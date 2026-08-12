"""
Reminder job for upcoming obligation deadlines.

Fires a Notification (reusing the existing notifications table) when a
pending obligation's due_date crosses the 30/15/1-day-out thresholds.
Each threshold fires at most once per obligation, tracked via
Obligation.reminder_sent_stage.
"""

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from backend.database import SessionLocal
from backend import models

logger = logging.getLogger(__name__)

REMINDER_THRESHOLDS_DAYS = (30, 15, 1)


def _sent_stages(obligation: models.Obligation) -> set[int]:
    if not obligation.reminder_sent_stage:
        return set()
    return {
        int(s) for s in obligation.reminder_sent_stage.split(",") if s.strip().isdigit()
    }


def _mark_stage_sent(obligation: models.Obligation, stage: int) -> None:
    stages = _sent_stages(obligation)
    stages.add(stage)
    obligation.reminder_sent_stage = ",".join(str(s) for s in sorted(stages))


def run_obligation_reminders(db: Session | None = None) -> int:
    """
    Check all pending obligations and insert a Notification for any that
    have just crossed a 30/15/1-day threshold. Returns the number of
    notifications created. Safe to call repeatedly (e.g. daily) — already
    sent stages are skipped.
    """
    owns_session = db is None
    if owns_session:
        db = SessionLocal()

    created = 0
    try:
        now = datetime.now(timezone.utc)
        pending = (
            db.query(models.Obligation)
            .filter(models.Obligation.status == "pending")
            .all()
        )

        for obligation in pending:
            # Handle both naive and aware datetimes from database
            due_date = obligation.due_date
            if due_date.tzinfo is None:
                due_date = due_date.replace(tzinfo=timezone.utc)
            days_remaining = (due_date - now).days
            sent_stages = _sent_stages(obligation)

            if days_remaining < 0:
                continue

            # Of the thresholds this obligation currently falls inside and
            # hasn't fired yet, only the closest (smallest) one is actually
            # actionable to the user right now — the wider ones are moot
            # once a tighter window has already been reached. Fire exactly
            # one notification per run, and mark every crossed threshold as
            # sent so the wider ones never fire retroactively afterward.
            applicable = [
                t for t in REMINDER_THRESHOLDS_DAYS
                if days_remaining <= t and t not in sent_stages
            ]
            if not applicable:
                continue

            closest_threshold = min(applicable)
            db.add(
                models.Notification(
                    user_id=obligation.user_id,
                    title=f"Upcoming deadline: {obligation.title}",
                    description=obligation.description
                    or f"Due in {days_remaining} day(s).",
                    type="document",
                )
            )
            for t in applicable:
                _mark_stage_sent(obligation, t)
            created += 1

        db.commit()
        logger.info("Obligation reminder run created %d notification(s)", created)
        return created
    except Exception:
        db.rollback()
        logger.exception("Obligation reminder run failed")
        raise
    finally:
        if owns_session:
            db.close()