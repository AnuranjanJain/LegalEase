"""
Tests for correlation ID validation and management.

This test suite validates the correlation ID validation middleware
to prevent log pollution and trace integrity issues.
"""
import pytest
import uuid
from unittest.mock import Mock, patch

from backend.middleware.correlation_id import (
    is_valid_uuid,
    is_safe_correlation_id,
    validate_or_generate_correlation_id,
    sanitize_correlation_id,
    MAX_CORRELATION_ID_LENGTH
)


@pytest.mark.unit
def test_valid_uuid_v4():
    """Test validation of valid UUID v4."""
    valid_uuid = str(uuid.uuid4())
    assert is_valid_uuid(valid_uuid) is True


@pytest.mark.unit
def test_invalid_uuid():
    """Test rejection of invalid UUIDs."""
    assert is_valid_uuid("not-a-uuid") is False
    assert is_valid_uuid("123-456-789") is False
    assert is_valid_uuid("") is False
    assert is_valid_uuid("00000000-0000-0000-0000-000000000000") is False  # Not v4


@pytest.mark.unit
def test_safe_correlation_id():
    """Test validation of safe correlation IDs."""
    # Safe identifiers
    assert is_safe_correlation_id("abc-123") is True
    assert is_safe_correlation_id("test_id.123") is True
    assert is_safe_correlation_id("valid_identifier") is True
    
    # Unsafe identifiers
    assert is_safe_correlation_id("") is False
    assert is_safe_correlation_id("test<script>") is False
    assert is_safe_correlation_id("test\ninjection") is False
    assert is_safe_correlation_id("test\tinjection") is False


@pytest.mark.unit
def test_correlation_id_length_limit():
    """Test that excessively long IDs are rejected."""
    # Create a string longer than MAX_CORRELATION_ID_LENGTH
    long_id = "a" * (MAX_CORRELATION_ID_LENGTH + 1)
    assert is_safe_correlation_id(long_id) is False
    
    # Exactly at limit should be accepted
    exact_length_id = "a" * MAX_CORRELATION_ID_LENGTH
    assert is_safe_correlation_id(exact_length_id) is True


@pytest.mark.unit
def test_validate_or_generate_with_valid_uuid():
    """Test that valid UUID v4 is accepted."""
    valid_uuid = str(uuid.uuid4())
    result, was_valid = validate_or_generate_correlation_id(valid_uuid)
    
    assert result == valid_uuid
    assert was_valid is True


@pytest.mark.unit
def test_validate_or_generate_with_safe_non_uuid():
    """Test that safe non-UUID identifiers are accepted with warning."""
    safe_id = "custom-trace-id-123"
    result, was_valid = validate_or_generate_correlation_id(safe_id)
    
    assert result == safe_id
    assert was_valid is True


@pytest.mark.unit
def test_validate_or_generate_with_invalid_id():
    """Test that invalid IDs are rejected and new UUID generated."""
    invalid_id = "<script>alert('xss')</script>"
    result, was_valid = validate_or_generate_correlation_id(invalid_id)
    
    assert result != invalid_id
    assert was_valid is False
    assert is_valid_uuid(result) is True


@pytest.mark.unit
def test_validate_or_generate_with_none():
    """Test that None/missing ID generates new UUID."""
    result, was_valid = validate_or_generate_correlation_id(None)
    
    assert is_valid_uuid(result) is True
    assert was_valid is False


@pytest.mark.unit
def test_validate_or_generate_with_empty_string():
    """Test that empty string generates new UUID."""
    result, was_valid = validate_or_generate_correlation_id("")
    
    assert is_valid_uuid(result) is True
    assert was_valid is False


@pytest.mark.unit
def test_sanitize_correlation_id():
    """Test sanitization of unsafe correlation IDs."""
    # Remove special characters
    assert sanitize_correlation_id("test<script>") == "testscript"
    assert sanitize_correlation_id("test\ninjection") == "testinjection"
    assert sanitize_correlation_id("test\tinjection") == "testinjection"
    
    # Preserve safe characters
    assert sanitize_correlation_id("test-id_123.test") == "test-id_123.test"


@pytest.mark.unit
def test_sanitize_truncates_long_ids():
    """Test that sanitization truncates excessively long IDs."""
    long_id = "a" * (MAX_CORRELATION_ID_LENGTH + 50)
    sanitized = sanitize_correlation_id(long_id)
    
    assert len(sanitized) == MAX_CORRELATION_ID_LENGTH


