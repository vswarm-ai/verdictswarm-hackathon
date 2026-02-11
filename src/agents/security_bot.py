"""SecurityBot — safety/risk checks.

Heuristic MVP is preserved, but when an ``AIClient`` is available the bot will
use **Gemini Flash** to:
- Summarize audit reports / scanner output
- Reason about common vulnerability classes
- Cross-reference *known* security knowledge bases conceptually (e.g., SWC registry,
  common ERC20/AMM pitfalls) when provided with findings

The AI path is best-effort and falls back to heuristics when not configured.
"""

from __future__ import annotations

from typing import Any, Dict, Optional, Tuple

try:
    from ..scoring_engine import AgentVerdict  # type: ignore
    from ..data_fetcher import TokenData  # type: ignore
except ImportError:  # pragma: no cover
    from scoring_engine import AgentVerdict
    from data_fetcher import TokenData

from .ai_client import AIClient
from .base_agent import BaseAgent
from .prompts import SECURITY_SYSTEM, SECURITY_USER_TEMPLATE


class SecurityBot(BaseAgent):
    """Checks contract verification and ScamBot-derived red flags (AI-enhanced)."""

    @property
    def name(self) -> str:  # noqa: D401
        return "SecurityBot"

    @property
    def category(self) -> str:  # noqa: D401
        return "Safety"

    @property
    def description(self) -> str:  # noqa: D401
        return "Security posture checks (Claude 3 Haiku)."

    def _ai_security_assessment(self, token_data: TokenData) -> Dict[str, Any]:
        client = self.ai_client or AIClient()
        provider, model = self.routed_provider_model() or ("gemini", self.model_for("gemini") or "")
        if not client.has_provider(provider):
            raise RuntimeError(f"{provider} API key not set")

        # Optional extras callers might attach.
        audit_report = getattr(token_data, "audit_report", None)
        known_findings = getattr(token_data, "security_findings", None)
        contract_name = getattr(token_data, "contract_name", "")

        scam = getattr(token_data, "scam_analysis", None)
        scam_payload: Dict[str, Any] = {}
        if scam is not None:
            scam_payload = {
                "scam_score": float(getattr(scam, "scam_score", 0.0) or 0.0),
                "recommendation": str(getattr(scam, "recommendation", "") or ""),
                "signals": [getattr(s, "value", str(s)) for s in (getattr(scam, "signals_detected", []) or [])][:10],
            }

        # Avoid sending massive source.
        source = (token_data.source_code or "").strip()
        # Keep prompts reasonable; Gemini 2.5 Flash handles up to ~1M tokens
        # but very large source can dilute the analysis. 12K chars is ~3K tokens.
        if len(source) > 12_000:
            source = source[:12_000] + "\n/* ...truncated (full source is larger)... */"

        system = str(SECURITY_SYSTEM)

        source_note = ""
        if source and "truncated" in source:
            source_note = (
                "\nNOTE: Source code was truncated for prompt size. The full contract may contain "
                "additional logic not shown. Do NOT treat truncation as a red flag — it is a tool limitation. "
                "Assess only what is visible and note low confidence for unseen portions.\n"
            )

        chain = getattr(token_data, "chain", "ethereum")
        chain_note = ""
        if chain == "solana":
            chain_note = (
                "NOTE: This is a Solana SPL token. Solana tokens have different security characteristics than EVM tokens. "
                "There is no traditional smart contract source code to review. Do NOT penalize heavily for missing source code "
                "or missing audit reports — focus on market data, liquidity, age, and on-chain activity metrics.\n\n"
            )

        user = (
            f"Assess the token security posture on {chain.upper()}. Use the provided context only.\n"
            f"{chain_note}"
            "If audit_report/findings are missing, note it but do NOT give an extremely low score just because "
            "no audit exists — many legitimate tokens lack formal audits.\n\n"
            f"Chain: {chain}\n"
            f"Contract/Mint: {token_data.contract_address}\n"
            f"Name/Symbol: {token_data.name} ({token_data.symbol})\n"
            f"Verified: {bool(token_data.contract_verified)}\n"
            f"Contract age (days): {int(token_data.contract_age_days or 0)}\n"
            f"Market cap (USD): {float(token_data.mcap or 0.0):,.2f}\n"
            f"Liquidity (USD): {float(token_data.liquidity_usd or 0.0):,.2f}\n"
            f"ContractName (if known): {contract_name}\n"
            f"Creator: {token_data.creator_address}\n\n"
            f"ScamBot (if provided): {scam_payload}\n\n"
            f"Known findings (if provided): {known_findings}\n\n"
            f"Audit report (if provided, may be text): {audit_report}\n\n"
            f"Source excerpt (if verified; may be truncated for size):\n"
            f"{source}\n"
            f"{source_note}\n"
            "Return JSON:\n"
            "{\n"
            "  score: number (0-10, higher=safer),\n"
            "  sentiment: 'bullish'|'neutral'|'bearish',\n"
            "  summary: string,\n"
            "  key_risks: string[] (top 5),\n"
            "  critical_flags: string[] (any immediate dealbreakers — only truly critical issues),\n"
            "  confidence: number (0-1),\n"
            "  suggested_checks: string[]\n"
            "}\n"
            "Guidance: explicitly consider common issues (upgradeability/admin keys, mintability, "
            "blacklist/whitelist, fee/tax, pausing, reentrancy, auth, owner privileges, proxy patterns). "
            "Established tokens with high mcap ($100M+), verified source, and years of operation "
            "should generally score 5+ unless there are concrete critical vulnerabilities."
        )

        user = self._prepend_fact_sheet(token_data, user)

        out = client.chat_json(
            provider=provider,  # router-selected
            model=model or None,
            system=system,
            user=user,
            temperature=0.0,
            max_output_tokens=1600,
        )

        # Normalize
        score = float(out.get("score", 5.0))
        score = max(0.0, min(10.0, score))
        sentiment = str(out.get("sentiment", "neutral")).strip().lower()
        if sentiment not in {"bullish", "neutral", "bearish"}:
            sentiment = "neutral"
        out["score"] = score
        out["sentiment"] = sentiment
        return out

    def analyze(self, token_data: TokenData) -> AgentVerdict:
        with self.timed("security.analyze") as t:
            self.emitter.thinking("Running heuristic security checks")
            # Default to heuristic.
            score, notes = _security_score(token_data)

            if token_data.contract_verified:
                self.emitter.finding("positive", "Contract source code is verified on explorer")
            elif getattr(token_data, "chain", "ethereum") == "solana":
                self.emitter.finding("info", "Solana SPL tokens do not have traditional source code verification — this is normal", "SPL standard")
            else:
                self.emitter.finding("critical", "Unverified contract increases security unknowns", "No verified source")

            scam = getattr(token_data, "scam_analysis", None)
            if scam is not None:
                scam_score = float(getattr(scam, "scam_score", 0.0) or 0.0)
                if scam_score >= 70:
                    self.emitter.finding("critical", f"ScamBot score {scam_score:.0f}/100 — high scam likelihood", "High scam score")
                elif scam_score >= 40:
                    self.emitter.finding("warning", f"ScamBot score {scam_score:.0f}/100 — elevated risk", "Elevated scam score")
                else:
                    self.emitter.finding("positive", f"ScamBot score {scam_score:.0f}/100 — low scam signals")

            source = (token_data.source_code or "").strip()
            if source:
                self.emitter.thinking("Reviewing contract source code for known vulnerability patterns…")
            else:
                self.emitter.thinking("No source code available — relying on metadata signals only")

            try:
                self.emitter.progress("Calling AI security assessment")
                self.emitter.thinking("Sending contract data to Gemini Flash for security audit…")
                out = self._ai_security_assessment(token_data)
                ai_score = float(out.get("score", score))
                ai_score = max(0.0, min(10.0, ai_score))
                # Blend: 70% AI + 30% heuristic to reduce variance
                score = round(ai_score * 0.7 + score * 0.3, 2)

                summary = str(out.get("summary", "")).strip()
                key_risks = out.get("key_risks", [])
                critical = out.get("critical_flags", [])
                conf = out.get("confidence", None)

                notes = ["AI security (Claude 3 Haiku)"]
                if summary:
                    notes.append(summary)
                if isinstance(critical, list) and critical:
                    notes.append("CRITICAL: " + ", ".join(str(x) for x in critical[:4]))
                    for c in critical[:4]:
                        self.emitter.finding("critical", str(c), evidence="AI security audit")
                if isinstance(key_risks, list) and key_risks:
                    notes.append("risks: " + ", ".join(str(x) for x in key_risks[:4]))
                    for r in key_risks[:4]:
                        self.emitter.finding("warning", str(r))
                if conf is not None:
                    notes.append(f"confidence {float(conf):.2f}")
            except Exception as e:
                self.emitter.warning(f"AI unavailable ({type(e).__name__}: {e})")
                # Keep heuristic notes.
                notes.append(f"AI unavailable ({type(e).__name__})")

            reasoning = "; ".join(notes)
            sentiment = "bullish" if score >= 6.5 else "bearish" if score <= 3.5 else "neutral"
            return AgentVerdict(score=score, sentiment=sentiment, reasoning=reasoning, category="Safety")


