"""
Tests for the create_rate_limiter factory function.

These tests verify that the factory correctly:
- Selects the appropriate backend based on configuration
- Fails fast when Redis is required but unavailable in production
- Allows fallback in development/testing environments
- Handles Redis health checks properly
"""
import os
import pytest
from unittest.mock import patch, MagicMock
import redis

os.environ["JWT_SECRET_KEY"] = "testing-secret-key-1234567890-abcdef"
os.environ["TEST_MODE"] = "true"

from backend.utils.limiter import create_rate_limiter, InMemoryStorage, RedisStorage
from backend.config import Settings


class TestRateLimiterFactoryBackendSelection:
    """Test backend selection logic."""
    
    def test_memory_backend_explicit(self):
        """Test explicit memory backend selection."""
        with patch.dict(os.environ, {
            "JWT_SECRET_KEY": "test-secret-key",
            "ENVIRONMENT": "development",
            "RATE_LIMIT_BACKEND": "memory",
            "TEST_MODE": "true",
        }):
            # Clear cached settings
            import backend.config
            backend.config._settings = None
            
            limiter = create_rate_limiter(calls=5, period=60)
            
            assert limiter._backend_name == "memory"
            assert limiter._using_redis is False
            assert isinstance(limiter._backend, InMemoryStorage)
    
    def test_redis_backend_explicit_with_url(self):
        """Test explicit Redis backend selection with valid URL."""
        mock_redis_client = MagicMock()
        mock_redis_client.ping.return_value = True
        mock_redis_client.set.return_value = True
        mock_redis_client.get.return_value = "test"
        mock_redis_client.delete.return_value = True

        with patch.dict(os.environ, {
            "JWT_SECRET_KEY": "test-secret-key",
            "ENVIRONMENT": "development",
            "RATE_LIMIT_BACKEND": "redis",
            "REDIS_URL": "redis://localhost:6379/0",
            "TEST_MODE": "true",
        }):
            import backend.config
            backend.config._settings = None

            # Create a mock RedisStorage by subclassing
            class MockRedisStorage(RedisStorage):
                def __init__(self, url):
                    # Don't call parent __init__ to avoid Redis connection
                    self.client = mock_redis_client
                    self.url = url

                def health_check(self):
                    return {"healthy": True, "error": None}

            with patch('backend.utils.limiter.RedisStorage', MockRedisStorage):
                with patch('backend.utils.limiter.redis.from_url', return_value=mock_redis_client):
                    limiter = create_rate_limiter(calls=5, period=60)

                    assert limiter._backend_name == "redis"
                    assert limiter._using_redis is True
    
    def test_redis_backend_explicit_without_url_development(self):
        """Test explicit Redis backend without URL in development - should fall back."""
        with patch.dict(os.environ, {
            "JWT_SECRET_KEY": "test-secret-key",
            "ENVIRONMENT": "development",
            "RATE_LIMIT_BACKEND": "redis",
            "TEST_MODE": "true",
            # REDIS_URL not set
        }):
            import backend.config
            backend.config._settings = None

            limiter = create_rate_limiter(calls=5, period=60)

            # Should fall back to memory in development
            assert limiter._backend_name == "memory"
            assert limiter._using_redis is False
    
    def test_redis_backend_explicit_without_url_production(self):
        """Test explicit Redis backend without URL in production - should fail at config validation."""
        with patch.dict(os.environ, {
            "JWT_SECRET_KEY": "test-secret-key",
            "ENVIRONMENT": "staging",
            "RATE_LIMIT_BACKEND": "redis",
            "DOCUMENT_ENCRYPTION_KEY": "test-encryption-key",
            "REQUIRE_REDIS_IN_PRODUCTION": "false",  # Disable to test factory logic
            "TEST_MODE": "false",  # Disable test mode to enforce Redis requirement
            # REDIS_URL not set
        }):
            import backend.config
            backend.config._settings = None

            with pytest.raises(RuntimeError) as exc_info:
                create_rate_limiter(calls=5, period=60)

            assert "Redis is required" in str(exc_info.value)
    
    def test_auto_backend_with_redis_available(self):
        """Test auto backend selection with Redis available."""
        mock_redis_client = MagicMock()
        mock_redis_client.ping.return_value = True
        mock_redis_client.set.return_value = True
        mock_redis_client.get.return_value = "test"
        mock_redis_client.delete.return_value = True

        with patch.dict(os.environ, {
            "JWT_SECRET_KEY": "test-secret-key",
            "ENVIRONMENT": "development",
            "RATE_LIMIT_BACKEND": "auto",
            "REDIS_URL": "redis://localhost:6379/0",
            "TEST_MODE": "true",
        }):
            import backend.config
            backend.config._settings = None

            # Create a mock RedisStorage by subclassing
            class MockRedisStorage(RedisStorage):
                def __init__(self, url):
                    self.client = mock_redis_client
                    self.url = url

                def health_check(self):
                    return {"healthy": True, "error": None}

            with patch('backend.utils.limiter.RedisStorage', MockRedisStorage):
                with patch('backend.utils.limiter.redis.from_url', return_value=mock_redis_client):
                    limiter = create_rate_limiter(calls=5, period=60)

                    assert limiter._backend_name == "redis"
                    assert limiter._using_redis is True
    
    def test_auto_backend_without_redis_development(self):
        """Test auto backend selection without Redis in development."""
        with patch.dict(os.environ, {
            "JWT_SECRET_KEY": "test-secret-key",
            "ENVIRONMENT": "development",
            "RATE_LIMIT_BACKEND": "auto",
            "TEST_MODE": "true",
            # REDIS_URL not set
        }):
            import backend.config
            backend.config._settings = None

            limiter = create_rate_limiter(calls=5, period=60)

            assert limiter._backend_name == "memory"
            assert limiter._using_redis is False


