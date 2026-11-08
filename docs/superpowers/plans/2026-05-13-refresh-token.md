# Refresh Token Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kurze Access Tokens (15 min) + stille Session-Verlängerung per httpOnly-Cookie-basiertem Refresh Token (90 Tage, stateless, reaktiv bei 401).

**Architecture:** Zwei JWTs mit `type`-Claim — Access Token (15 min, `type: "access"`) im `localStorage`, Refresh Token (90 Tage, `type: "refresh"`) als httpOnly Cookie. Bei 401 ruft `apiFetch` einmalig `POST /api/auth/refresh` auf, speichert den neuen Access Token und wiederholt den fehlgeschlagenen Request. Schlägt der Refresh fehl, wird der Nutzer ausgeloggt. Kein DB-Speicher, keine Token-Rotation.

**Tech Stack:** PyJWT, FastAPI `Response.set_cookie` / `delete_cookie`, Starlette Cookie-Dependency, fetch `credentials: 'include'`, Vitest `vi.stubGlobal`

---

## Dateiübersicht

| Datei | Änderung |
|---|---|
| `backend/core/auth.py` | `type`-Claim, 15 min Ablauf, `create_refresh_token()`, `verify_refresh_token()` |
| `backend/schemas/auth.py` | Neues Schema `RefreshResponse` |
| `backend/api/auth.py` | Login setzt Cookie, neue Endpoints `/refresh` und `/logout` |
| `tests/backend/test_core_auth.py` | Neue Tests für Token-Typen |
| `tests/backend/test_api_auth.py` | Neue Tests für Cookie, Refresh, Logout |
| `frontend/src/api/client.ts` | `credentials: 'include'`, Refresh-on-401-Logik |
| `frontend/src/api/client.test.ts` | Neue Datei — Tests für Refresh-Verhalten |
| `frontend/src/api/auth.ts` | Neue Funktion `logout()` |
| `frontend/src/pages/DashboardPage.tsx` | `handleLogout` nutzt `logout()` statt `clearToken()` |
| `frontend/src/pages/DashboardPage.test.tsx` | `../api/auth` mocken |

---

## Task 1: Backend core/auth.py — Token-Typen und Refresh Token

**Files:**
- Modify: `backend/core/auth.py`
- Modify: `tests/backend/test_core_auth.py`

- [ ] **Step 1: Failing-Tests schreiben**

Ergänze `tests/backend/test_core_auth.py` am Ende:

```python
from backend.core.auth import (
    create_access_token,
    create_refresh_token,
    verify_token,
    verify_refresh_token,
    JWTError,
)
import pytest


def test_access_token_has_type_claim():
    import jwt, os
    token = create_access_token("user-1")
    payload = jwt.decode(token, os.environ["JWT_SECRET"], algorithms=["HS256"])
    assert payload["type"] == "access"


def test_refresh_token_has_type_claim():
    import jwt, os
    token = create_refresh_token("user-1")
    payload = jwt.decode(token, os.environ["JWT_SECRET"], algorithms=["HS256"])
    assert payload["type"] == "refresh"


def test_verify_token_rejects_refresh_token():
    token = create_refresh_token("user-1")
    with pytest.raises(JWTError):
        verify_token(token)


def test_verify_refresh_token_rejects_access_token():
    token = create_access_token("user-1")
    with pytest.raises(JWTError):
        verify_refresh_token(token)


def test_create_and_verify_refresh_token():
    token = create_refresh_token("user-42")
    assert verify_refresh_token(token) == "user-42"
```

- [ ] **Step 2: Tests ausführen — müssen fehlschlagen**

```bash
pytest tests/backend/test_core_auth.py -x -v
```

Erwartetes Ergebnis: `FAILED` mit `ImportError: cannot import name 'create_refresh_token'` o.ä.

- [ ] **Step 3: Implementation schreiben**

Ersetze `backend/core/auth.py` vollständig:

