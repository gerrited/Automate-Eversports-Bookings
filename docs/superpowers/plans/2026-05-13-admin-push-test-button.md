# Admin Push-Test-Button — Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admins können in der User-Verwaltung per Klick eine Test-Push-Notification (`{ title: "Test", body: "Testnachricht vom Admin" }`) an alle registrierten Geräte eines Users senden.

**Architecture:** Gemeinsamer Push-Sende-Helper in `backend/core/push.py` (bisher inline im Worker). Neuer Admin-Endpunkt `POST /api/admin/users/{id}/push-test`. `UserResponse` bekommt `push_subscription_count`. Frontend zeigt Glocken-Button neben dem „Nachricht"-Button — deaktiviert wenn keine Subscriptions.

**Tech Stack:** FastAPI, SQLAlchemy, pywebpush (bereits in requirements-backend.txt), React, TypeScript

---

## Betroffene Dateien

| Aktion | Datei |
|--------|-------|
| Neu erstellen | `backend/core/push.py` |
| Neu erstellen | `tests/backend/test_core_push.py` |
| Ändern | `worker/notifications.py` (remove `_send_to_subscription`, import from backend.core.push) |
| Ändern | `tests/worker/test_notifications.py` (mock-Pfad aktualisieren) |
| Ändern | `backend/schemas/user.py` (add `push_subscription_count`) |
| Ändern | `backend/api/admin.py` (list_users query + 2× UserResponse + neuer Endpunkt) |
| Ändern | `tests/backend/test_api_admin.py` (VAPID-Env-Vars + neue Tests) |
| Ändern | `frontend/src/types.ts` (add `push_subscription_count`) |
| Ändern | `frontend/src/api/users.ts` (add `sendTestPush`) |
| Ändern | `frontend/src/components/UserManagementSection.tsx` (state + button) |

---

## Task 1: `backend/core/push.py` erstellen

**Files:**
- Create: `backend/core/push.py`
- Create: `tests/backend/test_core_push.py`

- [ ] **Schritt 1: Failing Tests schreiben**

Datei `tests/backend/test_core_push.py`:

```python
import json
import os
from unittest.mock import patch, MagicMock

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

os.environ.setdefault("VAPID_PRIVATE_KEY", "test-private-key")
os.environ.setdefault("VAPID_SUBJECT", "mailto:test@example.com")
os.environ.setdefault("ENCRYPTION_KEY", os.urandom(32).hex())
os.environ.setdefault("JWT_SECRET", "test-jwt-secret-do-not-use-in-prod")
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("FRONTEND_URL", "http://localhost:5173")

from backend.db import Base
from backend.models.push_subscription import PushSubscription
from backend.models.user import User
from backend.core.push import send_to_subscription, send_test_push_to_user


@pytest.fixture
def db_session():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()
    Base.metadata.drop_all(engine)


def _make_user(db) -> User:
    u = User(
        eversports_user_id="ev-1",
        email="u@example.com",
        encrypted_password="enc",
        active=True,
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


def _make_sub(db, user_id: str, endpoint: str = "https://push.example.com/1") -> PushSubscription:
    sub = PushSubscription(user_id=user_id, endpoint=endpoint, p256dh="k", auth="a")
    db.add(sub)
    db.commit()
    return sub


def test_send_to_subscription_calls_webpush(db_session):
    user = _make_user(db_session)
    sub = _make_sub(db_session, user.id)
    with patch("backend.core.push.webpush") as mock_wp:
        send_to_subscription(sub, {"title": "T", "body": "B"}, db_session)
    assert mock_wp.call_count == 1
    call_kwargs = mock_wp.call_args[1]
    assert call_kwargs["subscription_info"]["endpoint"] == sub.endpoint
    data = json.loads(call_kwargs["data"])
    assert data == {"title": "T", "body": "B"}


def test_send_to_subscription_removes_gone_subscription(db_session):
    from pywebpush import WebPushException
    user = _make_user(db_session)
    sub = _make_sub(db_session, user.id)
    exc = WebPushException("Gone")
    exc.response = MagicMock(status_code=410)
    with patch("backend.core.push.webpush", side_effect=exc):
        send_to_subscription(sub, {"title": "T", "body": "B"}, db_session)
    db_session.expire_all()
    assert db_session.query(PushSubscription).filter_by(user_id=user.id).count() == 0


def test_send_to_subscription_does_not_remove_on_other_errors(db_session):
    from pywebpush import WebPushException
    user = _make_user(db_session)
    sub = _make_sub(db_session, user.id)
    exc = WebPushException("Server Error")
    exc.response = MagicMock(status_code=500)
    with patch("backend.core.push.webpush", side_effect=exc):
        send_to_subscription(sub, {"title": "T", "body": "B"}, db_session)
    db_session.expire_all()
    assert db_session.query(PushSubscription).filter_by(user_id=user.id).count() == 1


def test_send_test_push_to_user_sends_to_all_subscriptions(db_session):
    user = _make_user(db_session)
    _make_sub(db_session, user.id, endpoint="https://push.example.com/1")
    _make_sub(db_session, user.id, endpoint="https://push.example.com/2")
    with patch("backend.core.push.webpush") as mock_wp:
        count = send_test_push_to_user(db_session, user.id)
    assert mock_wp.call_count == 2
    assert count == 2


def test_send_test_push_to_user_uses_correct_payload(db_session):
    user = _make_user(db_session)
    _make_sub(db_session, user.id)
    with patch("backend.core.push.webpush") as mock_wp:
        send_test_push_to_user(db_session, user.id)
    data = json.loads(mock_wp.call_args[1]["data"])
    assert data == {"title": "Test", "body": "Testnachricht vom Admin"}


def test_send_test_push_to_user_returns_zero_for_no_subscriptions(db_session):
    user = _make_user(db_session)
    with patch("backend.core.push.webpush") as mock_wp:
        count = send_test_push_to_user(db_session, user.id)
    assert count == 0
    assert mock_wp.call_count == 0
```

