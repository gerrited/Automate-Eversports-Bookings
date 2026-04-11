# Automate Eversports Bookings

Automatically books Eversports classes for multiple users via a web-based management UI. Booking jobs are configured through a React frontend, stored in a PostgreSQL database, and executed by an hourly Kubernetes worker that uses the Eversports GraphQL API directly (no browser required).

## Architecture

Three containers run on Kubernetes:

| Container | Image | Purpose |
|-----------|-------|---------|
| `backend` | `…-backend:latest` | FastAPI REST API — manages users, jobs, and booking logs |
| `worker` | `…-worker:latest` | Hourly CronJob — runs due booking jobs for all users |
| `frontend` | `…-frontend:latest` | React SPA served by nginx — booking management UI |

A fourth image (`…:latest`, the original `book.py`) still works standalone via CronJob for single-user setups.

## How it works

1. **Login** — users sign in with their Eversports credentials; the backend verifies them against the Eversports API and issues a JWT
2. **Job management** — authenticated users create booking jobs (weekday, time, facility, class name, days-in-advance) via the frontend
3. **Hourly worker** — every hour, the worker checks whether any job is due today (`target_date = today + days_in_advance`), skips jobs that were already booked successfully, decrypts stored credentials, and calls the Eversports API
4. **Booking flow** — for each job the worker authenticates, finds the class slot on the calendar, creates a cart, and confirms the order

## Why Kubernetes and not GitHub Actions?

Cloudflare protects the Eversports API and blocks requests from GitHub Actions runner IPs (returning a 403 managed challenge). The booking script works fine from a non-datacenter IP. Running on your own Kubernetes cluster uses a residential or otherwise non-flagged IP that Cloudflare allows through.

## Deployment

### 1. Container images

The GitHub Actions workflow (`.github/workflows/docker.yml`) builds and pushes all four images to GHCR on every push to `main`:

```
ghcr.io/gerrited/automate-eversports-bookings:latest          # standalone book.py
ghcr.io/gerrited/automate-eversports-bookings-backend:latest
ghcr.io/gerrited/automate-eversports-bookings-worker:latest
ghcr.io/gerrited/automate-eversports-bookings-frontend:latest
```

### 2. Create the Kubernetes secret

```yaml
# k8s/backend-secret.yaml  (gitignored — fill in your values)
apiVersion: v1
kind: Secret
metadata:
  name: eversports-backend-secrets
type: Opaque
stringData:
  database_url: "postgresql://user:pass@host:5432/eversports"
  encryption_key: "<32-byte Fernet key — generate with: python -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())'>"
  jwt_secret: "<random string>"
  FRONTEND_URL: "https://your-frontend-domain"
```

```bash
kubectl apply -f k8s/backend-secret.yaml
```

### 3. Deploy the backend

```bash
kubectl apply -f k8s/backend-deployment.yaml
```

Runs database migrations automatically on startup (`alembic upgrade head`).

### 4. Deploy the worker

```bash
kubectl apply -f k8s/worker-cronjob.yaml
```

Runs hourly (`0 * * * *`, `timeZone: Europe/Berlin`, `concurrencyPolicy: Forbid`). Reads `DATABASE_URL` and `ENCRYPTION_KEY` from the same secret.

### 5. Deploy the frontend

```bash
kubectl apply -f k8s/frontend-deployment.yaml
```

nginx serves the React SPA and proxies `/api/` to the backend service.

### 6. Register the first user

Open the frontend URL in your browser, click **Einloggen**, and sign in with your Eversports credentials. The backend validates them against Eversports and creates your account on first login.

---

### Legacy: standalone CronJob (single-user)

The original `book.py`-based CronJob still works if you only need a single user and no UI. See `k8s/cronjob.yaml` and create `k8s/secret.yaml`:

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
kubectl apply -f k8s/secret.yaml
kubectl apply -f k8s/cronjob.yaml
```

Manual test run:

```bash
kubectl create job --from=cronjob/eversports-booking-tuesday-1800 test-tuesday \
  --dry-run=client -o yaml \
  | kubectl set env --local -f - TARGET_DATE=2026-03-17 -o yaml \
  | kubectl apply -f -

kubectl logs -f job/test-tuesday
kubectl delete job test-tuesday
```

## Requirements

- Kubernetes 1.27+ (for `timeZone` support in CronJob)
- PostgreSQL database accessible from the cluster
- An image pull secret named `ghcr-secret` if your cluster needs credentials to pull from GHCR

## Backend environment variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | yes | — | PostgreSQL connection string |
| `ENCRYPTION_KEY` | yes | — | Fernet key for encrypting stored Eversports passwords |
| `JWT_SECRET` | yes | — | Secret for signing JWTs |
| `FRONTEND_URL` | yes | — | Allowed CORS origin |

## Worker environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | yes | PostgreSQL connection string (same as backend) |
| `ENCRYPTION_KEY` | yes | Fernet key for decrypting stored passwords |

## Standalone CronJob environment variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `EVERSPORTS_EMAIL` | yes | — | Eversports account email |
| `EVERSPORTS_PASSWORD` | yes | — | Eversports account password |
| `FACILITY_ID` | no | `73041` | Eversports facility ID |
| `TARGET_TIME` | no | `18:00` | Class start time (`HH:MM`) |
| `TARGET_DATE` | no | today + 4 days | Target class date (`YYYY-MM-DD`) |
