import logging
import os
import hashlib
import uuid
from datetime import datetime, timedelta
from typing import Optional, Union, Literal
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
import bcrypt
from sqlalchemy.orm import Session
from dotenv import load_dotenv

from backend.database import get_db
from backend import models

load_dotenv()

logger = logging.getLogger(__name__)

SECRET_KEY = os.getenv("JWT_SECRET_KEY")
if not SECRET_KEY:
    logger.critical(
        "JWT_SECRET_KEY is not configured. Authentication startup is aborted."
    )
    raise RuntimeError(
        "JWT_SECRET_KEY is required for authentication. Set JWT_SECRET_KEY before starting the application."
    )

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")


class AuthIdentity:
    """
    Unified identity model for authenticated principals.
    Distinguishes between user accounts and API key/service callers.
    """
    def __init__(
        self,
        identity_type: Literal["user", "api_key"],
        identifier: str,
        user: Optional[models.User] = None
    ):
        self.type = identity_type
        self.identifier = identifier
        self.user = user

    def is_user(self) -> bool:
        """Check if this identity represents a user account."""
        return self.type == "user"

    def is_api_key(self) -> bool:
        """Check if this identity represents an API key/service caller."""
        return self.type == "api_key"

    def get_rate_limit_key(self) -> str:
        """
        Get a consistent key for rate limiting.
        Users are rate-limited by email, API keys by their key identifier.
        """
        if self.type == "user":
            return f"user:{self.identifier}"
        else:
            return f"api_key:{self.identifier}"

    def get_user_id(self) -> Optional[int]:
        """
        Get the database user ID if this is a user identity.
        Returns None for API key identities.
        """
        return self.user.id if self.user else None

    def get_user_email(self) -> Optional[str]:
        """
        Get the user email if this is a user identity.
        Returns None for API key identities.
        """
        return self.user.email if self.user else None

    def __str__(self) -> str:
        """String representation for logging/debugging."""
        if self.type == "user":
            return f"User(email={self.identifier})"
        else:
            return f"APIKey(key={self.identifier[:8]}...)"


def _require_secret_key() -> str:
    if not SECRET_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service unavailable.",
        )
    return SECRET_KEY


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
    secret_key = _require_secret_key()
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta if expires_delta else timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS))
    to_encode.update({
        "exp": expire,
        "jti": str(uuid.uuid4()),  # unique token ID — used for revocation
    })
    return jwt.encode(to_encode, secret_key, algorithm=ALGORITHM)


def is_token_revoked(jti: str, db: Session) -> bool:
    """Return True if the token's jti is present in the revocation table."""
    from backend.models import RevokedToken  # local import avoids circular deps
    return db.query(RevokedToken).filter(RevokedToken.jti == jti).first() is not None


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> AuthIdentity:
    """Decode a JWT and return the matching user as AuthIdentity, or raise 401."""
    secret_key = _require_secret_key()
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, secret_key, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
        jti: Optional[str] = payload.get("jti")
        if jti and is_token_revoked(jti, db):
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(models.User).filter(models.User.email == email).first()
    if user is None:
        raise credentials_exception
    return AuthIdentity(
        identity_type="user",
        identifier=email,
        user=user
    )


def extract_jwt_from_authorization(request: Request) -> Optional[str]:
    """Extract JWT token from Authorization: Bearer header only.
    
    Returns the token if Authorization header exists and starts with 'Bearer ',
    otherwise returns None.
    """
    auth = request.headers.get("authorization", "")
    if auth.lower().startswith("bearer "):
        return auth.split(" ", 1)[1].strip()
    return None


def extract_api_key(request: Request) -> Optional[str]:
    """Extract API key from X-API-Key header only.
    
    Returns the API key if X-API-Key header exists, otherwise returns None.
    """
    return request.headers.get("x-api-key", "").strip() or None


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


def validate_token_or_api_key(request: Request, db: Session = Depends(get_db)) -> AuthIdentity:
    """
    Unified auth dependency for protected endpoints.
    Authentication mode is determined by header type, not token parsing.
    
    JWT Authentication: Authorization: Bearer <token>
    API Key Authentication: X-API-Key: <key>
    
    Returns an AuthIdentity object with clear type distinction.
    Rejects requests with both headers (ambiguous authentication).
    """
    jwt_token = extract_jwt_from_authorization(request)
    api_key = extract_api_key(request)
    
    # Reject ambiguous authentication (both headers present)
    if jwt_token and api_key:
        raise HTTPException(
            status_code=400, 
            detail="Ambiguous authentication: provide either Authorization: Bearer or X-API-Key, not both"
        )
    
    # JWT authentication path
    if jwt_token:
        if not SECRET_KEY:
            raise HTTPException(
                status_code=503, 
                detail="Authentication service unavailable"
            )
        try:
            payload = jwt.decode(jwt_token, SECRET_KEY, algorithms=[ALGORITHM])
            email: Optional[str] = payload.get("sub")
            jti: Optional[str] = payload.get("jti")
            if email and not (jti and is_token_revoked(jti, db)):
                user = db.query(models.User).filter(models.User.email == email).first()
                if user:
                    return AuthIdentity(
                        identity_type="user",
                        identifier=email,
                        user=user
                    )
        except JWTError:
            raise HTTPException(
                status_code=401, 
                detail="Invalid or expired JWT token"
            )
        raise HTTPException(
            status_code=401, 
            detail="Invalid or expired JWT token"
        )
    
    # API key authentication path
    if api_key:
        if _is_valid_api_key(api_key):
            # Hash the API key to avoid storing the secret in memory
            # Use SHA-256 and take first 16 characters as identifier
            key_hash = hashlib.sha256(api_key.encode()).hexdigest()[:16]
            return AuthIdentity(
                identity_type="api_key",
                identifier=key_hash,
                user=None
            )
        raise HTTPException(
            status_code=403, 
            detail="Invalid API key"
        )
    
    # No authentication provided
    raise HTTPException(
        status_code=401, 
        detail="Missing authentication: provide Authorization: Bearer or X-API-Key header"
    )


def _validate_api_key(request: Request) -> str:
    """
    API key-only validation helper (used for testing).
    Extracts API key from X-API-Key header only,
    validates it against configured static API keys, and returns
    the key if valid. Raises HTTPException for missing or invalid keys.
    """
    api_key = extract_api_key(request)
    if not api_key:
        raise HTTPException(status_code=401, detail="Missing API key")

    if _is_valid_api_key(api_key):
        return api_key

    raise HTTPException(status_code=403, detail="Invalid API key")


def get_optional_user(request: Request, db: Session = Depends(get_db)) -> Optional[AuthIdentity]:
    """Try to extract a JWT-authenticated user from the request.

    Returns an AuthIdentity object if the caller provided a valid JWT token
    via Authorization: Bearer header, or None otherwise.
    This allows endpoints to conditionally persist history for real users
    without breaking API-key authentication.
    """
    jwt_token = extract_jwt_from_authorization(request)
    if not jwt_token or not SECRET_KEY:
        return None
    try:
        payload = jwt.decode(jwt_token, SECRET_KEY, algorithms=[ALGORITHM])
        email: Optional[str] = payload.get("sub")
        jti: Optional[str] = payload.get("jti")
        if email and not (jti and is_token_revoked(jti, db)):
            user = db.query(models.User).filter(models.User.email == email).first()
            if user:
                return AuthIdentity(
                    identity_type="user",
                    identifier=email,
                    user=user
                )
    except JWTError:
        pass
    return None