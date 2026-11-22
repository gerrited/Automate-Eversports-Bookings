from datetime import date
from unittest.mock import MagicMock, patch


from backend.core.status import BookingStatus
from backend.eversports.client import book_session, eversports_login
from backend.eversports.errors import AuthFailed


def _gql_response(payload: dict) -> MagicMock:
    resp = MagicMock(ok=True)
    resp.json.return_value = {"data": payload}
    return resp


def test_login_fehlschlag_liefert_none():
    session = MagicMock()
    session.post.return_value = _gql_response(
        {"credentialLogin": {"__typename": "ExpectedErrors", "errors": []}}
    )
    with patch("backend.eversports.client.requests.Session", return_value=session):
        assert eversports_login("a@b.com", "falsch") is None


def test_book_session_klassifiziert_ausgebucht_als_waitlist():
    session = MagicMock()
    calendar_resp = MagicMock(ok=True)
    calendar_resp.json.return_value = {"data": {"html": (
        '<ul><h3 data-day="2026-06-16"></h3>'
        '<li data-uuid="u1"><div class="session-time">18:00</div>'
        '<div class="session-name">CrossFit</div></li></ul>'
    )}}
    session.get.return_value = calendar_resp
    session.post.side_effect = [
        _gql_response({"credentialLogin": {"__typename": "AuthResult", "apiToken": "t",
                                           "user": {"id": "ev-1", "profilePicture": None}}}),
        _gql_response({"createCartFromEventBookableItem": {
            "__typename": "ExpectedErrors", "errors": [{"message": "Diese Klasse ist ausgebucht"}]}}),
        _gql_response({"addToWaitingList": {"__typename": "WaitingList", "id": "u1"}}),
    ]
    with patch("backend.eversports.client.requests.Session", return_value=session):
        result = book_session(email="a@b.com", password="pw", target_date=date(2026, 6, 16),
                              target_time="18:00", facility_id="73041", class_name="CrossFit",
                              event_type="class")
    assert result["status"] == BookingStatus.WAITLIST


# --- prepare_booking / Wiederholungen ---

from backend.eversports.client import PreparedBooking, prepare_booking  # noqa: E402
from backend.eversports.errors import CartRejected, SlotNotFound  # noqa: E402
import pytest  # noqa: E402


def test_prepare_booking_wirft_auth_failed():
    with patch("backend.eversports.client.eversports_login", return_value=None):
        with pytest.raises(AuthFailed):
            prepare_booking("a@b.com", "pw", "73041")


def test_prepare_booking_liefert_session_und_facility():
    sess = MagicMock()
    with patch("backend.eversports.client.eversports_login", return_value={"session": sess}):
        prepared = prepare_booking("a@b.com", "pw", "73041")
    assert prepared.session is sess
    assert prepared.numeric_facility_id == "73041"


def test_book_session_mit_prepared_loggt_nicht_erneut_ein():
    prepared = PreparedBooking(session=MagicMock(), numeric_facility_id="73041")
    with patch("backend.eversports.client.eversports_login") as login, \
         patch("backend.eversports.client._book_with_session", return_value={"status": "success"}) as inner:
        book_session(email="a", password="p", target_date=date(2026, 6, 16), target_time="18:00",
                     facility_id="73041", class_name="X", prepared=prepared)
    login.assert_not_called()
    assert inner.call_args.args[0] is prepared.session


def test_book_session_wiederholt_bis_slot_buchbar():
    prepared = PreparedBooking(session=MagicMock(), numeric_facility_id="73041")
    sleeps = []
    with patch("backend.eversports.client._book_with_session", side_effect=[
        SlotNotFound("noch nicht da"), CartRejected("noch nicht offen"), {"status": "success"},
    ]) as inner:
        result = book_session(email="a", password="p", target_date=date(2026, 6, 16), target_time="18:00",
                              facility_id="73041", class_name="X", prepared=prepared,
                              attempts=4, retry_delay=2.0, _sleep=sleeps.append)
    assert result == {"status": "success"}
    assert inner.call_count == 3
    assert sleeps == [2.0, 2.0]


def test_book_session_gibt_nach_letztem_versuch_auf():
    prepared = PreparedBooking(session=MagicMock(), numeric_facility_id="73041")
    with patch("backend.eversports.client._book_with_session", side_effect=SlotNotFound("weg")) as inner:
        with pytest.raises(SlotNotFound):
            book_session(email="a", password="p", target_date=date(2026, 6, 16), target_time="18:00",
                         facility_id="73041", class_name="X", prepared=prepared,
                         attempts=3, _sleep=lambda s: None)
    assert inner.call_count == 3


def test_book_session_wiederholt_keine_auth_fehler():
    prepared = PreparedBooking(session=MagicMock(), numeric_facility_id="73041")
    with patch("backend.eversports.client._book_with_session", side_effect=AuthFailed("x")) as inner:
        with pytest.raises(AuthFailed):
            book_session(email="a", password="p", target_date=date(2026, 6, 16), target_time="18:00",
                         facility_id="73041", class_name="X", prepared=prepared,
                         attempts=3, _sleep=lambda s: None)
    assert inner.call_count == 1
