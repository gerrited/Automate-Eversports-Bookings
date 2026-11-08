![logo](frontend/public/logo.png)

# FOReversports - Automate Eversports Bookings

[![CI](https://github.com/gerrited/Automate-Eversports-Bookings/actions/workflows/ci.yml/badge.svg)](https://github.com/gerrited/Automate-Eversports-Bookings/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/gerrited/Automate-Eversports-Bookings/graph/badge.svg)](https://codecov.io/gh/gerrited/Automate-Eversports-Bookings)

FOReversports books your spots in Eversports classes for you, at the exact moment the booking window opens.

The name is a recursive acronym: **F**ast **O**n-time **R**eservation for **Eversports**.

## Demo

[![Watch the video](https://img.youtube.com/vi/spngnOZDBQo/0.jpg)](https://www.youtube.com/watch?v=spngnOZDBQo)

---

## Table of contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Key processes](#key-processes)
- [Local development](#local-development)
- [Tests & CI](#tests--ci)
- [Deployment (Kubernetes)](#deployment-kubernetes)
- [Configuration reference](#configuration-reference)
- [Scripts & maintenance](#scripts--maintenance)
- [Further documentation](#further-documentation)

---

## Features

### For users

- **Sign in with Eversports** – no separate account. Credentials are validated against Eversports; the password is stored encrypted (AES-256-GCM) because the worker has to log in on your behalf later.
- **Booking jobs** – plan recurring bookings by weekday, start time, facility, class and *days in advance* (when the provider opens the booking window). Facility and class are picked from search/autocomplete fields that query Eversports.
- **One-time jobs** – book a single upcoming slot; the job disables itself after a successful booking.
- **Automatic waitlist** – if a class is full, the worker joins the waitlist and notifies you.
- **"Book now"** – trigger a job immediately from the UI instead of waiting for the scheduled run.
- **Booked tab** – see your upcoming Eversports bookings and cancel them directly.
- **Booking history** – each job keeps a log of its executions (success, waitlist, already booked, failed).
- **E-mail notifications** (via Resend) when a booking fails or you end up on the waitlist.
- **Push reminders** – Web Push (PWA, VAPID) reminds you of upcoming appointments a configurable time before they start.
- **Calendar subscription** – a personal iCal feed (`/api/calendar/feed.ics?token=…`) of your bookings for Google/Apple/Outlook calendars; the token can be regenerated at any time.
- **Account management** – delete your account and all its data yourself.
- **Installable PWA** with service worker, FAQ and in-app help icons.

### For admins

- The **first registered user automatically becomes admin**; every further user must be activated by an admin (admins receive an e-mail on new sign-ups, users receive an e-mail on activation/deactivation).
- **User management** – activate/deactivate users, toggle the admin role, set a per-user limit of active jobs, send a message by e-mail, send a test push.
- **All jobs / all logs** – overview of every job and every execution across all users, with filtering and pagination.
- **Debug mode** per job – the booking is cancelled again right after it succeeded (useful for end-to-end tests against the real platform).
- **Test e-mails** – render and send every e-mail template to check layout and delivery.
- **Notice banner** – show public or logged-in-only announcements, sourced from a GitHub Gist (`NOTICE_PUBLIC_GIST_URL`, `NOTICE_USERS_GIST_URL`).

---

## Tech stack

| Area | Technology |
|---|---|
| Backend API | Python 3.13, [FastAPI](https://fastapi.tiangolo.com/), Pydantic 2, Uvicorn |
| Persistence | SQLAlchemy 2, Alembic migrations, PostgreSQL (production) / SQLite (local) |
| Auth | PyJWT (15-min access token + 90-day refresh token in an httpOnly cookie) |
| Encryption | `cryptography` – AES-256-GCM with the Eversports user ID as associated data |
| Eversports integration | `requests` against the Eversports GraphQL checkout API + calendar endpoint, `beautifulsoup4` for HTML parsing |
| Worker | Plain Python process (`worker/worker.py`), thread pool for parallel jobs |
| Notifications | [Resend](https://resend.com/) + Jinja2 HTML templates (e-mail), `pywebpush` (Web Push reminders) |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS 4, React Router 7 |
| Frontend serving | nginx (static SPA + reverse proxy for `/api/`) |
| Tests | pytest, pytest-cov, pytest-mock, httpx (backend/worker); Vitest + Testing Library (frontend) |
| CI/CD | GitHub Actions, Codecov, GitVersion, multi-arch images on GHCR |
| Runtime | Kubernetes (Deployments + CronJob) |

---

## Architecture

```
                ┌──────────────────────────┐
  Browser ─────▶│ frontend (nginx + React) │
   (PWA)        └────────────┬─────────────┘
                             │ /api/*
                             ▼
                ┌──────────────────────────┐        ┌──────────────────────┐
                │ backend (FastAPI)        │───────▶│                      │
                │ REST API, JWT, admin,    │        │  PostgreSQL          │
                │ calendar feed, push      │◀───────│  users, booking_jobs,│
                └────────────┬─────────────┘        │  booking_logs,       │
                             │                      │  push_subscriptions  │
                             │                      └──────────▲───────────┘
                             │                                 │
                             │      ┌──────────────────────────┴─┐
                             │      │ worker (K8s CronJob,       │
                             │      │ every 15 min)              │
                             │      └─────────────┬──────────────┘
                             ▼                    ▼
                ┌───────────────────────────────────────────────┐
                │ backend/eversports/  →  Eversports platform   │
                │ (login, calendar, GraphQL checkout, cancel)   │
                └───────────────────────────────────────────────┘
```

Three containers run on Kubernetes (see [ADR-001](docs/adr/001-three-container-architecture.md)):

| Container | Dockerfile | K8s resource | Purpose |
|---|---|---|---|
| `backend` | `Dockerfile.backend` | Deployment + Service | REST API; runs `alembic upgrade head` on start |
| `worker` | `Dockerfile.worker` | CronJob (`*/15 * * * *`, `Europe/Berlin`, `concurrencyPolicy: Forbid`) | Executes due booking jobs for all users |
| `frontend` | `Dockerfile.frontend` | Deployment + Service | nginx serves the SPA and proxies `/api/` to the backend |

A fourth image, `cronjob` (`cronjob/book.py`, `Dockerfile.cronjob`), is the original single-user script and still works standalone — see [Legacy](#legacy-standalone-cronjob-single-user).

### Repository layout

```
backend/
  api/          FastAPI routers (auth, jobs, admin, facilities, account, bookings, push, calendar)
  core/         auth, encryption, schedule (compute_next_run), status enum, e-mail, push, caching, rate limit
  eversports/   the ONLY code that talks to Eversports: client.py, parsing.py, classify.py, errors.py
  models/       SQLAlchemy models (User, BookingJob, BookingLog, PushSubscription)
  schemas/      Pydantic request/response models
  alembic/      database migrations
  templates/    e-mail templates (Jinja2)
worker/         booking worker, worker e-mails and push notifications
frontend/       React SPA (src/pages, src/components, src/api, src/hooks), nginx.conf, PWA assets
cronjob/        legacy single-user book.py
scripts/        one-off maintenance scripts
k8s/            Kubernetes manifests
tests/          backend, worker and Eversports contract tests (with HTML fixtures)
docs/adr/       architecture decision records
docs/superpowers/  design specs and implementation plans per feature
```

### Design principles

- **Eversports is the identity provider** ([ADR-002](docs/adr/002-eversports-as-identity-provider.md)) – there are no local passwords; a login is only accepted if Eversports accepts the credentials.
- **Platform isolation** – everything that touches Eversports lives in `backend/eversports/`. HTML parsing is pure functions in `parsing.py` (contract-tested against fixtures in `tests/eversports/fixtures/`; `MarkupDrift` signals that Eversports changed its markup), localized error-text classification lives in `classify.py`.
- **Scheduling is data, not a time comparison** ([ADR-004](docs/adr/004-worker-scheduling-and-idempotency.md)) – see [Scheduling](#2-scheduling-next_run_at).
- **No browser required** – bookings use the Eversports HTTP/GraphQL API directly.

---

## Key processes

### 1. Login & registration

1. The user enters their Eversports e-mail and password in the frontend.
2. `POST /api/auth/login` (rate-limited: 10 attempts / 5 min per IP) verifies them against Eversports.
3. On first login a user record is created. The **very first user becomes an active admin**; everyone else starts inactive and admins are notified by e-mail.
4. The password is encrypted with AES-256-GCM, bound to the user's Eversports ID (AAD). Legacy ciphertexts without AAD are re-encrypted on the next login.
5. The response contains a short-lived **access token** (15 min, `Authorization: Bearer`). The **refresh token** (90 days) is set **only** as an httpOnly cookie restricted to `/api/auth/refresh`.

Details: [`SECURITY.md`](SECURITY.md).

### 2. Scheduling (`next_run_at`)

Every job stores its next run as `booking_jobs.next_run_at` (UTC). `compute_next_run()` in `backend/core/schedule.py` is the single place that computes it:

> Run at `target_time` (Europe/Berlin, DST-safe) on the day that lies `days_in_advance` days before the class weekday — i.e. exactly when the provider opens the booking window.

Example: class on **Thursday 18:00**, booking opens **4 days** before → the job runs on **Sunday at 18:00** and books the following Thursday.

- Creating a job, changing `weekday` / `target_time` / `days_in_advance`, or re-enabling a job recalculates `next_run_at` (`backend/api/jobs.py`).
- `next_run_at = NULL` means "not computed yet"; the worker initialises it without booking retroactively.

### 3. Worker run (every 15 minutes)

1. Select all enabled jobs of active users with `next_run_at <= now` and claim them with `FOR UPDATE SKIP LOCKED` (PostgreSQL), so overlapping runs never process the same job twice.
2. Derive `target_date` from the **scheduled** run (`next_run_at`), never from `now`. Missed runs are caught up as long as the class is still in the future.
3. Skip the slot if a terminal log (`success` / `waitlist`) already exists for that date.
4. Decrypt the credentials and call `book_session()`:
   login → find the slot in the facility calendar → create cart → confirm order.
   If the class is full, join the waitlist.
5. Write a `booking_logs` entry with a `BookingStatus` (`success`, `already_booked`, `waitlist`, `failed`).
6. Side effects: failure → e-mail to user and admins; waitlist → e-mail; debug job → cancel the booking immediately; one-time job → disable after success.
7. **Always** advance `next_run_at` after an attempt — each slot is tried exactly once.

Jobs are processed in parallel (thread pool, up to 10 workers). Afterwards the worker sends push reminders for upcoming appointments of users with a push subscription.

### 4. Calendar feed

`GET /api/calendar/feed.ics?token=<calendar_token>` returns the user's upcoming Eversports bookings as iCalendar (times in UTC). The capability token is a UUID4 that can be regenerated in the settings; results are cached per user for 15 minutes (errors are not cached).

### 5. Releases & image builds

- **Push to `main`** → tests → build and push all images to GHCR tagged `latest` and `<sha>` (`.github/workflows/build-images.yml`).
- **Tag `v*`** → tests → [GitVersion](GitVersion.yml) computes the SemVer → images are additionally tagged `v<version>` → a GitHub release with a changelog is created (`.github/workflows/release.yml`).

```bash
git tag v1.2.3 && git push origin v1.2.3
```

---

## Local development

### Prerequisites

- Python 3.13
- Node.js 24

### Backend

```bash
pip install -r requirements-backend.txt
```

```bash
DATABASE_URL=sqlite:///eversports.db \
  alembic -c backend/alembic.ini upgrade head
```

```bash
DATABASE_URL=sqlite:///eversports.db \
  JWT_SECRET=test-secret \
  ENCRYPTION_KEY=$(python -c 'import os; print(os.urandom(32).hex())') \
  FRONTEND_URL=http://localhost:5173 \
  uvicorn backend.main:app --reload
```

The API runs on `http://localhost:8000`, Swagger UI on `http://localhost:8000/docs`.

> Keep the `ENCRYPTION_KEY` stable across restarts — otherwise stored passwords can no longer be decrypted and users must log in again.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The app runs on `http://localhost:5173`; Vite proxies `/api/` to `http://localhost:8000`.

### Running the worker locally

```bash
DATABASE_URL=sqlite:///eversports.db \
  ENCRYPTION_KEY=<same key as the backend> \
  python -m worker.worker
```

The worker processes all due jobs once and exits (in production the CronJob starts it every 15 minutes).

### Database migrations

```bash
DATABASE_URL=sqlite:///eversports.db \
  alembic -c backend/alembic.ini revision --autogenerate -m "description"
```

```bash
DATABASE_URL=sqlite:///eversports.db \
  alembic -c backend/alembic.ini current
```

Migrations must also run on SQLite: use `op.batch_alter_table()` for constraints and `ALTER` operations.

---

## Tests & CI

```bash
pytest tests/ -x
```

The suite runs against SQLite by default. To run it against PostgreSQL (covers production behaviour such as `FOR UPDATE SKIP LOCKED`):

```bash
TEST_DATABASE_URL=postgresql://test:test@localhost:5432/eversports_test pytest tests/ -x
```

```bash
cd frontend && npm test
```

CI (`.github/workflows/ci.yml`) runs on pushes to `main` and on pull requests:

| Job | Content |
|---|---|
| `tests` | Backend + worker tests on SQLite, coverage to job summary, PR comment and Codecov |
| `tests (postgres)` | Same suite against a PostgreSQL 17 service container |
| `frontend tests` | Vitest with coverage |
| `build images` | Only on `main` pushes, after all tests passed |

---

## Deployment (Kubernetes)

### Why Kubernetes and not GitHub Actions?

Cloudflare protects the Eversports API and blocks requests from GitHub Actions runner IPs (403 managed challenge). Running on your own cluster uses a residential or otherwise non-flagged IP that Cloudflare lets through.

### Requirements

- Kubernetes 1.27+ (for `timeZone` in CronJobs)
- A PostgreSQL database reachable from the cluster
- An image pull secret `ghcr-secret` if your cluster needs credentials for GHCR

### Images

```
ghcr.io/gerrited/automate-eversports-bookings-backend:latest
ghcr.io/gerrited/automate-eversports-bookings-worker:latest
ghcr.io/gerrited/automate-eversports-bookings-frontend:latest
ghcr.io/gerrited/automate-eversports-bookings-cronjob:latest   # legacy book.py
```

### 1. Create the secret

```yaml
# k8s/backend-secret.yaml — fill in your values, never commit real secrets
apiVersion: v1
kind: Secret
metadata:
  name: eversports-backend-secrets
type: Opaque
stringData:
  database_url: "postgresql://user:pass@host:5432/eversports"
  encryption_key: "<64 hex chars: python -c 'import os; print(os.urandom(32).hex())'>"
  jwt_secret: "<random string>"
  FRONTEND_URL: "https://your-frontend-domain"
  resend_api_key: "<Resend API key>"
  from_email: "FOReversports <noreply@your-domain>"
  vapid_public_key: "<VAPID public key>"
  vapid_private_key: "<VAPID private key>"
  vapid_subject: "mailto:you@your-domain"
```

```bash
kubectl apply -f k8s/backend-secret.yaml
```

### 2. Deploy backend, worker and frontend

```bash
kubectl apply -f k8s/backend-deployment.yaml
```

```bash
kubectl apply -f k8s/worker-cronjob.yaml
```

```bash
kubectl apply -f k8s/frontend-deployment.yaml
```

The backend runs the database migrations automatically on start.

### 3. Register the first user

Open the frontend, click **Anmelden** and sign in with your Eversports credentials. The first account becomes admin; later accounts have to be activated under user management.

### Useful operations

Trigger a worker run manually:

```bash
kubectl create job --from=cronjob/eversports-worker worker-manual
```

```bash
kubectl logs -f job/worker-manual
```

```bash
kubectl delete job worker-manual
```

Update to the latest images:

```bash
kubectl rollout restart deployment/eversports-backend deployment/eversports-frontend
```

(The worker CronJob pulls the image on every run.)

### Legacy: standalone CronJob (single-user)

The original `cronjob/book.py` still works for a single user without UI. Create `k8s/cronjob-secret.yaml` and apply it together with `k8s/cronjob.yaml`:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: eversports-credentials
type: Opaque
stringData:
  email: "your@email.com"
  password: "yourpassword"
```

```bash
kubectl apply -f k8s/cronjob-secret.yaml -f k8s/cronjob.yaml
```

Manual test run for a specific date:

```bash
kubectl create job --from=cronjob/eversports-booking-tuesday-1800 test-tuesday \
  --dry-run=client -o yaml \
  | kubectl set env --local -f - TARGET_DATE=2026-03-17 -o yaml \
  | kubectl apply -f -
```

---

## Configuration reference

### Backend

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | yes | PostgreSQL or SQLite URL, e.g. `sqlite:///eversports.db` |
| `JWT_SECRET` | yes | Secret for signing JWTs |
| `ENCRYPTION_KEY` | yes | AES-256-GCM key, 64 hex chars (32 bytes) |
| `FRONTEND_URL` | yes | Allowed CORS origin; also used for links in e-mails |
| `RESEND_API_KEY` | no | Enables e-mails via Resend |
| `FROM_EMAIL` | no | Sender address for e-mails |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | no | Enable Web Push reminders |

### Worker

`DATABASE_URL`, `ENCRYPTION_KEY` (required, same values as the backend), plus optionally `FRONTEND_URL`, `RESEND_API_KEY`, `FROM_EMAIL` and the `VAPID_*` variables for notifications.

### Frontend (runtime, nginx container)

| Variable | Description |
|---|---|
| `NOTICE_PUBLIC_GIST_URL` | Gist with a notice shown to everyone |
| `NOTICE_USERS_GIST_URL` | Gist with a notice shown to logged-in users |

`docker-entrypoint.sh` writes these into `config.js` (`window.__APP_CONFIG__`) at container start, so the same image works in every environment. Version, commit SHA and repository are baked in at build time (`VITE_VERSION`, `VITE_COMMIT_SHA`, `VITE_GITHUB_REPO`).

### Legacy `book.py`

| Variable | Required | Default | Description |
|---|---|---|---|
| `EVERSPORTS_EMAIL` | yes | — | Eversports account e-mail |
| `EVERSPORTS_PASSWORD` | yes | — | Eversports account password |
| `FACILITY_ID` | no | `73041` | Eversports facility ID |
| `TARGET_TIME` | no | `18:00` | Class start time (`HH:MM`) |
| `TARGET_DATE` | no | today + 4 days | Class date (`YYYY-MM-DD`) |

---

## Scripts & maintenance

### `scripts/migrate_passwords.py` — Fernet → AES-256-GCM

One-off migration of stored Eversports passwords from the former Fernet encryption to AES-256-GCM. It decrypts every user's password with the old key and re-encrypts it with the new one; it aborts on the first error (the change for the failing user is rolled back).

```bash
DATABASE_URL=postgresql://user:pass@host:5432/eversports \
  ENCRYPTION_KEY_OLD=<old Fernet key> \
  ENCRYPTION_KEY=<new 64-hex-char key> \
  python scripts/migrate_passwords.py
```

The script is included in the backend image, so it can also be run inside the cluster:

```bash
kubectl exec -it deploy/eversports-backend -- \
  sh -c 'ENCRYPTION_KEY_OLD=<old Fernet key> python scripts/migrate_passwords.py'
```

Afterwards (on the next login) the backend additionally binds each ciphertext to the user's Eversports ID (AAD).

> **Back up the database first.** Run the script exactly once — running it again on already migrated data fails because the values are no longer Fernet tokens.

### Generating keys

```bash
python -c 'import os; print(os.urandom(32).hex())'
```

VAPID key pair for Web Push:

```bash
npx web-push generate-vapid-keys
```

---

## Further documentation

- [`SECURITY.md`](SECURITY.md) – endpoint protection, token handling, password storage
- [`CLAUDE.md`](CLAUDE.md) – architecture invariants and developer notes
- [`docs/adr/`](docs/adr/) – architecture decision records (containers, identity, data model, scheduling, UI)
- [`docs/superpowers/`](docs/superpowers/) – design specs and implementation plans for individual features

## License

See [LICENSE](LICENSE).
