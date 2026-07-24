import threading
import time
from typing import Dict, List
import logging
import redis

from backend.config import get_settings

logger = logging.getLogger(__name__)


class BaseStorage:
    """Base class for rate limiter storage backends."""

    def check(self, key: str, calls: int, period: int) -> dict:
        raise NotImplementedError

    def peek(self, key: str, calls: int, period: int) -> dict:
        raise NotImplementedError

    def get_attempt_count(self, key: str, period: int) -> int:
        raise NotImplementedError

    def cleanup(self, period: int) -> int:
        raise NotImplementedError

    def contains(self, key: str) -> bool:
        raise NotImplementedError

    def delete(self, key: str) -> None:
        raise NotImplementedError

    def clear(self) -> None:
        raise NotImplementedError


class InMemoryStorage(BaseStorage):
    """Thread-safe in-memory sliding-window storage."""

    def __init__(self):
        self.storage: Dict[str, List[float]] = {}
        self._lock = threading.Lock()

    def check(self, key: str, calls: int, period: int) -> dict:
        now = time.time()
        window = now - period

        with self._lock:
            timestamps = self.storage.get(key, [])
            timestamps = [t for t in timestamps if t > window]
            remaining = calls - len(timestamps)

            if remaining <= 0:
                retry_after = max(1, int(timestamps[0] + period - now) + 1) if timestamps else 1
                self.storage[key] = timestamps
                return {
                    "allowed": False,
                    "remaining": 0,
                    "retry_after": retry_after,
                }

            timestamps.append(now)
            self.storage[key] = timestamps
            return {
                "allowed": True,
                "remaining": max(0, calls - len(timestamps)),
                "retry_after": 0,
            }

    def peek(self, key: str, calls: int, period: int) -> dict:
        """Check rate limit without incrementing the counter."""
        now = time.time()
        window = now - period

        with self._lock:
            timestamps = self.storage.get(key, [])
            timestamps = [t for t in timestamps if t > window]
            remaining = calls - len(timestamps)

            if remaining <= 0:
                retry_after = max(1, int(timestamps[0] + period - now) + 1) if timestamps else 1
                return {
                    "allowed": False,
                    "remaining": 0,
                    "retry_after": retry_after,
                }

            return {
                "allowed": True,
                "remaining": remaining,
                "retry_after": 0,
            }

    def get_attempt_count(self, key: str, period: int) -> int:
        """Get the current attempt count without incrementing."""
        now = time.time()
        window = now - period

        with self._lock:
            timestamps = self.storage.get(key, [])
            timestamps = [t for t in timestamps if t > window]
            return len(timestamps)

    def cleanup(self, period: int) -> int:
        now = time.time()
        window = now - period
        evicted = 0

        with self._lock:
            stale_keys = [
                k for k, ts in self.storage.items()
                if not any(t > window for t in ts)
            ]
            for k in stale_keys:
                del self.storage[k]
                evicted += 1

        return evicted

    def contains(self, key: str) -> bool:
        with self._lock:
            return key in self.storage

    def delete(self, key: str) -> None:
        with self._lock:
            if key in self.storage:
                del self.storage[key]

    def clear(self) -> None:
        with self._lock:
            self.storage.clear()