- [ ] **Schritt 2: Tests laufen lassen — müssen FAIL sein**

```bash
pytest tests/backend/test_core_push.py -v
```

Erwartetes Ergebnis: `ImportError: cannot import name 'send_to_subscription' from 'backend.core.push'` (Datei existiert noch nicht).

- [ ] **Schritt 3: `backend/core/push.py` erstellen**

```python
from __future__ import annotations

import json
import logging
import os

from pywebpush import webpush, WebPushException
from sqlalchemy.orm import Session

from backend.models.push_subscription import PushSubscription

log = logging.getLogger(__name__)

_TEST_PAYLOAD = {"title": "Test", "body": "Testnachricht vom Admin"}


def send_to_subscription(sub: PushSubscription, payload: dict, db: Session) -> None:
    try:
        webpush(
            subscription_info={
                "endpoint": sub.endpoint,
                "keys": {"p256dh": sub.p256dh, "auth": sub.auth},
            },
            data=json.dumps(payload),
            vapid_private_key=os.environ["VAPID_PRIVATE_KEY"],
            vapid_claims={"sub": os.environ["VAPID_SUBJECT"]},
        )
    except WebPushException as exc:
        if exc.response is not None and exc.response.status_code == 410:
            log.info("Push subscription gone, removing: %s", sub.endpoint)
            db.delete(sub)
            db.commit()
        else:
            log.error("Push failed for endpoint %s: %s", sub.endpoint, exc)


def send_test_push_to_user(db: Session, user_id: str) -> int:
    subscriptions = db.query(PushSubscription).filter_by(user_id=user_id).all()
    for sub in subscriptions:
        send_to_subscription(sub, _TEST_PAYLOAD, db)
    return len(subscriptions)
```

- [ ] **Schritt 4: Tests laufen lassen — müssen PASS sein**

```bash
pytest tests/backend/test_core_push.py -v
```

Erwartetes Ergebnis: 6 passed.

- [ ] **Schritt 5: Commit**

```bash
git add backend/core/push.py tests/backend/test_core_push.py
git commit -m "feat: add backend/core/push.py with shared send_to_subscription helper"
```

---

## Task 2: Worker refaktorieren + Worker-Tests anpassen

**Files:**
- Modify: `worker/notifications.py`
- Modify: `tests/worker/test_notifications.py`

- [ ] **Schritt 1: `worker/notifications.py` anpassen**

`_send_to_subscription` entfernen, stattdessen aus `backend.core.push` importieren.