def _security_score(token_data: TokenData) -> Tuple[float, list[str]]:
    score = 5.0
    notes: list[str] = ["Safety checks"]

    if token_data.contract_verified:
        score += 0.75
        notes.append("verified source")
    elif getattr(token_data, "chain", "ethereum") == "solana":
        # Solana SPL tokens don't have traditional source verification — don't penalize
        notes.append("SPL token (no source verification)")
    else:
        score -= 1.0
        notes.append("unverified contract")

    # ScamBot analysis (optional, attached by CLI)
    scam = getattr(token_data, "scam_analysis", None)
    if scam is not None:
        scam_score = float(getattr(scam, "scam_score", 0.0) or 0.0)
        recommendation = str(getattr(scam, "recommendation", "") or "").strip()
        signals = getattr(scam, "signals_detected", []) or []

        if scam_score >= 70:
            score -= 4.0
        elif scam_score >= 40:
            score -= 2.0
        elif scam_score >= 20:
            score -= 1.0

        sig_names = []
        for s in signals[:8]:
            sig_names.append(getattr(s, "value", str(s)))

        if recommendation:
            notes.append(f"ScamBot: {recommendation} (score {scam_score:.0f}/100)")
        if sig_names:
            notes.append("signals: " + ", ".join(sig_names))
    else:
        if token_data.source_code:
            notes.append("source available")
        else:
            notes.append("no source to scan")

    score = max(0.0, min(10.0, float(score)))
    return score, notes


__all__ = ["SecurityBot"]
