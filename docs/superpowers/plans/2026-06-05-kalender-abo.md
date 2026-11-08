# Kalender-Abonnement (ICS Feed) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Benutzer können ihre bevorstehenden Eversports-Buchungen als ICS-Kalender-Feed abonnieren; beim Stornieren über die App verschwindet der Termin beim nächsten Kalender-Sync automatisch.

**Architecture:** Ein langlebiger `calendar_token` (UUID) pro User ermöglicht einen öffentlichen Feed-Endpunkt `/api/calendar/feed.ics?token=<token>`, der `fetch_upcoming_bookings` aufruft und eine `.ics`-Datei zurückgibt. Im Frontend zeigt ein neuer `CalendarSubscriptionBlock` im „Gebucht"-Tab die Abo-URL mit Kopieren-Button und Google-Calendar-Link.

**Tech Stack:** Python/FastAPI (Backend), Alembic (Migration), React/TypeScript + Vitest + Testing Library (Frontend)

---

## Dateiübersicht

**Neu (Backend):**
- `backend/api/calendar.py` — 3 Endpunkte: Token abrufen, Token regenerieren, ICS-Feed
- `backend/alembic/versions/b2c3d4e5f6a7_add_calendar_token_to_users.py` — Migration

**Geändert (Backend):**
- `backend/models/user.py` — neues Feld `calendar_token`
- `backend/main.py` — calendar-Router einbinden

**Neu (Tests):**
- `tests/backend/test_api_calendar.py` — Backend-Tests

**Neu (Frontend):**
- `frontend/src/api/calendar.ts` — API-Funktionen
- `frontend/src/components/CalendarSubscriptionBlock.tsx` — UI-Komponente
- `frontend/src/components/CalendarSubscriptionBlock.test.tsx` — Component-Tests

**Geändert (Frontend):**
- `frontend/src/pages/DashboardPage.tsx` — `CalendarSubscriptionBlock` einbinden

---

## Task 1: User-Model und Alembic-Migration

**Files:**
- Modify: `backend/models/user.py`
- Create: `backend/alembic/versions/b2c3d4e5f6a7_add_calendar_token_to_users.py`

- [ ] **Step 1: `calendar_token`-Feld zum User-Model hinzufügen**

In `backend/models/user.py` die Importe und das Modell ergänzen:

```python
import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, Boolean, Integer
from sqlalchemy.orm import relationship
from backend.db import Base


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    eversports_user_id = Column(String, unique=True, nullable=False)
    email = Column(String, unique=True, nullable=False)
    encrypted_password = Column(String, nullable=False)
    active = Column(Boolean, default=False, nullable=False)
    role = Column(String, default="user", nullable=False)
    max_active_jobs = Column(Integer, nullable=True)
    total_bookings_executed = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    notification_advance_minutes = Column(Integer, nullable=False, server_default="60", default=60)
    calendar_token = Column(String, unique=True, nullable=True)

    jobs = relationship("BookingJob", back_populates="user", cascade="all, delete-orphan")
    push_subscriptions = relationship("PushSubscription", back_populates="user", cascade="all, delete-orphan")
```

- [ ] **Step 2: Alembic-Migration erstellen**

Datei `backend/alembic/versions/a1b2c3d4e5f6_add_calendar_token_to_users.py` erstellen:

```python
"""add calendar_token to users

Revision ID: b2c3d4e5f6a7
Revises: a5b6c7d8e9f0
Create Date: 2026-06-05 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, None] = 'a5b6c7d8e9f0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('calendar_token', sa.String(), nullable=True))
    op.create_unique_constraint('uq_users_calendar_token', 'users', ['calendar_token'])


def downgrade() -> None:
    op.drop_constraint('uq_users_calendar_token', 'users', type_='unique')
    op.drop_column('users', 'calendar_token')
```

- [ ] **Step 3: Bestehende Tests noch grün**

```bash
pytest tests/ -x -q
```

Erwartung: alle Tests bestehen (das neue Feld ist nullable, bricht nichts).

- [ ] **Step 4: Commit**

```bash
git add backend/models/user.py backend/alembic/versions/b2c3d4e5f6a7_add_calendar_token_to_users.py
git commit -m "feat: add calendar_token field to users model and migration"
```

---

## Task 2: Backend — Token-Verwaltungs-Endpunkte

