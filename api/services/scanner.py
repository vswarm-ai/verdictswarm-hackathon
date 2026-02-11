from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import anyio

# Import from ../src (relative to repo root)
from src.agents import (
    DevilsAdvocate,
    MacroBot,
    SecurityBot,
    SocialBot,
    TechnicianBot,
    TokenomicsBot,
)
from src.data_fetcher import DataFetcher, TokenData, is_solana_address
from src.scoring_engine import AgentVerdict, ScoringEngine
from src.tier_config import allowed_bots_for_tier
from src.free_tier import free_tier_scan
from src.tiers import TierLevel


def _risk_level(score_0_to_10: float) -> str:
    # Higher score => safer. Convert to risk.
    if score_0_to_10 >= 8.0:
        return "LOW"
    if score_0_to_10 >= 6.0:
        return "MEDIUM"
    if score_0_to_10 >= 4.0:
        return "HIGH"
    return "CRITICAL"


def _tier_from_str(tier: str | None) -> TierLevel:
    t = (tier or "FREE").strip().upper()
    if t in {"TIER_1", "INVESTIGATOR"}:
        return TierLevel.TIER_1
    if t in {"TIER_2", "VIGILANTE", "PROSECUTOR"}:
        return TierLevel.TIER_2
    if t in {"TIER_3", "WHALE", "GRAND_JURY"}:
        return TierLevel.TIER_3
    if t in {"SWARM_DEBATE", "CONSENSUS"}:
        return TierLevel.SWARM_DEBATE
    return TierLevel.FREE


class ScannerService:
    def __init__(self) -> None:
        self.fetcher = DataFetcher()
        self.engine = ScoringEngine()

    async def _fetch_token_data(self, address: str, chain: str) -> TokenData:
        # Auto-detect Solana vs EVM
        chain_lower = (chain or "base").lower().strip()
        if chain_lower == "solana" or is_solana_address(address):
            return await anyio.to_thread.run_sync(self.fetcher.fetch_solana_token_data, address)
        return await anyio.to_thread.run_sync(self.fetcher.fetch, address, chain)

    async def _run_bots(
        self,
        token_data: TokenData,
        *,
        include_devil: bool = True,
        allowed: Optional[set[str]] = None,
    ) -> Dict[str, AgentVerdict]:
        bots = [TechnicianBot, SecurityBot, TokenomicsBot, SocialBot, MacroBot]
        if include_devil:
            bots.append(DevilsAdvocate)

        if allowed is not None:
            bots = [b for b in bots if b().name in allowed]

        async def run_one(bot_cls):
            bot = bot_cls(model_overrides=None)
            return bot.name, await anyio.to_thread.run_sync(bot.analyze, token_data)

        # Run all bots in parallel
        results = await asyncio.gather(*[run_one(bc) for bc in bots])
        return {name: verdict for name, verdict in results}
    @staticmethod
    def _flags_from_data(token_data: TokenData) -> List[str]:
        flags: List[str] = []
        if token_data.top10_holders_pct and token_data.top10_holders_pct >= 60:
            flags.append("high_holder_concentration")
        if token_data.contract_age_days and token_data.contract_age_days <= 3:
            flags.append("very_new_contract")
        if token_data.liquidity_usd and token_data.liquidity_usd < 5000:
            flags.append("low_liquidity")
        return flags

    async def scan(self, *, address: str, chain: str, depth: str, tier: str = "FREE") -> Dict[str, Any]:
        # depth currently affects which signals/bots are included. MVP:
        # - basic: score from core bots only
        # - full/debate: include devils advocate + scambot raw output
        # tier affects *which bots are allowed to run at all*.
        depth_l = (depth or "basic").lower()

        tier_level = _tier_from_str(tier)
        allowed = allowed_bots_for_tier(tier_level)

        include_devil = depth_l in {"full", "debate", "standard"} and "DevilsAdvocate" in allowed
        include_scam = False

        # FREE tier runs legitimacy scan only (no AI, no numeric score).
        if tier_level == TierLevel.FREE:
            # Fetch data in thread to avoid blocking event loop
            token_data = await self._fetch_token_data(address, chain)
            ft = free_tier_scan(address, chain, fetcher=self.fetcher, token_data=token_data)
            scanned_at = datetime.now(timezone.utc)
            return {
                "address": address,
                "chain": chain,
                "depth": depth_l,
                "tier": tier_level.value,
                "free_tier_result": {
                    "verdict": ft.verdict,
                    "reason": ft.reason,
                    "label": ft.label,
                    "checks": ft.checks or {},
                },
                "locked_bots": [
                    "TechnicianBot",
                    "SecurityBot",
                    "TokenomicsBot",
                    "SocialBot",
                    "MacroBot",
                    "DevilsAdvocate",
                    "VisionBot",
                ],
                "scanned_at": scanned_at.isoformat().replace("+00:00", "Z"),
            }


        token_data = await self._fetch_token_data(address, chain)

        verdicts_task = (
            asyncio.create_task(self._run_bots(token_data, include_devil=include_devil, allowed=allowed))
            if any(b in allowed for b in {"TechnicianBot", "SecurityBot", "TokenomicsBot", "SocialBot", "MacroBot", "DevilsAdvocate"})
            else asyncio.create_task(asyncio.sleep(0, result={}))
        )
        scam_task = None

        verdicts = await verdicts_task
        scam = None

        # Filter verdicts defensively in case upstream bot lists change.
        verdicts = {k: v for k, v in verdicts.items() if k in allowed}

        result = self.engine.score(verdicts)

        analysis: Dict[str, Dict[str, Any]] = {
            "technical": {
                "score": float(result.category_scores.get("Technical", 0.0)),
                "summary": (verdicts.get("TechnicianBot").reasoning if verdicts.get("TechnicianBot") else ""),
            },
            "security": {
                "score": float(result.category_scores.get("Safety", 0.0)),
                "summary": (verdicts.get("SecurityBot").reasoning if verdicts.get("SecurityBot") else ""),
            },
            "tokenomics": {
                "score": float(result.category_scores.get("Tokenomics", 0.0)),
                "summary": (verdicts.get("TokenomicsBot").reasoning if verdicts.get("TokenomicsBot") else ""),
            },
            "social": {
                "score": float(result.category_scores.get("Social", 0.0)),
                "summary": (verdicts.get("SocialBot").reasoning if verdicts.get("SocialBot") else ""),
            },
            "macro": {
                "score": float(result.category_scores.get("Macro", 0.0)),
                "summary": (verdicts.get("MacroBot").reasoning if verdicts.get("MacroBot") else ""),
            },
        }

        bots_out: Dict[str, Any] = {
            name: {
                "score": float(v.score),
                "sentiment": v.sentiment,
                "category": v.category or self.engine.agent_category(name),
                "reasoning": v.reasoning,
            }
            for name, v in verdicts.items()
        }
        scanned_at = datetime.now(timezone.utc)
        flags = self._flags_from_data(token_data)

        return {
            "address": token_data.contract_address,
            "chain": chain,
            "depth": depth_l,
            "tier": tier_level.value,
            "score": float(result.final_score),
            "risk_level": _risk_level(float(result.final_score)),
            "flags": flags,
            "analysis": analysis,
            "bots": bots_out,
            "scanned_at": scanned_at.isoformat().replace("+00:00", "Z"),
        }
