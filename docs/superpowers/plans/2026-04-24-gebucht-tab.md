# Gebucht-Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Einen neuen "Gebucht"-Tab hinzufügen, der tatsächlich gebuchte Eversports-Termine anzeigt und Stornierungen ermöglicht; den bestehenden "Buchungen"-Tab in "Geplant" umbenennen.

**Architecture:** Das Backend scrapt `https://www.eversports.de/u` mit der eingeloggten `requests`-Session (identisches Muster wie `cancel_booking()`). Zwei neue Endpoints (`GET /api/bookings/upcoming`, `POST /api/bookings/{event_participant_id}/cancel`) in einem neuen Router `backend/api/bookings.py`. Das Frontend erhält einen neuen Tab mit einer `BookedAppointmentCard`-Komponente.

**Tech Stack:** Python/FastAPI, BeautifulSoup4, Pydantic, React/TypeScript, Tailwind CSS

---

## Dateiübersicht

| Aktion | Datei | Zweck |
|--------|-------|-------|
| Modify | `backend/core/booking.py` | `fetch_upcoming_bookings()` + `cancel_booking_by_ids()` hinzufügen |
| Create | `backend/api/bookings.py` | Neuer Router mit zwei Endpoints |
| Modify | `backend/main.py` | Neuen Router einbinden |
| Create | `backend/tests/test_bookings.py` | Tests für neuen Router |
| Modify | `frontend/src/types.ts` | `BookedAppointment`-Typ hinzufügen |
| Create | `frontend/src/api/bookedAppointments.ts` | API-Funktionen |
| Create | `frontend/src/components/BookedAppointmentCard.tsx` | Karte pro Buchung |
| Modify | `frontend/src/pages/DashboardPage.tsx` | Tab umbenennen + neuen Tab einbauen |

---

## Task 1: `fetch_upcoming_bookings()` in `backend/core/booking.py`

**Files:**
- Modify: `backend/core/booking.py`
- Test: `backend/tests/test_bookings.py`

- [ ] **Schritt 1: Failing Test schreiben**

Datei anlegen: `backend/tests/test_bookings.py`

```python
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from backend.api.deps import get_current_active_user
from backend.main import app
from backend.models.user import User

_fake_user = MagicMock(spec=User)
_fake_user.id = "test-user-id"
_fake_user.email = "test@example.com"
_fake_user.encrypted_password = "encrypted-pw"
app.dependency_overrides[get_current_active_user] = lambda: _fake_user

client = TestClient(app)

_U_HTML = """
<html><body>
<div class="activity-block eventparticipant">
  <div class="marketplace-booked-activity" data-facility-id="73041">
    <div class="marketplace-booked-activity__content">
      <div class="marketplace-booked-activity__content__main">
        <h4 class="marketplace-booked-activity__name"><a href="/activity/abc">CrossFit</a></h4>
        <div class="marketplace-booked-activity__facility">
          <a href="/s/crossfit-rabbit-hole">CrossFit Rabbit Hole</a>
        </div>
      </div>
      <ul class="dropdown-menu">
        <li>
          <a class="cancel-link-event"
             data-event="91440"
             data-eventparticipant="176157972"
             data-facilityid="73041"
             data-session="80836170">Sign out</a>
        </li>
      </ul>
    </div>
    <input id="google-calendar-start" type="hidden" value="20260426T090000"/>
    <input id="google-calendar-end"   type="hidden" value="20260426T100000"/>
    <input id="facility-street" type="hidden" value="Stubbenweg"/>
    <input id="facility-zip"    type="hidden" value="26125"/>
    <input id="facility-city"   type="hidden" value="Oldenburg"/>
  </div>
</div>
</body></html>
"""


def _mock_login(session):
    return {"user_id": "u1", "session": session}


def _make_u_session():
    resp = MagicMock()
    resp.ok = True
    resp.text = _U_HTML
    session = MagicMock()
    session.get.return_value = resp
    return session


def test_fetch_upcoming_bookings_returns_structured_data():
    from backend.core.booking import fetch_upcoming_bookings
    session = _make_u_session()
    with patch("backend.core.booking.eversports_login", return_value=_mock_login(session)):
        result = fetch_upcoming_bookings("test@example.com", "password")

    assert len(result) == 1
    b = result[0]
    assert b["activity_name"] == "CrossFit"
    assert b["facility_name"] == "CrossFit Rabbit Hole"
    assert b["facility_slug"] == "crossfit-rabbit-hole"
    assert b["start_datetime"] == "2026-04-26T09:00:00"
    assert b["end_datetime"] == "2026-04-26T10:00:00"
    assert b["address"] == "Stubbenweg, 26125 Oldenburg"
    assert b["event_id"] == "91440"
    assert b["event_participant_id"] == "176157972"
    assert b["session_id"] == "80836170"
    assert b["facility_id"] == "73041"


def test_fetch_upcoming_bookings_returns_empty_on_login_failure():
    from backend.core.booking import fetch_upcoming_bookings
    with patch("backend.core.booking.eversports_login", return_value=None):
        result = fetch_upcoming_bookings("test@example.com", "wrong")
    assert result == []
```

