# Eversports Buchungsautomatisierung — Design Spec

**Datum:** 2026-03-13  
**Status:** Genehmigt

---

## Übersicht

Automatisierung der wöchentlichen Buchung des CrossFit-Kurses um 18:00 Uhr bei CrossFit Rabbit Hole auf Eversports. Eine GitHub Action läuft jeden Freitag um genau 18:00 Uhr Europe/Berlin (DST-aware) und bucht den CrossFit-Kurs für den darauffolgenden Dienstag (4 Tage später) über die interne Eversports-GraphQL-API — kein Browser erforderlich.

---

## Entdeckte API

Alle Eversports-API-Calls nutzen einen einzigen GraphQL-Endpunkt:

```
POST https://www.eversports.de/api/checkout
Content-Type: application/json
```

Authentifizierung ist **session-cookie-basiert**: Die Login-Mutation setzt ein HttpOnly-Session-Cookie, das `requests.Session()` bei allen Folge-Requests automatisch mitsendet. Das `apiToken`-Feld in der Login-Antwort ist für die Mobile-App und wird von diesem Script nicht verwendet.

### Konstanten

| Key | Wert |
|-----|------|
| Base URL | `https://www.eversports.de` |
| GraphQL-Endpunkt | `https://www.eversports.de/api/checkout` |
| Kalender-Endpunkt | `https://www.eversports.de/api/eventsession/calendar` |
| Anbieter-ID | `73041` |
| Zielkurs | CrossFit um 18:00 |

---

## Buchungsablauf (4 Schritte)

Alle HTTP-Requests verwenden `timeout=30` (Sekunden) und `Content-Type: application/json`.

### Schritt 1 — Login

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

**Variablen:**
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

**Erfolgsprüfung:** HTTP 200 + kein `errors`-Key auf oberster Ebene + `data.credentialLogin.__typename == "AuthResult"`. Bei `ExpectedErrors`: Exception mit der Fehlermeldung werfen.

→ Das Session-Cookie wird automatisch durch die Response gesetzt.

---

### Schritt 2 — Dienstag 18:00 CrossFit Session-UUID finden

```
GET https://www.eversports.de/api/eventsession/calendar?facilityId=73041&startDate=YYYY-MM-DD&activeEventType=class
```

`startDate` = Montag der Woche, die den Ziel-Dienstag enthält (`target_tuesday - timedelta(days=1)`).

Die Response ist **HTML** (aus Live-API-Inspektion bestätigt — der Endpunkt gibt ein gerendertes HTML-Fragment zurück, kein JSON). Parsen mit `BeautifulSoup(html, "html.parser")` (stdlib-Parser).

**HTML-Struktur** (aus Live-Inspektion):
```html
<!-- Eine <ul> pro Tag. Alle Sessions eines Tages sind <li>-Items in derselben <ul>. -->
<ul class="calendar__slot-list">
  <li><h3 data-day="2026-03-17" class="calendar__day-header">Di., 17/03</h3></li>
  <li class="sr-only"><h3>Tuesday, 17/03/2026</h3></li>
  <li data-uuid="33f6254a-..." class="calendar__slot">
    <div class="session-time">18:00 ● 60 Min</div>
    <div class="session-name">CrossFit</div>
  </li>
  <!-- weitere Session-<li>-Items desselben Tages -->
</ul>
```

**Parse-Logik:**
1. Alle `<ul>`-Elemente finden, die ein `<h3 data-day="YYYY-MM-DD">` enthalten, dessen Datum `target_tuesday.isoformat()` entspricht.
2. Innerhalb dieser `<ul>`-Elemente alle `<li data-uuid>`-Items finden.
3. Auf jene filtern, bei denen `.session-time`-Text mit `18:00` beginnt und `.session-name`-Text `CrossFit` ist.
4. Null Treffer → `raise RuntimeError(f"CrossFit 18:00 not found for {target_tuesday}")`.
5. Mehrere Treffer → ersten nehmen (mehrere identische Slots sind nicht erwartet).

**`startDate`-Parameter:** Die API erwartet den Montag der Zielwoche als Anker. Bestätigt aus Live-Inspektion — die Übergabe von Montag gibt die vollständige Woche inklusive Dienstag zurück.

→ Gibt den `data-uuid`-Wert als `bookableItemId` zurück.

---

### Schritt 3 — Warenkorb erstellen

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

**Variablen:**
```json
{
  "bookableItemId": "<UUID aus Schritt 2>",
  "origin": "ORIGIN_MARKETPLACE",
  "clientMetadata": null
}
```

**Erfolgsprüfung:** HTTP 200 + kein `errors` auf oberster Ebene + `__typename == "Cart"` → `id` als `cartId` entnehmen.

**Behandlung "Bereits gebucht" / Ausgebucht:**
- Bei `__typename == "ExpectedErrors"`: jedes `message`-Feld der Fehler prüfen.
  - Enthält eine Meldung `already` oder `bereits` → "Already booked — nothing to do" loggen und **exit 0** (idempotent).
  - Enthält eine Meldung `sold out`, `ausgebucht` oder `no spots` → **exit non-zero** (Kurs voll, Buchung fehlgeschlagen).
  - Jeder andere Fehler → Exception mit vollständiger Meldung werfen.

