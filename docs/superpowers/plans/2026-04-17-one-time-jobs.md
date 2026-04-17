# One-Time Jobs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `one_time` flag to jobs so that after a successful booking the job is automatically deleted; failed jobs are retried as usual.

**Architecture:** A new boolean column `one_time` (default `false`) is added to `booking_jobs`. The worker checks this flag after writing a success/already_booked log entry and deletes the job (cascade removes its logs). The frontend adds a checkbox in the create/edit modal and a badge on one-time job cards.

**Tech Stack:** Python/FastAPI/SQLAlchemy/Alembic (backend), React/TypeScript/Tailwind (frontend), pytest/vitest (tests).

---

## File Map

| File | Change |
|---|---|
| `backend/alembic/versions/c1d2e3f4a5b6_add_one_time_to_booking_jobs.py` | New migration |
| `backend/models/booking_job.py` | Add `one_time` column |
| `backend/schemas/job.py` | Add `one_time` to `JobCreate`, `JobUpdate`, `JobResponse` |
| `worker/worker.py` | Delete one-time job after success/already_booked |
| `tests/worker/test_worker.py` | New tests for one-time deletion logic |
| `tests/backend/test_api_jobs.py` | Assert `one_time` in API responses |
| `frontend/src/types.ts` | Add `one_time` to `Job` and `JobFormData` |
| `frontend/src/components/JobModal.tsx` | Add checkbox |
| `frontend/src/components/JobModal.test.tsx` | Tests for checkbox |
| `frontend/src/components/JobCard.tsx` | Add badge for one-time jobs |
| `frontend/src/components/JobCard.test.tsx` | Test for badge |

---

## Task 1: Alembic Migration

**Files:**
- Create: `backend/alembic/versions/c1d2e3f4a5b6_add_one_time_to_booking_jobs.py`

- [ ] **Step 1: Write the migration file**

```python
"""add_one_time_to_booking_jobs

Revision ID: c1d2e3f4a5b6
Revises: 237a66a44ff1
Create Date: 2026-04-17

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'c1d2e3f4a5b6'
down_revision: Union[str, None] = '237a66a44ff1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('booking_jobs', sa.Column(
        'one_time', sa.Boolean(), nullable=False, server_default='false'
    ))


def downgrade() -> None:
    op.drop_column('booking_jobs', 'one_time')
```

- [ ] **Step 2: Commit**

```bash
git add backend/alembic/versions/c1d2e3f4a5b6_add_one_time_to_booking_jobs.py
git commit -m "feat: add one_time migration for booking_jobs"
```

---

## Task 2: Model and Schemas

**Files:**
- Modify: `backend/models/booking_job.py`
- Modify: `backend/schemas/job.py`

- [ ] **Step 1: Add `one_time` column to the model**

In `backend/models/booking_job.py`, add after the `enabled` line:

```python
one_time = Column(Boolean, default=False, nullable=False)
```

Full file after change:

```python
import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Boolean, Time, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from backend.db import Base


class BookingJob(Base):
    __tablename__ = "booking_jobs"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    weekday = Column(Integer, nullable=False)   # 0=Mon … 6=Sun
    target_time = Column(Time, nullable=False)
    facility_id = Column(String, nullable=False)
    facility_name = Column(String, nullable=False, server_default='')
    class_name = Column(String, nullable=False)
    days_in_advance = Column(Integer, nullable=False)
    enabled = Column(Boolean, default=True, nullable=False)
    one_time = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="jobs")
    logs = relationship("BookingLog", back_populates="job", cascade="all, delete-orphan")
```

- [ ] **Step 2: Add `one_time` to schemas**

Full replacement of `backend/schemas/job.py`:

```python
from __future__ import annotations

from datetime import time, datetime
from typing import Optional
from pydantic import BaseModel


class JobCreate(BaseModel):
    weekday: int       # 0=Mon … 6=Sun
    target_time: time
    facility_id: str
    facility_name: str
    class_name: str
    days_in_advance: int
    one_time: bool = False


class JobUpdate(BaseModel):
    weekday: Optional[int] = None
    target_time: Optional[time] = None
    facility_id: Optional[str] = None
    facility_name: Optional[str] = None
    class_name: Optional[str] = None
    days_in_advance: Optional[int] = None
    one_time: Optional[bool] = None


class JobResponse(BaseModel):
    id: str
    weekday: int
    target_time: time
    facility_id: str
    facility_name: str
    class_name: str
    days_in_advance: int
    enabled: bool
    one_time: bool
    created_at: datetime

    model_config = {"from_attributes": True}
```

- [ ] **Step 3: Commit**

```bash
git add backend/models/booking_job.py backend/schemas/job.py
git commit -m "feat: add one_time field to BookingJob model and schemas"
```

---

## Task 3: Worker — Delete One-Time Job After Success

**Files:**
- Modify: `worker/worker.py`
- Modify: `tests/worker/test_worker.py`

- [ ] **Step 1: Write the failing tests**

Add to `tests/worker/test_worker.py`. The `_job` helper needs a `one_time` param — update it first, then add the new tests:

```python
def _job(db, jid="j1", uid="u1", weekday=1, days=4, one_time=False):
    j = BookingJob(
        id=jid, user_id=uid, weekday=weekday,
        target_time=time(18, 0), facility_id="73041",
        class_name="CrossFit", days_in_advance=days, enabled=True,
        one_time=one_time,
    )
    db.add(j)
    db.commit()
    return j


def test_run_deletes_one_time_job_after_success(db_session, mocker):
    _user(db_session, uid="ot1", ev="ev_ot1", email="ot1@b.com")
    _job(db_session, jid="jot1", uid="ot1", weekday=1, days=4, one_time=True)
    friday_18 = datetime(2026, 4, 10, 18, 0)

    mocker.patch("worker.worker.decrypt", return_value="pass")
    mocker.patch("worker.worker.book_session", return_value={"status": "success", "order_id": "ord-ot1"})

    run(db_session, friday_18)

    remaining = db_session.query(BookingJob).filter(BookingJob.id == "jot1").first()
    assert remaining is None


def test_run_deletes_one_time_job_after_already_booked(db_session, mocker):
    _user(db_session, uid="ot2", ev="ev_ot2", email="ot2@b.com")
    _job(db_session, jid="jot2", uid="ot2", weekday=1, days=4, one_time=True)
    friday_18 = datetime(2026, 4, 10, 18, 0)

    mocker.patch("worker.worker.decrypt", return_value="pass")
    mocker.patch("worker.worker.book_session", return_value={"status": "already_booked", "order_id": None})

    run(db_session, friday_18)

    remaining = db_session.query(BookingJob).filter(BookingJob.id == "jot2").first()
    assert remaining is None


def test_run_keeps_one_time_job_after_failure(db_session, mocker):
    _user(db_session, uid="ot3", ev="ev_ot3", email="ot3@b.com")
    _job(db_session, jid="jot3", uid="ot3", weekday=1, days=4, one_time=True)
    friday_18 = datetime(2026, 4, 10, 18, 0)

    mocker.patch("worker.worker.decrypt", return_value="pass")
    mocker.patch("worker.worker.book_session", side_effect=RuntimeError("Class full"))
    mocker.patch("worker.worker.send_booking_failure_email")

    run(db_session, friday_18)

    remaining = db_session.query(BookingJob).filter(BookingJob.id == "jot3").first()
    assert remaining is not None


def test_run_keeps_regular_job_after_success(db_session, mocker):
    _user(db_session, uid="ot4", ev="ev_ot4", email="ot4@b.com")
    _job(db_session, jid="jot4", uid="ot4", weekday=1, days=4, one_time=False)
    friday_18 = datetime(2026, 4, 10, 18, 0)

    mocker.patch("worker.worker.decrypt", return_value="pass")
    mocker.patch("worker.worker.book_session", return_value={"status": "success", "order_id": "ord-ot4"})

    run(db_session, friday_18)

    remaining = db_session.query(BookingJob).filter(BookingJob.id == "jot4").first()
    assert remaining is not None
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
pytest tests/worker/test_worker.py::test_run_deletes_one_time_job_after_success tests/worker/test_worker.py::test_run_deletes_one_time_job_after_already_booked tests/worker/test_worker.py::test_run_keeps_one_time_job_after_failure tests/worker/test_worker.py::test_run_keeps_regular_job_after_success -v
```

