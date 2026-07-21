import os
import pytest
from sqlalchemy import text

os.environ["JWT_SECRET_KEY"] = "testing-secret-key-1234567890-abcdef"


@pytest.fixture(autouse=True)
def reset_encryption_cache():
    """Ensure each test gets a fresh Fernet instance reflecting current settings."""
    from backend.core import encryption
    encryption.reset_fernet_cache()
    yield
    encryption.reset_fernet_cache()


@pytest.mark.unit
def test_encrypt_then_decrypt_round_trips():
    from backend.core.encryption import encrypt_text, decrypt_text

    plaintext = "This clause contains sensitive indemnification terms."
    ciphertext = encrypt_text(plaintext)

    assert ciphertext != plaintext
    assert decrypt_text(ciphertext) == plaintext


@pytest.mark.unit
def test_encrypted_value_is_not_plaintext_substring():
    """The stored ciphertext must not contain the original plaintext anywhere."""
    from backend.core.encryption import encrypt_text

    plaintext = "CONFIDENTIAL-MARKER-9f3a"
    ciphertext = encrypt_text(plaintext)
    assert "CONFIDENTIAL-MARKER-9f3a" not in ciphertext


@pytest.mark.unit
def test_encrypt_none_returns_none():
    from backend.core.encryption import encrypt_text, decrypt_text

    assert encrypt_text(None) is None
    assert decrypt_text(None) is None


@pytest.mark.unit
def test_decrypt_falls_back_to_raw_value_for_non_fernet_input():
    """Pre-existing unencrypted rows from before this feature must remain readable."""
    from backend.core.encryption import decrypt_text

    legacy_plaintext = "Legacy unencrypted content stored before encryption was added."
    assert decrypt_text(legacy_plaintext) == legacy_plaintext


@pytest.mark.unit
def test_key_derives_from_jwt_secret_when_no_dedicated_key_set(monkeypatch):
    """Without DOCUMENT_ENCRYPTION_KEY in non-production, encryption works via JWT_SECRET_KEY fallback."""
    import backend.config as config
    from backend.core import encryption

    monkeypatch.delenv("DOCUMENT_ENCRYPTION_KEY", raising=False)
    monkeypatch.setenv("ENVIRONMENT", "development")
    config._settings = None
    encryption.reset_fernet_cache()

    plaintext = "Fallback key still encrypts and decrypts correctly."
    ciphertext = encryption.encrypt_text(plaintext)
    assert encryption.decrypt_text(ciphertext) == plaintext

    config._settings = None
    encryption.reset_fernet_cache()
    monkeypatch.delenv("ENVIRONMENT", raising=False)


@pytest.mark.unit
def test_dedicated_encryption_key_is_used_when_set(monkeypatch):
    """A dedicated DOCUMENT_ENCRYPTION_KEY produces a different key than the JWT fallback."""
    import backend.config as config
    from backend.core import encryption

    monkeypatch.delenv("DOCUMENT_ENCRYPTION_KEY", raising=False)
    config._settings = None
    encryption.reset_fernet_cache()
    plaintext = "Same plaintext, different keys."
    ciphertext_without_dedicated_key = encryption.encrypt_text(plaintext)

    monkeypatch.setenv("DOCUMENT_ENCRYPTION_KEY", "a-completely-different-dedicated-secret")
    config._settings = None
    encryption.reset_fernet_cache()
    ciphertext_with_dedicated_key = encryption.encrypt_text(plaintext)

    # Different keys must be able to decrypt their own ciphertext...
    assert encryption.decrypt_text(ciphertext_with_dedicated_key) == plaintext

    # ...but the JWT-derived key must not be able to decrypt data encrypted
    # under the dedicated key (falls back to returning the raw ciphertext).
    monkeypatch.delenv("DOCUMENT_ENCRYPTION_KEY", raising=False)
    config._settings = None
    encryption.reset_fernet_cache()
    assert encryption.decrypt_text(ciphertext_with_dedicated_key) != plaintext

    config._settings = None
    encryption.reset_fernet_cache()


@pytest.mark.unit
def test_production_requires_dedicated_encryption_key(monkeypatch):
    """In production, missing DOCUMENT_ENCRYPTION_KEY raises ConfigurationError at startup."""
    import backend.config as config
    from backend.core import encryption
    from backend.core.encryption import ConfigurationError
    from pydantic import ValidationError

    monkeypatch.delenv("DOCUMENT_ENCRYPTION_KEY", raising=False)
    monkeypatch.setenv("ENVIRONMENT", "production")
    config._settings = None
    encryption.reset_fernet_cache()

    # Config validation happens first at startup, before encryption is used
    with pytest.raises(ValidationError) as exc_info:
        config.get_settings()
    assert "DOCUMENT_ENCRYPTION_KEY is required in production" in str(exc_info.value)

    config._settings = None
    encryption.reset_fernet_cache()
    monkeypatch.delenv("ENVIRONMENT", raising=False)


@pytest.mark.unit
def test_production_with_dedicated_encryption_key_succeeds(monkeypatch):
    """In production, with DOCUMENT_ENCRYPTION_KEY set, encryption works correctly."""
    import backend.config as config
    from backend.core import encryption

    monkeypatch.setenv("DOCUMENT_ENCRYPTION_KEY", "production-encryption-key-1234567890")
    monkeypatch.setenv("ENVIRONMENT", "production")
    config._settings = None
    encryption.reset_fernet_cache()

    plaintext = "Production encryption with dedicated key."
    ciphertext = encryption.encrypt_text(plaintext)
    assert encryption.decrypt_text(ciphertext) == plaintext

    config._settings = None
    encryption.reset_fernet_cache()
    monkeypatch.delenv("DOCUMENT_ENCRYPTION_KEY", raising=False)
    monkeypatch.delenv("ENVIRONMENT", raising=False)


