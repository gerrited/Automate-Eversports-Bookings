# Admin-Email bei neuer User-Registrierung — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Alle aktiven Admins per Email benachrichtigen, wenn sich ein neuer User das erste Mal registriert.

**Architecture:** Neues Modul `backend/core/email.py` mit `send_new_user_notification()`. Wird in `backend/api/auth.py` direkt nach User-Erstellung aufgerufen. Best-effort: Email-Fehler werden geloggt, nie propagiert. Resend SDK (bereits in `requirements-backend.txt`).

**Tech Stack:** Python, FastAPI, Resend SDK (`resend==2.10.0`), pytest, SQLite (tests)

---

### Task 1: `backend/core/email.py` erstellen

**Files:**
- Create: `backend/core/email.py`
- Test: `tests/backend/test_api_auth.py` (later tasks)

- [ ] **Step 1: Datei erstellen**

```python
# backend/core/email.py
"""
Email notifications for the backend via Resend.
"""
from __future__ import annotations

import logging
import os
from datetime import datetime
from zoneinfo import ZoneInfo

import resend

log = logging.getLogger(__name__)

BERLIN = ZoneInfo("Europe/Berlin")


def send_new_user_notification(admin_emails: list[str], new_user_email: str) -> None:
    """Benachrichtigt alle Admins über einen neuen User. Best-effort — kein Crash bei Fehlern."""
    if not admin_emails:
        return
    try:
        resend.api_key = os.environ["RESEND_API_KEY"]
        from_email = os.environ["FROM_EMAIL"]

        now = datetime.now(BERLIN).strftime("%d.%m.%Y %H:%M")
        subject = f"Neuer User: {new_user_email}"
        html = f"""
<p>Ein neuer User hat sich registriert und wartet auf Freigabe.</p>
<ul>
  <li><strong>Email:</strong> {new_user_email}</li>
  <li><strong>Registriert am:</strong> {now} Uhr</li>
</ul>
"""
        resend.Emails.send({
            "from": from_email,
            "to": admin_emails,
            "subject": subject,
            "html": html,
        })
        log.info("New user notification sent to %d admin(s) for %s", len(admin_emails), new_user_email)
    except Exception as exc:
        log.error("Failed to send new user notification: %s", exc)
```

- [ ] **Step 2: Syntax prüfen**

```bash
python3 -c "import ast; ast.parse(open('backend/core/email.py').read()); print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/core/email.py
git commit -m "feat: add backend email module for new user notifications"
```

---

### Task 2: `auth.py` anpassen — Email nach User-Erstellung

**Files:**
- Modify: `backend/api/auth.py`

Die Email soll direkt nach `db.refresh(user)` und vor dem `raise HTTPException` gesendet werden, also wenn ein neuer nicht-Admin User angelegt wurde.

- [ ] **Step 1: Import ergänzen und Email-Call einfügen**

Ersetze den Block ab `from backend.core.booking import eversports_login` oben, und den `if user is None`-Block:

```python
# backend/api/auth.py
import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.core.booking import eversports_login
from backend.core.email import send_new_user_notification

log = logging.getLogger(__name__)
from backend.core.encryption import encrypt
from backend.core.auth import create_access_token
from backend.db import get_db
from backend.models.user import User
from backend.schemas.auth import LoginRequest, TokenResponse

router = APIRouter()


@router.post("/auth/login", response_model=TokenResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    result = eversports_login(req.email, req.password)
    if result is None:
        raise HTTPException(status_code=401, detail="Invalid Eversports credentials")

    eversports_user_id: str = result["user_id"]
    encrypted_pw = encrypt(req.password)

    user = db.query(User).filter(User.eversports_user_id == eversports_user_id).first()
    if user is None:
        is_first_user = db.query(User).count() == 0
        user = User(
            eversports_user_id=eversports_user_id,
            email=req.email,
            encrypted_password=encrypted_pw,
            active=is_first_user,
            role="admin" if is_first_user else "user",
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        if not is_first_user:
            admins = db.query(User).filter(User.role == "admin", User.active == True).all()
            try:
                send_new_user_notification([a.email for a in admins], req.email)
            except Exception as exc:
                log.error("Failed to send new user notification: %s", exc)
        if not user.active:
            raise HTTPException(status_code=403, detail="Account nicht freigegeben")
    else:
        if not user.active:
            raise HTTPException(status_code=403, detail="Account nicht freigegeben")
        user.encrypted_password = encrypted_pw
        db.commit()
        db.refresh(user)

    return TokenResponse(access_token=create_access_token(user.id), role=user.role)
```

- [ ] **Step 2: Syntax prüfen**

```bash
python3 -c "import ast; ast.parse(open('backend/api/auth.py').read()); print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/api/auth.py
git commit -m "feat: notify admins by email when new user registers"
```

---

### Task 3: Tests für Email-Verhalten

**Files:**
- Modify: `tests/backend/test_api_auth.py`

Die Funktion wird als `backend.api.auth.send_new_user_notification` gemockt (so wie sie in `auth.py` importiert ist).

- [ ] **Step 1: Tests ergänzen**

Folgende Tests ans Ende von `tests/backend/test_api_auth.py` anhängen:

```python
# --- email notifications ---

def test_new_user_registration_sends_admin_notification(client, mocker, db_session):
    from backend.models.user import User
    # Pre-create an active admin
    admin = User(
        eversports_user_id="ev-admin",
        email="admin@x.com",
        encrypted_password="x",
        active=True,
        role="admin",
    )
    db_session.add(admin)
    db_session.commit()

    mocker.patch(
        "backend.api.auth.eversports_login",
        return_value={"user_id": "ev-newuser", "session": None},
    )
    mock_notify = mocker.patch("backend.api.auth.send_new_user_notification")

    client.post("/api/auth/login", json={"email": "newuser@x.com", "password": "pw"})

    mock_notify.assert_called_once_with(["admin@x.com"], "newuser@x.com")


def test_first_user_registration_does_not_send_notification(client, mocker):
    mocker.patch(
        "backend.api.auth.eversports_login",
        return_value={"user_id": "ev-first2", "session": None},
    )
    mock_notify = mocker.patch("backend.api.auth.send_new_user_notification")

    client.post("/api/auth/login", json={"email": "first@x.com", "password": "pw"})

    mock_notify.assert_not_called()


def test_existing_user_login_does_not_send_notification(client, mocker, db_session):
    from backend.models.user import User
    existing = User(
        eversports_user_id="ev-exists",
        email="exists@x.com",
        encrypted_password="x",
        active=True,
        role="user",
    )
    db_session.add(existing)
    db_session.commit()

    mocker.patch(
        "backend.api.auth.eversports_login",
        return_value={"user_id": "ev-exists", "session": None},
    )
    mock_notify = mocker.patch("backend.api.auth.send_new_user_notification")

    client.post("/api/auth/login", json={"email": "exists@x.com", "password": "pw"})

    mock_notify.assert_not_called()


def test_login_succeeds_even_if_notification_fails(client, mocker, db_session):
    from backend.models.user import User
    admin = User(
        eversports_user_id="ev-admin2",
        email="admin2@x.com",
        encrypted_password="x",
        active=True,
        role="admin",
    )
    db_session.add(admin)
    db_session.commit()

    mocker.patch(
        "backend.api.auth.eversports_login",
        return_value={"user_id": "ev-failmail", "session": None},
    )
    mocker.patch(
        "backend.api.auth.send_new_user_notification",
        side_effect=Exception("Resend down"),
    )

    # Should still return 403 (inactive), not 500
    resp = client.post("/api/auth/login", json={"email": "failmail@x.com", "password": "pw"})
    assert resp.status_code == 403
    assert resp.json()["detail"] == "Account nicht freigegeben"
```

- [ ] **Step 2: Tests syntax prüfen**

```bash
python3 -c "import ast; ast.parse(open('tests/backend/test_api_auth.py').read()); print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add tests/backend/test_api_auth.py
git commit -m "test: add email notification tests for new user registration"
```

---

### Task 4: K8s Backend-Deployment mit Email-Env-Vars

**Files:**
- Modify: `k8s/backend-deployment.yaml`

`RESEND_API_KEY` und `FROM_EMAIL` sind bereits im Secret (aus dem Worker-Feature). Der Backend-Container braucht sie aber ebenfalls.

- [ ] **Step 1: Env-Vars ergänzen**

In `k8s/backend-deployment.yaml` nach dem `FRONTEND_URL`-Eintrag einfügen:

```yaml
            - name: RESEND_API_KEY
              valueFrom:
                secretKeyRef:
                  name: eversports-backend-secrets
                  key: resend_api_key
            - name: FROM_EMAIL
              valueFrom:
                secretKeyRef:
                  name: eversports-backend-secrets
                  key: from_email
```

Vollständiger `env`-Block danach:

```yaml
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: eversports-backend-secrets
                  key: database_url
            - name: ENCRYPTION_KEY
              valueFrom:
                secretKeyRef:
                  name: eversports-backend-secrets
                  key: encryption_key
            - name: JWT_SECRET
              valueFrom:
                secretKeyRef:
                  name: eversports-backend-secrets
                  key: jwt_secret
            - name: FRONTEND_URL
              value: "https://your-frontend-domain.example.com"
            - name: RESEND_API_KEY
              valueFrom:
                secretKeyRef:
                  name: eversports-backend-secrets
                  key: resend_api_key
            - name: FROM_EMAIL
              valueFrom:
                secretKeyRef:
                  name: eversports-backend-secrets
                  key: from_email
```

- [ ] **Step 2: Commit**

```bash
git add k8s/backend-deployment.yaml
git commit -m "feat: add RESEND_API_KEY and FROM_EMAIL to backend deployment"
```

---

### Task 5: Push & CI

- [ ] **Step 1: Alle Tests lokal prüfen (Syntax)**

```bash
python3 -c "
import ast
for f in ['backend/core/email.py', 'backend/api/auth.py', 'tests/backend/test_api_auth.py']:
    ast.parse(open(f).read())
    print(f'{f}: OK')
"
```

Expected: alle drei `OK`

- [ ] **Step 2: Push**

```bash
git push origin main
```

CI läuft `pytest tests/ -v` nach `pip install -r requirements-backend.txt`. Alle neuen Tests sollten grün sein.

## Verification

1. Push zu `main` — CI-Pipeline grün
2. K8s Secret mit `resend_api_key` und `from_email` befüllt: `kubectl apply -f k8s/backend-secret.yaml`
3. Backend neu deployen: `kubectl apply -f k8s/backend-deployment.yaml`
4. Neuen User anlegen (zweiter Login-Versuch mit neuen Credentials) — Email kommt bei allen Admins an
5. Erneuter Login desselben Users — keine zweite Email