```python
import os
from datetime import datetime, timedelta, timezone

import jwt

_ALGORITHM = "HS256"
_ACCESS_EXPIRE_MINUTES = 15
_REFRESH_EXPIRE_DAYS = 90

JWTError = jwt.PyJWTError  # re-exported for callers


def _secret() -> str:
    return os.environ["JWT_SECRET"]


def create_access_token(user_id: str) -> str:
    now = datetime.now(timezone.utc)
    return jwt.encode(
        {
            "sub": user_id,
            "type": "access",
            "iat": now,
            "exp": now + timedelta(minutes=_ACCESS_EXPIRE_MINUTES),
        },
        _secret(),
        algorithm=_ALGORITHM,
    )


def create_refresh_token(user_id: str) -> str:
    now = datetime.now(timezone.utc)
    return jwt.encode(
        {
            "sub": user_id,
            "type": "refresh",
            "iat": now,
            "exp": now + timedelta(days=_REFRESH_EXPIRE_DAYS),
        },
        _secret(),
        algorithm=_ALGORITHM,
    )


def verify_token(token: str) -> str:
    """Returns user_id. Raises jwt.PyJWTError on invalid/expired/wrong-type token."""
    payload = jwt.decode(token, _secret(), algorithms=[_ALGORITHM])
    if payload.get("type") != "access":
        raise jwt.PyJWTError("Token is not an access token")
    user_id: str | None = payload.get("sub")
    if not user_id:
        raise jwt.PyJWTError("Token missing subject")
    return user_id


def verify_refresh_token(token: str) -> str:
    """Returns user_id. Raises jwt.PyJWTError on invalid/expired/wrong-type token."""
    payload = jwt.decode(token, _secret(), algorithms=[_ALGORITHM])
    if payload.get("type") != "refresh":
        raise jwt.PyJWTError("Token is not a refresh token")
    user_id: str | None = payload.get("sub")
    if not user_id:
        raise jwt.PyJWTError("Token missing subject")
    return user_id
```

- [ ] **Step 4: Alle Core-Auth-Tests ausführen — müssen grün sein**

```bash
pytest tests/backend/test_core_auth.py -v
```

Erwartetes Ergebnis: alle Tests `PASSED`.

- [ ] **Step 5: Alle Backend-Tests ausführen — kein Regression**

```bash
pytest tests/backend/ -v
```

Erwartetes Ergebnis: alle Tests `PASSED`. Falls `test_inactive_user_cannot_access_protected_route` fehlschlägt, liegt es daran, dass `create_access_token` jetzt keinen `type`-Claim hatte — das ist mit Step 3 behoben.

- [ ] **Step 6: Committen**

```bash
git add backend/core/auth.py tests/backend/test_core_auth.py
git commit -m "feat: add refresh token functions and type claims to JWTs"
```

---

## Task 2: Backend API — Login Cookie + Refresh + Logout Endpoints

**Files:**
- Modify: `backend/schemas/auth.py`
- Modify: `backend/api/auth.py`
- Modify: `tests/backend/test_api_auth.py`

- [ ] **Step 1: Failing-Tests schreiben**

Ergänze `tests/backend/test_api_auth.py` am Ende:

```python
def test_login_sets_refresh_cookie(client, mocker):
    mocker.patch(
        "backend.api.auth.eversports_login",
        return_value={"user_id": "ev-cookie-1", "session": None},
    )
    resp = client.post("/api/auth/login", json={"email": "cookie@x.com", "password": "pw"})
    assert resp.status_code == 200
    assert "refresh_token" in resp.cookies


def test_refresh_returns_new_access_token(client, db_session):
    from backend.models.user import User
    from backend.core.auth import create_refresh_token

    user = User(
        eversports_user_id="ev-refresh-ok",
        email="refresh-ok@x.com",
        encrypted_password="x",
        active=True,
        role="user",
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    token = create_refresh_token(user.id)
    resp = client.post("/api/auth/refresh", cookies={"refresh_token": token})
    assert resp.status_code == 200
    body = resp.json()
    assert "access_token" in body
    assert body["token_type"] == "bearer"


def test_refresh_without_cookie_returns_401(client):
    resp = client.post("/api/auth/refresh")
    assert resp.status_code == 401


def test_refresh_with_invalid_token_returns_401(client):
    resp = client.post("/api/auth/refresh", cookies={"refresh_token": "not.a.valid.token"})
    assert resp.status_code == 401


def test_refresh_inactive_user_returns_403(client, db_session):
    from backend.models.user import User
    from backend.core.auth import create_refresh_token

    user = User(
        eversports_user_id="ev-refresh-inactive",
        email="refresh-inactive@x.com",
        encrypted_password="x",
        active=False,
        role="user",
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    token = create_refresh_token(user.id)
    resp = client.post("/api/auth/refresh", cookies={"refresh_token": token})
    assert resp.status_code == 403


def test_logout_clears_refresh_cookie(client):
    resp = client.post("/api/auth/logout")
    assert resp.status_code == 204
    set_cookie = resp.headers.get("set-cookie", "")
    assert "refresh_token" in set_cookie
    assert "max-age=0" in set_cookie.lower()
```

- [ ] **Step 2: Tests ausführen — müssen fehlschlagen**

