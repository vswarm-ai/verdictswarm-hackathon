"""Typed event models for VerdictSwarm scan streaming.

These events drive the Interrogation Room UI via SSE.
See docs/STREAMING_ARCHITECTURE.md for the full specification.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field, asdict
from enum import Enum
from typing import Any, Dict, List, Optional


class EventType(str, Enum):
    SCAN_START = "scan:start"
    SCAN_CONSENSUS = "scan:consensus"
    SCAN_COMPLETE = "scan:complete"
    SCAN_ERROR = "scan:error"
    AGENT_START = "agent:start"
    AGENT_THINKING = "agent:thinking"
    AGENT_FINDING = "agent:finding"
    AGENT_PROGRESS = "agent:progress"
    AGENT_SCORE = "agent:score"
    AGENT_COMPLETE = "agent:complete"
    AGENT_ERROR = "agent:error"
    DEBATE_START = "debate:start"
    DEBATE_MESSAGE = "debate:message"
    DEBATE_RESOLVED = "debate:resolved"


class Severity(str, Enum):
    CRITICAL = "critical"
    WARNING = "warning"
    INFO = "info"
    POSITIVE = "positive"


class Stance(str, Enum):
    CHALLENGE = "challenge"
    DEFEND = "defend"
    CONCEDE = "concede"
    ESCALATE = "escalate"
    COMPROMISE = "compromise"


class DebateOutcome(str, Enum):
    CONSENSUS = "consensus"
    COMPROMISE = "compromise"
    SPLIT = "split"


class ErrorCode(str, Enum):
    TIMEOUT = "TIMEOUT"
    API_ERROR = "API_ERROR"
    INVALID_TOKEN = "INVALID_TOKEN"
    RATE_LIMITED = "RATE_LIMITED"


@dataclass
class AgentInfo:
    """Agent metadata sent with scan:start."""
    id: str
    name: str
    display_name: str
    icon: str
    color: str
    phase: int
    category: str
    status: str = "waiting"  # waiting | active | complete | error | locked


@dataclass
class Finding:
    """Individual finding from an agent."""
    severity: str  # Severity enum value
    message: str
    evidence: Optional[str] = None
    category: Optional[str] = None


@dataclass
class ScanEvent:
    """Base event for all scan streaming events."""
    version: int
    type: str  # EventType enum value
    scan_id: str
    timestamp: int  # Unix ms
    data: Dict[str, Any]

    def to_sse(self) -> Dict[str, str]:
        """Convert to SSE-compatible dict for sse-starlette."""
        import json
        return {
            "id": str(self.timestamp),
            "event": self.type,
            "data": json.dumps(self.data),
        }


def _now_ms() -> int:
    return int(time.time() * 1000)


# --- Event Constructors ---

def scan_start(
    scan_id: str,
    token_address: str,
    chain: str,
    agents: List[AgentInfo],
    token_name: Optional[str] = None,
) -> ScanEvent:
    return ScanEvent(
        version=1,
        type=EventType.SCAN_START,
        scan_id=scan_id,
        timestamp=_now_ms(),
        data={
            "tokenAddress": token_address,
            "chain": chain,
            "tokenName": token_name,
            "agentCount": len(agents),
            "agents": [
                {
                    "id": a.id,
                    "name": a.name,
                    "displayName": a.display_name,
                    "icon": a.icon,
                    "color": a.color,
                    "phase": a.phase,
                    "category": a.category,
                    "status": a.status,
                }
                for a in agents
            ],
        },
    )


def agent_start(scan_id: str, agent_id: str, agent_name: str, phase: int) -> ScanEvent:
    return ScanEvent(
        version=1,
        type=EventType.AGENT_START,
        scan_id=scan_id,
        timestamp=_now_ms(),
        data={"agentId": agent_id, "agentName": agent_name, "phase": phase},
    )


def agent_thinking(scan_id: str, agent_id: str, agent_name: str, message: str) -> ScanEvent:
    return ScanEvent(
        version=1,
        type=EventType.AGENT_THINKING,
        scan_id=scan_id,
        timestamp=_now_ms(),
        data={"agentId": agent_id, "agentName": agent_name, "message": message},
    )


def agent_finding(
    scan_id: str,
    agent_id: str,
    agent_name: str,
    severity: str,
    message: str,
    evidence: Optional[str] = None,
) -> ScanEvent:
    return ScanEvent(
        version=1,
        type=EventType.AGENT_FINDING,
        scan_id=scan_id,
        timestamp=_now_ms(),
        data={
            "agentId": agent_id,
            "agentName": agent_name,
            "severity": severity,
            "message": message,
            "evidence": evidence,
        },
    )


def agent_score(
    scan_id: str,
    agent_id: str,
    agent_name: str,
    category: str,
    score: float,
    confidence: float,
) -> ScanEvent:
    return ScanEvent(
        version=1,
        type=EventType.AGENT_SCORE,
        scan_id=scan_id,
        timestamp=_now_ms(),
        data={
            "agentId": agent_id,
            "agentName": agent_name,
            "category": category,
            "score": score,
            "confidence": confidence,
        },
    )


def agent_complete(scan_id: str, agent_id: str, agent_name: str, duration_ms: int, metadata: dict | None = None) -> ScanEvent:
    data = {"agentId": agent_id, "agentName": agent_name, "durationMs": duration_ms}
    if metadata:
        data["metadata"] = metadata
    return ScanEvent(
        version=1,
        type=EventType.AGENT_COMPLETE,
        scan_id=scan_id,
        timestamp=_now_ms(),
        data=data,
    )


def agent_error(
    scan_id: str, agent_id: str, agent_name: str, message: str, recoverable: bool = True
) -> ScanEvent:
    return ScanEvent(
        version=1,
        type=EventType.AGENT_ERROR,
        scan_id=scan_id,
        timestamp=_now_ms(),
        data={
            "agentId": agent_id,
            "agentName": agent_name,
            "message": message,
            "recoverable": recoverable,
        },
    )


def debate_start(
    scan_id: str,
    agent_ids: List[str],
    topic: str,
    reason: str,
) -> ScanEvent:
    return ScanEvent(
        version=1,
        type=EventType.DEBATE_START,
        scan_id=scan_id,
        timestamp=_now_ms(),
        data={"agents": agent_ids, "topic": topic, "reason": reason},
    )


def debate_message(
    scan_id: str,
    from_agent: str,
    from_name: str,
    message: str,
    round_num: int,
    stance: str,
    evidence_cited: Optional[str] = None,
    score_adjustment: Optional[Dict[str, Any]] = None,
    phase: Optional[str] = None,
    target_agent: Optional[str] = None,
    target_name: Optional[str] = None,
) -> ScanEvent:
    """Emit a debate round message.

    *phase* labels the debate step for frontend animation sequencing:
      "challenge" | "defense" | "rebuttal" | "resolution" | "consensus"

    *target_agent* / *target_name* identify who is being addressed (e.g.
    the agent being challenged by the Devil's Advocate).
    """
    data: Dict[str, Any] = {
        "from": from_agent,
        "fromName": from_name,
        "message": message,
        "round": round_num,
        "stance": stance,
    }
    if phase:
        data["phase"] = phase
    if target_agent:
        data["targetAgent"] = target_agent
    if target_name:
        data["targetName"] = target_name
    if evidence_cited:
        data["evidenceCited"] = evidence_cited
    if score_adjustment:
        data["scoreAdjustment"] = score_adjustment
    return ScanEvent(
        version=1,
        type=EventType.DEBATE_MESSAGE,
        scan_id=scan_id,
        timestamp=_now_ms(),
        data=data,
    )


def debate_resolved(
    scan_id: str,
    outcome: str,
    resolution: str,
    confidence: float,
    adjusted_scores: Optional[Dict[str, float]] = None,
    split_positions: Optional[List[Dict[str, Any]]] = None,
) -> ScanEvent:
    data: Dict[str, Any] = {
        "outcome": outcome,
        "resolution": resolution,
        "confidence": confidence,
    }
    if adjusted_scores:
        data["adjustedScores"] = adjusted_scores
    if split_positions:
        data["splitPositions"] = split_positions
    return ScanEvent(
        version=1,
        type=EventType.DEBATE_RESOLVED,
        scan_id=scan_id,
        timestamp=_now_ms(),
        data=data,
    )


def scan_consensus(
    scan_id: str,
    score: float,
    grade: str,
    breakdown: Dict[str, Dict[str, float]],
) -> ScanEvent:
    return ScanEvent(
        version=1,
        type=EventType.SCAN_CONSENSUS,
        scan_id=scan_id,
        timestamp=_now_ms(),
        data={"score": score, "grade": grade, "breakdown": breakdown},
    )


def scan_complete(
    scan_id: str,
    score: float,
    grade: str,
    breakdown: Dict[str, Any],
    debates: List[Dict[str, str]],
    duration_ms: int,
    agent_count: int,
    full_results: Optional[Dict[str, Any]] = None,
) -> ScanEvent:
    return ScanEvent(
        version=1,
        type=EventType.SCAN_COMPLETE,
        scan_id=scan_id,
        timestamp=_now_ms(),
        data={
            "score": score,
            "grade": grade,
            "breakdown": breakdown,
            "debates": debates,
            "durationMs": duration_ms,
            "agentCount": agent_count,
            "fullResults": full_results or {},
        },
    )


def scan_error(
    scan_id: str,
    message: str,
    code: str = "API_ERROR",
    retryable: bool = True,
) -> ScanEvent:
    return ScanEvent(
        version=1,
        type=EventType.SCAN_ERROR,
        scan_id=scan_id,
        timestamp=_now_ms(),
        data={"message": message, "code": code, "retryable": retryable},
    )
