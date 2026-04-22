# User Activation & Roles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add account activation gating and a two-role (user/admin) system so new accounts must be approved before use, with admins managing activation from the dashboard.

**Architecture:** Two new DB columns (`active`, `role`) on `users`; login enforces active check and returns role; a new `require_admin` dependency guards admin routes; the frontend stores role in localStorage and conditionally renders a user management panel for admins.

**Tech Stack:** Python/FastAPI, SQLAlchemy, Alembic, Pydantic v2, pytest/pytest-mock; React/TypeScript, Vite, Tailwind CSS

---

## File Map

**Backend — modified:**
- `backend/models/user.py` — add `active` and `role` columns
- `backend/schemas/auth.py` — add `role: str` to `TokenResponse`
- `backend/api/auth.py` — first-user admin logic, active check, return role
- `backend/api/deps.py` — add `get_current_active_user` and `require_admin`
- `backend/api/jobs.py` — swap `get_current_user` → `get_current_active_user`
- `backend/main.py` — register admin router

**Backend — created:**
- `backend/alembic/versions/<rev>_add_active_and_role_to_users.py` — migration
- `backend/schemas/user.py` — `UserResponse` and `SetActiveRequest` schemas
- `backend/api/admin.py` — `GET /admin/users` and `PATCH /admin/users/{id}/active`

**Tests — modified:**
- `tests/backend/test_api_auth.py` — update existing + add new auth tests
- `tests/backend/test_api_jobs.py` — set `active=True` in `_create_user` helper

**Tests — created:**
- `tests/backend/test_api_admin.py` — admin route tests

**Frontend — modified:**
- `frontend/src/api/client.ts` — add `setRole`, `getRole`, `isAdmin`; update `clearToken`
- `frontend/src/api/auth.ts` — save role on login
- `frontend/src/types.ts` — add `UserRecord` interface
- `frontend/src/pages/DashboardPage.tsx` — render `UserManagementSection` for admins

**Frontend — created:**
- `frontend/src/api/users.ts` — `listUsers`, `setUserActive`
- `frontend/src/components/UserManagementSection.tsx` — admin user management panel

---

## Task 1: User model — add `active` and `role` columns

**Files:**
- Modify: `backend/models/user.py`

- [ ] **Step 1: Write failing test for model fields**

```python
# tests/backend/test_api_auth.py — add at top of file after existing imports

def test_user_model_has_active_and_role_fields():
    from backend.models.user import User
    user = User(
        eversports_user_id="ev-1",
        email="x@x.com",
        encrypted_password="x",
    )
    assert user.active == False
    assert user.role == "user"
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pytest tests/backend/test_api_auth.py::test_user_model_has_active_and_role_fields -v
```
Expected: `FAIL` — `AttributeError: 'User' object has no attribute 'active'`

- [ ] **Step 3: Update the User model**

Replace the full contents of `backend/models/user.py`:

```python
import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, Boolean
from sqlalchemy.orm import relationship
from backend.db import Base


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    eversports_user_id = Column(String, unique=True, nullable=False)
    email = Column(String, unique=True, nullable=False)
    encrypted_password = Column(String, nullable=False)
    active = Column(Boolean, default=False, nullable=False)
    role = Column(String, default="user", nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    jobs = relationship("BookingJob", back_populates="user", cascade="all, delete-orphan")
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pytest tests/backend/test_api_auth.py::test_user_model_has_active_and_role_fields -v
```
Expected: `PASS`

- [ ] **Step 5: Commit**

```bash
git add backend/models/user.py tests/backend/test_api_auth.py
git commit -m "feat: add active and role fields to User model"
```

---

## Task 2: Alembic migration

**Files:**
- Create: `backend/alembic/versions/a1b2c3d4e5f6_add_active_and_role_to_users.py`

- [ ] **Step 1: Create the migration file**

Create `backend/alembic/versions/a1b2c3d4e5f6_add_active_and_role_to_users.py`:

