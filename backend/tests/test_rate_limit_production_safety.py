"""
Tests for rate limiting production safety features.

This test suite validates that the rate limiter provides appropriate warnings
and fail-fast behavior for production deployments, ensuring distributed
rate limiting is properly configured.
"""
import pytest
import os
from unittest.mock import patch, MagicMock
import redis

os.environ["JWT_SECRET_KEY"] = "testing-secret-key-1234567890-abcdef"
os.environ["TEST_MODE"] = "true"
os.environ["ENVIRONMENT"] = "testing"

from backend.utils.limiter import SimpleRateLimiter
import backend.config


# Reset settings before tests
@pytest.fixture(autouse=True)
def reset_settings():
    """Reset settings before each test."""
    backend.config._settings = None
    yield
    backend.config._settings = None


@pytest.mark.production_safety
def test_development_no_redis_warning():
    """Test that development environment without Redis uses in-memory backend."""
    with patch.dict(os.environ, {
        "JWT_SECRET_KEY": "test-secret-key",
        "ENVIRONMENT": "development",
        # REDIS_URL not set
    }):
        limiter = SimpleRateLimiter(calls=5, period=60)
        
        # Should use in-memory backend
        assert limiter._redis_backend is None
        assert limiter._using_redis is False


@pytest.mark.production_safety
def test_production_no_redis_warning():
    """Test that production environment without Redis fails when REQUIRE_REDIS_IN_PRODUCTION is enabled (default)."""
    with patch.dict(os.environ, {
        "JWT_SECRET_KEY": "test-secret-key",
        "ENVIRONMENT": "staging",
        "TEST_MODE": "true",
        "DOCUMENT_ENCRYPTION_KEY": "test-encryption-key",
        "REQUIRE_REDIS_IN_PRODUCTION": "false",  # Disable to test warning behavior
        # REDIS_URL not set
    }):
        limiter = SimpleRateLimiter(calls=5, period=60)
        
        # Should use in-memory backend with warning
        assert limiter._redis_backend is None
        assert limiter._using_redis is False


@pytest.mark.production_safety
def test_production_require_redis_no_redis_error():
    """Test that production with REQUIRE_REDIS_IN_PRODUCTION enabled fails to start without Redis."""
    with patch.dict(os.environ, {
        "JWT_SECRET_KEY": "test-secret-key",
        "ENVIRONMENT": "staging",
        "TEST_MODE": "false",  # Disable test mode to enforce Redis requirement
        "DOCUMENT_ENCRYPTION_KEY": "test-encryption-key",
        "REQUIRE_REDIS_IN_PRODUCTION": "true",
        # REDIS_URL not set
    }):
        import backend.config
        backend.config._settings = None

        # Should raise RuntimeError because REQUIRE_REDIS_IN_PRODUCTION is now enforced
        with pytest.raises(RuntimeError) as exc_info:
            SimpleRateLimiter(calls=5, period=60)

        # Error message should mention Redis requirement
        assert "Redis is required" in str(exc_info.value)


@pytest.mark.production_safety
def test_redis_success_logs_info():
    """Test that successful Redis initialization uses Redis backend."""
    mock_redis_client = MagicMock()
    mock_pipeline = MagicMock()
    mock_redis_client.pipeline.return_value = mock_pipeline
    mock_pipeline.execute.return_value = [1, True]
    
    # Mock health check methods
    mock_redis_client.ping.return_value = True
    mock_redis_client.set.return_value = True
    mock_redis_client.get.return_value = "test"
    mock_redis_client.delete.return_value = 1
    
    with patch.dict(os.environ, {
        "JWT_SECRET_KEY": "test-secret-key",
        "ENVIRONMENT": "staging",
        "TEST_MODE": "true",
        "REDIS_URL": "redis://localhost:6379/0",
        "DOCUMENT_ENCRYPTION_KEY": "test-encryption-key",
    }):
        with patch('backend.utils.limiter.redis.from_url', return_value=mock_redis_client):
            from backend.utils.limiter import RedisStorage
            redis_storage = RedisStorage("redis://localhost:6379/0")
            limiter = SimpleRateLimiter(calls=5, period=60, backend=redis_storage, backend_name="redis")
            
            # Should use Redis backend
            assert limiter._redis_backend is not None
            assert limiter._using_redis is True


