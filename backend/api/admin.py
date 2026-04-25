import logging
import os
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import case, func
from sqlalchemy.orm import Session

from backend.api.deps import require_admin
from backend.core.email import send_account_status_email, send_limit_enforced_email, send_test_email
from backend.db import get_db
from backend.models.booking_job import BookingJob
from backend.models.booking_log import BookingLog
from backend.models.user import User
from backend.schemas.job import AdminJobResponse
from backend.schemas.log import AdminLogsPage, AdminLogResponse
from backend.schemas.user import UserResponse, SetActiveRequest, SetLimitRequest

log = logging.getLogger(__name__)

router = APIRouter()


@router.get("/admin/users", response_model=List[UserResponse])
def list_users(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(
            User,
            func.count(BookingJob.id).label("job_count"),
            func.sum(case((BookingJob.enabled == True, 1), else_=0)).label("active_job_count"),
        )
        .outerjoin(BookingJob, BookingJob.user_id == User.id)
        .group_by(User.id)
        .order_by(User.created_at)
        .all()
    )
    return [
        UserResponse(
            id=user.id,
            email=user.email,
            active=user.active,
            role=user.role,
            job_count=job_count,
            active_job_count=active_job_count or 0,
            max_active_jobs=user.max_active_jobs,
            created_at=user.created_at,
        )
        for user, job_count, active_job_count in rows
    ]


@router.patch("/admin/users/{user_id}/active", response_model=UserResponse)
def set_user_active(
    user_id: str,
    body: SetActiveRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    if user_id == current_user.id and not body.active:
        raise HTTPException(status_code=400, detail="Cannot deactivate your own account")
    user.active = body.active
    db.commit()
    db.refresh(user)
    try:
        send_account_status_email(user.email, user.active)
    except Exception as exc:
        log.error("Failed to send account status email: %s", exc)
    job_count = db.query(func.count(BookingJob.id)).filter(BookingJob.user_id == user.id).scalar()
    active_job_count = db.query(func.count(BookingJob.id)).filter(
        BookingJob.user_id == user.id, BookingJob.enabled == True
    ).scalar()
    return UserResponse(
        id=user.id,
        email=user.email,
        active=user.active,
        role=user.role,
        job_count=job_count,
        active_job_count=active_job_count or 0,
        max_active_jobs=user.max_active_jobs,
        created_at=user.created_at,
    )


@router.patch("/admin/users/{user_id}/limit", response_model=UserResponse)
def set_user_limit(
    user_id: str,
    body: SetLimitRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    user.max_active_jobs = body.max_active_jobs

    jobs_deactivated = False
    if body.max_active_jobs is not None:
        active_jobs = (
            db.query(BookingJob)
            .filter(BookingJob.user_id == user_id, BookingJob.enabled == True)
            .all()
        )
        if len(active_jobs) > body.max_active_jobs:
            for job in active_jobs:
                job.enabled = False
            jobs_deactivated = True

    db.commit()
    db.refresh(user)

    if jobs_deactivated:
        try:
            send_limit_enforced_email(user.email, body.max_active_jobs)
        except Exception as exc:
            log.error("Failed to send limit enforced email: %s", exc)

    job_count = db.query(func.count(BookingJob.id)).filter(BookingJob.user_id == user.id).scalar()
    active_job_count = db.query(func.count(BookingJob.id)).filter(
        BookingJob.user_id == user.id, BookingJob.enabled == True
    ).scalar()
    return UserResponse(
        id=user.id,
        email=user.email,
        active=user.active,
        role=user.role,
        job_count=job_count,
        active_job_count=active_job_count or 0,
        max_active_jobs=user.max_active_jobs,
        created_at=user.created_at,
    )


@router.get("/admin/jobs", response_model=List[AdminJobResponse])
def list_all_jobs(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(
            BookingJob,
            User.email.label("user_email"),
            func.sum(case((BookingLog.status == "success", 1), else_=0)).label("success_count"),
            func.sum(case((BookingLog.status == "failed", 1), else_=0)).label("failed_count"),
            func.sum(case((BookingLog.status == "already_booked", 1), else_=0)).label("already_booked_count"),
        )
        .join(User, User.id == BookingJob.user_id)
        .outerjoin(BookingLog, BookingLog.job_id == BookingJob.id)
        .group_by(BookingJob.id, User.email)
        .order_by(BookingJob.weekday, BookingJob.target_time, User.email)
        .all()
    )
    return [
        AdminJobResponse(
            id=job.id,
            weekday=job.weekday,
            target_time=job.target_time,
            facility_id=job.facility_id,
            facility_name=job.facility_name,
            class_name=job.class_name,
            days_in_advance=job.days_in_advance,
            enabled=job.enabled,
            one_time=job.one_time,
            debug=job.debug,
            created_at=job.created_at,
            user_email=user_email,
            success_count=success_count or 0,
            failed_count=failed_count or 0,
            already_booked_count=already_booked_count or 0,
        )
        for job, user_email, success_count, failed_count, already_booked_count in rows
    ]


@router.get("/admin/logs", response_model=AdminLogsPage)
def list_all_logs(
    page: int = 1,
    user_email: Optional[str] = None,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    PAGE_SIZE = 50
    query = (
        db.query(BookingLog, BookingJob, User.email.label("user_email"))
        .join(BookingJob, BookingJob.id == BookingLog.job_id)
        .join(User, User.id == BookingJob.user_id)
    )
    if user_email:
        query = query.filter(User.email.ilike(f"%{user_email}%"))
    total = query.count()
    rows = (
        query
        .order_by(BookingLog.executed_at.desc())
        .offset((page - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE)
        .all()
    )
    items = [
        AdminLogResponse(
            id=log.id,
            job_id=log.job_id,
            executed_at=log.executed_at,
            target_date=log.target_date,
            status=log.status,
            message=log.message,
            class_name=job.class_name,
            facility_name=job.facility_name,
            target_time=job.target_time,
            weekday=job.weekday,
            debug=job.debug,
            user_email=email,
        )
        for log, job, email in rows
    ]
    return AdminLogsPage(items=items, total=total, page=page, page_size=PAGE_SIZE)


class TestEmailRequest(BaseModel):
    type: Literal[
        "new_user",
        "account_activated",
        "account_deactivated",
        "booking_failure",
        "debug_cancel_failure",
    ]


@router.post("/admin/test-email")
def send_test_email_endpoint(
    body: TestEmailRequest,
    current_user: User = Depends(require_admin),
):
    if not os.environ.get("RESEND_API_KEY") or not os.environ.get("FROM_EMAIL"):
        raise HTTPException(status_code=503, detail="E-Mail nicht konfiguriert")
    try:
        send_test_email(current_user.email, body.type)
    except Exception as exc:
        log.error("Failed to send test email: %s", exc)
        raise HTTPException(status_code=500, detail="E-Mail konnte nicht gesendet werden")
    return {"detail": "Test-Mail gesendet"}
