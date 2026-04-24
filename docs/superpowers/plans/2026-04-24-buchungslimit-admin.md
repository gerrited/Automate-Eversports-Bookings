# Buchungslimit Admin-konfigurierbar — Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admins können das `max_active_jobs`-Limit eines Benutzers über ein klickbares Badge in der Benutzerliste einstellen; Unterschreiten des Limits deaktiviert alle aktiven Jobs und benachrichtigt den Benutzer per E-Mail.

**Architecture:** Backend-Endpoint `PATCH /admin/users/{id}/limit` (nur Admin) setzt das Limit und deaktiviert bei Bedarf alle aktiven Jobs in einer Transaktion. Das Frontend zeigt ein klickbares Badge pro Benutzer; bei Unterschreitung erscheint ein Bestätigungs-Dialog vor dem Speichern.

**Tech Stack:** FastAPI, SQLAlchemy, Pydantic, Jinja2, Resend (E-Mail), React 19, TypeScript, Tailwind CSS

---

## Dateiübersicht

| Datei | Aktion | Inhalt |
|---|---|---|
| `backend/schemas/user.py` | Modify | `max_active_jobs` + `active_job_count` zu `UserResponse`; `SetLimitRequest` hinzufügen |
| `backend/api/admin.py` | Modify | `list_users` + `set_user_active` um neue Felder erweitern; neuen Endpoint hinzufügen |
| `backend/core/email.py` | Modify | `send_limit_enforced_email` hinzufügen |
| `backend/templates/email/limit_enforced.html` | Create | E-Mail-Template |
| `tests/backend/test_api_admin.py` | Modify | Tests für neuen Endpoint und Schema-Erweiterung |
| `frontend/src/types.ts` | Modify | `max_active_jobs` + `active_job_count` zu `UserRecord` |
| `frontend/src/api/users.ts` | Modify | `setUserLimit` hinzufügen |
| `frontend/src/components/UserManagementSection.tsx` | Modify | Limit-Badge, Inline-Edit, Bestätigungs-Dialog |

---

## Task 1: Backend Schema erweitern

**Files:**
- Modify: `backend/schemas/user.py`
- Modify: `backend/api/admin.py` (Imports + `list_users` + `set_user_active`)
- Modify: `tests/backend/test_api_admin.py`

- [ ] **Schritt 1: Test schreiben (schlägt fehl)**

Am Ende von `tests/backend/test_api_admin.py` einfügen:

```python
def test_list_users_includes_max_active_jobs_and_active_job_count(client, db_session):
    admin = _make_admin(db_session, ev_id="ev-lim-a", email="limadmin@x.com")
    user = _make_user(db_session, ev_id="ev-lim-u", email="limuser@x.com")
    user.max_active_jobs = 5
    job = _make_job(db_session, user.id)          # enabled=True per Default
    _make_job(db_session, user.id, weekday=1)      # noch ein aktiver Job
    disabled_job = _make_job(db_session, user.id, weekday=2)
    disabled_job.enabled = False
    db_session.commit()

    resp = client.get("/api/admin/users", headers=_auth_header(admin.id))
    assert resp.status_code == 200
    data = next(u for u in resp.json() if u["email"] == "limuser@x.com")
    assert data["max_active_jobs"] == 5
    assert data["active_job_count"] == 2   # 2 aktiv, 1 deaktiviert
    assert data["job_count"] == 3
```

- [ ] **Schritt 2: Test ausführen — erwartet FAIL**

```bash
pytest tests/backend/test_api_admin.py::test_list_users_includes_max_active_jobs_and_active_job_count -v
```

Erwartet: `KeyError` oder `ValidationError` wegen fehlender Felder.

- [ ] **Schritt 3: Schema anpassen**

`backend/schemas/user.py` komplett ersetzen:

```python
from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class UserResponse(BaseModel):
    id: str
    email: str
    active: bool
    role: str
    job_count: int
    active_job_count: int
    max_active_jobs: Optional[int] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class SetActiveRequest(BaseModel):
    active: bool


class SetLimitRequest(BaseModel):
    max_active_jobs: Optional[int] = None
```

- [ ] **Schritt 4: `list_users` in `backend/api/admin.py` anpassen**

Import-Zeile oben ändern:
```python
from backend.schemas.user import UserResponse, SetActiveRequest, SetLimitRequest
```

Die `list_users`-Funktion ersetzen (Zeilen 24–46):

