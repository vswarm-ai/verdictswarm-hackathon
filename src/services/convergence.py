"""Iterative Bayesian Debate — Convergence Engine for VerdictSwarm.

Implements the 4-phase consensus algorithm:
  Phase 1: Blind Scoring (handled by existing agent pipeline)
  Phase 2: Attack Round — each agent critiques all peers
  Phase 3: Convergence Loop — agents update scores based on critiques (2-3 rounds)
  Phase 4: Final Synthesis — moderator summarizes or breaks deadlock

Uses Gemini Flash for all debate calls (~$0.02 per full convergence).
Falls back gracefully — if any call fails, uses original scores.

Design goals:
  - Stdlib-only (except AIClient)
  - Each function returns Optional — None means fallback to original
  - All AI calls have tight timeouts (8s) to avoid scan hangs
"""

from __future__ import annotations

import json
import math
import os
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

from src.agents.ai_client import AIClient


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

@dataclass
class AgentCritique:
    """One agent's critique of all peers."""
    agent_name: str
    critiques: Dict[str, str]  # peer_name -> critique text
    raw: str = ""


@dataclass
class ScoreUpdate:
    """An agent's updated score after receiving critiques."""
    agent_name: str
    original_score: float
    updated_score: float
    explanation: str = ""


@dataclass
class ConvergenceRound:
    """Results of one convergence round."""
    round_num: int
    updates: List[ScoreUpdate]
    std_dev: float
    converged: bool


@dataclass
class ModeratorVerdict:
    """The Moderator's binding verdict when agents deadlock."""
    final_score: float
    explanation: str
    strongest_arguments: str = ""


@dataclass
class ConvergenceResult:
    """Full convergence result."""
    critiques: List[AgentCritique]
    rounds: List[ConvergenceRound]
    final_scores: Dict[str, float]  # agent_name -> converged score
    converged: bool
    total_rounds: int
    synthesis: str = ""
    averaged_score: Optional[float] = None  # mean of converged scores (Phase 4)
    moderator_verdict: Optional[ModeratorVerdict] = None  # tiebreaker on deadlock


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

CONVERGENCE_THRESHOLD = 1.0  # σ below this = consensus reached (lowered from 1.5 — agents tend to cluster)
MAX_CONVERGENCE_ROUNDS = 2
AI_TIMEOUT = 10.0  # seconds per call


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_client() -> Optional[AIClient]:
    """Create an AIClient if Gemini is configured."""
    key = (os.getenv("GEMINI_API_KEY") or "").strip()
    if not key:
        return None
    client = AIClient(gemini_api_key=key)
    client.timeout_s = AI_TIMEOUT
    return client


def _std_dev(values: List[float]) -> float:
    """Population standard deviation."""
    if len(values) < 2:
        return 0.0
    mean = sum(values) / len(values)
    variance = sum((x - mean) ** 2 for x in values) / len(values)
    return math.sqrt(variance)


def _format_verdicts_summary(verdicts: Dict[str, Any]) -> str:
    """Build compact summary of all verdicts for prompt context."""
    lines = []
    for name, v in verdicts.items():
        score = float(getattr(v, "score", 0))
        reasoning = (getattr(v, "reasoning", "") or "")[:400]
        category = getattr(v, "category", "") or ""
        lines.append(f"[{name}] Category: {category} | Score: {score:.1f}/10\n  {reasoning}")
    return "\n\n".join(lines)


# ---------------------------------------------------------------------------
# Phase 2: Attack Round
# ---------------------------------------------------------------------------

def generate_critique(
    client: AIClient,
    agent_name: str,
    agent_category: str,
    agent_score: float,
    agent_reasoning: str,
    all_verdicts_summary: str,
    token_name: str = "",
    token_symbol: str = "",
) -> Optional[AgentCritique]:
    """Generate one agent's critique of all peers.
    
    Returns AgentCritique or None on failure.
    """
    system = (
        f"You are {agent_name}, a {agent_category} specialist in VerdictSwarm. "
        f"You scored this token {agent_score:.1f}/10. "
        "Review your peers' analyses and critique their assumptions from YOUR expertise. "
        "Be specific — attack weak data, flawed logic, or missing risks. "
        "Do NOT change your own score yet. Just critique."
    )
    
    user = (
        f"Token: {token_name} ({token_symbol})\n\n"
        f"Your score: {agent_score:.1f}/10\n"
        f"Your reasoning: {agent_reasoning[:500]}\n\n"
        f"ALL PEER ANALYSES:\n{all_verdicts_summary}\n\n"
        "For each peer agent, write a 1-2 sentence critique of their weakest assumption. "
        "Return JSON:\n"
        '{"critiques": {"AgentName": "your critique of them", ...}}\n'
        "Only critique agents that scored differently from you (±2 points). "
        "Skip agents you agree with."
    )
    
    try:
        result = client.chat_json(
            provider="gemini",
            system=system,
            user=user,
            temperature=0.5,
            max_output_tokens=800,
        )
        critiques = result.get("critiques", {})
        if not isinstance(critiques, dict):
            return None
        # Filter out self-critiques
        critiques = {k: str(v) for k, v in critiques.items() if k != agent_name and isinstance(v, str)}
        return AgentCritique(
            agent_name=agent_name,
            critiques=critiques,
            raw=json.dumps(result),
        )
    except Exception as e:
        print(f"[CONVERGENCE] Critique generation failed for {agent_name}: {e}")
        return None