- [ ] **Schritt 2: Test zum Scheitern bringen**

```bash
DATABASE_URL=sqlite:///eversports.db pytest backend/tests/test_bookings.py -x -v
```

Erwartetes Ergebnis: `ImportError` oder `AttributeError: module 'backend.core.booking' has no attribute 'fetch_upcoming_bookings'`

- [ ] **Schritt 3: `fetch_upcoming_bookings()` implementieren**

In `backend/core/booking.py` am Ende der Datei (nach `cancel_booking`) einfügen:

```python
from datetime import datetime


def fetch_upcoming_bookings(email: str, password: str) -> list[dict]:
    """
    Ruft bevorstehende Buchungen von /u ab und gibt strukturierte Daten zurück.
    Gibt [] zurück wenn Login fehlschlägt.
    """
    login_result = eversports_login(email, password)
    if login_result is None:
        return []
    session: requests.Session = login_result["session"]

    resp = session.get(BASE_URL + "/u", timeout=TIMEOUT)
    if not resp.ok:
        return []

    def _get_input(block, id_: str) -> str:
        el = block.find("input", id=id_)
        return el["value"] if el else ""

    soup = BeautifulSoup(resp.text, "html.parser")
    bookings = []

    for block in soup.find_all("div", class_="marketplace-booked-activity"):
        name_el = block.find("h4", class_="marketplace-booked-activity__name")
        activity_name = name_el.get_text(strip=True) if name_el else ""

        facility_el = block.find("div", class_="marketplace-booked-activity__facility")
        facility_link = facility_el.find("a") if facility_el else None
        facility_name = facility_link.get_text(strip=True) if facility_link else ""
        facility_href = facility_link.get("href", "") if facility_link else ""
        facility_slug = facility_href.removeprefix("/s/")

        cancel_link = block.find("a", class_="cancel-link-event")
        if cancel_link is None:
            continue

        def _parse_dt(raw: str) -> str:
            try:
                return datetime.strptime(raw, "%Y%m%dT%H%M%S").isoformat()
            except ValueError:
                return raw

        street = _get_input(block, "facility-street")
        zip_ = _get_input(block, "facility-zip")
        city = _get_input(block, "facility-city")
        address = f"{street}, {zip_} {city}".strip(", ")

        bookings.append({
            "activity_name": activity_name,
            "facility_name": facility_name,
            "facility_slug": facility_slug,
            "start_datetime": _parse_dt(_get_input(block, "google-calendar-start")),
            "end_datetime": _parse_dt(_get_input(block, "google-calendar-end")),
            "address": address,
            "event_id": cancel_link.get("data-event", ""),
            "event_participant_id": cancel_link.get("data-eventparticipant", ""),
            "session_id": cancel_link.get("data-session", ""),
            "facility_id": cancel_link.get("data-facilityid", ""),
        })

    return bookings
```

Hinweis: In `backend/core/booking.py` den bestehenden Import `from datetime import date, timedelta` ersetzen durch:
```python
from datetime import date, datetime, timedelta
```
`BeautifulSoup` ist bereits importiert.

- [ ] **Schritt 4: Tests laufen lassen**

