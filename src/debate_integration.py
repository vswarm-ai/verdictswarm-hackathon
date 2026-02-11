"""Model Debate Protocol integration for VerdictSwarm.

This module wires the external `model-debate` tool into VerdictSwarm's
`--debate` CLI mode.

Design goals:
- Keep imports resilient (repo-local dev without packaging).
- Provide a stable `run_swarm_debate(token_data, ...)` function for the CLI.
- Return a VerdictSwarm-ish report payload that can be formatted as Markdown.

NOTE: The debate protocol itself lives in an external `model-debate` package.
  (Expected at: ../tools/model-debate/ relative to the projects directory)
"""

from __future__ import annotations

import asyncio
import json
import os
import sys
from dataclasses import asdict
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


def _ensure_model_debate_importable() -> None:
    """Best-effort sys.path fixup for local workspace layouts."""

    try:
        import model_debate  # noqa: F401
        return
    except Exception:
        pass

    # Expected workspace layout:
    #   projects/verdictswarm/src/debate_integration.py
    #   projects/tools/model-debate/model_debate/
    here = Path(__file__).resolve()
    projects_dir = here.parents[2]  # .../projects
    candidate = projects_dir / "tools" / "model-debate"
    if candidate.exists():
        sys.path.insert(0, str(candidate))


def _check_required_keys() -> None:
    missing = [
        k
        for k in ["GEMINI_API_KEY", "XAI_API_KEY", "MOONSHOT_API_KEY", "OPENAI_API_KEY"]
        if not (os.getenv(k) or "").strip()
    ]
    if missing:
        raise RuntimeError(
            "Missing required API keys for --debate mode: "
            + ", ".join(missing)
            + ". Set them in your environment before running Swarm Debate."
        )


def _compact_source(source: Optional[str], *, max_chars: int = 3000) -> str:
    if not source:
        return ""
    s = str(source)
    if len(s) <= max_chars:
        return s
    return s[: max_chars - 50] + "\n\n... (truncated) ...\n"


def _topic_from_token_data(token_data: Any, *, chain: str) -> str:
    """Build a high-signal topic prompt for the debate protocol."""

    # TokenData is a dataclass; fall back to vars/dict.
    try:
        td = asdict(token_data)
    except Exception:
        td = dict(getattr(token_data, "__dict__", {}) or {})

    name = (td.get("name") or "").strip() or "Unknown"
    symbol = (td.get("symbol") or "").strip() or "?"
    addr = (td.get("contract_address") or "").strip()

    source_excerpt = _compact_source(td.get("source_code"))

    # Ask for structured JSON so we can parse "initial positions".
    # Round 2+ already forces the debate JSON schema via model-debate.
    return f"""Analyze the crypto token below and give an INVESTMENT-RISK style assessment.

Token:
- Name: {name}
- Symbol: {symbol}
- Chain: {chain}
- Contract: {addr}

Observed metrics (may be partial):
- contract_verified: {td.get('contract_verified')}
- contract_age_days: {td.get('contract_age_days')}
- tx_count_24h: {td.get('tx_count_24h')}
- holder_count: {td.get('holder_count')}
- top10_holders_pct: {td.get('top10_holders_pct')}
- price_usd: {td.get('price_usd')}
- price_change_24h: {td.get('price_change_24h')}
- volume_24h: {td.get('volume_24h')}
- liquidity_usd: {td.get('liquidity_usd')}
- mcap: {td.get('mcap')}
- fdv: {td.get('fdv')}
- data_sources: {td.get('data_sources')}

If provided, contract source (truncated):
---
{source_excerpt}
---

Your role/persona:
- SecurityBot: focus on contract safety, admin risk, audits, honeypots, deployer patterns.
- SocialBot: focus on mindshare, sentiment, community, distribution narrative.
- DevilsAdvocate: assume worst plausible case; stress-test optimism; call out unknowns.
- TechnicalBot: focus on code quality, architecture, integrations, upgradeability.

IMPORTANT (for the initial research round):
Return STRICT JSON (no markdown) with this schema:
{{
  "persona": "<SecurityBot|SocialBot|DevilsAdvocate|TechnicalBot>",
  "initial_position": "<one-sentence stance>",
  "overall_score": 0.0,
  "sentiment": "bullish|neutral|bearish",
  "category_scores": {{
    "Technical": 0.0,
    "Safety": 0.0,
    "Tokenomics": 0.0,
    "Social": 0.0,
    "Macro": 0.0
  }},
  "key_risks": ["..."],
  "key_bulls": ["..."],
  "assumptions": ["..."],
  "confidence": 0.0
}}

Scoring guidance:
- 0–10 overall_score (0 = avoid, 10 = extremely strong)
- confidence 0.0–1.0
- If data is missing, say so in assumptions and lower confidence.
"""


def _safe_json_obj(text: str) -> Optional[Dict[str, Any]]:
    if not text:
        return None
    try:
        obj = json.loads(text)
        if isinstance(obj, dict):
            return obj
    except Exception:
        return None
    return None


def _aggregate_initial_scores(initial: Dict[str, Dict[str, Any]]) -> Tuple[float, Dict[str, float]]:
    overall: List[float] = []
    cats: Dict[str, List[float]] = {k: [] for k in ["Technical", "Safety", "Tokenomics", "Social", "Macro"]}

    for p in initial.values():
        try:
            overall.append(float(p.get("overall_score")))
        except Exception:
            pass
        cs = p.get("category_scores") or {}
        if isinstance(cs, dict):
            for k in cats.keys():
                try:
                    cats[k].append(float(cs.get(k)))
                except Exception:
                    pass

    overall_avg = sum(overall) / len(overall) if overall else 5.0
    cat_avg = {k: (sum(v) / len(v) if v else 5.0) for k, v in cats.items()}
    return overall_avg, cat_avg


