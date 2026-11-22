import asyncio
import logging
import os
from contextlib import asynccontextmanager, suppress
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import backend.models  # noqa: F401 — ensures all models are registered with Base.metadata
from backend.api import auth, jobs, admin, facilities, account, bookings, push, calendar


log = logging.getLogger(__name__)


def _check_worker_heartbeat() -> None:
    from backend.core.email import send_worker_stale_email
    from backend.core.heartbeat import check_and_alert
    from backend.db import SessionLocal

    db = SessionLocal()
    try:
        check_and_alert(db, datetime.now(timezone.utc), send_worker_stale_email)
    finally:
        db.close()


async def _worker_watchdog(interval: float) -> None:
    """Prüft periodisch den Worker-Heartbeat und alarmiert Admins bei Ausfall."""
    while True:
        await asyncio.sleep(interval)
        try:
            await asyncio.to_thread(_check_worker_heartbeat)
        except Exception as exc:
            log.error("Worker watchdog failed: %s", exc)


@asynccontextmanager
async def lifespan(_: FastAPI):
    if not os.environ.get("JWT_SECRET"):
        raise RuntimeError("JWT_SECRET environment variable is not set")
    interval = float(os.environ.get("WORKER_WATCHDOG_INTERVAL_SECONDS", "300"))
    watchdog = asyncio.create_task(_worker_watchdog(interval)) if interval > 0 else None
    yield
    if watchdog is not None:
        watchdog.cancel()
        with suppress(asyncio.CancelledError):
            await watchdog


app = FastAPI(title="Eversports Booking API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.environ.get("FRONTEND_URL", "http://localhost:5173")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(jobs.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(facilities.router, prefix="/api")
app.include_router(account.router, prefix="/api")
app.include_router(bookings.router, prefix="/api")
app.include_router(push.router, prefix="/api")
app.include_router(calendar.router, prefix="/api")
