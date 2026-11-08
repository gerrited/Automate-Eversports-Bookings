"""Tests für compute_next_run: der Zeitpunkt, zu dem die Buchung ausgeführt wird.

Semantik: Der Lauf findet um target_time (Europe/Berlin) an dem Tag statt, der
days_in_advance Tage vor dem gewünschten Kurstag (weekday) liegt — also genau
dann, wenn das Buchungsfenster beim Anbieter öffnet.
"""
from datetime import datetime, time, timezone
from zoneinfo import ZoneInfo

from backend.core.schedule import compute_next_run

BERLIN = ZoneInfo("Europe/Berlin")


def berlin(*args) -> datetime:
    return datetime(*args, tzinfo=BERLIN)


def test_naechster_lauf_fuer_kurs_am_dienstag():
    # Kurs dienstags (weekday=1) 18:00, 4 Tage Vorlauf → Lauf freitags 18:00 Berlin
    # Referenz: Mittwoch 2026-06-10 12:00 → nächster Freitag ist der 12.06.
    after = berlin(2026, 6, 10, 12, 0)
    result = compute_next_run(weekday=1, target_time=time(18, 0), days_in_advance=4, after=after)
    assert result == berlin(2026, 6, 12, 18, 0)
    assert result.tzinfo == timezone.utc or result.utcoffset() is not None  # aware


def test_lauf_heute_wenn_zeit_noch_nicht_erreicht():
    # Referenz Freitag 17:59 → Lauf noch heute 18:00
    after = berlin(2026, 6, 12, 17, 59)
    result = compute_next_run(weekday=1, target_time=time(18, 0), days_in_advance=4, after=after)
    assert result == berlin(2026, 6, 12, 18, 0)


def test_lauf_naechste_woche_wenn_zeit_heute_vorbei():
    # Referenz Freitag 18:00 exakt → der Slot gilt als vorbei, nächster Lauf in einer Woche
    after = berlin(2026, 6, 12, 18, 0)
    result = compute_next_run(weekday=1, target_time=time(18, 0), days_in_advance=4, after=after)
    assert result == berlin(2026, 6, 19, 18, 0)


def test_null_tage_vorlauf():
    # Lauf am Kurstag selbst: Kurs montags (weekday=0) 07:00, 0 Tage Vorlauf
    after = berlin(2026, 6, 9, 9, 0)  # Dienstag
    result = compute_next_run(weekday=0, target_time=time(7, 0), days_in_advance=0, after=after)
    assert result == berlin(2026, 6, 15, 7, 0)  # nächster Montag


def test_rueckgabe_ist_utc():
    after = berlin(2026, 6, 10, 12, 0)
    result = compute_next_run(weekday=1, target_time=time(18, 0), days_in_advance=4, after=after)
    assert result.tzinfo == timezone.utc


def test_sommerzeit_winterzeit_uebergang():
    # Lauf 18:00 Berlin am 23.10.2026 (Sommerzeit, UTC+2) vs. 30.10.2026 (Winterzeit, UTC+1)
    # Kurs dienstags, 4 Tage Vorlauf → Läufe freitags
    summer = compute_next_run(weekday=1, target_time=time(18, 0), days_in_advance=4,
                              after=berlin(2026, 10, 22, 0, 0))
    winter = compute_next_run(weekday=1, target_time=time(18, 0), days_in_advance=4,
                              after=berlin(2026, 10, 29, 0, 0))
    assert summer == datetime(2026, 10, 23, 16, 0, tzinfo=timezone.utc)  # 18:00 MESZ = 16:00 UTC
    assert winter == datetime(2026, 10, 30, 17, 0, tzinfo=timezone.utc)  # 18:00 MEZ  = 17:00 UTC


def test_after_in_utc_funktioniert():
    # after darf in beliebiger Zeitzone übergeben werden
    after_utc = berlin(2026, 6, 10, 12, 0).astimezone(timezone.utc)
    result = compute_next_run(weekday=1, target_time=time(18, 0), days_in_advance=4, after=after_utc)
    assert result == berlin(2026, 6, 12, 18, 0)