async def run_swarm_debate(
    token_data: Any,
    *,
    chain: str,
    max_rounds: int = 4,
    models: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """Run the multi-model debate and return a report payload.

    Returns a dict with:
    - initial_positions (per model)
    - debate_summary (rounds, agreements, disagreements, minority, unresolved)
    - consensus (recommendation, confidence, key_points)
    - derived scoring fields (final_score, category_scores)
    """

    _ensure_model_debate_importable()
    _check_required_keys()

    from model_debate.debate_protocol import ModelDebate  # type: ignore

    debate = ModelDebate()

    topic = _topic_from_token_data(token_data, chain=chain)

    findings = await debate.research(topic, models=models)

    # Parse round-1 JSON (initial positions)
    initial_positions: Dict[str, Dict[str, Any]] = {}
    for model, d in (findings.get("findings") or {}).items():
        text = (d or {}).get("text", "")
        obj = _safe_json_obj(text)
        if obj:
            initial_positions[str(model)] = obj
        else:
            initial_positions[str(model)] = {"raw": text}

    history = await debate.debate(findings, max_rounds=max_rounds)
    out = debate.reach_consensus(history, topic=topic)

    overall_avg, cat_avg = _aggregate_initial_scores(initial_positions)

    return {
        "mode": "swarm_debate",
        "consensus": out.get("consensus", {}),
        "debate_summary": out.get("debate_summary", {}),
        "initial_positions": initial_positions,
        "individual_positions": out.get("individual_positions", {}),
        # Derived numeric scores to fit VerdictSwarm report conventions
        "final_score": float(round(overall_avg, 2)),
        "category_scores": {k: float(round(v, 2)) for k, v in cat_avg.items()},
    }


def format_debate_report_md(
    *,
    token_data: Any,
    chain: str,
    tier_label: str,
    balance: int,
    debate_result: Dict[str, Any],
) -> str:
    """Render the debate payload as a Markdown report."""

    try:
        td = asdict(token_data)
    except Exception:
        td = dict(getattr(token_data, "__dict__", {}) or {})

    name = (td.get("name") or "").strip() or "Unknown"
    symbol = (td.get("symbol") or "").strip() or "?"
    addr = (td.get("contract_address") or "").strip()

    consensus = debate_result.get("consensus") or {}
    summary = debate_result.get("debate_summary") or {}
    initial = debate_result.get("initial_positions") or {}

    conf = float(consensus.get("confidence") or 0.0)

    lines: List[str] = []
    lines.append(f"# VerdictSwarm Swarm Debate Report")
    lines.append("")
    lines.append(f"**Token:** {name} (${symbol})")
    lines.append(f"**Chain:** {chain}")
    lines.append(f"**Contract:** `{addr}`")
    lines.append(f"**Access:** {tier_label} | **Balance:** {balance:,}")
    lines.append("")

    lines.append("## Final Consensus")
    lines.append("")
    lines.append(f"**Recommendation:** {consensus.get('recommendation','').strip() or '(no recommendation)'}")
    lines.append(f"**Confidence:** {conf:.0%}")
    if consensus.get("key_points"):
        lines.append("")
        lines.append("**Key points (shared):**")
        for kp in consensus.get("key_points") or []:
            lines.append(f"- {kp}")

    lines.append("")
    lines.append("## Initial Positions (Round 1)")
    lines.append("")
    persona_label = {
        "gemini": "SecurityBot",
        "grok": "SocialBot",
        "kimi": "DevilsAdvocate",
        "codex": "TechnicalBot",
    }
    for model in ["gemini", "grok", "kimi", "codex"]:
        if model not in initial:
            continue
        p = initial.get(model) or {}
        lines.append(f"### {persona_label.get(model, model)} ({model})")
        if "raw" in p:
            lines.append("```text")
            lines.append(str(p.get("raw", "")).strip())
            lines.append("```")
            lines.append("")
            continue
        stance = (p.get("initial_position") or "").strip()
        score = p.get("overall_score")
        pconf = p.get("confidence")
        sent = (p.get("sentiment") or "").strip()
        if stance:
            lines.append(f"- **Stance:** {stance}")
        if score is not None:
            lines.append(f"- **Score:** {score}/10 ({sent})")
        if pconf is not None:
            try:
                lines.append(f"- **Confidence:** {float(pconf):.0%}")
            except Exception:
                pass
        risks = p.get("key_risks") or []
        bulls = p.get("key_bulls") or []
        if risks:
            lines.append("- **Key risks:**")
            for r in risks[:6]:
                lines.append(f"  - {r}")
        if bulls:
            lines.append("- **Key bulls:**")
            for b in bulls[:6]:
                lines.append(f"  - {b}")
        lines.append("")

    lines.append("## Debate Summary")
    lines.append("")
    lines.append(f"**Rounds completed:** {summary.get('rounds', 1)}")

    def _sec(title: str, items: List[str]) -> None:
        if not items:
            return
        lines.append("")
        lines.append(f"**{title}:**")
        for it in items[:12]:
            lines.append(f"- {it}")

    _sec("Agreements", summary.get("agreements") or [])
    _sec("Disagreements", summary.get("disagreements") or [])
    _sec("Minority opinions", summary.get("minority_opinions") or [])
    _sec("Unresolved", summary.get("unresolved") or [])

    return "\n".join(lines).rstrip() + "\n"
