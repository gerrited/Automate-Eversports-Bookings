from backend.core.status import BookingStatus


def test_enum_werte_entsprechen_den_db_strings():
    assert BookingStatus.SUCCESS == "success"
    assert BookingStatus.ALREADY_BOOKED == "already_booked"
    assert BookingStatus.WAITLIST == "waitlist"
    assert BookingStatus.FAILED == "failed"


def test_enum_ist_string_kompatibel():
    # Wird unverändert in der DB gespeichert und in JSON serialisiert
    assert isinstance(BookingStatus.SUCCESS, str)
    assert f"{BookingStatus.WAITLIST}" == "waitlist"


def test_terminal_statuses_fuer_already_booked_pruefung():
    assert BookingStatus.terminal() == ("success", "waitlist")
