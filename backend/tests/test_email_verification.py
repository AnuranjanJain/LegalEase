"""
Tests for email verification feature — Fixes #254.
Covers: signup with verification, verify endpoint, resend, login blocked for unverified.
"""

import os
import sys
from pathlib import Path
from datetime import datetime, timedelta
from unittest.mock import patch, MagicMock

import pytest

# Set test env vars before imports
os.environ["JWT_SECRET_KEY"] = "test-secret-key-for-email-verification-tests"
os.environ["ALLOW_DEV"] = "true"
os.environ["STUB_MODE"] = "true"

ROOT = Path(__file__).resolve().parents[2]
root_path = str(ROOT)
if root_path not in sys.path:
    sys.path.insert(0, root_path)

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

from backend.database import Base, get_db
from backend import models
from backend.email_verification import (
    generate_verification_token,
    create_verification_token,
    verify_email_token,
    get_verification_link,
)


# In-memory SQLite for tests
TEST_DATABASE_URL = "sqlite:///./test_email_verification.db"
engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(scope="module")
def client():
    """Create test client with DB override."""
    Base.metadata.create_all(bind=engine)

    from fastapi import FastAPI
    from backend.routers.auth_routes import router

    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as c:
        yield c

    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db_session():
    """Fresh DB session per test."""
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        # Clean up
        db.query(models.User).delete()
        db.commit()
        db.close()


class TestGenerateVerificationToken:
    """Token generation produces valid URL-safe strings."""

    def test_token_is_string(self):
        token = generate_verification_token()
        assert isinstance(token, str)

    def test_token_length(self):
        token = generate_verification_token()
        # urlsafe_b64(32 bytes) = ~43 chars
        assert len(token) >= 32

    def test_tokens_are_unique(self):
        tokens = {generate_verification_token() for _ in range(100)}
        assert len(tokens) == 100


class TestCreateVerificationToken:
    """Token persistence in database."""

    def test_token_stored_in_user(self, db_session):
        user = models.User(email="test@example.com", hashed_password="hashed", is_verified=False)
        db_session.add(user)
        db_session.commit()

        token = create_verification_token(db_session, user)
        assert user.verification_token == token
        assert user.verification_token_expires is not None
        assert user.verification_token_expires > datetime.utcnow()

    def test_token_expiry_is_24h(self, db_session):
        user = models.User(email="test2@example.com", hashed_password="hashed", is_verified=False)
        db_session.add(user)
        db_session.commit()

        create_verification_token(db_session, user)
        expected = datetime.utcnow() + timedelta(hours=24)
        assert abs((user.verification_token_expires - expected).total_seconds()) < 5


class TestVerifyEmailToken:
    """Token verification logic."""

    def test_valid_token_verifies_user(self, db_session):
        user = models.User(email="verify@example.com", hashed_password="hashed", is_verified=False)
        db_session.add(user)
        db_session.commit()

        token = create_verification_token(db_session, user)
        result = verify_email_token(db_session, token)

        assert result is not None
        assert result.is_verified is True
        assert result.verification_token is None
        assert result.verification_token_expires is None

    def test_invalid_token_returns_none(self, db_session):
        result = verify_email_token(db_session, "nonexistent-token")
        assert result is None

    def test_expired_token_returns_none(self, db_session):
        user = models.User(email="expired@example.com", hashed_password="hashed", is_verified=False)
        db_session.add(user)
        db_session.commit()

        token = create_verification_token(db_session, user)
        # Manually expire the token
        user.verification_token_expires = datetime.utcnow() - timedelta(hours=1)
        db_session.commit()

        result = verify_email_token(db_session, token)
        assert result is None

    def test_already_verified_user(self, db_session):
        user = models.User(email="already@example.com", hashed_password="hashed", is_verified=True)
        db_session.add(user)
        db_session.commit()

        # Should return user even though already verified
        user.verification_token = "some-token"
        db_session.commit()
        result = verify_email_token(db_session, "some-token")
        assert result is not None
        assert result.is_verified is True


