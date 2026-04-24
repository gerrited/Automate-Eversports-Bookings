# Stripe Webhooks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stripe-Webhooks integrieren, die `max_active_jobs` eines Users automatisch auf `null` (Abo aktiv) oder `1` (Abo abgelaufen) setzen und bei Abo-Ablauf alle Jobs deaktivieren.

**Architecture:** Neuer FastAPI-Router `backend/api/webhooks.py` nach bestehendem Muster. Stripe-Signatur-Verifikation (HMAC-SHA256) ersetzt JWT-Auth für den Webhook-Endpoint. Zwei neue E-Mail-Templates und Hilfsfunktionen in `email.py`.

**Tech Stack:** `stripe` Python SDK (neu), FastAPI, SQLAlchemy, Jinja2, pytest (bestehend)

---

## Dateien im Überblick

| Datei | Aktion | Inhalt |
|---|---|---|
| `requirements-backend.txt` | Erweitern | `stripe` Package hinzufügen |
| `backend/models/user.py` | Erweitern | `stripe_customer_id` Feld |
| `backend/alembic/versions/<hash>_add_stripe_customer_id_to_users.py` | Neu | DB-Migration |
| `backend/templates/email/subscription_activated.html` | Neu | E-Mail bei Abo-Aktivierung |
| `backend/templates/email/subscription_cancelled.html` | Neu | E-Mail bei Abo-Ablauf |
| `backend/core/email.py` | Erweitern | Zwei neue E-Mail-Hilfsfunktionen |
| `backend/api/webhooks.py` | Neu | Checkout- und Webhook-Endpunkte |
| `backend/main.py` | Erweitern | Router registrieren |
| `tests/backend/test_email_templates.py` | Erweitern | Template-Tests |
| `tests/backend/test_api_webhooks.py` | Neu | Webhook-API-Tests |

---

### Task 1: stripe Package + stripe_customer_id Feld + Migration

**Files:**
- Modify: `requirements-backend.txt`
- Modify: `backend/models/user.py`
- Create: `backend/alembic/versions/<hash>_add_stripe_customer_id_to_users.py`

- [ ] **Step 1: `stripe` zu requirements-backend.txt hinzufügen**

Ans Ende der Datei anfügen:
```
stripe
```

- [ ] **Step 2: Abhängigkeiten installieren**

```bash
pip install -r requirements-backend.txt
```

Expected: `Successfully installed stripe-...`

- [ ] **Step 3: `stripe_customer_id` zum User-Modell hinzufügen**

In `backend/models/user.py` nach `max_active_jobs`:
```python
    stripe_customer_id = Column(String, nullable=True)
```

- [ ] **Step 4: Alembic-Migration erstellen**

```bash
DATABASE_URL=sqlite:///eversports.db \
  alembic -c backend/alembic.ini revision --autogenerate -m "add stripe_customer_id to users"
```

Die generierte Datei in `backend/alembic/versions/` prüfen — sie muss enthalten:
```python
def upgrade() -> None:
    op.add_column('users', sa.Column('stripe_customer_id', sa.String(), nullable=True))

def downgrade() -> None:
    op.drop_column('users', 'stripe_customer_id')
```

- [ ] **Step 5: Migration ausführen**

```bash
DATABASE_URL=sqlite:///eversports.db \
  alembic -c backend/alembic.ini upgrade head
```

Expected output: `Running upgrade f2e233c3cee1 -> <neuer_hash>, add stripe_customer_id to users`

- [ ] **Step 6: Commit**

```bash
git add requirements-backend.txt backend/models/user.py backend/alembic/versions/
git commit -m "feat: add stripe dependency and stripe_customer_id to users"
```

---

### Task 2: E-Mail-Templates + Hilfsfunktionen

**Files:**
- Modify: `tests/backend/test_email_templates.py`
- Create: `backend/templates/email/subscription_activated.html`
- Create: `backend/templates/email/subscription_cancelled.html`
- Modify: `backend/core/email.py`

