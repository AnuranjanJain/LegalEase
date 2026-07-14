"""
Authentication-specific rate limiting middleware.

This module provides dedicated rate limiting controls for authentication endpoints
to prevent brute-force attacks, credential stuffing, signup abuse, and verification spam.
"""
import logging
from typing import Optional
from fastapi import Request, HTTPException, status
from backend.utils.limiter import SimpleRateLimiter
from backend.config import get_settings

logger = logging.getLogger(__name__)

# Get configuration from centralized settings
settings = get_settings()
rate_config = settings.rate_limit

# Environment variables for authentication rate limiting
AUTH_LOGIN_RATE_LIMIT = rate_config.auth_login_rate_limit
AUTH_LOGIN_RATE_PERIOD = rate_config.auth_login_rate_period
AUTH_LOGIN_FAILED_ATTEMPT_LIMIT = rate_config.auth_login_failed_attempt_limit
AUTH_LOGIN_FAILED_ATTEMPT_PERIOD = rate_config.auth_login_failed_attempt_period
AUTH_LOGIN_LOCKOUT_DURATION = rate_config.auth_login_lockout_duration

AUTH_SIGNUP_RATE_LIMIT = rate_config.auth_signup_rate_limit
AUTH_SIGNUP_RATE_PERIOD = rate_config.auth_signup_rate_period

AUTH_VERIFICATION_RATE_LIMIT = rate_config.auth_verification_rate_limit
AUTH_VERIFICATION_RATE_PERIOD = rate_config.auth_verification_rate_period

# Initialize rate limiters
login_ip_limiter = SimpleRateLimiter(AUTH_LOGIN_RATE_LIMIT, AUTH_LOGIN_RATE_PERIOD)
login_email_limiter = SimpleRateLimiter(AUTH_LOGIN_RATE_LIMIT, AUTH_LOGIN_RATE_PERIOD)
signup_ip_limiter = SimpleRateLimiter(AUTH_SIGNUP_RATE_LIMIT, AUTH_SIGNUP_RATE_PERIOD)
signup_email_limiter = SimpleRateLimiter(AUTH_SIGNUP_RATE_LIMIT, AUTH_SIGNUP_RATE_PERIOD)
verification_ip_limiter = SimpleRateLimiter(AUTH_VERIFICATION_RATE_LIMIT, AUTH_VERIFICATION_RATE_PERIOD)
verification_email_limiter = SimpleRateLimiter(AUTH_VERIFICATION_RATE_LIMIT, AUTH_VERIFICATION_RATE_PERIOD)
failed_login_limiter = SimpleRateLimiter(AUTH_LOGIN_FAILED_ATTEMPT_LIMIT, AUTH_LOGIN_FAILED_ATTEMPT_PERIOD)


def get_client_ip(request: Request) -> str:
    """Extract client IP from request, handling proxy headers."""
    direct_ip = request.client.host if request.client else "unknown"
    
    # Check for proxy headers
    forwarded_for = request.headers.get("x-forwarded-for", "").strip()
    if forwarded_for:
        candidate = forwarded_for.split(",", 1)[0].strip()
        if candidate:
            return candidate
    
    return direct_ip


def check_login_rate_limit(request: Request, email: str) -> None:
    """
    Check rate limits for login endpoint.
    
    Enforces dual-key rate limiting (IP + email) to prevent:
    - Brute-force attacks from single IP
    - Credential stuffing across multiple IPs
    
    Args:
        request: FastAPI request object
        email: User email attempting to login
        
    Raises:
        HTTPException: If rate limit is exceeded
    """
    ip = get_client_ip(request)
    email_lower = email.lower()
    
    # Check IP-based rate limit
    ip_result = login_ip_limiter.check(ip)
    if not ip_result["allowed"]:
        logger.warning(f"Login rate limit exceeded for IP: {ip}")
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many login attempts. Please try again later.",
            headers={
                "Retry-After": str(ip_result["retry_after"]),
                "X-RateLimit-Limit": str(AUTH_LOGIN_RATE_LIMIT),
                "X-RateLimit-Remaining": "0",
            }
        )
    
    # Check email-based rate limit (prevents credential stuffing)
    email_result = login_email_limiter.check(email_lower)
    if not email_result["allowed"]:
        logger.warning(f"Login rate limit exceeded for email: {email_lower}")
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many login attempts for this account. Please try again later.",
            headers={
                "Retry-After": str(email_result["retry_after"]),
                "X-RateLimit-Limit": str(AUTH_LOGIN_RATE_LIMIT),
                "X-RateLimit-Remaining": "0",
            }
        )


