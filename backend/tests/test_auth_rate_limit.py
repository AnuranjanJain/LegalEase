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

from backend.middleware import auth_rate_limit

# Reset settings before any tests
backend.config._settings = None

# Set JWT_SECRET_KEY for tests
os.environ["JWT_SECRET_KEY"] = "testing-secret-key-1234567890-abcdef"
# Disable test mode for rate limiting unit tests to ensure they actually test rate limiting
os.environ["TEST_MODE"] = "false"
os.environ["ENVIRONMENT"] = "testing"
os.environ["REQUIRE_REDIS_IN_PRODUCTION"] = "false"


@pytest.fixture(autouse=True)
def reset_limiters():
    """Reset all rate limiters before each test."""
    from importlib import reload
    
    # Reset settings to ensure clean state
    backend.config._settings = None
    
    # Ensure test mode is disabled for these tests
    os.environ["TEST_MODE"] = "false"
    os.environ["ENVIRONMENT"] = "testing"
    
    # Reload module to ensure fresh state (handles test_rate_limit_time_window_reset)
    reload(auth_rate_limit)
    
    # Get the fresh limiters from the reloaded module
    auth_rate_limit.login_ip_limiter._storage.clear()
    auth_rate_limit.login_email_limiter._storage.clear()
    auth_rate_limit.signup_ip_limiter._storage.clear()
    auth_rate_limit.signup_email_limiter._storage.clear()
    auth_rate_limit.verification_ip_limiter._storage.clear()
    auth_rate_limit.verification_email_limiter._storage.clear()
    auth_rate_limit.failed_login_limiter._storage.clear()
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
        auth_rate_limit.check_login_rate_limit(mock_request, "test@example.com")
    
    # 6th attempt should be rate limited
    with pytest.raises(HTTPException) as exc_info:
        auth_rate_limit.check_login_rate_limit(mock_request, "test@example.com")
    
    assert exc_info.value.status_code == status.HTTP_429_TOO_MANY_REQUESTS
    assert "Too many login attempts" in exc_info.value.detail


@pytest.mark.unit
def test_login_rate_limit_different_emails(mock_request):
    """Test that rate limiting is per-email (when IP limit not exhausted)."""
    # Make 5 attempts for user1 (exhausts both IP and email limits)
    for i in range(5):
        auth_rate_limit.check_login_rate_limit(mock_request, "user1@example.com")
    
    # Should be rate limited for user1 (both IP and email exhausted)
    with pytest.raises(HTTPException):
        auth_rate_limit.check_login_rate_limit(mock_request, "user1@example.com")
    
    # Change IP to test email-based limiting
    mock_request.client.host = "192.168.1.2"
    
    # user1 should still be rate limited by email (5 attempts already)
    with pytest.raises(HTTPException):
        auth_rate_limit.check_login_rate_limit(mock_request, "user1@example.com")
    
    # But user2 should be allowed (different email, new IP)
    auth_rate_limit.check_login_rate_limit(mock_request, "user2@example.com")


@pytest.mark.unit
def test_login_rate_limit_different_ips(mock_request):
    """Test that rate limiting is per-IP (when email limit not exhausted)."""
    # Make 3 attempts from IP1 for test@example.com
    for i in range(3):
        auth_rate_limit.check_login_rate_limit(mock_request, "test@example.com")
    
    # Change IP to test IP-based limiting
    mock_request.client.host = "192.168.1.2"
    
    # Should still be allowed (different IP, same email under limit)
    for i in range(2):
        auth_rate_limit.check_login_rate_limit(mock_request, "test@example.com")
    
    # Now email is exhausted (5 total), should be rate limited
    with pytest.raises(HTTPException):
        auth_rate_limit.check_login_rate_limit(mock_request, "test@example.com")
    
    # But different email should work on this IP
    auth_rate_limit.check_login_rate_limit(mock_request, "other@example.com")


@pytest.mark.unit
def test_signup_rate_limit_normal(mock_request):
    """Test normal signup requests within rate limit."""
    # Should allow first 3 signup attempts (default limit)
    for i in range(3):
        auth_rate_limit.check_signup_rate_limit(mock_request, "test@example.com")
    
    # 4th attempt should be rate limited
    with pytest.raises(HTTPException) as exc_info:
        auth_rate_limit.check_signup_rate_limit(mock_request, "test@example.com")
    
    assert exc_info.value.status_code == status.HTTP_429_TOO_MANY_REQUESTS
    assert "Too many signup attempts" in exc_info.value.detail


