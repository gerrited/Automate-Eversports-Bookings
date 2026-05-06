# Push-Benachrichtigungen vor Terminen — Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nutzer erhalten eine Web-Push-Notification auf ihrem Gerät X Minuten vor einem gebuchten Termin — auch ohne geöffnete App.

**Architecture:** Der Worker (K8s CronJob, alle 15 Min.) prüft für jeden User mit Push-Subscription, ob ein Eversports-Termin in das Benachrichtigungsfenster `[now, now+15min)` fällt, und sendet via pywebpush eine Web-Push-Nachricht. Der Browser-Service-Worker empfängt sie und zeigt eine OS-Notification. Die Vorlaufzeit ist per `PUT /api/account` einstellbar.

**Tech Stack:** pywebpush (Python), Web Push API + Service Worker (Browser), SQLAlchemy, Alembic, React/TypeScript, Vitest

---

## Dateiübersicht

**Neu erstellen:**
- `backend/models/push_subscription.py` — SQLAlchemy-Model PushSubscription
- `backend/schemas/push.py` — Pydantic-Schemas für Push-Endpoints
- `backend/api/push.py` — Router: VAPID-Key, subscribe, unsubscribe
- `backend/alembic/versions/a1b2c3d4e5f6_add_push_notifications.py` — Migration
- `worker/notifications.py` — send_push_notifications(), format_advance_time()
- `frontend/public/sw.js` — Service Worker
- `frontend/src/hooks/usePushNotifications.ts` — Hook
- `frontend/src/api/push.ts` — Frontend-API-Layer für Push
- `tests/backend/test_api_push.py` — Tests für Push-Endpoints
- `tests/worker/test_notifications.py` — Tests für Worker-Notification-Logik

**Modifizieren:**
- `requirements-backend.txt` — pywebpush hinzufügen
- `backend/models/user.py` — notification_advance_minutes Spalte
- `backend/models/__init__.py` — PushSubscription importieren
- `backend/schemas/user.py` — MeResponse + UpdateAccountRequest erweitern
- `backend/api/account.py` — PUT /api/account hinzufügen
- `backend/main.py` — push-Router registrieren
- `worker/worker.py` — Notification-Block in run() integrieren
- `frontend/src/types.ts` — CurrentUser erweitern
- `frontend/src/api/account.ts` — updateAccount() hinzufügen
- `frontend/src/components/SettingsModal.tsx` — Terminerinnerung-Abschnitt
- `frontend/src/pages/DashboardPage.tsx` — usePushNotifications aufrufen

---

## Task 1: pywebpush-Abhängigkeit + VAPID-Schlüssel

**Files:**
- Modify: `requirements-backend.txt`

- [ ] **Step 1: pywebpush hinzufügen**

  Zeile am Ende von `requirements-backend.txt` anhängen:
  ```
  pywebpush==2.0.0
  ```

- [ ] **Step 2: Abhängigkeit installieren**

  ```bash
  pip install pywebpush==2.0.0
  ```
  Expected: Successfully installed pywebpush-2.0.0 (und py-vapid, http-ece als transitive Deps)

- [ ] **Step 3: VAPID-Schlüsselpaar generieren**

  ```bash
  python -c "
  from cryptography.hazmat.primitives.asymmetric import ec
  from cryptography.hazmat.primitives.serialization import (
      Encoding, PublicFormat, PrivateFormat, NoEncryption
  )
  from cryptography.hazmat.backends import default_backend
  import base64

  private_key = ec.generate_private_key(ec.SECP256R1(), default_backend())
  public_key = private_key.public_key()

  private_pem = private_key.private_bytes(
      Encoding.PEM, PrivateFormat.TraditionalOpenSSL, NoEncryption()
  ).decode()
  public_bytes = public_key.public_bytes(Encoding.X962, PublicFormat.UncompressedPoint)
  public_b64 = base64.urlsafe_b64encode(public_bytes).rstrip(b'=').decode()

  print('VAPID_PRIVATE_KEY (PEM, mehrzeilig):')
  print(private_pem)
  print('VAPID_PUBLIC_KEY (base64url):')
  print(public_b64)
  "
  ```

  Die ausgegebenen Werte als Umgebungsvariablen setzen:
  - `VAPID_PRIVATE_KEY` = vollständiger PEM-String (mit Zeilenumbrüchen)
  - `VAPID_PUBLIC_KEY` = base64url-String (einzeilig)
  - `VAPID_SUBJECT` = `mailto:ged@amagno.de`

  **Wichtig für lokale Entwicklung:** In der Shell mit `export` oder in `.env`-Datei (PEM-Zeilenumbrüche durch `\n` ersetzen und mit `$'...'`-Syntax exportieren).

- [ ] **Step 4: Commit**

  ```bash
  git add requirements-backend.txt
  git commit -m "feat: add pywebpush dependency"
  ```

---

## Task 2: Datenbank-Migration

**Files:**
- Create: `backend/alembic/versions/a1b2c3d4e5f6_add_push_notifications.py`

