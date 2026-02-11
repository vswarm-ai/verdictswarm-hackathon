from __future__ import annotations

import redis.asyncio as redis
from fastapi import Depends

from .config import get_settings
from .services.cache import Cache
from .services.rate_limiter import RedisRateLimiter
from .services.scanner import ScannerService


async def get_redis() -> redis.Redis:
    settings = get_settings()
    return redis.from_url(settings.redis_url, decode_responses=False)


async def get_cache(r: redis.Redis = Depends(get_redis)) -> Cache:
    return Cache(r)


async def get_rate_limiter(r: redis.Redis = Depends(get_redis)) -> RedisRateLimiter:
    settings = get_settings()
    return RedisRateLimiter(r, tier_limits=settings.tier_limits())


_scanner_singleton: ScannerService | None = None


async def get_scanner() -> ScannerService:
    global _scanner_singleton
    if _scanner_singleton is None:
        _scanner_singleton = ScannerService()
    return _scanner_singleton
