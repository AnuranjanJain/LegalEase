import pytest
from fastapi import HTTPException
from backend.auth import _validate_api_key
from backend.main import ChatRequest, SummarizeRequest


@pytest.mark.unit
def test_validate_api_key_with_bearer_token():
    """Test API key validation with Bearer token"""
    import os
    from unittest.mock import Mock, patch
    
    # Mock request with Bearer token
    request = Mock()
    request.headers = {"authorization": "Bearer test-api-key"}
    
    with patch.dict(os.environ, {"API_KEYS": "test-api-key", "ALLOW_DEV": "false"}):
        result = _validate_api_key(request)
        assert result == "test-api-key"


@pytest.mark.unit
def test_validate_api_key_with_x_api_key():
    """Test API key validation with X-API-Key header"""
    import os
    from unittest.mock import Mock, patch
    
    request = Mock()
    request.headers = {"x-api-key": "test-api-key"}
    
    with patch.dict(os.environ, {"API_KEYS": "test-api-key", "ALLOW_DEV": "false"}):
        result = _validate_api_key(request)
        assert result == "test-api-key"


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
    request.headers = {"authorization": "Bearer invalid-key"}
    
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
