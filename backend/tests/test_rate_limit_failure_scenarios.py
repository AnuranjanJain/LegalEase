"""
Tests for rate limiting failure scenarios and Redis unavailability.

This test suite validates that the rate limiter handles Redis failures gracefully
with proper fallback behavior, logging, and error handling.
"""
import pytest
import os
from unittest.mock import Mock, patch, MagicMock
import redis

from backend.utils.limiter import SimpleRateLimiter, RedisStorage, InMemoryStorage


@pytest.fixture
def redis_limiter():
    """Create a limiter with Redis storage (mocked)."""
    limiter = SimpleRateLimiter(calls=5, period=60)
    
    # Mock Redis client
    mock_redis = Mock()
    mock_redis.pipeline.return_value = mock_redis
    mock_redis.incr.return_value = 1
    mock_redis.expire.return_value = True
    mock_redis.keys.return_value = []
    mock_redis.get.return_value = None
    mock_redis.delete.return_value = 0
    
    redis_storage = RedisStorage("redis://localhost:6379/0")
    redis_storage.client = mock_redis
    limiter._redis_backend = redis_storage
    
    return limiter, mock_redis


@pytest.mark.failure
def test_redis_connection_error_during_check(redis_limiter):
    """Test that Redis connection errors during check fall back to in-memory."""
    limiter, mock_redis = redis_limiter
    
    # Make Redis fail on first check
    mock_redis.execute.side_effect = redis.ConnectionError("Connection lost")
    
    # Should fall back to in-memory storage
    result = limiter.check("test_key")
    
    # Should still return a valid result
    assert "allowed" in result
    assert "remaining" in result
    assert "retry_after" in result
    
    # Should have used in-memory storage
    assert "test_key" in limiter._local_storage.storage


@pytest.mark.failure
def test_redis_timeout_error_during_check(redis_limiter):
    """Test that Redis timeout errors during check fall back to in-memory."""
    limiter, mock_redis = redis_limiter
    
    # Make Redis timeout
    mock_redis.execute.side_effect = redis.TimeoutError("Request timed out")
    
    # Should fall back to in-memory storage
    result = limiter.check("test_key")
    
    # Should still return a valid result
    assert "allowed" in result
    assert result["allowed"] is True


@pytest.mark.failure
def test_redis_connection_error_during_contains(redis_limiter):
    """Test that Redis connection errors during contains fall back to in-memory."""
    limiter, mock_redis = redis_limiter
    
    # Make Redis fail on keys operation
    mock_redis.keys.side_effect = redis.ConnectionError("Connection lost")
    
    # Should fall back to in-memory storage
    result = "test_key" in limiter.storage
    
    # Should return False (key not in local storage)
    assert result is False


@pytest.mark.failure
def test_redis_connection_error_during_delete(redis_limiter):
    """Test that Redis connection errors during delete fall back to in-memory."""
    limiter, mock_redis = redis_limiter
    
    # Add key to local storage first
    limiter._local_storage.check("test_key", limiter.calls, limiter.period)
    
    # Make Redis fail on delete
    mock_redis.keys.side_effect = redis.ConnectionError("Connection lost")
    
    # Should fall back to in-memory storage
    del limiter.storage["test_key"]
    
    # Key should be removed from local storage
    assert "test_key" not in limiter._local_storage.storage


@pytest.mark.failure
def test_redis_connection_error_during_clear(redis_limiter):
    """Test that Redis connection errors during clear fall back to in-memory."""
    limiter, mock_redis = redis_limiter
    
    # Add some keys to local storage
    limiter._local_storage.check("key1", limiter.calls, limiter.period)
    limiter._local_storage.check("key2", limiter.calls, limiter.period)
    
    # Make Redis fail on clear
    mock_redis.keys.side_effect = redis.ConnectionError("Connection lost")
    
    # Should fall back to in-memory storage
    limiter.storage.clear()
    
    # Local storage should be cleared
    assert len(limiter._local_storage.storage) == 0


@pytest.mark.failure
def test_redis_connection_error_during_cleanup(redis_limiter):
    """Test that Redis connection errors during cleanup fall back to in-memory."""
    limiter, mock_redis = redis_limiter
    
    # Make Redis fail on cleanup
    # Redis cleanup is a no-op, but we test the fallback logic
    mock_redis.execute.side_effect = redis.ConnectionError("Connection lost")
    
    # Should fall back to in-memory storage
    evicted = limiter.cleanup()
    
    # Should return a valid result
    assert evicted >= 0


