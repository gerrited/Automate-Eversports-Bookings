# backend/eversports/__init__.py
from backend.eversports.client import (
    book_session, cancel_booking, cancel_booking_by_ids,
    eversports_login, fetch_upcoming_bookings, join_waitlist,
    _cancel_with_session, _resolve_facility_id,
)
from backend.eversports.errors import (
    AuthFailed, EversportsError, MarkupDrift, PlatformError, SlotNotFound,
)