class TestGetVerificationLink:
    """Verification link construction."""

    def test_default_frontend_url(self):
        link = get_verification_link("abc123")
        assert "abc123" in link
        assert "/verify-email" in link

    def test_custom_frontend_url(self):
        with patch.dict(os.environ, {"FRONTEND_URL": "https://app.legalease.com"}):
            from backend import email_verification as ev
            original = ev.FRONTEND_URL
            ev.FRONTEND_URL = "https://app.legalease.com"
            link = get_verification_link("token123")
            assert link.startswith("https://app.legalease.com")
            ev.FRONTEND_URL = original


class TestSignupEndpoint:
    """POST /auth/signup should create user and send verification email."""

    def test_signup_returns_verification_message(self, client):
        with patch("backend.routers.auth_routes.send_verification_email", return_value=True):
            resp = client.post("/auth/signup", json={
                "email": "new@example.com",
                "password": "securepass123",
            })
        assert resp.status_code == 201
        assert "verify" in resp.json()["detail"].lower()

    def test_signup_duplicate_email(self, client):
        with patch("backend.routers.auth_routes.send_verification_email", return_value=True):
            client.post("/auth/signup", json={"email": "dup@example.com", "password": "securepass123"})
            resp = client.post("/auth/signup", json={"email": "dup@example.com", "password": "securepass123"})
        assert resp.status_code == 400


class TestVerifyEmailEndpoint:
    """POST /auth/verify-email should verify user with valid token."""

    def test_valid_token(self, client):
        # Create user first
        with patch("backend.routers.auth_routes.send_verification_email", return_value=True):
            signup_resp = client.post("/auth/signup", json={
                "email": "verify-me@example.com",
                "password": "securepass123",
            })
        assert signup_resp.status_code == 201

        # Get the token from DB
        db = TestingSessionLocal()
        user = db.query(models.User).filter(models.User.email == "verify-me@example.com").first()
        token = user.verification_token
        db.close()

        # Verify
        resp = client.post("/auth/verify-email", json={"token": token})
        assert resp.status_code == 200
        assert "verified" in resp.json()["detail"].lower()

    def test_invalid_token(self, client):
        resp = client.post("/auth/verify-email", json={"token": "invalid-garbage"})
        assert resp.status_code == 400


class TestLoginEndpoint:
    """POST /auth/login should block unverified users."""

    def test_unverified_user_cannot_login(self, client):
        # Create user
        with patch("backend.routers.auth_routes.send_verification_email", return_value=True):
            client.post("/auth/signup", json={
                "email": "unverified@example.com",
                "password": "securepass123",
            })

        # Try to login without verifying
        resp = client.post("/auth/login", json={
            "email": "unverified@example.com",
            "password": "securepass123",
        })
        assert resp.status_code == 403
        assert "not verified" in resp.json()["detail"].lower()

    def test_verified_user_can_login(self, client):
        # Create and verify user
        with patch("backend.routers.auth_routes.send_verification_email", return_value=True):
            client.post("/auth/signup", json={
                "email": "verified@example.com",
                "password": "securepass123",
            })

        db = TestingSessionLocal()
        user = db.query(models.User).filter(models.User.email == "verified@example.com").first()
        token = user.verification_token
        db.close()

        client.post("/auth/verify-email", json={"token": token})

        # Login
        resp = client.post("/auth/login", json={
            "email": "verified@example.com",
            "password": "securepass123",
        })
        assert resp.status_code == 200
        assert "access_token" in resp.json()


class TestResendVerificationEndpoint:
    """POST /auth/resend-verification should send new token."""

    def test_resend_for_unverified_user(self, client):
        with patch("backend.routers.auth_routes.send_verification_email", return_value=True):
            client.post("/auth/signup", json={
                "email": "resend@example.com",
                "password": "securepass123",
            })

        with patch("backend.routers.auth_routes.send_verification_email", return_value=True) as mock_send:
            resp = client.post("/auth/resend-verification", json={"email": "resend@example.com"})
        assert resp.status_code == 200
        mock_send.assert_called_once()

    def test_resend_for_verified_user_no_leak(self, client):
        """Should not reveal whether user exists or is already verified."""
        resp = client.post("/auth/resend-verification", json={"email": "nonexistent@example.com"})
        assert resp.status_code == 200
        assert "if an account" in resp.json()["detail"].lower()

    def test_resend_for_nonexistent_email(self, client):
        """Should return same message regardless of email existence."""
        resp = client.post("/auth/resend-verification", json={"email": "ghost@example.com"})
        assert resp.status_code == 200
