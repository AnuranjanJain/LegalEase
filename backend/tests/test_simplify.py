import os
import pytest
from unittest.mock import patch
from fastapi import status
from httpx import AsyncClient, ASGITransport
from backend.main import app, key_limiter
from backend.core.exceptions import ProviderError, TimeoutError
from backend.auth import AuthIdentity
import backend.config

# Reset settings before any tests
backend.config._settings = None

# Set JWT_SECRET_KEY for tests
os.environ["JWT_SECRET_KEY"] = "testing-secret-key-1234567890-abcdef"


@pytest.mark.asyncio
async def test_simplify_endpoint_success():
    """Test simplify endpoint returns simplified text in stub mode or successful AI invocation"""
    headers = {"x-api-key": "dev-token"}
    payload = {"text": "The party of the first part hereby agrees to indemnify the party of the second part."}

    os.environ["ALLOW_DEV"] = "true"
    os.environ["STUB_MODE"] = "true"

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        r = await ac.post("/api/simplify", json=payload, headers=headers)
        assert r.status_code == status.HTTP_200_OK
        data = r.json()
        assert "simplifiedText" in data
        # In stub mode, should return stub response, otherwise fallback message
        assert "[STUB SIMPLIFY RESPONSE]" in data["simplifiedText"] or "legal-assistant fallback" in data["simplifiedText"].lower()

    if "ALLOW_DEV" in os.environ:
        del os.environ["ALLOW_DEV"]
    if "STUB_MODE" in os.environ:
        del os.environ["STUB_MODE"]


@pytest.mark.asyncio
async def test_simplify_endpoint_validation_errors():
    """Test simplify endpoint rejects empty text and excessive length input"""
    headers = {"x-api-key": "dev-token"}
    os.environ["ALLOW_DEV"] = "true"

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Empty text
        r = await ac.post("/api/simplify", json={"text": ""}, headers=headers)
        assert r.status_code == status.HTTP_400_BAD_REQUEST
        assert r.json()["error"] == "validation_error"

        # Whitespace only
        r = await ac.post("/api/simplify", json={"text": "   "}, headers=headers)
        assert r.status_code == status.HTTP_400_BAD_REQUEST
        assert r.json()["error"] == "validation_error"

        # Oversized text
        with patch("backend.core.validation.MAX_SIMPLIFY_INPUT_CHARS", 10):
            r = await ac.post("/api/simplify", json={"text": "This clause is too long for the mocked max size limit"}, headers=headers)
            assert r.status_code == status.HTTP_400_BAD_REQUEST
            assert r.json()["error"] == "validation_error"

    if "ALLOW_DEV" in os.environ:
        del os.environ["ALLOW_DEV"]


@pytest.mark.asyncio
async def test_simplify_endpoint_ai_failure():
    """Test simplify endpoint propagates AI provider error correctly"""
    headers = {"x-api-key": "dev-token"}
    payload = {"text": "Indemnification agreement clause details."}
    
    os.environ["ALLOW_DEV"] = "true"
    os.environ["STUB_MODE"] = "false"
    
    # Mock simplify_clause to raise ProviderError (graceful_degradation = False)
    with patch("backend.services.ai_service.ai_service.simplify_clause", side_effect=ProviderError("Connection failed")), \
         patch("backend.services.ai_service.ai_service.graceful_degradation", False):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            r = await ac.post("/api/simplify", json=payload, headers=headers)
            assert r.status_code == status.HTTP_502_BAD_GATEWAY
            assert r.json()["error"] == "provider_error"

    if "ALLOW_DEV" in os.environ:
        del os.environ["ALLOW_DEV"]


@pytest.mark.asyncio
async def test_simplify_endpoint_rate_limiting():
    """Test rate limiting on simplify endpoint"""
    os.environ["ALLOW_DEV"] = "true"
    
    # Create a clean limiter specifically for testing this endpoint
    from backend.utils.limiter import create_rate_limiter
    import backend.main
    
    orig_limiter = backend.main.key_limiter
    backend.main.key_limiter = create_rate_limiter(2, 60)
    
    headers = {"x-api-key": "dev-token"}
    payload = {"text": "Clause to test rate limiting."}
    
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            # First two calls should be allowed (will respond with 200 or 503 depending on Bytez client, but won't be 429)
            r1 = await ac.post("/api/simplify", json=payload, headers=headers)
            assert r1.status_code in [200, 503]
            
            r2 = await ac.post("/api/simplify", json=payload, headers=headers)
            assert r2.status_code in [200, 503]
            
            # Third call must be rate-limited (429)
            r3 = await ac.post("/api/simplify", json=payload, headers=headers)
            assert r3.status_code == status.HTTP_429_TOO_MANY_REQUESTS
            assert r3.json()["detail"] == "Rate limit exceeded"
    finally:
        backend.main.key_limiter = orig_limiter
        if "ALLOW_DEV" in os.environ:
            del os.environ["ALLOW_DEV"]
