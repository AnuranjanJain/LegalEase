"""
comments_routes.py
───────────────────
REST endpoints for persisted, threaded, clause-anchored document comments.

Complements the ephemeral WebSocket collaboration in collaboration_routes.py:
that file handles live cursor/edit broadcasting with in-memory-only state,
while this router persists comments to the database so they survive page
reloads and full room disconnects.
"""

import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.auth import validate_token_or_api_key, AuthIdentity
from backend.database import get_db
from backend import models

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/documents", tags=["comments"])


class CommentCreateRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=5_000)
    clause_anchor: Optional[str] = None
    parent_comment_id: Optional[int] = None


class CommentItem(BaseModel):
    id: int
    document_id: int
    user_id: int
    clause_anchor: Optional[str] = None
    content: str
    resolved: bool
    parent_comment_id: Optional[int] = None


class CommentListResponse(BaseModel):
    comments: List[CommentItem]


def _to_item(c: models.DocumentComment) -> CommentItem:
    return CommentItem(
        id=c.id,
        document_id=c.document_id,
        user_id=c.user_id,
        clause_anchor=c.clause_anchor,
        content=c.content,
        resolved=bool(c.resolved),
        parent_comment_id=c.parent_comment_id,
    )


def _get_owned_document(document_id: int, user_id: int, db: Session) -> models.DocumentRecord:
    doc = (
        db.query(models.DocumentRecord)
        .filter(
            models.DocumentRecord.id == document_id,
            models.DocumentRecord.user_id == user_id,
        )
        .first()
    )
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    return doc


@router.post("/{document_id}/comments", response_model=CommentItem)
async def create_comment(
    document_id: int,
    payload: CommentCreateRequest,
    identity: AuthIdentity = Depends(validate_token_or_api_key),
    db: Session = Depends(get_db),
):
    user_id = identity.get_user_id()
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    _get_owned_document(document_id, user_id, db)

    if payload.parent_comment_id is not None:
        parent = (
            db.query(models.DocumentComment)
            .filter(
                models.DocumentComment.id == payload.parent_comment_id,
                models.DocumentComment.document_id == document_id,
            )
            .first()
        )
        if not parent:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parent comment not found")

    comment = models.DocumentComment(
        document_id=document_id,
        user_id=user_id,
        clause_anchor=payload.clause_anchor,
        content=payload.content,
        parent_comment_id=payload.parent_comment_id,
        resolved=0,
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)

    # Broadcast to any live collaborators in this document's room
    try:
        from backend.routers.collaboration_routes import manager
        await manager.broadcast(str(document_id), {
            "type": "comment_added",
            "comment": _to_item(comment).model_dump(),
        })
    except Exception:
        logger.warning("Failed to broadcast comment_added for document %s", document_id, exc_info=True)

    return _to_item(comment)


@router.get("/{document_id}/comments", response_model=CommentListResponse)
async def list_comments(
    document_id: int,
    identity: AuthIdentity = Depends(validate_token_or_api_key),
    db: Session = Depends(get_db),
):
    user_id = identity.get_user_id()
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    _get_owned_document(document_id, user_id, db)

    comments = (
        db.query(models.DocumentComment)
        .filter(models.DocumentComment.document_id == document_id)
        .order_by(models.DocumentComment.created_at.asc())
        .all()
    )
    return CommentListResponse(comments=[_to_item(c) for c in comments])


@router.patch("/comments/{comment_id}/resolve", response_model=CommentItem)
async def resolve_comment(
    comment_id: int,
    identity: AuthIdentity = Depends(validate_token_or_api_key),
    db: Session = Depends(get_db),
):
    user_id = identity.get_user_id()
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    comment = db.query(models.DocumentComment).filter(models.DocumentComment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")

    # Ownership check via the parent document, same pattern as _get_owned_document
    _get_owned_document(comment.document_id, user_id, db)

    comment.resolved = 1
    db.commit()
    db.refresh(comment)

    try:
        from backend.routers.collaboration_routes import manager
        await manager.broadcast(str(comment.document_id), {
            "type": "comment_resolved",
            "comment_id": comment.id,
        })
    except Exception:
        logger.warning("Failed to broadcast comment_resolved for comment %s", comment_id, exc_info=True)

    return _to_item(comment)