import pytest
from fastapi import status
from httpx import AsyncClient, ASGITransport
from backend.main import app


@pytest.mark.integration
@pytest.mark.asyncio
async def test_complete_document_upload_and_summarize_flow():
    """Test the complete flow of uploading a document and summarizing it"""
    import os
    os.environ["ALLOW_DEV"] = "true"
    
    headers = {"x-api-key": "dev-token"}
    
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Step 1: Upload a document
        content = b"This is a legal document about contract terms and conditions."
        files = {"file": ("contract.txt", content, "text/plain")}
        upload_response = await ac.post("/upload", files=files, headers=headers)
        
        assert upload_response.status_code == 200
        upload_data = upload_response.json()
        assert "text" in upload_data
        assert "filename" in upload_data
        
        # Step 2: Summarize the uploaded document
        summarize_payload = {"text": upload_data["text"]}
        summarize_response = await ac.post("/summarize", json=summarize_payload, headers=headers)
        
        # May return 503 if AI service unavailable, but should not be auth error
        assert summarize_response.status_code in [200, 503]
        
        if summarize_response.status_code == 200:
            summary_data = summarize_response.json()
            assert "summary" in summary_data
    
    if "ALLOW_DEV" in os.environ:
        del os.environ["ALLOW_DEV"]


@pytest.mark.integration
@pytest.mark.asyncio
async def test_document_upload_and_chat_flow():
    """Test uploading a document and then asking questions about it"""
    import os
    os.environ["ALLOW_DEV"] = "true"
    
    headers = {"x-api-key": "dev-token"}
    
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Step 1: Upload a document
        content = b"This employment contract states that the employee will work 40 hours per week."
        files = {"file": ("employment.txt", content, "text/plain")}
        upload_response = await ac.post("/upload", files=files, headers=headers)
        
        assert upload_response.status_code == 200
        upload_data = upload_response.json()
        
        # Step 2: Ask a question about the document
        chat_payload = {
            "message": "What are the working hours?",
            "context": upload_data["text"]
        }
        chat_response = await ac.post("/chat", json=chat_payload, headers=headers)
        
        # May return 503 if AI service unavailable
        assert chat_response.status_code in [200, 503]
        
        if chat_response.status_code == 200:
            chat_data = chat_response.json()
            assert "response" in chat_data
    
    if "ALLOW_DEV" in os.environ:
        del os.environ["ALLOW_DEV"]


@pytest.mark.integration
@pytest.mark.asyncio
async def test_health_check_and_service_availability():
    """Test health check endpoint and verify service status"""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/health")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "status" in data
        assert "details" in data
        assert "bytez" in data["details"]
        
        # Status should be either "ok" or "degraded"
        assert data["status"] in ["ok", "degraded"]


@pytest.mark.integration
@pytest.mark.asyncio
async def test_multiple_document_uploads():
    """Test uploading multiple documents in sequence"""
    import os
    os.environ["ALLOW_DEV"] = "true"
    
    headers = {"x-api-key": "dev-token"}
    
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        documents = [
            ("doc1.txt", b"First document content"),
            ("doc2.txt", b"Second document content"),
            ("doc3.txt", b"Third document content"),
        ]
        
        for filename, content in documents:
            files = {"file": (filename, content, "text/plain")}
            response = await ac.post("/upload", files=files, headers=headers)
            
            assert response.status_code == 200
            data = response.json()
            assert data["filename"] == filename
    
    if "ALLOW_DEV" in os.environ:
        del os.environ["ALLOW_DEV"]


@pytest.mark.integration
@pytest.mark.asyncio
async def test_error_recovery_flow():
    """Test that the system handles errors gracefully and recovers"""
    import os
    os.environ["ALLOW_DEV"] = "true"
    
    headers = {"x-api-key": "dev-token"}
    
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Try to upload an invalid file
        invalid_content = b"\x00\x01\x02\x03"
        files = {"file": ("invalid.bin", invalid_content, "application/octet-stream")}
        response = await ac.post("/upload", files=files, headers=headers)
        
        assert response.status_code == 400
        
        # Immediately try a valid upload to ensure system recovered
        valid_content = b"Valid text content"
        files = {"file": ("valid.txt", valid_content, "text/plain")}
        response = await ac.post("/upload", files=files, headers=headers)
        
        assert response.status_code == 200
    
    if "ALLOW_DEV" in os.environ:
        del os.environ["ALLOW_DEV"]
