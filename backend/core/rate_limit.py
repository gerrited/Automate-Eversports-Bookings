"""Einfacher In-Memory-Sliding-Window-Rate-Limiter.

Pro Backend-Prozess — bei mehreren Replicas gilt das Limit pro Pod.
Für den Login-Schutz (Brute-Force-Bremse) ist das ausreichend.
"""
import time
from collections import defaultdict, deque
from threading import Lock


class RateLimiter:
    def __init__(self, max_requests: int, window_seconds: float):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = Lock()

    def allow(self, key: str, now: float | None = None) -> bool:
        """True, wenn der Request unter dem Limit liegt (und zählt ihn dann mit)."""
        if now is None:
            now = time.monotonic()
        cutoff = now - self.window_seconds
        with self._lock:
            hits = self._hits[key]
            while hits and hits[0] <= cutoff:
                hits.popleft()
            if len(hits) >= self.max_requests:
                return False
            hits.append(now)
            return True

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()
