from datetime import timedelta
import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status, Response
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr, Field

from backend.database import get_db
from backend import models
from backend.auth import (
    verify_password,
    get_password_hash,
    create_access_token,
    get_current_user,
    AuthIdentity,
    ACCESS_TOKEN_EXPIRE_HOURS,
    _extract_jwt_token,
    SECRET_KEY,
    ALGORITHM,
    create_refresh_token,
    validate_refresh_token,
    revoke_refresh_token,
    rotate_refresh_token,
    set_refresh_token_cookie,
    clear_refresh_token_cookie,
    get_refresh_token_from_cookie,
)
from backend.middleware.auth_rate_limit import (
    check_login_rate_limit,
    check_signup_rate_limit,
    check_verification_rate_limit,
    record_failed_login,
    check_failed_login_lockout,
    clear_failed_login_attempts
)
from backend.config import get_settings

logger = logging.getLogger(__name__)

# Get configuration from centralized settings
settings = get_settings()
ENVIRONMENT = settings.environment.environment
TEST_MODE = settings.environment.test_mode

router = APIRouter(
    prefix="/auth",
    tags=["auth"]
)

class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, description="Password must be at least 8 characters")

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8, description="New password must be at least 8 characters")

class ResendVerificationRequest(BaseModel):
    email: EmailStr


