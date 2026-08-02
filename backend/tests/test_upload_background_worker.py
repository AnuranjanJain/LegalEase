import os
import pytest
from unittest.mock import patch
from fastapi import HTTPException

from backend.services.upload_job_queue import UploadJob, process_upload_job_async
from backend.storage.upload_tasks import get_upload_task_storage

os.environ["JWT_SECRET_KEY"] = "testing-secret-key-1234567890-abcdef"


@pytest.mark.asyncio
async def test_worker_masks_unexpected_exception_details(tmp_path):
    """
    An unexpected internal exception must not be exposed verbatim via task
    state; a generic message should be stored instead.
    """
    task_id = "test-task-mask"
    temp_file = tmp_path / "doc.pdf"
    temp_file.write_bytes(b"%PDF-1.4\nsome content")

    task_storage = get_upload_task_storage()
    task_storage.create_task(task_id, status="queued", progress=0)

    job = UploadJob(
        task_id=task_id,
        file_path=str(temp_file),
        filename="doc.pdf",
        content_type="application/pdf",
        file_extension=".pdf",
        content_prefix_b64="JVBERi0xLjQK",
    )

    sensitive_detail = "Traceback: /etc/secret/internal-path/config.py line 42, DB password=hunter2"
    with patch("backend.main._extract_pdf_text", side_effect=RuntimeError(sensitive_detail)):
        with pytest.raises(RuntimeError):
            await process_upload_job_async(job)

    result = task_storage.get_task(task_id)
    assert result["status"] == "failed"
    assert sensitive_detail not in result["result"]["error"]
    assert "process the uploaded document" in result["result"]["error"].lower()

    task_storage.delete_task(task_id)


@pytest.mark.asyncio
async def test_worker_preserves_safe_http_exception_detail(tmp_path):
    """
    A controlled HTTPException should remain visible to the user as-is.
    """
    task_id = "test-task-http-exc"
    temp_file = tmp_path / "doc.pdf"
    temp_file.write_bytes(b"%PDF-1.4\nsome content")

    task_storage = get_upload_task_storage()
    task_storage.create_task(task_id, status="queued", progress=0)

    job = UploadJob(
        task_id=task_id,
        file_path=str(temp_file),
        filename="doc.pdf",
        content_type="application/pdf",
        file_extension=".pdf",
        content_prefix_b64="JVBERi0xLjQK",
    )

    safe_detail = "File is too complex to process safely"
    with patch("backend.main._extract_pdf_text", side_effect=HTTPException(status_code=413, detail=safe_detail)):
        with pytest.raises(HTTPException):
            await process_upload_job_async(job)

    result = task_storage.get_task(task_id)
    assert result["status"] == "failed"
    assert result["result"]["error"] == safe_detail

    task_storage.delete_task(task_id)


@pytest.mark.asyncio
async def test_worker_success_path_unaffected(tmp_path):
    """Confirm the success path still returns the extracted text."""
    task_id = "test-task-success"
    temp_file = tmp_path / "doc.txt"
    temp_file.write_text("Legal document content.")

    task_storage = get_upload_task_storage()
    task_storage.create_task(task_id, status="queued", progress=0)

    job = UploadJob(
        task_id=task_id,
        file_path=str(temp_file),
        filename="doc.txt",
        content_type="text/plain",
        file_extension=".txt",
        content_prefix_b64="TGVnYWwgZG9jdW1lbnQgY29udGVudC4=",
    )

    await process_upload_job_async(job)

    result = task_storage.get_task(task_id)
    assert result["status"] == "done"
    assert result["result"]["text"] == "Legal document content."
    assert result["result"]["filename"] == "doc.txt"

    task_storage.delete_task(task_id)