Altes Import-Block (Zeilen 1–17):
```python
"""
Push-Benachrichtigungen für bevorstehende Termine.
"""
from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone, timedelta

from pywebpush import webpush, WebPushException
from sqlalchemy.orm import Session

from backend.models.push_subscription import PushSubscription
from backend.models.user import User

log = logging.getLogger(__name__)
```

Neuer Import-Block:
```python
"""
Push-Benachrichtigungen für bevorstehende Termine.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone, timedelta

from sqlalchemy.orm import Session

from backend.core.push import send_to_subscription
from backend.models.push_subscription import PushSubscription
from backend.models.user import User

log = logging.getLogger(__name__)
```

Die gesamte Funktion `_send_to_subscription` (Zeilen 33–50) entfernen.

In `send_push_notifications` alle Aufrufe `_send_to_subscription(sub, payload, db)` durch `send_to_subscription(sub, payload, db)` ersetzen (Zeile 92 im Original).

- [ ] **Schritt 2: Bestehende Worker-Tests aktualisieren — mock-Pfad ändern**

In `tests/worker/test_notifications.py`: Alle Vorkommen von `"worker.notifications.webpush"` durch `"backend.core.push.webpush"` ersetzen.

Betroffene Zeilen (im Original):
- Zeile 94: `with patch("worker.notifications.webpush") as mock_wp:`
- Zeile 112: `with patch("worker.notifications.webpush") as mock_wp:`
- Zeile 128: `with patch("worker.notifications.webpush", side_effect=gone_exc):`

Alle drei Vorkommen werden zu `"backend.core.push.webpush"`.

- [ ] **Schritt 3: Worker-Tests laufen lassen — müssen PASS sein**

```bash
pytest tests/worker/test_notifications.py -v
```

Erwartetes Ergebnis: alle Tests pass (mindestens 7 Tests).

- [ ] **Schritt 4: Alle Tests laufen lassen**

```bash
pytest tests/ -x
```

Erwartetes Ergebnis: alle Tests pass.

- [ ] **Schritt 5: Commit**

```bash
git add worker/notifications.py tests/worker/test_notifications.py
git commit -m "refactor: move send_to_subscription to backend/core/push, update worker import"
```

---

## Task 3: `push_subscription_count` ins Schema + `list_users`-Query

**Files:**
- Modify: `backend/schemas/user.py`
- Modify: `backend/api/admin.py` (Zeilen 25–53 und 79–88 und 129–138)
- Modify: `tests/backend/test_api_admin.py`

- [ ] **Schritt 1: Failing Test für `push_subscription_count` schreiben**

Am Ende von `tests/backend/test_api_admin.py` anfügen:

```python
# --- push_subscription_count ---

def _make_push_subscription(db_session, user_id: str, endpoint: str = "https://push.example.com/1"):
    from backend.models.push_subscription import PushSubscription
    sub = PushSubscription(user_id=user_id, endpoint=endpoint, p256dh="k", auth="a")
    db_session.add(sub)
    db_session.commit()
    return sub


def test_list_users_includes_push_subscription_count(client, db_session):
    admin = _make_admin(db_session)
    user = _make_user(db_session, ev_id="ev-push", email="push@x.com")
    _make_push_subscription(db_session, user.id)
    resp = client.get("/api/admin/users", headers=_auth_header(admin.id))
    assert resp.status_code == 200
    users_data = resp.json()
    push_user = next(u for u in users_data if u["email"] == "push@x.com")
    assert push_user["push_subscription_count"] == 1


def test_list_users_push_subscription_count_zero_when_none(client, db_session):
    admin = _make_admin(db_session)
    _make_user(db_session, ev_id="ev-nopush", email="nopush@x.com")
    resp = client.get("/api/admin/users", headers=_auth_header(admin.id))
    assert resp.status_code == 200
    users_data = resp.json()
    no_push_user = next(u for u in users_data if u["email"] == "nopush@x.com")
    assert no_push_user["push_subscription_count"] == 0
```

- [ ] **Schritt 2: Test laufen lassen — muss FAIL sein**

```bash
pytest tests/backend/test_api_admin.py::test_list_users_includes_push_subscription_count -v
```

Erwartetes Ergebnis: `KeyError: 'push_subscription_count'` oder Validation-Fehler.

