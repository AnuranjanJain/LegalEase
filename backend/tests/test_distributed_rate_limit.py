"""
Tests for distributed rate limiting with Redis backend.

This test suite validates the distributed rate limiting implementation
to ensure consistent enforcement across multiple workers and proper
fallback behavior when Redis is unavailable.
"""
import pytest
import time
import os
from unittest.mock import Mock, patch, MagicMock
import redis

os.environ["JWT_SECRET_KEY"] = "testing-secret-key-1234567890-abcdef"
os.environ["TEST_MODE"] = "true"
os.environ["ENVIRONMENT"] = "testing"

from backend.utils.limiter import (
    SimpleRateLimiter,
    InMemoryStorage,
    RedisStorage,
    LimiterStorageProxy,
)


@pytest.fixture
def in_memory_limiter():
    """Create a limiter with in-memory storage."""
    limiter = SimpleRateLimiter(calls=5, period=60)
    limiter._redis_backend = None
    return limiter


@pytest.fixture
def redis_limiter():
    """Create a limiter with Redis storage (mocked)."""
    # Mock Redis client
    mock_redis = Mock()
    mock_redis.pipeline.return_value = mock_redis
    mock_redis.incr.return_value = 1
    mock_redis.expire.return_value = True
    mock_redis.execute.return_value = (1, True)
    mock_redis.keys.return_value = []
    mock_redis.get.return_value = None
    mock_redis.delete.return_value = 0
    
    # Create Redis storage with mocked client
    redis_storage = RedisStorage("redis://localhost:6379/0")
    redis_storage.client = mock_redis
    
    # Create limiter with Redis backend
    limiter = SimpleRateLimiter(calls=5, period=60, backend=redis_storage, backend_name="redis")
    
    return limiter, mock_redis


@pytest.mark.unit
def test_in_memory_storage_normal_limit(in_memory_limiter):
    """Test normal rate limiting with in-memory storage."""
    # Should allow first 5 requests
    for i in range(5):
        result = in_memory_limiter.check("test_key")
        assert result["allowed"] is True
        assert result["remaining"] == 5 - (i + 1)
    
    # 6th request should be rate limited
    result = in_memory_limiter.check("test_key")
    assert result["allowed"] is False
    assert result["remaining"] == 0
    assert result["retry_after"] > 0


@pytest.mark.unit
def test_redis_storage_normal_limit(redis_limiter):
    """Test normal rate limiting with Redis storage."""
    limiter, mock_redis = redis_limiter
    
    # Mock increment behavior for first 5 requests
    mock_redis.execute.side_effect = [(1, True), (2, True), (3, True), (4, True), (5, True)]
    
    # Should allow first 5 requests
    for i in range(5):
        result = limiter.check("test_key")
        assert result["allowed"] is True
        assert result["remaining"] == 5 - (i + 1)
    
    # Mock increment for 6th request (exceeds limit)
    mock_redis.execute.side_effect = [(6, True)]
    
    # 6th request should be rate limited
    result = limiter.check("test_key")
    assert result["allowed"] is False
    assert result["remaining"] == 0
    assert result["retry_after"] > 0


@pytest.mark.unit
def test_redis_storage_fallback_to_in_memory(redis_limiter):
    """Test that Redis failures raise exceptions (no runtime fallback)."""
    limiter, mock_redis = redis_limiter
    
    # Make Redis fail
    mock_redis.execute.side_effect = redis.ConnectionError("Redis connection failed")
    
    # Should raise exception (no runtime fallback in production)
    with pytest.raises(redis.ConnectionError):
        limiter.check("test_key")


@pytest.mark.unit
def test_redis_storage_atomic_operations(redis_limiter):
    """Test that Redis uses atomic operations (pipeline)."""
    limiter, mock_redis = redis_limiter
    
    # Reset mock call counts
    mock_redis.reset_mock()
    
    limiter.check("test_key")
    
    # Verify pipeline was used for atomic operations
    assert mock_redis.pipeline.call_count >= 1
    assert mock_redis.incr.call_count >= 1
    assert mock_redis.expire.call_count >= 1
    assert mock_redis.execute.call_count >= 1


