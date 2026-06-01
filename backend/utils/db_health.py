"""
Database health check utility.

Provides health check functionality for database connections.
"""

import logging
from sqlalchemy import text
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


def check_database_health(db: Session) -> bool:
    """
    Check if database connection is healthy.
    
    Args:
        db: Database session
        
    Returns:
        True if healthy, False otherwise
    """
    try:
        # Execute a simple query to check connection
        db.execute(text("SELECT 1"))
        return True
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        return False


def wait_for_database(max_retries: int = 10, delay: float = 1.0) -> bool:
    """
    Wait for database to become available.
    
    Args:
        max_retries: Maximum number of retry attempts
        delay: Delay between retries (seconds)
        
    Returns:
        True if database is available, False otherwise
    """
    import time
    from backend.database import SessionLocal
    
    for attempt in range(max_retries):
        try:
            db = SessionLocal()
            try:
                db.execute(text("SELECT 1"))
                logger.info("Database connection established")
                return True
            finally:
                db.close()
        except Exception as e:
            logger.warning(
                f"Database not available (attempt {attempt + 1}/{max_retries}): {e}. "
                f"Retrying in {delay} seconds..."
            )
            time.sleep(delay)
    
    logger.error(f"Database not available after {max_retries} attempts")
    return False
