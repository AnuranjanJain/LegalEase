import os
import pytest
import time
import concurrent.futures
from unittest.mock import MagicMock, patch
import redis
from backend.utils.limiter import SimpleRateLimiter
import backend.config

# Reset settings before any tests
backend.config._settings = None

# Set JWT_SECRET_KEY for tests that don't use patch.dict
os.environ["JWT_SECRET_KEY"] = "testing-secret-key-1234567890-abcdef"


@pytest.mark.unit
def test_rate_limiter_basic():
    """Test basic rate limiting functionality"""
    limiter = SimpleRateLimiter(calls=3, period=60)
    
    # First 3 calls should be allowed
    assert limiter.is_allowed("user1") == True
    assert limiter.is_allowed("user1") == True
    assert limiter.is_allowed("user1") == True
    
    # 4th call should be denied
    assert limiter.is_allowed("user1") == False


@pytest.mark.unit
def test_rate_limiter_different_keys():
    """Test that rate limiting is per-key"""
    limiter = SimpleRateLimiter(calls=2, period=60)
    
    # Different keys should have independent limits
    assert limiter.is_allowed("user1") == True
    assert limiter.is_allowed("user1") == True
    assert limiter.is_allowed("user1") == False  # user1 exhausted
    
    assert limiter.is_allowed("user2") == True  # user2 fresh
    assert limiter.is_allowed("user2") == True


@pytest.mark.unit
def test_rate_limiter_time_window():
    """Test that rate limiting resets after time period"""
    limiter = SimpleRateLimiter(calls=2, period=1)  # 1 second period
    
    assert limiter.is_allowed("user1") == True
    assert limiter.is_allowed("user1") == True
    assert limiter.is_allowed("user1") == False
    
    # Wait for period to expire
    time.sleep(1.1)
    
    # Should be allowed again
    assert limiter.is_allowed("user1") == True


@pytest.mark.unit
def test_rate_limiter_pruning():
    """Test that old entries are pruned from storage"""
    limiter = SimpleRateLimiter(calls=100, period=1)
    
    # Make many calls
    for _ in range(50):
        limiter.is_allowed("user1")
    
    # Wait for period to expire
    time.sleep(1.1)
    
    # Make another call - should prune old entries
    limiter.is_allowed("user1")
    
    # Storage should not grow unbounded
    assert len(limiter._storage["user1"]) < 50


@pytest.mark.unit
def test_rate_limiter_concurrency():
    """Test that local rate limiting is thread-safe under concurrent access."""
    limiter = SimpleRateLimiter(calls=100, period=60)
    key = "concurrent_user"

    # We run 20 threads, each doing 5 requests. Total 100 requests.
    # All of them should be allowed, and remaining should decrease to 0.
    def call_limiter():
        return limiter.check(key)

    with concurrent.futures.ThreadPoolExecutor(max_workers=20) as executor:
        futures = [executor.submit(call_limiter) for _ in range(100)]
        results = [f.result() for f in concurrent.futures.as_completed(futures)]

    allowed_count = sum(1 for r in results if r["allowed"])
    assert allowed_count == 100

    # The next check should be blocked
    assert limiter.is_allowed(key) == False


@pytest.mark.unit
def test_redis_rate_limiter_success(monkeypatch):
    """Test that Redis rate limiting is used when REDIS_URL is configured."""
    # Set REDIS_URL environment variable
    monkeypatch.setenv("REDIS_URL", "redis://localhost:6379/0")

    # Mock redis client and pipeline
    mock_redis_client = MagicMock()
    mock_pipeline = MagicMock()
    mock_redis_client.pipeline.return_value = mock_pipeline
    
    # Simulate first hit returns 1, second returns 2, third returns 3 (blocked)
    mock_pipeline.execute.side_effect = [
        [1, True],
        [2, True],
        [3, True],
    ]

    with patch("redis.from_url", return_value=mock_redis_client) as mock_from_url:
        limiter = SimpleRateLimiter(calls=2, period=60)
        assert limiter._redis_backend is not None
        
        # Call 1 (allowed)
        res1 = limiter.check("user1")
        assert res1["allowed"] is True
        assert res1["remaining"] == 1
        
        # Call 2 (allowed)
        res2 = limiter.check("user1")
        assert res2["allowed"] is True
        assert res2["remaining"] == 0
        
        # Call 3 (denied)
        res3 = limiter.check("user1")
        assert res3["allowed"] is False
        assert res3["remaining"] == 0
        assert res3["retry_after"] > 0

        # Verify calls to mock
        mock_from_url.assert_called_once_with("redis://localhost:6379/0", decode_responses=True)
        assert mock_redis_client.pipeline.call_count == 3
        mock_pipeline.incr.assert_called_with(f"rate_limit:user1:{int(time.time() / 60)}")


@pytest.mark.unit
def test_redis_rate_limiter_fallback(monkeypatch, caplog):
    """Test automatic fallback to local storage when Redis is unavailable."""
    monkeypatch.setenv("REDIS_URL", "redis://localhost:6379/0")

    mock_redis_client = MagicMock()
    mock_pipeline = MagicMock()
    mock_redis_client.pipeline.return_value = mock_pipeline
    
    # Simulate a ConnectionError on check
    mock_pipeline.execute.side_effect = redis.exceptions.ConnectionError("Redis connection lost")

    with patch("redis.from_url", return_value=mock_redis_client):
        limiter = SimpleRateLimiter(calls=2, period=60)
        
        # Should fall back to in-memory store and allow request
        res1 = limiter.check("fallback_user")
        assert res1["allowed"] is True
        
        # Check logs for fallback warning/error
        assert any("Redis rate limiter check failed" in record.message for record in caplog.records)

        # Call 2 (should also fall back and be allowed)
        res2 = limiter.check("fallback_user")
        assert res2["allowed"] is True

        # Call 3 (falls back, but exceeds local limit of 2)
        res3 = limiter.check("fallback_user")
        assert res3["allowed"] is False