def run_attack_round(
    verdicts: Dict[str, Any],
    token_name: str = "",
    token_symbol: str = "",
) -> List[AgentCritique]:
    """Phase 2: All agents critique all peers.
    
    Returns list of AgentCritique (may be partial if some agents fail).
    """
    client = _get_client()
    if client is None:
        return []
    
    summary = _format_verdicts_summary(verdicts)
    critiques = []
    
    for agent_name, v in verdicts.items():
        if agent_name == "DevilsAdvocate":
            continue  # DA critiques separately in its own flow
        
        score = float(getattr(v, "score", 0))
        reasoning = getattr(v, "reasoning", "") or ""
        category = getattr(v, "category", "") or ""
        
        critique = generate_critique(
            client=client,
            agent_name=agent_name,
            agent_category=category,
            agent_score=score,
            agent_reasoning=reasoning,
            all_verdicts_summary=summary,
            token_name=token_name,
            token_symbol=token_symbol,
        )
        if critique:
            critiques.append(critique)
    
    return critiques


# ---------------------------------------------------------------------------
# Phase 3: Convergence Loop
# ---------------------------------------------------------------------------

def generate_score_update(
    client: AIClient,
    agent_name: str,
    agent_category: str,
    current_score: float,
    agent_reasoning: str,
    critiques_received: List[Tuple[str, str]],  # [(from_agent, critique_text), ...]
    token_name: str = "",
    token_symbol: str = "",
) -> Optional[ScoreUpdate]:
    """Generate one agent's updated score based on received critiques."""
    
    if not critiques_received:
        return ScoreUpdate(
            agent_name=agent_name,
            original_score=current_score,
            updated_score=current_score,
            explanation="No critiques received — maintaining score.",
        )
    
    critiques_text = "\n".join(
        f"- {from_agent}: {text}" for from_agent, text in critiques_received
    )
    
    system = (
        f"You are {agent_name}, a {agent_category} specialist. "
        f"Your current score is {current_score:.1f}/10. "
        "You've received critiques from peers. Incorporate VALID points and adjust your score. "
        "Be intellectually honest — if a critique has merit, move your score. "
        "Don't be stubborn, but don't cave to bad arguments either."
    )
    
    user = (
        f"Token: {token_name} ({token_symbol})\n\n"
        f"Your current score: {current_score:.1f}/10\n"
        f"Your reasoning: {agent_reasoning[:400]}\n\n"
        f"CRITIQUES FROM PEERS:\n{critiques_text}\n\n"
        "Return JSON:\n"
        '{"updated_score": <number 0-10>, "explanation": "<1-2 sentences explaining what you adjusted and why>"}\n'
        "If no critique has merit, keep your score and explain why."
    )
    
    try:
        result = client.chat_json(
            provider="gemini",
            system=system,
            user=user,
            temperature=0.3,
            max_output_tokens=300,
        )
        updated = float(result.get("updated_score", current_score))
        updated = max(0.0, min(10.0, updated))
        explanation = str(result.get("explanation", ""))
        return ScoreUpdate(
            agent_name=agent_name,
            original_score=current_score,
            updated_score=updated,
            explanation=explanation,
        )
    except Exception as e:
        print(f"[CONVERGENCE] Score update failed for {agent_name}: {e}")
        return None