→ Gibt `cartId` zurück. Die bestehende Mitgliedschaft wird automatisch vom Server ausgewählt.

---

### Schritt 4 — Buchung bestätigen

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

**Variablen:** `{ "cartId": "<cartId aus Schritt 3>" }`

**Erfolgsprüfung:** HTTP 200 + kein `errors` auf oberster Ebene + `__typename == "Order"`. Bei `ExpectedErrors`: Exception werfen.

→ Script gibt die Order-ID aus und beendet sich mit Exit 0.

---

## Fehlerbehandlung

Jede Response wird geprüft auf:
1. HTTP-Statuscode == 200 (sonst `requests.HTTPError` werfen).
2. Kein `errors`-Key auf oberster Ebene im JSON-Body (GraphQL gibt immer HTTP 200 zurück, auch bei Server-Fehlern).
3. Erwartetes `__typename` im Union-Result.

Spezifische Fälle:
- **Login-Fehler** → Exception mit Fehlermeldung → Action schlägt fehl.
- **Session nicht im Kalender gefunden** → `RuntimeError` werfen → Action schlägt fehl.
- **Bereits gebucht** (Schritt 3) → loggen + exit 0 → Action erfolgreich (idempotent).
- **Kurs voll / ausgebucht** → Exception werfen → Action schlägt fehl (erwartet — Buchung nicht möglich).
- **Jeder andere API-Fehler** → Exception werfen → Action schlägt fehl.
- **Timeout (30s)** → `requests.Timeout` wird geworfen → Action schlägt fehl.

Keine Retry-Logik. Bei Fehler schlägt die GitHub Action fehl und GitHub sendet eine Fehler-E-Mail.

---

## Dateistruktur

```
book.py                          # Haupt-Buchungsscript
.github/
  workflows/
    book.yml                     # GitHub Action: cron Freitag 17:00 UTC
```

---

## GitHub Action

```yaml
name: Book CrossFit Tuesday 18:00
on:
  schedule:
    - cron: '0 16 * * 5'   # Freitag 16:00 UTC — frühestmöglich, damit der Sleep-Schritt 18:00 Berlin in CET und CEST erreichen kann
  workflow_dispatch:
    inputs:
      target_date:
        description: 'Ziel-Dienstag Datum (YYYY-MM-DD). Standard: heute+4.'
        required: false

jobs:
  book:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      - name: Warten bis 18:00 Europe/Berlin
        run: |
          BERLIN_HOUR=$(TZ="Europe/Berlin" date +%H)
          BERLIN_MIN=$(TZ="Europe/Berlin" date +%M)
          TARGET=18
          if [ "$BERLIN_HOUR" -lt "$TARGET" ]; then
            SLEEP_SECS=$(( (TARGET - BERLIN_HOUR) * 3600 - BERLIN_MIN * 60 ))
            echo "Berlin time is ${BERLIN_HOUR}:${BERLIN_MIN}. Sleeping ${SLEEP_SECS}s until 18:00."
            sleep "$SLEEP_SECS"
          else
            echo "Berlin time is ${BERLIN_HOUR}:${BERLIN_MIN}. No sleep needed."
          fi
      - run: pip install requests beautifulsoup4
      - run: python book.py
        env:
          EVERSPORTS_EMAIL: ${{ secrets.EVERSPORTS_EMAIL }}
          EVERSPORTS_PASSWORD: ${{ secrets.EVERSPORTS_PASSWORD }}
          TARGET_DATE: ${{ inputs.target_date }}
          # Hinweis: wenn kein Input angegeben, ergibt das einen leeren String "".
          # Das Script nutzt `if override:` (Falsy-Prüfung), was "" korrekt als nicht vorhanden behandelt.
```

**Cron-Hinweis:** `0 16 * * 5` = 16:00 UTC. In CET (UTC+1, Winter) entspricht das 17:00 Berlin; der Sleep-Schritt wartet 1 Stunde bis 18:00. In CEST (UTC+2, Sommer) entspricht das 18:00 Berlin; der Sleep-Schritt wird übersprungen. Die Buchung wird unabhängig von der Sommerzeit immer genau um 18:00 Europe/Berlin ausgeführt.

---

## Datumslogik

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
    # UTC-Datum auf dem Runner (cron feuert Freitag 16:00 UTC → noch Freitag)
    return datetime.now(timezone.utc).date() + timedelta(days=4)

def get_week_start(d: date) -> date:
    return d - timedelta(days=d.weekday())  # Montag dieser Woche
```

---

## Benötigte Secrets

| Secret | Beschreibung |
|--------|--------------|
| `EVERSPORTS_EMAIL` | Eversports-Konto-E-Mail |
| `EVERSPORTS_PASSWORD` | Eversports-Konto-Passwort |

---

## Abhängigkeiten

- `requests` — HTTP-Client mit automatischer Cookie- und Session-Verwaltung
- `beautifulsoup4` — HTML-Parsing der Kalender-Response (nutzt stdlib `html.parser`, kein lxml nötig)