```python
"""add active and role to users

Revision ID: a1b2c3d4e5f6
Revises: 5513b0f9e2a5
Create Date: 2026-04-12 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '5513b0f9e2a5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # server_default='1' ensures existing users stay active and aren't locked out
    op.add_column('users', sa.Column('active', sa.Boolean(), nullable=False, server_default='1'))
    op.add_column('users', sa.Column('role', sa.String(), nullable=False, server_default='user'))


def downgrade() -> None:
    op.drop_column('users', 'role')
    op.drop_column('users', 'active')
```

- [ ] **Step 2: Verify migration applies cleanly**

```bash
cd /Users/gerrit/Code/Automate-Eversports-Bookings
alembic upgrade head
```
Expected: no errors, migration `a1b2c3d4e5f6` appears in output

- [ ] **Step 3: Commit**

```bash
git add backend/alembic/versions/a1b2c3d4e5f6_add_active_and_role_to_users.py
git commit -m "feat: migration — add active and role columns to users"
```

---

## Task 3: Schemas — `TokenResponse` + new `UserResponse`

**Files:**
- Modify: `backend/schemas/auth.py`
- Create: `backend/schemas/user.py`

- [ ] **Step 1: Write failing tests**

Add to `tests/backend/test_api_auth.py`:

```python
def test_token_response_includes_role(client, mocker):
    mocker.patch(
        "backend.api.auth.eversports_login",
        return_value={"user_id": "ev-schema-1", "session": None},
    )
    resp = client.post("/api/auth/login", json={"email": "schema@x.com", "password": "pw"})
    assert resp.status_code == 200
    assert "role" in resp.json()
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pytest tests/backend/test_api_auth.py::test_token_response_includes_role -v
```
Expected: `FAIL` — `AssertionError: assert 'role' in {...}`

- [ ] **Step 3: Update `TokenResponse` schema**

Replace the full contents of `backend/schemas/auth.py`:

```python
from pydantic import BaseModel


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
```

- [ ] **Step 4: Create `UserResponse` and `SetActiveRequest` schemas**

Create `backend/schemas/user.py`:

```python
from datetime import datetime
from pydantic import BaseModel


class UserResponse(BaseModel):
    id: str
    email: str
    active: bool
    role: str
    created_at: datetime

    model_config = {"from_attributes": True}


class SetActiveRequest(BaseModel):
    active: bool
```

- [ ] **Step 5: Run schema test — still fails (login not yet updated)**

```bash
pytest tests/backend/test_api_auth.py::test_token_response_includes_role -v
```
Expected: still `FAIL` — the login endpoint doesn't return `role` yet. That's fixed in Task 4.

- [ ] **Step 6: Commit**

```bash
git add backend/schemas/auth.py backend/schemas/user.py tests/backend/test_api_auth.py
git commit -m "feat: add role to TokenResponse, add UserResponse schema"
```

---

## Task 4: Login logic — first-user admin, active check, return role

**Files:**
- Modify: `backend/api/auth.py`

- [ ] **Step 1: Write failing tests**

Add to `tests/backend/test_api_auth.py`:

```python
def test_first_user_becomes_admin_and_is_active(client, mocker):
    mocker.patch(
        "backend.api.auth.eversports_login",
        return_value={"user_id": "ev-first", "session": None},
    )
    resp = client.post("/api/auth/login", json={"email": "first@x.com", "password": "pw"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["role"] == "admin"


def test_second_user_is_inactive_and_gets_user_role(client, mocker, db_session):
    from backend.models.user import User
    # Pre-create the first user so second registration is not first
    existing = User(
        eversports_user_id="ev-existing",
        email="existing@x.com",
        encrypted_password="x",
        active=True,
        role="admin",
    )
    db_session.add(existing)
    db_session.commit()

    mocker.patch(
        "backend.api.auth.eversports_login",
        return_value={"user_id": "ev-second", "session": None},
    )
    resp = client.post("/api/auth/login", json={"email": "second@x.com", "password": "pw"})
    assert resp.status_code == 403
    assert resp.json()["detail"] == "Account nicht freigegeben"


def test_inactive_user_login_returns_403(client, mocker, db_session):
    from backend.models.user import User
    inactive = User(
        eversports_user_id="ev-inactive",
        email="inactive@x.com",
        encrypted_password="x",
        active=False,
        role="user",
    )
    db_session.add(inactive)
    db_session.commit()

    mocker.patch(
        "backend.api.auth.eversports_login",
        return_value={"user_id": "ev-inactive", "session": None},
    )
    resp = client.post("/api/auth/login", json={"email": "inactive@x.com", "password": "pw"})
    assert resp.status_code == 403
    assert resp.json()["detail"] == "Account nicht freigegeben"


def test_active_user_login_returns_role(client, mocker, db_session):
    from backend.models.user import User
    active_user = User(
        eversports_user_id="ev-active",
        email="active@x.com",
        encrypted_password="x",
        active=True,
        role="user",
    )
    db_session.add(active_user)
    db_session.commit()

    mocker.patch(
        "backend.api.auth.eversports_login",
        return_value={"user_id": "ev-active", "session": None},
    )
    resp = client.post("/api/auth/login", json={"email": "active@x.com", "password": "pw"})
    assert resp.status_code == 200
    assert resp.json()["role"] == "user"
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/backend/test_api_auth.py::test_first_user_becomes_admin_and_is_active tests/backend/test_api_auth.py::test_second_user_is_inactive_and_gets_user_role tests/backend/test_api_auth.py::test_inactive_user_login_returns_403 tests/backend/test_api_auth.py::test_active_user_login_returns_role -v
```
Expected: all `FAIL`

