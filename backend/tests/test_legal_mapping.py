import pytest
from httpx import AsyncClient, ASGITransport
from backend.main import app


@pytest.mark.asyncio
async def test_legal_map_keyword_match():
    payload = {"description": "My phone was stolen and someone robbed me on the street"}
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        r = await ac.post("/legal/map", json=payload)
        assert r.status_code == 200
        data = r.json()
        assert "suggestions" in data
        assert isinstance(data["suggestions"], list)
        assert len(data["suggestions"]) >= 1


@pytest.mark.asyncio
async def test_legal_map_empty_description():
    payload = {"description": " "}
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        r = await ac.post("/legal/map", json=payload)
        assert r.status_code == 422 or r.status_code == 200
