import logging
import os

from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

from backend.config import get_settings

logger = logging.getLogger(__name__)


def is_serverless_environment(*vercel_values: object) -> bool:
    """Return whether any configured Vercel flag identifies a serverless run."""
    return any(
        str(value or "").strip().lower() in {"1", "true", "yes"}
        for value in vercel_values
    )


# Get configuration from centralized settings
settings = get_settings()
_database_url = (settings.database.database_url or "").strip() or None
vercel = settings.database.vercel
environment = settings.environment.environment
is_serverless = is_serverless_environment(os.getenv("VERCEL"), vercel)

# Read database URL from environment; fall back to local SQLite for development.
if not _database_url:
    sqlite_path = "/tmp/legalease.db" if is_serverless else "./legalease.db"
    _database_url = f"sqlite:///{sqlite_path}"

# SQLAlchemy requires 'postgresql://' but some providers (e.g. Heroku, Supabase)
# supply 'postgres://'. Normalise the scheme automatically.
if _database_url.startswith("postgres://"):
    _database_url = _database_url.replace("postgres://", "postgresql://", 1)

_is_sqlite = _database_url.startswith("sqlite")
using_ephemeral_sqlite = _is_sqlite and (
    is_serverless or environment in {"production", "staging"}
)

if _is_sqlite:
    # check_same_thread=False is required for SQLite with FastAPI
    engine = create_engine(
        _database_url,
        connect_args={"check_same_thread": False, "timeout": 30},
    )
    if using_ephemeral_sqlite:
        logger.warning(
            "Using ephemeral SQLite fallback; configure DATABASE_URL for persistent accounts."
        )
    else:
        logger.info("Using SQLite database (local development mode)")
else:
    # Production-ready connection pool for PostgreSQL / other databases
    engine = create_engine(
        _database_url,
        pool_size=5,
        max_overflow=10,
        pool_pre_ping=True,
        connect_args={"connect_timeout": 10},
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