class TestRateLimiterFactoryProductionSafety:
    """Test production safety requirements."""
    
    def test_production_requires_redis_with_require_flag(self):
        """Test production fails when Redis required but unavailable."""
        with patch.dict(os.environ, {
            "JWT_SECRET_KEY": "test-secret-key",
            "ENVIRONMENT": "staging",
            "RATE_LIMIT_BACKEND": "auto",
            "REQUIRE_REDIS_IN_PRODUCTION": "true",
            "DOCUMENT_ENCRYPTION_KEY": "test-encryption-key",
            "TEST_MODE": "false",  # Disable test mode to enforce Redis requirement
            # REDIS_URL not set
        }):
            import backend.config
            backend.config._settings = None

            # Config validation will fail first
            from pydantic import ValidationError
            with pytest.raises(ValidationError) as exc_info:
                create_rate_limiter(calls=5, period=60)

            assert "REDIS_URL" in str(exc_info.value) or "Redis" in str(exc_info.value)
    
    def test_production_allows_memory_without_require_flag(self):
        """Test production allows memory when REQUIRE_REDIS_IN_PRODUCTION is disabled."""
        with patch.dict(os.environ, {
            "JWT_SECRET_KEY": "test-secret-key",
            "ENVIRONMENT": "staging",
            "RATE_LIMIT_BACKEND": "auto",
            "REQUIRE_REDIS_IN_PRODUCTION": "false",
            "DOCUMENT_ENCRYPTION_KEY": "test-encryption-key",
            "TEST_MODE": "true",  # Enable test mode to skip Redis requirement validation
            # REDIS_URL not set
        }):
            import backend.config
            backend.config._settings = None

            limiter = create_rate_limiter(calls=5, period=60)

            # Should use memory with warning
            assert limiter._backend_name == "memory"
            assert limiter._using_redis is False
    
    def test_production_redis_health_check_failure(self):
        """Test production fails when Redis health check fails."""
        mock_redis_client = MagicMock()
        mock_redis_client.ping.return_value = False

        # Create a mock RedisStorage by subclassing
        class MockRedisStorage(RedisStorage):
            def __init__(self, url):
                self.client = mock_redis_client
                self.url = url

            def health_check(self):
                return {"healthy": False, "error": "ping failed"}

        with patch.dict(os.environ, {
            "JWT_SECRET_KEY": "test-secret-key",
            "ENVIRONMENT": "staging",
            "RATE_LIMIT_BACKEND": "auto",
            "REQUIRE_REDIS_IN_PRODUCTION": "true",
            "REDIS_URL": "redis://localhost:6379/0",
            "DOCUMENT_ENCRYPTION_KEY": "test-encryption-key",
            "TEST_MODE": "false",  # Disable test mode to enforce Redis requirement
        }):
            import backend.config
            backend.config._settings = None

            with patch('backend.utils.limiter.RedisStorage', MockRedisStorage):
                with patch('backend.utils.limiter.redis.from_url', return_value=mock_redis_client):
                    with pytest.raises(RuntimeError) as exc_info:
                        create_rate_limiter(calls=5, period=60)

                    assert "health check failed" in str(exc_info.value).lower()
    
    def test_production_redis_init_failure(self):
        """Test production fails when Redis initialization fails."""
        with patch.dict(os.environ, {
            "JWT_SECRET_KEY": "test-secret-key",
            "ENVIRONMENT": "staging",
            "RATE_LIMIT_BACKEND": "redis",
            "REDIS_URL": "redis://localhost:6379/0",
            "DOCUMENT_ENCRYPTION_KEY": "test-encryption-key",
            "TEST_MODE": "false",  # Disable test mode to enforce Redis requirement
        }):
            import backend.config
            backend.config._settings = None

            with patch('backend.utils.limiter.RedisStorage', side_effect=redis.ConnectionError("Cannot connect")):
                with pytest.raises(RuntimeError) as exc_info:
                    create_rate_limiter(calls=5, period=60)

                assert "initialization failed" in str(exc_info.value).lower()


