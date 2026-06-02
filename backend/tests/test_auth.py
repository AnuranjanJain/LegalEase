import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi import status
from httpx import AsyncClient, ASGITransport

from backend.database import Base, get_db
from backend.main import app
from backend import models
from backend.auth import (
    verify_password,
    get_password_hash,
    create_access_token,
    get_current_user,
)

# Setup in-memory SQLite database engine for testing
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(name="db_session")
def fixture_db_session():
    # Create the database tables
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        # Drop the tables to clean up
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(autouse=True)
def override_get_db(db_session):
    def _override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = _override_get_db
    yield
    app.dependency_overrides.pop(get_db, None)


def test_password_hashing():
    password = "MyTestPassword123"
    hashed = get_password_hash(password)
    assert hashed != password
    assert verify_password(password, hashed) is True
    assert verify_password("WrongPassword", hashed) is False


def test_create_access_token():
    data = {"sub": "test@example.com"}
    token = create_access_token(data)
    assert isinstance(token, str)
    assert len(token) > 0


@pytest.mark.asyncio
async def test_signup_success():
    payload = {
        "email": "signup_success@legalease.ai",
        "password": "SecurePassword123"
    }
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        r = await ac.post("/auth/signup", json=payload)
        assert r.status_code == 201
        data = r.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_signup_duplicate_email(db_session):
    # Pre-register user in DB
    hashed = get_password_hash("ExistingPassword123")
    user = models.User(email="existing@legalease.ai", hashed_password=hashed)
    db_session.add(user)
    db_session.commit()

    payload = {
        "email": "existing@legalease.ai",
        "password": "NewPassword123"
    }
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        r = await ac.post("/auth/signup", json=payload)
        assert r.status_code == 400
        assert r.json()["detail"] == "Email already registered"


@pytest.mark.asyncio
async def test_signup_validation_errors():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Invalid email format
        r1 = await ac.post("/auth/signup", json={"email": "invalid_email", "password": "validpassword"})
        assert r1.status_code == 422

        # Password too short (less than 8 chars)
        r2 = await ac.post("/auth/signup", json={"email": "valid@email.com", "password": "short"})
        assert r2.status_code == 422


@pytest.mark.asyncio
async def test_login_success(db_session):
    # Pre-register user in DB
    hashed = get_password_hash("LoginPassword123")
    user = models.User(email="login_user@legalease.ai", hashed_password=hashed)
    db_session.add(user)
    db_session.commit()

    payload = {
        "email": "login_user@legalease.ai",
        "password": "LoginPassword123"
    }
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        r = await ac.post("/auth/login", json=payload)
        assert r.status_code == 200
        data = r.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_login_invalid_password(db_session):
    # Pre-register user in DB
    hashed = get_password_hash("LoginPassword123")
    user = models.User(email="login_user@legalease.ai", hashed_password=hashed)
    db_session.add(user)
    db_session.commit()

    payload = {
        "email": "login_user@legalease.ai",
        "password": "WrongPassword123"
    }
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        r = await ac.post("/auth/login", json=payload)
        assert r.status_code == 401
        assert "Incorrect email or password" in r.json()["detail"]


@pytest.mark.asyncio
async def test_login_unregistered_email():
    payload = {
        "email": "unregistered@legalease.ai",
        "password": "AnyPassword123"
    }
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        r = await ac.post("/auth/login", json=payload)
        assert r.status_code == 401
        assert "Incorrect email or password" in r.json()["detail"]


@pytest.mark.asyncio
async def test_change_password_success(db_session):
    # Pre-register user in DB
    hashed = get_password_hash("OldPassword123")
    user = models.User(email="change@legalease.ai", hashed_password=hashed)
    db_session.add(user)
    db_session.commit()

    # Generate token
    token = create_access_token({"sub": "change@legalease.ai"})

    payload = {
        "current_password": "OldPassword123",
        "new_password": "NewSecurePassword123"
    }
    headers = {"Authorization": f"Bearer {token}"}
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        r = await ac.post("/auth/change-password", json=payload, headers=headers)
        assert r.status_code == 200
        assert r.json()["detail"] == "Password updated successfully"

        # Verify password changed in DB
        db_session.refresh(user)
        assert verify_password("NewSecurePassword123", user.hashed_password) is True


@pytest.mark.asyncio
async def test_change_password_incorrect_current_password(db_session):
    hashed = get_password_hash("OldPassword123")
    user = models.User(email="change@legalease.ai", hashed_password=hashed)
    db_session.add(user)
    db_session.commit()

    token = create_access_token({"sub": "change@legalease.ai"})

    payload = {
        "current_password": "WrongOldPassword",
        "new_password": "NewSecurePassword123"
    }
    headers = {"Authorization": f"Bearer {token}"}
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        r = await ac.post("/auth/change-password", json=payload, headers=headers)
        assert r.status_code == 401
        assert "Current password is incorrect" in r.json()["detail"]


@pytest.mark.asyncio
async def test_change_password_unauthorized():
    payload = {
        "current_password": "OldPassword123",
        "new_password": "NewSecurePassword123"
    }
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Missing token
        r1 = await ac.post("/auth/change-password", json=payload)
        assert r1.status_code == 401

        # Invalid token
        headers = {"Authorization": "Bearer invalid_token"}
        r2 = await ac.post("/auth/change-password", json=payload, headers=headers)
        assert r2.status_code == 401


@pytest.mark.asyncio
async def test_protected_endpoint_accept_jwt(db_session):
    hashed = get_password_hash("MyPassword123")
    user = models.User(email="protected_user@legalease.ai", hashed_password=hashed)
    db_session.add(user)
    db_session.commit()

    token = create_access_token({"sub": "protected_user@legalease.ai"})
    headers = {"Authorization": f"Bearer {token}"}

    payload = {"message": "Hello"}
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        r = await ac.post("/chat", json=payload, headers=headers)
        # Should bypass authentication and return 200 or 503 (service unavailable) instead of 401/403
        assert r.status_code in [200, 503]
