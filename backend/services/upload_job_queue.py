"""
Durable upload job queue and worker helpers.

The API enqueues upload jobs in Redis and returns immediately. A separate
worker process can dequeue and process the jobs independently of the request
lifecycle, which makes the upload pipeline safe for serverless and multi-worker deployments.

Production Deployment & Fail-Fast Policy:
- In production / staging, Redis is mandatory for job durability, multi-worker coordination,
  and process restart resilience. Falling back to an in-memory queue in production is strictly
  forbidden as it leads to silent job loss and process isolation issues.
- If Redis is unavailable or REDIS_URL is missing in production, UploadJobQueue raises
  a RuntimeError immediately on startup.
- Development, testing, and local environments allow an explicit in-memory fallback with warning logs.
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
from backend.core.exceptions import ValidationError
from backend.core.validation import validate_mime_and_bytes, validate_docx_archive_safety
from backend.storage.upload_tasks import get_upload_task_storage

logger = logging.getLogger(__name__)

READY_QUEUE_KEY = "upload_jobs:ready"
SCHEDULED_ZSET_KEY = "upload_jobs:scheduled"
DEAD_LETTER_KEY = "upload_jobs:dead"
DEFAULT_MAX_RETRIES = 3
DEFAULT_RETRY_BACKOFF_SECONDS = 2
ALLOWED_IN_MEMORY_ENVIRONMENTS = {"development", "testing", "local"}


def get_current_environment(explicit_env: Optional[str] = None) -> str:
    """Retrieve the current environment name.

    Prefers explicit parameter if provided, otherwise checks project configuration system
    (backend.config.get_settings()), and falls back to os.getenv("ENVIRONMENT").
    """
    if explicit_env and explicit_env.strip():
        return explicit_env.strip().lower()

    try:
        from backend.config import get_settings
        settings = get_settings()
        if hasattr(settings, "environment") and hasattr(settings.environment, "environment"):
            return settings.environment.environment.lower()
    except Exception:
        pass

    env = os.getenv("ENVIRONMENT", "production")
    return env.strip().lower()


def get_redis_url(explicit_url: Optional[str] = None) -> Optional[str]:
    """Retrieve the configured Redis URL.

    Prefers explicit parameter if provided, otherwise checks project configuration system
    (backend.config.get_settings()), and falls back to os.getenv("REDIS_URL").
    """
    if explicit_url and explicit_url.strip():
        return explicit_url.strip()

    try:
        from backend.config import get_settings
        settings = get_settings()
        if hasattr(settings, "database") and getattr(settings.database, "redis_url", None):
            return settings.database.redis_url
    except Exception:
        pass

    url = os.getenv("REDIS_URL")
    return url.strip() if url else None


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
    """Queue for managing background document upload processing jobs.

    In production or staging environments, Redis is strictly required for multi-worker
    coordination, durability across process restarts, and reliable job execution.
    If Redis is unconfigured or unreachable in production, initialization fails fast
    with a critical log and a RuntimeError.

    In non-production environments (development, testing, local), if Redis is unavailable
    or unconfigured, the queue logs an explicit warning and falls back to process-local memory.
    """

    def __init__(
        self,
        redis_url: Optional[str] = None,
        environment: Optional[str] = None,
    ):
        self.environment = get_current_environment(environment)
        self.redis_url = get_redis_url(redis_url)
        self._client = None
        self._in_memory: list[str] = []
        self._scheduled: list[tuple[float, str]] = []
        self._dead_letters: list[str] = []

        is_non_prod = self.environment in ALLOWED_IN_MEMORY_ENVIRONMENTS

        if self.redis_url:
            try:
                self._client = redis.from_url(self.redis_url, decode_responses=True)
                self._client.ping()
                logger.info(
                    f"UploadJobQueue initialized successfully using Redis backend "
                    f"[environment='{self.environment}', redis_url_configured=True]"
                )
            except Exception as exc:
                fallback_reason = f"Redis connection failed: {exc}"
                if is_non_prod:
                    logger.warning(
                        f"Redis unavailable ({fallback_reason}). "
                        f"Using in-memory upload queue ({self.environment} mode only). Jobs are not durable. "
                        f"[environment='{self.environment}', redis_url_configured=True]"
                    )
                    self._client = None
                else:
                    logger.critical(
                        f"Failed to connect to Redis at '{self.redis_url}' in '{self.environment}' environment: {exc}. "
                        f"UploadJobQueue cannot operate safely without Redis."
                    )
                    raise RuntimeError(
                        f"Redis connection failed for UploadJobQueue in environment '{self.environment}' (URL: '{self.redis_url}'): {exc}. "
                        f"UploadJobQueue cannot operate safely in production using an in-memory fallback. "
                        f"Please verify REDIS_URL environment variable is correct and Redis server is accessible."
                    ) from exc
        else:
            fallback_reason = "REDIS_URL environment variable is not configured"
            if is_non_prod:
                logger.warning(
                    f"Redis unavailable ({fallback_reason}). "
                    f"Using in-memory upload queue ({self.environment} mode only). Jobs are not durable. "
                    f"[environment='{self.environment}', redis_url_configured=False]"
                )
                self._client = None
            else:
                logger.critical(
                    f"REDIS_URL is not configured in '{self.environment}' environment. "
                    f"UploadJobQueue cannot operate safely without Redis."
                )
                raise RuntimeError(
                    f"REDIS_URL environment variable is required for UploadJobQueue in environment '{self.environment}'. "
                    f"UploadJobQueue cannot operate safely in production using an in-memory queue. "
                    f"Please set REDIS_URL (e.g., redis://localhost:6379/0) in your production environment configuration."
                )

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


def _cleanup_temp_file(job: UploadJob) -> None:
    """
    Delete the job's temp file if it still exists. Safe to call more than
    once (e.g. once from a no-retry caller's default cleanup, and never
    again) since it no-ops if the file is already gone.
    """
    try:
        if os.path.exists(job.file_path):
            os.unlink(job.file_path)
            logger.info(f"[{job.task_id}] Cleaned up temporary upload file")
    except OSError as cleanup_error:
        logger.warning(f"[{job.task_id}] Temporary file cleanup failed: {cleanup_error}")


async def process_upload_job_async(job: UploadJob, *, cleanup_on_exit: bool = True) -> None:
    """
    Process one upload job and update task state.

    cleanup_on_exit controls whether the temp file is deleted when this
    function returns or raises. Defaults to True for callers with no retry
    logic (e.g. the in-process dev/test worker thread started directly from
    main.py's /upload handler). Callers that implement their own retry
    logic — currently only run_upload_worker_loop_async — must pass
    cleanup_on_exit=False and manage cleanup themselves: a failed attempt
    that's about to be retried needs job.file_path to still exist, since
    the retry reuses the same UploadJob (and therefore the same path).
    Deleting it unconditionally here previously caused every retry to fail
    immediately with a spurious FileNotFoundError instead of getting a
    genuine second attempt at the original failure.
    """
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

        is_pdf = job.file_extension == ".pdf" or job.content_prefix.startswith(b"%PDF-")
        if is_pdf:
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

        # A PDF that yields effectively no text is almost always a scanned or
        # image-only document. LegalEase has no OCR engine, so extraction
        # returns an empty string that would silently produce a blank
        # analysis. Surface a clear, actionable failure instead.
        if is_pdf and len(extracted_text.strip()) < 10:
            raise ValidationError(
                "This PDF appears to be scanned or image-only, so no text could be "
                "extracted. Please upload a text-based PDF, DOCX, or TXT file, or run "
                "the document through OCR first."
            )

        task_storage.mark_completed(job.task_id, {"filename": job.filename, "text": extracted_text})
        logger.info(f"[{job.task_id}] Upload processing complete")
    except Exception as exc:
        if hasattr(exc, "detail"):
            message = exc.detail
        elif isinstance(exc, ValidationError):
            # Validation failures carry a user-actionable message (e.g. a
            # scanned/image-only PDF that produced no extractable text).
            message = str(exc)
        else:
            message = "Failed to process the uploaded document. Please try again or use a different file."
        task_storage.mark_failed(job.task_id, message)
        logger.error(f"[{job.task_id}] Upload processing failed: {exc}", exc_info=True)
        raise
    finally:
        if cleanup_on_exit:
            _cleanup_temp_file(job)


async def _handle_one_job(job: UploadJob, queue: "UploadJobQueue", storage) -> None:
    """
    Process a single dequeued job and decide its fate: mark complete and
    clean up on success; schedule a retry (preserving the temp file) on a
    recoverable failure; or dead-letter and clean up once retries are
    exhausted. Extracted from run_upload_worker_loop_async's while-loop
    body so this per-job logic is directly unit-testable without needing
    to drive (and break out of) an infinite loop.
    """
    try:
        await process_upload_job_async(job, cleanup_on_exit=False)
        _cleanup_temp_file(job)
    except Exception as exc:
        job.attempts += 1
        if job.attempts < job.max_retries:
            storage.update_status(job.task_id, "queued")
            storage.update_progress(job.task_id, 0)
            queue.schedule_retry(job)
            # Intentionally no cleanup here — the retried attempt reuses
            # this same job.file_path.
        else:
            storage.mark_failed(job.task_id, str(getattr(exc, "detail", exc)))
            queue.dead_letter(job, str(exc))
            _cleanup_temp_file(job)


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
        await _handle_one_job(job, queue, storage)


def run_upload_worker_loop(poll_interval_seconds: float = 1.0) -> None:
    import asyncio

    asyncio.run(run_upload_worker_loop_async(poll_interval_seconds=poll_interval_seconds))
