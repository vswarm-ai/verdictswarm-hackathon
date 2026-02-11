from __future__ import annotations

from enum import Enum
from typing import List

from pydantic import BaseModel, Field


class ScanDepth(str, Enum):
    basic = "basic"
    standard = "standard"
    full = "full"
    debate = "debate"


class DeepScanRequest(BaseModel):
    address: str = Field(..., description="Token contract address")
    chain: str = Field(default="base", description="Chain name (base/eth/arbitrum/optimism/polygon/bsc/avalanche)")
    depth: ScanDepth = Field(default=ScanDepth.full)
    # Tier used to determine which bots run. Defaults to FREE for public/demo use.
    # Authenticated API calls may override this with the API key's tier.
    tier: str = Field(default="FREE", description="Access tier (FREE/TIER_1/TIER_2/TIER_3/SWARM_DEBATE)")
    force_refresh: bool = Field(default=False)


class BatchScanRequest(BaseModel):
    addresses: List[str] = Field(..., min_length=1, max_length=100)
    chain: str = Field(default="base")
    depth: ScanDepth = Field(default=ScanDepth.basic)
    tier: str = Field(default="FREE", description="Access tier (FREE/TIER_1/TIER_2/TIER_3/SWARM_DEBATE)")
    force_refresh: bool = Field(default=False)