- [ ] **Step 1: Tests für neue Templates schreiben**

In `tests/backend/test_email_templates.py` am Ende anfügen:
```python
def test_subscription_activated_renders():
    html = _env(BACKEND_DIR).get_template("subscription_activated.html").render(
        frontend_url=FRONTEND_URL,
        plan_name="Pro Monatlich",
        amount="9.99",
        subscription_end="24.05.2025",
    )
    assert "Pro Monatlich" in html
    assert "9.99" in html
    assert "24.05.2025" in html
    assert FRONTEND_URL in html
    assert "#004349" in html
    assert "aktiv" in html


def test_subscription_cancelled_renders():
    html = _env(BACKEND_DIR).get_template("subscription_cancelled.html").render(
        frontend_url=FRONTEND_URL,
        cancelled_at="24.04.2025",
        deactivated_jobs_count=3,
    )
    assert "24.04.2025" in html
    assert "3" in html
    assert FRONTEND_URL in html
    assert "#004349" in html
    assert "abgelaufen" in html
```

- [ ] **Step 2: Tests ausführen (erwarte Fehler)**

```bash
pytest tests/backend/test_email_templates.py::test_subscription_activated_renders tests/backend/test_email_templates.py::test_subscription_cancelled_renders -v
```

Expected: FAIL mit `TemplateNotFound`

- [ ] **Step 3: `subscription_activated.html` erstellen**

Datei `backend/templates/email/subscription_activated.html`:
```html
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Abo aktiv</title>
</head>
<body style="background:#021214;margin:0;padding:32px 16px;font-family:-apple-system,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:0 auto;">

    <div style="background:#03191b;border-radius:12px 12px 0 0;padding:18px 24px;border:1px solid rgba(100,116,139,0.2);border-bottom:1px solid rgba(100,116,139,0.15);">
      <img src="{{ frontend_url }}/logo.png" alt="FOReversports" height="36"
           style="display:inline-block;vertical-align:middle;"
           onerror="this.style.display='none';this.nextElementSibling.style.display='inline-block'">
      <span style="display:none;font-size:18px;font-weight:700;vertical-align:middle;letter-spacing:-0.3px;">
        <span style="color:#26b5c0;">∞ FOR</span><span style="color:#9ca3af;font-weight:400;">eversports</span>
      </span>
    </div>

    <div style="background:#03191b;border-radius:0 0 12px 12px;border:1px solid rgba(100,116,139,0.2);border-top:none;padding:24px;">
      <p style="color:#f1f5f9;font-size:18px;font-weight:600;margin:0 0 12px;">Abo aktiv</p>
      <div style="background:#031a0d;border-left:3px solid #22c55e;border-radius:0 5px 5px 0;padding:10px 14px;margin:0 0 16px;font-size:13px;color:#86efac;">
        Du kannst ab sofort unbegrenzt Buchungen anlegen.
      </div>
      <table style="width:100%;border-collapse:collapse;margin:0 0 20px;font-size:13px;">
        <tr>
          <td style="color:#94a3b8;padding:6px 0;border-bottom:1px solid rgba(100,116,139,0.15);">Plan</td>
          <td style="color:#f1f5f9;padding:6px 0;border-bottom:1px solid rgba(100,116,139,0.15);text-align:right;">{{ plan_name }}</td>
        </tr>
        <tr>
          <td style="color:#94a3b8;padding:6px 0;border-bottom:1px solid rgba(100,116,139,0.15);">Betrag</td>
          <td style="color:#f1f5f9;padding:6px 0;border-bottom:1px solid rgba(100,116,139,0.15);text-align:right;">{{ amount }} €</td>
        </tr>
        <tr>
          <td style="color:#94a3b8;padding:6px 0;">Nächste Abrechnung</td>
          <td style="color:#f1f5f9;padding:6px 0;text-align:right;">{{ subscription_end }}</td>
        </tr>
      </table>
      <a href="{{ frontend_url }}" style="display:inline-block;background:#004349;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:10px 22px;border-radius:8px;">Zum Dashboard →</a>
    </div>

    <p style="color:#374151;font-size:11px;text-align:center;margin:16px 0 0;">FOReversports · Abo-Benachrichtigung</p>
  </div>
</body>
</html>
```

