"""Untersuchungs-Skript für das Wartelisten-Verhalten von Eversports (Spike S1–S6).

Siehe docs/superpowers/specs/2026-10-27-waitlist-auto-booking-design.md.
Läuft lokal mit dem eigenen Eversports-Account; die Rohantworten landen in
probe-output/ (gitignored, enthält persönliche Daten — vor dem Teilen prüfen).

Beispiele:
    python scripts/waitlist_probe.py introspect
    python scripts/waitlist_probe.py calendar --facility <slug-oder-id> --week 2026-11-09
    python scripts/waitlist_probe.py profile
    python scripts/waitlist_probe.py cart --item <data-uuid>   # schreibend, nur für ausgebuchte Kurse
    python scripts/waitlist_probe.py watch --facility <slug> --date 2026-11-12 --time 18:00 --name "Yoga" --book

Zugangsdaten: EVERSPORTS_EMAIL / EVERSPORTS_PASSWORD oder interaktive Abfrage.
"""
from __future__ import annotations

import argparse
import getpass
import json
import os
import sys
import time
from datetime import date, datetime, timedelta
from pathlib import Path

from bs4 import BeautifulSoup

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from backend.eversports.classify import classify_cart_errors  # noqa: E402
from backend.eversports.client import (  # noqa: E402
    BASE_URL, CALENDAR_URL, GRAPHQL_URL, TIMEOUT, _resolve_facility_id, eversports_login,
)
from backend.eversports.parsing import parse_calendar_slots  # noqa: E402

OUT_DIR = Path(__file__).resolve().parent.parent / "probe-output"
INTERESTING = ("wait", "cart", "booking", "participant", "notification", "spot", "subscription")

_INTROSPECTION_QUERY = """
query Introspection {
  __schema {
    queryType { name }
    mutationType { name }
    subscriptionType { name }
    types {
      kind name
      fields { name args { name type { kind name ofType { kind name ofType { kind name } } } } }
      possibleTypes { name }
    }
  }
}
"""

_CART_MUTATION = """
mutation UseCartCreationHandlerCreateCartFromEventBookableItem(
  $bookableItemId: ID!, $origin: Origin!, $clientMetadata: ClientMetadataInput
) {
  createCartFromEventBookableItem(
    bookableItemId: $bookableItemId origin: $origin clientMetadata: $clientMetadata
  ) {
    ... on Cart { id __typename }
    ... on ExpectedErrors { errors { id message path __typename } __typename }
    __typename
  }
}
"""


