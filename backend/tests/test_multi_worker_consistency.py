"""
Multi-worker consistency tests for upload task storage.

These tests simulate multi-worker scenarios to verify that task state
is consistent across different worker processes when using Redis storage.
"""

import pytest
import time
import threading
from unittest.mock import MagicMock, patch
import json

from backend.storage.upload_tasks import (
    RedisTaskStorage,
    UploadTaskStorage,
    reset_upload_task_storage,
)


class TestMultiWorkerConsistency:
    """Test suite for multi-worker consistency scenarios."""

    @pytest.fixture
    def shared_redis_client(self):
        """Create a shared mock Redis client to simulate distributed storage."""
        client = MagicMock()
        client.ping.return_value = True

        # Simulate shared storage using a dict
        shared_storage = {}
        client.storage = shared_storage

        def mock_setex(key, ttl, value):
            shared_storage[key] = value

        def mock_get(key):
            return shared_storage.get(key)

        def mock_ttl(key):
            return 3600 if key in shared_storage else -2

        def mock_exists(key):
            return 1 if key in shared_storage else 0

        def mock_delete(*keys):
            for key in keys:
                shared_storage.pop(key, None)

        def mock_keys(pattern):
            return [k for k in shared_storage.keys() if pattern.replace("*", "") in k]

        client.setex = mock_setex
        client.get = mock_get
        client.ttl = mock_ttl
        client.exists = mock_exists
        client.delete = mock_delete
        client.keys = mock_keys

        return client

    def test_worker_a_creates_worker_b_reads(self, shared_redis_client):
        """Test Worker A creates task, Worker B reads it successfully."""
        with patch('backend.storage.upload_tasks.redis.from_url', return_value=shared_redis_client):
            # Worker A creates task
            worker_a_storage = RedisTaskStorage("redis://localhost:6379/0")
            worker_a_storage.client = shared_redis_client

            task_id = "multi-worker-task-1"
            worker_a_storage.create_task(task_id, status="processing", progress=0)

            # Worker B reads task (simulating different process)
            worker_b_storage = RedisTaskStorage("redis://localhost:6379/0")
            worker_b_storage.client = shared_redis_client

            task = worker_b_storage.get_task(task_id)
            assert task is not None
            assert task["status"] == "processing"
            assert task["progress"] == 0

    def test_worker_a_updates_worker_b_reads(self, shared_redis_client):
        """Test Worker A updates progress, Worker B sees the update."""
        with patch('backend.storage.upload_tasks.redis.from_url', return_value=shared_redis_client):
            # Worker A creates and updates task
            worker_a_storage = RedisTaskStorage("redis://localhost:6379/0")
            worker_a_storage.client = shared_redis_client

            task_id = "multi-worker-task-2"
            worker_a_storage.create_task(task_id, status="processing", progress=0)
            worker_a_storage.update_progress(task_id, 50)

            # Worker B reads task
            worker_b_storage = RedisTaskStorage("redis://localhost:6379/0")
            worker_b_storage.client = shared_redis_client

            task = worker_b_storage.get_task(task_id)
            assert task["progress"] == 50

    def test_worker_a_completes_worker_b_reads(self, shared_redis_client):
        """Test Worker A completes task, Worker B sees completion."""
        with patch('backend.storage.upload_tasks.redis.from_url', return_value=shared_redis_client):
            # Worker A processes and completes task
            worker_a_storage = RedisTaskStorage("redis://localhost:6379/0")
            worker_a_storage.client = shared_redis_client

            task_id = "multi-worker-task-3"
            worker_a_storage.create_task(task_id, status="processing", progress=0)
            worker_a_storage.mark_completed(task_id, {"filename": "test.pdf", "text": "processed"})

            # Worker B reads task
            worker_b_storage = RedisTaskStorage("redis://localhost:6379/0")
            worker_b_storage.client = shared_redis_client

            task = worker_b_storage.get_task(task_id)
            assert task["status"] == "done"
            assert task["progress"] == 100
            assert task["result"]["filename"] == "test.pdf"

    def test_concurrent_workers_same_task(self, shared_redis_client):
        """Test multiple workers updating the same task concurrently."""
        with patch('backend.storage.upload_tasks.redis.from_url', return_value=shared_redis_client):
            # Create task
            worker_a_storage = RedisTaskStorage("redis://localhost:6379/0")
            worker_a_storage.client = shared_redis_client

            task_id = "concurrent-task-1"
            worker_a_storage.create_task(task_id, status="processing", progress=0)

            # Simulate multiple workers updating progress
            def worker_update_progress(worker_id, progress_values):
                worker_storage = RedisTaskStorage("redis://localhost:6379/0")
                worker_storage.client = shared_redis_client
                for progress in progress_values:
                    worker_storage.update_progress(task_id, progress)
                    time.sleep(0.01)

            threads = []
            for i in range(3):
                progress_values = [20 + i * 20, 40 + i * 20, 60 + i * 20]
                thread = threading.Thread(target=worker_update_progress, args=(i, progress_values))
                threads.append(thread)
                thread.start()

            for thread in threads:
                thread.join()

            # Final state should be consistent
            final_storage = RedisTaskStorage("redis://localhost:6379/0")
            final_storage.client = shared_redis_client
            task = final_storage.get_task(task_id)
            assert task is not None
            assert task["status"] == "processing"
            # Progress should be one of the updated values
            assert 0 <= task["progress"] <= 100

    def test_multiple_workers_different_tasks(self, shared_redis_client):
        """Test multiple workers creating different tasks simultaneously."""
        with patch('backend.storage.upload_tasks.redis.from_url', return_value=shared_redis_client):
            def worker_create_tasks(worker_id, task_count):
                worker_storage = RedisTaskStorage("redis://localhost:6379/0")
                worker_storage.client = shared_redis_client
                for i in range(task_count):
                    task_id = f"worker-{worker_id}-task-{i}"
                    worker_storage.create_task(task_id, status="processing", progress=0)

            threads = []
            for i in range(5):
                thread = threading.Thread(target=worker_create_tasks, args=(i, 3))
                threads.append(thread)
                thread.start()

            for thread in threads:
                thread.join()

            # Verify all tasks exist
            final_storage = RedisTaskStorage("redis://localhost:6379/0")
            final_storage.client = shared_redis_client

            for worker_id in range(5):
                for i in range(3):
                    task_id = f"worker-{worker_id}-task-{i}"
                    task = final_storage.get_task(task_id)
                    assert task is not None
                    assert task["status"] == "processing"

    def test_worker_a_fails_worker_b_handles(self, shared_redis_client):
        """Test Worker A marks task as failed, Worker B handles failure state."""
        with patch('backend.storage.upload_tasks.redis.from_url', return_value=shared_redis_client):
            # Worker A fails task
            worker_a_storage = RedisTaskStorage("redis://localhost:6379/0")
            worker_a_storage.client = shared_redis_client

            task_id = "failed-task-1"
            worker_a_storage.create_task(task_id, status="processing", progress=50)
            worker_a_storage.mark_failed(task_id, "Processing error")

            # Worker B reads task
            worker_b_storage = RedisTaskStorage("redis://localhost:6379/0")
            worker_b_storage.client = shared_redis_client

            task = worker_b_storage.get_task(task_id)
            assert task["status"] == "failed"
            assert task["progress"] == 0
            assert task["result"]["error"] == "Processing error"

    def test_task_persistence_across_restarts(self, shared_redis_client):
        """Test that tasks persist across simulated worker restarts."""
        with patch('backend.storage.upload_tasks.redis.from_url', return_value=shared_redis_client):
            # Worker 1 creates task
            worker1_storage = RedisTaskStorage("redis://localhost:6379/0")
            worker1_storage.client = shared_redis_client

            task_id = "persistent-task-1"
            worker1_storage.create_task(task_id, status="processing", progress=30)

            # Simulate worker restart (new storage instance)
            worker2_storage = RedisTaskStorage("redis://localhost:6379/0")
            worker2_storage.client = shared_redis_client

            # Task should still exist
            task = worker2_storage.get_task(task_id)
            assert task is not None
            assert task["status"] == "processing"
            assert task["progress"] == 30

    def test_distributed_status_polling(self, shared_redis_client):
        """Test that status polling works across distributed workers."""
        with patch('backend.storage.upload_tasks.redis.from_url', return_value=shared_redis_client):
            # Worker A creates task
            worker_a_storage = RedisTaskStorage("redis://localhost:6379/0")
            worker_a_storage.client = shared_redis_client

            task_id = "polling-task-1"
            worker_a_storage.create_task(task_id, status="processing", progress=0)

            # Worker B polls status (simulating frontend request to different worker)
            worker_b_storage = RedisTaskStorage("redis://localhost:6379/0")
            worker_b_storage.client = shared_redis_client

            task = worker_b_storage.get_task(task_id)
            assert task["status"] == "processing"
            assert task["progress"] == 0

            # Worker A updates progress
            worker_a_storage.update_progress(task_id, 50)

            # Worker B polls again
            task = worker_b_storage.get_task(task_id)
            assert task["progress"] == 50

            # Worker A completes task
            worker_a_storage.mark_completed(task_id, {"filename": "test.pdf", "text": "done"})

            # Worker B polls final status
            task = worker_b_storage.get_task(task_id)
            assert task["status"] == "done"
            assert task["progress"] == 100

    def test_task_cleanup_distributed(self, shared_redis_client):
        """Test that task cleanup works across distributed workers."""
        with patch('backend.storage.upload_tasks.redis.from_url', return_value=shared_redis_client):
            # Worker A creates task with short TTL
            worker_a_storage = RedisTaskStorage("redis://localhost:6379/0")
            worker_a_storage.client = shared_redis_client

            task_id = "cleanup-task-1"
            worker_a_storage.create_task(task_id, status="processing", progress=0, ttl_seconds=1)

            # Task exists initially
            worker_b_storage = RedisTaskStorage("redis://localhost:6379/0")
            worker_b_storage.client = shared_redis_client
            assert worker_b_storage.task_exists(task_id) is True

            # Wait for TTL expiration
            time.sleep(1.1)

            # Task should be expired (Redis handles this automatically)
            # In our mock, we simulate this by checking if key exists
            # In real Redis, the key would be auto-deleted
            assert shared_redis_client.exists(f"upload_task:{task_id}") == 0

    def test_horizontal_scaling_scenario(self, shared_redis_client):
        """Test a complete horizontal scaling scenario."""
        with patch('backend.storage.upload_tasks.redis.from_url', return_value=shared_redis_client):
            # Simulate load balancer distributing requests to different workers
            workers = []
            for i in range(3):
                worker_storage = RedisTaskStorage("redis://localhost:6379/0")
                worker_storage.client = shared_redis_client
                workers.append(worker_storage)

            # Worker 1 receives upload request
            task_id = "scaling-task-1"
            workers[0].create_task(task_id, status="processing", progress=0)

            # Worker 2 receives status poll
            task = workers[1].get_task(task_id)
            assert task["status"] == "processing"

            # Worker 1 updates progress
            workers[0].update_progress(task_id, 50)

            # Worker 3 receives status poll
            task = workers[2].get_task(task_id)
            assert task["progress"] == 50

            # Worker 2 completes task
            workers[1].mark_completed(task_id, {"filename": "test.pdf", "text": "done"})

            # Worker 3 receives final status poll
            task = workers[2].get_task(task_id)
            assert task["status"] == "done"

            # All workers see consistent state
            for worker in workers:
                task = worker.get_task(task_id)
                assert task["status"] == "done"
                assert task["progress"] == 100


