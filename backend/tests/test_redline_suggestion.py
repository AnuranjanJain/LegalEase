import os
import pytest
from unittest.mock import patch
from fastapi import status
from httpx import AsyncClient, ASGITransport
from backend.main import app
from backend.services.ai_service import ai_service
import backend.config

# Reset settings before any tests
backend.config._settings = None

# Set JWT_SECRET_KEY for tests
os.environ["JWT_SECRET_KEY"] = "testing-secret-key-1234567890-abcdef"


@pytest.mark.asyncio
async def test_ai_service_suggest_redline_stub_mode():
    """suggest_redline returns a deterministic stub response in stub mode"""
    with patch.dict(os.environ, {"STUB_MODE": "true", "JWT_SECRET_KEY": "testing-secret-key-1234567890-abcdef"}):
        backend.config._settings = None
        ai_service.__init__()
        suggestion = await ai_service.suggest_redline("The company may terminate at any time.")
        assert "[STUB REDLINE SUGGESTION]" in suggestion
        ai_service.__init__()


@pytest.mark.asyncio
async def test_ai_service_suggest_redline_empty_input():
    """suggest_redline returns empty string for empty/whitespace-only input"""
    assert await ai_service.suggest_redline("") == ""
    assert await ai_service.suggest_redline("   ") == ""


@pytest.mark.asyncio
async def test_ai_service_suggest_redline_includes_risk_reason_and_jurisdiction():
    """The prompt sent to the model must include the risk reason and jurisdiction context"""
    captured = {}

    async def fake_execute(model_name, messages):
        captured["prompt"] = messages[0]["content"]

        class Output:
            output = "Revised clause text."
        return Output()

    with patch.object(ai_service, "stub_mode", False):
        with patch.object(ai_service, "_execute_with_retry_and_timeout", side_effect=fake_execute):
            result = await ai_service.suggest_redline(
                "The company may terminate at any time without notice.",
                risk_reason="Unilateral termination rights.",
                jurisdiction="California Law",
            )
            assert result == "Revised clause text."
            assert "Unilateral termination rights." in captured["prompt"]
            assert "California Law" in captured["prompt"]


@pytest.mark.asyncio
async def test_ai_service_suggest_redline_graceful_degradation():
    """If the AI call fails and graceful_degradation is on, a fallback message is returned"""
    with patch.object(ai_service, "stub_mode", False):
        with patch.object(ai_service, "graceful_degradation", True):
            with patch.object(ai_service, "_execute_with_retry_and_timeout", side_effect=RuntimeError("boom")):
                result = await ai_service.suggest_redline("Some clause text.")
                assert "manually" in result.lower()


@pytest.mark.asyncio
async def test_ai_service_suggest_redline_raises_without_graceful_degradation():
    """If graceful_degradation is off, the original exception propagates"""
    with patch.object(ai_service, "stub_mode", False):
        with patch.object(ai_service, "graceful_degradation", False):
            with patch.object(ai_service, "_execute_with_retry_and_timeout", side_effect=RuntimeError("boom")):
                with pytest.raises(RuntimeError):
                    await ai_service.suggest_redline("Some clause text.")


@pytest.mark.asyncio
async def test_suggest_redline_endpoint_success():
    """POST /legal/suggest-redline returns original and suggested text"""
    headers = {"x-api-key": "dev-token"}
    payload = {"clause": "The company may terminate this agreement at any time without notice."}

    with patch.dict(os.environ, {"STUB_MODE": "true", "ALLOW_DEV": "true", "JWT_SECRET_KEY": "testing-secret-key-1234567890-abcdef"}):
        backend.config._settings = None
        ai_service.__init__()
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            r = await ac.post("/legal/suggest-redline", json=payload, headers=headers)
            assert r.status_code == status.HTTP_200_OK
            data = r.json()
            assert data["original_text"] == payload["clause"]
            assert "[STUB REDLINE SUGGESTION]" in data["suggested_text"]
        ai_service.__init__()


@pytest.mark.asyncio
async def test_suggest_redline_endpoint_validation_error():
    """POST /legal/suggest-redline rejects an empty clause with 422"""
    headers = {"x-api-key": "dev-token"}

    with patch.dict(os.environ, {"STUB_MODE": "true", "ALLOW_DEV": "true", "JWT_SECRET_KEY": "testing-secret-key-1234567890-abcdef"}):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            r = await ac.post("/legal/suggest-redline", json={"clause": ""}, headers=headers)
            assert r.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


@pytest.mark.asyncio
async def test_suggest_redline_endpoint_rate_limiting():
    """POST /legal/suggest-redline is rate limited per identity"""
    from backend.utils.limiter import SimpleRateLimiter
    import backend.routers.legal_routes as legal_routes

    orig_limiter = legal_routes._redline_limiter
    legal_routes._redline_limiter = SimpleRateLimiter(1, 60)

    headers = {"x-api-key": "dev-token"}
    payload = {"clause": "Clause to test rate limiting."}

    try:
        with patch.dict(os.environ, {"STUB_MODE": "true", "ALLOW_DEV": "true", "JWT_SECRET_KEY": "testing-secret-key-1234567890-abcdef"}):
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
                r1 = await ac.post("/legal/suggest-redline", json=payload, headers=headers)
                assert r1.status_code == status.HTTP_200_OK

                r2 = await ac.post("/legal/suggest-redline", json=payload, headers=headers)
                assert r2.status_code == status.HTTP_429_TOO_MANY_REQUESTS
    finally:
        legal_routes._redline_limiter = orig_limiter


@pytest.mark.asyncio
async def test_suggest_redline_endpoint_ai_failure_returns_502():
    """POST /legal/suggest-redline returns 502 (not a raw error leak) when the AI call fails"""
    headers = {"x-api-key": "dev-token"}
    payload = {"clause": "Clause that triggers an AI failure."}

    with patch.dict(os.environ, {"ALLOW_DEV": "true", "JWT_SECRET_KEY": "testing-secret-key-1234567890-abcdef"}):
        with patch.object(ai_service, "stub_mode", False):
            with patch.object(ai_service, "graceful_degradation", False):
                with patch.object(ai_service, "_execute_with_retry_and_timeout", side_effect=RuntimeError("Internal provider secret detail")):
                    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
                        r = await ac.post("/legal/suggest-redline", json=payload, headers=headers)
                        assert r.status_code == status.HTTP_502_BAD_GATEWAY
                        assert "Internal provider secret detail" not in r.text
