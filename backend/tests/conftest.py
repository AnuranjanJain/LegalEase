import os
os.environ["JWT_SECRET_KEY"] = "test-jwt-secret-key-at-least-32-bytes-long-for-testing"
os.environ["ENVIRONMENT"] = "development"
os.environ["ALLOW_DEV"] = "true"
os.environ["DEV_API_KEY"] = "dev-token"

from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
root_path = str(ROOT)
if root_path not in sys.path:
    sys.path.insert(0, root_path)