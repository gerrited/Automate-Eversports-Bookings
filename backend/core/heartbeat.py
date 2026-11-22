"""Worker-Heartbeat: Lebenszeichen schreiben, Zustand lesen, Ausfall melden.

Der Worker (CronJob, alle 15 Min) schreibt bei jedem Lauf. Ein Lauf kann bis
zu WORKER_LOOKAHEAD Minuten dauern (sekundengenaues Warten), daher bemisst
sich "veraltet" am letzten *Start*: Nach STALE_AFTER ohne Start gelten
mindestens zwei Ticks als verpasst.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import update
from sqlalchemy.orm import Session

from backend.models.user import User
from backend.models.worker_heartbeat import WorkerHeartbeat

log = logging.getLogger(__name__)

HEARTBEAT_ID = "worker"
STALE_AFTER = timedelta(minutes=35)


def _as_utc(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt.astimezone(timezone.utc)


def _get_or_create(db: Session) -> WorkerHeartbeat:
    hb = db.get(WorkerHeartbeat, HEARTBEAT_ID)
    if hb is None:
        hb = WorkerHeartbeat(id=HEARTBEAT_ID)
        db.add(hb)
    return hb


def record_start(db: Session, now: datetime) -> None:
    hb = _get_or_create(db)
    hb.last_started_at = now.astimezone(timezone.utc)
    # Worker lebt wieder → ein künftiger Ausfall darf erneut alarmieren
    hb.alert_sent_at = None
    db.commit()


def record_finish(db: Session, now: datetime, job_count: int) -> None:
    hb = _get_or_create(db)
    hb.last_finished_at = now.astimezone(timezone.utc)
    hb.last_job_count = job_count
    db.commit()


def get_status(db: Session, now: datetime) -> dict:
    hb = db.get(WorkerHeartbeat, HEARTBEAT_ID)
    started = _as_utc(hb.last_started_at) if hb else None
    return {
        "last_started_at": started,
        "last_finished_at": _as_utc(hb.last_finished_at) if hb else None,
        "last_job_count": hb.last_job_count if hb else None,
        "alert_sent_at": _as_utc(hb.alert_sent_at) if hb else None,
        # Noch nie gelaufen gilt nicht als Ausfall (frische Installation)
        "stale": started is not None and now - started > STALE_AFTER,
        "stale_after_minutes": int(STALE_AFTER.total_seconds() // 60),
    }


def check_and_alert(db: Session, now: datetime, send_alert) -> bool:
    """Alarmiert die Admins einmal pro Ausfall. Gibt True zurück, wenn alarmiert wurde.

    Der Claim per bedingtem UPDATE (alert_sent_at IS NULL) verhindert doppelte
    Mails, wenn mehrere Backend-Replikas gleichzeitig prüfen.
    """
    status = get_status(db, now)
    if not status["stale"] or status["alert_sent_at"] is not None:
        return False
    claimed = db.execute(
        update(WorkerHeartbeat)
        .where(WorkerHeartbeat.id == HEARTBEAT_ID, WorkerHeartbeat.alert_sent_at.is_(None))
        .values(alert_sent_at=now)
    ).rowcount
    db.commit()
    if not claimed:
        return False
    admin_emails = [u.email for u in db.query(User).filter(User.role == "admin", User.active.is_(True)).all()]
    log.warning("Worker-Heartbeat veraltet (letzter Start %s) — alarmiere %d Admin(s)",
                status["last_started_at"], len(admin_emails))
    send_alert(admin_emails, status["last_started_at"], status["stale_after_minutes"])
    return True
