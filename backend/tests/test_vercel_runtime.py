"""Regression checks for serverless-safe runtime behavior."""

import json
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]


def test_vercel_function_is_explicitly_configured_and_bundles_backend_data():
    config = json.loads((PROJECT_ROOT / "vercel.json").read_text(encoding="utf-8"))
    function = config["functions"]["api/index.py"]

    assert config["framework"] == "vite"
    assert config["buildCommand"] == "npm run build"
    assert config["outputDirectory"] == "dist"
    assert "backend/data/**" in function["includeFiles"]


def test_semantic_cache_does_not_load_ml_model_at_import_time():
    from backend.services.cache_service import SemanticCache

    cache = SemanticCache()

    assert cache.model is None
    assert cache._model_load_attempted is False


def test_serverless_detection_accepts_direct_and_nested_vercel_flags():
    from backend.database import is_serverless_environment

    assert is_serverless_environment("1") is True
    assert is_serverless_environment(None, "true") is True
    assert is_serverless_environment("0", "false", None) is False


def test_redis_health_checks_use_unique_keys():
    from backend.utils.limiter import RedisStorage

    class FakeRedis:
        def __init__(self):
            self.keys = []

        def ping(self):
            return True

        def set(self, key, value, ex):
            self.keys.append(key)
            return True

        def get(self, key):
            return "test"

        def delete(self, key):
            return True

    first = RedisStorage.__new__(RedisStorage)
    first.client = FakeRedis()
    second = RedisStorage.__new__(RedisStorage)
    second.client = FakeRedis()

    assert first.health_check()["healthy"] is True
    assert second.health_check()["healthy"] is True
    assert first.client.keys[0] != second.client.keys[0]