- [ ] **Step 1: Migrationsdatei anlegen**

  Datei `backend/alembic/versions/a1b2c3d4e5f6_add_push_notifications.py` erstellen:

  ```python
  """add_push_notifications

  Revision ID: a1b2c3d4e5f6
  Revises: f90336fd45b8
  Create Date: 2026-05-06 00:00:00.000000

  """
  from typing import Sequence, Union

  from alembic import op
  import sqlalchemy as sa


  revision: str = 'a1b2c3d4e5f6'
  down_revision: Union[str, None] = 'f90336fd45b8'
  branch_labels: Union[str, Sequence[str], None] = None
  depends_on: Union[str, Sequence[str], None] = None


  def upgrade() -> None:
      op.add_column(
          'users',
          sa.Column('notification_advance_minutes', sa.Integer(), nullable=False, server_default='60'),
      )
      op.create_table(
          'push_subscriptions',
          sa.Column('id', sa.String(), nullable=False),
          sa.Column('user_id', sa.String(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
          sa.Column('endpoint', sa.String(), nullable=False),
          sa.Column('p256dh', sa.String(), nullable=False),
          sa.Column('auth', sa.String(), nullable=False),
          sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
          sa.PrimaryKeyConstraint('id'),
          sa.UniqueConstraint('endpoint'),
      )
      op.create_index('ix_push_subscriptions_user_id', 'push_subscriptions', ['user_id'])


  def downgrade() -> None:
      op.drop_index('ix_push_subscriptions_user_id', table_name='push_subscriptions')
      op.drop_table('push_subscriptions')
      op.drop_column('users', 'notification_advance_minutes')
  ```

- [ ] **Step 2: Migration ausführen**

  ```bash
  DATABASE_URL=sqlite:///eversports.db \
    alembic -c backend/alembic.ini upgrade head
  ```
  Expected: `Running upgrade f90336fd45b8 -> a1b2c3d4e5f6, add_push_notifications`

- [ ] **Step 3: Stand prüfen**

  ```bash
  DATABASE_URL=sqlite:///eversports.db \
    alembic -c backend/alembic.ini current
  ```
  Expected: `a1b2c3d4e5f6 (head)`

- [ ] **Step 4: Commit**

  ```bash
  git add backend/alembic/versions/a1b2c3d4e5f6_add_push_notifications.py
  git commit -m "feat: migration for push_subscriptions table and notification_advance_minutes"
  ```

---

## Task 3: SQLAlchemy-Models

**Files:**
- Create: `backend/models/push_subscription.py`
- Modify: `backend/models/user.py`
- Modify: `backend/models/__init__.py`

- [ ] **Step 1: PushSubscription-Model erstellen**

  Datei `backend/models/push_subscription.py`:

  ```python
  import uuid
  from datetime import datetime, timezone
  from sqlalchemy import Column, String, DateTime, ForeignKey, UniqueConstraint, Index
  from sqlalchemy.orm import relationship
  from backend.db import Base


  class PushSubscription(Base):
      __tablename__ = "push_subscriptions"

      id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
      user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
      endpoint = Column(String, nullable=False, unique=True)
      p256dh = Column(String, nullable=False)
      auth = Column(String, nullable=False)
      created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

      user = relationship("User", back_populates="push_subscriptions")

      __table_args__ = (
          Index("ix_push_subscriptions_user_id", "user_id"),
      )
  ```

- [ ] **Step 2: User-Model um notification_advance_minutes und push_subscriptions erweitern**

  In `backend/models/user.py` die Imports ergänzen und zwei Zeilen hinzufügen:

  Vorher:
  ```python
  from sqlalchemy import Column, String, DateTime, Boolean, Integer
  ```
  Nachher (unverändert, Integer ist bereits importiert).

  In der Klasse nach `created_at`:
  ```python
      notification_advance_minutes = Column(Integer, nullable=False, server_default="60", default=60)
  ```

  Und nach `jobs = relationship(...)`:
  ```python
      push_subscriptions = relationship("PushSubscription", back_populates="user", cascade="all, delete-orphan")
  ```

- [ ] **Step 3: __init__.py aktualisieren**

  `backend/models/__init__.py` ersetzen:

  ```python
  from .user import User
  from .booking_job import BookingJob
  from .booking_log import BookingLog
  from .push_subscription import PushSubscription

  __all__ = ["User", "BookingJob", "BookingLog", "PushSubscription"]
  ```

- [ ] **Step 4: Commit**

  ```bash
  git add backend/models/push_subscription.py backend/models/user.py backend/models/__init__.py
  git commit -m "feat: add PushSubscription model and notification_advance_minutes to User"
  ```

---

## Task 4: Backend-Schemas

**Files:**
- Create: `backend/schemas/push.py`
- Modify: `backend/schemas/user.py`

- [ ] **Step 1: Push-Schemas erstellen**

  Datei `backend/schemas/push.py`:

  ```python
  from pydantic import BaseModel


  class VapidPublicKeyResponse(BaseModel):
      public_key: str


  class SubscribeRequest(BaseModel):
      endpoint: str
      p256dh: str
      auth: str


  class UnsubscribeRequest(BaseModel):
      endpoint: str
  ```

- [ ] **Step 2: MeResponse und UpdateAccountRequest in user.py erweitern**

  In `backend/schemas/user.py` `MeResponse` um das neue Feld ergänzen:

  ```python
  class MeResponse(BaseModel):
      total_bookings_executed: int
      max_active_jobs: Optional[int] = None
      notification_advance_minutes: int = 60

      model_config = {"from_attributes": True}
  ```

  Und eine neue Klasse am Ende der Datei hinzufügen:

  ```python
  class UpdateAccountRequest(BaseModel):
      notification_advance_minutes: Optional[int] = Field(default=None, ge=15, le=1440)
  ```

  Außerdem `Field` zu den Imports hinzufügen (ist bereits vorhanden).

