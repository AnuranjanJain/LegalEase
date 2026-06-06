import os
import logging

from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

logger = logging.getLogger(__name__)

# Read database URL from environment; fall back to local SQLite for development.
_database_url = os.getenv("DATABASE_URL", "sqlite:///./legalease.db")

# SQLAlchemy requires 'postgresql://' but some providers (e.g. Heroku, Supabase)
# supply 'postgres://'. Normalise the scheme automatically.
if _database_url.startswith("postgres://"):
    _database_url = _database_url.replace("postgres://", "postgresql://", 1)

_is_sqlite = _database_url.startswith("sqlite")

if _is_sqlite:
    # check_same_thread=False is required for SQLite with FastAPI
    engine = create_engine(
        _database_url,
        connect_args={"check_same_thread": False, "timeout": 30},
    )
    logger.info("Using SQLite database (local development mode)")
else:
    # Production-ready connection pool for PostgreSQL / other databases
    engine = create_engine(
        _database_url,
        pool_size=5,
        max_overflow=10,
        pool_pre_ping=True,
    )
    logger.info("Using production database via DATABASE_URL")

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
