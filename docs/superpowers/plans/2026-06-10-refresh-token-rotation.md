# Refresh-Token-Rotation mit Reuse-Detection — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refresh-Tokens sind heute stateless JWTs mit 90 Tagen Laufzeit — ein geleakter Token bleibt 90 Tage gültig und ist nicht widerrufbar. Stattdessen: opake, gehasht gespeicherte Tokens, die bei jedem Refresh rotieren; Wiederverwendung eines alten Tokens (= Diebstahl-Indikator) widerruft die gesamte Token-Familie.

**Architecture:** Neue Tabelle `refresh_tokens` (Token-Hash, Familie, Ablauf, Widerruf). `backend/core/refresh_tokens.py` kapselt issue/rotate/revoke. `backend/api/auth.py` stellt Login/Refresh/Logout um; Übergangsweise akzeptiert Refresh auch noch alte JWT-Cookies und tauscht sie gegen rotierende Tokens. Access-Tokens (JWT, 15 Min) bleiben unverändert.

**Tech Stack:** `secrets.token_urlsafe`, `hashlib.sha256`, SQLAlchemy, Alembic. Keine neuen Abhängigkeiten.

**Voraussetzung:** PR #18 gemerged. Vor Task 2 mit `DATABASE_URL=sqlite:///eversports.db venv/bin/alembic -c backend/alembic.ini heads` den aktuellen Head ermitteln (erwartet: `c8d9e0f1a2b3`) und als `down_revision` eintragen.

---

## Sicherheitsmodell (für Reviewer)

- **Rotation:** Jeder Refresh entwertet den benutzten Token und gibt einen neuen derselben Familie aus. Cookie-Eigenschaften bleiben wie gehabt (httpOnly, secure, SameSite=Lax, Pfad `/api/auth/refresh` — siehe Invariante in CLAUDE.md).
- **Reuse-Detection:** Kommt ein bereits rotierter (widerrufener) Token an, wurde er gestohlen oder die Antwort ging verloren. Sicherheitsentscheidung: gesamte Familie widerrufen → Angreifer UND legitimer Client müssen neu einloggen.
- **Speicherung:** Nur SHA-256-Hashes in der DB — ein DB-Leak gibt keine verwendbaren Tokens her.
- **Laufzeit:** Familie läuft 90 Tage ab letztem erfolgreichen Refresh (Sliding Window über `expires_at` des jeweils neuesten Tokens).

## File Structure

| Datei | Verantwortung |
|---|---|
| `backend/models/refresh_token.py` | SQLAlchemy-Modell |
| `backend/models/__init__.py` | Modell registrieren |
| `backend/alembic/versions/d4e5f6a7b8c9_add_refresh_tokens.py` | Migration |
| `backend/core/refresh_tokens.py` | issue / verify_and_rotate / revoke_family |
| `backend/api/auth.py` | Login/Refresh/Logout auf rotierende Tokens |
| `tests/backend/test_refresh_rotation.py` | Unit- und API-Tests |
| `SECURITY.md` | Abschnitt Token-Handling aktualisieren |

---

### Task 1: Modell + Migration

**Files:**
- Create: `backend/models/refresh_token.py`
- Modify: `backend/models/__init__.py` (Import ergänzen, analog zu den bestehenden)
- Create: `backend/alembic/versions/d4e5f6a7b8c9_add_refresh_tokens.py`

- [ ] **Step 1: Modell schreiben**

```python
# backend/models/refresh_token.py
import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, String

from backend.db import Base


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    token_hash = Column(String, unique=True, nullable=False, index=True)
    family_id = Column(String, nullable=False, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    revoked_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
```

- [ ] **Step 2: Migration schreiben** (`down_revision` vorher per `alembic heads` verifizieren!)

