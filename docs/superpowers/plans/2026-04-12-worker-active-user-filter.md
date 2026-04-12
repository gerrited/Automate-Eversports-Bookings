# Worker Active-User Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Filter out jobs belonging to inactive users at the DB query level so the worker never attempts bookings for unapproved accounts.

**Architecture:** Extend the existing `BookingJob` query in `worker/worker.py` with a JOIN on `User` and an `active` filter. No new files. One failing test added first (TDD), then the minimal implementation to make it pass.

**Tech Stack:** Python, SQLAlchemy, pytest, pytest-mock

---

## File Map

| File | Change |
|------|--------|
| `tests/worker/test_worker.py` | Add `test_run_skips_inactive_user_job`; update `_user()` helper to accept/set `active` |
| `worker/worker.py` | Extend `run()` query with JOIN + `User.active.is_(True)` filter |

---

### Task 1: Write the failing test

**Files:**
- Modify: `tests/worker/test_worker.py`

- [ ] **Step 1: Update `_user()` to accept an `active` parameter**

In `tests/worker/test_worker.py`, replace the existing `_user` helper:

```python
def _user(db, uid="u1", ev="ev1", email="a@b.com", active=True):
    u = User(id=uid, eversports_user_id=ev, email=email, encrypted_password="enc", active=active)
    db.add(u)
    db.commit()
    return u
```

> Note: existing tests call `_user()` without `active=` — they now get `active=True` by default, which is the correct behaviour (active users should be processed).

- [ ] **Step 2: Add the new test at the bottom of the file**

```python
def test_run_skips_inactive_user_job(db_session, mocker):
    _user(db_session, uid="u8", ev="ev8", email="h@b.com", active=False)
    _job(db_session, jid="j8", uid="u8", weekday=1, days=4)
    friday = date(2026, 4, 10)  # Friday+4=Tuesday(weekday=1) → job is due

    mock_book = mocker.patch("worker.worker.book_session")
    run(db_session, friday)
    mock_book.assert_not_called()
```

- [ ] **Step 3: Run the new test to confirm it fails**

```bash
pytest tests/worker/test_worker.py::test_run_skips_inactive_user_job -v
```

Expected output: `FAILED` — `book_session` is called once (inactive user is not yet filtered).

- [ ] **Step 4: Also run the full test suite to confirm existing tests still pass**

```bash
pytest tests/worker/ -v
```

Expected: all existing tests pass, only the new test fails.

---

### Task 2: Implement the active-user filter

**Files:**
- Modify: `worker/worker.py:52`

- [ ] **Step 1: Replace the jobs query in `run()`**

In `worker/worker.py`, replace:

```python
    jobs = db.query(BookingJob).filter(BookingJob.enabled.is_(True)).all()
```

with:

```python
    jobs = (
        db.query(BookingJob)
        .join(User, BookingJob.user_id == User.id)
        .filter(BookingJob.enabled.is_(True), User.active.is_(True))
        .all()
    )
```

`User` is already imported at line 19 — no new imports needed.

- [ ] **Step 2: Run the new test to confirm it passes**

```bash
pytest tests/worker/test_worker.py::test_run_skips_inactive_user_job -v
```

Expected: `PASSED`

- [ ] **Step 3: Run the full worker test suite**

```bash
pytest tests/worker/ -v
```

Expected: all tests pass.

- [ ] **Step 4: Run the full test suite**

```bash
pytest -v
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add worker/worker.py tests/worker/test_worker.py
git commit -m "feat: skip jobs of inactive users in worker"
```