class TestRateLimiterFactoryDevelopmentFallback:
    """Test development environment fallback behavior."""
    
    def test_development_redis_health_check_fallback(self):
        """Test development falls back to memory when Redis health check fails."""
        mock_redis_client = MagicMock()
        mock_redis_client.ping.return_value = False

        # Create a mock RedisStorage by subclassing
        class MockRedisStorage(RedisStorage):
            def __init__(self, url):
                self.client = mock_redis_client
                self.url = url

            def health_check(self):
                return {"healthy": False, "error": "ping failed"}

        with patch.dict(os.environ, {
            "JWT_SECRET_KEY": "test-secret-key",
            "ENVIRONMENT": "development",
            "RATE_LIMIT_BACKEND": "auto",
            "REDIS_URL": "redis://localhost:6379/0",
            "TEST_MODE": "true",
        }):
            import backend.config
            backend.config._settings = None

            with patch('backend.utils.limiter.RedisStorage', MockRedisStorage):
                with patch('backend.utils.limiter.redis.from_url', return_value=mock_redis_client):
                    limiter = create_rate_limiter(calls=5, period=60)

                    # Should fall back to memory
                    assert limiter._backend_name == "memory"
                    assert limiter._using_redis is False
    
    def test_development_redis_init_fallback(self):
        """Test development falls back to memory when Redis init fails (with REDIS_FAIL_FAST=false)."""
        with patch.dict(os.environ, {
            "JWT_SECRET_KEY": "test-secret-key",
            "ENVIRONMENT": "development",
            "RATE_LIMIT_BACKEND": "redis",
            "REDIS_URL": "redis://localhost:6379/0",
            "REDIS_FAIL_FAST": "false",  # Disable fail-fast to allow fallback
            "TEST_MODE": "true",
        }):
            import backend.config
            backend.config._settings = None

            with patch('backend.utils.limiter.RedisStorage', side_effect=redis.ConnectionError("Cannot connect")):
                limiter = create_rate_limiter(calls=5, period=60)

                # Should fall back to memory
                assert limiter._backend_name == "memory"
                assert limiter._using_redis is False
    
    def test_local_environment_allows_memory(self):
        """Test local environment allows memory backend."""
        with patch.dict(os.environ, {
            "JWT_SECRET_KEY": "test-secret-key",
            "ENVIRONMENT": "local",
            "RATE_LIMIT_BACKEND": "auto",
            "TEST_MODE": "true",
            # REDIS_URL not set
        }):
            import backend.config
            backend.config._settings = None

            limiter = create_rate_limiter(calls=5, period=60)

            assert limiter._backend_name == "memory"
            assert limiter._using_redis is False
    
    def test_testing_environment_allows_memory(self):
        """Test testing environment allows memory backend."""
        with patch.dict(os.environ, {
            "JWT_SECRET_KEY": "test-secret-key",
            "ENVIRONMENT": "testing",
            "RATE_LIMIT_BACKEND": "auto",
            "TEST_MODE": "true",
            # REDIS_URL not set
        }):
            import backend.config
            backend.config._settings = None

            limiter = create_rate_limiter(calls=5, period=60)

            assert limiter._backend_name == "memory"
            assert limiter._using_redis is False


class TestRateLimiterFactoryFailFast:
    """Test REDIS_FAIL_FAST behavior."""
    
    def test_fail_fast_enabled_redis_failure(self):
        """Test fail-fast enabled causes startup failure on Redis failure."""
        with patch.dict(os.environ, {
            "JWT_SECRET_KEY": "test-secret-key",
            "ENVIRONMENT": "development",
            "RATE_LIMIT_BACKEND": "redis",
            "REDIS_URL": "redis://localhost:6379/0",
            "REDIS_FAIL_FAST": "true",
            "TEST_MODE": "true",
        }):
            import backend.config
            backend.config._settings = None

            with patch('backend.utils.limiter.RedisStorage', side_effect=redis.ConnectionError("Cannot connect")):
                with pytest.raises(RuntimeError) as exc_info:
                    create_rate_limiter(calls=5, period=60)

                assert "initialization failed" in str(exc_info.value).lower()
    
    def test_fail_fast_disabled_redis_failure(self):
        """Test fail-fast disabled allows fallback on Redis failure."""
        with patch.dict(os.environ, {
            "JWT_SECRET_KEY": "test-secret-key",
            "ENVIRONMENT": "development",
            "RATE_LIMIT_BACKEND": "redis",
            "REDIS_URL": "redis://localhost:6379/0",
            "REDIS_FAIL_FAST": "false",
            "TEST_MODE": "true",
        }):
            import backend.config
            backend.config._settings = None

            with patch('backend.utils.limiter.RedisStorage', side_effect=redis.ConnectionError("Cannot connect")):
                limiter = create_rate_limiter(calls=5, period=60)

                # Should fall back to memory
                assert limiter._backend_name == "memory"
                assert limiter._using_redis is False


