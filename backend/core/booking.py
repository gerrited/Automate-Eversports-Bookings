"""
Eversports booking logic — adapted from book.py for multi-user use.
Functions accept explicit parameters instead of reading from os.environ.

facility_id kann sein:
  - numerische ID (z.B. "73041") — direkt verwendbar
  - Venue-Slug (z.B. "crossfit-rabbit-hole") — wird beim Buchen mit der
    eingeloggten Session aufgelöst (Cloudflare lässt auth. Sessions durch)
"""
from __future__ import annotations

import logging
import re
from datetime import date, datetime, timedelta
from typing import Optional

import requests

log = logging.getLogger(__name__)
from bs4 import BeautifulSoup

GRAPHQL_URL = "https://www.eversports.de/api/checkout"
CALENDAR_URL = "https://www.eversports.de/api/eventsession/calendar"
BASE_URL = "https://www.eversports.de"
_DATA_ID_RE = re.compile(r"data-id=[\"'](\d+)[\"']")
TIMEOUT = 30
_SESSION_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/145.0.0.0 Safari/537.36"
    ),
    "Accept": "*/*",
    "Accept-Language": "en-GB,en;q=0.9",
    "Origin": BASE_URL,
    "Referer": BASE_URL + "/",
    "sec-ch-ua": '"Not:A-Brand";v="99", "Google Chrome";v="145", "Chromium";v="145"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"macOS"',
}


def _http_error(resp: requests.Response) -> RuntimeError:
    snippet = resp.text[:300].strip() if resp.text else ""
    return RuntimeError(f"HTTP {resp.status_code} from Eversports: {snippet}")


def _gql(session: requests.Session, operation: str, query: str, variables: dict) -> dict:
    resp = session.post(
        GRAPHQL_URL,
        json={"operationName": operation, "query": query, "variables": variables},
        headers={"Content-Type": "application/json"},
        timeout=TIMEOUT,
    )
    if not resp.ok:
        raise _http_error(resp)
    body = resp.json()
    if "errors" in body:
        raise RuntimeError(f"GraphQL error: {body['errors']}")
    return body["data"]


def _resolve_facility_id(facility_id: str, session: requests.Session) -> str:
    """Numerische facilityId für die Calendar-API ermitteln.
    Ist facility_id bereits numerisch, wird sie direkt zurückgegeben.
    Sonst wird /scl/<slug> mit der eingeloggten Session abgerufen
    (Cloudflare lässt auth. Sessions durch).
    """
    if facility_id.isdigit():
        return facility_id
    resp = session.get(BASE_URL + "/scl/" + facility_id, timeout=TIMEOUT)
    if not resp.ok:
        raise _http_error(resp)
    match = _DATA_ID_RE.search(resp.text)
    if not match:
        raise RuntimeError(f"Numeric facility ID not found for slug '{facility_id}'")
    return match.group(1)


_WAITLIST_MUTATION = """
mutation AddToWaitingList($eventBookableItemId: ID!) {
  addToWaitingList(eventBookableItemId: $eventBookableItemId) {
    ... on WaitingList { id __typename }
    ... on ExpectedErrors { errors { message __typename } __typename }
    __typename
  }
}
"""


def join_waitlist(session: requests.Session, event_bookable_item_id: str) -> str:
    """Trägt den eingeloggten Nutzer auf die Warteliste ein.
    Gibt die WaitingList-ID (= event_bookable_item_id) zurück.
    Wirft RuntimeError bei ExpectedErrors.
    """
    data = _gql(session, "AddToWaitingList", _WAITLIST_MUTATION, {"eventBookableItemId": event_bookable_item_id})
    result = data["addToWaitingList"]
    if result["__typename"] == "ExpectedErrors":
        msgs = "; ".join(e["message"] for e in result["errors"])
        raise RuntimeError(f"Waitlist join failed: {msgs}")
    return result["id"]


def eversports_login(email: str, password: str) -> Optional[dict]:
    """
    Authenticate against Eversports.
    Returns {"user_id": str, "session": requests.Session, "avatar_url": str | None} on success, None on failure.
    """
    query = """
    mutation LoginCredentialLogin($params: AuthParamsInput!, $credentials: CredentialLoginInput!) {
      credentialLogin(params: $params, credentials: $credentials) {
        ... on AuthResult {
          apiToken
          user {
            id
            profilePicture { xSmall __typename }
            __typename
          }
          __typename
        }
        ... on ExpectedErrors { errors { id message path __typename } __typename }
        __typename
      }
    }
    """
    variables = {
        "credentials": {"email": email, "password": password},
        "params": {
            "origin": "ORIGIN_MARKETPLACE",
            "corporatePartner": None,
            "corporateInvitationToken": None,
            "queryString": "",
            "region": "DE",
        },
    }
    session = requests.Session()
    session.headers.update(_SESSION_HEADERS)
    session.get(BASE_URL + "/", timeout=TIMEOUT)

    data = _gql(session, "LoginCredentialLogin", query, variables)
    result = data["credentialLogin"]
    if result["__typename"] != "AuthResult":
        return None
    log.info("eversports_login user fields: %s", result["user"])
    profile_picture = result["user"].get("profilePicture") or {}
    return {
        "user_id": result["user"]["id"],
        "session": session,
        "avatar_url": profile_picture.get("xSmall"),
    }