- [ ] **Step 3: Rewrite login endpoint**

Replace the full contents of `backend/api/auth.py`:

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.core.booking import eversports_login
from backend.core.encryption import encrypt
from backend.core.auth import create_access_token
from backend.db import get_db
from backend.models.user import User
from backend.schemas.auth import LoginRequest, TokenResponse

router = APIRouter()


@router.post("/auth/login", response_model=TokenResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    result = eversports_login(req.email, req.password)
    if result is None:
        raise HTTPException(status_code=401, detail="Invalid Eversports credentials")

    eversports_user_id: str = result["user_id"]
    encrypted_pw = encrypt(req.password)

    user = db.query(User).filter(User.eversports_user_id == eversports_user_id).first()
    if user is None:
        is_first_user = db.query(User).count() == 0
        user = User(
            eversports_user_id=eversports_user_id,
            email=req.email,
            encrypted_password=encrypted_pw,
            active=is_first_user,
            role="admin" if is_first_user else "user",
        )
        db.add(user)
    else:
        user.encrypted_password = encrypted_pw

    db.commit()
    db.refresh(user)

    if not user.active:
        raise HTTPException(status_code=403, detail="Account nicht freigegeben")

    return TokenResponse(access_token=create_access_token(user.id), role=user.role)
```

- [ ] **Step 4: Run all new tests to verify they pass**

```bash
pytest tests/backend/test_api_auth.py -v
```
Expected: all tests `PASS`

- [ ] **Step 5: Commit**

```bash
git add backend/api/auth.py tests/backend/test_api_auth.py
git commit -m "feat: first user becomes admin, inactive users blocked at login"
```

---

## Task 5: Dependencies — `get_current_active_user` and `require_admin`

**Files:**
- Modify: `backend/api/deps.py`

- [ ] **Step 1: Write failing tests**

Add to `tests/backend/test_api_auth.py`:

```python
def test_inactive_user_cannot_access_protected_route(client, db_session):
    from backend.core.auth import create_access_token
    from backend.models.user import User
    inactive = User(
        eversports_user_id="ev-blocked",
        email="blocked@x.com",
        encrypted_password="x",
        active=False,
        role="user",
    )
    db_session.add(inactive)
    db_session.commit()
    db_session.refresh(inactive)

    headers = {"Authorization": f"Bearer {create_access_token(inactive.id)}"}
    resp = client.get("/api/jobs", headers=headers)
    assert resp.status_code == 403
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pytest tests/backend/test_api_auth.py::test_inactive_user_cannot_access_protected_route -v
```
Expected: `FAIL` — currently returns 200 (active not checked)

- [ ] **Step 3: Update `deps.py`**

Replace the full contents of `backend/api/deps.py`:

```python
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from backend.core.auth import verify_token, JWTError
from backend.db import get_db
from backend.models.user import User

_bearer = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
    db: Session = Depends(get_db),
) -> User:
    try:
        user_id = verify_token(credentials.credentials)
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    if not current_user.active:
        raise HTTPException(status_code=403, detail="Account nicht freigegeben")
    return current_user