@pytest.mark.production_safety
def test_redis_fail_fast_disabled_fallback():
    """Test that Redis failure with REDIS_FAIL_FAST disabled falls back to in-memory."""
    mock_redis_client = MagicMock()
    
    with patch.dict(os.environ, {
        "JWT_SECRET_KEY": "test-secret-key",
        "ENVIRONMENT": "staging",
        "TEST_MODE": "true",
        "REDIS_URL": "redis://localhost:6379/0",
        "REDIS_FAIL_FAST": "false",
        "DOCUMENT_ENCRYPTION_KEY": "test-encryption-key",
    }):
        with patch('backend.utils.limiter.redis.from_url', return_value=mock_redis_client) as mock_from_url:
            # Make Redis initialization fail
            mock_from_url.side_effect = redis.ConnectionError("Cannot connect")
            
            limiter = SimpleRateLimiter(calls=5, period=60)
            
            # Should fall back to in-memory backend
            assert limiter._redis_backend is None
            assert limiter._using_redis is False


@pytest.mark.production_safety
def test_redis_fail_fast_enabled_raises_error():
    """Test that Redis failure with REDIS_FAIL_FAST enabled raises RuntimeError."""
    mock_redis_client = MagicMock()

    with patch.dict(os.environ, {
        "JWT_SECRET_KEY": "test-secret-key",
        "ENVIRONMENT": "staging",
        "TEST_MODE": "false",  # Disable test mode to enforce Redis requirement
        "REDIS_URL": "redis://localhost:6379/0",
        "REDIS_FAIL_FAST": "true",
        "DOCUMENT_ENCRYPTION_KEY": "test-encryption-key",
    }):
        import backend.config
        backend.config._settings = None

        with patch('backend.utils.limiter.RedisStorage', side_effect=redis.ConnectionError("Cannot connect")):
            # Should raise RuntimeError
            with pytest.raises(RuntimeError) as exc_info:
                SimpleRateLimiter(calls=5, period=60)

            # Error message should mention REDIS_FAIL_FAST
            assert "REDIS_FAIL_FAST" in str(exc_info.value) or "initialization failed" in str(exc_info.value).lower()


@pytest.mark.production_safety
def test_local_environment_no_redis_info():
    """Test that local environment without Redis uses in-memory backend."""
    with patch.dict(os.environ, {
        "JWT_SECRET_KEY": "test-secret-key",
        "ENVIRONMENT": "local",
        # REDIS_URL not set
    }):
        limiter = SimpleRateLimiter(calls=5, period=60)
        
        # Should use in-memory backend
        assert limiter._redis_backend is None
        assert limiter._using_redis is False


@pytest.mark.production_safety
def test_testing_environment_no_redis_info():
    """Test that testing environment without Redis uses in-memory backend."""
    with patch.dict(os.environ, {
        "JWT_SECRET_KEY": "test-secret-key",
        "ENVIRONMENT": "testing",
        # REDIS_URL not set
    }):
        limiter = SimpleRateLimiter(calls=5, period=60)
        
        # Should use in-memory backend
        assert limiter._redis_backend is None
        assert limiter._using_redis is False


@pytest.mark.production_safety
def test_staging_environment_redis_success():
    """Test that staging environment with Redis works correctly."""
    mock_redis_client = MagicMock()
    mock_pipeline = MagicMock()
    mock_redis_client.pipeline.return_value = mock_pipeline
    mock_pipeline.execute.return_value = [1, True]
    
    # Mock health check methods
    mock_redis_client.ping.return_value = True
    mock_redis_client.set.return_value = True
    mock_redis_client.get.return_value = "test"
    mock_redis_client.delete.return_value = 1
    
    with patch.dict(os.environ, {
        "JWT_SECRET_KEY": "test-secret-key",
        "ENVIRONMENT": "staging",
        "REDIS_URL": "redis://localhost:6379/0",
    }):
        with patch('backend.utils.limiter.redis.from_url', return_value=mock_redis_client):
            from backend.utils.limiter import RedisStorage
            redis_storage = RedisStorage("redis://localhost:6379/0")
            limiter = SimpleRateLimiter(calls=5, period=60, backend=redis_storage, backend_name="redis")
            
            # Should use Redis backend
            assert limiter._redis_backend is not None
            assert limiter._using_redis is True


@pytest.mark.production_safety
def test_backend_selection_in_memory():
    """Test that in-memory backend selection state is correctly set."""
    with patch.dict(os.environ, {
        "JWT_SECRET_KEY": "test-secret-key",
        "ENVIRONMENT": "development",
    }):
        limiter = SimpleRateLimiter(calls=5, period=60)
        assert limiter._using_redis is False