```python
# backend/alembic/versions/d4e5f6a7b8c9_add_refresh_tokens.py
"""add refresh_tokens table"""
import sqlalchemy as sa
from alembic import op

revision = "d4e5f6a7b8c9"
down_revision = "c8d9e0f1a2b3"  # vor Ausführung gegen `alembic heads` prüfen!
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "refresh_tokens",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("user_id", sa.String(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("token_hash", sa.String(), nullable=False),
        sa.Column("family_id", sa.String(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_refresh_tokens_user_id", "refresh_tokens", ["user_id"])
    op.create_index("ix_refresh_tokens_token_hash", "refresh_tokens", ["token_hash"], unique=True)
    op.create_index("ix_refresh_tokens_family_id", "refresh_tokens", ["family_id"])


def downgrade() -> None:
    op.drop_table("refresh_tokens")
```

- [ ] **Step 3: Migration lokal anwenden und verifizieren**

Run: `DATABASE_URL=sqlite:///eversports.db venv/bin/alembic -c backend/alembic.ini upgrade head && sqlite3 eversports.db ".schema refresh_tokens"`
Expected: Tabelle mit allen Spalten und drei Indizes

- [ ] **Step 4: Commit**

```bash
git add backend/models/ backend/alembic/versions/d4e5f6a7b8c9_add_refresh_tokens.py
git commit -m "feat(auth): refresh_tokens-Tabelle für Rotation"
```

---

### Task 2: Kernlogik issue / verify_and_rotate / revoke_family

**Files:**
- Create: `backend/core/refresh_tokens.py`
- Test: `tests/backend/test_refresh_rotation.py`

- [ ] **Step 1: Failing Tests schreiben**

```python
# tests/backend/test_refresh_rotation.py
from datetime import datetime, timedelta, timezone

import pytest

from backend.core import refresh_tokens as rt
from backend.models.refresh_token import RefreshToken
from backend.models.user import User


def _user(db, uid="u1"):
    u = User(id=uid, eversports_user_id=f"ev-{uid}", email=f"{uid}@x.com",
             encrypted_password="x", active=True)
    db.add(u)
    db.commit()
    return u


def test_issue_speichert_nur_hash(db_session):
    _user(db_session)
    raw = rt.issue(db_session, "u1")
    row = db_session.query(RefreshToken).one()
    assert raw not in (row.token_hash, row.id, row.family_id)
    assert len(raw) >= 43  # token_urlsafe(32)


def test_rotate_liefert_neuen_token_und_entwertet_alten(db_session):
    _user(db_session)
    old_raw = rt.issue(db_session, "u1")
    user_id, new_raw = rt.verify_and_rotate(db_session, old_raw)
    assert user_id == "u1"
    assert new_raw != old_raw
    # alter Token ist jetzt widerrufen → erneute Nutzung ist Reuse
    with pytest.raises(rt.ReuseDetected):
        rt.verify_and_rotate(db_session, old_raw)


def test_reuse_widerruft_gesamte_familie(db_session):
    _user(db_session)
    old_raw = rt.issue(db_session, "u1")
    _, new_raw = rt.verify_and_rotate(db_session, old_raw)
    with pytest.raises(rt.ReuseDetected):
        rt.verify_and_rotate(db_session, old_raw)  # Reuse des alten
    # auch der neue (legitime) Token der Familie ist jetzt tot
    with pytest.raises(rt.InvalidRefreshToken):
        rt.verify_and_rotate(db_session, new_raw)


def test_unbekannter_token_ist_invalid(db_session):
    with pytest.raises(rt.InvalidRefreshToken):
        rt.verify_and_rotate(db_session, "voellig-unbekannt")


def test_abgelaufener_token_ist_invalid(db_session):
    _user(db_session)
    raw = rt.issue(db_session, "u1")
    row = db_session.query(RefreshToken).one()
    row.expires_at = datetime.now(timezone.utc) - timedelta(days=1)
    db_session.commit()
    with pytest.raises(rt.InvalidRefreshToken):
        rt.verify_and_rotate(db_session, raw)


def test_revoke_family_entwertet_aktiven_token(db_session):
    _user(db_session)
    raw = rt.issue(db_session, "u1")
    rt.revoke_family_for_token(db_session, raw)
    with pytest.raises(rt.InvalidRefreshToken):
        rt.verify_and_rotate(db_session, raw)
```

- [ ] **Step 2: Fehlschlag verifizieren**

