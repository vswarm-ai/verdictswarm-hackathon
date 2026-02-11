"""Metrics API — consumed by SRE/monitoring agents.

Endpoints:
  GET /api/metrics/snapshot?key=... — Full daily metrics
  GET /api/metrics/hourly?key=...   — Hourly scan breakdown
  GET /api/metrics/health           — Public health check (no auth)
"""

import os
from fastapi import APIRouter, Depends, Query, HTTPException
from ..deps import get_cache
from ..services.metrics import MetricsService

router = APIRouter(prefix="/api/metrics", tags=["metrics"])

METRICS_API_KEY = os.getenv("METRICS_API_KEY", "")


def _check_auth(key: str = Query(..., alias="key")):
    """Validate API key for protected endpoints."""
    if not METRICS_API_KEY:
        raise HTTPException(status_code=503, detail="Metrics API key not configured")
    if key != METRICS_API_KEY:
        raise HTTPException(status_code=403, detail="Invalid API key")


@router.get("/snapshot")
async def snapshot(
    date: str = None,
    cache=Depends(get_cache),
    _auth=Depends(_check_auth),
):
    """Full metrics snapshot for a date (default: today UTC)."""
    svc = MetricsService(cache.r)
    return await svc.get_snapshot(date)


@router.get("/hourly")
async def hourly(
    date: str = None,
    cache=Depends(get_cache),
    _auth=Depends(_check_auth),
):
    """Hourly scan breakdown (for rate/trend detection)."""
    svc = MetricsService(cache.r)
    return await svc.get_hourly(date)


@router.get("/health")
async def health(cache=Depends(get_cache)):
    """Public health check. No auth needed. Use for UptimeRobot."""
    try:
        await cache.r.ping()
        redis_ok = True
    except Exception:
        redis_ok = False

    return {
        "status": "healthy" if redis_ok else "degraded",
        "redis": redis_ok,
        "service": "verdictswarm-api",
    }