- [ ] **Step 4: `subscription_cancelled.html` erstellen**

Datei `backend/templates/email/subscription_cancelled.html`:
```html
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Abo abgelaufen</title>
</head>
<body style="background:#021214;margin:0;padding:32px 16px;font-family:-apple-system,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:0 auto;">

    <div style="background:#03191b;border-radius:12px 12px 0 0;padding:18px 24px;border:1px solid rgba(100,116,139,0.2);border-bottom:1px solid rgba(100,116,139,0.15);">
      <img src="{{ frontend_url }}/logo.png" alt="FOReversports" height="36"
           style="display:inline-block;vertical-align:middle;"
           onerror="this.style.display='none';this.nextElementSibling.style.display='inline-block'">
      <span style="display:none;font-size:18px;font-weight:700;vertical-align:middle;letter-spacing:-0.3px;">
        <span style="color:#26b5c0;">∞ FOR</span><span style="color:#9ca3af;font-weight:400;">eversports</span>
      </span>
    </div>

    <div style="background:#03191b;border-radius:0 0 12px 12px;border:1px solid rgba(100,116,139,0.2);border-top:none;padding:24px;">
      <p style="color:#f1f5f9;font-size:18px;font-weight:600;margin:0 0 12px;">Abo abgelaufen</p>
      <div style="background:#1a0303;border-left:3px solid #ef4444;border-radius:0 5px 5px 0;padding:10px 14px;margin:0 0 16px;font-size:13px;color:#fca5a5;">
        Dein Abo ist abgelaufen. Du hast jetzt noch 1 aktive Buchung möglich.
      </div>
      <table style="width:100%;border-collapse:collapse;margin:0 0 20px;font-size:13px;">
        <tr>
          <td style="color:#94a3b8;padding:6px 0;border-bottom:1px solid rgba(100,116,139,0.15);">Abgelaufen am</td>
          <td style="color:#f1f5f9;padding:6px 0;border-bottom:1px solid rgba(100,116,139,0.15);text-align:right;">{{ cancelled_at }}</td>
        </tr>
        <tr>
          <td style="color:#94a3b8;padding:6px 0;">Deaktivierte Buchungen</td>
          <td style="color:#f1f5f9;padding:6px 0;text-align:right;">{{ deactivated_jobs_count }}</td>
        </tr>
      </table>
      <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:0 0 20px;">
        Du kannst deine Buchungen manuell wieder aktivieren — dabei gilt das Limit von 1 aktiver Buchung.
      </p>
      <a href="{{ frontend_url }}" style="display:inline-block;background:#004349;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:10px 22px;border-radius:8px;">Zum Dashboard →</a>
    </div>

    <p style="color:#374151;font-size:11px;text-align:center;margin:16px 0 0;">FOReversports · Abo-Benachrichtigung</p>
  </div>
</body>
</html>
```

- [ ] **Step 5: E-Mail-Hilfsfunktionen in `backend/core/email.py` hinzufügen**

