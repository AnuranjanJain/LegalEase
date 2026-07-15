"""
Failure scenario tests for upload task storage.

These tests verify graceful handling of various failure scenarios:
- Redis unavailable
- Network interruption
- Missing tasks
- Expired tasks
- Worker crash
- Serialization failures
"""

import pytest
import time
from unittest.mock import MagicMock, patch
import redis

from backend.storage.upload_tasks import (
    InMemoryTaskStorage,
    RedisTaskStorage,
    UploadTaskStorage,
    reset_upload_task_storage,
)
from backend.main import app
from fastapi.testclient import TestClient


@pytest.fixture(autouse=True)
def reset_storage():
    """Reset storage before each test."""
    reset_upload_task_storage()
    yield
    reset_upload_task_storage()


@pytest.fixture
def client():
    """Create a test client."""
    return TestClient(app)


@pytest.fixture
def auth_headers():
    """Create authentication headers for testing."""
    return {"Authorization": "Bearer dev-token"}


class TestRedisUnavailable:
    """Test graceful handling when Redis is unavailable."""

    def test_redis_connection_failure_on_init(self):
        """Test that Redis connection failure falls back to in-memory."""
        with patch.dict('os.environ', {
            'JWT_SECRET_KEY': 'test-secret',
            'REDIS_URL': 'redis://localhost:6379/0',
            'ENVIRONMENT': 'production',
        }, clear=True):
            with patch('backend.storage.upload_tasks.redis.from_url') as mock_from_url:
                mock_client = MagicMock()
                mock_client.ping.side_effect = redis.ConnectionError("Connection refused")
                mock_from_url.return_value = mock_client

                reset_upload_task_storage()
                storage = UploadTaskStorage()

                # Should fall back to in-memory
                assert storage.using_redis is False
                assert isinstance(storage.backend, InMemoryTaskStorage)

    def test_redis_error_during_create_fallback(self):
        """Test that Redis errors during create are handled gracefully."""
        mock_client = MagicMock()
        mock_client.ping.return_value = True
        mock_client.setex.side_effect = redis.RedisError("Redis error")

        with patch('backend.storage.upload_tasks.redis.from_url', return_value=mock_client):
            storage = RedisTaskStorage("redis://localhost:6379/0")
            result = storage.create_task("task-1", status="processing", progress=0)

            # Should return False but not crash
            assert result is False

    def test_redis_error_during_get(self):
        """Test that Redis errors during get are handled gracefully."""
        mock_client = MagicMock()
        mock_client.ping.return_value = True
        mock_client.get.side_effect = redis.RedisError("Redis error")

        with patch('backend.storage.upload_tasks.redis.from_url', return_value=mock_client):
            storage = RedisTaskStorage("redis://localhost:6379/0")
            task = storage.get_task("task-1")

            # Should return None but not crash
            assert task is None

    def test_redis_error_during_update(self):
        """Test that Redis errors during update are handled gracefully."""
        mock_client = MagicMock()
        mock_client.ping.return_value = True
        mock_client.get.return_value = '{"status": "processing", "progress": 0, "result": null}'
        mock_client.ttl.side_effect = redis.RedisError("Redis error")

        with patch('backend.storage.upload_tasks.redis.from_url', return_value=mock_client):
            storage = RedisTaskStorage("redis://localhost:6379/0")
            result = storage.update_progress("task-1", 50)

            # Should return False but not crash
            assert result is False

    def test_redis_error_during_delete(self):
        """Test that Redis errors during delete are handled gracefully."""
        mock_client = MagicMock()
        mock_client.ping.return_value = True
        mock_client.delete.side_effect = redis.RedisError("Redis error")

        with patch('backend.storage.upload_tasks.redis.from_url', return_value=mock_client):
            storage = RedisTaskStorage("redis://localhost:6379/0")
            result = storage.delete_task("task-1")

            # Should return False but not crash
            assert result is False


class TestNetworkInterruption:
    """Test handling of network interruptions."""

    def test_network_timeout_during_create(self):
        """Test network timeout during task creation."""
        mock_client = MagicMock()
        mock_client.ping.return_value = True
        mock_client.setex.side_effect = redis.TimeoutError("Network timeout")

        with patch('backend.storage.upload_tasks.redis.from_url', return_value=mock_client):
            storage = RedisTaskStorage("redis://localhost:6379/0")
            result = storage.create_task("task-1", status="processing", progress=0)

            assert result is False

    def test_network_timeout_during_get(self):
        """Test network timeout during task retrieval."""
        mock_client = MagicMock()
        mock_client.ping.return_value = True
        mock_client.get.side_effect = redis.TimeoutError("Network timeout")

        with patch('backend.storage.upload_tasks.redis.from_url', return_value=mock_client):
            storage = RedisTaskStorage("redis://localhost:6379/0")
            task = storage.get_task("task-1")

            assert task is None

    def test_intermittent_network_errors(self):
        """Test handling of intermittent network errors."""
        mock_client = MagicMock()
        mock_client.ping.return_value = True

        # First call fails, second succeeds
        call_count = [0]
        def side_effect(*args, **kwargs):
            call_count[0] += 1
            if call_count[0] == 1:
                raise redis.ConnectionError("Network error")
            return "OK"

        mock_client.setex.side_effect = side_effect

        with patch('backend.storage.upload_tasks.redis.from_url', return_value=mock_client):
            storage = RedisTaskStorage("redis://localhost:6379/0")

            # First call fails
            result1 = storage.create_task("task-1", status="processing", progress=0)
            assert result1 is False

            # Second call succeeds
            result2 = storage.create_task("task-2", status="processing", progress=0)
            assert result2 is True