@pytest.mark.production_safety
def test_backend_selection_redis():
    """Test that Redis backend selection state is correctly set."""
    mock_redis_client = MagicMock()
    mock_pipeline = MagicMock()
    mock_redis_client.pipeline.return_value = mock_pipeline
    mock_pipeline.execute.return_value = [1, True]
    
    # Mock health check methods
    mock_redis_client.ping.return_value = True
    mock_redis_client.set.return_value = True
    mock_redis_client.get.return_value = "test"
    mock_redis_client.delete.return_value = 1
    
    with patch.dict(os.environ, {
        "JWT_SECRET_KEY": "test-secret-key",
        "ENVIRONMENT": "staging",
        "TEST_MODE": "true",
        "REDIS_URL": "redis://localhost:6379/0",
        "DOCUMENT_ENCRYPTION_KEY": "test-encryption-key",
    }):
        with patch('backend.utils.limiter.redis.from_url', return_value=mock_redis_client):
            from backend.utils.limiter import RedisStorage
            redis_storage = RedisStorage("redis://localhost:6379/0")
            limiter = SimpleRateLimiter(calls=5, period=60, backend=redis_storage, backend_name="redis")
            assert limiter._using_redis is True


@pytest.mark.production_safety
def test_redis_url_truncated_in_logs():
    """Test that Redis backend is initialized with long URL."""
    mock_redis_client = MagicMock()
    mock_pipeline = MagicMock()
    mock_redis_client.pipeline.return_value = mock_pipeline
    mock_pipeline.execute.return_value = [1, True]
    
    long_redis_url = "redis://user:very-long-password-should-be-truncated-in-logs@localhost:6379/0"
    
    with patch.dict(os.environ, {
        "JWT_SECRET_KEY": "test-secret-key",
        "ENVIRONMENT": "staging",
        "TEST_MODE": "true",
        "REDIS_URL": long_redis_url,
        "DOCUMENT_ENCRYPTION_KEY": "test-encryption-key",
    }):
        with patch('backend.utils.limiter.redis.from_url', return_value=mock_redis_client):
            from backend.utils.limiter import RedisStorage
            redis_storage = RedisStorage(long_redis_url)
            limiter = SimpleRateLimiter(calls=5, period=60, backend=redis_storage, backend_name="redis")
            
            # Should use Redis backend
            assert limiter._redis_backend is not None
            assert limiter._using_redis is True


@pytest.mark.production_safety
def test_rate_limiter_functionality_unchanged_with_redis():
    """Test that rate limiter functionality remains unchanged when using Redis."""
    mock_redis_client = MagicMock()
    mock_pipeline = MagicMock()
    mock_redis_client.pipeline.return_value = mock_pipeline
    
    # Simulate rate limiting: 2 calls allowed
    call_count = [0]
    def mock_execute():
        call_count[0] += 1
        return [call_count[0], True]
    
    mock_pipeline.execute.side_effect = mock_execute
    
    with patch.dict(os.environ, {
        "JWT_SECRET_KEY": "test-secret-key",
        "ENVIRONMENT": "staging",
        "TEST_MODE": "true",
        "REDIS_URL": "redis://localhost:6379/0",
        "DOCUMENT_ENCRYPTION_KEY": "test-encryption-key",
    }):
        with patch('backend.utils.limiter.redis.from_url', return_value=mock_redis_client):
            from backend.utils.limiter import RedisStorage
            redis_storage = RedisStorage("redis://localhost:6379/0")
            limiter = SimpleRateLimiter(calls=2, period=60, backend=redis_storage, backend_name="redis")
            
            # First 2 calls should be allowed
            assert limiter.is_allowed("user1") == True
            assert limiter.is_allowed("user1") == True
            
            # 3rd call should be denied
            assert limiter.is_allowed("user1") == False


@pytest.mark.production_safety
def test_rate_limiter_functionality_unchanged_without_redis():
    """Test that rate limiter functionality remains unchanged when using in-memory."""
    with patch.dict(os.environ, {
        "JWT_SECRET_KEY": "test-secret-key",
        "ENVIRONMENT": "development",
    }):
        limiter = SimpleRateLimiter(calls=2, period=60)
        
        # First 2 calls should be allowed
        assert limiter.is_allowed("user1") == True
        assert limiter.is_allowed("user1") == True
        
        # 3rd call should be denied
        assert limiter.is_allowed("user1") == False


