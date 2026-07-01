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
from datetime import datetime
from typing import Dict, Set, Optional
from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect, Query, status
from sqlalchemy.orm import Session

from backend.auth import authenticate_websocket_token
from backend.database import get_db

logger = logging.getLogger(__name__)

router = APIRouter(tags=["collaboration"])


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
            "timestamp": datetime.utcnow().isoformat()
        }, exclude=websocket)

        # Send current state to the new user
        await websocket.send_json({
            "type": "room_state",
            "active_users": self.active_users.get(room_id, {}),
            "cursors": self.user_cursors.get(room_id, {}),
            "timestamp": datetime.utcnow().isoformat()
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
            "timestamp": datetime.utcnow().isoformat()
        }, exclude=sender)

    async def handle_edit(self, room_id: str, user_id: str, edit_data: dict, sender: WebSocket):
        await self.broadcast(room_id, {
            "type": "document_edit",
            "user_id": user_id,
            "edit": edit_data,
            "timestamp": datetime.utcnow().isoformat()
        }, exclude=sender)


manager = ConnectionManager()


@router.websocket("/ws/collaborate/{room_id}")
async def websocket_collaborate(
    websocket: WebSocket,
    room_id: str,
    token: Optional[str] = Query(default=None),
    username: str = Query(default="Anonymous"),
    db: Session = Depends(get_db),
):
    """
    WebSocket endpoint for real-time document collaboration.

    Clients connect to a room (identified by document ID) and can:
      - Send cursor position updates
      - Send document edits
      - Receive broadcasts of other users' cursors and edits

    Requires a valid JWT passed as `?token=...` (browser WebSocket clients
    cannot set custom Authorization headers). The connecting user's identity
    is derived from the validated token rather than trusted from client
    input, so a client can no longer join any room and impersonate an
    arbitrary user_id. `username` remains a client-supplied display label
    only, not a security boundary.
    """
    identity = authenticate_websocket_token(token, db)
    if identity is None:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Authentication required")
        return

    user_id = identity.identifier

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
            "timestamp": datetime.utcnow().isoformat()
        })
    except Exception as e:
        logger.error(f"WebSocket error in room {room_id}: {e}")
        manager.disconnect(websocket, room_id, user_id)
