"""Einziger HTTP-Berührungspunkt zur Eversports-Plattform.

Alle Netzwerk-Calls (Login, Kalender, GraphQL-Mutationen, Stornierung) sind
hier zentralisiert. Parsing und Fehlerklassifikation delegieren an die
Schwester-Module parsing.py und classify.py.
"""
from __future__ import annotations

import logging
from datetime import date, datetime, timedelta
from typing import Optional

import requests

from backend.core.status import BookingStatus
from backend.eversports.classify import CartOutcome, classify_cart_errors
from backend.eversports.errors import AuthFailed, EversportsError, PlatformError, SlotNotFound
from backend.eversports.parsing import extract_facility_id, parse_calendar_slots, parse_upcoming_bookings

log = logging.getLogger(__name__)

GRAPHQL_URL = "https://www.eversports.de/api/checkout"
CALENDAR_URL = "https://www.eversports.de/api/eventsession/calendar"
BASE_URL = "https://www.eversports.de"
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


def _http_error(resp: requests.Response) -> PlatformError:
    snippet = resp.text[:300].strip() if resp.text else ""
    return PlatformError(f"HTTP {resp.status_code} from Eversports: {snippet}")


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
        raise PlatformError(f"GraphQL error: {body['errors']}")
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
    return extract_facility_id(resp.text, page="/scl/" + facility_id)


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
    Wirft PlatformError bei ExpectedErrors.
    """
    data = _gql(session, "AddToWaitingList", _WAITLIST_MUTATION, {"eventBookableItemId": event_bookable_item_id})
    result = data["addToWaitingList"]
    if result["__typename"] == "ExpectedErrors":
        msgs = "; ".join(e["message"] for e in result["errors"])
        raise PlatformError(f"Waitlist join failed: {msgs}")
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
    Returns {"status": BookingStatus.SUCCESS, "order_id": str, "event_type": str}
          | {"status": BookingStatus.ALREADY_BOOKED, "order_id": None, "event_type": str}
          | {"status": BookingStatus.WAITLIST, "order_id": None, "event_type": str}
    Raises AuthFailed on login failure, SlotNotFound when class not found, PlatformError on booking error.

    If event_type is given, only that type is queried (faster).
    Otherwise all types (class, training, course) are tried in order.
    """
    login_result = eversports_login(email, password)
    if login_result is None:
        raise AuthFailed("Eversports login failed")
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

        matches = parse_calendar_slots(calendar_html, target_date, target_time, class_name)
        if matches:
            matched_event_type = et
            break

    if not matches:
        raise SlotNotFound(f"{class_name} {target_time} not found for {target_date}")

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
        messages = [e["message"] for e in cart_result["errors"]]
        outcome = classify_cart_errors(messages)
        if outcome is CartOutcome.ALREADY_BOOKED:
            return {"status": BookingStatus.ALREADY_BOOKED, "order_id": None, "event_type": matched_event_type, "_session": session}
        if outcome is CartOutcome.SLOT_FULL:
            join_waitlist(session, bookable_item_id)
            return {"status": BookingStatus.WAITLIST, "order_id": None, "event_type": matched_event_type, "_session": session}
        raise PlatformError(f"Cart creation failed: {'; '.join(messages)}")

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
            return {"status": BookingStatus.SUCCESS, "order_id": cart_id, "event_type": matched_event_type, "_session": session}
        raise PlatformError(f"Order creation failed: {msgs}")

    return {"status": BookingStatus.SUCCESS, "order_id": order_result["id"], "event_type": matched_event_type, "_session": session}


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
        raise AuthFailed("Eversports login failed")
    _cancel_with_session(
        session=login_result["session"],
        class_name=class_name,
        facility_id=facility_id,
    )


def _cancel_with_session(
    session: requests.Session,
    class_name: str,
    facility_id: str,
    target_date: Optional[date] = None,
    target_time: Optional[str] = None,
) -> None:
    resp = session.get(BASE_URL + "/u", timeout=TIMEOUT)
    if not resp.ok:
        raise _http_error(resp)

    numeric_facility_id = _resolve_facility_id(facility_id, session)

    bookings = parse_upcoming_bookings(resp.text)

    cancel_booking_dict = None
    for b in bookings:
        if b["facility_id"] != numeric_facility_id:
            continue
        activity_name = b["activity_name"]
        if class_name and class_name not in activity_name:
            continue
        if target_date is not None or target_time is not None:
            try:
                booking_dt = datetime.fromisoformat(b["start_datetime"])
            except ValueError:
                booking_dt = None
            if booking_dt is not None:
                if target_date is not None and booking_dt.date() != target_date:
                    continue
                if target_time is not None and booking_dt.strftime("%H:%M") != target_time:
                    continue
        cancel_booking_dict = b
        break

    if cancel_booking_dict is None:
        raise SlotNotFound(
            f"No upcoming booking found to cancel for {class_name} at facility {facility_id}"
        )

    resp = session.post(
        BASE_URL + "/api/event/cancel",
        data={
            "eventId": cancel_booking_dict["event_id"],
            "eventParticipantId": cancel_booking_dict["event_participant_id"],
            "facilityId": cancel_booking_dict["facility_id"],
            "sessionId": cancel_booking_dict["session_id"],
            "isLateCancellation": "false",
        },
        timeout=TIMEOUT,
    )
    if not resp.ok:
        raise _http_error(resp)


def _with_login_retry(email: str, password: str, operation):
    """Führt operation(login_result) aus; bei EversportsError einmal mit frischem Login wiederholen.

    AuthFailed und SlotNotFound lösen keinen Retry aus — falsche Credentials bzw.
    nicht gefundene Kurse sind keine Session-Probleme.
    """
    from backend.eversports import session_cache  # lazy: vermeidet Import-Zyklus

    login = session_cache.get_or_login(email, password)
    if login is None:
        raise AuthFailed("Eversports login failed")
    try:
        return operation(login)
    except (AuthFailed, SlotNotFound):
        raise
    except EversportsError:
        session_cache.invalidate(email, password)
        login = session_cache.get_or_login(email, password)
        if login is None:
            raise AuthFailed("Eversports login failed")
        return operation(login)


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

    bookings = parse_upcoming_bookings(resp.text)
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
    Wirft AuthFailed bei Login-Fehler oder PlatformError bei HTTP-Fehler.
    """
    login_result = eversports_login(email, password)
    if login_result is None:
        raise AuthFailed("Eversports login failed")
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