@pytest.mark.unit
def test_sanitize_empty_result():
    """Test that empty result after sanitization generates UUID."""
    # Only unsafe characters (no alphanumeric)
    unsafe_id = "<>\n\t\r"
    sanitized = sanitize_correlation_id(unsafe_id)
    
    assert is_valid_uuid(sanitized) is True


@pytest.mark.integration
def test_middleware_integration_with_valid_header():
    """Test middleware integration with valid correlation ID header."""
    from fastapi import Request
    from backend.main import correlation_id_middleware
    from backend.services.ai_service import correlation_id_var
    
    # Create mock request with valid UUID
    valid_uuid = str(uuid.uuid4())
    mock_request = Mock(spec=Request)
    mock_request.headers = {"X-Correlation-ID": valid_uuid}
    
    # Create mock call_next
    async def call_next(request):
        from fastapi.responses import Response
        return Response(content="OK")
    
    # Run middleware
    import asyncio
    response = asyncio.run(correlation_id_middleware(mock_request, call_next))
    
    # Verify correlation ID is set and returned
    assert response.headers["X-Correlation-ID"] == valid_uuid


@pytest.mark.integration
def test_middleware_integration_with_invalid_header():
    """Test middleware integration with invalid correlation ID header."""
    from fastapi import Request
    from backend.main import correlation_id_middleware
    
    # Create mock request with invalid ID
    invalid_id = "<script>alert('xss')</script>"
    mock_request = Mock(spec=Request)
    mock_request.headers = {"X-Correlation-ID": invalid_id}
    
    # Create mock call_next
    async def call_next(request):
        from fastapi.responses import Response
        return Response(content="OK")
    
    # Run middleware
    import asyncio
    response = asyncio.run(correlation_id_middleware(mock_request, call_next))
    
    # Verify invalid ID was replaced with valid UUID
    returned_id = response.headers["X-Correlation-ID"]
    assert returned_id != invalid_id
    assert is_valid_uuid(returned_id) is True


@pytest.mark.integration
def test_middleware_integration_without_header():
    """Test middleware integration without correlation ID header."""
    from fastapi import Request
    from backend.main import correlation_id_middleware
    
    # Create mock request without header
    mock_request = Mock(spec=Request)
    mock_request.headers = {}
    
    # Create mock call_next
    async def call_next(request):
        from fastapi.responses import Response
        return Response(content="OK")
    
    # Run middleware
    import asyncio
    response = asyncio.run(correlation_id_middleware(mock_request, call_next))
    
    # Verify new UUID was generated
    returned_id = response.headers["X-Correlation-ID"]
    assert is_valid_uuid(returned_id) is True


@pytest.mark.reliability
def test_logging_consistency():
    """Test that correlation IDs are consistently used in logging."""
    valid_uuid = str(uuid.uuid4())
    result, was_valid = validate_or_generate_correlation_id(valid_uuid)
    
    # Verify the same ID is returned
    assert result == valid_uuid
    assert was_valid is True


@pytest.mark.reliability
def test_trace_propagation():
    """Test that valid correlation IDs propagate through the system."""
    # Simulate a trace ID from upstream service
    trace_id = "trace-123-abc-456"
    result, was_valid = validate_or_generate_correlation_id(trace_id)
    
    # Safe non-UUID should be accepted
    assert result == trace_id
    assert was_valid is True


@pytest.mark.security
def test_prevents_log_injection():
    """Test that log injection attempts are prevented."""
    # Various log injection attempts
    injection_attempts = [
        "test\nadmin: true",
        "test\radmin: true",
        "test\x00null",
        "<script>alert('xss')</script>",
        "$(whoami)",
        "`ls -la`",
    ]
    
    for attempt in injection_attempts:
        result, was_valid = validate_or_generate_correlation_id(attempt)
        # Should be rejected and replaced
        assert result != attempt
        assert was_valid is False
        assert is_valid_uuid(result) is True


@pytest.mark.security
def test_prevents_excessive_length():
    """Test that excessively long IDs are rejected."""
    # Create extremely long ID
    long_id = "a" * 10000
    result, was_valid = validate_or_generate_correlation_id(long_id)
    
    # Should be rejected and replaced
    assert result != long_id
    assert was_valid is False
    assert len(result) <= MAX_CORRELATION_ID_LENGTH
