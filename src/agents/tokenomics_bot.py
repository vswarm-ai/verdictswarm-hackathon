"""TokenomicsBot — token economics.

Heuristic MVP is preserved, but when an ``AIClient`` is available the bot will
use Gemini to:
- Reason about distribution, unlock/vesting sell pressure (when provided)
- Compare tokenomic structure to common success/failure patterns

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
from .prompts import TOKENOMICS_SYSTEM, TOKENOMICS_USER_TEMPLATE


class TokenomicsBot(BaseAgent):
    """Analyzes distribution and valuation sanity checks (AI-enhanced)."""

    @property
    def name(self) -> str:  # noqa: D401
        return "TokenomicsBot"

    @property
    def category(self) -> str:  # noqa: D401
        return "Tokenomics"

    @property
    def description(self) -> str:  # noqa: D401
        return "Supply/distribution + vesting + FDV sanity checks (Gemini 2.5 Flash)."

    def _ai_tokenomics_assessment(self, token_data: TokenData) -> Dict[str, Any]:
        client = self.ai_client or AIClient()
        provider, model = self.routed_provider_model() or ("gemini", self.model_for("gemini") or "")
        if not client.has_provider(provider):
            raise RuntimeError(f"{provider} API key not set")

        # Optional richer tokenomics fields that callers may attach.
        vesting = getattr(token_data, "vesting_schedule", None)
        allocations = getattr(token_data, "token_allocations", None)
        emissions = getattr(token_data, "emissions", None)
        supply = getattr(token_data, "supply", None)

        system = str(TOKENOMICS_SYSTEM)

        # Compute derived metrics for richer analysis
        mcap = float(token_data.mcap or 0.0)
        fdv = float(token_data.fdv or 0.0)
        mcap_fdv_ratio = round(mcap / fdv, 3) if fdv > 0 else None
        liq = float(token_data.liquidity_usd or 0.0)
        liq_mcap_ratio = round(liq / mcap, 3) if mcap > 0 else None

        user = (
            "Analyze token distribution, supply dynamics, and tokenomics risk.\n\n"
            f"Token: {token_data.name} ({token_data.symbol})\n"
            f"Top10 holders %: {float(token_data.top10_holders_pct or 0.0) if token_data.top10_holders_pct else '[data unavailable]'}\n"
            f"Holder count: {int(token_data.holder_count or 0) if token_data.holder_count else '[data unavailable — do NOT assume 0 holders]'}\n"
            f"MCAP: ${mcap:,.0f}\n"
            f"FDV: ${fdv:,.0f}\n"
            f"MCap/FDV ratio: {mcap_fdv_ratio} {'(most supply circulating)' if mcap_fdv_ratio and mcap_fdv_ratio > 0.8 else '(significant supply locked/unvested)' if mcap_fdv_ratio and mcap_fdv_ratio < 0.4 else ''}\n"
            f"Liquidity: ${liq:,.0f}\n"
            f"Liquidity/MCap ratio: {liq_mcap_ratio} {'(deep liquidity)' if liq_mcap_ratio and liq_mcap_ratio > 0.1 else '(thin liquidity relative to mcap)' if liq_mcap_ratio and liq_mcap_ratio < 0.02 else ''}\n"
            f"Volume 24h: ${float(token_data.volume_24h or 0.0):,.0f}\n"
            f"Vesting schedule (optional): {vesting}\n"
            f"Allocations (optional): {allocations}\n"
            f"Emissions (optional): {emissions}\n"
            f"Supply info (optional): {supply}\n\n"
            "Return JSON:\n"
            "{\n"
            "  score: number (0-10, higher=healthier tokenomics),\n"
            "  sentiment: 'bullish'|'neutral'|'bearish',\n"
            "  summary: string (2-3 sentences, be SPECIFIC with ratios and comparisons),\n"
            "  distribution_assessment: string,\n"
            "  unlock_risk: number (0-100),\n"
            "  comparable_models: {successful: string[], failed: string[]},\n"
            "  key_risks: string[] (top 5),\n"
            "  positives: string[] (top 4),\n"
            "  confidence: number (0-1)\n"
            "}\n"
            "If vesting/unlocks data is missing, state unlock_risk is uncertain.\n"
            + (TOKENOMICS_USER_TEMPLATE if TOKENOMICS_USER_TEMPLATE else
               "Be skeptical about insider allocation and unlock risk.")
        )

        user = self._prepend_fact_sheet(token_data, user)

        out = client.chat_json(
            provider=provider,
            model=model or None,
            system=system,
            user=user,
            temperature=0.2,
            max_output_tokens=1400,
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
        with self.timed("tokenomics.analyze") as t:
            score, notes = _tokenomics_score(token_data)

            # Remember heuristic baseline (canonical tokens get 8.0)
            heuristic_score = score

            try:
                out = self._ai_tokenomics_assessment(token_data)
                ai_score = float(out.get("score", score))
                # For canonical tokens, AI shouldn't score below the heuristic floor
                score = max(ai_score, heuristic_score) if heuristic_score >= 7.0 else ai_score

                summary = str(out.get("summary", "")).strip()
                risks = out.get("key_risks", [])
                positives = out.get("positives", [])
                unlock_risk = out.get("unlock_risk", None)
                conf = out.get("confidence", None)

                notes = ["AI tokenomics (Gemini 2.5 Flash)"]
                if summary:
                    notes.append(summary)
                if unlock_risk is not None:
                    try:
                        notes.append(f"unlock risk {float(unlock_risk):.0f}/100")
                    except (ValueError, TypeError):
                        notes.append(f"unlock risk: {unlock_risk}")
                if isinstance(positives, list) and positives:
                    notes.append("+ " + ", ".join(str(x) for x in positives[:3]))
                if isinstance(risks, list) and risks:
                    notes.append("risks: " + ", ".join(str(x) for x in risks[:4]))
                if conf is not None:
                    try:
                        notes.append(f"confidence {float(conf):.2f}")
                    except (ValueError, TypeError):
                        notes.append(f"confidence: {conf}")
            except Exception as e:
                notes.append(f"AI unavailable ({type(e).__name__})")

            ai_worked = not any("AI unavailable" in n for n in notes)
            reasoning = "; ".join(notes)
            sentiment = "bullish" if score >= 6.5 else "bearish" if score <= 3.5 else "neutral"
            # Heuristic fallback still has value — use 0.4 confidence (not 0.0)
            fallback_conf = 0.4 if not ai_worked else 0.0
            try:
                conf_val = float(conf) if ai_worked and conf is not None else fallback_conf
            except (ValueError, TypeError):
                conf_val = fallback_conf
            return AgentVerdict(score=score, sentiment=sentiment, reasoning=reasoning, category="Tokenomics",
                               confidence=conf_val)


_CANONICAL_WRAPPED = {
    "weth", "wrapped ether", "wrapped ethereum", "eth", "ether",
    "wsol", "wrapped sol", "wrapped solana", "sol",
    "wbtc", "wrapped btc", "wrapped bitcoin", "btc",
    "wmatic", "wrapped matic", "matic", "pol",
    "wbnb", "wrapped bnb", "bnb",
    "steth", "wsteth", "cbeth", "reth", "msol", "jitosol",
    "usdc", "usdt", "dai", "frax", "tusd", "busd", "pyusd",
}


def _tokenomics_score(token_data: TokenData) -> Tuple[float, list[str]]:
    # Wrapped/canonical tokens get a high baseline — their tokenomics are inherently sound
    name_lower = (getattr(token_data, "name", "") or "").strip().lower()
    symbol_lower = (getattr(token_data, "symbol", "") or "").strip().lower()
    if symbol_lower in _CANONICAL_WRAPPED or name_lower in _CANONICAL_WRAPPED:
        return 8.0, [f"Canonical token ({symbol_lower.upper()})", "1:1 backed or protocol-native", "tokenomics N/A — peg stability is the metric"]

    score = 5.0
    notes: list[str] = ["Tokenomics checks"]

    # Concentration (expects percent 0-100; if unknown may be 0.0).
    top10 = float(token_data.top10_holders_pct or 0.0)
    if top10 <= 0.0:
        notes.append("top holders % unknown")
    elif top10 <= 20.0:
        score += 1.0
        notes.append(f"healthy distribution (top10 {top10:.1f}%)")
    elif top10 <= 50.0:
        notes.append(f"moderate concentration (top10 {top10:.1f}%)")
    else:
        score -= 1.25
        notes.append(f"high concentration (top10 {top10:.1f}%)")

    # FDV / MCAP sanity.
    mcap = float(token_data.mcap or 0.0)
    fdv = float(token_data.fdv or 0.0)
    if mcap > 0 and fdv > 0:
        ratio = fdv / mcap
        if ratio <= 1.5:
            score += 0.5
            notes.append(f"FDV/MCAP reasonable ({ratio:.2f}x)")
        elif ratio <= 3.0:
            notes.append(f"FDV/MCAP elevated ({ratio:.2f}x)")
        else:
            score -= 0.75
            notes.append(f"FDV/MCAP very high ({ratio:.2f}x)")
    else:
        notes.append("valuation data incomplete")

    score = max(0.0, min(10.0, float(score)))
    return score, notes


__all__ = ["TokenomicsBot"]
