from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, Query, Response

from ..deps import get_cache, get_rate_limiter, get_scanner
from ..middleware.auth import ApiKeyInfo, require_api_key
from ..models.requests import BatchScanRequest, DeepScanRequest, ScanDepth
from ..models.responses import ErrorResponse, SuccessResponse
from ..services.cache import Cache
from ..services.rate_limiter import RateLimitExceeded, RedisRateLimiter
from ..services.scanner import ScannerService


router = APIRouter(prefix="/v1", tags=["scan"])


def _ttl_for_depth(depth: str) -> int:
    d = (depth or "basic").lower()
    if d == "basic":
        return 3600
    if d == "full":
        return 1800
    if d == "debate":
        return 1800
    return 3600


@router.get("/scan/{address}", response_model=SuccessResponse)
async def quick_scan(
    address: str,
    chain: str = Query(default="base"),
    tier: str = Query(default="FREE"),
    api_key: ApiKeyInfo = Depends(require_api_key),
    rl: RedisRateLimiter = Depends(get_rate_limiter),
    cache: Cache = Depends(get_cache),
    scanner: ScannerService = Depends(get_scanner),
):
    # Quick scan uses depth=basic and cache by default.
    depth = "basic"
    effective_tier = (tier or api_key.tier or "FREE").upper()
    cache_key = f"scan:{chain}:{address}:{depth}:{effective_tier}"

    cached = await cache.get_json(cache_key)
    if cached:
        value, cached_at = cached
        usage = await rl.consume(api_key_id=api_key.api_key_id, tier=api_key.tier, cost=1)
        value["cached"] = True
        value["cached_at"] = cached_at.isoformat().replace("+00:00", "Z")
        return SuccessResponse(data=value, usage=usage.__dict__)

    usage = await rl.consume(api_key_id=api_key.api_key_id, tier=api_key.tier, cost=1)
    result = await scanner.scan(address=address, chain=chain, depth=depth, tier=effective_tier)
    cached_at = await cache.set_json(cache_key, result, ttl_s=_ttl_for_depth(depth))
    result["cached"] = False
    result["cached_at"] = cached_at.isoformat().replace("+00:00", "Z")
    return SuccessResponse(data=result, usage=usage.__dict__)


@router.post("/scan", response_model=SuccessResponse)
async def deep_scan(
    req: DeepScanRequest,
    response: Response,
    api_key: ApiKeyInfo = Depends(require_api_key),
    rl: RedisRateLimiter = Depends(get_rate_limiter),
    cache: Cache = Depends(get_cache),
    scanner: ScannerService = Depends(get_scanner),
):
    depth = req.depth.value
    effective_tier = (getattr(req, "tier", None) or api_key.tier or "FREE").upper()
    cache_key = f"scan:{req.chain}:{req.address}:{depth}:{effective_tier}"

    if not req.force_refresh:
        cached = await cache.get_json(cache_key)
        if cached:
            value, cached_at = cached
            usage = await rl.consume(api_key_id=api_key.api_key_id, tier=api_key.tier, cost=1)
            value["cached"] = True
            value["cached_at"] = cached_at.isoformat().replace("+00:00", "Z")
            return SuccessResponse(data=value, usage=usage.__dict__)

    usage = await rl.consume(api_key_id=api_key.api_key_id, tier=api_key.tier, cost=1)
    result = await scanner.scan(address=req.address, chain=req.chain, depth=depth, tier=effective_tier)
    cached_at = await cache.set_json(cache_key, result, ttl_s=_ttl_for_depth(depth))
    result["cached"] = False
    result["cached_at"] = cached_at.isoformat().replace("+00:00", "Z")
    return SuccessResponse(data=result, usage=usage.__dict__)


@router.post("/scan/batch", response_model=SuccessResponse)
async def batch_scan(
    req: BatchScanRequest,
    api_key: ApiKeyInfo = Depends(require_api_key),
    rl: RedisRateLimiter = Depends(get_rate_limiter),
    cache: Cache = Depends(get_cache),
    scanner: ScannerService = Depends(get_scanner),
):
    depth = req.depth.value
    effective_tier = (getattr(req, "tier", None) or api_key.tier or "FREE").upper()
    results = []

    # Charge 1 call per address.
    usage = await rl.consume(api_key_id=api_key.api_key_id, tier=api_key.tier, cost=len(req.addresses))

    for addr in req.addresses:
        cache_key = f"scan:{req.chain}:{addr}:{depth}:{effective_tier}"
        if not req.force_refresh:
            cached = await cache.get_json(cache_key)
            if cached:
                value, cached_at = cached
                value["cached"] = True
                value["cached_at"] = cached_at.isoformat().replace("+00:00", "Z")
                results.append(value)
                continue

        res = await scanner.scan(address=addr, chain=req.chain, depth=depth, tier=effective_tier)
        cached_at = await cache.set_json(cache_key, res, ttl_s=_ttl_for_depth(depth))
        res["cached"] = False
        res["cached_at"] = cached_at.isoformat().replace("+00:00", "Z")
        results.append(res)

    return SuccessResponse(data=results, usage=usage.__dict__)