```bash
DATABASE_URL=sqlite:///eversports.db pytest backend/tests/test_bookings.py::test_fetch_upcoming_bookings_returns_structured_data backend/tests/test_bookings.py::test_fetch_upcoming_bookings_returns_empty_on_login_failure -v
```

Erwartetes Ergebnis: 2 PASSED

- [ ] **Schritt 5: Commit**

```bash
git add backend/core/booking.py backend/tests/test_bookings.py
git commit -m "feat: add fetch_upcoming_bookings() to booking core"
```

---

## Task 2: `cancel_booking_by_ids()` in `backend/core/booking.py`

**Files:**
- Modify: `backend/core/booking.py`
- Test: `backend/tests/test_bookings.py`

- [ ] **Schritt 1: Failing Test schreiben**

In `backend/tests/test_bookings.py` anhängen:

```python
def test_cancel_booking_by_ids_calls_eversports():
    from backend.core.booking import cancel_booking_by_ids
    cancel_resp = MagicMock()
    cancel_resp.ok = True
    session = MagicMock()
    session.post.return_value = cancel_resp

    with patch("backend.core.booking.eversports_login", return_value=_mock_login(session)):
        cancel_booking_by_ids(
            email="test@example.com",
            password="pw",
            event_id="91440",
            event_participant_id="176157972",
            facility_id="73041",
            session_id="80836170",
        )

    session.post.assert_called_once()
    call_kwargs = session.post.call_args
    assert "event/cancel" in call_kwargs[0][0]
    posted = call_kwargs[1]["data"]
    assert posted["eventId"] == "91440"
    assert posted["eventParticipantId"] == "176157972"
    assert posted["facilityId"] == "73041"
    assert posted["sessionId"] == "80836170"


def test_cancel_booking_by_ids_raises_on_login_failure():
    from backend.core.booking import cancel_booking_by_ids
    with patch("backend.core.booking.eversports_login", return_value=None):
        try:
            cancel_booking_by_ids("e", "p", "1", "2", "3", "4")
            assert False, "RuntimeError erwartet"
        except RuntimeError:
            pass
```

- [ ] **Schritt 2: Test zum Scheitern bringen**

```bash
DATABASE_URL=sqlite:///eversports.db pytest backend/tests/test_bookings.py::test_cancel_booking_by_ids_calls_eversports -v
```

Erwartetes Ergebnis: `AttributeError: module 'backend.core.booking' has no attribute 'cancel_booking_by_ids'`

- [ ] **Schritt 3: `cancel_booking_by_ids()` implementieren**

In `backend/core/booking.py` nach `fetch_upcoming_bookings` einfügen:

```python
def cancel_booking_by_ids(
    email: str,
    password: str,
    event_id: str,
    event_participant_id: str,
    facility_id: str,
    session_id: str,
) -> None:
    """
    Storniert eine Buchung direkt über die bekannten IDs.
    Wirft RuntimeError bei Login-Fehler oder HTTP-Fehler.
    """
    login_result = eversports_login(email, password)
    if login_result is None:
        raise RuntimeError("Eversports login failed")
    session: requests.Session = login_result["session"]

    resp = session.post(
        BASE_URL + "/api/event/cancel",
        data={
            "eventId": event_id,
            "eventParticipantId": event_participant_id,
            "facilityId": facility_id,
            "sessionId": session_id,
            "isLateCancellation": "false",
        },
        timeout=TIMEOUT,
    )
    if not resp.ok:
        raise _http_error(resp)
```

- [ ] **Schritt 4: Tests laufen lassen**

```bash
DATABASE_URL=sqlite:///eversports.db pytest backend/tests/test_bookings.py -v
```

Erwartetes Ergebnis: 4 PASSED

- [ ] **Schritt 5: Commit**

```bash
git add backend/core/booking.py backend/tests/test_bookings.py
git commit -m "feat: add cancel_booking_by_ids() to booking core"
```

---

## Task 3: API-Router `backend/api/bookings.py`

**Files:**
- Create: `backend/api/bookings.py`
- Modify: `backend/main.py`
- Test: `backend/tests/test_bookings.py`

- [ ] **Schritt 1: Failing Tests schreiben**

In `backend/tests/test_bookings.py` anhängen:

```python
_BOOKING = {
    "activity_name": "CrossFit",
    "facility_name": "CrossFit Rabbit Hole",
    "facility_slug": "crossfit-rabbit-hole",
    "start_datetime": "2026-04-26T09:00:00",
    "end_datetime": "2026-04-26T10:00:00",
    "address": "Stubbenweg, 26125 Oldenburg",
    "event_id": "91440",
    "event_participant_id": "176157972",
    "session_id": "80836170",
    "facility_id": "73041",
}


def test_get_upcoming_bookings_returns_list():
    with (
        patch("backend.api.bookings.decrypt", return_value="password"),
        patch("backend.api.bookings.fetch_upcoming_bookings", return_value=[_BOOKING]),
    ):
        resp = client.get("/api/bookings/upcoming")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["activity_name"] == "CrossFit"
    assert data[0]["start_datetime"] == "2026-04-26T09:00:00"


def test_get_upcoming_bookings_502_on_empty_credentials():
    with (
        patch("backend.api.bookings.decrypt", return_value="password"),
        patch("backend.api.bookings.fetch_upcoming_bookings", side_effect=RuntimeError("login failed")),
    ):
        resp = client.get("/api/bookings/upcoming")
    assert resp.status_code == 502


def test_cancel_booking_success():
    with (
        patch("backend.api.bookings.decrypt", return_value="password"),
        patch("backend.api.bookings.cancel_booking_by_ids", return_value=None),
    ):
        resp = client.post("/api/bookings/176157972/cancel", json={
            "event_id": "91440",
            "facility_id": "73041",
            "session_id": "80836170",
        })
    assert resp.status_code == 204


def test_cancel_booking_400_on_eversports_error():
    with (
        patch("backend.api.bookings.decrypt", return_value="password"),
        patch("backend.api.bookings.cancel_booking_by_ids",
              side_effect=RuntimeError("HTTP 400 from Eversports: too late")),
    ):
        resp = client.post("/api/bookings/176157972/cancel", json={
            "event_id": "91440",
            "facility_id": "73041",
            "session_id": "80836170",
        })
    assert resp.status_code == 400
    assert "too late" in resp.json()["detail"]
```

- [ ] **Schritt 2: Tests zum Scheitern bringen**

```bash
DATABASE_URL=sqlite:///eversports.db pytest backend/tests/test_bookings.py::test_get_upcoming_bookings_returns_list -v
```

Erwartetes Ergebnis: `404 Not Found` (Router noch nicht registriert)

- [ ] **Schritt 3: Router implementieren**

Neue Datei `backend/api/bookings.py` anlegen:

```python
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.api.deps import get_current_active_user
from backend.core.booking import fetch_upcoming_bookings, cancel_booking_by_ids
from backend.core.encryption import decrypt
from backend.db import get_db
from backend.models.user import User

router = APIRouter()


class CancelRequest(BaseModel):
    event_id: str
    facility_id: str
    session_id: str


@router.get("/bookings/upcoming")
def get_upcoming_bookings(
    current_user: User = Depends(get_current_active_user),
):
    password = decrypt(current_user.encrypted_password)
    try:
        bookings = fetch_upcoming_bookings(current_user.email, password)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))
    return bookings


@router.post("/bookings/{event_participant_id}/cancel", status_code=204)
def cancel_booking(
    event_participant_id: str,
    body: CancelRequest,
    current_user: User = Depends(get_current_active_user),
):
    password = decrypt(current_user.encrypted_password)
    try:
        cancel_booking_by_ids(
            email=current_user.email,
            password=password,
            event_id=body.event_id,
            event_participant_id=event_participant_id,
            facility_id=body.facility_id,
            session_id=body.session_id,
        )
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e))
```

- [ ] **Schritt 4: Router in `backend/main.py` einbinden**

In `backend/main.py` die Import-Zeile erweitern:

```python
from backend.api import auth, jobs, admin, facilities, account, bookings
```

Und nach der letzten `include_router`-Zeile einfügen:

```python
app.include_router(bookings.router, prefix="/api")
```

- [ ] **Schritt 5: Alle Tests laufen lassen**