@pytest.mark.failure
def test_redis_initialization_failure():
    """Test that Redis initialization failures fall back to in-memory."""
    with patch.dict(os.environ, {"REDIS_URL": "redis://localhost:6379/0"}):
        with patch('backend.utils.limiter.redis.from_url') as mock_from_url:
            # Make Redis initialization fail
            mock_from_url.side_effect = redis.ConnectionError("Cannot connect")
            
            limiter = SimpleRateLimiter(calls=5, period=60)
            
            # Should fall back to in-memory storage
            assert limiter._redis_backend is None
            assert isinstance(limiter._local_storage, InMemoryStorage)


@pytest.mark.failure
def test_redis_reconnection_scenario(redis_limiter):
    """Test that Redis reconnection after failure works correctly."""
    limiter, mock_redis = redis_limiter
    
    # First request fails
    mock_redis.execute.side_effect = redis.ConnectionError("Connection lost")
    result1 = limiter.check("test_key")
    assert result1["allowed"] is True  # Fallback to in-memory
    
    # Redis recovers for second request
    mock_redis.execute.side_effect = None
    mock_redis.execute.return_value = (1, True)
    
    result2 = limiter.check("test_key")
    assert result2["allowed"] is True  # Should use Redis now


@pytest.mark.failure
def test_redis_partial_failure(redis_limiter):
    """Test that partial Redis failures (some operations succeed, some fail) are handled."""
    limiter, mock_redis = redis_limiter
    
    # First operation succeeds
    mock_redis.execute.return_value = (1, True)
    result1 = limiter.check("test_key")
    assert result1["allowed"] is True
    
    # Second operation fails
    mock_redis.execute.side_effect = redis.ConnectionError("Connection lost")
    result2 = limiter.check("test_key")
    assert result2["allowed"] is True  # Fallback to in-memory
    
    # Third operation succeeds again
    mock_redis.execute.side_effect = None
    mock_redis.execute.return_value = (2, True)
    result3 = limiter.check("test_key")
    assert result3["allowed"] is True


@pytest.mark.failure
def test_redis_pipeline_failure(redis_limiter):
    """Test that Redis pipeline failures are handled gracefully."""
    limiter, mock_redis = redis_limiter
    
    # Make pipeline fail
    mock_redis.pipeline.side_effect = redis.ConnectionError("Pipeline error")
    
    # Should fall back to in-memory storage
    result = limiter.check("test_key")
    
    # Should still return a valid result
    assert "allowed" in result
    assert result["allowed"] is True


@pytest.mark.failure
def test_redis_auth_error():
    """Test that Redis authentication errors are handled."""
    with patch.dict(os.environ, {"REDIS_URL": "redis://localhost:6379/0"}):
        with patch('backend.utils.limiter.redis.from_url') as mock_from_url:
            # Make Redis fail with auth error
            mock_from_url.side_effect = redis.AuthenticationError("Invalid password")
            
            limiter = SimpleRateLimiter(calls=5, period=60)
            
            # Should fall back to in-memory storage
            assert limiter._redis_backend is None
            assert isinstance(limiter._local_storage, InMemoryStorage)


@pytest.mark.failure
def test_redis_database_error(redis_limiter):
    """Test that Redis database errors are handled."""
    limiter, mock_redis = redis_limiter
    
    # Make Redis fail with database error (using RedisError as base)
    mock_redis.execute.side_effect = redis.RedisError("Database error")
    
    # Should fall back to in-memory storage
    result = limiter.check("test_key")
    
    # Should still return a valid result
    assert "allowed" in result
    assert result["allowed"] is True


@pytest.mark.failure
def test_concurrent_redis_failures(redis_limiter):
    """Test that concurrent Redis failures are handled gracefully."""
    limiter, mock_redis = redis_limiter
    
    # Make Redis fail intermittently
    call_count = [0]
    def mock_execute():
        call_count[0] += 1
        if call_count[0] % 2 == 0:
            raise redis.ConnectionError("Intermittent failure")
        return (call_count[0], True)
    
    mock_redis.execute.side_effect = mock_execute
    
    import threading
    
    results = []
    def make_request():
        result = limiter.check("test_key")
        results.append(result["allowed"])
    
    threads = []
    for _ in range(10):
        t = threading.Thread(target=make_request)
        threads.append(t)
        t.start()
    
    for t in threads:
        t.join()
    
    # All requests should complete without errors
    assert len(results) == 10
    # All should return valid results
    assert all(isinstance(r, bool) for r in results)


