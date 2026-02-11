from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from src.agents.ai_client import AIClient


TIER1_MODEL_ID = "google/gemini-2.0-flash-exp"


@dataclass
class ContractReader:
    """Summarize Solidity contract code quickly (Tier 1)."""

    model: str = TIER1_MODEL_ID
    ai: Optional[AIClient] = None

    @property
    def name(self) -> str:
        return "ContractReader"

    def analyze(self, *, contract_source: str, address: str = "") -> Dict[str, Any]:
        flags: List[str] = []
        source = (contract_source or "").strip()
        if not source:
            return {
                "agent": self.name,
                "analysis": "No contract source provided.",
                "flags": ["missing_contract_source"],
                "score": 0.0,
            }

        ai = self.ai or AIClient()
        # If Gemini isn't configured, return a tiny heuristic summary.
        if not ai.has_provider("gemini"):
            heur_flags: List[str] = []
            lowered = source.lower()
            if "owner" in lowered and "onlyowner" in lowered:
                heur_flags.append("owner_privileges_present")
            return {
                "agent": self.name,
                "analysis": "Gemini not configured; returning heuristic-only summary.",
                "flags": heur_flags + ["llm_unavailable"],
                "score": 5.0,
            }

        system = (
            "You are ContractReader, a Solidity contract analyst for a token scanner. "
            "Return ONLY valid JSON with keys: agent, analysis, flags, score. "
            "analysis: short summary of what the contract does + key functions + admin controls. "
            "flags: array of short snake_case strings for risks/notes. "
            "score: number 0-10 where 10 is safest/cleanest."
        )

        user = (
            f"Contract address: {address or 'unknown'}\n\n"
            "Solidity source (may be partial):\n"
            "---\n"
            f"{source[:12000]}\n"
            "---\n\n"
            "Focus on: mint/burn, blacklist/whitelist, pausing, fees, upgradeability/proxy, owner powers, hidden transfer restrictions."
        )

        try:
            obj = ai.chat_json(
                provider="gemini",
                system=system,
                user=user,
                # IMPORTANT: AIClient expects Gemini API model id (e.g. gemini-3-flash).
                # We pass our tier model id via env mapping in router; by default this will be ignored.
                model=None,
                temperature=0.2,
                max_output_tokens=650,
            )
        except Exception as e:
            return {
                "agent": self.name,
                "analysis": f"ContractReader failed: {e}",
                "flags": ["contract_reader_error"],
                "score": 0.0,
            }

        # Normalize
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
