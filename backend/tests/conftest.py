import os
os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"
try:
    import torch
except Exception:
    pass

from pathlib import Path
import sys
import pytest

# Automatically set test environment variables before any tests or imports execute
# Set JWT_SECRET_KEY first and ensure it's always present
os.environ["JWT_SECRET_KEY"] = "testing-secret-key-1234567890-abcdef"
os.environ["ALLOW_DEV"] = "true"
os.environ["STUB_MODE"] = "true"
os.environ["MAX_MODEL_INPUT_CHARS"] = "15000"
os.environ["DATABASE_URL"] = "sqlite:///./test_legalease.db"
os.environ["API_KEYS"] = "test-api-key,dev-token"
os.environ["DEV_API_KEY"] = "dev-token"

ROOT = Path(__file__).resolve().parents[2]
root_path = str(ROOT)
if root_path not in sys.path:
    sys.path.insert(0, root_path)


@pytest.fixture(autouse=True)
def reset_settings():
    """Reset global settings before each test to ensure clean state."""
    import backend.config
    backend.config._settings = None
    yield
    backend.config._settings = None
