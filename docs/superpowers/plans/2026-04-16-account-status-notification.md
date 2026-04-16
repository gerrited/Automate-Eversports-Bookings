# Account-Status-Benachrichtigung — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** User per Email benachrichtigen wenn ihr Konto von einem Admin freigeschaltet oder deaktiviert wurde.

**Architecture:** Neue Funktion `send_account_status_email()` in bestehendem `backend/core/email.py`. Aufgerufen aus `backend/api/admin.py` nach `db.commit()` im `set_user_active`-Endpoint. Best-effort: try/except, nie propagiert.

**Tech Stack:** Python, FastAPI, Resend SDK (`resend==2.10.0`), pytest

---

### Task 1: `send_account_status_email` in `backend/core/email.py` ergänzen

**Files:**
- Modify: `backend/core/email.py`

- [ ] **Step 1: Funktion ans Ende der Datei anhängen**

Aktuelle letzte Zeile ist 43. Folgendes direkt darunter anfügen:

```python


def send_account_status_email(user_email: str, is_active: bool) -> None:
    """Benachrichtigt den User über eine Konto-Statusänderung. Best-effort — kein Crash bei Fehlern."""
    try:
        resend.api_key = os.environ["RESEND_API_KEY"]
        from_email = os.environ["FROM_EMAIL"]

        if is_active:
            subject = "Dein Konto wurde freigeschaltet"
            html = "<p>Dein Konto für FOReversports wurde freigeschaltet. Du kannst dich ab sofort anmelden.</p>"
        else:
            subject = "Dein Konto wurde deaktiviert"
            html = "<p>Dein Konto für FOReversports wurde deaktiviert. Wende dich an einen Admin, falls du Fragen hast.</p>"

        resend.Emails.send({
            "from": from_email,
            "to": [user_email],
            "subject": subject,
            "html": html,
        })
        status_str = "activated" if is_active else "deactivated"
        log.info("Account status email (%s) sent to %s", status_str, user_email)
    except Exception as exc:
        log.error("Failed to send account status email to %s: %s", user_email, exc)
```

- [ ] **Step 2: Syntax prüfen**

```bash
python3 -c "import ast; ast.parse(open('backend/core/email.py').read()); print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/core/email.py
git commit -m "feat: add account status email notification function"
```

---

### Task 2: `backend/api/admin.py` anpassen

**Files:**
- Modify: `backend/api/admin.py`

- [ ] **Step 1: Datei mit folgenden Änderungen überschreiben**

```python
import logging
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.api.deps import require_admin
from backend.core.email import send_account_status_email
from backend.db import get_db
from backend.models.booking_job import BookingJob
from backend.models.user import User
from backend.schemas.user import UserResponse, SetActiveRequest

log = logging.getLogger(__name__)

router = APIRouter()


@router.get("/admin/users", response_model=List[UserResponse])
def list_users(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(User, func.count(BookingJob.id).label("job_count"))
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
            created_at=user.created_at,
        )
        for user, job_count in rows
    ]


@router.patch("/admin/users/{user_id}/active", response_model=UserResponse)
def set_user_active(
    user_id: str,
    body: SetActiveRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    if user_id == current_user.id and not body.active:
        raise HTTPException(status_code=400, detail="Cannot deactivate your own account")
    user.active = body.active
    db.commit()
    db.refresh(user)
    try:
        send_account_status_email(user.email, user.active)
    except Exception as exc:
        log.error("Failed to send account status email: %s", exc)
    job_count = db.query(func.count(BookingJob.id)).filter(BookingJob.user_id == user.id).scalar()
    return UserResponse(
        id=user.id,
        email=user.email,
        active=user.active,
        role=user.role,
        job_count=job_count,
        created_at=user.created_at,
    )
```

- [ ] **Step 2: Syntax prüfen**

```bash
python3 -c "import ast; ast.parse(open('backend/api/admin.py').read()); print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/api/admin.py
git commit -m "feat: send account status email on user activation/deactivation"
```

---

### Task 3: Tests in `tests/backend/test_api_admin.py`

**Files:**
- Modify: `tests/backend/test_api_admin.py`

Die Funktion wird als `backend.api.admin.send_account_status_email` gemockt.

- [ ] **Step 1: Tests ans Ende der Datei anhängen**

```python


# --- email notifications ---

def test_activation_sends_status_email(client, db_session, mocker):
    admin = _make_admin(db_session)
    user = _make_user(db_session, ev_id="ev-notify1", email="notify1@x.com", active=False)
    mock_email = mocker.patch("backend.api.admin.send_account_status_email")

    resp = client.patch(
        f"/api/admin/users/{user.id}/active",
        json={"active": True},
        headers=_auth_header(admin.id),
    )

    assert resp.status_code == 200
    mock_email.assert_called_once_with("notify1@x.com", True)


def test_deactivation_sends_status_email(client, db_session, mocker):
    admin = _make_admin(db_session)
    user = _make_user(db_session, ev_id="ev-notify2", email="notify2@x.com", active=True)
    mock_email = mocker.patch("backend.api.admin.send_account_status_email")

    resp = client.patch(
        f"/api/admin/users/{user.id}/active",
        json={"active": False},
        headers=_auth_header(admin.id),
    )

    assert resp.status_code == 200
    mock_email.assert_called_once_with("notify2@x.com", False)


def test_status_email_failure_does_not_affect_response(client, db_session, mocker):
    admin = _make_admin(db_session)
    user = _make_user(db_session, ev_id="ev-notify3", email="notify3@x.com", active=False)
    mocker.patch(
        "backend.api.admin.send_account_status_email",
        side_effect=Exception("Resend down"),
    )

    resp = client.patch(
        f"/api/admin/users/{user.id}/active",
        json={"active": True},
        headers=_auth_header(admin.id),
    )

    assert resp.status_code == 200
    assert resp.json()["active"] is True


def test_no_email_when_user_not_found(client, db_session, mocker):
    admin = _make_admin(db_session)
    mock_email = mocker.patch("backend.api.admin.send_account_status_email")

    resp = client.patch(
        "/api/admin/users/nonexistent-id/active",
        json={"active": True},
        headers=_auth_header(admin.id),
    )

    assert resp.status_code == 404
    mock_email.assert_not_called()
```

- [ ] **Step 2: Syntax prüfen**

```bash
python3 -c "import ast; ast.parse(open('tests/backend/test_api_admin.py').read()); print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add tests/backend/test_api_admin.py
git commit -m "test: add account status email notification tests"
```

---

### Task 4: Push & CI

- [ ] **Step 1: Syntax aller geänderten Dateien prüfen**

```bash
python3 -c "
import ast
for f in ['backend/core/email.py', 'backend/api/admin.py', 'tests/backend/test_api_admin.py']:
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
2. Backend neu deployen: `kubectl rollout restart deployment/eversports-backend`
3. Als Admin einen inaktiven User freischalten — Email beim User prüfen
4. Als Admin denselben User deaktivieren — zweite Email beim User prüfen
5. Sicherstellen dass kein Email-Fehler den 200-Response verhindert
