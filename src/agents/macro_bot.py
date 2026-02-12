"""MacroBot — macro/market context.

When an ``AIClient`` is available, MacroBot uses Gemini to reason about macro
conditions and correlations **from provided context** (e.g., BTC/ETH regime,
rates, DXY, sector narratives). This repo's MVP DataFetcher does not currently
fetch macro data, so callers may optionally attach a ``macro_context`` payload
onto TokenData.

Falls back to a neutral heuristic verdict when no macro context is present or
Gemini isn't configured.
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
from .prompts import MACRO_SYSTEM, MACRO_USER_TEMPLATE


class MacroBot(BaseAgent):
    """Analyzes market conditions and sector momentum (AI-enhanced when possible)."""

    @property
    def name(self) -> str:  # noqa: D401
        return "MacroBot"

    @property
    def category(self) -> str:  # noqa: D401
        return "Macro"

    @property
    def description(self) -> str:  # noqa: D401
        return "Macro regime + sector momentum checks (Grok)."

    def _ai_macro_assessment(self, token_data: TokenData) -> Dict[str, Any]:
        client = self.ai_client or AIClient()
        provider, model = self.routed_provider_model() or ("xai", self.model_for("xai") or "")
        if not client.has_provider(provider):
            raise RuntimeError(f"{provider} API key not set")

        macro_context = getattr(token_data, "macro_context", None) or "Not provided — use your own knowledge of current crypto market conditions."

        system = str(MACRO_SYSTEM)

        # Add token-specific context
        chain = getattr(token_data, "chain", "ethereum")
        mcap = float(token_data.mcap or 0.0)
        sector = "DeFi" if chain in ("ethereum", "base", "arbitrum") else "Solana ecosystem" if chain == "solana" else "crypto"

        from datetime import datetime, timezone
        current_date = datetime.now(timezone.utc).strftime("%B %d, %Y")

        user = (
            f"TODAY'S DATE: {current_date}\n\n"
            f"Assess the macro environment's impact on {token_data.name} ({token_data.symbol}).\n\n"
            f"Token context: {sector} token, MCap ${mcap:,.0f}, Chain: {chain}\n"
            f"Additional macro data (if provided): {macro_context}\n\n"
            "IMPORTANT — Also consider:\n"
            "1) NOTABLE FIGURE MOVES: Are any well-known traders, VCs, or founders publicly entering or exiting positions in this token or its sector?\n"
            "2) SECTOR-SPECIFIC NEWS: Any recent events (last 48h) that specifically impact this token's sector or chain?\n"
            "3) SMART MONEY ROTATION: Is smart money flowing into or out of this sector?\n\n"
            "Return JSON:\n"
            "{\n"
            "  score: number (0-10, higher=better macro tailwinds),\n"
            "  sentiment: 'bullish'|'neutral'|'bearish',\n"
            "  summary: string (2-3 sentences),\n"
            "  key_drivers: string[] (top 4 tailwinds),\n"
            "  key_risks: string[] (top 4 headwinds),\n"
            "  correlations: {btc: string, eth: string, rates: string, dxy: string},\n"
            "  sector_outlook: string,\n"
            "  notable_moves: string[] (any known figures buying/selling — empty if none),\n"
            "  confidence: number (0-1)\n"
            "}\n"
            "Return ONLY a valid JSON object, no markdown fences, no text before or after.\n"
            + (MACRO_USER_TEMPLATE if MACRO_USER_TEMPLATE else
               "Use your knowledge of current market conditions even if macro_context is empty.")
        )

        user = self._prepend_fact_sheet(token_data, user)

        out = client.chat_json(
            provider=provider,
            model=model or None,
            system=system,
            user=user,
            temperature=0.2,
            max_output_tokens=800,
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
        with self.timed("macro.analyze") as t:
            score, notes = _mock_macro_score(token_data)

            try:
                out = self._ai_macro_assessment(token_data)
                score = float(out.get("score", score))

                summary = str(out.get("summary", "")).strip()
                drivers = out.get("key_drivers", [])
                risks = out.get("key_risks", [])
                conf = out.get("confidence", None)

                notes = ["AI macro (Grok)"]
                if summary:
                    notes.append(summary)
                if isinstance(drivers, list) and drivers:
                    notes.append("drivers: " + ", ".join(str(x) for x in drivers[:3]))
                if isinstance(risks, list) and risks:
                    notes.append("risks: " + ", ".join(str(x) for x in risks[:3]))
                if conf is not None:
                    notes.append(f"confidence {float(conf):.2f}")
            except Exception as e:
                notes.append(f"AI unavailable ({type(e).__name__})")

            ai_worked = not any("AI unavailable" in n for n in notes)
            reasoning = "; ".join(notes)
            sentiment = "bullish" if score >= 6.5 else "bearish" if score <= 3.5 else "neutral"
            fallback_conf = 0.3 if not ai_worked else 0.0
            return AgentVerdict(score=score, sentiment=sentiment, reasoning=reasoning, category="Macro",
                               confidence=float(conf) if ai_worked and conf is not None else fallback_conf)


def _mock_macro_score(_: TokenData) -> Tuple[float, list[str]]:
    return 5.0, ["Macro checks", "heuristic fallback (AI unavailable)"]


__all__ = ["MacroBot"]