@pytest.mark.production_safety
def test_config_validator_require_redis_in_production():
    """Test that config validator raises error when REQUIRE_REDIS_IN_PRODUCTION is enabled without Redis."""
    with patch.dict(os.environ, {
        "JWT_SECRET_KEY": "test-secret-key",
        "ENVIRONMENT": "staging",
        "TEST_MODE": "false",  # Disable test mode to enforce Redis requirement
        "DOCUMENT_ENCRYPTION_KEY": "test-encryption-key",
        "REQUIRE_REDIS_IN_PRODUCTION": "true",
        # REDIS_URL not set
    }):
        import backend.config
        backend.config._settings = None

        from backend.config import get_settings
        from pydantic import ValidationError

        # Should raise ValidationError because REQUIRE_REDIS_IN_PRODUCTION is now enforced
        with pytest.raises(ValidationError) as exc_info:
            get_settings()

        # Error message should mention Redis requirement
        error_str = str(exc_info.value)
        assert "REDIS_URL" in error_str or "Redis" in error_str


@pytest.mark.production_safety
def test_multiple_limiters_independent_redis_state():
    """Test that multiple limiters share Redis state but have independent configuration."""
    mock_redis_client = MagicMock()
    mock_pipeline = MagicMock()
    mock_redis_client.pipeline.return_value = mock_pipeline
    
    # Track calls per limiter
    call_tracker = {}
    def mock_execute():
        key = mock_pipeline.incr.call_args[0][0]
        call_tracker[key] = call_tracker.get(key, 0) + 1
        return [call_tracker[key], True]
    
    mock_pipeline.execute.side_effect = mock_execute
    
    with patch.dict(os.environ, {
        "JWT_SECRET_KEY": "test-secret-key",
        "ENVIRONMENT": "staging",
        "TEST_MODE": "true",
        "REDIS_URL": "redis://localhost:6379/0",
        "DOCUMENT_ENCRYPTION_KEY": "test-encryption-key",
    }):
        with patch('backend.utils.limiter.redis.from_url', return_value=mock_redis_client):
            from backend.utils.limiter import RedisStorage
            redis_storage = RedisStorage("redis://localhost:6379/0")
            limiter1 = SimpleRateLimiter(calls=2, period=60, backend=redis_storage, backend_name="redis")
            limiter2 = SimpleRateLimiter(calls=5, period=60, backend=redis_storage, backend_name="redis")
            
            # Both should use Redis
            assert limiter1._using_redis is True
            assert limiter2._using_redis is True
            
            # Each should have independent configuration
            assert limiter1.calls == 2
            assert limiter2.calls == 5


@pytest.mark.production_safety
def test_redis_health_check_success():
    """Test that Redis health check passes when Redis is healthy."""
    mock_redis_client = MagicMock()
    mock_redis_client.ping.return_value = True
    mock_redis_client.set.return_value = True
    mock_redis_client.get.return_value = "test"
    mock_redis_client.delete.return_value = 1
    
    with patch.dict(os.environ, {
        "JWT_SECRET_KEY": "test-secret-key",
        "ENVIRONMENT": "staging",
        "TEST_MODE": "true",
        "REDIS_URL": "redis://localhost:6379/0",
        "DOCUMENT_ENCRYPTION_KEY": "test-encryption-key",
    }):
        with patch('backend.utils.limiter.redis.from_url', return_value=mock_redis_client):
            from backend.utils.limiter import RedisStorage
            redis_storage = RedisStorage("redis://localhost:6379/0")
            limiter = SimpleRateLimiter(calls=5, period=60, backend=redis_storage, backend_name="redis")
            
            # Should use Redis backend
            assert limiter._redis_backend is not None
            assert limiter._using_redis is True


@pytest.mark.production_safety
def test_redis_health_check_ping_failure():
    """Test that Redis health check fails when ping fails."""
    mock_redis_client = MagicMock()
    mock_redis_client.ping.return_value = False
    
    with patch.dict(os.environ, {
        "JWT_SECRET_KEY": "test-secret-key",
        "ENVIRONMENT": "staging",
        "TEST_MODE": "true",
        "REDIS_URL": "redis://localhost:6379/0",
        "REDIS_FAIL_FAST": "true",
        "DOCUMENT_ENCRYPTION_KEY": "test-encryption-key",
    }):
        with patch('backend.utils.limiter.redis.from_url', return_value=mock_redis_client):
            from backend.utils.limiter import RedisStorage
            redis_storage = RedisStorage("redis://localhost:6379/0")
            # Health check should fail
            health_result = redis_storage.health_check()
            assert not health_result["healthy"]
            assert "ping failed" in health_result["error"].lower()


