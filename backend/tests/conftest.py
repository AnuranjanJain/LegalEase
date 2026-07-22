import os
os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"
try:
    import torch
except Exception:
    pass

from pathlib import Path
import sys

# Automatically set test environment variables before any tests or imports execute
os.environ["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY", "testing-secret-key-1234567890-abcdef")
os.environ["ALLOW_DEV"] = "true"
os.environ["STUB_MODE"] = "true"
os.environ["MAX_MODEL_INPUT_CHARS"] = "15000"
os.environ["DATABASE_URL"] = "sqlite:///./test_legalease.db"
os.environ["ENVIRONMENT"] = "testing"

ROOT = Path(__file__).resolve().parents[2]
root_path = str(ROOT)
if root_path not in sys.path:
    sys.path.insert(0, root_path)


import pytest

@pytest.fixture(autouse=True)
def isolate_test_environment():
    import os
    import backend.config as config
    
    # Backup os.environ and settings cache
    old_environ = dict(os.environ)
    old_settings = config._settings
    
    yield
    
    # Restore os.environ and settings cache
    os.environ.clear()
    os.environ.update(old_environ)
    config._settings = old_settings

@pytest.fixture(autouse=True)
def clear_rate_limiters():
    # Clear main key limiter
    try:
        from backend.main import key_limiter
        key_limiter.storage.clear()
    except Exception:
        pass

    # Clear compare routes limiter
    try:
        from backend.routers.compare_routes import _compare_limiter
        _compare_limiter.storage.clear()
    except Exception:
        pass

    # Clear IP limiter in middleware
    try:
        from backend.middleware.rate_limit import ip_limiter
        ip_limiter.storage.clear()
    except Exception:
        pass

    # Clear auth rate limiters
    try:
        from backend.middleware import auth_rate_limit
        for attr in [
            "login_ip_limiter", "login_email_limiter", 
            "signup_ip_limiter", "signup_email_limiter", 
            "verification_ip_limiter", "verification_email_limiter", 
            "failed_login_limiter"
        ]:
            limiter = getattr(auth_rate_limit, attr, None)
            if limiter:
                limiter.storage.clear()
    except Exception:
        pass

    # Clear legal AI limiter
    try:
        from backend.routers import legal_routes
        legal_routes._legal_ai_limiter.storage.clear()
    except Exception:
        pass