```python
@router.get("/admin/users", response_model=List[UserResponse])
def list_users(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(
            User,
            func.count(BookingJob.id).label("job_count"),
            func.sum(case((BookingJob.enabled == True, 1), else_=0)).label("active_job_count"),
        )
        .outerjoin(BookingJob, BookingJob.user_id == User.id)
        .group_by(User.id)
        .order_by(User.created_at)
        .all()
    )
    return [
        UserResponse(
            id=user.id,
            email=user.email,
            active=user.active,
            role=user.role,
            job_count=job_count,
            active_job_count=active_job_count or 0,
            max_active_jobs=user.max_active_jobs,
            created_at=user.created_at,
        )
        for user, job_count, active_job_count in rows
    ]
```

- [ ] **Schritt 5: `set_user_active` in `backend/api/admin.py` anpassen**

Den Return-Block von `set_user_active` (Zeilen 68–76) ersetzen:

```python
    job_count = db.query(func.count(BookingJob.id)).filter(BookingJob.user_id == user.id).scalar()
    active_job_count = db.query(func.count(BookingJob.id)).filter(
        BookingJob.user_id == user.id, BookingJob.enabled == True
    ).scalar()
    return UserResponse(
        id=user.id,
        email=user.email,
        active=user.active,
        role=user.role,
        job_count=job_count,
        active_job_count=active_job_count or 0,
        max_active_jobs=user.max_active_jobs,
        created_at=user.created_at,
    )
```

- [ ] **Schritt 6: Test ausführen — erwartet PASS**

```bash
pytest tests/backend/test_api_admin.py::test_list_users_includes_max_active_jobs_and_active_job_count -v
```

Erwartet: PASS.

- [ ] **Schritt 7: Alle bisherigen Tests laufen lassen**

```bash
pytest tests/backend/test_api_admin.py -v
```

Erwartet: alle PASS.

- [ ] **Schritt 8: Committen**

```bash
git add backend/schemas/user.py backend/api/admin.py tests/backend/test_api_admin.py
git commit -m "feat: add max_active_jobs and active_job_count to UserResponse"
```

---

## Task 2: E-Mail-Template und Funktion

**Files:**
- Create: `backend/templates/email/limit_enforced.html`
- Modify: `backend/core/email.py`

- [ ] **Schritt 1: E-Mail-Template erstellen**

`backend/templates/email/limit_enforced.html` anlegen:

```html
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Buchungslimit angepasst</title>
</head>
<body style="background:#021214;margin:0;padding:32px 16px;font-family:-apple-system,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:0 auto;">

    <div style="background:#03191b;border-radius:12px 12px 0 0;padding:18px 24px;border:1px solid rgba(100,116,139,0.2);border-bottom:1px solid rgba(100,116,139,0.15);">
      <img src="{{ frontend_url }}/logo.png" alt="FOReversports" height="36"
           style="display:inline-block;vertical-align:middle;"
           onerror="this.style.display='none';this.nextElementSibling.style.display='inline-block'">
      <span style="display:none;font-size:18px;font-weight:700;vertical-align:middle;letter-spacing:-0.3px;">
        <span style="color:#26b5c0;">∞ FOR</span><span style="color:#9ca3af;font-weight:400;">eversports</span>
      </span>
    </div>

    <div style="background:#03191b;border-radius:0 0 12px 12px;border:1px solid rgba(100,116,139,0.2);border-top:none;padding:24px;">
      <p style="color:#f1f5f9;font-size:18px;font-weight:600;margin:0 0 12px;">Buchungslimit angepasst</p>
      <div style="background:#1a1208;border-left:3px solid #f59e0b;border-radius:0 5px 5px 0;padding:10px 14px;margin:0 0 16px;font-size:13px;color:#fcd34d;">
        Dein Buchungslimit wurde auf {{ max_active_jobs }} aktive Buchung{{ 'en' if max_active_jobs != 1 else '' }} gesetzt.
      </div>
      <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:0 0 20px;">
        Da deine aktiven Buchungen das neue Limit überschritten haben, wurden alle deine aktiven Buchungsjobs deaktiviert.
        Du kannst sie jederzeit im Dashboard bis zum neuen Limit wieder aktivieren.
      </p>
      <a href="{{ frontend_url }}" style="display:inline-block;background:#004349;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:10px 22px;border-radius:8px;">Zum Dashboard →</a>
    </div>

    <p style="color:#374151;font-size:11px;text-align:center;margin:16px 0 0;">FOReversports · Kontobenachrichtigung</p>
  </div>
</body>
</html>
```

