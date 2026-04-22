# Email Templates Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Alle 5 Jinja2-E-Mail-Templates auf ein einheitliches dunkles Design mit Logo, Brand-Farben und Card-Layout umstellen.

**Architecture:** Jedes Template wird eine eigenständige HTML-Datei mit vollständig inline-gestyled CSS (E-Mail-Clients unterstützen keine externen Stylesheets). Das Logo wird als `<img src="{{ frontend_url }}/logo.png">` eingebunden, mit einem CSS-Text-Fallback für den Fall, dass das Bild nicht geladen werden kann. Die Shared-Struktur (Logo-Streifen, Card, Footer) wird in jedem Template wiederholt — Jinja2-Inheritance wäre möglich, aber nicht nötig für 5 Templates. Worker-Templates sind identische Kopien der Backend-Templates.

**Tech Stack:** Jinja2, HTML/CSS (inline), pytest

---

### Task 1: Test-Datei anlegen

**Files:**
- Create: `tests/backend/test_email_templates.py`

- [ ] **Step 1: Testdatei schreiben**

Erstelle `tests/backend/test_email_templates.py`:

```python
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape

BACKEND_DIR = Path(__file__).parent.parent.parent / "backend" / "templates" / "email"
WORKER_DIR = Path(__file__).parent.parent.parent / "worker" / "templates" / "email"
FRONTEND_URL = "https://app.example.de"


def _env(path: Path) -> Environment:
    return Environment(loader=FileSystemLoader(path), autoescape=select_autoescape(["html"]))


def test_booking_failure_renders():
    html = _env(BACKEND_DIR).get_template("booking_failure.html").render(
        class_name="Yoga Basics",
        time_str="18:00",
        weekday_str="Montag",
        date_str="28.04.2026",
        facility_name="FitnessPark Mitte",
        error_message="Kurs bereits ausgebucht",
        frontend_url=FRONTEND_URL,
    )
    assert "Yoga Basics" in html
    assert "Kurs bereits ausgebucht" in html
    assert FRONTEND_URL in html
    assert "#004349" in html
    assert "Buchung fehlgeschlagen" in html


def test_debug_cancel_failure_renders():
    html = _env(BACKEND_DIR).get_template("debug_cancel_failure.html").render(
        class_name="Yoga Basics",
        time_str="18:00",
        weekday_str="Montag",
        date_str="28.04.2026",
        facility_name="FitnessPark Mitte",
        error_message="Verbindung fehlgeschlagen",
        frontend_url=FRONTEND_URL,
    )
    assert "Yoga Basics" in html
    assert "Verbindung fehlgeschlagen" in html
    assert FRONTEND_URL in html
    assert "#004349" in html
    assert "Debug-Stornierung" in html


def test_account_activated_renders():
    html = _env(BACKEND_DIR).get_template("account_activated.html").render(
        frontend_url=FRONTEND_URL,
    )
    assert FRONTEND_URL in html
    assert "#004349" in html
    assert "freigeschaltet" in html


def test_account_deactivated_renders():
    html = _env(BACKEND_DIR).get_template("account_deactivated.html").render(
        frontend_url=FRONTEND_URL,
    )
    assert FRONTEND_URL in html
    assert "#004349" in html
    assert "deaktiviert" in html


def test_new_user_notification_renders():
    html = _env(BACKEND_DIR).get_template("new_user_notification.html").render(
        new_user_email="test@example.com",
        now="28.04.2026 14:23",
        users_url=f"{FRONTEND_URL}/dashboard#users",
        frontend_url=FRONTEND_URL,
    )
    assert "test@example.com" in html
    assert "28.04.2026 14:23" in html
    assert f"{FRONTEND_URL}/dashboard#users" in html
    assert "#004349" in html
    assert "Freigabe" in html


def test_worker_booking_failure_renders():
    html = _env(WORKER_DIR).get_template("booking_failure.html").render(
        class_name="Yoga Basics",
        time_str="18:00",
        weekday_str="Montag",
        date_str="28.04.2026",
        facility_name="FitnessPark Mitte",
        error_message="Kurs bereits ausgebucht",
        frontend_url=FRONTEND_URL,
    )
    assert "Yoga Basics" in html
    assert "#004349" in html


def test_worker_debug_cancel_failure_renders():
    html = _env(WORKER_DIR).get_template("debug_cancel_failure.html").render(
        class_name="Yoga Basics",
        time_str="18:00",
        weekday_str="Montag",
        date_str="28.04.2026",
        facility_name="FitnessPark Mitte",
        error_message="Verbindung fehlgeschlagen",
        frontend_url=FRONTEND_URL,
    )
    assert "Yoga Basics" in html
    assert "#004349" in html
```

