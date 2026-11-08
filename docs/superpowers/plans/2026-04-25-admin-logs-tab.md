# Admin-Logs-Tab Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admins einen neuen Tab "Logs" hinzufügen, der alle `booking_logs` aller User mit Job- und User-Kontext anzeigt, sortiert nach Ausführungsdatum, filterbar nach User-E-Mail.

**Architecture:** Neuer Admin-Endpunkt `GET /api/admin/logs` joined `booking_logs` + `booking_jobs` + `users` und liefert paginierte Ergebnisse (PAGE_SIZE=50). Das Frontend erhält eine neue `AllLogsSection`-Komponente, die serverseitig filtert und paginiert. Filter ist debounced (300ms).

**Tech Stack:** FastAPI, SQLAlchemy, Pydantic (Backend); React, TypeScript, Tailwind CSS (Frontend); Vitest + Testing Library (Tests).

---

## Dateiübersicht

| Datei | Aktion | Zweck |
|-------|--------|-------|
| `backend/schemas/log.py` | Modify | `AdminLogResponse` und `AdminLogsPage` hinzufügen |
| `backend/api/admin.py` | Modify | `GET /api/admin/logs` Endpunkt hinzufügen |
| `tests/backend/test_api_admin.py` | Modify | Tests für neuen Endpunkt |
| `frontend/src/types.ts` | Modify | `AdminLog` und `AdminLogsPage` Interfaces |
| `frontend/src/api/adminLogs.ts` | Modify | `listAllLogs` Funktion |
| `frontend/src/components/AllLogsSection.tsx` | Create | Neue Komponente |
| `frontend/src/components/AllLogsSection.test.tsx` | Create | Tests für Komponente |
| `frontend/src/pages/DashboardPage.tsx` | Modify | Tab integrieren |

---

## Task 1: Backend-Schema

**Files:**
- Modify: `backend/schemas/log.py`

- [ ] **Step 1: Schema erweitern**

Ersetze den vollständigen Inhalt von `backend/schemas/log.py`:

```python
from __future__ import annotations

from datetime import date, datetime, time
from typing import List, Optional
from pydantic import BaseModel


class LogResponse(BaseModel):
    id: str
    job_id: str
    executed_at: datetime
    target_date: date
    status: str
    message: Optional[str]

    model_config = {"from_attributes": True}


class AdminLogResponse(BaseModel):
    id: str
    job_id: str
    executed_at: datetime
    target_date: date
    status: str
    message: Optional[str]
    class_name: str
    facility_name: str
    target_time: time
    weekday: int
    debug: bool
    user_email: str


class AdminLogsPage(BaseModel):
    items: List[AdminLogResponse]
    total: int
    page: int
    page_size: int
```

- [ ] **Step 2: Commit**

```bash
git add backend/schemas/log.py
git commit -m "feat: add AdminLogResponse and AdminLogsPage schemas"
```

---

## Task 2: Backend-Tests (failing)

**Files:**
- Modify: `tests/backend/test_api_admin.py`

- [ ] **Step 1: Hilfsfunktionen und Tests am Ende der Datei ergänzen**

Folgendes an das Ende von `tests/backend/test_api_admin.py` anhängen:

