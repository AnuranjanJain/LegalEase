"""
Integration tests for authentication flows.

These tests verify the strict separation between JWT and API key authentication
at the integration level, testing actual endpoint behavior.
"""
import pytest
import os
from fastapi import HTTPException
from unittest.mock import Mock, patch
from jose import jwt

from backend.auth import (
    validate_token_or_api_key,
    _validate_jwt_token,
    _validate_api_key_token,
    _determine_auth_mode,
    create_access_token,
    SECRET_KEY,
    ALGORITHM,
    AuthIdentity
)
from backend.database import get_db


@pytest.mark.integration
def test_jwt_authentication_flow_valid_token():
    """Test complete JWT authentication flow with valid token"""
    from unittest.mock import Mock
    import hashlib
    
    # Create a mock request with valid JWT
    request = Mock()
    request.headers = {"authorization": "Bearer valid-jwt-token"}
    
    # Mock the JWT decode to return a valid payload
    with patch('backend.auth.jwt.decode') as mock_decode:
        mock_decode.return_value = {
            "sub": "test@example.com",
            "jti": "test-jti-123",
            "exp": 9999999999  # Far future
        }
        
        # Mock database query
        mock_db = Mock()
        mock_user = Mock()
        mock_user.email = "test@example.com"
        mock_db.query.return_value.filter.return_value.first.return_value = mock_user
        
        # Mock is_token_revoked to return False
        with patch('backend.auth.is_token_revoked', return_value=False):
            identity = _validate_jwt_token(request, mock_db)
            
            assert identity.type == "user"
            assert identity.identifier == "test@example.com"
            assert identity.user == mock_user


@pytest.mark.integration
def test_jwt_authentication_flow_expired_token():
    """Test JWT authentication flow with expired token"""
    from unittest.mock import Mock
    
    request = Mock()
    request.headers = {"authorization": "Bearer expired-jwt-token"}
    
    mock_db = Mock()
    
    # Mock JWT decode to raise JWTError (expired)
    with patch('backend.auth.jwt.decode', side_effect=jwt.JWTError("Token expired")):
        with pytest.raises(HTTPException) as exc_info:
            _validate_jwt_token(request, mock_db)
        
        assert exc_info.value.status_code == 401
        assert "Invalid or expired JWT token" in exc_info.value.detail


@pytest.mark.integration
def test_jwt_authentication_flow_revoked_token():
    """Test JWT authentication flow with revoked token"""
    from unittest.mock import Mock
    
    request = Mock()
    request.headers = {"authorization": "Bearer revoked-jwt-token"}
    
    mock_db = Mock()
    
    # Mock JWT decode to return a valid payload
    with patch('backend.auth.jwt.decode') as mock_decode:
        mock_decode.return_value = {
            "sub": "test@example.com",
            "jti": "revoked-jti-123",
            "exp": 9999999999
        }
        
        # Mock is_token_revoked to return True
        with patch('backend.auth.is_token_revoked', return_value=True):
            with pytest.raises(HTTPException) as exc_info:
                _validate_jwt_token(request, mock_db)
            
            assert exc_info.value.status_code == 401
            assert "revoked" in exc_info.value.detail.lower()


@pytest.mark.integration
def test_api_key_authentication_flow_valid_key():
    """Test complete API key authentication flow with valid key"""
    from unittest.mock import Mock
    import hashlib
    
    request = Mock()
    request.headers = {"x-api-key": "valid-api-key"}
    
    with patch.dict(os.environ, {"API_KEYS": "valid-api-key", "ALLOW_DEV": "false"}):
        identity = _validate_api_key_token(request)
        
        assert identity.type == "api_key"
        assert identity.user is None
        # Verify the key is hashed
        expected_hash = hashlib.sha256("valid-api-key".encode()).hexdigest()[:16]
        assert identity.identifier == expected_hash


@pytest.mark.integration
def test_api_key_authentication_flow_invalid_key():
    """Test API key authentication flow with invalid key"""
    from unittest.mock import Mock
    
    request = Mock()
    request.headers = {"x-api-key": "invalid-api-key"}
    
    with patch.dict(os.environ, {"API_KEYS": "valid-api-key", "ALLOW_DEV": "false"}):
        with pytest.raises(HTTPException) as exc_info:
            _validate_api_key_token(request)
        
        assert exc_info.value.status_code == 403
        assert "Invalid API key" in exc_info.value.detail


