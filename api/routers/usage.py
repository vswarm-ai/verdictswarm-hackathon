from __future__ import annotations

from fastapi import APIRouter, Depends

from ..deps import get_rate_limiter
from ..middleware.auth import ApiKeyInfo, require_api_key
from ..models.responses import SuccessResponse, UsageBody
from ..services.rate_limiter import RedisRateLimiter


router = APIRouter(prefix="/v1", tags=["usage"])


@router.get("/usage", response_model=SuccessResponse)
async def usage(
    api_key: ApiKeyInfo = Depends(require_api_key),
    rl: RedisRateLimiter = Depends(get_rate_limiter),
):
    u = await rl.get_usage(api_key_id=api_key.api_key_id, tier=api_key.tier)
    return SuccessResponse(data=UsageBody(**u.__dict__), usage=UsageBody(**u.__dict__))
