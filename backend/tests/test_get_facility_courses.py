from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from backend.api.deps import get_current_active_user
from backend.main import app
from backend.models.user import User

# ── Auth überspringen ──────────────────────────────────────────────────────────
_fake_user = MagicMock(spec=User)
_fake_user.id = "test-user-id"
_fake_user.email = "test@example.com"
_fake_user.encrypted_password = "encrypted-pw"
app.dependency_overrides[get_current_active_user] = lambda: _fake_user

client = TestClient(app)

# ── Hilfsdaten ─────────────────────────────────────────────────────────────────
_CALENDAR_HTML = """
<ul>
  <li data-uuid="1"><div class="session-name">CrossFit</div></li>
  <li data-uuid="2"><div class="session-name">Yoga</div></li>
  <li data-uuid="3"><div class="session-name">CrossFit</div></li>
</ul>
"""


def _make_session_mock(html: str) -> MagicMock:
    resp = MagicMock()
    resp.json.return_value = {"data": {"html": html}}
    resp.raise_for_status = MagicMock()
    session = MagicMock()
    session.get.return_value = resp
    return session


def _login_result(session: MagicMock) -> dict:
    return {"user_id": "u1", "session": session}


# ── Tests ──────────────────────────────────────────────────────────────────────

def test_returns_unique_sorted_course_names():
    session = _make_session_mock(_CALENDAR_HTML)
    with (
        patch("backend.api.facilities.decrypt", return_value="password"),
        patch("backend.api.facilities.eversports_login", return_value=_login_result(session)),
        patch("backend.api.facilities._booking_resolve_facility_id", return_value="73041"),
    ):
        resp = client.get("/api/facilities/crossfit-rabbit-hole/courses")

    assert resp.status_code == 200
    assert resp.json() == ["CrossFit", "Yoga"]


def test_returns_empty_list_when_login_fails():
    with (
        patch("backend.api.facilities.decrypt", return_value="password"),
        patch("backend.api.facilities.eversports_login", return_value=None),
    ):
        resp = client.get("/api/facilities/crossfit-rabbit-hole/courses")

    assert resp.status_code == 200
    assert resp.json() == []


def test_returns_empty_list_when_slug_cannot_be_resolved():
    with (
        patch("backend.api.facilities.decrypt", return_value="password"),
        patch("backend.api.facilities.eversports_login", return_value=_login_result(MagicMock())),
        patch("backend.api.facilities._booking_resolve_facility_id", side_effect=RuntimeError("not found")),
    ):
        resp = client.get("/api/facilities/crossfit-rabbit-hole/courses")

    assert resp.status_code == 200
    assert resp.json() == []


def test_returns_empty_list_when_calendar_request_fails():
    session = MagicMock()
    session.get.side_effect = Exception("timeout")
    with (
        patch("backend.api.facilities.decrypt", return_value="password"),
        patch("backend.api.facilities.eversports_login", return_value=_login_result(session)),
        patch("backend.api.facilities._booking_resolve_facility_id", return_value="73041"),
    ):
        resp = client.get("/api/facilities/crossfit-rabbit-hole/courses")

    assert resp.status_code == 200
    assert resp.json() == []
