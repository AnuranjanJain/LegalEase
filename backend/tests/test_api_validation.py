import os
import pytest
from fastapi import HTTPException
from unittest.mock import Mock, patch
from backend.auth import validate_token_or_api_key
from backend.main import ChatRequest, SummarizeRequest


@pytest.mark.unit
def test_validate_api_key_with_bearer_token():
    """Test API key validation with Bearer token"""
    request = Mock()
    request.headers = {"authorization": "Bearer test-api-key"}
    
    with patch.dict(os.environ, {"API_KEYS": "test-api-key", "ALLOW_DEV": "false"}):
        result = validate_token_or_api_key(request)
        assert result == "test-api-key"


@pytest.mark.unit
def test_validate_api_key_with_x_api_key():
    """Test API key validation with X-API-Key header"""
    request = Mock()
    request.headers = {"x-api-key": "test-api-key"}
    
    with patch.dict(os.environ, {"API_KEYS": "test-api-key", "ALLOW_DEV": "false"}):
        result = validate_token_or_api_key(request)
        assert result == "test-api-key"


@pytest.mark.unit
def test_validate_api_key_missing():
    """Test API key validation when key is missing"""
    request = Mock()
    request.headers = {}
    
    with patch.dict(os.environ, {"ALLOW_DEV": "false"}):
        with pytest.raises(HTTPException) as exc_info:
            validate_token_or_api_key(request)
        assert exc_info.value.status_code == 401


@pytest.mark.unit
def test_validate_api_key_invalid():
    """Test API key validation with invalid key"""
    request = Mock()
    request.headers = {"authorization": "Bearer invalid-key"}
    
    with patch.dict(os.environ, {"API_KEYS": "valid-key", "ALLOW_DEV": "false"}):
        with pytest.raises(HTTPException) as exc_info:
            validate_token_or_api_key(request)
        assert exc_info.value.status_code == 403


@pytest.mark.unit
def test_validate_api_key_dev_mode():
    """Test API key validation with dev mode enabled"""
    request = Mock()
    request.headers = {"x-api-key": "dev-token"}
    
    with patch.dict(os.environ, {"API_KEYS": "", "DEV_API_KEY": "dev-token", "ALLOW_DEV": "true"}):
        result = validate_token_or_api_key(request)
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


@pytest.mark.unit
def test_validate_api_key_production_gating():
    """Test that dev mode API key is rejected in production environment, even if ALLOW_DEV is true"""
    request = Mock()
    request.headers = {"x-api-key": "dev-token"}
    
    with patch.dict(os.environ, {
        "API_KEYS": "prod-key-1,prod-key-2",
        "DEV_API_KEY": "dev-token",
        "ALLOW_DEV": "true",
        "APP_ENV": "production"
    }):
        with pytest.raises(HTTPException) as exc_info:
            validate_token_or_api_key(request)
        assert exc_info.value.status_code == 403
