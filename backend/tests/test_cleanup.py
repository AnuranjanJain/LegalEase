import asyncio
import os
import pytest
from datetime import datetime, timedelta
from unittest.mock import patch, MagicMock
from fastapi import status, HTTPException
from httpx import AsyncClient, ASGITransport

from backend.database import SessionLocal, Base, engine
from backend.models import RevokedToken, User
from backend.utils.cleanup import purge_expired_tokens, start_token_cleanup_task
from backend.auth import get_current_user, create_access_token
from backend.main import app

# Ensure tables exist
Base.metadata.create_all(bind=engine)

@pytest.fixture
def db_session():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.query(RevokedToken).delete()
        session.query(User).delete()
        session.commit()
        session.close()

@pytest.mark.asyncio
async def test_blacklisted_token_auth_fails(db_session):
    from jose import jwt
    from backend.auth import SECRET_KEY, ALGORITHM

    # Create a test user
    user = User(email="blacklisted_test@example.com", hashed_password="hashedpassword")
    db_session.add(user)
    db_session.commit()

    # Generate token
    token = create_access_token(data={"sub": user.email})

    # Initially auth should succeed
    current_user = get_current_user(token=token, db=db_session)
    assert current_user.get_user_email() == user.email

    # Extract jti from the token
    payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    jti = payload.get("jti")

    # Blacklist the token
    revoked = RevokedToken(jti=jti, expires_at=datetime.utcnow() + timedelta(hours=1))
    db_session.add(revoked)
    db_session.commit()

    # Now auth should fail
    with pytest.raises(HTTPException) as exc_info:
        get_current_user(token=token, db=db_session)
    assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED

@pytest.mark.asyncio
async def test_purge_expired_tokens(db_session):
    now = datetime.utcnow()
    # Add expired token
    expired = RevokedToken(jti="expired-token-jti", expires_at=now - timedelta(seconds=1))
    # Add valid token
    valid = RevokedToken(jti="valid-token-jti", expires_at=now + timedelta(hours=1))

    db_session.add_all([expired, valid])
    db_session.commit()

    # Run purge
    await purge_expired_tokens()

    # Query tokens
    remaining_tokens = db_session.query(RevokedToken).all()
    assert len(remaining_tokens) == 1
    assert remaining_tokens[0].jti == "valid-token-jti"

@pytest.mark.asyncio
async def test_purge_batch_deletion(db_session):
    now = datetime.utcnow()
    # Create 5 expired tokens
    expired_tokens = [
        RevokedToken(jti=f"expired-jti-{i}", expires_at=now - timedelta(seconds=1))
        for i in range(5)
    ]
    db_session.add_all(expired_tokens)
    db_session.commit()

    # Run purge with batch size of 2
    await purge_expired_tokens(batch_size=2)

    remaining_tokens = db_session.query(RevokedToken).all()
    assert len(remaining_tokens) == 0

@pytest.mark.asyncio
async def test_purge_rollback_on_failure(db_session):
    now = datetime.utcnow()
    expired = RevokedToken(jti="expired-token-rollback-jti", expires_at=now - timedelta(seconds=1))
    db_session.add(expired)
    db_session.commit()

    # Mock SessionLocal to throw an exception on commit or query to simulate database failure
    with patch("backend.utils.cleanup.SessionLocal") as mock_session_class:
        mock_session = MagicMock()
        mock_session_class.return_value = mock_session
        
        # Make delete or commit raise an error
        mock_session.commit.side_effect = Exception("DB Fail")
        mock_session.query().filter().limit().all.return_value = [(expired.id,)]
        mock_session.query().filter().delete.return_value = 1

        with pytest.raises(Exception, match="DB Fail"):
            await purge_expired_tokens()
        
        # Verify rollback was called
        mock_session.rollback.assert_called_once()
        mock_session.close.assert_called_once()

@pytest.mark.asyncio
async def test_scheduled_background_execution():
    # Verify that start_token_cleanup_task triggers the purge and sleeps
    with patch("backend.utils.cleanup.purge_expired_tokens") as mock_purge:
        # Call start_token_cleanup_task, but we want it to exit after one iteration
        # to avoid infinite loops in tests. We can mock asyncio.sleep to raise asyncio.CancelledError
        # or similar after it executes the purge once.
        async def mock_sleep(seconds):
            raise asyncio.CancelledError()

        with patch("asyncio.sleep", side_effect=mock_sleep):
            try:
                await start_token_cleanup_task(interval_seconds=1)
            except asyncio.CancelledError:
                pass
            
            mock_purge.assert_called_once()