Run: `venv/bin/pytest tests/backend/test_refresh_rotation.py -v`
Expected: FAIL mit `ModuleNotFoundError: No module named 'backend.core.refresh_tokens'`

- [ ] **Step 3: Implementierung**

```python
# backend/core/refresh_tokens.py
"""Rotierende Refresh-Tokens: opak, gehasht gespeichert, familienweise widerrufbar.

Reuse eines bereits rotierten Tokens ist ein Diebstahl-Indikator und
widerruft die gesamte Familie (Angreifer UND legitimer Client fliegen raus).
"""
import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from backend.models.refresh_token import RefreshToken

_LIFETIME = timedelta(days=90)


class InvalidRefreshToken(Exception):
    """Unbekannt, abgelaufen oder Familie widerrufen."""


class ReuseDetected(InvalidRefreshToken):
    """Bereits rotierter Token wurde erneut benutzt — Familie wurde widerrufen."""


def _hash(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _as_utc(dt: datetime) -> datetime:
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt.astimezone(timezone.utc)


def issue(db: Session, user_id: str, family_id: str | None = None) -> str:
    """Neuen Token ausstellen (neue Familie, wenn family_id None). Gibt den Klartext-Token zurück."""
    raw = secrets.token_urlsafe(32)
    db.add(RefreshToken(
        user_id=user_id,
        token_hash=_hash(raw),
        family_id=family_id or str(uuid.uuid4()),
        expires_at=_now() + _LIFETIME,
    ))
    db.commit()
    return raw


def _revoke_family(db: Session, family_id: str) -> None:
    db.query(RefreshToken).filter(
        RefreshToken.family_id == family_id,
        RefreshToken.revoked_at.is_(None),
    ).update({"revoked_at": _now()})
    db.commit()


def verify_and_rotate(db: Session, raw: str) -> tuple[str, str]:
    """Token prüfen und rotieren. Gibt (user_id, neuer_klartext_token) zurück."""
    row = db.query(RefreshToken).filter(RefreshToken.token_hash == _hash(raw)).first()
    if row is None:
        raise InvalidRefreshToken("Unbekannter Refresh-Token")
    if row.revoked_at is not None:
        _revoke_family(db, row.family_id)
        raise ReuseDetected("Rotierter Token erneut benutzt — Familie widerrufen")
    if _as_utc(row.expires_at) <= _now():
        raise InvalidRefreshToken("Refresh-Token abgelaufen")

    row.revoked_at = _now()
    db.commit()
    return row.user_id, issue(db, row.user_id, family_id=row.family_id)


def revoke_family_for_token(db: Session, raw: str) -> None:
    """Logout: Familie des übergebenen Tokens widerrufen (no-op bei unbekanntem Token)."""
    row = db.query(RefreshToken).filter(RefreshToken.token_hash == _hash(raw)).first()
    if row is not None:
        _revoke_family(db, row.family_id)
```

- [ ] **Step 4: Erfolg verifizieren, Commit**

Run: `venv/bin/pytest tests/backend/test_refresh_rotation.py -v` — Expected: 6 passed

```bash
git add backend/core/refresh_tokens.py tests/backend/test_refresh_rotation.py
git commit -m "feat(auth): Rotation und Reuse-Detection für Refresh-Tokens"
```

---

### Task 3: API-Endpunkte umstellen (mit JWT-Übergangspfad)

**Files:**
- Modify: `backend/api/auth.py` — `login` (Zeile ~93: `_set_refresh_cookie(response, create_refresh_token(user.id))`), `refresh` (~102), `logout` (~121)
- Test: `tests/backend/test_refresh_rotation.py` (API-Tests ergänzen)
- Hinweis: `tests/backend/test_api_auth.py` enthält bestehende Cookie-Tests, die grün bleiben müssen

- [ ] **Step 1: Failing API-Tests schreiben**

