# Admin „Jetzt buchen"-Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admins können auf ihren eigenen JobCards einen „Jetzt buchen"-Button klicken, der die Buchung sofort für den nächsten passenden Wochentag ausführt.

**Architecture:** Neuer synchroner Endpoint `POST /api/jobs/{job_id}/execute` in `backend/api/jobs.py` berechnet das nächste Datum, ruft `book_session` direkt auf und schreibt einen `BookingLog`-Eintrag. Das Frontend zeigt während der Ausführung einen Spinner und danach ein 4-Sekunden-Feedback direkt auf der Karte.

**Tech Stack:** FastAPI, SQLAlchemy, SQLite (Test), React, TypeScript, Tailwind CSS, Vitest

---

## Dateien-Übersicht

| Datei | Aktion | Grund |
|---|---|---|
| `backend/api/jobs.py` | Modify | Neue Hilfsfunktion + execute-Endpoint |
| `tests/backend/test_api_jobs.py` | Modify | Tests für den neuen Endpoint |
| `frontend/src/api/jobs.ts` | Modify | `executeJob`-Funktion ergänzen |
| `frontend/src/components/JobCard.tsx` | Modify | `onExecute`-Prop, Spinner, Feedback |
| `frontend/src/components/JobCard.test.tsx` | Modify | Tests für neues Verhalten |
| `frontend/src/pages/DashboardPage.tsx` | Modify | `handleExecute` verdrahten |

---

## Task 1: Backend – execute-Endpoint

**Files:**
- Modify: `backend/api/jobs.py`
- Modify: `tests/backend/test_api_jobs.py`

- [ ] **Schritt 1: Failing Tests schreiben**

In `tests/backend/test_api_jobs.py` am Ende hinzufügen:

```python
from unittest.mock import patch


def _create_job(client, user_id: str) -> str:
    resp = client.post(
        "/api/jobs",
        json={
            "weekday": 1,
            "target_time": "18:00:00",
            "facility_id": "73041",
            "facility_name": "CrossFit Rabbit Hole",
            "class_name": "CrossFit",
            "days_in_advance": 4,
        },
        headers=_auth_header(user_id),
    )
    return resp.json()["id"]


def test_execute_job_success(client, db_session):
    user = _create_user(db_session)
    job_id = _create_job(client, user.id)

    with patch("backend.api.jobs.book_session", return_value={"status": "success", "order_id": "ord-1", "event_type": "class"}), \
         patch("backend.api.jobs.decrypt", return_value="password123"):
        resp = client.post(f"/api/jobs/{job_id}/execute", headers=_auth_header(user.id))

    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "success"
    assert "message" in body


def test_execute_job_already_booked(client, db_session):
    user = _create_user(db_session)
    job_id = _create_job(client, user.id)

    with patch("backend.api.jobs.book_session", return_value={"status": "already_booked", "order_id": None, "event_type": "class"}), \
         patch("backend.api.jobs.decrypt", return_value="password123"):
        resp = client.post(f"/api/jobs/{job_id}/execute", headers=_auth_header(user.id))

    assert resp.status_code == 200
    assert resp.json()["status"] == "already_booked"


def test_execute_job_booking_error(client, db_session):
    user = _create_user(db_session)
    job_id = _create_job(client, user.id)

    with patch("backend.api.jobs.book_session", side_effect=RuntimeError("CrossFit 18:00 not found")), \
         patch("backend.api.jobs.decrypt", return_value="password123"):
        resp = client.post(f"/api/jobs/{job_id}/execute", headers=_auth_header(user.id))

    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "failed"
    assert "CrossFit 18:00 not found" in body["message"]


def test_execute_job_debug_mode_cancels_booking(client, db_session):
    user = _create_user(db_session)
    # Job mit debug=True erstellen
    resp = client.post(
        "/api/jobs",
        json={
            "weekday": 1, "target_time": "18:00:00", "facility_id": "73041",
            "facility_name": "CrossFit Rabbit Hole", "class_name": "CrossFit",
            "days_in_advance": 4, "debug": True,
        },
        headers=_auth_header(user.id),
    )
    job_id = resp.json()["id"]

    with patch("backend.api.jobs.book_session", return_value={"status": "success", "order_id": "ord-1", "event_type": "class"}), \
         patch("backend.api.jobs.decrypt", return_value="password123"), \
         patch("backend.api.jobs.cancel_booking") as mock_cancel:
        resp = client.post(f"/api/jobs/{job_id}/execute", headers=_auth_header(user.id))

    assert resp.status_code == 200
    assert resp.json()["status"] == "success"
    assert "[DEBUG]" in resp.json()["message"]
    mock_cancel.assert_called_once()


def test_execute_job_forbidden_for_other_user(client, db_session):
    user_a = _create_user(db_session)
    user_b = User(eversports_user_id="ev-3", email="c@b.com", encrypted_password="x", active=True)
    db_session.add(user_b)
    db_session.commit()
    db_session.refresh(user_b)

    job_id = _create_job(client, user_a.id)
    resp = client.post(f"/api/jobs/{job_id}/execute", headers=_auth_header(user_b.id))
    assert resp.status_code == 403
```

