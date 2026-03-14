# Automate Eversports Bookings

Automatically books the CrossFit 18:00 class at CrossFit Rabbit Hole every Tuesday by running a weekly cron job on Kubernetes.

## How it works

`book.py` calls the Eversports internal GraphQL API directly (no browser required) in four steps:

1. **Login** — authenticates with email and password, receives a session cookie
2. **Find session** — fetches the weekly class calendar and locates the CrossFit slot for the target Tuesday
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

### 3. Deploy the CronJob

```bash
kubectl apply -f k8s/cronjob.yaml
```

The CronJob runs every **Friday at 18:00 Europe/Berlin** (DST-aware via `timeZone: "Europe/Berlin"`) and books the CrossFit class for the following Tuesday.

### 4. Manual test run

To trigger an immediate run with a specific date and time:

```bash
kubectl create job --from=cronjob/eversports-booking test-run \
  --dry-run=client -o yaml \
  | kubectl set env --local -f - TARGET_DATE=2026-03-18 TARGET_TIME=18:00 -o yaml \
  | kubectl apply -f -

kubectl logs -f job/test-run
kubectl delete job test-run
```

`TARGET_DATE` must be a future Tuesday in `YYYY-MM-DD` format. `TARGET_TIME` defaults to `18:00`.

## Requirements

- Kubernetes 1.27+ (for `timeZone` support in CronJob)
- An image pull secret named `ghcr-secret` if your cluster needs credentials to pull from GHCR
- Eversports account with an active membership at CrossFit Rabbit Hole

## Secrets

| Secret key | Description |
|------------|-------------|
| `email`    | Eversports account email |
| `password` | Eversports account password |
