import os
import pytest
from fastapi import status
from httpx import AsyncClient, ASGITransport
from backend.main import app

@pytest.mark.asyncio
async def test_export_pdf_success():
    """Test successful generation of PDF with summary and chat history."""
    headers = {"x-api-key": "dev-token"}
    payload = {
        "title": "Lease Audit Report",
        "summary": "This is a clean document summary for the lease audit. **Bold term** and *italic term* are present.",
        "chatHistory": [
            {"role": "user", "content": "What is the monthly rent?"},
            {"role": "assistant", "content": "The monthly rent is **$2,450.00 USD**."}
        ]
    }
    
    os.environ["ALLOW_DEV"] = "true"
    
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        r = await ac.post("/api/export/pdf", json=payload, headers=headers)
        assert r.status_code == status.HTTP_200_OK
        assert r.headers["content-type"] == "application/pdf"
        assert "attachment" in r.headers["content-disposition"]
        
        # Verify it has PDF magic bytes header
        content = r.content
        assert content.startswith(b"%PDF-")

    if "ALLOW_DEV" in os.environ:
        del os.environ["ALLOW_DEV"]


@pytest.mark.asyncio
async def test_export_pdf_validation_failures():
    """Test validation errors for empty title, empty body, and incorrect formats."""
    headers = {"x-api-key": "dev-token"}
    os.environ["ALLOW_DEV"] = "true"

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. Empty title
        r1 = await ac.post("/api/export/pdf", json={
            "title": "",
            "summary": "Some summary"
        }, headers=headers)
        assert r1.status_code == status.HTTP_400_BAD_REQUEST
        assert "validation_error" in r1.json()["error"]

        # 2. Both summary and chat empty
        r2 = await ac.post("/api/export/pdf", json={
            "title": "No Content Report",
            "summary": "",
            "chatHistory": []
        }, headers=headers)
        assert r2.status_code == status.HTTP_400_BAD_REQUEST
        assert "validation_error" in r2.json()["error"]

        # 3. Invalid chat message role
        r3 = await ac.post("/api/export/pdf", json={
            "title": "Invalid Role Report",
            "chatHistory": [
                {"role": "system", "content": "You are a helpful assistant."}
            ]
        }, headers=headers)
        assert r3.status_code == status.HTTP_400_BAD_REQUEST
        assert "validation_error" in r3.json()["error"]

        # 4. Empty chat message content
        r4 = await ac.post("/api/export/pdf", json={
            "title": "Empty Msg Content",
            "chatHistory": [
                {"role": "user", "content": ""}
            ]
        }, headers=headers)
        assert r4.status_code == status.HTTP_400_BAD_REQUEST
        assert "validation_error" in r4.json()["error"]

    if "ALLOW_DEV" in os.environ:
        del os.environ["ALLOW_DEV"]


@pytest.mark.asyncio
async def test_export_pdf_unauthorized():
    """Test that requests lacking auth credentials are rejected."""
    payload = {
        "title": "Unauthenticated Report",
        "summary": "Summary text..."
    }
    
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        r = await ac.post("/api/export/pdf", json=payload)
        assert r.status_code == status.HTTP_401_UNAUTHORIZED
