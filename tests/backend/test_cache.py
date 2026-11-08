from backend.core.cache import TTLCache


def test_get_liefert_none_fuer_unbekannten_schluessel():
    cache = TTLCache(ttl_seconds=60)
    assert cache.get("k", now=100.0) is None


def test_get_liefert_gespeicherten_wert_innerhalb_der_ttl():
    cache = TTLCache(ttl_seconds=60)
    cache.set("k", [1, 2, 3], now=100.0)
    assert cache.get("k", now=159.0) == [1, 2, 3]


def test_get_liefert_none_nach_ablauf_der_ttl():
    cache = TTLCache(ttl_seconds=60)
    cache.set("k", "wert", now=100.0)
    assert cache.get("k", now=161.0) is None


def test_set_ueberschreibt_und_verlaengert():
    cache = TTLCache(ttl_seconds=60)
    cache.set("k", "alt", now=100.0)
    cache.set("k", "neu", now=150.0)
    assert cache.get("k", now=205.0) == "neu"


def test_clear_entfernt_alle_eintraege():
    cache = TTLCache(ttl_seconds=60)
    cache.set("k", "wert", now=100.0)
    cache.clear()
    assert cache.get("k", now=101.0) is None
