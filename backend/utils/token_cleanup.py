"""
Utility to purge expired rows from the revoked_tokens table.

Rows whose `expires_at` is in the past are safe to delete because
the corresponding JWT would already be rejected by the expiry check,
making the blacklist entry redundant.

Usage (call periodically, e.g. from a cron job or a FastAPI startup task):

    from backend.utils.token_cleanup import purge_expired_revoked_tokens
    purge_expired_revoked_tokens(db)
"""
import logging
from datetime import datetime

from sqlalchemy.orm import Session

from backend.models import RevokedToken

logger = logging.getLogger(__name__)


def purge_expired_revoked_tokens(db: Session) -> int:
    """
    Delete all RevokedToken rows that have passed their expiry time.
    Returns the number of rows deleted.
    """
    now = datetime.utcnow()
    try:
        deleted = (
            db.query(RevokedToken)
            .filter(RevokedToken.expires_at < now)
            .delete(synchronize_session=False)
        )
        db.commit()
        if deleted:
            logger.info("Purged %d expired revoked token(s)", deleted)
        return deleted
    except Exception:
        db.rollback()
        logger.exception("Failed to purge expired revoked tokens")
        return 0