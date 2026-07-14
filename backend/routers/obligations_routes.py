"""
Obligations ledger: an aggregated, sortable view of extracted deadlines
across a user's entire document portfolio, plus completion tracking.
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session
from pydantic import BaseModel

from backend.database import get_db
from backend import models
from backend.auth import get_current_user, AuthIdentity

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/obligations",
    tags=["obligations"],
)

VALID_STATUSES = {"pending", "completed", "dismissed"}


class ObligationResponse(BaseModel):
    id: int
    document_id: int
    title: str
    due_date: str
    description: Optional[str]
    status: str
    created_at: str

    class Config:
        from_attributes = True


class ObligationListResponse(BaseModel):
    obligations: list[ObligationResponse]


class UpdateObligationRequest(BaseModel):
    status: str  # 'pending' | 'completed' | 'dismissed'


def _to_response(o: models.Obligation) -> ObligationResponse:
    return ObligationResponse(
        id=o.id,
        document_id=o.document_id,
        title=o.title,
        due_date=o.due_date.isoformat() + "Z",
        description=o.description,
        status=o.status,
        created_at=o.created_at.isoformat() + "Z",
    )


@router.get("", response_model=ObligationListResponse)
def get_obligations(
    current_user: AuthIdentity = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Return every obligation for the authenticated user, across all of their
    documents, ordered by due date (soonest first).
    """
    if not current_user.user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    try:
        rows = (
            db.query(models.Obligation)
            .filter(models.Obligation.user_id == current_user.user.id)
            .order_by(models.Obligation.due_date.asc())
            .all()
        )
    except SQLAlchemyError:
        logger.exception("Failed to fetch obligations")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve obligations",
        )

    return ObligationListResponse(obligations=[_to_response(o) for o in rows])


@router.patch("/{obligation_id}", response_model=ObligationResponse)
def update_obligation(
    obligation_id: int,
    payload: UpdateObligationRequest,
    current_user: AuthIdentity = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Update an obligation's status (mark complete/dismissed). Completed and
    dismissed obligations are excluded from active reminders.
    """
    if not current_user.user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    if payload.status not in VALID_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status. Must be one of: {', '.join(sorted(VALID_STATUSES))}",
        )

    try:
        obligation = (
            db.query(models.Obligation)
            .filter(
                models.Obligation.id == obligation_id,
                models.Obligation.user_id == current_user.user.id,
            )
            .first()
        )
    except SQLAlchemyError:
        logger.exception("Failed to query obligation")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error",
        )

    if not obligation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Obligation not found",
        )

    obligation.status = payload.status
    try:
        db.commit()
        db.refresh(obligation)
    except SQLAlchemyError:
        db.rollback()
        logger.exception("Failed to update obligation")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update obligation",
        )

    return _to_response(obligation)