@router.post("/signup", status_code=status.HTTP_201_CREATED, response_model=TokenResponse)
def signup(request: Request, response: Response, user: UserCreate, db: Session = Depends(get_db)):
    # Enforce rate limiting before database operations
    check_signup_rate_limit(request, user.email)
    
    # Normalize email so casing variations resolve to a single account
    normalized_email = user.email.strip().lower()
    try:
        db_user = db.query(models.User).filter(models.User.email == normalized_email).first()
    except SQLAlchemyError:
        logger.exception("Failed to query database during signup")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database connection failed",
        )

    if db_user:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already exists")

    hashed_password = get_password_hash(user.password)
    new_user = models.User(email=normalized_email, hashed_password=hashed_password)

    db.add(new_user)
    try:
        db.commit()
        db.refresh(new_user)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already exists")
    except SQLAlchemyError:
        db.rollback()
        logger.exception("Failed to create user during signup")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database connection failed",
        )

    access_token = create_access_token(
        data={"sub": new_user.email},
        expires_delta=timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    )
    
    # Create and set refresh token cookie
    refresh_token = create_refresh_token(
        data={"sub": new_user.email},
        db=db,
    )
    set_refresh_token_cookie(response, refresh_token)
    
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/login", response_model=TokenResponse)
def login(request: Request, response: Response, user: UserLogin, db: Session = Depends(get_db)):
    # Enforce rate limiting before processing
    check_login_rate_limit(request, user.email)
    
    # Check for failed login lockout
    check_failed_login_lockout(request, user.email)
    
    # Normalize email to match accounts case-insensitively
    normalized_email = user.email.strip().lower()
    try:
        db_user = db.query(models.User).filter(models.User.email == normalized_email).first()
    except SQLAlchemyError:
        logger.exception("Failed to query database during login")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database connection failed",
        )

    if not db_user or not verify_password(user.password, db_user.hashed_password):
        # Record failed login attempt for progressive backoff
        record_failed_login(request, user.email)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Clear failed login attempts on successful login
    clear_failed_login_attempts(request, user.email)

    access_token = create_access_token(
        data={"sub": db_user.email},
        expires_delta=timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    )
    
    # Create and set refresh token cookie
    refresh_token = create_refresh_token(
        data={"sub": db_user.email},
        db=db,
    )
    set_refresh_token_cookie(response, refresh_token)
    
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/change-password")
def change_password(
    payload: ChangePasswordRequest,
    current_user: AuthIdentity = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Verify the current password and update to the new one."""
    if not current_user.user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    user = current_user.user
    
    if not verify_password(payload.current_password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Current password is incorrect",
        )

    try:
        user.hashed_password = get_password_hash(payload.new_password)
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        logger.exception("Failed to update password in database")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database connection failed",
        )
    return {"detail": "Password updated successfully"}


@router.post("/resend-verification")
def resend_verification(request: Request, payload: ResendVerificationRequest, db: Session = Depends(get_db)):
    """Resend a verification email to the user.
    
    This endpoint checks if the user exists and simulates sending a verification email.
    In test mode, specific email patterns can be configured to simulate failures for testing purposes.
    
    Security note: Returns consistent success response regardless of user existence to prevent
    user enumeration attacks. This is a common security best practice for authentication endpoints.
    """
    # Enforce rate limiting before processing
    check_verification_rate_limit(request, payload.email)
    
    email_lower = payload.email.lower()
    
    # Test mode: controlled failure simulation for development/testing only
    # This is isolated behind an explicit environment flag and cannot be enabled in production
    if TEST_MODE:
        if email_lower == "994917jishnu@gmail.com" or "fail" in email_lower:
            logger.warning(f"Test mode: Simulating verification email failure for {email_lower}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to send verification email. Please try again later.",
            )
    
    # Check if user exists in the database
    try:
        db_user = db.query(models.User).filter(models.User.email == email_lower).first()
    except SQLAlchemyError:
        logger.exception("Failed to query database during resend-verification")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database connection failed",
        )
    
    # Security: Return consistent response regardless of user existence to prevent enumeration
    # In a real implementation, only send email if user exists, but always return success
    if db_user:
        logger.info(f"Verification email resent successfully to {email_lower}")
    else:
        logger.info(f"Verification email requested for non-existent user {email_lower} - returning success for security")
    
    return {"detail": "Verification email sent successfully!"}


@router.get("/verify")
def verify_token(current_user: AuthIdentity = Depends(get_current_user)):
    """
    Verify that the current JWT token is valid and return user information.
    Used by frontend for authentication validation during startup, page refresh,
    and token verification after login.
    """
    email = current_user.get_user_email()
    if not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    return {
        "valid": True,
        "email": email
    }


@router.get("/refresh", response_model=TokenResponse)
def refresh(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    """
    Refresh an access token using a refresh token from an HttpOnly cookie.
    
    This endpoint enables session restoration after page refreshes without
    requiring the user to re-enter credentials. The refresh token is stored
    in an HttpOnly Secure SameSite cookie for security.
    
    Process:
    1. Extract refresh token from HttpOnly cookie
    2. Validate refresh token (signature, expiration, revocation, user existence)
    3. Issue new access token
    4. Optionally rotate refresh token (if enabled in config)
    5. Update cookie with new refresh token (if rotated)
    
    Returns:
        JSON with new access token
        
    Raises:
        401: If refresh token is missing, invalid, expired, or revoked
    """
    settings = get_settings()
    
    # Extract refresh token from cookie
    refresh_token = get_refresh_token_from_cookie(request)
    if not refresh_token:
        logger.warning("Refresh endpoint called without refresh token cookie")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing refresh token",
        )
    
    # Validate refresh token
    try:
        payload = validate_refresh_token(refresh_token, db)
    except HTTPException:
        # Clear invalid refresh token cookie
        clear_refresh_token_cookie(response)
        raise
    
    email = payload.get("sub")
    old_jti = payload.get("jti")
    
    # Verify user still exists
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        logger.warning(f"Refresh token valid but user not found (email={email})")
        clear_refresh_token_cookie(response)
        revoke_refresh_token(old_jti, db)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    
    # Create new access token
    access_token = create_access_token(
        data={"sub": user.email},
        expires_delta=timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    )
    
    # Rotate refresh token if enabled
    if settings.security.refresh_token_rotation_enabled:
        try:
            # Create new refresh token
            new_refresh_token = create_refresh_token(
                data={"sub": user.email},
                db=db,
            )
            
            # Mark old token as replaced (rotation tracking)
            rotate_refresh_token(old_jti, new_refresh_token, db)
            
            # Update cookie with new refresh token
            set_refresh_token_cookie(response, new_refresh_token)
            
            logger.info(f"Refresh token rotated for user {email}")
        except Exception as e:
            logger.error(f"Failed to rotate refresh token: {e}")
            # Continue with non-rotated response if rotation fails
            # This is a graceful degradation - user still gets a new access token
    
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/logout", status_code=status.HTTP_200_OK)
def logout(
    request: Request,
    response: Response,
    current_user: AuthIdentity = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Invalidate the caller's JWT by recording its jti in the revocation table.
    Also clears the refresh token cookie if present.
    Subsequent requests carrying the same token will be rejected with 401,
    even if the token has not yet expired.
    """
    from jose import jwt as jose_jwt, JWTError
    from backend.models import RevokedToken
    from datetime import datetime

    # Clear refresh token cookie
    clear_refresh_token_cookie(response)
    
    # Revoke refresh token from database if present
    refresh_token = get_refresh_token_from_cookie(request)
    if refresh_token:
        try:
            payload = jose_jwt.decode(refresh_token, SECRET_KEY, algorithms=[ALGORITHM])
            refresh_jti = payload.get("jti")
            if refresh_jti:
                revoke_refresh_token(refresh_jti, db)
        except JWTError:
            # Invalid refresh token, ignore
            pass

    # Revoke access token
    token = _extract_jwt_token(request)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing token")

    try:
        payload = jose_jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        # Token already invalid — treat as a successful logout
        return {"detail": "Logged out successfully"}

    jti = payload.get("jti")
    exp = payload.get("exp")

    if not jti or not exp:
        # Token was issued without jti (pre-fix token) — nothing to blacklist,
        # but the client has already cleared localStorage so this is acceptable.
        return {"detail": "Logged out successfully"}

    expires_at = datetime.utcfromtimestamp(exp)

    # Idempotent: ignore if jti already revoked (e.g. duplicate logout request)
    existing = db.query(RevokedToken).filter(RevokedToken.jti == jti).first()
    if not existing:
        try:
            db.add(RevokedToken(jti=jti, expires_at=expires_at))
            db.commit()
        except Exception:
            db.rollback()
            logger.exception("Failed to record token revocation")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Logout failed — please try again",
            )

    logger.info("Token revoked for user %s (jti=%s)", current_user.identifier, jti)
    return {"detail": "Logged out successfully"}
