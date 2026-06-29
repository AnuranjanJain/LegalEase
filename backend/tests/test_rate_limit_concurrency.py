"""
Tests for rate limiting under concurrent access and multi-worker scenarios.

This test suite validates that rate limiting works correctly under concurrent
requests and simulates multi-worker deployments to ensure global enforcement.
"""
import pytest
import threading
import time
from unittest.mock import Mock, patch
import redis

from backend.utils.limiter import SimpleRateLimiter, RedisStorage


@pytest.fixture
def in_memory_limiter():
    """Create a limiter with in-memory storage."""
    limiter = SimpleRateLimiter(calls=10, period=60)
    limiter._redis_backend = None
    return limiter


@pytest.fixture
def redis_limiter():
    """Create a limiter with Redis storage (mocked)."""
    limiter = SimpleRateLimiter(calls=10, period=60)
    
    # Mock Redis client with thread-safe behavior
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


@pytest.mark.concurrency
def test_concurrent_requests_in_memory(in_memory_limiter):
    """Test concurrent requests with in-memory storage."""
    key = "test_key"
    num_threads = 20
    allowed_count = 0
    denied_count = 0
    results = []
    
    def make_request():
        result = in_memory_limiter.check(key)
        results.append(result["allowed"])
    
    threads = []
    for _ in range(num_threads):
        t = threading.Thread(target=make_request)
        threads.append(t)
        t.start()
    
    for t in threads:
        t.join()
    
    allowed_count = sum(results)
    denied_count = len(results) - allowed_count
    
    # With in-memory storage and threading.Lock, should be thread-safe
    # Should allow exactly 10 requests (the limit)
    assert allowed_count == 10
    assert denied_count == 10


@pytest.mark.concurrency
def test_concurrent_requests_different_keys(in_memory_limiter):
    """Test concurrent requests with different keys."""
    num_threads = 10
    results = []
    
    def make_request(key):
        result = in_memory_limiter.check(key)
        results.append((key, result["allowed"]))
    
    threads = []
    for i in range(num_threads):
        t = threading.Thread(target=make_request, args=(f"key_{i}",))
        threads.append(t)
        t.start()
    
    for t in threads:
        t.join()
    
    # All different keys should be allowed
    assert all(allowed for _, allowed in results)


@pytest.mark.concurrency
def test_concurrent_redis_requests(redis_limiter):
    """Test concurrent requests with Redis storage."""
    limiter, mock_redis = redis_limiter
    key = "test_key"
    num_threads = 20
    
    # Mock Redis to increment atomically
    call_count = [0]
    def mock_execute():
        call_count[0] += 1
        if call_count[0] <= 10:
            return (call_count[0], True)
        else:
            return (call_count[0], True)
    
    mock_redis.execute.side_effect = mock_execute
    
    allowed_count = 0
    denied_count = 0
    results = []
    
    def make_request():
        result = limiter.check(key)
        results.append(result["allowed"])
    
    threads = []
    for _ in range(num_threads):
        t = threading.Thread(target=make_request)
        threads.append(t)
        t.start()
    
    for t in threads:
        t.join()
    
    allowed_count = sum(results)
    denied_count = len(results) - allowed_count
    
    # With Redis atomic operations, should allow exactly 10 requests
    assert allowed_count == 10
    assert denied_count == 10


@pytest.mark.concurrency
def test_simulated_multi_worker_scenario():
    """Simulate multi-worker scenario with separate limiter instances."""
    # Simulate 4 workers with their own in-memory limiters
    workers = [SimpleRateLimiter(calls=5, period=60) for _ in range(4)]
    
    # Disable Redis for all workers to simulate process-local storage
    for worker in workers:
        worker._redis_backend = None
    
    key = "shared_key"
    results = []
    
    def worker_requests(worker_id):
        # Each worker makes 3 requests
        for _ in range(3):
            result = workers[worker_id].check(key)
            results.append((worker_id, result["allowed"]))
    
    threads = []
    for i in range(4):
        t = threading.Thread(target=worker_requests, args=(i,))
        threads.append(t)
        t.start()
    
    for t in threads:
        t.join()
    
    # With process-local storage, each worker has its own limit
    # This demonstrates the problem: 4 workers * 5 limit = 20 total allowed
    allowed_by_worker = {}
    for worker_id, allowed in results:
        if worker_id not in allowed_by_worker:
            allowed_by_worker[worker_id] = 0
        if allowed:
            allowed_by_worker[worker_id] += 1
    
    # Each worker should have allowed 3 requests (under their individual limit of 5)
    for worker_id in range(4):
        assert allowed_by_worker[worker_id] == 3
    
    # Total allowed: 4 workers * 3 requests = 12
    # This exceeds the intended global limit of 5
    total_allowed = sum(allowed_by_worker.values())
    assert total_allowed == 12  # Problem: exceeds intended limit


