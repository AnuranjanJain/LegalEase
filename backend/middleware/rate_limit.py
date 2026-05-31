from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from backend.utils.limiter import SimpleRateLimiter
import ipaddress
import os

RATE_LIMIT_PERIOD = int(os.getenv("RATE_LIMIT_PERIOD", "60"))
RATE_LIMIT_IP_CALLS = int(os.getenv("RATE_LIMIT_IP_CALLS", "60"))
TRUST_PROXY_HEADERS = os.getenv("TRUST_PROXY_HEADERS", "false").lower() in ("1", "true", "yes")

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


def get_client_ip(request: Request) -> str:
    direct_ip = request.client.host if request.client else "unknown"
    if not TRUST_PROXY_HEADERS:
        return direct_ip

    forwarded_for = request.headers.get("x-forwarded-for", "").strip()
    if not forwarded_for:
        return direct_ip

    candidate = forwarded_for.split(",", 1)[0].strip()
    if not candidate:
        return direct_ip

    try:
        ipaddress.ip_address(candidate)
    except ValueError:
        return direct_ip

    return candidate


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.url.path in EXCLUDED_PATHS:
            return await call_next(request)
        ip = get_client_ip(request)
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