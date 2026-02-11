"""Admin endpoints — API-key protected management tools."""

from __future__ import annotations

import os
from typing import Any, Dict

from fastapi import APIRouter, Header, HTTPException, Request
from pydantic import BaseModel

from src.agents.prompts import get_all_prompts, load_from_redis, set_prompt

router = APIRouter(tags=["admin"])

ADMIN_API_KEY = os.environ.get("METRICS_API_KEY", "")  # reuse existing key


def _check_key(key: str | None) -> None:
    if not ADMIN_API_KEY or key != ADMIN_API_KEY:
        raise HTTPException(status_code=403, detail="Invalid API key")


class PromptUpdate(BaseModel):
    key: str  # e.g. "TECHNICIAN_SYSTEM"
    value: str


class BulkPromptUpdate(BaseModel):
    prompts: Dict[str, str]  # key → value


@router.get("/api/admin/prompts")
async def list_prompts(x_api_key: str | None = Header(default=None)):
    """List all stored prompts (keys + first 80 chars of value)."""
    _check_key(x_api_key)
    all_prompts = await get_all_prompts()
    return {
        "count": len(all_prompts),
        "prompts": {k: v[:80] + "..." if len(v) > 80 else v for k, v in all_prompts.items()},
    }


@router.post("/api/admin/prompts")
async def update_prompt(body: PromptUpdate, x_api_key: str | None = Header(default=None)):
    """Update a single prompt. Takes effect immediately (no redeploy)."""
    _check_key(x_api_key)
    await set_prompt(body.key, body.value)
    return {"status": "ok", "key": body.key, "length": len(body.value)}


@router.post("/api/admin/prompts/bulk")
async def bulk_update_prompts(body: BulkPromptUpdate, x_api_key: str | None = Header(default=None)):
    """Update multiple prompts at once."""
    _check_key(x_api_key)
    for key, value in body.prompts.items():
        await set_prompt(key, value)
    return {"status": "ok", "updated": len(body.prompts), "keys": list(body.prompts.keys())}


@router.post("/api/admin/cache/flush")
async def flush_scan_cache(request: Request, x_api_key: str | None = Header(default=None)):
    """Flush all cached scan results. Use after bug fixes that affect scoring."""
    _check_key(x_api_key)
    import redis
    redis_url = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
    try:
        r = redis.Redis.from_url(redis_url, decode_responses=True)
        # Delete everything except prompt: keys (preserves custom prompts)
        deleted = 0
        for key in r.scan_iter(match="*", count=200):
            if not key.startswith("prompt:"):
                r.delete(key)
                deleted += 1
        return {"status": "ok", "deleted": deleted}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@router.get("/api/admin/redis/keys")
async def list_redis_keys(x_api_key: str | None = Header(default=None)):
    """List all Redis keys (admin debug)."""
    _check_key(x_api_key)
    import redis
    redis_url = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
    try:
        r = redis.Redis.from_url(redis_url, decode_responses=True)
        keys = []
        for key in r.scan_iter(match="*", count=500):
            keys.append(key)
            if len(keys) >= 200:
                break
        return {"status": "ok", "count": len(keys), "keys": keys}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@router.post("/api/admin/prompts/reload")
async def reload_prompts(x_api_key: str | None = Header(default=None)):
    """Reload all prompts from Redis into memory cache."""
    _check_key(x_api_key)
    await load_from_redis()
    all_prompts = await get_all_prompts()
    return {"status": "ok", "loaded": len(all_prompts)}