class TestRateLimiterFactoryFunctionality:
    """Test that created limiters function correctly."""
    
    def test_memory_limiter_functionality(self):
        """Test memory backend limiter works correctly."""
        with patch.dict(os.environ, {
            "JWT_SECRET_KEY": "test-secret-key",
            "ENVIRONMENT": "development",
            "RATE_LIMIT_BACKEND": "memory",
            "TEST_MODE": "true",
        }):
            import backend.config
            backend.config._settings = None

            limiter = create_rate_limiter(calls=2, period=60)

            # First 2 calls should be allowed
            assert limiter.is_allowed("user1") == True
            assert limiter.is_allowed("user1") == True

            # Third call should be denied
            assert limiter.is_allowed("user1") == False
    
    def test_redis_limiter_functionality(self):
        """Test Redis backend limiter works correctly."""
        mock_redis_client = MagicMock()
        mock_redis_client.ping.return_value = True
        mock_redis_client.set.return_value = True
        mock_redis_client.get.return_value = "test"
        mock_redis_client.delete.return_value = True

        # Mock pipeline for atomic operations
        mock_pipeline = MagicMock()
        mock_pipeline.incr.return_value = 1
        mock_pipeline.expire.return_value = True
        mock_pipeline.execute.return_value = (1, None)
        mock_redis_client.pipeline.return_value = mock_pipeline

        with patch.dict(os.environ, {
            "JWT_SECRET_KEY": "test-secret-key",
            "ENVIRONMENT": "development",
            "RATE_LIMIT_BACKEND": "redis",
            "REDIS_URL": "redis://localhost:6379/0",
            "TEST_MODE": "true",
        }):
            import backend.config
            backend.config._settings = None

            # Create a mock RedisStorage by subclassing
            class MockRedisStorage(RedisStorage):
                def __init__(self, url):
                    self.client = mock_redis_client
                    self.url = url

                def health_check(self):
                    return {"healthy": True, "error": None}

            with patch('backend.utils.limiter.RedisStorage', MockRedisStorage):
                with patch('backend.utils.limiter.redis.from_url', return_value=mock_redis_client):
                    limiter = create_rate_limiter(calls=5, period=60)

                    # Should use Redis
                    assert limiter._using_redis is True

                    # Test check method
                    result = limiter.check("user1")
                    assert "allowed" in result
                    assert "remaining" in result
                    assert "retry_after" in result


class TestRateLimiterFactoryNoRuntimeFallback:
    """Test that runtime fallback is eliminated."""
    
    def test_no_runtime_fallback_on_check_failure(self):
        """Test that check() raises exception on Redis failure instead of falling back."""
        mock_redis_client = MagicMock()
        mock_redis_client.ping.return_value = True
        mock_redis_client.set.return_value = True
        mock_redis_client.get.return_value = "test"
        mock_redis_client.delete.return_value = True
        
        # Mock pipeline for atomic operations
        mock_pipeline = MagicMock()
        mock_pipeline.incr.side_effect = redis.ConnectionError("Redis down")
        mock_pipeline.expire.return_value = True
        mock_pipeline.execute.return_value = (1, None)
        mock_redis_client.pipeline.return_value = mock_pipeline
        
        with patch.dict(os.environ, {
            "JWT_SECRET_KEY": "test-secret-key",
            "ENVIRONMENT": "staging",
            "RATE_LIMIT_BACKEND": "redis",
            "REDIS_URL": "redis://localhost:6379/0",
            "DOCUMENT_ENCRYPTION_KEY": "test-encryption-key",
        }):
            import backend.config
            backend.config._settings = None
            
            with patch('backend.utils.limiter.redis.from_url', return_value=mock_redis_client):
                limiter = create_rate_limiter(calls=5, period=60)
                
                # Check should raise exception, not fall back
                with pytest.raises(redis.ConnectionError):
                    limiter.check("user1")