- [ ] **Schritt 2: `send_limit_enforced_email` in `backend/core/email.py` hinzufügen**

Am Ende von `backend/core/email.py` (nach `send_account_status_email`, vor `_WEEKDAYS_DE`) einfügen:

```python
def send_limit_enforced_email(user_email: str, max_active_jobs: int) -> None:
    """Benachrichtigt den User, dass sein Limit gesetzt und alle Jobs deaktiviert wurden. Best-effort."""
    try:
        resend.api_key = os.environ["RESEND_API_KEY"]
        from_email = os.environ["FROM_EMAIL"]
        sender = f"FOReversports <{from_email}>"
        frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:5173")

        subject = "Dein Buchungslimit wurde angepasst"
        html = _templates.get_template("limit_enforced.html").render(
            max_active_jobs=max_active_jobs,
            frontend_url=frontend_url,
        )
        resend.Emails.send({
            "from": sender,
            "to": [user_email],
            "subject": subject,
            "html": html,
        })
        log.info("Limit enforced email sent to %s (limit=%d)", user_email, max_active_jobs)
    except Exception as exc:
        log.error("Failed to send limit enforced email to %s: %s", user_email, exc)
```

- [ ] **Schritt 3: Alle Tests laufen lassen**

```bash
pytest tests/ -x
```

Erwartet: alle PASS (keine neuen Tests für die Funktion nötig — wird in Task 3 über den Endpoint getestet).

- [ ] **Schritt 4: Committen**

```bash
git add backend/templates/email/limit_enforced.html backend/core/email.py
git commit -m "feat: add limit_enforced email template and send function"
```

---

## Task 3: Backend-Endpoint `PATCH /admin/users/{id}/limit`

**Files:**
- Modify: `backend/api/admin.py`
- Modify: `tests/backend/test_api_admin.py`

- [ ] **Schritt 1: Tests schreiben (schlagen fehl)**

Am Ende von `tests/backend/test_api_admin.py` einfügen:

```python
# --- /admin/users/{id}/limit ---

def test_set_limit_requires_admin(client, db_session):
    user = _make_user(db_session, ev_id="ev-sl0", email="sl0@x.com")
    resp = client.patch(
        f"/api/admin/users/{user.id}/limit",
        json={"max_active_jobs": 3},
        headers=_auth_header(user.id),
    )
    assert resp.status_code == 403


def test_set_limit_user_not_found(client, db_session):
    admin = _make_admin(db_session, ev_id="ev-sl1", email="sl1@x.com")
    resp = client.patch(
        "/api/admin/users/nonexistent/limit",
        json={"max_active_jobs": 3},
        headers=_auth_header(admin.id),
    )
    assert resp.status_code == 404


def test_set_limit_sets_value(client, db_session):
    admin = _make_admin(db_session, ev_id="ev-sl2", email="sl2@x.com")
    user = _make_user(db_session, ev_id="ev-sl2u", email="sl2u@x.com")

    resp = client.patch(
        f"/api/admin/users/{user.id}/limit",
        json={"max_active_jobs": 3},
        headers=_auth_header(admin.id),
    )
    assert resp.status_code == 200
    assert resp.json()["max_active_jobs"] == 3


def test_set_limit_to_null_clears_limit(client, db_session):
    admin = _make_admin(db_session, ev_id="ev-sl3", email="sl3@x.com")
    user = _make_user(db_session, ev_id="ev-sl3u", email="sl3u@x.com")
    user.max_active_jobs = 5
    db_session.commit()

    resp = client.patch(
        f"/api/admin/users/{user.id}/limit",
        json={"max_active_jobs": None},
        headers=_auth_header(admin.id),
    )
    assert resp.status_code == 200
    assert resp.json()["max_active_jobs"] is None


def test_set_limit_above_active_jobs_no_deactivation(client, db_session, mocker):
    admin = _make_admin(db_session, ev_id="ev-sl4", email="sl4@x.com")
    user = _make_user(db_session, ev_id="ev-sl4u", email="sl4u@x.com")
    _make_job(db_session, user.id)
    _make_job(db_session, user.id, weekday=1)
    mock_email = mocker.patch("backend.api.admin.send_limit_enforced_email")

    resp = client.patch(
        f"/api/admin/users/{user.id}/limit",
        json={"max_active_jobs": 5},
        headers=_auth_header(admin.id),
    )
    assert resp.status_code == 200
    assert resp.json()["active_job_count"] == 2
    mock_email.assert_not_called()


def test_set_limit_below_active_jobs_deactivates_all(client, db_session, mocker):
    admin = _make_admin(db_session, ev_id="ev-sl5", email="sl5@x.com")
    user = _make_user(db_session, ev_id="ev-sl5u", email="sl5u@x.com")
    _make_job(db_session, user.id)
    _make_job(db_session, user.id, weekday=1)
    _make_job(db_session, user.id, weekday=2)
    mock_email = mocker.patch("backend.api.admin.send_limit_enforced_email")

    resp = client.patch(
        f"/api/admin/users/{user.id}/limit",
        json={"max_active_jobs": 2},
        headers=_auth_header(admin.id),
    )
    assert resp.status_code == 200
    assert resp.json()["active_job_count"] == 0
    mock_email.assert_called_once_with(user.email, 2)


def test_set_limit_email_failure_does_not_break_response(client, db_session, mocker):
    admin = _make_admin(db_session, ev_id="ev-sl6", email="sl6@x.com")
    user = _make_user(db_session, ev_id="ev-sl6u", email="sl6u@x.com")
    _make_job(db_session, user.id)
    mocker.patch(
        "backend.api.admin.send_limit_enforced_email",
        side_effect=Exception("Resend down"),
    )

    resp = client.patch(
        f"/api/admin/users/{user.id}/limit",
        json={"max_active_jobs": 0},
        headers=_auth_header(admin.id),
    )
    assert resp.status_code == 200
    assert resp.json()["active_job_count"] == 0
```