```bash
DATABASE_URL=sqlite:///eversports.db pytest backend/tests/test_bookings.py -v
```

Erwartetes Ergebnis: 8 PASSED

- [ ] **Schritt 6: Commit**

```bash
git add backend/api/bookings.py backend/main.py backend/tests/test_bookings.py
git commit -m "feat: add /api/bookings/upcoming and /api/bookings/{id}/cancel endpoints"
```

---

## Task 4: Frontend-Typen und API-Datei

**Files:**
- Modify: `frontend/src/types.ts`
- Create: `frontend/src/api/bookedAppointments.ts`

- [ ] **Schritt 1: `BookedAppointment`-Typ in `frontend/src/types.ts` hinzufügen**

Am Ende der Datei einfügen:

```typescript
export interface BookedAppointment {
  activity_name: string
  facility_name: string
  facility_slug: string
  start_datetime: string
  end_datetime: string
  address: string
  event_id: string
  event_participant_id: string
  session_id: string
  facility_id: string
}
```

- [ ] **Schritt 2: API-Datei anlegen**

Neue Datei `frontend/src/api/bookedAppointments.ts`:

```typescript
import { apiFetch } from './client'
import type { BookedAppointment } from '../types'

export const getUpcomingBookings = (): Promise<BookedAppointment[]> =>
  apiFetch('/api/bookings/upcoming')

export const cancelBooking = (
  eventParticipantId: string,
  body: { event_id: string; facility_id: string; session_id: string },
): Promise<void> =>
  apiFetch(`/api/bookings/${eventParticipantId}/cancel`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
```

- [ ] **Schritt 3: TypeScript-Kompilierung prüfen**

```bash
cd frontend && npx tsc --noEmit
```

Erwartetes Ergebnis: keine Fehler

- [ ] **Schritt 4: Commit**

```bash
git add frontend/src/types.ts frontend/src/api/bookedAppointments.ts
git commit -m "feat: add BookedAppointment type and bookedAppointments API"
```

---

## Task 5: `BookedAppointmentCard`-Komponente

**Files:**
- Create: `frontend/src/components/BookedAppointmentCard.tsx`

- [ ] **Schritt 1: Komponente anlegen**

Neue Datei `frontend/src/components/BookedAppointmentCard.tsx`:

```typescript
import { useState } from 'react'
import type { BookedAppointment } from '../types'

interface Props {
  booking: BookedAppointment
  onCancel: (booking: BookedAppointment) => Promise<void>
}

function formatDatetime(isoStart: string, isoEnd: string): string {
  const start = new Date(isoStart)
  const end = new Date(isoEnd)
  const dateStr = start.toLocaleDateString('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
  const startTime = start.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
  const endTime = end.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
  return `${dateStr}, ${startTime} – ${endTime}`
}

export default function BookedAppointmentCard({ booking, onCancel }: Props) {
  const [cancelling, setCancelling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  async function handleCancel() {
    setCancelling(true)
    setError(null)
    try {
      await onCancel(booking)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Stornierung fehlgeschlagen')
      setCancelling(false)
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-col gap-2">
      <div className="text-sm text-gray-500">{formatDatetime(booking.start_datetime, booking.end_datetime)}</div>
      <div className="font-semibold text-gray-900">{booking.activity_name}</div>
      <div className="text-sm text-gray-600">{booking.facility_name}</div>
      <div className="text-xs text-gray-400">{booking.address}</div>

      {error && <div className="text-xs text-red-500 mt-1">{error}</div>}

      {!confirmOpen ? (
        <button
          onClick={() => setConfirmOpen(true)}
          className="mt-2 self-start text-sm text-red-500 hover:text-red-700 transition-colors"
        >
          Stornieren
        </button>
      ) : (
        <div className="mt-2 flex items-center gap-3">
          <span className="text-sm text-gray-700">Wirklich stornieren?</span>
          <button
            onClick={handleCancel}
            disabled={cancelling}
            className="text-sm text-red-600 font-medium hover:text-red-800 disabled:opacity-50"
          >
            {cancelling ? 'Wird storniert…' : 'Ja, stornieren'}
          </button>
          <button
            onClick={() => setConfirmOpen(false)}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Abbrechen
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Schritt 2: TypeScript-Kompilierung prüfen**

```bash
cd frontend && npx tsc --noEmit
```

Erwartetes Ergebnis: keine Fehler

- [ ] **Schritt 3: Commit**

```bash
git add frontend/src/components/BookedAppointmentCard.tsx
git commit -m "feat: add BookedAppointmentCard component"
```

---

## Task 6: Tab-Umbenennung und "Gebucht"-Tab in `DashboardPage.tsx`

**Files:**
- Modify: `frontend/src/pages/DashboardPage.tsx`

- [ ] **Schritt 1: Imports erweitern**

Oben in `DashboardPage.tsx` die bestehende Import-Zeile für `listJobs` etc. lassen und folgende zwei neue Imports hinzufügen:

```typescript
import { getUpcomingBookings, cancelBooking } from '../api/bookedAppointments'
import BookedAppointmentCard from '../components/BookedAppointmentCard'
import type { BookedAppointment } from '../types'
```

- [ ] **Schritt 2: Tab-Typ und State erweitern**

Die bestehende Zeile:
```typescript
const activeTab: 'buchungen' | 'benutzer' | 'jobs' =
  hash === '#users' ? 'benutzer' : hash === '#all-jobs' ? 'jobs' : 'buchungen'
