"""Model routing for VerdictSwarm tiers.

This module maps a user's TierLevel to provider/model selections for each bot.

Return shape (dict for flexibility):

{
  "security": ("anthropic", "claude-opus-4-5"),
  "social": ("xai", "grok-4"),
  "technical": ("openai", "gpt-5"),
  "tokenomics": ("gemini", "gemini-2.5-pro"),
  "macro": ("moonshot", "kimi-k2.5"),
  "devils_advocate": ("anthropic", "claude-opus-4-5"),
  "swarm_debate": ["gemini", "kimi", "grok", "codex"],
}

Notes:
- Normal (non-debate) bots use :class:`~agents.ai_client.AIClient` and will be
  given a (provider, model) tuple from this router.
- Swarm Debate mode uses the external `model-debate` tool, which currently
  accepts model *aliases* ("gemini", "kimi", "grok", "codex").

Design goals:
- stdlib-only
- explicit, easy to override (env vars / future on-chain governance)
"""

from __future__ import annotations

import os
from typing import Dict, List, Optional, Tuple

from .tiers import TierLevel


ProviderModel = Tuple[str, str]


def _env(key: str, default: str) -> str:
    return (os.getenv(key) or default).strip()


def get_models_for_tier(tier: TierLevel) -> Dict[str, object]:
    """Return provider/model routing for a tier."""

    # Optional env overrides (handy for rollouts / emergency swaps)
    opus = _env("VSWARM_ANTHROPIC_OPUS_MODEL", "claude-opus-4-5")
    sonnet = _env("VSWARM_ANTHROPIC_SONNET_MODEL", "claude-sonnet-4-5")
    haiku = _env("VSWARM_ANTHROPIC_HAIKU_MODEL", "claude-3-haiku-20240307")

    grok3 = _env("VSWARM_XAI_GROK3_MODEL", "grok-3")
    grok4 = _env("VSWARM_XAI_GROK4_MODEL", "grok-4")

    gpt5 = _env("VSWARM_OPENAI_GPT5_MODEL", "gpt-5")
    gpt45 = _env("VSWARM_OPENAI_GPT45_MODEL", "gpt-4.5")
    gpt4omini = _env("VSWARM_OPENAI_GPT4OMINI_MODEL", "gpt-4o-mini")

    gemini_pro = _env("VSWARM_GEMINI_PRO_MODEL", "gemini-2.5-pro")
    gemini_flash = _env("VSWARM_GEMINI_FLASH_MODEL", "gemini-2.5-flash")

    kimi = _env("VSWARM_MOONSHOT_KIMI_MODEL", "kimi-k2.5")

    if tier == TierLevel.FREE:
        return {
            "security": None,
            "social": None,
            "technical": None,
            "tokenomics": None,
            "macro": None,
            "devils_advocate": None,
            "swarm_debate": None,
        }

    if tier == TierLevel.TIER_1:
        return {
            "security": ("anthropic", haiku),
            "social": ("xai", grok3),
            "technical": ("openai", gpt4omini),
            "tokenomics": ("gemini", gemini_flash),
            "macro": ("gemini", gemini_flash),
            "devils_advocate": ("gemini", gemini_pro),  # DA needs to be smartest agent
            "swarm_debate": None,
        }

    if tier == TierLevel.TIER_2:
        return {
            "security": ("gemini", gemini_flash),
            "social": ("xai", grok4),
            "technical": ("gemini", gemini_pro),
            "tokenomics": ("gemini", gemini_pro),
            "macro": ("gemini", gemini_flash),
            "devils_advocate": ("xai", grok3),  # DA should be smartest — Grok has real-time X data
            "swarm_debate": None,
        }

    if tier == TierLevel.TIER_3:
        return {
            "security": ("anthropic", opus),
            "social": ("xai", grok4),
            "technical": ("openai", gpt5),
            "tokenomics": ("gemini", gemini_pro),
            "macro": ("moonshot", kimi),
            "devils_advocate": ("anthropic", opus),
            "swarm_debate": None,
        }

    if tier == TierLevel.SWARM_DEBATE:
        # Consensus tier: use all flagship providers in the debate tool.
        # NOTE: The debate tool currently takes aliases, not (provider, model) tuples.
        return {
            "security": ("anthropic", opus),
            "social": ("xai", grok4),
            "technical": ("openai", gpt5),
            "tokenomics": ("gemini", gemini_pro),
            "macro": ("moonshot", kimi),
            "devils_advocate": ("anthropic", opus),
            "swarm_debate": ["gemini", "grok", "kimi", "codex"],
        }

    # Fallback
    return {
        "security": ("anthropic", haiku),
        "social": ("xai", grok3),
        "technical": ("openai", gpt4omini),
        "tokenomics": ("gemini", gemini_flash),
        "macro": None,
        "devils_advocate": None,
        "swarm_debate": None,
    }


__all__ = ["get_models_for_tier", "ProviderModel"]