- [ ] **Schritt 2: Tests ausführen — erwartet FAIL**

```bash
pytest tests/backend/test_api_admin.py -k "set_limit" -v
```

Erwartet: alle FAIL mit 404 oder 405 (Endpoint existiert nicht).

- [ ] **Schritt 3: Endpoint in `backend/api/admin.py` implementieren**

Import-Zeile für E-Mail-Funktionen ändern:
```python
from backend.core.email import send_account_status_email, send_limit_enforced_email, send_test_email
```

Nach dem `set_user_active`-Endpoint (nach Zeile 76, vor dem `list_all_jobs`-Endpoint) einfügen:

```python
@router.patch("/admin/users/{user_id}/limit", response_model=UserResponse)
def set_user_limit(
    user_id: str,
    body: SetLimitRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    user.max_active_jobs = body.max_active_jobs

    jobs_deactivated = False
    if body.max_active_jobs is not None:
        active_jobs = (
            db.query(BookingJob)
            .filter(BookingJob.user_id == user_id, BookingJob.enabled == True)
            .all()
        )
        if len(active_jobs) > body.max_active_jobs:
            for job in active_jobs:
                job.enabled = False
            jobs_deactivated = True

    db.commit()
    db.refresh(user)

    if jobs_deactivated:
        try:
            send_limit_enforced_email(user.email, body.max_active_jobs)
        except Exception as exc:
            log.error("Failed to send limit enforced email: %s", exc)

    job_count = db.query(func.count(BookingJob.id)).filter(BookingJob.user_id == user.id).scalar()
    active_job_count = db.query(func.count(BookingJob.id)).filter(
        BookingJob.user_id == user.id, BookingJob.enabled == True
    ).scalar()
    return UserResponse(
        id=user.id,
        email=user.email,
        active=user.active,
        role=user.role,
        job_count=job_count,
        active_job_count=active_job_count or 0,
        max_active_jobs=user.max_active_jobs,
        created_at=user.created_at,
    )
```

- [ ] **Schritt 4: Tests ausführen — erwartet PASS**

```bash
pytest tests/backend/test_api_admin.py -k "set_limit" -v
```

Erwartet: alle PASS.

- [ ] **Schritt 5: Alle Backend-Tests laufen lassen**

```bash
pytest tests/ -x
```

Erwartet: alle PASS.

- [ ] **Schritt 6: Committen**

```bash
git add backend/api/admin.py tests/backend/test_api_admin.py
git commit -m "feat: add PATCH /admin/users/{id}/limit endpoint with job deactivation"
```

---

## Task 4: Frontend — Typen und API-Client