class RedisStorage(BaseStorage):
    """Process-safe, distributed Redis-based rate limiting storage.

    Uses Redis atomic INCR and EXPIRE operations.
    """

    def __init__(self, redis_url: str):
        self.redis_url = redis_url
        self.client = redis.from_url(redis_url, decode_responses=True)

    def health_check(self) -> dict:
        """
        Perform comprehensive Redis health check.
        
        Validates:
        - Connection
        - Authentication
        - Ping response
        - Database selection
        
        Returns:
            dict: Health check result with 'healthy' boolean and 'error' message if failed.
        """
        try:
            # Test ping
            pong = self.client.ping()
            if not pong:
                return {
                    "healthy": False,
                    "error": "Redis ping failed - server not responding"
                }
            
            # Test basic operation (set/get/delete)
            test_key = "health_check_test"
            self.client.set(test_key, "test", ex=5)
            value = self.client.get(test_key)
            if value != "test":
                return {
                    "healthy": False,
                    "error": "Redis read/write test failed"
                }
            self.client.delete(test_key)
            
            return {"healthy": True}
            
        except redis.AuthenticationError as e:
            return {
                "healthy": False,
                "error": f"Redis authentication failed: {e}"
            }
        except redis.ConnectionError as e:
            return {
                "healthy": False,
                "error": f"Redis connection failed: {e}"
            }
        except redis.TimeoutError as e:
            return {
                "healthy": False,
                "error": f"Redis timeout: {e}"
            }
        except Exception as e:
            return {
                "healthy": False,
                "error": f"Redis health check failed: {e}"
            }

    def check(self, key: str, calls: int, period: int) -> dict:
        now = time.time()
        window_id = int(now / period)
        redis_key = f"rate_limit:{key}:{window_id}"

        # Atomic increment and expire using pipeline
        pipe = self.client.pipeline()
        pipe.incr(redis_key)
        pipe.expire(redis_key, period)
        val, _ = pipe.execute()

        remaining = calls - val
        if remaining < 0:
            retry_after = int(period - (now % period))
            if retry_after <= 0:
                retry_after = 1
            return {
                "allowed": False,
                "remaining": 0,
                "retry_after": retry_after,
            }

        return {
            "allowed": True,
            "remaining": remaining,
            "retry_after": 0,
        }

    def peek(self, key: str, calls: int, period: int) -> dict:
        """Check rate limit without incrementing the counter."""
        now = time.time()
        window_id = int(now / period)
        redis_key = f"rate_limit:{key}:{window_id}"

        # Get current value without incrementing
        val = self.client.get(redis_key)
        current_count = int(val) if val else 0

        remaining = calls - current_count
        if remaining <= 0:
            retry_after = int(period - (now % period))
            if retry_after <= 0:
                retry_after = 1
            return {
                "allowed": False,
                "remaining": 0,
                "retry_after": retry_after,
            }

        return {
            "allowed": True,
            "remaining": remaining,
            "retry_after": 0,
        }

    def get_attempt_count(self, key: str, period: int) -> int:
        """Get the current attempt count without incrementing."""
        now = time.time()
        window_id = int(now / period)
        redis_key = f"rate_limit:{key}:{window_id}"

        val = self.client.get(redis_key)
        return int(val) if val else 0

    def cleanup(self, period: int) -> int:
        # Redis expires keys automatically, cleanup is a no-op
        return 0

    def contains(self, key: str) -> bool:
        pattern = f"rate_limit:{key}:*"
        keys = self.client.keys(pattern)
        return len(keys) > 0

    def delete(self, key: str) -> None:
        pattern = f"rate_limit:{key}:*"
        keys = self.client.keys(pattern)
        if keys:
            self.client.delete(*keys)

    def clear(self) -> None:
        pattern = "rate_limit:*"
        keys = self.client.keys(pattern)
        if keys:
            self.client.delete(*keys)


