# Admin "Alle Buchungen" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-only admin tab "Alle Buchungen" that lists all users' booking jobs with email, weekday/time/course/studio info, and execution count, filterable by username with 25-per-page pagination.

**Architecture:** New `GET /admin/jobs` endpoint with a three-way JOIN (BookingJob + User + COUNT(BookingLog)), new `AdminJobResponse` schema, new `AllJobsSection` React component mirroring `UserManagementSection`, and a third tab wired into `DashboardPage`.

**Tech Stack:** FastAPI + SQLAlchemy (backend), React + TypeScript + Tailwind (frontend), pytest (backend tests), Vitest + React Testing Library (frontend tests)

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `backend/schemas/job.py` | Modify | Add `AdminJobResponse` schema |
| `backend/api/admin.py` | Modify | Add `GET /admin/jobs` endpoint |
| `tests/backend/test_api_admin.py` | Modify | Tests for new endpoint |
| `frontend/src/types.ts` | Modify | Add `AdminJob` interface |
| `frontend/src/api/adminJobs.ts` | Create | `listAllJobs()` API function |
| `frontend/src/components/AllJobsSection.tsx` | Create | Read-only jobs list with filter + pagination |
| `frontend/src/components/AllJobsSection.test.tsx` | Create | Component tests |
| `frontend/src/pages/DashboardPage.tsx` | Modify | Wire in third tab |

---

### Task 1: Backend schema – `AdminJobResponse`

**Files:**
- Modify: `backend/schemas/job.py`

- [ ] **Step 1: Add `AdminJobResponse` to the schema file**

Open `backend/schemas/job.py`. The file currently ends with `JobResponse`. Append the new class after it:

```python
class AdminJobResponse(BaseModel):
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
    user_email: str
    execution_count: int

    model_config = {"from_attributes": True}
```

- [ ] **Step 2: Commit**

```bash
git add backend/schemas/job.py
git commit -m "feat: add AdminJobResponse schema"
```

---

### Task 2: Backend endpoint – `GET /admin/jobs`

**Files:**
- Modify: `backend/api/admin.py`
- Test: `tests/backend/test_api_admin.py`

- [ ] **Step 1: Write failing tests**

Append to `tests/backend/test_api_admin.py` (keep the existing imports/helpers at the top of the file — `_make_admin`, `_make_user`, `_auth_header` are already defined there):

