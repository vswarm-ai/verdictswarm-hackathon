"""Agent prompt registry — loads from Redis (hot-reloadable), env vars, or defaults.

Prompts are the core IP. Priority order:
1. Redis (key: prompt:{name}) — hot-reloadable, no redeploy needed
2. Environment variable (PROMPT_{NAME}) — set in Railway
3. Generic fallback — works but is NOT optimized

Update prompts via: POST /api/admin/prompts (API-key protected)
"""

from __future__ import annotations

import os
from typing import Optional

# Redis client — set at app startup by init_prompt_store()
_redis_client = None

# In-memory cache to avoid hitting Redis on every scan
_cache: dict[str, str] = {}


def init_prompt_store(redis_client) -> None:
    """Call once at app startup to enable Redis-backed prompts."""
    global _redis_client
    _redis_client = redis_client


async def set_prompt(key: str, value: str) -> None:
    """Write a prompt to Redis (hot-reload, no redeploy)."""
    written = False
    if _redis_client:
        try:
            await _redis_client.set(f"prompt:{key}", value)
            written = True
        except Exception as e:
            print(f"[WARN] Redis set failed for prompt:{key}: {e}")
    if not written:
        # Fallback: try direct Redis connection
        try:
            import redis.asyncio as aioredis
            url = os.environ.get("REDIS_URL", "")
            if url:
                r = aioredis.from_url(url, decode_responses=True)
                await r.set(f"prompt:{key}", value)
                await r.aclose()
                written = True
        except Exception as e:
            print(f"[WARN] Direct Redis set also failed for prompt:{key}: {e}")
    _cache[key] = value


async def get_all_prompts() -> dict[str, str]:
    """Return all prompt keys and values from Redis."""
    result = {}
    client = _redis_client
    if not client:
        # Fallback: try direct connection
        try:
            import redis.asyncio as aioredis
            url = os.environ.get("REDIS_URL", "")
            if url:
                client = aioredis.from_url(url, decode_responses=True)
        except Exception:
            pass
    if client:
        try:
            keys = await client.keys("prompt:*")
            for k in keys:
                name = k.decode() if isinstance(k, bytes) else k
                name = name.replace("prompt:", "", 1)
                val = await client.get(f"prompt:{name}")
                if val:
                    result[name] = val.decode() if isinstance(val, bytes) else val
        except Exception as e:
            print(f"[WARN] get_all_prompts failed: {e}")
    # Also include in-memory cache
    for k, v in _cache.items():
        if k not in result:
            result[k] = v
    return result


def _get(key: str, default: str) -> str:
    """Resolve prompt: cache → Redis → env → default."""
    # 1. In-memory cache (populated from Redis on first access)
    if key in _cache:
        return _cache[key]

    # 2. Try Redis synchronously via cache (async load happens at startup)
    # Skip here — async Redis needs await. We pre-load at startup instead.

    # 3. Environment variable
    env_val = os.environ.get(f"PROMPT_{key}", "")
    if env_val:
        _cache[key] = env_val
        return env_val

    # 4. Generic fallback
    return default


async def load_from_redis() -> None:
    """Pre-load all prompts from Redis into memory cache. Call at app startup."""
    if not _redis_client:
        return
    keys = await _redis_client.keys("prompt:*")
    for k in keys:
        name = k.decode() if isinstance(k, bytes) else k
        name = name.replace("prompt:", "", 1)
        val = await _redis_client.get(f"prompt:{name}")
        if val:
            _cache[name] = val.decode() if isinstance(val, bytes) else val


async def seed_redis_from_env():
    import os, redis.asyncio as aioredis
    r = aioredis.from_url(os.getenv("REDIS_URL", "redis://localhost:6379"))
    for key, val in os.environ.items():
        if key.startswith("PROMPT_") and val:
            redis_key = f"prompt:{key.lower()}"
            if not await r.exists(redis_key):
                await r.set(redis_key, val)
    await r.aclose()


# ---------------------------------------------------------------------------
# Prompt accessors — agents import these
# ---------------------------------------------------------------------------

class _LazyPrompt:
    """Descriptor that resolves prompt value on first access."""
    def __init__(self, key: str, default: str):
        self._key = key
        self._default = default

    def __str__(self) -> str:
        return _get(self._key, self._default)

    def __bool__(self) -> bool:
        val = _get(self._key, self._default)
        return bool(val) and val != self._default

    def __add__(self, other: str) -> str:
        return str(self) + other

    def __radd__(self, other: str) -> str:
        return other + str(self)


# System prompts
TECHNICIAN_SYSTEM = _LazyPrompt(
    "TECHNICIAN_SYSTEM",
    "You are a crypto on-chain analyst. Be concrete and conservative. "
    "Output MUST be valid JSON only (no markdown).",
)

TECHNICIAN_USER_TEMPLATE = _LazyPrompt("TECHNICIAN_USER", "")

SECURITY_SYSTEM = _LazyPrompt(
    "SECURITY_SYSTEM",
    "You are a smart-contract security auditor. Be conservative and assume unknowns are risks. "
    "Output MUST be valid JSON only (no markdown).",
)

SECURITY_USER_TEMPLATE = _LazyPrompt("SECURITY_USER", "")

TOKENOMICS_SYSTEM = _LazyPrompt(
    "TOKENOMICS_SYSTEM",
    "You are a crypto tokenomics analyst. Be skeptical about insider allocation. "
    "Output MUST be valid JSON only (no markdown).",
)

TOKENOMICS_USER_TEMPLATE = _LazyPrompt("TOKENOMICS_USER", "")

SOCIAL_SYSTEM = _LazyPrompt(
    "SOCIAL_SYSTEM",
    "You are a social intelligence analyst for crypto assets. "
    "Output MUST be valid JSON only (no markdown).",
)

SOCIAL_USER_TEMPLATE = _LazyPrompt("SOCIAL_USER", "")

MACRO_SYSTEM = _LazyPrompt(
    "MACRO_SYSTEM",
    "You are a macro strategist for crypto markets. "
    "Output MUST be valid JSON only (no markdown).",
)

MACRO_USER_TEMPLATE = _LazyPrompt("MACRO_USER", "")

DEVILS_ADVOCATE_SYSTEM = _LazyPrompt(
    "DA_SYSTEM",
    "You are a skeptical crypto due-diligence analyst. Look for what others miss. "
    "Output MUST be valid JSON only (no markdown).",
)

DEVILS_ADVOCATE_USER_TEMPLATE = _LazyPrompt("DA_USER", "")
