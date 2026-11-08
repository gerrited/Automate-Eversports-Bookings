"""Einfacher In-Memory-TTL-Cache (pro Backend-Prozess)."""
import time
from threading import Lock
from typing import Any


class TTLCache:
    def __init__(self, ttl_seconds: float):
        self.ttl_seconds = ttl_seconds
        self._entries: dict[str, tuple[float, Any]] = {}
        self._lock = Lock()

    def get(self, key: str, now: float | None = None) -> Any | None:
        if now is None:
            now = time.monotonic()
        with self._lock:
            entry = self._entries.get(key)
            if entry is None:
                return None
            expires_at, value = entry
            if now > expires_at:
                del self._entries[key]
                return None
            return value

    def set(self, key: str, value: Any, now: float | None = None) -> None:
        if now is None:
            now = time.monotonic()
        with self._lock:
            self._entries[key] = (now + self.ttl_seconds, value)

    def clear(self) -> None:
        with self._lock:
            self._entries.clear()
