from __future__ import annotations

# Ensure workspace root is on sys.path so we can import `projects.verdictswarm.src.*`
import os
import sys
from datetime import datetime, timezone
from typing import Any, Dict

_THIS_DIR = os.path.dirname(os.path.abspath(__file__))
_WORKSPACE_ROOT = os.path.abspath(os.path.join(_THIS_DIR, "..", "..", ".."))
if _WORKSPACE_ROOT not in sys.path:
    sys.path.insert(0, _WORKSPACE_ROOT)

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import get_settings
from .models.responses import ErrorResponse
from .routers import admin, auth, b2a, metrics, pdf, scan, share, stream_scan, usage
from .middleware.security import SecurityMiddleware
from .services.rate_limiter import RateLimitExceeded


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="VerdictSwarm B2A API",
        version="2.0.0",
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
    )

    # Security middleware (request size limits, blocked paths)
    app.add_middleware(SecurityMiddleware)

    # CORS — restricted to known origins
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "https://verdictswarm.io",
            "https://www.verdictswarm.io",
            "http://localhost:3000",
            "http://localhost:3001",
        ],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.exception_handler(RateLimitExceeded)
    async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
        payload = ErrorResponse(
            error={
                "code": "RATE_LIMITED",
                "message": "Rate limit exceeded",
                "retry_after": exc.retry_after_s,
            }
        ).model_dump()
        headers = {"Retry-After": str(exc.retry_after_s)}
        return JSONResponse(status_code=429, content=payload, headers=headers)

    @app.exception_handler(Exception)
    async def unhandled_handler(request: Request, exc: Exception):
        payload = ErrorResponse(
            error={
                "code": "INTERNAL_ERROR",
                "message": "Internal server error",
            }
        ).model_dump()
        return JSONResponse(status_code=500, content=payload)

    app.include_router(auth.router)
    app.include_router(scan.router)
    app.include_router(stream_scan.router)
    app.include_router(usage.router)
    app.include_router(b2a.router)
    app.include_router(pdf.router)
    app.include_router(share.router)
    app.include_router(metrics.router)
    app.include_router(admin.router)

    @app.on_event("startup")
    async def _startup():
        """Load prompts from Redis into memory cache at startup."""
        try:
            from src.agents.prompts import init_prompt_store, load_from_redis, seed_redis_from_env
            import redis.asyncio as _redis
            from .config import get_settings
            _settings = get_settings()
            r = _redis.from_url(_settings.redis_url, decode_responses=False)
            init_prompt_store(r)
            await seed_redis_from_env()
            await load_from_redis()
            print("[INFO] Prompts loaded from Redis")
        except Exception as e:
            print(f"[WARN] Failed to load prompts from Redis: {e}")

    @app.get("/health")
    async def health() -> Dict[str, Any]:
        return {
            "ok": True,
            "service": "verdictswarm-b2a-api",
            "time": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "env": settings.env,
        }

    return app


app = create_app()