def run_convergence_round(
    verdicts: Dict[str, Any],
    current_scores: Dict[str, float],
    critiques: List[AgentCritique],
    round_num: int,
    token_name: str = "",
    token_symbol: str = "",
) -> Optional[ConvergenceRound]:
    """Run one convergence round: agents update scores based on critiques."""
    
    client = _get_client()
    if client is None:
        return None
    
    # Build critique map: agent_name -> [(from_agent, critique_text)]
    critiques_for: Dict[str, List[Tuple[str, str]]] = {}
    for c in critiques:
        for target, text in c.critiques.items():
            critiques_for.setdefault(target, []).append((c.agent_name, text))
    
    updates = []
    for agent_name, v in verdicts.items():
        if agent_name == "DevilsAdvocate":
            continue
        
        score = current_scores.get(agent_name, float(getattr(v, "score", 0)))
        reasoning = getattr(v, "reasoning", "") or ""
        category = getattr(v, "category", "") or ""
        received = critiques_for.get(agent_name, [])
        
        update = generate_score_update(
            client=client,
            agent_name=agent_name,
            agent_category=category,
            current_score=score,
            agent_reasoning=reasoning,
            critiques_received=received,
            token_name=token_name,
            token_symbol=token_symbol,
        )
        if update:
            updates.append(update)
        else:
            # Keep original score on failure
            updates.append(ScoreUpdate(
                agent_name=agent_name,
                original_score=score,
                updated_score=score,
                explanation="(AI call failed — maintaining score)",
            ))
    
    # Calculate new σ
    new_scores = [u.updated_score for u in updates]
    sigma = _std_dev(new_scores)
    converged = sigma < CONVERGENCE_THRESHOLD
    
    return ConvergenceRound(
        round_num=round_num,
        updates=updates,
        std_dev=sigma,
        converged=converged,
    )


# ---------------------------------------------------------------------------
# Phase 4: Moderator verdict (deadlock tiebreaker)
# ---------------------------------------------------------------------------

async def generate_moderator_verdict(
    agent_verdicts: Dict[str, Any],
    critiques: List[AgentCritique],
    rounds: List[ConvergenceRound],
    ai_client: AIClient,
) -> ModeratorVerdict:
    """Generate a binding moderator verdict when agents fail to converge.

    On ANY failure, falls back to average of current/final agent scores.
    """

    # Build current/final scores map (prefer last round updates when available)
    scoreable = {k: v for k, v in agent_verdicts.items() if k != "DevilsAdvocate"}
    fallback_scores: Dict[str, float] = {
        name: float(getattr(v, "score", 0.0)) for name, v in scoreable.items()
    }
    if rounds:
        for u in rounds[-1].updates:
            fallback_scores[u.agent_name] = float(u.updated_score)

    avg_fallback = (
        sum(fallback_scores.values()) / len(fallback_scores)
        if fallback_scores
        else 0.0
    )

    fallback = ModeratorVerdict(
        final_score=avg_fallback,
        explanation="Moderator fallback: averaged agent scores",
        strongest_arguments="",
    )

    try:
        # Critiques context
        critique_lines: List[str] = []
        for c in critiques:
            for target, text in c.critiques.items():
                critique_lines.append(f"- {c.agent_name} -> {target}: {text}")
        critiques_block = "\n".join(critique_lines) if critique_lines else "(No critiques captured)"

        # Round-by-round score updates context
        round_lines: List[str] = []
        for r in rounds:
            round_lines.append(f"Round {r.round_num} (sigma={r.std_dev:.3f}, converged={r.converged}):")
            for u in r.updates:
                round_lines.append(
                    f"  - {u.agent_name}: {u.original_score:.2f} -> {u.updated_score:.2f} | {u.explanation}"
                )
        rounds_block = "\n".join(round_lines) if round_lines else "(No convergence rounds run)"

        # Agent summary with original and final scores
        agent_lines: List[str] = []
        for name, v in scoreable.items():
            category = getattr(v, "category", "") or ""
            reasoning = (getattr(v, "reasoning", "") or "")[:500]
            original = float(getattr(v, "score", 0.0))
            final = float(fallback_scores.get(name, original))
            agent_lines.append(
                f"[{name}] category={category} | original={original:.2f} | final={final:.2f}\n"
                f"reasoning: {reasoning}"
            )
        agents_block = "\n\n".join(agent_lines)

        system = (
            "You are the VerdictSwarm Moderator. Agents failed to reach convergence. "
            "You must issue a binding final score from 0-10 using the full debate context. "
            "Be fair, concise, and evidence-weighted."
        )

        user = (
            "Debate context:\n\n"
            f"AGENTS (original + final scores):\n{agents_block}\n\n"
            f"CRITIQUES GIVEN/RECEIVED:\n{critiques_block}\n\n"
            f"SCORE UPDATES BY ROUND:\n{rounds_block}\n\n"
            "Return strict JSON with keys:\n"
            '{"final_score": <float 0-10>, "explanation": "<short explanation>", '
            '"strongest_arguments": "<best arguments that drove this decision>"}'
        )

        result = ai_client.chat_json(
            provider="gemini",
            system=system,
            user=user,
            temperature=0.2,
            max_output_tokens=500,
        )

        final_score = float(result.get("final_score", avg_fallback))
        final_score = max(0.0, min(10.0, final_score))
        explanation = str(result.get("explanation", "")).strip() or fallback.explanation
        strongest_arguments = str(result.get("strongest_arguments", "")).strip()

        return ModeratorVerdict(
            final_score=final_score,
            explanation=explanation,
            strongest_arguments=strongest_arguments,
        )
    except Exception as e:
        print(f"[CONVERGENCE] Moderator verdict failed: {e}")
        return fallback


