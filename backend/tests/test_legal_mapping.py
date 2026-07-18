import os
import pytest
from httpx import AsyncClient, ASGITransport
from backend.main import app

os.environ["JWT_SECRET_KEY"] = "testing-secret-key-1234567890-abcdef"
os.environ["ALLOW_DEV"] = "true"

AUTH_HEADERS = {"x-api-key": "dev-token"}


@pytest.mark.asyncio
async def test_legal_map_requires_auth():
    """/legal/map now requires authentication, unlike before."""
    payload = {"description": "My phone was stolen and someone robbed me on the street"}
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        r = await ac.post("/legal/map", json=payload)
        assert r.status_code == 401


@pytest.mark.asyncio
async def test_legal_map_keyword_match():
    payload = {"description": "My phone was stolen and someone robbed me on the street"}
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        r = await ac.post("/legal/map", json=payload, headers=AUTH_HEADERS)
        assert r.status_code == 200
        data = r.json()
        assert "suggestions" in data
        assert isinstance(data["suggestions"], list)
        assert len(data["suggestions"]) >= 1


@pytest.mark.asyncio
async def test_legal_map_empty_description():
    payload = {"description": " "}
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        r = await ac.post("/legal/map", json=payload, headers=AUTH_HEADERS)
        assert r.status_code == 422 or r.status_code == 200
