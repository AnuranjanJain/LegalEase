"""
Durable upload job queue and worker helpers.

The API enqueues upload jobs in Redis and returns immediately. A separate
worker process can dequeue and process the jobs independently of the request
lifecycle, which makes the upload pipeline safe for serverless deployments.
"""

from __future__ import annotations

import base64
import json
import logging
import os
import time
from dataclasses import dataclass, asdict
from typing import Any, Optional

import redis

from backend.config import get_settings
from backend.core.exceptions import ValidationError
from backend.core.validation import validate_mime_and_bytes, validate_docx_archive_safety
from backend.storage.upload_tasks import get_upload_task_storage

logger = logging.getLogger(__name__)

READY_QUEUE_KEY = "upload_jobs:ready"
SCHEDULED_ZSET_KEY = "upload_jobs:scheduled"
DEAD_LETTER_KEY = "upload_jobs:dead"
DEFAULT_MAX_RETRIES = 3
DEFAULT_RETRY_BACKOFF_SECONDS = 2


@dataclass
class UploadJob:
    task_id: str
    file_path: str
    filename: str
    content_type: str
    file_extension: str
    content_prefix_b64: str
    attempts: int = 0
    max_retries: int = DEFAULT_MAX_RETRIES
    retry_backoff_seconds: int = DEFAULT_RETRY_BACKOFF_SECONDS

    def to_json(self) -> str:
        return json.dumps(asdict(self))

    @classmethod
    def from_json(cls, data: str) -> "UploadJob":
        payload = json.loads(data)
        return cls(**payload)

    @property
    def content_prefix(self) -> bytes:
        return base64.b64decode(self.content_prefix_b64.encode())


class UploadJobQueue:
    def __init__(self, redis_url: Optional[str] = None):
        settings = get_settings()
        self.redis_url = redis_url or settings.database.redis_url
        self._client = None
        self._in_memory: list[str] = []
        self._scheduled: list[tuple[float, str]] = []
        self._dead_letters: list[str] = []
        if self.redis_url:
            try:
                self._client = redis.from_url(self.redis_url, decode_responses=True)
                self._client.ping()
            except Exception as exc:
                logger.warning(f"Falling back to in-memory upload queue: {exc}")
                self._client = None

    @property
    def using_redis(self) -> bool:
        return self._client is not None

    def enqueue(self, job: UploadJob) -> bool:
        payload = job.to_json()
        if self._client:
            self._client.rpush(READY_QUEUE_KEY, payload)
            logger.info(f"[{job.task_id}] Enqueued upload job")
            return True
        self._in_memory.append(payload)
        logger.info(f"[{job.task_id}] Enqueued upload job in memory fallback")
        return True

    def promote_due_jobs(self) -> int:
        now = time.time()
        promoted = 0
        if self._client:
            due = self._client.zrangebyscore(SCHEDULED_ZSET_KEY, 0, now)
            for payload in due:
                self._client.zrem(SCHEDULED_ZSET_KEY, payload)
                self._client.rpush(READY_QUEUE_KEY, payload)
                promoted += 1
            return promoted

        due = [item for item in self._scheduled if item[0] <= now]
        self._scheduled = [item for item in self._scheduled if item[0] > now]
        for _, payload in due:
            self._in_memory.append(payload)
            promoted += 1
        return promoted

    def reserve(self, timeout_seconds: int = 1) -> Optional[UploadJob]:
        self.promote_due_jobs()
        if self._client:
            item = self._client.brpop(READY_QUEUE_KEY, timeout=timeout_seconds)
            if not item:
                return None
            _, payload = item
            return UploadJob.from_json(payload)
        if self._in_memory:
            return UploadJob.from_json(self._in_memory.pop(0))
        time.sleep(timeout_seconds)
        return None

    def schedule_retry(self, job: UploadJob) -> None:
        delay = max(1, job.retry_backoff_seconds * (2 ** max(job.attempts - 1, 0)))
        due_at = time.time() + delay
        payload = job.to_json()
        if self._client:
            self._client.zadd(SCHEDULED_ZSET_KEY, {payload: due_at})
        else:
            self._scheduled.append((due_at, payload))
        logger.info(f"[{job.task_id}] Scheduled retry attempt {job.attempts} in {delay}s")

    def dead_letter(self, job: UploadJob, reason: str) -> None:
        payload = json.dumps({"job": asdict(job), "reason": reason, "dead_lettered_at": time.time()})
        if self._client:
            self._client.rpush(DEAD_LETTER_KEY, payload)
        else:
            self._dead_letters.append(payload)


