import logging
import os
import hashlib
import uuid
import secrets
import json
from datetime import datetime, timedelta
from typing import Optional, Union, Literal
from fastapi import Depends, HTTPException, Request, status, Response
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
import bcrypt
from sqlalchemy.orm import Session
from dotenv import load_dotenv

from backend.database import get_db
from backend import models
from backend.config import get_settings

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
        user: Optional[models.User] = None,
        scopes: Optional[list] =None,
    ):
        self.type = identity_type
        self.identifier = identifier
        self.user = user
        self.scopes = scopes 

    def has_scope(self, scope: str) -> bool:
        if self.scopes is None:
            return True  # JWT users and the static/global key remain unrestricted
        return scope in self.scopes

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

def generate_api_key() -> str:
    """Generate a new plaintext API key. Shown to the user exactly once."""
    return f"legalease_{secrets.token_urlsafe(32)}"


def hash_api_key(key: str) -> str:
    """Hash a key for storage/lookup — same SHA-256 scheme already used
    for static API key identifiers in _validate_api_key_token."""
    return hashlib.sha256(key.encode()).hexdigest()

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


def create_refresh_token(data: dict, db: Session, expires_delta: Optional[timedelta] = None) -> str:
    """
    Create a refresh token and store it in the database for revocation support.
    
    Refresh tokens are longer-lived JWTs used to obtain new access tokens.
    They are stored in the database to enable revocation and rotation.
    
    Args:
        data: Dictionary containing token claims (must include 'sub' for user email)
        db: Database session for storing the refresh token
        expires_delta: Optional custom expiration time
        
    Returns:
        The refresh token JWT string
    """
    secret_key = _require_secret_key()
    settings = get_settings()
    
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta if expires_delta else timedelta(days=settings.security.refresh_token_expire_days))
    to_encode.update({
        "exp": expire,
        "jti": str(uuid.uuid4()),  # unique token ID for revocation
        "type": "refresh",  # token type claim
    })
    
    token = jwt.encode(to_encode, secret_key, algorithm=ALGORITHM)
    jti = to_encode["jti"]
    user_email = to_encode.get("sub")
    
    if not user_email:
        raise ValueError("Refresh token must include 'sub' claim (user email)")
    
    # Get user ID from email
    user = db.query(models.User).filter(models.User.email == user_email).first()
    if not user:
        raise ValueError(f"User not found for email: {user_email}")
    
    # Store refresh token in database
    refresh_token_record = models.RefreshToken(
        user_id=user.id,
        token_jti=jti,
        expires_at=expire,
    )
    db.add(refresh_token_record)
    db.commit()
    
    logger.info(f"Refresh token created for user {user_email} (jti={jti})")
    return token


def validate_refresh_token(token: str, db: Session) -> dict:
    """
    Validate a refresh token and return its payload if valid.
    
    Performs comprehensive validation:
    - Signature verification
    - Expiration check
    - Token type verification
    - Database revocation check
    - User existence verification
    
    Args:
        token: The refresh token JWT string
        db: Database session for revocation check
        
    Returns:
        The decoded token payload
        
    Raises:
        HTTPException: If token is invalid for any reason
    """
    secret_key = _require_secret_key()
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid refresh token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        payload = jwt.decode(token, secret_key, algorithms=[ALGORITHM])
    except JWTError as e:
        logger.warning(f"Refresh token JWT decode failed: {str(e)}")
        raise credentials_exception
    
    # Verify token type
    token_type = payload.get("type")
    if token_type != "refresh":
        logger.warning(f"Invalid token type: {token_type} (expected 'refresh')")
        raise credentials_exception
    
    # Verify subject
    email = payload.get("sub")
    if not email:
        logger.warning("Refresh token missing subject claim")
        raise credentials_exception
    
    # Verify jti
    jti = payload.get("jti")
    if not jti:
        logger.warning("Refresh token missing jti claim")
        raise credentials_exception
    
    # Check if token is revoked in database
    refresh_token_record = db.query(models.RefreshToken).filter(
        models.RefreshToken.token_jti == jti
    ).first()
    
    if not refresh_token_record:
        logger.warning(f"Refresh token not found in database (jti={jti})")
        raise credentials_exception
    
    if refresh_token_record.revoked_at is not None:
        logger.warning(f"Refresh token has been revoked (jti={jti})")
        raise credentials_exception
    
    # Check expiration (double-check with database)
    if datetime.utcnow() > refresh_token_record.expires_at:
        logger.warning(f"Refresh token expired (jti={jti})")
        raise credentials_exception
    
    # Verify user still exists
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        logger.warning(f"Refresh token valid but user not found (email={email})")
        raise credentials_exception
    
    logger.info(f"Refresh token validated for user {email} (jti={jti})")
    return payload