- [ ] **Step 3: Commit**

  ```bash
  git add backend/schemas/push.py backend/schemas/user.py
  git commit -m "feat: add push schemas and UpdateAccountRequest"
  ```

---

## Task 5: Backend Push-Router

**Files:**
- Create: `backend/api/push.py`
- Modify: `backend/main.py`
- Create: `tests/backend/test_api_push.py`

- [ ] **Step 1: Failing tests schreiben**

  Datei `tests/backend/test_api_push.py`:

  ```python
  import os
  from backend.core.auth import create_access_token
  from backend.models.user import User
  from backend.models.push_subscription import PushSubscription


  def _auth(user_id: str) -> dict:
      return {"Authorization": f"Bearer {create_access_token(user_id)}"}


  def _user(db, email="u@example.com") -> User:
      u = User(eversports_user_id="ev-1", email=email, encrypted_password="x", active=True)
      db.add(u)
      db.commit()
      db.refresh(u)
      return u


  def test_vapid_public_key_returns_key(client):
      os.environ["VAPID_PUBLIC_KEY"] = "test-public-key"
      resp = client.get("/api/push/vapid-public-key")
      assert resp.status_code == 200
      assert resp.json()["public_key"] == "test-public-key"


  def test_subscribe_creates_subscription(client, db_session):
      user = _user(db_session)
      resp = client.post(
          "/api/push/subscribe",
          json={"endpoint": "https://example.com/push/1", "p256dh": "key1", "auth": "auth1"},
          headers=_auth(user.id),
      )
      assert resp.status_code == 204
      sub = db_session.query(PushSubscription).filter_by(endpoint="https://example.com/push/1").first()
      assert sub is not None
      assert sub.user_id == user.id


  def test_subscribe_upserts_existing_endpoint(client, db_session):
      user = _user(db_session)
      for _ in range(2):
          client.post(
              "/api/push/subscribe",
              json={"endpoint": "https://example.com/push/1", "p256dh": "key1", "auth": "auth1"},
              headers=_auth(user.id),
          )
      count = db_session.query(PushSubscription).filter_by(endpoint="https://example.com/push/1").count()
      assert count == 1


  def test_subscribe_requires_auth(client):
      resp = client.post(
          "/api/push/subscribe",
          json={"endpoint": "https://example.com/push/1", "p256dh": "k", "auth": "a"},
      )
      assert resp.status_code == 401


  def test_unsubscribe_removes_subscription(client, db_session):
      user = _user(db_session)
      sub = PushSubscription(user_id=user.id, endpoint="https://example.com/push/2", p256dh="k", auth="a")
      db_session.add(sub)
      db_session.commit()

      resp = client.request(
          "DELETE",
          "/api/push/subscribe",
          json={"endpoint": "https://example.com/push/2"},
          headers=_auth(user.id),
      )
      assert resp.status_code == 204
      assert db_session.query(PushSubscription).filter_by(endpoint="https://example.com/push/2").first() is None


  def test_unsubscribe_nonexistent_returns_204(client, db_session):
      user = _user(db_session)
      resp = client.request(
          "DELETE",
          "/api/push/subscribe",
          json={"endpoint": "https://example.com/push/999"},
          headers=_auth(user.id),
      )
      assert resp.status_code == 204
  ```

- [ ] **Step 2: Tests fehlschlagen lassen**

  ```bash
  pytest tests/backend/test_api_push.py -v
  ```
  Expected: ERRORS (ImportError oder 404)

- [ ] **Step 3: Push-Router implementieren**

  Datei `backend/api/push.py`:

  ```python
  import os

  from fastapi import APIRouter, Depends, Response
  from sqlalchemy.orm import Session

  from backend.api.deps import get_current_active_user
  from backend.db import get_db
  from backend.models.push_subscription import PushSubscription
  from backend.models.user import User
  from backend.schemas.push import VapidPublicKeyResponse, SubscribeRequest, UnsubscribeRequest

  router = APIRouter()


  @router.get("/push/vapid-public-key", response_model=VapidPublicKeyResponse)
  def get_vapid_public_key():
      return {"public_key": os.environ.get("VAPID_PUBLIC_KEY", "")}


  @router.post("/push/subscribe", status_code=204)
  def subscribe(
      body: SubscribeRequest,
      current_user: User = Depends(get_current_active_user),
      db: Session = Depends(get_db),
  ):
      existing = db.query(PushSubscription).filter_by(endpoint=body.endpoint).first()
      if existing:
          existing.p256dh = body.p256dh
          existing.auth = body.auth
      else:
          db.add(PushSubscription(
              user_id=current_user.id,
              endpoint=body.endpoint,
              p256dh=body.p256dh,
              auth=body.auth,
          ))
      db.commit()
      return Response(status_code=204)


  @router.delete("/push/subscribe", status_code=204)
  def unsubscribe(
      body: UnsubscribeRequest,
      current_user: User = Depends(get_current_active_user),
      db: Session = Depends(get_db),
  ):
      db.query(PushSubscription).filter_by(
          endpoint=body.endpoint, user_id=current_user.id
      ).delete()
      db.commit()
      return Response(status_code=204)
  ```

- [ ] **Step 4: Router in main.py registrieren**

  In `backend/main.py` import ergänzen:
  ```python
  from backend.api import auth, jobs, admin, facilities, account, bookings, push
  ```

  Und am Ende:
  ```python
  app.include_router(push.router, prefix="/api")
  ```