- [ ] **Schritt 2: Tests ausführen – Fehler bestätigen**

```bash
pytest tests/backend/test_api_jobs.py::test_execute_job_success tests/backend/test_api_jobs.py::test_execute_job_already_booked tests/backend/test_api_jobs.py::test_execute_job_booking_error tests/backend/test_api_jobs.py::test_execute_job_forbidden_for_other_user -v
```

Erwartetes Ergebnis: 4x FAILED mit `404 Not Found` oder `AttributeError` (Endpoint existiert noch nicht).

- [ ] **Schritt 3: Endpoint implementieren**

In `backend/api/jobs.py` Imports am Anfang erweitern:

```python
from __future__ import annotations

from datetime import date, timedelta
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.api.deps import get_current_active_user
from backend.core.booking import book_session, cancel_booking
from backend.core.encryption import decrypt
from backend.db import get_db
from backend.models.booking_job import BookingJob
from backend.models.booking_log import BookingLog
from backend.models.user import User
from backend.schemas.job import JobCreate, JobUpdate, JobResponse
from backend.schemas.log import LogResponse
```

Hilfsfunktion `_next_weekday` direkt nach den bestehenden Hilfsfunktionen (`_find_duplicate`, `_get_owned_job`) einfügen:

```python
def _next_weekday(weekday: int) -> date:
    """Nächstes Datum ab heute mit dem gegebenen Wochentag (0=Mo … 6=So).
    Gibt heute zurück, wenn der Wochentag übereinstimmt."""
    today = date.today()
    days_ahead = (weekday - today.weekday()) % 7
    return today + timedelta(days=days_ahead)
```

Response-Schema am Ende der Imports (nach `LogResponse`-Import, vor `router = APIRouter()`):

```python
class ExecuteJobResponse(BaseModel):
    status: str   # "success" | "already_booked" | "failed"
    message: str
```

Neuen Endpoint am Ende von `backend/api/jobs.py` (nach `get_job_logs`) hinzufügen:

```python
@router.post("/jobs/{job_id}/execute", response_model=ExecuteJobResponse)
def execute_job(
    job_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    job = _get_owned_job(job_id, current_user, db)
    target_date = _next_weekday(job.weekday)

    user = db.query(User).filter(User.id == job.user_id).first()
    password = decrypt(user.encrypted_password)

    try:
        result = book_session(
            email=user.email,
            password=password,
            target_date=target_date,
            target_time=job.target_time.strftime("%H:%M"),
            facility_id=job.facility_id,
            class_name=job.class_name,
            event_type=job.event_type,
        )
        status = result["status"]
        message = str(target_date)

        if status == "success" and job.debug:
            try:
                cancel_booking(
                    email=user.email,
                    password=password,
                    class_name=job.class_name,
                    facility_id=job.facility_id,
                )
                message = f"[DEBUG] gebucht und storniert für {target_date}"
            except Exception as cancel_exc:
                message = f"[DEBUG] gebucht, Stornierung fehlgeschlagen: {cancel_exc}"

    except Exception as exc:
        status = "failed"
        message = str(exc)

    db.add(BookingLog(job_id=job.id, target_date=target_date, status=status, message=message))
    db.commit()

    return ExecuteJobResponse(status=status, message=message)
```

- [ ] **Schritt 4: Tests ausführen – Erfolg bestätigen**

```bash
pytest tests/backend/test_api_jobs.py -v
```

Erwartetes Ergebnis: alle Tests PASSED.

- [ ] **Schritt 5: Commit**

```bash
git add backend/api/jobs.py tests/backend/test_api_jobs.py
git commit -m "feat: add POST /api/jobs/{id}/execute endpoint for immediate booking"
```

---

## Task 2: Frontend – API-Funktion

**Files:**
- Modify: `frontend/src/api/jobs.ts`

- [ ] **Schritt 1: `executeJob`-Funktion ergänzen**

In `frontend/src/api/jobs.ts` am Ende hinzufügen:

```typescript
export const executeJob = (id: string): Promise<{ status: string; message: string }> =>
  apiFetch(`/api/jobs/${id}/execute`, { method: 'POST' })
```

- [ ] **Schritt 2: TypeScript-Kompilierung prüfen**

