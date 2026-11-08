"""Berechnung des nächsten Ausführungszeitpunkts eines Buchungsjobs.

Der Lauf findet um target_time (Europe/Berlin) an dem Tag statt, der
days_in_advance Tage vor dem gewünschten Kurstag (weekday) liegt — also genau
dann, wenn das Buchungsfenster beim Anbieter öffnet.
"""
from datetime import datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

BERLIN = ZoneInfo("Europe/Berlin")


def compute_next_run(weekday: int, target_time: time, days_in_advance: int, after: datetime) -> datetime:
    """Frühester Lauf-Zeitpunkt strikt nach `after`, als UTC-aware datetime.

    weekday: Wochentag des Kurses (0=Mo … 6=So).
    """
    after_berlin = after.astimezone(BERLIN)

    # Lauftag: (Lauftag + days_in_advance) hat den gewünschten Wochentag
    run_weekday = (weekday - days_in_advance) % 7
    days_ahead = (run_weekday - after_berlin.date().weekday()) % 7
    run_date = after_berlin.date() + timedelta(days=days_ahead)

    candidate = datetime.combine(run_date, target_time, tzinfo=BERLIN)
    if candidate <= after_berlin:
        candidate = datetime.combine(run_date + timedelta(days=7), target_time, tzinfo=BERLIN)
    return candidate.astimezone(timezone.utc)