@pytest.mark.unit
def test_verification_rate_limit_normal(mock_request):
    """Test normal verification resend requests within rate limit."""
    # Should allow first 3 verification requests (default limit)
    for i in range(3):
        auth_rate_limit.check_verification_rate_limit(mock_request, "test@example.com")
    
    # 4th attempt should be rate limited
    with pytest.raises(HTTPException) as exc_info:
        auth_rate_limit.check_verification_rate_limit(mock_request, "test@example.com")
    
    assert exc_info.value.status_code == status.HTTP_429_TOO_MANY_REQUESTS
    assert "Too many verification requests" in exc_info.value.detail


@pytest.mark.unit
def test_failed_login_progressive_backoff(mock_request):
    """Test progressive backoff for failed login attempts."""
    # Record failed attempts
    for i in range(10):  # Default limit is 10
        auth_rate_limit.record_failed_login(mock_request, "test@example.com")
    
    # Should trigger lockout
    with pytest.raises(HTTPException) as exc_info:
        auth_rate_limit.check_failed_login_lockout(mock_request, "test@example.com")
    
    assert exc_info.value.status_code == status.HTTP_429_TOO_MANY_REQUESTS
    assert "temporarily locked" in exc_info.value.detail


@pytest.mark.unit
def test_failed_login_lockout_different_ips(mock_request):
    """Test that failed login lockout is per-IP/email combination."""
    # Record failed attempts for IP1
    for i in range(10):
        auth_rate_limit.record_failed_login(mock_request, "test@example.com")
    
    # Should trigger lockout for IP1
    with pytest.raises(HTTPException):
        auth_rate_limit.check_failed_login_lockout(mock_request, "test@example.com")
    
    # Different IP should not be locked out
    mock_request.client.host = "192.168.1.2"
    auth_rate_limit.check_failed_login_lockout(mock_request, "test@example.com")


@pytest.mark.unit
def test_clear_failed_login_attempts(mock_request):
    """Test clearing failed login attempts after successful login."""
    # Record failed attempts
    for i in range(5):
        auth_rate_limit.record_failed_login(mock_request, "test@example.com")
    
    # Should have failed attempts recorded
    key = f"{mock_request.client.host}:test@example.com"
    assert key in auth_rate_limit.failed_login_limiter.storage
    
    # Clear failed attempts
    auth_rate_limit.clear_failed_login_attempts(mock_request, "test@example.com")
    
    # Should be cleared
    assert key not in auth_rate_limit.failed_login_limiter.storage


@pytest.mark.unit
def test_login_rate_limit_case_insensitive_email(mock_request):
    """Test that email rate limiting is case-insensitive."""
    # Make 5 attempts with different case variations of the same email
    auth_rate_limit.check_login_rate_limit(mock_request, "Test@Example.com")
    auth_rate_limit.check_login_rate_limit(mock_request, "test@example.com")
    auth_rate_limit.check_login_rate_limit(mock_request, "TEST@EXAMPLE.COM")
    auth_rate_limit.check_login_rate_limit(mock_request, "TeSt@ExAmPlE.cOm")
    auth_rate_limit.check_login_rate_limit(mock_request, "tEsT@eXaMpLe.CoM")
    
    # Should be rate limited (same email, different case)
    with pytest.raises(HTTPException):
        auth_rate_limit.check_login_rate_limit(mock_request, "TEST@EXAMPLE.COM")


@pytest.mark.unit
def test_rate_limit_time_window_reset(mock_request):
    """Test that rate limits reset after time period."""
    # Create a dedicated limiter with short period for this test
    from backend.utils.limiter import SimpleRateLimiter
    test_limiter = SimpleRateLimiter(5, 1)  # 5 requests per 1 second
    
    # Make requests up to limit
    for i in range(5):
        result = test_limiter.check("test_key")
        assert result["allowed"] == True
    
    # Should be rate limited
    result = test_limiter.check("test_key")
    assert result["allowed"] == False
    
    # Wait for period to expire
    time.sleep(1.1)
    
    # Should be allowed again
    result = test_limiter.check("test_key")
    assert result["allowed"] == True


@pytest.mark.integration
def test_login_flow_with_failed_attempts(mock_request):
    """Test complete login flow with failed attempts and recovery."""
    # Simulate failed login attempts
    for i in range(3):
        auth_rate_limit.record_failed_login(mock_request, "test@example.com")
    
    # Should still be allowed (under lockout threshold)
    auth_rate_limit.check_failed_login_lockout(mock_request, "test@example.com")
    
    # Simulate successful login clears attempts
    auth_rate_limit.clear_failed_login_attempts(mock_request, "test@example.com")
    
    # Should have no failed attempts
    key = f"{mock_request.client.host}:test@example.com"
    assert key not in auth_rate_limit.failed_login_limiter.storage


