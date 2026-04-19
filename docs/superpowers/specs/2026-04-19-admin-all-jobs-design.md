# Admin "Alle Buchungen" – Design Spec

**Date:** 2026-04-19  
**Status:** Approved

## Overview

Add a new read-only admin tab "Alle Buchungen" to the dashboard that lists all configured jobs across all users, filterable by username (email), paginated at 25 per page.

## Backend

### New Endpoint

`GET /admin/jobs` in `backend/api/admin.py`, protected with `require_admin`.

Returns all `BookingJob` records joined with their owning `User` and a log execution count:

```python
db.query(
    BookingJob,
    User.email.label("user_email"),
    func.count(BookingLog.id).label("execution_count")
)
.join(User, User.id == BookingJob.user_id)
.outerjoin(BookingLog, BookingLog.job_id == BookingJob.id)
.group_by(BookingJob.id)
.order_by(BookingJob.weekday, BookingJob.target_time, User.email)
.all()
```

### New Schema

`AdminJobResponse` in `backend/schemas/job.py`, extending the existing `JobResponse` fields:

| Field | Type | Source |
|-------|------|--------|
| `id` | str | BookingJob |
| `weekday` | int | BookingJob |
| `target_time` | time | BookingJob |
| `facility_id` | str | BookingJob |
| `facility_name` | str | BookingJob |
| `class_name` | str | BookingJob |
| `days_in_advance` | int | BookingJob |
| `enabled` | bool | BookingJob |
| `one_time` | bool | BookingJob |
| `created_at` | datetime | BookingJob |
| `user_email` | str | User (JOIN) |
| `execution_count` | int | COUNT(BookingLog) |

## Frontend

### New Type

`AdminJob` in `frontend/src/types.ts`:

```typescript
export interface AdminJob extends Job {
  user_email: string
  execution_count: number
}
```

### New API Function

`listAllJobs(): Promise<AdminJob[]>` in `frontend/src/api/adminJobs.ts`:

```typescript
import { apiFetch } from './client'
import type { AdminJob } from '../types'

export const listAllJobs = (): Promise<AdminJob[]> =>
  apiFetch('/api/admin/jobs')
```

### New Component: `AllJobsSection`

Location: `frontend/src/components/AllJobsSection.tsx`

Behavior mirrors `UserManagementSection`:
- Fetches all jobs on mount via `listAllJobs()`
- Text filter input: filters by `user_email` (case-insensitive, clientside)
- Pagination: `PAGE_SIZE = 25`, same Zurück/Weiter controls
- Shows summary line: `N von M Jobs · Seite X von Y`

Each row displays:
- **Line 1 (bold):** `user_email`
- **Line 2:** `Wochentag · HH:MM Uhr · class_name`
- **Line 3 (muted):** `facility_name · days_in_advance Tage im Voraus · [Einmalig]`
- **Right side:** `execution_count × ausgeführt` (muted badge)

No edit/delete/toggle actions (read-only).

### Tab Integration

In `DashboardPage.tsx`:

- Extend tab type to `'buchungen' | 'benutzer' | 'alle-buchungen'`
- Add hash `#all-jobs` for the new tab
- Add tab button "Alle Buchungen" (only visible to admins, same as existing tabs)
- Render `<AllJobsSection />` when `activeTab === 'alle-buchungen'`
- Swipe gesture (touchstart/touchend) extended to cycle through all three tabs

## Error Handling

- Loading state: show "Lädt…" text (same as other sections)
- Empty state: "Keine Buchungen gefunden." centered text
- API errors: silently swallowed (consistent with existing pattern in the codebase)

## Out of Scope

- Admin editing/deleting/toggling jobs from this view
- Server-side pagination or filtering
- Sorting controls
