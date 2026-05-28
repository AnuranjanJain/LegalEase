import os
import logging
from datetime import datetime, timedelta
from typing import Optional
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
import bcrypt
from sqlalchemy.orm import Session
from dotenv import load_dotenv

from database import get_db
import models

load_dotenv()

logger = logging.getLogger(__name__)

# Require JWT_SECRET_KEY to be set in environment
SECRET_KEY = os.getenv("JWT_SECRET_KEY")
if not SECRET_KEY:
    raise ValueError("JWT_SECRET_KEY environment variable is not set! Please define it in your .env file or environment.")

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(
        plain_password.encode("utf-8"),
        hashed_password.encode("utf-8")
    )


def get_password_hash(password: str) -> str:
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta if expires_delta else timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    """Decode a JWT and return the matching user, or raise 401."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(models.User).filter(models.User.email == email).first()
    if user is None:
        raise credentials_exception
    return user


def _extract_bearer_token(request: Request) -> str:
    """Pull the bearer token from Authorization or X-API-Key headers."""
    auth = request.headers.get("authorization") or ""
    if auth.lower().startswith("bearer "):
        return auth.split(" ", 1)[1].strip()
    return request.headers.get("x-api-key", "").strip()


def _is_valid_api_key(token: str) -> bool:
    """Check whether the token is a recognised static API key."""
    api_keys = [k.strip() for k in os.getenv("API_KEYS", "").split(",") if k.strip()]
    allow_dev = os.getenv("ALLOW_DEV", "false").lower() in ("1", "true", "yes")
    dev_api_key = os.getenv("DEV_API_KEY", "dev-token")

    if api_keys and token in api_keys:
        return True
    if allow_dev and token == dev_api_key:
        return True
    return False


def validate_token_or_api_key(request: Request, db: Session = Depends(get_db)) -> str:
    """
    Unified auth dependency for protected endpoints.
    Tries JWT authentication first; falls back to static API key
    validation for service-to-service callers.
    Returns the authenticated identity (user email or API key).
    """
    token = _extract_bearer_token(request)
    if not token:
        raise HTTPException(status_code=401, detail="Missing authentication token")

    # 1. Try JWT decode
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: Optional[str] = payload.get("sub")
        if email:
            user = db.query(models.User).filter(models.User.email == email).first()
            if user:
                return email
    except JWTError:
        pass

    # 2. Fall back to static API key
    if _is_valid_api_key(token):
        return token

    raise HTTPException(status_code=403, detail="Invalid or expired authentication token")