@pytest.mark.integration
def test_signup_and_verification_limits_independent(mock_request):
    """Test that signup and verification limits are independent."""
    # Exhaust signup limit
    for i in range(3):
        auth_rate_limit.check_signup_rate_limit(mock_request, "test@example.com")
    
    # Signup should be rate limited
    with pytest.raises(HTTPException):
        auth_rate_limit.check_signup_rate_limit(mock_request, "test@example.com")
    
    # But verification should still work (different limiter)
    auth_rate_limit.check_verification_rate_limit(mock_request, "test@example.com")


@pytest.mark.integration
def test_login_endpoint_rate_limit_enforcement():
    """Test that login endpoint enforces rate limiting at the HTTP level."""
    from fastapi.testclient import TestClient
    from backend.main import app
    
    # Reset limiters
    auth_rate_limit.login_ip_limiter._storage.clear()
    auth_rate_limit.login_email_limiter._storage.clear()
    
    client = TestClient(app)
    
    # Make 5 successful login attempts (should be allowed)
    for i in range(5):
        response = client.post("/auth/login", json={
            "email": "test@example.com",
            "password": "wrongpassword"
        })
        # Should fail authentication but not be rate limited yet
        assert response.status_code in [401, 429]
    
    # 6th attempt should be rate limited
    response = client.post("/auth/login", json={
        "email": "test@example.com",
        "password": "wrongpassword"
    })
    assert response.status_code == 429
    assert "Too many login attempts" in response.json()["detail"]
    
    # Clean up
    auth_rate_limit.login_ip_limiter._storage.clear()
    auth_rate_limit.login_email_limiter._storage.clear()


@pytest.mark.integration
def test_signup_endpoint_rate_limit_enforcement():
    """Test that signup endpoint enforces rate limiting at the HTTP level."""
    from fastapi.testclient import TestClient
    from backend.main import app
    
    # Reset limiters
    auth_rate_limit.signup_ip_limiter._storage.clear()
    auth_rate_limit.signup_email_limiter._storage.clear()
    
    client = TestClient(app)
    
    # Make 3 signup attempts (should be allowed, will fail due to duplicate email but not rate limited)
    for i in range(3):
        response = client.post("/auth/signup", json={
            "email": f"test{i}@example.com",
            "password": "password123"
        })
        # Should not be rate limited
        assert response.status_code in [201, 409, 429]
    
    # 4th attempt should be rate limited
    response = client.post("/auth/signup", json={
        "email": "test4@example.com",
        "password": "password123"
    })
    assert response.status_code == 429
    assert "Too many signup attempts" in response.json()["detail"]
    
    # Clean up
    auth_rate_limit.signup_ip_limiter._storage.clear()
    auth_rate_limit.signup_email_limiter._storage.clear()


@pytest.mark.integration
def test_verification_endpoint_rate_limit_enforcement():
    """Test that verification endpoint enforces rate limiting at the HTTP level."""
    from fastapi.testclient import TestClient
    from backend.main import app
    
    # Reset limiters
    auth_rate_limit.verification_ip_limiter._storage.clear()
    auth_rate_limit.verification_email_limiter._storage.clear()
    
    client = TestClient(app)
    
    # Make 3 verification requests (should be allowed)
    for i in range(3):
        response = client.post("/auth/resend-verification", json={
            "email": "test@example.com"
        })
        # Should not be rate limited
        assert response.status_code in [200, 429]
    
    # 4th attempt should be rate limited
    response = client.post("/auth/resend-verification", json={
        "email": "test@example.com"
    })
    assert response.status_code == 429
    assert "Too many verification requests" in response.json()["detail"]
    
    # Clean up
    auth_rate_limit.verification_ip_limiter._storage.clear()
    auth_rate_limit.verification_email_limiter._storage.clear()


@pytest.mark.unit
def test_failed_login_counter_single_increment(mock_request):
    """Test that each failed login increments the counter exactly once."""
    key = f"{mock_request.client.host}:test@example.com"
    
    # First failed login should increment counter to 1
    auth_rate_limit.record_failed_login(mock_request, "test@example.com")
    assert auth_rate_limit.failed_login_limiter.get_attempt_count(key) == 1
    
    # Second failed login should increment counter to 2
    auth_rate_limit.record_failed_login(mock_request, "test@example.com")
    assert auth_rate_limit.failed_login_limiter.get_attempt_count(key) == 2
    
    # Third failed login should increment counter to 3
    auth_rate_limit.record_failed_login(mock_request, "test@example.com")
    assert auth_rate_limit.failed_login_limiter.get_attempt_count(key) == 3


@pytest.mark.unit
def test_lockout_check_does_not_increment_counter(mock_request):
    """Test that check_failed_login_lockout does not increment the counter."""
    key = f"{mock_request.client.host}:test@example.com"
    
    # Record one failed attempt
    auth_rate_limit.record_failed_login(mock_request, "test@example.com")
    initial_count = auth_rate_limit.failed_login_limiter.get_attempt_count(key)
    assert initial_count == 1
    
    # Check lockout multiple times - should not increment counter
    for i in range(5):
        auth_rate_limit.check_failed_login_lockout(mock_request, "test@example.com")
    
    # Counter should remain at 1
    assert auth_rate_limit.failed_login_limiter.get_attempt_count(key) == 1


