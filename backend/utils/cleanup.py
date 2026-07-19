import asyncio
import logging
from datetime import datetime
from sqlalchemy.orm import Session
from backend.database import SessionLocal
from backend.models import RevokedToken

logger = logging.getLogger(__name__)

def purge_expired_tokens_sync(batch_size: int = 1000):
    """
    Synchronous purging logic. Deletes expired entries from `revoked_tokens` table.
    Deletes are performed in batches to prevent long-running locks on the table.
    """
    db: Session = SessionLocal()
    try:
        now = datetime.utcnow()
        total_deleted = 0
        while True:
            # Query IDs first to keep the transaction size and locks minimal
            expired_ids = (
                db.query(RevokedToken.id)
                .filter(RevokedToken.expires_at < now)
                .limit(batch_size)
                .all()
            )
            if not expired_ids:
                break

            id_list = [r[0] for r in expired_ids]

            # Execute batch deletion
            deleted_count = (
                db.query(RevokedToken)
                .filter(RevokedToken.id.in_(id_list))
                .delete(synchronize_session=False)
            )
            db.commit()
            total_deleted += deleted_count
            logger.info(f"Purged batch of {deleted_count} expired blacklist entries.")

            if len(id_list) < batch_size:
                break

        if total_deleted > 0:
            logger.info(f"Completed purging expired blacklist entries. Total deleted: {total_deleted}")
    except Exception as e:
        db.rollback()
        logger.error(f"Error purging expired blacklist entries: {e}", exc_info=True)
        raise e
    finally:
        db.close()

async def purge_expired_tokens(batch_size: int = 1000):
    """
    Asynchronous wrapper that runs the synchronous DB purging process in a separate thread.
    """
    await asyncio.to_thread(purge_expired_tokens_sync, batch_size)

async def start_token_cleanup_task(interval_seconds: int = 3600):
    """
    Loop that runs indefinitely to trigger token blacklist purging at the specified interval.
    """
    logger.info(f"Token cleanup background worker initialized with interval: {interval_seconds}s")
    while True:
        try:
            logger.info("Triggering periodic token blacklist cleanup...")
            await purge_expired_tokens()
        except Exception as e:
            logger.error(f"Periodic token blacklist cleanup failed: {e}")
        await asyncio.sleep(interval_seconds)
