"""Tier feature matrix for VerdictSwarm.

This is a single source of truth for what each tier can do.
Stdlib-only.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import FrozenSet, Set

from .tiers import TierLevel


# NOTE: Bot names here are string identifiers (usually the class.name values).
# This avoids import cycles and keeps tiering decoupled from implementation.


@dataclass(frozen=True)
class TierFeatures:
    allowed_bots: FrozenSet[str]
    output_formats: FrozenSet[str]
    daily_limit: int  # -1 for unlimited
    api_access: bool = False
    realtime_monitoring: bool = False
    webhooks: bool = False
    swarm_debate: bool = False
    priority_queue: bool = False


FEATURES_BY_TIER = {
    TierLevel.FREE: TierFeatures(
        # Free tier gets 2 core bots so users see real AI analysis.
        allowed_bots=frozenset({"TechnicianBot", "SecurityBot"}),
        output_formats=frozenset({"text"}),
        daily_limit=3,  # 3 scans/day per IP
        api_access=False,
        realtime_monitoring=False,
        webhooks=False,
        swarm_debate=False,
        priority_queue=False,
    ),
    TierLevel.TIER_1: TierFeatures(
        # Investigator: 6 visible AI agents (+ ScamBot behind the scenes)
        allowed_bots=frozenset(
            {
                "TechnicianBot",
                "SecurityBot",
                "TokenomicsBot",
                "SocialBot",
                "MacroBot",
                "DevilsAdvocate",
                "ScamBot",
            }
        ),
        output_formats=frozenset({"text", "markdown"}),
        daily_limit=15,  # 15 scans/day per wallet
        api_access=False,
    ),
    TierLevel.TIER_2: TierFeatures(
        # Required matrix:
        #   TIER_2: + MacroBot, DevilsAdvocate, VisionBot
        allowed_bots=frozenset(
            {
                "TechnicianBot",
                "SecurityBot",
                "TokenomicsBot",
                "SocialBot",
                "MacroBot",
                "DevilsAdvocate",
                "VisionBot",
                "ScamBot",
            }
        ),
        output_formats=frozenset({"text", "markdown", "json"}),
        daily_limit=30,  # 30 scans/day per wallet
        api_access=True,
    ),
    TierLevel.TIER_3: TierFeatures(
        # Same bots as TIER_2; model routing differences (e.g., Grok 4) are handled elsewhere.
        allowed_bots=frozenset(
            {
                "TechnicianBot",
                "SecurityBot",
                "TokenomicsBot",
                "SocialBot",
                "MacroBot",
                "DevilsAdvocate",
                "VisionBot",
                "ScamBot",
            }
        ),
        output_formats=frozenset({"text", "markdown", "json"}),
        daily_limit=50,  # 50 scans/day per wallet
        api_access=True,
        realtime_monitoring=True,
        webhooks=True,
        priority_queue=True,
    ),
    TierLevel.SWARM_DEBATE: TierFeatures(
        # All bots + debate capability.
        allowed_bots=frozenset(
            {
                "TechnicianBot",
                "SecurityBot",
                "TokenomicsBot",
                "SocialBot",
                "MacroBot",
                "DevilsAdvocate",
                "VisionBot",
                "ScamBot",
                "SwarmDebate",  # reserved capability
            }
        ),
        output_formats=frozenset({"text", "markdown", "json"}),
        # BUSINESS_MODEL.md: 5/day included + burn-per-extra debate
        daily_limit=5,
        api_access=True,
        realtime_monitoring=True,
        webhooks=True,
        swarm_debate=True,
        priority_queue=True,
    ),
}


def allowed_bots_for_tier(tier: TierLevel) -> Set[str]:
    return set(FEATURES_BY_TIER.get(tier, FEATURES_BY_TIER[TierLevel.FREE]).allowed_bots)


def can_use_swarm_debate(tier: TierLevel) -> bool:
    return bool(FEATURES_BY_TIER.get(tier, FEATURES_BY_TIER[TierLevel.FREE]).swarm_debate)


def get_rate_limit(tier: TierLevel) -> int:
    """Return daily rate limit; -1 means unlimited."""

    return int(FEATURES_BY_TIER.get(tier, FEATURES_BY_TIER[TierLevel.FREE]).daily_limit)
