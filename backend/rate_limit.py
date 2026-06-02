import time
import os
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

class SimpleRateLimiter:
    def __init__(self, limit_env_key: str = None, default_calls: int = None, period_env_key: str = None, default_period: int = None, calls: int = None, period: int = None):
        if calls is not None:
            self.limit_env_key = None
            self.default_calls = calls
        else:
            self.limit_env_key = limit_env_key
            self.default_calls = default_calls

        if period is not None:
            self.period_env_key = None
            self.default_period = period
        else:
            self.period_env_key = period_env_key
            self.default_period = default_period

        self.storage = {}

    def get_calls(self) -> int:
        if self.limit_env_key is None:
            return self.default_calls
        return int(os.getenv(self.limit_env_key, str(self.default_calls)))

    def get_period(self) -> int:
        if self.period_env_key is None:
            return self.default_period
        return int(os.getenv(self.period_env_key, str(self.default_period)))

    def is_allowed(self, key: str) -> bool:
        now = time.time()
        period = self.get_period()
        calls = self.get_calls()
        
        window = now - period
        arr = self.storage.get(key, [])
        # prune
        arr = [t for t in arr if t > window]
        if len(arr) >= calls:
            self.storage[key] = arr
            return False
        arr.append(now)
        self.storage[key] = arr
        return True

ip_limiter = SimpleRateLimiter("RATE_LIMIT_IP_CALLS", 60, "RATE_LIMIT_PERIOD", 60)
key_limiter = SimpleRateLimiter("RATE_LIMIT_KEY_CALLS", 30, "RATE_LIMIT_PERIOD", 60)

class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        try:
            ip = request.client.host if request.client else "unknown"
        except Exception:
            ip = "unknown"

        if not ip_limiter.is_allowed(ip):
            return JSONResponse(
                status_code=429, 
                content={"detail": "Rate limit exceeded for IP"}
            )

        auth = request.headers.get("authorization") or ""
        api_key = ""
        if auth.lower().startswith("bearer "):
            api_key = auth.split(" ", 1)[1].strip()
        else:
            api_key = request.headers.get("x-api-key", "").strip()

        if api_key:
            if not key_limiter.is_allowed(api_key):
                return JSONResponse(
                    status_code=429, 
                    content={"detail": "Rate limit exceeded for API key"}
                )

        response = await call_next(request)
        return response