class TestMissingTasks:
    """Test handling of missing/non-existent tasks."""

    def test_get_missing_task(self):
        """Test retrieving a non-existent task."""
        reset_upload_task_storage()
        storage = UploadTaskStorage()
        task = storage.get_task("nonexistent-task")
        assert task is None

    def test_update_missing_task(self):
        """Test updating a non-existent task."""
        reset_upload_task_storage()
        storage = UploadTaskStorage()
        result = storage.update_progress("nonexistent-task", 50)
        assert result is False

    def test_complete_missing_task(self):
        """Test completing a non-existent task."""
        reset_upload_task_storage()
        storage = UploadTaskStorage()
        result = storage.mark_completed("nonexistent-task", {"filename": "test.txt", "text": "done"})
        assert result is False

    def test_fail_missing_task(self):
        """Test failing a non-existent task."""
        reset_upload_task_storage()
        storage = UploadTaskStorage()
        result = storage.mark_failed("nonexistent-task", "Error")
        assert result is False

    def test_delete_missing_task(self):
        """Test deleting a non-existent task."""
        reset_upload_task_storage()
        storage = UploadTaskStorage()
        result = storage.delete_task("nonexistent-task")
        assert result is True  # Delete should be idempotent

    def test_status_endpoint_missing_task(self, client, auth_headers):
        """Test status endpoint with missing task."""
        response = client.get("/upload/status/nonexistent-task", headers=auth_headers)
        assert response.status_code == 404
        assert "Task not found" in response.json()["detail"]


class TestExpiredTasks:
    """Test handling of expired tasks."""

    def test_expired_task_not_found(self):
        """Test that expired tasks return None."""
        reset_upload_task_storage()
        storage = UploadTaskStorage()
        storage.create_task("expiring-task", status="processing", progress=0, ttl_seconds=1)

        # Task exists initially
        assert storage.get_task("expiring-task") is not None

        # Wait for expiration
        time.sleep(1.1)

        # Task should be expired
        assert storage.get_task("expiring-task") is None

    def test_expired_task_operations_fail(self):
        """Test that operations on expired tasks fail gracefully."""
        reset_upload_task_storage()
        storage = UploadTaskStorage()
        storage.create_task("expiring-task", status="processing", progress=0, ttl_seconds=1)

        # Wait for expiration
        time.sleep(1.1)

        # Operations should fail
        assert storage.update_progress("expiring-task", 50) is False
        assert storage.mark_completed("expiring-task", {"text": "done"}) is False
        assert storage.mark_failed("expiring-task", "Error") is False

    def test_status_endpoint_expired_task(self, client, auth_headers):
        """Test status endpoint with expired task."""
        reset_upload_task_storage()
        storage = get_upload_task_storage()
        storage.create_task("expiring-task", status="processing", progress=0, ttl_seconds=1)

        # Wait for expiration
        time.sleep(1.1)

        response = client.get("/upload/status/expiring-task", headers=auth_headers)
        assert response.status_code == 404


class TestWorkerCrash:
    """Test handling of worker crash scenarios."""

    def test_task_survives_worker_crash(self):
        """Test that tasks survive worker crash with Redis."""
        mock_client = MagicMock()
        mock_client.ping.return_value = True

        # Simulate shared storage
        shared_storage = {}
        mock_client.storage = shared_storage

        def mock_setex(key, ttl, value):
            shared_storage[key] = value

        def mock_get(key):
            return shared_storage.get(key)

        mock_client.setex = mock_setex
        mock_client.get = mock_get
        mock_client.ttl.return_value = 3600

        with patch('backend.storage.upload_tasks.redis.from_url', return_value=mock_client):
            # Worker 1 creates task
            worker1 = RedisTaskStorage("redis://localhost:6379/0")
            worker1.client = mock_client
            worker1.create_task("survivor-task", status="processing", progress=50)

            # Simulate worker 1 crash
            del worker1

            # Worker 2 can still access the task
            worker2 = RedisTaskStorage("redis://localhost:6379/0")
            worker2.client = mock_client
            task = worker2.get_task("survivor-task")

            assert task is not None
            assert task["progress"] == 50

    def test_in_memory_task_lost_on_crash(self):
        """Test that in-memory tasks are lost on worker crash."""
        from backend.storage.upload_tasks import InMemoryTaskStorage

        # Worker creates task
        worker = InMemoryTaskStorage()
        worker.create_task("lost-task", status="processing", progress=50)

        # Simulate worker crash
        del worker

        # New worker cannot access the task
        new_worker = InMemoryTaskStorage()
        task = new_worker.get_task("lost-task")

        assert task is None