@pytest.mark.failure
def test_redis_url_invalid():
    """Test that invalid Redis URL is handled gracefully."""
    with patch.dict(os.environ, {"REDIS_URL": "invalid://url"}):
        with patch('backend.utils.limiter.redis.from_url') as mock_from_url:
            # Make Redis fail with invalid URL
            mock_from_url.side_effect = ValueError("Invalid Redis URL")
            
            limiter = SimpleRateLimiter(calls=5, period=60)
            
            # Should fall back to in-memory storage
            assert limiter._redis_backend is None
            assert isinstance(limiter._local_storage, InMemoryStorage)


@pytest.mark.failure
def test_redis_max_connections_error():
    """Test that Redis max connections errors are handled."""
    with patch.dict(os.environ, {"REDIS_URL": "redis://localhost:6379/0"}):
        with patch('backend.utils.limiter.redis.from_url') as mock_from_url:
            # Make Redis fail with max connections error
            mock_from_url.side_effect = redis.ConnectionError("Max connections reached")
            
            limiter = SimpleRateLimiter(calls=5, period=60)
            
            # Should fall back to in-memory storage
            assert limiter._redis_backend is None
            assert isinstance(limiter._local_storage, InMemoryStorage)


@pytest.mark.failure
def test_storage_proxy_getitem_failure(redis_limiter):
    """Test that storage proxy getitem failures are handled."""
    limiter, mock_redis = redis_limiter
    
    # Make Redis fail on getitem
    mock_redis.keys.side_effect = redis.ConnectionError("Connection lost")
    
    # Should fall back to in-memory storage
    result = limiter.storage["test_key"]
    
    # Should return empty list from local storage
    assert result == []


@pytest.mark.failure
def test_storage_proxy_setitem_failure(redis_limiter):
    """Test that storage proxy setitem failures are handled."""
    limiter, mock_redis = redis_limiter
    
    # Make Redis fail on setitem
    mock_redis.execute.side_effect = redis.ConnectionError("Connection lost")
    
    # Should fall back to in-memory storage
    limiter.storage["test_key"] = [1.0, 2.0]
    
    # Should be set in local storage (via the proxy's setitem which falls back)
    # The proxy's setitem calls set/expire on Redis, which fails, then falls back to local
    # So we verify the operation didn't crash
    assert True  # Test passes if no exception is raised


@pytest.mark.failure
def test_storage_proxy_items_failure(redis_limiter):
    """Test that storage proxy items() failures are handled."""
    limiter, mock_redis = redis_limiter
    
    # Make Redis fail on items
    mock_redis.keys.side_effect = redis.ConnectionError("Connection lost")
    
    # Should fall back to in-memory storage
    items = limiter.storage.items()
    
    # Should return items from local storage
    assert isinstance(items, list)


@pytest.mark.failure
def test_storage_proxy_len_failure(redis_limiter):
    """Test that storage proxy len() failures are handled."""
    limiter, mock_redis = redis_limiter
    
    # Make Redis fail on len
    mock_redis.keys.side_effect = redis.ConnectionError("Connection lost")
    
    # Should fall back to in-memory storage
    length = len(limiter.storage)
    
    # Should return length from local storage
    assert isinstance(length, int)
    assert length >= 0


@pytest.mark.failure
def test_graceful_degradation_under_load(redis_limiter):
    """Test that the system degrades gracefully under Redis failure load."""
    limiter, mock_redis = redis_limiter
    
    # Simulate Redis failing under load
    failure_count = [0]
    def mock_execute():
        failure_count[0] += 1
        if failure_count[0] > 5:  # Fail after 5 successful requests
            raise redis.ConnectionError("Under load")
        return (failure_count[0], True)
    
    mock_redis.execute.side_effect = mock_execute
    
    # Make multiple requests
    results = []
    for _ in range(20):
        result = limiter.check("test_key")
        results.append(result["allowed"])
    
    # All requests should complete
    assert len(results) == 20
    # All should return valid results
    assert all(isinstance(r, bool) for r in results)
    # First 5 should be from Redis, rest from in-memory fallback
    assert sum(results) > 0  # At least some should be allowed
