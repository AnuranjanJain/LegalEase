from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from backend.utils.limiter import SimpleRateLimiter
import os

RATE_LIMIT_PERIOD = int(os.getenv("RATE_LIMIT_PERIOD", "60"))
RATE_LIMIT_IP_CALLS = int(os.getenv("RATE_LIMIT_IP_CALLS", "60"))

ip_limiter=SimpleRateLimiter(
    RATE_LIMIT_IP_CALLS,
    RATE_LIMIT_PERIOD
)
EXCLUDED_PATHS = {
    "/health",
    "/docs",
    "/openapi.json",
    "/redoc",
}
class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.url.path in EXCLUDED_PATHS:
            return await call_next(request)
        ip = request.client.host if request.client else "unknown"    
        result = ip_limiter.check(ip)
        if not result["allowed"]:
            return JSONResponse(
                status_code=429,
                content={
                    "detail": "Rate limit exceeded"
                },
                headers={
                    "X-RateLimit-Limit": str(RATE_LIMIT_IP_CALLS),
                    "X-RateLimit-Remaining": "0",
                    "Retry-After": str(result["retry_after"]),
                }
            )
        response=await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(RATE_LIMIT_IP_CALLS)
        response.headers["X-RateLimit-Remaining"] = str(result["remaining"])
        return response    