Expected: all 4 FAIL (job is not being deleted yet)

- [ ] **Step 3: Implement the deletion logic in the worker**

In `worker/worker.py`, modify the `run()` function. After `db.add(log_entry)` and `db.commit()`, add the one-time deletion block:

```python
def run(db: Session, now: datetime) -> None:
    jobs = (
        db.query(BookingJob)
        .join(User, BookingJob.user_id == User.id)
        .filter(BookingJob.enabled.is_(True), User.active.is_(True))
        .all()
    )
    log.info("Found %d active jobs", len(jobs))

    for job in jobs:
        if not is_due(job, now):
            continue

        target_date = now.date() + timedelta(days=job.days_in_advance)
        log.info("Job %s: due for %s", job.id, target_date)

        if already_booked(db, job, target_date):
            log.info("Job %s: already booked for %s, skipping", job.id, target_date)
            continue

        user = db.query(User).filter(User.id == job.user_id).first()
        if user is None:
            log.error("Job %s: user %s not found", job.id, job.user_id)
            continue

        try:
            password = decrypt(user.encrypted_password)
            result = book_session(
                email=user.email,
                password=password,
                target_date=target_date,
                target_time=job.target_time.strftime("%H:%M"),
                facility_id=job.facility_id,
                class_name=job.class_name,
            )
            log_entry = BookingLog(
                job_id=job.id,
                target_date=target_date,
                status=result["status"],
                message=result.get("order_id"),
            )
            log.info("Job %s: %s order=%s", job.id, result["status"], result.get("order_id"))
        except Exception as exc:
            log_entry = BookingLog(
                job_id=job.id,
                target_date=target_date,
                status="failed",
                message=str(exc),
            )
            log.error("Job %s: failed — %s", job.id, exc)
            try:
                send_booking_failure_email(user.email, job, str(exc), target_date)
            except Exception as email_exc:
                log.error("Job %s: could not send failure email — %s", job.id, email_exc)

        db.add(log_entry)
        db.commit()

        if job.one_time and log_entry.status in ("success", "already_booked"):
            log.info("Job %s: one-time job executed successfully, deleting", job.id)
            db.delete(job)
            db.commit()
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
pytest tests/worker/test_worker.py -v
```

Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add worker/worker.py tests/worker/test_worker.py
git commit -m "feat: delete one-time jobs after successful execution"
```

---

## Task 4: API Tests — Assert `one_time` in Responses

**Files:**
- Modify: `tests/backend/test_api_jobs.py`

- [ ] **Step 1: Update `test_create_job` to assert `one_time`**

In `tests/backend/test_api_jobs.py`, update the `test_create_job` test to also assert the default value:

```python
def test_create_job(client, db_session):
    user = _create_user(db_session)
    payload = {
        "weekday": 1,
        "target_time": "18:00:00",
        "facility_id": "73041",
        "facility_name": "CrossFit Rabbit Hole",
        "class_name": "CrossFit",
        "days_in_advance": 4,
    }
    resp = client.post("/api/jobs", json=payload, headers=_auth_header(user.id))
    assert resp.status_code == 201
    body = resp.json()
    assert body["weekday"] == 1
    assert body["facility_id"] == "73041"
    assert body["enabled"] is True
    assert body["one_time"] is False
```

- [ ] **Step 2: Add a test for creating a one-time job**

```python
def test_create_one_time_job(client, db_session):
    user = _create_user(db_session)
    payload = {
        "weekday": 2,
        "target_time": "10:00:00",
        "facility_id": "73041",
        "facility_name": "CrossFit Rabbit Hole",
        "class_name": "Yoga",
        "days_in_advance": 2,
        "one_time": True,
    }
    resp = client.post("/api/jobs", json=payload, headers=_auth_header(user.id))
    assert resp.status_code == 201
    assert resp.json()["one_time"] is True