```bash
pytest tests/backend/test_api_auth.py -x -v -k "refresh or logout or cookie"
```

Erwartetes Ergebnis: `FAILED` mit `404` oder `AssertionError`.

- [ ] **Step 3: `RefreshResponse` Schema hinzufügen**

Ersetze `backend/schemas/auth.py` vollständig:

```python
from pydantic import BaseModel


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    avatar_url: str | None = None


class RefreshResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
```

- [ ] **Step 4: `backend/api/auth.py` implementieren**

Ersetze `backend/api/auth.py` vollständig:

```python
import logging

from fastapi import APIRouter, Cookie, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from backend.core.auth import (
    create_access_token,
    create_refresh_token,
    verify_refresh_token,
    JWTError,
)
from backend.core.booking import eversports_login
from backend.core.email import send_new_user_notification
from backend.core.encryption import encrypt
from backend.db import get_db
from backend.models.user import User
from backend.schemas.auth import LoginRequest, RefreshResponse, TokenResponse

log = logging.getLogger(__name__)

router = APIRouter()

_REFRESH_COOKIE = "refresh_token"
_REFRESH_MAX_AGE = 90 * 24 * 60 * 60  # 7 776 000 Sekunden
_REFRESH_PATH = "/api/auth/refresh"


def _set_refresh_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=_REFRESH_COOKIE,
        value=token,
        httponly=True,
        secure=True,
        samesite="strict",
        path=_REFRESH_PATH,
        max_age=_REFRESH_MAX_AGE,
    )


@router.post("/auth/login", response_model=TokenResponse)
def login(req: LoginRequest, response: Response, db: Session = Depends(get_db)):
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
        db.commit()
        db.refresh(user)
        if not is_first_user:
            admins = db.query(User).filter(User.role == "admin", User.active == True).all()
            try:
                send_new_user_notification([a.email for a in admins], req.email)
            except Exception as exc:
                log.error("Failed to send new user notification: %s", exc)
        if not user.active:
            raise HTTPException(status_code=403, detail="Account nicht freigegeben")
    else:
        if not user.active:
            raise HTTPException(status_code=403, detail="Account nicht freigegeben")
        user.encrypted_password = encrypted_pw
        db.commit()
        db.refresh(user)

    _set_refresh_cookie(response, create_refresh_token(user.id))
    return TokenResponse(
        access_token=create_access_token(user.id),
        role=user.role,
        avatar_url=result.get("avatar_url"),
    )


@router.post("/auth/refresh", response_model=RefreshResponse)
def refresh(
    db: Session = Depends(get_db),
    refresh_token: str | None = Cookie(default=None),
):
    if not refresh_token:
        raise HTTPException(status_code=401, detail="Missing refresh token")
    try:
        user_id = verify_refresh_token(refresh_token)
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    if not user.active:
        raise HTTPException(status_code=403, detail="Account nicht freigegeben")
    return RefreshResponse(access_token=create_access_token(user.id))


@router.post("/auth/logout", status_code=204)
def logout(response: Response):
    response.delete_cookie(
        key=_REFRESH_COOKIE,
        path=_REFRESH_PATH,
        httponly=True,
        secure=True,
        samesite="strict",
    )
```

- [ ] **Step 5: Alle API-Auth-Tests ausführen — müssen grün sein**

```bash
pytest tests/backend/test_api_auth.py -v
```

Erwartetes Ergebnis: alle Tests `PASSED`.

- [ ] **Step 6: Alle Backend-Tests ausführen — kein Regression**

```bash
pytest tests/backend/ -v
```

Erwartetes Ergebnis: alle Tests `PASSED`.

- [ ] **Step 7: Committen**

```bash
git add backend/schemas/auth.py backend/api/auth.py tests/backend/test_api_auth.py
git commit -m "feat: add refresh token cookie on login, /auth/refresh and /auth/logout endpoints"
```

---

## Task 3: Frontend client.ts — credentials + Refresh on 401

**Files:**
- Create: `frontend/src/api/client.test.ts`
- Modify: `frontend/src/api/client.ts`

- [ ] **Step 1: Failing-Tests schreiben**

