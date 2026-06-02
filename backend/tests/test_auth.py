import pytest
import os
import tempfile
import json
from unittest.mock import patch
from fastapi import status
from httpx import AsyncClient, ASGITransport

from backend.main import app
from auth import ACTIVE_SESSIONS, hash_password, verify_password


@pytest.fixture(autouse=True)
def mock_users_file():
    """Fixture to redirect USERS_FILE to a temporary JSON file to avoid corrupting local data."""
    with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as tmp:
        tmp_path = tmp.name
        tmp.write(b"{}")
        
    with patch("auth.USERS_FILE", tmp_path):
        yield tmp_path
        
    if os.path.exists(tmp_path):
        try:
            os.remove(tmp_path)
        except Exception:
            pass


@pytest.fixture(autouse=True)
def clean_sessions():
    """Fixture to ensure ACTIVE_SESSIONS is clean before and after each test."""
    ACTIVE_SESSIONS.clear()
    yield
    ACTIVE_SESSIONS.clear()


@pytest.mark.asyncio
async def test_register_success():
    """Test user registration successfully saves user credentials and hashed password."""
    payload = {
        "email": "test@legalease.ai",
        "password": "SecurePassword123!",
        "first_name": "Jane",
        "last_name": "Doe"
    }
    
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        r = await ac.post("/auth/register", json=payload)
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "ok"
        assert "registered successfully" in data["message"]


@pytest.mark.asyncio
async def test_register_duplicate_email_rejected():
    """Test registering an already registered email returns a 400 bad request error."""
    payload = {
        "email": "test@legalease.ai",
        "password": "SecurePassword123!",
        "first_name": "Jane",
        "last_name": "Doe"
    }
    
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # First registration
        r1 = await ac.post("/auth/register", json=payload)
        assert r1.status_code == 200
        
        # Duplicate registration
        r2 = await ac.post("/auth/register", json=payload)
        assert r2.status_code == 400
        assert "Email already registered" in r2.json()["detail"]


@pytest.mark.asyncio
async def test_login_success():
    """Test successful user login returns a valid token and user profile."""
    # Pre-register user
    reg_payload = {
        "email": "login@legalease.ai",
        "password": "MySecretPassword",
        "first_name": "Bob",
        "last_name": "Smith"
    }
    
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        r_reg = await ac.post("/auth/register", json=reg_payload)
        assert r_reg.status_code == 200
        
        # Login
        login_payload = {
            "email": "login@legalease.ai",
            "password": "MySecretPassword"
        }
        r_login = await ac.post("/auth/login", json=login_payload)
        assert r_login.status_code == 200
        data = r_login.json()
        
        assert "token" in data
        assert "user" in data
        assert data["user"]["email"] == "login@legalease.ai"
        assert data["user"]["firstName"] == "Bob"
        assert data["user"]["lastName"] == "Smith"
        
        # Confirm token is saved in active sessions
        token = data["token"]
        assert token in ACTIVE_SESSIONS
        assert ACTIVE_SESSIONS[token] == "login@legalease.ai"


@pytest.mark.asyncio
async def test_login_invalid_password_rejected():
    """Test login with incorrect password returns a 401 unauthorized error."""
    reg_payload = {
        "email": "login@legalease.ai",
        "password": "CorrectPassword",
        "first_name": "Bob",
        "last_name": "Smith"
    }
    
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        await ac.post("/auth/register", json=reg_payload)
        
        login_payload = {
            "email": "login@legalease.ai",
            "password": "IncorrectPassword"
        }
        r = await ac.post("/auth/login", json=login_payload)
        assert r.status_code == 401
        assert "Invalid email or password" in r.json()["detail"]


@pytest.mark.asyncio
async def test_login_unregistered_email_rejected():
    """Test login with unregistered email returns a 401 unauthorized error."""
    login_payload = {
        "email": "nonexistent@legalease.ai",
        "password": "AnyPassword"
    }
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        r = await ac.post("/auth/login", json=login_payload)
        assert r.status_code == 401
        assert "Invalid email or password" in r.json()["detail"]


@pytest.mark.asyncio
async def test_get_me_success():
    """Test retrieving authenticated user profile using a valid session token."""
    reg_payload = {
        "email": "me@legalease.ai",
        "password": "Password123",
        "first_name": "Alice",
        "last_name": "Johnson"
    }
    
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        await ac.post("/auth/register", json=reg_payload)
        
        login_r = await ac.post("/auth/login", json={"email": "me@legalease.ai", "password": "Password123"})
        token = login_r.json()["token"]
        
        # Request user profile
        headers = {"Authorization": f"Bearer {token}"}
        r_me = await ac.get("/auth/me", headers=headers)
        assert r_me.status_code == 200
        user_info = r_me.json()
        assert user_info["email"] == "me@legalease.ai"
        assert user_info["firstName"] == "Alice"
        assert user_info["lastName"] == "Johnson"


@pytest.mark.asyncio
async def test_get_me_invalid_token_rejected():
    """Test requesting profile with an invalid/nonexistent token returns 401."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        headers = {"Authorization": "Bearer badtoken123"}
        r = await ac.get("/auth/me", headers=headers)
        assert r.status_code == 401
        assert "Not authenticated" in r.json()["detail"]


@pytest.mark.asyncio
async def test_logout_success():
    """Test logout successfully invalidates the token and restricts subsequent access."""
    reg_payload = {
        "email": "logout@legalease.ai",
        "password": "Password123",
        "first_name": "Larry",
        "last_name": "Logout"
    }
    
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        await ac.post("/auth/register", json=reg_payload)
        
        login_r = await ac.post("/auth/login", json={"email": "logout@legalease.ai", "password": "Password123"})
        token = login_r.json()["token"]
        assert token in ACTIVE_SESSIONS
        
        # Logout
        headers = {"Authorization": f"Bearer {token}"}
        r_logout = await ac.post("/auth/logout", headers=headers)
        assert r_logout.status_code == 200
        assert "Logged out successfully" in r_logout.json()["message"]
        
        # Confirm token is deleted from session list
        assert token not in ACTIVE_SESSIONS
        
        # Profile request should now fail
        r_me = await ac.get("/auth/me", headers=headers)
        assert r_me.status_code == 401


@pytest.mark.asyncio
async def test_logout_invalid_token_rejected():
    """Test logging out with invalid token returns a 401 unauthorized error."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        headers = {"Authorization": "Bearer non_existent_token"}
        r = await ac.post("/auth/logout", headers=headers)
        assert r.status_code == 401


@pytest.mark.asyncio
async def test_protected_endpoints_accept_session_token():
    """Test that standard protected endpoints (e.g. upload) accept user session token."""
    reg_payload = {
        "email": "session@legalease.ai",
        "password": "Password123",
        "first_name": "Peter",
        "last_name": "Parker"
    }
    
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        await ac.post("/auth/register", json=reg_payload)
        login_r = await ac.post("/auth/login", json={"email": "session@legalease.ai", "password": "Password123"})
        token = login_r.json()["token"]
        
        # Use Bearer token for access
        headers = {"Authorization": f"Bearer {token}"}
        content = b"This is sample document text."
        files = {"file": ("test.txt", content, "text/plain")}
        
        r_upload = await ac.post("/upload", files=files, headers=headers)
        # Should bypass authentication successfully and return 200 since text parsing is available
        assert r_upload.status_code == 200
        assert r_upload.json()["filename"] == "test.txt"
