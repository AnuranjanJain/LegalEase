import pytest
import os
from fastapi import status
from httpx import AsyncClient, ASGITransport
from backend.main import app


@pytest.mark.asyncio
async def test_health_endpoint_ok():
    """Test health endpoint when services are available"""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        r = await ac.get("/health")
        assert r.status_code == 200
        data = r.json()
        assert "status" in data
        assert "details" in data
        assert "bytez" in data["details"]


@pytest.mark.asyncio
async def test_chat_endpoint_with_valid_key():
    """Test chat endpoint with valid API key"""
    import os
    os.environ["ALLOW_DEV"] = "true"
    
    headers = {"x-api-key": "dev-token"}
    payload = {"message": "Hello"}
    
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        r = await ac.post("/chat", json=payload, headers=headers)
        # Will return 503 if Bytez client not initialized, but should not be auth error
        assert r.status_code in [200, 503]
    
    if "ALLOW_DEV" in os.environ:
        del os.environ["ALLOW_DEV"]


@pytest.mark.asyncio
async def test_chat_endpoint_with_context():
    """Test chat endpoint with document context"""
    import os
    os.environ["ALLOW_DEV"] = "true"
    
    headers = {"x-api-key": "dev-token"}
    payload = {
        "message": "What does this mean?",
        "context": "Document context here"
    }
    
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        r = await ac.post("/chat", json=payload, headers=headers)
        assert r.status_code in [200, 503]
    
    if "ALLOW_DEV" in os.environ:
        del os.environ["ALLOW_DEV"]


@pytest.mark.asyncio
async def test_summarize_endpoint_with_valid_key():
    """Test summarize endpoint with valid API key"""
    import os
    os.environ["ALLOW_DEV"] = "true"
    
    headers = {"x-api-key": "dev-token"}
    payload = {"text": "This is a sample text to summarize."}
    
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        r = await ac.post("/summarize", json=payload, headers=headers)
        assert r.status_code in [200, 503]
    
    if "ALLOW_DEV" in os.environ:
        del os.environ["ALLOW_DEV"]


@pytest.mark.asyncio
async def test_upload_endpoint_with_text_file():
    """Test upload endpoint with a text file"""
    import os
    os.environ["ALLOW_DEV"] = "true"
    
    headers = {"x-api-key": "dev-token"}
    content = b"This is a sample text file content."
    files = {"file": ("sample.txt", content, "text/plain")}
    
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        r = await ac.post("/upload", files=files, headers=headers)
        assert r.status_code == 200
        data = r.json()
        assert "filename" in data
        assert "text" in data
        assert data["filename"] == "sample.txt"
    
    if "ALLOW_DEV" in os.environ:
        del os.environ["ALLOW_DEV"]


@pytest.mark.asyncio
async def test_upload_endpoint_with_pdf():
    """Test upload endpoint with a PDF file (mock)"""
    import os
    os.environ["ALLOW_DEV"] = "true"
    
    headers = {"x-api-key": "dev-token"}
    # Mock PDF content
    content = b"%PDF-1.4\n%mock pdf content"
    files = {"file": ("sample.pdf", content, "application/pdf")}
    
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        r = await ac.post("/upload", files=files, headers=headers)
        # Will return 503 if PyMuPDF not available, or 400 for invalid PDF
        assert r.status_code in [200, 503, 400]
    
    if "ALLOW_DEV" in os.environ:
        del os.environ["ALLOW_DEV"]


@pytest.mark.asyncio
async def test_upload_endpoint_with_docx():
    """Test upload endpoint with a DOCX file"""
    import os
    from unittest.mock import patch, Mock
    os.environ["ALLOW_DEV"] = "true"
    
    from unittest.mock import Mock, patch
    mock_doc = Mock()
    mock_para = Mock()
    mock_para.text = "Sample mock docx content."
    mock_doc.paragraphs = [mock_para]
    
    headers = {"x-api-key": "dev-token"}
    # Mock DOCX content (starts with PK magic bytes)
    content = b"PK\x03\x04\x14\x00\x00\x00\x08\x00"
    files = {"file": ("sample.docx", content, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")}
    

    with patch("backend.main.DocxDocument", return_value=mock_doc):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            r = await ac.post("/upload", files=files, headers=headers)
            assert r.status_code == 200
            data = r.json()
            assert "filename" in data
            assert data["filename"] == "sample.docx"
            assert "text" in data
            assert data["text"] == "Sample mock docx content."

    
    if "ALLOW_DEV" in os.environ:
        del os.environ["ALLOW_DEV"]



@pytest.mark.asyncio
async def test_upload_endpoint_unsupported_file():
    """Test upload endpoint with unsupported file type"""
    import os
    os.environ["ALLOW_DEV"] = "true"
    
    headers = {"x-api-key": "dev-token"}
    # Binary content that's not PDF, DOCX, or text
    content = b"\x00\x01\x02\x03\x04\x05"
    files = {"file": ("sample.bin", content, "application/octet-stream")}
    
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        r = await ac.post("/upload", files=files, headers=headers)
        assert r.status_code == 400
    
    if "ALLOW_DEV" in os.environ:
        del os.environ["ALLOW_DEV"]


@pytest.mark.asyncio
async def test_rate_limiting_on_chat():
    """Test that rate limiting works on chat endpoint"""
    import backend.main
    
    # Patch the limiter directly
    orig_limiter = backend.main.key_limiter
    backend.main.key_limiter = backend.main.SimpleRateLimiter(2, 60)
    
    headers = {"x-api-key": "dev-token"}
    payload = {"message": "Hello"}
    

    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            # First two requests should succeed (or return 503 if AI unavailable)
            r1 = await ac.post("/chat", json=payload, headers=headers)
            r2 = await ac.post("/chat", json=payload, headers=headers)
            
            # Third request should be rate limited
            r3 = await ac.post("/chat", json=payload, headers=headers)
            assert r3.status_code == 429
    finally:
        backend.main.key_limiter = orig_limiter
        
    if "ALLOW_DEV" in os.environ:
        del os.environ["ALLOW_DEV"]
    if "RATE_LIMIT_KEY_CALLS" in os.environ:
        del os.environ["RATE_LIMIT_KEY_CALLS"]
    if "RATE_LIMIT_PERIOD" in os.environ:
        del os.environ["RATE_LIMIT_PERIOD"]

