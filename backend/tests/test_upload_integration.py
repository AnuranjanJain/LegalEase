"""
Integration tests for upload endpoints with shared storage.

Tests verify that the upload endpoints work correctly with the new
storage abstraction, including:
- POST /upload creates tasks correctly
- GET /upload/status/{task_id} retrieves tasks correctly
- Background processing updates task state
- API responses remain unchanged
- Frontend polling continues to work
"""

import pytest
import asyncio
import io
import os
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from fastapi import BackgroundTasks

from backend.main import app
from backend.storage.upload_tasks import reset_upload_task_storage, get_upload_task_storage


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
    return {"X-API-Key": "dev-token"}


class TestUploadEndpointIntegration:
    """Integration tests for upload endpoints."""

    def test_upload_creates_task_in_storage(self, client, auth_headers):
        """Test that upload endpoint creates task in shared storage."""
        # Create a simple text file
        file_content = b"Sample document content for testing"
        file = io.BytesIO(file_content)
        file.name = "test.txt"

        response = client.post(
            "/upload",
            headers=auth_headers,
            files={"file": ("test.txt", file, "text/plain")}
        )

        assert response.status_code == 202
        data = response.json()
        assert "task_id" in data
        assert data["status"] == "processing"
        assert "filename" in data

        # Verify task exists in storage. Background processing runs
        # synchronously under TestClient, so the task may already be done.
        task_storage = get_upload_task_storage()
        task = task_storage.get_task(data["task_id"])
        assert task is not None
        assert task["status"] in ("processing", "done")

    def test_upload_status_retrieves_task(self, client, auth_headers):
        """Test that status endpoint retrieves task from shared storage."""
        # Create a task directly in storage
        task_storage = get_upload_task_storage()
        task_id = "test-task-123"
        task_storage.create_task(task_id, status="processing", progress=50)

        response = client.get(f"/upload/status/{task_id}", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["task_id"] == task_id
        assert data["status"] == "processing"
        assert data["progress"] == 50

    def test_upload_status_not_found(self, client, auth_headers):
        """Test that status endpoint returns 404 for non-existent task."""
        response = client.get("/upload/status/nonexistent-task", headers=auth_headers)
        assert response.status_code == 404
        assert "Task not found" in response.json()["detail"]

    def test_upload_response_format_unchanged(self, client, auth_headers):
        """Test that upload response format remains unchanged."""
        file_content = b"Sample document content"
        file = io.BytesIO(file_content)
        file.name = "test.txt"

        response = client.post(
            "/upload",
            headers=auth_headers,
            files={"file": ("test.txt", file, "text/plain")}
        )

        assert response.status_code == 202
        data = response.json()
        # Verify exact response format matches original API
        assert "task_id" in data
        assert "filename" in data
        assert "status" in data
        assert data["status"] == "processing"

    def test_upload_status_response_format_unchanged(self, client, auth_headers):
        """Test that status response format remains unchanged."""
        task_storage = get_upload_task_storage()
        task_id = "test-task-456"
        task_storage.create_task(
            task_id,
            status="done",
            progress=100,
            result={"filename": "test.txt", "text": "extracted content"}
        )

        response = client.get(f"/upload/status/{task_id}", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        # Verify exact response format matches original API
        assert data["task_id"] == task_id
        assert "status" in data
        assert "progress" in data
        assert "result" in data
        assert data["status"] == "done"
        assert data["progress"] == 100
        assert data["result"]["filename"] == "test.txt"

    def test_background_processing_updates_storage(self, client, auth_headers):
        """Test that background processing updates shared storage."""
        file_content = b"Sample document content"
        file = io.BytesIO(file_content)
        file.name = "test.txt"

        # Mock the background task to run synchronously for testing
        with patch('backend.main.BackgroundTasks') as mock_bg_tasks:
            mock_bg = MagicMock()
            mock_bg_tasks.return_value = mock_bg

            response = client.post(
                "/upload",
                headers=auth_headers,
                files={"file": ("test.txt", file, "text/plain")}
            )

            task_id = response.json()["task_id"]

            # Background processing runs synchronously under TestClient,
            # so the task is already complete by the time we check.
            task_storage = get_upload_task_storage()
            task = task_storage.get_task(task_id)
            assert task["status"] == "done"
            assert task["progress"] == 100
            assert task["result"]["filename"] == "test.txt"

    def test_failed_task_updates_storage(self, client, auth_headers):
        """Test that failed tasks are correctly stored."""
        task_storage = get_upload_task_storage()
        task_id = "test-task-failed"
        task_storage.create_task(task_id, status="processing", progress=0)

        # Simulate failure
        task_storage.mark_failed(task_id, "File processing failed")

        task = task_storage.get_task(task_id)
        assert task["status"] == "failed"
        assert task["progress"] == 0
        assert "error" in task["result"]
        assert task["result"]["error"] == "File processing failed"

    def test_multiple_concurrent_uploads(self, client, auth_headers):
        """Test that multiple concurrent uploads are handled correctly."""
        task_storage = get_upload_task_storage()

        # Create multiple tasks
        task_ids = []
        for i in range(5):
            file_content = f"Sample document content {i}".encode()
            file = io.BytesIO(file_content)
            file.name = f"test{i}.txt"

            response = client.post(
                "/upload",
                headers=auth_headers,
                files={"file": (f"test{i}.txt", file, "text/plain")}
            )

            task_ids.append(response.json()["task_id"])

        # Verify all tasks exist. Background processing runs synchronously
        # under TestClient, so tasks may already be done.
        for task_id in task_ids:
            task = task_storage.get_task(task_id)
            assert task is not None
            assert task["status"] in ("processing", "done")

    def test_task_progress_updates(self, client, auth_headers):
        """Test that task progress can be updated multiple times."""
        task_storage = get_upload_task_storage()
        task_id = "test-task-progress"

        task_storage.create_task(task_id, status="processing", progress=0)

        # Simulate progress updates
        task_storage.update_progress(task_id, 20)
        task = task_storage.get_task(task_id)
        assert task["progress"] == 20

        task_storage.update_progress(task_id, 50)
        task = task_storage.get_task(task_id)
        assert task["progress"] == 50

        task_storage.update_progress(task_id, 100)
        task = task_storage.get_task(task_id)
        assert task["progress"] == 100

    def test_task_status_transitions(self, client, auth_headers):
        """Test that task status transitions work correctly."""
        task_storage = get_upload_task_storage()
        task_id = "test-task-transitions"

        task_storage.create_task(task_id, status="processing", progress=0)

        # Transition to done
        task_storage.mark_completed(task_id, {"filename": "test.txt", "text": "done"})
        task = task_storage.get_task(task_id)
        assert task["status"] == "done"

        # Reset and transition to failed
        task_storage.create_task(task_id + "-2", status="processing", progress=50)
        task_storage.mark_failed(task_id + "-2", "Error occurred")
        task = task_storage.get_task(task_id + "-2")
        assert task["status"] == "failed"

    def test_polling_workflow(self, client, auth_headers):
        """Test that frontend polling workflow works correctly."""
        task_storage = get_upload_task_storage()
        task_id = "test-task-polling"

        # Initial state
        task_storage.create_task(task_id, status="processing", progress=0)

        # Simulate polling
        response = client.get(f"/upload/status/{task_id}", headers=auth_headers)
        assert response.json()["status"] == "processing"
        assert response.json()["progress"] == 0

        # Update progress
        task_storage.update_progress(task_id, 50)
        response = client.get(f"/upload/status/{task_id}", headers=auth_headers)
        assert response.json()["progress"] == 50

        # Complete task
        task_storage.mark_completed(task_id, {"filename": "test.txt", "text": "done"})
        response = client.get(f"/upload/status/{task_id}", headers=auth_headers)
        assert response.json()["status"] == "done"
        assert response.json()["progress"] == 100


class TestUploadWithRedisStorage:
    """Integration tests with Redis storage backend."""

    @pytest.fixture
    def mock_redis_client(self):
        """Create a mock Redis client backed by an in-memory dict so
        setex/get round-trip like real Redis."""
        store = {}
        client = MagicMock()
        client.ping.return_value = True
        client.setex.side_effect = lambda key, ttl, value: store.__setitem__(key, value)
        client.get.side_effect = lambda key: store.get(key)
        client.delete.side_effect = lambda key: store.pop(key, None)
        client.exists.side_effect = lambda key: key in store
        return client

    def test_upload_with_redis_backend(self, client, auth_headers, mock_redis_client):
        """Test upload endpoint with Redis storage backend."""
        with patch.dict('os.environ', {
            'JWT_SECRET_KEY': 'test-secret',
            'REDIS_URL': 'redis://localhost:6379/0',
            'ENVIRONMENT': 'production',
            'ALLOW_DEV': 'true',
            'DEV_API_KEY': 'dev-token',
        }, clear=True):
            with patch('backend.storage.upload_tasks.redis.from_url', return_value=mock_redis_client):
                with patch('backend.storage.upload_tasks.get_settings') as mock_settings:
                    # Mock settings to return Redis URL
                    settings = MagicMock()
                    settings.database.redis_url = "redis://localhost:6379/0"
                    settings.environment.environment = "production"
                    mock_settings.return_value = settings

                    reset_upload_task_storage()

                    file_content = b"Sample document content"
                    file = io.BytesIO(file_content)
                    file.name = "test.txt"

                    response = client.post(
                        "/upload",
                        headers=auth_headers,
                        files={"file": ("test.txt", file, "text/plain")}
                    )

                    assert response.status_code == 202
                    task_id = response.json()["task_id"]

                    # Verify Redis was used
                    task_storage = get_upload_task_storage()
                    assert task_storage.using_redis is True

    def test_status_with_redis_backend(self, client, auth_headers, mock_redis_client):
        """Test status endpoint with Redis storage backend."""
        with patch.dict('os.environ', {
            'JWT_SECRET_KEY': 'test-secret',
            'REDIS_URL': 'redis://localhost:6379/0',
            'ENVIRONMENT': 'production',
            'ALLOW_DEV': 'true',
            'DEV_API_KEY': 'dev-token',
        }, clear=True):
            with patch('backend.storage.upload_tasks.redis.from_url', return_value=mock_redis_client):
                with patch('backend.storage.upload_tasks.get_settings') as mock_settings:
                    settings = MagicMock()
                    settings.database.redis_url = "redis://localhost:6379/0"
                    settings.environment.environment = "production"
                    mock_settings.return_value = settings

                    reset_upload_task_storage()

                    # Create task directly in storage
                    task_storage = get_upload_task_storage()
                    task_id = "redis-task-123"
                    task_storage.create_task(task_id, status="processing", progress=75)

                    response = client.get(f"/upload/status/{task_id}", headers=auth_headers)

                    assert response.status_code == 200
                    assert response.json()["progress"] == 75


class TestUploadErrorHandling:
    """Integration tests for error handling."""

    def test_upload_with_invalid_file(self, client, auth_headers):
        """Test upload with invalid file type."""
        # This should be handled by validation before storage
        file_content = b"Invalid content"
        file = io.BytesIO(file_content)
        file.name = "test.exe"

        response = client.post(
            "/upload",
            headers=auth_headers,
            files={"file": ("test.exe", file, "application/x-msdownload")}
        )

        # Should fail validation before storage
        assert response.status_code in [400, 413]

    def test_status_with_expired_task(self, client, auth_headers):
        """Test status endpoint with expired task."""
        import time

        task_storage = get_upload_task_storage()
        task_id = "expired-task"
        task_storage.create_task(task_id, status="processing", progress=0, ttl_seconds=1)

        # Wait for expiration
        time.sleep(1.1)

        response = client.get(f"/upload/status/{task_id}", headers=auth_headers)
        assert response.status_code == 404

    def test_upload_with_large_file(self, client, auth_headers):
        """Test upload with file exceeding size limit."""
        # Create a file larger than the limit
        large_content = b"x" * (26 * 1024 * 1024)  # 26MB
        file = io.BytesIO(large_content)
        file.name = "large.txt"

        response = client.post(
            "/upload",
            headers=auth_headers,
            files={"file": ("large.txt", file, "text/plain")}
        )

        # Should fail due to size limit
        assert response.status_code == 413
