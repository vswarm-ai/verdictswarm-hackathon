from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from src.agents.ai_client import AIClient


TIER1_MODEL_ID = "google/gemini-2.0-flash-exp"


@dataclass
class VerdictBot:
    """Synthesize Tier 1 agent outputs into a final verdict and SwarmScore."""

    model: str = TIER1_MODEL_ID
    ai: Optional[AIClient] = None

    @property
    def name(self) -> str:
        return "VerdictBot"

    def analyze(
        self,
        *,
        address: str,
        chain: str,
        contract_reader: Dict[str, Any],
        social_scanner: Dict[str, Any],
        swarm_score: float,
    ) -> Dict[str, Any]:
        ai = self.ai or AIClient()

        # If Gemini isn't configured, produce a deterministic synthesis.
        if not ai.has_provider("gemini"):
            flags: List[str] = []
            flags += [*(contract_reader.get("flags") or [])]
            flags += [*(social_scanner.get("flags") or [])]
            flags = [str(f) for f in flags if str(f).strip()]
            verdict = "SAFE" if swarm_score >= 7.5 else "CAUTION" if swarm_score >= 5.0 else "HIGH_RISK"
            analysis = (
                f"Verdict: {verdict}. SwarmScore={swarm_score:.1f}/10. "
                "(LLM unavailable; heuristic synthesis.)"
            )
            return {"agent": self.name, "analysis": analysis, "flags": sorted(set(flags)), "score": float(swarm_score)}

        system = (
            "You are VerdictBot. Return ONLY valid JSON with keys: agent, analysis, flags, score. "
            "Combine ContractReader + SocialScanner into a concise final verdict. "
            "analysis should be a short paragraph plus a one-line final recommendation (SAFE/CAUTION/HIGH_RISK). "
            "flags should include the most important risks. "
            "score should equal the provided swarm_score (0-10)."
        )

        user = (
            f"address: {address}\nchain: {chain}\n"
            f"swarm_score: {swarm_score:.2f}\n\n"
            f"ContractReader: {contract_reader}\n\n"
            f"SocialScanner: {social_scanner}\n"
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
                "analysis": f"VerdictBot failed: {e}",
                "flags": ["verdict_bot_error"],
                "score": float(swarm_score),
            }

        analysis = str(obj.get("analysis") or "").strip()
        out_flags = obj.get("flags") or []
        if not isinstance(out_flags, list):
            out_flags = []

        # Force score to swarm_score per contract.
        return {
            "agent": self.name,
            "analysis": analysis,
            "flags": [str(f) for f in out_flags if str(f).strip()],
            "score": float(swarm_score),
        }
