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
* Nach jedem Verarbeitungsversuch (Erfolg, Fehler, already_booked, verpasst) wird `next_run_at` weitergeschaltet — ein Slot wird genau einmal versucht. Weitergeschaltet wird ab `max(now, next_run_at)`, damit ein vorzeitig geclaimter Job nicht denselben Slot erneut plant.
* Sekundengenaues Buchen: Ein Lauf claimt auch Jobs mit `next_run_at <= now + LOOKAHEAD` (15 Min), loggt vorab ein (`prepare_booking`), wartet bis zum geplanten Zeitpunkt und hält währenddessen den Row-Lock. Deshalb läuft der CronJob mit `concurrencyPolicy: Allow` — parallele Läufe sichert ausschließlich `SKIP LOCKED` ab.
* Wiederholungen in `book_session` (`attempts`) nur bei `SlotNotFound`/`CartRejected`, also **vor** der Order-Erstellung — nie nach einem möglicherweise erfolgreichen Order-Call.
* Der Kurstag eines Laufs wird nur über `class_date_for_run()` (`backend/core/schedule.py`) abgeleitet (Worker und Job-Vorschau `next_class_date`).

### Worker-Heartbeat

* Jeder Worker-Lauf schreibt Start/Ende in `worker_heartbeats` (`backend/core/heartbeat.py`). Der Backend-Watchdog (`backend/main.py`, alle 5 Min) mailt aktiven Admins einmal pro Ausfall, wenn > 35 Min kein Start; der Claim läuft per bedingtem UPDATE auf `alert_sent_at` (mehrere Replikas). Tests setzen `WORKER_WATCHDOG_INTERVAL_SECONDS=0`.

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

## DB-Migrationen lokal ausführen

Die lokale Datenbank liegt unter `eversports.db` im Projektwurzel-Verzeichnis (wird von `upgrade head` angelegt).

Alle Migrationen einspielen:

```bash
DATABASE_URL=sqlite:///eversports.db \
  alembic -c backend/alembic.ini upgrade head
```

Neue Migration erstellen (autogenerate):

```bash
DATABASE_URL=sqlite:///eversports.db \
  alembic -c backend/alembic.ini revision --autogenerate -m "beschreibung"
```

## Tests ausführen

```bash
pytest tests/ -x
```

Standardmäßig läuft die Suite gegen SQLite. Mit `TEST_DATABASE_URL` läuft sie gegen PostgreSQL (macht die CI zusätzlich, um Produktions-DB-Verhalten wie `FOR UPDATE SKIP LOCKED` abzudecken):

```bash
TEST_DATABASE_URL=postgresql://test:test@localhost:5432/eversports_test pytest tests/ -x
```

## E-Mail-Templates

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
| `WORKER_LOOKAHEAD_MINUTES` | — | Worker: Vorlauf fürs sekundengenaue Buchen (Default 15 = CronJob-Intervall) |
| `WORKER_WATCHDOG_INTERVAL_SECONDS` | — | Backend: Intervall der Heartbeat-Prüfung (Default 300, `0` = aus) |
| `DB_POOL_SIZE` / `DB_MAX_OVERFLOW` | — | Connection-Pool (nur PostgreSQL); der Worker setzt `DB_MAX_OVERFLOW` per Default auf 35 |
