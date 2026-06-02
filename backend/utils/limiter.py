import math
import time
from typing import Dict, List


class SimpleRateLimiter:
    def __init__(self, limit_env_key = None, default_calls = None, period_env_key = None, default_period = None, calls = None, period = None):
        if isinstance(limit_env_key, int):
            calls = limit_env_key
            if isinstance(default_calls, int):
                period = default_calls
            limit_env_key = None
            default_calls = None
            period_env_key = None
            default_period = None

        if calls is not None:
            self.limit_env_key = None
            self.default_calls = calls
        else:
            self.limit_env_key = limit_env_key
            self.default_calls = default_calls

        if period is not None:
            self.period_env_key = None
            self.default_period = period
        else:
            self.period_env_key = period_env_key
            self.default_period = default_period

        self.storage = {}

    def get_calls(self) -> int:
        import os
        if self.limit_env_key is None:
            return self.default_calls
        return int(os.getenv(self.limit_env_key, str(self.default_calls)))

    def get_period(self) -> int:
        import os
        if self.period_env_key is None:
            return self.default_period
        return int(os.getenv(self.period_env_key, str(self.default_period)))

    def check(self, key: str):
        now = time.time()
        period = self.get_period()
        calls = self.get_calls()
        window = now - period
        
        timestamps = self.storage.get(key, [])
        timestamps = [t for t in timestamps if t > window]
        remaining = calls - len(timestamps)
        if remaining <= 0:
            retry_after = max(0, int(math.ceil(timestamps[0] + period - now)))

            return {
                "allowed": False,
                "remaining": 0,
                "retry_after": max(1, retry_after)
            }

        timestamps.append(now)
        self.storage[key] = timestamps
        return {
            "allowed": True,
            "remaining": max(0, calls - len(timestamps)),
            "retry_after": 0,
        }

    def is_allowed(self, key: str) -> bool:
        return self.check(key)["allowed"]

