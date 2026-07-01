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
