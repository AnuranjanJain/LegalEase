import logging
from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr, Field

from backend.database import get_db
from backend import models
from backend.auth import (
    verify_password,
    get_password_hash,
    create_access_token,
    get_current_user,
    ACCESS_TOKEN_EXPIRE_HOURS,
)
from backend.email_verification import (
    create_verification_token,
    verify_email_token,
    send_verification_email,
)

logger = logging.getLogger(__name__)

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

class VerifyEmailRequest(BaseModel):
    token: str = Field(..., min_length=1, description="Verification token from email link")

class ResendVerificationRequest(BaseModel):
    email: EmailStr

class MessageResponse(BaseModel):
    detail: str


@router.post("/signup", status_code=status.HTTP_201_CREATED, response_model=MessageResponse)
def signup(user: UserCreate, db: Session = Depends(get_db)):
    """
    Register a new account. Sends a verification email; account remains
    unverified until the user clicks the verification link.
    """
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    hashed_password = get_password_hash(user.password)
    new_user = models.User(email=user.email, hashed_password=hashed_password, is_verified=False)

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # Generate verification token and send email
    token = create_verification_token(db, new_user)
    send_verification_email(new_user.email, token)

    logger.info("User registered: %s (verification email sent)", new_user.email)
    return {
        "detail": "Account created successfully. Please check your email to verify your account.",
    }


@router.post("/verify-email", response_model=MessageResponse)
def verify_email(payload: VerifyEmailRequest, db: Session = Depends(get_db)):
    """Verify email address using the token sent during signup."""
    user = verify_email_token(db, payload.token)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification token. Please request a new one.",
        )
    return {"detail": "Email verified successfully. You can now log in."}


@router.post("/resend-verification", response_model=MessageResponse)
def resend_verification(payload: ResendVerificationRequest, db: Session = Depends(get_db)):
    """Resend verification email for an unverified account."""
    user = db.query(models.User).filter(models.User.email == payload.email).first()
    if not user:
        # Don't reveal whether the email exists
        return {"detail": "If an account with that email exists and is unverified, a verification email has been sent."}

    if user.is_verified:
        return {"detail": "If an account with that email exists and is unverified, a verification email has been sent."}

    token = create_verification_token(db, user)
    send_verification_email(user.email, token)

    return {"detail": "If an account with that email exists and is unverified, a verification email has been sent."}


@router.post("/login", response_model=TokenResponse)
def login(user: UserLogin, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.email == user.email).first()

    if not db_user or not verify_password(user.password, db_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not db_user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email not verified. Please check your inbox or request a new verification email.",
        )

    access_token = create_access_token(
        data={"sub": db_user.email},
        expires_delta=timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    )
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/change-password")
def change_password(
    payload: ChangePasswordRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Verify the current password and update to the new one."""
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Current password is incorrect",
        )

    current_user.hashed_password = get_password_hash(payload.new_password)
    db.commit()
    return {"detail": "Password updated successfully"}
