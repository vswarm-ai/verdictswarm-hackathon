from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from src.agents.ai_client import AIClient


TIER1_MODEL_ID = "google/gemini-2.0-flash-exp"


@dataclass
class SocialScanner:
    """Check for Twitter/X presence and basic social sanity signals (Tier 1)."""

    model: str = TIER1_MODEL_ID
    ai: Optional[AIClient] = None

    @property
    def name(self) -> str:
        return "SocialScanner"

    def analyze(
        self,
        *,
        token_name: str = "",
        token_symbol: str = "",
        website_url: str = "",
        twitter_url: str = "",
    ) -> Dict[str, Any]:
        flags: List[str] = []

        # Heuristic-only check: do we even have a twitter link?
        tw = (twitter_url or "").strip()
        if not tw:
            flags.append("no_twitter_link")

        ai = self.ai or AIClient()
        # If no Gemini, just return the link existence check.
        if not ai.has_provider("gemini"):
            score = 6.0 if tw else 3.0
            analysis = "Twitter link present." if tw else "No Twitter/X link found in token metadata."
            return {"agent": self.name, "analysis": analysis, "flags": flags + ["llm_unavailable"], "score": score}

        system = (
            "You are SocialScanner. Return ONLY valid JSON with keys: agent, analysis, flags, score. "
            "Goal: assess the token's Twitter/X presence quickly. "
            "If a twitter_url is provided, estimate whether it looks legit and if possible infer rough follower scale from the content of the URL/handle (do NOT browse). "
            "If no twitter_url, mention missing social link. "
            "score 0-10 where 10 is strong/credible social proof."
        )

        user = (
            f"Token: {token_name} ({token_symbol})\n"
            f"website_url: {website_url or ''}\n"
            f"twitter_url: {tw or ''}\n\n"
            "Notes: You cannot access the internet. Only assess based on the provided fields. "
            "Add flags like: no_twitter_link, suspicious_twitter_url, has_twitter_link, needs_manual_social_check."
        )

        try:
            obj = ai.chat_json(
                provider="gemini",
                system=system,
                user=user,
                model=None,
                temperature=0.2,
                max_output_tokens=450,
            )
        except Exception as e:
            return {
                "agent": self.name,
                "analysis": f"SocialScanner failed: {e}",
                "flags": flags + ["social_scanner_error"],
                "score": 0.0,
            }

        analysis = str(obj.get("analysis") or "").strip()
        out_flags = obj.get("flags") or []
        if not isinstance(out_flags, list):
            out_flags = []
        score = obj.get("score")
        try:
            score_f = float(score)
        except Exception:
            score_f = 5.0
        score_f = max(0.0, min(10.0, score_f))

        return {
            "agent": self.name,
            "analysis": analysis,
            "flags": [str(f) for f in out_flags if str(f).strip()],
            "score": score_f,
        }
