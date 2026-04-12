# Worker Active-User Filter — Design Spec

**Date:** 2026-04-12
**Status:** Approved

## Overview

The booking worker should only process jobs belonging to active users. Inactive users (those awaiting admin approval) must be silently skipped — their jobs should not trigger bookings.

---

## Change

**File:** `worker/worker.py` — `run()` function

The opening query is extended with a `JOIN` on `User` and an additional filter on `User.active`. No other production code changes are required.

**Before:**
```python
jobs = db.query(BookingJob).filter(BookingJob.enabled.is_(True)).all()
```

**After:**
```python
jobs = (
    db.query(BookingJob)
    .join(User, BookingJob.user_id == User.id)
    .filter(BookingJob.enabled.is_(True), User.active.is_(True))
    .all()
)
```

The per-job user fetch (used to decrypt the password) remains unchanged.

---

## Tests

`tests/worker/test_worker.py` gains one new test case:

- A job belonging to an inactive user (`active=False`) must not be processed even when the job is enabled and due.

---

## Out of Scope

- Logging a warning when inactive-user jobs are skipped (they never enter the loop).
- Any frontend or API changes.