class TestInMemoryMultiWorkerLimitations:
    """Test suite demonstrating in-memory storage limitations in multi-worker scenarios."""

    def test_in_memory_storage_not_shared(self):
        """Test that in-memory storage is not shared between instances."""
        from backend.storage.upload_tasks import InMemoryTaskStorage

        # Worker A creates task
        worker_a_storage = InMemoryTaskStorage()
        worker_a_storage.create_task("task-1", status="processing", progress=0)

        # Worker B has separate storage instance
        worker_b_storage = InMemoryTaskStorage()

        # Worker B cannot see Worker A's task
        task = worker_b_storage.get_task("task-1")
        assert task is None

    def test_in_memory_worker_restart_loses_state(self):
        """Test that in-memory storage loses state on worker restart."""
        from backend.storage.upload_tasks import InMemoryTaskStorage

        # Worker creates task
        worker_storage = InMemoryTaskStorage()
        worker_storage.create_task("task-1", status="processing", progress=50)

        # Simulate worker restart (new storage instance)
        new_worker_storage = InMemoryTaskStorage()

        # Task is lost
        task = new_worker_storage.get_task("task-1")
        assert task is None

    def test_redis_vs_in_memory_comparison(self, shared_redis_client):
        """Compare Redis vs in-memory storage behavior."""
        from backend.storage.upload_tasks import InMemoryTaskStorage

        task_id = "comparison-task-1"

        # Redis storage - shared
        with patch('backend.storage.upload_tasks.redis.from_url', return_value=shared_redis_client):
            redis_worker_a = RedisTaskStorage("redis://localhost:6379/0")
            redis_worker_a.client = shared_redis_client
            redis_worker_a.create_task(task_id, status="processing", progress=0)

            redis_worker_b = RedisTaskStorage("redis://localhost:6379/0")
            redis_worker_b.client = shared_redis_client
            assert redis_worker_b.get_task(task_id) is not None

        # In-memory storage - not shared
        mem_worker_a = InMemoryTaskStorage()
        mem_worker_a.create_task(task_id, status="processing", progress=0)

        mem_worker_b = InMemoryTaskStorage()
        assert mem_worker_b.get_task(task_id) is None
