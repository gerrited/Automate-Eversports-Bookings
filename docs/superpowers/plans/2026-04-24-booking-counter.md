# Buchungszähler pro User — Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unterhalb der geplanten Buchungen anzeigen, wie viele Buchungen der Worker bisher automatisch für den User durchgeführt hat.

**Architecture:** Ein Integer-Zähler `total_bookings_executed` sitzt direkt am User-Modell und wird vom Worker nach jeder erfolgreichen Ausführung (Status `success`, `already_booked` oder `waitlist`) atomar inkrementiert. Ein neuer `GET /api/me`-Endpoint liefert den Wert ans Frontend; die DashboardPage lädt ihn beim Mount und zeigt die Meldung unterhalb der Job-Cards an.

**Tech Stack:** Python/SQLAlchemy/Alembic (Backend), FastAPI (API), TypeScript/React (Frontend), pytest/vitest (Tests)

---

## Dateiübersicht

| Datei | Aktion |
|-------|--------|
| `backend/models/user.py` | Spalte `total_bookings_executed` hinzufügen |
| `backend/alembic/versions/<rev>_add_total_bookings_executed_to_users.py` | Neue Migration (per autogenerate erzeugt) |
| `backend/schemas/user.py` | `MeResponse`-Schema hinzufügen |
| `backend/api/account.py` | `GET /api/me`-Endpoint hinzufügen |
| `worker/worker.py` | Zähler nach Log-Eintrag inkrementieren |
| `frontend/src/types.ts` | `CurrentUser`-Interface hinzufügen |
| `frontend/src/api/account.ts` | `getMe()`-Funktion hinzufügen |
| `frontend/src/pages/DashboardPage.tsx` | Zähler laden und Meldung anzeigen |
| `tests/backend/test_api_me.py` | Neue Testdatei für `GET /api/me` |
| `tests/worker/test_worker.py` | Counter-Tests anhängen |

---

### Task 1: DB-Modell und Migration

**Files:**
- Modify: `backend/models/user.py`
- Create: `backend/alembic/versions/<rev>_add_total_bookings_executed_to_users.py` (per Alembic erzeugt)

- [ ] **Schritt 1: Spalte im Modell hinzufügen**

In `backend/models/user.py` nach `max_active_jobs` einfügen:

```python
total_bookings_executed = Column(Integer, default=0, nullable=False)
```

Die Datei soll danach so aussehen:

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

    jobs = relationship("BookingJob", back_populates="user", cascade="all, delete-orphan")
```

- [ ] **Schritt 2: Migration erzeugen**

```bash
DATABASE_URL=sqlite:///eversports.db \
  alembic -c backend/alembic.ini revision --autogenerate -m "add_total_bookings_executed_to_users"
```

Die erzeugte Datei in `backend/alembic/versions/` öffnen und prüfen, dass `upgrade()` und `downgrade()` korrekt sind. Sie soll so aussehen (Revision-ID variiert):

```python
from alembic import op
import sqlalchemy as sa

revision: str = '<generierte-id>'
down_revision = 'f2e233c3cee1'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('users', sa.Column('total_bookings_executed', sa.Integer(), nullable=False, server_default='0'))


def downgrade() -> None:
    op.drop_column('users', 'total_bookings_executed')
```

- [ ] **Schritt 3: Migration lokal einspielen**

```bash
DATABASE_URL=sqlite:///eversports.db \
  alembic -c backend/alembic.ini upgrade head