- [ ] **Step 5: Tests bestehen lassen**

  ```bash
  pytest tests/backend/test_api_push.py -v
  ```
  Expected: 6 passed

- [ ] **Step 6: Commit**

  ```bash
  git add backend/api/push.py backend/main.py tests/backend/test_api_push.py
  git commit -m "feat: add push subscription API endpoints"
  ```

---

## Task 6: Account-API erweitern

**Files:**
- Modify: `backend/api/account.py`
- Modify: `tests/backend/test_api_account.py`

- [ ] **Step 1: Failing tests schreiben**

  Am Ende von `tests/backend/test_api_account.py` hinzufügen:

  ```python
  def test_get_me_includes_notification_advance_minutes(client, db_session):
      user = _create_active_user(db_session)
      resp = client.get("/api/me", headers=_auth_header(user.id))
      assert resp.status_code == 200
      assert resp.json()["notification_advance_minutes"] == 60


  def test_put_account_updates_notification_advance_minutes(client, db_session):
      user = _create_active_user(db_session)
      resp = client.put(
          "/api/account",
          json={"notification_advance_minutes": 30},
          headers=_auth_header(user.id),
      )
      assert resp.status_code == 200
      assert resp.json()["notification_advance_minutes"] == 30


  def test_put_account_rejects_value_below_15(client, db_session):
      user = _create_active_user(db_session)
      resp = client.put(
          "/api/account",
          json={"notification_advance_minutes": 10},
          headers=_auth_header(user.id),
      )
      assert resp.status_code == 422


  def test_put_account_rejects_value_above_1440(client, db_session):
      user = _create_active_user(db_session)
      resp = client.put(
          "/api/account",
          json={"notification_advance_minutes": 1500},
          headers=_auth_header(user.id),
      )
      assert resp.status_code == 422


  def test_put_account_requires_auth(client):
      resp = client.put("/api/account", json={"notification_advance_minutes": 30})
      assert resp.status_code == 401
  ```

- [ ] **Step 2: Tests fehlschlagen lassen**

  ```bash
  pytest tests/backend/test_api_account.py::test_get_me_includes_notification_advance_minutes \
         tests/backend/test_api_account.py::test_put_account_updates_notification_advance_minutes -v
  ```
  Expected: FAILED

- [ ] **Step 3: Account-API implementieren**

  `backend/api/account.py` ersetzen:

  ```python
  from fastapi import APIRouter, Depends, Response
  from sqlalchemy.orm import Session

  from backend.api.deps import get_current_active_user
  from backend.db import get_db
  from backend.models.user import User
  from backend.schemas.user import MeResponse, UpdateAccountRequest

  router = APIRouter()


  @router.get("/me", response_model=MeResponse)
  def get_me(current_user: User = Depends(get_current_active_user)):
      return current_user


  @router.put("/account", response_model=MeResponse)
  def update_account(
      body: UpdateAccountRequest,
      current_user: User = Depends(get_current_active_user),
      db: Session = Depends(get_db),
  ):
      if body.notification_advance_minutes is not None:
          current_user.notification_advance_minutes = body.notification_advance_minutes
      db.commit()
      db.refresh(current_user)
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

- [ ] **Step 4: Tests bestehen lassen**

  ```bash
  pytest tests/backend/test_api_account.py -v
  ```
  Expected: alle passed

- [ ] **Step 5: Commit**

  ```bash
  git add backend/api/account.py tests/backend/test_api_account.py
  git commit -m "feat: extend account API with notification_advance_minutes"
  ```

---

## Task 7: Frontend — Typen und API-Layer

**Files:**
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/api/account.ts`
- Create: `frontend/src/api/push.ts`

- [ ] **Step 1: CurrentUser in types.ts erweitern**

  In `frontend/src/types.ts` das Interface `CurrentUser` ersetzen:

  ```typescript
  export interface CurrentUser {
    total_bookings_executed: number
    max_active_jobs: number | null
    notification_advance_minutes: number
  }
  ```

