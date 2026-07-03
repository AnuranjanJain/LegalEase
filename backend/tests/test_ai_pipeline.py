import pytest
import os
import asyncio
from unittest.mock import Mock, patch
from fastapi import status
from httpx import AsyncClient, ASGITransport


from backend.main import app
from backend.core.exceptions import ValidationError, ProviderError, TimeoutError
from backend.core.validation import (
    validate_chat_input, validate_summarize_input, validate_mime_and_bytes, sanitize_text
)
from backend.services.ai_service import ai_service, correlation_id_var


@pytest.mark.unit
def test_sanitize_text():
    """Test text sanitization strips HTML tags and excessive blank lines"""
    dirty = "<h1>Title</h1>\n\n\n\nSome text with <script>alert(1)</script> tags."
    clean = sanitize_text(dirty)
    assert "Title" in clean
    assert "<h1>" not in clean
    assert "<script>" not in clean
    # Check that excessive blank lines are replaced with a max of double blank lines
    assert "\n\n\n" not in clean


@pytest.mark.unit
def test_payload_validation_chat_limits():
    """Test that chat input validation rejects oversized inputs correctly"""
    # Safe message
    validate_chat_input("Hello", "Context")
    
    # Empty message
    with pytest.raises(ValidationError) as exc:
        validate_chat_input("")
    assert "cannot be empty" in str(exc.value)
    
    # Safe message but context too large
    with patch("backend.core.validation.MAX_CONTEXT_INPUT_CHARS", 5):
        with pytest.raises(ValidationError) as exc:
            validate_chat_input("Hello", "TooLongContext")
        assert "exceeds the maximum allowed length" in str(exc.value)

    # Message too large
    with patch("backend.core.validation.MAX_CHAT_INPUT_CHARS", 5):
        with pytest.raises(ValidationError) as exc:
            validate_chat_input("TooLongMessage")
        assert "exceeds the maximum allowed length" in str(exc.value)


@pytest.mark.unit
def test_payload_validation_summarize_limits():
    """Test that summarize input validation rejects oversized inputs correctly"""
    # Safe text
    validate_summarize_input("Some text to summarize")
    
    # Empty text
    with pytest.raises(ValidationError) as exc:
        validate_summarize_input("   ")
    assert "cannot be empty" in str(exc.value)
    
    # Too large
    with patch("backend.core.validation.MAX_SUMMARIZE_INPUT_CHARS", 10):
        with pytest.raises(ValidationError) as exc:
            validate_summarize_input("This is way too long to summarize")
        assert "exceeds the maximum allowed length" in str(exc.value)


@pytest.mark.unit
def test_mime_aware_validation():
    """Test MIME-aware file validation for magic bytes and signatures"""
    # Valid PDF magic bytes
    validate_mime_and_bytes(b"%PDF-1.4\ncontent", "application/pdf", "file.pdf")
    
    # Invalid PDF magic bytes
    with pytest.raises(ValidationError) as exc:
        validate_mime_and_bytes(b"NOTAPDF", "application/pdf", "file.pdf")
    assert "signature does not match PDF structure" in str(exc.value)
    
    # Valid DOCX ZIP magic bytes
    validate_mime_and_bytes(b"PK\x03\x04\x14\x00\x00\x00", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "file.docx")
    
    # Invalid DOCX magic bytes
    with pytest.raises(ValidationError) as exc:
        validate_mime_and_bytes(b"NOTZIP", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "file.docx")
    assert "signature does not match DOCX structure" in str(exc.value)
    
    # Unsupported file extension
    with pytest.raises(ValidationError) as exc:
        validate_mime_and_bytes(b"random bytes", "application/octet-stream", "file.exe")
    assert "Unsupported file extension" in str(exc.value)


@pytest.mark.unit
def test_txt_upload_validation():
    """Test content-level validation for .txt uploads (no magic bytes exist for plain text)"""
    # Valid plain text passes
    validate_mime_and_bytes(b"This is a plain text legal document.", "text/plain", "file.txt")

    # Binary content with null bytes disguised as .txt is rejected
    with pytest.raises(ValidationError) as exc:
        validate_mime_and_bytes(b"\x00\x01\x02binary garbage\x00", "text/plain", "file.txt")
    assert "binary data" in str(exc.value)

    # Non-UTF-8 content (no null bytes, so this exercises the encoding check
    # rather than the binary-data check above) is rejected
    with pytest.raises(ValidationError) as exc:
        validate_mime_and_bytes(b"\xff\xfeinvalid utf-8 without any null bytes", "text/plain", "file.txt")
    assert "not valid UTF-8" in str(exc.value)

    # Content dominated by non-printable control characters is rejected
    control_heavy = bytes([1, 2, 3, 4, 5, 6, 7]) * 20
    with pytest.raises(ValidationError) as exc:
        validate_mime_and_bytes(control_heavy, "text/plain", "file.txt")
    assert "non-printable characters" in str(exc.value)

    # Normal whitespace (newlines, tabs) is not flagged as non-printable
    validate_mime_and_bytes(b"Line one.\nLine two.\tTabbed content.\r\n", "text/plain", "file.txt")

    # Empty content is valid (no crash on empty decode)
    validate_mime_and_bytes(b"", "text/plain", "file.txt")