```python
# tests/backend/test_refresh_rotation.py — ergänzen
def test_refresh_rotiert_cookie(client, db_session):
    _user(db_session, uid="api1")
    raw = rt.issue(db_session, "api1")
    client.cookies.set("refresh_token", raw)
    resp = client.post("/api/auth/refresh")
    assert resp.status_code == 200
    assert "access_token" in resp.json()
    new_cookie = resp.cookies.get("refresh_token")
    assert new_cookie and new_cookie != raw


def test_refresh_mit_wiederverwendetem_token_gibt_401(client, db_session):
    _user(db_session, uid="api2")
    raw = rt.issue(db_session, "api2")
    rt.verify_and_rotate(db_session, raw)  # rotiert — raw ist verbrannt
    client.cookies.set("refresh_token", raw)
    resp = client.post("/api/auth/refresh")
    assert resp.status_code == 401


def test_legacy_jwt_cookie_wird_auf_rotation_umgestellt(client, db_session):
    from backend.core.auth import create_refresh_token
    _user(db_session, uid="api3")
    client.cookies.set("refresh_token", create_refresh_token("api3"))
    resp = client.post("/api/auth/refresh")
    assert resp.status_code == 200
    # neues Cookie ist ein DB-Token, kein JWT (JWTs enthalten zwei Punkte)
    assert resp.cookies.get("refresh_token").count(".") == 0


def test_login_stellt_rotierendes_token_aus(client, db_session, mocker):
    mocker.patch("backend.api.auth.eversports_login",
                 return_value={"user_id": "ev-rot", "session": None})
    resp = client.post("/api/auth/login", json={"email": "rot@x.com", "password": "pw"})
    assert resp.status_code == 200
    assert resp.cookies.get("refresh_token").count(".") == 0
    assert db_session.query(RefreshToken).count() == 1
```

- [ ] **Step 2: Fehlschlag verifizieren**

Run: `venv/bin/pytest tests/backend/test_refresh_rotation.py -v`
Expected: die 4 neuen Tests FAIL (Login stellt noch JWT aus etc.)

- [ ] **Step 3: auth.py umstellen**

```python
# backend/api/auth.py — Imports ergänzen:
from backend.core import refresh_tokens as refresh_token_store

# In login(): Zeile `_set_refresh_cookie(response, create_refresh_token(user.id))` ersetzen durch:
    _set_refresh_cookie(response, refresh_token_store.issue(db, user.id))

# refresh() komplett ersetzen durch:
@router.post("/auth/refresh", response_model=RefreshResponse)
def refresh(
    response: Response,
    db: Session = Depends(get_db),
    refresh_token: str | None = Cookie(alias="refresh_token", default=None),
):
    if not refresh_token:
        raise HTTPException(status_code=401, detail="Missing refresh token")
    try:
        user_id, new_token = refresh_token_store.verify_and_rotate(db, refresh_token)
    except refresh_token_store.InvalidRefreshToken:
        # Übergang: alte stateless JWTs akzeptieren und auf Rotation umstellen
        try:
            user_id = verify_refresh_token(refresh_token)
        except JWTError:
            raise HTTPException(status_code=401, detail="Invalid or expired refresh token")
        new_token = refresh_token_store.issue(db, user_id)
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    if not user.active:
        raise HTTPException(status_code=403, detail="Account nicht freigegeben")
    _set_refresh_cookie(response, new_token)
    return RefreshResponse(access_token=create_access_token(user.id))

# logout() ersetzen durch:
@router.post("/auth/logout", status_code=204)
def logout(
    response: Response,
    db: Session = Depends(get_db),
    refresh_token: str | None = Cookie(alias="refresh_token", default=None),
):
    if refresh_token:
        refresh_token_store.revoke_family_for_token(db, refresh_token)
    response.delete_cookie(
        key=_REFRESH_COOKIE,
        path=_REFRESH_PATH,
        httponly=True,
        secure=True,
        samesite="lax",
    )
```

`create_refresh_token`-Import in auth.py entfernen, sobald ungenutzt (in `backend/core/auth.py` bleibt die Funktion für den Übergangstest und wird in einem späteren Aufräum-PR gelöscht, wenn die 90-Tage-Übergangsfrist vorbei ist).

- [ ] **Step 4: Gesamtsuite ausführen**