Am Ende der Datei anfügen:
```python
def send_subscription_activated_email(
    user_email: str,
    *,
    plan_name: str,
    amount: float,
    subscription_end: str,
) -> None:
    """Benachrichtigt den User über ein aktives Abo. Best-effort — kein Crash bei Fehlern."""
    try:
        resend.api_key = os.environ["RESEND_API_KEY"]
        from_email = os.environ["FROM_EMAIL"]
        sender = f"FOReversports <{from_email}>"
        frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:5173")
        subject = "Dein Abo ist aktiv"
        html = _templates.get_template("subscription_activated.html").render(
            frontend_url=frontend_url,
            plan_name=plan_name,
            amount=f"{amount:.2f}",
            subscription_end=subscription_end,
        )
        resend.Emails.send({"from": sender, "to": [user_email], "subject": subject, "html": html})
        log.info("Subscription activated email sent to %s", user_email)
    except Exception as exc:
        log.error("Failed to send subscription activated email to %s: %s", user_email, exc)


def send_subscription_cancelled_email(
    user_email: str,
    *,
    cancelled_at: str,
    deactivated_jobs_count: int,
) -> None:
    """Benachrichtigt den User über ein abgelaufenes Abo. Best-effort — kein Crash bei Fehlern."""
    try:
        resend.api_key = os.environ["RESEND_API_KEY"]
        from_email = os.environ["FROM_EMAIL"]
        sender = f"FOReversports <{from_email}>"
        frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:5173")
        subject = "Dein Abo ist abgelaufen"
        html = _templates.get_template("subscription_cancelled.html").render(
            frontend_url=frontend_url,
            cancelled_at=cancelled_at,
            deactivated_jobs_count=deactivated_jobs_count,
        )
        resend.Emails.send({"from": sender, "to": [user_email], "subject": subject, "html": html})
        log.info("Subscription cancelled email sent to %s", user_email)
    except Exception as exc:
        log.error("Failed to send subscription cancelled email to %s: %s", user_email, exc)
```

- [ ] **Step 6: Template-Tests ausführen**

```bash
pytest tests/backend/test_email_templates.py::test_subscription_activated_renders tests/backend/test_email_templates.py::test_subscription_cancelled_renders -v
```

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add backend/templates/email/subscription_activated.html \
        backend/templates/email/subscription_cancelled.html \
        backend/core/email.py \
        tests/backend/test_email_templates.py
git commit -m "feat: add subscription email templates and helper functions"
```

---

### Task 3: Checkout-Endpunkt

**Files:**
- Create: `tests/backend/test_api_webhooks.py`
- Create: `backend/api/webhooks.py`
- Modify: `backend/main.py`

- [ ] **Step 1: Testdatei mit Checkout-Tests erstellen**

Neue Datei `tests/backend/test_api_webhooks.py`:
```python
import os
from datetime import time as dt_time
from unittest.mock import MagicMock, patch

from backend.core.auth import create_access_token
from backend.models.booking_job import BookingJob
from backend.models.user import User

os.environ.setdefault("STRIPE_SECRET_KEY", "sk_test_dummy")
os.environ.setdefault("STRIPE_PRICE_ID", "price_dummy")
os.environ.setdefault("STRIPE_WEBHOOK_SECRET", "whsec_test_dummy")


def _auth_header(user_id: str) -> dict:
    return {"Authorization": f"Bearer {create_access_token(user_id)}"}