- [ ] **Step 2: account.ts erweitern**

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

  export function updateAccount(data: { notification_advance_minutes?: number }): Promise<CurrentUser> {
    return apiFetch<CurrentUser>('/api/account', {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }
  ```

- [ ] **Step 3: push.ts erstellen**

  Datei `frontend/src/api/push.ts`:

  ```typescript
  import { apiFetch } from './client'

  export function getVapidPublicKey(): Promise<{ public_key: string }> {
    return apiFetch<{ public_key: string }>('/api/push/vapid-public-key')
  }

  export function registerSubscription(sub: {
    endpoint: string
    p256dh: string
    auth: string
  }): Promise<void> {
    return apiFetch<void>('/api/push/subscribe', {
      method: 'POST',
      body: JSON.stringify(sub),
    })
  }

  export function unregisterSubscription(endpoint: string): Promise<void> {
    return apiFetch<void>('/api/push/subscribe', {
      method: 'DELETE',
      body: JSON.stringify({ endpoint }),
    })
  }
  ```

- [ ] **Step 4: TypeScript-Check**

  ```bash
  cd frontend && npx tsc --noEmit
  ```
  Expected: keine Fehler

- [ ] **Step 5: Commit**

  ```bash
  git add frontend/src/types.ts frontend/src/api/account.ts frontend/src/api/push.ts
  git commit -m "feat: extend frontend types and API layer for push notifications"
  ```

---

## Task 8: Service Worker

**Files:**
- Create: `frontend/public/sw.js`

- [ ] **Step 1: Service Worker erstellen**

  Datei `frontend/public/sw.js`:

  ```javascript
  self.addEventListener('push', (event) => {
    if (!event.data) return
    const { title, body } = event.data.json()
    event.waitUntil(
      self.registration.showNotification(title, {
        body,
        icon: '/web-app-manifest-192x192.png',
        badge: '/favicon-96x96.png',
      })
    )
  })

  self.addEventListener('notificationclick', (event) => {
    event.notification.close()
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        for (const client of clientList) {
          if ('focus' in client) return client.focus()
        }
        return clients.openWindow('/')
      })
    )
  })
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add frontend/public/sw.js
  git commit -m "feat: add service worker for push notifications"
  ```

---

## Task 9: usePushNotifications Hook

**Files:**
- Create: `frontend/src/hooks/usePushNotifications.ts`

- [ ] **Step 1: Hook erstellen**

  Datei `frontend/src/hooks/usePushNotifications.ts`:

  ```typescript
  import { useEffect } from 'react'
  import { getVapidPublicKey, registerSubscription } from '../api/push'

  function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
    const rawData = atob(base64)
    return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)))
  }

  export function usePushNotifications(): void {
    useEffect(() => {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return

      async function setup() {
        try {
          const registration = await navigator.serviceWorker.register('/sw.js')
          const { public_key } = await getVapidPublicKey()
          const permission = await Notification.requestPermission()
          if (permission !== 'granted') return

          const existing = await registration.pushManager.getSubscription()
          if (existing) {
            await sendSubscription(existing)
            return
          }

          const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(public_key),
          })
          await sendSubscription(subscription)
        } catch {
          // Fehler still ignorieren
        }
      }

      function sendSubscription(sub: PushSubscription) {
        const json = sub.toJSON()
        const keys = json.keys ?? {}
        return registerSubscription({
          endpoint: sub.endpoint,
          p256dh: keys['p256dh'] ?? '',
          auth: keys['auth'] ?? '',
        })
      }

      setup()
    }, [])
  }
  ```

- [ ] **Step 2: TypeScript-Check**

  ```bash
  cd frontend && npx tsc --noEmit
  ```
  Expected: keine Fehler

- [ ] **Step 3: Commit**

  ```bash
  git add frontend/src/hooks/usePushNotifications.ts
  git commit -m "feat: add usePushNotifications hook"
  ```

---

## Task 10: SettingsModal — Terminerinnerung-Abschnitt

**Files:**
- Modify: `frontend/src/components/SettingsModal.tsx`
- Modify: `frontend/src/components/SettingsModal.test.tsx`

- [ ] **Step 1: Failing tests schreiben**

  Folgenden Block am Ende der `describe('SettingsModal', ...)` in `SettingsModal.test.tsx` hinzufügen:

  Zuerst Mocks erweitern — `vi.mock('../api/account', ...)` ersetzen:
  ```typescript
  vi.mock('../api/account', () => ({
    deleteAccount: vi.fn(),
    getMe: vi.fn().mockResolvedValue({
      total_bookings_executed: 0,
      max_active_jobs: null,
      notification_advance_minutes: 60,
    }),
    updateAccount: vi.fn().mockResolvedValue({
      total_bookings_executed: 0,
      max_active_jobs: null,
      notification_advance_minutes: 30,
    }),
  }))
  ```

  Neue Tests in der `describe`-Gruppe:
  ```typescript
  it('renders notification advance minutes field', async () => {
    renderModal()
    expect(await screen.findByLabelText('Minuten vor dem Termin')).toBeInTheDocument()
  })

  it('loads current notification_advance_minutes from API', async () => {
    renderModal()
    const input = await screen.findByLabelText('Minuten vor dem Termin') as HTMLInputElement
    expect(input.value).toBe('60')
  })

  it('saves notification_advance_minutes on submit', async () => {
    const { updateAccount } = await import('../api/account')
    renderModal()
    const input = await screen.findByLabelText('Minuten vor dem Termin')
    fireEvent.change(input, { target: { value: '30' } })
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }))
    await waitFor(() => {
      expect(updateAccount).toHaveBeenCalledWith({ notification_advance_minutes: 30 })
    })
  })
  ```

- [ ] **Step 2: Tests fehlschlagen lassen**

  ```bash
  cd frontend && npm test -- SettingsModal --run
  ```
  Expected: neue Tests FAILED

- [ ] **Step 3: SettingsModal implementieren**

  `frontend/src/components/SettingsModal.tsx` ersetzen:

  ```typescript
  import { useState, useEffect } from 'react'
  import { useNavigate } from 'react-router-dom'
  import { clearToken } from '../api/client'
  import { deleteAccount, getMe, updateAccount } from '../api/account'

  interface Props {
    onClose: () => void
  }

  export default function SettingsModal({ onClose }: Props) {
    const navigate = useNavigate()
    const [confirmText, setConfirmText] = useState('')
    const [deleteLoading, setDeleteLoading] = useState(false)
    const [deleteError, setDeleteError] = useState<string | null>(null)

    const [advanceMinutes, setAdvanceMinutes] = useState<number>(60)
    const [saveLoading, setSaveLoading] = useState(false)
    const [saveError, setSaveError] = useState<string | null>(null)
    const [saveSuccess, setSaveSuccess] = useState(false)
    const notificationsSupported =
      typeof Notification !== 'undefined' && 'serviceWorker' in navigator

    useEffect(() => {
      getMe().then((me) => setAdvanceMinutes(me.notification_advance_minutes)).catch(() => {})
    }, [])

    async function handleSave() {
      setSaveLoading(true)
      setSaveError(null)
      setSaveSuccess(false)
      try {
        await updateAccount({ notification_advance_minutes: advanceMinutes })
        setSaveSuccess(true)
        setTimeout(() => setSaveSuccess(false), 3000)
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : 'Fehler beim Speichern.')
      } finally {
        setSaveLoading(false)
      }
    }

    async function handleDelete() {
      setDeleteLoading(true)
      setDeleteError(null)
      try {
        await deleteAccount()
        clearToken()
        navigate('/')
      } catch (err) {
        setDeleteError(err instanceof Error ? err.message : 'Fehler beim Löschen des Kontos.')
        setDeleteLoading(false)
      }
    }

    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
        <div className="bg-surface-card rounded-xl w-full max-w-md p-6">
          <div className="flex justify-between items-center mb-5">
            <h2 className="text-white font-bold text-lg">Einstellungen</h2>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white transition-colors text-xl leading-none"
              aria-label="Schließen"
            >
              ✕
            </button>
          </div>

          {/* Terminerinnerung */}
          <div className="border-t border-slate-700 pt-5 mb-5">
            <h3 className="text-white font-semibold mb-2">Terminerinnerung</h3>
            {notificationsSupported ? (
              <>
                <label className="flex flex-col gap-1 mb-4">
                  <span className="text-slate-400 text-sm">Minuten vor dem Termin</span>
                  <input
                    aria-label="Minuten vor dem Termin"
                    type="number"
                    min={15}
                    max={1440}
                    value={advanceMinutes}
                    onChange={(e) => setAdvanceMinutes(Number(e.target.value))}
                    className="bg-surface-input text-white rounded-lg px-3 py-2 outline-hidden focus:ring-2 focus:ring-blue-500 w-32"
                  />
                </label>
                {saveError && <p className="text-red-400 text-sm mb-3">{saveError}</p>}
                {saveSuccess && <p className="text-green-400 text-sm mb-3">Gespeichert.</p>}
                <button
                  onClick={handleSave}
                  disabled={saveLoading || advanceMinutes < 15 || advanceMinutes > 1440}
                  className="px-4 py-2 bg-blue-700 hover:bg-blue-600 text-white font-semibold rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {saveLoading ? 'Wird gespeichert…' : 'Speichern'}
                </button>
              </>
            ) : (
              <p className="text-slate-400 text-sm">
                Dein Browser unterstützt keine Push-Benachrichtigungen.
              </p>
            )}
          </div>

          {/* Konto löschen */}
          <div className="border-t border-slate-700 pt-5">
            <h3 className="text-white font-semibold mb-2">Konto löschen</h3>
            <p className="text-red-400 text-sm mb-4">
              Diese Aktion ist unwiderruflich. Dein Konto bei FOReversports und alle geplanten Buchungen werden dauerhaft gelöscht.
            </p>

            <label className="flex flex-col gap-1 mb-4">
              <span className="text-slate-400 text-sm">
                Zur Bestätigung <span className="font-mono text-slate-200">DELETE</span> eingeben
              </span>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="DELETE"
                className="bg-surface-input text-white rounded-lg px-3 py-2 outline-hidden focus:ring-2 focus:ring-red-500 font-mono"
              />
            </label>

            {deleteError && <p className="text-red-400 text-sm mb-3">{deleteError}</p>}

            <button
              onClick={handleDelete}
              disabled={confirmText !== 'DELETE' || deleteLoading}
              className="w-full py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {deleteLoading ? 'Wird gelöscht…' : 'Konto löschen'}
            </button>
          </div>
        </div>
      </div>
    )
  }
  ```

- [ ] **Step 4: Tests bestehen lassen**

  ```bash
  cd frontend && npm test -- SettingsModal --run
  ```
  Expected: alle passed

- [ ] **Step 5: Commit**

  ```bash
  git add frontend/src/components/SettingsModal.tsx frontend/src/components/SettingsModal.test.tsx
  git commit -m "feat: add notification advance minutes setting to SettingsModal"
  ```

---

## Task 11: DashboardPage — Hook verdrahten

**Files:**
- Modify: `frontend/src/pages/DashboardPage.tsx`

- [ ] **Step 1: Hook importieren und aufrufen**

  In `frontend/src/pages/DashboardPage.tsx` den Import hinzufügen — nach den bestehenden Imports:
  ```typescript
  import { usePushNotifications } from '../hooks/usePushNotifications'
  ```

  Direkt im Funktionskörper von `DashboardPage`, nach den `useState`-Deklarationen:
  ```typescript
  usePushNotifications()
  ```

- [ ] **Step 2: TypeScript-Check**

  ```bash
  cd frontend && npx tsc --noEmit
  ```
  Expected: keine Fehler

- [ ] **Step 3: Frontend-Tests laufen lassen**

  ```bash
  cd frontend && npm test --run
  ```
  Expected: alle passed

- [ ] **Step 4: Commit**

  ```bash
  git add frontend/src/pages/DashboardPage.tsx
  git commit -m "feat: wire up usePushNotifications hook in DashboardPage"
  ```

---

## Task 12: Worker — Notifications-Modul

**Files:**
- Create: `worker/notifications.py`
- Create: `tests/worker/test_notifications.py`

- [ ] **Step 1: Failing tests schreiben**

  Datei `tests/worker/test_notifications.py`:

  ```python
  import json
  import os
  from datetime import datetime, timezone, timedelta
  from unittest.mock import patch, MagicMock

  import pytest
  from sqlalchemy import create_engine
  from sqlalchemy.orm import sessionmaker
  from sqlalchemy.pool import StaticPool

  os.environ.setdefault("VAPID_PRIVATE_KEY", "test-private-key")
  os.environ.setdefault("VAPID_PUBLIC_KEY", "test-public-key")
  os.environ.setdefault("VAPID_SUBJECT", "mailto:test@example.com")

  from backend.db import Base
  from backend.models.user import User
  from backend.models.push_subscription import PushSubscription
  from worker.notifications import format_advance_time, send_push_notifications


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


  # --- format_advance_time ---

  def test_format_advance_time_hours_and_minutes():
      assert format_advance_time(90) == "1 Stunde 30 Minuten"


  def test_format_advance_time_exact_hours():
      assert format_advance_time(120) == "2 Stunden"


  def test_format_advance_time_one_hour():
      assert format_advance_time(60) == "1 Stunde"


  def test_format_advance_time_minutes_only():
      assert format_advance_time(30) == "30 Minuten"


  def test_format_advance_time_one_minute():
      assert format_advance_time(1) == "1 Minute"


  # --- send_push_notifications ---

  def _make_user(db, advance=60) -> User:
      u = User(
          eversports_user_id="ev-1",
          email="u@example.com",
          encrypted_password="enc",
          active=True,
          notification_advance_minutes=advance,
      )
      db.add(u)
      db.commit()
      db.refresh(u)
      return u


  def _make_subscription(db, user_id: str) -> PushSubscription:
      sub = PushSubscription(
          user_id=user_id,
          endpoint="https://push.example.com/1",
          p256dh="p256dh_key",
          auth="auth_key",
      )
      db.add(sub)
      db.commit()
      return sub


  def test_sends_notification_when_booking_in_window(db_session):
      user = _make_user(db_session, advance=60)
      _make_subscription(db_session, user.id)

      now = datetime(2026, 5, 6, 9, 0, tzinfo=timezone.utc)
      # start_datetime in 60 min = 10:00 → notification_time = 09:00 → im Fenster [09:00, 09:15)
      bookings = [{"start_datetime": "2026-05-06T10:00:00", "activity_name": "Yoga", "facility_name": "FitX"}]

      with patch("worker.notifications.webpush") as mock_wp:
          send_push_notifications(db_session, user, bookings, now)
          assert mock_wp.call_count == 1
          call_kwargs = mock_wp.call_args[1]
          data = json.loads(call_kwargs["data"])
          assert "1 Stunde" in data["title"]
          assert "Yoga" in data["body"]
          assert "FitX" in data["body"]


  def test_no_notification_when_booking_outside_window(db_session):
      user = _make_user(db_session, advance=60)
      _make_subscription(db_session, user.id)

      now = datetime(2026, 5, 6, 9, 0, tzinfo=timezone.utc)
      # Termin in 2 Stunden → notification_time = 10:00 → außerhalb [09:00, 09:15)
      bookings = [{"start_datetime": "2026-05-06T11:00:00", "activity_name": "Yoga", "facility_name": "FitX"}]

      with patch("worker.notifications.webpush") as mock_wp:
          send_push_notifications(db_session, user, bookings, now)
          assert mock_wp.call_count == 0


  def test_deletes_gone_subscription(db_session):
      from pywebpush import WebPushException
      user = _make_user(db_session, advance=60)
      _make_subscription(db_session, user.id)

      now = datetime(2026, 5, 6, 9, 0, tzinfo=timezone.utc)
      bookings = [{"start_datetime": "2026-05-06T10:00:00", "activity_name": "Yoga", "facility_name": "FitX"}]

      gone_exc = WebPushException("Gone")
      gone_exc.response = MagicMock(status_code=410)

      with patch("worker.notifications.webpush", side_effect=gone_exc):
          send_push_notifications(db_session, user, bookings, now)

      db_session.expire_all()
      assert db_session.query(PushSubscription).filter_by(user_id=user.id).count() == 0
  ```

- [ ] **Step 2: Tests fehlschlagen lassen**

  ```bash
  pytest tests/worker/test_notifications.py -v
  ```
  Expected: ImportError (worker.notifications existiert nicht)

- [ ] **Step 3: notifications.py implementieren**

  Datei `worker/notifications.py`:

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

  WORKER_INTERVAL_MINUTES = 15


  def format_advance_time(minutes: int) -> str:
      hours, mins = divmod(minutes, 60)
      if hours > 0 and mins > 0:
          h_label = "Stunde" if hours == 1 else "Stunden"
          m_label = "Minute" if mins == 1 else "Minuten"
          return f"{hours} {h_label} {mins} {m_label}"
      if hours > 0:
          return f"{hours} {'Stunde' if hours == 1 else 'Stunden'}"
      return f"{minutes} {'Minute' if minutes == 1 else 'Minuten'}"


  def _send_to_subscription(sub: PushSubscription, payload: dict, db: Session) -> None:
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


  def send_push_notifications(
      db: Session,
      user: User,
      bookings: list[dict],
      now: datetime,
  ) -> None:
      window_start = now.replace(tzinfo=None) if now.tzinfo else now
      window_end = window_start + timedelta(minutes=WORKER_INTERVAL_MINUTES)

      subscriptions = db.query(PushSubscription).filter_by(user_id=user.id).all()
      if not subscriptions:
          return

      for booking in bookings:
          try:
              start_dt = datetime.fromisoformat(booking["start_datetime"])
              if start_dt.tzinfo is not None:
                  start_dt = start_dt.replace(tzinfo=None)
          except (ValueError, KeyError):
              continue

          notification_time = start_dt - timedelta(minutes=user.notification_advance_minutes)
          if not (window_start <= notification_time < window_end):
              continue

          advance_label = format_advance_time(user.notification_advance_minutes)
          time_str = start_dt.strftime("%H:%M")
          payload = {
              "title": f"Termin in {advance_label}",
              "body": f"{booking.get('activity_name', '')} um {time_str} Uhr · {booking.get('facility_name', '')}",
          }

          for sub in subscriptions:
              _send_to_subscription(sub, payload, db)
  ```