**Files:**
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/api/users.ts`

- [ ] **Schritt 1: `UserRecord` in `frontend/src/types.ts` erweitern**

Das `UserRecord`-Interface (Zeilen 42–49) ersetzen:

```typescript
export interface UserRecord {
  id: string
  email: string
  active: boolean
  role: string
  job_count: number
  active_job_count: number
  max_active_jobs: number | null
  created_at: string
}
```

- [ ] **Schritt 2: `setUserLimit` in `frontend/src/api/users.ts` hinzufügen**

Am Ende der Datei einfügen:

```typescript
export async function setUserLimit(id: string, max_active_jobs: number | null): Promise<UserRecord> {
  return apiFetch<UserRecord>(`/api/admin/users/${id}/limit`, {
    method: 'PATCH',
    body: JSON.stringify({ max_active_jobs }),
  })
}
```

- [ ] **Schritt 3: Frontend-Tests laufen lassen**

```bash
cd frontend && npm test -- --run
```

Erwartet: alle PASS (kein TypeScript-Fehler, keine broken Tests).

- [ ] **Schritt 4: Committen**

```bash
git add frontend/src/types.ts frontend/src/api/users.ts
git commit -m "feat: add max_active_jobs and active_job_count to UserRecord, add setUserLimit API"
```

---

## Task 5: Frontend — Limit-Badge, Inline-Edit und Bestätigungs-Dialog

**Files:**
- Modify: `frontend/src/components/UserManagementSection.tsx`

- [ ] **Schritt 1: Import und State in `UserManagementSection.tsx` ergänzen**

Import-Zeile (Zeile 2) anpassen:
```typescript
import { listUsers, setUserActive, setUserLimit } from '../api/users'
```

Nach `const currentEmail = getEmail()` (nach Zeile 14) die neuen State-Variablen einfügen:

```typescript
  const [editingLimitUserId, setEditingLimitUserId] = useState<string | null>(null)
  const [limitInputValue, setLimitInputValue] = useState('')
  const [pendingLimit, setPendingLimit] = useState<{ user: UserRecord; value: number | null } | null>(null)
```

- [ ] **Schritt 2: Limit-Handler-Funktionen vor dem `return` einfügen**

Nach `handleToggle` (nach Zeile 47) einfügen:

```typescript
  function startEditLimit(user: UserRecord) {
    setEditingLimitUserId(user.id)
    setLimitInputValue(user.max_active_jobs !== null ? String(user.max_active_jobs) : '')
  }

  function cancelEditLimit() {
    setEditingLimitUserId(null)
    setLimitInputValue('')
  }

  async function handleSaveLimit(user: UserRecord) {
    const trimmed = limitInputValue.trim()
    const newLimit = trimmed === '' ? null : parseInt(trimmed, 10)
    if (newLimit !== null && (isNaN(newLimit) || newLimit < 1)) return
    cancelEditLimit()
    if (newLimit !== null && user.active_job_count > newLimit) {
      setPendingLimit({ user, value: newLimit })
      return
    }
    await setUserLimit(user.id, newLimit)
    load()
  }

  async function handleConfirmLimit() {
    if (!pendingLimit) return
    await setUserLimit(pendingLimit.user.id, pendingLimit.value)
    setPendingLimit(null)
    load()
  }
```

- [ ] **Schritt 3: Limit-Badge/Inline-Edit in die Benutzerliste einbauen**

Den `<div>` mit dem E-Mail und den Status-Infos (Zeilen 96–113) ersetzen:

```tsx
                <div>
                  <p className="text-white text-sm">{user.email}</p>
                  <div className="flex items-center gap-2 flex-wrap mt-1">
                    <span className="text-slate-400 text-xs">
                      {user.role === 'admin' ? 'Admin' : 'User'} ·{' '}
                      {user.active ? 'Aktiv' : 'Inaktiv'} ·{' '}
                      {onJobsClick && user.job_count > 0 ? (
                        <button
                          aria-label={`Jobs von ${user.email} anzeigen`}
                          onClick={() => onJobsClick(user.email)}
                          className="text-white underline cursor-pointer hover:opacity-80 transition-opacity"
                        >
                          {user.job_count} {user.job_count === 1 ? 'Job' : 'Jobs'}
                        </button>
                      ) : (
                        <>{user.job_count} {user.job_count === 1 ? 'Job' : 'Jobs'}</>
                      )}
                    </span>
                    {editingLimitUserId === user.id ? (
                      <span className="inline-flex items-center gap-1">
                        <input
                          type="number"
                          min="1"
                          value={limitInputValue}
                          onChange={e => setLimitInputValue(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleSaveLimit(user)
                            if (e.key === 'Escape') cancelEditLimit()
                          }}
                          placeholder="∞"
                          className="w-12 px-1 py-0.5 text-xs bg-slate-800 border border-slate-600 rounded text-center text-white focus:outline-none focus:border-violet-500"
                          autoFocus
                        />
                        <button
                          onClick={() => handleSaveLimit(user)}
                          className="text-xs text-green-400 hover:text-green-300 px-1"
                        >✓</button>
                        <button
                          onClick={cancelEditLimit}
                          className="text-xs text-slate-500 hover:text-slate-400 px-1"
                        >✕</button>
                      </span>
                    ) : (
                      <button
                        onClick={() => startEditLimit(user)}
                        className={`text-xs px-2 py-0.5 rounded-full border cursor-pointer hover:opacity-80 transition-opacity ${
                          user.max_active_jobs !== null
                            ? 'bg-violet-900/50 border-violet-700 text-violet-300'
                            : 'bg-slate-800 border-slate-700 text-slate-500'
                        }`}
                      >
                        {user.max_active_jobs !== null ? `Limit: ${user.max_active_jobs} ✎` : 'Kein Limit ✎'}
                      </button>
                    )}
                  </div>
                </div>
