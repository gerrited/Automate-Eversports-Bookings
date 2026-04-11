# ADR-001: Three-Container Architecture on Kubernetes

**Date:** 2026-04-11  
**Status:** Accepted

## Context

The original system was a single Python script (`book.py`) running as a hardcoded Kubernetes CronJob. We needed to evolve it into a multi-user platform where users can manage their own booking schedules via a web UI while automated bookings continue to run in the background.

## Decision

The system is split into three containers deployed on the existing Kubernetes cluster:

| Container | Technology | K8s resource |
|---|---|---|
| `frontend` | React + Vite + TypeScript, served by nginx | Deployment + Service + Ingress |
| `backend` | Python 3.13, FastAPI, SQLAlchemy | Deployment + Service |
| `worker` | Python 3.13, shares `backend/core/` | CronJob (`0 * * * *`) |

External dependencies:
- **PostgreSQL** — externally hosted (e.g. Supabase), connected via `DATABASE_URL` secret
- **Eversports API** — GraphQL + calendar endpoint at `https://www.eversports.de/api/`

The worker imports directly from `backend/core/` (booking logic, encryption) rather than duplicating code. This is possible because both the backend Dockerfile and the worker Dockerfile copy the `backend/` directory into the image.

## Consequences

- The original `book.py` and `k8s/cronjob.yaml` remain untouched for standalone operation.
- `backend/core/booking.py` is the single source of truth for Eversports API interaction.
- Scaling the worker independently from the backend is possible (different CronJob schedule, resource limits).
- Frontend has no direct database access — all data flows through the backend API.
