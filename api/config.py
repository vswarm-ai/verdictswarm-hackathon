from __future__ import annotations

from functools import lru_cache
from typing import Dict, Optional

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    env: str = Field(default="dev", alias="ENV")
    log_level: str = Field(default="info", alias="LOG_LEVEL")

    redis_url: str = Field(default="redis://localhost:6379/0", alias="REDIS_URL")

    # Static API keys: "tier:key" or just "key" (defaults to agent)
    vs_api_keys: Optional[str] = Field(default=None, alias="VS_API_KEYS")

    # Signed API keys
    api_keys_secret: Optional[str] = Field(default=None, alias="API_KEYS_SECRET")

    # Calls/day
    vs_tier_limit_agent: int = Field(default=1000, alias="VS_TIER_LIMIT_AGENT")
    vs_tier_limit_pro: int = Field(default=10000, alias="VS_TIER_LIMIT_PRO")
    vs_tier_limit_enterprise: int = Field(default=100000, alias="VS_TIER_LIMIT_ENTERPRISE")

    def tier_limits(self) -> Dict[str, int]:
        return {
            "agent": int(self.vs_tier_limit_agent),
            "pro": int(self.vs_tier_limit_pro),
            "enterprise": int(self.vs_tier_limit_enterprise),
        }


@lru_cache
def get_settings() -> Settings:
    return Settings()
