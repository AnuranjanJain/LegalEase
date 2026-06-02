import pytest
from fastapi import HTTPException
from auth import validate_token_or_api_key
from backend.main import ChatRequest, SummarizeRequest


@pytest.mark.unit
def test_validate_api_key_with_bearer_token():
    """Test API key validation with Bearer token"""
    from unittest.mock import Mock
    
    # Mock request with Bearer token
    request = Mock()
    request.headers = {"authorization": "Bearer test-api-key"}
    
    # Set environment to allow dev mode
    import os
    os.environ["API_KEYS"] = "test-api-key"
    os.environ["ALLOW_DEV"] = "false"
    
    try:
        result = validate_token_or_api_key(request)
        assert result == "test-api-key"
    finally:
        # Clean up
        if "API_KEYS" in os.environ:
            del os.environ["API_KEYS"]
        if "ALLOW_DEV" in os.environ:
            del os.environ["ALLOW_DEV"]


@pytest.mark.unit
def test_validate_api_key_with_x_api_key():
    """Test API key validation with X-API-Key header"""
    from unittest.mock import Mock
    
    request = Mock()
    request.headers = {"x-api-key": "test-api-key"}
    
    import os
    os.environ["API_KEYS"] = "test-api-key"
    os.environ["ALLOW_DEV"] = "false"
    
    try:
        result = validate_token_or_api_key(request)
        assert result == "test-api-key"
    finally:
        if "API_KEYS" in os.environ:
            del os.environ["API_KEYS"]
        if "ALLOW_DEV" in os.environ:
            del os.environ["ALLOW_DEV"]


@pytest.mark.unit
def test_validate_api_key_missing():
    """Test API key validation when key is missing"""
    from unittest.mock import Mock
    
    request = Mock()
    request.headers = {}
    
    import os
    os.environ["ALLOW_DEV"] = "false"
    
    try:
        with pytest.raises(HTTPException) as exc_info:
            validate_token_or_api_key(request)
        assert exc_info.value.status_code == 401
    finally:
        if "ALLOW_DEV" in os.environ:
            del os.environ["ALLOW_DEV"]


@pytest.mark.unit
def test_validate_api_key_invalid():
    """Test API key validation with invalid key"""
    from unittest.mock import Mock
    
    request = Mock()
    request.headers = {"authorization": "Bearer invalid-key"}
    
    import os
    os.environ["API_KEYS"] = "valid-key"
    os.environ["ALLOW_DEV"] = "false"
    
    try:
        with pytest.raises(HTTPException) as exc_info:
            validate_token_or_api_key(request)
        assert exc_info.value.status_code == 403
    finally:
        if "API_KEYS" in os.environ:
            del os.environ["API_KEYS"]
        if "ALLOW_DEV" in os.environ:
            del os.environ["ALLOW_DEV"]


@pytest.mark.unit
def test_validate_api_key_dev_mode():
    """Test API key validation with dev mode enabled"""
    from unittest.mock import Mock
    
    request = Mock()
    request.headers = {"x-api-key": "dev-token"}
    
    import os
    os.environ["API_KEYS"] = ""
    os.environ["DEV_API_KEY"] = "dev-token"
    os.environ["ALLOW_DEV"] = "true"
    
    try:
        result = validate_token_or_api_key(request)
        assert result == "dev-token"
    finally:
        if "API_KEYS" in os.environ:
            del os.environ["API_KEYS"]
        if "DEV_API_KEY" in os.environ:
            del os.environ["DEV_API_KEY"]
        if "ALLOW_DEV" in os.environ:
            del os.environ["ALLOW_DEV"]


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


@pytest.mark.unit
def test_validate_api_key_production_gating():
    """Test that dev mode API key is rejected in production environment, even if ALLOW_DEV is true"""
    from unittest.mock import Mock
    import os
    
    request = Mock()
    request.headers = {"x-api-key": "dev-token"}
    
    os.environ["API_KEYS"] = "prod-key-1,prod-key-2"
    os.environ["DEV_API_KEY"] = "dev-token"
    os.environ["ALLOW_DEV"] = "true"
    os.environ["APP_ENV"] = "production"
    
    try:
        with pytest.raises(HTTPException) as exc_info:
            validate_token_or_api_key(request)
        assert exc_info.value.status_code == 403
    finally:
        if "API_KEYS" in os.environ:
            del os.environ["API_KEYS"]
        if "DEV_API_KEY" in os.environ:
            del os.environ["DEV_API_KEY"]
        if "ALLOW_DEV" in os.environ:
            del os.environ["ALLOW_DEV"]
        if "APP_ENV" in os.environ:
            del os.environ["APP_ENV"]
