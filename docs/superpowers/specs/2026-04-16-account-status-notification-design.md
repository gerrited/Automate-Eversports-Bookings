# Design: Email bei Konto-Freischaltung und -Deaktivierung

**Datum:** 2026-04-16

## Kontext

Wenn ein Admin ein Konto freischaltet oder deaktiviert, bekommt der betroffene User aktuell keine Benachrichtigung. Ziel ist eine sachliche Info-Email bei jeder Statusänderung.

## Trigger

`PATCH /admin/users/{user_id}/active` in `backend/api/admin.py:41-64` — direkt nach `db.commit()` und `db.refresh(user)`.

## Ansatz

Neue Funktion `send_account_status_email(user_email, is_active)` in das bestehende Modul `backend/core/email.py`. Aufgerufen aus `admin.py` nach dem Commit. Best-effort: try/except, nie propagiert. Keine neuen Env-Vars — `RESEND_API_KEY` und `FROM_EMAIL` sind bereits im Backend-Deployment gemountet.

## Email-Inhalt

**Freischaltung (`is_active=True`):**
- Betreff: `Dein Konto wurde freigeschaltet`
- Body: Dein Konto für FOReversports wurde freigeschaltet. Du kannst dich ab sofort anmelden.

**Deaktivierung (`is_active=False`):**
- Betreff: `Dein Konto wurde deaktiviert`
- Body: Dein Konto für FOReversports wurde deaktiviert. Wende dich an einen Admin, falls du Fragen hast.

## Fehlerbehandlung

- Email-Fehler: `log.error(...)`, kein Exception-Propagation
- Endpoint antwortet immer mit 200, unabhängig vom Email-Status
- Wenn User nicht gefunden (404): kein Email-Versand

## Komponenten

### `backend/core/email.py` (erweitert)
```python
def send_account_status_email(user_email: str, is_active: bool) -> None
```

### `backend/api/admin.py` (geändert)
Nach `db.refresh(user)` im `set_user_active`-Endpoint:
```python
try:
    send_account_status_email(user.email, user.active)
except Exception as exc:
    log.error("Failed to send account status email: %s", exc)
```

## Tests (`tests/backend/test_api_admin.py`)

- Email wird bei Freischaltung mit `is_active=True` aufgerufen
- Email wird bei Deaktivierung mit `is_active=False` aufgerufen
- Endpoint gibt 200 zurück auch wenn Email-Versand scheitert
- Kein Email-Versand wenn User nicht existiert (404-Fall)
