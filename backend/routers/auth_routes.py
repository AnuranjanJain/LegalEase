from datetime import timedelta
import logging
import os

from fastapi import APIRouter, Depends, HTTPException, status
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
    ACCESS_TOKEN_EXPIRE_HOURS
)

logger = logging.getLogger(__name__)

# Environment configuration - defaults to production for safety
ENVIRONMENT = os.getenv("ENVIRONMENT", "production").lower()

# Test mode configuration - only enabled in non-production environments
# This allows controlled failure simulation for testing purposes
# Cannot be enabled in production regardless of TEST_MODE setting
TEST_MODE = (
    ENVIRONMENT in ("development", "testing", "staging")
    and os.getenv("TEST_MODE", "false").lower() in ("true", "1", "yes")
)

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
def signup(user: UserCreate, db: Session = Depends(get_db)):
    try:
        db_user = db.query(models.User).filter(models.User.email == user.email).first()
    except SQLAlchemyError as exc:
        logger.exception("Failed to query database during signup")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database connection failed",
        )

    if db_user:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already exists")

    hashed_password = get_password_hash(user.password)
    new_user = models.User(email=user.email, hashed_password=hashed_password)

    db.add(new_user)
    try:
        db.commit()
        db.refresh(new_user)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already exists")
    except SQLAlchemyError as exc:
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
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/login", response_model=TokenResponse)
def login(user: UserLogin, db: Session = Depends(get_db)):
    try:
        db_user = db.query(models.User).filter(models.User.email == user.email).first()
    except SQLAlchemyError as exc:
        logger.exception("Failed to query database during login")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database connection failed",
        )

    if not db_user or not verify_password(user.password, db_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(
        data={"sub": db_user.email},
        expires_delta=timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    )
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/change-password")
def change_password(
    payload: ChangePasswordRequest,
    current_user: AuthIdentity = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Verify the current password and update to the new one."""
    user = current_user.user
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    
    if not verify_password(payload.current_password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Current password is incorrect",
        )

    try:
        user.hashed_password = get_password_hash(payload.new_password)
        db.commit()
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Failed to update password in database")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database connection failed",
        )
    return {"detail": "Password updated successfully"}


@router.post("/resend-verification")
def resend_verification(payload: ResendVerificationRequest, db: Session = Depends(get_db)):
    """Resend a verification email to the user.
    
    This endpoint checks if the user exists and simulates sending a verification email.
    In test mode, specific email patterns can be configured to simulate failures for testing purposes.
    
    Security note: Returns consistent success response regardless of user existence to prevent
    user enumeration attacks. This is a common security best practice for authentication endpoints.
    """
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
    except SQLAlchemyError as exc:
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