```

- [ ] **Schritt 4: Bestätigungs-Dialog am Ende des Komponenten-Returns einbauen**

Direkt vor dem letzten `</div>` (dem äußersten, Zeile 148) einfügen:

```tsx
          {pendingLimit && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
              <div className="bg-surface-card border border-slate-700 rounded-xl p-6 max-w-sm w-full mx-4">
                <p className="text-white font-semibold mb-3">Alle Jobs werden deaktiviert</p>
                <p className="text-slate-400 text-sm mb-5">
                  Das neue Limit von{' '}
                  <strong className="text-white">{pendingLimit.value}</strong> liegt unter den aktuell{' '}
                  <strong className="text-white">{pendingLimit.user.active_job_count}</strong> aktiven Jobs von{' '}
                  <strong className="text-white">{pendingLimit.user.email}</strong>. Alle aktiven Jobs werden deaktiviert und der Benutzer per E-Mail informiert.
                </p>
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setPendingLimit(null)}
                    className="px-4 py-2 text-sm text-slate-400 hover:text-white border border-slate-700 rounded-lg transition-colors"
                  >
                    Abbrechen
                  </button>
                  <button
                    onClick={handleConfirmLimit}
                    className="px-4 py-2 text-sm bg-red-900 hover:bg-red-700 text-red-300 rounded-lg transition-colors"
                  >
                    Ja, Limit setzen
                  </button>
                </div>
              </div>
            </div>
          )}
```

- [ ] **Schritt 5: TypeScript-Build prüfen**

```bash
cd frontend && npm run build 2>&1 | tail -20
```

Erwartet: keine TypeScript-Fehler, Build erfolgreich.

- [ ] **Schritt 6: Dev-Server starten und manuell testen**

```bash
# Terminal 1 — Backend
DATABASE_URL=sqlite:///eversports.db JWT_SECRET=test-secret ENCRYPTION_KEY=$(python -c 'import os; print(os.urandom(32).hex())') FRONTEND_URL=http://localhost:5173 uvicorn backend.main:app --reload

# Terminal 2 — Frontend
cd frontend && npm run dev
```

Folgendes testen:
1. Als Admin einloggen und zur Benutzer-Übersicht navigieren
2. Ein Badge „Kein Limit ✎" anklicken → Inline-Edit erscheint
3. Zahl eingeben, Enter drücken → Badge zeigt „Limit: X ✎"
4. Limit auf Wert **unter** aktueller aktiver Job-Anzahl setzen → Bestätigungs-Dialog erscheint
5. Dialog bestätigen → Jobs werden deaktiviert, `active_job_count` im Badge aktualisiert sich
6. Dialog abbrechen → kein Limit gesetzt, Jobs bleiben aktiv
7. Badge mit Limit anklicken → Inline-Edit mit aktuellem Wert vorausgefüllt
8. Feld leeren, bestätigen → Badge wechselt zurück zu „Kein Limit ✎"

- [ ] **Schritt 7: Frontend-Tests laufen lassen**

```bash
cd frontend && npm test -- --run
```

Erwartet: alle PASS.

- [ ] **Schritt 8: Committen**

```bash
git add frontend/src/components/UserManagementSection.tsx
git commit -m "feat: add limit badge and inline-edit to user management"
```
