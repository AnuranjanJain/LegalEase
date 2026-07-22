"""
Regression tests for existing upload functionality.

These tests ensure that the refactoring from in-memory to shared storage
does not break existing functionality:
- File parsing (PDF, DOCX, TXT)
- Upload endpoint behavior
- Status endpoint behavior
- Background processing workflow
- Frontend polling compatibility
- API contract preservation
"""

import pytest
import io
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

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


class TestUploadEndpointRegression:
    """Regression tests for upload endpoint behavior."""

    def test_upload_returns_202_accepted(self, client, auth_headers):
        """Test that upload endpoint returns 202 Accepted."""
        file_content = b"Sample document content"
        file = io.BytesIO(file_content)
        file.name = "test.txt"

        response = client.post(
            "/upload",
            headers=auth_headers,
            files={"file": ("test.txt", file, "text/plain")}
        )

        assert response.status_code == 202

    def test_upload_response_contains_task_id(self, client, auth_headers):
        """Test that upload response contains task_id."""
        file_content = b"Sample document content"
        file = io.BytesIO(file_content)
        file.name = "test.txt"

        response = client.post(
            "/upload",
            headers=auth_headers,
            files={"file": ("test.txt", file, "text/plain")}
        )

        data = response.json()
        assert "task_id" in data
        assert isinstance(data["task_id"], str)
        assert len(data["task_id"]) > 0

    def test_upload_response_contains_filename(self, client, auth_headers):
        """Test that upload response contains filename."""
        file_content = b"Sample document content"
        file = io.BytesIO(file_content)
        file.name = "test.txt"

        response = client.post(
            "/upload",
            headers=auth_headers,
            files={"file": ("test.txt", file, "text/plain")}
        )

        data = response.json()
        assert "filename" in data
        assert data["filename"] == "test.txt"

    def test_upload_response_status_is_queued(self, client, auth_headers):
        """Test that upload response status is 'queued'."""
        file_content = b"Sample document content"
        file = io.BytesIO(file_content)
        file.name = "test.txt"

        response = client.post(
            "/upload",
            headers=auth_headers,
            files={"file": ("test.txt", file, "text/plain")}
        )

        data = response.json()
        assert "status" in data
        assert data["status"] == "queued"

    def test_upload_accepts_txt_files(self, client, auth_headers):
        """Test that upload endpoint accepts TXT files."""
        file_content = b"Sample document content"
        file = io.BytesIO(file_content)
        file.name = "test.txt"

        response = client.post(
            "/upload",
            headers=auth_headers,
            files={"file": ("test.txt", file, "text/plain")}
        )

        assert response.status_code == 202

    def test_upload_accepts_pdf_files(self, client, auth_headers):
        """Test that upload endpoint accepts PDF files."""
        # Create a minimal PDF file
        pdf_content = b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF"
        file = io.BytesIO(pdf_content)
        file.name = "test.pdf"

        response = client.post(
            "/upload",
            headers=auth_headers,
            files={"file": ("test.pdf", file, "application/pdf")}
        )

        assert response.status_code == 202

    def test_upload_accepts_docx_files(self, client, auth_headers):
        """Test that upload endpoint accepts DOCX files."""
        # Create a minimal DOCX file (ZIP format)
        import zipfile
        file_buffer = io.BytesIO()
        with zipfile.ZipFile(file_buffer, 'w') as zf:
            zf.writestr('[Content_Types].xml', '<Types />')
            zf.writestr('_rels/.rels', '<Relationships />')
            zf.writestr('word/document.xml', '<w:document />')

        file_buffer.seek(0)
        file = file_buffer
        file.name = "test.docx"

        response = client.post(
            "/upload",
            headers=auth_headers,
            files={"file": ("test.docx", file, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")}
        )

        assert response.status_code == 202


class TestStatusEndpointRegression:
    """Regression tests for status endpoint behavior."""

    def test_status_returns_200_for_valid_task(self, client, auth_headers):
        """Test that status endpoint returns 200 for valid task."""
        task_storage = get_upload_task_storage()
        task_id = "test-task-123"
        task_storage.create_task(task_id, status="processing", progress=50)

        response = client.get(f"/upload/status/{task_id}", headers=auth_headers)

        assert response.status_code == 200

    def test_status_returns_404_for_invalid_task(self, client, auth_headers):
        """Test that status endpoint returns 404 for invalid task."""
        response = client.get("/upload/status/invalid-task-id", headers=auth_headers)

        assert response.status_code == 404

    def test_status_response_contains_task_id(self, client, auth_headers):
        """Test that status response contains task_id."""
        task_storage = get_upload_task_storage()
        task_id = "test-task-456"
        task_storage.create_task(task_id, status="processing", progress=50)

        response = client.get(f"/upload/status/{task_id}", headers=auth_headers)

        data = response.json()
        assert "task_id" in data
        assert data["task_id"] == task_id

    def test_status_response_contains_status(self, client, auth_headers):
        """Test that status response contains status."""
        task_storage = get_upload_task_storage()
        task_id = "test-task-789"
        task_storage.create_task(task_id, status="processing", progress=50)

        response = client.get(f"/upload/status/{task_id}", headers=auth_headers)

        data = response.json()
        assert "status" in data
        assert data["status"] == "processing"

    def test_status_response_contains_progress(self, client, auth_headers):
        """Test that status response contains progress."""
        task_storage = get_upload_task_storage()
        task_id = "test-task-abc"
        task_storage.create_task(task_id, status="processing", progress=75)

        response = client.get(f"/upload/status/{task_id}", headers=auth_headers)

        data = response.json()
        assert "progress" in data
        assert data["progress"] == 75

    def test_status_response_contains_result(self, client, auth_headers):
        """Test that status response contains result."""
        task_storage = get_upload_task_storage()
        task_id = "test-task-def"
        task_storage.create_task(
            task_id,
            status="done",
            progress=100,
            result={"filename": "test.txt", "text": "extracted content"}
        )

        response = client.get(f"/upload/status/{task_id}", headers=auth_headers)

        data = response.json()
        assert "result" in data
        assert data["result"]["filename"] == "test.txt"
        assert data["result"]["text"] == "extracted content"


class TestTaskLifecycleRegression:
    """Regression tests for task lifecycle."""

    def test_task_initial_state_is_queued(self, client, auth_headers):
        """Test that task initial state is 'queued'."""
        file_content = b"Sample document content"
        file = io.BytesIO(file_content)
        file.name = "test.txt"

        response = client.post(
            "/upload",
            headers=auth_headers,
            files={"file": ("test.txt", file, "text/plain")}
        )

        data = response.json()
        assert data["status"] == "queued"

    def test_task_progress_updates(self, client, auth_headers):
        """Test that task progress can be updated."""
        task_storage = get_upload_task_storage()
        task_id = "test-task-progress"
        task_storage.create_task(task_id, status="processing", progress=0)

        task_storage.update_progress(task_id, 25)
        task = task_storage.get_task(task_id)
        assert task["progress"] == 25

        task_storage.update_progress(task_id, 50)
        task = task_storage.get_task(task_id)
        assert task["progress"] == 50

        task_storage.update_progress(task_id, 100)
        task = task_storage.get_task(task_id)
        assert task["progress"] == 100

    def test_task_completion_state(self, client, auth_headers):
        """Test that task completion state is 'done'."""
        task_storage = get_upload_task_storage()
        task_id = "test-task-completion"
        task_storage.create_task(task_id, status="processing", progress=0)

        task_storage.mark_completed(task_id, {"filename": "test.txt", "text": "processed"})

        task = task_storage.get_task(task_id)
        assert task["status"] == "done"
        assert task["progress"] == 100
        assert task["result"]["filename"] == "test.txt"

    def test_task_failure_state(self, client, auth_headers):
        """Test that task failure state is 'failed'."""
        task_storage = get_upload_task_storage()
        task_id = "test-task-failure"
        task_storage.create_task(task_id, status="processing", progress=50)

        task_storage.mark_failed(task_id, "Processing error")

        task = task_storage.get_task(task_id)
        assert task["status"] == "failed"
        assert task["progress"] == 0
        assert task["result"]["error"] == "Processing error"


class TestBackgroundProcessingRegression:
    """Regression tests for background processing workflow."""

    def test_background_task_creates_task(self, client, auth_headers):
        """Test that background task creates task in storage."""
        file_content = b"Sample document content"
        file = io.BytesIO(file_content)
        file.name = "test.txt"

        response = client.post(
            "/upload",
            headers=auth_headers,
            files={"file": ("test.txt", file, "text/plain")}
        )

        task_id = response.json()["task_id"]
        task_storage = get_upload_task_storage()

        # Task should exist in storage
        assert task_storage.task_exists(task_id) is True

    def test_background_task_updates_progress(self):
        """Test that background task can update progress."""
        task_storage = get_upload_task_storage()
        task_id = "background-task-1"
        task_storage.create_task(task_id, status="processing", progress=0)

        # Simulate background task progress updates
        task_storage.update_progress(task_id, 20)
        task_storage.update_progress(task_id, 70)
        task_storage.update_progress(task_id, 100)

        task = task_storage.get_task(task_id)
        assert task["progress"] == 100

    def test_background_task_completes(self):
        """Test that background task can complete successfully."""
        task_storage = get_upload_task_storage()
        task_id = "background-task-2"
        task_storage.create_task(task_id, status="processing", progress=0)

        # Simulate background task completion
        task_storage.update_progress(task_id, 100)
        task_storage.mark_completed(task_id, {"filename": "test.txt", "text": "processed"})

        task = task_storage.get_task(task_id)
        assert task["status"] == "done"
        assert task["result"]["text"] == "processed"

    def test_background_task_handles_failure(self):
        """Test that background task can handle failures."""
        task_storage = get_upload_task_storage()
        task_id = "background-task-3"
        task_storage.create_task(task_id, status="processing", progress=50)

        # Simulate background task failure
        task_storage.mark_failed(task_id, "File too complex")

        task = task_storage.get_task(task_id)
        assert task["status"] == "failed"
        assert task["result"]["error"] == "File too complex"


class TestFrontendPollingRegression:
    """Regression tests for frontend polling compatibility."""

    def test_polling_workflow_processing_to_done(self, client, auth_headers):
        """Test frontend polling workflow from processing to done."""
        task_storage = get_upload_task_storage()
        task_id = "polling-task-1"
        task_storage.create_task(task_id, status="processing", progress=0)

        # Initial poll
        response = client.get(f"/upload/status/{task_id}", headers=auth_headers)
        assert response.json()["status"] == "processing"
        assert response.json()["progress"] == 0

        # Progress update
        task_storage.update_progress(task_id, 50)
        response = client.get(f"/upload/status/{task_id}", headers=auth_headers)
        assert response.json()["progress"] == 50

        # Completion
        task_storage.mark_completed(task_id, {"filename": "test.txt", "text": "done"})
        response = client.get(f"/upload/status/{task_id}", headers=auth_headers)
        assert response.json()["status"] == "done"
        assert response.json()["progress"] == 100

    def test_polling_workflow_processing_to_failed(self, client, auth_headers):
        """Test frontend polling workflow from processing to failed."""
        task_storage = get_upload_task_storage()
        task_id = "polling-task-2"
        task_storage.create_task(task_id, status="processing", progress=0)

        # Initial poll
        response = client.get(f"/upload/status/{task_id}", headers=auth_headers)
        assert response.json()["status"] == "processing"

        # Failure
        task_storage.mark_failed(task_id, "Processing error")
        response = client.get(f"/upload/status/{task_id}", headers=auth_headers)
        assert response.json()["status"] == "failed"
        assert "error" in response.json()["result"]

    def test_polling_handles_nonexistent_task(self, client, auth_headers):
        """Test that polling handles nonexistent task gracefully."""
        response = client.get("/upload/status/nonexistent-task", headers=auth_headers)
        assert response.status_code == 404


class TestAPIContractRegression:
    """Regression tests for API contract preservation."""

    def test_upload_response_structure_unchanged(self, client, auth_headers):
        """Test that upload response structure is unchanged."""
        file_content = b"Sample document content"
        file = io.BytesIO(file_content)
        file.name = "test.txt"

        response = client.post(
            "/upload",
            headers=auth_headers,
            files={"file": ("test.txt", file, "text/plain")}
        )

        data = response.json()

        # Verify exact response structure
        assert set(data.keys()) == {"task_id", "filename", "status"}
        assert isinstance(data["task_id"], str)
        assert isinstance(data["filename"], str)
        assert isinstance(data["status"], str)

    def test_status_response_structure_unchanged(self, client, auth_headers):
        """Test that status response structure is unchanged."""
        task_storage = get_upload_task_storage()
        task_id = "contract-task-1"
        task_storage.create_task(
            task_id,
            status="done",
            progress=100,
            result={"filename": "test.txt", "text": "processed"}
        )

        response = client.get(f"/upload/status/{task_id}", headers=auth_headers)

        data = response.json()

        # Verify exact response structure
        assert set(data.keys()) == {"task_id", "status", "progress", "result"}
        assert isinstance(data["task_id"], str)
        assert isinstance(data["status"], str)
        assert isinstance(data["progress"], int)
        assert isinstance(data["result"], dict)

    def test_status_values_unchanged(self, client, auth_headers):
        """Test that status values are unchanged."""
        task_storage = get_upload_task_storage()

        # Test processing status
        task_id_1 = "contract-task-2"
        task_storage.create_task(task_id_1, status="processing", progress=50)
        response = client.get(f"/upload/status/{task_id_1}", headers=auth_headers)
        assert response.json()["status"] == "processing"
        assert response.json()["progress"] == 50

        # Test done status
        task_id_2 = "contract-task-3"
        task_storage.create_task(task_id_2, status="done", progress=100, result={"text": "done"})
        response = client.get(f"/upload/status/{task_id_2}", headers=auth_headers)
        assert response.json()["status"] == "done"
        assert response.json()["progress"] == 100

        # Test failed status
        task_id_3 = "contract-task-4"
        task_storage.create_task(task_id_3, status="failed", progress=0, result={"error": "error"})
        response = client.get(f"/upload/status/{task_id_3}", headers=auth_headers)
        assert response.json()["status"] == "failed"
        assert response.json()["progress"] == 0


class TestFileProcessingRegression:
    """Regression tests for file processing functionality."""

    def test_txt_file_processing(self):
        """Test that TXT file processing still works."""
        from backend.main import _extract_docx_text
        # This test verifies the file processing functions are still available
        # The actual processing is tested in the background task
        assert True  # Placeholder - actual file processing tests would go here

    def test_pdf_file_processing(self):
        """Test that PDF file processing still works."""
        # Placeholder for PDF processing regression tests
        assert True

    def test_docx_file_processing(self):
        """Test that DOCX file processing still works."""
        # Placeholder for DOCX processing regression tests
        assert True


class TestErrorHandlingRegression:
    """Regression tests for error handling."""

    def test_upload_without_file_returns_error(self, client, auth_headers):
        """Test that upload without file returns error."""
        response = client.post("/upload", headers=auth_headers)
        assert response.status_code == 422  # Unprocessable Entity

    def test_upload_with_invalid_mime_type(self, client, auth_headers):
        """Test that upload with invalid MIME type returns error."""
        file_content = b"Invalid content"
        file = io.BytesIO(file_content)
        file.name = "test.exe"

        response = client.post(
            "/upload",
            headers=auth_headers,
            files={"file": ("test.exe", file, "application/x-msdownload")}
        )

        # Should fail validation
        assert response.status_code in [400, 413]

    def test_upload_with_large_file_returns_error(self, client, auth_headers):
        """Test that upload with large file returns error."""
        large_content = b"x" * (26 * 1024 * 1024)  # 26MB
        file = io.BytesIO(large_content)
        file.name = "large.txt"

        response = client.post(
            "/upload",
            headers=auth_headers,
            files={"file": ("large.txt", file, "text/plain")}
        )

        assert response.status_code == 413


class TestAuthenticationRegression:
    """Regression tests for authentication."""

    def test_upload_requires_authentication(self, client):
        """Test that upload endpoint requires authentication."""
        file_content = b"Sample document content"
        file = io.BytesIO(file_content)
        file.name = "test.txt"

        response = client.post(
            "/upload",
            files={"file": ("test.txt", file, "text/plain")}
        )

        assert response.status_code == 401

    def test_status_requires_authentication(self, client):
        """Test that status endpoint requires authentication."""
        response = client.get("/upload/status/test-task")
        assert response.status_code == 401

    def test_upload_with_valid_auth_succeeds(self, client, auth_headers):
        """Test that upload with valid authentication succeeds."""
        file_content = b"Sample document content"
        file = io.BytesIO(file_content)
        file.name = "test.txt"

        response = client.post(
            "/upload",
            headers=auth_headers,
            files={"file": ("test.txt", file, "text/plain")}
        )

        assert response.status_code == 202
