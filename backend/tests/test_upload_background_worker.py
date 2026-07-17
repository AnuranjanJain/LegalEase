import os
import pytest
from unittest.mock import patch
from fastapi import HTTPException

import backend.main as main
from backend.storage.upload_tasks import get_upload_task_storage

os.environ["JWT_SECRET_KEY"] = "testing-secret-key-1234567890-abcdef"


@pytest.mark.asyncio
async def test_background_worker_masks_unexpected_exception_details(tmp_path):
    """
    An unexpected internal exception (which could contain file paths or
    library internals) must not be exposed verbatim via
    /upload/status/{task_id}; a generic message should be returned instead.
    """
    task_id = "test-task-mask"
    temp_file = tmp_path / "doc.pdf"
    temp_file.write_bytes(b"%PDF-1.4\nsome content")

    task_storage = get_upload_task_storage()
    task_storage.create_task(task_id, status="processing", progress=0)

    sensitive_detail = "Traceback: /etc/secret/internal-path/config.py line 42, DB password=hunter2"
    with patch.object(main, "_extract_pdf_text", side_effect=RuntimeError(sensitive_detail)):
        await main._process_document_background(
            task_id=task_id,
            temp_path=str(temp_file),
            filename="doc.pdf",
            file_extension=".pdf",
            content_prefix=b"%PDF-1.4\n",
        )

    result = task_storage.get_task(task_id)
    assert result["status"] == "failed"
    assert sensitive_detail not in result["result"]["error"]
    assert "process the uploaded document" in result["result"]["error"].lower()

    task_storage.delete_task(task_id)


@pytest.mark.asyncio
async def test_background_worker_preserves_safe_http_exception_detail(tmp_path):
    """
    A controlled HTTPException (e.g. the "file too complex" timeout from
    _run_bounded_parser) carries a message that is safe and useful to show
    the user, and should still be surfaced as-is.
    """
    task_id = "test-task-http-exc"
    temp_file = tmp_path / "doc.pdf"
    temp_file.write_bytes(b"%PDF-1.4\nsome content")

    task_storage = get_upload_task_storage()
    task_storage.create_task(task_id, status="processing", progress=0)

    safe_detail = "File is too complex to process safely"
    with patch.object(
        main, "_extract_pdf_text", side_effect=HTTPException(status_code=413, detail=safe_detail)
    ):
        await main._process_document_background(
            task_id=task_id,
            temp_path=str(temp_file),
            filename="doc.pdf",
            file_extension=".pdf",
            content_prefix=b"%PDF-1.4\n",
        )

    result = task_storage.get_task(task_id)
    assert result["status"] == "failed"
    assert result["result"]["error"] == safe_detail

    task_storage.delete_task(task_id)


@pytest.mark.asyncio
async def test_background_worker_success_path_unaffected(tmp_path):
    """Confirm the success path still returns the extracted text as before."""
    task_id = "test-task-success"
    temp_file = tmp_path / "doc.txt"
    temp_file.write_text("Legal document content.")

    task_storage = get_upload_task_storage()
    task_storage.create_task(task_id, status="processing", progress=0)

    await main._process_document_background(
        task_id=task_id,
        temp_path=str(temp_file),
        filename="doc.txt",
        file_extension=".txt",
        content_prefix=b"Legal document content.",
    )

    result = task_storage.get_task(task_id)
    assert result["status"] == "done"
    assert result["result"]["text"] == "Legal document content."
    assert result["result"]["filename"] == "doc.txt"

    task_storage.delete_task(task_id)
