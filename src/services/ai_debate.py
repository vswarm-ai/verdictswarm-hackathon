"""AI-powered debate engine for VerdictSwarm.

Uses Gemini Flash to generate genuine debate arguments instead of
template-based reformatting of existing bot reasoning.

Three AI calls per scan (~$0.002 total):
1. Devil's Advocate Challenge — targeted counter-arguments
2. Target Agent Defense — evidence-based rebuttal
3. Consensus Synthesis — narrative explaining swarm agreement/disagreement

All functions fall back gracefully to ``None`` on failure so the caller
can use the existing template text.
"""

from __future__ import annotations

import os
from typing import Any, Dict, List, Optional

from src.agents.ai_client import AIClient


def _get_ai_client() -> Optional[AIClient]:
    """Create an AIClient if Gemini is configured, else return None."""
    key = (os.getenv("GEMINI_API_KEY") or "").strip()
    if not key:
        return None
    return AIClient(gemini_api_key=key)


def _format_bot_context(verdicts: Dict[str, Any]) -> str:
    """Build a compact summary of all bot scores + reasoning for prompt context."""
    lines: List[str] = []
    for name, v in verdicts.items():
        score = float(v.score) if hasattr(v, "score") else 0.0
        reasoning = getattr(v, "reasoning", "") or ""
        category = getattr(v, "category", "") or ""
        sentiment = getattr(v, "sentiment", "") or ""
        lines.append(
            f"[{name}] Category: {category} | Score: {score:.1f}/10 | "
            f"Sentiment: {sentiment}\n  Reasoning: {reasoning[:500]}"
        )
    return "\n\n".join(lines)


def generate_da_challenge(
    verdicts: Dict[str, Any],
    target_name: str,
    target_score: float,
    da_score: float,
    token_name: str = "",
    token_symbol: str = "",
) -> Optional[str]:
    """Generate a Devil's Advocate challenge using Gemini Flash.

    Returns the AI-generated challenge text, or None on failure.
    """
    client = _get_ai_client()
    if client is None:
        return None

    bot_context = _format_bot_context(verdicts)
    target_reasoning = getattr(verdicts.get(target_name), "reasoning", "") or ""

    system = (
        "You are the Devil's Advocate in VerdictSwarm, a crypto token analysis system. "
        "Your job is to challenge the most optimistic assessment with specific, pointed "
        "counter-arguments. Be sharp, skeptical, and cite specific weaknesses. "
        "Do NOT be generic — reference actual data points from the analyses provided. "
        "Keep your response to 2-3 sentences. Be direct and confrontational but fair."
    )

    user = (
        f"Token: {token_name} ({token_symbol})\n\n"
        f"All bot analyses:\n{bot_context}\n\n"
        f"You scored this token {da_score:.1f}/10. "
        f"{target_name} scored it {target_score:.1f}/10 with this reasoning:\n"
        f'"{target_reasoning[:600]}"\n\n'
        f"Generate a specific, pointed challenge to {target_name}'s optimistic score. "
        f"Attack the WEAKEST points in their reasoning. What are they overlooking or downplaying?"
    )

    try:
        return client.chat_text(
            provider="gemini",
            system=system,
            user=user,
            temperature=0.5,
            max_output_tokens=300,
            json_mode=False,
        )
    except Exception as e:
        print(f"[WARN] AI debate challenge generation failed for {token_name} ({len(verdicts)} verdicts): {e}")
        return None


def generate_agent_defense(
    verdicts: Dict[str, Any],
    target_name: str,
    target_score: float,
    da_challenge: str,
    token_name: str = "",
    token_symbol: str = "",
) -> Optional[str]:
    """Generate a target agent's defense against the DA challenge.

    Returns the AI-generated defense text, or None on failure.
    """
    client = _get_ai_client()
    if client is None:
        return None

    target_reasoning = getattr(verdicts.get(target_name), "reasoning", "") or ""
    target_category = getattr(verdicts.get(target_name), "category", "") or ""

    system = (
        f"You are {target_name} in VerdictSwarm, a crypto token analysis system. "
        f"Your specialty is {target_category} analysis. "
        "You've been challenged by the Devil's Advocate. Defend your analysis with "
        "specific evidence and reasoning. Acknowledge valid concerns but explain why "
        "your score is still justified. Be confident but intellectually honest. "
        "Keep your response to 2-3 sentences."
    )

    user = (
        f"Token: {token_name} ({token_symbol})\n\n"
        f"Your original analysis (score {target_score:.1f}/10):\n"
        f'"{target_reasoning[:600]}"\n\n'
        f"Devil's Advocate challenge:\n"
        f'"{da_challenge}"\n\n'
        f"Defend your position. What evidence supports your score? "
        f"Address the specific concerns raised."
    )

    try:
        return client.chat_text(
            provider="gemini",
            system=system,
            user=user,
            temperature=0.4,
            max_output_tokens=300,
            json_mode=False,
        )
    except Exception as e:
        print(f"[WARN] AI debate defense generation failed for {token_name} ({len(verdicts)} verdicts): {e}")
        return None


def generate_consensus_narrative(
    verdicts: Dict[str, Any],
    debates_log: List[Dict[str, str]],
    final_score: float,
    grade: str,
    token_name: str = "",
    token_symbol: str = "",
) -> Optional[str]:
    """Generate an AI-synthesized consensus narrative.

    Takes all agent scores, reasoning, and debate outcomes to produce
    a genuine synthesis explaining what the swarm agreed on and where
    disagreements remain.

    Returns the AI-generated narrative, or None on failure.
    """
    client = _get_ai_client()
    if client is None:
        return None

    bot_context = _format_bot_context(verdicts)

    debates_text = ""
    if debates_log:
        debate_lines = [f"- {d['topic']}: {d['resolution']}" for d in debates_log]
        debates_text = "\n".join(debate_lines)

    system = (
        "You are the VerdictSwarm consensus engine. Synthesize all agent analyses and "
        "debate outcomes into a clear, insightful narrative (4-6 sentences). "
        "Explain: (1) what the swarm agreed on, (2) where key disagreements are, "
        "(3) what the final grade means for the user. "
        "Be specific — reference actual agent findings, not generic statements. "
        "Write in third person ('The swarm found...', 'SecurityBot flagged...'). "
        "End with a clear actionable takeaway."
    )

    user = (
        f"Token: {token_name} ({token_symbol})\n"
        f"Final Score: {final_score:.1f}/10 | Grade: {grade}\n\n"
        f"Agent Analyses:\n{bot_context}\n\n"
        f"Debate Outcomes:\n{debates_text or '(no formal debates triggered)'}\n\n"
        f"Synthesize a consensus narrative for this token analysis."
    )

    try:
        return client.chat_text(
            provider="gemini",
            system=system,
            user=user,
            temperature=0.4,
            max_output_tokens=500,
            json_mode=False,
        )
    except Exception as e:
        print(f"[WARN] AI consensus narrative generation failed for {token_name} ({len(verdicts)} verdicts): {e}")
        return None