- [ ] **Schritt 3: `backend/schemas/user.py` aktualisieren**

`push_subscription_count: int = 0` zu `UserResponse` hinzufügen:

```python
class UserResponse(BaseModel):
    id: str
    email: str
    active: bool
    role: str
    job_count: int
    active_job_count: int
    max_active_jobs: Optional[int] = None
    created_at: datetime
    push_subscription_count: int = 0

    model_config = {"from_attributes": True}
```

- [ ] **Schritt 4: `list_users` in `backend/api/admin.py` anpassen**

Imports am Anfang der Datei ergänzen (zu den bestehenden Imports hinzufügen):

```python
from sqlalchemy import case, func, select as sa_select
from backend.models.push_subscription import PushSubscription
```

Die `list_users`-Funktion (Zeilen 25–53) vollständig ersetzen:

```python
@router.get("/admin/users", response_model=List[UserResponse])
def list_users(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    push_count_sq = (
        sa_select(func.count(PushSubscription.id))
        .where(PushSubscription.user_id == User.id)
        .correlate(User)
        .scalar_subquery()
    )
    rows = (
        db.query(
            User,
            func.count(BookingJob.id).label("job_count"),
            func.sum(case((BookingJob.enabled == True, 1), else_=0)).label("active_job_count"),
            push_count_sq.label("push_subscription_count"),
        )
        .outerjoin(BookingJob, BookingJob.user_id == User.id)
        .group_by(User.id)
        .order_by(User.created_at)
        .all()
    )
    return [
        UserResponse(
            id=user.id,
            email=user.email,
            active=user.active,
            role=user.role,
            job_count=job_count,
            active_job_count=active_job_count or 0,
            max_active_jobs=user.max_active_jobs,
            created_at=user.created_at,
            push_subscription_count=push_subscription_count or 0,
        )
        for user, job_count, active_job_count, push_subscription_count in rows
    ]
```

- [ ] **Schritt 5: `set_user_active` (Zeilen 79–88) `UserResponse` um `push_subscription_count` erweitern**

Nach den bestehenden `job_count`/`active_job_count`-Queries eine weitere Query hinzufügen und das `UserResponse` ergänzen:

```python
    job_count = db.query(func.count(BookingJob.id)).filter(BookingJob.user_id == user.id).scalar()
    active_job_count = db.query(func.count(BookingJob.id)).filter(
        BookingJob.user_id == user.id, BookingJob.enabled == True
    ).scalar()
    push_subscription_count = db.query(func.count(PushSubscription.id)).filter(
        PushSubscription.user_id == user.id
    ).scalar()
    return UserResponse(
        id=user.id,
        email=user.email,
        active=user.active,
        role=user.role,
        job_count=job_count,
        active_job_count=active_job_count or 0,
        max_active_jobs=user.max_active_jobs,
        created_at=user.created_at,
        push_subscription_count=push_subscription_count or 0,
    )
```

- [ ] **Schritt 6: `set_user_limit` (Zeilen 129–138) analog anpassen**

Identische Änderung wie in Schritt 5 — `push_subscription_count`-Query hinzufügen und in `UserResponse` eintragen.

- [ ] **Schritt 7: Tests laufen lassen — müssen PASS sein**

```bash
pytest tests/backend/test_api_admin.py -v
```

Erwartetes Ergebnis: alle Tests pass.

- [ ] **Schritt 8: Commit**

```bash
git add backend/schemas/user.py backend/api/admin.py tests/backend/test_api_admin.py
git commit -m "feat: add push_subscription_count to UserResponse and list_users query"
```

---

## Task 4: `POST /admin/users/{user_id}/push-test` Endpunkt

**Files:**
- Modify: `backend/api/admin.py`
- Modify: `tests/backend/test_api_admin.py`

- [ ] **Schritt 1: VAPID-Env-Vars in `test_api_admin.py` ergänzen**

Am Anfang von `tests/backend/test_api_admin.py`, nach den bestehenden `os.environ.setdefault`-Zeilen (Zeilen 4–7) hinzufügen:

```python
os.environ.setdefault("VAPID_PRIVATE_KEY", "test-private-key")
os.environ.setdefault("VAPID_SUBJECT", "mailto:test@example.com")
```

