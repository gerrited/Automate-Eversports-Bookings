# User Activation & Roles — Design Spec

**Date:** 2026-04-12
**Status:** Approved

## Overview

New accounts require admin approval before they can use the app. A simple two-role system (`user` / `admin`) controls who can manage accounts. The first registered user becomes admin automatically. Admins can activate and deactivate users from the dashboard.

---

## 1. Database Changes

Two new columns on the `users` table:

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `active` | Boolean | `False` | Whether the account is approved |
| `role` | String | `"user"` | Either `"user"` or `"admin"` |

**Alembic migration:** Adds both columns. Existing users in the DB receive `active=True` and `role="user"` as migration values so no one is locked out.

---

## 2. Backend

### Login endpoint (`POST /auth/login`)

- **New user (first in DB):** Created with `active=True`, `role="admin"`
- **New user (not first):** Created with `active=False`, `role="user"`
- **Existing user, `active=False`:** Returns HTTP 403 with `"Account nicht freigegeben"`
- **Existing user, `active=True`:** Login succeeds, returns `{access_token, role}`

The `TokenResponse` schema gains a `role: str` field.

### Dependencies

**`get_current_active_user`**
Extends `get_current_user`. Additionally checks `user.active == True`. Returns 403 if inactive. All existing protected routes switch to this dependency.

**`require_admin`**
Extends `get_current_active_user`. Additionally checks `user.role == "admin"`. Returns 403 if not admin. Used exclusively on admin routes.

### Admin routes (`/admin/users`)

All routes require `require_admin` dependency.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/admin/users` | Returns list of all users: `id`, `email`, `active`, `role`, `created_at` |
| `PATCH` | `/admin/users/{id}/active` | Sets `active` on the given user. Returns 400 if admin attempts to deactivate themselves. |

---

## 3. Frontend

### Login flow

- `api/auth.ts`: After successful login, stores both `token` and `role` in `localStorage`
- On logout: both `token` and `role` are removed from `localStorage`
- On 403 from login: `LoginPage` shows error message `"Dein Account wartet auf Freigabe"`

### Dashboard

- New helper `isAdmin()` reads `role` from `localStorage`
- Below the job list: if `isAdmin()` is true, renders a new `UserManagementSection` component
- `UserManagementSection` fetches all users via `GET /admin/users` and renders them as a list with email and an activate/deactivate toggle
- The toggle for the admin's own account is `disabled` (UX protection; backend is the authoritative guard)

### New API file `api/users.ts`

- `listUsers()` → `GET /admin/users`
- `setUserActive(id: string, active: boolean)` → `PATCH /admin/users/{id}/active`

---

## 4. Error Handling

| Scenario | Backend | Frontend |
|----------|---------|----------|
| Inactive user logs in | 403 `"Account nicht freigegeben"` | Error shown on login page |
| Non-admin calls admin route | 403 | — (button not shown to non-admins) |
| Admin tries to deactivate self | 400 | Toggle is disabled in UI |
| Inactive user calls any protected route | 403 | — (can't reach dashboard) |

---

## 5. Out of Scope

- Role promotion (admins cannot make other users admins)
- Email notifications on activation
- Password reset flow
- First admin setup via env variable or seed script (manual DB edit for initial admin)
