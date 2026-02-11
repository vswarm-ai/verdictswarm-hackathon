"""Staking + revenue share stubs (future on-chain integration).

BUSINESS_MODEL.md revenue distribution:
- 50% -> Staking Rewards Pool
- 30% -> Treasury/Buybacks
- 15% -> Development Fund
- 5%  -> Direct Burn

This module is a placeholder for contract integration.

Planned integration points:
- Read staked balances per wallet from a staking contract
- Distribute rewards from protocol revenue to stakers
- Execute buyback+burn via treasury governance

IMPORTANT: This repo currently does NOT perform any on-chain transactions.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict


# Revenue allocation per VERDICTSWARM_SPEC.md (Phase 2):
#   60% burn, 30% treasury, 10% liquidity
# Below is the FUTURE staking model (not yet implemented):
REVENUE_SPLIT = {
    "burn": 0.60,
    "treasury": 0.30,
    "liquidity": 0.10,
}


@dataclass(frozen=True)
class StakingRewards:
    wallet: str
    pending_rewards: float
    notes: str = "stub"


def get_staking_rewards(wallet: str) -> StakingRewards:
    """Placeholder: return pending staking rewards for a wallet.

    Future: query staking contract/indexer.
    """

    return StakingRewards(wallet=(wallet or "").strip().lower(), pending_rewards=0.0, notes="not implemented")


def calculate_revenue_share(total_revenue: float) -> Dict[str, float]:
    """Split revenue per BUSINESS_MODEL.md.

    Args:
        total_revenue: total revenue amount in USD (or other unit) for a period.

    Returns:
        dict with keys matching REVENUE_SPLIT.
    """

    tr = float(total_revenue or 0.0)
    return {k: tr * v for k, v in REVENUE_SPLIT.items()}


__all__ = ["get_staking_rewards", "calculate_revenue_share", "REVENUE_SPLIT", "StakingRewards"]