@pytest.mark.integration
def test_api_key_authentication_flow_dev_mode():
    """Test API key authentication flow in dev mode"""
    from unittest.mock import Mock
    import hashlib
    
    request = Mock()
    request.headers = {"x-api-key": "dev-token"}
    
    with patch.dict(os.environ, {"API_KEYS": "", "DEV_API_KEY": "dev-token", "ALLOW_DEV": "true"}):
        identity = _validate_api_key_token(request)
        
        assert identity.type == "api_key"
        assert identity.user is None
        expected_hash = hashlib.sha256("dev-token".encode()).hexdigest()[:16]
        assert identity.identifier == expected_hash


@pytest.mark.integration
def test_unified_auth_jwt_mode():
    """Test unified authentication with JWT mode"""
    from unittest.mock import Mock
    
    request = Mock()
    request.headers = {"authorization": "Bearer jwt-token"}
    
    mock_db = Mock()
    mock_user = Mock()
    mock_user.email = "test@example.com"
    mock_db.query.return_value.filter.return_value.first.return_value = mock_user
    
    with patch('backend.auth.jwt.decode') as mock_decode:
        mock_decode.return_value = {
            "sub": "test@example.com",
            "jti": "test-jti",
            "exp": 9999999999
        }
        with patch('backend.auth.is_token_revoked', return_value=False):
            identity = validate_token_or_api_key(request, mock_db)
            
            assert identity.type == "user"
            assert identity.identifier == "test@example.com"


@pytest.mark.integration
def test_unified_auth_api_key_mode():
    """Test unified authentication with API key mode"""
    from unittest.mock import Mock
    
    request = Mock()
    request.headers = {"x-api-key": "valid-api-key"}
    
    mock_db = Mock()
    
    with patch.dict(os.environ, {"API_KEYS": "valid-api-key", "ALLOW_DEV": "false"}):
        identity = validate_token_or_api_key(request, mock_db)
        
        assert identity.type == "api_key"
        assert identity.user is None


@pytest.mark.integration
def test_unified_auth_no_credentials():
    """Test unified authentication with no credentials"""
    from unittest.mock import Mock
    
    request = Mock()
    request.headers = {}
    
    mock_db = Mock()
    
    with pytest.raises(HTTPException) as exc_info:
        validate_token_or_api_key(request, mock_db)
    
    assert exc_info.value.status_code == 401
    assert "Missing authentication token" in exc_info.value.detail


@pytest.mark.integration
def test_unified_auth_both_headers_rejected():
    """Test unified authentication rejects both headers present"""
    from unittest.mock import Mock
    
    request = Mock()
    request.headers = {
        "authorization": "Bearer jwt-token",
        "x-api-key": "api-key"
    }
    
    mock_db = Mock()
    
    with pytest.raises(HTTPException) as exc_info:
        validate_token_or_api_key(request, mock_db)
    
    assert exc_info.value.status_code == 400
    assert "Ambiguous authentication" in exc_info.value.detail


@pytest.mark.integration
def test_jwt_token_in_x_api_key_header_rejected():
    """Test that JWT token in X-API-Key header is not processed as JWT"""
    from unittest.mock import Mock
    
    request = Mock()
    request.headers = {"x-api-key": "Bearer jwt-token"}
    
    mock_db = Mock()
    
    # This should attempt API key validation, not JWT validation
    with patch.dict(os.environ, {"API_KEYS": "", "ALLOW_DEV": "false"}):
        with pytest.raises(HTTPException) as exc_info:
            validate_token_or_api_key(request, mock_db)
        
        # Should fail as invalid API key, not as JWT
        assert exc_info.value.status_code == 403


@pytest.mark.integration
def test_api_key_in_authorization_header_rejected():
    """Test that API key in Authorization header is not processed as API key"""
    from unittest.mock import Mock
    
    request = Mock()
    request.headers = {"authorization": "Bearer valid-api-key"}
    
    mock_db = Mock()
    
    # This should attempt JWT validation, not API key validation
    with patch('backend.auth.jwt.decode', side_effect=jwt.JWTError("Invalid JWT")):
        with pytest.raises(HTTPException) as exc_info:
            validate_token_or_api_key(request, mock_db)
        
        # Should fail as invalid JWT, not as API key
        assert exc_info.value.status_code == 401
        assert "JWT" in exc_info.value.detail