def revoke_refresh_token(jti: str, db: Session) -> bool:
    """
    Revoke a refresh token by marking it as revoked in the database.
    
    Args:
        jti: The JWT ID of the refresh token to revoke
        db: Database session
        
    Returns:
        True if token was revoked, False if not found
    """
    refresh_token = db.query(models.RefreshToken).filter(
        models.RefreshToken.token_jti == jti
    ).first()
    
    if not refresh_token:
        logger.warning(f"Refresh token not found for revocation (jti={jti})")
        return False
    
    if refresh_token.revoked_at is not None:
        logger.info(f"Refresh token already revoked (jti={jti})")
        return True
    
    refresh_token.revoked_at = datetime.utcnow()
    db.commit()
    
    logger.info(f"Refresh token revoked (jti={jti})")
    return True


def rotate_refresh_token(old_jti: str, new_token: str, db: Session) -> bool:
    """
    Rotate a refresh token by marking the old one as replaced by the new one.
    
    This enables detection of replay attacks - if an old refresh token
    is used after rotation, it will be rejected.
    
    Args:
        old_jti: The JWT ID of the old refresh token
        new_token: The new refresh token JWT string
        db: Database session
        
    Returns:
        True if rotation succeeded, False otherwise
    """
    # Extract jti from new token
    try:
        secret_key = _require_secret_key()
        new_payload = jwt.decode(new_token, secret_key, algorithms=[ALGORITHM])
        new_jti = new_payload.get("jti")
        if not new_jti:
            logger.error("New refresh token missing jti claim")
            return False
    except JWTError as e:
        logger.error(f"Failed to decode new refresh token: {str(e)}")
        return False
    
    # Update old token record
    old_token = db.query(models.RefreshToken).filter(
        models.RefreshToken.token_jti == old_jti
    ).first()
    
    if not old_token:
        logger.warning(f"Old refresh token not found for rotation (jti={old_jti})")
        return False
    
    old_token.replaced_by_token_jti = new_jti
    db.commit()
    
    logger.info(f"Refresh token rotated: {old_jti} -> {new_jti}")
    return True


def set_refresh_token_cookie(response: Response, token: str) -> None:
    """
    Set an HttpOnly Secure SameSite cookie for the refresh token.
    
    Args:
        response: FastAPI Response object
        token: The refresh token JWT string
    """
    settings = get_settings()
    environment = settings.environment.environment
    
    # Calculate cookie expiration
    refresh_expire_days = settings.security.refresh_token_expire_days
    max_age = refresh_expire_days * 24 * 60 * 60  # Convert days to seconds
    
    # In production, use Secure flag
    secure = environment == "production"
    
    # Use Lax for better UX while maintaining security
    same_site = "lax"
    
    response.set_cookie(
        key=settings.security.refresh_token_cookie_name,
        value=token,
        max_age=max_age,
        expires=refresh_expire_days,
        path="/",
        domain=None,
        secure=secure,
        httponly=True,
        samesite=same_site,
    )
    
    logger.debug(f"Refresh token cookie set (secure={secure}, same_site={same_site})")


def clear_refresh_token_cookie(response: Response) -> None:
    """
    Clear the refresh token cookie by setting it to expire immediately.
    
    Args:
        response: FastAPI Response object
    """
    settings = get_settings()
    
    response.delete_cookie(
        key=settings.security.refresh_token_cookie_name,
        path="/",
        domain=None,
        secure=True,
        httponly=True,
        samesite="lax",
    )
    
    logger.debug("Refresh token cookie cleared")