@pytest.mark.unit
def test_txt_upload_validation_handles_truncated_utf8_prefix():
    """A size-limited prefix that cuts a multi-byte UTF-8 character mid-sequence
    must not be falsely rejected as invalid encoding."""
    full_text = "Legal document with unicode: café, naïve, résumé. " * 50
    full_bytes = full_text.encode("utf-8")

    # Truncate at a byte offset that is very likely to land inside a
    # multi-byte character (the "é" in café is a 2-byte UTF-8 sequence).
    truncated_prefix = full_bytes[:4096]

    # Should not raise, even if the prefix ends mid-character.
    validate_mime_and_bytes(truncated_prefix, "text/plain", "file.txt")


@pytest.mark.asyncio
async def test_correlation_id_propagation():
    """Test that correlation ID is generated, propagated, and injected into headers"""
    headers = {"x-api-key": "dev-token", "X-Correlation-ID": "test-trace-123"}
    payload = {"message": "Hello correlation ID"}
    
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        r = await ac.post("/chat", json=payload, headers=headers)
        # Correlation ID should be returned in response headers
        assert r.headers.get("X-Correlation-ID") == "test-trace-123"


@pytest.mark.asyncio
async def test_ai_service_stub_mode():
    """Test AI Service behaviors in Stub Mode"""
    # Re-initialize service settings for stub mode
    ai_service.__init__()
    
    # Test Chat Response in Stub Mode
    chat_gen = ai_service.generate_chat_response(message="Hi", stream=False)
    chat_res = ""
    async for chunk in chat_gen:
        chat_res += chunk
    assert "[STUB CHAT RESPONSE]" in chat_res
    
    # Test Summarize Response in Stub Mode
    summary = await ai_service.generate_summary(text="Summarize this text")
    assert "[STUB SUMMARY RESPONSE]" in summary
    
    # Test Health status in Stub Mode
    health = ai_service.check_health()
    assert health["status"] == "ok"
    assert health["details"]["stub_mode"] is True


@pytest.mark.asyncio
async def test_ai_service_streaming_mode():
    """Test AI Service streaming responses chunk generator"""
    ai_service.__init__()
    
    chat_gen = ai_service.generate_chat_response(message="This is a stream", stream=True)
    chunks = []
    async for chunk in chat_gen:
        chunks.append(chunk)
        
    assert len(chunks) > 1
    
    # Parse SSE format and extract response values
    full_response = ""
    for chunk in chunks:
        # Extract JSON from "data: {...}" format
        if chunk.startswith("data: ") and chunk != "data: [DONE]\n\n":
            try:
                import json
                json_str = chunk.replace("data: ", "").strip()
                data = json.loads(json_str)
                full_response += data.get("response", "")
            except (json.JSONDecodeError, ValueError):
                pass
    
    assert full_response.startswith("[STUB CHAT RESPONSE]")


@pytest.mark.asyncio
async def test_ai_service_provider_retry_strategy():
    """Test provider retry strategy under mock failure conditions"""
    mock_model = Mock()
    # Mock model.run to fail 2 times and succeed on 3rd attempt
    mock_model.run.side_effect = [
        Exception("Attempt 1 failure"),
        Exception("Attempt 2 failure"),
        Mock(output="Retry success", error=None)
    ]
    
    mock_client = Mock()
    mock_client.model.return_value = mock_model
    
    # Inject mock client into ai_service
    ai_service.client = mock_client
    ai_service.stub_mode = False
    ai_service.max_retries = 3
    ai_service.retry_backoff_factor = 0.01  # speed up backoff sleep for tests
    ai_service.provider_timeout = 1.0
    
    messages = [{"role": "user", "content": "test prompt"}]
    output = await ai_service._execute_with_retry_and_timeout("inference-net/Schematron-3B", messages)
    
    assert output.output == "Retry success"
    assert mock_model.run.call_count == 3
    
    # Re-initialize to reset singleton
    ai_service.__init__()


@pytest.mark.asyncio
async def test_ai_service_graceful_degradation():
    """Test that graceful degradation returns descriptive fallback when Bytez fails"""
    # Cause execute to fail by providing no client or stub
    ai_service.client = None
    ai_service.stub_mode = False
    ai_service.graceful_degradation = True
    
    chat_gen = ai_service.generate_chat_response(message="Will degrade gracefully", stream=False)
    chat_res = ""
    async for chunk in chat_gen:
        chat_res += chunk
    assert "operating in legal-assistant fallback mode" in chat_res
    
    summary_res = await ai_service.generate_summary(text="This document will degrade gracefully")
    assert "[OFFLINE SUMMARY FALLBACK]" in summary_res
    
    # Revert to defaults
    ai_service.__init__()
