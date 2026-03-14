# Automate Eversports Bookings

Automatically books CrossFit classes at CrossFit Rabbit Hole by running weekly cron jobs on Kubernetes.

Currently scheduled bookings:

| Target class | Runs |
|---|---|
| Tuesday 18:00 | Friday 18:00 Europe/Berlin |
| Sunday 10:00 | Wednesday 10:00 Europe/Berlin |

## How it works

`book.py` calls the Eversports internal GraphQL API directly (no browser required) in four steps:

1. **Login** — authenticates with email and password, receives a session cookie
2. **Find session** — fetches the weekly class calendar and locates the CrossFit slot for the target date and time
3. **Create cart** — creates a booking cart for the session (existing membership is auto-selected)
4. **Confirm order** — places the order and exits

## Why Kubernetes and not GitHub Actions?

Cloudflare protects the Eversports API and appears to block outgoing requests from GitHub Actions runner IPs (returning a 403 managed challenge). The Python script works fine from a non-datacenter IP. The solution is to run the script as a Kubernetes CronJob on your own cluster, which uses a residential or non-flagged IP that Cloudflare allows through.

## Deployment

### 1. Build and push the image

The GitHub Actions workflow in `.github/workflows/docker.yml` builds a multi-platform image (`linux/amd64`, `linux/arm64`) and pushes it to GHCR on every push to `main` that touches `book.py` or `Dockerfile`.

The image is published at:
```
ghcr.io/gerrited/automate-eversports-bookings:latest
```

### 2. Create the Kubernetes secret

Fill in your credentials in `k8s/secret.yaml` (this file is gitignored):

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

Apply it:
```bash
kubectl apply -f k8s/secret.yaml
```

### 3. Deploy the CronJobs

```bash
kubectl apply -f k8s/cronjob.yaml
```

This creates two CronJobs (both DST-aware via `timeZone: "Europe/Berlin"`):

- `eversports-booking-tuesday-1800` — runs **Friday 18:00**, books the **Tuesday 18:00** class
- `eversports-booking-sunday-1000` — runs **Wednesday 10:00**, books the **Sunday 10:00** class

Both use `today + 4 days` to compute the target date, so no configuration is needed as long as the run day is exactly 4 days before the target class day.

If you previously deployed the old single CronJob, delete it:
```bash
kubectl delete cronjob eversports-booking
```

### 4. Manual test run

To trigger an immediate run with a specific date and time:

```bash
kubectl create job --from=cronjob/eversports-booking-tuesday-1800 test-tuesday \
  --dry-run=client -o yaml \
  | kubectl set env --local -f - TARGET_DATE=2026-03-17 -o yaml \
  | kubectl apply -f -

kubectl logs -f job/test-tuesday
kubectl delete job test-tuesday
```

`TARGET_DATE` accepts any future date in `YYYY-MM-DD` format. `TARGET_TIME` is set per CronJob and defaults to `18:00` if unset.

### 5. Adding a new booking slot

Any class where the target day is exactly 4 days after the desired run day works with just a new CronJob block in `k8s/cronjob.yaml` — no changes to `book.py` needed. Set `TARGET_TIME` to the class start time.

## Requirements

- Kubernetes 1.27+ (for `timeZone` support in CronJob)
- An image pull secret named `ghcr-secret` if your cluster needs credentials to pull from GHCR
- Eversports account with an active membership at CrossFit Rabbit Hole

## Secrets

| Secret key | Description |
|------------|-------------|
| `email`    | Eversports account email |
| `password` | Eversports account password |