- [ ] **Step 2: Tests laufen lassen — alle müssen scheitern**

```bash
pytest tests/backend/test_email_templates.py -v
```

Erwartetes Ergebnis: alle 7 Tests FAILED (alte Templates enthalten kein `#004349`).

- [ ] **Step 3: Committen**

```bash
git add tests/backend/test_email_templates.py
git commit -m "test: add render tests for redesigned email templates"
```

---

### Task 2: `booking_failure.html` (Backend)

**Files:**
- Modify: `backend/templates/email/booking_failure.html`

- [ ] **Step 1: Template ersetzen**

Ersetze den gesamten Inhalt von `backend/templates/email/booking_failure.html`:

```html
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Buchung fehlgeschlagen</title>
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
      <p style="color:#f1f5f9;font-size:18px;font-weight:600;margin:0 0 12px;">Buchung fehlgeschlagen</p>
      <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:0 0 16px;">Deine automatische Buchung konnte nicht durchgeführt werden.</p>
      <div style="background:#021214;border-radius:6px;padding:12px 16px;margin:0 0 16px;font-size:13px;color:#94a3b8;line-height:2;">
        <strong style="color:#cbd5e1;">Kurs</strong>&nbsp;&nbsp;{{ class_name }} — {{ time_str }} Uhr<br>
        <strong style="color:#cbd5e1;">Tag&nbsp;&nbsp;</strong>&nbsp;{{ weekday_str }}, {{ date_str }}<br>
        <strong style="color:#cbd5e1;">Ort&nbsp;&nbsp;</strong>&nbsp;{{ facility_name }}
      </div>
      <div style="background:#1a0a0a;border-left:3px solid #f87171;border-radius:0 5px 5px 0;padding:10px 14px;margin:0 0 16px;font-size:13px;color:#f87171;font-family:monospace;">{{ error_message }}</div>
      <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:0 0 20px;">Der Job ist weiterhin aktiv und wird beim nächsten Versuch erneut ausgeführt.</p>
      <a href="{{ frontend_url }}" style="display:inline-block;background:#004349;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:10px 22px;border-radius:8px;">Zur App →</a>
    </div>

    <p style="color:#374151;font-size:11px;text-align:center;margin:16px 0 0;">FOReversports · Automatische Buchungsbenachrichtigung</p>
  </div>
</body>
</html>
```

- [ ] **Step 2: Test laufen lassen**

```bash
pytest tests/backend/test_email_templates.py::test_booking_failure_renders -v
```

Erwartetes Ergebnis: PASSED.

- [ ] **Step 3: Committen**

```bash
git add backend/templates/email/booking_failure.html
git commit -m "feat: redesign booking_failure email template"
```

---

### Task 3: `debug_cancel_failure.html` (Backend)

**Files:**
- Modify: `backend/templates/email/debug_cancel_failure.html`

- [ ] **Step 1: Template ersetzen**

Ersetze den gesamten Inhalt von `backend/templates/email/debug_cancel_failure.html`:

```html
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Debug-Stornierung fehlgeschlagen</title>
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
      <p style="color:#f1f5f9;font-size:18px;font-weight:600;margin:0 0 12px;">Debug-Stornierung fehlgeschlagen</p>
      <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:0 0 16px;">Die Debug-Buchung wurde erfolgreich gebucht, konnte aber nicht automatisch storniert werden.</p>
      <div style="background:#021214;border-radius:6px;padding:12px 16px;margin:0 0 16px;font-size:13px;color:#94a3b8;line-height:2;">
        <strong style="color:#cbd5e1;">Kurs</strong>&nbsp;&nbsp;{{ class_name }} — {{ time_str }} Uhr<br>
        <strong style="color:#cbd5e1;">Tag&nbsp;&nbsp;</strong>&nbsp;{{ weekday_str }}, {{ date_str }}<br>
        <strong style="color:#cbd5e1;">Ort&nbsp;&nbsp;</strong>&nbsp;{{ facility_name }}
      </div>
      <div style="background:#1a0a0a;border-left:3px solid #f87171;border-radius:0 5px 5px 0;padding:10px 14px;margin:0 0 16px;font-size:13px;color:#f87171;font-family:monospace;">{{ error_message }}</div>
      <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:0 0 20px;">Bitte storniere die Buchung manuell auf Eversports.</p>
      <a href="{{ frontend_url }}" style="display:inline-block;background:#004349;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:10px 22px;border-radius:8px;">Zur App →</a>
    </div>

    <p style="color:#374151;font-size:11px;text-align:center;margin:16px 0 0;">FOReversports · Automatische Buchungsbenachrichtigung</p>
  </div>
</body>
</html>
```

