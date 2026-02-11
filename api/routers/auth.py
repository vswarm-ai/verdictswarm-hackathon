from __future__ import annotations

from fastapi import APIRouter, Depends

from ..middleware.auth import ApiKeyInfo, require_api_key
from ..models.responses import AuthVerifyData, SuccessResponse
from ..services.rate_limiter import RedisRateLimiter
from ..deps import get_rate_limiter


router = APIRouter(prefix="/v1/auth", tags=["auth"])


@router.post("/verify", response_model=SuccessResponse)
async def verify(
    api_key: ApiKeyInfo = Depends(require_api_key),
    rl: RedisRateLimiter = Depends(get_rate_limiter),
):
    usage = await rl.get_usage(api_key_id=api_key.api_key_id, tier=api_key.tier)
    data = AuthVerifyData(valid=True, tier=api_key.tier, calls_remaining=usage.calls_remaining)
    return SuccessResponse(data=data, usage={"calls_today": usage.calls_today, "calls_limit": usage.calls_limit, "calls_remaining": usage.calls_remaining, "reset_at": usage.reset_at})