Erstelle `frontend/src/api/client.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { apiFetch, setToken, clearToken } from './client'

// window.location.href ist in jsdom read-only — überschreiben
const locationDescriptor = Object.getOwnPropertyDescriptor(window, 'location')
beforeEach(() => {
  Object.defineProperty(window, 'location', {
    configurable: true,
    writable: true,
    value: { href: '' },
  })
  localStorage.clear()
})
afterEach(() => {
  if (locationDescriptor) {
    Object.defineProperty(window, 'location', locationDescriptor)
  }
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function mockFetch(...responses: Partial<Response>[]) {
  const fn = vi.fn()
  responses.forEach((r) =>
    fn.mockResolvedValueOnce({
      ok: r.ok ?? true,
      status: r.status ?? 200,
      json: r.json ?? (async () => ({})),
    })
  )
  vi.stubGlobal('fetch', fn)
  return fn
}

describe('apiFetch', () => {
  it('sendet credentials: include bei jedem Request', async () => {
    const fetch = mockFetch({ status: 200, ok: true, json: async () => ({ ok: true }) })
    await apiFetch('/api/test')
    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ credentials: 'include' })
    )
  })

  it('wiederholt Request mit neuem Token nach erfolgreichem Refresh bei 401', async () => {
    setToken('expired-token')
    const fetch = mockFetch(
      { status: 401, ok: false, json: async () => ({}) },
      { status: 200, ok: true, json: async () => ({ access_token: 'new-token', token_type: 'bearer' }) },
      { status: 200, ok: true, json: async () => ({ result: 'ok' }) }
    )

    const result = await apiFetch<{ result: string }>('/api/test')

    expect(fetch).toHaveBeenCalledTimes(3)
    expect(localStorage.getItem('token')).toBe('new-token')
    expect(result).toEqual({ result: 'ok' })
  })

  it('löscht Token und leitet weiter, wenn Refresh bei 401 fehlschlägt', async () => {
    setToken('expired-token')
    mockFetch(
      { status: 401, ok: false, json: async () => ({}) },
      { status: 401, ok: false, json: async () => ({}) }
    )

    await apiFetch('/api/test').catch(() => {})

    expect(localStorage.getItem('token')).toBeNull()
    expect((window.location as { href: string }).href).toBe('/')
  })

  it('versucht keinen Refresh bei 401 ohne Token', async () => {
    const fetch = mockFetch({ status: 401, ok: false, json: async () => ({ detail: 'Unauthorized' }) })

    await expect(apiFetch('/api/test')).rejects.toThrow('Unauthorized')
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Tests ausführen — müssen fehlschlagen**

```bash
cd frontend && npm test -- client.test.ts --run
```

Erwartetes Ergebnis: `FAILED` — `credentials` fehlt, Refresh-Logik nicht vorhanden.

- [ ] **Step 3: Implementation schreiben**

Ersetze `frontend/src/api/client.ts` vollständig:

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

export function setIsActualAdmin(value: boolean): void {
  if (value) {
    localStorage.setItem('isActualAdmin', 'true')
  } else {
    localStorage.removeItem('isActualAdmin')
  }
}

export function isActualAdmin(): boolean {
  return localStorage.getItem('isActualAdmin') === 'true'
}

export function clearToken(): void {
  localStorage.removeItem('token')
  localStorage.removeItem('email')
  localStorage.removeItem('role')
  localStorage.removeItem('avatarUrl')
  localStorage.removeItem('isActualAdmin')
  window.dispatchEvent(new Event('auth-changed'))
}

export function setEmail(email: string): void {
  localStorage.setItem('email', email)
  window.dispatchEvent(new Event('auth-changed'))
}

export function getEmail(): string | null {
  return localStorage.getItem('email')
}

export function setAvatarUrl(url: string): void {
  localStorage.setItem('avatarUrl', url)
}

export function getAvatarUrl(): string | null {
  return localStorage.getItem('avatarUrl')
}

async function _refreshAccessToken(): Promise<string | null> {
  const resp = await fetch(`${BASE}/api/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  })
  if (!resp.ok) return null
  const data = await resp.json()
  setToken(data.access_token)
  return data.access_token
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

  const resp = await fetch(`${BASE}${path}`, { ...options, headers, credentials: 'include' })

  if (resp.status === 401 && getToken()) {
    const newToken = await _refreshAccessToken()
    if (newToken) {
      const retryHeaders = { ...headers, 'Authorization': `Bearer ${newToken}` }
      const retryResp = await fetch(`${BASE}${path}`, { ...options, headers: retryHeaders, credentials: 'include' })
      if (retryResp.status === 204) return undefined as T
      if (!retryResp.ok) {
        const body = await retryResp.json().catch(() => ({}))
        throw new Error(body.detail ?? `HTTP ${retryResp.status}`)
      }
      return retryResp.json()
    }
    clearToken()
    window.location.href = '/'
  }

  if (resp.status === 401) {
    const body = await resp.json().catch(() => ({}))
    throw new Error(body.detail ?? 'Unauthorized')
  }

  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}))
    throw new Error(body.detail ?? `HTTP ${resp.status}`)
  }

  if (resp.status === 204) return undefined as T
  return resp.json()
}
```

- [ ] **Step 4: Tests ausführen — müssen grün sein**

```bash
cd frontend && npm test -- client.test.ts --run
```

Erwartetes Ergebnis: alle Tests `PASSED`.

- [ ] **Step 5: Alle Frontend-Tests ausführen — kein Regression**

```bash
cd frontend && npm test -- --run
```

Erwartetes Ergebnis: alle Tests `PASSED`.

- [ ] **Step 6: Committen**

```bash
git add frontend/src/api/client.ts frontend/src/api/client.test.ts
git commit -m "feat: add credentials: include and refresh-on-401 to apiFetch"
```

---

## Task 4: Frontend — logout() Funktion und DashboardPage

**Files:**
- Modify: `frontend/src/api/auth.ts`
- Modify: `frontend/src/pages/DashboardPage.tsx`
- Modify: `frontend/src/pages/DashboardPage.test.tsx`

- [ ] **Step 1: `logout()` zu `auth.ts` hinzufügen**

Ersetze `frontend/src/api/auth.ts` vollständig:

```typescript
import { apiFetch, setToken, setEmail, setRole, setAvatarUrl, setIsActualAdmin, clearToken } from './client'