def require_admin(
    current_user: User = Depends(get_current_active_user),
) -> User:
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin required")
    return current_user
```

- [ ] **Step 4: Update `jobs.py` to use `get_current_active_user`**

In `backend/api/jobs.py`, change the import and all five dependency usages:

```python
# Change import line from:
from backend.api.deps import get_current_user
# To:
from backend.api.deps import get_current_active_user
```

Then replace every `Depends(get_current_user)` with `Depends(get_current_active_user)` in all five route handlers (`list_jobs`, `create_job`, `update_job`, `toggle_job`, `delete_job`, `get_job_logs`).

- [ ] **Step 5: Fix `_create_user` in jobs test to set `active=True`**

In `tests/backend/test_api_jobs.py`, update `_create_user`:

```python
def _create_user(db_session) -> User:
    user = User(eversports_user_id="ev-1", email="a@b.com", encrypted_password="x", active=True)
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user
```

- [ ] **Step 6: Run all tests**

```bash
pytest tests/backend/ -v
```
Expected: all tests `PASS`

- [ ] **Step 7: Commit**

```bash
git add backend/api/deps.py backend/api/jobs.py tests/backend/test_api_auth.py tests/backend/test_api_jobs.py
git commit -m "feat: add get_current_active_user and require_admin dependencies"
```

---

## Task 6: Admin routes

**Files:**
- Create: `backend/api/admin.py`
- Modify: `backend/main.py`

- [ ] **Step 1: Write failing tests**

Create `tests/backend/test_api_admin.py`:

```python
import os

os.environ.setdefault("ENCRYPTION_KEY", os.urandom(32).hex())
os.environ.setdefault("JWT_SECRET", "test-jwt-secret-do-not-use-in-prod")
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("FRONTEND_URL", "http://localhost:5173")

from backend.core.auth import create_access_token
from backend.models.user import User


def _auth_header(user_id: str) -> dict:
    return {"Authorization": f"Bearer {create_access_token(user_id)}"}


