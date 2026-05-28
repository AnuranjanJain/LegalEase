import time
import os
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

class SimpleRateLimiter:
    def __init__(self, calls: int, period: int):
        self.calls = calls
        self.period = period
        self.storage = {}

    def is_allowed(self, key: str) -> bool:
        now = time.time()
        window = now - self.period
        arr = self.storage.get(key, [])
        # prune
        arr = [t for t in arr if t > window]
        if len(arr) >= self.calls:
            self.storage[key] = arr
            return False
        arr.append(now)
        self.storage[key] = arr
        return True

ip_limiter = SimpleRateLimiter(
    int(os.getenv("RATE_LIMIT_IP_CALLS", "60")), 
    int(os.getenv("RATE_LIMIT_PERIOD", "60"))
)
key_limiter = SimpleRateLimiter(
    int(os.getenv("RATE_LIMIT_KEY_CALLS", "30")), 
    int(os.getenv("RATE_LIMIT_PERIOD", "60"))
)

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