def test_update_job_one_time_flag(client, db_session):
    user = _create_user(db_session)
    create_resp = client.post(
        "/api/jobs",
        json={"weekday": 1, "target_time": "18:00:00", "facility_id": "73041",
              "facility_name": "CrossFit Rabbit Hole", "class_name": "CrossFit",
              "days_in_advance": 4},
        headers=_auth_header(user.id),
    )
    job_id = create_resp.json()["id"]
    resp = client.put(f"/api/jobs/{job_id}", json={"one_time": True}, headers=_auth_header(user.id))
    assert resp.status_code == 200
    assert resp.json()["one_time"] is True
```

- [ ] **Step 3: Run API tests**

```bash
pytest tests/backend/test_api_jobs.py -v
```

Expected: all tests PASS

- [ ] **Step 4: Commit**

```bash
git add tests/backend/test_api_jobs.py
git commit -m "test: assert one_time field in job API tests"
```

---

## Task 5: Frontend Types

**Files:**
- Modify: `frontend/src/types.ts`

- [ ] **Step 1: Add `one_time` to `Job` and `JobFormData`**

Full replacement of `frontend/src/types.ts`:

```typescript
export interface Job {
  id: string
  weekday: number        // 0=Mon … 6=Sun
  target_time: string   // "HH:MM:SS"
  facility_id: string
  facility_name: string
  class_name: string
  days_in_advance: number
  enabled: boolean
  one_time: boolean
  created_at: string
}

export interface JobFormData {
  weekday: number
  target_time: string   // "HH:MM"
  facility_id: string
  facility_name: string
  class_name: string
  days_in_advance: number
  one_time: boolean
}

export interface Facility {
  id: string
  name: string
}

export interface BookingLog {
  id: string
  job_id: string
  executed_at: string
  target_date: string
  status: 'success' | 'failed' | 'already_booked'
  message: string | null
}

export const WEEKDAY_NAMES = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag']

export interface UserRecord {
  id: string
  email: string
  active: boolean
  role: string
  job_count: number
  created_at: string
}
```

- [ ] **Step 2: Run frontend type check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: type errors about `one_time` missing in test fixtures — these will be fixed in the next tasks.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/types.ts
git commit -m "feat: add one_time to Job and JobFormData types"
```

---

## Task 6: JobModal — Checkbox

**Files:**
- Modify: `frontend/src/components/JobModal.tsx`
- Modify: `frontend/src/components/JobModal.test.tsx`

- [ ] **Step 1: Write failing tests**

In `frontend/src/components/JobModal.test.tsx`, add these tests. Also add `one_time: false` to the existing job fixture in `prefills fields when editing an existing job`:

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import JobModal from './JobModal'

