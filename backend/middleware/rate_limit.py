from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from backend.utils.limiter import create_rate_limiter
import ipaddress
from backend.config import get_settings

# Get configuration from centralized settings
settings = get_settings()
rate_config = settings.rate_limit

RATE_LIMIT_PERIOD = rate_config.rate_limit_period
RATE_LIMIT_IP_CALLS = rate_config.rate_limit_ip_calls
TRUST_PROXY_HEADERS = rate_config.trust_proxy_headers

ip_limiter = create_rate_limiter(RATE_LIMIT_IP_CALLS, RATE_LIMIT_PERIOD)
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
        if isinstance(result, dict):
            allowed = bool(result.get("allowed", False))
            remaining = int(result.get("remaining", 0) or 0)
            retry_after = int(result.get("retry_after", 0) or 0)
        else:
            allowed = bool(result)
            remaining = RATE_LIMIT_IP_CALLS if allowed else 0
            retry_after = 0

        if not allowed:
            return JSONResponse(
                status_code=429,
                content={
                    "detail": "Rate limit exceeded"
                },
                headers={
                    "X-RateLimit-Limit": str(RATE_LIMIT_IP_CALLS),
                    "X-RateLimit-Remaining": "0",
                    "Retry-After": str(retry_after),
                }
            )
        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(RATE_LIMIT_IP_CALLS)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        return response