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
