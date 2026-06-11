"""Klassifikation der Eversports-GraphQL-Fehlertexte.

⚠️ HEIKELSTE STELLE DES SYSTEMS: Eversports liefert Fehler als lokalisierte
Freitexte. Dieses Modul ist die EINZIGE Stelle, die darauf matcht. Wenn eine
Buchung fälschlich als harter Fehler statt als Warteliste/Doppelbuchung endet,
fehlt hier ein Keyword — Keyword ergänzen, Test ergänzen, fertig.

Verhalten exakt übernommen aus dem früheren backend/core/booking.py (Stand 2026-06-10):
already-Prüfung läuft VOR der full-Prüfung über alle Messages.
"""
from enum import Enum, auto

_ALREADY_KEYWORDS = ("already", "bereits")
_FULL_KEYWORDS = ("fully booked", "fully_booked", "ausgebucht", "sold out", "no spots")


class CartOutcome(Enum):
    ALREADY_BOOKED = auto()
    SLOT_FULL = auto()
    UNKNOWN = auto()


def classify_cart_errors(messages: list[str]) -> CartOutcome:
    lowered = [m.lower() for m in messages]
    for msg in lowered:
        if any(kw in msg for kw in _ALREADY_KEYWORDS):
            return CartOutcome.ALREADY_BOOKED
    for msg in lowered:
        if any(kw in msg for kw in _FULL_KEYWORDS):
            return CartOutcome.SLOT_FULL
    return CartOutcome.UNKNOWN
