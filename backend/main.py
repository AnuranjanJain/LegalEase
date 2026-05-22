from fastapi import FastAPI, HTTPException, UploadFile, File, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import logging
import base64
from io import BytesIO
from typing import Optional
import time
import hashlib
import secrets
import json
from dotenv import load_dotenv

# Optional imports (wrap in try/except so server can start without optional deps)
try:
    import fitz  # PyMuPDF
except Exception:
    fitz = None

try:
    from docx import Document as DocxDocument  # type: ignore[import-untyped]
except Exception:
    DocxDocument = None  # type: ignore[assignment,misc]

try:
    from bytez import Bytez  # pyright: ignore[reportMissingImports]
except Exception:
    Bytez = None
    # Bytez SDK not available or misconfigured; we'll degrade gracefully.

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

app = FastAPI()

# Enable CORS for frontend communication
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Bytez SDK
BYTEZ_API_KEY = os.getenv("BYTEZ_API_KEY")

# Initialize Bytez client if available and configured; otherwise degrade gracefully
client = None
if BYTEZ_API_KEY and Bytez is not None:
    try:
        client = Bytez(BYTEZ_API_KEY)
        logger.info("Bytez client initialized")
    except Exception as e:
        logger.error(f"Failed to initialize Bytez client: {e}")
        client = None
else:
    logger.warning("BYTEZ_API_KEY not configured or Bytez SDK unavailable. AI features disabled.")

# Configuration
MAX_UPLOAD_SIZE = int(os.getenv("MAX_UPLOAD_SIZE", str(25 * 1024 * 1024)))  # 25 MB default
MAX_MODEL_INPUT_CHARS = int(os.getenv("MAX_MODEL_INPUT_CHARS", "2000"))

# Simple in-memory rate limiter (per-IP and per-key)
class SimpleRateLimiter:
    def __init__(self, calls: int, period: int):
        self.calls = calls
        self.period = period
        self.storage = {}

    def is_allowed(self, key: str) -> bool:
        now = time.time()
        window = now - self.period
        arr = self.storage.get(key, [])
        # prune
        arr = [t for t in arr if t > window]
        if len(arr) >= self.calls:
            self.storage[key] = arr
            return False
        arr.append(now)
        self.storage[key] = arr
        return True

# Defaults: 60 requests per minute per IP, 30 per minute per API key
ip_limiter = SimpleRateLimiter(int(os.getenv("RATE_LIMIT_IP_CALLS", "60")), int(os.getenv("RATE_LIMIT_PERIOD", "60")))
key_limiter = SimpleRateLimiter(int(os.getenv("RATE_LIMIT_KEY_CALLS", "30")), int(os.getenv("RATE_LIMIT_PERIOD", "60")))

# API keys and dev mode
API_KEYS = [k.strip() for k in os.getenv("API_KEYS", "").split(",") if k.strip()]
DEV_API_KEY = os.getenv("DEV_API_KEY", "dev-token")
ALLOW_DEV = os.getenv("ALLOW_DEV", "true").lower() in ("1", "true", "yes")

class UserRegister(BaseModel):
    email: str
    password: str
    first_name: str
    last_name: str

class UserLogin(BaseModel):
    email: str
    password: str

# Active sessions mapping token -> email
ACTIVE_SESSIONS = {}

USERS_FILE = os.path.join(os.path.dirname(__file__), "users.json")

def load_users() -> dict:
    if not os.path.exists(USERS_FILE):
        return {}
    try:
        with open(USERS_FILE, "r") as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Error loading users.json: {e}")
        return {}

def save_users(users: dict):
    try:
        with open(USERS_FILE, "w") as f:
            json.dump(users, f, indent=4)
    except Exception as e:
        logger.error(f"Error saving users.json: {e}")

def hash_password(password: str) -> tuple[str, str]:
    salt = secrets.token_hex(16)
    pwd_hash = hashlib.pbkdf2_hmac(
        'sha256',
        password.encode('utf-8'),
        salt.encode('utf-8'),
        100000
    ).hex()
    return pwd_hash, salt

def verify_password(password: str, pwd_hash: str, salt: str) -> bool:
    compare_hash = hashlib.pbkdf2_hmac(
        'sha256',
        password.encode('utf-8'),
        salt.encode('utf-8'),
        100000
    ).hex()
    return secrets.compare_digest(pwd_hash, compare_hash)

class ChatRequest(BaseModel):
    message: str
    context: Optional[str] = None
    conversation_history: Optional[list[dict[str, str]]] = None


class SummarizeRequest(BaseModel):
    text: str


