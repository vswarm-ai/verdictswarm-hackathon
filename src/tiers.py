"""Tier primitives for VerdictSwarm.

This module is intentionally stdlib-only.

Tiers are driven by a token balance (integer token units).
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum


class TierLevel(str, Enum):
    """Supported access tiers."""

    FREE = "free"
    TIER_1 = "tier_1"
    TIER_2 = "tier_2"
    TIER_3 = "tier_3"
    SWARM_DEBATE = "swarm_debate"


@dataclass(frozen=True)
class TierThresholds:
    """Token thresholds that unlock tiers."""

    tier_1: int = 50_000
    tier_2: int = 150_000
    tier_3: int = 500_000
    swarm_debate: int = 1_000_000


DEFAULT_THRESHOLDS = TierThresholds()


def tier_from_balance(balance: int, thresholds: TierThresholds = DEFAULT_THRESHOLDS) -> TierLevel:
    """Return the tier corresponding to a token balance."""

    b = int(balance or 0)
    if b >= thresholds.swarm_debate:
        return TierLevel.SWARM_DEBATE
    if b >= thresholds.tier_3:
        return TierLevel.TIER_3
    if b >= thresholds.tier_2:
        return TierLevel.TIER_2
    if b >= thresholds.tier_1:
        return TierLevel.TIER_1
    return TierLevel.FREE


def tier_name(tier: TierLevel) -> str:
    """Human-friendly tier name."""

    if tier == TierLevel.FREE:
        return "Free"
    if tier == TierLevel.TIER_1:
        return "Investigator"
    if tier == TierLevel.TIER_2:
        return "Prosecutor"
    if tier == TierLevel.TIER_3:
        return "Grand Jury"
    if tier == TierLevel.SWARM_DEBATE:
        return "Consensus"
    return str(tier)


def tier_badge(tier: TierLevel) -> str:
    """Short badge used in CLI output."""

    if tier == TierLevel.FREE:
        return "[FREE]"
    if tier == TierLevel.TIER_1:
        return "[INVESTIGATOR]"
    if tier == TierLevel.TIER_2:
        return "[PROSECUTOR]"
    if tier == TierLevel.TIER_3:
        return "[GRAND JURY]"
    if tier == TierLevel.SWARM_DEBATE:
        return "[SWARM-DEBATE]"
    return f"[{tier}]"
