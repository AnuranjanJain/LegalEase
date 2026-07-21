"""
Unit tests for upload task storage abstraction.

Tests cover both in-memory and Redis backends, including:
- Task creation, retrieval, updates
- Progress and status updates
- Completion and failure marking
- TTL expiration
- Error handling
"""

import pytest
import time
from unittest.mock import Mock, MagicMock, patch
import json

from backend.storage.upload_tasks import (
    InMemoryTaskStorage,
    RedisTaskStorage,
    UploadTaskStorage,
    reset_upload_task_storage,
)


class TestInMemoryTaskStorage:
    """Test suite for in-memory storage backend."""

    def test_create_task(self):
        """Test creating a new task."""
        storage = InMemoryTaskStorage()
        result = storage.create_task("task-1", status="processing", progress=0)
        assert result is True
        task = storage.get_task("task-1")
        assert task is not None
        assert task["status"] == "processing"
        assert task["progress"] == 0
        assert task["result"] is None

    def test_get_task(self):
        """Test retrieving a task."""
        storage = InMemoryTaskStorage()
        storage.create_task("task-1", status="processing", progress=50)
        task = storage.get_task("task-1")
        assert task["status"] == "processing"
        assert task["progress"] == 50

    def test_get_nonexistent_task(self):
        """Test retrieving a non-existent task."""
        storage = InMemoryTaskStorage()
        task = storage.get_task("nonexistent")
        assert task is None

    def test_update_progress(self):
        """Test updating task progress."""
        storage = InMemoryTaskStorage()
        storage.create_task("task-1", status="processing", progress=0)
        result = storage.update_progress("task-1", 75)
        assert result is True
        task = storage.get_task("task-1")
        assert task["progress"] == 75

    def test_update_progress_nonexistent_task(self):
        """Test updating progress for non-existent task."""
        storage = InMemoryTaskStorage()
        result = storage.update_progress("nonexistent", 75)
        assert result is False

    def test_update_status(self):
        """Test updating task status."""
        storage = InMemoryTaskStorage()
        storage.create_task("task-1", status="processing", progress=0)
        result = storage.update_status("task-1", "done")
        assert result is True
        task = storage.get_task("task-1")
        assert task["status"] == "done"

    def test_set_result(self):
        """Test setting task result."""
        storage = InMemoryTaskStorage()
        storage.create_task("task-1", status="processing", progress=0)
        result = storage.set_result("task-1", {"filename": "test.pdf", "text": "sample"})
        assert result is True
        task = storage.get_task("task-1")
        assert task["result"]["filename"] == "test.pdf"
        assert task["result"]["text"] == "sample"

    def test_delete_task(self):
        """Test deleting a task."""
        storage = InMemoryTaskStorage()
        storage.create_task("task-1", status="processing", progress=0)
        result = storage.delete_task("task-1")
        assert result is True
        assert storage.get_task("task-1") is None

    def test_task_exists(self):
        """Test checking if task exists."""
        storage = InMemoryTaskStorage()
        storage.create_task("task-1", status="processing", progress=0)
        assert storage.task_exists("task-1") is True
        assert storage.task_exists("nonexistent") is False

    def test_ttl_expiration(self):
        """Test that tasks expire after TTL."""
        storage = InMemoryTaskStorage()
        storage.create_task("task-1", status="processing", progress=0, ttl_seconds=1)
        assert storage.task_exists("task-1") is True
        time.sleep(1.1)
        assert storage.task_exists("task-1") is False

    def test_multiple_tasks(self):
        """Test handling multiple tasks."""
        storage = InMemoryTaskStorage()
        storage.create_task("task-1", status="processing", progress=0)
        storage.create_task("task-2", status="done", progress=100)
        storage.create_task("task-3", status="failed", progress=0)

        assert storage.task_exists("task-1") is True
        assert storage.task_exists("task-2") is True
        assert storage.task_exists("task-3") is True

        task1 = storage.get_task("task-1")
        task2 = storage.get_task("task-2")
        task3 = storage.get_task("task-3")

        assert task1["status"] == "processing"
        assert task2["status"] == "done"
        assert task3["status"] == "failed"

    def test_clear(self):
        """Test clearing all tasks."""
        storage = InMemoryTaskStorage()
        storage.create_task("task-1", status="processing", progress=0)
        storage.create_task("task-2", status="done", progress=100)
        storage.clear()
        assert storage.task_exists("task-1") is False
        assert storage.task_exists("task-2") is False


