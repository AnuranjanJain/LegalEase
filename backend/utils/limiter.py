import threading
import time
from typing import Dict, List


class SimpleRateLimiter:
    """In-process sliding-window rate limiter.

    This implementation stores request timestamps in an in-memory dictionary
    protected by a threading lock.  It works correctly for single-process
    deployments (e.g. ``uvicorn main:app``).

    **Production note**: When running multiple worker processes (e.g.
    ``gunicorn -w 4 -k uvicorn.workers.UvicornWorker``), each worker has
    its own memory space, so rate-limit state is NOT shared across workers.
    For multi-worker deployments, consider replacing this with a
    Redis-backed solution such as ``slowapi`` with a Redis storage backend.
    """

    def __init__(self, calls: int, period: int):
        self.calls = calls
        self.period = period
        self._storage: Dict[str, List[float]] = {}
        self._lock = threading.Lock()

    def check(self, key: str):
        now = time.time()
        window = now - self.period

        with self._lock:
            timestamps = self._storage.get(key, [])
            timestamps = [t for t in timestamps if t > window]
            remaining = self.calls - len(timestamps)

            if remaining <= 0:
                retry_after = max(1, int(timestamps[0] + self.period - now) + 1) if timestamps else 1
                self._storage[key] = timestamps
                return {
                    "allowed": False,
                    "remaining": 0,
                    "retry_after": retry_after,
                }

            timestamps.append(now)
            self._storage[key] = timestamps
            return {
                "allowed": True,
                "remaining": max(0, self.calls - len(timestamps)),
                "retry_after": 0,
            }

    def is_allowed(self, key: str) -> bool:
        return self.check(key)["allowed"]

    def cleanup(self) -> int:
        """Remove stale keys that have no timestamps in the current window.

        Returns the number of keys evicted.
        """
        now = time.time()
        window = now - self.period
        evicted = 0

        with self._lock:
            stale_keys = [
                k for k, ts in self._storage.items()
                if not any(t > window for t in ts)
            ]
            for k in stale_keys:
                del self._storage[k]
                evicted += 1

        return evicted
