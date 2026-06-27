import os
import uuid
import pytest
from fastapi import status
from httpx import AsyncClient, ASGITransport
import backend.config

# Reset settings before any tests
backend.config._settings = None

# Import app (JWT_SECRET_KEY is set by conftest.py)
from backend.main import app


@pytest.mark.asyncio
async def test_health_endpoint_ok():
    """Test health endpoint when services are available"""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        r = await ac.get("/health")
        assert r.status_code == 200
        data = r.json()
        assert "status" in data
        assert data["status"] in ["ok", "degraded"]
        assert "uptime_seconds" in data
        assert isinstance(data["uptime_seconds"], (int, float))
        assert data["uptime_seconds"] >= 0
        assert "timestamp" in data
        assert "T" in data["timestamp"]  # ISO 8601 format
        assert "details" in data
        assert isinstance(data["details"], dict)
        assert "database" in data["details"]


@pytest.mark.asyncio
async def test_signup_endpoint_creates_account():
    email = f"test+{uuid.uuid4()}@example.com"
    payload = {"email": email, "password": "securePass123"}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        r = await ac.post("/auth/signup", json=payload)
        assert r.status_code == status.HTTP_201_CREATED
        data = r.json()
        assert data["access_token"]
        assert data["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_signup_endpoint_fails_for_duplicate_email():
    email = f"test+{uuid.uuid4()}@example.com"
    payload = {"email": email, "password": "securePass123"}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        first_response = await ac.post("/auth/signup", json=payload)
        assert first_response.status_code == status.HTTP_201_CREATED

        second_response = await ac.post("/auth/signup", json=payload)
        assert second_response.status_code == status.HTTP_409_CONFLICT
        assert second_response.json()["detail"] == "Email already exists"


@pytest.mark.asyncio
async def test_health_endpoint_degraded():
    """Test health endpoint returns 503 when service is degraded"""
    from unittest.mock import patch

    with patch("backend.main.ai_service") as mock_ai:
        mock_ai.check_health.return_value = {"status": "degraded"}
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            r = await ac.get("/health")
            assert r.status_code == 503
            data = r.json()
            assert data["detail"]["status"] == "degraded"
            assert "uptime_seconds" in data["detail"]
            assert "timestamp" in data["detail"]


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
        assert r.status_code == 202
        data = r.json()
        assert "task_id" in data
    
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
        # Will return 202
        assert r.status_code == 202
    
    if "ALLOW_DEV" in os.environ:
        del os.environ["ALLOW_DEV"]


@pytest.mark.asyncio
async def test_upload_endpoint_with_docx():
    """Test upload endpoint with a DOCX file"""
    import os
    import io
    import zipfile
    from unittest.mock import Mock, patch
    
    os.environ["ALLOW_DEV"] = "true"

    mock_doc = Mock()
    mock_para = Mock()
    mock_para.text = "Sample mock docx content."
    mock_doc.paragraphs = [mock_para]
    
    headers = {"x-api-key": "dev-token"}
    
    # Create a valid minimal ZIP archive to pass safety checks
    docx_io = io.BytesIO()
    with zipfile.ZipFile(docx_io, "w") as zf:
        zf.writestr("word/document.xml", "mock XML content")
    content = docx_io.getvalue()
    
    files = {"file": ("sample.docx", content, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")}

    with patch("backend.main.DocxDocument", return_value=mock_doc):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            r = await ac.post("/upload", files=files, headers=headers)
            assert r.status_code == 202
            data = r.json()
            assert "task_id" in data

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

    os.environ["ALLOW_DEV"] = "true"
    os.environ["JWT_SECRET_KEY"] = "testing-secret-key-1234567890-abcdef"

    # Patch the limiter directly
    orig_limiter = backend.main.key_limiter
    backend.main.key_limiter = backend.main.SimpleRateLimiter(2, 60)

    headers = {"x-api-key": "dev-token"}
    payload = {"message": "Hello"}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # First two requests should succeed (or return 503 if AI unavailable)
        r1 = await ac.post("/chat", json=payload, headers=headers)
        r2 = await ac.post("/chat", json=payload, headers=headers)
        
        # Third request should be rate limited
        r3 = await ac.post("/chat", json=payload, headers=headers)
        assert r3.status_code == 429
    
    if "RATE_LIMIT_KEY_CALLS" in os.environ:
        del os.environ["RATE_LIMIT_KEY_CALLS"]
    if "RATE_LIMIT_PERIOD" in os.environ:
        del os.environ["RATE_LIMIT_PERIOD"]

    try:
        async with AsyncClient(app=app, base_url="http://test") as ac:
            r1 = await ac.post("/chat", json=payload, headers=headers)
            r2 = await ac.post("/chat", json=payload, headers=headers)

            r3 = await ac.post("/chat", json=payload, headers=headers)
            assert r3.status_code == 429
    finally:
        backend.main.key_limiter = orig_limiter
        if "ALLOW_DEV" in os.environ:
            del os.environ["ALLOW_DEV"]

