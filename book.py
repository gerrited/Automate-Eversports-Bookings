#!/usr/bin/env python3
"""Automate weekly CrossFit class booking on Eversports."""

import os
import sys
from datetime import date, datetime, timedelta, timezone

import requests
from bs4 import BeautifulSoup

GRAPHQL_URL = "https://www.eversports.de/api/checkout"
CALENDAR_URL = "https://www.eversports.de/api/eventsession/calendar"
FACILITY_ID = "73041"
TIMEOUT = 30


def get_target_tuesday() -> date:
    override = os.environ.get("TARGET_DATE")
    if override:
        d = date.fromisoformat(override)
        if d.weekday() != 1:
            raise ValueError(f"TARGET_DATE {override} is not a Tuesday")
        if d <= datetime.now(timezone.utc).date():
            raise ValueError(f"TARGET_DATE {override} is not in the future")
        return d
    # Cron fires Friday 16:00 UTC — still Friday in UTC
    return datetime.now(timezone.utc).date() + timedelta(days=4)


def get_week_start(d: date) -> date:
    return d - timedelta(days=d.weekday())  # Monday of that week


def gql(session: requests.Session, operation: str, query: str, variables: dict) -> dict:
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


def login(session: requests.Session, email: str, password: str) -> None:
    query = """
    mutation LoginCredentialLogin($params: AuthParamsInput!, $credentials: CredentialLoginInput!) {
      credentialLogin(params: $params, credentials: $credentials) {
        ... on AuthResult {
          apiToken
          user { id __typename }
          __typename
        }
        ... on ExpectedErrors {
          errors { id message path __typename }
          __typename
        }
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
    data = gql(session, "LoginCredentialLogin", query, variables)
    result = data["credentialLogin"]
    if result["__typename"] == "ExpectedErrors":
        msgs = "; ".join(e["message"] for e in result["errors"])
        raise RuntimeError(f"Login failed: {msgs}")
    if result["__typename"] != "AuthResult":
        raise RuntimeError(f"Unexpected login result: {result['__typename']}")
    print(f"Logged in as user {result['user']['id']}")


def find_session_uuid(session: requests.Session, target_tuesday: date) -> str:
    start_date = get_week_start(target_tuesday).isoformat()
    resp = session.get(
        CALENDAR_URL,
        params={"facilityId": FACILITY_ID, "startDate": start_date, "activeEventType": "class"},
        timeout=TIMEOUT,
    )
    resp.raise_for_status()

    soup = BeautifulSoup(resp.text, "html.parser")
    target_iso = target_tuesday.isoformat()

    matches = []
    for ul in soup.find_all("ul"):
        header = ul.find("h3", attrs={"data-day": target_iso})
        if not header:
            continue
        for li in ul.find_all("li", attrs={"data-uuid": True}):
            time_div = li.find(class_="session-time")
            name_div = li.find(class_="session-name")
            if time_div and name_div:
                if time_div.get_text(strip=True).startswith("18:00") and name_div.get_text(strip=True) == "CrossFit":
                    matches.append(li["data-uuid"])

    if not matches:
        raise RuntimeError(f"CrossFit 18:00 not found for {target_tuesday}")
    if len(matches) > 1:
        print(f"Warning: {len(matches)} matching slots found, using the first")
    print(f"Found session UUID: {matches[0]}")
    return matches[0]


def create_cart(session: requests.Session, bookable_item_id: str) -> str:
    query = """
    mutation UseCartCreationHandlerCreateCartFromEventBookableItem(
      $bookableItemId: ID!,
      $origin: Origin!,
      $clientMetadata: ClientMetadataInput
    ) {
      createCartFromEventBookableItem(
        bookableItemId: $bookableItemId
        origin: $origin
        clientMetadata: $clientMetadata
      ) {
        ... on Cart { id __typename }
        ... on ExpectedErrors { errors { id message __typename } __typename }
        __typename
      }
    }
    """
    variables = {
        "bookableItemId": bookable_item_id,
        "origin": "ORIGIN_MARKETPLACE",
        "clientMetadata": None,
    }
    data = gql(session, "UseCartCreationHandlerCreateCartFromEventBookableItem", query, variables)
    result = data["createCartFromEventBookableItem"]

    if result["__typename"] == "ExpectedErrors":
        for error in result["errors"]:
            msg = error["message"].lower()
            if "already" in msg or "bereits" in msg:
                print("Already booked — nothing to do")
                sys.exit(0)
            if "sold out" in msg or "ausgebucht" in msg or "no spots" in msg:
                raise RuntimeError(f"Class is full: {error['message']}")
        msgs = "; ".join(e["message"] for e in result["errors"])
        raise RuntimeError(f"Cart creation failed: {msgs}")

    if result["__typename"] != "Cart":
        raise RuntimeError(f"Unexpected cart result: {result['__typename']}")

    cart_id = result["id"]
    print(f"Cart created: {cart_id}")
    return cart_id


def confirm_booking(session: requests.Session, cart_id: str) -> str:
    query = """
    mutation SummaryButtonCreateOrderFromCart($cartId: ID!) {
      createOrderFromCart(cartId: $cartId, skipSetupFutureUsage: true) {
        ... on Order {
          id
          priceTable { total { value __typename } __typename }
          __typename
        }
        ... on ExpectedErrors {
          errors { id message __typename }
          __typename
        }
        __typename
      }
    }
    """
    data = gql(session, "SummaryButtonCreateOrderFromCart", query, {"cartId": cart_id})
    result = data["createOrderFromCart"]

    if result["__typename"] == "ExpectedErrors":
        msgs = "; ".join(e["message"] for e in result["errors"])
        raise RuntimeError(f"Order creation failed: {msgs}")

    if result["__typename"] != "Order":
        raise RuntimeError(f"Unexpected order result: {result['__typename']}")

    order_id = result["id"]
    print(f"Booking confirmed! Order ID: {order_id}")
    return order_id


def main() -> None:
    email = os.environ.get("EVERSPORTS_EMAIL")
    password = os.environ.get("EVERSPORTS_PASSWORD")
    if not email or not password:
        raise RuntimeError("EVERSPORTS_EMAIL and EVERSPORTS_PASSWORD must be set")

    target_tuesday = get_target_tuesday()
    print(f"Target Tuesday: {target_tuesday}")

    session = requests.Session()

    login(session, email, password)
    bookable_item_id = find_session_uuid(session, target_tuesday)
    cart_id = create_cart(session, bookable_item_id)
    confirm_booking(session, cart_id)


if __name__ == "__main__":
    main()
