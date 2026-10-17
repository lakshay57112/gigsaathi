"""Small in-memory sliding-window rate limiter for the expensive AI endpoints."""

import time
from collections import deque
from collections.abc import Callable

_PRUNE_ABOVE = 10_000  # keys tracked before idle ones are dropped


class SlidingWindowLimiter:
    def __init__(
        self,
        max_calls: int,
        window_seconds: float = 60.0,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self.max_calls = max_calls
        self.window = window_seconds
        self._clock = clock
        self._hits: dict[str, deque[float]] = {}

    def check(self, key: str) -> int:
        """Record a call. Returns 0 if allowed, otherwise the seconds to wait."""
        now = self._clock()
        if len(self._hits) > _PRUNE_ABOVE:
            self._prune(now)
        hits = self._hits.setdefault(key, deque())
        while hits and now - hits[0] >= self.window:
            hits.popleft()
        if len(hits) >= self.max_calls:
            return max(1, int(self.window - (now - hits[0])) + 1)
        hits.append(now)
        return 0

    def _prune(self, now: float) -> None:
        self._hits = {k: h for k, h in self._hits.items() if h and now - h[-1] < self.window}