**Files:**
- Create: `backend/api/calendar.py`
- Modify: `backend/main.py`
- Create: `tests/backend/test_api_calendar.py`

- [ ] **Step 1: Fehlschlagende Tests schreiben**

Datei `tests/backend/test_api_calendar.py` erstellen:

```python
import uuid
from unittest.mock import patch

from backend.core.auth import create_access_token
from backend.core.encryption import encrypt
from backend.models.user import User


def _auth_header(user_id: str) -> dict:
    return {"Authorization": f"Bearer {create_access_token(user_id)}"}


def _create_user(db_session, *, calendar_token: str | None = None) -> User:
    user = User(
        eversports_user_id="ev-1",
        email="a@b.com",
        encrypted_password=encrypt("password123"),
        active=True,
        calendar_token=calendar_token,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def test_get_calendar_token_creates_on_first_call(client, db_session):
    user = _create_user(db_session)
    resp = client.get("/api/me/calendar-token", headers=_auth_header(user.id))
    assert resp.status_code == 200
    body = resp.json()
    assert "token" in body
    assert len(body["token"]) == 36  # UUID4


def test_get_calendar_token_returns_existing(client, db_session):
    existing = str(uuid.uuid4())
    user = _create_user(db_session, calendar_token=existing)
    resp = client.get("/api/me/calendar-token", headers=_auth_header(user.id))
    assert resp.status_code == 200
    assert resp.json()["token"] == existing


def test_regenerate_calendar_token_returns_new_token(client, db_session):
    old = str(uuid.uuid4())
    user = _create_user(db_session, calendar_token=old)
    resp = client.post("/api/me/calendar-token/regenerate", headers=_auth_header(user.id))
    assert resp.status_code == 200
    new_token = resp.json()["token"]
    assert new_token != old
    assert len(new_token) == 36
```

- [ ] **Step 2: Tests laufen lassen — erwarteter Fehler**

```bash
pytest tests/backend/test_api_calendar.py -v
```

Erwartung: FAIL mit `404 Not Found` (Endpunkte existieren noch nicht).

- [ ] **Step 3: `backend/api/calendar.py` erstellen**

```python
from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.api.deps import get_current_active_user
from backend.core.encryption import decrypt
from backend.db import get_db
from backend.models.user import User

router = APIRouter()


class CalendarTokenResponse(BaseModel):
    token: str


@router.get("/me/calendar-token", response_model=CalendarTokenResponse)
def get_calendar_token(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    if current_user.calendar_token is None:
        current_user.calendar_token = str(uuid.uuid4())
        db.commit()
        db.refresh(current_user)
    return CalendarTokenResponse(token=current_user.calendar_token)


@router.post("/me/calendar-token/regenerate", response_model=CalendarTokenResponse)
def regenerate_calendar_token(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    current_user.calendar_token = str(uuid.uuid4())
    db.commit()
    db.refresh(current_user)
    return CalendarTokenResponse(token=current_user.calendar_token)
```

- [ ] **Step 4: Router in `backend/main.py` einbinden**

```python
from backend.api import auth, jobs, admin, facilities, account, bookings, push, calendar

# ... (bestehende includes bleiben) ...
app.include_router(calendar.router, prefix="/api")
```

- [ ] **Step 5: Tests grün**

```bash
pytest tests/backend/test_api_calendar.py -v
```

Erwartung: alle 3 Tests PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/api/calendar.py backend/main.py tests/backend/test_api_calendar.py
git commit -m "feat: add calendar token management endpoints"
```

---

## Task 3: Backend — ICS-Feed-Endpunkt

**Files:**
- Modify: `backend/api/calendar.py`
- Modify: `tests/backend/test_api_calendar.py`

- [ ] **Step 1: Fehlschlagende Tests hinzufügen**

Am Ende von `tests/backend/test_api_calendar.py` ergänzen:

```python
SAMPLE_BOOKINGS = [
    {
        "activity_name": "Yoga",
        "facility_name": "Sport XY",
        "facility_slug": "sport-xy",
        "start_datetime": "2026-06-09T09:00:00",
        "end_datetime": "2026-06-09T10:00:00",
        "address": "Musterstraße 1, 1010 Wien",
        "event_id": "evt-abc",
        "event_participant_id": "ep-123",
        "session_id": "sess-456",
        "facility_id": "fac-789",
    }
]