def _create_user(db_session, *, stripe_customer_id: str | None = None, max_active_jobs: int | None = None) -> User:
    user = User(
        eversports_user_id="ev-stripe-1",
        email="stripe@example.com",
        encrypted_password="x",
        active=True,
        stripe_customer_id=stripe_customer_id,
        max_active_jobs=max_active_jobs,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def _create_job(db_session, user_id: str, *, enabled: bool = True) -> BookingJob:
    job = BookingJob(
        user_id=user_id,
        weekday=1,
        target_time=dt_time(18, 0),
        facility_id="73041",
        facility_name="TestFacility",
        class_name="Yoga",
        days_in_advance=4,
        enabled=enabled,
    )
    db_session.add(job)
    db_session.commit()
    db_session.refresh(job)
    return job


def test_checkout_returns_url(client, db_session):
    user = _create_user(db_session)
    mock_session = MagicMock()
    mock_session.url = "https://checkout.stripe.com/test-session"
    with patch("backend.api.webhooks.stripe.checkout.Session.create", return_value=mock_session):
        resp = client.post("/api/stripe/checkout", headers=_auth_header(user.id))
    assert resp.status_code == 200
    assert resp.json()["url"] == "https://checkout.stripe.com/test-session"


def test_checkout_requires_auth(client):
    resp = client.post("/api/stripe/checkout")
    assert resp.status_code == 403
```

- [ ] **Step 2: Tests ausführen (erwarte Fehler)**

```bash
pytest tests/backend/test_api_webhooks.py::test_checkout_returns_url tests/backend/test_api_webhooks.py::test_checkout_requires_auth -v
```

Expected: FAIL — `404 Not Found` weil `webhooks.py` noch nicht existiert

- [ ] **Step 3: `backend/api/webhooks.py` erstellen**

```python
from __future__ import annotations

import logging
import os
from datetime import datetime, timezone

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.api.deps import get_current_active_user
from backend.core.email import send_subscription_activated_email, send_subscription_cancelled_email
from backend.db import get_db
from backend.models.booking_job import BookingJob
from backend.models.user import User

log = logging.getLogger(__name__)
router = APIRouter()


class CheckoutResponse(BaseModel):
    url: str


@router.post("/stripe/checkout", response_model=CheckoutResponse)
def create_checkout(
    current_user: User = Depends(get_current_active_user),
):
    stripe.api_key = os.environ["STRIPE_SECRET_KEY"]
    frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:5173")
    price_id = os.environ["STRIPE_PRICE_ID"]
    session = stripe.checkout.Session.create(
        payment_method_types=["card"],
        line_items=[{"price": price_id, "quantity": 1}],
        mode="subscription",
        success_url=f"{frontend_url}/dashboard?checkout=success",
        cancel_url=f"{frontend_url}/dashboard?checkout=cancelled",
        client_reference_id=current_user.id,
    )
    return CheckoutResponse(url=session.url)


@router.post("/stripe/webhook", status_code=200)
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    raw_body = await request.body()
    sig_header = request.headers.get("stripe-signature", "")
    webhook_secret = os.environ["STRIPE_WEBHOOK_SECRET"]
    try:
        event = stripe.Webhook.construct_event(raw_body, sig_header, webhook_secret)
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")
    obj = event["data"]["object"]
    if event["type"] == "checkout.session.completed":
        _handle_checkout_completed(obj, db)
    elif event["type"] == "invoice.paid":
        _handle_invoice_paid(obj, db)
    elif event["type"] == "customer.subscription.deleted":
        _handle_subscription_deleted(obj, db)
    return {"received": True}


def _handle_checkout_completed(obj: dict, db: Session) -> None:
    user_id = obj.get("client_reference_id")
    stripe_customer_id = obj.get("customer")
    if not user_id or not stripe_customer_id:
        log.warning("checkout.session.completed: missing client_reference_id or customer")
        return
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        log.warning("checkout.session.completed: user not found for id %s", user_id)
        return
    user.stripe_customer_id = stripe_customer_id
    db.commit()


def _handle_invoice_paid(obj: dict, db: Session) -> None:
    stripe_customer_id = obj.get("customer")
    user = db.query(User).filter(User.stripe_customer_id == stripe_customer_id).first()
    if user is None:
        log.warning("invoice.paid: user not found for stripe_customer_id %s", stripe_customer_id)
        return
    user.max_active_jobs = None
    db.commit()
    lines = obj.get("lines", {}).get("data", [])
    plan_name = lines[0].get("description", "") if lines else ""
    amount = obj.get("amount_paid", 0) / 100
    period_end_ts = lines[0].get("period", {}).get("end") if lines else None
    subscription_end = (
        datetime.fromtimestamp(period_end_ts, tz=timezone.utc).strftime("%d.%m.%Y")
        if period_end_ts else ""
    )
    send_subscription_activated_email(
        user.email,
        plan_name=plan_name,
        amount=amount,
        subscription_end=subscription_end,
    )


def _handle_subscription_deleted(obj: dict, db: Session) -> None:
    stripe_customer_id = obj.get("customer")
    user = db.query(User).filter(User.stripe_customer_id == stripe_customer_id).first()
    if user is None:
        log.warning("customer.subscription.deleted: user not found for stripe_customer_id %s", stripe_customer_id)
        return
    jobs = db.query(BookingJob).filter(
        BookingJob.user_id == user.id,
        BookingJob.enabled == True,
    ).all()
    deactivated_count = len(jobs)
    for job in jobs:
        job.enabled = False
    user.max_active_jobs = 1
    db.commit()
    cancelled_at_ts = obj.get("canceled_at") or obj.get("current_period_end")
    cancelled_at = (
        datetime.fromtimestamp(cancelled_at_ts, tz=timezone.utc).strftime("%d.%m.%Y")
        if cancelled_at_ts else ""
    )
    send_subscription_cancelled_email(
        user.email,
        cancelled_at=cancelled_at,
        deactivated_jobs_count=deactivated_count,
    )
```

- [ ] **Step 4: Router in `backend/main.py` registrieren**

Zeile 8 von `main.py` ändern:
```python
# vorher:
from backend.api import auth, jobs, admin, facilities, account, bookings
# nachher:
from backend.api import auth, jobs, admin, facilities, account, bookings, webhooks
```

Zeile 33 nach dem letzten `include_router` anfügen:
```python
app.include_router(webhooks.router, prefix="/api")
```

- [ ] **Step 5: Checkout-Tests ausführen**

```bash
pytest tests/backend/test_api_webhooks.py::test_checkout_returns_url tests/backend/test_api_webhooks.py::test_checkout_requires_auth -v
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/api/webhooks.py backend/main.py tests/backend/test_api_webhooks.py
git commit -m "feat: add stripe checkout and webhook endpoints"
```

---

### Task 4: Webhook-Signatur-Verifikation testen

**Files:**
- Modify: `tests/backend/test_api_webhooks.py`

- [ ] **Step 1: Tests für Signatur-Verifikation hinzufügen**

In `tests/backend/test_api_webhooks.py` anfügen:
```python
def test_webhook_invalid_signature(client):
    import stripe as stripe_lib
    with patch("backend.api.webhooks.stripe.Webhook.construct_event") as mock_event:
        mock_event.side_effect = stripe_lib.error.SignatureVerificationError(
            "No signatures found", "stripe-signature"
        )
        resp = client.post(
            "/api/stripe/webhook",
            content=b"{}",
            headers={"stripe-signature": "invalid"},
        )
    assert resp.status_code == 400


def test_webhook_unknown_event_returns_200(client):
    with patch("backend.api.webhooks.stripe.Webhook.construct_event") as mock_event:
        mock_event.return_value = {"type": "some.unknown.event", "data": {"object": {}}}
        resp = client.post(
            "/api/stripe/webhook",
            content=b"{}",
            headers={"stripe-signature": "valid"},
        )
    assert resp.status_code == 200
    assert resp.json() == {"received": True}
```

- [ ] **Step 2: Tests ausführen**

```bash
pytest tests/backend/test_api_webhooks.py::test_webhook_invalid_signature tests/backend/test_api_webhooks.py::test_webhook_unknown_event_returns_200 -v
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add tests/backend/test_api_webhooks.py
git commit -m "test: add webhook signature verification tests"
```

---

### Task 5: checkout.session.completed Handler testen

**Files:**
- Modify: `tests/backend/test_api_webhooks.py`

- [ ] **Step 1: Tests hinzufügen**

In `tests/backend/test_api_webhooks.py` anfügen:
```python
def test_checkout_session_completed_saves_customer_id(client, db_session):
    user = _create_user(db_session)
    event_obj = {
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "client_reference_id": user.id,
                "customer": "cus_test_123",
            }
        },
    }
    with patch("backend.api.webhooks.stripe.Webhook.construct_event", return_value=event_obj):
        resp = client.post(
            "/api/stripe/webhook",
            content=b"{}",
            headers={"stripe-signature": "valid"},
        )
    assert resp.status_code == 200
    db_session.refresh(user)
    assert user.stripe_customer_id == "cus_test_123"