```python
# --- /admin/jobs ---

from backend.models.booking_job import BookingJob
from backend.models.booking_log import BookingLog
from datetime import time, date


def _make_job(db_session, user_id: str, weekday: int = 0, target_time=time(18, 0)) -> BookingJob:
    job = BookingJob(
        user_id=user_id,
        weekday=weekday,
        target_time=target_time,
        facility_id="fac-1",
        facility_name="Studio A",
        class_name="Yoga",
        days_in_advance=3,
    )
    db_session.add(job)
    db_session.commit()
    db_session.refresh(job)
    return job


def _make_log(db_session, job_id: str) -> BookingLog:
    log = BookingLog(
        job_id=job_id,
        target_date=date(2026, 1, 1),
        status="success",
    )
    db_session.add(log)
    db_session.commit()
    return log


def test_list_all_jobs_requires_auth(client):
    resp = client.get("/api/admin/jobs")
    assert resp.status_code == 401


def test_list_all_jobs_requires_admin_role(client, db_session):
    user = _make_user(db_session, ev_id="ev-nonadmin", email="nonadmin@x.com")
    resp = client.get("/api/admin/jobs", headers=_auth_header(user.id))
    assert resp.status_code == 403


def test_list_all_jobs_returns_all_users_jobs(client, db_session):
    admin = _make_admin(db_session, ev_id="ev-a1", email="admin1@x.com")
    user = _make_user(db_session, ev_id="ev-u1", email="user1@x.com")
    _make_job(db_session, admin.id)
    _make_job(db_session, user.id)
    resp = client.get("/api/admin/jobs", headers=_auth_header(admin.id))
    assert resp.status_code == 200
    emails = [j["user_email"] for j in resp.json()]
    assert "admin1@x.com" in emails
    assert "user1@x.com" in emails


def test_list_all_jobs_includes_execution_count(client, db_session):
    admin = _make_admin(db_session, ev_id="ev-a2", email="admin2@x.com")
    user = _make_user(db_session, ev_id="ev-u2", email="user2@x.com")
    job = _make_job(db_session, user.id)
    _make_log(db_session, job.id)
    _make_log(db_session, job.id)
    resp = client.get("/api/admin/jobs", headers=_auth_header(admin.id))
    assert resp.status_code == 200
    job_data = next(j for j in resp.json() if j["user_email"] == "user2@x.com")
    assert job_data["execution_count"] == 2


def test_list_all_jobs_zero_execution_count_when_no_logs(client, db_session):
    admin = _make_admin(db_session, ev_id="ev-a3", email="admin3@x.com")
    user = _make_user(db_session, ev_id="ev-u3", email="user3@x.com")
    _make_job(db_session, user.id)
    resp = client.get("/api/admin/jobs", headers=_auth_header(admin.id))
    assert resp.status_code == 200
    job_data = next(j for j in resp.json() if j["user_email"] == "user3@x.com")
    assert job_data["execution_count"] == 0


def test_list_all_jobs_sorted_by_weekday_time_email(client, db_session):
    admin = _make_admin(db_session, ev_id="ev-a4", email="admin4@x.com")
    u1 = _make_user(db_session, ev_id="ev-s1", email="b@x.com")
    u2 = _make_user(db_session, ev_id="ev-s2", email="a@x.com")
    _make_job(db_session, u1.id, weekday=1, target_time=time(10, 0))
    _make_job(db_session, u2.id, weekday=0, target_time=time(18, 0))
    _make_job(db_session, u1.id, weekday=0, target_time=time(8, 0))
    resp = client.get("/api/admin/jobs", headers=_auth_header(admin.id))
    assert resp.status_code == 200
    jobs = resp.json()
    weekdays = [j["weekday"] for j in jobs]
    assert weekdays == sorted(weekdays)
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/backend/test_api_admin.py::test_list_all_jobs_requires_auth tests/backend/test_api_admin.py::test_list_all_jobs_returns_all_users_jobs -v
```

Expected: FAIL with 404 (route doesn't exist yet)

- [ ] **Step 3: Implement the endpoint**

In `backend/api/admin.py`, add the following imports at the top (after the existing imports):

```python
from backend.models.booking_log import BookingLog
from backend.schemas.job import AdminJobResponse
```

Then add the new route after the existing `set_user_active` route:

```python
@router.get("/admin/jobs", response_model=List[AdminJobResponse])
def list_all_jobs(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(
            BookingJob,
            User.email.label("user_email"),
            func.count(BookingLog.id).label("execution_count"),
        )
        .join(User, User.id == BookingJob.user_id)
        .outerjoin(BookingLog, BookingLog.job_id == BookingJob.id)
        .group_by(BookingJob.id)
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
            created_at=job.created_at,
            user_email=user_email,
            execution_count=execution_count,
        )
        for job, user_email, execution_count in rows
    ]
```

- [ ] **Step 4: Run all new tests**

```bash
pytest tests/backend/test_api_admin.py -v -k "list_all_jobs"
```

Expected: all 6 new tests PASS

- [ ] **Step 5: Run full backend test suite**

```bash
pytest tests/backend/ -v
```

Expected: all tests PASS

- [ ] **Step 6: Commit**

```bash
git add backend/api/admin.py tests/backend/test_api_admin.py
git commit -m "feat: add GET /admin/jobs endpoint with user email and execution count"
```

---

### Task 3: Frontend type + API function

**Files:**
- Modify: `frontend/src/types.ts`
- Create: `frontend/src/api/adminJobs.ts`

- [ ] **Step 1: Add `AdminJob` to types**

In `frontend/src/types.ts`, append after the `UserRecord` interface:

```typescript
export interface AdminJob extends Job {
  user_email: string
  execution_count: number
}
```

- [ ] **Step 2: Create `frontend/src/api/adminJobs.ts`**

```typescript
import { apiFetch } from './client'
import type { AdminJob } from '../types'

export const listAllJobs = (): Promise<AdminJob[]> =>
  apiFetch('/api/admin/jobs')
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/types.ts frontend/src/api/adminJobs.ts
git commit -m "feat: add AdminJob type and listAllJobs API function"
```

---

### Task 4: `AllJobsSection` component

**Files:**
- Create: `frontend/src/components/AllJobsSection.tsx`
- Create: `frontend/src/components/AllJobsSection.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `frontend/src/components/AllJobsSection.test.tsx`:

```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import AllJobsSection from './AllJobsSection'

vi.mock('../api/adminJobs', () => ({
  listAllJobs: vi.fn(),
}))

import { listAllJobs } from '../api/adminJobs'

function makeJobs(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `job-${i}`,
    user_email: `user${i}@example.com`,
    weekday: i % 7,
    target_time: '18:00:00',
    facility_id: 'fac-1',
    facility_name: 'Studio A',
    class_name: 'Yoga',
    days_in_advance: 3,
    enabled: true,
    one_time: false,
    created_at: '2026-01-01T00:00:00Z',
    execution_count: i,
  }))
}

