"""DEPRECATED Shim — Code lebt in backend/eversports/. Wird nach Caller-Migration gelöscht."""
from backend.eversports import (  # noqa: F401
    AuthFailed, EversportsError, MarkupDrift, PlatformError, SlotNotFound,
    _cancel_with_session, _resolve_facility_id, book_session, cancel_booking,
    cancel_booking_by_ids, eversports_login, fetch_upcoming_bookings, join_waitlist,
)