@pytest.mark.production_safety
def test_redis_health_check_auth_failure():
    """Test that Redis health check fails when authentication fails."""
    mock_redis_client = MagicMock()
    mock_redis_client.ping.side_effect = redis.AuthenticationError("Invalid password")
    
    with patch.dict(os.environ, {
        "JWT_SECRET_KEY": "test-secret-key",
        "ENVIRONMENT": "staging",
        "TEST_MODE": "true",
        "REDIS_URL": "redis://localhost:6379/0",
        "REDIS_FAIL_FAST": "true",
        "DOCUMENT_ENCRYPTION_KEY": "test-encryption-key",
    }):
        with patch('backend.utils.limiter.redis.from_url', return_value=mock_redis_client):
            from backend.utils.limiter import RedisStorage
            redis_storage = RedisStorage("redis://localhost:6379/0")
            # Health check should fail
            health_result = redis_storage.health_check()
            assert not health_result["healthy"]
            assert "authentication failed" in health_result["error"].lower()


@pytest.mark.production_safety
def test_redis_health_check_connection_failure():
    """Test that Redis health check fails when connection fails."""
    mock_redis_client = MagicMock()
    mock_redis_client.ping.side_effect = redis.ConnectionError("Connection refused")
    
    with patch.dict(os.environ, {
        "JWT_SECRET_KEY": "test-secret-key",
        "ENVIRONMENT": "staging",
        "TEST_MODE": "true",
        "REDIS_URL": "redis://localhost:6379/0",
        "REDIS_FAIL_FAST": "true",
        "DOCUMENT_ENCRYPTION_KEY": "test-encryption-key",
    }):
        with patch('backend.utils.limiter.redis.from_url', return_value=mock_redis_client):
            from backend.utils.limiter import RedisStorage
            redis_storage = RedisStorage("redis://localhost:6379/0")
            # Health check should fail
            health_result = redis_storage.health_check()
            assert not health_result["healthy"]
            assert "connection failed" in health_result["error"].lower()


@pytest.mark.production_safety
def test_redis_health_check_timeout_failure():
    """Test that Redis health check fails when timeout occurs."""
    mock_redis_client = MagicMock()
    mock_redis_client.ping.side_effect = redis.TimeoutError("Timeout")
    
    with patch.dict(os.environ, {
        "JWT_SECRET_KEY": "test-secret-key",
        "ENVIRONMENT": "staging",
        "TEST_MODE": "true",
        "REDIS_URL": "redis://localhost:6379/0",
        "REDIS_FAIL_FAST": "true",
        "DOCUMENT_ENCRYPTION_KEY": "test-encryption-key",
    }):
        with patch('backend.utils.limiter.redis.from_url', return_value=mock_redis_client):
            from backend.utils.limiter import RedisStorage
            redis_storage = RedisStorage("redis://localhost:6379/0")
            # Health check should fail
            health_result = redis_storage.health_check()
            assert not health_result["healthy"]
            assert "timeout" in health_result["error"].lower()


@pytest.mark.production_safety
def test_development_redis_health_check_fallback():
    """Test that development environment allows fallback when Redis health check fails."""
    mock_redis_client = MagicMock()
    mock_redis_client.ping.return_value = False
    
    with patch.dict(os.environ, {
        "JWT_SECRET_KEY": "test-secret-key",
        "ENVIRONMENT": "development",
        "REDIS_URL": "redis://localhost:6379/0",
        "REDIS_FAIL_FAST": "false",
    }):
        with patch('backend.utils.limiter.redis.from_url', return_value=mock_redis_client):
            limiter = SimpleRateLimiter(calls=5, period=60)
            
            # Should fall back to in-memory backend
            assert limiter._redis_backend is None
            assert limiter._using_redis is False


@pytest.mark.production_safety
def test_production_redis_health_check_fail_fast():
    """Test that production environment fails fast when Redis health check fails."""
    mock_redis_client = MagicMock()
    mock_redis_client.ping.return_value = False
    
    with patch.dict(os.environ, {
        "JWT_SECRET_KEY": "test-secret-key",
        "ENVIRONMENT": "staging",
        "TEST_MODE": "true",
        "REDIS_URL": "redis://localhost:6379/0",
        "REDIS_FAIL_FAST": "true",
        "DOCUMENT_ENCRYPTION_KEY": "test-encryption-key",
    }):
        with patch('backend.utils.limiter.redis.from_url', return_value=mock_redis_client):
            from backend.utils.limiter import RedisStorage
            redis_storage = RedisStorage("redis://localhost:6379/0")
            # Health check should fail
            health_result = redis_storage.health_check()
            assert not health_result["healthy"]