```python
# ── Hilfsfunktionen für Log-Tests ─────────────────────────────────────────────

def _make_job(db_session, user_id: str, facility_name: str = "Studio A", class_name: str = "Yoga") -> BookingJob:
    from datetime import time as time_
    job = BookingJob(
        user_id=user_id,
        weekday=0,
        target_time=time_(18, 0),
        facility_id="fac-1",
        facility_name=facility_name,
        class_name=class_name,
        days_in_advance=3,
    )
    db_session.add(job)
    db_session.commit()
    db_session.refresh(job)
    return job


def _make_log(db_session, job_id: str, status: str = "success", executed_at=None) -> BookingLog:
    from datetime import date, datetime, timezone
    entry = BookingLog(
        job_id=job_id,
        target_date=date(2026, 1, 15),
        status=status,
        executed_at=executed_at or datetime.now(timezone.utc),
    )
    db_session.add(entry)
    db_session.commit()
    db_session.refresh(entry)
    return entry


# ── Tests GET /api/admin/logs ──────────────────────────────────────────────────

def test_list_all_logs_requires_auth(client):
    resp = client.get("/api/admin/logs")
    assert resp.status_code == 401


def test_list_all_logs_requires_admin_role(client, db_session):
    user = _make_user(db_session)
    resp = client.get("/api/admin/logs", headers=_auth_header(user.id))
    assert resp.status_code == 403


def test_list_all_logs_returns_all_logs(client, db_session):
    admin = _make_admin(db_session)
    user = _make_user(db_session)
    job = _make_job(db_session, user.id)
    _make_log(db_session, job.id, status="success")
    _make_log(db_session, job.id, status="failed")
    resp = client.get("/api/admin/logs", headers=_auth_header(admin.id))
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 2
    assert len(data["items"]) == 2


def test_list_all_logs_sorted_newest_first(client, db_session):
    from datetime import datetime, timezone
    admin = _make_admin(db_session)
    user = _make_user(db_session)
    job = _make_job(db_session, user.id)
    t1 = datetime(2026, 1, 1, 10, tzinfo=timezone.utc)
    t2 = datetime(2026, 1, 2, 10, tzinfo=timezone.utc)
    _make_log(db_session, job.id, executed_at=t1)
    _make_log(db_session, job.id, executed_at=t2)
    resp = client.get("/api/admin/logs", headers=_auth_header(admin.id))
    data = resp.json()
    times = [item["executed_at"] for item in data["items"]]
    assert times[0] > times[1]


def test_list_all_logs_filter_by_user_email(client, db_session):
    admin = _make_admin(db_session)
    user1 = _make_user(db_session, ev_id="ev-u1", email="anna@example.com")
    user2 = _make_user(db_session, ev_id="ev-u2", email="bernd@example.com")
    job1 = _make_job(db_session, user1.id)
    job2 = _make_job(db_session, user2.id)
    _make_log(db_session, job1.id)
    _make_log(db_session, job2.id)
    resp = client.get("/api/admin/logs?user_email=anna", headers=_auth_header(admin.id))
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 1
    assert data["items"][0]["user_email"] == "anna@example.com"


def test_list_all_logs_includes_job_fields(client, db_session):
    admin = _make_admin(db_session)
    user = _make_user(db_session)
    job = _make_job(db_session, user.id, facility_name="Studio B", class_name="Pilates")
    _make_log(db_session, job.id)
    resp = client.get("/api/admin/logs", headers=_auth_header(admin.id))
    assert resp.status_code == 200
    item = resp.json()["items"][0]
    assert item["class_name"] == "Pilates"
    assert item["facility_name"] == "Studio B"
    assert item["user_email"] == "user@x.com"
    assert "weekday" in item
    assert "target_time" in item
    assert "debug" in item


def test_list_all_logs_pagination(client, db_session):
    admin = _make_admin(db_session)
    user = _make_user(db_session)
    job = _make_job(db_session, user.id)
    for _ in range(55):
        _make_log(db_session, job.id)
    resp = client.get("/api/admin/logs?page=1", headers=_auth_header(admin.id))
    data = resp.json()
    assert data["total"] == 55
    assert len(data["items"]) == 50
    assert data["page"] == 1
    assert data["page_size"] == 50
    resp2 = client.get("/api/admin/logs?page=2", headers=_auth_header(admin.id))
    data2 = resp2.json()
    assert len(data2["items"]) == 5
```

- [ ] **Step 2: Tests ausführen — müssen fehlschlagen (404 expected)**

```bash
pytest tests/backend/test_api_admin.py -k "logs" -x -v
```

Erwartetes Ergebnis: FAILED mit 404 oder ähnlichem (Endpunkt existiert noch nicht).

- [ ] **Step 3: Commit**

```bash
git add tests/backend/test_api_admin.py
git commit -m "test: add failing tests for GET /api/admin/logs"
```

---

## Task 3: Backend-Endpunkt implementieren

**Files:**
- Modify: `backend/api/admin.py`

- [ ] **Step 1: Import und Endpunkt in `backend/api/admin.py` hinzufügen**

Zeile 3 (`from typing import List, Literal`) ändern zu:
```python
from typing import List, Literal, Optional
```

Zeile 17 (`from backend.schemas.job import AdminJobResponse`) nach unten ergänzen:
```python
from backend.schemas.log import AdminLogsPage, AdminLogResponse
```

