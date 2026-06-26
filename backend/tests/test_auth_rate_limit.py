"""
Tests for authentication-specific rate limiting.

This test suite validates the rate limiting controls for login, signup,
and verification endpoints to prevent brute-force attacks, credential stuffing,
signup abuse, and verification spam.
"""
import os
import pytest
import time
from unittest.mock import Mock, patch
from fastapi import HTTPException, status
import backend.config

from backend.middleware.auth_rate_limit import (
    check_login_rate_limit,
    check_signup_rate_limit,
    check_verification_rate_limit,
    record_failed_login,
    check_failed_login_lockout,
    clear_failed_login_attempts,
    login_ip_limiter,
    login_email_limiter,
    signup_ip_limiter,
    signup_email_limiter,
    verification_ip_limiter,
    verification_email_limiter,
    failed_login_limiter,
)

# Reset settings before any tests
backend.config._settings = None

# Set JWT_SECRET_KEY for tests
os.environ["JWT_SECRET_KEY"] = "testing-secret-key-1234567890-abcdef"


@pytest.fixture(autouse=True)
def reset_limiters():
    """Reset all rate limiters before each test."""
    login_ip_limiter._storage.clear()
    login_email_limiter._storage.clear()
    signup_ip_limiter._storage.clear()
    signup_email_limiter._storage.clear()
    verification_ip_limiter._storage.clear()
    verification_email_limiter._storage.clear()
    failed_login_limiter._storage.clear()
    yield


@pytest.fixture
def mock_request():
    """Create a mock FastAPI request object."""
    request = Mock()
    request.client = Mock()
    request.client.host = "192.168.1.1"
    request.headers = {}
    return request


@pytest.mark.unit
def test_login_rate_limit_normal(mock_request):
    """Test normal login requests within rate limit."""
    # Should allow first 5 login attempts (default limit)
    for i in range(5):
        check_login_rate_limit(mock_request, "test@example.com")
    
    # 6th attempt should be rate limited
    with pytest.raises(HTTPException) as exc_info:
        check_login_rate_limit(mock_request, "test@example.com")
    
    assert exc_info.value.status_code == status.HTTP_429_TOO_MANY_REQUESTS
    assert "Too many login attempts" in exc_info.value.detail


@pytest.mark.unit
def test_login_rate_limit_different_emails(mock_request):
    """Test that rate limiting is per-email (when IP limit not exhausted)."""
    # Make 5 attempts for user1 (exhausts both IP and email limits)
    for i in range(5):
        check_login_rate_limit(mock_request, "user1@example.com")
    
    # Should be rate limited for user1 (both IP and email exhausted)
    with pytest.raises(HTTPException):
        check_login_rate_limit(mock_request, "user1@example.com")
    
    # Change IP to test email-based limiting
    mock_request.client.host = "192.168.1.2"
    
    # user1 should still be rate limited by email (5 attempts already)
    with pytest.raises(HTTPException):
        check_login_rate_limit(mock_request, "user1@example.com")
    
    # But user2 should be allowed (different email, new IP)
    check_login_rate_limit(mock_request, "user2@example.com")


@pytest.mark.unit
def test_login_rate_limit_different_ips(mock_request):
    """Test that rate limiting is per-IP (when email limit not exhausted)."""
    # Make 3 attempts from IP1 for test@example.com
    for i in range(3):
        check_login_rate_limit(mock_request, "test@example.com")
    
    # Change IP to test IP-based limiting
    mock_request.client.host = "192.168.1.2"
    
    # Should still be allowed (different IP, same email under limit)
    for i in range(2):
        check_login_rate_limit(mock_request, "test@example.com")
    
    # Now email is exhausted (5 total), should be rate limited
    with pytest.raises(HTTPException):
        check_login_rate_limit(mock_request, "test@example.com")
    
    # But different email should work on this IP
    check_login_rate_limit(mock_request, "other@example.com")


@pytest.mark.unit
def test_signup_rate_limit_normal(mock_request):
    """Test normal signup requests within rate limit."""
    # Should allow first 3 signup attempts (default limit)
    for i in range(3):
        check_signup_rate_limit(mock_request, "test@example.com")
    
    # 4th attempt should be rate limited
    with pytest.raises(HTTPException) as exc_info:
        check_signup_rate_limit(mock_request, "test@example.com")
    
    assert exc_info.value.status_code == status.HTTP_429_TOO_MANY_REQUESTS
    assert "Too many signup attempts" in exc_info.value.detail


@pytest.mark.unit
def test_verification_rate_limit_normal(mock_request):
    """Test normal verification resend requests within rate limit."""
    # Should allow first 3 verification requests (default limit)
    for i in range(3):
        check_verification_rate_limit(mock_request, "test@example.com")
    
    # 4th attempt should be rate limited
    with pytest.raises(HTTPException) as exc_info:
        check_verification_rate_limit(mock_request, "test@example.com")
    
    assert exc_info.value.status_code == status.HTTP_429_TOO_MANY_REQUESTS
    assert "Too many verification requests" in exc_info.value.detail


