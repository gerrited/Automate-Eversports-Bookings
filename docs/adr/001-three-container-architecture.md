# ADR-001: Drei-Container-Architektur auf Kubernetes

**Datum:** 2026-04-11  
**Status:** Akzeptiert

## Kontext

Das ursprüngliche System war ein einzelnes Python-Script (`book.py`), das als hartcodierter Kubernetes CronJob lief. Es musste zu einer Multi-User-Plattform weiterentwickelt werden, auf der Benutzer ihre eigenen Buchungsplanungen über eine Web-UI verwalten können, während automatische Buchungen weiterhin im Hintergrund laufen.

## Entscheidung

Das System wird in drei Container aufgeteilt, die auf dem bestehenden Kubernetes-Cluster betrieben werden:

| Container | Technologie | K8s-Ressource |
|---|---|---|
| `frontend` | React + Vite + TypeScript, ausgeliefert via nginx | Deployment + Service + Ingress |
| `backend` | Python 3.13, FastAPI, SQLAlchemy | Deployment + Service |
| `worker` | Python 3.13, nutzt `backend/eversports/` und `backend/core/` | CronJob (`*/15 * * * *`) |

Externe Abhängigkeiten:
- **PostgreSQL** — extern gehostet (z.B. Supabase), verbunden via `DATABASE_URL` Secret
- **Eversports API** — GraphQL + Kalender-Endpunkt unter `https://www.eversports.de/api/`

Der Worker importiert direkt aus `backend/` (`backend/eversports/` für Buchungslogik, `backend/core/` für Verschlüsselung) statt Code zu duplizieren. Das ist möglich, weil sowohl das Backend-Dockerfile als auch das Worker-Dockerfile das Verzeichnis `backend/` ins Image kopieren.

## Konsequenzen

- Das ursprüngliche `book.py` und `k8s/cronjob.yaml` bleiben für den Standalone-Betrieb unverändert.
- `backend/eversports/` ist die einzige Quelle der Wahrheit für die Eversports-API-Interaktion.
- Der Worker kann unabhängig vom Backend skaliert werden (unterschiedlicher CronJob-Zeitplan, eigene Ressourcenlimits).
- Das Frontend hat keinen direkten Datenbankzugriff — alle Daten laufen über die Backend-API.
