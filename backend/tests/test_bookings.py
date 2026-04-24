from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from backend.api.deps import get_current_active_user
from backend.main import app
from backend.models.user import User

_fake_user = MagicMock(spec=User)
_fake_user.id = "test-user-id"
_fake_user.email = "test@example.com"
_fake_user.encrypted_password = "encrypted-pw"
app.dependency_overrides[get_current_active_user] = lambda: _fake_user

client = TestClient(app)

_U_HTML = """
<html><body>
<div class="activity-block eventparticipant">
  <div class="marketplace-booked-activity" data-facility-id="73041">
    <div class="marketplace-booked-activity__content">
      <div class="marketplace-booked-activity__content__main">
        <h4 class="marketplace-booked-activity__name"><a href="/activity/abc">CrossFit</a></h4>
        <div class="marketplace-booked-activity__facility">
          <a href="/s/crossfit-rabbit-hole">CrossFit Rabbit Hole</a>
        </div>
      </div>
      <ul class="dropdown-menu">
        <li>
          <a class="cancel-link-event"
             data-event="91440"
             data-eventparticipant="176157972"
             data-facilityid="73041"
             data-session="80836170">Sign out</a>
        </li>
      </ul>
    </div>
    <input id="google-calendar-start" type="hidden" value="20260426T090000"/>
    <input id="google-calendar-end"   type="hidden" value="20260426T100000"/>
    <input id="facility-street" type="hidden" value="Stubbenweg"/>
    <input id="facility-zip"    type="hidden" value="26125"/>
    <input id="facility-city"   type="hidden" value="Oldenburg"/>
  </div>
</div>
</body></html>
"""


def _mock_login(session):
    return {"user_id": "u1", "session": session}


def _make_u_session():
    resp = MagicMock()
    resp.ok = True
    resp.text = _U_HTML
    session = MagicMock()
    session.get.return_value = resp
    return session


def test_fetch_upcoming_bookings_returns_structured_data():
    from backend.core.booking import fetch_upcoming_bookings
    session = _make_u_session()
    with patch("backend.core.booking.eversports_login", return_value=_mock_login(session)):
        result = fetch_upcoming_bookings("test@example.com", "password")

    assert len(result) == 1
    b = result[0]
    assert b["activity_name"] == "CrossFit"
    assert b["facility_name"] == "CrossFit Rabbit Hole"
    assert b["facility_slug"] == "crossfit-rabbit-hole"
    assert b["start_datetime"] == "2026-04-26T09:00:00"
    assert b["end_datetime"] == "2026-04-26T10:00:00"
    assert b["address"] == "Stubbenweg, 26125 Oldenburg"
    assert b["event_id"] == "91440"
    assert b["event_participant_id"] == "176157972"
    assert b["session_id"] == "80836170"
    assert b["facility_id"] == "73041"


def test_fetch_upcoming_bookings_returns_empty_on_login_failure():
    from backend.core.booking import fetch_upcoming_bookings
    with patch("backend.core.booking.eversports_login", return_value=None):
        result = fetch_upcoming_bookings("test@example.com", "wrong")
    assert result == []


def test_cancel_booking_by_ids_calls_eversports():
    from backend.core.booking import cancel_booking_by_ids
    cancel_resp = MagicMock()
    cancel_resp.ok = True
    session = MagicMock()
    session.post.return_value = cancel_resp

    with patch("backend.core.booking.eversports_login", return_value=_mock_login(session)):
        cancel_booking_by_ids(
            email="test@example.com",
            password="pw",
            event_id="91440",
            event_participant_id="176157972",
            facility_id="73041",
            session_id="80836170",
        )

    session.post.assert_called_once()
    call_kwargs = session.post.call_args
    assert "event/cancel" in call_kwargs[0][0]
    posted = call_kwargs[1]["data"]
    assert posted["eventId"] == "91440"
    assert posted["eventParticipantId"] == "176157972"
    assert posted["facilityId"] == "73041"
    assert posted["sessionId"] == "80836170"


def test_cancel_booking_by_ids_raises_on_login_failure():
    from backend.core.booking import cancel_booking_by_ids
    with patch("backend.core.booking.eversports_login", return_value=None):
        try:
            cancel_booking_by_ids("e", "p", "1", "2", "3", "4")
            assert False, "RuntimeError erwartet"
        except RuntimeError:
            pass


_BOOKING = {
    "activity_name": "CrossFit",
    "facility_name": "CrossFit Rabbit Hole",
    "facility_slug": "crossfit-rabbit-hole",
    "start_datetime": "2026-04-26T09:00:00",
    "end_datetime": "2026-04-26T10:00:00",
    "address": "Stubbenweg, 26125 Oldenburg",
    "event_id": "91440",
    "event_participant_id": "176157972",
    "session_id": "80836170",
    "facility_id": "73041",
}


def test_get_upcoming_bookings_returns_list():
    with (
        patch("backend.api.bookings.decrypt", return_value="password"),
        patch("backend.api.bookings.fetch_upcoming_bookings", return_value=[_BOOKING]),
    ):
        resp = client.get("/api/bookings/upcoming")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["activity_name"] == "CrossFit"
    assert data[0]["start_datetime"] == "2026-04-26T09:00:00"


def test_get_upcoming_bookings_502_on_empty_credentials():
    with (
        patch("backend.api.bookings.decrypt", return_value="password"),
        patch("backend.api.bookings.fetch_upcoming_bookings", side_effect=RuntimeError("login failed")),
    ):
        resp = client.get("/api/bookings/upcoming")
    assert resp.status_code == 502


def test_cancel_booking_success():
    with (
        patch("backend.api.bookings.decrypt", return_value="password"),
        patch("backend.api.bookings.cancel_booking_by_ids", return_value=None),
    ):
        resp = client.post("/api/bookings/176157972/cancel", json={
            "event_id": "91440",
            "facility_id": "73041",
            "session_id": "80836170",
        })
    assert resp.status_code == 204


def test_cancel_booking_400_on_eversports_error():
    with (
        patch("backend.api.bookings.decrypt", return_value="password"),
        patch("backend.api.bookings.cancel_booking_by_ids",
              side_effect=RuntimeError("HTTP 400 from Eversports: too late")),
    ):
        resp = client.post("/api/bookings/176157972/cancel", json={
            "event_id": "91440",
            "facility_id": "73041",
            "session_id": "80836170",
        })
    assert resp.status_code == 400
    assert "too late" in resp.json()["detail"]
