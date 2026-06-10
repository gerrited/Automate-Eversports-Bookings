import pytest

from backend.eversports.classify import CartOutcome, classify_cart_errors


# --- already_booked ---

@pytest.mark.parametrize("msg", [
    "You have already booked this session",
    "Du hast diese Session bereits gebucht",
    "ALREADY booked",  # case-insensitiv
])
def test_bereits_gebucht(msg):
    assert classify_cart_errors([msg]) is CartOutcome.ALREADY_BOOKED


# --- voll → Warteliste ---

@pytest.mark.parametrize("msg", [
    "This class is fully booked",
    "Error: fully_booked",
    "Diese Klasse ist ausgebucht",
    "Sold out",
    "There are no spots left",
])
def test_ausgebucht(msg):
    assert classify_cart_errors([msg]) is CartOutcome.SLOT_FULL


# --- Prioritäten und Unbekanntes ---

def test_already_hat_vorrang_vor_full():
    # Reihenfolge wie im Original: erst already-Schleife über alle Messages, dann full
    assert classify_cart_errors(["sold out", "already booked"]) is CartOutcome.ALREADY_BOOKED


def test_unbekannte_meldung_ist_unknown():
    assert classify_cart_errors(["Payment method required"]) is CartOutcome.UNKNOWN


def test_leere_liste_ist_unknown():
    assert classify_cart_errors([]) is CartOutcome.UNKNOWN
