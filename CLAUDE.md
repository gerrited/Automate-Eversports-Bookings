# CLAUDE.md

## Wichtige Informationen

* Benutzer planen mit dem Frontend Buchungen von Sportterminen bei der Plattform Eversports. Das Backend speichert die geplanten Buchungen in der Datenbank (Tabelle `booking_jobs`), der Worker führt sie aus.
* Das Backend bietet eine Web API mit JWT-Authentifizierung (Details in `SECURITY.md`) und speichert Daten in PostgreSQL. Lokal wird SQLite verwendet.
* Ein Worker (läuft als Kubernetes CronJob alle 15 Minuten) führt fällige Buchungen automatisch beim Anbieter (z.B. ein Fitnessstudio oder ein Sportverein) durch.
* Der erste registrierte Benutzer wird automatisch Admin. Weitere Benutzer müssen von einem Admin freigeschaltet werden.
* Das `debug`-Flag auf einer Buchung aktiviert den Testmodus: die Buchung wird direkt nach Ausführung wieder storniert. Nur für Admins sichtbar.

## Architektur-Invarianten

Diese Regeln müssen bei Änderungen erhalten bleiben:

### Scheduling (`next_run_at`)

* Fälligkeit ist **Datenmodell, kein Zeitvergleich**: Jeder Job trägt seinen nächsten Lauf in `booking_jobs.next_run_at` (UTC). Der Worker wählt Jobs per `next_run_at <= now` und claimt sie mit `FOR UPDATE SKIP LOCKED` (greift nur auf PostgreSQL; SQLite kennt kein `FOR UPDATE`).
* `compute_next_run()` in `backend/core/schedule.py` ist die einzige Stelle, die Lauf-Zeitpunkte berechnet (Europe/Berlin, DST-fest). Semantik: Lauf um `target_time` an dem Tag, der `days_in_advance` Tage vor dem Kurstag (`weekday`) liegt.
* **Jeder Code-Pfad, der einen Job anlegt oder Scheduling-Felder (`weekday`, `target_time`, `days_in_advance`) ändert oder einen Job reaktiviert, muss `next_run_at` neu berechnen** (siehe `backend/api/jobs.py`).
* `next_run_at = NULL` heißt „noch nicht berechnet": Der Worker initialisiert solche Jobs beim nächsten Lauf, ohne rückwirkend zu buchen.
* Verpasste Läufe werden nachgeholt, solange der Kurstermin in der Zukunft liegt; `target_date` leitet sich vom **geplanten** Lauf ab (`next_run_at`), nie von `now`.
* Nach jedem Verarbeitungsversuch (Erfolg, Fehler, already_booked, verpasst) wird `next_run_at` weitergeschaltet — ein Slot wird genau einmal versucht.

### Status & Verschlüsselung

* Buchungsstatus immer über das Enum `BookingStatus` (`backend/core/status.py`) referenzieren, nie als freier String.
* `encrypt()`/`decrypt()` (`backend/core/encryption.py`) verlangen `aad=eversports_user_id` — der Ciphertext ist an den Nutzer gebunden. Bestandsdaten ohne AAD werden per Fallback entschlüsselt und beim nächsten Login migriert.

### Eversports-Zugriff

* `backend/eversports/` ist der **einzige** Code, der die Eversports-Plattform berührt. Neue Plattform-Interaktionen gehören dorthin, nie in API-Handler oder den Worker.
* Fehlertext-Klassifikation (lokalisierte Strings) ausschließlich in `backend/eversports/classify.py` — Keyword-Änderungen immer mit Test.
* HTML-Parsing ausschließlich in `backend/eversports/parsing.py` (reine Funktionen, Contract-Fixtures in `tests/eversports/fixtures/`). `MarkupDrift` heißt: Eversports hat das Markup geändert.

### Auth

* Der Refresh-Token existiert **ausschließlich** als httpOnly-Cookie (Pfad `/api/auth/refresh`). Niemals im Response-Body zurückgeben oder im `localStorage` speichern; der Refresh-Endpoint akzeptiert nur das Cookie.
* `/api/auth/login` ist rate-limitiert (`login_limiter` in `backend/api/auth.py`, 10 Versuche / 5 Min pro IP). Die Test-conftest resettet Limiter und Kalender-Feed-Cache pro Test.
* Der Kalender-Feed cacht Buchungen 15 Min pro Nutzer (`bookings_cache` in `backend/api/calendar.py`); Fehler werden nicht gecacht.

### Migrationen & CI

* Alembic-Migrationen müssen auch auf SQLite laufen: für Constraints/ALTER-Operationen `op.batch_alter_table()` verwenden (siehe Migration `b2c3d4e5f6a7`).
* Die CI (`.github/workflows/ci.yml`) läuft auf Push nach `main` **und** auf Pull Requests: Backend-Tests gegen SQLite und PostgreSQL (Service-Container, `TEST_DATABASE_URL`), Frontend-Tests (Node 24). Der Image-Build läuft nur auf `main`-Pushes.

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

Standardmäßig läuft die Suite gegen SQLite. Mit `TEST_DATABASE_URL` läuft sie gegen PostgreSQL (macht die CI zusätzlich, um Produktions-DB-Verhalten wie `FOR UPDATE SKIP LOCKED` abzudecken):

```bash
TEST_DATABASE_URL=postgresql://test:test@localhost:5432/eversports_test pytest tests/ -x
```

### Frontend

```bash
cd frontend && npm test
```

## E-Mail-Templates

E-Mail-Templates werden als Jinja2-HTML-Dateien gespeichert (`{{ variable }}`-Syntax, autoescape aktiviert).

| Template-Datei | Verwendet in | Variablen |
|---|---|---|
| `backend/templates/email/new_user_notification.html` | Backend + Test-Mail | `new_user_email`, `now`, `users_url`, `frontend_url` |
| `backend/templates/email/account_activated.html` | Backend + Test-Mail | `frontend_url` |
| `backend/templates/email/account_deactivated.html` | Backend + Test-Mail | `frontend_url` |
| `backend/templates/email/admin_message.html` | Backend | `subject`, `content`, `frontend_url` |
| `backend/templates/email/booking_failure.html` | Test-Mail | `class_name`, `time_str`, `weekday_str`, `date_str`, `facility_name`, `error_message`, `frontend_url` |
| `backend/templates/email/debug_cancel_failure.html` | Test-Mail | wie `booking_failure` |
| `worker/templates/email/booking_failure.html` | Worker | wie oben |
| `worker/templates/email/admin_booking_failure.html` | Worker | `user_email`, `job_id`, wie `booking_failure` |
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