def test_ics_feed_valid_token(client, db_session):
    token = str(uuid.uuid4())
    _create_user(db_session, calendar_token=token)
    with patch("backend.api.calendar.fetch_upcoming_bookings", return_value=SAMPLE_BOOKINGS):
        resp = client.get(f"/api/calendar/feed.ics?token={token}")
    assert resp.status_code == 200
    assert "text/calendar" in resp.headers["content-type"]
    body = resp.text
    assert "BEGIN:VCALENDAR" in body
    assert "BEGIN:VEVENT" in body
    assert "Yoga" in body
    assert "Sport XY" in body
    assert "evt-abc@eversports-bookings" in body
    assert "20260609T090000" in body


def test_ics_feed_invalid_token(client, db_session):
    _create_user(db_session)
    resp = client.get("/api/calendar/feed.ics?token=nonexistent-token")
    assert resp.status_code == 404


def test_ics_feed_eversports_error_returns_empty_calendar(client, db_session):
    token = str(uuid.uuid4())
    _create_user(db_session, calendar_token=token)
    with patch("backend.api.calendar.fetch_upcoming_bookings", side_effect=RuntimeError("down")):
        resp = client.get(f"/api/calendar/feed.ics?token={token}")
    assert resp.status_code == 200
    assert "BEGIN:VCALENDAR" in resp.text
    assert "BEGIN:VEVENT" not in resp.text
```

- [ ] **Step 2: Tests laufen lassen — erwarteter Fehler**

```bash
pytest tests/backend/test_api_calendar.py::test_ics_feed_valid_token tests/backend/test_api_calendar.py::test_ics_feed_invalid_token tests/backend/test_api_calendar.py::test_ics_feed_eversports_error_returns_empty_calendar -v
```

Erwartung: FAIL (Endpunkt fehlt).

- [ ] **Step 3: ICS-Endpunkt zu `backend/api/calendar.py` hinzufügen**

Die bestehenden Imports am Anfang der Datei um `fetch_upcoming_bookings` ergänzen:

```python
from backend.core.booking import fetch_upcoming_bookings
```

Dann diese beiden Hilfsfunktionen und den Endpunkt hinzufügen:

```python
def _format_ics_dt(iso_str: str) -> str:
    try:
        return datetime.fromisoformat(iso_str).strftime("%Y%m%dT%H%M%S")
    except (ValueError, TypeError):
        return ""


def _generate_ics(bookings: list[dict]) -> str:
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Eversports Bookings//DE",
        "CALSCALE:GREGORIAN",
        "X-WR-CALNAME:Meine Eversports Buchungen",
    ]
    for b in bookings:
        lines += [
            "BEGIN:VEVENT",
            f"UID:{b['event_id']}@eversports-bookings",
            f"DTSTART:{_format_ics_dt(b['start_datetime'])}",
            f"DTEND:{_format_ics_dt(b['end_datetime'])}",
            f"SUMMARY:{b['activity_name']}",
            f"LOCATION:{b['facility_name']}, {b['address']}",
            "END:VEVENT",
        ]
    lines.append("END:VCALENDAR")
    return "\r\n".join(lines)


@router.get("/calendar/feed.ics")
def get_calendar_feed(token: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.calendar_token == token).first()
    if user is None:
        raise HTTPException(status_code=404, detail="Invalid token")

    try:
        password = decrypt(user.encrypted_password)
        bookings = fetch_upcoming_bookings(user.email, password)
    except Exception:
        bookings = []

    ics_content = _generate_ics(bookings)
    return Response(
        content=ics_content,
        media_type="text/calendar; charset=utf-8",
        headers={"Content-Disposition": 'inline; filename="eversports.ics"',
                 "Cache-Control": "no-cache, no-store"},
    )
```

- [ ] **Step 4: Tests grün**

```bash
pytest tests/backend/test_api_calendar.py -v
```

Erwartung: alle 6 Tests PASS.

- [ ] **Step 5: Alle Backend-Tests grün**

```bash
pytest tests/ -x -q
```

Erwartung: alle Tests PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/api/calendar.py tests/backend/test_api_calendar.py
git commit -m "feat: add ICS calendar feed endpoint"
```

---

## Task 4: Frontend — API-Modul

