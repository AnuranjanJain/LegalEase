"""
core/encryption.py
───────────────────
Field-level, at-rest encryption for stored contract content.

Applies Fernet (symmetric, authenticated) encryption to the sensitive text
columns that hold actual contract content: DocumentRecord.summary,
DocumentRecord.clause_analysis, and ChatMessage.content. Filenames, titles,
and other metadata are left as plain text since they are not the contract
content itself and encrypting them would break ordering/searching for no
real confidentiality benefit.

The Fernet key is derived from DOCUMENT_ENCRYPTION_KEY if set. In non-production
environments (development, testing, local), it falls back to JWT_SECRET_KEY for
convenience. In production, DOCUMENT_ENCRYPTION_KEY is mandatory to ensure
cryptographic key separation - using the same secret for JWT signing and
document encryption is prohibited in production for security reasons.

## Legacy Plaintext Handling

This module maintains backward compatibility with legacy plaintext database rows
that existed before field-level encryption was introduced. The decrypt_text()
function distinguishes between:

- **Legacy plaintext**: Values that do not appear to be Fernet tokens are
  returned unchanged with DEBUG-level logging. This is expected behavior for
  pre-existing unencrypted rows.

- **Encrypted values**: Values that appear to be Fernet tokens are decrypted.
  If decryption fails (wrong key, corrupted data, tampered ciphertext), a
  DecryptionError is raised with ERROR-level logging.

This distinction ensures that genuine encryption failures are surfaced
immediately rather than being silently ignored, while legacy data remains
accessible.

## Strict Encryption Mode

When STRICT_ENCRYPTION_MODE is enabled (via environment variable), legacy
plaintext data is rejected with DecryptionError instead of being returned
unchanged. This mode is recommended for production environments after all
legacy data has been migrated to encrypted format. When disabled (default),
legacy plaintext is allowed for backward compatibility.

## Key Rotation

To rotate encryption keys:

1. Set the new DOCUMENT_ENCRYPTION_KEY
2. Decrypt all existing encrypted values with the old key
3. Re-encrypt with the new key
4. Update the database with the new ciphertext

The decrypt_text() function will raise DecryptionError if an encrypted value
cannot be decrypted with the current key, which helps detect key rotation
issues.

## Troubleshooting

If you encounter DecryptionError:

- **Wrong encryption key**: Verify DOCUMENT_ENCRYPTION_KEY matches the key used
  to encrypt the data. Check environment configuration and key rotation history.

- **Corrupted ciphertext**: The data may have been modified in storage. Restore
  from backup if available.

- **Tampered ciphertext**: The HMAC validation failed, indicating the data may
  have been tampered with. Investigate potential security incidents.

- **Legacy plaintext in strict mode**: Either disable STRICT_ENCRYPTION_MODE
  temporarily to access legacy data, or migrate the data to encrypted format.
"""

import base64
import hashlib
import logging
from typing import Optional

from cryptography.fernet import Fernet, InvalidToken
from sqlalchemy.types import Text as SAText, TypeDecorator

from backend.config import get_settings


class ConfigurationError(Exception):
    """Raised when application configuration is invalid for the current environment."""
    pass


class DecryptionError(Exception):
    """Raised when decryption of an encrypted value fails.

    This exception is raised when a value appears to be a valid Fernet token
    but cannot be decrypted with the current key. This indicates a genuine
    encryption failure (wrong key, corrupted data, tampered ciphertext) rather
    than legacy plaintext data.
    """
    pass

logger = logging.getLogger(__name__)

_fernet: Optional[Fernet] = None


def _derive_fernet_key(secret: str) -> bytes:
    """Derive a valid 32-byte urlsafe-base64 Fernet key from an arbitrary secret string."""
    digest = hashlib.sha256(secret.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest)


def _get_fernet() -> Fernet:
    global _fernet
    if _fernet is not None:
        return _fernet

    settings = get_settings()
    key_source = settings.encryption.document_encryption_key
    environment = settings.environment.environment

    if not key_source:
        if environment == "production":
            logger.error(
                "DOCUMENT_ENCRYPTION_KEY is required in production. "
                "Using JWT_SECRET_KEY for document encryption is prohibited."
            )
            raise ConfigurationError(
                "DOCUMENT_ENCRYPTION_KEY is required in production. "
                "Using JWT_SECRET_KEY for document encryption is prohibited."
            )
        else:
            logger.warning(
                "DOCUMENT_ENCRYPTION_KEY is not configured. "
                "Using JWT_SECRET_KEY as a fallback because the application is "
                "running in a non-production environment (%s). "
                "Configure a dedicated DOCUMENT_ENCRYPTION_KEY before deploying to production.",
                environment,
            )
            key_source = settings.security.jwt_secret_key

    _fernet = Fernet(_derive_fernet_key(key_source))
    return _fernet


def reset_fernet_cache() -> None:
    """Reset the cached Fernet instance. Used by tests that reload settings."""
    global _fernet
    _fernet = None


