from backend.eversports.errors import (
    EversportsError, AuthFailed, SlotNotFound, MarkupDrift, PlatformError,
)


def test_alle_fehler_erben_von_eversports_error():
    for cls in (AuthFailed, SlotNotFound, MarkupDrift, PlatformError):
        assert issubclass(cls, EversportsError)


def test_eversports_error_erbt_von_runtime_error():
    # Übergangs-Kompatibilität: bestehende RuntimeError-Handler (z.B. backend/api/bookings.py, backend/api/facilities.py) fangen die neuen Fehler weiterhin
    assert issubclass(EversportsError, RuntimeError)


def test_markup_drift_traegt_kontext():
    err = MarkupDrift("data-id nicht gefunden", page="/scl/crossfit-rabbit-hole")
    assert err.page == "/scl/crossfit-rabbit-hole"
    assert "data-id" in str(err)