```

Ersetzen durch:
```typescript
const activeTab: 'geplant' | 'gebucht' | 'benutzer' | 'jobs' =
  hash === '#users' ? 'benutzer'
  : hash === '#all-jobs' ? 'jobs'
  : hash === '#booked' ? 'gebucht'
  : 'geplant'
```

Die bestehende Funktion `setActiveTab`:
```typescript
function setActiveTab(tab: 'buchungen' | 'benutzer' | 'jobs', clearFilters = false) {
```
Ersetzen durch:
```typescript
function setActiveTab(tab: 'geplant' | 'gebucht' | 'benutzer' | 'jobs', clearFilters = false) {
```

Die `navigate`-Zeile innerhalb von `setActiveTab`:
```typescript
navigate(tab === 'benutzer' ? '#users' : tab === 'jobs' ? '#all-jobs' : '#bookings', { replace: true })
```
Ersetzen durch:
```typescript
navigate(
  tab === 'benutzer' ? '#users'
  : tab === 'jobs' ? '#all-jobs'
  : tab === 'gebucht' ? '#booked'
  : '#bookings',
  { replace: true }
)
```

Den Swipe-Handler (Array der Tabs):
```typescript
const tabs = ['#bookings', '#users', '#all-jobs']
```
Ersetzen durch:
```typescript
const tabs = ['#bookings', '#booked', '#users', '#all-jobs']
```

- [ ] **Schritt 3: State für Buchungen hinzufügen**

Nach der bestehenden `const [jobs, setJobs] = useState<Job[]>([])` Zeile einfügen:

```typescript
const [bookedAppointments, setBookedAppointments] = useState<BookedAppointment[]>([])
const [bookedLoading, setBookedLoading] = useState(false)
const [bookedError, setBookedError] = useState<string | null>(null)
```

- [ ] **Schritt 4: Lade-Logik für "Gebucht"-Tab hinzufügen**

Nach dem bestehenden `useEffect` der Jobs (suche nach `listJobs()`) einen neuen `useEffect` einfügen:

```typescript
useEffect(() => {
  if (activeTab !== 'gebucht') return
  if (bookedAppointments.length > 0) return  // nur einmal laden
  setBookedLoading(true)
  setBookedError(null)
  getUpcomingBookings()
    .then(setBookedAppointments)
    .catch((e) => setBookedError(e instanceof Error ? e.message : 'Fehler beim Laden'))
    .finally(() => setBookedLoading(false))
}, [activeTab])
```

- [ ] **Schritt 5: Cancel-Handler hinzufügen**

Nach dem `useEffect` aus Schritt 4 einfügen:

```typescript
async function handleCancelBooking(booking: BookedAppointment) {
  await cancelBooking(booking.event_participant_id, {
    event_id: booking.event_id,
    facility_id: booking.facility_id,
    session_id: booking.session_id,
  })
  setBookedAppointments((prev) =>
    prev.filter((b) => b.event_participant_id !== booking.event_participant_id)
  )
}
```

- [ ] **Schritt 6: Tab-Navigation anpassen**

Die bestehende Tab-Schleife:
```typescript
{(['buchungen', 'benutzer', 'jobs'] as const).map((tab) => (
  ...
  {tab === 'buchungen' ? 'Buchungen' : tab === 'benutzer' ? 'Benutzer' : 'Jobs'}
```

Ersetzen durch:
```typescript
{(['geplant', 'gebucht', 'benutzer', 'jobs'] as const).map((tab) => (
  <button
    key={tab}
    onClick={() => setActiveTab(tab, true)}
    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
      activeTab === tab
        ? 'bg-white text-gray-900 shadow-sm'
        : 'text-gray-500 hover:text-gray-700'
    }`}
  >
    {tab === 'geplant' ? 'Geplant'
      : tab === 'gebucht' ? 'Gebucht'
      : tab === 'benutzer' ? 'Benutzer'
      : 'Jobs'}
  </button>
))}
```

- [ ] **Schritt 7: Bestehende Buchungen-Anzeige auf `geplant` umstellen**

Die beiden Stellen wo `activeTab === 'buchungen'` steht:
```typescript
{(!isAdmin() || activeTab === 'buchungen') && (
```
Jeweils ersetzen durch:
```typescript
{(!isAdmin() || activeTab === 'geplant') && (
```

- [ ] **Schritt 8: "Gebucht"-Tab-Inhalt einbauen**

Nach der letzten `{(!isAdmin() || activeTab === 'geplant') ...}`-Sektion und vor dem `{isAdmin() && activeTab === 'benutzer' ...}` Block einfügen:

```typescript
{activeTab === 'gebucht' && (
  <div className="flex flex-col gap-3">
    {bookedLoading && (
      <p className="text-center text-gray-400 py-8">Lade Buchungen…</p>
    )}
    {bookedError && (
      <p className="text-center text-red-500 py-8">{bookedError}</p>
    )}
    {!bookedLoading && !bookedError && bookedAppointments.length === 0 && (
      <p className="text-center text-gray-400 py-8">Keine bevorstehenden Buchungen</p>
    )}
    {bookedAppointments.map((b) => (
      <BookedAppointmentCard
        key={b.event_participant_id}
        booking={b}
        onCancel={handleCancelBooking}
      />
    ))}
  </div>
)}
```

- [ ] **Schritt 9: TypeScript-Kompilierung prüfen**

```bash
cd frontend && npx tsc --noEmit
```

Erwartetes Ergebnis: keine Fehler

- [ ] **Schritt 10: Commit**

```bash
git add frontend/src/pages/DashboardPage.tsx
git commit -m "feat: rename Buchungen to Geplant, add Gebucht tab"
```

---

## Task 7: Manuelle Verifikation

- [ ] **Schritt 1: Backend starten**

```bash
DATABASE_URL=sqlite:///eversports.db \
  JWT_SECRET=test-secret \
  ENCRYPTION_KEY=$(python3 -c 'import os; print(os.urandom(32).hex())') \
  FRONTEND_URL=http://localhost:5173 \
  uvicorn backend.main:app --reload
```

- [ ] **Schritt 2: Frontend starten**

```bash
cd frontend && npm run dev
```

- [ ] **Schritt 3: Prüfliste**

- [ ] Tab heißt "Geplant" (vorher "Buchungen")
- [ ] Neuer Tab "Gebucht" ist sichtbar
- [ ] Klick auf "Gebucht" lädt bevorstehende Buchungen von Eversports
- [ ] Buchungen werden mit Datum, Uhrzeit, Kursname und Studio angezeigt
- [ ] "Stornieren" öffnet Bestätigungsdialog
- [ ] Nach Bestätigung wird die Buchung aus der Liste entfernt
- [ ] Bei Fehler erscheint eine Fehlermeldung

- [ ] **Schritt 4: Alle Tests laufen lassen**

```bash
DATABASE_URL=sqlite:///eversports.db pytest backend/tests/ -v
```

Erwartetes Ergebnis: alle Tests PASSED