# ---------------------------------------------------------------------------
# Full convergence pipeline
# ---------------------------------------------------------------------------

def run_full_convergence(
    verdicts: Dict[str, Any],
    token_name: str = "",
    token_symbol: str = "",
    max_rounds: int = MAX_CONVERGENCE_ROUNDS,
    threshold: float = CONVERGENCE_THRESHOLD,
) -> Optional[ConvergenceResult]:
    """Run the full iterative convergence pipeline (Phases 2-3).
    
    Returns ConvergenceResult or None if convergence engine is unavailable.
    """
    client = _get_client()
    if client is None:
        return None
    
    # Skip if too few agents (need 3+ for meaningful convergence)
    scoreable = {k: v for k, v in verdicts.items() if k != "DevilsAdvocate"}
    if len(scoreable) < 3:
        return None
    
    # Check initial σ — if already converged, skip
    initial_scores = [float(getattr(v, "score", 0)) for v in scoreable.values()]
    initial_sigma = _std_dev(initial_scores)
    if initial_sigma < threshold:
        final_scores = {name: float(getattr(v, "score", 0)) for name, v in scoreable.items()}
        averaged_score = (
            sum(final_scores.values()) / len(final_scores)
            if final_scores
            else None
        )
        return ConvergenceResult(
            critiques=[],
            rounds=[],
            final_scores=final_scores,
            converged=True,
            total_rounds=0,
            synthesis="Agents already in consensus — no debate needed.",
            averaged_score=averaged_score,
        )
    
    print(f"[CONVERGENCE] Starting convergence: {len(scoreable)} agents, σ={initial_sigma:.2f}")
    
    # Phase 2: Attack Round
    critiques = run_attack_round(verdicts, token_name, token_symbol)
    if not critiques:
        print("[CONVERGENCE] Attack round produced no critiques — skipping convergence")
        return None
    
    print(f"[CONVERGENCE] Attack round: {len(critiques)} agents produced critiques")
    
    # Phase 3: Convergence Loop
    current_scores = {name: float(getattr(v, "score", 0)) for name, v in scoreable.items()}
    rounds = []
    
    for round_num in range(1, max_rounds + 1):
        result = run_convergence_round(
            verdicts=verdicts,
            current_scores=current_scores,
            critiques=critiques,
            round_num=round_num,
            token_name=token_name,
            token_symbol=token_symbol,
        )
        
        if result is None:
            print(f"[CONVERGENCE] Round {round_num} failed — stopping")
            break
        
        rounds.append(result)
        
        # Update current scores
        for u in result.updates:
            current_scores[u.agent_name] = u.updated_score
        
        print(f"[CONVERGENCE] Round {round_num}: σ={result.std_dev:.2f} converged={result.converged}")
        
        if result.converged:
            break
    
    converged = bool(rounds and rounds[-1].converged)

    averaged_score: Optional[float] = None
    moderator_verdict: Optional[ModeratorVerdict] = None

    if converged:
        averaged_score = (
            sum(current_scores.values()) / len(current_scores)
            if current_scores
            else None
        )
    else:
        # Deadlock: Moderator issues binding verdict
        moderator_verdict = __import__("asyncio").run(
            generate_moderator_verdict(
                agent_verdicts=verdicts,
                critiques=critiques,
                rounds=rounds,
                ai_client=client,
            )
        )
    
    return ConvergenceResult(
        critiques=critiques,
        rounds=rounds,
        final_scores=current_scores,
        converged=converged,
        total_rounds=len(rounds),
        averaged_score=averaged_score,
        moderator_verdict=moderator_verdict,
    )


# ---------------------------------------------------------------------------
# Phase 4: Synthesis (uses existing generate_consensus_narrative)
# ---------------------------------------------------------------------------

def format_convergence_for_narrative(result: ConvergenceResult) -> str:
    """Format convergence results as context for the consensus narrative generator."""
    lines = []
    
    if result.critiques:
        lines.append("DEBATE CRITIQUES:")
        for c in result.critiques:
            for target, text in c.critiques.items():
                lines.append(f"  {c.agent_name} → {target}: {text[:150]}")
    
    if result.rounds:
        lines.append(f"\nCONVERGENCE ({result.total_rounds} rounds, {'reached' if result.converged else 'not reached'}):")
        for r in result.rounds:
            for u in r.updates:
                if abs(u.updated_score - u.original_score) > 0.1:
                    lines.append(f"  {u.agent_name}: {u.original_score:.1f} → {u.updated_score:.1f} — {u.explanation[:100]}")
            lines.append(f"  Round {r.round_num} σ={r.std_dev:.2f}")
    
    return "\n".join(lines)