def check_signup_rate_limit(request: Request, email: str) -> None:
    """
    Check rate limits for signup endpoint.
    
    Enforces dual-key rate limiting (IP + email) to prevent:
    - Automated signup abuse from single IP
    - Multiple signup attempts for same email
    
    Args:
        request: FastAPI request object
        email: User email attempting to signup
        
    Raises:
        HTTPException: If rate limit is exceeded
    """
    ip = get_client_ip(request)
    email_lower = email.lower()
    
    # Check IP-based rate limit
    ip_result = signup_ip_limiter.check(ip)
    if not ip_result["allowed"]:
        logger.warning(f"Signup rate limit exceeded for IP: {ip}")
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many signup attempts. Please try again later.",
            headers={
                "Retry-After": str(ip_result["retry_after"]),
                "X-RateLimit-Limit": str(AUTH_SIGNUP_RATE_LIMIT),
                "X-RateLimit-Remaining": "0",
            }
        )
    
    # Check email-based rate limit
    email_result = signup_email_limiter.check(email_lower)
    if not email_result["allowed"]:
        logger.warning(f"Signup rate limit exceeded for email: {email_lower}")
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many signup attempts for this email. Please try again later.",
            headers={
                "Retry-After": str(email_result["retry_after"]),
                "X-RateLimit-Limit": str(AUTH_SIGNUP_RATE_LIMIT),
                "X-RateLimit-Remaining": "0",
            }
        )


def check_verification_rate_limit(request: Request, email: str) -> None:
    """
    Check rate limits for resend-verification endpoint.
    
    Enforces dual-key rate limiting (IP + email) to prevent:
    - Verification spam from single IP
    - Excessive verification requests for same email
    
    Args:
        request: FastAPI request object
        email: User email requesting verification resend
        
    Raises:
        HTTPException: If rate limit is exceeded
    """
    ip = get_client_ip(request)
    email_lower = email.lower()
    
    # Check IP-based rate limit
    ip_result = verification_ip_limiter.check(ip)
    if not ip_result["allowed"]:
        logger.warning(f"Verification rate limit exceeded for IP: {ip}")
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many verification requests. Please try again later.",
            headers={
                "Retry-After": str(ip_result["retry_after"]),
                "X-RateLimit-Limit": str(AUTH_VERIFICATION_RATE_LIMIT),
                "X-RateLimit-Remaining": "0",
            }
        )
    
    # Check email-based rate limit
    email_result = verification_email_limiter.check(email_lower)
    if not email_result["allowed"]:
        logger.warning(f"Verification rate limit exceeded for email: {email_lower}")
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many verification requests for this email. Please try again later.",
            headers={
                "Retry-After": str(email_result["retry_after"]),
                "X-RateLimit-Limit": str(AUTH_VERIFICATION_RATE_LIMIT),
                "X-RateLimit-Remaining": "0",
            }
        )


def record_failed_login(request: Request, email: str) -> None:
    """
    Record a failed login attempt for progressive backoff.
    
    Tracks failed login attempts per IP to implement progressive backoff,
    making brute-force attacks increasingly difficult.
    
    Args:
        request: FastAPI request object
        email: User email that failed login
    """
    ip = get_client_ip(request)
    email_lower = email.lower()
    
    # Record failed attempt for IP
    failed_login_limiter.check(f"{ip}:{email_lower}")
    logger.info(f"Recorded failed login attempt for IP: {ip}, email: {email_lower}")


def check_failed_login_lockout(request: Request, email: str) -> None:
    """
    Check if IP/email combination is locked out due to excessive failed attempts.
    
    Implements progressive backoff by checking if the number of failed attempts
    exceeds the threshold, triggering a temporary lockout.
    
    This function uses peek() to check the lockout status without incrementing
    the failed attempt counter. The counter is only incremented by record_failed_login()
    after an actual authentication failure.
    
    Args:
        request: FastAPI request object
        email: User email attempting to login
        
    Raises:
        HTTPException: If lockout threshold is exceeded
    """
    ip = get_client_ip(request)
    email_lower = email.lower()
    key = f"{ip}:{email_lower}"
    
    # Use peek() to check lockout status without incrementing counter
    result = failed_login_limiter.peek(key)
    
    # If not allowed, it means we've exceeded the failed attempt limit
    if not result["allowed"]:
        logger.warning(f"Login lockout triggered for IP: {ip}, email: {email_lower}")
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many failed login attempts. Account temporarily locked for {AUTH_LOGIN_LOCKOUT_DURATION} seconds.",
            headers={
                "Retry-After": str(AUTH_LOGIN_LOCKOUT_DURATION),
                "X-RateLimit-Limit": str(AUTH_LOGIN_FAILED_ATTEMPT_LIMIT),
                "X-RateLimit-Remaining": "0",
            }
        )


def clear_failed_login_attempts(request: Request, email: str) -> None:
    """
    Clear failed login attempts after successful login.
    
    Resets the failed attempt counter when a user successfully authenticates,
    allowing normal access after recovery.
    
    Args:
        request: FastAPI request object
        email: User email that successfully logged in
    """
    ip = get_client_ip(request)
    email_lower = email.lower()
    key = f"{ip}:{email_lower}"
    
    # Clear the failed attempt counter by removing the key
    if key in failed_login_limiter.storage:
        del failed_login_limiter.storage[key]
        logger.info(f"Cleared failed login attempts for IP: {ip}, email: {email_lower}")
