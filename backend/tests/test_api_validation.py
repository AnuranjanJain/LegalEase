import pytest
from fastapi import HTTPException
from backend.auth import _validate_api_key, _extract_jwt_token, _extract_api_key, _determine_auth_mode
from backend.main import ChatRequest, SummarizeRequest


@pytest.mark.unit
def test_validate_api_key_with_x_api_key():
    """Test API key validation with X-API-Key header"""
    import os
    from unittest.mock import Mock, patch
    
    request = Mock()
    request.headers = {"x-api-key": "test-api-key"}
    
    with patch.dict(os.environ, {"API_KEYS": "test-api-key", "ALLOW_DEV": "false"}):
        with pytest.raises(HTTPException) as exc_info:
            _validate_api_key(request)
        assert exc_info.value.status_code == 401


@pytest.mark.unit
def test_validate_api_key_with_bearer_token_rejected():
    """Test API key validation rejects Bearer token format (strict separation)"""
    import os
    from unittest.mock import Mock, patch
    
    # Mock request with Bearer token - should be rejected since _validate_api_key
    # only accepts X-API-Key header for strict separation
    request = Mock()
    request.headers = {"authorization": "Bearer test-api-key"}
    
    with patch.dict(os.environ, {"API_KEYS": "test-api-key", "ALLOW_DEV": "false"}):
        with pytest.raises(HTTPException) as exc_info:
            _validate_api_key(request)
        assert exc_info.value.status_code == 401
        assert "X-API-Key" in exc_info.value.detail


@pytest.mark.unit
def test_validate_api_key_missing():
    """Test API key validation when key is missing"""
    import os
    from unittest.mock import Mock, patch
    
    request = Mock()
    request.headers = {}
    
    with patch.dict(os.environ, {"ALLOW_DEV": "false"}):
        with pytest.raises(HTTPException) as exc_info:
            _validate_api_key(request)
        assert exc_info.value.status_code == 401


@pytest.mark.unit
def test_validate_api_key_invalid():
    """Test API key validation with invalid key"""
    import os
    from unittest.mock import Mock, patch
    
    request = Mock()
    request.headers = {"x-api-key": "invalid-key"}
    
    with patch.dict(os.environ, {"API_KEYS": "valid-key", "ALLOW_DEV": "false"}):
        with pytest.raises(HTTPException) as exc_info:
            _validate_api_key(request)
        assert exc_info.value.status_code == 403


@pytest.mark.unit
def test_validate_api_key_dev_mode():
    """Test API key validation with dev mode enabled"""
    import os
    from unittest.mock import Mock, patch
    
    request = Mock()
    request.headers = {"x-api-key": "dev-token"}
    
    with patch.dict(os.environ, {"API_KEYS": "", "DEV_API_KEY": "dev-token", "ALLOW_DEV": "true"}):
        result = _validate_api_key(request)
        assert result == "dev-token"


@pytest.mark.unit
def test_extract_jwt_token_from_authorization():
    """Test JWT token extraction from Authorization header"""
    from unittest.mock import Mock
    
    request = Mock()
    request.headers = {"authorization": "Bearer test-jwt-token"}
    
    result = _extract_jwt_token(request)
    assert result == "test-jwt-token"


@pytest.mark.unit
def test_extract_jwt_token_missing():
    """Test JWT token extraction when header is missing"""
    from unittest.mock import Mock
    
    request = Mock()
    request.headers = {}
    
    result = _extract_jwt_token(request)
    assert result is None


@pytest.mark.unit
def test_extract_jwt_token_from_x_api_key_rejected():
    """Test JWT token extraction rejects X-API-Key header (strict separation)"""
    from unittest.mock import Mock
    
    request = Mock()
    request.headers = {"x-api-key": "some-token"}
    
    result = _extract_jwt_token(request)
    assert result is None


@pytest.mark.unit
def test_extract_api_key_from_x_api_key():
    """Test API key extraction from X-API-Key header"""
    from unittest.mock import Mock
    
    request = Mock()
    request.headers = {"x-api-key": "test-api-key"}
    
    result = _extract_api_key(request)
    assert result == "test-api-key"


@pytest.mark.unit
def test_extract_api_key_missing():
    """Test API key extraction when header is missing"""
    from unittest.mock import Mock
    
    request = Mock()
    request.headers = {}
    
    result = _extract_api_key(request)
    assert result is None


@pytest.mark.unit
def test_extract_api_key_from_authorization_rejected():
    """Test API key extraction rejects Authorization header (strict separation)"""
    from unittest.mock import Mock
    
    request = Mock()
    request.headers = {"authorization": "Bearer some-token"}
    
    result = _extract_api_key(request)
    assert result is None


@pytest.mark.unit
def test_determine_auth_mode_jwt():
    """Test authentication mode detection for JWT"""
    from unittest.mock import Mock
    
    request = Mock()
    request.headers = {"authorization": "Bearer jwt-token"}
    
    result = _determine_auth_mode(request)
    assert result == "jwt"


@pytest.mark.unit
def test_determine_auth_mode_api_key():
    """Test authentication mode detection for API key"""
    from unittest.mock import Mock
    
    request = Mock()
    request.headers = {"x-api-key": "api-key"}
    
    result = _determine_auth_mode(request)
    assert result == "api_key"


@pytest.mark.unit
def test_determine_auth_mode_none():
    """Test authentication mode detection when no credentials"""
    from unittest.mock import Mock
    
    request = Mock()
    request.headers = {}
    
    result = _determine_auth_mode(request)
    assert result == "none"


@pytest.mark.unit
def test_determine_auth_mode_both_headers_rejected():
    """Test authentication mode detection rejects both headers present"""
    from unittest.mock import Mock
    
    request = Mock()
    request.headers = {"authorization": "Bearer jwt-token", "x-api-key": "api-key"}
    
    with pytest.raises(HTTPException) as exc_info:
        _determine_auth_mode(request)
    assert exc_info.value.status_code == 400
    assert "Ambiguous authentication" in exc_info.value.detail


@pytest.mark.unit
def test_chat_request_model():
    """Test ChatRequest model validation"""
    # Valid request
    request = ChatRequest(message="Hello", context="Some context")
    assert request.message == "Hello"
    assert request.context == "Some context"
    
    # Request without context (optional)
    request = ChatRequest(message="Hello")
    assert request.message == "Hello"
    assert request.context is None


@pytest.mark.unit
def test_summarize_request_model():
    """Test SummarizeRequest model validation"""
    request = SummarizeRequest(text="Some text to summarize")
    assert request.text == "Some text to summarize"
