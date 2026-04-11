# ADR-005: Frontend UI Design — Cards, Modal, Log Drawer

**Date:** 2026-04-11  
**Status:** Accepted

## Context

The dashboard needs to display a user's booking jobs and give them controls to add, edit, enable/disable, delete, and inspect the history of each job. Two layout options were considered:

**Option A — Card per job:** One card per job, toggle visible inline, edit/delete buttons at the bottom of each card.  
**Option B — Table:** All jobs in a table, more compact but less scannable at a glance.

## Decision

**Option A (cards) was chosen.** Each `JobCard` shows weekday, time, class name, facility, toggle, and edit/delete actions. Clicking the card body opens a `LogDrawer`.

### Component breakdown

- **`LoginPage`** — Email + password form. Delegates authentication to the Eversports backend. Redirects to `/dashboard` on success, shows an `role="alert"` error on failure.
- **`JobCard`** — Displays one job. The toggle (`role="switch"`) calls `onToggle` without navigating away. Edit and delete buttons call their respective handlers. The card body (`data-testid="job-card-body"`) calls `onSelect` to open the log drawer.
- **`JobModal`** — Modal dialog for creating and editing jobs. Pre-fills all fields when an existing job is passed. Fields: weekday (dropdown), time, class name, facility ID, days in advance.
- **`LogDrawer`** — Slide-in panel from the right showing the last 20 executions for a job. Status is colour-coded: green for `success`, red for `failed`, grey for `already_booked`. Closes via backdrop click or ✕ button.
- **`DashboardPage`** — Orchestrates all of the above. Holds state for modal visibility, selected job, and log data. Calls the API client on every mutation and refreshes the job list.
- **`App`** — BrowserRouter with a `RequireAuth` guard that redirects unauthenticated users to `/login`.

### API communication

No external state library. All API calls use a thin `apiFetch` wrapper (`src/api/client.ts`) that injects the JWT from `localStorage` and redirects to `/login` on a `401` response.

In production, nginx proxies `/api/` to the backend Kubernetes service — no CORS configuration required. In local development, Vite proxies `/api/` to `localhost:8000`.

## Consequences

- The card layout is slightly more verbose than a table for users with many jobs, but was preferred for legibility and mobile friendliness.
- `localStorage` JWT storage is acceptable for this internal tool. A more security-sensitive application should prefer `httpOnly` cookies.
- There is no optimistic UI update — every mutation awaits the API response and then re-fetches the full job list. This keeps client state simple at the cost of an extra round-trip per action.
