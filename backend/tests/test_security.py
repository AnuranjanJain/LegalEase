import pytest
from fastapi import status
from httpx import AsyncClient

from backend.main import app


@pytest.mark.asyncio
async def test_missing_api_key_rejected():
    async with AsyncClient(app=app, base_url="http://test") as ac:
        r = await ac.post("/chat", json={"message": "hi"})
        assert r.status_code in (401, 403)


@pytest.mark.asyncio
async def test_upload_too_large_rejected():
    # Use dev token for auth header
    headers = {"x-api-key": "dev-token"}
    big = b"0" * (26 * 1024 * 1024)
    files = {"file": ("big.pdf", big, "application/pdf")}
    async with AsyncClient(app=app, base_url="http://test") as ac:
        r = await ac.post("/upload", files=files, headers=headers)
        assert r.status_code in (413, 400)