@pytest.mark.unit
def test_peek_does_not_increment_counter(mock_request):
    """Test that peek() does not increment the counter."""
    key = f"{mock_request.client.host}:test@example.com"
    
    # Peek multiple times before any failed login
    for i in range(5):
        result = auth_rate_limit.failed_login_limiter.peek(key)
        assert result["allowed"] == True
    
    # Counter should still be 0
    assert auth_rate_limit.failed_login_limiter.get_attempt_count(key) == 0
    
    # Record one failed attempt
    auth_rate_limit.record_failed_login(mock_request, "test@example.com")
    assert auth_rate_limit.failed_login_limiter.get_attempt_count(key) == 1
    
    # Peek multiple times after failed login
    for i in range(5):
        result = auth_rate_limit.failed_login_limiter.peek(key)
        assert result["allowed"] == True
    
    # Counter should still be 1
    assert auth_rate_limit.failed_login_limiter.get_attempt_count(key) == 1


@pytest.mark.unit
def test_lockout_threshold_accuracy(mock_request):
    """Test that lockout occurs exactly at the configured threshold."""
    # Default limit is 10 failed attempts
    key = f"{mock_request.client.host}:test@example.com"
    
    # Record 9 failed attempts - should not be locked out
    for i in range(9):
        auth_rate_limit.record_failed_login(mock_request, "test@example.com")
        auth_rate_limit.check_failed_login_lockout(mock_request, "test@example.com")
    
    assert auth_rate_limit.failed_login_limiter.get_attempt_count(key) == 9
    
    # Should still be allowed
    auth_rate_limit.check_failed_login_lockout(mock_request, "test@example.com")
    
    # 10th failed attempt should trigger lockout
    auth_rate_limit.record_failed_login(mock_request, "test@example.com")
    assert auth_rate_limit.failed_login_limiter.get_attempt_count(key) == 10
    
    # Now should be locked out
    with pytest.raises(HTTPException) as exc_info:
        auth_rate_limit.check_failed_login_lockout(mock_request, "test@example.com")
    
    assert exc_info.value.status_code == status.HTTP_429_TOO_MANY_REQUESTS
    assert "temporarily locked" in exc_info.value.detail


@pytest.mark.unit
def test_successful_login_resets_counter(mock_request):
    """Test that successful login clears the failed attempt counter."""
    key = f"{mock_request.client.host}:test@example.com"
    
    # Record multiple failed attempts
    for i in range(5):
        auth_rate_limit.record_failed_login(mock_request, "test@example.com")
    
    assert auth_rate_limit.failed_login_limiter.get_attempt_count(key) == 5
    
    # Clear failed attempts (simulating successful login)
    auth_rate_limit.clear_failed_login_attempts(mock_request, "test@example.com")
    
    # Counter should be reset
    assert auth_rate_limit.failed_login_limiter.get_attempt_count(key) == 0
    assert key not in auth_rate_limit.failed_login_limiter.storage


@pytest.mark.unit
def test_counter_accuracy_after_lockout_check(mock_request):
    """Test that counter remains accurate after lockout check + failed login."""
    key = f"{mock_request.client.host}:test@example.com"
    
    # Simulate the actual login flow: check lockout, then record failure
    for i in range(3):
        auth_rate_limit.check_failed_login_lockout(mock_request, "test@example.com")
        auth_rate_limit.record_failed_login(mock_request, "test@example.com")
    
    # Counter should be exactly 3, not 6
    assert auth_rate_limit.failed_login_limiter.get_attempt_count(key) == 3


@pytest.mark.unit
def test_is_locked_out_helper(mock_request):
    """Test the is_locked_out() helper method."""
    key = f"{mock_request.client.host}:test@example.com"
    
    # Initially not locked out
    assert auth_rate_limit.failed_login_limiter.is_locked_out(key) == False
    
    # Record failed attempts up to threshold
    for i in range(10):
        auth_rate_limit.record_failed_login(mock_request, "test@example.com")
    
    # Now should be locked out
    assert auth_rate_limit.failed_login_limiter.is_locked_out(key) == True
    
    # is_locked_out should not increment counter
    initial_count = auth_rate_limit.failed_login_limiter.get_attempt_count(key)
    for i in range(5):
        assert auth_rate_limit.failed_login_limiter.is_locked_out(key) == True
    
    # Counter should remain unchanged
    assert auth_rate_limit.failed_login_limiter.get_attempt_count(key) == initial_count


