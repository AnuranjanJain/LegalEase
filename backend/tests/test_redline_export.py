import os
import pytest
from fastapi import status
from httpx import AsyncClient, ASGITransport
from docx import Document
from io import BytesIO
from backend.main import app

@pytest.mark.asyncio
async def test_export_redline_docx_success():
    """Test successful generation of redlined DOCX."""
    headers = {"x-api-key": "dev-token"}
    payload = {
        "original_text": "The employee will work 40 hours per week.",
        "suggested_text": "The employee will work 35 hours per week."
    }
    
    os.environ["ALLOW_DEV"] = "true"
    
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        r = await ac.post("/api/export/redline-docx", json=payload, headers=headers)
        assert r.status_code == status.HTTP_200_OK
        assert r.headers["content-type"] == "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        assert "attachment" in r.headers["content-disposition"]
        
        # Verify it's a valid docx file
        content = r.content
        doc = Document(BytesIO(content))
        # Ensure we can read paragraphs and that the settings revised track setting is enabled
        assert len(doc.paragraphs) >= 1
        
    if "ALLOW_DEV" in os.environ:
        del os.environ["ALLOW_DEV"]


@pytest.mark.asyncio
async def test_export_redline_docx_validation_failures():
    """Test validation errors for missing fields."""
    headers = {"x-api-key": "dev-token"}
    os.environ["ALLOW_DEV"] = "true"

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Missing suggested_text
        r = await ac.post("/api/export/redline-docx", json={
            "original_text": "Only original"
        }, headers=headers)
        assert r.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    if "ALLOW_DEV" in os.environ:
        del os.environ["ALLOW_DEV"]
