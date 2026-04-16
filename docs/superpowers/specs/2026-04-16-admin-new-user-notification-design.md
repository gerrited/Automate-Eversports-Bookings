# Design: Admin-Email bei neuer User-Registrierung

**Datum:** 2026-04-16

## Kontext

Wenn sich ein neuer User das erste Mal mit seinen Eversports-Credentials anmeldet, wird er in der DB angelegt — aber inaktiv. Admins müssen ihn manuell freischalten. Aktuell bekommen Admins keine Benachrichtigung und müssen das Admin-Panel aktiv prüfen. Ziel ist es, alle aktiven Admins automatisch per Email zu informieren.

## Trigger

`POST /api/auth/login` in `backend/api/auth.py:24-35` — genau dann, wenn:
- `user is None` (User existiert noch nicht in der DB) **und**
- `not is_first_user` (d.h. nicht der erste User, der automatisch Admin wird)

## Ansatz

Neues Modul `backend/core/email.py` mit der Funktion `send_new_user_notification(admin_emails, new_user_email)`. Wird direkt nach `db.commit()` in `auth.py` aufgerufen. Best-effort: Fehler werden geloggt, nicht propagiert.

## Komponenten

### `backend/core/email.py` (neu)
```python
send_new_user_notification(admin_emails: list[str], new_user_email: str) -> None
```
- Ruft Resend API auf
- Liest `RESEND_API_KEY` und `FROM_EMAIL` aus Env-Vars
- Catchall try/except — kein Crash bei Email-Fehlern

### `backend/api/auth.py` (geändert)
Nach User-Erstellung wenn `not is_first_user`:
1. Alle aktiven Admins abfragen: `db.query(User).filter(User.role == "admin", User.active == True).all()`
2. `send_new_user_notification([a.email for a in admins], req.email)` aufrufen

### `k8s/backend-deployment.yaml` (geändert)
`RESEND_API_KEY` und `FROM_EMAIL` als Secret-Refs ergänzen (analog zu `worker-cronjob.yaml`).

### `k8s/backend-secret.yaml.template` (geändert)
Bereits vorhanden mit den neuen Keys — kein weiterer Änderungsbedarf.

## Email-Inhalt

**Betreff:** `Neuer User: {new_user_email}`

**Body:**
> Ein neuer User hat sich registriert und wartet auf Freigabe.
>
> **Email:** user@example.com
> **Registriert am:** 16.04.2026 14:32 Uhr

## Fehlerbehandlung

- Email-Fehler: `log.error(...)`, kein Exception-Propagation
- Keine Admins in DB: kein Versand, kein Fehler
- Login-Flow bleibt in beiden Fällen unberührt

## Tests (`tests/backend/test_api_auth.py`)

- Email wird gesendet wenn neuer nicht-Admin User angelegt wird
- Email wird **nicht** gesendet beim ersten User (Admin-Erstellung)
- Email wird **nicht** gesendet bei erneutem Login eines bestehenden Users
- Login-Response ist 403 (inaktiv) — Email wurde trotzdem gesendet
- Login schlägt nicht fehl wenn Email-Versand scheitert
