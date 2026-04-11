# Multi-User Eversports Booking Platform — Design Spec

**Datum:** 2026-04-11  
**Status:** Approved

---

## Kontext

Das bestehende System bucht CrossFit-Kurse bei Eversports über hartcodierte K8s CronJobs mit festen Umgebungsvariablen. Ziel ist es, daraus eine Multi-User-Plattform zu bauen: Nutzer loggen sich mit ihren Eversports-Zugangsdaten ein, verwalten ihre eigenen Buchungs-Jobs über ein Web-Frontend, und ein stündlicher Worker führt fällige Buchungen automatisch durch.

Das Projekt wird als Sub-Projekt 1 von 3 behandelt. Dieser Spec umfasst das gesamte System (Backend, Frontend, Worker), da alle Teile eng gekoppelt sind.

---

## Architektur

**3 Container auf dem bestehenden Kubernetes-Cluster:**

| Container | Technologie | K8s-Ressource |
|-----------|-------------|---------------|
| `frontend` | React + Vite + Tailwind, nginx | Deployment + Service + Ingress |
| `backend` | Python 3.12, FastAPI, SQLAlchemy | Deployment + Service |
| `worker` | Python 3.12, nutzt `backend/core/` | CronJob (`0 * * * *`) |

**Externe Dienste:**
- PostgreSQL (extern gehostet) — verbunden per `DATABASE_URL` K8s Secret
- Eversports API (`https://www.eversports.de/api/`) — GraphQL + Kalender-Endpunkt

**Repo-Struktur** (erweitertes bestehendes Repo):

```
backend/
  core/           # adaptierte book.py-Logik: login, find_session_uuid, create_cart, confirm_booking
  api/            # FastAPI-Routes (auth, jobs, logs)
  models/         # SQLAlchemy-Modelle (User, BookingJob, BookingLog)
  schemas/        # Pydantic-Schemas
  db.py           # DB-Session, Alembic-Konfiguration
  main.py         # FastAPI-App, CORS, Router-Registrierung
frontend/
  src/
    components/   # JobCard, JobModal, LogDrawer, LoginForm
    pages/        # LoginPage, DashboardPage
    api/          # API-Client (fetch-Wrapper mit JWT)
  index.html
  vite.config.ts
worker/
  worker.py       # Stündlicher Job-Scheduler, nutzt backend/core/
k8s/
  cronjob.yaml              # bestehend, bleibt für Standalone-Betrieb
  backend-deployment.yaml
  frontend-deployment.yaml
  worker-cronjob.yaml       # schedule: "0 * * * *"
book.py                     # bestehend, bleibt als Standalone-Script
```

---

## Datenmodell (PostgreSQL)

### `users`

| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| `id` | UUID PK | |
| `eversports_user_id` | TEXT UNIQUE | User-ID aus Eversports-Login-Response |
| `email` | TEXT UNIQUE | Eversports E-Mail-Adresse |
| `encrypted_password` | TEXT | AES-256-verschlüsseltes Passwort |
| `created_at` | TIMESTAMPTZ | |

### `booking_jobs`

| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| `id` | UUID PK | |
| `user_id` | UUID FK → users | |
| `weekday` | INTEGER | 0=Montag … 6=Sonntag |
| `target_time` | TIME | Kursstart, z.B. `18:00` |
| `facility_id` | TEXT | Eversports Facility-ID, z.B. `"73041"` |
| `class_name` | TEXT | Kursname-Filter, z.B. `"CrossFit"` |
| `days_in_advance` | INTEGER | Wie viele Tage vor dem Kurs gebucht wird, z.B. `4` |
| `enabled` | BOOLEAN | Default `true` |
| `created_at` | TIMESTAMPTZ | |

### `booking_logs`

| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| `id` | UUID PK | |
| `job_id` | UUID FK → booking_jobs | |
| `executed_at` | TIMESTAMPTZ | Zeitpunkt der Worker-Ausführung |
| `target_date` | DATE | Datum des gebuchten Kurses |
| `status` | TEXT | `success` / `failed` / `already_booked` |
| `message` | TEXT | Order-ID bei Erfolg, Fehlermeldung bei Fehler |

Migrationen werden mit **Alembic** verwaltet.

---

## Authentifizierung

Eversports fungiert als einziger Identity Provider — es gibt kein eigenes Passwort-System.

**Login-Flow:**
1. User sendet E-Mail + Passwort ans Backend (`POST /api/auth/login`)
2. Backend ruft Eversports GraphQL-Mutation `LoginCredentialLogin` auf (identisch mit `book.py`)
3. Bei Fehler: `401` ans Frontend
4. Bei Erfolg: Eversports `user.id` aus Response entnehmen
5. User in DB anlegen (neu) oder aktualisieren (Passwort aktualisieren, falls geändert)
6. Passwort AES-256-verschlüsselt speichern (Key aus K8s Secret `ENCRYPTION_KEY`)
7. JWT (24h, HS256) mit `user_id` als Subject ausstellen und ans Frontend zurückgeben

Das Frontend speichert den JWT im `localStorage` und sendet ihn als `Authorization: Bearer <token>` Header bei allen API-Calls. Jeder API-Endpunkt prüft den Token und gibt nur Daten des eingeloggten Users zurück.