def test_checkout_session_completed_unknown_user_returns_200(client, db_session):
    event_obj = {
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "client_reference_id": "nonexistent-user-id",
                "customer": "cus_test_456",
            }
        },
    }
    with patch("backend.api.webhooks.stripe.Webhook.construct_event", return_value=event_obj):
        resp = client.post(
            "/api/stripe/webhook",
            content=b"{}",
            headers={"stripe-signature": "valid"},
        )
    assert resp.status_code == 200
```

- [ ] **Step 2: Tests ausführen**

```bash
pytest tests/backend/test_api_webhooks.py::test_checkout_session_completed_saves_customer_id tests/backend/test_api_webhooks.py::test_checkout_session_completed_unknown_user_returns_200 -v
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add tests/backend/test_api_webhooks.py
git commit -m "test: add checkout.session.completed handler tests"
```

---

### Task 6: invoice.paid Handler testen

**Files:**
- Modify: `tests/backend/test_api_webhooks.py`

- [ ] **Step 1: Tests hinzufügen**

In `tests/backend/test_api_webhooks.py` anfügen:
```python
def test_invoice_paid_sets_unlimited_jobs(client, db_session):
    user = _create_user(db_session, stripe_customer_id="cus_test_123", max_active_jobs=1)
    event_obj = {
        "type": "invoice.paid",
        "data": {
            "object": {
                "customer": "cus_test_123",
                "amount_paid": 999,
                "lines": {
                    "data": [{
                        "description": "Pro Monatlich",
                        "period": {"end": 1748044800},
                    }]
                },
            }
        },
    }
    with patch("backend.api.webhooks.stripe.Webhook.construct_event", return_value=event_obj):
        with patch("backend.api.webhooks.send_subscription_activated_email") as mock_mail:
            resp = client.post(
                "/api/stripe/webhook",
                content=b"{}",
                headers={"stripe-signature": "valid"},
            )
    assert resp.status_code == 200
    db_session.refresh(user)
    assert user.max_active_jobs is None
    mock_mail.assert_called_once_with(
        "stripe@example.com",
        plan_name="Pro Monatlich",
        amount=9.99,
        subscription_end="24.05.2025",
    )