def _save(name: str, content: str) -> Path:
    OUT_DIR.mkdir(exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    path = OUT_DIR / f"{stamp}-{name}"
    path.write_text(content, encoding="utf-8")
    print(f"→ gespeichert: {path}")
    return path


def _login():
    email = os.environ.get("EVERSPORTS_EMAIL") or input("Eversports-E-Mail: ")
    password = os.environ.get("EVERSPORTS_PASSWORD") or getpass.getpass("Eversports-Passwort: ")
    result = eversports_login(email, password)
    if result is None:
        sys.exit("Login fehlgeschlagen")
    print("Login ok")
    return result["session"]


def _raw_gql(session, operation: str, query: str, variables: dict) -> dict:
    """Wie client._gql, aber ohne Exception bei GraphQL-Fehlern — wir wollen die Rohantwort sehen."""
    resp = session.post(
        GRAPHQL_URL,
        json={"operationName": operation, "query": query, "variables": variables},
        headers={"Content-Type": "application/json"},
        timeout=TIMEOUT,
    )
    print(f"HTTP {resp.status_code}")
    try:
        return resp.json()
    except ValueError:
        return {"_raw": resp.text[:2000]}


def cmd_introspect(session, _args) -> None:
    """S5/S6: Gibt es removeFromWaitingList, Subscriptions, Notification-Queries?"""
    body = _raw_gql(session, "Introspection", _INTROSPECTION_QUERY, {})
    _save("introspection.json", json.dumps(body, indent=2, ensure_ascii=False))
    schema = (body.get("data") or {}).get("__schema")
    if not schema:
        print("Introspection nicht verfügbar:", json.dumps(body.get("errors", body))[:500])
        return
    roots = {k: (schema[k] or {}).get("name") for k in ("queryType", "mutationType", "subscriptionType")}
    print("Root-Typen:", roots)
    types = {t["name"]: t for t in schema["types"]}
    for kind, root in roots.items():
        if not root:
            continue
        fields = types[root].get("fields") or []
        hits = [f["name"] for f in fields if any(k in f["name"].lower() for k in INTERESTING)]
        print(f"\n{kind} ({len(fields)} Felder), relevant:")
        for name in sorted(hits):
            print("  ", name)
    print("\nTypen mit 'wait' im Namen:", sorted(n for n in types if "wait" in n.lower()))


def cmd_calendar(session, args) -> None:
    """S4: Wie markiert das Kalender-HTML ausgebuchte Kurse / freie Plätze?"""
    facility_id = _resolve_facility_id(args.facility, session)
    week = date.fromisoformat(args.week)
    week_start = week - timedelta(days=week.weekday())
    for et in ("class", "training", "course"):
        resp = session.get(
            CALENDAR_URL,
            params={"facilityId": facility_id, "startDate": week_start.isoformat(), "activeEventType": et},
            timeout=TIMEOUT,
        )
        print(f"\n=== {et}: HTTP {resp.status_code}")
        try:
            html = resp.json()["data"]["html"]
        except (ValueError, KeyError, TypeError):
            print("kein HTML (Typ nicht angeboten?)")
            continue
        _save(f"calendar-{facility_id}-{week_start}-{et}.html", html)
        soup = BeautifulSoup(html, "html.parser")
        for li in soup.find_all("li", attrs={"data-uuid": True}):
            time_div = li.find(class_="session-time")
            name_div = li.find(class_="session-name")
            attrs = {k: v for k, v in li.attrs.items() if k != "data-uuid"}
            text = " ".join(li.get_text(" ", strip=True).split())
            print(
                f"- {li['data-uuid']} | {time_div.get_text(strip=True) if time_div else '?'}"
                f" | {name_div.get_text(strip=True) if name_div else '?'}"
                f"\n    attrs={attrs}\n    text={text[:200]}"
            )


def cmd_profile(session, _args) -> None:
    """S5: Erscheinen Wartelisten-Einträge auf /u, und mit welchem Markup?"""
    resp = session.get(BASE_URL + "/u", timeout=TIMEOUT)
    print(f"HTTP {resp.status_code}")
    _save("profile-u.html", resp.text)
    soup = BeautifulSoup(resp.text, "html.parser")
    blocks = soup.find_all("div", class_="marketplace-booked-activity")
    print(f"{len(blocks)} Blöcke 'marketplace-booked-activity'")
    for block in blocks:
        name = block.find("h4")
        links = [(a.get("class"), {k: v for k, v in a.attrs.items() if k.startswith("data-")}) for a in block.find_all("a")]
        print(f"- {name.get_text(strip=True) if name else '?'} | classes={block.get('class')}\n    links={links}")
    for kw in ("Warteliste", "waiting", "waitlist", "Wartelist"):
        hits = [el for el in soup.find_all(string=lambda s: s and kw.lower() in s.lower())]
        for el in hits[:10]:
            parent = el.parent
            print(f"[{kw}] <{parent.name} class={parent.get('class')}> {el.strip()[:120]}")


def cmd_cart(session, args) -> None:
    """S1/S3: Rohantwort von createCartFromEventBookableItem. Bestätigt KEINE Order."""
    print(
        "ACHTUNG: Legt bei Eversports einen Warenkorb an. Ist der Kurs nicht ausgebucht oder kostenlos,\n"
        "kann das bereits eine Buchung sein. Nur für ausgebuchte oder geschlossene Kurse verwenden."
    )
    if input("Fortfahren? Tippe JA: ").strip() != "JA":
        sys.exit("Abgebrochen")
    body = _raw_gql(
        session,
        "UseCartCreationHandlerCreateCartFromEventBookableItem",
        _CART_MUTATION,
        {"bookableItemId": args.item, "origin": "ORIGIN_MARKETPLACE", "clientMetadata": None},
    )
    _save(f"cart-{args.item}.json", json.dumps(body, indent=2, ensure_ascii=False))
    print(json.dumps(body, indent=2, ensure_ascii=False))


_ORDER_MUTATION = """
mutation SummaryButtonCreateOrderFromCart($cartId: ID!) {
  createOrderFromCart(cartId: $cartId, skipSetupFutureUsage: true) {
    ... on Order { id __typename }
    ... on ExpectedErrors { errors { id message path __typename } __typename }
    __typename
  }
}
"""


def _find_slot(session, facility_id: str, target: date, time_str: str, name: str):
    """(event_type, data-uuid, html) des Slots, oder (None, None, None)."""
    week_start = target - timedelta(days=target.weekday())
    for et in ("class", "training", "course"):
        resp = session.get(
            CALENDAR_URL,
            params={"facilityId": facility_id, "startDate": week_start.isoformat(), "activeEventType": et},
            timeout=TIMEOUT,
        )
        try:
            html = resp.json()["data"]["html"]
        except (ValueError, KeyError, TypeError):
            continue
        uuids = parse_calendar_slots(html, target, time_str, name)
        if uuids:
            return et, uuids[0], html
    return None, None, None


def _slot_snapshot(html: str, uuid: str) -> str:
    """Das <li> des Slots als Text — Änderungen daran zeigen, wie Eversports freie Plätze markiert."""
    li = BeautifulSoup(html, "html.parser").find("li", attrs={"data-uuid": uuid})
    return str(li) if li else "<slot nicht im HTML>"


def cmd_watch(session, args) -> None:
    """S1/S2/S4: Das Feature simulieren. Pollt Kalender + Warenkorb, bucht beim ersten freien Platz.

    Ablauf pro Runde: Kalender lesen (Slot-Markup bei Änderung speichern), Warenkorb anlegen.
    ExpectedErrors → weiter warten. Cart ok → mit --book Order bestätigen, danach /u sichern.
    Alles mit Zeitstempel in probe-output/<stamp>-watch.jsonl.
    """
    facility_id = _resolve_facility_id(args.facility, session)
    target = date.fromisoformat(args.date)
    event_type, uuid, html = _find_slot(session, facility_id, target, args.time, args.name)
    if uuid is None:
        sys.exit(f"Slot {args.name} {args.time} am {target} nicht gefunden")
    print(f"Slot gefunden: {uuid} (event_type={event_type})")
    print(
        "Jede Runde legt einen Warenkorb an. Sobald ein Platz frei ist, "
        + ("wird die Order bestätigt, also VERBINDLICH GEBUCHT." if args.book else "wird nur der Warenkorb angelegt (ohne --book keine Order).")
    )
    if input("Starten? Tippe JA: ").strip() != "JA":
        sys.exit("Abgebrochen")

    OUT_DIR.mkdir(exist_ok=True)
    log_path = OUT_DIR / f"{datetime.now().strftime('%Y%m%d-%H%M%S')}-watch-{uuid}.jsonl"

    def record(kind: str, **data) -> None:
        entry = {"ts": datetime.now().isoformat(timespec="seconds"), "kind": kind, **data}
        with log_path.open("a", encoding="utf-8") as f:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")
        print(f"[{entry['ts']}] {kind}: {json.dumps(data, ensure_ascii=False)[:300]}")

    record("start", uuid=uuid, event_type=event_type, facility_id=facility_id, book=args.book)
    _save("watch-profile-vorher.html", session.get(BASE_URL + "/u", timeout=TIMEOUT).text)

    last_slot = None
    deadline = datetime.now() + timedelta(minutes=args.max_minutes)
    while datetime.now() < deadline:
        week_start = target - timedelta(days=target.weekday())
        resp = session.get(
            CALENDAR_URL,
            params={"facilityId": facility_id, "startDate": week_start.isoformat(), "activeEventType": event_type},
            timeout=TIMEOUT,
        )
        if resp.status_code in (401, 403):
            record("session_abgelaufen", status=resp.status_code)
            session = _login()
            continue
        try:
            slot = _slot_snapshot(resp.json()["data"]["html"], uuid)
        except (ValueError, KeyError, TypeError):
            slot = f"<kein Kalender-HTML, HTTP {resp.status_code}>"
        if slot != last_slot:
            record("slot_markup_geaendert", markup=slot)
            last_slot = slot

        cart = _raw_gql(
            session,
            "UseCartCreationHandlerCreateCartFromEventBookableItem",
            _CART_MUTATION,
            {"bookableItemId": uuid, "origin": "ORIGIN_MARKETPLACE", "clientMetadata": None},
        )
        result = (cart.get("data") or {}).get("createCartFromEventBookableItem") or {}
        if result.get("__typename") != "Cart":
            messages = [e.get("message", "") for e in result.get("errors", [])] or [json.dumps(cart)[:300]]
            record("cart_abgelehnt", messages=messages, klassifikation=classify_cart_errors(messages).name)
            time.sleep(args.interval)
            continue

        record("cart_ok", cart_id=result["id"])
        if args.book:
            order = _raw_gql(session, "SummaryButtonCreateOrderFromCart", _ORDER_MUTATION, {"cartId": result["id"]})
            record("order_antwort", antwort=order)
        _save("watch-profile-nachher.html", session.get(BASE_URL + "/u", timeout=TIMEOUT).text)
        record("ende", grund="platz_frei")
        print(f"\nProtokoll: {log_path}")
        return

    record("ende", grund="timeout")
    print(f"\nProtokoll: {log_path}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="cmd", required=True)
    sub.add_parser("introspect", help="GraphQL-Schema abfragen (S5, S6)")
    cal = sub.add_parser("calendar", help="Kalender-HTML einer Woche dumpen (S4)")
    cal.add_argument("--facility", required=True, help="Slug oder numerische facilityId")
    cal.add_argument("--week", default=date.today().isoformat(), help="ein Datum der Woche (YYYY-MM-DD)")
    sub.add_parser("profile", help="/u dumpen und nach Wartelisten-Einträgen suchen (S5)")
    cart = sub.add_parser("cart", help="Warenkorb-Mutation für einen Slot ausführen (S1, S3) — schreibend!")
    cart.add_argument("--item", required=True, help="data-uuid des Slots (aus 'calendar')")
    watch = sub.add_parser("watch", help="Feature simulieren: pollen und bei freiem Platz buchen (S1, S2, S4)")
    watch.add_argument("--facility", required=True, help="Slug oder numerische facilityId")
    watch.add_argument("--date", required=True, help="Kurstag (YYYY-MM-DD)")
    watch.add_argument("--time", required=True, help="Startzeit wie im Kalender (HH:MM)")
    watch.add_argument("--name", required=True, help="Kursname exakt wie im Kalender")
    watch.add_argument("--interval", type=int, default=10, help="Sekunden zwischen Runden (Standard 10)")
    watch.add_argument("--max-minutes", type=int, default=30, help="Abbruch nach N Minuten (Standard 30)")
    watch.add_argument("--book", action="store_true", help="bei freiem Platz die Order bestätigen (verbindlich)")
    args = parser.parse_args()

    session = _login()
    commands = {
        "introspect": cmd_introspect, "calendar": cmd_calendar, "profile": cmd_profile,
        "cart": cmd_cart, "watch": cmd_watch,
    }
    commands[args.cmd](session, args)


if __name__ == "__main__":
    main()
