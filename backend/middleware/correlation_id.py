"""
Correlation ID validation and management middleware.

This module provides safe handling of client-supplied correlation IDs
to prevent log pollution and trace integrity issues.
"""
import re
import uuid
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# Validation patterns
UUID_PATTERN = re.compile(
    r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
    re.IGNORECASE
)

# Configuration
MAX_CORRELATION_ID_LENGTH = 100  # Prevent excessively long identifiers
ALLOWED_PATTERN = re.compile(r'^[a-zA-Z0-9\-_\.]+$')  # Safe characters only


def is_valid_uuid(candidate: str) -> bool:
    """
    Check if a string is a valid UUID v4.
    
    Args:
        candidate: String to validate
        
    Returns:
        True if valid UUID v4, False otherwise
    """
    try:
        uuid.UUID(candidate, version=4)
        return bool(UUID_PATTERN.match(candidate))
    except (ValueError, AttributeError):
        return False


def is_safe_correlation_id(candidate: str) -> bool:
    """
    Check if a correlation ID is safe for use in logs and tracing.
    
    Args:
        candidate: String to validate
        
    Returns:
        True if safe, False otherwise
    """
    if not candidate:
        return False
    
    # Check length
    if len(candidate) > MAX_CORRELATION_ID_LENGTH:
        return False
    
    # Check for safe characters only
    if not ALLOWED_PATTERN.match(candidate):
        return False
    
    return True


def validate_or_generate_correlation_id(client_id: Optional[str]) -> tuple[str, bool]:
    """
    Validate client-provided correlation ID or generate a safe one.
    
    Args:
        client_id: Client-provided correlation ID from X-Correlation-ID header
        
    Returns:
        Tuple of (validated_correlation_id, was_valid)
        - validated_correlation_id: Safe correlation ID to use
        - was_valid: True if client ID was valid, False if generated
    """
    if not client_id:
        # No client ID provided, generate one
        generated_id = str(uuid.uuid4())
        logger.debug(f"No correlation ID provided, generated: {generated_id}")
        return generated_id, False
    
    # Check if it's a valid UUID v4 (preferred format)
    if is_valid_uuid(client_id):
        logger.debug(f"Valid UUID v4 correlation ID provided: {client_id}")
        return client_id, True
    
    # Check if it's safe (non-UUID but acceptable)
    if is_safe_correlation_id(client_id):
        logger.warning(
            f"Non-UUID correlation ID accepted: {client_id[:50]}{'...' if len(client_id) > 50 else ''}. "
            f"UUID v4 format recommended."
        )
        return client_id, True
    
    # Invalid ID, generate a new one
    generated_id = str(uuid.uuid4())
    logger.warning(
        f"Invalid correlation ID rejected: {client_id[:50]}{'...' if len(client_id) > 50 else ''}. "
        f"Generated replacement: {generated_id}"
    )
    return generated_id, False


def sanitize_correlation_id(candidate: str) -> str:
    """
    Sanitize a correlation ID by removing unsafe characters.
    
    This is a fallback for cases where we want to preserve some
    identifier information while making it safe.
    
    Args:
        candidate: String to sanitize
        
    Returns:
        Sanitized string safe for use in logs
    """
    if not candidate:
        return str(uuid.uuid4())
    
    # Remove unsafe characters
    sanitized = re.sub(r'[^a-zA-Z0-9\-_\.]', '', candidate)
    
    # Truncate if too long
    if len(sanitized) > MAX_CORRELATION_ID_LENGTH:
        sanitized = sanitized[:MAX_CORRELATION_ID_LENGTH]
    
    # If empty after sanitization, generate UUID
    if not sanitized or sanitized.isspace():
        return str(uuid.uuid4())
    
    return sanitized
