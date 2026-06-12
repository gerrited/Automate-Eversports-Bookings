from unittest.mock import MagicMock, patch

import pytest

from backend.eversports import session_cache
from backend.eversports.session_cache import get_or_login, invalidate


@pytest.fixture(autouse=True)
def _clear_cache():
    session_cache._cache.clear()
    yield
    session_cache._cache.clear()


def _login_result(uid="ev-1"):
    return {"user_id": uid, "session": MagicMock(), "avatar_url": None}


def test_zweiter_aufruf_loggt_nicht_erneut_ein():
    with patch("backend.eversports.client.eversports_login",
               return_value=_login_result()) as mock_login:
        first = get_or_login("a@b.com", "pw")
        second = get_or_login("a@b.com", "pw")
    assert mock_login.call_count == 1
    assert first is second


def test_anderes_passwort_ist_anderer_cache_key():
    with patch("backend.eversports.client.eversports_login",
               side_effect=[_login_result("ev-1"), _login_result("ev-2")]) as mock_login:
        get_or_login("a@b.com", "altes-pw")
        get_or_login("a@b.com", "neues-pw")
    assert mock_login.call_count == 2


def test_fehlgeschlagener_login_wird_nicht_gecacht():
    with patch("backend.eversports.client.eversports_login",
               side_effect=[None, _login_result()]) as mock_login:
        assert get_or_login("a@b.com", "pw") is None
        assert get_or_login("a@b.com", "pw") is not None
    assert mock_login.call_count == 2


def test_invalidate_erzwingt_frischen_login():
    with patch("backend.eversports.client.eversports_login",
               return_value=_login_result()) as mock_login:
        get_or_login("a@b.com", "pw")
        invalidate("a@b.com", "pw")
        get_or_login("a@b.com", "pw")
    assert mock_login.call_count == 2


def test_book_und_fetch_teilen_sich_einen_login():
    from datetime import date

    from backend.eversports.client import book_session, fetch_upcoming_bookings

    login = _login_result()
    login["session"].get.return_value = MagicMock(ok=True, text="<html></html>")
    # book_session schlägt fehl (SlotNotFound), aber der Login ist danach gecacht
    with patch("backend.eversports.client.eversports_login", return_value=login) as mock_login:
        try:
            book_session(email="a@b.com", password="pw", target_date=date(2026, 6, 16),
                         target_time="18:00", facility_id="73041", class_name="X", event_type="class")
        except Exception:
            pass
        fetch_upcoming_bookings("a@b.com", "pw")
    assert mock_login.call_count == 1