export async function login(email: string, password: string): Promise<void> {
  const data = await apiFetch<{ access_token: string; role: string; avatar_url?: string | null }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  setToken(data.access_token)
  setRole(data.role)
  setIsActualAdmin(data.role === 'admin')
  setEmail(email)
  if (data.avatar_url) setAvatarUrl(data.avatar_url)
}

export async function logout(): Promise<void> {
  try {
    await apiFetch('/api/auth/logout', { method: 'POST' })
  } finally {
    clearToken()
  }
}
```

- [ ] **Step 2: `DashboardPage.test.tsx` — `../api/auth` mocken**

Füge in `frontend/src/pages/DashboardPage.test.tsx` nach dem letzten `vi.mock(...)` Block folgendes ein (vor den `import`-Statements der gemockten Module):

```typescript
vi.mock('../api/auth', () => ({
  login: vi.fn(),
  logout: vi.fn(),
}))
```

- [ ] **Step 3: `DashboardPage.tsx` — `handleLogout` auf `logout()` umstellen**

Ändere in `frontend/src/pages/DashboardPage.tsx`:

**Zeile 3** — `clearToken` aus dem Import entfernen:
```typescript
// Vorher:
import { clearToken, isAdmin, isActualAdmin, getEmail, getAvatarUrl } from '../api/client'

// Nachher:
import { isAdmin, isActualAdmin, getEmail, getAvatarUrl } from '../api/client'
```

**Nach den anderen Imports** — `logout` importieren:
```typescript
import { logout } from '../api/auth'
```

**`handleLogout` Funktion** (ca. Zeile 169) — async machen und `logout()` aufrufen:
```typescript
// Vorher:
function handleLogout() {
  clearToken()
  navigate('/')
}

// Nachher:
async function handleLogout() {
  await logout()
  navigate('/')
}
```

- [ ] **Step 4: Frontend-Tests ausführen — müssen grün sein**

```bash
cd frontend && npm test -- --run
```

Erwartetes Ergebnis: alle Tests `PASSED`.

- [ ] **Step 5: Committen**

```bash
git add frontend/src/api/auth.ts frontend/src/pages/DashboardPage.tsx frontend/src/pages/DashboardPage.test.tsx
git commit -m "feat: add logout() function that clears refresh cookie via API"
```

---

## Abschluss

- [ ] **Gesamte Test-Suite ausführen**

```bash
pytest tests/ -v && cd frontend && npm test -- --run
```

Erwartetes Ergebnis: alle Tests Backend + Frontend `PASSED`.

- [ ] **Manuell testen**

1. Backend starten: `DATABASE_URL=sqlite:///eversports.db JWT_SECRET=test-secret ENCRYPTION_KEY=$(python -c 'import os; print(os.urandom(32).hex())') FRONTEND_URL=http://localhost:5173 uvicorn backend.main:app --reload`
2. Frontend starten: `cd frontend && npm run dev`
3. Einloggen — in DevTools → Application → Cookies: `refresh_token` mit `HttpOnly` und `Path=/api/auth/refresh` prüfen
4. In DevTools → Application → Local Storage: `token` mit ~15 min Ablauf prüfen (JWT auf jwt.io decodieren)
5. Ausloggen — Cookie verschwindet, localStorage wird geleert
