"""
Regression tests for scanned/image-only PDF detection (#OCR-gap).

LegalEase has no OCR engine, so a scanned PDF extracts to an empty string.
process_upload_job_async must surface a clear, user-actionable failure in
that case instead of silently completing with blank text.

These tests stub ``backend.main`` in ``sys.modules`` so importing the
extraction helpers does not pull in the full FastAPI app (which makes the
other upload-queue test modules hang at import time).
"""

import asyncio
import os
import sys
import tempfile
import types

import pytest

from backend.services.upload_job_queue import UploadJob, process_upload_job_async
from backend.storage.upload_tasks import (
    get_upload_task_storage,
    reset_upload_task_storage,
)


def _install_fake_backend_main(pdf_text: str) -> None:
    """Register a lightweight backend.main stub returning ``pdf_text``."""
    module = types.ModuleType("backend.main")
    module.MAX_EXTRACTED_TEXT_CHARS = 10000

    async def _run_bounded_parser(parser, file_path):
        return parser(file_path)

    module._run_bounded_parser = _run_bounded_parser
    module._extract_pdf_text = lambda file_path: pdf_text
    module._extract_docx_text = lambda file_path: pdf_text
    sys.modules["backend.main"] = module


def _make_pdf_job(path: str) -> UploadJob:
    return UploadJob(
        task_id="scan-task",
        file_path=path,
        filename="scan.pdf",
        content_type="application/pdf",
        file_extension=".pdf",
        content_prefix_b64="JVBERi0=",  # "%PDF-"
    )


@pytest.fixture(autouse=True)
def _reset_storage_and_module():
    reset_upload_task_storage()
    saved = sys.modules.get("backend.main")
    yield
    if saved is not None:
        sys.modules["backend.main"] = saved
    else:
        sys.modules.pop("backend.main", None)
    reset_upload_task_storage()


def _write_pdf_bytes() -> str:
    fd, path = tempfile.mkstemp(suffix=".pdf")
    with os.fdopen(fd, "wb") as f:
        f.write(b"%PDF-1.4 fake body")
    return path


def test_scanned_pdf_marks_task_failed_with_ocr_message():
    _install_fake_backend_main(pdf_text="   \n  ")  # effectively empty
    path = _write_pdf_bytes()
    job = _make_pdf_job(path)

    storage = get_upload_task_storage()
    storage.create_task(job.task_id, status="queued", progress=0, result=None, user_id="u1")

    with pytest.raises(Exception):
        asyncio.run(process_upload_job_async(job))

    task = storage.get_task(job.task_id)
    assert task["status"] == "failed"
    error_message = task["result"]["error"]
    assert "scanned" in error_message.lower() or "ocr" in error_message.lower()
    assert not os.path.exists(path)


def test_text_pdf_completes_successfully():
    _install_fake_backend_main(pdf_text="This is a real contract with plenty of text.")
    path = _write_pdf_bytes()
    job = _make_pdf_job(path)

    storage = get_upload_task_storage()
    storage.create_task(job.task_id, status="queued", progress=0, result=None, user_id="u1")

    asyncio.run(process_upload_job_async(job))

    task = storage.get_task(job.task_id)
    assert task["status"] == "done"
    assert "real contract" in task["result"]["text"]
