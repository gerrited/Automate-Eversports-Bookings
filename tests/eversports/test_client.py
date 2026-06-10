from datetime import date
from unittest.mock import MagicMock, patch

import pytest

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
