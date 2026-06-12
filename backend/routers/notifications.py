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
    prefix="/notifications",
    tags=["notifications"]
)


class NotificationResponse(BaseModel):
    id: int
    title: str
    description: Optional[str]
    type: str
    read: bool
    created_at: str

    class Config:
        from_attributes = True


class NotificationListResponse(BaseModel):
    notifications: list[NotificationResponse]
    unread_count: int


class CreateNotificationRequest(BaseModel):
    title: str
    description: Optional[str] = None
    type: str = "system"


@router.get("", response_model=NotificationListResponse)
def get_notifications(
    current_user: AuthIdentity = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Fetch all notifications for the authenticated user.
    Returns notifications ordered by creation date (newest first).
    """
    if not current_user.user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    try:
        db_notifications = (
            db.query(models.Notification)
            .filter(models.Notification.user_id == current_user.user.id)
            .order_by(models.Notification.created_at.desc())
            .all()
        )
    except SQLAlchemyError as exc:
        logger.exception("Failed to fetch notifications")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve notifications",
        )

    notifications = [
        NotificationResponse(
            id=n.id,
            title=n.title,
            description=n.description,
            type=n.type,
            read=bool(n.read),
            created_at=n.created_at.isoformat() + "Z",
        )
        for n in db_notifications
    ]
    unread_count = sum(1 for n in notifications if not n.read)

    return NotificationListResponse(
        notifications=notifications,
        unread_count=unread_count,
    )


@router.post("/{notification_id}/read")
def mark_notification_read(
    notification_id: int,
    current_user: AuthIdentity = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Mark a specific notification as read.
    """
    if not current_user.user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    try:
        notification = (
            db.query(models.Notification)
            .filter(
                models.Notification.id == notification_id,
                models.Notification.user_id == current_user.user.id
            )
            .first()
        )
    except SQLAlchemyError as exc:
        logger.exception("Failed to query notification")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error",
        )

    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )

    notification.read = 1
    try:
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        logger.exception("Failed to mark notification as read")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update notification",
        )

    return {"detail": "Notification marked as read"}


@router.post("/read-all")
def mark_all_notifications_read(
    current_user: AuthIdentity = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Mark all notifications for the authenticated user as read.
    """
    if not current_user.user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    try:
        (
            db.query(models.Notification)
            .filter(
                models.Notification.user_id == current_user.user.id,
                models.Notification.read == 0
            )
            .update({"read": 1})
        )
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        logger.exception("Failed to mark all notifications as read")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update notifications",
        )

    return {"detail": "All notifications marked as read"}


@router.delete("/{notification_id}")
def delete_notification(
    notification_id: int,
    current_user: AuthIdentity = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Delete a specific notification.
    """
    if not current_user.user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    try:
        notification = (
            db.query(models.Notification)
            .filter(
                models.Notification.id == notification_id,
                models.Notification.user_id == current_user.user.id
            )
            .first()
        )
    except SQLAlchemyError:
        logger.exception("Failed to query notification")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error",
        )

    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )

    db.delete(notification)
    try:
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        logger.exception("Failed to delete notification")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete notification",
        )

    return {"detail": "Notification deleted"}


@router.post("", status_code=status.HTTP_201_CREATED)
def create_notification(
    payload: CreateNotificationRequest,
    current_user: AuthIdentity = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create a new notification for the authenticated user.
    This endpoint can be called by the application when specific events occur.
    """
    if not current_user.user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    if payload.type not in ("document", "security", "system"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid notification type. Must be 'document', 'security', or 'system'",
        )

    try:
        notification = models.Notification(
            user_id=current_user.user.id,
            title=payload.title,
            description=payload.description,
            type=payload.type,
            read=0,
        )
        db.add(notification)
        db.commit()
        db.refresh(notification)
    except SQLAlchemyError:
        db.rollback()
        logger.exception("Failed to create notification")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create notification",
        )

    return NotificationResponse(
        id=notification.id,
        title=notification.title,
        description=notification.description,
        type=notification.type,
        read=bool(notification.read),
        created_at=notification.created_at.isoformat() + "Z",
    )