describe('JobModal', () => {
  const onSave = vi.fn()
  const onClose = vi.fn()

  it('renders all form fields', () => {
    render(<JobModal onSave={onSave} onClose={onClose} />)
    expect(screen.getByLabelText(/wochentag/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/uhrzeit/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/kursname/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/facility/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/tage im voraus/i)).toBeInTheDocument()
  })

  it('renders one_time checkbox unchecked by default', () => {
    render(<JobModal onSave={onSave} onClose={onClose} />)
    const checkbox = screen.getByLabelText(/einmalige buchung/i) as HTMLInputElement
    expect(checkbox).toBeInTheDocument()
    expect(checkbox.checked).toBe(false)
  })

  it('calls onSave with form data on submit', async () => {
    render(<JobModal onSave={onSave} onClose={onClose} />)
    fireEvent.change(screen.getByLabelText(/uhrzeit/i), { target: { value: '18:00' } })
    fireEvent.change(screen.getByLabelText(/kursname/i), { target: { value: 'CrossFit' } })
    fireEvent.change(screen.getByLabelText(/facility/i), { target: { value: '73041' } })
    fireEvent.change(screen.getByLabelText(/tage im voraus/i), { target: { value: '4' } })
    fireEvent.click(screen.getByRole('button', { name: /speichern/i }))
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ class_name: 'CrossFit', facility_id: '73041', days_in_advance: 4, one_time: false })
    ))
  })

  it('calls onSave with one_time true when checkbox is checked', async () => {
    render(<JobModal onSave={onSave} onClose={onClose} />)
    fireEvent.change(screen.getByLabelText(/facility/i), { target: { value: '73041' } })
    fireEvent.click(screen.getByLabelText(/einmalige buchung/i))
    fireEvent.click(screen.getByRole('button', { name: /speichern/i }))
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ one_time: true })
    ))
  })

  it('prefills fields when editing an existing job', () => {
    const job = {
      id: 'j1', weekday: 2, target_time: '09:00:00', facility_id: '73041',
      class_name: 'Yoga', days_in_advance: 3, enabled: true, one_time: true, created_at: '',
    }
    render(<JobModal job={job} onSave={onSave} onClose={onClose} />)
    expect((screen.getByLabelText(/kursname/i) as HTMLInputElement).value).toBe('Yoga')
    expect((screen.getByLabelText(/tage im voraus/i) as HTMLInputElement).value).toBe('3')
    expect((screen.getByLabelText(/einmalige buchung/i) as HTMLInputElement).checked).toBe(true)
  })

  it('calls onClose when cancel is clicked', () => {
    render(<JobModal onSave={onSave} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: /abbrechen/i }))
    expect(onClose).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd frontend && npx vitest run src/components/JobModal.test.tsx
```

Expected: new tests FAIL (checkbox not yet rendered)

- [ ] **Step 3: Add checkbox to JobModal**

Full replacement of `frontend/src/components/JobModal.tsx`:

```tsx
import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import type { Job, JobFormData, Facility } from '../types'
import { WEEKDAY_NAMES } from '../types'
import FacilityCombobox from './FacilityCombobox'
import CourseCombobox from './CourseCombobox'
import { getCourses } from '../api/facilities'

interface Props {
  job?: Job
  onSave: (data: JobFormData) => Promise<void>
  onClose: () => void
  error?: string | null
}

