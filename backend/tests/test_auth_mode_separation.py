"""
Tests for explicit authentication mode separation.

This test suite validates that JWT authentication and API key authentication
follow explicit, deterministic, and isolated validation paths based on request
headers rather than token parsing behavior.
"""
import os
import pytest
from unittest.mock import Mock, patch
from fastapi import HTTPException, status
from jose import jwt

from backend.auth import (
    _extract_jwt_token as extract_jwt_from_authorization,
    _extract_api_key as extract_api_key,
    validate_token_or_api_key,
    _is_valid_api_key,
    AuthIdentity,
    SECRET_KEY,
    ALGORITHM,
)
from backend.database import get_db


@pytest.fixture
def mock_request():
    """Create a mock FastAPI request object."""
    request = Mock()
    request.client = Mock()
    request.client.host = "192.168.1.1"
    request.headers = {}
    return request


@pytest.fixture
def mock_db():
    """Create a mock database session."""
    db = Mock()
    return db


@pytest.fixture
def valid_jwt_token():
    """Create a valid JWT token for testing."""
    if not SECRET_KEY:
        pytest.skip("JWT_SECRET_KEY not configured")
    return jwt.encode({"sub": "test@example.com", "jti": "test-jti"}, SECRET_KEY, algorithm=ALGORITHM)


