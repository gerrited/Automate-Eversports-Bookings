from enum import StrEnum


class BookingStatus(StrEnum):
    """Status einer Buchungsausführung — wird als String in booking_logs gespeichert."""

    SUCCESS = "success"
    ALREADY_BOOKED = "already_booked"
    WAITLIST = "waitlist"
    FAILED = "failed"

    @classmethod
    def terminal(cls) -> tuple[str, ...]:
        """Statuses, nach denen ein Job für das Zieldatum nicht erneut ausgeführt wird."""
        return (cls.SUCCESS.value, cls.WAITLIST.value)