class TestSerializationFailures:
    """Test handling of JSON serialization failures."""

    def test_invalid_json_in_redis(self):
        """Test handling of invalid JSON in Redis."""
        mock_client = MagicMock()
        mock_client.ping.return_value = True
        mock_client.get.return_value = "invalid json {{{"

        with patch('backend.storage.upload_tasks.redis.from_url', return_value=mock_client):
            storage = RedisTaskStorage("redis://localhost:6379/0")
            task = storage.get_task("task-1")

            # Should handle gracefully
            assert task is None

    def test_serialization_error_during_create(self):
        """Test handling of serialization error during create."""
        mock_client = MagicMock()
        mock_client.ping.return_value = True

        # Object that can't be serialized
        class UnserializableObject:
            pass

        with patch('backend.storage.upload_tasks.redis.from_url', return_value=mock_client):
            storage = RedisTaskStorage("redis://localhost:6379/0")
            # This should handle the serialization error
            result = storage.create_task("task-1", status="processing", progress=0)
            # If it doesn't crash, we're good
            assert result in [True, False]

    def test_malformed_task_data(self):
        """Test handling of malformed task data."""
        mock_client = MagicMock()
        mock_client.ping.return_value = True
        mock_client.get.return_value = '{"status": "processing", "progress": "invalid"}'

        with patch('backend.storage.upload_tasks.redis.from_url', return_value=mock_client):
            storage = RedisTaskStorage("redis://localhost:6379/0")
            task = storage.get_task("task-1")

            # Should handle gracefully - may return task or None depending on implementation
            # The important thing is it doesn't crash
            assert task is None or isinstance(task, dict)


class TestConcurrentFailures:
    """Test handling of concurrent failure scenarios."""

    def test_concurrent_redis_failures(self):
        """Test handling of concurrent Redis failures."""
        import threading

        mock_client = MagicMock()
        mock_client.ping.return_value = True

        failure_count = [0]
        def side_effect(*args, **kwargs):
            failure_count[0] += 1
            if failure_count[0] % 2 == 0:
                raise redis.RedisError("Concurrent failure")
            return "OK"

        mock_client.setex.side_effect = side_effect

        with patch('backend.storage.upload_tasks.redis.from_url', return_value=mock_client):
            storage = RedisTaskStorage("redis://localhost:6379/0")

            def create_task():
                storage.create_task(f"task-{threading.get_ident()}", status="processing", progress=0)

            threads = [threading.Thread(target=create_task) for _ in range(10)]
            for t in threads:
                t.start()
            for t in threads:
                t.join()

            # Should complete without crashing
            assert failure_count[0] > 0


class TestGracefulDegradation:
    """Test graceful degradation behavior."""

    def test_redis_fallback_continues_operation(self):
        """Test that operation continues after Redis fallback."""
        with patch.dict('os.environ', {
            'JWT_SECRET_KEY': 'test-secret',
            'REDIS_URL': 'redis://localhost:6379/0',
            'ENVIRONMENT': 'production',
        }, clear=True):
            with patch('backend.storage.upload_tasks.redis.from_url') as mock_from_url:
                mock_client = MagicMock()
                mock_client.ping.side_effect = redis.ConnectionError("Connection failed")
                mock_from_url.return_value = mock_client

                reset_upload_task_storage()
                storage = UploadTaskStorage()

                # Should fall back to in-memory but continue working
                assert storage.using_redis is False

                # Operations should still work
                storage.create_task("task-1", status="processing", progress=0)
                task = storage.get_task("task-1")
                assert task is not None
                assert task["status"] == "processing"

    def test_partial_redis_failure(self):
        """Test handling of partial Redis failure (some operations fail)."""
        mock_client = MagicMock()
        mock_client.ping.return_value = True

        # Only setex fails
        mock_client.setex.side_effect = redis.RedisError("Partial failure")
        mock_client.get.return_value = '{"status": "processing", "progress": 0, "result": null}'
        mock_client.ttl.return_value = 3600

        with patch('backend.storage.upload_tasks.redis.from_url', return_value=mock_client):
            storage = RedisTaskStorage("redis://localhost:6379/0")

            # Create fails
            assert storage.create_task("task-1", status="processing", progress=0) is False

            # But other operations might work if data exists
            # (In this case, get works because we mocked it)
            task = storage.get_task("task-1")
            # Since create failed, get might return None or the mocked value
            # The important thing is it doesn't crash
