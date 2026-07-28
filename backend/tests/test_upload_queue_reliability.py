"""
Tests for UploadJobQueue initialization reliability, production fail-fast policies,
environment detection, structured logging, and fallback behaviors.
"""

import os
import logging
from unittest.mock import patch, MagicMock

import pytest

from backend.services.upload_job_queue import UploadJobQueue, build_upload_job


class TestUploadJobQueueReliability:
    """Test suite covering UploadJobQueue environment policies and fail-fast behavior."""

    def test_redis_available_and_healthy(self, caplog):
        """Test successful Redis initialization when REDIS_URL is provided and reachable."""
        mock_client = MagicMock()
        mock_client.ping.return_value = True

        with caplog.at_level(logging.INFO):
            with patch("redis.from_url", return_value=mock_client):
                queue = UploadJobQueue(
                    redis_url="redis://localhost:6379/0",
                    environment="production",
                )
                assert queue.using_redis is True
                assert queue.environment == "production"
                assert queue.redis_url == "redis://localhost:6379/0"
                mock_client.ping.assert_called_once()
                assert "UploadJobQueue initialized successfully using Redis backend" in caplog.text

    def test_redis_unavailable_in_development_enables_in_memory(self, caplog):
        """Test that missing REDIS_URL in development falls back to in-memory with a warning."""
        with caplog.at_level(logging.WARNING):
            queue = UploadJobQueue(redis_url=None, environment="development")
            assert queue.using_redis is False
            assert queue.environment == "development"
            assert "Redis unavailable" in caplog.text
            assert "development mode only" in caplog.text

    def test_redis_connection_error_in_development_enables_in_memory(self, caplog):
        """Test that Redis ping failure in development falls back to in-memory with a warning."""
        with caplog.at_level(logging.WARNING):
            with patch("redis.from_url", side_effect=ConnectionError("Connection refused")):
                queue = UploadJobQueue(
                    redis_url="redis://localhost:6379/0",
                    environment="development",
                )
                assert queue.using_redis is False
                assert queue.environment == "development"
                assert "Redis unavailable" in caplog.text
                assert "Connection refused" in caplog.text

    def test_redis_unavailable_in_testing_enables_in_memory(self, caplog):
        """Test that missing REDIS_URL in testing falls back to in-memory with a warning."""
        with caplog.at_level(logging.WARNING):
            queue = UploadJobQueue(redis_url=None, environment="testing")
            assert queue.using_redis is False
            assert queue.environment == "testing"
            assert "Redis unavailable" in caplog.text
            assert "testing mode only" in caplog.text

    def test_redis_unavailable_in_local_enables_in_memory(self, caplog):
        """Test that missing REDIS_URL in local environment falls back to in-memory with a warning."""
        with caplog.at_level(logging.WARNING):
            queue = UploadJobQueue(redis_url=None, environment="local")
            assert queue.using_redis is False
            assert queue.environment == "local"
            assert "Redis unavailable" in caplog.text
            assert "local mode only" in caplog.text

    def test_redis_missing_in_production_fails_fast(self, caplog):
        """Test that missing REDIS_URL in production raises RuntimeError and logs CRITICAL."""
        with caplog.at_level(logging.CRITICAL):
            with pytest.raises(RuntimeError) as exc_info:
                UploadJobQueue(redis_url=None, environment="production")

            error_msg = str(exc_info.value)
            assert "REDIS_URL environment variable is required" in error_msg
            assert "production" in error_msg
            assert "cannot operate safely" in error_msg
            assert "REDIS_URL is not configured in 'production' environment" in caplog.text

    def test_redis_ping_failure_in_production_fails_fast(self, caplog):
        """Test that Redis ping failure in production raises RuntimeError and logs CRITICAL."""
        with caplog.at_level(logging.CRITICAL):
            with patch("redis.from_url", side_effect=ConnectionError("Network unreachable")):
                with pytest.raises(RuntimeError) as exc_info:
                    UploadJobQueue(
                        redis_url="redis://prod-redis:6379/0",
                        environment="production",
                    )

            error_msg = str(exc_info.value)
            assert "Redis connection failed" in error_msg
            assert "Network unreachable" in error_msg
            assert "cannot operate safely in production" in error_msg
            assert "Failed to connect to Redis" in caplog.text

    def test_redis_missing_in_staging_fails_fast(self, caplog):
        """Test that staging environment (equivalent production mode) fails fast when Redis is missing."""
        with caplog.at_level(logging.CRITICAL):
            with pytest.raises(RuntimeError) as exc_info:
                UploadJobQueue(redis_url=None, environment="staging")

            assert "REDIS_URL environment variable is required" in str(exc_info.value)

    def test_environment_read_from_config(self):
        """Test environment detection through central config system when explicit environment is not passed."""
        mock_settings = MagicMock()
        mock_settings.environment.environment = "production"
        mock_settings.database.redis_url = None

        with patch("backend.config.get_settings", return_value=mock_settings):
            with pytest.raises(RuntimeError) as exc_info:
                UploadJobQueue()

            assert "production" in str(exc_info.value)

    def test_environment_read_from_os_env(self):
        """Test fallback environment detection via os.environ when get_settings is unavailable."""
        with patch.dict(os.environ, {"ENVIRONMENT": "production", "REDIS_URL": ""}):
            with patch("backend.config.get_settings", side_effect=ImportError("no config")):
                with pytest.raises(RuntimeError) as exc_info:
                    UploadJobQueue()

                assert "production" in str(exc_info.value)

    def test_in_memory_queue_operations(self):
        """Test basic queue operations when operating in development fallback mode."""
        queue = UploadJobQueue(redis_url=None, environment="development")

        job = build_upload_job(
            task_id="task-123",
            file_path="/tmp/test.pdf",
            filename="test.pdf",
            content_type="application/pdf",
            file_extension=".pdf",
            content_prefix=b"%PDF-1.4",
        )

        assert queue.enqueue(job) is True
        reserved = queue.reserve(timeout_seconds=0)
        assert reserved is not None
        assert reserved.task_id == "task-123"
        assert reserved.filename == "test.pdf"

    def test_redis_queue_operations(self):
        """Test queue operations delegate correctly to Redis when connected."""
        mock_client = MagicMock()
        mock_client.ping.return_value = True

        job = build_upload_job(
            task_id="task-456",
            file_path="/tmp/doc.pdf",
            filename="doc.pdf",
            content_type="application/pdf",
            file_extension=".pdf",
            content_prefix=b"%PDF-1.4",
        )

        with patch("redis.from_url", return_value=mock_client):
            queue = UploadJobQueue(
                redis_url="redis://localhost:6379/0",
                environment="development",
            )
            assert queue.enqueue(job) is True
            mock_client.rpush.assert_called_once()