- [ ] **Step 2: Test laufen lassen**

```bash
pytest tests/backend/test_email_templates.py::test_debug_cancel_failure_renders -v
```

Erwartetes Ergebnis: PASSED.

- [ ] **Step 3: Committen**

```bash
git add backend/templates/email/debug_cancel_failure.html
git commit -m "feat: redesign debug_cancel_failure email template"
```

---

### Task 4: `account_activated.html`

**Files:**
- Modify: `backend/templates/email/account_activated.html`

- [ ] **Step 1: Template ersetzen**

Ersetze den gesamten Inhalt von `backend/templates/email/account_activated.html`:

```html
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Konto freigeschaltet</title>
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
      <p style="color:#f1f5f9;font-size:18px;font-weight:600;margin:0 0 12px;">Konto freigeschaltet</p>
      <div style="background:#031a0d;border-left:3px solid #22c55e;border-radius:0 5px 5px 0;padding:10px 14px;margin:0 0 16px;font-size:13px;color:#86efac;">Dein Konto ist jetzt aktiv.</div>
      <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:0 0 20px;">Du kannst dich ab sofort anmelden und deine Buchungen automatisch planen lassen.</p>
      <a href="{{ frontend_url }}" style="display:inline-block;background:#004349;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:10px 22px;border-radius:8px;">Jetzt anmelden →</a>
    </div>

    <p style="color:#374151;font-size:11px;text-align:center;margin:16px 0 0;">FOReversports · Kontobenachrichtigung</p>
  </div>
</body>
</html>
```

- [ ] **Step 2: Test laufen lassen**

```bash
pytest tests/backend/test_email_templates.py::test_account_activated_renders -v
```

Erwartetes Ergebnis: PASSED.

- [ ] **Step 3: Committen**

```bash
git add backend/templates/email/account_activated.html
git commit -m "feat: redesign account_activated email template"
```

---

### Task 5: `account_deactivated.html` + email.py-Update

Dieses Template bekommt neu `frontend_url` als Variable (wird für das Logo benötigt). Dazu muss `email.py` angepasst werden, das die Variable bisher nicht übergibt.

**Files:**
- Modify: `backend/templates/email/account_deactivated.html`
- Modify: `backend/core/email.py`

- [ ] **Step 1: Template ersetzen**

Ersetze den gesamten Inhalt von `backend/templates/email/account_deactivated.html`:

```html
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Konto deaktiviert</title>
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
      <p style="color:#f1f5f9;font-size:18px;font-weight:600;margin:0 0 12px;">Konto deaktiviert</p>
      <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:0 0 0;">Dein Konto wurde deaktiviert. Wende dich an einen Admin, falls du Fragen hast.</p>
    </div>

    <p style="color:#374151;font-size:11px;text-align:center;margin:16px 0 0;">FOReversports · Kontobenachrichtigung</p>
  </div>
</body>
</html>
```

- [ ] **Step 2: email.py — `frontend_url` an account_deactivated übergeben**

In `backend/core/email.py` gibt es zwei Stellen, an denen `account_deactivated.html` gerendert wird. Beide müssen `frontend_url=frontend_url` erhalten.

Ändere in `send_account_status_email` (Zeile mit `account_deactivated.html`):

```python
# Vorher:
html = _templates.get_template("account_deactivated.html").render()

# Nachher:
html = _templates.get_template("account_deactivated.html").render(frontend_url=frontend_url)
```

Ändere in `send_test_email` (Zeile mit `account_deactivated.html`):

