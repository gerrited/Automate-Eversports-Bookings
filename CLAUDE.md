# CLAUDE.md

## Wichtige Informationen

* Benutzer planen mit dem Frontend Buchungen von Sportterminen bei der Plattform Eversports. Das Backend speichert die geplanten Buchungen in der Datenbank (Tabelle `booking_jobs`), der Worker führt sie aus.
* Das Backend bietet eine Web API mit JWT-Authentifizierung (Details in `SECURITY.md`) und speichert Daten in PostgreSQL. Lokal wird SQLite verwendet.
* Ein Worker (läuft als Kubernetes CronJob alle 15 Minuten) führt fällige Buchungen automatisch beim Anbieter (z.B. ein Fitnessstudio oder ein Sportverein) durch.
* Der erste registrierte Benutzer wird automatisch Admin. Weitere Benutzer müssen von einem Admin freigeschaltet werden.
* Das `debug`-Flag auf einer Buchung aktiviert den Testmodus: die Buchung wird direkt nach Ausführung wieder storniert. Nur für Admins sichtbar.

## Projekt lokal starten

### Backend

```bash
# Abhängigkeiten installieren
pip install -r requirements-backend.txt

# Umgebungsvariablen setzen und Server starten
DATABASE_URL=sqlite:///eversports.db \
  JWT_SECRET=test-secret \
  ENCRYPTION_KEY=$(python -c 'import os; print(os.urandom(32).hex())') \
  FRONTEND_URL=http://localhost:5173 \
  uvicorn backend.main:app --reload
```

Der Server läuft auf `http://localhost:8000`. Swagger UI: `http://localhost:8000/docs`.

`RESEND_API_KEY` und `FROM_EMAIL` sind optional — ohne sie funktioniert alles, nur ohne E-Mail-Benachrichtigungen.

### Frontend

```bash
cd frontend
npm install
npm run dev   # http://localhost:5173
```

Vite proxied `/api/` automatisch auf `http://localhost:8000` (konfiguriert in `vite.config.ts`).

## DB-Migrationen lokal ausführen

Die lokale Datenbank liegt unter `eversports.db` im Projektwurzel-Verzeichnis.

### SQLite-Datenbank erstellen (einmalig)

Falls `eversports.db` noch nicht existiert, wird sie automatisch beim ersten Ausführen von `upgrade head` erstellt. Alternativ explizit anlegen:

```bash
touch eversports.db
```

Danach alle Migrationen einspielen:

```bash
DATABASE_URL=sqlite:///eversports.db \
  alembic -c backend/alembic.ini upgrade head
```

Neue Migration erstellen (autogenerate):

```bash
DATABASE_URL=sqlite:///eversports.db \
  alembic -c backend/alembic.ini revision --autogenerate -m "beschreibung"
```

Aktuellen Stand prüfen:

```bash
DATABASE_URL=sqlite:///eversports.db \
  alembic -c backend/alembic.ini current
```

In der Produktion führt das Backend-Dockerfile `alembic upgrade head` automatisch beim Start aus.

## Tests ausführen

### Backend

```bash
pytest tests/ -x
```

### Frontend

```bash
cd frontend && npm test
```

## E-Mail-Templates

E-Mail-Templates werden als Jinja2-HTML-Dateien gespeichert (`{{ variable }}`-Syntax, autoescape aktiviert).

| Template-Datei | Verwendet in | Variablen |
|---|---|---|
| `backend/templates/email/new_user_notification.html` | Backend + Test-Mail | `new_user_email`, `now`, `users_url` |
| `backend/templates/email/account_activated.html` | Backend + Test-Mail | `frontend_url` |
| `backend/templates/email/account_deactivated.html` | Backend + Test-Mail | — |
| `backend/templates/email/booking_failure.html` | Test-Mail | `class_name`, `time_str`, `weekday_str`, `date_str`, `facility_name`, `error_message`, `frontend_url` |
| `backend/templates/email/debug_cancel_failure.html` | Test-Mail | wie `booking_failure` |
| `worker/templates/email/booking_failure.html` | Worker | wie oben |
| `worker/templates/email/debug_cancel_failure.html` | Worker | wie oben |

Neue E-Mails: Template unter `backend/templates/email/` oder `worker/templates/email/` anlegen, dann in `backend/core/email.py` bzw. `worker/email.py` mit `_templates.get_template("name.html").render(...)` rendern.

## Umgebungsvariablen

| Variable | Pflicht | Beschreibung |
|----------|---------|--------------|
| `DATABASE_URL` | ✓ | PostgreSQL oder SQLite, z.B. `sqlite:///eversports.db` |
| `JWT_SECRET` | ✓ | Beliebiger geheimer String zum Signieren von JWTs |
| `ENCRYPTION_KEY` | ✓ | 64 Hex-Zeichen (32 Bytes), generieren mit: `python -c 'import os; print(os.urandom(32).hex())'` |
| `FRONTEND_URL` | ✓ | CORS-Origin, z.B. `http://localhost:5173` |
| `RESEND_API_KEY` | — | E-Mail-Versand via Resend (optional, ohne keine E-Mails) |
| `FROM_EMAIL` | — | Absender-Adresse für E-Mails (optional) |
