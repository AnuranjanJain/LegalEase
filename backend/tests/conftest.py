import os
from pathlib import Path
import sys

# Automatically set test environment variables before any tests or imports execute
os.environ["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY", "testing-secret-key-1234567890-abcdef")
os.environ["ALLOW_DEV"] = "true"
os.environ["STUB_MODE"] = "true"
os.environ["MAX_MODEL_INPUT_CHARS"] = "15000"
os.environ["DATABASE_URL"] = "sqlite:///./test_legalease.db"

ROOT = Path(__file__).resolve().parents[2]
root_path = str(ROOT)
if root_path not in sys.path:
    sys.path.insert(0, root_path)
