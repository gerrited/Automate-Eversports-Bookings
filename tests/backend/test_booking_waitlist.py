import pytest
from unittest.mock import MagicMock, patch
from backend.core.booking import join_waitlist


def test_join_waitlist_returns_id_on_success():
    session = MagicMock()
    gql_response = {"addToWaitingList": {"id": "abc-123", "__typename": "WaitingList"}}

    with patch("backend.core.booking._gql", return_value=gql_response):
        result = join_waitlist(session, "abc-123")

    assert result == "abc-123"


def test_join_waitlist_raises_on_expected_errors():
    session = MagicMock()
    gql_response = {
        "addToWaitingList": {
            "__typename": "ExpectedErrors",
            "errors": [{"message": "Warteliste nicht verfügbar"}],
        }
    }

    with patch("backend.core.booking._gql", return_value=gql_response):
        with pytest.raises(RuntimeError, match="Waitlist join failed"):
            join_waitlist(session, "abc-123")


from backend.core.booking import book_session
from unittest.mock import patch, MagicMock
from datetime import date


def _make_session_mock():
    session = MagicMock()
    session.get.return_value.ok = True
    session.get.return_value.json.return_value = {
        "data": {
            "html": """
            <ul>
              <h3 data-day="2026-04-14"></h3>
              <li data-uuid="item-full-123">
                <div class="session-time">18:00 Uhr</div>
                <div class="session-name">CrossFit</div>
              </li>
            </ul>
            """
        }
    }
    return session


def test_book_session_joins_waitlist_when_fully_booked(mocker):
    mocker.patch("backend.core.booking.eversports_login", return_value={
        "user_id": "u1",
        "session": _make_session_mock(),
        "avatar_url": None,
    })
    mocker.patch("backend.core.booking._resolve_facility_id", return_value="73041")

    cart_response = {
        "createCartFromEventBookableItem": {
            "__typename": "ExpectedErrors",
            "errors": [{"id": "1", "message": "ausgebucht", "__typename": "ExpectedError"}],
        }
    }
    waitlist_response = {
        "addToWaitingList": {"id": "item-full-123", "__typename": "WaitingList"}
    }

    call_count = {"n": 0}
    def fake_gql(session, op, query, variables):
        call_count["n"] += 1
        if call_count["n"] == 1:
            return cart_response
        return waitlist_response

    mocker.patch("backend.core.booking._gql", side_effect=fake_gql)

    result = book_session(
        email="a@b.com",
        password="pw",
        target_date=date(2026, 4, 14),
        target_time="18:00",
        facility_id="73041",
        class_name="CrossFit",
    )

    assert result["status"] == "waitlist"
    assert result["order_id"] is None


def test_book_session_raises_on_other_cart_errors(mocker):
    mocker.patch("backend.core.booking.eversports_login", return_value={
        "user_id": "u1",
        "session": _make_session_mock(),
        "avatar_url": None,
    })
    mocker.patch("backend.core.booking._resolve_facility_id", return_value="73041")

    cart_response = {
        "createCartFromEventBookableItem": {
            "__typename": "ExpectedErrors",
            "errors": [{"id": "1", "message": "Zahlung abgelehnt", "__typename": "ExpectedError"}],
        }
    }
    mocker.patch("backend.core.booking._gql", return_value=cart_response)

    with pytest.raises(RuntimeError, match="Cart creation failed"):
        book_session(
            email="a@b.com",
            password="pw",
            target_date=date(2026, 4, 14),
            target_time="18:00",
            facility_id="73041",
            class_name="CrossFit",
        )
