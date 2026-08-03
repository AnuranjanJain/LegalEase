"""
Security tests for rate limit middleware to ensure TEST_MODE never bypasses rate limiting.

This test suite validates that:
- Rate limiting middleware executes in every environment
- TEST_MODE never causes early exit from middleware
- Production always enforces rate limiting
- Configuration validation prevents insecure deployments
- Rate limit headers remain unchanged
- Retry-After header still exists
"""
import pytest
import os
from unittest.mock import patch, MagicMock
from fastapi import Request
from fastapi.responses import Response
import backend.config
import backend.middleware.rate_limit as rate_limit_module


# Reset settings before tests
@pytest.fixture(autouse=True)
def reset_settings():
    """Reset settings before each test."""
    backend.config._settings = None
    # Reset middleware module to reload with new settings
    if hasattr(rate_limit_module, 'ip_limiter'):
        rate_limit_module.ip_limiter.storage.clear()
    yield
    backend.config._settings = None


@pytest.mark.security
def test_middleware_executes_in_production():
    """Test that rate limiting middleware executes in production environment."""
    with patch.dict(os.environ, {
        "JWT_SECRET_KEY": "test-secret-key",
        "ENVIRONMENT": "production",
        "TEST_MODE": "false",
        "DOCUMENT_ENCRYPTION_KEY": "test-encryption-key",
        "RATE_LIMIT_IP_CALLS": "60",
        "RATE_LIMIT_PERIOD": "60",
        "REQUIRE_REDIS_IN_PRODUCTION": "false",  # Disable for test
    }, clear=True):
        # Force reload of middleware module with new environment
        import importlib
        importlib.reload(rate_limit_module)
        
        from backend.middleware.rate_limit import RateLimitMiddleware
        from fastapi import FastAPI
        
        app = FastAPI()
        middleware = RateLimitMiddleware(app)
        
        # Create mock request
        mock_request = MagicMock(spec=Request)
        mock_request.url.path = "/api/test"
        mock_request.client.host = "127.0.0.1"
        mock_request.headers.get.return_value = ""
        
        # Create mock call_next
        async def call_next(request):
            response = Response(content="OK")
            return response
        
        # Execute middleware
        import asyncio
        response = asyncio.run(middleware.dispatch(mock_request, call_next))
        
        # Verify middleware executed (rate limit headers should be present)
        assert "X-RateLimit-Limit" in response.headers
        assert "X-RateLimit-Remaining" in response.headers


@pytest.mark.security
def test_middleware_executes_in_development():
    """Test that rate limiting middleware executes in development environment."""
    with patch.dict(os.environ, {
        "JWT_SECRET_KEY": "test-secret-key",
        "ENVIRONMENT": "development",
        "RATE_LIMIT_IP_CALLS": "60",
        "RATE_LIMIT_PERIOD": "60",
    }, clear=True):
        # Force reload of middleware module with new environment
        import importlib
        importlib.reload(rate_limit_module)
        
        from backend.middleware.rate_limit import RateLimitMiddleware
        from fastapi import FastAPI
        
        app = FastAPI()
        middleware = RateLimitMiddleware(app)
        
        # Create mock request
        mock_request = MagicMock(spec=Request)
        mock_request.url.path = "/api/test"
        mock_request.client.host = "127.0.0.1"
        mock_request.headers.get.return_value = ""
        
        # Create mock call_next
        async def call_next(request):
            response = Response(content="OK")
            return response
        
        # Execute middleware
        import asyncio
        response = asyncio.run(middleware.dispatch(mock_request, call_next))
        
        # Verify middleware executed (rate limit headers should be present)
        assert "X-RateLimit-Limit" in response.headers
        assert "X-RateLimit-Remaining" in response.headers


@pytest.mark.security
def test_middleware_executes_in_testing_mode():
    """Test that rate limiting middleware executes even in testing mode."""
    with patch.dict(os.environ, {
        "JWT_SECRET_KEY": "test-secret-key",
        "ENVIRONMENT": "testing",
        "TEST_MODE": "true",
        "RATE_LIMIT_IP_CALLS": "100000",  # Elevated limits
        "RATE_LIMIT_PERIOD": "60",
    }, clear=True):
        # Force reload of middleware module with new environment
        import importlib
        importlib.reload(rate_limit_module)
        
        from backend.middleware.rate_limit import RateLimitMiddleware
        from fastapi import FastAPI
        
        app = FastAPI()
        middleware = RateLimitMiddleware(app)
        
        # Create mock request
        mock_request = MagicMock(spec=Request)
        mock_request.url.path = "/api/test"
        mock_request.client.host = "127.0.0.1"
        mock_request.headers.get.return_value = ""
        
        # Create mock call_next
        async def call_next(request):
            response = Response(content="OK")
            return response
        
        # Execute middleware
        import asyncio
        response = asyncio.run(middleware.dispatch(mock_request, call_next))
        
        # Verify middleware executed (rate limit headers should be present)
        assert "X-RateLimit-Limit" in response.headers
        assert "X-RateLimit-Remaining" in response.headers
        # Verify elevated limits are used
        assert response.headers["X-RateLimit-Limit"] == "100000"


