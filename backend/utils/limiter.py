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

    This implementation defaults to an in-memory sliding-window backend, but
    automatically uses a Redis backend if REDIS_URL environment variable is set.
    
    In production environments, provides warnings and optional fail-fast behavior
    when Redis is unavailable to prevent inconsistent rate limiting across distributed deployments.
    """

    def __init__(self, calls: int, period: int):
        self.calls = calls
        self.period = period
        self._local_storage = InMemoryStorage()
        self._storage = LimiterStorageProxy(self)

        settings = get_settings()
        redis_url = settings.database.redis_url
        environment = settings.environment.environment
        rate_config = settings.rate_limit
        
        self._redis_backend = None
        self._using_redis = False
        
        if redis_url:
            try:
                self._redis_backend = RedisStorage(redis_url)
                self._using_redis = True
                logger.info(
                    f"Redis rate limiting storage backend initialized successfully. "
                    f"Environment: {environment}, Redis URL: {redis_url[:20]}..."
                )
            except Exception as e:
                if rate_config.redis_fail_fast:
                    logger.error(
                        f"REDIS_FAIL_FAST is enabled but Redis initialization failed: {e}. "
                        f"Application cannot start without Redis. Please check REDIS_URL configuration."
                    )
                    raise RuntimeError(
                        f"Redis initialization failed with REDIS_FAIL_FAST enabled: {e}. "
                        f"Please verify REDIS_URL is correct and Redis is accessible."
                    ) from e
                else:
                    logger.error(
                        f"Failed to initialize Redis rate limiting backend: {e}. "
                        f"Falling back to in-memory storage. Rate limiting will be process-local only."
                    )
        else:
            # Redis URL not configured
            if environment == "production" and rate_config.require_redis_in_production:
                logger.error(
                    "REQUIRE_REDIS_IN_PRODUCTION is enabled but REDIS_URL is not configured. "
                    "Rate limiting will use in-memory storage, which is not suitable for distributed deployments. "
                    "Set REDIS_URL or disable REQUIRE_REDIS_IN_PRODUCTION."
                )
            elif environment == "production":
                logger.warning(
                    "REDIS_URL is not configured in production environment. "
                    "Rate limiting will use in-memory storage, which is not suitable for distributed deployments. "
                    "Multiple workers or application instances will have independent rate limiters. "
                    "Consider setting REDIS_URL for distributed rate limiting."
                )
            else:
                logger.info(
                    f"REDIS_URL not configured. Using in-memory rate limiting storage. "
                    f"Environment: {environment}. This is appropriate for local development."
                )
        
        # Log final backend selection
        if self._using_redis:
            logger.info("Rate limiter: Using Redis backend (distributed)")
        else:
            logger.warning("Rate limiter: Using in-memory backend (process-local only)")

    @property
    def storage(self) -> dict:
        """Expose limiter state for tests and diagnostics."""
        return self._storage

    def check(self, key: str) -> dict:
        if self._redis_backend:
            try:
                return self._redis_backend.check(key, self.calls, self.period)
            except Exception as e:
                logger.error(f"Redis rate limiter check failed, falling back to local storage: {e}")
                return self._local_storage.check(key, self.calls, self.period)

        return self._local_storage.check(key, self.calls, self.period)

    def is_allowed(self, key: str) -> bool:
        return self.check(key)["allowed"]

    def cleanup(self) -> int:
        """Remove stale keys that have no timestamps in the current window.

        Returns the number of keys evicted.
        """
        if self._redis_backend:
            try:
                return self._redis_backend.cleanup(self.period)
            except Exception as e:
                logger.error(f"Redis cleanup failed, falling back to local storage: {e}")
                return self._local_storage.cleanup(self.period)

        return self._local_storage.cleanup(self.period)
