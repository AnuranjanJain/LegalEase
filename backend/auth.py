import os
import hashlib
import secrets
import json
import logging
from typing import Tuple, Dict
from fastapi import Request, HTTPException, status
from dotenv import load_dotenv

# Configure logging
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Active sessions mapping token -> email
ACTIVE_SESSIONS: Dict[str, str] = {}

def get_api_keys() -> list:
    return [k.strip() for k in os.getenv("API_KEYS", "").split(",") if k.strip()]

def get_dev_api_key() -> str:
    return os.getenv("DEV_API_KEY", "dev-token")

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

def hash_password(password: str) -> Tuple[str, str]:
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

def is_dev_allowed() -> bool:
    """
    Explicitly gate development mode behavior.
    It must only be enabled if:
    1. ALLOW_DEV is True
    2. AND the APP_ENV environment variable is not 'production'
    """
    app_env = os.getenv("APP_ENV", "development").lower()
    if app_env == "production":
        return False
    allow_dev = os.getenv("ALLOW_DEV", "true").lower() in ("1", "true", "yes")
    return allow_dev

def validate_token_or_api_key(request: Request) -> str:
    """
    Centralized validation mechanism used consistently across protected endpoints.
    Accepts Bearer token in 'Authorization' header or a key in 'X-API-Key' header.
    """
    auth = request.headers.get("authorization") or ""
    api_key = ""
    if auth.lower().startswith("bearer "):
        api_key = auth.split(" ", 1)[1].strip()
    else:
        api_key = request.headers.get("x-api-key", "").strip()

    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing API key"
        )

    # 1. Check if the token is a valid active user session (from login flow)
    if api_key in ACTIVE_SESSIONS:
        return api_key

    # 2. Check if the token matches the configured API keys
    api_keys = get_api_keys()
    if api_keys and api_key not in api_keys:
        if is_dev_allowed() and api_key == get_dev_api_key():
            return api_key
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid API key"
        )

    return api_key
