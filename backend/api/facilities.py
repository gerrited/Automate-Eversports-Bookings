# Eversports facility search
# Endpoint: https://www.eversports.de/api/checkout
# Operation: SearchInventorySearch
# Variable for search term: searchTerm
# Result path: data.inventorySearch (filter __typename == "VenueSearchResult")
# Result item shape: { slug: str (used as id), name: str }
#
# Note on IDs: The Eversports marketplace search returns venue UUIDs, but the
# booking calendar API (/api/eventsession/calendar) requires a numeric facilityId.
# We use the venue *slug* as the facility_id (e.g. "crossfit-rabbit-hole").
# At booking time, booking.py resolves the slug to a numeric ID by fetching the
# /scl/<slug> page and extracting data-id from the HTML.
# Legacy numeric IDs (e.g. "73041") continue to work unchanged.

import logging
from datetime import date, timedelta
from typing import List

from bs4 import BeautifulSoup

import requests
from fastapi import APIRouter, Depends, HTTPException, Query

from backend.core.booking import eversports_login, _resolve_facility_id as _booking_resolve_facility_id
from backend.core.encryption import decrypt

logger = logging.getLogger(__name__)

from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.api.deps import get_current_active_user
from backend.db import get_db
from backend.models.booking_job import BookingJob
from backend.models.user import User

router = APIRouter()

_EVERSPORTS_SEARCH_URL = "https://www.eversports.de/api/checkout"
_EVERSPORTS_OPERATION  = "SearchInventorySearch"
_EVERSPORTS_QUERY      = (
    "query SearchInventorySearch($coordinate: CoordinateArgs!, $searchTerm: String, $limit: Int) {\n"
    "  inventorySearch(coordinate: $coordinate, searchTerm: $searchTerm, limit: $limit) {\n"
    "    ... on VenueSearchResult { id slug name __typename }\n"
    "    __typename\n"
    "  }\n"
    "}"
)
# Default coordinate: central Germany (Frankfurt).
# The coordinate is required by the API and influences result ranking,
# but the searchTerm is the primary filter for finding specific venues.
_DEFAULT_COORDINATE = {"latitude": 50.1109, "longitude": 8.6821}
_SEARCH_LIMIT = 20
_CALENDAR_URL = "https://www.eversports.de/api/eventsession/calendar"

_HEADERS = {
    "Content-Type": "application/json",
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36"
    ),
    "Origin": "https://www.eversports.de",
    "Referer": "https://www.eversports.de/",
}


@router.get("/facilities/recent")
def get_recent_facilities(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> List[dict]:
    rows = (
        db.query(
            BookingJob.facility_id,
            BookingJob.facility_name,
            func.max(BookingJob.created_at).label("last_used"),
        )
        .filter(BookingJob.user_id == current_user.id)
        .group_by(BookingJob.facility_id, BookingJob.facility_name)
        .order_by(func.max(BookingJob.created_at).desc())
        .limit(5)
        .all()
    )
    return [{"id": row.facility_id, "name": row.facility_name} for row in rows]


@router.get("/courses/recent")
def get_recent_courses(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> List[str]:
    rows = (
        db.query(BookingJob.class_name)
        .filter(BookingJob.user_id == current_user.id)
        .group_by(BookingJob.class_name)
        .order_by(func.max(BookingJob.created_at).desc())
        .limit(10)
        .all()
    )
    return [row.class_name for row in rows]


def _eversports_search(term: str) -> List[dict]:
    """
    Query the Eversports marketplace search GraphQL endpoint.
    Returns a list of venues as {"id": slug, "name": name}.
    Raises RuntimeError on network or API failure.
    """
    payload = {
        "operationName": _EVERSPORTS_OPERATION,
        "query": _EVERSPORTS_QUERY,
        "variables": {
            "coordinate": _DEFAULT_COORDINATE,
            "searchTerm": term,
            "limit": _SEARCH_LIMIT,
        },
    }
    try:
        resp = requests.post(_EVERSPORTS_SEARCH_URL, json=payload, headers=_HEADERS, timeout=8)
        resp.raise_for_status()
    except requests.RequestException as exc:
        raise RuntimeError(str(exc)) from exc

    data = resp.json()
    if "errors" in data:
        raise RuntimeError(f"GraphQL errors: {data['errors']}")

    items = data.get("data", {}).get("inventorySearch", [])
    return [
        {"id": item["slug"], "name": item["name"]}
        for item in items
        if item.get("__typename") == "VenueSearchResult"
    ]


@router.get("/facilities/search")
def search_facilities(
    q: str = Query(..., min_length=5),
    current_user: User = Depends(get_current_active_user),
) -> List[dict]:
    try:
        return _eversports_search(q)
    except RuntimeError:
        raise HTTPException(status_code=502, detail="Eversports search unavailable")


@router.get("/facilities/{facility_id}/courses")
def get_facility_courses(
    facility_id: str,
    weekday: int | None = Query(default=None, ge=0, le=6),
    target_time: str | None = Query(default=None),
    current_user: User = Depends(get_current_active_user),
) -> List[str]:
    try:
        password = decrypt(current_user.encrypted_password)
        login_result = eversports_login(current_user.email, password)
        if login_result is None:
            return []
        session = login_result["session"]
        numeric_id = _booking_resolve_facility_id(facility_id, session)
    except Exception:
        logger.warning("Failed to authenticate or resolve facility %s", facility_id, exc_info=True)
        return []

    today = date.today()
    filter_by_time = weekday is not None and target_time is not None
    if filter_by_time:
        # Find the next occurrence of the target weekday (today or later)
        days_ahead = (weekday - today.weekday()) % 7
        target_date = today + timedelta(days=days_ahead)
        first_week_start = target_date - timedelta(days=target_date.weekday())
        week_starts = [first_week_start, first_week_start + timedelta(days=7)]
    else:
        week_starts = [today - timedelta(days=today.weekday())]

    # Normalize target_time to HH:MM
    time_filter = target_time[:5] if target_time else None

    names: set[str] = set()
    for week_start in week_starts:
        for event_type in ("class", "course", "training"):
            try:
                resp = session.get(
                    _CALENDAR_URL,
                    params={
                        "facilityId": numeric_id,
                        "startDate": week_start.isoformat(),
                        "activeEventType": event_type,
                    },
                    timeout=8,
                )
                resp.raise_for_status()
                html = resp.json()["data"]["html"]
            except Exception:
                logger.warning(
                    "Failed to fetch courses (eventType=%s) for facility %s",
                    event_type, numeric_id, exc_info=True,
                )
                continue

            soup = BeautifulSoup(html, "html.parser")

            if filter_by_time:
                for li in soup.find_all("li"):
                    time_el = li.find(class_="session-time")
                    name_el = li.find(class_="session-name")
                    if not time_el or not name_el:
                        continue
                    session_time = time_el.get_text(strip=True)[:5]
                    if session_time != time_filter:
                        continue
                    if weekday is not None:
                        data_date = li.get("data-date") or li.get("data-start")
                        if data_date:
                            try:
                                session_weekday = date.fromisoformat(data_date[:10]).weekday()
                                if session_weekday != weekday:
                                    continue
                            except ValueError:
                                pass
                    name = name_el.get_text(strip=True)
                    if name:
                        names.add(name)
            else:
                names.update(
                    el.get_text(strip=True)
                    for el in soup.find_all(class_="session-name")
                    if el.get_text(strip=True)
                )

    return sorted(names)