```python
# Vorher:
html = _templates.get_template("account_deactivated.html").render()

# Nachher:
html = _templates.get_template("account_deactivated.html").render(frontend_url=frontend_url)
```

(`frontend_url` ist in beiden Funktionen bereits als lokale Variable vorhanden.)

- [ ] **Step 3: Tests laufen lassen**

```bash
pytest tests/backend/test_email_templates.py::test_account_deactivated_renders -v
```

Erwartetes Ergebnis: PASSED.

- [ ] **Step 4: Alle bisherigen Tests prüfen**

```bash
pytest tests/backend/test_email_templates.py -v
```

Erwartetes Ergebnis: 5 von 7 Tests PASSED (worker-Tests noch ausstehend).

- [ ] **Step 5: Committen**

```bash
git add backend/templates/email/account_deactivated.html backend/core/email.py
git commit -m "feat: redesign account_deactivated email template, pass frontend_url"
```

---

### Task 6: `new_user_notification.html` + email.py-Update

Dieses Template bekommt neu `frontend_url` als Variable (für das Logo). `email.py` übergibt es bisher nicht.

**Files:**
- Modify: `backend/templates/email/new_user_notification.html`
- Modify: `backend/core/email.py`

- [ ] **Step 1: Template ersetzen**

Ersetze den gesamten Inhalt von `backend/templates/email/new_user_notification.html`:

```html
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Neuer Benutzer wartet auf Freigabe</title>
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
      <p style="color:#f1f5f9;font-size:18px;font-weight:600;margin:0 0 12px;">Neuer Benutzer wartet auf Freigabe</p>
      <div style="background:#031a1d;border-left:3px solid #004349;border-radius:0 5px 5px 0;padding:10px 14px;margin:0 0 16px;font-size:13px;color:#94a3b8;">
        <strong style="color:#cbd5e1;">{{ new_user_email }}</strong><br>
        Registriert am {{ now }} Uhr
      </div>
      <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:0 0 20px;">Ein neuer Benutzer hat sich registriert und wartet auf deine Freigabe.</p>
      <a href="{{ users_url }}" style="display:inline-block;background:#004349;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:10px 22px;border-radius:8px;">Zur Benutzerverwaltung →</a>
    </div>

    <p style="color:#374151;font-size:11px;text-align:center;margin:16px 0 0;">FOReversports · Admin-Benachrichtigung</p>
  </div>
</body>
</html>
```

- [ ] **Step 2: email.py — `frontend_url` an new_user_notification übergeben**

In `backend/core/email.py` gibt es zwei Stellen, an denen `new_user_notification.html` gerendert wird.

Ändere in `send_new_user_notification`:

```python
# Vorher:
html = _templates.get_template("new_user_notification.html").render(
    new_user_email=new_user_email,
    now=now,
    users_url=users_url,
)

# Nachher:
html = _templates.get_template("new_user_notification.html").render(
    new_user_email=new_user_email,
    now=now,
    users_url=users_url,
    frontend_url=frontend_url,
)
```

Ändere in `send_test_email` (new_user-Branch):

```python
# Vorher:
html = _templates.get_template("new_user_notification.html").render(
    new_user_email="test@example.com",
    now=now,
    users_url=users_url,
)

# Nachher:
html = _templates.get_template("new_user_notification.html").render(
    new_user_email="test@example.com",
    now=now,
    users_url=users_url,
    frontend_url=frontend_url,
)
```

(`frontend_url` ist in beiden Funktionen bereits als lokale Variable vorhanden.)

- [ ] **Step 3: Tests laufen lassen**

```bash
pytest tests/backend/test_email_templates.py::test_new_user_notification_renders -v
```

Erwartetes Ergebnis: PASSED.

- [ ] **Step 4: Committen**

```bash
git add backend/templates/email/new_user_notification.html backend/core/email.py
git commit -m "feat: redesign new_user_notification email template, pass frontend_url"
```

---

### Task 7: Worker-Templates

Die Worker-Templates für `booking_failure` und `debug_cancel_failure` sind inhaltlich identisch mit den Backend-Versionen.

**Files:**
- Modify: `worker/templates/email/booking_failure.html`
- Modify: `worker/templates/email/debug_cancel_failure.html`

- [ ] **Step 1: Worker booking_failure.html ersetzen**

