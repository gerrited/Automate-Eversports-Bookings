from datetime import date
from pathlib import Path

import pytest

from backend.eversports.errors import MarkupDrift
from backend.eversports.parsing import (
    extract_facility_id, parse_calendar_slots, parse_upcoming_bookings,
)

FIXTURES = Path(__file__).parent / "fixtures"


def _calendar() -> str:
    return (FIXTURES / "calendar_week.html").read_text(encoding="utf-8")


def test_kalender_findet_passenden_slot():
    uuids = parse_calendar_slots(_calendar(), target_date=date(2026, 6, 16),
                                 target_time="18:00", class_name="CrossFit")
    assert uuids == ["uuid-crossfit-18"]


def test_kalender_filtert_nach_name_zeit_und_datum():
    assert parse_calendar_slots(_calendar(), date(2026, 6, 16), "19:00", "CrossFit") == ["uuid-crossfit-19"]
    assert parse_calendar_slots(_calendar(), date(2026, 6, 17), "18:00", "CrossFit") == ["uuid-crossfit-mi"]
    assert parse_calendar_slots(_calendar(), date(2026, 6, 16), "18:00", "Pilates") == []


def test_profilseite_liefert_strukturierte_buchung():
    bookings = parse_upcoming_bookings((FIXTURES / "profile_bookings.html").read_text(encoding="utf-8"))
    assert len(bookings) == 1
    b = bookings[0]
    assert b["activity_name"] == "CrossFit"
    assert b["facility_slug"] == "crossfit-rabbit-hole"
    assert b["start_datetime"] == "2026-06-16T18:00:00"
    assert b["address"] == "Musterstr. 1, 10115 Berlin"
    assert b["event_id"] == "evt-1"
    assert b["facility_id"] == "73041"


def test_facility_id_aus_slug_seite():
    assert extract_facility_id('<div data-id="73041">x</div>', page="/scl/slug") == "73041"


def test_facility_id_fehlend_ist_markup_drift():
    with pytest.raises(MarkupDrift):
        extract_facility_id("<html><body>Cloudflare</body></html>", page="/scl/slug")
