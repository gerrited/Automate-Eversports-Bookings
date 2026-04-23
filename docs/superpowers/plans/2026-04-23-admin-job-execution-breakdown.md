# Admin Job Execution Breakdown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `execution_count` in the admin job list with three separate counts (`success_count`, `failed_count`, `already_booked_count`) and display them as a segmented progress bar on each job card.

**Architecture:** Backend schema and SQL query are updated first (one commit), then frontend types and UI are updated together (one commit). Tests are written before implementation (TDD).

**Tech Stack:** FastAPI + SQLAlchemy 2.0 (backend), React + TypeScript + Tailwind CSS (frontend), pytest (backend tests)

---

### Task 1: Update backend tests for the new response shape

**Files:**
- Modify: `tests/backend/test_api_admin.py`

- [ ] **Step 1: Replace the `_make_log` helper to support any status**

  In `tests/backend/test_api_admin.py`, replace:
  ```python
  def _make_log(db_session, job_id: str) -> BookingLog:
      log = BookingLog(
          job_id=job_id,
          target_date=date(2026, 1, 1),
          status="success",
      )
      db_session.add(log)
      db_session.commit()
      return log
  ```
  with:
  ```python
  def _make_log(db_session, job_id: str, status: str = "success") -> BookingLog:
      log = BookingLog(
          job_id=job_id,
          target_date=date(2026, 1, 1),
          status=status,
      )
      db_session.add(log)
      db_session.commit()
      return log
  ```

- [ ] **Step 2: Replace the two `execution_count` tests with new breakdown tests**

  Remove `test_list_all_jobs_includes_execution_count` and `test_list_all_jobs_zero_execution_count_when_no_logs`.

  Add in their place:
  ```python
  def test_list_all_jobs_counts_by_status(client, db_session):
      admin = _make_admin(db_session, ev_id="ev-a2", email="admin2@x.com")
      user = _make_user(db_session, ev_id="ev-u2", email="user2@x.com")
      job = _make_job(db_session, user.id)
      _make_log(db_session, job.id, status="success")
      _make_log(db_session, job.id, status="success")
      _make_log(db_session, job.id, status="failed")
      _make_log(db_session, job.id, status="already_booked")
      resp = client.get("/api/admin/jobs", headers=_auth_header(admin.id))
      assert resp.status_code == 200
      job_data = next(j for j in resp.json() if j["user_email"] == "user2@x.com")
      assert job_data["success_count"] == 2
      assert job_data["failed_count"] == 1
      assert job_data["already_booked_count"] == 1
      assert "execution_count" not in job_data


  def test_list_all_jobs_zero_counts_when_no_logs(client, db_session):
      admin = _make_admin(db_session, ev_id="ev-a3", email="admin3@x.com")
      user = _make_user(db_session, ev_id="ev-u3", email="user3@x.com")
      _make_job(db_session, user.id)
      resp = client.get("/api/admin/jobs", headers=_auth_header(admin.id))
      assert resp.status_code == 200
      job_data = next(j for j in resp.json() if j["user_email"] == "user3@x.com")
      assert job_data["success_count"] == 0
      assert job_data["failed_count"] == 0
      assert job_data["already_booked_count"] == 0
  ```

- [ ] **Step 3: Run the new tests to confirm they fail**

  ```bash
  pytest tests/backend/test_api_admin.py::test_list_all_jobs_counts_by_status tests/backend/test_api_admin.py::test_list_all_jobs_zero_counts_when_no_logs -v
  ```
  Expected: FAIL (fields not yet in schema/API)

---

### Task 2: Update the backend schema

**Files:**
- Modify: `backend/schemas/job.py`

- [ ] **Step 1: Replace `execution_count` with three count fields**

  In `backend/schemas/job.py`, replace:
  ```python
  class AdminJobResponse(JobResponse):
      user_email: str
      execution_count: int
  ```
  with:
  ```python
  class AdminJobResponse(JobResponse):
      user_email: str
      success_count: int
      failed_count: int
      already_booked_count: int
  ```

---

### Task 3: Update the backend API query

**Files:**
- Modify: `backend/api/admin.py`

- [ ] **Step 1: Add `case` to the SQLAlchemy import**

  Change line 7 from:
  ```python
  from sqlalchemy import func
  ```
  to:
  ```python
  from sqlalchemy import case, func
  ```

- [ ] **Step 2: Replace the single `COUNT` with three conditional `SUM`s**

  Replace the `db.query(...)` block in `list_all_jobs` (lines 84–95):
  ```python
  rows = (
      db.query(
          BookingJob,
          User.email.label("user_email"),
          func.count(BookingLog.id).label("execution_count"),
      )
      .join(User, User.id == BookingJob.user_id)
      .outerjoin(BookingLog, BookingLog.job_id == BookingJob.id)
      .group_by(BookingJob.id, User.email)
      .order_by(BookingJob.weekday, BookingJob.target_time, User.email)
      .all()
  )
  ```
  with:
  ```python
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
  ```

