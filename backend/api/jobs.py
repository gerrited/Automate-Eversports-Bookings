from __future__ import annotations

from datetime import date, timedelta
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.api.deps import get_current_active_user
from backend.core.booking import book_session, cancel_booking
from backend.core.encryption import decrypt
from backend.db import get_db
from backend.models.booking_job import BookingJob
from backend.models.booking_log import BookingLog
from backend.models.user import User
from backend.schemas.job import JobCreate, JobUpdate, JobResponse
from backend.schemas.log import LogResponse


def _find_duplicate(
    user_id: str,
    weekday: int,
    target_time,
    facility_id: str,
    class_name: str,
    db: Session,
    exclude_id: str | None = None,
) -> BookingJob | None:
    q = db.query(BookingJob).filter(
        BookingJob.user_id == user_id,
        BookingJob.weekday == weekday,
        BookingJob.target_time == target_time,
        BookingJob.facility_id == facility_id,
        BookingJob.class_name == class_name,
    )
    if exclude_id:
        q = q.filter(BookingJob.id != exclude_id)
    return q.first()


def _check_job_limit(user: User, db: Session) -> None:
    if user.max_active_jobs is None:
        return
    active_count = db.query(BookingJob).filter(
        BookingJob.user_id == user.id,
        BookingJob.enabled == True,
    ).count()
    if active_count >= user.max_active_jobs:
        raise HTTPException(
            status_code=409,
            detail=f"Limit von {user.max_active_jobs} aktiven Buchungen erreicht.",
        )


def _get_owned_job(job_id: str, current_user: User, db: Session) -> BookingJob:
    job = db.query(BookingJob).filter(BookingJob.id == job_id).first()
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your job")
    return job


def _next_weekday(weekday: int) -> date:
    """Nächstes Datum ab heute mit dem gegebenen Wochentag (0=Mo … 6=So).
    Gibt heute zurück, wenn der Wochentag übereinstimmt."""
    today = date.today()
    days_ahead = (weekday - today.weekday()) % 7
    return today + timedelta(days=days_ahead)


class ExecuteJobResponse(BaseModel):
    status: str   # "success" | "already_booked" | "failed"
    message: str


router = APIRouter()


@router.get("/jobs", response_model=List[JobResponse])
def list_jobs(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    return db.query(BookingJob).filter(BookingJob.user_id == current_user.id).all()


@router.post("/jobs", response_model=JobResponse, status_code=201)
def create_job(
    body: JobCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    if _find_duplicate(current_user.id, body.weekday, body.target_time, body.facility_id, body.class_name, db):
        raise HTTPException(status_code=409, detail="Ein identischer Job existiert bereits.")
    _check_job_limit(current_user, db)
    job = BookingJob(**body.model_dump(), user_id=current_user.id)
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


@router.put("/jobs/{job_id}", response_model=JobResponse)
def update_job(
    job_id: str,
    body: JobUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    job = _get_owned_job(job_id, current_user, db)
    updated = {**{f: getattr(job, f) for f in ("weekday", "target_time", "facility_id", "class_name")}, **body.model_dump(exclude_unset=True)}
    if _find_duplicate(current_user.id, updated["weekday"], updated["target_time"], updated["facility_id"], updated["class_name"], db, exclude_id=job_id):
        raise HTTPException(status_code=409, detail="Ein identischer Job existiert bereits.")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(job, field, value)
    db.commit()
    db.refresh(job)
    return job


@router.patch("/jobs/{job_id}/toggle", response_model=JobResponse)
def toggle_job(
    job_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    job = _get_owned_job(job_id, current_user, db)
    if not job.enabled:
        _check_job_limit(current_user, db)
    job.enabled = not job.enabled
    db.commit()
    db.refresh(job)
    return job


@router.delete("/jobs/{job_id}", status_code=204)
def delete_job(
    job_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    job = _get_owned_job(job_id, current_user, db)
    db.delete(job)
    db.commit()


@router.get("/jobs/{job_id}/logs", response_model=List[LogResponse])
def get_job_logs(
    job_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    job = _get_owned_job(job_id, current_user, db)
    return (
        db.query(BookingLog)
        .filter(BookingLog.job_id == job.id)
        .order_by(BookingLog.executed_at.desc())
        .limit(20)
        .all()
    )


@router.post("/jobs/{job_id}/execute", response_model=ExecuteJobResponse)
def execute_job(
    job_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    job = _get_owned_job(job_id, current_user, db)
    target_date = _next_weekday(job.weekday)

    password = decrypt(current_user.encrypted_password)

    try:
        result = book_session(
            email=current_user.email,
            password=password,
            target_date=target_date,
            target_time=job.target_time.strftime("%H:%M"),
            facility_id=job.facility_id,
            class_name=job.class_name,
            event_type=job.event_type,
        )
        status = result["status"]
        message = str(target_date)

        if status == "success" and result.get("event_type") and job.event_type != result["event_type"]:
            job.event_type = result["event_type"]

        if status == "success" and job.debug:
            try:
                cancel_booking(
                    email=current_user.email,
                    password=password,
                    class_name=job.class_name,
                    facility_id=job.facility_id,
                )
                message = f"[DEBUG] gebucht und storniert für {target_date}"
            except Exception as cancel_exc:
                message = f"[DEBUG] gebucht, Stornierung fehlgeschlagen: {cancel_exc}"

    except Exception as exc:
        status = "failed"
        message = str(exc)

    db.add(BookingLog(job_id=job.id, target_date=target_date, status=status, message=message))
    db.commit()

    return ExecuteJobResponse(status=status, message=message)