Folgenden Endpunkt **vor** der `TestEmailRequest`-Klasse (vor Zeile 181) einfügen:

```python
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
```

- [ ] **Step 2: Tests ausführen — müssen jetzt grün sein**

```bash
pytest tests/backend/test_api_admin.py -k "logs" -x -v
```

Erwartetes Ergebnis: alle 7 Log-Tests PASSED.

- [ ] **Step 3: Alle Backend-Tests laufen lassen**

```bash
pytest tests/ -x
```

Erwartetes Ergebnis: alle Tests PASSED.

- [ ] **Step 4: Commit**

```bash
git add backend/api/admin.py backend/schemas/log.py
git commit -m "feat: add GET /api/admin/logs endpoint for admins"
```

---

## Task 4: Frontend-Typen

**Files:**
- Modify: `frontend/src/types.ts`

- [ ] **Step 1: Interfaces am Ende von `frontend/src/types.ts` ergänzen**

Folgendes ans Ende der Datei anhängen:

```typescript
export interface AdminLog {
  id: string
  job_id: string
  executed_at: string
  target_date: string
  status: 'success' | 'failed' | 'already_booked' | 'waitlist'
  message: string | null
  class_name: string
  facility_name: string
  target_time: string
  weekday: number
  debug: boolean
  user_email: string
}

export interface AdminLogsPage {
  items: AdminLog[]
  total: number
  page: number
  page_size: number
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/types.ts
git commit -m "feat: add AdminLog and AdminLogsPage types"
```

---

## Task 5: Frontend-API-Client

**Files:**
- Create: `frontend/src/api/adminLogs.ts`

- [ ] **Step 1: Neue Datei `frontend/src/api/adminLogs.ts` erstellen**

(`adminJobs.ts` bleibt unverändert.)

```typescript
import { apiFetch } from './client'
import type { AdminLogsPage } from '../types'

export const listAllLogs = (page: number, userEmail?: string): Promise<AdminLogsPage> => {
  const params = new URLSearchParams({ page: String(page) })
  if (userEmail) params.set('user_email', userEmail)
  return apiFetch(`/api/admin/logs?${params}`)
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/api/adminLogs.ts
git commit -m "feat: add listAllLogs API client function"
```

---

## Task 6: Frontend-Komponente Tests (failing)

**Files:**
- Create: `frontend/src/components/AllLogsSection.test.tsx`

- [ ] **Step 1: Testdatei erstellen**

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import AllLogsSection from './AllLogsSection'

vi.mock('../api/adminLogs', () => ({
  listAllLogs: vi.fn(),
}))

import { listAllLogs } from '../api/adminLogs'

function makePage(count: number, total?: number) {
  const items = Array.from({ length: count }, (_, i) => ({
    id: `log-${i}`,
    job_id: `job-${i}`,
    executed_at: `2026-01-${String(i + 1).padStart(2, '0')}T10:00:00Z`,
    target_date: '2026-01-15',
    status: 'success' as const,
    message: null,
    class_name: 'Yoga',
    facility_name: 'Studio A',
    target_time: '18:00:00',
    weekday: 0,
    debug: false,
    user_email: `user${i}@example.com`,
  }))
  return { items, total: total ?? count, page: 1, page_size: 50 }
}