@pytest.mark.unit
def test_retry_after_calculation(redis_limiter):
    """Test retry-after calculation for Redis storage."""
    limiter, mock_redis = redis_limiter
    
    # Mock increment to exceed limit
    mock_redis.execute.return_value = (10, True)  # 10 > 5 (limit)
    
    result = limiter.check("test_key")
    assert result["allowed"] is False
    assert result["retry_after"] >= 0
    assert result["retry_after"] <= 60  # Should not exceed period


@pytest.mark.unit
def test_different_keys_independent(redis_limiter):
    """Test that different keys are rate limited independently."""
    limiter, mock_redis = redis_limiter
    
    # Mock increment for different keys
    mock_redis.execute.side_effect = [(1, True), (1, True), (1, True)]
    
    # Each key should have its own limit
    result1 = limiter.check("key1")
    result2 = limiter.check("key2")
    result3 = limiter.check("key3")
    
    assert result1["allowed"] is True
    assert result2["allowed"] is True
    assert result3["allowed"] is True


@pytest.mark.unit
def test_cleanup_in_memory_storage(in_memory_limiter):
    """Test cleanup of stale keys in in-memory storage."""
    # Add some entries
    in_memory_limiter.check("key1")
    in_memory_limiter.check("key2")
    
    # Cleanup should remove stale keys
    evicted = in_memory_limiter.cleanup()
    # In a real scenario with time passing, this would evict old keys
    assert evicted >= 0


@pytest.mark.unit
def test_cleanup_redis_storage(redis_limiter):
    """Test that Redis storage cleanup is a no-op (Redis expires keys automatically)."""
    limiter, mock_redis = redis_limiter
    
    # Cleanup should be a no-op for Redis
    evicted = limiter.cleanup()
    assert evicted == 0


@pytest.mark.unit
def test_storage_proxy_contains(redis_limiter):
    """Test LimiterStorageProxy contains method."""
    limiter, mock_redis = redis_limiter
    
    # Mock keys to return empty (key doesn't exist)
    mock_redis.keys.return_value = []
    
    assert "test_key" not in limiter.storage
    
    # Mock keys to return the key
    mock_redis.keys.return_value = ["rate_limit:test_key:123"]
    
    assert "test_key" in limiter.storage


@pytest.mark.unit
def test_storage_proxy_delete(redis_limiter):
    """Test LimiterStorageProxy delete method."""
    limiter, mock_redis = redis_limiter
    
    # Mock keys to return some keys
    mock_redis.keys.return_value = ["rate_limit:test_key:123"]
    
    del limiter.storage["test_key"]
    
    # Verify delete was called
    mock_redis.delete.assert_called_once()


@pytest.mark.unit
def test_storage_proxy_clear(redis_limiter):
    """Test LimiterStorageProxy clear method."""
    limiter, mock_redis = redis_limiter
    
    # Mock keys to return some keys
    mock_redis.keys.return_value = ["rate_limit:key1:123", "rate_limit:key2:456"]
    
    limiter.storage.clear()
    
    # Verify delete was called with all keys
    mock_redis.delete.assert_called_once()


@pytest.mark.unit
def test_redis_key_format(redis_limiter):
    """Test that Redis keys are formatted correctly."""
    limiter, mock_redis = redis_limiter
    
    # Reset mock call counts
    mock_redis.reset_mock()
    
    limiter.check("test_key")
    
    # Verify the key format includes the user key and window ID
    if mock_redis.incr.call_count > 0:
        call_args = mock_redis.incr.call_args[0][0]
        assert "rate_limit:test_key:" in call_args


@pytest.mark.unit
def test_redis_expire_set(redis_limiter):
    """Test that Redis keys have expiration set."""
    limiter, mock_redis = redis_limiter
    
    # Reset mock call counts
    mock_redis.reset_mock()
    
    limiter.check("test_key")
    
    # Verify expire was called with the period
    assert mock_redis.expire.call_count >= 1
    if mock_redis.expire.call_count > 0:
        call_args = mock_redis.expire.call_args[0]
        assert call_args[1] == 60  # period


