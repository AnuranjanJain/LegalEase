import pytest
from datetime import datetime, timedelta
from httpx import AsyncClient, ASGITransport
from sqlalchemy.orm import Session

from backend.main import app
from backend.database import Base, engine, SessionLocal
from backend import models
from backend.auth import create_access_token


@pytest.fixture
def db_session():
    """Create a fresh database session for each test."""
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture
def test_user(db_session: Session):
    """Create a test user."""
    user = models.User(email="history.user@example.com", hashed_password="hashed_password")
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def user_token(test_user):
    """Generate JWT token for test user."""
    return create_access_token(data={"sub": test_user.email})


@pytest.fixture
def another_user(db_session: Session):
    """Create another user for authorization tests."""
    user = models.User(email="other.user@example.com", hashed_password="hashed_password")
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def another_user_token(another_user):
    """Generate JWT token for another user."""
    return create_access_token(data={"sub": another_user.email})


@pytest.mark.asyncio
async def test_list_chat_sessions_unauthorized():
    """Accessing chat sessions history without credentials should return 401."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        r = await ac.get("/history/chats")
        assert r.status_code == 401


@pytest.mark.asyncio
async def test_list_chat_sessions_paginated(db_session, test_user, user_token):
    """Test paginated fetching of chat sessions."""
    # Seed 5 chat sessions with different updated_at times and varying message counts
    base_time = datetime.utcnow()
    sessions = []
    for i in range(5):
        # We manually space out updated_at so ordering is consistent and deterministic
        session = models.ChatSession(
            user_id=test_user.id,
            title=f"Chat Session {i}",
            created_at=base_time - timedelta(minutes=10 - i),
            updated_at=base_time - timedelta(minutes=10 - i)
        )
        db_session.add(session)
        db_session.flush()

        # Add messages: session 0 -> 0 messages, session 1 -> 1 message, etc.
        for j in range(i):
            msg = models.ChatMessage(
                session_id=session.id,
                role="user" if j % 2 == 0 else "assistant",
                content=f"Msg {j} in session {i}"
            )
            db_session.add(msg)
        
        sessions.append(session)
    db_session.commit()

    headers = {"authorization": f"Bearer {user_token}"}
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. Fetch first page: limit=2, offset=0
        # Expected: Session 4, Session 3 (since session 4 is the newest, with i=4)
        r = await ac.get("/history/chats?limit=2&offset=0", headers=headers)
        assert r.status_code == 200
        data = r.json()
        assert len(data) == 2
        assert data[0]["title"] == "Chat Session 4"
        assert data[0]["message_count"] == 4
        assert data[1]["title"] == "Chat Session 3"
        assert data[1]["message_count"] == 3

        # 2. Fetch second page: limit=2, offset=2
        # Expected: Session 2, Session 1
        r = await ac.get("/history/chats?limit=2&offset=2", headers=headers)
        assert r.status_code == 200
        data = r.json()
        assert len(data) == 2
        assert data[0]["title"] == "Chat Session 2"
        assert data[0]["message_count"] == 2
        assert data[1]["title"] == "Chat Session 1"
        assert data[1]["message_count"] == 1

        # 3. Fetch third page: limit=2, offset=4
        # Expected: Session 0
        r = await ac.get("/history/chats?limit=2&offset=4", headers=headers)
        assert r.status_code == 200
        data = r.json()
        assert len(data) == 1
        assert data[0]["title"] == "Chat Session 0"
        assert data[0]["message_count"] == 0

        # 4. Fetch out of bounds: limit=2, offset=5
        # Expected: Empty list
        r = await ac.get("/history/chats?limit=2&offset=5", headers=headers)
        assert r.status_code == 200
        data = r.json()
        assert len(data) == 0


@pytest.mark.asyncio
async def test_get_chat_messages_eager_loading(db_session, test_user, user_token):
    """Test retrieving chat messages for a valid session."""
    session = models.ChatSession(
        user_id=test_user.id,
        title="Test Session Messages"
    )
    db_session.add(session)
    db_session.flush()

    messages = [
        models.ChatMessage(session_id=session.id, role="user", content="Hello assistant"),
        models.ChatMessage(session_id=session.id, role="assistant", content="Hello user")
    ]
    for msg in messages:
        db_session.add(msg)
    db_session.commit()

    headers = {"authorization": f"Bearer {user_token}"}
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        r = await ac.get(f"/history/chats/{session.id}/messages", headers=headers)
        assert r.status_code == 200
        data = r.json()
        assert len(data) == 2
        assert data[0]["role"] == "user"
        assert data[0]["content"] == "Hello assistant"
        assert data[1]["role"] == "assistant"
        assert data[1]["content"] == "Hello user"


@pytest.mark.asyncio
async def test_get_chat_messages_not_found(db_session, test_user, user_token):
    """Retrieving messages of a non-existent session should return 404."""
    headers = {"authorization": f"Bearer {user_token}"}
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        r = await ac.get("/history/chats/999999/messages", headers=headers)
        assert r.status_code == 404
        assert r.json()["detail"] == "Chat session not found"


@pytest.mark.asyncio
async def test_get_chat_messages_unauthorized_session(
    db_session, test_user, user_token, another_user
):
    """Retrieving messages of a session owned by another user should return 404."""
    session = models.ChatSession(
        user_id=another_user.id,
        title="Other User Session"
    )
    db_session.add(session)
    db_session.commit()

    headers = {"authorization": f"Bearer {user_token}"}
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        r = await ac.get(f"/history/chats/{session.id}/messages", headers=headers)
        assert r.status_code == 404
        assert r.json()["detail"] == "Chat session not found"


@pytest.mark.asyncio
async def test_list_documents(db_session, test_user, user_token):
    """Test retrieving uploaded documents history."""
    doc1 = models.DocumentRecord(
        user_id=test_user.id,
        filename="contract1.pdf",
        file_type="application/pdf",
        summary="A summary of contract 1"
    )
    doc2 = models.DocumentRecord(
        user_id=test_user.id,
        filename="contract2.docx",
        file_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        summary="A summary of contract 2"
    )
    db_session.add(doc1)
    db_session.add(doc2)
    db_session.commit()

    headers = {"authorization": f"Bearer {user_token}"}
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        r = await ac.get("/history/documents", headers=headers)
        assert r.status_code == 200
        data = r.json()
        assert len(data) == 2
        # Documents are ordered by uploaded_at desc
        assert data[0]["filename"] in ["contract1.pdf", "contract2.docx"]
        assert data[1]["filename"] in ["contract1.pdf", "contract2.docx"]