- [ ] **Schritt 2: Failing Tests für den neuen Endpunkt schreiben**

Am Ende von `tests/backend/test_api_admin.py` hinzufügen:

```python
# --- push-test endpoint ---

def test_send_push_test_requires_auth(client, db_session):
    user = _make_user(db_session)
    resp = client.post(f"/api/admin/users/{user.id}/push-test")
    assert resp.status_code == 401


def test_send_push_test_requires_admin(client, db_session):
    user = _make_user(db_session)
    resp = client.post(
        f"/api/admin/users/{user.id}/push-test",
        headers=_auth_header(user.id),
    )
    assert resp.status_code == 403


def test_send_push_test_returns_404_for_unknown_user(client, db_session):
    from unittest.mock import patch
    admin = _make_admin(db_session)
    with patch("backend.api.admin.send_test_push_to_user"):
        resp = client.post(
            "/api/admin/users/nonexistent-id/push-test",
            headers=_auth_header(admin.id),
        )
    assert resp.status_code == 404


def test_send_push_test_returns_204(client, db_session):
    from unittest.mock import patch, ANY
    admin = _make_admin(db_session)
    user = _make_user(db_session, ev_id="ev-pt", email="pt@x.com")
    with patch("backend.api.admin.send_test_push_to_user") as mock_send:
        resp = client.post(
            f"/api/admin/users/{user.id}/push-test",
            headers=_auth_header(admin.id),
        )
    assert resp.status_code == 204
    mock_send.assert_called_once_with(ANY, user.id)
```

- [ ] **Schritt 3: Test laufen lassen — muss FAIL sein**

```bash
pytest tests/backend/test_api_admin.py::test_send_push_test_returns_204 -v
```

Erwartetes Ergebnis: `404 Not Found` (Route noch nicht registriert).

- [ ] **Schritt 4: Endpunkt in `backend/api/admin.py` implementieren**

Imports am Anfang der Datei ergänzen:

```python
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from backend.core.push import send_test_push_to_user
```

(Hinweis: `Response` zur bestehenden FastAPI-Import-Zeile hinzufügen; `send_test_push_to_user` als neuen Import.)

Direkt nach dem `send_message_to_user`-Endpunkt (nach Zeile 241) einfügen:

```python
@router.post("/admin/users/{user_id}/push-test", status_code=204)
def send_push_test(
    user_id: str,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if not os.environ.get("VAPID_PRIVATE_KEY") or not os.environ.get("VAPID_SUBJECT"):
        raise HTTPException(status_code=503, detail="Push not configured")
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    send_test_push_to_user(db, user_id)
    return Response(status_code=204)
```

- [ ] **Schritt 5: Alle Tests laufen lassen — müssen PASS sein**

```bash
pytest tests/ -x
```

Erwartetes Ergebnis: alle Tests pass.

- [ ] **Schritt 6: Commit**

```bash
git add backend/api/admin.py tests/backend/test_api_admin.py
git commit -m "feat: add POST /admin/users/{id}/push-test endpoint"
```

---

## Task 5: Frontend — Typ, API-Funktion, Push-Button

**Files:**
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/api/users.ts`
- Modify: `frontend/src/components/UserManagementSection.tsx`

- [ ] **Schritt 1: `UserRecord` in `frontend/src/types.ts` erweitern**

In `frontend/src/types.ts`, `UserRecord`-Interface (Zeile 42) um `push_subscription_count` ergänzen:

```typescript
export interface UserRecord {
  id: string
  email: string
  active: boolean
  role: string
  job_count: number
  active_job_count: number
  max_active_jobs: number | null
  created_at: string
  push_subscription_count: number
}
```

- [ ] **Schritt 2: `sendTestPush` in `frontend/src/api/users.ts` hinzufügen**

Am Ende der Datei `frontend/src/api/users.ts` anfügen:

```typescript
export async function sendTestPush(userId: string): Promise<void> {
  await apiFetch(`/api/admin/users/${userId}/push-test`, { method: 'POST' })
}
```

- [ ] **Schritt 3: TypeScript-Build prüfen**

```bash
cd frontend && npm run build 2>&1 | tail -20
```

Erwartetes Ergebnis: kein Fehler (oder nur bekannte Warnings).

- [ ] **Schritt 4: State und Handler in `UserManagementSection.tsx` hinzufügen**

Import-Zeile (Zeile 2) erweitern — `sendTestPush` hinzufügen:

```typescript
import { listUsers, setUserActive, setUserLimit, sendUserMessage, sendTestPush } from '../api/users'
```

Nach dem bestehenden `messageSent`-State (Zeile 25) zwei neue States hinzufügen:

```typescript
  const [pushingUserId, setPushingUserId] = useState<string | null>(null)
  const [pushSuccessUserId, setPushSuccessUserId] = useState<string | null>(null)
