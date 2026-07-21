import os
import pytest
from httpx import AsyncClient, ASGITransport

import backend.main as main
from backend.main import app
from backend.utils.limiter import SimpleRateLimiter

os.environ["JWT_SECRET_KEY"] = "testing-secret-key-1234567890-abcdef"
os.environ["ALLOW_DEV"] = "true"

AUTH_HEADERS = {"x-api-key": "dev-token"}


@pytest.mark.asyncio
async def test_summarize_endpoint_is_rate_limited():
    """/summarize was missing the key_limiter check that /chat and /simplify already had."""
    orig_limiter = main.key_limiter
    main.key_limiter = SimpleRateLimiter(1, 60)

    payload = {"text": "This is a clause about indemnification and liability terms."}

    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            r1 = await ac.post("/summarize", json=payload, headers=AUTH_HEADERS)
            assert r1.status_code != 429

            r2 = await ac.post("/summarize", json=payload, headers=AUTH_HEADERS)
            assert r2.status_code == 429
            assert r2.json()["detail"] == "Rate limit exceeded"
    finally:
        main.key_limiter = orig_limiter


@pytest.mark.asyncio
async def test_legal_map_endpoint_is_rate_limited():
    """AI endpoints in legal_routes.py previously had no rate limiting at all."""
    import backend.routers.legal_routes as legal_routes

    orig_limiter = legal_routes._legal_ai_limiter
    legal_routes._legal_ai_limiter = SimpleRateLimiter(1, 60)

    payload = {"description": "My phone was stolen and someone robbed me on the street"}

    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            r1 = await ac.post("/legal/map", json=payload, headers=AUTH_HEADERS)
            assert r1.status_code != 429

            r2 = await ac.post("/legal/map", json=payload, headers=AUTH_HEADERS)
            assert r2.status_code == 429
    finally:
        legal_routes._legal_ai_limiter = orig_limiter


@pytest.mark.asyncio
async def test_legal_extract_entities_requires_auth():
    """/legal/extract-entities previously had no auth requirement at all."""
    payload = {"text": "This agreement is between Acme Corp and Jane Doe."}
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        r = await ac.post("/legal/extract-entities", json=payload)
        assert r.status_code == 401


@pytest.mark.asyncio
async def test_legal_web_search_requires_auth():
    """/legal/web-search previously had no auth requirement at all."""
    payload = {"query": "governing law clause enforceability"}
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        r = await ac.post("/legal/web-search", json=payload)
        assert r.status_code == 401


@pytest.mark.asyncio
async def test_legal_agent_requires_auth():
    """/legal/agent previously had no auth requirement at all."""
    payload = {"query": "Summarize the liability clauses", "documents": []}
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        r = await ac.post("/legal/agent", json=payload)
        assert r.status_code == 401


@pytest.mark.asyncio
async def test_legal_hybrid_search_requires_auth():
    """/legal/hybrid-search previously had no auth requirement at all."""
    payload = {"query": "termination clause", "documents": ["Sample document text."]}
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        r = await ac.post("/legal/hybrid-search", json=payload)
        assert r.status_code == 401


@pytest.mark.asyncio
async def test_legal_extract_deadlines_is_rate_limited():
    """/legal/extract-deadlines was missing the _check_rate_limit call that other AI endpoints have."""
    import backend.routers.legal_routes as legal_routes

    orig_limiter = legal_routes._legal_ai_limiter
    legal_routes._legal_ai_limiter = SimpleRateLimiter(1, 60)

    payload = {"text": "The contract must be signed by December 31, 2025 and payment is due within 30 days."}

    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            r1 = await ac.post("/legal/extract-deadlines", json=payload, headers=AUTH_HEADERS)
            assert r1.status_code != 429

            r2 = await ac.post("/legal/extract-deadlines", json=payload, headers=AUTH_HEADERS)
            assert r2.status_code == 429
            assert r2.json()["detail"] == "Rate limit exceeded"
    finally:
        legal_routes._legal_ai_limiter = orig_limiter


@pytest.mark.asyncio
async def test_legal_extract_deadlines_consistency_with_other_ai_endpoints():
    """Verify /legal/extract-deadlines uses the same shared rate limiter as other AI endpoints."""
    import backend.routers.legal_routes as legal_routes

    orig_limiter = legal_routes._legal_ai_limiter
    legal_routes._legal_ai_limiter = SimpleRateLimiter(1, 60)

    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            # First call to extract-deadlines should succeed
            r1 = await ac.post("/legal/extract-deadlines", json={"text": "Payment due in 30 days"}, headers=AUTH_HEADERS)
            assert r1.status_code != 429

            # Second call to extract-deadlines should be rate limited
            r2 = await ac.post("/legal/extract-deadlines", json={"text": "Payment due in 30 days"}, headers=AUTH_HEADERS)
            assert r2.status_code == 429

            # Other AI endpoints should also be rate limited by the same limiter
            r3 = await ac.post("/legal/map", json={"description": "Test description"}, headers=AUTH_HEADERS)
            assert r3.status_code == 429
    finally:
        legal_routes._legal_ai_limiter = orig_limiter
