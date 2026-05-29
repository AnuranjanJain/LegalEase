import math
import time
from typing import Dict, List

class SimpleRateLimiter:
    def __init__(self,calls:int,period:int):
        self.calls=calls
        self.period=period
        self.storage:Dict[str,List[float]]={}
    def check(self,key:str):
        now=time.time()
        window=now-self.period
        timestamps = self.storage.get(key, [])
        timestamps = [t for t in timestamps if t > window]
        remaining = self.calls - len(timestamps)
        if remaining<=0:
<<<<<<< HEAD
            oldest_timestamp = timestamps[0] if timestamps else now
            retry_after = max(0, math.ceil(oldest_timestamp + self.period - now))
=======
            retry_after = max(0, int(math.ceil(timestamps[0] + self.period - now)))
>>>>>>> upstream/main

            return{
                "allowed":False,
                "remaining":0,
                "retry_after":retry_after
            }
        timestamps.append(now)
        self.storage[key] = timestamps
        return {
            "allowed": True,
            "remaining": self.calls - len(timestamps),
            "retry_after": 0,
        }

