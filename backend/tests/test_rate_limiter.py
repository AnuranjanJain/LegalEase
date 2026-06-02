import pytest
import time
from backend.rate_limit import SimpleRateLimiter


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
    assert len(limiter.storage["user1"]) < 50