- [ ] **Step 4: Tests bestehen lassen**

  ```bash
  pytest tests/worker/test_notifications.py -v
  ```
  Expected: alle passed

- [ ] **Step 5: Commit**

  ```bash
  git add worker/notifications.py tests/worker/test_notifications.py
  git commit -m "feat: add worker notification module with push sending logic"
  ```

---

## Task 13: Worker — Integration in run()

**Files:**
- Modify: `worker/worker.py`
- Modify: `tests/worker/test_worker.py`

- [ ] **Step 1: Failing test schreiben**

  Am Ende von `tests/worker/test_worker.py` hinzufügen:

  ```python
  from unittest.mock import patch
  from backend.models.push_subscription import PushSubscription


  def test_run_calls_push_notifications_for_subscribed_users(db_session, session_factory):
      from backend.core.encryption import encrypt
      u = User(
          id="u-push",
          eversports_user_id="ev-push",
          email="push@example.com",
          encrypted_password=encrypt("secret"),
          active=True,
          notification_advance_minutes=60,
      )
      db_session.add(u)
      sub = PushSubscription(user_id="u-push", endpoint="https://push.example.com/x", p256dh="k", auth="a")
      db_session.add(sub)
      db_session.commit()

      now = datetime(2026, 5, 6, 9, 0)

      with patch("worker.worker.fetch_upcoming_bookings", return_value=[]) as mock_fetch, \
           patch("worker.worker.send_push_notifications") as mock_notify:
          run(now, session_factory)
          mock_fetch.assert_called_once_with("push@example.com", "secret")
          mock_notify.assert_called_once()
  ```