**Files:**
- Create: `frontend/src/api/calendar.ts`

- [ ] **Step 1: `frontend/src/api/calendar.ts` erstellen**

```typescript
import { apiFetch } from './client'

export interface CalendarTokenResponse {
  token: string
}

export const getCalendarToken = (): Promise<CalendarTokenResponse> =>
  apiFetch('/api/me/calendar-token')

export const regenerateCalendarToken = (): Promise<CalendarTokenResponse> =>
  apiFetch('/api/me/calendar-token/regenerate', { method: 'POST' })
```

- [ ] **Step 2: TypeScript-Compile prüfen**

```bash
cd frontend && npx tsc --noEmit
```

Erwartung: keine Fehler.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/api/calendar.ts
git commit -m "feat: add calendar API module"
```

---

## Task 5: Frontend — CalendarSubscriptionBlock Komponente

**Files:**
- Create: `frontend/src/components/CalendarSubscriptionBlock.tsx`
- Create: `frontend/src/components/CalendarSubscriptionBlock.test.tsx`

- [ ] **Step 1: Fehlschlagende Tests schreiben**

Datei `frontend/src/components/CalendarSubscriptionBlock.test.tsx` erstellen:

```typescript
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import CalendarSubscriptionBlock from './CalendarSubscriptionBlock'
import * as calendarApi from '../api/calendar'

vi.mock('../api/calendar')

const mockGetCalendarToken = vi.mocked(calendarApi.getCalendarToken)
const mockRegenerateCalendarToken = vi.mocked(calendarApi.regenerateCalendarToken)

beforeEach(() => {
  mockGetCalendarToken.mockResolvedValue({ token: 'test-token-123' })
  mockRegenerateCalendarToken.mockResolvedValue({ token: 'new-token-456' })
  Object.defineProperty(window, 'location', {
    value: { host: 'localhost:5173' },
    writable: true,
  })
  Object.assign(navigator, {
    clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
  })
})

describe('CalendarSubscriptionBlock', () => {
  it('shows loading state initially', () => {
    render(<CalendarSubscriptionBlock />)
    expect(screen.getByText('Kalender abonnieren')).toBeInTheDocument()
  })

  it('shows subscription URL after token loads', async () => {
    render(<CalendarSubscriptionBlock />)
    await waitFor(() => {
      expect(screen.getByDisplayValue(/webcal:\/\/localhost:5173\/api\/calendar\/feed\.ics\?token=test-token-123/)).toBeInTheDocument()
    })
  })

  it('copies URL to clipboard on copy button click', async () => {
    render(<CalendarSubscriptionBlock />)
    await waitFor(() => screen.getByRole('button', { name: 'Kopieren' }))
    await userEvent.click(screen.getByRole('button', { name: 'Kopieren' }))
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      'webcal://localhost:5173/api/calendar/feed.ics?token=test-token-123'
    )
  })

  it('regenerates token on reset click', async () => {
    render(<CalendarSubscriptionBlock />)
    await waitFor(() => screen.getByRole('button', { name: 'Token zurücksetzen' }))
    await userEvent.click(screen.getByRole('button', { name: 'Token zurücksetzen' }))
    await waitFor(() => {
      expect(screen.getByDisplayValue(/token=new-token-456/)).toBeInTheDocument()
    })
  })
})
```

- [ ] **Step 2: Tests laufen lassen — erwarteter Fehler**

```bash
cd frontend && npm test -- CalendarSubscriptionBlock --run
```

Erwartung: FAIL (Komponente existiert nicht).

- [ ] **Step 3: `CalendarSubscriptionBlock.tsx` erstellen**

```typescript
import { useEffect, useState } from 'react'
import { getCalendarToken, regenerateCalendarToken } from '../api/calendar'

function buildWebcalUrl(token: string): string {
  return `webcal://${window.location.host}/api/calendar/feed.ics?token=${token}`
}

function buildGoogleCalendarUrl(token: string): string {
  const httpsUrl = `https://${window.location.host}/api/calendar/feed.ics?token=${token}`
  return `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(httpsUrl)}`
}