beforeEach(() => {
  vi.mocked(listAllLogs).mockResolvedValue(makePage(3))
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('AllLogsSection', () => {
  it('zeigt ein Filterfeld an', async () => {
    render(<AllLogsSection />)
    expect(await screen.findByPlaceholderText('Nach E-Mail filtern…')).toBeInTheDocument()
  })

  it('zeigt Log-Einträge an', async () => {
    render(<AllLogsSection />)
    await waitFor(() => {
      expect(screen.getByText('user0@example.com')).toBeInTheDocument()
      expect(screen.getByText('user2@example.com')).toBeInTheDocument()
    })
  })

  it('zeigt Kursname an', async () => {
    render(<AllLogsSection />)
    await waitFor(() => {
      const yogaItems = screen.getAllByText(/Yoga/)
      expect(yogaItems.length).toBeGreaterThan(0)
    })
  })

  it('zeigt Status-Badge an', async () => {
    render(<AllLogsSection />)
    await waitFor(() => {
      expect(screen.getAllByText('Erfolgreich').length).toBeGreaterThan(0)
    })
  })

  it('zeigt Fehlerstatus in Rot', async () => {
    vi.mocked(listAllLogs).mockResolvedValue(makePage(0))
    vi.mocked(listAllLogs).mockResolvedValueOnce({
      items: [{
        id: 'log-1', job_id: 'job-1', executed_at: '2026-01-01T10:00:00Z',
        target_date: '2026-01-15', status: 'failed', message: 'Kurs voll',
        class_name: 'Yoga', facility_name: 'Studio A', target_time: '18:00:00',
        weekday: 0, debug: false, user_email: 'test@example.com',
      }],
      total: 1, page: 1, page_size: 50,
    })
    render(<AllLogsSection />)
    await waitFor(() => {
      expect(screen.getByText('Fehlgeschlagen')).toBeInTheDocument()
    })
  })

  it('zeigt lange Nachricht mit "mehr"-Button', async () => {
    const longMsg = 'A'.repeat(70)
    vi.mocked(listAllLogs).mockResolvedValue({
      items: [{
        id: 'log-1', job_id: 'job-1', executed_at: '2026-01-01T10:00:00Z',
        target_date: '2026-01-15', status: 'failed', message: longMsg,
        class_name: 'Yoga', facility_name: 'Studio A', target_time: '18:00:00',
        weekday: 0, debug: false, user_email: 'test@example.com',
      }],
      total: 1, page: 1, page_size: 50,
    })
    render(<AllLogsSection />)
    expect(await screen.findByText('mehr')).toBeInTheDocument()
  })

  it('filter triggert neuen API-Request nach Debounce', async () => {
    render(<AllLogsSection />)
    const input = await screen.findByPlaceholderText('Nach E-Mail filtern…')
    fireEvent.change(input, { target: { value: 'anna' } })
    await waitFor(() => {
      expect(listAllLogs).toHaveBeenCalledWith(1, 'anna')
    }, { timeout: 1000 })
  })

  it('"Zurück"-Button ist auf Seite 1 deaktiviert', async () => {
    render(<AllLogsSection />)
    await screen.findByPlaceholderText('Nach E-Mail filtern…')
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /zurück/i })).toBeDisabled()
    })
  })

  it('"Weiter"-Button ist deaktiviert wenn total <= page_size', async () => {
    render(<AllLogsSection />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /weiter/i })).toBeDisabled()
    })
  })

  it('"Weiter" navigiert zur Seite 2', async () => {
    vi.mocked(listAllLogs).mockResolvedValue(makePage(50, 100))
    render(<AllLogsSection />)
    await waitFor(() => {
      expect(screen.getByText(/Seite 1 von 2/)).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: /weiter/i }))
    await waitFor(() => {
      expect(listAllLogs).toHaveBeenCalledWith(2, undefined)
    })
  })

  it('zeigt "Keine Logs gefunden" bei leerer Antwort', async () => {
    vi.mocked(listAllLogs).mockResolvedValue({ items: [], total: 0, page: 1, page_size: 50 })
    render(<AllLogsSection />)
    expect(await screen.findByText('Keine Logs gefunden.')).toBeInTheDocument()
  })

  it('zeigt Test-Badge für debug-Logs', async () => {
    vi.mocked(listAllLogs).mockResolvedValue({
      items: [{
        id: 'log-1', job_id: 'job-1', executed_at: '2026-01-01T10:00:00Z',
        target_date: '2026-01-15', status: 'success', message: null,
        class_name: 'Yoga', facility_name: 'Studio A', target_time: '18:00:00',
        weekday: 0, debug: true, user_email: 'test@example.com',
      }],
      total: 1, page: 1, page_size: 50,
    })
    render(<AllLogsSection />)
    expect(await screen.findByText('Test')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Tests ausführen — müssen fehlschlagen (Komponente existiert noch nicht)**

```bash
cd frontend && npm test -- AllLogsSection --run
```

Erwartetes Ergebnis: FAILED (cannot find module oder ähnlich).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/AllLogsSection.test.tsx
git commit -m "test: add failing tests for AllLogsSection component"
```

---

## Task 7: Frontend-Komponente implementieren

**Files:**
- Create: `frontend/src/components/AllLogsSection.tsx`

- [ ] **Step 1: Komponente erstellen**

```typescript
import { useState, useEffect } from 'react'
import { listAllLogs } from '../api/adminLogs'
import { WEEKDAY_NAMES } from '../types'
import type { AdminLogsPage } from '../types'

const PAGE_SIZE = 50

const STATUS_STYLES: Record<string, string> = {
  success: 'text-green-400',
  failed: 'text-red-400',
  already_booked: 'text-slate-400',
  waitlist: 'text-yellow-400',
}

const STATUS_LABELS: Record<string, string> = {
  success: 'Erfolgreich',
  failed: 'Fehlgeschlagen',
  already_booked: 'Bereits gebucht',
  waitlist: 'Warteliste',
}

export default function AllLogsSection() {
  const [result, setResult] = useState<AdminLogsPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [emailFilter, setEmailFilter] = useState('')
  const [debouncedFilter, setDebouncedFilter] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [expandedMessage, setExpandedMessage] = useState<string | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedFilter(emailFilter)
      setCurrentPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [emailFilter])

  useEffect(() => {
    setLoading(true)
    setError(null)
    listAllLogs(currentPage, debouncedFilter || undefined)
      .then(setResult)
      .catch(e => setError(e instanceof Error ? e.message : 'Fehler beim Laden'))
      .finally(() => setLoading(false))
  }, [currentPage, debouncedFilter])

  const items = result?.items ?? []
  const total = result?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div>
      {loading && !result && <p className="text-slate-400 text-sm">Lädt…</p>}
      <div className="flex flex-col gap-2">
        <input
          type="text"
          value={emailFilter}
          onChange={e => setEmailFilter(e.target.value)}
          placeholder="Nach E-Mail filtern…"
          className="flex-1 bg-surface-card border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-slate-500"
        />
        {!loading && !error && result && (
          <p className="text-slate-500 text-xs">
            {total} Einträge · Seite {currentPage} von {totalPages}
          </p>
        )}
        {error && <p className="text-red-400 text-sm">{error}</p>}
        {!loading && !error && items.length === 0 && (
          <p className="text-slate-400 text-sm text-center mt-12">Keine Logs gefunden.</p>
        )}
        {items.map(log => {
          const displayTime = log.target_time.slice(0, 5)
          const truncated =
            log.message && log.message.length > 60
              ? log.message.slice(0, 60) + '…'
              : log.message
          return (
            <div key={log.id} className="bg-surface-card rounded-xl px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{log.user_email}</p>
                  <p className="text-slate-300 text-sm">
                    {log.class_name} · {WEEKDAY_NAMES[log.weekday]} · {displayTime} Uhr
                  </p>
                  <p className="text-slate-400 text-xs mt-0.5">
                    {log.facility_name}
                    {log.debug && (
                      <span className="ml-1 text-amber-400 font-medium">Test</span>
                    )}
                  </p>
                  {truncated && (
                    <p className="text-slate-500 text-xs mt-0.5">
                      {truncated}
                      {log.message && log.message.length > 60 && (
                        <button
                          className="ml-1 text-brand hover:text-brand-hover text-xs"
                          onClick={() => setExpandedMessage(log.message)}
                        >
                          mehr
                        </button>
                      )}
                    </p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <p className={`text-xs font-medium ${STATUS_STYLES[log.status] ?? 'text-slate-400'}`}>
                    {STATUS_LABELS[log.status] ?? log.status}
                  </p>
                  <p className="text-slate-500 text-xs mt-0.5">
                    {new Date(log.executed_at).toLocaleString('de-DE')}
                  </p>
                  <p className="text-slate-600 text-xs">
                    Ziel: {log.target_date}
                  </p>
                </div>
              </div>
            </div>
          )
        })}
        {result && (
          <div className="flex items-center justify-center gap-3 mt-2">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => p - 1)}
              className="px-3 py-1 rounded-md text-sm bg-surface-card text-slate-400 border border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:enabled:bg-slate-700 transition-colors"
            >
              ← Zurück
            </button>
            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(p => p + 1)}
              className="px-3 py-1 rounded-md text-sm bg-surface-card text-slate-400 border border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:enabled:bg-slate-700 transition-colors"
            >
              Weiter →
            </button>
          </div>
        )}
      </div>
      {expandedMessage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setExpandedMessage(null)}
        >
          <div
            className="bg-surface-card rounded-xl p-4 max-w-lg w-full"
            onClick={e => e.stopPropagation()}
          >
            <p className="text-slate-200 text-sm break-all">{expandedMessage}</p>
            <button
              className="mt-3 text-slate-400 text-sm hover:text-white"
              onClick={() => setExpandedMessage(null)}
            >
              Schließen
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Tests ausführen — müssen grün sein**

```bash
cd frontend && npm test -- AllLogsSection --run
```

Erwartetes Ergebnis: alle Tests PASSED.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/AllLogsSection.tsx
git commit -m "feat: add AllLogsSection component for admin logs tab"
```

---

## Task 8: DashboardPage integrieren

**Files:**
- Modify: `frontend/src/pages/DashboardPage.tsx`

- [ ] **Step 1: Import hinzufügen**

In `DashboardPage.tsx` nach Zeile 10 (`import AllJobsSection from '../components/AllJobsSection'`) einfügen:

```typescript
import AllLogsSection from '../components/AllLogsSection'
```

- [ ] **Step 2: `activeTab`-Typ und Ableitung erweitern (Zeile 22–26)**

```typescript
const activeTab: 'geplant' | 'gebucht' | 'benutzer' | 'jobs' | 'logs' =
  hash === '#users' ? 'benutzer'
  : hash === '#all-jobs' ? 'jobs'
  : hash === '#logs' ? 'logs'
  : hash === '#booked' ? 'gebucht'
  : 'geplant'
```

- [ ] **Step 3: `setActiveTab`-Signatur erweitern (Zeile 28)**

```typescript
function setActiveTab(tab: 'geplant' | 'gebucht' | 'benutzer' | 'jobs' | 'logs', clearFilters = false) {
```

- [ ] **Step 4: Hash-Mapping in `setActiveTab` (Zeile 33–39)**

```typescript
    navigate(
      tab === 'benutzer' ? '#users'
      : tab === 'jobs' ? '#all-jobs'
      : tab === 'logs' ? '#logs'
      : tab === 'gebucht' ? '#booked'
      : '#bookings',
      { replace: true }
    )
```

- [ ] **Step 5: Auth-Changed-Redirect erweitern (Zeile 81)**

```typescript
      if (!isAdmin() && (h === '#users' || h === '#all-jobs' || h === '#logs')) {
```

- [ ] **Step 6: Swipe-Gesten-Tabs erweitern (Zeile 114)**

```typescript
      const tabs = isAdmin() ? ['#bookings', '#booked', '#users', '#all-jobs', '#logs'] : ['#bookings', '#booked']
```

- [ ] **Step 7: Tab-Array in JSX erweitern (Zeile 231)**

```typescript
            {(['geplant', 'gebucht', ...(isAdmin() ? ['benutzer', 'jobs', 'logs'] : [])] as ('geplant' | 'gebucht' | 'benutzer' | 'jobs' | 'logs')[]).map((tab) => (
```

- [ ] **Step 8: Tab-Label ergänzen (Zeile 241–245)**

```typescript
                {tab === 'geplant' ? 'Geplant'
                  : tab === 'gebucht' ? 'Gebucht'
                  : tab === 'benutzer' ? 'Benutzer'
                  : tab === 'jobs' ? 'Jobs'
                  : 'Logs'}
```

- [ ] **Step 9: Tab-Content rendern — nach Zeile 346 (`AllJobsSection`)**

```typescript
      {/* Admin: Logs-Tab */}
      {isAdmin() && activeTab === 'logs' && <AllLogsSection />}
```

- [ ] **Step 10: Frontend bauen (Typcheck)**

```bash
cd frontend && npm run build
```

Erwartetes Ergebnis: Build erfolgreich ohne Typfehler.

- [ ] **Step 11: Alle Frontend-Tests**

```bash
cd frontend && npm test -- --run
```

Erwartetes Ergebnis: alle Tests PASSED.

- [ ] **Step 12: Commit**

```bash
git add frontend/src/pages/DashboardPage.tsx
git commit -m "feat: add admin Logs tab to DashboardPage"
```

---

## Abschluss-Verifikation

- [ ] Backend-Tests alle grün: `pytest tests/ -x`
- [ ] Frontend-Tests alle grün: `cd frontend && npm test -- --run`
- [ ] Frontend baut: `cd frontend && npm run build`