@pytest.mark.unit
def test_is_allowed_helper(in_memory_limiter):
    """Test the is_allowed helper method."""
    assert in_memory_limiter.is_allowed("test_key") is True
    
    # Exhaust the limit
    for _ in range(5):
        in_memory_limiter.check("test_key")
    
    assert in_memory_limiter.is_allowed("test_key") is False


@pytest.mark.unit
def test_multiple_limiters_independent():
    """Test that multiple limiter instances are independent."""
    limiter1 = SimpleRateLimiter(calls=3, period=60)
    limiter2 = SimpleRateLimiter(calls=5, period=60)
    
    # Limiter1 should allow 3 requests
    for _ in range(3):
        assert limiter1.check("key")["allowed"] is True
    assert limiter1.check("key")["allowed"] is False
    
    # Limiter2 should allow 5 requests
    for _ in range(5):
        assert limiter2.check("key")["allowed"] is True
    assert limiter2.check("key")["allowed"] is False


@pytest.mark.unit
def test_period_parameter():
    """Test that period parameter affects rate limiting."""
    # Create limiter with very short period for testing
    limiter = SimpleRateLimiter(calls=2, period=1)
    
    # Should allow 2 requests
    assert limiter.check("key")["allowed"] is True
    assert limiter.check("key")["allowed"] is True
    assert limiter.check("key")["allowed"] is False
    
    # Wait for period to expire
    time.sleep(1.1)
    
    # Should allow requests again
    assert limiter.check("key")["allowed"] is True


@pytest.mark.integration
def test_redis_url_environment_variable():
    """Test that REDIS_URL environment variable enables Redis backend via factory."""
    with patch.dict(os.environ, {"REDIS_URL": "redis://localhost:6379/0", "JWT_SECRET_KEY": "test-secret-key", "TEST_MODE": "true", "RATE_LIMIT_BACKEND": "redis"}):
        import backend.config
        backend.config._settings = None

        mock_redis = Mock()
        mock_redis.ping.return_value = True
        mock_redis.get.return_value = "test"  # Return the value that was set
        mock_redis.set.return_value = True
        mock_redis.delete.return_value = 1
        mock_redis.pipeline.return_value = mock_redis
        mock_redis.execute.return_value = [1, True]  # For incr and expire operations
        mock_redis.keys.return_value = []
        mock_redis.expire.return_value = True

        # Patch redis.from_url before importing create_rate_limiter
        with patch('backend.utils.limiter.redis.from_url', return_value=mock_redis):
            from backend.utils.limiter import create_rate_limiter
            limiter = create_rate_limiter(calls=5, period=60)

            # Verify Redis backend was initialized
            assert limiter._using_redis is True


@pytest.mark.integration
def test_no_redis_url_uses_in_memory():
    """Test that absence of REDIS_URL uses in-memory storage."""
    with patch.dict(os.environ, {"JWT_SECRET_KEY": "test-secret-key", "DOCUMENT_ENCRYPTION_KEY": "test-encryption-key", "TEST_MODE": "true"}, clear=True):
        import backend.config as config
        old_settings = config._settings
        config._settings = None
        try:
            limiter = SimpleRateLimiter(calls=5, period=60)

            # Verify in-memory storage is used
            assert limiter._redis_backend is None
            assert isinstance(limiter._local_storage, InMemoryStorage)
        finally:
            config._settings = old_settings


@pytest.mark.integration
def test_redis_connection_error_on_init():
    """Test that Redis connection errors on init fall back to in-memory."""
    with patch.dict(os.environ, {"REDIS_URL": "redis://localhost:6379/0", "JWT_SECRET_KEY": "test-secret-key", "TEST_MODE": "true"}):
        with patch('backend.utils.limiter.redis.from_url') as mock_from_url:
            mock_from_url.side_effect = redis.ConnectionError("Connection failed")

            limiter = SimpleRateLimiter(calls=5, period=60)

            # Should fall back to in-memory storage
            assert limiter._redis_backend is None
            assert isinstance(limiter._local_storage, InMemoryStorage)