class LimiterStorageProxy(dict):
    """A dictionary-compatible proxy that delegates queries to the active storage backend."""

    def __init__(self, limiter: "SimpleRateLimiter"):
        super().__init__()
        self._limiter = limiter

    def __contains__(self, key):
        if self._limiter._redis_backend:
            try:
                return self._limiter._redis_backend.contains(key)
            except Exception as e:
                logger.error(f"Redis contains check failed, falling back to local: {e}")
        return self._limiter._local_storage.contains(key)

    def __delitem__(self, key):
        if self._limiter._redis_backend:
            try:
                self._limiter._redis_backend.delete(key)
                return
            except Exception as e:
                logger.error(f"Redis delete failed, falling back to local: {e}")
        self._limiter._local_storage.delete(key)

    def __getitem__(self, key):
        if self._limiter._redis_backend:
            try:
                pattern = f"rate_limit:{key}:*"
                keys = self._limiter._redis_backend.client.keys(pattern)
                total_hits = 0
                for k in keys:
                    val = self._limiter._redis_backend.client.get(k)
                    if val:
                        total_hits += int(val)
                return [time.time()] * total_hits
            except Exception as e:
                logger.error(f"Redis getitem failed, falling back to local: {e}")
        with self._limiter._local_storage._lock:
            return self._limiter._local_storage.storage.get(key, [])

    def __setitem__(self, key, value):
        if self._limiter._redis_backend:
            try:
                now = time.time()
                window_id = int(now / self._limiter.period)
                redis_key = f"rate_limit:{key}:{window_id}"
                self._limiter._redis_backend.client.set(redis_key, len(value))
                self._limiter._redis_backend.client.expire(redis_key, self._limiter.period)
                return
            except Exception as e:
                logger.error(f"Redis setitem failed, falling back to local: {e}")
        with self._limiter._local_storage._lock:
            self._limiter._local_storage.storage[key] = value

    def clear(self):
        if self._limiter._redis_backend:
            try:
                self._limiter._redis_backend.clear()
                return
            except Exception as e:
                logger.error(f"Redis clear failed, falling back to local: {e}")
        self._limiter._local_storage.clear()

    def get(self, key, default=None):
        if key in self:
            return self[key]
        return default

    def items(self):
        if not self._limiter._redis_backend:
            with self._limiter._local_storage._lock:
                return list(self._limiter._local_storage.storage.items())
        try:
            keys = self._limiter._redis_backend.client.keys("rate_limit:*")
            unique_keys = set()
            for k in keys:
                parts = k.split(":")
                if len(parts) >= 3:
                    unique_keys.add(parts[1])
            return [(uk, self[uk]) for uk in unique_keys]
        except Exception as e:
            logger.error(f"Redis items failed, falling back to local: {e}")
            with self._limiter._local_storage._lock:
                return list(self._limiter._local_storage.storage.items())

    def __len__(self):
        if not self._limiter._redis_backend:
            with self._limiter._local_storage._lock:
                return len(self._limiter._local_storage.storage)
        try:
            return len(self.items())
        except Exception as e:
            logger.error(f"Redis len failed, falling back to local: {e}")
            with self._limiter._local_storage._lock:
                return len(self._limiter._local_storage.storage)


class SimpleRateLimiter:
    """Thread-safe and process-safe distributed rate limiter.

    This implementation uses a single backend (Redis or in-memory) consistently.
    Backend selection is controlled via RATE_LIMIT_BACKEND configuration.
    
    In production with Redis backend, failures are not silently tolerated -
    the application will fail fast to prevent security degradation.
    """

    def __init__(self, calls: int, period: int, backend: BaseStorage = None, backend_name: str = None):
        # Backward compatibility: if backend not provided, use in-memory storage
        if backend is None:
            backend = InMemoryStorage()
            backend_name = "memory"
        
        self.calls = calls
        self.period = period
        self._backend = backend
        self._backend_name = backend_name
        self._storage = LimiterStorageProxy(self)
        
        # Determine if using Redis for proxy compatibility
        self._redis_backend = backend if isinstance(backend, RedisStorage) else None
        self._using_redis = isinstance(backend, RedisStorage)
        
        # Initialize local storage for proxy compatibility
        # If using in-memory backend, use the same instance for _local_storage
        if not self._using_redis:
            self._local_storage = backend if isinstance(backend, InMemoryStorage) else InMemoryStorage()
        else:
            self._local_storage = None

    @property
    def storage(self) -> dict:
        """Expose limiter state for tests and diagnostics."""
        return self._storage

    def check(self, key: str) -> dict:
        try:
            return self._backend.check(key, self.calls, self.period)
        except Exception as e:
            logger.error(f"Rate limiter check failed: {e}")
            # In production with Redis, this is a critical failure
            settings = get_settings()
            if self._using_redis and settings.environment.environment == "production":
                logger.critical(
                    "Redis rate limiter check failed in production. "
                    "This may allow rate limit bypass. Check Redis connectivity."
                )
            raise

    def peek(self, key: str) -> dict:
        """Check rate limit without incrementing the counter."""
        try:
            return self._backend.peek(key, self.calls, self.period)
        except Exception as e:
            logger.error(f"Rate limiter peek failed: {e}")
            settings = get_settings()
            if self._using_redis and settings.environment.environment == "production":
                logger.critical(
                    "Redis rate limiter peek failed in production. "
                    "This may allow rate limit bypass. Check Redis connectivity."
                )
            raise

    def get_attempt_count(self, key: str) -> int:
        """Get the current attempt count without incrementing."""
        try:
            return self._backend.get_attempt_count(key, self.period)
        except Exception as e:
            logger.error(f"Rate limiter get_attempt_count failed: {e}")
            settings = get_settings()
            if self._using_redis and settings.environment.environment == "production":
                logger.critical(
                    "Redis rate limiter get_attempt_count failed in production. "
                    "This may allow rate limit bypass. Check Redis connectivity."
                )
            raise

    def is_allowed(self, key: str) -> bool:
        return self.check(key)["allowed"]

    def is_locked_out(self, key: str) -> bool:
        """Check if the key is currently locked out without incrementing."""
        return not self.peek(key)["allowed"]

    def cleanup(self) -> int:
        """Remove stale keys that have no timestamps in the current window.

        Returns the number of keys evicted.
        """
        try:
            return self._backend.cleanup(self.period)
        except Exception as e:
            logger.error(f"Rate limiter cleanup failed: {e}")
            settings = get_settings()
            if self._using_redis and settings.environment.environment == "production":
                logger.critical(
                    "Redis rate limiter cleanup failed in production. "
                    "Check Redis connectivity."
                )
            raise


