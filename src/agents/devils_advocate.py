"""DevilsAdvocate — contrarian concerns.

This agent is intentionally skeptical. With an ``AIClient`` available, it will
use Gemini (preferring the configured *pro* model) to generate contrarian risk
arguments and edge-case failure modes.

In the scoring engine, this agent is typically left **unweighted** (category=None)
so it appears as additional notes.
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
from .prompts import DEVILS_ADVOCATE_SYSTEM, DEVILS_ADVOCATE_USER_TEMPLATE


class DevilsAdvocate(BaseAgent):
    """Always finds contrarian concerns."""

    @property
    def name(self) -> str:  # noqa: D401
        return "DevilsAdvocate"

    @property
    def category(self) -> str:  # noqa: D401
        return "Contrarian"

    @property
    def description(self) -> str:  # noqa: D401
        return "Most skeptical agent: contrarian risks, failure modes, hidden downsides (Gemini 2.5 Flash)."

    def _get_model_label(self) -> str:
        pm = self.routed_provider_model()
        if pm:
            model = pm[1]
            # Clean up model ID to human-readable label
            labels = {
                "gemini-2.5-flash": "Gemini 2.5 Flash",
                "gemini-2.5-pro": "Gemini 2.5 Pro",
                "gpt-4o-mini": "GPT-4o Mini",
                "claude-3-haiku-20240307": "Claude 3 Haiku",
                "grok-3": "Grok 3",
            }
            return labels.get(model, model)
        return "Gemini 2.5 Flash"

    def _ai_contrarian_assessment(self, token_data: TokenData, prior_verdicts: dict | None = None) -> Dict[str, Any]:
        client = self.ai_client or AIClient()
        # Give DA extra timeout since it processes all prior verdicts
        client.timeout_s = max(client.timeout_s, 60.0)
        provider, model = self.routed_provider_model() or ("gemini", self.model_for("gemini") or client.gemini_pro_model)
        print(f"[DA] Using provider={provider} model={model} has_provider={client.has_provider(provider)}")
        if not client.has_provider(provider):
            raise RuntimeError(f"{provider} API key not set")

        # Optional richer inputs.
        project_desc = getattr(token_data, "project_description", None)
        links = getattr(token_data, "links", None)

        system = DEVILS_ADVOCATE_SYSTEM

        # Build prior verdicts context for the DA to challenge
        prior_context = ""
        if prior_verdicts:
            lines = []
            for agent_name, v in prior_verdicts.items():
                score = float(getattr(v, "score", 0))
                reasoning = getattr(v, "reasoning", "")
                # Truncate long reasoning
                if len(reasoning) > 150:
                    reasoning = reasoning[:147] + "..."
                lines.append(f"  - {agent_name}: {score:.1f}/10 — {reasoning}")
            prior_context = (
                "OTHER AGENTS' VERDICTS (your job is to CHALLENGE these):\n"
                + "\n".join(lines) + "\n\n"
                "For each agent above, identify:\n"
                "1. What did they get WRONG or overlook?\n"
                "2. What assumptions are they making that could break?\n"
                "3. What scenario would make their score wildly incorrect?\n\n"
            )

        user = (
            f"Challenge the swarm's analysis of {token_data.name} ({token_data.symbol}).\n\n"
            f"{prior_context}"
            f"TOKEN DATA:\n"
            f"Contract: {token_data.contract_address}\n"
            f"Verified: {bool(token_data.contract_verified)}\n"
            f"Contract age (days): {int(token_data.contract_age_days or 0) or '[data unavailable]'}\n"
            f"Tx 24h: {int(token_data.tx_count_24h or 0)}\n"
            f"Holders: {int(token_data.holder_count or 0) if token_data.holder_count else '[data unavailable — do NOT assume 0 holders]'}\n"
            f"Top10 holders %: {float(token_data.top10_holders_pct or 0.0) if token_data.top10_holders_pct else '[data unavailable]'}\n"
            f"Liquidity USD: {float(token_data.liquidity_usd or 0.0)}\n"
            f"MCAP/FDV: {float(token_data.mcap or 0.0)}/{float(token_data.fdv or 0.0)}\n"
            f"Project description (optional): {project_desc}\n"
            f"Links (optional): {links}\n\n"
            "Return JSON:\n"
            "{\n"
            '  "score": number (0-10 where LOWER means more risk),\n'
            '  "sentiment": "bearish" or "neutral",\n'
            '  "thesis": "2-3 sentence contrarian thesis",\n'
            '  "key_risks": ["risk 1", "risk 2", ...] (top 5),\n'
            '  "unknowns": ["unknown 1", ...] (top 3),\n'
            '  "confidence": number (0-1)\n'
            "}\n"
            + (DEVILS_ADVOCATE_USER_TEMPLATE if DEVILS_ADVOCATE_USER_TEMPLATE else
               "Be maximally skeptical while staying plausible.")
        )

        user = self._prepend_fact_sheet(token_data, user)

        out = client.chat_json(
            provider=provider,
            system=system,
            user=user,
            model=model or None,
            temperature=0.3,
            max_output_tokens=3000,
        )

        score = float(out.get("score", 4.0))
        score = max(0.0, min(10.0, score))
        sentiment = str(out.get("sentiment", "bearish")).strip().lower()
        if sentiment not in {"bearish", "neutral"}:
            sentiment = "bearish"
        out["score"] = score
        out["sentiment"] = sentiment
        return out

    def analyze(self, token_data: TokenData, prior_verdicts: dict | None = None) -> AgentVerdict:
        with self.timed("devils_advocate.analyze") as t:
            if prior_verdicts:
                agent_names = ", ".join(prior_verdicts.keys())
                self.emitter.thinking(f"Reviewing {len(prior_verdicts)} agents' verdicts: {agent_names}")
            else:
                self.emitter.thinking("Looking for contrarian risks and hidden downsides…")
            score, notes = _contrarian_score(token_data)

            # Emit heuristic findings
            cats = [str(c).strip().lower() for c in (getattr(token_data, "coingecko_categories", []) or [])]
            if any(c == "meme-coin" or "meme coin" in c or c == "meme" for c in cats):
                self.emitter.finding("critical", "Meme coin classification — high speculation risk")

            top10 = float(token_data.top10_holders_pct or 0.0)
            if top10 > 50.0:
                self.emitter.finding("warning", f"High holder concentration: top 10 hold {top10:.1f}%")

            if not token_data.contract_verified:
                self.emitter.finding("warning", "Unverified contract — unknown risk surface")

            self.emitter.thinking("Generating AI contrarian assessment — challenging the swarm…")
            try:
                out = self._ai_contrarian_assessment(token_data, prior_verdicts=prior_verdicts)
                print(f"[DA] AI call succeeded, got keys: {list(out.keys())}")
                score = float(out.get("score", score))

                thesis = str(out.get("thesis", "")).strip()
                risks = out.get("key_risks", [])
                unknowns = out.get("unknowns", [])
                conf = out.get("confidence", None)

                # Build structured reasoning like other agents
                thesis = str(out.get("thesis", "")).strip()
                risks = out.get("key_risks", [])
                unknowns = out.get("unknowns", [])
                conf = out.get("confidence", None)

                # Emit findings to the SSE stream
                if thesis:
                    self.emitter.finding("warning", thesis)
                if isinstance(risks, list):
                    for r in risks[:3]:
                        self.emitter.finding("warning", str(r))
                if isinstance(unknowns, list):
                    for u in unknowns[:2]:
                        self.emitter.finding("info", f"❓ {u}")

                # Build reasoning paragraph (matches other agents' format)
                parts = [f"AI contrarian ({self._get_model_label()})"]
                if thesis:
                    parts.append(thesis)
                if isinstance(risks, list) and risks:
                    parts.append("risks: " + ", ".join(str(r) for r in risks[:5]))
                if isinstance(unknowns, list) and unknowns:
                    parts.append("unknowns: " + ", ".join(str(u) for u in unknowns[:3]))
                if conf is not None:
                    parts.append(f"confidence {float(conf):.2f}")
                # Replace heuristic notes with AI output
                if thesis:
                    notes = parts
            except Exception as e:
                import traceback
                err_msg = f"{type(e).__name__}: {str(e)[:200]}"
                print(f"[DA] AI contrarian assessment failed: {err_msg}")
                traceback.print_exc()
                self.emitter.finding("info", "Devil's Advocate using heuristic analysis (AI response was malformed)")
                # Keep heuristic notes, just append fallback note
                notes.append("(heuristic mode — AI response malformed)")

            reasoning = "; ".join(notes)
            sentiment = "bearish" if score <= 6.5 else "neutral"
            return AgentVerdict(score=score, sentiment=sentiment, reasoning=reasoning, category="Contrarian")


def _contrarian_score(token_data: TokenData) -> Tuple[float, list[str]]:
    score = 4.0
    notes: list[str] = []

    # Meme coin penalty (CoinGecko categories)
    cats = [str(c).strip().lower() for c in (getattr(token_data, "coingecko_categories", []) or [])]
    if any(c == "meme-coin" or "meme coin" in c or c == "meme" for c in cats):
        score -= 2.5
        notes.append("Meme coin - high speculation risk")

    top10 = float(token_data.top10_holders_pct or 0.0)
    if top10 > 50.0:
        score -= 1.0
        notes.append(f"high concentration (top10 {top10:.1f}%)")
    elif top10 > 25.0:
        score -= 0.5
        notes.append(f"moderate concentration (top10 {top10:.1f}%)")
    elif top10 > 0:
        notes.append(f"healthy distribution (top10 {top10:.1f}%)")
    # If top10 is 0/None, holder data unavailable — don't comment

    if not token_data.contract_verified:
        score -= 0.5
        notes.append("unverified contract increases unknown risk")

    age = int(token_data.contract_age_days or 0)
    if 0 < age < 7:
        score -= 0.5
        notes.append(f"very new deployment ({age}d)")
    elif 0 < age < 90:
        notes.append(f"relatively young project ({age}d)")

    # Meme-specific narrative risk (not for established tokens)
    if any(c == "meme-coin" or "meme coin" in c or c == "meme" for c in cats):
        notes.append("meme narrative risk: attention can fade quickly")

    score = max(0.0, min(10.0, float(score)))
    return score, notes


__all__ = ["DevilsAdvocate"]