@pytest.mark.security
def test_high_configured_limits_do_not_bypass_middleware():
    """Test that high configured limits in tests do not bypass middleware execution."""
    with patch.dict(os.environ, {
        "JWT_SECRET_KEY": "test-secret-key",
        "ENVIRONMENT": "testing",
        "TEST_MODE": "true",
        "RATE_LIMIT_IP_CALLS": "999999",  # Very high limit
        "RATE_LIMIT_PERIOD": "60",
    }, clear=True):
        # Force reload of middleware module with new environment
        import importlib
        importlib.reload(rate_limit_module)
        
        from backend.middleware.rate_limit import RateLimitMiddleware
        from fastapi import FastAPI
        
        app = FastAPI()
        middleware = RateLimitMiddleware(app)
        
        # Create mock request
        mock_request = MagicMock(spec=Request)
        mock_request.url.path = "/api/test"
        mock_request.client.host = "127.0.0.1"
        mock_request.headers.get.return_value = ""
        
        # Create mock call_next
        async def call_next(request):
            response = Response(content="OK")
            return response
        
        # Execute middleware
        import asyncio
        response = asyncio.run(middleware.dispatch(mock_request, call_next))
        
        # Verify middleware still executed
        assert "X-RateLimit-Limit" in response.headers
        assert "X-RateLimit-Remaining" in response.headers
        assert response.headers["X-RateLimit-Limit"] == "999999"


@pytest.mark.security
def test_production_with_test_mode_raises_error():
    """Test that TEST_MODE=true with ENVIRONMENT=production raises configuration error."""
    with patch.dict(os.environ, {
        "JWT_SECRET_KEY": "test-secret-key",
        "ENVIRONMENT": "production",
        "TEST_MODE": "true",
    }, clear=True):
        backend.config._settings = None
        
        from backend.config import get_settings
        from pydantic import ValidationError
        
        # Should raise ValidationError
        with pytest.raises(ValidationError) as exc_info:
            get_settings()
        
        assert "TEST_MODE cannot be enabled in production" in str(exc_info.value)


@pytest.mark.security
def test_rate_limit_headers_unchanged():
    """Test that rate limit headers remain unchanged after security fix."""
    with patch.dict(os.environ, {
        "JWT_SECRET_KEY": "test-secret-key",
        "ENVIRONMENT": "testing",
        "TEST_MODE": "true",
        "RATE_LIMIT_IP_CALLS": "100",
        "RATE_LIMIT_PERIOD": "60",
    }, clear=True):
        # Force reload of middleware module with new environment
        import importlib
        importlib.reload(rate_limit_module)
        
        from backend.middleware.rate_limit import RateLimitMiddleware
        from fastapi import FastAPI
        
        app = FastAPI()
        middleware = RateLimitMiddleware(app)
        
        # Create mock request
        mock_request = MagicMock(spec=Request)
        mock_request.url.path = "/api/test"
        mock_request.client.host = "127.0.0.1"
        mock_request.headers.get.return_value = ""
        
        # Create mock call_next
        async def call_next(request):
            response = Response(content="OK")
            return response
        
        # Execute middleware
        import asyncio
        response = asyncio.run(middleware.dispatch(mock_request, call_next))
        
        # Verify headers are present and correct
        assert "X-RateLimit-Limit" in response.headers
        assert "X-RateLimit-Remaining" in response.headers
        assert response.headers["X-RateLimit-Limit"] == "100"


@pytest.mark.security
def test_retry_after_header_exists_when_rate_limited():
    """Test that Retry-After header exists when rate limit is exceeded."""
    with patch.dict(os.environ, {
        "JWT_SECRET_KEY": "test-secret-key",
        "ENVIRONMENT": "testing",
        "TEST_MODE": "true",
        "RATE_LIMIT_IP_CALLS": "2",  # Very low limit for testing
        "RATE_LIMIT_PERIOD": "60",
    }, clear=True):
        # Force reload of middleware module with new environment
        import importlib
        importlib.reload(rate_limit_module)
        
        from backend.middleware.rate_limit import RateLimitMiddleware
        from fastapi import FastAPI
        
        app = FastAPI()
        middleware = RateLimitMiddleware(app)
        
        # Create mock request
        mock_request = MagicMock(spec=Request)
        mock_request.url.path = "/api/test"
        mock_request.client.host = "127.0.0.1"
        mock_request.headers.get.return_value = ""
        
        # Create mock call_next
        async def call_next(request):
            response = Response(content="OK")
            return response
        
        # Execute middleware multiple times to exceed limit
        import asyncio
        response1 = asyncio.run(middleware.dispatch(mock_request, call_next))
        response2 = asyncio.run(middleware.dispatch(mock_request, call_next))
        response3 = asyncio.run(middleware.dispatch(mock_request, call_next))
        
        # Third request should be rate limited with Retry-After header
        assert response3.status_code == 429
        assert "Retry-After" in response3.headers


