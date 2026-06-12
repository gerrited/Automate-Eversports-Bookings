"""Login-Cache: ein Eversports-Login pro Nutzer und TTL statt pro Operation.

Key = SHA-256(email:password) — ein Passwortwechsel ergibt automatisch einen
neuen Key und damit einen frischen Login. Es werden nie Klartext-Credentials
im Cache abgelegt, nur der Hash als Schlüssel und das Login-Ergebnis als Wert.
"""
import hashlib

from backend.core.cache import TTLCache
from backend.eversports.client import eversports_login

# 20 Min: deutlich länger als ein Worker-Lauf, kurz genug, dass server-
# seitig ablaufende Sessions selten auftreten (Retry-Wrapper fängt den Rest)
_cache = TTLCache(ttl_seconds=20 * 60)


def _key(email: str, password: str) -> str:
    return hashlib.sha256(f"{email}:{password}".encode()).hexdigest()


def get_or_login(email: str, password: str) -> dict | None:
    """Gecachtes Login-Ergebnis oder frischer Login. None bei Auth-Fehlschlag (nie gecacht)."""
    key = _key(email, password)
    cached = _cache.get(key)
    if cached is not None:
        return cached
    result = eversports_login(email, password)
    if result is not None:
        _cache.set(key, result)
    return result


def invalidate(email: str, password: str) -> None:
    """Invalidiert einen gecachten Login und erzwingt beim nächsten Aufruf einen frischen Login."""
    _cache.delete(_key(email, password))
