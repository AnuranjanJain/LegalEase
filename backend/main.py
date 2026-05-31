from fastapi import FastAPI, HTTPException, UploadFile, File, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel
import asyncio
import os
import logging
import tempfile
from typing import Optional

import time
import uuid

from dotenv import load_dotenv

from backend.database import engine, Base
from backend.routers import auth_routes

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
    validate_chat_input, validate_summarize_input, sanitize_text, validate_mime_and_bytes,
    validate_docx_archive_safety
)
from backend.services.ai_service import ai_service, correlation_id_var

#Middleware import 
from backend.middleware.rate_limit import RateLimitMiddleware
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
raw_allowed_origins = os.getenv("ALLOWED_ORIGINS") or os.getenv(
    "FRONTEND_URL",
    "http://localhost:5173"
)
ALLOWED_ORIGINS = [
    origin.strip()
    for origin in raw_allowed_origins.split(",")
    if origin.strip()
]
# Rate-limit middleware registered first so that CORSMiddleware
# (added second) wraps it — ensuring 429 responses include CORS headers.
app.add_middleware(RateLimitMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
logger.info(f"Allowed frontend origins: {ALLOWED_ORIGINS}")


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
CHUNK_SIZE = 1024 * 1024
UPLOAD_PARSE_TIMEOUT_SECONDS = float(os.getenv("UPLOAD_PARSE_TIMEOUT_SECONDS", "5"))
MAX_PDF_PAGES = int(os.getenv("MAX_PDF_PAGES", "100"))
MAX_DOCX_PARAGRAPHS = int(os.getenv("MAX_DOCX_PARAGRAPHS", "2000"))



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
    calls=300, period=60,
    env_calls_key="RATE_LIMIT_KEY_CALLS", env_period_key="RATE_LIMIT_PERIOD"
)




# API keys and dev mode
API_KEYS = [k.strip() for k in os.getenv("API_KEYS", "").split(",") if k.strip()]
# Require explicit DEV_API_KEY configuration — no guessable default
DEV_API_KEY = os.getenv("DEV_API_KEY", "")
ALLOW_DEV = os.getenv("ALLOW_DEV", "false").lower() in ("1", "true", "yes")

if not API_KEYS:
    logger.warning(
        "API_KEYS is not configured. "
        "Authentication fallback behavior is active."
    )

if ALLOW_DEV:
    if not DEV_API_KEY:
        logger.error(
            "ALLOW_DEV is enabled but DEV_API_KEY is not set. "
            "Refusing to start with insecure configuration. "
            "Set DEV_API_KEY to a strong, unique value."
        )
        raise RuntimeError(
            "ALLOW_DEV=true requires DEV_API_KEY to be explicitly configured."
        )
    if API_KEYS:
        logger.warning(
            "ALLOW_DEV is enabled alongside API_KEYS. "
            "Dev auth fallback is active — do not use in production."
        )
    else:
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

    api_keys = API_KEYS
    allow_dev = ALLOW_DEV
    dev_api_key = DEV_API_KEY

    if api_keys and api_key not in api_keys:
        if allow_dev and api_key == dev_api_key:
            return api_key
        raise HTTPException(status_code=403, detail="Invalid API key")

    return api_key


def _get_client_ip(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        return forwarded_for.split(",", 1)[0].strip()
    return request.client.host if request.client else "unknown"


async def _run_bounded_parser(parser_callable):
    try:
        return await asyncio.wait_for(
            asyncio.to_thread(parser_callable),
            timeout=UPLOAD_PARSE_TIMEOUT_SECONDS,
        )
    except asyncio.TimeoutError:
        raise HTTPException(status_code=413, detail="Document parsing exceeded the allowed processing time")


@app.post("/chat")
async def chat(request: Request, payload: ChatRequest):
    # Auth
    api_key = _validate_api_key(request)

    if not key_limiter.is_allowed(api_key):
        raise HTTPException(status_code=429, detail="Rate limit exceeded")

    # Sanitize inputs
    sanitized_message = sanitize_text(payload.message)
    sanitized_context = sanitize_text(payload.context) if payload.context else None

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

    temp_path = None
    try:
        filename = file.filename or "unknown"
        file_extension = os.path.splitext(filename)[1].lower()
        extracted_text = ""
        total_size = 0
        with tempfile.NamedTemporaryFile(delete=False, suffix=file_extension or "") as temp_file:
            temp_path = temp_file.name
            while True:
                chunk = await file.read(CHUNK_SIZE)
                if not chunk:
                    break
                total_size += len(chunk)
                if total_size > MAX_UPLOAD_SIZE:
                    raise HTTPException(status_code=413, detail="Uploaded file is too large")
                temp_file.write(chunk)

        with open(temp_path, "rb") as temp_file:
            content_prefix = temp_file.read(4096)

        # Perform MIME-aware preprocessing and signature validation using only the
        # minimum bytes needed for structural checks.
        validate_mime_and_bytes(content_prefix, file.content_type or "", filename)

        # Process by type from the temporary on-disk file.
        if file_extension == '.pdf' or content_prefix.startswith(b'%PDF-'):
            if fitz is None:
                raise HTTPException(status_code=503, detail="PDF processing not available")
            try:
                def parse_pdf():
                    doc = fitz.open(temp_path)
                    try:
                        if doc.page_count > MAX_PDF_PAGES:
                            raise HTTPException(status_code=413, detail="PDF exceeds the maximum allowed page count")
                        text_parts = []
                        for page in doc:
                            text_parts.append(page.get_text())
                        return "".join(text_parts)
                    finally:
                        doc.close()

                extracted_text = await _run_bounded_parser(parse_pdf)
            except Exception as e:
                if isinstance(e, HTTPException):
                    raise
                logger.error(f"PDF parse error: {e}")
                raise HTTPException(status_code=400, detail="Invalid or corrupted PDF")

        elif file_extension == '.docx':
            if DocxDocument is None:
                raise HTTPException(status_code=503, detail="DOCX processing not available")
            try:
                validate_docx_archive_safety(temp_path)

                def parse_docx():
                    doc = DocxDocument(temp_path)
                    if len(doc.paragraphs) > MAX_DOCX_PARAGRAPHS:
                        raise HTTPException(status_code=413, detail="DOCX exceeds the maximum allowed paragraph count")
                    return "\n".join(
                        para.text
                        for para in doc.paragraphs
                        if para.text.strip()
                    )

                extracted_text = await _run_bounded_parser(parse_docx)
            except Exception as e:
                if isinstance(e, HTTPException):
                    raise
                raise HTTPException(
                    status_code=400,
                    detail="Invalid or corrupted DOCX file."
                )

        elif file_extension == '.txt':
            with open(temp_path, 'r', encoding='utf-8') as text_file:
                extracted_text = text_file.read(10000)

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
    finally:
        if temp_path and os.path.exists(temp_path):
            try:
                os.unlink(temp_path)
            except OSError:
                pass


@app.post("/summarize")
async def summarize(request: Request, payload: SummarizeRequest):
    # Auth
    api_key = _validate_api_key(request)

    # Sanitize input
    sanitized_text = sanitize_text(payload.text)

    # Early payload validation
    validate_summarize_input(sanitized_text)

    summary = await ai_service.generate_summary(sanitized_text)
    return {"summary": summary}


@app.get("/health")
async def health():
    return ai_service.check_health()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