def build_upload_job(
    *,
    task_id: str,
    file_path: str,
    filename: str,
    content_type: str,
    file_extension: str,
    content_prefix: bytes,
    max_retries: int = DEFAULT_MAX_RETRIES,
) -> UploadJob:
    return UploadJob(
        task_id=task_id,
        file_path=file_path,
        filename=filename,
        content_type=content_type,
        file_extension=file_extension,
        content_prefix_b64=base64.b64encode(content_prefix).decode(),
        max_retries=max_retries,
    )


def process_upload_job(job: UploadJob) -> None:
    raise RuntimeError("Use process_upload_job_async()")


async def process_upload_job_async(job: UploadJob) -> None:
    """Process one upload job and update task state."""
    from backend.main import (
        MAX_EXTRACTED_TEXT_CHARS,
        _extract_docx_text,
        _extract_pdf_text,
        _run_bounded_parser,
    )

    task_storage = get_upload_task_storage()
    logger.info(f"[{job.task_id}] Dequeued upload job")
    task_storage.update_status(job.task_id, "processing")
    task_storage.update_progress(job.task_id, 10)

    try:
        with open(job.file_path, "rb") as handle:
            prefix = handle.read(4096)
        validate_mime_and_bytes(prefix or job.content_prefix, job.content_type, job.filename)
        if job.file_extension == ".docx":
            validate_docx_archive_safety(job.file_path)

        extracted_text = ""
        task_storage.update_progress(job.task_id, 30)

        if job.file_extension == ".pdf" or job.content_prefix.startswith(b"%PDF-"):
            extracted_text = await _run_bounded_parser(_extract_pdf_text, job.file_path)
        elif job.file_extension == ".docx":
            extracted_text = await _run_bounded_parser(_extract_docx_text, job.file_path)
        elif job.file_extension == ".txt":
            with open(job.file_path, "r", encoding="utf-8") as tf:
                extracted_text = tf.read(MAX_EXTRACTED_TEXT_CHARS)
        else:
            raise ValidationError(f"Unsupported file extension '{job.file_extension}'")

        task_storage.update_progress(job.task_id, 80)
        extracted_text = extracted_text[:MAX_EXTRACTED_TEXT_CHARS]
        task_storage.mark_completed(job.task_id, {"filename": job.filename, "text": extracted_text})
        logger.info(f"[{job.task_id}] Upload processing complete")
    except Exception as exc:
        message = exc.detail if hasattr(exc, "detail") else "Failed to process the uploaded document. Please try again or use a different file."
        task_storage.mark_failed(job.task_id, message)
        logger.error(f"[{job.task_id}] Upload processing failed: {exc}", exc_info=True)
        raise
    finally:
        try:
            if os.path.exists(job.file_path):
                os.unlink(job.file_path)
                logger.info(f"[{job.task_id}] Cleaned up temporary upload file")
        except OSError as cleanup_error:
            logger.warning(f"[{job.task_id}] Temporary file cleanup failed: {cleanup_error}")


async def run_upload_worker_loop_async(poll_interval_seconds: float = 1.0) -> None:
    queue = UploadJobQueue()
    while True:
        job = queue.reserve(timeout_seconds=int(max(1, poll_interval_seconds)))
        if job is None:
            continue
        storage = get_upload_task_storage()
        task = storage.get_task(job.task_id)
        if not task:
            logger.warning(f"[{job.task_id}] Skipping missing task record")
            continue
        try:
            await process_upload_job_async(job)
        except Exception as exc:
            job.attempts += 1
            if job.attempts < job.max_retries:
                storage.update_status(job.task_id, "queued")
                storage.update_progress(job.task_id, 0)
                queue.schedule_retry(job)
            else:
                storage.mark_failed(job.task_id, str(getattr(exc, "detail", exc)))
                queue.dead_letter(job, str(exc))


def run_upload_worker_loop(poll_interval_seconds: float = 1.0) -> None:
    import asyncio

    asyncio.run(run_upload_worker_loop_async(poll_interval_seconds=poll_interval_seconds))
