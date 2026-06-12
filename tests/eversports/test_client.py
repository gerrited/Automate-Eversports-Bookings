import pytest
from datetime import date
from unittest.mock import MagicMock, patch


from backend.core.status import BookingStatus
from backend.eversports.client import _with_login_retry, book_session, eversports_login
from backend.eversports.errors import AuthFailed, PlatformError, SlotNotFound


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


def test_with_login_retry_wiederholt_einmal_mit_frischem_login():
    calls = []

    def op(login):
        calls.append(login["user_id"])
        if len(calls) == 1:
            raise PlatformError("HTTP 403 from Eversports")
        return "ok"

    fresh = {"user_id": "ev-frisch", "session": MagicMock(), "avatar_url": None}
    stale = {"user_id": "ev-alt", "session": MagicMock(), "avatar_url": None}
    with patch("backend.eversports.session_cache.get_or_login", side_effect=[stale, fresh]), \
         patch("backend.eversports.session_cache.invalidate") as mock_inv:
        assert _with_login_retry("a@b.com", "pw", op) == "ok"
    mock_inv.assert_called_once_with("a@b.com", "pw")
    assert calls == ["ev-alt", "ev-frisch"]


def test_with_login_retry_gibt_zweiten_fehler_weiter():
    def op(login):
        raise PlatformError("dauerhaft kaputt")

    fresh = {"user_id": "ev-1", "session": MagicMock(), "avatar_url": None}
    with patch("backend.eversports.session_cache.get_or_login", return_value=fresh), \
         patch("backend.eversports.session_cache.invalidate"):
        with pytest.raises(PlatformError):
            _with_login_retry("a@b.com", "pw", op)


def test_with_login_retry_kein_retry_bei_slot_not_found():
    # Kurs nicht im Kalender ist kein Session-Problem — kein Invalidate, kein zweiter Versuch
    calls = []

    def op(login):
        calls.append(1)
        raise SlotNotFound("CrossFit 18:00 not found")

    fresh = {"user_id": "ev-1", "session": MagicMock(), "avatar_url": None}
    with patch("backend.eversports.session_cache.get_or_login", return_value=fresh), \
         patch("backend.eversports.session_cache.invalidate") as mock_inv:
        with pytest.raises(SlotNotFound):
            _with_login_retry("a@b.com", "pw", op)
    mock_inv.assert_not_called()
    assert calls == [1]


def test_with_login_retry_wirft_auth_failed_wenn_login_scheitert():
    with patch("backend.eversports.session_cache.get_or_login", return_value=None):
        with pytest.raises(AuthFailed):
            _with_login_retry("a@b.com", "pw", lambda login: "nie erreicht")
