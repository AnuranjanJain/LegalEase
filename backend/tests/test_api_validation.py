import pytest
from fastapi import HTTPException
from backend.main import _validate_api_key, ChatRequest, SummarizeRequest
import backend.main


@pytest.mark.unit
def test_validate_api_key_with_bearer_token():
    """Test API key validation with Bearer token"""
    from unittest.mock import Mock
    
    # Mock request with Bearer token
    request = Mock()
    request.headers = {"authorization": "Bearer test-api-key"}
    
    # Set backend configuration directly
    orig_keys = backend.main.API_KEYS
    orig_allow_dev = backend.main.ALLOW_DEV
    backend.main.API_KEYS = ["test-api-key"]
    backend.main.ALLOW_DEV = False
    
    try:
        result = _validate_api_key(request)
        assert result == "test-api-key"
    finally:
        # Clean up
        backend.main.API_KEYS = orig_keys
        backend.main.ALLOW_DEV = orig_allow_dev


@pytest.mark.unit
def test_validate_api_key_with_x_api_key():
    """Test API key validation with X-API-Key header"""
    from unittest.mock import Mock
    
    request = Mock()
    request.headers = {"x-api-key": "test-api-key"}
    
    orig_keys = backend.main.API_KEYS
    orig_allow_dev = backend.main.ALLOW_DEV
    backend.main.API_KEYS = ["test-api-key"]
    backend.main.ALLOW_DEV = False
    
    try:
        result = _validate_api_key(request)
        assert result == "test-api-key"
    finally:
        backend.main.API_KEYS = orig_keys
        backend.main.ALLOW_DEV = orig_allow_dev


@pytest.mark.unit
def test_validate_api_key_missing():
    """Test API key validation when key is missing"""
    from unittest.mock import Mock
    
    request = Mock()
    request.headers = {}
    
    orig_allow_dev = backend.main.ALLOW_DEV
    backend.main.ALLOW_DEV = False
    
    try:
        with pytest.raises(HTTPException) as exc_info:
            _validate_api_key(request)
        assert exc_info.value.status_code == 401
    finally:
        backend.main.ALLOW_DEV = orig_allow_dev


@pytest.mark.unit
def test_validate_api_key_invalid():
    """Test API key validation with invalid key"""
    from unittest.mock import Mock
    
    request = Mock()
    request.headers = {"authorization": "Bearer invalid-key"}
    
    orig_keys = backend.main.API_KEYS
    orig_allow_dev = backend.main.ALLOW_DEV
    backend.main.API_KEYS = ["valid-key"]
    backend.main.ALLOW_DEV = False
    
    try:
        with pytest.raises(HTTPException) as exc_info:
            _validate_api_key(request)
        assert exc_info.value.status_code == 403
    finally:
        backend.main.API_KEYS = orig_keys
        backend.main.ALLOW_DEV = orig_allow_dev


@pytest.mark.unit
def test_validate_api_key_dev_mode():
    """Test API key validation with dev mode enabled"""
    from unittest.mock import Mock
    
    request = Mock()
    request.headers = {"x-api-key": "dev-token"}
    
    orig_keys = backend.main.API_KEYS
    orig_dev_key = backend.main.DEV_API_KEY
    orig_allow_dev = backend.main.ALLOW_DEV
    
    backend.main.API_KEYS = []
    backend.main.DEV_API_KEY = "dev-token"
    backend.main.ALLOW_DEV = True
    
    try:
        result = _validate_api_key(request)
        assert result == "dev-token"
    finally:
        backend.main.API_KEYS = orig_keys
        backend.main.DEV_API_KEY = orig_dev_key
        backend.main.ALLOW_DEV = orig_allow_dev


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