```

Erwartete Ausgabe enthält: `Running upgrade f2e233c3cee1 -> <neue-rev>, add_total_bookings_executed_to_users`

- [ ] **Schritt 4: Committen**

```bash
git add backend/models/user.py backend/alembic/versions/*add_total_bookings_executed*
git commit -m "feat: add total_bookings_executed column to users"
```

---

### Task 2: Backend-API — `GET /api/me`

**Files:**
- Modify: `backend/schemas/user.py`
- Modify: `backend/api/account.py`
- Create: `tests/backend/test_api_me.py`

- [ ] **Schritt 1: Failing-Tests schreiben**

Neue Datei `tests/backend/test_api_me.py`:

```python
import os

os.environ.setdefault("ENCRYPTION_KEY", os.urandom(32).hex())
os.environ.setdefault("JWT_SECRET", "test-jwt-secret-do-not-use-in-prod")
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("FRONTEND_URL", "http://localhost:5173")

from backend.core.auth import create_access_token
from backend.models.user import User


def _auth(user_id: str) -> dict:
    return {"Authorization": f"Bearer {create_access_token(user_id)}"}


def _make_user(db_session, ev_id="ev1", email="u@x.com", total=0) -> User:
    user = User(
        eversports_user_id=ev_id,
        email=email,
        encrypted_password="x",
        active=True,
        role="user",
        total_bookings_executed=total,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def test_me_requires_auth(client):
    resp = client.get("/api/me")
    assert resp.status_code == 401


def test_me_returns_total_bookings_executed(client, db_session):
    user = _make_user(db_session, total=5)
    resp = client.get("/api/me", headers=_auth(user.id))
    assert resp.status_code == 200
    assert resp.json()["total_bookings_executed"] == 5


def test_me_returns_zero_when_no_bookings(client, db_session):
    user = _make_user(db_session, total=0)
    resp = client.get("/api/me", headers=_auth(user.id))
    assert resp.status_code == 200
    assert resp.json()["total_bookings_executed"] == 0
```

- [ ] **Schritt 2: Tests ausführen und Fehlschlag bestätigen**

```bash
pytest tests/backend/test_api_me.py -v
```

Erwartete Ausgabe: `FAILED` mit `404 Not Found` oder ähnlichem (Endpoint existiert noch nicht).

- [ ] **Schritt 3: `MeResponse`-Schema hinzufügen**

In `backend/schemas/user.py` anhängen:

```python
class MeResponse(BaseModel):
    total_bookings_executed: int

    model_config = {"from_attributes": True}
```

Die Datei sieht danach so aus:

```python
from datetime import datetime
from pydantic import BaseModel


class UserResponse(BaseModel):
    id: str
    email: str
    active: bool
    role: str
    job_count: int
    created_at: datetime

    model_config = {"from_attributes": True}


class SetActiveRequest(BaseModel):
    active: bool


class MeResponse(BaseModel):
    total_bookings_executed: int

    model_config = {"from_attributes": True}
```

- [ ] **Schritt 4: Endpoint implementieren**

`backend/api/account.py` ersetzen:

```python
from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from backend.api.deps import get_current_active_user
from backend.db import get_db
from backend.models.user import User
from backend.schemas.user import MeResponse

router = APIRouter()


@router.get("/me", response_model=MeResponse)
def get_me(current_user: User = Depends(get_current_active_user)):
    return current_user


@router.delete("/account", status_code=204)
def delete_account(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    db.delete(current_user)
    db.commit()
    return Response(status_code=204)
```

- [ ] **Schritt 5: Tests ausführen und Erfolg bestätigen**

```bash
pytest tests/backend/test_api_me.py -v
```

Erwartete Ausgabe: 3× `PASSED`

- [ ] **Schritt 6: Gesamte Backend-Testsuite prüfen**

```bash
pytest tests/backend/ -x
```

Erwartete Ausgabe: alle Tests `PASSED`

- [ ] **Schritt 7: Committen**

```bash
git add backend/schemas/user.py backend/api/account.py tests/backend/test_api_me.py
git commit -m "feat: add GET /api/me endpoint returning total_bookings_executed"
```

---

### Task 3: Worker — Zähler inkrementieren

**Files:**
- Modify: `worker/worker.py`
- Modify: `tests/worker/test_worker.py`

- [ ] **Schritt 1: Failing-Tests schreiben**

An das Ende von `tests/worker/test_worker.py` anhängen:

```python
def test_process_job_increments_counter_on_success(db_session, session_factory, mocker):
    user = _user(db_session, uid="cnt1", ev="ev_cnt1", email="cnt1@b.com")
    _job(db_session, jid="jcnt1", uid="cnt1", weekday=1, days=4)

    mocker.patch("worker.worker.decrypt", return_value="pass")
    mocker.patch("worker.worker.book_session", return_value={"status": "success", "order_id": "ord"})

    process_job("jcnt1", datetime(2026, 4, 10, 18, 0), session_factory, [])

    db_session.refresh(user)
    assert user.total_bookings_executed == 1


def test_process_job_increments_counter_on_already_booked(db_session, session_factory, mocker):
    user = _user(db_session, uid="cnt2", ev="ev_cnt2", email="cnt2@b.com")
    _job(db_session, jid="jcnt2", uid="cnt2", weekday=1, days=4)

    mocker.patch("worker.worker.decrypt", return_value="pass")
    mocker.patch("worker.worker.book_session", return_value={"status": "already_booked"})

    process_job("jcnt2", datetime(2026, 4, 10, 18, 0), session_factory, [])

    db_session.refresh(user)
    assert user.total_bookings_executed == 1


def test_process_job_increments_counter_on_waitlist(db_session, session_factory, mocker):
    user = _user(db_session, uid="cnt3", ev="ev_cnt3", email="cnt3@b.com")
    _job(db_session, jid="jcnt3", uid="cnt3", weekday=1, days=4)

    mocker.patch("worker.worker.decrypt", return_value="pass")
    mocker.patch("worker.worker.book_session", return_value={"status": "waitlist"})
    mocker.patch("worker.worker.send_waitlist_notification")

    process_job("jcnt3", datetime(2026, 4, 10, 18, 0), session_factory, [])

    db_session.refresh(user)
    assert user.total_bookings_executed == 1


def test_process_job_does_not_increment_counter_on_failure(db_session, session_factory, mocker):
    user = _user(db_session, uid="cnt4", ev="ev_cnt4", email="cnt4@b.com")
    _job(db_session, jid="jcnt4", uid="cnt4", weekday=1, days=4)

    mocker.patch("worker.worker.decrypt", return_value="pass")
    mocker.patch("worker.worker.book_session", side_effect=RuntimeError("Fehler"))
    mocker.patch("worker.worker.send_booking_failure_email")

    process_job("jcnt4", datetime(2026, 4, 10, 18, 0), session_factory, [])

    db_session.refresh(user)
    assert user.total_bookings_executed == 0
```

- [ ] **Schritt 2: Tests ausführen und Fehlschlag bestätigen**

```bash
pytest tests/worker/test_worker.py::test_process_job_increments_counter_on_success \
       tests/worker/test_worker.py::test_process_job_increments_counter_on_already_booked \
       tests/worker/test_worker.py::test_process_job_increments_counter_on_waitlist \
       tests/worker/test_worker.py::test_process_job_does_not_increment_counter_on_failure -v
```

Erwartete Ausgabe: 4× `FAILED` (Zähler bleibt 0)

- [ ] **Schritt 3: Zähler im Worker inkrementieren**

In `worker/worker.py` die Zeilen nach `db.add(log_entry)` (aktuell Zeile 145) so ändern:

```python
        db.add(log_entry)
        if log_entry.status in ("success", "already_booked", "waitlist"):
            user.total_bookings_executed += 1
        db.commit()
```

Vorher:
```python
        db.add(log_entry)
        db.commit()
```

- [ ] **Schritt 4: Tests ausführen und Erfolg bestätigen**

```bash
pytest tests/worker/test_worker.py -v
```

Erwartete Ausgabe: alle Tests `PASSED`

- [ ] **Schritt 5: Committen**

```bash
git add worker/worker.py tests/worker/test_worker.py
git commit -m "feat: increment total_bookings_executed on worker job execution"
```

---

### Task 4: Frontend — Zähler laden und anzeigen

**Files:**
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/api/account.ts`
- Modify: `frontend/src/pages/DashboardPage.tsx`

- [ ] **Schritt 1: `CurrentUser`-Interface in `types.ts` hinzufügen**

An das Ende von `frontend/src/types.ts` anhängen:

```typescript
export interface CurrentUser {
  total_bookings_executed: number
}
```

- [ ] **Schritt 2: `getMe()` in `account.ts` hinzufügen**

`frontend/src/api/account.ts` ersetzen:

```typescript
import { apiFetch } from './client'
import type { CurrentUser } from '../types'

export function deleteAccount(): Promise<void> {
  return apiFetch<void>('/api/account', { method: 'DELETE' })
}

export function getMe(): Promise<CurrentUser> {
  return apiFetch<CurrentUser>('/api/me')
}
```

- [ ] **Schritt 3: Import in `DashboardPage.tsx` ergänzen**

Die Zeile

```typescript
import { clearToken, isAdmin, isActualAdmin, getEmail, getAvatarUrl } from '../api/client'
```

bleibt. Direkt darunter (Zeile 4) existiert noch kein Import aus `account.ts`. Folgende Zeile nach den bestehenden Imports einfügen (z.B. nach Zeile 14, vor der Typen-Zeile):

```typescript
import { getMe } from '../api/account'
```

- [ ] **Schritt 4: State und Fetch in `DashboardPage.tsx` hinzufügen**

Nach der Zeile `const [tick, forceUpdate] = useState(0)` (aktuell Zeile 59) einfügen:

```typescript
  const [totalBookingsExecuted, setTotalBookingsExecuted] = useState<number>(0)

  useEffect(() => {
    getMe().then(data => setTotalBookingsExecuted(data.total_bookings_executed)).catch(() => {})
  }, [])
```

- [ ] **Schritt 5: Meldung unterhalb der Job-Cards einfügen**

Im `activeTab === 'geplant'`-Block (Zeilen 255–285) nach der schließenden `</div>` der Job-Cards-Liste, aber noch innerhalb des `<>`-Fragments, einfügen:

```tsx
          {totalBookingsExecuted > 0 && (
            <p className="text-slate-400 text-sm text-center mt-6">
              🦾 für dich wurde{totalBookingsExecuted === 1 ? '' : 'n'} bereits{' '}
              <span className="font-semibold text-slate-200">{totalBookingsExecuted}</span>{' '}
              Buchung{totalBookingsExecuted === 1 ? '' : 'en'} automatisch durchgeführt.
            </p>
          )}
```

Der Block sieht danach so aus:

```tsx
      {activeTab === 'geplant' && (
        <>
          {loading && <p className="text-slate-400 text-sm">Lädt…</p>}
          {!loading && jobs.length === 0 && (
            <p className="text-slate-400 text-sm text-center mt-12">
              Noch keine Buchung geplant.
            </p>
          )}

          <div className="flex flex-col gap-3">
            {[...jobs]
              .filter(job => debugFilter === 'debug' ? job.debug : !job.debug)
              .sort((a, b) =>
                a.weekday - b.weekday ||
                a.target_time.localeCompare(b.target_time) ||
                a.facility_name.localeCompare(b.facility_name, 'de') ||
                a.class_name.localeCompare(b.class_name, 'de')
              ).map(job => (
              <JobCard
                key={job.id}
                job={job}
                onToggle={handleToggle}
                onEdit={j => { setEditingJob(j); setShowModal(true) }}
                onDelete={handleDelete}
                onSelect={handleSelect}
                onExecute={isAdmin() ? handleExecute : undefined}
              />
            ))}
          </div>

          {totalBookingsExecuted > 0 && (
            <p className="text-slate-400 text-sm text-center mt-6">
              🦾 für dich wurde{totalBookingsExecuted === 1 ? '' : 'n'} bereits{' '}
              <span className="font-semibold text-slate-200">{totalBookingsExecuted}</span>{' '}
              Buchung{totalBookingsExecuted === 1 ? '' : 'en'} automatisch durchgeführt.
            </p>
          )}
        </>
      )}
```

- [ ] **Schritt 6: TypeScript-Fehler prüfen**

```bash
cd frontend && npx tsc --noEmit
```

Erwartete Ausgabe: keine Fehler

- [ ] **Schritt 7: Frontend-Tests ausführen**

```bash
cd frontend && npm test
```

Erwartete Ausgabe: alle Tests `PASSED`

- [ ] **Schritt 8: Dev-Server starten und manuell prüfen**

```bash
# Terminal 1 — Backend
DATABASE_URL=sqlite:///eversports.db \
  JWT_SECRET=test-secret \
  ENCRYPTION_KEY=$(python -c 'import os; print(os.urandom(32).hex())') \
  FRONTEND_URL=http://localhost:5173 \
  uvicorn backend.main:app --reload

# Terminal 2 — Frontend
cd frontend && npm run dev
```

Im Browser `http://localhost:5173` öffnen, einloggen und auf den „Geplant"-Tab wechseln.
- Bei `total_bookings_executed = 0`: **keine Meldung** sichtbar.
- Um die Meldung zu testen: In der DB direkt `UPDATE users SET total_bookings_executed = 1 WHERE email = '...'` setzen, Seite neu laden → Singular-Form prüfen.
- Dann auf 2 setzen, neu laden → Plural-Form prüfen.

- [ ] **Schritt 9: Committen**

```bash
git add frontend/src/types.ts frontend/src/api/account.ts frontend/src/pages/DashboardPage.tsx
git commit -m "feat: show total bookings executed count on dashboard"
```
