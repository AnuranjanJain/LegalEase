from fastapi import FastAPI, HTTPException, UploadFile, File, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel
import os
import logging
from io import BytesIO
from typing import Optional

import time
import uuid

from dotenv import load_dotenv

from database import engine, Base
from routers import auth_routes

# Optional imports (wrap in try/except so server can start without optional deps)
try:
    import fitz  # PyMuPDF
except Exception:
    fitz = None

try:
    from docx import Document as DocxDocument  # type: ignore[import-untyped]
except Exception:
    DocxDocument = None  # type: ignore[assignment,misc]

# Import pipeline exceptions, validations, and service
from backend.core.exceptions import (
    AIError, ValidationError, ProviderError, TimeoutError, ServiceUnavailableError
)
from backend.core.validation import (
    validate_chat_input, validate_summarize_input, sanitize_text, validate_mime_and_bytes
)
from backend.services.ai_service import ai_service, correlation_id_var

#Middleware import 
from middleware.rate_limit import RateLimitMiddleware
# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

app = FastAPI()


# Exception Handlers to match standardized error contracts
@app.exception_handler(ValidationError)
async def validation_exception_handler(request: Request, exc: ValidationError):
    logger.warning(f"[{correlation_id_var.get()}] Validation error: {exc}")
    return JSONResponse(
        status_code=400,
        content={
            "error": "validation_error",
            "detail": str(exc),
            "correlation_id": correlation_id_var.get()
        }
    )


@app.exception_handler(ProviderError)
async def provider_exception_handler(request: Request, exc: ProviderError):
    logger.error(f"[{correlation_id_var.get()}] Upstream provider error: {exc}")
    return JSONResponse(
        status_code=502,
        content={
            "error": "provider_error",
            "detail": str(exc),
            "correlation_id": correlation_id_var.get()
        }
    )


@app.exception_handler(TimeoutError)
async def timeout_exception_handler(request: Request, exc: TimeoutError):
    logger.error(f"[{correlation_id_var.get()}] Request timeout: {exc}")
    return JSONResponse(
        status_code=504,
        content={
            "error": "timeout_error",
            "detail": str(exc),
            "correlation_id": correlation_id_var.get()
        }
    )


@app.exception_handler(ServiceUnavailableError)
async def service_unavailable_exception_handler(request: Request, exc: ServiceUnavailableError):
    logger.error(f"[{correlation_id_var.get()}] Service unavailable: {exc}")
    return JSONResponse(
        status_code=503,
        content={
            "error": "service_unavailable",
            "detail": str(exc),
            "correlation_id": correlation_id_var.get()
        }
    )


# Create database tables
Base.metadata.create_all(bind=engine)

# Include authentication router
app.include_router(auth_routes.router)


# Enable CORS for frontend communication
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
#Centralized rate-limit middleware
app.add_middleware(RateLimitMiddleware)


# Correlation ID middleware to inject trace headers
@app.middleware("http")
async def correlation_id_middleware(request: Request, call_next):
    corr_id = request.headers.get("X-Correlation-ID") or str(uuid.uuid4())
    token = correlation_id_var.set(corr_id)
    try:
        response = await call_next(request)
        response.headers["X-Correlation-ID"] = corr_id
        return response
    finally:
        correlation_id_var.reset(token)


# Configuration
MAX_UPLOAD_SIZE = int(os.getenv("MAX_UPLOAD_SIZE", str(25 * 1024 * 1024)))  # 25 MB default



# Simple in-memory rate limiter (per-IP and per-key)
class SimpleRateLimiter:
    def __init__(self, calls: int = 60, period: int = 60, env_calls_key: Optional[str] = None, env_period_key: Optional[str] = None):
        self.calls = calls
        self.period = period
        self.env_calls_key = env_calls_key
        self.env_period_key = env_period_key
        self.storage = {}

    def is_allowed(self, key: str) -> bool:
        calls = self.calls
        period = self.period
        if self.env_calls_key:
            calls = int(os.getenv(self.env_calls_key, str(self.calls)))
        if self.env_period_key:
            period = int(os.getenv(self.env_period_key, str(self.period)))

        now = time.time()
        window = now - period
        arr = self.storage.get(key, [])
        # prune
        arr = [t for t in arr if t > window]
        if len(arr) >= calls:
            self.storage[key] = arr
            return False
        arr.append(now)
        self.storage[key] = arr
        return True


