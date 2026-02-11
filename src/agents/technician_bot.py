"""TechnicianBot — on-chain / technical due diligence.

Heuristic MVP is preserved, but when an ``AIClient`` is available the bot will
use Gemini to interpret on-chain metrics more intelligently:
- Activity vs liquidity/market cap context
- Holder/whale concentration implications
- Contract age + verification context

Falls back to heuristics when Gemini isn't configured.
"""

from __future__ import annotations

from typing import Any, Dict, Tuple

try:
    from ..scoring_engine import AgentVerdict  # type: ignore
    from ..data_fetcher import TokenData  # type: ignore
except ImportError:  # pragma: no cover
    from scoring_engine import AgentVerdict
    from data_fetcher import TokenData

from .ai_client import AIClient
from .base_agent import BaseAgent
from .prompts import TECHNICIAN_SYSTEM, TECHNICIAN_USER_TEMPLATE


class TechnicianBot(BaseAgent):
    """Analyzes basic on-chain + contract maturity signals (AI-enhanced)."""

    @property
    def name(self) -> str:  # noqa: D401
        return "TechnicianBot"

    @property
    def category(self) -> str:  # noqa: D401
        return "Technical"

    @property
    def description(self) -> str:  # noqa: D401
        return "On-chain + contract maturity checks (GPT-4o Mini)."

    def _ai_onchain_assessment(self, token_data: TokenData) -> Dict[str, Any]:
        client = self.ai_client or AIClient()
        provider, model = self.routed_provider_model() or ("gemini", self.model_for("gemini") or "")
        if not client.has_provider(provider):
            raise RuntimeError(f"{provider} API key not set")

        # Optional extras callers may attach.
        onchain_extras = getattr(token_data, "onchain_metrics", None)
        transfers = getattr(token_data, "recent_transfers", None)

        system = str(TECHNICIAN_SYSTEM)

        # Build data lines, marking unavailable data clearly so the AI doesn't
        # penalize tokens for missing API data (e.g. Etherscan Pro-only endpoints).
        holders = int(token_data.holder_count or 0)
        top10 = float(token_data.top10_holders_pct or 0.0)
        holder_line = (
            f"Holders: {holders:,}\nTop10 holders %: {top10:.1f}"
            if holders > 0
            else "Holders: [data unavailable — do NOT penalize]\nTop10 holders %: [data unavailable]"
        )

        chain = getattr(token_data, "chain", "ethereum")
        chain_note = ""
        if chain == "solana":
            chain_note = (
                "NOTE: This is a Solana token (SPL token). Solana tokens do NOT have traditional "
                "smart contract source code like EVM tokens. Do NOT penalize for missing source code. "
                "Evaluate based on available on-chain metrics, market data, and token metadata.\n\n"
            )

        user = (
            f"Analyze the on-chain quality/activity signals for this {chain.upper()} token.\n\n"
            f"{chain_note}"
            f"Token: {token_data.name} ({token_data.symbol})\n"
            f"Chain: {chain}\n"
            f"Contract/Mint: {token_data.contract_address}\n"
            f"Verified: {bool(token_data.contract_verified)}\n"
            f"Contract age (days): {int(token_data.contract_age_days or 0)}\n"
            f"Tx count 24h: {int(token_data.tx_count_24h or 0)}\n"
            f"{holder_line}\n"
            f"Volume 24h (USD): {float(token_data.volume_24h or 0.0):,.2f}\n"
            f"Liquidity (USD): {float(token_data.liquidity_usd or 0.0):,.2f}\n"
            f"Market cap (USD): {float(token_data.mcap or 0.0):,.2f}\n"
            f"Price (USD): {float(token_data.price_usd or 0.0)}\n"
            f"Price change 24h (%): {float(token_data.price_change_24h or 0.0)}\n"
            f"Extras (if any): {onchain_extras}\n"
            f"Recent transfers sample (if any): {transfers}\n\n"
            "IMPORTANT: Fields marked '[data unavailable]' mean our API could not fetch that data. "
            "Do NOT treat unavailable data as zero or negative — simply exclude it from your analysis.\n\n"
            "Return JSON:\n"
            "{\n"
            "  score: number (0-10, higher=better on-chain health),\n"
            "  sentiment: 'bullish'|'neutral'|'bearish',\n"
            "  summary: string (2-3 sentences),\n"
            "  positives: string[] (top 4),\n"
            "  negatives: string[] (top 4),\n"
            "  anomaly_flags: string[] (only flag if evidence exists),\n"
            "  confidence: number (0-1)\n"
            "}\n"
            + (TECHNICIAN_USER_TEMPLATE if TECHNICIAN_USER_TEMPLATE else
               "Focus on interpreting transaction patterns and on-chain metrics.")
        )

        user = self._prepend_fact_sheet(token_data, user)

        out = client.chat_json(
            provider=provider,
            model=model or None,
            system=system,
            user=user,
            temperature=0.0,
            max_output_tokens=700,
        )

        score = float(out.get("score", 5.0))
        score = max(0.0, min(10.0, score))
        sentiment = str(out.get("sentiment", "neutral")).strip().lower()
        if sentiment not in {"bullish", "neutral", "bearish"}:
            sentiment = "neutral"
        out["score"] = score
        out["sentiment"] = sentiment
        return out

    def analyze(self, token_data: TokenData) -> AgentVerdict:
        with self.timed("technician.analyze") as t:
            self.emitter.thinking("Running heuristic on-chain maturity checks")
            score, notes = _technical_score(token_data)

            # Emit key heuristic findings for the UI terminal.
            if token_data.contract_verified:
                self.emitter.finding("positive", "Contract source code is verified")
            else:
                self.emitter.finding("warning", "Contract source is not verified", "No verified source on explorer")

            age = int(token_data.contract_age_days or 0)
            if 0 < age < 7:
                self.emitter.finding("warning", f"Very new contract — only {age} days old")
            elif age >= 180:
                self.emitter.finding("positive", f"Mature contract — {age} days old")

            top10 = float(getattr(token_data, "top10_holders_pct", 0.0) or 0.0)
            if top10 >= 60.0:
                self.emitter.finding("warning", f"High holder concentration (top10 {top10:.1f}%)", "Distribution risk")

            tx_24h = int(token_data.tx_count_24h or 0)
            if tx_24h >= 50_000:
                self.emitter.finding("positive", f"High transaction activity: {tx_24h:,} txns in 24h")
            elif 0 < tx_24h < 100:
                self.emitter.finding("info", f"Low transaction activity: {tx_24h} txns in 24h")

            try:
                self.emitter.progress("Calling AI on-chain assessment")
                self.emitter.thinking("Sending metrics to Gemini for contextual analysis…")
                out = self._ai_onchain_assessment(token_data)
                ai_score = float(out.get("score", score))
                ai_score = max(0.0, min(10.0, ai_score))
                # Blend: 70% AI + 30% heuristic to reduce variance
                score = round(ai_score * 0.7 + score * 0.3, 2)

                summary = str(out.get("summary", "")).strip()
                pos = out.get("positives", [])
                neg = out.get("negatives", [])
                flags = out.get("anomaly_flags", [])
                conf = out.get("confidence", None)

                notes = ["AI on-chain (GPT-4o Mini)"]
                if summary:
                    notes.append(summary)
                if isinstance(pos, list) and pos:
                    notes.append("+ " + ", ".join(str(x) for x in pos[:3]))
                    for p in pos[:3]:
                        self.emitter.finding("positive", str(p))
                if isinstance(neg, list) and neg:
                    notes.append("- " + ", ".join(str(x) for x in neg[:3]))
                    for n in neg[:3]:
                        self.emitter.finding("warning", str(n))
                if isinstance(flags, list) and flags:
                    notes.append("flags: " + ", ".join(str(x) for x in flags[:3]))
                    for fl in flags[:3]:
                        self.emitter.finding("critical", str(fl), evidence="anomaly detection")
                if conf is not None:
                    notes.append(f"confidence {float(conf):.2f}")
            except Exception as e:
                self.emitter.warning(f"AI unavailable ({type(e).__name__}: {e})")
                notes.append(f"AI unavailable ({type(e).__name__})")

            reasoning = "; ".join(notes)
            sentiment = "bullish" if score >= 6.5 else "bearish" if score <= 3.5 else "neutral"
            return AgentVerdict(score=score, sentiment=sentiment, reasoning=reasoning, category="Technical")


def _technical_score(token_data: TokenData) -> Tuple[float, list[str]]:
    score = 5.0
    notes: list[str] = ["Technical checks"]

    if token_data.contract_verified:
        score += 1.0
        notes.append("contract verified")
    else:
        score -= 0.75
        notes.append("contract not verified")

    age = int(token_data.contract_age_days or 0)
    if age >= 180:
        score += 1.0
        notes.append(f"contract age {age}d")
    elif age >= 30:
        score += 0.5
        notes.append(f"contract age {age}d")
    elif 0 < age < 7:
        score -= 0.5
        notes.append(f"very new contract ({age}d)")
    else:
        notes.append("contract age unknown")

    tx_24h = int(token_data.tx_count_24h or 0)
    if tx_24h >= 50_000:
        score += 0.75
        notes.append(f"high activity ({tx_24h}/24h)")
    elif tx_24h >= 5_000:
        score += 0.25
        notes.append(f"moderate activity ({tx_24h}/24h)")
    elif tx_24h > 0:
        score -= 0.25
        notes.append(f"low activity ({tx_24h}/24h)")
    else:
        notes.append("activity unknown")

    score = max(0.0, min(10.0, float(score)))
    return score, notes


__all__ = ["TechnicianBot"]