export default function JobModal({ job, onSave, onClose, error }: Props) {
  const [weekday, setWeekday] = useState(job?.weekday ?? 0)
  const [targetTime, setTargetTime] = useState(job?.target_time.slice(0, 5) ?? '18:00')
  const [facility, setFacility] = useState<Facility | null>(
    job ? { id: job.facility_id, name: job.facility_name } : null
  )
  const [className, setClassName] = useState(job?.class_name ?? 'CrossFit')
  const [daysInAdvance, setDaysInAdvance] = useState(job?.days_in_advance ?? 4)
  const [oneTime, setOneTime] = useState(job?.one_time ?? false)
  const [courses, setCourses] = useState<string[]>([])

  useEffect(() => {
    if (!facility) {
      setCourses([])
      return
    }
    let cancelled = false
    getCourses(facility.id)
      .then(data => { if (!cancelled) setCourses(data) })
      .catch(() => { if (!cancelled) setCourses([]) })
    return () => { cancelled = true }
  }, [facility?.id])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!facility) return
    await onSave({
      weekday,
      target_time: targetTime,
      facility_id: facility.id,
      facility_name: facility.name,
      class_name: className,
      days_in_advance: Number(daysInAdvance),
      one_time: oneTime,
    })
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="bg-surface-card rounded-xl w-full max-w-md p-6">
        <h2 className="text-white font-bold text-lg mb-5">
          {job ? 'Routine bearbeiten' : 'Neue Routine anlegen'}
        </h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-slate-400 text-sm">Einrichtung</span>
            <FacilityCombobox value={facility} onChange={setFacility} />
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-slate-400 text-sm">Kursname</span>
            <CourseCombobox
              value={className}
              onChange={setClassName}
              facilityCourses={courses}
            />
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-slate-400 text-sm">Wochentag</span>
            <select
              aria-label="Wochentag"
              value={weekday}
              onChange={e => setWeekday(Number(e.target.value))}
              className="bg-surface-input text-white rounded-lg px-3 py-2 outline-hidden focus:ring-2 focus:ring-brand"
            >
              {WEEKDAY_NAMES.map((name, i) => (
                <option key={i} value={i}>{name}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-slate-400 text-sm">Uhrzeit</span>
            <input
              aria-label="Uhrzeit"
              type="time"
              value={targetTime}
              onChange={e => setTargetTime(e.target.value)}
              required
              className="bg-surface-input text-white rounded-lg px-3 py-2 outline-hidden focus:ring-2 focus:ring-brand"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-slate-400 text-sm">Tage im Voraus</span>
            <input
              aria-label="Tage im Voraus"
              type="number"
              min={1}
              max={30}
              value={daysInAdvance}
              onChange={e => setDaysInAdvance(Number(e.target.value))}
              required
              className="bg-surface-input text-white rounded-lg px-3 py-2 outline-hidden focus:ring-2 focus:ring-brand"
            />
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              aria-label="Einmalige Buchung"
              type="checkbox"
              checked={oneTime}
              onChange={e => setOneTime(e.target.checked)}
              className="w-4 h-4 rounded accent-brand"
            />
            <span className="text-slate-300 text-sm">
              Einmalige Buchung (wird nach Ausführung gelöscht)
            </span>
          </label>

          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}

          <div className="flex gap-3 justify-end mt-2">
            <button
              type="submit"
              disabled={!facility}
              className="px-4 py-2 bg-brand hover:bg-brand-hover text-white rounded-lg font-semibold transition-colors disabled:opacity-50"
            >
              Speichern
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
            >
              Abbrechen
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd frontend && npx vitest run src/components/JobModal.test.tsx
```

Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/JobModal.tsx frontend/src/components/JobModal.test.tsx
git commit -m "feat: add one_time checkbox to JobModal"
```

---

## Task 7: JobCard — Badge for One-Time Jobs

**Files:**
- Modify: `frontend/src/components/JobCard.tsx`
- Modify: `frontend/src/components/JobCard.test.tsx`

- [ ] **Step 1: Write failing test**

In `frontend/src/components/JobCard.test.tsx`, add `one_time: false` to the existing `job` fixture and add a new test:

```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import JobCard from './JobCard'
import type { Job } from '../types'

const job: Job = {
  id: 'job-1',
  weekday: 1,
  target_time: '18:00:00',
  facility_id: '73041',
  facility_name: 'CrossFit Rabbit Hole',
  class_name: 'CrossFit',
  days_in_advance: 4,
  enabled: true,
  one_time: false,
  created_at: '2026-04-01T00:00:00Z',
}

describe('JobCard', () => {
  it('renders weekday, time and class name', () => {
    render(
      <JobCard job={job} onToggle={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} onSelect={vi.fn()} />
    )
    expect(screen.getByText(/Di/)).toBeInTheDocument()
    expect(screen.getByText(/18:00/)).toBeInTheDocument()
    expect(screen.getByText('CrossFit')).toBeInTheDocument()
  })

  it('does not show one-time badge for regular jobs', () => {
    render(
      <JobCard job={job} onToggle={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} onSelect={vi.fn()} />
    )
    expect(screen.queryByText(/einmalig/i)).not.toBeInTheDocument()
  })

  it('shows one-time badge for one-time jobs', () => {
    render(
      <JobCard job={{ ...job, one_time: true }} onToggle={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} onSelect={vi.fn()} />
    )
    expect(screen.getByText(/einmalig/i)).toBeInTheDocument()
  })

  it('calls onToggle when toggle is clicked', () => {
    const onToggle = vi.fn()
    render(
      <JobCard job={job} onToggle={onToggle} onEdit={vi.fn()} onDelete={vi.fn()} onSelect={vi.fn()} />
    )
    fireEvent.click(screen.getByRole('switch'))
    expect(onToggle).toHaveBeenCalledWith('job-1')
  })

  it('calls onEdit when edit button is clicked', () => {
    const onEdit = vi.fn()
    render(
      <JobCard job={job} onToggle={vi.fn()} onEdit={onEdit} onDelete={vi.fn()} onSelect={vi.fn()} />
    )
    fireEvent.click(screen.getByRole('button', { name: /bearbeiten/i }))
    expect(onEdit).toHaveBeenCalledWith(job)
  })

  it('calls onDelete when delete button is clicked', () => {
    const onDelete = vi.fn()
    render(
      <JobCard job={job} onToggle={vi.fn()} onEdit={vi.fn()} onDelete={onDelete} onSelect={vi.fn()} />
    )
    fireEvent.click(screen.getByRole('button', { name: /löschen/i }))
    expect(onDelete).toHaveBeenCalledWith('job-1')
  })

  it('calls onSelect when card body is clicked', () => {
    const onSelect = vi.fn()
    render(
      <JobCard job={job} onToggle={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} onSelect={onSelect} />
    )
    fireEvent.click(screen.getByTestId('job-card-body'))
    expect(onSelect).toHaveBeenCalledWith(job)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd frontend && npx vitest run src/components/JobCard.test.tsx
```

Expected: badge tests FAIL (badge not yet rendered), type errors due to missing `facility_name` in old fixture (also fixed above)

- [ ] **Step 3: Add badge to JobCard**

Full replacement of `frontend/src/components/JobCard.tsx`:

```tsx
import type { Job } from '../types'
import { WEEKDAY_NAMES } from '../types'

interface Props {
  job: Job
  onToggle: (id: string) => void
  onEdit: (job: Job) => void
  onDelete: (id: string) => void
  onSelect: (job: Job) => void
}

export default function JobCard({ job, onToggle, onEdit, onDelete, onSelect }: Props) {
  const time = job.target_time.slice(0, 5)  // "18:00"
  const facilityLabel = job.facility_name || job.facility_id

  return (
    <div className="bg-surface-card rounded-xl overflow-hidden">
      {/* Clickable body */}
      <div
        data-testid="job-card-body"
        className="p-4 cursor-pointer hover:bg-surface-input transition-colors"
        onClick={() => onSelect(job)}
      >
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-white font-semibold">
                {WEEKDAY_NAMES[job.weekday]} · {time} Uhr · {job.class_name}
              </p>
              {job.one_time && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-900/60 text-amber-300 font-medium">
                  Einmalig
                </span>
              )}
            </div>
            <p className="text-slate-400 text-sm mt-1">
              {facilityLabel} · {job.days_in_advance} Tage im Voraus
            </p>
          </div>
          {/* Toggle */}
          <button
            role="switch"
            aria-checked={job.enabled}
            onClick={e => { e.stopPropagation(); onToggle(job.id) }}
            className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${
              job.enabled ? 'bg-green-700' : 'bg-slate-600'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform mt-1 ${
                job.enabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-2 px-4 pb-3 pt-3">
        <button
          aria-label="Bearbeiten"
          onClick={() => onEdit(job)}
          className="px-3 py-1 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm transition-colors"
        >
          Bearbeiten
        </button>
        <button
          aria-label="Löschen"
          onClick={() => onDelete(job.id)}
          className="px-3 py-1 rounded-md bg-red-900 hover:bg-red-700 text-red-300 text-sm transition-colors ml-auto"
        >
          Löschen
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run all frontend tests**

```bash
cd frontend && npx vitest run
```

Expected: all tests PASS

- [ ] **Step 5: Run type check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/JobCard.tsx frontend/src/components/JobCard.test.tsx
git commit -m "feat: show Einmalig badge on one-time job cards"
```

---

## Task 8: Run All Tests

- [ ] **Step 1: Run backend + worker tests**

```bash
pytest tests/ -v
```

Expected: all tests PASS

- [ ] **Step 2: Run frontend tests**

```bash
cd frontend && npx vitest run
```

Expected: all tests PASS

- [ ] **Step 3: Final commit if any stray changes remain**

```bash
git status
```

If clean: done. If there are unstaged changes: investigate before committing.