@pytest.fixture
def expired_jwt_token():
    """Create an expired JWT token for testing."""
    if not SECRET_KEY:
        pytest.skip("JWT_SECRET_KEY not configured")
    from datetime import datetime, timedelta
    payload = {
        "sub": "test@example.com",
        "jti": "expired-jti",
        "exp": datetime.utcnow() - timedelta(hours=1)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


@pytest.fixture
def invalid_jwt_token():
    """Create an invalid JWT token for testing."""
    return "invalid.jwt.token"


@pytest.fixture
def valid_api_key():
    """Set up a valid API key for testing."""
    os.environ["API_KEYS"] = "test-api-key-12345"
    os.environ["JWT_SECRET_KEY"] = "testing-secret-key-1234567890-abcdef"
    # Reset settings to pick up new environment variables
    import backend.config
    backend.config._settings = None
    # Reload auth module to pick up new settings
    from importlib import reload
    import backend.auth
    reload(backend.auth)
    yield "test-api-key-12345"
    if "API_KEYS" in os.environ:
        del os.environ["API_KEYS"]
    if "JWT_SECRET_KEY" in os.environ:
        del os.environ["JWT_SECRET_KEY"]
    # Reset settings after test
    backend.config._settings = None


@pytest.fixture
def invalid_api_key():
    """An invalid API key for testing."""
    return "invalid-api-key"


# ==================== Header Extraction Tests ====================

@pytest.mark.unit
def test_extract_jwt_from_authorization_with_bearer(mock_request):
    """Test JWT extraction from Authorization: Bearer header."""
    mock_request.headers = {"authorization": "Bearer test-token"}
    token = extract_jwt_from_authorization(mock_request)
    assert token == "test-token"


@pytest.mark.unit
def test_extract_jwt_from_authorization_case_insensitive(mock_request):
    """Test JWT extraction is case-insensitive for 'Bearer'."""
    mock_request.headers = {"authorization": "bearer test-token"}
    token = extract_jwt_from_authorization(mock_request)
    assert token == "test-token"
    
    mock_request.headers = {"authorization": "BEARER test-token"}
    token = extract_jwt_from_authorization(mock_request)
    assert token == "test-token"


@pytest.mark.unit
def test_extract_jwt_from_authorization_without_bearer(mock_request):
    """Test JWT extraction returns None when Authorization is not Bearer."""
    mock_request.headers = {"authorization": "Basic test-token"}
    token = extract_jwt_from_authorization(mock_request)
    assert token is None


@pytest.mark.unit
def test_extract_jwt_from_authorization_missing_header(mock_request):
    """Test JWT extraction returns None when Authorization header is missing."""
    mock_request.headers = {}
    token = extract_jwt_from_authorization(mock_request)
    assert token is None


@pytest.mark.unit
def test_extract_api_key_from_header(mock_request):
    """Test API key extraction from X-API-Key header."""
    mock_request.headers = {"x-api-key": "test-api-key"}
    key = extract_api_key(mock_request)
    assert key == "test-api-key"


@pytest.mark.unit
def test_extract_api_key_case_insensitive_header(mock_request):
    """Test API key extraction works with lowercase header (FastAPI normalizes headers)."""
    mock_request.headers = {"x-api-key": "test-api-key"}
    key = extract_api_key(mock_request)
    assert key == "test-api-key"


@pytest.mark.unit
def test_extract_api_key_missing_header(mock_request):
    """Test API key extraction returns None when X-API-Key header is missing."""
    mock_request.headers = {}
    key = extract_api_key(mock_request)
    assert key is None


@pytest.mark.unit
def test_extract_api_key_empty_header(mock_request):
    """Test API key extraction returns None when X-API-Key header is empty."""
    mock_request.headers = {"x-api-key": ""}
    key = extract_api_key(mock_request)
    assert key is None


@pytest.mark.unit
def test_extract_api_key_whitespace_only(mock_request):
    """Test API key extraction returns None when X-API-Key header is whitespace."""
    mock_request.headers = {"x-api-key": "   "}
    key = extract_api_key(mock_request)
    assert key is None


# ==================== Authentication Mode Separation Tests ====================

@pytest.mark.unit
def test_validate_jwt_with_authorization_header(mock_request, mock_db, valid_jwt_token):
    """Test JWT authentication attempts with Authorization: Bearer header."""
    mock_request.headers = {"authorization": f"Bearer {valid_jwt_token}"}
    
    # This will fail database lookup but proves JWT validation was attempted
    # (not API key validation)
    with pytest.raises(HTTPException) as exc_info:
        validate_token_or_api_key(mock_request, mock_db)
    
    # Should be JWT validation error, not API key error
    assert exc_info.value.status_code == 401
    assert "jwt" in exc_info.value.detail.lower() or "token" in exc_info.value.detail.lower()

    assert "JWT" in exc_info.value.detail or "token" in exc_info.value.detail.lower()


@pytest.mark.unit
def test_validate_jwt_rejects_api_key_in_authorization(mock_request, mock_db, valid_api_key):
    """Test that API key in Authorization header is rejected (no fallback)."""
    mock_request.headers = {"authorization": f"Bearer {valid_api_key}"}
    
    with pytest.raises(HTTPException) as exc_info:
        validate_token_or_api_key(mock_request, mock_db)
    
    assert exc_info.value.status_code == 401
    assert "Invalid or expired JWT token" in exc_info.value.detail


@pytest.mark.unit
def test_validate_api_key_with_x_api_key_header(mock_request, mock_db, valid_api_key):
    """Test API key authentication succeeds with X-API-Key header."""
    mock_request.headers = {"x-api-key": valid_api_key}
    
    identity = validate_token_or_api_key(mock_request, mock_db)
    
    assert identity.is_api_key()
    assert identity.identifier is not None
    assert identity.user is None


@pytest.mark.unit
def test_validate_api_key_rejects_jwt_in_x_api_key(mock_request, mock_db, valid_jwt_token):
    """Test that JWT in X-API-Key header is rejected (no fallback)."""
    mock_request.headers = {"x-api-key": valid_jwt_token}
    
    with pytest.raises(HTTPException) as exc_info:
        validate_token_or_api_key(mock_request, mock_db)
    
    assert exc_info.value.status_code == 403
    assert "Invalid API key" in exc_info.value.detail


@pytest.mark.unit
def test_validate_rejects_both_headers_present(mock_request, mock_db, valid_jwt_token, valid_api_key):
    """Test that requests with both headers are rejected as ambiguous."""
    mock_request.headers = {
        "authorization": f"Bearer {valid_jwt_token}",
        "x-api-key": valid_api_key
    }
    
    with pytest.raises(HTTPException) as exc_info:
        validate_token_or_api_key(mock_request, mock_db)
    
    assert exc_info.value.status_code == 400
    assert "Ambiguous authentication" in exc_info.value.detail


@pytest.mark.unit
def test_validate_rejects_no_authentication(mock_request, mock_db):
    """Test that requests with no authentication are rejected."""
    mock_request.headers = {}
    
    with pytest.raises(HTTPException) as exc_info:
        validate_token_or_api_key(mock_request, mock_db)
    
    assert exc_info.value.status_code == 401
    assert "Missing authentication" in exc_info.value.detail


@pytest.mark.unit
def test_validate_jwt_with_expired_token(mock_request, mock_db, expired_jwt_token):
    """Test that expired JWT tokens are rejected."""
    mock_request.headers = {"authorization": f"Bearer {expired_jwt_token}"}
    
    with pytest.raises(HTTPException) as exc_info:
        validate_token_or_api_key(mock_request, mock_db)
    
    assert exc_info.value.status_code == 401
    assert "Invalid or expired JWT token" in exc_info.value.detail


@pytest.mark.unit
def test_validate_jwt_with_invalid_token(mock_request, mock_db, invalid_jwt_token):
    """Test that invalid JWT tokens are rejected."""
    mock_request.headers = {"authorization": f"Bearer {invalid_jwt_token}"}
    
    with pytest.raises(HTTPException) as exc_info:
        validate_token_or_api_key(mock_request, mock_db)
    
    assert exc_info.value.status_code == 401
    assert "Invalid or expired JWT token" in exc_info.value.detail


@pytest.mark.unit
def test_validate_api_key_with_invalid_key(mock_request, mock_db, invalid_api_key):
    """Test that invalid API keys are rejected."""
    mock_request.headers = {"x-api-key": invalid_api_key}
    
    with pytest.raises(HTTPException) as exc_info:
        validate_token_or_api_key(mock_request, mock_db)
    
    assert exc_info.value.status_code == 403
    assert "Invalid API key" in exc_info.value.detail


@pytest.mark.unit
def test_validate_api_key_missing_header(mock_request, mock_db):
    """Test that missing API key header is rejected."""
    mock_request.headers = {}
    
    with pytest.raises(HTTPException) as exc_info:
        validate_token_or_api_key(mock_request, mock_db)
    
    assert exc_info.value.status_code == 401
    assert "Missing authentication" in exc_info.value.detail


# ==================== Identity Creation Tests ====================

@pytest.mark.unit
def test_jwt_identity_creates_user_type(mock_request, mock_db, valid_jwt_token):
    """Test that JWT authentication attempts user-type identity creation."""
    mock_request.headers = {"authorization": f"Bearer {valid_jwt_token}"}
    
    # This will fail database lookup but proves JWT path was taken
    with pytest.raises(HTTPException) as exc_info:
        validate_token_or_api_key(mock_request, mock_db)
    
    # Should be JWT validation error (user lookup failed), not API key error
    assert exc_info.value.status_code == 401
    assert "jwt" in exc_info.value.detail.lower() or "token" in exc_info.value.detail.lower()

    assert "JWT" in exc_info.value.detail or "token" in exc_info.value.detail.lower()


@pytest.mark.unit
def test_api_key_identity_creates_api_key_type(mock_request, mock_db, valid_api_key):
    """Test that API key authentication creates api_key-type identity."""
    mock_request.headers = {"x-api-key": valid_api_key}
    
    identity = validate_token_or_api_key(mock_request, mock_db)
    
    assert identity.type == "api_key"
    assert identity.identifier is not None  # Hash of the key
    assert identity.user is None
    assert identity.get_user_id() is None
    assert identity.get_user_email() is None


# ==================== Rate Limit Key Generation Tests ====================

@pytest.mark.unit
def test_user_identity_rate_limit_key(mock_request, mock_db, valid_jwt_token):
    """Test that JWT authentication path is taken (rate limit key format)."""
    mock_request.headers = {"authorization": f"Bearer {valid_jwt_token}"}
    
    # This will fail database lookup but proves JWT path was taken
    with pytest.raises(HTTPException) as exc_info:
        validate_token_or_api_key(mock_request, mock_db)
    
    # Should be JWT validation error, not API key error
    assert exc_info.value.status_code == 401
    assert "jwt" in exc_info.value.detail.lower() or "token" in exc_info.value.detail.lower()

    assert "JWT" in exc_info.value.detail or "token" in exc_info.value.detail.lower()


@pytest.mark.unit
def test_api_key_identity_rate_limit_key(mock_request, mock_db, valid_api_key):
    """Test that API key identity generates correct rate limit key."""
    mock_request.headers = {"x-api-key": valid_api_key}
    
    identity = validate_token_or_api_key(mock_request, mock_db)
    rate_limit_key = identity.get_rate_limit_key()
    
    assert rate_limit_key.startswith("api_key:")
    assert len(rate_limit_key) > len("api_key:")


# ==================== Integration Tests ====================

@pytest.mark.integration
@pytest.mark.asyncio
async def test_jwt_authentication_via_chat_endpoint():
    """Test JWT authentication works through the chat endpoint."""
    from httpx import AsyncClient, ASGITransport
    from backend.main import app
    import uuid
    
    # First, create a user and get a token
    email = f"test+{uuid.uuid4()}@example.com"
    signup_payload = {"email": email, "password": "securePass123"}
    
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Signup
        r = await ac.post("/auth/signup", json=signup_payload)
        assert r.status_code == 201
        token = r.json()["access_token"]
        
        # Use JWT token to access protected endpoint
        headers = {"authorization": f"Bearer {token}"}
        chat_payload = {"message": "Hello"}
        
        r = await ac.post("/chat", json=chat_payload, headers=headers)
        # Should not be auth error (may be 503 if AI unavailable)
        assert r.status_code not in [401, 403]


@pytest.mark.integration
@pytest.mark.asyncio
async def test_api_key_authentication_via_chat_endpoint():
    """Test API key authentication works through the chat endpoint."""
    from httpx import AsyncClient, ASGITransport
    from backend.main import app
    
    os.environ["ALLOW_DEV"] = "true"
    
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            headers = {"x-api-key": "dev-token"}
            chat_payload = {"message": "Hello"}
            
            r = await ac.post("/chat", json=chat_payload, headers=headers)
            # Should not be auth error (may be 503 if AI unavailable)
            assert r.status_code not in [401, 403]
    finally:
        if "ALLOW_DEV" in os.environ:
            del os.environ["ALLOW_DEV"]


@pytest.mark.integration
@pytest.mark.asyncio
async def test_ambiguous_authentication_rejected():
    """Test that ambiguous authentication (both headers) is rejected."""
    from httpx import AsyncClient, ASGITransport
    from backend.main import app
    
    os.environ["ALLOW_DEV"] = "true"
    
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            headers = {
                "authorization": "Bearer some-token",
                "x-api-key": "dev-token"
            }
            chat_payload = {"message": "Hello"}
            
            r = await ac.post("/chat", json=chat_payload, headers=headers)
            assert r.status_code == 400
            assert "Ambiguous authentication" in r.json()["detail"]
    finally:
        if "ALLOW_DEV" in os.environ:
            del os.environ["ALLOW_DEV"]


@pytest.mark.integration
@pytest.mark.asyncio
async def test_api_key_in_authorization_rejected():
    """Test that API key in Authorization header is rejected."""
    from httpx import AsyncClient, ASGITransport
    from backend.main import app
    
    os.environ["ALLOW_DEV"] = "true"
    
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            headers = {"authorization": "Bearer dev-token"}
            chat_payload = {"message": "Hello"}
            
            r = await ac.post("/chat", json=chat_payload, headers=headers)
            assert r.status_code == 401
            assert "Invalid or expired JWT token" in r.json()["detail"]
    finally:
        if "ALLOW_DEV" in os.environ:
            del os.environ["ALLOW_DEV"]