# Defaults: 60 requests per minute per IP, 30 per minute per API key
ip_limiter = SimpleRateLimiter(
    calls=60, period=60,
    env_calls_key="RATE_LIMIT_IP_CALLS", env_period_key="RATE_LIMIT_PERIOD"
)
key_limiter = SimpleRateLimiter(
    calls=30, period=60,
    env_calls_key="RATE_LIMIT_KEY_CALLS", env_period_key="RATE_LIMIT_PERIOD"
)




# API keys and dev mode
API_KEYS = [k.strip() for k in os.getenv("API_KEYS", "").split(",") if k.strip()]
DEV_API_KEY = os.getenv("DEV_API_KEY", "dev-token")
ALLOW_DEV = os.getenv("ALLOW_DEV", "false").lower() in ("1", "true", "yes")

if ALLOW_DEV:
    logger.warning(
        "Development API authentication is enabled. "
        "Do not use in production."
    )


class ChatRequest(BaseModel):
    message: str
    context: Optional[str] = None
    conversation_history: Optional[list[dict[str, str]]] = None
    stream: Optional[bool] = False


class SummarizeRequest(BaseModel):
    text: str

def _validate_api_key(request: Request) -> str:
    # Accept header `Authorization: Bearer <key>` or `X-API-Key`
    auth = request.headers.get("authorization") or ""
    api_key = ""
    if auth.lower().startswith("bearer "):
        api_key = auth.split(" ", 1)[1].strip()
    else:
        api_key = request.headers.get("x-api-key", "").strip()

    if not api_key:
        raise HTTPException(status_code=401, detail="Missing API key")

    # Read config dynamically to support testing environments setting env vars
    api_keys = [k.strip() for k in os.getenv("API_KEYS", "").split(",") if k.strip()]
    allow_dev = os.getenv("ALLOW_DEV", "true").lower() in ("1", "true", "yes")
    dev_api_key = os.getenv("DEV_API_KEY", "dev-token")

    if api_keys and api_key not in api_keys:
        if allow_dev and api_key == dev_api_key:
            return api_key
        raise HTTPException(status_code=403, detail="Invalid API key")

    return api_key



@app.post("/chat")
async def chat(request: Request, payload: ChatRequest):
    # Auth
    api_key = _validate_api_key(request)


    # Rate limiting
    ip = _get_client_ip(request)
    if not ip_limiter.is_allowed(ip):
        raise HTTPException(status_code=429, detail="Rate limit exceeded for IP")
    if not key_limiter.is_allowed(api_key):
        raise HTTPException(status_code=429, detail="Rate limit exceeded for API key")

    # Sanitize inputs
    sanitized_message = sanitize_text(payload.message)
    sanitized_context = sanitize_text(payload.context) if payload.context else None

    if client is None:
        raise HTTPException(status_code=503, detail="AI service unavailable")


    # Early payload validation
    validate_chat_input(sanitized_message, sanitized_context)

    # Streaming or standard block handling
    if payload.stream:
        async def stream_generator():
            try:
                async for chunk in ai_service.generate_chat_response(
                    message=sanitized_message,
                    context=sanitized_context,
                    history=payload.conversation_history,
                    stream=True
                ):
                    yield chunk
            except Exception as e:
                logger.error(f"[{correlation_id_var.get()}] Stream generation error: {e}")
                yield "\n[Error: Inference stream failed]"

        return StreamingResponse(stream_generator(), media_type="text/event-stream")
    else:
        response_gen = ai_service.generate_chat_response(
            message=sanitized_message,
            context=sanitized_context,
            history=payload.conversation_history,
            stream=False
        )
        response_text = ""
        async for chunk in response_gen:
            response_text += chunk
        return {"response": response_text}