def test_invoice_paid_unknown_customer_returns_200(client, db_session):
    event_obj = {
        "type": "invoice.paid",
        "data": {
            "object": {
                "customer": "cus_unknown",
                "amount_paid": 0,
                "lines": {"data": []},
            }
        },
    }
    with patch("backend.api.webhooks.stripe.Webhook.construct_event", return_value=event_obj):
        resp = client.post(
            "/api/stripe/webhook",
            content=b"{}",
            headers={"stripe-signature": "valid"},
        )
    assert resp.status_code == 200
```

- [ ] **Step 2: Tests ausführen**

```bash
pytest tests/backend/test_api_webhooks.py::test_invoice_paid_sets_unlimited_jobs tests/backend/test_api_webhooks.py::test_invoice_paid_unknown_customer_returns_200 -v
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add tests/backend/test_api_webhooks.py
git commit -m "test: add invoice.paid handler tests"
```

---

### Task 7: customer.subscription.deleted Handler testen + Gesamttest

**Files:**
- Modify: `tests/backend/test_api_webhooks.py`

- [ ] **Step 1: Tests hinzufügen**

In `tests/backend/test_api_webhooks.py` anfügen:
```python
def test_subscription_deleted_deactivates_jobs_and_sets_limit(client, db_session):
    user = _create_user(db_session, stripe_customer_id="cus_test_123")
    job1 = _create_job(db_session, user.id, enabled=True)
    job2 = _create_job(db_session, user.id, enabled=True)
    _create_job(db_session, user.id, enabled=False)

    event_obj = {
        "type": "customer.subscription.deleted",
        "data": {
            "object": {
                "customer": "cus_test_123",
                "canceled_at": 1745452800,
            }
        },
    }
    with patch("backend.api.webhooks.stripe.Webhook.construct_event", return_value=event_obj):
        with patch("backend.api.webhooks.send_subscription_cancelled_email") as mock_mail:
            resp = client.post(
                "/api/stripe/webhook",
                content=b"{}",
                headers={"stripe-signature": "valid"},
            )
    assert resp.status_code == 200
    db_session.refresh(user)
    db_session.refresh(job1)
    db_session.refresh(job2)
    assert user.max_active_jobs == 1
    assert job1.enabled is False
    assert job2.enabled is False
    mock_mail.assert_called_once_with(
        "stripe@example.com",
        cancelled_at="24.04.2025",
        deactivated_jobs_count=2,
    )


