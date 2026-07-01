import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from starlette.websockets import WebSocketDisconnect

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
    user = models.User(email="collab.user@example.com", hashed_password="hashed_password")
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def user_token(test_user):
    return create_access_token(data={"sub": test_user.email})


@pytest.fixture
def other_user(db_session: Session):
    user = models.User(email="collab.other@example.com", hashed_password="hashed_password")
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def other_user_token(other_user):
    return create_access_token(data={"sub": other_user.email})


def test_websocket_rejects_connection_without_token(db_session):
    client = TestClient(app)
    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect("/ws/collaborate/room-1"):
            pass


def test_websocket_rejects_connection_with_invalid_token(db_session):
    client = TestClient(app)
    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect("/ws/collaborate/room-1?token=not-a-real-jwt"):
            pass


def test_websocket_accepts_connection_with_valid_token(db_session, user_token):
    client = TestClient(app)
    with client.websocket_connect(f"/ws/collaborate/room-1?token={user_token}&username=Alice") as websocket:
        state = websocket.receive_json()
        assert state["type"] == "room_state"


def test_websocket_derives_user_id_from_token_not_client_input(db_session, test_user, user_token):
    """
    A client cannot impersonate an arbitrary user_id: the identity used for
    broadcasts must be the authenticated user's email from the token, even
    though the endpoint no longer even accepts a client-supplied user_id.
    """
    client = TestClient(app)
    with client.websocket_connect(f"/ws/collaborate/room-2?token={user_token}&username=Alice") as ws1:
        ws1.receive_json()  # room_state for ws1

        with client.websocket_connect(f"/ws/collaborate/room-2?token={user_token}&username=Alice2") as ws2:
            ws2.receive_json()  # room_state for ws2

            joined_event = ws1.receive_json()
            assert joined_event["type"] == "user_joined"
            assert joined_event["user_id"] == test_user.email


def test_websocket_two_different_users_get_distinct_identities(db_session, test_user, user_token, other_user, other_user_token):
    client = TestClient(app)
    with client.websocket_connect(f"/ws/collaborate/room-3?token={user_token}") as ws1:
        ws1.receive_json()

        with client.websocket_connect(f"/ws/collaborate/room-3?token={other_user_token}") as ws2:
            ws2.receive_json()

            joined_event = ws1.receive_json()
            assert joined_event["user_id"] == other_user.email
            assert joined_event["user_id"] != test_user.email


def test_websocket_cursor_update_uses_authenticated_identity(db_session, test_user, user_token, other_user, other_user_token):
    client = TestClient(app)
    with client.websocket_connect(f"/ws/collaborate/room-4?token={user_token}") as ws1:
        ws1.receive_json()

        with client.websocket_connect(f"/ws/collaborate/room-4?token={other_user_token}") as ws2:
            ws2.receive_json()
            ws1.receive_json()  # user_joined broadcast to ws1

            ws2.send_json({"type": "cursor_update", "cursor": {"line": 5, "col": 2}})
            cursor_event = ws1.receive_json()
            assert cursor_event["type"] == "cursor_update"
            assert cursor_event["user_id"] == other_user.email