@pytest.mark.unit
def test_failed_login_progressive_backoff(mock_request):
    """Test progressive backoff for failed login attempts."""
    # Record failed attempts
    for i in range(10):  # Default limit is 10
        record_failed_login(mock_request, "test@example.com")
    
    # Should trigger lockout
    with pytest.raises(HTTPException) as exc_info:
        check_failed_login_lockout(mock_request, "test@example.com")
    
    assert exc_info.value.status_code == status.HTTP_429_TOO_MANY_REQUESTS
    assert "temporarily locked" in exc_info.value.detail


@pytest.mark.unit
def test_failed_login_lockout_different_ips(mock_request):
    """Test that failed login lockout is per-IP/email combination."""
    # Record failed attempts for IP1
    for i in range(10):
        record_failed_login(mock_request, "test@example.com")
    
    # Should trigger lockout for IP1
    with pytest.raises(HTTPException):
        check_failed_login_lockout(mock_request, "test@example.com")
    
    # Different IP should not be locked out
    mock_request.client.host = "192.168.1.2"
    check_failed_login_lockout(mock_request, "test@example.com")


@pytest.mark.unit
def test_clear_failed_login_attempts(mock_request):
    """Test clearing failed login attempts after successful login."""
    # Record failed attempts
    for i in range(5):
        record_failed_login(mock_request, "test@example.com")
    
    # Should have failed attempts recorded
    key = f"{mock_request.client.host}:test@example.com"
    assert key in failed_login_limiter.storage
    
    # Clear failed attempts
    clear_failed_login_attempts(mock_request, "test@example.com")
    
    # Should be cleared
    assert key not in failed_login_limiter.storage


@pytest.mark.unit
def test_login_rate_limit_case_insensitive_email(mock_request):
    """Test that email rate limiting is case-insensitive."""
    # Make 5 attempts with different case variations of the same email
    check_login_rate_limit(mock_request, "Test@Example.com")
    check_login_rate_limit(mock_request, "test@example.com")
    check_login_rate_limit(mock_request, "TEST@EXAMPLE.COM")
    check_login_rate_limit(mock_request, "TeSt@ExAmPlE.cOm")
    check_login_rate_limit(mock_request, "tEsT@eXaMpLe.CoM")
    
    # Should be rate limited (same email, different case)
    with pytest.raises(HTTPException):
        check_login_rate_limit(mock_request, "TEST@EXAMPLE.COM")


@pytest.mark.unit
def test_rate_limit_time_window_reset(mock_request):
    """Test that rate limits reset after time period."""
    # Set a short period for testing
    import os
    original_period = os.getenv("AUTH_LOGIN_RATE_PERIOD")
    os.environ["AUTH_LOGIN_RATE_PERIOD"] = "1"
    os.environ["JWT_SECRET_KEY"] = "testing-secret-key-1234567890-abcdef"
    
    # Re-import to pick up new environment variable
    from importlib import reload
    import backend.middleware.auth_rate_limit as auth_rate_limit
    reload(auth_rate_limit)
    
    # Make requests up to limit
    for i in range(5):
        auth_rate_limit.check_login_rate_limit(mock_request, "test@example.com")
    
    # Should be rate limited
    with pytest.raises(HTTPException):
        auth_rate_limit.check_login_rate_limit(mock_request, "test@example.com")
    
    # Wait for period to expire
    time.sleep(1.1)
    
    # Should be allowed again
    auth_rate_limit.check_login_rate_limit(mock_request, "test@example.com")
    
    # Restore original value
    if original_period:
        os.environ["AUTH_LOGIN_RATE_PERIOD"] = original_period
    else:
        os.environ.pop("AUTH_LOGIN_RATE_PERIOD", None)


@pytest.mark.integration
def test_login_flow_with_failed_attempts(mock_request):
    """Test complete login flow with failed attempts and recovery."""
    # Simulate failed login attempts
    for i in range(3):
        record_failed_login(mock_request, "test@example.com")
    
    # Should still be allowed (under lockout threshold)
    check_failed_login_lockout(mock_request, "test@example.com")
    
    # Simulate successful login clears attempts
    clear_failed_login_attempts(mock_request, "test@example.com")
    
    # Should have no failed attempts
    key = f"{mock_request.client.host}:test@example.com"
    assert key not in failed_login_limiter.storage


@pytest.mark.integration
def test_signup_and_verification_limits_independent(mock_request):
    """Test that signup and verification limits are independent."""
    # Exhaust signup limit
    for i in range(3):
        check_signup_rate_limit(mock_request, "test@example.com")
    
    # Signup should be rate limited
    with pytest.raises(HTTPException):
        check_signup_rate_limit(mock_request, "test@example.com")
    
    # But verification should still work (different limiter)
    check_verification_rate_limit(mock_request, "test@example.com")
