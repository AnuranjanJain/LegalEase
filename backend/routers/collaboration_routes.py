"""
Real-time multiplayer collaboration via WebSockets & Redis pub/sub.

Provides:
  - WebSocket endpoint for document collaboration rooms
  - Cursor tracking and broadcasting
  - Document edit synchronization
  - Active user presence management
"""

import json
import logging
import asyncio
from datetime import datetime, timezone
from typing import Dict, Set, Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from backend.auth import SECRET_KEY, ALGORITHM, is_token_revoked
from backend.database import SessionLocal
from backend import models

logger = logging.getLogger(__name__)

router = APIRouter(tags=["collaboration"])

# Note: persisted, threaded comments (comment_added / comment_resolved events)
# are handled in comments_routes.py, which imports `manager` from this module
# to broadcast into the same room. This file only owns ephemeral state
# (cursors, live edits, presence)

class ConnectionManager:
    """Manages WebSocket connections for real-time document collaboration rooms."""

    def __init__(self):
        # room_id -> set of WebSocket connections
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        # room_id -> { user_id: { cursor_position, username, color } }
        self.user_cursors: Dict[str, Dict[str, dict]] = {}
        # room_id -> { user_id: username }
        self.active_users: Dict[str, Dict[str, str]] = {}

    async def connect(self, websocket: WebSocket, room_id: str, user_id: str, username: str):
        await websocket.accept()
        if room_id not in self.active_connections:
            self.active_connections[room_id] = set()
            self.user_cursors[room_id] = {}
            self.active_users[room_id] = {}

        self.active_connections[room_id].add(websocket)
        self.active_users[room_id][user_id] = username

        # Broadcast user joined
        await self.broadcast(room_id, {
            "type": "user_joined",
            "user_id": user_id,
            "username": username,
            "active_users": self.active_users.get(room_id, {}),
            "timestamp": datetime.now(timezone.utc).replace(tzinfo=None).isoformat()
        }, exclude=websocket)

        # Send current state to the new user
        await websocket.send_json({
            "type": "room_state",
            "active_users": self.active_users.get(room_id, {}),
            "cursors": self.user_cursors.get(room_id, {}),
            "timestamp": datetime.now(timezone.utc).replace(tzinfo=None).isoformat()
        })

    def disconnect(self, websocket: WebSocket, room_id: str, user_id: str):
        if room_id in self.active_connections:
            self.active_connections[room_id].discard(websocket)
            self.active_users.get(room_id, {}).pop(user_id, None)
            self.user_cursors.get(room_id, {}).pop(user_id, None)

            if not self.active_connections[room_id]:
                del self.active_connections[room_id]
                self.user_cursors.pop(room_id, None)
                self.active_users.pop(room_id, None)

    async def broadcast(self, room_id: str, message: dict, exclude: Optional[WebSocket] = None):
        if room_id not in self.active_connections:
            return
        disconnected = []
        for connection in self.active_connections[room_id]:
            if connection == exclude:
                continue
            try:
                await connection.send_json(message)
            except Exception:
                disconnected.append(connection)
        for conn in disconnected:
            self.active_connections[room_id].discard(conn)

    async def handle_cursor_update(self, room_id: str, user_id: str, cursor_data: dict, sender: WebSocket):
        if room_id not in self.user_cursors:
            self.user_cursors[room_id] = {}
        self.user_cursors[room_id][user_id] = cursor_data
        await self.broadcast(room_id, {
            "type": "cursor_update",
            "user_id": user_id,
            "cursor": cursor_data,
            "timestamp": datetime.now(timezone.utc).replace(tzinfo=None).isoformat()
        }, exclude=sender)

    async def handle_edit(self, room_id: str, user_id: str, edit_data: dict, sender: WebSocket):
        await self.broadcast(room_id, {
            "type": "document_edit",
            "user_id": user_id,
            "edit": edit_data,
            "timestamp": datetime.now(timezone.utc).replace(tzinfo=None).isoformat()
        }, exclude=sender)


manager = ConnectionManager()


async def _authenticate_websocket(token: Optional[str], db: Session) -> Optional["models.User"]:
    """
    Validate a JWT passed as a query param. Browsers cannot attach custom
    headers to a WebSocket handshake, so Authorization: Bearer isn't an
    option here — this mirrors how other WS-auth patterns work (token in
    the connection URL, validated before accept()).

    Returns the authenticated User on success, or None if the token is
    missing, malformed, expired, or revoked. Callers MUST reject the
    connection when this returns None rather than falling back to
    trusting any client-supplied identity.
    """
    if not token or not SECRET_KEY:
        return None
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None

    email = payload.get("sub")
    jti = payload.get("jti")
    if not email:
        return None
    if jti and is_token_revoked(jti, db):
        return None

    return db.query(models.User).filter(models.User.email == email).first()


@router.websocket("/ws/collaborate/{room_id}")
async def websocket_collaborate(
    websocket: WebSocket,
    room_id: str,
    token: Optional[str] = Query(default=None),
):
    """
    WebSocket endpoint for real-time document collaboration.

    Authentication: the caller must pass a valid JWT access token via the
    `token` query parameter. user_id and username are derived from the
    verified token — never trusted from client input, unlike the previous
    implementation. The caller must also own the document identified by
    room_id (same ownership rule as comments_routes.py's
    _get_owned_document), enforced before the connection is accepted.

    Clients connect to a room (identified by document ID) and can:
      - Send cursor position updates
      - Send document edits
      - Receive broadcasts of other users' cursors and edits
    """
    db = SessionLocal()
    try:
        user = await _authenticate_websocket(token, db)
        if user is None:
            # Reject before accept(): sending a close frame during the
            # handshake instead of upgrading the connection at all.
            await websocket.close(code=4401)
            return

        try:
            document_id = int(room_id)
        except ValueError:
            await websocket.close(code=4404)
            return

        owns_document = (
            db.query(models.DocumentRecord)
            .filter(
                models.DocumentRecord.id == document_id,
                models.DocumentRecord.user_id == user.id,
            )
            .first()
        )
        if owns_document is None:
            await websocket.close(code=4403)
            return

        user_id = str(user.id)
        username = user.email
    finally:
        db.close()

    await manager.connect(websocket, room_id, user_id, username)
    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")

            if msg_type == "cursor_update":
                await manager.handle_cursor_update(
                    room_id, user_id, data.get("cursor", {}), websocket
                )
            elif msg_type == "document_edit":
                await manager.handle_edit(
                    room_id, user_id, data.get("edit", {}), websocket
                )
            elif msg_type == "ping":
                await websocket.send_json({"type": "pong"})

    except WebSocketDisconnect:
        manager.disconnect(websocket, room_id, user_id)
        await manager.broadcast(room_id, {
            "type": "user_left",
            "user_id": user_id,
            "username": username,
            "active_users": manager.active_users.get(room_id, {}),
            "timestamp": datetime.now(timezone.utc).replace(tzinfo=None).isoformat()
        })
    except Exception as e:
        logger.error(f"WebSocket error in room {room_id}: {e}")
        manager.disconnect(websocket, room_id, user_id)