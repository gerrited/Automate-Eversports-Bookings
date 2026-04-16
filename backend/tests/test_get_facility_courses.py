from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from backend.api.deps import get_current_active_user
from backend.main import app
from backend.models.user import User

# ── Auth überspringen ──────────────────────────────────────────────────────────
_fake_user = MagicMock(spec=User)
_fake_user.id = "test-user-id"
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


def _mock_calendar_response(html: str) -> MagicMock:
    resp = MagicMock()
    resp.json.return_value = {"data": {"html": html}}
    resp.raise_for_status = MagicMock()
    return resp


# ── Tests ──────────────────────────────────────────────────────────────────────

def test_returns_unique_sorted_course_names():
    with (
        patch("backend.api.facilities.resolve_facility_id", return_value="73041"),
        patch("backend.api.facilities.requests.get", return_value=_mock_calendar_response(_CALENDAR_HTML)),
    ):
        resp = client.get("/api/facilities/crossfit-rabbit-hole/courses")

    assert resp.status_code == 200
    assert resp.json() == ["CrossFit", "Yoga"]


def test_returns_empty_list_when_slug_cannot_be_resolved():
    with patch("backend.api.facilities.resolve_facility_id", side_effect=RuntimeError("not found")):
        resp = client.get("/api/facilities/unknown-venue/courses")

    assert resp.status_code == 200
    assert resp.json() == []


def test_returns_empty_list_when_calendar_request_fails():
    with (
        patch("backend.api.facilities.resolve_facility_id", return_value="73041"),
        patch("backend.api.facilities.requests.get", side_effect=Exception("timeout")),
    ):
        resp = client.get("/api/facilities/crossfit-rabbit-hole/courses")

    assert resp.status_code == 200
    assert resp.json() == []
