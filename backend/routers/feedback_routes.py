import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import Feedback
from backend.auth import validate_token_or_api_key, AuthIdentity

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/feedback",
    tags=["feedback"],
)

class FeedbackCreate(BaseModel):
    response_type: str
    rating: str
    category: Optional[str] = None
    message: Optional[str] = None

@router.post("")
def submit_feedback(
    feedback: FeedbackCreate,
    identity: AuthIdentity = Depends(validate_token_or_api_key),
    db: Session = Depends(get_db)
):
    """Submit user feedback for an AI response."""
    try:
        new_feedback = Feedback(
            user_id=identity.user_id,
            response_type=feedback.response_type,
            rating=feedback.rating,
            category=feedback.category,
            message=feedback.message
        )
        db.add(new_feedback)
        db.commit()
        db.refresh(new_feedback)
        return {"status": "success", "message": "Feedback submitted successfully", "feedback_id": new_feedback.id}
    except Exception as e:
        logger.error(f"Error submitting feedback: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to submit feedback")