```

Nach der `handleSendMessage`-Funktion (nach Zeile 125) den neuen Handler einfügen:

```typescript
  async function handleSendTestPush(userId: string) {
    setPushingUserId(userId)
    try {
      await sendTestPush(userId)
      setPushSuccessUserId(userId)
      setTimeout(() => setPushSuccessUserId(null), 2000)
    } catch {
      // Admin-Werkzeug: kein UI-Fehler
    } finally {
      setPushingUserId(null)
    }
  }
```

- [ ] **Schritt 5: Push-Button in die User-Card einfügen**

In der Button-Gruppe (bei Zeile 238, direkt vor dem „Nachricht"-Button):

```tsx
                <div className="flex items-center gap-2">
                  <Button
                    variant="slate"
                    size="sm"
                    aria-label="Test-Push senden"
                    disabled={user.push_subscription_count === 0 || pushingUserId === user.id}
                    title={user.push_subscription_count === 0 ? 'Kein Gerät registriert' : undefined}
                    onClick={() => handleSendTestPush(user.id)}
                  >
                    {pushSuccessUserId === user.id ? (
                      <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 0 1 0 1.414l-8 8a1 1 0 0 1-1.414 0l-4-4a1 1 0 0 1 1.414-1.414L8 12.586l7.293-7.293a1 1 0 0 1 1.414 0z" clipRule="evenodd"/>
                      </svg>
                    ) : (
                      <>
                        <svg className="sm:hidden w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M10 2a6 6 0 0 0-6 6v3.586l-.707.707A1 1 0 0 0 4 14h12a1 1 0 0 0 .707-1.707L16 11.586V8a6 6 0 0 0-6-6zm0 16a2 2 0 0 1-2-2h4a2 2 0 0 1-2 2z"/>
                        </svg>
                        <span className="hidden sm:inline">Push</span>
                      </>
                    )}
                  </Button>
                  <Button
                    variant="slate"
                    size="sm"
                    aria-label="Nachricht senden"
                    onClick={() => openMessageModal(user)}
                  >
```

Der Rest der Zeile (SVG + span) und alle folgenden Buttons bleiben unverändert. Den schließenden `</div>`-Tag der `flex items-center gap-2`-Gruppe nicht vergessen.

- [ ] **Schritt 6: TypeScript-Kompilierung und Lint prüfen**

```bash
cd frontend && npm run build 2>&1 | tail -20
```

Erwartetes Ergebnis: keine Fehler.

- [ ] **Schritt 7: Alle Backend-Tests laufen lassen**

```bash
pytest tests/ -x
```

Erwartetes Ergebnis: alle Tests pass.

- [ ] **Schritt 8: Manuell im Browser testen**

1. Backend starten:
   ```bash
   DATABASE_URL=sqlite:///eversports.db JWT_SECRET=test-secret \
     ENCRYPTION_KEY=$(python -c 'import os; print(os.urandom(32).hex())') \
     FRONTEND_URL=http://localhost:5173 \
     uvicorn backend.main:app --reload
   ```
2. Frontend starten:
   ```bash
   cd frontend && npm run dev
   ```
3. Als Admin einloggen → User-Verwaltung öffnen.
4. Prüfen: User ohne Push-Subscription → Button ausgegraut, Tooltip „Kein Gerät registriert".
5. Prüfen: User mit Push-Subscription → Button klickbar, nach Klick erscheint ✓ für 2 Sekunden.

- [ ] **Schritt 9: Commit**

```bash
git add frontend/src/types.ts frontend/src/api/users.ts frontend/src/components/UserManagementSection.tsx
git commit -m "feat: add push-test button to admin user card"
```
