from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.api.deps import get_current_active_user
from backend.db import get_db
from backend.models.booking_job import BookingJob
from backend.models.booking_log import BookingLog
from backend.models.user import User
from backend.schemas.job import JobCreate, JobUpdate, JobResponse
from backend.schemas.log import LogResponse

router = APIRouter()


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


def _get_owned_job(job_id: str, current_user: User, db: Session) -> BookingJob:
    job = db.query(BookingJob).filter(BookingJob.id == job_id).first()
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your job")
    return job


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
