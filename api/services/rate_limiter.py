from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Dict, Tuple

import redis.asyncio as redis


class RateLimitExceeded(Exception):
    def __init__(self, *, retry_after_s: int, calls_limit: int) -> None:
        super().__init__("Rate limit exceeded")
        self.retry_after_s = int(retry_after_s)
        self.calls_limit = int(calls_limit)


@dataclass(frozen=True)
class Usage:
    calls_today: int
    calls_limit: int
    calls_remaining: int
    reset_at: datetime


def _utc_midnight_next() -> datetime:
    now = datetime.now(timezone.utc)
    tomorrow = (now + timedelta(days=1)).date()
    return datetime(tomorrow.year, tomorrow.month, tomorrow.day, tzinfo=timezone.utc)


class RedisRateLimiter:
    def __init__(self, r: redis.Redis, *, tier_limits: Dict[str, int]):
        self.r = r
        self.tier_limits = {k.lower(): int(v) for k, v in tier_limits.items()}

    def limit_for_tier(self, tier: str) -> int:
        return int(self.tier_limits.get((tier or "agent").lower(), self.tier_limits.get("agent", 1000)))

    async def consume(self, *, api_key_id: str, tier: str, cost: int = 1, identifier: str | None = None) -> Usage:
        """Consume rate limit quota.

        Args:
            api_key_id: API key ID (legacy, for backward compatibility)
            tier: Tier level
            cost: Number of calls to consume (default 1)
            identifier: Rate limit identifier (e.g., "ip:1.2.3.4" or "wallet:0x123")
                       If provided, this takes precedence over api_key_id
        """
        now = datetime.now(timezone.utc)
        reset_at = _utc_midnight_next()
        ttl = int((reset_at - now).total_seconds())

        calls_limit = self.limit_for_tier(tier)
        if calls_limit <= 0:
            # Unlimited
            return Usage(calls_today=0, calls_limit=0, calls_remaining=0, reset_at=reset_at)

        # Use identifier if provided, otherwise fall back to api_key_id
        key_id = identifier if identifier else api_key_id
        k = f"rl:{key_id}:{now.date().isoformat()}"

        # Increment by cost
        pipe = self.r.pipeline()
        pipe.incrby(k, int(cost))
        pipe.expire(k, ttl)
        calls_today, _ = await pipe.execute()

        calls_today = int(calls_today)
        remaining = max(calls_limit - calls_today, 0)

        if calls_today > calls_limit:
            raise RateLimitExceeded(retry_after_s=ttl, calls_limit=calls_limit)

        return Usage(calls_today=calls_today, calls_limit=calls_limit, calls_remaining=remaining, reset_at=reset_at)

    async def get_usage(self, *, api_key_id: str, tier: str, identifier: str | None = None) -> Usage:
        """Get current usage without consuming quota.

        Args:
            api_key_id: API key ID (legacy, for backward compatibility)
            tier: Tier level
            identifier: Rate limit identifier (e.g., "ip:1.2.3.4" or "wallet:0x123")
                       If provided, this takes precedence over api_key_id
        """
        now = datetime.now(timezone.utc)
        reset_at = _utc_midnight_next()
        ttl = int((reset_at - now).total_seconds())

        calls_limit = self.limit_for_tier(tier)
        if calls_limit <= 0:
            return Usage(calls_today=0, calls_limit=0, calls_remaining=0, reset_at=reset_at)

        # Use identifier if provided, otherwise fall back to api_key_id
        key_id = identifier if identifier else api_key_id
        k = f"rl:{key_id}:{now.date().isoformat()}"
        raw = await self.r.get(k)
        calls_today = int(raw or 0)
        remaining = max(calls_limit - calls_today, 0)
        return Usage(calls_today=calls_today, calls_limit=calls_limit, calls_remaining=remaining, reset_at=reset_at)