@app.post("/upload")
async def upload_document(request: Request, file: UploadFile = File(...)):
    # Auth
    api_key = _validate_api_key(request)
    # Content-Length pre-check
    try:
        content_length = int(request.headers.get("content-length", "0"))
    except Exception:
        content_length = 0
    if content_length and content_length > MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=413, detail="Uploaded file is too large")

    try:
        content = await file.read()
        if len(content) > MAX_UPLOAD_SIZE:
            raise HTTPException(status_code=413, detail="Uploaded file is too large")

        filename = file.filename or "unknown"
        file_extension = os.path.splitext(filename)[1].lower()
        extracted_text = ""

        # Perform MIME-aware preprocessing and signature validation
        validate_mime_and_bytes(content, file.content_type or "", filename)

        # Process by type
        if file_extension == '.pdf' or content.startswith(b'%PDF-'):
            if fitz is None:
                raise HTTPException(status_code=503, detail="PDF processing not available")
            try:
                doc = fitz.open(stream=content, filetype="pdf")
                for page in doc:
                    extracted_text += page.get_text()
            except Exception as e:
                logger.error(f"PDF parse error: {e}")
                raise HTTPException(status_code=400, detail="Invalid or corrupted PDF")

        elif file_extension == '.docx':
            if DocxDocument is None:
                raise HTTPException(status_code=503, detail="DOCX processing not available")
            try:
                doc = DocxDocument(BytesIO(content))
                extracted_text = "\n".join(
                    para.text
                    for para in doc.paragraphs
                    if para.text.strip()
                )
            except Exception:
                raise HTTPException(
                    status_code=400,
                    detail="Invalid or corrupted DOCX file."
                )

        elif file_extension == '.txt':
            extracted_text = content.decode('utf-8')

        # Truncate extracted text to avoid sending huge payloads to models
        extracted_text = extracted_text[:10000]

        return {"filename": filename, "text": extracted_text}

    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Upload error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to process document")


@app.post("/summarize")
async def summarize(request: Request, payload: SummarizeRequest):
    # Auth
    api_key = _validate_api_key(request)


    # Rate limiting
    ip = _get_client_ip(request)
    if not ip_limiter.is_allowed(ip):
        raise HTTPException(status_code=429, detail="Rate limit exceeded for IP")
    if not key_limiter.is_allowed(api_key):
        raise HTTPException(status_code=429, detail="Rate limit exceeded for API key")

    # Sanitize input
    sanitized_text = sanitize_text(payload.text)

    # Early payload validation
    validate_summarize_input(sanitized_text)

    summary = await ai_service.generate_summary(sanitized_text)
    return {"summary": summary}


@app.get("/health")
async def health():
    return ai_service.check_health()


    if client is None:
        raise HTTPException(status_code=503, detail="AI service unavailable")

    try:
        model = client.model("inference-net/Schematron-3B")

        prompt = (
            "Summarize the following legal text clearly and concisely:\n\n"
            f"{payload.text[:2000]}"
        )
        messages = [{"role": "user", "content": prompt}]

        output = model.run(messages)

        if hasattr(output, 'error') and output.error:
            logger.error(f"Summarization model error: {output.error}")
            raise HTTPException(status_code=503, detail="Failed to generate summary.")
        return {"summary": output.output if hasattr(output, 'output') else str(output)}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Summarization error: {e}", exc_info=True)
        try:
            # Fallback to the upstream extractive summarizer if the primary path fails.
            summary_model = client.model("Jnjnpx/fine-tuned-bert-extractive-summarization")
            fallback_output = summary_model.run(payload.text[:512])

            if hasattr(fallback_output, 'error') and fallback_output.error:
                logger.error(f"Summarizer model error: {fallback_output.error}")
                raise HTTPException(status_code=503, detail="Failed to generate summary.")

            return {"summary": fallback_output.output if hasattr(fallback_output, 'output') else str(fallback_output)}
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(status_code=503, detail="Failed to generate summary.")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)



# Health endpoint
@app.get("/health")
async def health():
    status = "ok"
    details = {"bytez": bool(client)}
    if not client:
        status = "degraded"
    return {"status": status, "details": details}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