def create_rate_limiter(calls: int, period: int) -> SimpleRateLimiter:
    """
    Factory function to create a rate limiter with appropriate backend.
    
    Backend selection is controlled by RATE_LIMIT_BACKEND configuration:
    - 'redis': Use Redis backend (fails if unavailable)
    - 'memory': Use in-memory backend (process-local only)
    - 'auto': Automatically choose Redis if available, otherwise memory
    
    In production, Redis is required when REQUIRE_REDIS_IN_PRODUCTION is enabled.
    
    Args:
        calls: Maximum number of calls allowed in the period
        period: Time period in seconds
        
    Returns:
        SimpleRateLimiter: Configured rate limiter instance
        
    Raises:
        RuntimeError: If Redis is required but unavailable
    """
    settings = get_settings()
    redis_url = settings.database.redis_url
    environment = settings.environment.environment
    rate_config = settings.rate_limit
    
    backend_preference = rate_config.rate_limit_backend
    
    # Determine which backend to use
    if backend_preference == "redis":
        # Explicitly require Redis
        if not redis_url:
            if environment == "production":
                logger.critical(
                    "RATE_LIMIT_BACKEND is set to 'redis' but REDIS_URL is not configured. "
                    "Refusing to start because Redis is required."
                )
                raise RuntimeError(
                    "Redis is required for rate limiting (RATE_LIMIT_BACKEND=redis) "
                    "but REDIS_URL is not configured. Set REDIS_URL or change RATE_LIMIT_BACKEND."
                )
            else:
                logger.warning(
                    "RATE_LIMIT_BACKEND is set to 'redis' but REDIS_URL is not configured. "
                    "Falling back to in-memory storage for development."
                )
                backend = InMemoryStorage()
                backend_name = "memory"
        else:
            # Try to initialize Redis
            try:
                backend = RedisStorage(redis_url)
                health_result = backend.health_check()
                if not health_result["healthy"]:
                    if rate_config.redis_fail_fast:
                        logger.critical(
                            f"Redis health check failed: {health_result['error']}. "
                            "Application cannot start without Redis."
                        )
                        raise RuntimeError(
                            f"Redis health check failed: {health_result['error']}. "
                            "Please verify REDIS_URL is correct and Redis is accessible."
                        )
                    else:
                        if environment == "production":
                            logger.critical(
                                f"Redis health check failed in production: {health_result['error']}. "
                                "Refusing to start without distributed rate limiting."
                            )
                            raise RuntimeError(
                                f"Redis health check failed in production: {health_result['error']}. "
                                "Distributed rate limiting is required in production."
                            )
                        else:
                            logger.warning(
                                f"Redis health check failed: {health_result['error']}. "
                                "Falling back to in-memory storage for development."
                            )
                            backend = InMemoryStorage()
                            backend_name = "memory"
                else:
                    backend_name = "redis"
                    logger.info(
                        f"Redis rate limiting backend initialized and healthy. "
                        f"Environment: {environment}"
                    )
            except Exception as e:
                if rate_config.redis_fail_fast:
                    logger.critical(
                        f"Redis initialization failed: {e}. "
                        "Application cannot start without Redis."
                    )
                    raise RuntimeError(
                        f"Redis initialization failed: {e}. "
                        "Please verify REDIS_URL is correct and Redis is accessible."
                    ) from e
                else:
                    if environment == "production":
                        logger.critical(
                            f"Redis initialization failed in production: {e}. "
                            "Refusing to start without distributed rate limiting."
                        )
                        raise RuntimeError(
                            f"Redis initialization failed in production: {e}. "
                            "Distributed rate limiting is required in production."
                        ) from e
                    else:
                        logger.warning(
                            f"Redis initialization failed: {e}. "
                            "Falling back to in-memory storage for development."
                        )
                        backend = InMemoryStorage()
                        backend_name = "memory"
    
    elif backend_preference == "memory":
        # Explicitly use in-memory
        backend = InMemoryStorage()
        backend_name = "memory"
        if environment == "production":
            logger.warning(
                "RATE_LIMIT_BACKEND is set to 'memory' in production. "
                "Rate limiting will be process-local only, which is unsafe for distributed deployments."
            )
        else:
            logger.info("Using in-memory rate limiting backend.")
    
    else:  # backend_preference == "auto"
        # Automatically choose backend
        if redis_url:
            try:
                backend = RedisStorage(redis_url)
                health_result = backend.health_check()
                if health_result["healthy"]:
                    backend_name = "redis"
                    logger.info(
                        f"Auto-selected Redis rate limiting backend. "
                        f"Environment: {environment}"
                    )
                else:
                    if environment == "production" and rate_config.require_redis_in_production:
                        logger.critical(
                            f"Redis health check failed in production: {health_result['error']}. "
                            "Refusing to start without distributed rate limiting."
                        )
                        raise RuntimeError(
                            f"Redis health check failed in production: {health_result['error']}. "
                            "Distributed rate limiting is required in production."
                        )
                    else:
                        logger.warning(
                            f"Redis health check failed: {health_result['error']}. "
                            "Falling back to in-memory storage."
                        )
                        backend = InMemoryStorage()
                        backend_name = "memory"
            except Exception as e:
                if environment == "production" and rate_config.require_redis_in_production:
                    logger.critical(
                        f"Redis initialization failed in production: {e}. "
                        "Refusing to start without distributed rate limiting."
                    )
                    raise RuntimeError(
                        f"Redis initialization failed in production: {e}. "
                        "Distributed rate limiting is required in production."
                    ) from e
                else:
                    logger.warning(
                        f"Redis initialization failed: {e}. "
                        "Falling back to in-memory storage."
                    )
                    backend = InMemoryStorage()
                    backend_name = "memory"
        else:
            # No Redis URL configured
            if environment == "production" and rate_config.require_redis_in_production:
                logger.critical(
                    "REQUIRE_REDIS_IN_PRODUCTION is enabled but REDIS_URL is not configured. "
                    "Refusing to start because distributed rate limiting is required."
                )
                raise RuntimeError(
                    "Redis is required for production rate limiting but is unavailable. "
                    "Set REDIS_URL or disable REQUIRE_REDIS_IN_PRODUCTION."
                )
            else:
                backend = InMemoryStorage()
                backend_name = "memory"
                if environment == "production":
                    logger.warning(
                        "REDIS_URL not configured in production. "
                        "Using in-memory rate limiting (process-local only). "
                        "This is unsafe for distributed deployments."
                    )
                else:
                    logger.info(
                        "REDIS_URL not configured. Using in-memory rate limiting. "
                        "This is appropriate for local development."
                    )
    
    # Log final backend selection
    if backend_name == "redis":
        logger.info("Rate limiter: Using Redis backend (distributed)")
    else:
        if environment == "production":
            logger.warning(
                "Rate limiter: Using in-memory backend (process-local only). "
                "This is unsafe for production deployments with multiple workers."
            )
        else:
            logger.info("Rate limiter: Using in-memory backend (process-local only)")
    
    return SimpleRateLimiter(calls, period, backend, backend_name)