@pytest.mark.integration
def test_auth_mode_detection_jwt_only():
    """Test auth mode detection with JWT only"""
    from unittest.mock import Mock
    
    request = Mock()
    request.headers = {"authorization": "Bearer jwt-token"}
    
    mode = _determine_auth_mode(request)
    assert mode == "jwt"


@pytest.mark.integration
def test_auth_mode_detection_api_key_only():
    """Test auth mode detection with API key only"""
    from unittest.mock import Mock
    
    request = Mock()
    request.headers = {"x-api-key": "api-key"}
    
    mode = _determine_auth_mode(request)
    assert mode == "api_key"


@pytest.mark.integration
def test_auth_mode_detection_none():
    """Test auth mode detection with no credentials"""
    from unittest.mock import Mock
    
    request = Mock()
    request.headers = {}
    
    mode = _determine_auth_mode(request)
    assert mode == "none"


@pytest.mark.integration
def test_auth_mode_detection_both_rejected():
    """Test auth mode detection rejects both headers"""
    from unittest.mock import Mock
    
    request = Mock()
    request.headers = {
        "authorization": "Bearer jwt-token",
        "x-api-key": "api-key"
    }
    
    with pytest.raises(HTTPException) as exc_info:
        _determine_auth_mode(request)
    
    assert exc_info.value.status_code == 400
    assert "Ambiguous authentication" in exc_info.value.detail


@pytest.mark.integration
def test_create_and_validate_jwt_token():
    """Test creating a JWT token and validating it"""
    from unittest.mock import Mock
    
    # Create a token
    token = create_access_token(data={"sub": "test@example.com"})
    
    # Validate it
    request = Mock()
    request.headers = {"authorization": f"Bearer {token}"}
    
    mock_db = Mock()
    mock_user = Mock()
    mock_user.email = "test@example.com"
    mock_db.query.return_value.filter.return_value.first.return_value = mock_user
    
    with patch('backend.auth.is_token_revoked', return_value=False):
        identity = _validate_jwt_token(request, mock_db)
        
        assert identity.type == "user"
        assert identity.identifier == "test@example.com"


@pytest.mark.integration
def test_jwt_token_contains_jti():
    """Test that created JWT tokens contain jti for revocation"""
    token = create_access_token(data={"sub": "test@example.com"})
    
    # Decode the token
    payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    
    assert "jti" in payload
    assert "exp" in payload
    assert payload["sub"] == "test@example.com"


@pytest.mark.integration
def test_auth_identity_user_methods():
    """Test AuthIdentity user methods"""
    mock_user = Mock()
    mock_user.id = 123
    mock_user.email = "test@example.com"
    
    identity = AuthIdentity(
        identity_type="user",
        identifier="test@example.com",
        user=mock_user
    )
    
    assert identity.is_user() is True
    assert identity.is_api_key() is False
    assert identity.get_user_id() == 123
    assert identity.get_user_email() == "test@example.com"
    assert identity.get_rate_limit_key() == "user:test@example.com"


@pytest.mark.integration
def test_auth_identity_api_key_methods():
    """Test AuthIdentity API key methods"""
    identity = AuthIdentity(
        identity_type="api_key",
        identifier="abc123def456",
        user=None
    )
    
    assert identity.is_user() is False
    assert identity.is_api_key() is True
    assert identity.get_user_id() is None
    assert identity.get_user_email() is None
    assert identity.get_rate_limit_key() == "api_key:abc123def456"


@pytest.mark.integration
def test_auth_identity_string_representation():
    """Test AuthIdentity string representation for logging"""
    mock_user = Mock()
    mock_user.email = "test@example.com"
    
    user_identity = AuthIdentity(
        identity_type="user",
        identifier="test@example.com",
        user=mock_user
    )
    
    api_key_identity = AuthIdentity(
        identity_type="api_key",
        identifier="abc123def456",
        user=None
    )
    
    assert "User(email=test@example.com)" in str(user_identity)
    assert "APIKey(key=abc123de...)" in str(api_key_identity)