def get_refresh_token_from_cookie(request: Request) -> Optional[str]:
    """
    Extract refresh token from HttpOnly cookie.
    
    Args:
        request: FastAPI Request object
        
    Returns:
        The refresh token string if present, None otherwise
    """
    settings = get_settings()
    token = request.cookies.get(settings.security.refresh_token_cookie_name)
    return token


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


def _extract_jwt_token(request: Request) -> Optional[str]:
    """Extract JWT token from Authorization header only.
    
    Returns the JWT token if present in Authorization header with Bearer prefix,
    otherwise returns None. This function explicitly handles JWT authentication
    and does not fall back to API key extraction.
    """
    auth = request.headers.get("authorization", "")
    if auth.lower().startswith("bearer "):
        token = auth.split(" ", 1)[1].strip()
        if token:
            logger.debug(f"JWT token extracted from Authorization header")
            return token
    return None


def _extract_api_key(request: Request) -> Optional[str]:
    """Extract API key from X-API-Key header only.
    
    Returns the API key if present in X-API-Key header,
    otherwise returns None. This function explicitly handles API key
    authentication and does not fall back to JWT extraction.
    """
    api_key = request.headers.get("x-api-key", "").strip()
    if api_key:
        logger.debug(f"API key extracted from X-API-Key header")
        return api_key
    return None