def _make_admin(db_session, ev_id="ev-admin", email="admin@x.com") -> User:
    user = User(
        eversports_user_id=ev_id,
        email=email,
        encrypted_password="x",
        active=True,
        role="admin",
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def _make_user(db_session, ev_id="ev-user", email="user@x.com", active=True) -> User:
    user = User(
        eversports_user_id=ev_id,
        email=email,
        encrypted_password="x",
        active=active,
        role="user",
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def test_list_users_requires_auth(client):
    resp = client.get("/api/admin/users")
    assert resp.status_code == 403


def test_list_users_requires_admin_role(client, db_session):
    user = _make_user(db_session)
    resp = client.get("/api/admin/users", headers=_auth_header(user.id))
    assert resp.status_code == 403


def test_list_users_returns_all_users(client, db_session):
    admin = _make_admin(db_session)
    _make_user(db_session, ev_id="ev-u2", email="other@x.com")
    resp = client.get("/api/admin/users", headers=_auth_header(admin.id))
    assert resp.status_code == 200
    emails = [u["email"] for u in resp.json()]
    assert "admin@x.com" in emails
    assert "other@x.com" in emails


def test_set_active_activates_user(client, db_session):
    admin = _make_admin(db_session)
    user = _make_user(db_session, ev_id="ev-u3", email="inactive@x.com", active=False)
    resp = client.patch(
        f"/api/admin/users/{user.id}/active",
        json={"active": True},
        headers=_auth_header(admin.id),
    )
    assert resp.status_code == 200
    assert resp.json()["active"] is True


def test_set_active_deactivates_user(client, db_session):
    admin = _make_admin(db_session)
    user = _make_user(db_session, ev_id="ev-u4", email="active@x.com", active=True)
    resp = client.patch(
        f"/api/admin/users/{user.id}/active",
        json={"active": False},
        headers=_auth_header(admin.id),
    )
    assert resp.status_code == 200
    assert resp.json()["active"] is False


def test_admin_cannot_deactivate_self(client, db_session):
    admin = _make_admin(db_session)
    resp = client.patch(
        f"/api/admin/users/{admin.id}/active",
        json={"active": False},
        headers=_auth_header(admin.id),
    )
    assert resp.status_code == 400
    assert resp.json()["detail"] == "Cannot deactivate your own account"


def test_set_active_user_not_found(client, db_session):
    admin = _make_admin(db_session)
    resp = client.patch(
        "/api/admin/users/nonexistent-id/active",
        json={"active": True},
        headers=_auth_header(admin.id),
    )
    assert resp.status_code == 404
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/backend/test_api_admin.py -v
```
Expected: all fail with 404 (route doesn't exist yet)

- [ ] **Step 3: Create `backend/api/admin.py`**

```python
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.api.deps import require_admin
from backend.db import get_db
from backend.models.user import User
from backend.schemas.user import UserResponse, SetActiveRequest

router = APIRouter()


@router.get("/admin/users", response_model=List[UserResponse])
def list_users(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return db.query(User).order_by(User.created_at).all()


@router.patch("/admin/users/{user_id}/active", response_model=UserResponse)
def set_user_active(
    user_id: str,
    body: SetActiveRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if user_id == current_user.id and not body.active:
        raise HTTPException(status_code=400, detail="Cannot deactivate your own account")
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    user.active = body.active
    db.commit()
    db.refresh(user)
    return user
```

- [ ] **Step 4: Register the admin router in `backend/main.py`**

Replace the full contents of `backend/main.py`:

```python
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import backend.models  # noqa: F401 — ensures all models are registered with Base.metadata
from backend.api import auth, jobs, admin

app = FastAPI(title="Eversports Booking API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.environ.get("FRONTEND_URL", "http://localhost:5173")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(jobs.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
```

- [ ] **Step 5: Run all admin tests**

```bash
pytest tests/backend/test_api_admin.py -v
```
Expected: all `PASS`

- [ ] **Step 6: Run full test suite**

```bash
pytest tests/backend/ -v
```
Expected: all tests `PASS`

- [ ] **Step 7: Commit**

```bash
git add backend/api/admin.py backend/main.py tests/backend/test_api_admin.py
git commit -m "feat: add admin routes for user activation management"
```

---

## Task 7: Frontend — role storage in `client.ts` and `auth.ts`

**Files:**
- Modify: `frontend/src/api/client.ts`
- Modify: `frontend/src/api/auth.ts`

- [ ] **Step 1: Update `client.ts`**

Replace the full contents of `frontend/src/api/client.ts`:

```typescript
const BASE = import.meta.env.VITE_API_BASE_URL ?? ''

function getToken(): string | null {
  return localStorage.getItem('token')
}

export function setToken(token: string): void {
  localStorage.setItem('token', token)
}

export function setRole(role: string): void {
  localStorage.setItem('role', role)
}

export function getRole(): string | null {
  return localStorage.getItem('role')
}

export function isAdmin(): boolean {
  return localStorage.getItem('role') === 'admin'
}

export function clearToken(): void {
  localStorage.removeItem('token')
  localStorage.removeItem('email')
  localStorage.removeItem('role')
  window.dispatchEvent(new Event('auth-changed'))
}

export function setEmail(email: string): void {
  localStorage.setItem('email', email)
  window.dispatchEvent(new Event('auth-changed'))
}

export function getEmail(): string | null {
  return localStorage.getItem('email')
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const resp = await fetch(`${BASE}${path}`, { ...options, headers })

  if (resp.status === 401) {
    clearToken()
    window.location.href = '/login'
    throw new Error('Unauthorized')
  }

  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}))
    throw new Error(body.detail ?? `HTTP ${resp.status}`)
  }

  if (resp.status === 204) return undefined as T
  return resp.json()
}
```

- [ ] **Step 2: Update `auth.ts`**

Replace the full contents of `frontend/src/api/auth.ts`:

```typescript
import { apiFetch, setToken, setEmail, setRole } from './client'

export async function login(email: string, password: string): Promise<void> {
  const data = await apiFetch<{ access_token: string; role: string }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  setToken(data.access_token)
  setRole(data.role)
  setEmail(email)
}
```

- [ ] **Step 3: Verify the existing login page test still passes**

```bash
cd frontend && npx vitest run src/pages/LoginPage.test.tsx
```
Expected: `PASS`

- [ ] **Step 4: Commit**

```bash
git add frontend/src/api/client.ts frontend/src/api/auth.ts
git commit -m "feat: store and expose role in localStorage after login"
```

---

## Task 8: Frontend — `UserRecord` type and `users.ts` API

**Files:**
- Modify: `frontend/src/types.ts`
- Create: `frontend/src/api/users.ts`

- [ ] **Step 1: Add `UserRecord` interface to `types.ts`**

Add the following to the end of `frontend/src/types.ts`:

```typescript
export interface UserRecord {
  id: string
  email: string
  active: boolean
  role: string
  created_at: string
}
```

- [ ] **Step 2: Create `frontend/src/api/users.ts`**

```typescript
import { apiFetch } from './client'
import type { UserRecord } from '../types'

export async function listUsers(): Promise<UserRecord[]> {
  return apiFetch<UserRecord[]>('/api/admin/users')
}

export async function setUserActive(id: string, active: boolean): Promise<UserRecord> {
  return apiFetch<UserRecord>(`/api/admin/users/${id}/active`, {
    method: 'PATCH',
    body: JSON.stringify({ active }),
  })
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/types.ts frontend/src/api/users.ts
git commit -m "feat: add UserRecord type and admin users API client"
```

---

## Task 9: Frontend — `UserManagementSection` component

**Files:**
- Create: `frontend/src/components/UserManagementSection.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { useState, useEffect, useCallback } from 'react'
import { listUsers, setUserActive } from '../api/users'
import { getEmail } from '../api/client'
import type { UserRecord } from '../types'

export default function UserManagementSection() {
  const [users, setUsers] = useState<UserRecord[]>([])
  const [loading, setLoading] = useState(true)
  const currentEmail = getEmail()

  const load = useCallback(async () => {
    try {
      setUsers(await listUsers())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleToggle(user: UserRecord) {
    if (user.email === currentEmail && user.active) return // guard: can't deactivate self
    await setUserActive(user.id, !user.active)
    load()
  }

  return (
    <div className="mt-10">
      <h2 className="text-slate-300 font-semibold text-sm uppercase tracking-wide mb-3">
        Benutzerverwaltung
      </h2>
      {loading && <p className="text-slate-400 text-sm">Lädt…</p>}
      {!loading && (
        <div className="flex flex-col gap-2">
          {users.map(user => {
            const isSelf = user.email === currentEmail
            return (
              <div
                key={user.id}
                className="bg-surface-card rounded-xl px-4 py-3 flex items-center justify-between"
              >
                <div>
                  <p className="text-white text-sm">{user.email}</p>
                  <p className="text-slate-400 text-xs">
                    {user.role === 'admin' ? 'Admin' : 'User'} ·{' '}
                    {user.active ? 'Aktiv' : 'Inaktiv'}
                  </p>
                </div>
                <button
                  disabled={isSelf}
                  onClick={() => handleToggle(user)}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                    isSelf
                      ? 'opacity-40 cursor-not-allowed bg-slate-700 text-slate-400'
                      : user.active
                      ? 'bg-slate-700 hover:bg-slate-600 text-slate-200'
                      : 'bg-brand hover:bg-brand-hover text-white'
                  }`}
                >
                  {user.active ? 'Deaktivieren' : 'Aktivieren'}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/UserManagementSection.tsx
git commit -m "feat: add UserManagementSection component for admin dashboard"
```

---

## Task 10: Frontend — integrate into `DashboardPage`

**Files:**
- Modify: `frontend/src/pages/DashboardPage.tsx`

- [ ] **Step 1: Update `DashboardPage.tsx`**

Replace the full contents of `frontend/src/pages/DashboardPage.tsx`:

```tsx
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { clearToken, isAdmin } from '../api/client'
import { listJobs, createJob, updateJob, toggleJob, deleteJob, getJobLogs } from '../api/jobs'
import type { Job, BookingLog, JobFormData } from '../types'
import JobCard from '../components/JobCard'
import JobModal from '../components/JobModal'
import LogDrawer from '../components/LogDrawer'
import UserManagementSection from '../components/UserManagementSection'

export default function DashboardPage() {
  const navigate = useNavigate()
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [editingJob, setEditingJob] = useState<Job | 'new' | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [logs, setLogs] = useState<BookingLog[]>([])
  const [logsLoading, setLogsLoading] = useState(false)

  const loadJobs = useCallback(async () => {
    try {
      setJobs(await listJobs())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadJobs() }, [loadJobs])

  function handleLogout() {
    clearToken()
    navigate('/login')
  }

  async function handleSave(data: JobFormData) {
    if (editingJob === 'new' || editingJob === null) {
      await createJob(data)
    } else {
      await updateJob(editingJob.id, data)
    }
    setShowModal(false)
    setEditingJob(null)
    loadJobs()
  }

  async function handleToggle(id: string) {
    await toggleJob(id)
    loadJobs()
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Job wirklich löschen?')) return
    await deleteJob(id)
    loadJobs()
  }

  async function handleSelect(job: Job) {
    setSelectedJob(job)
    setLogsLoading(true)
    setLogs([])
    try {
      setLogs(await getJobLogs(job.id))
    } finally {
      setLogsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface-page">
    <div className="px-4 py-8 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Logo" className="h-16 w-auto" />
        </div>
        <button
          onClick={handleLogout}
          className="px-3 py-1 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm transition-colors"
        >
          Abmelden
        </button>
      </div>

      {/* Add button */}
      <button
        onClick={() => { setEditingJob('new'); setShowModal(true) }}
        className="w-full mb-6 py-3 bg-brand hover:bg-brand-hover text-white font-semibold rounded-xl transition-colors"
      >
        + Buchung hinzufügen
      </button>

      {/* Job list */}
      {loading && <p className="text-slate-400 text-sm">Lädt…</p>}
      {!loading && jobs.length === 0 && (
        <p className="text-slate-400 text-sm text-center mt-12">
          Noch keine Jobs. Leg einen an!
        </p>
      )}
      <div className="flex flex-col gap-3">
        {jobs.map(job => (
          <JobCard
            key={job.id}
            job={job}
            onToggle={handleToggle}
            onEdit={j => { setEditingJob(j); setShowModal(true) }}
            onDelete={handleDelete}
            onSelect={handleSelect}
          />
        ))}
      </div>

      {/* Admin: user management */}
      {isAdmin() && <UserManagementSection />}

      {/* Modal */}
      {showModal && (
        <JobModal
          job={editingJob !== 'new' && editingJob !== null ? editingJob : undefined}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditingJob(null) }}
        />
      )}

      {/* Log drawer */}
      {selectedJob && (
        <LogDrawer
          job={selectedJob}
          logs={logs}
          loading={logsLoading}
          onClose={() => setSelectedJob(null)}
        />
      )}
    </div>
    </div>
  )
}
```

- [ ] **Step 2: Run the full backend test suite one final time**

```bash
pytest tests/backend/ -v
```
Expected: all tests `PASS`

- [ ] **Step 3: Run TypeScript type check**

```bash
cd frontend && npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/DashboardPage.tsx
git commit -m "feat: show user management panel in dashboard for admins"
```

---

## Self-Review Checklist

- [x] **Spec coverage:**
  - New accounts inactive by default ✓ (Task 4: `active=False` for non-first users)
  - "Freigabe notwendig" message ✓ (Task 4: 403 `"Account nicht freigegeben"`, Task 7: frontend shows `detail` from error)
  - `active` column, starts 0, set to 1 ✓ (Tasks 1 & 2)
  - First registered user becomes admin + activated ✓ (Task 4)
  - Role concept user/admin ✓ (Tasks 1, 5)
  - Admin sees user list below bookings ✓ (Tasks 9, 10)
  - Admin can activate/deactivate ✓ (Task 6)
  - Admin cannot deactivate themselves ✓ (Tasks 6 & 9: both backend 400 and disabled button)
  - Admin routes check role ✓ (Task 5: `require_admin` dependency on all admin routes)
- [x] **No placeholders:** all steps have concrete code
- [x] **Type consistency:** `UserRecord` defined in Task 8, used in Task 9; `setRole`/`isAdmin` defined in Task 7, used in Tasks 8 & 10
