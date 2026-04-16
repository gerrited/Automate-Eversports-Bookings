# Eversports facility search
# Endpoint: to be filled in from Task 1 research
# Operation: to be filled in from Task 1 research
# Variable for search term: to be filled in from Task 1 research
# Result path: to be filled in from Task 1 research
# Result item shape: { id: str, name: str }

from typing import List

import requests
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.api.deps import get_current_active_user
from backend.db import get_db
from backend.models.booking_job import BookingJob
from backend.models.user import User

router = APIRouter()

# ── Filled in from Task 1 research ──────────────────────────────────────────
_EVERSPORTS_SEARCH_URL = ""           # e.g. "https://www.eversports.de/api/graphql"
_EVERSPORTS_OPERATION  = ""           # e.g. "SearchFacilities"
_EVERSPORTS_QUERY      = ""           # full GraphQL query string
_EVERSPORTS_TERM_VAR   = ""           # e.g. "term" or "query"
_EVERSPORTS_RESULT_PATH: list[str] = []  # e.g. ["data", "searchVendors", "vendors"]
# ────────────────────────────────────────────────────────────────────────────


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


def _eversports_search(term: str) -> List[dict]:
    """Call Eversports marketplace search. Raises RuntimeError on failure."""
    payload = {
        "operationName": _EVERSPORTS_OPERATION,
        "query": _EVERSPORTS_QUERY,
        "variables": {_EVERSPORTS_TERM_VAR: term},
    }
    headers = {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Origin": "https://www.eversports.de",
        "Referer": "https://www.eversports.de/",
    }
    try:
        resp = requests.post(_EVERSPORTS_SEARCH_URL, json=payload, headers=headers, timeout=8)
        resp.raise_for_status()
    except requests.RequestException as exc:
        raise RuntimeError(str(exc)) from exc

    data = resp.json()
    node = data
    for key in _EVERSPORTS_RESULT_PATH:
        node = node[key]
    return [{"id": str(item["id"]), "name": item["name"]} for item in node]


@router.get("/facilities/search")
def search_facilities(
    q: str = Query(..., min_length=5),
    current_user: User = Depends(get_current_active_user),
) -> List[dict]:
    try:
        return _eversports_search(q)
    except RuntimeError:
        raise HTTPException(status_code=502, detail="Eversports search unavailable")