def looks_like_fernet_token(value: str) -> bool:
    """Conservatively determine if a string appears to be a Fernet token.

    This helper checks for characteristics of valid Fernet tokens without
    attempting decryption. It's designed to avoid false positives on legacy
    plaintext data.

    A valid Fernet token:
    - Starts with 'gAAAAA' (the base64-encoded version byte 0x80 followed by timestamp)
    - Contains only URL-safe base64 characters (A-Z, a-z, 0-9, -, _)
    - Has a minimum length (Fernet tokens are at least 44 characters)

    Args:
        value: The string to check.

    Returns:
        True if the string appears to be a Fernet token, False otherwise.
    """
    if not value:
        return False

    # Fernet tokens always start with 'gAAAAA' (base64 of version byte 0x80)
    # The actual token starts with 'gAAAAA' followed by base64-encoded timestamp
    if not value.startswith("gAAAAA"):
        return False

    # Check that the value contains only URL-safe base64 characters
    # Fernet uses base64.urlsafe_b64encode which produces: A-Z, a-z, 0-9, -, _
    # and may include padding (=) at the end
    valid_chars = set("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_=")
    if not all(c in valid_chars for c in value):
        return False

    # Fernet tokens have a minimum length (timestamp + IV + ciphertext + HMAC)
    # Minimum is around 44 characters for very short plaintext
    if len(value) < 44:
        return False

    # All checks passed - this appears to be a Fernet token
    return True


def encrypt_text(plaintext: Optional[str]) -> Optional[str]:
    """Encrypt a string for storage. Returns None unchanged."""
    if plaintext is None:
        return None
    token = _get_fernet().encrypt(plaintext.encode("utf-8"))
    return token.decode("utf-8")


def decrypt_text(ciphertext: Optional[str]) -> Optional[str]:
    """
    Decrypt a stored string. Returns None unchanged.

    This function distinguishes between legacy plaintext data (stored before
    encryption was added) and genuine encryption failures. Legacy plaintext is
    returned unchanged with a DEBUG log (unless STRICT_ENCRYPTION_MODE is enabled).
    Values that appear to be encrypted but fail decryption raise DecryptionError
    with detailed ERROR logging.

    Args:
        ciphertext: The encrypted string to decrypt, or None.

    Returns:
        The decrypted plaintext, or the original value if it's legacy plaintext
        and STRICT_ENCRYPTION_MODE is disabled.

    Raises:
        DecryptionError: If the value appears to be encrypted but decryption fails,
            or if STRICT_ENCRYPTION_MODE is enabled and the value is not encrypted.
    """
    if ciphertext is None:
        return None

    # Check if this appears to be a Fernet token before attempting decryption
    is_encrypted = looks_like_fernet_token(ciphertext)

    if not is_encrypted:
        # This appears to be legacy plaintext
        settings = get_settings()
        strict_mode = settings.encryption.strict_encryption_mode

        if strict_mode:
            # Strict mode: reject legacy plaintext
            environment = settings.environment.environment
            logger.error(
                "Legacy plaintext record detected in strict encryption mode. "
                "environment=%s, strict_encryption_mode=%s",
                environment,
                strict_mode,
            )
            raise DecryptionError(
                f"Legacy plaintext data detected but STRICT_ENCRYPTION_MODE is enabled. "
                f"Environment: {environment}. "
                f"Migrate legacy data to encrypted format or disable STRICT_ENCRYPTION_MODE."
            )
        else:
            # Non-strict mode: allow legacy plaintext for backward compatibility
            logger.debug("Legacy plaintext record detected; returning as-is.")
            return ciphertext

    # The value appears to be encrypted - attempt decryption
    try:
        return _get_fernet().decrypt(ciphertext.encode("utf-8")).decode("utf-8")
    except InvalidToken as e:
        # The token structure is valid but decryption failed
        # This indicates: wrong key, corrupted data, or tampered ciphertext
        settings = get_settings()
        environment = settings.environment.environment
        has_dedicated_key = settings.encryption.document_encryption_key is not None

        logger.error(
            "Decryption failed for value that appears to be a Fernet token. "
            "This indicates a genuine encryption failure (wrong key, corrupted data, or tampered ciphertext). "
            "environment=%s, has_dedicated_key=%s, exception_type=%s",
            environment,
            has_dedicated_key,
            type(e).__name__,
            exc_info=True,
        )
        raise DecryptionError(
            f"Failed to decrypt value that appears to be encrypted. "
            f"Environment: {environment}, "
            f"Has dedicated encryption key: {has_dedicated_key}. "
            f"This may indicate an incorrect DOCUMENT_ENCRYPTION_KEY, corrupted data, or tampered ciphertext."
        ) from e
    except (ValueError, UnicodeDecodeError) as e:
        # The token structure is invalid (e.g., malformed base64, wrong encoding)
        # This is unexpected since looks_like_fernet_token should have caught this
        settings = get_settings()
        environment = settings.environment.environment

        logger.error(
            "Decryption failed due to malformed token structure. "
            "environment=%s, exception_type=%s",
            environment,
            type(e).__name__,
            exc_info=True,
        )
        raise DecryptionError(
            f"Failed to decrypt value due to malformed token structure. "
            f"Environment: {environment}, "
            f"Exception type: {type(e).__name__}."
        ) from e


class EncryptedText(TypeDecorator):
    """
    SQLAlchemy column type that transparently encrypts on write and
    decrypts on read, so application code (routes, tests) works with
    plaintext exactly as before; only the value actually stored in the
    database is ciphertext.
    """

    impl = SAText
    cache_ok = True

    def process_bind_param(self, value, dialect):
        return encrypt_text(value)

    def process_result_value(self, value, dialect):
        return decrypt_text(value)