export default function CalendarSubscriptionBlock() {
  const [token, setToken] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [resetting, setResetting] = useState(false)

  useEffect(() => {
    getCalendarToken().then(r => setToken(r.token)).catch(() => {})
  }, [])

  async function handleCopy() {
    if (!token) return
    await navigator.clipboard.writeText(buildWebcalUrl(token))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleReset() {
    if (!window.confirm('Token zurücksetzen? Der alte Abo-Link wird ungültig.')) return
    setResetting(true)
    try {
      const r = await regenerateCalendarToken()
      setToken(r.token)
    } finally {
      setResetting(false)
    }
  }

  return (
    <div className="mt-6 rounded-xl bg-surface-card p-4">
      <p className="text-sm font-semibold text-slate-300 mb-3">Kalender abonnieren</p>
      {token ? (
        <>
          <input
            readOnly
            value={buildWebcalUrl(token)}
            className="w-full rounded-lg bg-slate-800 px-3 py-2 text-xs text-slate-400 font-mono mb-3 truncate focus:outline-none"
          />
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleCopy}
              className="px-3 py-2 text-sm font-medium rounded-lg bg-brand hover:bg-brand-hover text-white transition-colors"
            >
              {copied ? 'Kopiert!' : 'Kopieren'}
            </button>
            <a
              href={buildGoogleCalendarUrl(token)}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2 text-sm font-medium rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors"
            >
              In Google Kalender öffnen
            </a>
          </div>
          <p className="text-xs text-slate-500 mt-3 mb-1">
            Der Kalender aktualisiert sich automatisch.
          </p>
          <button
            onClick={handleReset}
            disabled={resetting}
            className="text-xs text-slate-500 hover:text-slate-400 underline disabled:opacity-50"
          >
            Token zurücksetzen
          </button>
        </>
      ) : (
        <p className="text-xs text-slate-500">Lädt…</p>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Tests grün**

```bash
cd frontend && npm test -- CalendarSubscriptionBlock --run
```

Erwartung: alle 4 Tests PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/CalendarSubscriptionBlock.tsx frontend/src/components/CalendarSubscriptionBlock.test.tsx
git commit -m "feat: add CalendarSubscriptionBlock component"
```

---

## Task 6: Frontend — Integration in DashboardPage

**Files:**
- Modify: `frontend/src/pages/DashboardPage.tsx`

- [ ] **Step 1: Import hinzufügen**

In `frontend/src/pages/DashboardPage.tsx` den bestehenden Import-Block um eine Zeile ergänzen:

```typescript
import CalendarSubscriptionBlock from '../components/CalendarSubscriptionBlock'
```

- [ ] **Step 2: Komponente im „Gebucht"-Tab einbinden**

Den bestehenden „Gebucht"-Tab-Block (Zeile ca. 330–350) so anpassen, dass `CalendarSubscriptionBlock` unterhalb der Buchungsliste erscheint:

```tsx
{/* Gebucht-Tab */}
{activeTab === 'gebucht' && (
  <div className="flex flex-col gap-3">
    {bookedLoading && (
      <p className="text-slate-400 text-sm text-center mt-12">Lade Buchungen…</p>
    )}
    {bookedError && (
      <p className="text-red-400 text-sm text-center mt-12">{bookedError}</p>
    )}
    {!bookedLoading && !bookedError && bookedAppointments.length === 0 && (
      <p className="text-slate-400 text-sm text-center mt-12">Keine bevorstehenden Buchungen</p>
    )}
    {[...bookedAppointments]
      .sort((a, b) => a.start_datetime.localeCompare(b.start_datetime))
      .map((b) => (
      <BookedAppointmentCard
        key={b.event_participant_id}
        booking={b}
        onCancel={handleCancelBooking}
      />
    ))}
    {!bookedLoading && !bookedError && <CalendarSubscriptionBlock />}
  </div>
)}
```

- [ ] **Step 3: TypeScript-Compile prüfen**

```bash
cd frontend && npx tsc --noEmit
```

Erwartung: keine Fehler.

- [ ] **Step 4: Alle Frontend-Tests grün**

```bash
cd frontend && npm test -- --run
```

Erwartung: alle Tests PASS.

- [ ] **Step 5: Alle Backend-Tests grün**

```bash
pytest tests/ -x -q
```

Erwartung: alle Tests PASS.

- [ ] **Step 6: Abschluss-Commit**

```bash
git add frontend/src/pages/DashboardPage.tsx
git commit -m "feat: integrate CalendarSubscriptionBlock into Gebucht tab"
```
