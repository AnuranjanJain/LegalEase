"""Tests for the obligations ledger: model, persist-on-extract, CRUD, reminders."""

import os
os.environ["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY", "testing-secret-key-1234567890-abcdef")

from datetime import datetime, timedelta

import pytest

from backend.database import Base, engine, SessionLocal
from backend import models
from backend.services.reminder_service import run_obligation_reminders


@pytest.fixture
def db_session():
    """Provide a database session for each test, cleaning up rows it creates.

    Re-runs create_all on every fixture setup (not just at module import) so
    this test is self-healing if an earlier test in the session reset the
    database/engine — create_all is a no-op when tables already exist.
    """
    Base.metadata.create_all(bind=engine)
    session = SessionLocal()
    try:
        yield session
    finally:
        session.query(models.Obligation).delete()
        session.query(models.Notification).delete()
        session.query(models.DocumentRecord).delete()
        session.query(models.User).delete()
        session.commit()
        session.close()


def _make_user(db, email="obligation_test@example.com"):
    user = models.User(email=email, hashed_password="hashedpassword")
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _make_document(db, user_id, filename="contract.pdf"):
    doc = models.DocumentRecord(user_id=user_id, filename=filename)
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


def _make_obligation(db, user_id, document_id, due_in_days, status="pending", reminder_sent_stage=""):
    obligation = models.Obligation(
        user_id=user_id,
        document_id=document_id,
        title="Test deadline",
        due_date=datetime.utcnow() + timedelta(days=due_in_days),
        description="A test obligation",
        status=status,
        reminder_sent_stage=reminder_sent_stage,
    )
    db.add(obligation)
    db.commit()
    db.refresh(obligation)
    return obligation


def test_reminder_fires_at_30_day_threshold(db_session):
    user = _make_user(db_session)
    doc = _make_document(db_session, user.id)
    obligation = _make_obligation(db_session, user.id, doc.id, due_in_days=29)

    created = run_obligation_reminders(db_session)

    assert created == 1
    db_session.refresh(obligation)
    assert "30" in obligation.reminder_sent_stage.split(",")


def test_reminder_does_not_refire_same_threshold(db_session):
    user = _make_user(db_session)
    doc = _make_document(db_session, user.id)
    _make_obligation(db_session, user.id, doc.id, due_in_days=29, reminder_sent_stage="30")

    created = run_obligation_reminders(db_session)

    assert created == 0


def test_completed_obligation_excluded_from_reminders(db_session):
    user = _make_user(db_session)
    doc = _make_document(db_session, user.id)
    _make_obligation(db_session, user.id, doc.id, due_in_days=1, status="completed")

    created = run_obligation_reminders(db_session)

    assert created == 0


def test_dismissed_obligation_excluded_from_reminders(db_session):
    user = _make_user(db_session)
    doc = _make_document(db_session, user.id)
    _make_obligation(db_session, user.id, doc.id, due_in_days=1, status="dismissed")

    created = run_obligation_reminders(db_session)

    assert created == 0


def test_reminder_fires_at_multiple_thresholds_independently(db_session):
    user = _make_user(db_session)
    doc = _make_document(db_session, user.id)
    obligation = _make_obligation(db_session, user.id, doc.id, due_in_days=1)

    created = run_obligation_reminders(db_session)

    # A 1-day-out obligation crosses all three thresholds (30, 15, 1) at once
    # on first run since none have fired yet.
    assert created == 3
    db_session.refresh(obligation)
    assert set(obligation.reminder_sent_stage.split(",")) == {"30", "15", "1"}


def test_obligation_model_persists_expected_fields(db_session):
    user = _make_user(db_session)
    doc = _make_document(db_session, user.id)
    obligation = _make_obligation(db_session, user.id, doc.id, due_in_days=10)

    fetched = db_session.query(models.Obligation).filter(
        models.Obligation.id == obligation.id
    ).first()

    assert fetched.user_id == user.id
    assert fetched.document_id == doc.id
    assert fetched.status == "pending"
    assert fetched.title == "Test deadline"