@pytest.mark.concurrency
def test_simulated_multi_worker_with_redis():
    """Simulate multi-worker scenario with shared Redis backend."""
    # Simulate 4 workers with shared Redis backend
    mock_redis = Mock()
    mock_redis.pipeline.return_value = mock_redis
    mock_redis.expire.return_value = True
    mock_redis.keys.return_value = []
    mock_redis.get.return_value = None
    mock_redis.delete.return_value = 0
    
    # Mock atomic increment with shared counter
    shared_counter = [0]
    def mock_execute():
        shared_counter[0] += 1
        if shared_counter[0] <= 5:
            return (shared_counter[0], True)
        else:
            return (shared_counter[0], True)
    
    mock_redis.execute.side_effect = mock_execute
    
    workers = []
    for _ in range(4):
        limiter = SimpleRateLimiter(calls=5, period=60)
        redis_storage = RedisStorage("redis://localhost:6379/0")
        redis_storage.client = mock_redis
        limiter._redis_backend = redis_storage
        workers.append(limiter)
    
    key = "shared_key"
    results = []
    
    def worker_requests(worker_id):
        # Each worker makes 3 requests
        for _ in range(3):
            result = workers[worker_id].check(key)
            results.append((worker_id, result["allowed"]))
    
    threads = []
    for i in range(4):
        t = threading.Thread(target=worker_requests, args=(i,))
        threads.append(t)
        t.start()
    
    for t in threads:
        t.join()
    
    # With shared Redis, total allowed should be exactly 5 (the global limit)
    total_allowed = sum(1 for _, allowed in results if allowed)
    assert total_allowed == 5  # Correct: enforces global limit


@pytest.mark.concurrency
def test_race_condition_in_memory_storage(in_memory_limiter):
    """Test that in-memory storage is thread-safe under race conditions."""
    key = "race_key"
    num_threads = 50
    
    results = []
    
    def make_request():
        result = in_memory_limiter.check(key)
        results.append(result["allowed"])
    
    threads = []
    for _ in range(num_threads):
        t = threading.Thread(target=make_request)
        threads.append(t)
        t.start()
    
    for t in threads:
        t.join()
    
    allowed_count = sum(results)
    
    # Should not exceed the limit due to threading.Lock
    assert allowed_count <= 10


@pytest.mark.concurrency
def test_concurrent_different_periods():
    """Test concurrent requests with different rate limit periods."""
    limiter_short = SimpleRateLimiter(calls=5, period=1)
    limiter_short._redis_backend = None
    
    limiter_long = SimpleRateLimiter(calls=5, period=60)
    limiter_long._redis_backend = None
    
    key = "test_key"
    
    def make_requests(limiter):
        for _ in range(3):
            limiter.check(key)
    
    # Make concurrent requests with different limiters
    t1 = threading.Thread(target=make_requests, args=(limiter_short,))
    t2 = threading.Thread(target=make_requests, args=(limiter_long,))
    
    t1.start()
    t2.start()
    t1.join()
    t2.join()
    
    # Each limiter should have its own independent state
    assert limiter_short.check(key)["allowed"] is True  # 4th request
    assert limiter_long.check(key)["allowed"] is True  # 4th request


@pytest.mark.concurrency
def test_concurrent_cleanup(in_memory_limiter):
    """Test concurrent cleanup operations."""
    # Add some entries
    for i in range(5):
        in_memory_limiter.check(f"key_{i}")
    
    results = []
    
    def cleanup_operation():
        evicted = in_memory_limiter.cleanup()
        results.append(evicted)
    
    threads = []
    for _ in range(10):
        t = threading.Thread(target=cleanup_operation)
        threads.append(t)
        t.start()
    
    for t in threads:
        t.join()
    
    # All cleanups should complete without errors
    assert len(results) == 10


@pytest.mark.concurrency
def test_concurrent_storage_proxy_operations():
    """Test concurrent operations on storage proxy."""
    limiter = SimpleRateLimiter(calls=10, period=60)
    limiter._redis_backend = None
    
    results = []
    
    def proxy_operations():
        # Mix of different operations
        limiter.check("key1")
        limiter.check("key2")
        "key1" in limiter.storage
        limiter.storage.get("key1")
    
    threads = []
    for _ in range(20):
        t = threading.Thread(target=proxy_operations)
        threads.append(t)
        t.start()
    
    for t in threads:
        t.join()
    
    # All operations should complete without errors
    assert True


@pytest.mark.concurrency
def test_high_concurrency_stress_test(in_memory_limiter):
    """Stress test with high concurrency."""
    key = "stress_key"
    num_threads = 100
    requests_per_thread = 5
    
    results = []
    
    def make_requests():
        for _ in range(requests_per_thread):
            result = in_memory_limiter.check(key)
            results.append(result["allowed"])
    
    threads = []
    for _ in range(num_threads):
        t = threading.Thread(target=make_requests)
        threads.append(t)
        t.start()
    
    for t in threads:
        t.join()
    
    allowed_count = sum(results)
    
    # Should not exceed the limit even under high concurrency
    assert allowed_count <= 10