def _get_client_ip(request: Request) -> str:
    try:
        return request.client.host
    except Exception:
        return "unknown"


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

    # If the token is a valid active user session, accept it
    if api_key in ACTIVE_SESSIONS:
        return api_key

    if API_KEYS and api_key not in API_KEYS:
        if ALLOW_DEV and api_key == DEV_API_KEY:
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

    if client is None:
        raise HTTPException(status_code=503, detail="AI service unavailable")

    try:
        model = client.model("inference-net/Schematron-3B")

        # Build prompt combining document context and/or conversation history
        parts = []
        if payload.context:
            parts.append(f"Context from document:\n{payload.context}")
        if payload.conversation_history:
            history_text = "\n".join([
                f"{msg['role']}: {msg['content']}"
                for msg in payload.conversation_history[-10:]
            ])
            parts.append(f"Previous conversation:\n{history_text}")
        parts.append(f"Current question: {payload.message}")
        prompt = "\n\n".join(parts)

        # Truncate to model input limit
        if len(prompt) > MAX_MODEL_INPUT_CHARS:
            prompt = prompt[:MAX_MODEL_INPUT_CHARS]

        messages = [{"role": "user", "content": prompt}]

        output = model.run(messages)

        if hasattr(output, 'error') and output.error:
            logger.error(f"Model error: {output.error}")

            raise HTTPException(
                status_code=503,
                detail="AI chatbot service is currently unavailable."
            )

        return {"response": output.output}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"Error processing chat request: {str(e)}",
            exc_info=True
        )

        raise HTTPException(
            status_code=503,
            detail="AI chatbot service is currently unavailable."
        )

@app.post("/upload")
async def upload_document(request: Request, file: UploadFile = File(...)):
    # Auth
    api_key = _validate_api_key(request)

    # Rate limiting
    ip = _get_client_ip(request)
    if not ip_limiter.is_allowed(ip):
        raise HTTPException(status_code=429, detail="Rate limit exceeded for IP")
    if not key_limiter.is_allowed(api_key):
        raise HTTPException(status_code=429, detail="Rate limit exceeded for API key")

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

        # Validate by magic bytes / simple signatures
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

        else:
            raise HTTPException(
                status_code=400,
                detail="Unsupported file type."
            )

        # Truncate extracted text to avoid sending huge payloads to models
        extracted_text = extracted_text[:10000]

        return {"filename": filename, "text": extracted_text}

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

    if client is None:
        raise HTTPException(status_code=503, detail="AI service unavailable")

    try:
        if client is None:
            raise HTTPException(
                status_code=503,
                detail="Summarization service unavailable because API key is not configured."
            )

        # Use a summarization model from Bytez

        return {"summary": output.output if hasattr(output, 'output') else str(output)}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Summarization error: {e}", exc_info=True)

@app.post("/auth/register")
async def register(payload: UserRegister):
    users = load_users()
    email = payload.email.strip().lower()
    if email in users:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    pwd_hash, salt = hash_password(payload.password)
    users[email] = {
        "email": email,
        "first_name": payload.first_name.strip(),
        "last_name": payload.last_name.strip(),
        "password_hash": pwd_hash,
        "salt": salt
    }
    save_users(users)
    return {"status": "ok", "message": "User registered successfully"}

@app.post("/auth/login")
async def login(payload: UserLogin):
    users = load_users()
    email = payload.email.strip().lower()
    if email not in users:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    user = users[email]
    if not verify_password(payload.password, user["password_hash"], user["salt"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    token = secrets.token_hex(32)
    ACTIVE_SESSIONS[token] = email
    
    return {
        "token": token,
        "user": {
            "email": user["email"],
            "firstName": user["first_name"],
            "lastName": user["last_name"]
        }
    }

@app.post("/auth/logout")
async def logout(request: Request):
    auth = request.headers.get("authorization") or ""
    token = ""
    if auth.lower().startswith("bearer "):
        token = auth.split(" ", 1)[1].strip()
    
    if token in ACTIVE_SESSIONS:
        del ACTIVE_SESSIONS[token]
        return {"status": "ok", "message": "Logged out successfully"}
    
    raise HTTPException(status_code=401, detail="Invalid or missing session token")

@app.get("/auth/me")
async def get_me(request: Request):
    auth = request.headers.get("authorization") or ""
    token = ""
    if auth.lower().startswith("bearer "):
        token = auth.split(" ", 1)[1].strip()
        
    if not token or token not in ACTIVE_SESSIONS:
        raise HTTPException(status_code=401, detail="Not authenticated")
        
    email = ACTIVE_SESSIONS[token]
    users = load_users()
    user = users.get(email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    return {
        "email": user["email"],
        "firstName": user["first_name"],
        "lastName": user["last_name"]
    }

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
