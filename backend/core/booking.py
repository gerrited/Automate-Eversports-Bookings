"""
Eversports booking logic — adapted from book.py for multi-user use.
Functions accept explicit parameters instead of reading from os.environ.

facility_id kann sein:
  - numerische ID (z.B. "73041") — direkt verwendbar
  - Venue-Slug (z.B. "crossfit-rabbit-hole") — wird beim Buchen mit der
    eingeloggten Session aufgelöst (Cloudflare lässt auth. Sessions durch)
"""
from __future__ import annotations

import re
from datetime import date, timedelta
from typing import Optional

import requests
from bs4 import BeautifulSoup

GRAPHQL_URL = "https://www.eversports.de/api/checkout"
CALENDAR_URL = "https://www.eversports.de/api/eventsession/calendar"
BASE_URL = "https://www.eversports.de"
_DATA_ID_RE = re.compile(r"data-id='(\d+)'")
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


def _gql(session: requests.Session, operation: str, query: str, variables: dict) -> dict:
    resp = session.post(
        GRAPHQL_URL,
        json={"operationName": operation, "query": query, "variables": variables},
        headers={"Content-Type": "application/json"},
        timeout=TIMEOUT,
    )
    resp.raise_for_status()
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
    resp.raise_for_status()
    match = _DATA_ID_RE.search(resp.text)
    if not match:
        raise RuntimeError(f"Numeric facility ID not found for slug '{facility_id}'")
    return match.group(1)


def eversports_login(email: str, password: str) -> Optional[dict]:
    """
    Authenticate against Eversports.
    Returns {"user_id": str, "session": requests.Session} on success, None on failure.
    """
    query = """
    mutation LoginCredentialLogin($params: AuthParamsInput!, $credentials: CredentialLoginInput!) {
      credentialLogin(params: $params, credentials: $credentials) {
        ... on AuthResult { apiToken user { id __typename } __typename }
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
    return {"user_id": result["user"]["id"], "session": session}


def book_session(
    email: str,
    password: str,
    target_date: date,
    target_time: str,
    facility_id: str,
    class_name: str,
) -> dict:
    """
    Full booking flow.
    Returns {"status": "success", "order_id": str}
          | {"status": "already_booked", "order_id": None}
    Raises RuntimeError on login failure, class not found, or booking error.
    """
    login_result = eversports_login(email, password)
    if login_result is None:
        raise RuntimeError("Eversports login failed")
    session: requests.Session = login_result["session"]

    # Slug → numerische ID (mit auth. Session, Cloudflare-kompatibel)
    numeric_facility_id = _resolve_facility_id(facility_id, session)

    # Fetch calendar for the week containing target_date
    week_start = target_date - timedelta(days=target_date.weekday())
    resp = session.get(
        CALENDAR_URL,
        params={
            "facilityId": numeric_facility_id,
            "startDate": week_start.isoformat(),
            "activeEventType": "class",
        },
        timeout=TIMEOUT,
    )
    resp.raise_for_status()
    calendar_html = resp.json()["data"]["html"]

    soup = BeautifulSoup(calendar_html, "html.parser")
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
                return {"status": "already_booked", "order_id": None}
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
        raise RuntimeError(f"Order creation failed: {msgs}")

    return {"status": "success", "order_id": order_result["id"]}
