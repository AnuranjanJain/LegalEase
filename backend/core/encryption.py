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

The Fernet key is derived from DOCUMENT_ENCRYPTION_KEY if set, otherwise
from JWT_SECRET_KEY, so the app still runs out of the box without a new
required environment variable, while still protecting stored contract
content if the database is compromised independently of the application
(a stolen backup, an over-privileged read replica, etc). A dedicated
DOCUMENT_ENCRYPTION_KEY is strongly recommended in production.
"""

import base64
import hashlib
import logging
import secrets
from typing import Optional

from cryptography.fernet import Fernet, InvalidToken
from sqlalchemy.types import Text as SAText, TypeDecorator

from backend.config import get_settings

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
    if not key_source:
        logger.warning(
            "DOCUMENT_ENCRYPTION_KEY is not set; deriving the document "
            "encryption key from JWT_SECRET_KEY instead. Set a dedicated "
            "DOCUMENT_ENCRYPTION_KEY in production."
        )
        key_source = settings.security.jwt_secret_key

    _fernet = Fernet(_derive_fernet_key(key_source))
    return _fernet


def reset_fernet_cache() -> None:
    """Reset the cached Fernet instance. Used by tests that reload settings."""
    global _fernet
    _fernet = None


def encrypt_text(plaintext: Optional[str]) -> Optional[str]:
    """Encrypt a string for storage. Returns None unchanged."""
    if plaintext is None:
        return None
    token = _get_fernet().encrypt(plaintext.encode("utf-8"))
    return token.decode("utf-8")


def decrypt_text(ciphertext: Optional[str]) -> Optional[str]:
    """
    Decrypt a stored string. Returns None unchanged.

    Falls back to returning the raw stored value if it isn't a valid Fernet
    token, so pre-existing unencrypted rows (from before this feature was
    added) remain readable instead of raising on every read.
    """
    if ciphertext is None:
        return None
    try:
        return _get_fernet().decrypt(ciphertext.encode("utf-8")).decode("utf-8")
    except (InvalidToken, ValueError):
        logger.warning("Failed to decrypt stored value; returning raw stored value as-is.")
        return ciphertext


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
    
def generate_secure_token(n_bytes: int = 32) -> str:
    """
    Generate a cryptographically secure, URL-safe token for a one-time
    e-signature signing link. Uses `secrets`, not `random`, and isn't
    derived from user input, so it can't be guessed or enumerated.
    """
    return secrets.token_urlsafe(n_bytes)
