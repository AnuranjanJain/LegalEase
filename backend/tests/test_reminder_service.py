"""
Tests for backend.services.reminder_service.

Covers the threshold-stacking bug fix: an obligation that has crossed
multiple reminder thresholds (30/15/1 days) in a single run should only
generate ONE notification, with all crossed thresholds marked as sent —
not one notification per crossed threshold.
"""

from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.database import Base
from backend import models
from backend.services.reminder_service import run_obligation_reminders


@pytest.fixture()
def db_session():
    """Fresh in-memory SQLite DB per test, isolated from other test files."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def test_user(db_session):
    user = models.User(email="test@example.com", hashed_password="not-a-real-hash")
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture()
def test_document(db_session, test_user):
    doc = models.DocumentRecord(
        user_id=test_user.id,
        filename="contract.pdf",
        file_type="application/pdf",
    )
    db_session.add(doc)
    db_session.commit()
    db_session.refresh(doc)
    return doc


def _make_obligation(db_session, user, document, days_from_now, reminder_sent_stage=""):
    obligation = models.Obligation(
        user_id=user.id,
        document_id=document.id,
        title="Test filing deadline",
        due_date=(datetime.now(timezone.utc) + timedelta(days=days_from_now)).replace(tzinfo=None),
        status="pending",
        reminder_sent_stage=reminder_sent_stage,
    )
    db_session.add(obligation)
    db_session.commit()
    db_session.refresh(obligation)
    return obligation


class TestReminderThresholdStacking:
    """Regression tests for the multi-threshold stacking bug."""

    def test_fires_only_one_notification_when_multiple_thresholds_crossed(
        self, db_session, test_user, test_document
    ):
        """
        An obligation 1 day from due, with no prior reminders sent, is
        simultaneously inside the 30-day, 15-day, and 1-day windows.
        Only ONE notification should be created, not three.
        """
        obligation = _make_obligation(db_session, test_user, test_document, days_from_now=1)

        created = run_obligation_reminders(db_session)

        assert created == 1

        notifications = (
            db_session.query(models.Notification)
            .filter(models.Notification.user_id == test_user.id)
            .all()
        )
        assert len(notifications) == 1
        assert "Upcoming deadline" in notifications[0].title

    def test_marks_all_crossed_thresholds_as_sent(
        self, db_session, test_user, test_document
    ):
        """
        Even though only one notification fires, every threshold the
        obligation has already crossed (30, 15, 1) must be recorded as
        sent, so none of them can fire retroactively on a later run.
        """
        obligation = _make_obligation(db_session, test_user, test_document, days_from_now=1)

        run_obligation_reminders(db_session)
        db_session.refresh(obligation)

        sent_stages = {int(s) for s in obligation.reminder_sent_stage.split(",") if s}
        assert sent_stages == {30, 15, 1}

    def test_second_run_does_not_duplicate_notification(
        self, db_session, test_user, test_document
    ):
        """
        Idempotency check: running the job again immediately afterward
        (same obligation, same due date) should create zero additional
        notifications, since all applicable thresholds are already sent.
        """
        _make_obligation(db_session, test_user, test_document, days_from_now=1)

        first_run = run_obligation_reminders(db_session)
        second_run = run_obligation_reminders(db_session)

        assert first_run == 1
        assert second_run == 0

        total_notifications = db_session.query(models.Notification).count()
        assert total_notifications == 1

    def test_fires_exactly_one_notification_at_30_day_boundary(
        self, db_session, test_user, test_document
    ):
        """
        An obligation exactly 30 days out (only inside the widest window)
        should still produce exactly one notification — the normal,
        non-stacked case.
        """
        _make_obligation(db_session, test_user, test_document, days_from_now=30)

        created = run_obligation_reminders(db_session)

        assert created == 1
        notifications = db_session.query(models.Notification).count()
        assert notifications == 1

    def test_no_notification_when_outside_all_thresholds(
        self, db_session, test_user, test_document
    ):
        """An obligation 90 days out is outside every threshold — no reminder yet."""
        _make_obligation(db_session, test_user, test_document, days_from_now=90)

        created = run_obligation_reminders(db_session)

        assert created == 0
        assert db_session.query(models.Notification).count() == 0

    def test_overdue_obligation_does_not_fire(
        self, db_session, test_user, test_document
    ):
        """
        Negative days_remaining (already past due) should not trigger a
        notification — reminders are for upcoming deadlines, not overdue
        ones (a separate feature's concern).
        """
        _make_obligation(db_session, test_user, test_document, days_from_now=-5)

        created = run_obligation_reminders(db_session)

        assert created == 0
        assert db_session.query(models.Notification).count() == 0

    def test_partial_thresholds_already_sent_only_fires_for_remaining(
        self, db_session, test_user, test_document
    ):
        """
        If the 30-day reminder already fired on a previous run, and the
        obligation has now crossed into the 15-day and 1-day windows too,
        only ONE new notification should fire for the still-unsent,
        closest applicable threshold — and it should be marked alongside
        the others crossed in this run.
        """
        obligation = _make_obligation(
            db_session, test_user, test_document, days_from_now=1, reminder_sent_stage="30"
        )

        created = run_obligation_reminders(db_session)
        db_session.refresh(obligation)

        assert created == 1
        sent_stages = {int(s) for s in obligation.reminder_sent_stage.split(",") if s}
        assert sent_stages == {30, 15, 1}

    def test_multiple_obligations_each_get_own_notification(
        self, db_session, test_user, test_document
    ):
        """Sanity check: the one-notification-per-run fix is per-obligation, not global."""
        _make_obligation(db_session, test_user, test_document, days_from_now=1)
        _make_obligation(db_session, test_user, test_document, days_from_now=10)

        created = run_obligation_reminders(db_session)

        assert created == 2
        assert db_session.query(models.Notification).count() == 2