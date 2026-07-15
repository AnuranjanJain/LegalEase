import os
import pytest
from datetime import datetime, timedelta
from httpx import AsyncClient, ASGITransport
from sqlalchemy.orm import Session

from backend.main import app
from backend.models import RevokedToken, User
from backend.auth import create_access_token, is_token_revoked, get_password_hash
from backend.database import SessionLocal

os.environ["JWT_SECRET_KEY"] = "testing-secret-key-1234567890-abcdef"

TEST_USER_EMAIL = "revocation@test.com"
TEST_PASSWORD = "password123"


@pytest.fixture
def db():
    session = SessionLocal()
    yield session
    session.close()


@pytest.fixture
def test_user(db: Session):
    user = db.query(User).filter(User.email == TEST_USER_EMAIL).first()
    if user:
        db.delete(user)
        db.commit()

    user = User(
        email=TEST_USER_EMAIL,
        hashed_password=get_password_hash(TEST_PASSWORD),
        is_verified=True
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def valid_token(test_user):
    return create_access_token({"sub": test_user.email})


@pytest.mark.asyncio
async def test_logout_revokes_token(test_user, valid_token, db):
    """Test that logout endpoint successfully revokes a token."""
    headers = {"Authorization": f"Bearer {valid_token}"}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.post("/auth/logout", headers=headers)

    assert response.status_code == 200
    assert "Logged out successfully" in response.json()["detail"]


@pytest.mark.asyncio
async def test_revoked_token_rejected_on_subsequent_request(test_user, valid_token, db):
    """Test that a revoked token is rejected on subsequent API calls."""
    headers = {"Authorization": f"Bearer {valid_token}"}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        logout_response = await ac.post("/auth/logout", headers=headers)
        assert logout_response.status_code == 200

        protected_response = await ac.get("/auth/me", headers=headers)
        assert protected_response.status_code == 401


@pytest.mark.asyncio
async def test_logout_without_token_fails(db):
    """Test that logout without a token returns 401."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.post("/auth/logout")

    assert response.status_code == 401


def test_is_token_revoked_returns_true_for_revoked_token(db):
    """Test that is_token_revoked correctly identifies revoked tokens."""
    jti = "test-jti-12345"
    expires_at = datetime.utcnow() + timedelta(hours=24)

    revoked = RevokedToken(jti=jti, expires_at=expires_at)
    db.add(revoked)
    db.commit()

    assert is_token_revoked(jti, db) is True


def test_is_token_revoked_returns_false_for_non_revoked_token(db):
    """Test that is_token_revoked returns False for tokens not revoked."""
    assert is_token_revoked("non-existent-jti", db) is False