@pytest.mark.unit
def test_development_fallback_logs_warning(monkeypatch, caplog):
    """In development, fallback to JWT_SECRET_KEY logs a warning."""
    import backend.config as config
    from backend.core import encryption

    monkeypatch.delenv("DOCUMENT_ENCRYPTION_KEY", raising=False)
    monkeypatch.setenv("ENVIRONMENT", "development")
    config._settings = None
    encryption.reset_fernet_cache()

    with caplog.at_level("WARNING"):
        plaintext = "Development fallback test."
        ciphertext = encryption.encrypt_text(plaintext)
        assert encryption.decrypt_text(ciphertext) == plaintext

    assert "DOCUMENT_ENCRYPTION_KEY is not configured" in caplog.text
    assert "non-production environment" in caplog.text

    config._settings = None
    encryption.reset_fernet_cache()
    monkeypatch.delenv("ENVIRONMENT", raising=False)


@pytest.mark.unit
def test_testing_environment_fallback_allowed(monkeypatch):
    """In testing environment, fallback to JWT_SECRET_KEY is allowed."""
    import backend.config as config
    from backend.core import encryption

    monkeypatch.delenv("DOCUMENT_ENCRYPTION_KEY", raising=False)
    monkeypatch.setenv("ENVIRONMENT", "testing")
    config._settings = None
    encryption.reset_fernet_cache()

    plaintext = "Testing environment fallback test."
    ciphertext = encryption.encrypt_text(plaintext)
    assert encryption.decrypt_text(ciphertext) == plaintext

    config._settings = None
    encryption.reset_fernet_cache()
    monkeypatch.delenv("ENVIRONMENT", raising=False)


@pytest.mark.unit
def test_local_environment_fallback_allowed(monkeypatch):
    """In local environment, fallback to JWT_SECRET_KEY is allowed."""
    import backend.config as config
    from backend.core import encryption

    monkeypatch.delenv("DOCUMENT_ENCRYPTION_KEY", raising=False)
    monkeypatch.setenv("ENVIRONMENT", "local")
    config._settings = None
    encryption.reset_fernet_cache()

    plaintext = "Local environment fallback test."
    ciphertext = encryption.encrypt_text(plaintext)
    assert encryption.decrypt_text(ciphertext) == plaintext

    config._settings = None
    encryption.reset_fernet_cache()
    monkeypatch.delenv("ENVIRONMENT", raising=False)


@pytest.fixture
def db_session():
    """
    Provide a database session for each test.

    Deliberately does not drop tables in teardown: other test modules assume
    the tables created by importing backend.main persist for the rest of the
    pytest session, and dropping them here would break any test file that
    happens to run afterwards in alphabetical collection order.
    """
    from backend.database import Base, engine, SessionLocal

    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.mark.asyncio
async def test_chat_message_content_stored_encrypted_at_rest(db_session):
    """
    The raw database row must not contain the plaintext message content;
    only the ORM-level attribute (which transparently decrypts) should.
    """
    from backend.database import engine
    from backend import models

    user = models.User(email="encrypt.test@example.com", hashed_password="hashed")
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    session = models.ChatSession(user_id=user.id, title="Test Session")
    db_session.add(session)
    db_session.commit()
    db_session.refresh(session)

    plaintext = "SENSITIVE-CLAUSE-MARKER: indemnification liability terms"
    message = models.ChatMessage(session_id=session.id, role="user", content=plaintext)
    db_session.add(message)
    db_session.commit()
    db_session.refresh(message)

    # ORM-level access transparently decrypts.
    assert message.content == plaintext

    # Raw storage must not contain the plaintext anywhere.
    with engine.connect() as conn:
        row = conn.execute(
            text("SELECT content FROM chat_messages WHERE id = :id"),
            {"id": message.id},
        ).fetchone()
    raw_stored_value = row[0]
    assert raw_stored_value != plaintext
    assert "SENSITIVE-CLAUSE-MARKER" not in raw_stored_value


@pytest.mark.asyncio
async def test_document_record_summary_and_clause_analysis_stored_encrypted(db_session):
    from backend.database import engine
    from backend import models

    user = models.User(email="encrypt.doc@example.com", hashed_password="hashed")
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    summary_plaintext = "CONFIDENTIAL SUMMARY: this contract contains a non-compete clause."
    clause_plaintext = '[{"clause": "CONFIDENTIAL CLAUSE TEXT", "riskLevel": "High"}]'

    doc = models.DocumentRecord(
        user_id=user.id,
        filename="contract.pdf",
        summary=summary_plaintext,
        clause_analysis=clause_plaintext,
    )
    db_session.add(doc)
    db_session.commit()
    db_session.refresh(doc)

    assert doc.summary == summary_plaintext
    assert doc.clause_analysis == clause_plaintext

    with engine.connect() as conn:
        row = conn.execute(
            text("SELECT summary, clause_analysis FROM document_records WHERE id = :id"),
            {"id": doc.id},
        ).fetchone()
    raw_summary, raw_clause_analysis = row[0], row[1]
    assert raw_summary != summary_plaintext
    assert "CONFIDENTIAL SUMMARY" not in raw_summary
    assert raw_clause_analysis != clause_plaintext
    assert "CONFIDENTIAL CLAUSE TEXT" not in raw_clause_analysis