def test_subscription_deleted_no_enabled_jobs(client, db_session):
    user = _create_user(db_session, stripe_customer_id="cus_test_123")
    _create_job(db_session, user.id, enabled=False)

    event_obj = {
        "type": "customer.subscription.deleted",
        "data": {
            "object": {
                "customer": "cus_test_123",
                "canceled_at": 1745452800,
            }
        },
    }
    with patch("backend.api.webhooks.stripe.Webhook.construct_event", return_value=event_obj):
        with patch("backend.api.webhooks.send_subscription_cancelled_email") as mock_mail:
            resp = client.post(
                "/api/stripe/webhook",
                content=b"{}",
                headers={"stripe-signature": "valid"},
            )
    assert resp.status_code == 200
    db_session.refresh(user)
    assert user.max_active_jobs == 1
    mock_mail.assert_called_once_with(
        "stripe@example.com",
        cancelled_at="24.04.2025",
        deactivated_jobs_count=0,
    )


def test_subscription_deleted_unknown_customer_returns_200(client, db_session):
    event_obj = {
        "type": "customer.subscription.deleted",
        "data": {"object": {"customer": "cus_unknown", "canceled_at": None}},
    }
    with patch("backend.api.webhooks.stripe.Webhook.construct_event", return_value=event_obj):
        resp = client.post(
            "/api/stripe/webhook",
            content=b"{}",
            headers={"stripe-signature": "valid"},
        )
    assert resp.status_code == 200
```

- [ ] **Step 2: Neue Tests ausführen**

```bash
pytest tests/backend/test_api_webhooks.py::test_subscription_deleted_deactivates_jobs_and_sets_limit tests/backend/test_api_webhooks.py::test_subscription_deleted_no_enabled_jobs tests/backend/test_api_webhooks.py::test_subscription_deleted_unknown_customer_returns_200 -v
```

Expected: PASS

- [ ] **Step 3: Gesamte Test-Suite ausführen**

```bash
pytest tests/ -x
```

Expected: Alle Tests PASS

- [ ] **Step 4: Commit**

```bash
git add tests/backend/test_api_webhooks.py
git commit -m "test: add customer.subscription.deleted handler tests"
```

---

## Umgebungsvariablen für Produktion

Folgende Variablen müssen in der Produktionsumgebung gesetzt werden:

```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID=price_...
```

Den `STRIPE_WEBHOOK_SECRET` erhält man im Stripe-Dashboard unter **Developers → Webhooks → Endpoint** nach dem Erstellen des Webhook-Endpoints mit URL `https://<deine-domain>/api/stripe/webhook` und den Events:
- `checkout.session.completed`
- `invoice.paid`
- `customer.subscription.deleted`