beforeEach(() => {
  vi.mocked(listAllJobs).mockResolvedValue(makeJobs(60))
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('AllJobsSection', () => {
  it('zeigt ein Filterfeld an', async () => {
    render(<AllJobsSection />)
    expect(await screen.findByPlaceholderText('Nach Benutzer filtern…')).toBeInTheDocument()
  })

  it('zeigt ohne Filter maximal 25 Jobs an (Seite 1)', async () => {
    render(<AllJobsSection />)
    await screen.findByPlaceholderText('Nach Benutzer filtern…')
    expect(screen.getAllByText(/user\d+@example\.com/).length).toBe(25)
  })

  it('filter begrenzt Ergebnisse nach user_email', async () => {
    vi.mocked(listAllJobs).mockResolvedValue([
      { id: '1', user_email: 'anna@firma.de', weekday: 0, target_time: '08:00:00', facility_id: 'f1', facility_name: 'Studio A', class_name: 'Yoga', days_in_advance: 3, enabled: true, one_time: false, created_at: '', execution_count: 2 },
      { id: '2', user_email: 'bernd@xyz.org', weekday: 1, target_time: '10:00:00', facility_id: 'f1', facility_name: 'Studio A', class_name: 'Pilates', days_in_advance: 3, enabled: true, one_time: false, created_at: '', execution_count: 0 },
      { id: '3', user_email: 'anna@test.de', weekday: 2, target_time: '18:00:00', facility_id: 'f1', facility_name: 'Studio B', class_name: 'Boxing', days_in_advance: 3, enabled: false, one_time: true, created_at: '', execution_count: 5 },
    ])
    render(<AllJobsSection />)
    const input = await screen.findByPlaceholderText('Nach Benutzer filtern…')
    fireEvent.change(input, { target: { value: 'anna' } })
    expect(screen.getAllByText(/anna@/).length).toBe(2)
    expect(screen.queryByText('bernd@xyz.org')).not.toBeInTheDocument()
  })

  it('filter setzt Seite auf 1 zurück', async () => {
    render(<AllJobsSection />)
    const input = await screen.findByPlaceholderText('Nach Benutzer filtern…')
    fireEvent.click(screen.getByRole('button', { name: /weiter/i }))
    expect(await screen.findByText(/Seite 2 von/)).toBeInTheDocument()
    fireEvent.change(input, { target: { value: 'user' } })
    expect(screen.getByText(/Seite 1 von/)).toBeInTheDocument()
  })

  it('"Zurück"-Button ist auf Seite 1 deaktiviert', async () => {
    render(<AllJobsSection />)
    await screen.findByPlaceholderText('Nach Benutzer filtern…')
    expect(screen.getByRole('button', { name: /zurück/i })).toBeDisabled()
  })

  it('"Weiter"-Button ist auf der letzten Seite deaktiviert', async () => {
    vi.mocked(listAllJobs).mockResolvedValue(makeJobs(10))
    render(<AllJobsSection />)
    await screen.findByPlaceholderText('Nach Benutzer filtern…')
    expect(screen.getByRole('button', { name: /weiter/i })).toBeDisabled()
  })

  it('"Weiter" navigiert zur nächsten Seite', async () => {
    render(<AllJobsSection />)
    await screen.findByPlaceholderText('Nach Benutzer filtern…')
    fireEvent.click(screen.getByRole('button', { name: /weiter/i }))
    expect(await screen.findByText(/Seite 2 von 3/)).toBeInTheDocument()
  })

  it('zeigt Kursname und Anzahl Durchführungen an', async () => {
    vi.mocked(listAllJobs).mockResolvedValue([
      { id: '1', user_email: 'anna@firma.de', weekday: 0, target_time: '08:00:00', facility_id: 'f1', facility_name: 'Studio A', class_name: 'Yoga', days_in_advance: 3, enabled: true, one_time: false, created_at: '', execution_count: 7 },
    ])
    render(<AllJobsSection />)
    await screen.findByPlaceholderText('Nach Benutzer filtern…')
    expect(screen.getByText('Yoga')).toBeInTheDocument()
    expect(screen.getByText(/7.*ausgeführt/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd frontend && npx vitest run src/components/AllJobsSection.test.tsx
```

Expected: FAIL — `AllJobsSection` module not found

- [ ] **Step 3: Implement `AllJobsSection`**

Create `frontend/src/components/AllJobsSection.tsx`:

```typescript
import { useState, useEffect, useCallback } from 'react'
import { listAllJobs } from '../api/adminJobs'
import { WEEKDAY_NAMES } from '../types'
import type { AdminJob } from '../types'

const PAGE_SIZE = 25

export default function AllJobsSection() {
  const [jobs, setJobs] = useState<AdminJob[]>([])
  const [loading, setLoading] = useState(true)
  const [emailFilter, setEmailFilter] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

  const load = useCallback(async () => {
    try {
      setJobs(await listAllJobs())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  function handleFilterChange(value: string) {
    setEmailFilter(value)
    setCurrentPage(1)
  }

  const filteredJobs = jobs.filter(
    j => emailFilter.length < 1 || j.user_email.toLowerCase().includes(emailFilter.toLowerCase())
  )

  const totalPages = Math.max(1, Math.ceil(filteredJobs.length / PAGE_SIZE))
  const safePage = Math.min(currentPage, totalPages)
  const pagedJobs = filteredJobs.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  )

  return (
    <div>
      {loading && <p className="text-slate-400 text-sm">Lädt…</p>}
      {!loading && (
        <div className="flex flex-col gap-2">
          <input
            type="text"
            value={emailFilter}
            onChange={e => handleFilterChange(e.target.value)}
            placeholder="Nach Benutzer filtern…"
            className="flex-1 bg-surface-card border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-slate-500"
          />
          <p className="text-slate-500 text-xs">
            {filteredJobs.length} von {jobs.length} Jobs · Seite {safePage} von {totalPages}
          </p>
          {filteredJobs.length === 0 && (
            <p className="text-slate-400 text-sm text-center mt-12">Keine Buchungen gefunden.</p>
          )}
          {pagedJobs.map(job => {
            const time = job.target_time.slice(0, 5)
            return (
              <div
                key={job.id}
                className="bg-surface-card rounded-xl px-4 py-3 flex items-center justify-between"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{job.user_email}</p>
                  <p className="text-slate-300 text-sm">
                    {WEEKDAY_NAMES[job.weekday]} · {time} Uhr · {job.class_name}
                  </p>
                  <p className="text-slate-400 text-xs mt-0.5">
                    {job.facility_name} · {job.days_in_advance} Tage im Voraus{job.one_time ? ' · Einmalig' : ''}
                  </p>
                </div>
                <span className="ml-3 shrink-0 text-slate-400 text-xs whitespace-nowrap">
                  {job.execution_count}× ausgeführt
                </span>
              </div>
            )
          })}
          <div className="flex items-center justify-center gap-3 mt-2">
            <button
              disabled={safePage === 1}
              onClick={() => setCurrentPage(p => p - 1)}
              className="px-3 py-1 rounded-md text-sm bg-surface-card text-slate-400 border border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:enabled:bg-slate-700 transition-colors"
            >
              ← Zurück
            </button>
            <button
              disabled={safePage === totalPages}
              onClick={() => setCurrentPage(p => p + 1)}
              className="px-3 py-1 rounded-md text-sm bg-surface-card text-slate-400 border border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:enabled:bg-slate-700 transition-colors"
            >
              Weiter →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run tests**

```bash
cd frontend && npx vitest run src/components/AllJobsSection.test.tsx
```

Expected: all 8 tests PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/AllJobsSection.tsx frontend/src/components/AllJobsSection.test.tsx
git commit -m "feat: add AllJobsSection component with filter and pagination"
```

---

### Task 5: Wire third tab into `DashboardPage`

**Files:**
- Modify: `frontend/src/pages/DashboardPage.tsx`

- [ ] **Step 1: Update tab type and hash parsing**

In `DashboardPage.tsx`, replace the tab type and `activeTab` derivation (lines 14-18):

```typescript
const activeTab: 'buchungen' | 'benutzer' | 'alle-buchungen' =
  hash === '#users' ? 'benutzer' : hash === '#all-jobs' ? 'alle-buchungen' : 'buchungen'

function setActiveTab(tab: 'buchungen' | 'benutzer' | 'alle-buchungen') {
  navigate(tab === 'benutzer' ? '#users' : tab === 'alle-buchungen' ? '#all-jobs' : '#bookings', { replace: true })
}
```

- [ ] **Step 2: Add import for `AllJobsSection`**

At the top of `DashboardPage.tsx`, add after the existing component imports:

```typescript
import AllJobsSection from '../components/AllJobsSection'
```

- [ ] **Step 3: Add tab button in the tab navigation**

Replace the tab map array in the JSX (the `(['buchungen', 'benutzer'] as const).map(...)` block) with:

```typescript
{(['buchungen', 'benutzer', 'alle-buchungen'] as const).map((tab) => (
  <button
    key={tab}
    onClick={() => setActiveTab(tab)}
    className={`px-4 py-2 text-sm font-medium rounded-t-md transition-colors focus:outline-none
      ${activeTab === tab
        ? 'bg-brand text-white border-b-2 border-brand -mb-px'
        : 'text-slate-400 hover:text-slate-200 hover:bg-surface-card'
      }`}
  >
    {tab === 'buchungen' ? 'Buchungen' : tab === 'benutzer' ? 'Benutzer' : 'Alle Buchungen'}
  </button>
))}
```

- [ ] **Step 4: Render `AllJobsSection` on the new tab**

After the existing `{isAdmin() && activeTab === 'benutzer' && <UserManagementSection />}` line, add:

```typescript
{isAdmin() && activeTab === 'alle-buchungen' && <AllJobsSection />}
```

- [ ] **Step 5: Update the swipe gesture to cycle through all three tabs**

Replace the `onTouchEnd` function (the entire function body inside the `useEffect`):

```typescript
function onTouchEnd(e: TouchEvent) {
  if (touchStartX.current === null || touchStartY.current === null) return
  const dx = e.changedTouches[0].clientX - touchStartX.current
  const dy = e.changedTouches[0].clientY - touchStartY.current
  touchStartX.current = null
  touchStartY.current = null
  if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy)) return
  const tabs = ['#bookings', '#users', '#all-jobs']
  const currentIndex = tabs.indexOf(window.location.hash || '#bookings')
  const nextIndex = dx < 0
    ? Math.min(currentIndex + 1, tabs.length - 1)
    : Math.max(currentIndex - 1, 0)
  window.location.hash = tabs[nextIndex]
}
```

- [ ] **Step 6: Update the "Add button" and "Job list" visibility conditions**

The existing conditions `(!isAdmin() || activeTab === 'buchungen')` already correctly hide these on non-buchungen tabs. No change needed — verify they still render correctly with 3 tabs by reading the JSX at lines 149 and 159.

- [ ] **Step 7: Run frontend tests**

```bash
cd frontend && npx vitest run
```

Expected: all tests PASS

- [ ] **Step 8: Commit**

```bash
git add frontend/src/pages/DashboardPage.tsx
git commit -m "feat: add Alle Buchungen admin tab to dashboard"
```