@pytest.mark.security
def test_middleware_never_exits_early_because_of_test_mode():
    """Test that middleware never exits early because of TEST_MODE."""
    with patch.dict(os.environ, {
        "JWT_SECRET_KEY": "test-secret-key",
        "ENVIRONMENT": "testing",
        "TEST_MODE": "true",
        "RATE_LIMIT_IP_CALLS": "100000",
        "RATE_LIMIT_PERIOD": "60",
    }, clear=True):
        # Force reload of middleware module with new environment
        import importlib
        importlib.reload(rate_limit_module)
        
        from backend.middleware.rate_limit import RateLimitMiddleware
        from fastapi import FastAPI
        
        app = FastAPI()
        middleware = RateLimitMiddleware(app)
        
        # Create mock request
        mock_request = MagicMock(spec=Request)
        mock_request.url.path = "/api/test"
        mock_request.client.host = "127.0.0.1"
        mock_request.headers.get.return_value = ""
        
        # Track if call_next was called
        call_next_called = False
        
        # Create mock call_next
        async def call_next(request):
            nonlocal call_next_called
            call_next_called = True
            response = Response(content="OK")
            return response
        
        # Execute middleware
        import asyncio
        response = asyncio.run(middleware.dispatch(mock_request, call_next))
        
        # Verify call_next was called (middleware didn't exit early)
        assert call_next_called
        
        # Verify rate limiting logic executed (headers present)
        assert "X-RateLimit-Limit" in response.headers


@pytest.mark.security
def test_excluded_paths_still_work():
    """Test that excluded paths still bypass rate limiting."""
    with patch.dict(os.environ, {
        "JWT_SECRET_KEY": "test-secret-key",
        "ENVIRONMENT": "testing",
        "TEST_MODE": "true",
        "RATE_LIMIT_IP_CALLS": "1",  # Very low limit
        "RATE_LIMIT_PERIOD": "60",
    }, clear=True):
        # Force reload of middleware module with new environment
        import importlib
        importlib.reload(rate_limit_module)
        
        from backend.middleware.rate_limit import RateLimitMiddleware
        from fastapi import FastAPI
        
        app = FastAPI()
        middleware = RateLimitMiddleware(app)
        
        # Create mock request for excluded path
        mock_request = MagicMock(spec=Request)
        mock_request.url.path = "/health"
        mock_request.client.host = "127.0.0.1"
        
        # Create mock call_next
        async def call_next(request):
            response = Response(content="OK")
            return response
        
        # Execute middleware multiple times on excluded path
        import asyncio
        for _ in range(10):
            response = asyncio.run(middleware.dispatch(mock_request, call_next))
            assert response.status_code == 200
            # No rate limit headers on excluded paths
            assert "X-RateLimit-Limit" not in response.headers


@pytest.mark.security
def test_staging_enforces_rate_limiting():
    """Test that staging environment enforces rate limiting."""
    with patch.dict(os.environ, {
        "JWT_SECRET_KEY": "test-secret-key",
        "ENVIRONMENT": "staging",
        "RATE_LIMIT_IP_CALLS": "60",
        "RATE_LIMIT_PERIOD": "60",
    }, clear=True):
        # Force reload of middleware module with new environment
        import importlib
        importlib.reload(rate_limit_module)
        
        from backend.middleware.rate_limit import RateLimitMiddleware
        from fastapi import FastAPI
        
        app = FastAPI()
        middleware = RateLimitMiddleware(app)
        
        # Create mock request
        mock_request = MagicMock(spec=Request)
        mock_request.url.path = "/api/test"
        mock_request.client.host = "127.0.0.1"
        mock_request.headers.get.return_value = ""
        
        # Create mock call_next
        async def call_next(request):
            response = Response(content="OK")
            return response
        
        # Execute middleware
        import asyncio
        response = asyncio.run(middleware.dispatch(mock_request, call_next))
        
        # Verify middleware executed
        assert "X-RateLimit-Limit" in response.headers
        assert "X-RateLimit-Remaining" in response.headers


@pytest.mark.security
def test_local_enforces_rate_limiting():
    """Test that local environment enforces rate limiting."""
    with patch.dict(os.environ, {
        "JWT_SECRET_KEY": "test-secret-key",
        "ENVIRONMENT": "local",
        "RATE_LIMIT_IP_CALLS": "60",
        "RATE_LIMIT_PERIOD": "60",
    }, clear=True):
        # Force reload of middleware module with new environment
        import importlib
        importlib.reload(rate_limit_module)
        
        from backend.middleware.rate_limit import RateLimitMiddleware
        from fastapi import FastAPI
        
        app = FastAPI()
        middleware = RateLimitMiddleware(app)
        
        # Create mock request
        mock_request = MagicMock(spec=Request)
        mock_request.url.path = "/api/test"
        mock_request.client.host = "127.0.0.1"
        mock_request.headers.get.return_value = ""
        
        # Create mock call_next
        async def call_next(request):
            response = Response(content="OK")
            return response
        
        # Execute middleware
        import asyncio
        response = asyncio.run(middleware.dispatch(mock_request, call_next))
        
        # Verify middleware executed
        assert "X-RateLimit-Limit" in response.headers
        assert "X-RateLimit-Remaining" in response.headers
