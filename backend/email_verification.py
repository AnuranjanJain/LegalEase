"""
Email verification utilities — token generation, email sending, verification logic.
"""

import logging
import os
import secrets
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy.orm import Session

from backend import models

logger = logging.getLogger(__name__)

VERIFICATION_TOKEN_BYTES = 32
VERIFICATION_TOKEN_EXPIRY_HOURS = int(os.getenv("VERIFICATION_TOKEN_EXPIRY_HOURS", "24"))
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")


def generate_verification_token() -> str:
    """Generate a cryptographically secure URL-safe verification token."""
    return secrets.token_urlsafe(VERIFICATION_TOKEN_BYTES)


def create_verification_token(db: Session, user: models.User) -> str:
    """
    Generate and persist a verification token for the user.
    Returns the raw token (to be sent in the verification email).
    """
    token = generate_verification_token()
    user.verification_token = token
    user.verification_token_expires = datetime.utcnow() + timedelta(hours=VERIFICATION_TOKEN_EXPIRY_HOURS)
    db.commit()
    db.refresh(user)
    logger.info("Created verification token for user %s", user.email)
    return token


def verify_email_token(db: Session, token: str) -> Optional[models.User]:
    """
    Validate a verification token and mark the user as verified.
    Returns the user if successful, None if token is invalid or expired.
    """
    user = db.query(models.User).filter(models.User.verification_token == token).first()
    if not user:
        logger.warning("Verification attempt with invalid token")
        return None

    if user.is_verified:
        logger.info("User %s already verified", user.email)
        return user

    if user.verification_token_expires and user.verification_token_expires < datetime.utcnow():
        logger.warning("Verification token expired for user %s", user.email)
        return None

    user.is_verified = True
    user.verification_token = None
    user.verification_token_expires = None
    db.commit()
    db.refresh(user)
    logger.info("Email verified for user %s", user.email)
    return user


def get_verification_link(token: str) -> str:
    """Build the frontend verification URL."""
    return f"{FRONTEND_URL}/verify-email?token={token}"


def send_verification_email(email: str, token: str) -> bool:
    """
    Send verification email to the user.
    In development mode, logs the link instead of sending.
    Returns True if email was sent/logged successfully.
    """
    verification_link = get_verification_link(token)
    smtp_host = os.getenv("SMTP_HOST")

    if not smtp_host:
        # Development mode — log the link
        logger.info(
            "[DEV] Verification email for %s: %s",
            email,
            verification_link,
        )
        print(f"[DEV] Verification email for {email}: {verification_link}")
        return True

    # Production mode — send via SMTP
    try:
        import smtplib
        from email.mime.text import MIMEText
        from email.mime.multipart import MIMEMultipart

        smtp_port = int(os.getenv("SMTP_PORT", "587"))
        smtp_user = os.getenv("SMTP_USER", "")
        smtp_password = os.getenv("SMTP_PASSWORD", "")
        from_email = os.getenv("FROM_EMAIL", smtp_user)

        msg = MIMEMultipart("alternative")
        msg["Subject"] = "Verify your email — LegalEase"
        msg["From"] = from_email
        msg["To"] = email

        text_content = (
            f"Welcome to LegalEase!\n\n"
            f"Please verify your email by clicking the link below:\n\n"
            f"{verification_link}\n\n"
            f"This link expires in {VERIFICATION_TOKEN_EXPIRY_HOURS} hours.\n"
            f"If you did not create an account, please ignore this email.\n"
        )

        html_content = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1a1a2e;">Welcome to LegalEase!</h2>
            <p>Please verify your email address by clicking the button below:</p>
            <div style="text-align: center; margin: 30px 0;">
                <a href="{verification_link}"
                   style="background-color: #4f46e5; color: white; padding: 12px 32px;
                          text-decoration: none; border-radius: 6px; font-weight: bold;">
                    Verify Email
                </a>
            </div>
            <p style="color: #666; font-size: 14px;">
                This link expires in {VERIFICATION_TOKEN_EXPIRY_HOURS} hours.<br>
                If you did not create an account, please ignore this email.
            </p>
        </div>
        """

        msg.attach(MIMEText(text_content, "plain"))
        msg.attach(MIMEText(html_content, "html"))

        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.starttls()
            server.login(smtp_user, smtp_password)
            server.sendmail(from_email, email, msg.as_string())

        logger.info("Verification email sent to %s", email)
        return True

    except Exception as exc:
        logger.error("Failed to send verification email to %s: %s", email, exc)
        return False
