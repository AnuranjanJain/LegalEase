"""
Upload Task Storage Abstraction

Provides a shared persistent storage backend for upload task state,
enabling multi-worker deployments and horizontal scaling.

Supports Redis as the primary backend with automatic fallback to in-memory
storage for development environments.
"""

import json
import logging
import os
import time
from typing import Optional, Dict, Any
from abc import ABC, abstractmethod

import redis

from backend.config import get_settings

logger = logging.getLogger(__name__)


class UploadTaskStorageBackend(ABC):
    """Abstract base class for upload task storage backends."""

    @abstractmethod
    def create_task(
        self,
        task_id: str,
        status: str = "processing",
        progress: int = 0,
        result: Optional[Dict[str, Any]] = None,
        ttl_seconds: int = 3600
    ) -> bool:
        """Create a new upload task."""
        pass

    @abstractmethod
    def get_task(self, task_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve an upload task by ID."""
        pass

    @abstractmethod
    def update_progress(self, task_id: str, progress: int) -> bool:
        """Update task progress."""
        pass

    @abstractmethod
    def update_status(self, task_id: str, status: str) -> bool:
        """Update task status."""
        pass

    @abstractmethod
    def set_result(self, task_id: str, result: Dict[str, Any]) -> bool:
        """Set task result."""
        pass

    @abstractmethod
    def delete_task(self, task_id: str) -> bool:
        """Delete a task."""
        pass

    @abstractmethod
    def task_exists(self, task_id: str) -> bool:
        """Check if a task exists."""
        pass

    def mark_completed(self, task_id: str, result: Dict[str, Any]) -> bool:
        """Mark task as completed with result."""
        return (
            self.set_result(task_id, result) and
            self.update_status(task_id, "done") and
            self.update_progress(task_id, 100)
        )

    def mark_failed(self, task_id: str, error_message: str) -> bool:
        """Mark task as failed with error message."""
        return (
            self.set_result(task_id, {"error": error_message}) and
            self.update_status(task_id, "failed") and
            self.update_progress(task_id, 0)
        )


class InMemoryTaskStorage(UploadTaskStorageBackend):
    """In-memory storage backend for development/testing.

    WARNING: This backend is not suitable for production multi-worker deployments.
    Each worker process maintains its own independent state.
    """

    def __init__(self):
        self._storage: Dict[str, Dict[str, Any]] = {}
        self._ttls: Dict[str, float] = {}
        logger.warning(
            "Using in-memory upload task storage. "
            "This is NOT suitable for multi-worker deployments. "
            "Configure REDIS_URL for production."
        )

    def _cleanup_expired(self):
        """Remove expired tasks based on TTL."""
        now = time.time()
        expired = [tid for tid, expiry in self._ttls.items() if expiry < now]
        for tid in expired:
            self._storage.pop(tid, None)
            self._ttls.pop(tid, None)

    def create_task(
        self,
        task_id: str,
        status: str = "processing",
        progress: int = 0,
        result: Optional[Dict[str, Any]] = None,
        ttl_seconds: int = 3600
    ) -> bool:
        self._cleanup_expired()
        self._storage[task_id] = {
            "status": status,
            "progress": progress,
            "result": result,
        }
        self._ttls[task_id] = time.time() + ttl_seconds
        return True

    def get_task(self, task_id: str) -> Optional[Dict[str, Any]]:
        self._cleanup_expired()
        return self._storage.get(task_id)

    def update_progress(self, task_id: str, progress: int) -> bool:
        self._cleanup_expired()
        if task_id in self._storage:
            self._storage[task_id]["progress"] = progress
            return True
        return False

    def update_status(self, task_id: str, status: str) -> bool:
        self._cleanup_expired()
        if task_id in self._storage:
            self._storage[task_id]["status"] = status
            return True
        return False

    def set_result(self, task_id: str, result: Dict[str, Any]) -> bool:
        self._cleanup_expired()
        if task_id in self._storage:
            self._storage[task_id]["result"] = result
            return True
        return False

    def delete_task(self, task_id: str) -> bool:
        self._storage.pop(task_id, None)
        self._ttls.pop(task_id, None)
        return True

    def task_exists(self, task_id: str) -> bool:
        self._cleanup_expired()
        return task_id in self._storage

    def clear(self) -> None:
        """Clear all tasks (useful for testing)."""
        self._storage.clear()
        self._ttls.clear()


class RedisTaskStorage(UploadTaskStorageBackend):
    """Redis-based distributed storage backend for upload tasks.

    Provides process-safe, distributed task storage with automatic TTL-based cleanup.
    Suitable for multi-worker deployments and horizontal scaling.
    """

    def __init__(self, redis_url: str):
        self.redis_url = redis_url
        self.client = redis.from_url(redis_url, decode_responses=True)
        self._key_prefix = "upload_task:"
        self._test_connection()

    def _test_connection(self):
        """Test Redis connection on initialization."""
        try:
            self.client.ping()
            logger.info(
                f"Redis upload task storage initialized successfully. "
                f"Redis URL: {self.redis_url[:20]}..."
            )
        except Exception as e:
            logger.error(f"Redis connection test failed: {e}")
            raise

    def _make_key(self, task_id: str) -> str:
        """Generate Redis key for a task."""
        return f"{self._key_prefix}{task_id}"

    def create_task(
        self,
        task_id: str,
        status: str = "processing",
        progress: int = 0,
        result: Optional[Dict[str, Any]] = None,
        ttl_seconds: int = 3600
    ) -> bool:
        try:
            task_data = {
                "status": status,
                "progress": progress,
                "result": result,
            }
            key = self._make_key(task_id)
            self.client.setex(
                key,
                ttl_seconds,
                json.dumps(task_data)
            )
            return True
        except Exception as e:
            logger.error(f"Failed to create task {task_id} in Redis: {e}")
            return False

    def get_task(self, task_id: str) -> Optional[Dict[str, Any]]:
        try:
            key = self._make_key(task_id)
            data = self.client.get(key)
            if data:
                return json.loads(data)
            return None
        except Exception as e:
            logger.error(f"Failed to get task {task_id} from Redis: {e}")
            return None

    def update_progress(self, task_id: str, progress: int) -> bool:
        try:
            task = self.get_task(task_id)
            if task is None:
                return False
            task["progress"] = progress
            key = self._make_key(task_id)
            # Preserve existing TTL
            ttl = self.client.ttl(key)
            if ttl > 0:
                self.client.setex(key, ttl, json.dumps(task))
            else:
                self.client.set(key, json.dumps(task))
            return True
        except Exception as e:
            logger.error(f"Failed to update progress for task {task_id}: {e}")
            return False

    def update_status(self, task_id: str, status: str) -> bool:
        try:
            task = self.get_task(task_id)
            if task is None:
                return False
            task["status"] = status
            key = self._make_key(task_id)
            # Preserve existing TTL
            ttl = self.client.ttl(key)
            if ttl > 0:
                self.client.setex(key, ttl, json.dumps(task))
            else:
                self.client.set(key, json.dumps(task))
            return True
        except Exception as e:
            logger.error(f"Failed to update status for task {task_id}: {e}")
            return False

    def set_result(self, task_id: str, result: Dict[str, Any]) -> bool:
        try:
            task = self.get_task(task_id)
            if task is None:
                return False
            task["result"] = result
            key = self._make_key(task_id)
            # Preserve existing TTL
            ttl = self.client.ttl(key)
            if ttl > 0:
                self.client.setex(key, ttl, json.dumps(task))
            else:
                self.client.set(key, json.dumps(task))
            return True
        except Exception as e:
            logger.error(f"Failed to set result for task {task_id}: {e}")
            return False

    def delete_task(self, task_id: str) -> bool:
        try:
            key = self._make_key(task_id)
            self.client.delete(key)
            return True
        except Exception as e:
            logger.error(f"Failed to delete task {task_id}: {e}")
            return False

    def task_exists(self, task_id: str) -> bool:
        try:
            key = self._make_key(task_id)
            return self.client.exists(key) > 0
        except Exception as e:
            logger.error(f"Failed to check existence of task {task_id}: {e}")
            return False

    def clear(self) -> None:
        """Clear all upload tasks (useful for testing)."""
        try:
            pattern = f"{self._key_prefix}*"
            keys = self.client.keys(pattern)
            if keys:
                self.client.delete(*keys)
        except Exception as e:
            logger.error(f"Failed to clear upload tasks: {e}")


class UploadTaskStorage:
    """Upload task storage manager with automatic backend selection.

    Automatically selects Redis backend if REDIS_URL is configured,
    otherwise falls back to in-memory storage for development.

    Provides graceful degradation and retry-safe operations.
    """

    def __init__(self, default_ttl_seconds: int = 3600):
        self.default_ttl_seconds = default_ttl_seconds
        self._backend = self._initialize_backend()
        self._using_redis = isinstance(self._backend, RedisTaskStorage)

    def _initialize_backend(self) -> UploadTaskStorageBackend:
        """Initialize the appropriate storage backend."""
        # Avoid loading the full settings tree here because unrelated
        # production-only validators (for example document encryption) can
        # fail when upload task storage itself only needs Redis and env mode.
        redis_url = os.getenv("REDIS_URL")
        environment = os.getenv("ENVIRONMENT", "production").lower()

        if redis_url:
            try:
                backend = RedisTaskStorage(redis_url)
                logger.info(
                    f"Upload task storage: Using Redis backend (distributed). "
                    f"Environment: {environment}"
                )
                return backend
            except Exception as e:
                logger.error(
                    f"Failed to initialize Redis upload task storage: {e}. "
                    f"Falling back to in-memory storage. "
                    f"Upload task state will be process-local only."
                )
                logger.warning(
                    "Multi-worker deployments will have inconsistent task state. "
                    "Configure REDIS_URL for distributed task storage."
                )
        else:
            if environment == "production":
                logger.warning(
                    "REDIS_URL not configured in production environment. "
                    "Upload task storage will use in-memory backend, which is not "
                    "suitable for multi-worker deployments. "
                    "Multiple workers will have independent task state."
                )
            else:
                logger.info(
                    f"REDIS_URL not configured. Using in-memory upload task storage. "
                    f"Environment: {environment}. This is appropriate for local development."
                )

        return InMemoryTaskStorage()

    def create_task(
        self,
        task_id: str,
        status: str = "processing",
        progress: int = 0,
        result: Optional[Dict[str, Any]] = None,
        ttl_seconds: Optional[int] = None
    ) -> bool:
        """Create a new upload task."""
        ttl = ttl_seconds or self.default_ttl_seconds
        return self._backend.create_task(task_id, status, progress, result, ttl)

    def get_task(self, task_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve an upload task by ID."""
        return self._backend.get_task(task_id)

    def update_progress(self, task_id: str, progress: int) -> bool:
        """Update task progress."""
        return self._backend.update_progress(task_id, progress)

    def update_status(self, task_id: str, status: str) -> bool:
        """Update task status."""
        return self._backend.update_status(task_id, status)

    def mark_completed(self, task_id: str, result: Dict[str, Any]) -> bool:
        """Mark task as completed with result."""
        return (
            self._backend.set_result(task_id, result) and
            self._backend.update_status(task_id, "done") and
            self._backend.update_progress(task_id, 100)
        )

    def mark_failed(self, task_id: str, error_message: str) -> bool:
        """Mark task as failed with error message."""
        return (
            self._backend.set_result(task_id, {"error": error_message}) and
            self._backend.update_status(task_id, "failed") and
            self._backend.update_progress(task_id, 0)
        )

    def delete_task(self, task_id: str) -> bool:
        """Delete a task."""
        return self._backend.delete_task(task_id)

    def task_exists(self, task_id: str) -> bool:
        """Check if a task exists."""
        return self._backend.task_exists(task_id)

    def clear(self) -> None:
        """Clear all tasks (useful for testing)."""
        self._backend.clear()

    @property
    def using_redis(self) -> bool:
        """Check if using Redis backend."""
        return self._using_redis

    @property
    def backend(self) -> UploadTaskStorageBackend:
        """Access the underlying backend (useful for testing)."""
        return self._backend


# Global storage instance
_upload_task_storage: Optional[UploadTaskStorage] = None


def get_upload_task_storage() -> UploadTaskStorage:
    """Get the global upload task storage instance."""
    global _upload_task_storage
    if _upload_task_storage is None:
        _upload_task_storage = UploadTaskStorage()
    return _upload_task_storage


def reset_upload_task_storage() -> None:
    """Reset the global storage instance (useful for testing)."""
    global _upload_task_storage
    _upload_task_storage = None