---

## Backend API (FastAPI)

Alle Endpunkte außer `/api/auth/login` erfordern einen gültigen JWT.

| Methode | Endpunkt | Beschreibung |
|---------|----------|--------------|
| `POST` | `/api/auth/login` | Eversports-Login → JWT |
| `GET` | `/api/jobs` | Alle Jobs des eingeloggten Users |
| `POST` | `/api/jobs` | Job erstellen |
| `PUT` | `/api/jobs/{id}` | Job bearbeiten |
| `PATCH` | `/api/jobs/{id}/toggle` | Job aktivieren / deaktivieren |
| `DELETE` | `/api/jobs/{id}` | Job löschen |
| `GET` | `/api/jobs/{id}/logs` | Letzte 20 Ausführungen eines Jobs |

Ownership-Prüfung: Vor jedem Zugriff auf einen Job wird `job.user_id == current_user.id` geprüft, sonst `403`.

---

## Worker

Der Worker ist ein eigenständiges Python-Script (`worker/worker.py`), das als K8s CronJob stündlich (`0 * * * *`) läuft. Er importiert die Buchungslogik aus `backend/core/`.

**Ablauf pro Lauf:**
1. Alle aktiven Jobs laden: `SELECT * FROM booking_jobs WHERE enabled = true`
2. Für jeden Job: `target_date = today + days_in_advance`
3. Fällig, wenn `target_date.weekday() == job.weekday`
4. Nicht fällig → überspringen
5. Prüfen ob bereits erfolgreich gebucht: `booking_logs` nach `job_id + target_date + status='success'`
6. Bereits gebucht → überspringen (verhindert Doppelbuchungen bei Worker-Neustart)
7. Passwort entschlüsseln → `login()` → `find_session_uuid()` → `create_cart()` → `confirm_booking()`
8. Ergebnis in `booking_logs` schreiben (`success` + Order-ID, `already_booked`, oder `failed` + Fehlermeldung)

Der Worker bricht bei einem Fehler in einem Job nicht ab — er loggt den Fehler und fährt mit dem nächsten Job fort.

---

## Frontend (React + Vite + Tailwind)

**Screens:**

| Route | Beschreibung |
|-------|--------------|
| `/login` | E-Mail + Passwort Formular, leitet nach Login zu `/dashboard` |
| `/dashboard` | Job-Cards, "+ Buchung hinzufügen"-Button, Logout |

**Komponenten:**

- **`JobCard`** — zeigt Wochentag, Uhrzeit, Kursname, letzten Status (✓ / ✗), Enable/Disable-Toggle, Edit- und Delete-Buttons. Klick auf die Karte öffnet den `LogDrawer`.
- **`JobModal`** — Modal-Dialog für Erstellen und Bearbeiten eines Jobs. Felder: Wochentag (Dropdown), Uhrzeit, Kursname, Facility ID, Tage im Voraus.
- **`LogDrawer`** — Seitlicher Drawer mit den letzten 20 Ausführungen des Jobs (Datum, Status, Meldung).
- **`LoginForm`** — E-Mail + Passwort, Fehleranzeige bei fehlgeschlagenem Eversports-Login.

---

## Sicherheit

- **Passwort-Verschlüsselung:** AES-256 (Fernet/cryptography-Bibliothek). `ENCRYPTION_KEY` als K8s Secret, gemountet in Backend und Worker.
- **JWT:** HS256, 24h TTL. Secret als K8s Secret `JWT_SECRET`.
- **Datenisolierung:** Jeder API-Endpunkt prüft `user_id` — kein User kann Jobs anderer User sehen oder bearbeiten.
- **HTTPS:** Via K8s Ingress (TLS-Terminierung).
- **CORS:** Backend erlaubt nur die Frontend-Origin.

---

## Kubernetes-Ressourcen (neu)

| Datei | Ressource |
|-------|-----------|
| `k8s/backend-deployment.yaml` | Deployment + Service, env: `DATABASE_URL`, `ENCRYPTION_KEY`, `JWT_SECRET` |
| `k8s/frontend-deployment.yaml` | Deployment + Service + Ingress |
| `k8s/worker-cronjob.yaml` | CronJob `0 * * * *`, env: `DATABASE_URL`, `ENCRYPTION_KEY` |

Die bestehende `k8s/cronjob.yaml` bleibt unverändert für den Standalone-Betrieb.

---

## Verifikation

1. **Backend lokal:** `uvicorn backend.main:app --reload` → `POST /api/auth/login` mit echten Eversports-Credentials testen
2. **Worker lokal:** `python worker/worker.py` → prüfen ob Jobs korrekt erkannt und gebucht werden
3. **Frontend lokal:** `npm run dev` in `frontend/` → Login-Flow, Job anlegen, Toggle, Log-Drawer testen
4. **K8s:** `kubectl apply -f k8s/` → alle drei Deployments laufen, Worker-CronJob wird stündlich ausgeführt
5. **End-to-End:** Job anlegen für `today + days_in_advance`, Worker manuell triggern (`kubectl create job --from=cronjob/eversports-worker test-run`), Ergebnis in Log-Drawer prüfen