def book_session(
    email: str,
    password: str,
    target_date: date,
    target_time: str,
    facility_id: str,
    class_name: str,
    event_type: Optional[str] = None,
) -> dict:
    """
    Full booking flow.
    Returns {"status": "success", "order_id": str, "event_type": str}
          | {"status": "already_booked", "order_id": None, "event_type": str}
          | {"status": "waitlist", "order_id": None, "event_type": str}
    Raises RuntimeError on login failure, class not found, or booking error.

    If event_type is given, only that type is queried (faster).
    Otherwise all types (class, training, course) are tried in order.
    """
    login_result = eversports_login(email, password)
    if login_result is None:
        raise RuntimeError("Eversports login failed")
    session: requests.Session = login_result["session"]

    # Slug → numerische ID (mit auth. Session, Cloudflare-kompatibel)
    numeric_facility_id = _resolve_facility_id(facility_id, session)

    # Fetch calendar for the week containing target_date.
    # If a known event_type is given, try it first — but fall back to other types
    # in case the session type changed (e.g. training → course).
    week_start = target_date - timedelta(days=target_date.weekday())
    all_types = ("class", "training", "course")
    if event_type:
        event_types_to_try = (event_type, *[t for t in all_types if t != event_type])
    else:
        event_types_to_try = all_types
    matches: list[str] = []
    matched_event_type: str = event_type or "class"
    for et in event_types_to_try:
        resp = session.get(
            CALENDAR_URL,
            params={
                "facilityId": numeric_facility_id,
                "startDate": week_start.isoformat(),
                "activeEventType": et,
            },
            timeout=TIMEOUT,
        )
        if not resp.ok:
            raise _http_error(resp)
        try:
            calendar_html = resp.json()["data"]["html"]
        except (KeyError, TypeError):
            continue  # facility doesn't offer this event type

        soup = BeautifulSoup(calendar_html, "html.parser")
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

        if matches:
            matched_event_type = et
            break

    if not matches:
        raise RuntimeError(f"{class_name} {target_time} not found for {target_date}")

    bookable_item_id = matches[0]

    # Create cart
    cart_query = """
    mutation UseCartCreationHandlerCreateCartFromEventBookableItem(
      $bookableItemId: ID!, $origin: Origin!, $clientMetadata: ClientMetadataInput
    ) {
      createCartFromEventBookableItem(
        bookableItemId: $bookableItemId origin: $origin clientMetadata: $clientMetadata
      ) {
        ... on Cart { id __typename }
        ... on ExpectedErrors { errors { id message __typename } __typename }
        __typename
      }
    }
    """
    data = _gql(
        session,
        "UseCartCreationHandlerCreateCartFromEventBookableItem",
        cart_query,
        {"bookableItemId": bookable_item_id, "origin": "ORIGIN_MARKETPLACE", "clientMetadata": None},
    )
    cart_result = data["createCartFromEventBookableItem"]

    if cart_result["__typename"] == "ExpectedErrors":
        for error in cart_result["errors"]:
            msg = error["message"].lower()
            if "already" in msg or "bereits" in msg:
                return {"status": "already_booked", "order_id": None, "event_type": matched_event_type, "_session": session}
        full_keywords = ("fully booked", "fully_booked", "ausgebucht", "sold out", "no spots")
        for error in cart_result["errors"]:
            msg = error["message"].lower()
            if any(kw in msg for kw in full_keywords):
                join_waitlist(session, bookable_item_id)
                return {"status": "waitlist", "order_id": None, "event_type": matched_event_type, "_session": session}
        msgs = "; ".join(e["message"] for e in cart_result["errors"])
        raise RuntimeError(f"Cart creation failed: {msgs}")

    cart_id = cart_result["id"]

    # Confirm order
    order_query = """
    mutation SummaryButtonCreateOrderFromCart($cartId: ID!) {
      createOrderFromCart(cartId: $cartId, skipSetupFutureUsage: true) {
        ... on Order { id __typename }
        ... on ExpectedErrors { errors { id message __typename } __typename }
        __typename
      }
    }
    """
    data = _gql(session, "SummaryButtonCreateOrderFromCart", order_query, {"cartId": cart_id})
    order_result = data["createOrderFromCart"]

    if order_result["__typename"] == "ExpectedErrors":
        msgs = "; ".join(e["message"] for e in order_result["errors"])
        # Free sessions have no product assigned — booking is completed at cart level
        if any("product" in e["message"].lower() for e in order_result["errors"]):
            return {"status": "success", "order_id": cart_id, "event_type": matched_event_type, "_session": session}
        raise RuntimeError(f"Order creation failed: {msgs}")

    return {"status": "success", "order_id": order_result["id"], "event_type": matched_event_type, "_session": session}