- [ ] **Step 3: Update the response construction**

  Replace the `return [...]` block:
  ```python
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
          execution_count=execution_count,
      )
      for job, user_email, execution_count in rows
  ]
  ```
  with:
  ```python
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
  ```
  Note: `or 0` guards against `None` returned by `SUM` when there are no logs (SQLite returns `None` for `SUM` of an empty set).

- [ ] **Step 4: Run the backend tests**

  ```bash
  pytest tests/backend/test_api_admin.py -v
  ```
  Expected: All tests PASS

- [ ] **Step 5: Commit**

  ```bash
  git add backend/schemas/job.py backend/api/admin.py tests/backend/test_api_admin.py
  git commit -m "feat: replace execution_count with per-status counts in admin jobs API"
  ```

---

### Task 4: Update the frontend types and component

**Files:**
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/components/AllJobsSection.tsx`

- [ ] **Step 1: Update `AdminJob` type**

  In `frontend/src/types.ts`, find the `AdminJob` interface and replace:
  ```typescript
  export interface AdminJob extends Job {
    user_email: string
    execution_count: number
  }
  ```
  with:
  ```typescript
  export interface AdminJob extends Job {
    user_email: string
    success_count: number
    failed_count: number
    already_booked_count: number
  }
  ```

- [ ] **Step 2: Replace the execution count display in `AllJobsSection.tsx`**

  In `frontend/src/components/AllJobsSection.tsx`, find and replace the `<span>` that shows execution count:
  ```tsx
  <span className="ml-3 shrink-0 text-slate-400 text-xs whitespace-nowrap">
    {job.execution_count}× ausgeführt
  </span>
  ```
  with the segmented bar block:
  ```tsx
  {(() => {
    const total = job.success_count + job.failed_count + job.already_booked_count
    if (total === 0) return (
      <span className="ml-3 shrink-0 text-slate-500 text-xs whitespace-nowrap">
        Noch nicht ausgeführt
      </span>
    )
    const successPct = (job.success_count / total) * 100
    const failedPct = (job.failed_count / total) * 100
    const bookedPct = (job.already_booked_count / total) * 100
    return (
      <div className="ml-3 shrink-0 w-28">
        <div className="flex justify-between mb-1">
          {job.success_count > 0 && (
            <span className="text-green-400 text-xs">✓ {job.success_count}</span>
          )}
          {job.failed_count > 0 && (
            <span className="text-red-400 text-xs">✗ {job.failed_count}</span>
          )}
          {job.already_booked_count > 0 && (
            <span className="text-slate-400 text-xs">⊘ {job.already_booked_count}</span>
          )}
        </div>
        <div className="flex h-1.5 rounded-full overflow-hidden bg-slate-700">
          {job.success_count > 0 && (
            <div className="bg-green-400" style={{ width: `${successPct}%` }} />
          )}
          {job.failed_count > 0 && (
            <div className="bg-red-400" style={{ width: `${failedPct}%` }} />
          )}
          {job.already_booked_count > 0 && (
            <div className="bg-slate-500" style={{ width: `${bookedPct}%` }} />
          )}
        </div>
        <div className="text-slate-500 text-xs mt-1 text-right">{total}× gesamt</div>
      </div>
    )
  })()}
  ```

- [ ] **Step 3: Check TypeScript compiles without errors**

  ```bash
  cd frontend && npx tsc --noEmit
  ```
  Expected: No errors

- [ ] **Step 4: Commit**

  ```bash
  git add frontend/src/types.ts frontend/src/components/AllJobsSection.tsx
  git commit -m "feat: show execution breakdown bar on admin job cards"
  ```

---

### Task 5: Verify end-to-end in the browser

- [ ] **Step 1: Start backend and frontend**

  Terminal 1:
  ```bash
  DATABASE_URL=sqlite:///eversports.db \
    JWT_SECRET=test-secret \
    ENCRYPTION_KEY=$(python -c 'import os; print(os.urandom(32).hex())') \
    FRONTEND_URL=http://localhost:5173 \
    uvicorn backend.main:app --reload
  ```

  Terminal 2:
  ```bash
  cd frontend && npm run dev
  ```

- [ ] **Step 2: Open the admin job list**

  Navigate to `http://localhost:5173` → log in as admin → open the admin panel → job list section.

  Verify:
  - Jobs with logs show the segmented bar with correct counts
  - Jobs without logs show "Noch nicht ausgeführt"
  - Bar segments are proportional (e.g. 2 successes + 1 failure: green ~67%, red ~33%)
  - No TypeScript or console errors
