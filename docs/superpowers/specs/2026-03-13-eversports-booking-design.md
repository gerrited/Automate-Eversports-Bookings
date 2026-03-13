# Eversports Booking Automation — Design Spec

**Date:** 2026-03-13
**Status:** Approved

---

## Overview

Automate the weekly booking of the 18:00 CrossFit class at CrossFit Rabbit Hole on Eversports. A GitHub Action runs every Friday at 18:00 CET and books the CrossFit class for the following Tuesday (4 days later) using the Eversports internal GraphQL API — no browser required.

---

## Discovered API

All Eversports API calls use a single GraphQL endpoint:

```
POST https://www.eversports.de/api/checkout
```

Authentication is session-cookie based (set by the login mutation).

### Constants

| Key | Value |
|-----|-------|
| Facility ID | `73041` |
| Venue ID | `b69ec34c-923d-4e56-94ac-4eb0380687ce` |
| Target class | CrossFit at 18:00 |
| Calendar API | `GET /api/eventsession/calendar?facilityId=73041&startDate=YYYY-MM-DD&activeEventType=class` |

---

## Booking Flow (4 steps)

### Step 1 — Login

**Mutation:** `LoginCredentialLogin`

```graphql
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
```

**Variables:**
```json
{
  "credentials": { "email": "<EMAIL>", "password": "<PASSWORD>" },
  "params": {
    "origin": "ORIGIN_MARKETPLACE",
    "corporatePartner": null,
    "corporateInvitationToken": null,
    "queryString": "",
    "region": "DE"
  }
}
```

→ Response sets a session cookie used for all subsequent requests.

---

### Step 2 — Find Tuesday 18:00 CrossFit session UUID

```
GET /api/eventsession/calendar?facilityId=73041&startDate=YYYY-MM-DD&activeEventType=class
```

Where `startDate` is the Monday of the week containing the target Tuesday (run date + 4 days, rounded to Monday).

Response is HTML. Parse with BeautifulSoup: find `<li data-uuid="...">` where:
- The parent `<ul>` has `[data-day="YYYY-MM-DD"]` matching Tuesday
- `.session-time` contains `18:00`
- `.session-name` contains `CrossFit`

→ Extract `data-uuid` attribute as the `bookableItemId`.

---

### Step 3 — Create cart

**Mutation:** `UseCartCreationHandlerCreateCartFromEventBookableItem`

```graphql
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
    ... on ExpectedErrors { errors { message __typename } __typename }
    __typename
  }
}
```

**Variables:**
```json
{
  "bookableItemId": "<UUID from step 2>",
  "origin": "ORIGIN_MARKETPLACE",
  "clientMetadata": null
}
```

→ Returns `cartId`. The existing FÜR BEGEISTERTE membership is auto-selected.

---

### Step 4 — Confirm booking

**Mutation:** `SummaryButtonCreateOrderFromCart`

```graphql
mutation SummaryButtonCreateOrderFromCart($cartId: ID!) {
  createOrderFromCart(cartId: $cartId, skipSetupFutureUsage: true) {
    ... on Order {
      id
      priceTable { total { value __typename } __typename }
      __typename
    }
    ... on ExpectedErrors {
      errors { message __typename }
      __typename
    }
    __typename
  }
}
```

**Variables:** `{ "cartId": "<cartId from step 3>" }`

→ Booking confirmed. Script exits 0 on success, non-zero on any error.

---

## Error Handling

- Any step failure raises an exception → GitHub Action fails → GitHub sends failure email.
- No retry logic. No custom notifications.
- If the class is already booked or sold out, the cart creation returns an `ExpectedErrors` response — the script raises and the Action fails visibly.

---

## File Structure

```
book.py                          # Main booking script
.github/
  workflows/
    book.yml                     # GitHub Action: cron Friday 17:00 UTC
```

---

## GitHub Action

```yaml
name: Book CrossFit Tuesday 18:00
on:
  schedule:
    - cron: '0 17 * * 5'   # Friday 17:00 UTC = 18:00 CET (19:00 CEST in summer)
  workflow_dispatch:          # Allow manual trigger

jobs:
  book:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      - run: pip install requests beautifulsoup4
      - run: python book.py
        env:
          EVERSPORTS_EMAIL: ${{ secrets.EVERSPORTS_EMAIL }}
          EVERSPORTS_PASSWORD: ${{ secrets.EVERSPORTS_PASSWORD }}
```

**Cron note:** `0 17 * * 5` = 17:00 UTC = 18:00 CET (winter). In summer (CEST, UTC+2) this runs at 19:00 local time. Since the script only needs to run on the correct day (Friday), a 1-hour drift is acceptable.

---

## Date Logic

```python
from datetime import date, timedelta

def get_target_tuesday() -> date:
    today = date.today()  # Friday when run by cron
    return today + timedelta(days=4)

def get_week_start(d: date) -> date:
    return d - timedelta(days=d.weekday())  # Monday of that week
```

---

## Secrets Required

| Secret | Description |
|--------|-------------|
| `EVERSPORTS_EMAIL` | Eversports account email |
| `EVERSPORTS_PASSWORD` | Eversports account password |

---

## Dependencies

- `requests` — HTTP client with automatic cookie handling
- `beautifulsoup4` — HTML parsing for calendar response