def _determine_auth_mode(request: Request) -> Literal["jwt", "api_key", "none"]:
    """Determine authentication mode from request headers.
    
    Returns:
        - "jwt": Authorization header with Bearer prefix is present
        - "api_key": X-API-Key header is present
        - "none": Neither header is present
    
    Note: If both headers are present, this function will reject the request
    to avoid ambiguous authentication behavior.
    """
    has_jwt = _extract_jwt_token(request) is not None
    has_api_key = _extract_api_key(request) is not None
    
    if has_jwt and has_api_key:
        logger.warning("Request contains both Authorization and X-API-Key headers - rejecting to avoid ambiguity")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ambiguous authentication: both Authorization and X-API-Key headers present. Use only one authentication method."
        )
    
    if has_jwt:
        return "jwt"
    elif has_api_key:
        return "api_key"
    else:
        return "none"


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
    Unified auth dependency for protected endpoints with explicit authentication mode separation.
    
    Authentication mode is determined from request headers, not from validation failures:
    - If Authorization header with Bearer prefix is present: JWT authentication only
    - If X-API-Key header is present: API key authentication only
    - If both headers are present: Reject request to avoid ambiguity
    - If neither header is present: Reject request
    
    Returns an AuthIdentity object with clear type distinction.
    Rejects requests with both headers (ambiguous authentication).
    """
    auth_mode = _determine_auth_mode(request)
    
    if auth_mode == "none":
        logger.warning("Authentication attempt with no credentials")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication token"
        )
    
    if auth_mode == "jwt":
        return _validate_jwt_token(request, db)
    elif auth_mode == "api_key":
        return _validate_api_key_token(request, db)
    else:
        # This should never be reached due to the check above
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Invalid authentication mode"
        )


def _validate_jwt_token(request: Request, db: Session) -> AuthIdentity:
    """Validate JWT token from Authorization header.
    
    This function only processes JWT tokens and never attempts API key validation.
    """
    token = _extract_jwt_token(request)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing JWT token"
        )
    
    if not SECRET_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service unavailable"
        )
    
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: Optional[str] = payload.get("sub")
        jti: Optional[str] = payload.get("jti")
        
        if email is None:
            logger.warning("JWT token missing subject claim")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid JWT token: missing subject"
            )
        
        if jti and is_token_revoked(jti, db):
            logger.warning(f"JWT token revoked (jti={jti})")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has been revoked"
            )
        
        user = db.query(models.User).filter(models.User.email == email).first()
        if not user:
            logger.warning(f"JWT token valid but user not found (email={email})")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found"
            )
        
        logger.info(f"JWT authentication successful for user {email}")
        return AuthIdentity(
            identity_type="user",
            identifier=email,
            user=user
        )
        
    except JWTError as e:
        logger.warning(f"JWT token validation failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired JWT token"
        )


def _validate_api_key_token(request: Request, db: Optional[Session] = None) -> AuthIdentity:
    """Validate API key from X-API-Key header: checks the static/dev key
    list first (unchanged), then falls back to per-user hashed keys in
    the database if a db session is provided."""
    token = _extract_api_key(request)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing API key"
        )

    if _is_valid_api_key(token):
        key_hash = hashlib.sha256(token.encode()).hexdigest()
        logger.info(f"Static API key authentication successful (key_hash={key_hash})")
        return AuthIdentity(identity_type="api_key", identifier=key_hash, user=None)

    if db is not None:
        key_hash = hash_api_key(token)
        row = (
            db.query(models.ApiKey)
            .filter(models.ApiKey.hashed_key == key_hash, models.ApiKey.revoked_at.is_(None))
            .first()
        )
        if row:
            logger.info(f"Per-user API key authentication successful (key_id={row.id})")
            return AuthIdentity(
                identity_type="api_key",
                identifier=key_hash,
                user=row.user,
                scopes=json.loads(row.scopes or "[]"),
            )

    logger.warning("API key validation failed")
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid API key")




def _validate_api_key(request: Request) -> str:
    """
    API key-only validation helper (used for testing).
    
    Extracts API key from X-API-Key header only (not Authorization header),
    validates it against configured static API keys, and returns
    the key if valid. Raises HTTPException for missing or invalid keys.
    
    Note: This function only accepts API keys via X-API-Key header to maintain
    strict separation between JWT and API key authentication.
    """
    token = _extract_api_key(request)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing API key in X-API-Key header"
        )

    if _is_valid_api_key(token):
        return token

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Invalid API key"
    )


def get_optional_user(request: Request, db: Session = Depends(get_db)) -> Optional[AuthIdentity]:
    """Try to extract a JWT-authenticated user from the request.

    Returns an AuthIdentity object if the caller provided a valid JWT token
    in the Authorization header, or None if:
    - No JWT token is present
    - JWT token is invalid
    - Caller is using API key authentication
    
    This allows endpoints to conditionally persist history for real users
    without breaking API-key authentication.
    
    Note: This function only checks for JWT tokens in the Authorization header
    and does not fall back to API key validation, maintaining strict separation.
    """
    token = _extract_jwt_token(request)
    if not token or not SECRET_KEY:
        return None
    
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
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

# Aliases for test suite backward compatibility
extract_jwt_from_authorization = _extract_jwt_token
extract_api_key = _extract_api_key

def _validate_dev_api_key_security():
    """
    Prevent deployment with default dev API key enabled.
    This check ensures developers don't accidentally ship with trivial authentication.
    Note: Skipped during testing to allow test suite to run with default credentials.
    """
    environment = os.getenv("ENVIRONMENT", "").lower()
    is_testing = environment == "testing" or os.getenv("PYTEST_CURRENT_TEST") is not None
    
    if is_testing:
        return
    
    allow_dev = os.getenv("ALLOW_DEV", "false").lower() in ("true", "1", "yes")
    dev_api_key = os.getenv("DEV_API_KEY", "dev-token").strip()
    
    if allow_dev and dev_api_key == "dev-token":
        raise RuntimeError(
            "SECURITY: DEV_API_KEY is still the default 'dev-token' value and ALLOW_DEV=true. "
            "This configuration must NOT be used in any deployment. "
            "Either set ALLOW_DEV=false or generate a secure DEV_API_KEY using: "
            "python -c \"import secrets; print(secrets.token_urlsafe(32))\""
        )
    
    if allow_dev and (not dev_api_key or dev_api_key.isspace()):
        raise RuntimeError(
            "SECURITY: ALLOW_DEV=true but DEV_API_KEY is empty or not set. "
            "This violates security principle of not allowing empty credentials. "
            "Either set ALLOW_DEV=false or generate a secure non-empty DEV_API_KEY."
        )


_validate_dev_api_key_security()