Run: `venv/bin/pytest tests/ -q`
Expected: alle passed — insbesondere die bestehenden Tests in `tests/backend/test_api_auth.py` (`test_refresh_returns_new_access_token` nutzt ein JWT-Cookie → läuft über den Legacy-Pfad; `test_refresh_inactive_user_returns_403` ebenso).

- [ ] **Step 5: Commit**

```bash
git add backend/api/auth.py tests/backend/
git commit -m "feat(auth): Login/Refresh/Logout auf rotierende Refresh-Tokens"
```

---

### Task 4: Aufräumjob + Doku

**Files:**
- Modify: `worker/worker.py` — am Ende von `run()` (nach `_run_push_notifications`)
- Modify: `SECURITY.md` — Abschnitt „Token-Handling"
- Test: `tests/worker/test_worker.py`

- [ ] **Step 1: Failing Test**

```python
# tests/worker/test_worker.py — ergänzen
def test_run_loescht_abgelaufene_refresh_tokens(db_session, session_factory):
    from datetime import datetime as dt, timedelta, timezone as tz
    from backend.models.refresh_token import RefreshToken
    _user(db_session, uid="rt1", ev="ev_rt1", email="rt1@b.com")
    db_session.add(RefreshToken(user_id="rt1", token_hash="alt", family_id="f1",
                                expires_at=dt.now(tz.utc) - timedelta(days=40)))
    db_session.add(RefreshToken(user_id="rt1", token_hash="frisch", family_id="f2",
                                expires_at=dt.now(tz.utc) + timedelta(days=40)))
    db_session.commit()

    run(datetime(2026, 4, 10, 18, 0), session_factory)

    hashes = {r.token_hash for r in db_session.query(RefreshToken).all()}
    assert hashes == {"frisch"}
```

- [ ] **Step 2: Fehlschlag verifizieren** — Run: `venv/bin/pytest tests/worker/test_worker.py -k refresh_tokens -v`, Expected: FAIL

- [ ] **Step 3: Implementierung in `run()`** (nach dem Push-Notification-Aufruf):

```python
    _cleanup_refresh_tokens(session_factory)


def _cleanup_refresh_tokens(session_factory) -> None:
    from backend.models.refresh_token import RefreshToken
    db = session_factory()
    try:
        deleted = db.query(RefreshToken).filter(
            RefreshToken.expires_at < datetime.now(timezone.utc) - timedelta(days=30)
        ).delete()
        db.commit()
        if deleted:
            log.info("Refresh-Token-Cleanup: %d abgelaufene Einträge gelöscht", deleted)
    finally:
        db.close()
```

- [ ] **Step 4: SECURITY.md aktualisieren** — im Abschnitt „Token-Handling" den Satz zur bekannten Einschränkung („stateless und nicht einzeln widerrufbar") ersetzen durch eine Beschreibung von Rotation, Reuse-Detection und Hash-Speicherung (Inhalt aus dem Abschnitt „Sicherheitsmodell" oben).

- [ ] **Step 5: Gesamtsuite + Commit**

Run: `venv/bin/pytest tests/ -q` — Expected: alle passed

```bash
git add worker/worker.py SECURITY.md tests/
git commit -m "feat(auth): Cleanup abgelaufener Refresh-Tokens im Worker, SECURITY.md aktualisiert"
```

---

## Self-Review-Notizen

- Frontend braucht KEINE Änderung: Es kennt den Token-Inhalt nicht (httpOnly-Cookie) und der Refresh-Flow bleibt `POST /api/auth/refresh` mit Cookie.
- Race „zwei Tabs refreshen gleichzeitig": Tab B benutzt den von Tab A schon rotierten Token → Reuse-Detection → beide neu einloggen. Bewusster Trade-off zugunsten der Sicherheit; abmilderbar wäre ein kurzes Gnaden-Fenster, das ist hier YAGNI.
- Der Legacy-JWT-Pfad ist nach 90 Tagen tote Strecke — Erinnerung: `create_refresh_token`/`verify_refresh_token` und den Übergangszweig in `refresh()` dann entfernen.
