import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase, Session
from typing import Generator

class Base(DeclarativeBase):
    pass


_engine = None
_session_factory = None


def _get_engine():
    global _engine
    if _engine is None:
        url = os.environ["DATABASE_URL"]
        if url.startswith("sqlite"):
            kwargs = {"connect_args": {"check_same_thread": False}}
        else:
            kwargs = {
                "pool_size": int(os.environ.get("DB_POOL_SIZE", "5")),
                "max_overflow": int(os.environ.get("DB_MAX_OVERFLOW", "10")),
            }
        _engine = create_engine(url, pool_pre_ping=True, **kwargs)
    return _engine


def _get_session_factory():
    global _session_factory
    if _session_factory is None:
        _session_factory = sessionmaker(autocommit=False, autoflush=False, bind=_get_engine())
    return _session_factory


def get_db() -> Generator[Session, None, None]:
    db = _get_session_factory()()
    try:
        yield db
    finally:
        db.close()


def SessionLocal() -> Session:
    """Used by the worker to create a session directly outside of FastAPI DI."""
    return _get_session_factory()()
