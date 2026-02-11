from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, Optional, Tuple

import orjson
import redis.asyncio as redis


class Cache:
    def __init__(self, r: redis.Redis):
        self.r = r

    @staticmethod
    def _key(*parts: str) -> str:
        return ":".join(parts)

    async def get_json(self, key: str) -> Optional[Tuple[Any, datetime]]:
        raw = await self.r.get(key)
        if not raw:
            return None
        try:
            obj = orjson.loads(raw)
            cached_at_s = obj.get("cached_at")
            cached_at = datetime.fromisoformat(cached_at_s.replace("Z", "+00:00")) if cached_at_s else datetime.now(timezone.utc)
            return obj.get("value"), cached_at
        except Exception:
            return None

    async def set_json(self, key: str, value: Any, ttl_s: int) -> datetime:
        cached_at = datetime.now(timezone.utc)
        payload = {"cached_at": cached_at.isoformat().replace("+00:00", "Z"), "value": value}
        await self.r.set(key, orjson.dumps(payload), ex=int(ttl_s))
        return cached_at