def cancel_booking(
    email: str,
    password: str,
    class_name: str,
    facility_id: str,
) -> None:
    """
    Cancel the most recent upcoming booking matching class_name + facility_id.
    Fetches /u to find the cancel link data attributes, then calls /api/event/cancel.
    """
    login_result = eversports_login(email, password)
    if login_result is None:
        raise RuntimeError("Eversports login failed")
    _cancel_with_session(
        session=login_result["session"],
        class_name=class_name,
        facility_id=facility_id,
    )


def _cancel_with_session(
    session: requests.Session,
    class_name: str,
    facility_id: str,
) -> None:
    resp = session.get(BASE_URL + "/u", timeout=TIMEOUT)
    if not resp.ok:
        raise _http_error(resp)
    soup = BeautifulSoup(resp.text, "html.parser")

    numeric_facility_id = _resolve_facility_id(facility_id, session)
    all_links = soup.find_all("a", class_="cancel-link-event")
    log.info(
        "_cancel_with_session: looking for facility=%s (numeric=%s) class=%s — found %d cancel link(s)",
        facility_id, numeric_facility_id, class_name, len(all_links),
    )
    for i, link in enumerate(all_links):
        parent_li = link.find_parent("li")
        log.info(
            "  link[%d]: data-facilityid=%s text=%s",
            i, link.get("data-facilityid", ""),
            (parent_li.get_text(strip=True)[:80] if parent_li else ""),
        )

    cancel_link = None
    for link in all_links:
        if str(link.get("data-facilityid", "")) != numeric_facility_id:
            continue
        h4 = link.find_parent("li")
        if h4 and class_name and class_name not in h4.get_text():
            continue
        cancel_link = link
        break

    if cancel_link is None:
        raise RuntimeError(
            f"No upcoming booking found to cancel for {class_name} at facility {facility_id}"
        )

    resp = session.post(
        BASE_URL + "/api/event/cancel",
        data={
            "eventId": cancel_link["data-event"],
            "eventParticipantId": cancel_link["data-eventparticipant"],
            "facilityId": cancel_link["data-facilityid"],
            "sessionId": cancel_link["data-session"],
            "isLateCancellation": "false",
        },
        timeout=TIMEOUT,
    )
    if not resp.ok:
        raise _http_error(resp)


def fetch_upcoming_bookings(email: str, password: str) -> list[dict]:
    """
    Ruft bevorstehende Buchungen von /u ab und gibt strukturierte Daten zurück.
    Gibt [] zurück wenn Login fehlschlägt.
    """
    login_result = eversports_login(email, password)
    if login_result is None:
        return []
    session: requests.Session = login_result["session"]

    resp = session.get(BASE_URL + "/u", timeout=TIMEOUT)
    if not resp.ok:
        return []

    def _get_input(block, id_: str) -> str:
        el = block.find("input", id=id_)
        return el["value"] if el else ""

    soup = BeautifulSoup(resp.text, "html.parser")
    bookings = []

    def _parse_dt(raw: str) -> str:
        try:
            return datetime.strptime(raw, "%Y%m%dT%H%M%S").isoformat()
        except ValueError:
            return raw

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


def cancel_booking_by_ids(
    email: str,
    password: str,
    event_id: str,
    event_participant_id: str,
    facility_id: str,
    session_id: str,
) -> None:
    """
    Storniert eine Buchung direkt über die bekannten IDs.
    Wirft RuntimeError bei Login-Fehler oder HTTP-Fehler.
    """
    login_result = eversports_login(email, password)
    if login_result is None:
        raise RuntimeError("Eversports login failed")
    session: requests.Session = login_result["session"]

    resp = session.post(
        BASE_URL + "/api/event/cancel",
        data={
            "eventId": event_id,
            "eventParticipantId": event_participant_id,
            "facilityId": facility_id,
            "sessionId": session_id,
            "isLateCancellation": "false",
        },
        timeout=TIMEOUT,
    )
    if not resp.ok:
        raise _http_error(resp)
