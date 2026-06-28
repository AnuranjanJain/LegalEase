import pytest
from unittest.mock import AsyncMock, patch

from backend.core.validation import validate_jurisdiction, ValidationError
from backend.core.jurisdictions import Jurisdictions
from backend.main import ChatRequest
from backend.routers.compare_routes import CompareRequest
from backend.services.ai_service import ai_service
from httpx import AsyncClient, ASGITransport
from backend.main import app

@pytest.mark.unit
def test_validate_jurisdiction_valid():
    # Test all supported jurisdictions are valid
    for j in Jurisdictions.ALL:
        validate_jurisdiction(j)  # Should not raise any exception

@pytest.mark.unit
def test_validate_jurisdiction_invalid():
    # Test some invalid jurisdictions raise ValidationError
    invalid_jurisdictions = [
        "US Law",
        "Texas Law",
        "random string",
        "",
        "   "
    ]
    for j in invalid_jurisdictions:
        with pytest.raises(ValidationError):
            validate_jurisdiction(j)

@pytest.mark.unit
def test_chat_request_default_jurisdiction():
    # Test default jurisdiction is "General / Not Specified"
    req = ChatRequest(message="test message")
    assert req.jurisdiction == "General / Not Specified"

@pytest.mark.unit
def test_compare_request_default_jurisdiction():
    # Test default jurisdiction is "General / Not Specified"
    req = CompareRequest(
        message="test comparison",
        document_texts=[
            {"id": "1", "name": "doc1.txt", "text": "content"},
            {"id": "2", "name": "doc2.txt", "text": "content"}
        ]
    )
    assert req.jurisdiction == "General / Not Specified"

@pytest.mark.asyncio
@pytest.mark.integration
async def test_api_chat_valid_jurisdiction():
    # Test api accepts a valid jurisdiction
    import os
    os.environ["ALLOW_DEV"] = "true"
    headers = {"x-api-key": "dev-token"}
    
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        payload = {
            "message": "Analyze this",
            "jurisdiction": "California Law"
        }
        # Mock LLM call to avoid hitting external API or stub
        with patch.object(ai_service, "generate_chat_response", return_value=AsyncMock()) as mock_chat:
            async def mock_generator(*args, **kwargs):
                yield "Test response"
            mock_chat.return_value = mock_generator()
            
            response = await ac.post("/chat", json=payload, headers=headers)
            assert response.status_code == 200
            assert response.json()["response"] == "Test response"
            
            # Verify the jurisdiction was passed to generate_chat_response
            mock_chat.assert_called_once()
            assert mock_chat.call_args.kwargs.get("jurisdiction") == "California Law"
            
    if "ALLOW_DEV" in os.environ:
        del os.environ["ALLOW_DEV"]

@pytest.mark.asyncio
@pytest.mark.integration
async def test_api_chat_invalid_jurisdiction():
    # Test api rejects an invalid jurisdiction with 400 Bad Request
    import os
    os.environ["ALLOW_DEV"] = "true"
    headers = {"x-api-key": "dev-token"}
    
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        payload = {
            "message": "Analyze this",
            "jurisdiction": "Invalid Jurisdiction"
        }
        response = await ac.post("/chat", json=payload, headers=headers)
        assert response.status_code == 400
        assert "Unsupported jurisdiction" in response.json()["detail"]
            
    if "ALLOW_DEV" in os.environ:
        del os.environ["ALLOW_DEV"]

@pytest.mark.asyncio
@pytest.mark.integration
async def test_api_compare_valid_jurisdiction():
    # Test comparison api accepts and passes valid jurisdiction
    import os
    os.environ["ALLOW_DEV"] = "true"
    headers = {"x-api-key": "dev-token"}
    
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        payload = {
            "message": "Compare documents",
            "document_texts": [
                {"id": "1", "name": "doc1.txt", "text": "content"},
                {"id": "2", "name": "doc2.txt", "text": "content"}
            ],
            "jurisdiction": "Delaware Corporate Law"
        }
        
        with patch("backend.services.comparison_service.comparison_service.compare_documents", new_callable=AsyncMock) as mock_compare:
            mock_compare.return_value = "Comparison result"
            response = await ac.post("/compare/chat", json=payload, headers=headers)
            assert response.status_code == 200
            assert response.json()["response"] == "Comparison result"
            
            # Verify the jurisdiction was passed to compare_documents
            mock_compare.assert_called_once()
            assert mock_compare.call_args.kwargs.get("jurisdiction") == "Delaware Corporate Law"
            
    if "ALLOW_DEV" in os.environ:
        del os.environ["ALLOW_DEV"]

@pytest.mark.asyncio
@pytest.mark.integration
async def test_prompt_injection_structure():
    # Test prompt contains selected jurisdiction and follows template
    jurisdiction = "European Union Law"
    message = "Is this contract valid?"
    
    # We patch stub_mode to False, client to True, and mock _execute_with_retry_and_timeout
    with patch.object(ai_service, "stub_mode", False), \
         patch.object(ai_service, "client", True), \
         patch.object(ai_service, "_execute_with_retry_and_timeout", new_callable=AsyncMock) as mock_execute:
        # Mock return value of execution
        mock_output = AsyncMock()
        mock_output.output = "LLM output"
        mock_execute.return_value = mock_output
        
        # Call generate_chat_response and consume the generator
        generator = ai_service.generate_chat_response(
            message=message,
            jurisdiction=jurisdiction,
            stream=False
        )
        responses = [r async for r in generator]
        
        # Verify the prompt sent to _execute_with_retry_and_timeout contains prompt injection
        mock_execute.assert_called_once()
        messages_arg = mock_execute.call_args[0][1]
        prompt_content = messages_arg[0]["content"]
        
        # Check that the instruction is prepended
        assert "You are an expert legal assistant." in prompt_content
        assert f"laws and regulations of: {jurisdiction}" in prompt_content
        assert "Is this contract valid?" in prompt_content