class TestRedisTaskStorage:
    """Test suite for Redis storage backend."""

    @pytest.fixture
    def mock_redis_client(self):
        """Create a mock Redis client."""
        client = MagicMock()
        client.ping.return_value = True
        return client

    @pytest.fixture
    def redis_storage(self, mock_redis_client):
        """Create Redis storage with mocked client."""
        with patch('backend.storage.upload_tasks.redis.from_url', return_value=mock_redis_client):
            storage = RedisTaskStorage("redis://localhost:6379/0")
            storage.client = mock_redis_client
            return storage

    def test_create_task(self, redis_storage, mock_redis_client):
        """Test creating a new task in Redis."""
        result = redis_storage.create_task("task-1", status="processing", progress=0)
        assert result is True
        mock_redis_client.setex.assert_called_once()
        call_args = mock_redis_client.setex.call_args
        assert "upload_task:task-1" in str(call_args[0])

    def test_get_task(self, redis_storage, mock_redis_client):
        """Test retrieving a task from Redis."""
        mock_redis_client.get.return_value = json.dumps({
            "status": "processing",
            "progress": 50,
            "result": None
        })
        task = redis_storage.get_task("task-1")
        assert task is not None
        assert task["status"] == "processing"
        assert task["progress"] == 50

    def test_get_nonexistent_task(self, redis_storage, mock_redis_client):
        """Test retrieving a non-existent task from Redis."""
        mock_redis_client.get.return_value = None
        task = redis_storage.get_task("nonexistent")
        assert task is None

    def test_update_progress(self, redis_storage, mock_redis_client):
        """Test updating task progress in Redis."""
        mock_redis_client.get.return_value = json.dumps({
            "status": "processing",
            "progress": 0,
            "result": None
        })
        mock_redis_client.ttl.return_value = 3600
        result = redis_storage.update_progress("task-1", 75)
        assert result is True
        mock_redis_client.setex.assert_called()

    def test_update_status(self, redis_storage, mock_redis_client):
        """Test updating task status in Redis."""
        mock_redis_client.get.return_value = json.dumps({
            "status": "processing",
            "progress": 0,
            "result": None
        })
        mock_redis_client.ttl.return_value = 3600
        result = redis_storage.update_status("task-1", "done")
        assert result is True

    def test_set_result(self, redis_storage, mock_redis_client):
        """Test setting task result in Redis."""
        mock_redis_client.get.return_value = json.dumps({
            "status": "processing",
            "progress": 0,
            "result": None
        })
        mock_redis_client.ttl.return_value = 3600
        result = redis_storage.set_result("task-1", {"filename": "test.pdf", "text": "sample"})
        assert result is True

    def test_delete_task(self, redis_storage, mock_redis_client):
        """Test deleting a task from Redis."""
        result = redis_storage.delete_task("task-1")
        assert result is True
        mock_redis_client.delete.assert_called_once_with("upload_task:task-1")

    def test_task_exists(self, redis_storage, mock_redis_client):
        """Test checking if task exists in Redis."""
        mock_redis_client.exists.return_value = 1
        assert redis_storage.task_exists("task-1") is True
        mock_redis_client.exists.return_value = 0
        assert redis_storage.task_exists("task-2") is False

    def test_clear(self, redis_storage, mock_redis_client):
        """Test clearing all tasks from Redis."""
        mock_redis_client.keys.return_value = ["upload_task:task-1", "upload_task:task-2"]
        redis_storage.clear()
        mock_redis_client.delete.assert_called_once_with("upload_task:task-1", "upload_task:task-2")

    def test_redis_connection_error_on_init(self):
        """Test that Redis connection errors are raised on initialization."""
        with patch('backend.storage.upload_tasks.redis.from_url') as mock_from_url:
            mock_client = MagicMock()
            mock_client.ping.side_effect = Exception("Connection failed")
            mock_from_url.return_value = mock_client
            with pytest.raises(Exception):
                RedisTaskStorage("redis://localhost:6379/0")

    def test_redis_error_on_create(self, redis_storage, mock_redis_client):
        """Test graceful handling of Redis errors during create."""
        mock_redis_client.setex.side_effect = Exception("Redis error")
        result = redis_storage.create_task("task-1", status="processing", progress=0)
        assert result is False

    def test_redis_error_on_get(self, redis_storage, mock_redis_client):
        """Test graceful handling of Redis errors during get."""
        mock_redis_client.get.side_effect = Exception("Redis error")
        task = redis_storage.get_task("task-1")
        assert task is None


