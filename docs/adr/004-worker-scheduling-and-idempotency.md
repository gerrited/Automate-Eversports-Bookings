# ADR-004: Worker Scheduling and Idempotency

**Date:** 2026-04-11  
**Status:** Accepted

## Context

Bookings must be placed a configurable number of days before the class. The booking window on Eversports typically opens exactly N days ahead. The worker needs to run frequently enough to not miss the window, but bookings must never be placed twice.

## Decision

### Schedule

The worker runs as a Kubernetes CronJob every hour (`0 * * * *`, `timeZone: Europe/Berlin`). `concurrencyPolicy: Forbid` prevents overlapping runs.

### Due-date calculation

For each enabled job, the worker computes:

```
target_date = today + days_in_advance
due = (target_date.weekday() == job.weekday)
```

A job with `weekday=1` (Tuesday) and `days_in_advance=4` is due on Fridays: Friday + 4 days = Tuesday.

### Idempotency

Before executing any booking, the worker queries `booking_logs` for an existing entry with:
- `job_id = job.id`
- `target_date = target_date`
- `status = 'success'`

If such a row exists, the job is skipped. This makes the worker safe to re-run or restart mid-execution — a crash after a successful booking will not cause a duplicate booking on the next run.

### Error isolation

An exception in one job does not abort the worker. Each job is wrapped in a `try/except`; failures are written to `booking_logs` with `status='failed'` and the error message, then execution continues with the next job.

## Consequences

- A booking placed in hour H will be detected and skipped in hour H+1, H+2, etc. No double-bookings.
- If the Eversports API is briefly unavailable during one hour, the next hourly run will retry automatically (the failed log entry has `status='failed'`, not `'success'`, so the idempotency check does not block the retry).
- The worker must have access to `DATABASE_URL` and `ENCRYPTION_KEY` secrets — it does not need `JWT_SECRET` or `FRONTEND_URL`.
- Manual trigger for testing: `kubectl create job --from=cronjob/eversports-worker worker-test-run`.
