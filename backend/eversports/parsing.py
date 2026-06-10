"""Reine HTML-Parser für Eversports-Seiten. Kein I/O — testbar mit Fixtures.

Bei Markup-Änderungen seitens Eversports schlagen die Contract-Tests in
tests/eversports/test_parsing.py fehl bzw. wird MarkupDrift geworfen.
"""
from __future__ import annotations

import re
from datetime import date, datetime

from bs4 import BeautifulSoup

from backend.eversports.errors import MarkupDrift

_DATA_ID_RE = re.compile(r"data-id=[\"'](\d+)[\"']")


def extract_facility_id(html: str, page: str) -> str:
    """Numerische facility-ID aus dem HTML einer /scl/<slug>-Seite extrahieren."""
    match = _DATA_ID_RE.search(html)
    if not match:
        raise MarkupDrift("Numerische facility-ID (data-id) nicht gefunden", page=page)
    return match.group(1)


def parse_calendar_slots(html: str, target_date: date, target_time: str, class_name: str) -> list[str]:
    """data-uuids aller Slots am target_date, die um target_time beginnen und class_name heißen."""
    soup = BeautifulSoup(html, "html.parser")
    matches: list[str] = []
    for ul in soup.find_all("ul"):
        header = ul.find("h3", attrs={"data-day": target_date.isoformat()})
        if not header:
            continue
        for li in ul.find_all("li", attrs={"data-uuid": True}):
            time_div = li.find(class_="session-time")
            name_div = li.find(class_="session-name")
            if time_div and name_div:
                if (
                    time_div.get_text(strip=True).startswith(target_time)
                    and name_div.get_text(strip=True) == class_name
                ):
                    matches.append(li["data-uuid"])
    return matches


def _get_input(block, id_: str) -> str:
    """Wert eines <input id="..."> innerhalb eines Blocks lesen."""
    el = block.find("input", id=id_)
    return el["value"] if el else ""


def _parse_dt(raw: str) -> str:
    """Eversports-Datumsformat (YYYYMMDDTHHmmss) in ISO-8601 umwandeln."""
    try:
        return datetime.strptime(raw, "%Y%m%dT%H%M%S").isoformat()
    except ValueError:
        return raw


def parse_upcoming_bookings(html: str) -> list[dict]:
    """Strukturierte Buchungen von der /u-Profilseite."""
    soup = BeautifulSoup(html, "html.parser")
    bookings = []
    for block in soup.find_all("div", class_="marketplace-booked-activity"):
        name_el = block.find("h4", class_="marketplace-booked-activity__name")
        activity_name = name_el.get_text(strip=True) if name_el else ""

        facility_el = block.find("div", class_="marketplace-booked-activity__facility")
        facility_link = facility_el.find("a") if facility_el else None
        facility_name = facility_link.get_text(strip=True) if facility_link else ""
        facility_href = facility_link.get("href", "") if facility_link else ""
        facility_slug = facility_href.removeprefix("/s/")

        cancel_link = block.find("a", class_="cancel-link-event")
        if cancel_link is None:
            continue

        street = _get_input(block, "facility-street")
        zip_ = _get_input(block, "facility-zip")
        city = _get_input(block, "facility-city")
        parts = [p for p in [street, f"{zip_} {city}".strip()] if p]
        address = ", ".join(parts)

        bookings.append({
            "activity_name": activity_name,
            "facility_name": facility_name,
            "facility_slug": facility_slug,
            "start_datetime": _parse_dt(_get_input(block, "google-calendar-start")),
            "end_datetime": _parse_dt(_get_input(block, "google-calendar-end")),
            "address": address,
            "event_id": cancel_link.get("data-event", ""),
            "event_participant_id": cancel_link.get("data-eventparticipant", ""),
            "session_id": cancel_link.get("data-session", ""),
            "facility_id": cancel_link.get("data-facilityid", ""),
        })
    return bookings
