import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.auth import get_current_user
from backend.database import get_db
from backend import models

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/history", tags=["history"])


# --------------- Response schemas ---------------

class ChatSessionOut(BaseModel):
    id: int
    title: str
    created_at: str
    updated_at: str
    message_count: int

    class Config:
        from_attributes = True


class ChatMessageOut(BaseModel):
    id: int
    role: str
    content: str
    created_at: str

    class Config:
        from_attributes = True


class DocumentRecordOut(BaseModel):
    id: int
    filename: str
    file_type: Optional[str] = None
    summary: Optional[str] = None
    uploaded_at: str

    class Config:
        from_attributes = True


# --------------- Endpoints ---------------

@router.get("/chats", response_model=List[ChatSessionOut])
def list_chat_sessions(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return all chat sessions for the authenticated user."""
    sessions = (
        db.query(models.ChatSession)
        .filter(models.ChatSession.user_id == current_user.id)
        .order_by(models.ChatSession.updated_at.desc())
        .all()
    )
    result = []
    for s in sessions:
        result.append(
            ChatSessionOut(
                id=s.id,
                title=s.title or "New Chat",
                created_at=s.created_at.isoformat() if s.created_at else "",
                updated_at=s.updated_at.isoformat() if s.updated_at else "",
                message_count=len(s.messages) if s.messages else 0,
            )
        )
    return result


@router.get("/chats/{session_id}/messages", response_model=List[ChatMessageOut])
def get_chat_messages(
    session_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return all messages in a chat session owned by the authenticated user."""
    session = (
        db.query(models.ChatSession)
        .filter(
            models.ChatSession.id == session_id,
            models.ChatSession.user_id == current_user.id,
        )
        .first()
    )
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat session not found")

    return [
        ChatMessageOut(
            id=m.id,
            role=m.role,
            content=m.content,
            created_at=m.created_at.isoformat() if m.created_at else "",
        )
        for m in session.messages
    ]


@router.get("/documents", response_model=List[DocumentRecordOut])
def list_documents(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return all uploaded documents for the authenticated user."""
    docs = (
        db.query(models.DocumentRecord)
        .filter(models.DocumentRecord.user_id == current_user.id)
        .order_by(models.DocumentRecord.uploaded_at.desc())
        .all()
    )
    return [
        DocumentRecordOut(
            id=d.id,
            filename=d.filename,
            file_type=d.file_type,
            summary=d.summary,
            uploaded_at=d.uploaded_at.isoformat() if d.uploaded_at else "",
        )
        for d in docs
    ]