Ersetze den Inhalt von `worker/templates/email/booking_failure.html` mit demselben HTML wie in Task 2 (identische Datei):

```html
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Buchung fehlgeschlagen</title>
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
      <p style="color:#f1f5f9;font-size:18px;font-weight:600;margin:0 0 12px;">Buchung fehlgeschlagen</p>
      <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:0 0 16px;">Deine automatische Buchung konnte nicht durchgeführt werden.</p>
      <div style="background:#021214;border-radius:6px;padding:12px 16px;margin:0 0 16px;font-size:13px;color:#94a3b8;line-height:2;">
        <strong style="color:#cbd5e1;">Kurs</strong>&nbsp;&nbsp;{{ class_name }} — {{ time_str }} Uhr<br>
        <strong style="color:#cbd5e1;">Tag&nbsp;&nbsp;</strong>&nbsp;{{ weekday_str }}, {{ date_str }}<br>
        <strong style="color:#cbd5e1;">Ort&nbsp;&nbsp;</strong>&nbsp;{{ facility_name }}
      </div>
      <div style="background:#1a0a0a;border-left:3px solid #f87171;border-radius:0 5px 5px 0;padding:10px 14px;margin:0 0 16px;font-size:13px;color:#f87171;font-family:monospace;">{{ error_message }}</div>
      <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:0 0 20px;">Der Job ist weiterhin aktiv und wird beim nächsten Versuch erneut ausgeführt.</p>
      <a href="{{ frontend_url }}" style="display:inline-block;background:#004349;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:10px 22px;border-radius:8px;">Zur App →</a>
    </div>

    <p style="color:#374151;font-size:11px;text-align:center;margin:16px 0 0;">FOReversports · Automatische Buchungsbenachrichtigung</p>
  </div>
</body>
</html>
```

- [ ] **Step 2: Worker debug_cancel_failure.html ersetzen**

Ersetze den Inhalt von `worker/templates/email/debug_cancel_failure.html` mit demselben HTML wie in Task 3:

```html
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Debug-Stornierung fehlgeschlagen</title>
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
      <p style="color:#f1f5f9;font-size:18px;font-weight:600;margin:0 0 12px;">Debug-Stornierung fehlgeschlagen</p>
      <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:0 0 16px;">Die Debug-Buchung wurde erfolgreich gebucht, konnte aber nicht automatisch storniert werden.</p>
      <div style="background:#021214;border-radius:6px;padding:12px 16px;margin:0 0 16px;font-size:13px;color:#94a3b8;line-height:2;">
        <strong style="color:#cbd5e1;">Kurs</strong>&nbsp;&nbsp;{{ class_name }} — {{ time_str }} Uhr<br>
        <strong style="color:#cbd5e1;">Tag&nbsp;&nbsp;</strong>&nbsp;{{ weekday_str }}, {{ date_str }}<br>
        <strong style="color:#cbd5e1;">Ort&nbsp;&nbsp;</strong>&nbsp;{{ facility_name }}
      </div>
      <div style="background:#1a0a0a;border-left:3px solid #f87171;border-radius:0 5px 5px 0;padding:10px 14px;margin:0 0 16px;font-size:13px;color:#f87171;font-family:monospace;">{{ error_message }}</div>
      <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:0 0 20px;">Bitte storniere die Buchung manuell auf Eversports.</p>
      <a href="{{ frontend_url }}" style="display:inline-block;background:#004349;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:10px 22px;border-radius:8px;">Zur App →</a>
    </div>

    <p style="color:#374151;font-size:11px;text-align:center;margin:16px 0 0;">FOReversports · Automatische Buchungsbenachrichtigung</p>
  </div>
</body>
</html>
```

- [ ] **Step 3: Alle Tests laufen lassen**

```bash
pytest tests/backend/test_email_templates.py -v
```

Erwartetes Ergebnis: alle 7 Tests PASSED.

- [ ] **Step 4: Gesamte Test-Suite prüfen**

```bash
pytest tests/ -x
```

Erwartetes Ergebnis: alle Tests PASSED, keine Regressionen.

- [ ] **Step 5: Committen**

```bash
git add worker/templates/email/booking_failure.html worker/templates/email/debug_cancel_failure.html
git commit -m "feat: redesign worker email templates"
```