- [ ] **Step 2: Test fehlschlagen lassen**

  ```bash
  pytest tests/worker/test_worker.py::test_run_calls_push_notifications_for_subscribed_users -v
  ```
  Expected: FAILED (AttributeError oder AssertionError)

- [ ] **Step 3: worker.py erweitern**

  In `worker/worker.py` Import ergänzen — nach dem bestehenden Import-Block:

  ```python
  from backend.core.booking import book_session, cancel_booking, fetch_upcoming_bookings
  from backend.models.push_subscription import PushSubscription
  from worker.notifications import send_push_notifications
  ```

  *(`fetch_upcoming_bookings` ist bereits aus `backend.core.booking` importierbar)*

  Am Ende der `run()`-Funktion, nach dem `ThreadPoolExecutor`-Block, neuen Abschnitt hinzufügen:

  ```python
      _run_push_notifications(now, session_factory)


  def _run_push_notifications(now: datetime, session_factory) -> None:
      db = session_factory()
      try:
          users_with_subs = (
              db.query(User)
              .join(PushSubscription, PushSubscription.user_id == User.id)
              .filter(User.active.is_(True))
              .distinct()
              .all()
          )
          log.info("Push notifications: checking %d users with subscriptions", len(users_with_subs))
          for user in users_with_subs:
              try:
                  password = decrypt(user.encrypted_password)
                  bookings = fetch_upcoming_bookings(user.email, password)
                  send_push_notifications(db, user, bookings, now)
              except Exception as exc:
                  log.error("Push notification error for user %s: %s", user.email, exc)
      finally:
          db.close()
  ```

  Außerdem den bestehenden Import in `worker.py` um `fetch_upcoming_bookings` erweitern (falls nicht bereits vorhanden):
  ```python
  from backend.core.booking import book_session, cancel_booking, fetch_upcoming_bookings
  ```

- [ ] **Step 4: Tests bestehen lassen**

  ```bash
  pytest tests/worker/test_worker.py -v
  ```
  Expected: alle passed

- [ ] **Step 5: Alle Tests laufen lassen**

  ```bash
  pytest tests/ -x
  ```
  Expected: alle passed

- [ ] **Step 6: Commit**

  ```bash
  git add worker/worker.py tests/worker/test_worker.py
  git commit -m "feat: integrate push notifications into worker run loop"
  ```

---

## Task 14: Frontend-Tests komplett durchlaufen lassen

- [ ] **Step 1: Alle Frontend-Tests**

  ```bash
  cd frontend && npm test --run
  ```
  Expected: alle passed

- [ ] **Step 2: Falls DashboardPage-Tests fehlschlagen**

  Falls `DashboardPage.test.tsx` fehlschlägt weil `usePushNotifications` nicht gemockt ist:

  In `DashboardPage.test.tsx` einen Mock hinzufügen:
  ```typescript
  vi.mock('../hooks/usePushNotifications', () => ({
    usePushNotifications: vi.fn(),
  }))
  ```

- [ ] **Step 3: Abschluss-Commit**

  ```bash
  git add -A
  git commit -m "feat: complete push notifications feature"
  ```