```bash
cd frontend && npx tsc --noEmit
```

Erwartetes Ergebnis: keine Fehler.

- [ ] **Schritt 3: Commit**

```bash
git add frontend/src/api/jobs.ts
git commit -m "feat: add executeJob API function"
```

---

## Task 3: Frontend – JobCard mit onExecute-Prop

**Files:**
- Modify: `frontend/src/components/JobCard.tsx`
- Modify: `frontend/src/components/JobCard.test.tsx`

- [ ] **Schritt 1: Failing Tests schreiben**

In `frontend/src/components/JobCard.test.tsx` – neue Testgruppe am Ende der `describe`-Block hinzufügen (vor der schließenden `}`):

```typescript
import { act } from 'react'

// ... bestehende Tests bleiben unverändert ...

  describe('onExecute', () => {
    it('zeigt keinen Jetzt-buchen-Button ohne onExecute-Prop', () => {
      render(
        <JobCard job={job} onToggle={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} onSelect={vi.fn()} />
      )
      expect(screen.queryByRole('button', { name: /jetzt buchen/i })).not.toBeInTheDocument()
    })

    it('zeigt Jetzt-buchen-Button wenn onExecute übergeben wird', () => {
      render(
        <JobCard job={job} onToggle={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} onSelect={vi.fn()} onExecute={vi.fn()} />
      )
      expect(screen.getByRole('button', { name: /jetzt buchen/i })).toBeInTheDocument()
    })

    it('ruft onExecute mit job.id auf wenn Button geklickt', async () => {
      const onExecute = vi.fn().mockResolvedValue({ status: 'success', message: '2026-04-28' })
      render(
        <JobCard job={job} onToggle={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} onSelect={vi.fn()} onExecute={onExecute} />
      )
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /jetzt buchen/i }))
      })
      expect(onExecute).toHaveBeenCalledWith('job-1')
    })

    it('zeigt Erfolgsmeldung nach erfolgreicher Buchung', async () => {
      const onExecute = vi.fn().mockResolvedValue({ status: 'success', message: '2026-04-28' })
      render(
        <JobCard job={job} onToggle={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} onSelect={vi.fn()} onExecute={onExecute} />
      )
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /jetzt buchen/i }))
      })
      expect(screen.getByText(/erfolgreich gebucht/i)).toBeInTheDocument()
    })

    it('zeigt Fehlermeldung bei fehlgeschlagener Buchung', async () => {
      const onExecute = vi.fn().mockResolvedValue({ status: 'failed', message: 'CrossFit not found' })
      render(
        <JobCard job={job} onToggle={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} onSelect={vi.fn()} onExecute={onExecute} />
      )
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /jetzt buchen/i }))
      })
      expect(screen.getByText(/CrossFit not found/)).toBeInTheDocument()
    })
  })
```

- [ ] **Schritt 2: Tests ausführen – Fehler bestätigen**

```bash
cd frontend && npm test -- --run JobCard
```

Erwartetes Ergebnis: neue Tests FAILED (onExecute-Prop existiert noch nicht).

- [ ] **Schritt 3: JobCard implementieren**

`frontend/src/components/JobCard.tsx` vollständig ersetzen:

```tsx
import { useState, useEffect, useRef } from 'react'
import type { Job } from '../types'
import { WEEKDAY_NAMES } from '../types'

interface Props {
  job: Job
  onToggle: (id: string) => void
  onEdit: (job: Job) => void
  onDelete: (id: string) => void
  onSelect: (job: Job) => void
  onExecute?: (id: string) => Promise<{ status: string; message: string }>
}

function nextWeekdayDate(weekday: number): Date {
  // weekday: 0=Mo … 6=So (wie Python), JS getDay(): 0=So … 6=Sa
  const today = new Date()
  const daysAhead = (weekday + 1 - today.getDay() + 7) % 7
  const d = new Date(today)
  d.setDate(today.getDate() + daysAhead)
  return d
}

export default function JobCard({ job, onToggle, onEdit, onDelete, onSelect, onExecute }: Props) {
  const time = job.target_time.slice(0, 5)
  const facilityLabel = job.facility_name || job.facility_id

  const [executing, setExecuting] = useState(false)
  const [feedback, setFeedback] = useState<{ status: string; message: string } | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [])

  async function handleExecute() {
    if (!onExecute || executing) return
    setExecuting(true)
    setFeedback(null)
    try {
      const result = await onExecute(job.id)
      setFeedback(result)
    } catch {
      setFeedback({ status: 'failed', message: 'Unbekannter Fehler' })
    } finally {
      setExecuting(false)
      timerRef.current = setTimeout(() => setFeedback(null), 4000)
    }
  }

  const targetDate = nextWeekdayDate(job.weekday)
  const dateLabel = targetDate.toLocaleDateString('de-DE', {
    weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric',
  })

  let feedbackText = ''
  let feedbackClass = ''
  if (feedback) {
    if (feedback.status === 'success') {
      feedbackText = `✓ Erfolgreich gebucht für ${dateLabel}`
      feedbackClass = 'text-green-400'
    } else if (feedback.status === 'already_booked') {
      feedbackText = `ℹ Bereits gebucht für ${dateLabel}`
      feedbackClass = 'text-blue-400'
    } else {
      feedbackText = `✕ ${feedback.message}`
      feedbackClass = 'text-red-400'
    }
  }

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
            <p className="text-white font-semibold">
              {WEEKDAY_NAMES[job.weekday]} · {time} Uhr · {job.class_name}
            </p>
            <p className="text-slate-400 text-sm mt-1">
              {facilityLabel} · {job.days_in_advance} Tage im Voraus{job.one_time ? ' · Einmalig' : ''}{job.debug ? ' · ' : ''}{job.debug && <span className="text-amber-400 text-xs font-medium">Test</span>}
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
          disabled={executing}
          className="px-3 py-1 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm transition-colors disabled:opacity-50"
        >
          Bearbeiten
        </button>
        {onExecute && (
          <button
            aria-label="Jetzt buchen"
            onClick={handleExecute}
            disabled={executing}
            className="px-3 py-1 rounded-md bg-blue-700 hover:bg-blue-600 text-white text-sm transition-colors disabled:opacity-60 flex items-center gap-1"
          >
            {executing ? (
              <>
                <span className="inline-block h-3 w-3 rounded-full border-2 border-blue-300 border-t-transparent animate-spin" />
                Bucht…
              </>
            ) : 'Jetzt buchen'}
          </button>
        )}
        <button
          aria-label="Löschen"
          onClick={() => onDelete(job.id)}
          disabled={executing}
          className="px-3 py-1 rounded-md bg-red-900 hover:bg-red-700 text-red-300 text-sm transition-colors ml-auto disabled:opacity-50"
        >
          Löschen
        </button>
      </div>

      {/* Feedback */}
      {feedback && (
        <div className={`px-4 pb-3 text-sm font-medium ${feedbackClass}`}>
          {feedbackText}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Schritt 4: Tests ausführen – Erfolg bestätigen**

```bash
cd frontend && npm test -- --run JobCard
```

Erwartetes Ergebnis: alle Tests PASSED.

- [ ] **Schritt 5: TypeScript-Kompilierung prüfen**

```bash
cd frontend && npx tsc --noEmit
```

Erwartetes Ergebnis: keine Fehler.

- [ ] **Schritt 6: Commit**

```bash
git add frontend/src/components/JobCard.tsx frontend/src/components/JobCard.test.tsx
git commit -m "feat: add onExecute prop to JobCard with spinner and feedback"
```

---

## Task 4: Frontend – DashboardPage verdrahten

**Files:**
- Modify: `frontend/src/pages/DashboardPage.tsx`

- [ ] **Schritt 1: Import ergänzen und `handleExecute` + Prop verdrahten**

In `frontend/src/pages/DashboardPage.tsx`:

Import-Zeile ändern (bestehende jobs-Imports erweitern):

```typescript
import { listJobs, createJob, updateJob, toggleJob, deleteJob, getJobLogs, executeJob } from '../api/jobs'
```

Neue Funktion `handleExecute` direkt nach `handleSelect` hinzufügen:

```typescript
async function handleExecute(id: string) {
  return await executeJob(id)
}
```

In der `JobCard`-Renderstelle das neue Prop ergänzen:

```tsx
<JobCard
  key={job.id}
  job={job}
  onToggle={handleToggle}
  onEdit={j => { setEditingJob(j); setShowModal(true) }}
  onDelete={handleDelete}
  onSelect={handleSelect}
  onExecute={isAdmin() ? handleExecute : undefined}
/>
```

- [ ] **Schritt 2: TypeScript-Kompilierung prüfen**

```bash
cd frontend && npx tsc --noEmit
```

Erwartetes Ergebnis: keine Fehler.

- [ ] **Schritt 3: Alle Frontend-Tests ausführen**

```bash
cd frontend && npm test -- --run
```

Erwartetes Ergebnis: alle Tests PASSED.

- [ ] **Schritt 4: Alle Backend-Tests ausführen**

```bash
pytest tests/ -x
```

Erwartetes Ergebnis: alle Tests PASSED.

- [ ] **Schritt 5: Commit**

```bash
git add frontend/src/pages/DashboardPage.tsx
git commit -m "feat: wire up execute-job button for admins on booking cards"
```
