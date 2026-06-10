import os

os.environ.setdefault("ENCRYPTION_KEY", os.urandom(32).hex())
os.environ.setdefault("JWT_SECRET", "test-jwt-secret")
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("FRONTEND_URL", "http://localhost:5173")

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from backend.db import Base


# Standard: SQLite-Datei (Worker-Threads brauchen mehrere Connections).
# In der CI läuft die Suite zusätzlich gegen PostgreSQL (TEST_DATABASE_URL).
TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL")


@pytest.fixture(scope="function")
def engine(tmp_path):
    if TEST_DATABASE_URL:
        eng = create_engine(TEST_DATABASE_URL)
    else:
        db_file = tmp_path / "test.db"
        eng = create_engine(
            f"sqlite:///{db_file}",
            connect_args={"check_same_thread": False},
        )
    Base.metadata.create_all(bind=eng)
    yield eng
    Base.metadata.drop_all(bind=eng)
    eng.dispose()


@pytest.fixture(scope="function")
def db_session(engine):
    Session = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = Session()
    yield session
    session.close()


@pytest.fixture(scope="function")
def session_factory(engine):
    return sessionmaker(autocommit=False, autoflush=False, bind=engine)