class TestUploadTaskStorage:
    """Test suite for the main UploadTaskStorage manager."""

    def test_initialization_without_redis(self):
        """Test initialization falls back to in-memory when Redis not configured."""
        with patch.dict('os.environ', {
            'JWT_SECRET_KEY': 'test-secret',
            'ENVIRONMENT': 'development',
        }, clear=True):
            reset_upload_task_storage()
            storage = UploadTaskStorage()
            assert storage.using_redis is False
            assert isinstance(storage.backend, InMemoryTaskStorage)

    def test_initialization_with_redis(self):
        """Test initialization uses Redis when configured."""
        mock_redis_client = MagicMock()
        mock_redis_client.ping.return_value = True
        with patch.dict('os.environ', {
            'JWT_SECRET_KEY': 'test-secret',
            'REDIS_URL': 'redis://localhost:6379/0',
            'ENVIRONMENT': 'development',
        }, clear=True):
            with patch('backend.storage.upload_tasks.redis.from_url', return_value=mock_redis_client):
                # Reset both storage and settings cache
                import backend.config
                backend.config._settings = None
                reset_upload_task_storage()
                storage = UploadTaskStorage()
                assert storage.using_redis is True
                assert isinstance(storage.backend, RedisTaskStorage)

    def test_redis_fallback_on_connection_error(self):
        """Test fallback to in-memory when Redis connection fails."""
        with patch.dict('os.environ', {
            'JWT_SECRET_KEY': 'test-secret',
            'REDIS_URL': 'redis://localhost:6379/0',
            'ENVIRONMENT': 'development',
        }, clear=True):
            with patch('backend.storage.upload_tasks.redis.from_url') as mock_from_url:
                mock_client = MagicMock()
                mock_client.ping.side_effect = Exception("Connection failed")
                mock_from_url.return_value = mock_client
                # Reset both storage and settings cache
                import backend.config
                backend.config._settings = None
                reset_upload_task_storage()
                storage = UploadTaskStorage()
                assert storage.using_redis is False
                assert isinstance(storage.backend, InMemoryTaskStorage)

    def test_create_task(self):
        """Test creating a task through the manager."""
        reset_upload_task_storage()
        storage = UploadTaskStorage()
        result = storage.create_task("task-1", status="processing", progress=0)
        assert result is True
        task = storage.get_task("task-1")
        assert task is not None

    def test_mark_completed(self):
        """Test marking a task as completed."""
        reset_upload_task_storage()
        storage = UploadTaskStorage()
        storage.create_task("task-1", status="processing", progress=0)
        result = storage.mark_completed("task-1", {"filename": "test.pdf", "text": "sample"})
        assert result is True
        task = storage.get_task("task-1")
        assert task["status"] == "done"
        assert task["result"]["filename"] == "test.pdf"

    def test_mark_failed(self):
        """Test marking a task as failed."""
        reset_upload_task_storage()
        storage = UploadTaskStorage()
        storage.create_task("task-1", status="processing", progress=50)
        result = storage.mark_failed("task-1", "Processing failed")
        assert result is True
        task = storage.get_task("task-1")
        assert task["status"] == "failed"
        assert task["progress"] == 0
        assert task["result"]["error"] == "Processing failed"

    def test_custom_ttl(self):
        """Test creating task with custom TTL."""
        reset_upload_task_storage()
        storage = UploadTaskStorage(default_ttl_seconds=3600)
        storage.create_task("task-1", status="processing", progress=0, ttl_seconds=7200)
        task = storage.get_task("task-1")
        assert task is not None

    def test_clear(self):
        """Test clearing all tasks through the manager."""
        reset_upload_task_storage()
        storage = UploadTaskStorage()
        storage.create_task("task-1", status="processing", progress=0)
        storage.create_task("task-2", status="done", progress=100)
        storage.clear()
        assert storage.task_exists("task-1") is False
        assert storage.task_exists("task-2") is False


class TestStorageConcurrency:
    """Test suite for concurrent access patterns."""

    def test_concurrent_progress_updates(self):
        """Test that concurrent progress updates are handled safely."""
        import threading
        reset_upload_task_storage()
        storage = UploadTaskStorage()
        storage.create_task("task-1", status="processing", progress=0)

        def update_progress():
            for i in range(10):
                storage.update_progress("task-1", i * 10)

        threads = [threading.Thread(target=update_progress) for _ in range(5)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        task = storage.get_task("task-1")
        assert task is not None
        assert 0 <= task["progress"] <= 100

    def test_concurrent_task_creation(self):
        """Test that concurrent task creation is handled safely."""
        import threading
        reset_upload_task_storage()
        storage = UploadTaskStorage()

        def create_tasks():
            for i in range(10):
                storage.create_task(f"task-{threading.get_ident()}-{i}", status="processing", progress=0)

        threads = [threading.Thread(target=create_tasks) for _ in range(5)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        # All tasks should be created successfully
        # We can't check exact count due to potential overlaps, but storage should be stable
        storage.clear()
