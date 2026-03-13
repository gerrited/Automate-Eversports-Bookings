# Eversports Booking Automation — Design Spec

**Date:** 2026-03-13
**Status:** Approved

---

## Overview

Automate the weekly booking of the 18:00 CrossFit class at CrossFit Rabbit Hole on Eversports. A GitHub Action runs every Friday at 17:00 UTC (18:00 CET in winter, 19:00 CEST in summer) and books the CrossFit class for the following Tuesday (4 days later) using the Eversports internal GraphQL API — no browser required.

---

## Discovered API

All Eversports API calls use a single GraphQL endpoint:

```
POST https://www.eversports.de/api/checkout
Content-Type: application/json
```

Authentication is **session-cookie based**: the login mutation sets an HttpOnly session cookie which `requests.Session()` forwards automatically on all subsequent requests. The `apiToken` field returned in the login response body is for the mobile app and is not used by this script.

### Constants

| Key | Value |
|-----|-------|
| Base URL | `https://www.eversports.de` |
| GraphQL endpoint | `https://www.eversports.de/api/checkout` |
| Calendar endpoint | `https://www.eversports.de/api/eventsession/calendar` |
| Facility ID | `73041` |
| Target class | CrossFit at 18:00 |

---

## Booking Flow (4 steps)

All HTTP requests use a `timeout=30` (seconds) and `Content-Type: application/json`.

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

**Success check:** HTTP 200 + no top-level `errors` key + `data.credentialLogin.__typename == "AuthResult"`. If `ExpectedErrors`, raise with the error message.

→ Session cookie is set automatically by the response.

---

### Step 2 — Find Tuesday 18:00 CrossFit session UUID

```
GET https://www.eversports.de/api/eventsession/calendar?facilityId=73041&startDate=YYYY-MM-DD&activeEventType=class
```

`startDate` = Monday of the week containing the target Tuesday (`target_tuesday - timedelta(days=1)`).

The response body is **HTML** (confirmed from live API inspection — the endpoint returns a rendered HTML fragment, not JSON). Parse with `BeautifulSoup(html, "html.parser")` (stdlib parser).

**HTML structure** (from live inspection):
```html
<!-- One <ul> per day. All sessions for a day are <li> items in the same <ul>. -->
<ul class="calendar__slot-list">
  <li><h3 data-day="2026-03-17" class="calendar__day-header">Tu., 17/03</h3></li>
  <li class="sr-only"><h3>Tuesday, 17/03/2026</h3></li>
  <li data-uuid="33f6254a-..." class="calendar__slot">
    <div class="session-time">18:00 ● 60 Min</div>
    <div class="session-name">CrossFit</div>
  </li>
  <!-- more session <li> items for the same day -->
</ul>
```

**Parsing logic:**
1. Find all `<ul>` elements that contain an `<h3 data-day="YYYY-MM-DD">` where the date equals `target_tuesday.isoformat()`. These `<ul>` elements group all sessions for that day.
2. Within those `<ul>` elements, find all `<li data-uuid>` items.
3. Filter to those where `.session-time` text starts with `18:00` and `.session-name` text == `CrossFit`.
4. If zero matches → `raise RuntimeError(f"CrossFit 18:00 not found for {target_tuesday}")`.
5. If multiple matches → take the first (multiple identical slots are unexpected).

**`startDate` parameter:** The API requires the Monday of the target week as the anchor. Confirmed from live inspection — passing Monday returns the full week including Tuesday. Other week-anchor dates were not tested.

→ Returns the `data-uuid` value as `bookableItemId`.

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
    ... on ExpectedErrors { errors { id message __typename } __typename }
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

**Success check:** HTTP 200 + no top-level `errors` + `__typename == "Cart"` → extract `id` as `cartId`.

**"Already booked" / sold out handling:**
- If `__typename == "ExpectedErrors"`: check each error's `message` field.
  - If any message contains `already` or `bereits` (German equivalent) → log "Already booked — nothing to do" and **exit 0** (idempotent).
  - If any message contains `sold out`, `ausgebucht`, or `no spots` → **exit non-zero** (class is full, booking failed).
  - Any other error → raise with the full message.
- Note: The Eversports API error `id` field was not captured for these cases during live inspection. Message-based detection is used as the discriminator.

→ Returns `cartId`. The existing membership is auto-selected by the server.

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
      errors { id message __typename }
      __typename
    }
    __typename
  }
}
```

**Variables:** `{ "cartId": "<cartId from step 3>" }`

**Success check:** HTTP 200 + no top-level `errors` + `__typename == "Order"`. If `ExpectedErrors`, raise.

→ Script prints the order ID and exits 0.

---

## Error Handling

Every response is validated for:
1. HTTP status code == 200 (raise `requests.HTTPError` otherwise).
2. Absence of a top-level `errors` key in the JSON body (GraphQL always returns HTTP 200 even for server errors).
3. The expected `__typename` in the union result.

Specific cases:
- **Login failure** → raise with error message → Action fails.
- **Session not found in calendar** → raise `RuntimeError` → Action fails.
- **Already booked** (step 3) → log + exit 0 → Action passes (idempotent).
- **Class full / sold out** → raise → Action fails (expected — booking not possible).
- **Any other API error** → raise → Action fails.
- **Timeout (30s)** → `requests.Timeout` raised → Action fails.

No retry logic. On failure the GitHub Action fails and GitHub sends a failure email.

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
    - cron: '0 17 * * 5'   # Friday 17:00 UTC = 18:00 CET (winter) / 19:00 CEST (summer)
  workflow_dispatch:
    inputs:
      target_date:
        description: 'Target Tuesday date (YYYY-MM-DD). Defaults to today+4.'
        required: false

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
                TARGET_DATE: ${{ inputs.target_date }}
          # Note: when input is not provided, this evaluates to empty string "".
          # The script uses `if override:` (falsy check) which correctly treats "" as absent.
```

**Cron note:** `0 17 * * 5` = 17:00 UTC. In CET (UTC+1, winter) this is 18:00 local; in CEST (UTC+2, summer) this is 19:00 local. The 1-hour summer drift is acceptable because the CrossFit class booking window is open for days, not minutes. Spots are not expected to fill within 1 hour of the window opening.

---

## Date Logic

```python
import os
from datetime import date, timedelta, timezone, datetime

def get_target_tuesday() -> date:
    override = os.environ.get("TARGET_DATE")
    if override:
        d = date.fromisoformat(override)
        if d.weekday() != 1:
            raise ValueError(f"TARGET_DATE {override} is not a Tuesday")
        if d <= datetime.now(timezone.utc).date():
            raise ValueError(f"TARGET_DATE {override} is not in the future")
        return d
    # UTC date on the runner (cron fires Friday 17:00 UTC → still Friday)
    return datetime.now(timezone.utc).date() + timedelta(days=4)

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

- `requests` — HTTP client with automatic cookie and session handling
- `beautifulsoup4` — HTML parsing for calendar response (uses stdlib `html.parser`, no lxml needed)
