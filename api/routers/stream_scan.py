from __future__ import annotations

import asyncio
import json
import os
import time
import uuid
from datetime import date, datetime, timezone
from typing import Any, AsyncGenerator, Dict, List, Optional, Tuple

import anyio
from fastapi import APIRouter, Depends, Query, Request
from sse_starlette.sse import EventSourceResponse

from ..deps import get_cache, get_rate_limiter, get_scanner
from ..services.metrics import MetricsService
from ..models.scan_events import (
    AgentInfo,
    ScanEvent,
    agent_complete,
    agent_error,
    agent_finding,
    agent_score,
    agent_start,
    agent_thinking,
    debate_message,
    debate_resolved,
    debate_start,
    scan_complete,
    scan_consensus,
    scan_error,
    scan_start,
)
from ..services.cache import Cache
from ..services.event_bus import ScanEventBus
from ..services.rate_limiter import RateLimitExceeded, RedisRateLimiter
from ..services.scanner import ScannerService

from src.agents.base_agent import CallbackEmitter
from src.free_tier import free_tier_scan
# News pre-fetch removed — models (Gemini, Grok) have native real-time news access
from src.services.token_preprocessor import (
    PreprocessedFacts,
    build_fact_preamble,
    format_degraded_mode_notice,
    format_fact_sheet_for_agent,
    preprocess_token,
)
from src.tier_config import allowed_bots_for_tier, get_rate_limit
from src.tiers import TierLevel


router = APIRouter(tags=["scan-stream"])

# ---------------------------------------------------------------------------
# Agent metadata registry  (id, display name, emoji/icon, hex color, phase, category)
# ---------------------------------------------------------------------------

AGENT_REGISTRY: List[Dict[str, Any]] = [
    {"id": "TechnicianBot", "name": "TechnicianBot", "display_name": "Technician", "icon": "📊", "color": "#00D4FF", "phase": 1, "category": "Technical"},
    {"id": "SecurityBot",   "name": "SecurityBot",   "display_name": "Security",   "icon": "🔒", "color": "#FF6B6B", "phase": 1, "category": "Safety"},
    {"id": "TokenomicsBot", "name": "TokenomicsBot", "display_name": "Tokenomics", "icon": "💰", "color": "#FFD700", "phase": 2, "category": "Tokenomics"},
    {"id": "SocialBot",     "name": "SocialBot",     "display_name": "Social",     "icon": "🐦", "color": "#6B46C1", "phase": 2, "category": "Social"},
    {"id": "MacroBot",      "name": "MacroBot",      "display_name": "Macro",      "icon": "🌍", "color": "#00D4AA", "phase": 3, "category": "Macro"},
    {"id": "DevilsAdvocate","name": "DevilsAdvocate","display_name": "Devil's Advocate","icon": "😈", "color": "#FF0055", "phase": 4, "category": "Contrarian"},
    {"id": "VisionBot",     "name": "VisionBot",     "display_name": "Vision",     "icon": "👁️", "color": "#FF6B6B", "phase": 5, "category": "security"},
]

_AGENT_META = {a["id"]: a for a in AGENT_REGISTRY}

# Debate threshold — score difference between agents that triggers debate
DEBATE_THRESHOLD = 2.5
CROSS_CATEGORY_THRESHOLD = 2.0


# ---------------------------------------------------------------------------
# AI debate helper — lightweight Gemini Flash calls for debate arguments
# ---------------------------------------------------------------------------

async def _ai_debate_call(
    prompt: str,
    system: str = "You are a crypto analysis debate participant. Be specific, cite data, and make pointed arguments. Keep responses to 2-3 sentences max.",
) -> str:
    """Make a lightweight AI call for debate arguments. Returns empty string on failure."""
    from src.agents.ai_client import AIClient
    try:
        client = AIClient()
        text = await anyio.to_thread.run_sync(
            lambda: client.chat_text(
                provider="gemini",
                system=system,
                user=prompt,
                temperature=0.6,
                max_output_tokens=200,
            )
        )
        if text and len(text) > 300:
            text = text[:297] + "..."
        return (text or "").strip()
    except Exception:
        return ""


# ---------------------------------------------------------------------------
# Debug endpoint removed — use /api/metrics/health instead

# ---------------------------------------------------------------------------
# Tier 1 sync endpoint (unchanged)
# ---------------------------------------------------------------------------

@router.get("/api/scan/tier1")
async def tier1_scan(
    address: str,
    chain: str = Query(default="base"),
    scanner: ScannerService = Depends(get_scanner),
):
    """Tier 1 (Scout) scan.

    Returns structured JSON with 3 agent outputs + final verdict.

    Note: This is separate from SSE streaming endpoint; designed for ~15s sync response.
    """

    from datetime import datetime, timezone

    from ..agents.contract_reader import ContractReader
    from ..agents.social_scanner import SocialScanner
    from ..agents.verdict_bot import VerdictBot

    token_data = await scanner._fetch_token_data(address, chain)  # noqa: SLF001

    contract_source = getattr(token_data, "contract_source", None) or getattr(token_data, "source_code", None) or ""

    cr = ContractReader().analyze(contract_source=contract_source, address=getattr(token_data, "contract_address", address))

    ss = SocialScanner().analyze(
        token_name=getattr(token_data, "name", "") or getattr(token_data, "token_name", ""),
        token_symbol=getattr(token_data, "symbol", "") or getattr(token_data, "token_symbol", ""),
        website_url=getattr(token_data, "website", "") or getattr(token_data, "website_url", ""),
        twitter_url=getattr(token_data, "twitter", "") or getattr(token_data, "twitter_url", ""),
    )

    scores = [float(cr.get("score") or 0.0), float(ss.get("score") or 0.0)]
    swarm_score = sum(scores) / max(1, len(scores))

    vb = VerdictBot().analyze(
        address=getattr(token_data, "contract_address", address),
        chain=chain,
        contract_reader=cr,
        social_scanner=ss,
        swarm_score=swarm_score,
    )

    scanned_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    flags = sorted({*(cr.get("flags") or []), *(ss.get("flags") or []), *(vb.get("flags") or [])})

    return {
        "address": getattr(token_data, "contract_address", address),
        "chain": chain,
        "tier": "TIER_1",
        "swarm_score": float(swarm_score),
        "agents": [cr, ss, vb],
        "flags": flags,
        "scanned_at": scanned_at,
    }


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_client_ip(request: Request) -> str:
    """Extract client IP address from request headers."""
    # Check X-Forwarded-For header first (used by proxies)
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        # X-Forwarded-For can be a comma-separated list; take the first IP
        return forwarded.split(",")[0].strip()

    # Fallback to direct client host
    if request.client:
        return request.client.host

    return "unknown"


def _get_rate_limit_identifier(request: Request, tier_level: TierLevel) -> str:
    """Get identifier for rate limiting: IP for FREE tier, wallet for paid tiers."""
    if tier_level == TierLevel.FREE:
        # FREE tier: rate limit by IP address
        return f"ip:{_get_client_ip(request)}"

    # Paid tiers: rate limit by wallet address
    wallet = (request.headers.get("x-wallet-address") or "").strip()
    if not wallet:
        wallet = (request.query_params.get("wallet") or "").strip()
    if not wallet:
        # Fallback to IP if no wallet provided
        return f"ip:{_get_client_ip(request)}"

    return f"wallet:{wallet.lower()}"


def _risk_level(score_0_to_10: float) -> str:
    if score_0_to_10 >= 8.0:
        return "LOW"
    if score_0_to_10 >= 6.0:
        return "MEDIUM"
    if score_0_to_10 >= 4.0:
        return "HIGH"
    return "CRITICAL"


def _grade_from_score(score_0_to_10: float) -> str:
    if score_0_to_10 >= 9.0:
        return "A+"
    if score_0_to_10 >= 8.0:
        return "A"
    if score_0_to_10 >= 7.0:
        return "B"
    if score_0_to_10 >= 6.0:
        return "C"
    if score_0_to_10 >= 4.0:
        return "D"
    return "F"


def _generate_summary(
    token_data: Any,
    final_score: float,
    grade: str,
    verdicts: Dict[str, Any],
    analysis: Dict[str, Dict[str, Any]],
) -> str:
    """Generate a 3-5 sentence verdict summary from scan data.

    Template-based approach (Option A) — no AI call, just format the data.
    """
    # Extract token metadata
    name = getattr(token_data, "name", "") or "Unknown Token"
    symbol = getattr(token_data, "symbol", "") or ""
    mcap = float(getattr(token_data, "mcap", 0) or 0)
    liquidity = float(getattr(token_data, "liquidity_usd", 0) or 0)
    age_days = int(getattr(token_data, "contract_age_days", 0) or 0)
    verified = bool(getattr(token_data, "contract_verified", False))
    chain = getattr(token_data, "chain", "blockchain")

    # Format numbers
    def fmt_usd(n: float) -> str:
        if n >= 1e9:
            return f"${n/1e9:.1f}B"
        if n >= 1e6:
            return f"${n/1e6:.1f}M"
        if n >= 1e3:
            return f"${n/1e3:.0f}K"
        return f"${n:.2f}"

    # Sentence 1: Token description
    parts = []
    if mcap > 0:
        parts.append(f"{fmt_usd(mcap)} market cap")
    if age_days > 0:
        if age_days > 365:
            parts.append(f"{age_days // 365}+ years old")
        else:
            parts.append(f"{age_days} days old")
    if verified:
        parts.append("verified contract")

    intro = f"{name} ({symbol}) is "
    if parts:
        intro += f"a {'well-established' if age_days > 365 else 'token on'} {chain}"
        if len(parts) > 0:
            intro += f" with {', '.join(parts[:2])}"
    else:
        intro += f"a token on {chain}"
    intro += "."

    # Sentence 2: Key strengths (from positive findings or high scores)
    strengths = []
    if mcap > 100e6:
        strengths.append(f"significant market cap ({fmt_usd(mcap)})")
    if liquidity > 1e6:
        strengths.append(f"deep liquidity ({fmt_usd(liquidity)})")
    if analysis.get("security", {}).get("score", 0) >= 7:
        strengths.append("strong security profile")
    if analysis.get("technical", {}).get("score", 0) >= 7:
        strengths.append("solid technical fundamentals")
    if analysis.get("social", {}).get("score", 0) >= 7:
        strengths.append("positive community sentiment")
    if analysis.get("macro", {}).get("score", 0) >= 7:
        strengths.append("favorable macro positioning")

    strength_text = ""
    if strengths:
        strength_text = f"The Swarm found {' and '.join(strengths[:2])}."

    # Sentence 3: Key concerns (from low scores or warnings)
    concerns = []
    if analysis.get("security", {}).get("score", 0) < 5:
        concerns.append("security risks")
    if analysis.get("tokenomics", {}).get("score", 0) < 5:
        concerns.append("tokenomics concerns")
    if analysis.get("technical", {}).get("score", 0) < 5:
        concerns.append("weak technical fundamentals")
    if liquidity < 100000:
        concerns.append("limited liquidity")
    da_score = analysis.get("Contrarian", {}).get("score", analysis.get("DevilsAdvocate", {}).get("score", 5))
    if da_score < 4:
        concerns.append("adversarial review raised red flags")

    concern_text = ""
    if concerns:
        concern_text = f" Key concerns: {', '.join(concerns[:2])}."
    elif not strengths:
        # Still provide something useful based on agent count
        num_agents = len([k for k, v in analysis.items() if isinstance(v, dict) and v.get("score") is not None])
        if num_agents >= 4:
            concern_text = " The swarm found a balanced risk-reward profile with no extreme outliers."
        else:
            concern_text = ""

    # Sentence 4: Overall assessment
    assessment_map = {
        "A+": "exceptional quality with minimal risk",
        "A": "high quality with low risk",
        "B": "established and liquid, but carry standard risk awareness",
        "C": "moderate risk — proceed with caution",
        "D": "high risk — significant concerns identified",
        "F": "critical risk — not recommended",
    }
    assessment = assessment_map.get(grade, "standard crypto risk")
    final_text = f"Overall verdict: {grade} — {assessment}."

    # Combine all parts
    summary_parts = [intro]
    if strength_text:
        summary_parts.append(strength_text)
    if concern_text:
        summary_parts.append(concern_text)
    summary_parts.append(final_text)

    return " ".join(summary_parts)


def _bot_summary(v: Any) -> str:
    if v is None:
        return ""
    r = getattr(v, "reasoning", None)
    if isinstance(r, str):
        return r
    return ""


def _tier_from_str(tier: str | None) -> TierLevel:
    t = (tier or "FREE").strip().upper()
    if t in {"TIER_1", "INVESTIGATOR"}:
        return TierLevel.TIER_1
    if t in {"TIER_2", "VIGILANTE", "PROSECUTOR"}:
        return TierLevel.TIER_2
    if t in {"TIER_3", "WHALE", "GRAND_JURY"}:
        return TierLevel.TIER_3
    if t in {"SWARM_DEBATE", "CONSENSUS"}:
        return TierLevel.SWARM_DEBATE
    return TierLevel.FREE


def _make_emitter(bus: ScanEventBus, scan_id: str, agent_id: str, agent_name: str) -> CallbackEmitter:
    """Create a CallbackEmitter that bridges agent events → ScanEventBus."""

    def _on_thinking(msg: str) -> None:
        bus.emit(agent_thinking(scan_id, agent_id, agent_name, msg))

    def _on_finding(severity: str, msg: str, evidence: Optional[str] = None) -> None:
        bus.emit(agent_finding(scan_id, agent_id, agent_name, severity, msg, evidence))

    def _on_progress(step: str) -> None:
        bus.emit(agent_thinking(scan_id, agent_id, agent_name, f"[step] {step}"))

    def _on_warning(msg: str) -> None:
        bus.emit(agent_thinking(scan_id, agent_id, agent_name, f"⚠️ {msg}"))

    return CallbackEmitter(
        on_thinking=_on_thinking,
        on_finding=_on_finding,
        on_progress=_on_progress,
        on_warning=_on_warning,
    )


# ---------------------------------------------------------------------------
# Cross-agent challenge emitter
# ---------------------------------------------------------------------------

_emitted_challenge_pairs: set = set()

def _emit_cross_agent_challenges(
    bus: ScanEventBus,
    scan_id: str,
    new_bot: str,
    new_verdict: Any,
    all_verdicts: Dict[str, Any],
) -> None:
    """After a bot completes, emit challenge/reaction events if scores diverge."""
    new_score = float(new_verdict.score)
    new_meta = _AGENT_META.get(new_bot, {})

    for prev_name, prev_verdict in all_verdicts.items():
        if prev_name == new_bot:
            continue
        # Deduplicate: only emit each pair once per scan
        pair_key = tuple(sorted([new_bot, prev_name]))
        if pair_key in _emitted_challenge_pairs:
            continue
        prev_score = float(prev_verdict.score)
        diff = abs(new_score - prev_score)
        if diff < DEBATE_THRESHOLD:
            continue

        # Determine challenger (lower score) and defender (higher score)
        if new_score < prev_score:
            low_name, low_score, low_reasoning = new_bot, new_score, getattr(new_verdict, "reasoning", "") or ""
            high_name, high_score = prev_name, prev_score
        else:
            low_name, low_score, low_reasoning = prev_name, prev_score, getattr(prev_verdict, "reasoning", "") or ""
            high_name, high_score = new_bot, new_score

        low_meta = _AGENT_META.get(low_name, {})
        high_meta = _AGENT_META.get(high_name, {})

        # Extract first sentence of the challenger's reasoning
        first_sentence = low_reasoning.split(".")[0].strip() + "." if low_reasoning else "Risk factors detected."
        if len(first_sentence) > 120:
            first_sentence = first_sentence[:117] + "..."

        _emitted_challenge_pairs.add(pair_key)
        bus.emit(agent_thinking(
            scan_id, low_name, low_meta.get("name", low_name),
            f"⚔️ Challenging {high_meta.get('display_name', high_name)}'s {high_score:.1f}/10 — {first_sentence}"
        ))
        bus.emit(agent_thinking(
            scan_id, high_name, high_meta.get("name", high_name),
            f"🤔 Reviewing {low_meta.get('display_name', low_name)}'s concerns (scored {low_score:.1f}/10)..."
        ))


# ---------------------------------------------------------------------------
# Consensus narrative builder
# ---------------------------------------------------------------------------

def _build_consensus_narrative(
    verdicts: Dict[str, Any],
    debates_log: List[Dict[str, str]],
    final_score: float,
    grade: str,
    token_name: str = "",
    token_symbol: str = "",
) -> str:
    """Build a narrative of how the swarm reached consensus.

    Attempts AI-powered synthesis via Gemini Flash first, with graceful
    fallback to the original template-based narrative.

    **Always** returns a non-empty string when verdicts is non-empty.
    Both the AI path and the template path are wrapped in try/except
    to guarantee no silent failures crash the scan stream.
    """

    # --- Try AI-powered consensus narrative first ---
    try:
        from src.services.ai_debate import generate_consensus_narrative

        ai_narrative = generate_consensus_narrative(
            verdicts=verdicts,
            debates_log=debates_log,
            final_score=final_score,
            grade=grade,
            token_name=token_name,
            token_symbol=token_symbol,
        )
        if ai_narrative and len(ai_narrative.strip()) > 50:
            return ai_narrative.strip()
    except Exception as e:
        print(f"[WARN] AI consensus narrative failed, using template: {e}")

    # --- Fallback: template-based narrative ---
    try:
        lines: List[str] = []

        scores = {name: float(v.score) for name, v in verdicts.items()}
        if not scores:
            return ""
        avg = sum(scores.values()) / len(scores)

        dissenters = [name for name, s in scores.items() if abs(s - avg) >= 1.5]

        # Opening
        if len(dissenters) == 0:
            lines.append(f"The swarm reached strong consensus: all {len(verdicts)} agents converged on Grade {grade}.")
        elif len(dissenters) == 1:
            d_name = dissenters[0]
            d_meta = _AGENT_META.get(d_name, {})
            d_score = scores[d_name]
            lines.append(f"{len(verdicts)} agents analyzed this token. {d_meta.get('display_name', d_name)} was the lone dissenter (scored {d_score:.1f}/10 vs swarm average {avg:.1f}).")
        else:
            lines.append(f"The swarm was divided: {len(dissenters)} of {len(verdicts)} agents disagreed significantly on the risk assessment.")

        # Key debates
        for debate in debates_log:
            lines.append(f"⚖️ {debate['topic']}: {debate['resolution']}")

        # Highest and lowest
        if len(scores) >= 2:
            high_name = max(scores, key=scores.get)  # type: ignore[arg-type]
            low_name = min(scores, key=scores.get)  # type: ignore[arg-type]
            high_meta = _AGENT_META.get(high_name, {})
            low_meta = _AGENT_META.get(low_name, {})
            high_reasoning = _bot_summary(verdicts.get(high_name))
            low_reasoning = _bot_summary(verdicts.get(low_name))

            if high_name != low_name:
                h_sent = high_reasoning.split(".")[0] + "." if high_reasoning else ""
                l_sent = low_reasoning.split(".")[0] + "." if low_reasoning else ""
                if h_sent:
                    lines.append(f"Most optimistic: {high_meta.get('display_name', high_name)} ({scores[high_name]:.1f}/10) — {h_sent}")
                if l_sent:
                    lines.append(f"Most critical: {low_meta.get('display_name', low_name)} ({scores[low_name]:.1f}/10) — {l_sent}")

        result = "\n".join([l for l in lines if l])
        return result if result else f"The swarm analyzed this token with {len(verdicts)} agents and assigned Grade {grade}."
    except Exception as e:
        print(f"[WARN] Template consensus narrative also failed for {token_name}: {e}")
        return f"The swarm analyzed this token with {len(verdicts)} agents and assigned Grade {grade}."

    # Final catch-all: guarantee non-empty string when verdicts is non-empty
    if verdicts:
        return f"The swarm analyzed this token with {len(verdicts)} agents and assigned Grade {grade}."
    return ""


# ---------------------------------------------------------------------------
# Main SSE streaming endpoint  (V2 — typed events)
# ---------------------------------------------------------------------------

@router.get("/api/scan/stream")
async def stream_scan(
    request: Request,
    address: str,
    chain: str = Query(default="base"),
    depth: str = Query(default="full"),
    tier: str = Query(default="FREE"),
    fresh: bool = Query(default=False),
    wallet: str = Query(default=""),
    scanner: ScannerService = Depends(get_scanner),
    cache: Cache = Depends(get_cache),
    rate_limiter: RedisRateLimiter = Depends(get_rate_limiter),
):
    """Stream scan progress via Server-Sent Events (SSE).

    **V2 Event Protocol** — typed events drive the Interrogation Room UI:

      scan:start, agent:start, agent:thinking, agent:finding, agent:score,
      agent:complete, agent:error, debate:start, debate:message,
      debate:resolved, scan:consensus, scan:complete, scan:error

    Supports reconnection via ``Last-Event-ID`` header.
    """

    # Sanitize chain — strip any query param leakage (e.g. "solana?fresh=true" → "solana")
    chain = chain.split("?")[0].strip().lower() if chain else "base"

    # Apply TOKEN_OVERRIDES: resolve symbol → (address, chain)
    from src.data_fetcher import TOKEN_OVERRIDES
    override = TOKEN_OVERRIDES.get(address.strip().upper())
    if override:
        address, chain = override

    depth_l = (depth or "full").lower()
    tier_level = _tier_from_str(tier)
    allowed = allowed_bots_for_tier(tier_level)

    # ---------- Admin bypass for testing ----------
    admin_key = request.headers.get("x-api-key") or request.query_params.get("api_key") or ""
    _admin_api_key = os.environ.get("METRICS_API_KEY", "")
    is_admin = bool(_admin_api_key and admin_key == _admin_api_key)
    if is_admin:
        # Admin: override tier to TIER_1 for full agent access, skip rate limits
        tier_level = TierLevel.TIER_1
        allowed = allowed_bots_for_tier(tier_level)

    # ---------- Rate limiting & daily scan caps ----------
    identifier = _get_rate_limit_identifier(request, tier_level)
    daily_limit = get_rate_limit(tier_level)

    # Check cache first (before consuming rate limit quota)
    cache_key = f"{chain}:{address.lower()}:{tier_level.value}"
    cached_result = None
    cached_at = None
    redis_available = True

    if not fresh:
        try:
            result_tuple = await cache.get_json(cache_key)
            if result_tuple:
                cached_result, cached_at = result_tuple
                # Invalidate stale cache entries that predate consensus_narrative
                # or other required fields. Forces a fresh scan.
                if isinstance(cached_result, dict) and cached_result.get("bots") and not cached_result.get("consensus_narrative"):
                    print(f"[INFO] Cache miss (stale: missing consensus_narrative) for {cache_key}")
                    cached_result = None
                    cached_at = None
        except Exception as e:
            # Redis connection failed — log and continue without cache
            print(f"[WARN] Redis cache unavailable: {e}")
            redis_available = False

    # If we have a cached result, stream it back immediately
    if cached_result is not None:
        try:
            metrics = MetricsService(cache.r)
            await metrics.track("scans_total", tags={"chain": chain, "tier": tier_level.value})
            await metrics.track("cache_hits", tags={"chain": chain})
        except Exception:
            pass
        return EventSourceResponse(_replay_cached_scan(cached_result, cached_at))

    # Consume rate limit quota (only if not cached, and not admin)
    daily_scans_remaining = None
    if is_admin:
        daily_scans_remaining = 9999  # Admin: unlimited
    try:
        # Track daily scans in Redis
        today = date.today().isoformat()
        scan_count_key = f"scans:{today}:{identifier}"

        # Get current count
        current_count = await cache.r.get(scan_count_key)
        current_count = int(current_count or 0)

        if current_count >= daily_limit and not is_admin:
            try:
                m = MetricsService(cache.r)
                await m.track("rate_limits", tags={"tier": tier_level.value})
            except Exception:
                pass

            async def _rate_limit_gen():
                yield {
                    "event": "scan:error",
                    "data": json.dumps({
                        "message": f"Daily scan limit reached ({daily_limit}/{daily_limit}). Connect a wallet to unlock more scans.",
                        "code": "RATE_LIMIT",
                        "retryable": False,
                        "limit": daily_limit,
                        "tier": tier_level.value,
                    }),
                }
            return EventSourceResponse(
                _rate_limit_gen(),
                status_code=200,
            )

        # Increment scan count
        pipe = cache.r.pipeline()
        pipe.incr(scan_count_key)
        pipe.expire(scan_count_key, 86400)  # 24 hours
        await pipe.execute()

        daily_scans_remaining = max(daily_limit - current_count - 1, 0)
    except Exception as e:
        # Redis rate limiting failed — log and continue (degrade gracefully)
        print(f"[WARN] Redis rate limiter unavailable: {e}")
        redis_available = False
        daily_scans_remaining = None

    # ---------- Determine which bots to run vs lock ----------
    include_devil = depth_l in {"full", "debate", "standard"} and "DevilsAdvocate" in allowed

    all_bots: List[str] = [
        "TechnicianBot", "SecurityBot", "TokenomicsBot",
        "SocialBot", "MacroBot", "DevilsAdvocate",
    ]

    bots_for_depth = list(all_bots)
    if not include_devil:
        bots_for_depth = [b for b in bots_for_depth if b != "DevilsAdvocate"]

    bots_to_run = [b for b in bots_for_depth if b in allowed]
    bots_locked = [b for b in bots_for_depth if b not in allowed]

    # ---------- Reconnection support ----------
    last_event_id_str = request.headers.get("last-event-id", "")
    try:
        last_event_ts = int(last_event_id_str) if last_event_id_str else None
    except (ValueError, TypeError):
        last_event_ts = None

    # ---------- Event Bus ----------
    bus = ScanEventBus()
    scan_id = uuid.uuid4().hex[:12]

    # Track what we've flushed so far
    flush_cursor: List[int] = [0]  # mutable int wrapped in list for closure

    def _pending_events() -> List[ScanEvent]:
        """Get events we haven't yielded yet."""
        all_events = bus.replay(after_timestamp=last_event_ts)
        result = all_events[flush_cursor[0]:]
        flush_cursor[0] = len(all_events)
        return result

    async def event_generator() -> AsyncGenerator[Dict[str, str], None]:
        scan_start_time = time.perf_counter()

        # ------ Build agent roster ------
        roster: List[AgentInfo] = []
        for bot_name in bots_to_run:
            meta = _AGENT_META.get(bot_name, {})
            roster.append(AgentInfo(
                id=bot_name,
                name=meta.get("name", bot_name),
                display_name=meta.get("display_name", bot_name),
                icon=meta.get("icon", "🤖"),
                color=meta.get("color", "#888888"),
                phase=meta.get("phase", 1),
                category=meta.get("category", ""),
                status="waiting",
            ))
        for bot_name in bots_locked:
            meta = _AGENT_META.get(bot_name, {})
            roster.append(AgentInfo(
                id=bot_name,
                name=meta.get("name", bot_name),
                display_name=meta.get("display_name", bot_name),
                icon=meta.get("icon", "🤖"),
                color=meta.get("color", "#888888"),
                phase=meta.get("phase", 1),
                category=meta.get("category", ""),
                status="locked",
            ))

        # ------ Emit scan:start ------
        bus.emit(scan_start(
            scan_id=scan_id,
            token_address=address,
            chain=chain,
            agents=roster,
            token_name=None,
        ))

        for evt in _pending_events():
            yield evt.to_sse()

        # ------ Fetch token data ------
        try:
            token_data = await scanner._fetch_token_data(address, chain)  # noqa: SLF001
        except Exception as e:
            bus.emit(scan_error(scan_id, str(e), "API_ERROR", True))
            for evt in _pending_events():
                yield evt.to_sse()
            return

        # ------ FREE tier path (heuristic-only fallback when no bots allowed) ------
        if tier_level == TierLevel.FREE and not bots_to_run:
            try:
                ft_result = free_tier_scan(address, chain, fetcher=scanner.fetcher, token_data=token_data)
            except Exception as e:
                bus.emit(scan_error(scan_id, str(e), "API_ERROR", True))
                for evt in _pending_events():
                    yield evt.to_sse()
                return

            scanned_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
            duration_ms = int((time.perf_counter() - scan_start_time) * 1000)
            payload: Dict[str, Any] = {
                "address": getattr(token_data, "contract_address", address),
                "chain": chain,
                "depth": depth_l,
                "tier": tier_level.value,
                "free_tier": True,
                "verdict": getattr(ft_result, "verdict", "UNKNOWN"),
                "reason": getattr(ft_result, "reason", ""),
                "label": getattr(ft_result, "label", None),
                "checks": getattr(ft_result, "checks", {}) or {},
                "score": None,
                "bots": {},
                "locked_bots": list(bots_locked),
                "scanned_at": scanned_at,
            }

            # Add daily scans remaining
            if daily_scans_remaining is not None:
                payload["daily_scans_remaining"] = daily_scans_remaining

            # Store in cache (2-hour TTL)
            if redis_available:
                try:
                    await cache.set_json(cache_key, payload, ttl_s=7200)
                except Exception as e:
                    print(f"[WARN] Failed to cache free tier scan results: {e}")

            bus.emit(scan_complete(
                scan_id=scan_id,
                score=0.0,
                grade="N/A",
                breakdown={},
                debates=[],
                duration_ms=duration_ms,
                agent_count=0,
                full_results=payload,
            ))
            for evt in _pending_events():
                yield evt.to_sse()
            return

        # ------ Token Preprocessor (Fact Oracle) ------
        preprocessed_facts: Optional[PreprocessedFacts] = None
        # Emit SSE immediately so the frontend knows we're working
        yield {
            "event": "preprocess:start",
            "data": json.dumps({"message": "Identifying token..."}),
            "id": str(int(time.time() * 1000)),
        }
        try:
            preprocessed_facts = await preprocess_token(
                token_data, chain, address,
                cache=cache if redis_available else None,
            )
            if preprocessed_facts:
                # Attach to token_data so agents can access it
                token_data.preprocessed_facts = preprocessed_facts  # type: ignore[attr-defined]
                # Emit SSE event so frontend shows instant token identification
                yield {
                    "event": "preprocess:complete",
                    "data": json.dumps({
                        "token_type": preprocessed_facts.token_type,
                        "project_name": preprocessed_facts.project_name,
                        "project_description": preprocessed_facts.project_description,
                        "contract_age_days": preprocessed_facts.contract_age_days,
                        "known_project": preprocessed_facts.known_project,
                        "confidence": preprocessed_facts.confidence,
                    }),
                    "id": str(int(time.time() * 1000)),
                }
            else:
                print(f"[INFO] Preprocessor returned None for {chain}:{address} — agents use raw data")
        except Exception as e:
            print(f"[WARN] Token preprocessor failed (non-fatal): {e}")

        # News pre-fetch removed — models have native real-time news access via
        # Gemini (Google News) and Grok (X/Grokpedia). Better prompts > raw headlines.
            print(f"[WARN] News pre-fetch failed (non-fatal): {e}")

        # ------ Paid-tier: run agents in phased parallel ------
        from src.model_router import get_models_for_tier
        from src.tiers import TierLevel as _TierLevel

        # Map tier string to TierLevel enum for model routing
        _tier_map = {"free": _TierLevel.FREE, "tier_1": _TierLevel.TIER_1, "tier_2": _TierLevel.TIER_2, "tier_3": _TierLevel.TIER_3, "swarm_debate": _TierLevel.SWARM_DEBATE}
        _tier_enum = _tier_map.get(tier.lower(), _TierLevel.FREE)
        _tier_routes = get_models_for_tier(_tier_enum)

        from ..services.scanner import (
            DevilsAdvocate,
            MacroBot,
            SecurityBot,
            SocialBot,
            TechnicianBot,
            TokenomicsBot,
        )

        cls_by_name = {
            "TechnicianBot": TechnicianBot,
            "SecurityBot": SecurityBot,
            "TokenomicsBot": TokenomicsBot,
            "SocialBot": SocialBot,
            "MacroBot": MacroBot,
            "DevilsAdvocate": DevilsAdvocate,
        }

        # Group bots by phase
        bots_by_phase: Dict[int, List[str]] = {}
        for bot_name in bots_to_run:
            phase = _AGENT_META.get(bot_name, {}).get("phase", 1)
            bots_by_phase.setdefault(phase, []).append(bot_name)

        verdicts: Dict[str, Any] = {}
        timings: Dict[str, float] = {}
        _emitted_challenge_pairs.clear()
        debates_log: List[Dict[str, str]] = []

        async def run_bot(bot_name: str) -> Tuple[str, str, Any, Optional[str]]:
            """Run a single bot, returns (name, status, verdict_or_None, error_or_None)."""
            meta = _AGENT_META.get(bot_name, {})
            a_name = meta.get("name", bot_name)
            a_phase = meta.get("phase", 1)

            bus.emit(agent_start(scan_id, bot_name, a_name, a_phase))

            start_ms = time.perf_counter() * 1000
            try:
                bot_cls = cls_by_name[bot_name]
                emitter = _make_emitter(bus, scan_id, bot_name, a_name)
                # Look up routed provider/model for this bot's category
                _cat_remap = {"safety": "security", "contrarian": "devils_advocate"}
                _raw_cat = (_AGENT_META.get(bot_name, {}).get("category", "")).lower()
                _cat_key = _cat_remap.get(_raw_cat, _raw_cat)
                _routed = _tier_routes.get(_cat_key)
                bot = bot_cls(
                    provider_model=_routed if isinstance(_routed, tuple) else None,
                    model_overrides=None,
                    emitter=emitter,
                )

                # Devil's Advocate gets all prior verdicts so it can challenge them
                if bot_name == "DevilsAdvocate" and verdicts:
                    verdict = await anyio.to_thread.run_sync(
                        lambda: bot.analyze(token_data, prior_verdicts=verdicts)
                    )
                else:
                    verdict = await anyio.to_thread.run_sync(bot.analyze, token_data)

                elapsed = time.perf_counter() * 1000 - start_ms
                timings[bot_name] = elapsed

                bus.emit(agent_score(
                    scan_id,
                    bot_name,
                    a_name,
                    getattr(verdict, "category", "") or scanner.engine.agent_category(bot_name) or "",
                    float(verdict.score),
                    0.0,  # per-agent confidence (placeholder)
                ))
                complete_meta: Dict[str, Any] = {}
                if bot_name == "DevilsAdvocate":
                    complete_meta["model_name"] = getattr(bot, "_model", None)
                    complete_meta["powered_by"] = getattr(bot, "_provider", None)
                bus.emit(agent_complete(scan_id, bot_name, a_name, int(elapsed), metadata=complete_meta or None))
                return (bot_name, "complete", verdict, None)
            except Exception as e:
                elapsed = time.perf_counter() * 1000 - start_ms
                print(f"[ERROR] {bot_name} failed ({type(e).__name__}): {e}")
                bus.emit(agent_error(scan_id, bot_name, a_name, str(e), recoverable=False))
                return (bot_name, "error", None, str(e))

        # Execute phases:
        # - Free/scout tier: run bots one at a time for dramatic pacing
        # - Paid tiers: run ALL non-DA bots in parallel, then DA last
        is_sequential = tier in ("free", "scout")
        if is_sequential:
            for phase_num in sorted(bots_by_phase.keys()):
                phase_bots = bots_by_phase[phase_num]
                results = []
                for bot_name in phase_bots:
                    result = await run_bot(bot_name)
                    results.append(result)
                    _, status, verdict, _ = result
                    if status == "complete" and verdict is not None:
                        verdicts[bot_name] = verdict
                        _emit_cross_agent_challenges(bus, scan_id, bot_name, verdict, verdicts)
                    for evt in _pending_events():
                        yield evt.to_sse()
        else:
            # Paid tiers: run all non-DA bots in parallel for speed
            non_da_bots = [b for b in bots_to_run if b != "DevilsAdvocate"]
            da_bots = [b for b in bots_to_run if b == "DevilsAdvocate"]

            # Phase 1: ALL analysis bots in parallel
            if non_da_bots:
                tasks = [run_bot(name) for name in non_da_bots]
                results = await asyncio.gather(*tasks)
                for bot_name, status, verdict, err in results:
                    if status == "complete" and verdict is not None:
                        verdicts[bot_name] = verdict
                for bot_name, status, verdict, _ in results:
                    if status == "complete" and verdict is not None:
                        _emit_cross_agent_challenges(bus, scan_id, bot_name, verdict, verdicts)
                for evt in _pending_events():
                    yield evt.to_sse()

            # Phase 2: Devil's Advocate (needs all prior verdicts)
            if da_bots:
                for bot_name in da_bots:
                    result = await run_bot(bot_name)
                    _, status, verdict, _ = result
                    if status == "complete" and verdict is not None:
                        verdicts[bot_name] = verdict
                for evt in _pending_events():
                    yield evt.to_sse()

        # ------ Cross-agent debates (after all analysis bots, before scoring) ------
        if len(verdicts) > 1:
            await _check_and_run_debates(bus, scan_id, verdicts, scanner, debates_log)
            for evt in _pending_events():
                yield evt.to_sse()
            await _check_cross_category_debates(bus, scan_id, verdicts, scanner, debates_log)
            for evt in _pending_events():
                yield evt.to_sse()

        if "DevilsAdvocate" in verdicts and len(verdicts) > 1:
            _tname = getattr(token_data, "name", "") or ""
            _tsymbol = getattr(token_data, "symbol", "") or ""
            await _run_devils_advocate_debate(
                bus, scan_id, verdicts, scanner, debates_log,
                token_name=_tname, token_symbol=_tsymbol,
            )
            for evt in _pending_events():
                yield evt.to_sse()

        # ------ Iterative Convergence (Phase 2-3) ------
        # Only for paid tiers with 3+ scoring agents (not free tier)
        convergence_result = None
        scoreable_agents = {k: v for k, v in verdicts.items() if k != "DevilsAdvocate"}
        if len(scoreable_agents) >= 3:
            try:
                from src.services.convergence import run_full_convergence, format_convergence_for_narrative, ConvergenceResult
                _tname = getattr(token_data, "name", "") or ""
                _tsymbol = getattr(token_data, "symbol", "") or ""

                bus.emit(debate_start(scan_id, list(scoreable_agents.keys()), "Score Calibration", "Agents reviewing peer analyses and updating scores"))
                for evt in _pending_events():
                    yield evt.to_sse()

                convergence_result = await anyio.to_thread.run_sync(
                    lambda: run_full_convergence(verdicts, token_name=_tname, token_symbol=_tsymbol)
                )

                if convergence_result and convergence_result.total_rounds > 0:
                    # Emit critique events
                    for c in convergence_result.critiques:
                        for target, text in c.critiques.items():
                            target_meta = _AGENT_META.get(target, {})
                            agent_meta = _AGENT_META.get(c.agent_name, {})
                            bus.emit(debate_message(
                                scan_id, c.agent_name, agent_meta.get("name", c.agent_name),
                                f"📋 {text[:250]}",
                                round_num=0, stance="challenge", phase="critique",
                                target_agent=target, target_name=target_meta.get("display_name", target),
                            ))
                    for evt in _pending_events():
                        yield evt.to_sse()

                    # Emit convergence round events
                    for r in convergence_result.rounds:
                        for u in r.updates:
                            if abs(u.updated_score - u.original_score) > 0.1:
                                agent_meta = _AGENT_META.get(u.agent_name, {})
                                direction = "↑" if u.updated_score > u.original_score else "↓"
                                bus.emit(debate_message(
                                    scan_id, u.agent_name, agent_meta.get("name", u.agent_name),
                                    f"{direction} Score adjusted: {u.original_score:.1f} → {u.updated_score:.1f}. {u.explanation[:200]}",
                                    round_num=r.round_num, stance="compromise", phase="convergence",
                                ))
                        for evt in _pending_events():
                            yield evt.to_sse()

                    # Apply converged scores to verdicts
                    from src.scoring_engine import AgentVerdict
                    for agent_name, new_score in convergence_result.final_scores.items():
                        if agent_name in verdicts:
                            old = verdicts[agent_name]
                            verdicts[agent_name] = AgentVerdict(
                                score=new_score,
                                sentiment=old.sentiment,
                                reasoning=old.reasoning,
                                category=old.category,
                                confidence=old.confidence,
                            )

                    σ_final = convergence_result.rounds[-1].std_dev if convergence_result.rounds else 0
                    bus.emit(debate_resolved(
                        scan_id,
                        "consensus" if convergence_result.converged else "deadlock",
                        f"{'Consensus reached' if convergence_result.converged else 'Deadlock'} after {convergence_result.total_rounds} round(s) (σ={σ_final:.2f})",
                        confidence=0.8 if convergence_result.converged else 0.5,
                    ))
                    for evt in _pending_events():
                        yield evt.to_sse()

                    debates_log.append({
                        "topic": "Score Calibration",
                        "resolution": f"{'Consensus' if convergence_result.converged else 'Deadlock'} after {convergence_result.total_rounds} round(s), σ={σ_final:.2f}",
                        "outcome": "consensus" if convergence_result.converged else "deadlock",
                    })

            except Exception as e:
                import traceback
                traceback.print_exc()
                print(f"[CONVERGENCE] Pipeline failed (non-fatal): {e}")

        # ------ Scoring (uses converged scores if available) ------
        print(f"[SCORING DEBUG] verdicts count: {len(verdicts)}, keys: {list(verdicts.keys())}")
        for vname, vobj in verdicts.items():
            print(f"[SCORING DEBUG]   {vname}: score={getattr(vobj, 'score', '?')}, cat={getattr(vobj, 'category', '?')}, conf={getattr(vobj, 'confidence', '?')}")
        result = scanner.engine.score(verdicts) if verdicts else None
        if result:
            print(f"[SCORING DEBUG] engine result: final_score={result.final_score}, category_scores={dict(result.category_scores)}")
        else:
            print(f"[SCORING DEBUG] engine result: None (no verdicts)")

        category_score_map: Dict[str, float] = {}
        if result:
            category_score_map = {str(k): float(v) for k, v in result.category_scores.items()}

        # Fallback: if scoring engine returned empty category scores despite having verdicts,
        # reconstruct category scores directly from collected verdicts.
        if not category_score_map and verdicts:
            grouped_scores: Dict[str, List[float]] = {}
            for bot_name, verdict in verdicts.items():
                category = getattr(verdict, "category", None) or scanner.engine.agent_category(bot_name)
                if not category:
                    continue
                grouped_scores.setdefault(category, []).append(float(verdict.score))
            category_score_map = {
                category: (sum(scores) / len(scores))
                for category, scores in grouped_scores.items()
                if scores
            }

        analysis: Dict[str, Dict[str, Any]] = {
            "technical": {
                "score": float(category_score_map.get("Technical", 0.0)),
                "summary": _bot_summary(verdicts.get("TechnicianBot")),
            },
            "security": {
                "score": float(category_score_map.get("Safety", 0.0)),
                "summary": _bot_summary(verdicts.get("SecurityBot")),
            },
            "tokenomics": {
                "score": float(category_score_map.get("Tokenomics", 0.0)),
                "summary": _bot_summary(verdicts.get("TokenomicsBot")),
            },
            "social": {
                "score": float(category_score_map.get("Social", 0.0)),
                "summary": _bot_summary(verdicts.get("SocialBot")),
            },
            "macro": {
                "score": float(category_score_map.get("Macro", 0.0)),
                "summary": _bot_summary(verdicts.get("MacroBot")),
            },
        }

        bots_out: Dict[str, Any] = {}
        for name, v in verdicts.items():
            agent_conf = getattr(v, 'confidence', None)
            # Treat 0.0 or None confidence as "not set" — default to 1.0
            if agent_conf is None or agent_conf == 0.0:
                agent_conf = 1.0
            # Skip only explicitly negative-confidence agents
            if agent_conf < 0.0:
                continue
            bots_out[name] = {
                "score": float(v.score),
                "sentiment": v.sentiment,
                "category": v.category or scanner.engine.agent_category(name),
                "reasoning": v.reasoning,
                "confidence": agent_conf,
            }

        if result:
            final_score = float(result.final_score)
            # Fallback when scoring engine returns 0.0 despite collected agent verdicts.
            if final_score <= 0.0 and verdicts:
                weighted_scores = [float(v.score) for v in verdicts.values() if float(v.score) > 0]
                if weighted_scores:
                    final_score = sum(weighted_scores) / len(weighted_scores)
        else:
            weighted_scores = [float(v.score) for v in verdicts.values() if float(v.score) > 0]
            final_score = (sum(weighted_scores) / len(weighted_scores)) if weighted_scores else 0.0

        if convergence_result:
            if convergence_result.converged and convergence_result.averaged_score is not None:
                final_score = float(convergence_result.averaged_score)
            elif (not convergence_result.converged) and convergence_result.moderator_verdict is not None:
                moderator_verdict = convergence_result.moderator_verdict
                final_score = float(moderator_verdict.final_score)
                bus.emit(debate_message(
                    scan_id,
                    "Moderator",
                    "Moderator",
                    moderator_verdict.explanation,
                    score=moderator_verdict.final_score,
                    phase="moderator",
                ))
                for evt in _pending_events():
                    yield evt.to_sse()

        grade = _grade_from_score(final_score)

        # Convert to 0-100 scale for frontend
        final_score_100 = round(final_score * 10, 1)

        # ------ Emit scan:consensus ------
        # Map category names to their analysis keys for summary lookup
        _cat_to_analysis = {
            "Technical": "technical", "Safety": "security",
            "Tokenomics": "tokenomics", "Social": "social", "Macro": "macro",
        }
        breakdown: Dict[str, Dict[str, Any]] = {}
        if result:
            for cat in ("Technical", "Safety", "Tokenomics", "Social", "Macro"):
                if cat in result.category_scores:
                    a_key = _cat_to_analysis.get(cat, cat.lower())
                    summary_text = analysis.get(a_key, {}).get("summary", "")
                    # Build findings from bot reasoning
                    findings = []
                    for bname, bdata in bots_out.items():
                        if (bdata.get("category") or "") == cat and bdata.get("reasoning"):
                            # Split reasoning into individual findings
                            for sentence in bdata["reasoning"].replace("\n", ". ").split(". "):
                                s = sentence.strip().rstrip(".")
                                if s and len(s) > 15:
                                    sev = "warning"
                                    if any(w in s.lower() for w in ("verified", "strong", "high liquidity", "active", "substantial", "solid")):
                                        sev = "positive"
                                    if any(w in s.lower() for w in ("critical", "honeypot", "rug", "malicious", "exploit")):
                                        sev = "critical"
                                    findings.append({"severity": sev, "message": s + "."})
                    cat_score = float(result.category_scores[cat])
                    # Skip categories where all agents had zero confidence
                    cat_agents = [v for n, v in verdicts.items()
                                  if (v.category or scanner.engine.agent_category(n)) == cat]
                    if cat_agents and all(getattr(v, 'confidence', 1.0) < 0.1 for v in cat_agents):
                        continue
                    breakdown[cat] = {
                        "score": cat_score,
                        "confidence": result.confidence,
                        "summary": summary_text,
                        "findings": findings[:8],
                    }

        # Add Devil's Advocate to breakdown (unweighted but shown in report)
        da_verdict = verdicts.get("DevilsAdvocate")
        if da_verdict and getattr(da_verdict, "confidence", 0) >= 0.1:
            da_reasoning = getattr(da_verdict, "reasoning", "") or ""
            da_findings = []
            for sentence in da_reasoning.replace("\n", ". ").split(". "):
                s = sentence.strip().rstrip(".")
                if s and len(s) > 15:
                    sev = "warning"
                    if any(w in s.lower() for w in ("critical", "exploit", "rug", "honeypot")):
                        sev = "critical"
                    da_findings.append({"severity": sev, "message": s + "."})
            breakdown["Contrarian"] = {
                "score": float(da_verdict.score),
                "confidence": getattr(da_verdict, "confidence", 0.5),
                "summary": "; ".join(da_reasoning.split(";")[:2]).strip() if da_reasoning else "Devil's Advocate review",
                "findings": da_findings[:6],
            }

        bus.emit(scan_consensus(scan_id, final_score_100, grade, breakdown))
        for evt in _pending_events():
            yield evt.to_sse()

        # Small pause so UI can show consensus animation before complete
        await asyncio.sleep(0.5)

        # ------ Emit scan:complete ------
        scanned_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        duration_ms = int((time.perf_counter() - scan_start_time) * 1000)

        # Generate summary and consensus narrative
        summary = _generate_summary(token_data, final_score, grade, verdicts, analysis)
        # Include convergence context in narrative if available
        _convergence_context = ""
        if convergence_result and convergence_result.total_rounds > 0:
            try:
                from src.services.convergence import format_convergence_for_narrative
                _convergence_context = format_convergence_for_narrative(convergence_result)
            except Exception:
                pass
        if _convergence_context:
            debates_log.append({"topic": "Peer Review", "resolution": _convergence_context[:1000]})
        consensus_narrative = _build_consensus_narrative(
            verdicts, debates_log, final_score, grade,
            token_name=getattr(token_data, "name", "") or "",
            token_symbol=getattr(token_data, "symbol", "") or "",
        )

        # Emit consensus synthesis as a debate event so the IR can animate it.
        # Always emit when narrative exists — even without prior debates, the
        # consensus narrative is the final "verdict summary" that the user sees
        # animated in the Interrogation Room.
        if consensus_narrative:
            bus.emit(debate_message(
                scan_id,
                "SwarmConsensus",
                "Swarm Consensus",
                consensus_narrative,
                round_num=max(len(debates_log), 0) + 1,
                stance="compromise",
                phase="consensus",
            ))
            for evt in _pending_events():
                yield evt.to_sse()

        full_payload: Dict[str, Any] = {
            "address": getattr(token_data, "contract_address", address),
            "chain": chain,
            "depth": depth_l,
            "tier": tier_level.value,
            "score": final_score_100,
            "grade": grade,
            "risk_level": _risk_level(final_score),
            "flags": scanner._flags_from_data(token_data),  # noqa: SLF001
            "analysis": analysis,
            "bots": bots_out,
            "locked_bots": bots_locked,
            "scanned_at": scanned_at,
            "summary": summary,
            "consensus_narrative": consensus_narrative,
            "debates": debates_log,
            # Token metadata for the results UI
            "token": {
                "name": getattr(token_data, "name", "") or "",
                "symbol": getattr(token_data, "symbol", "") or "",
                "price_usd": float(getattr(token_data, "price_usd", 0) or 0),
                "mcap": float(getattr(token_data, "mcap", 0) or 0),
                "volume_24h": float(getattr(token_data, "volume_24h", 0) or 0),
                "liquidity_usd": float(getattr(token_data, "liquidity_usd", 0) or 0),
                "contract_age_days": int(getattr(token_data, "contract_age_days", 0) or 0),
                "contract_verified": bool(getattr(token_data, "contract_verified", False)),
            },
        }

        # Add daily scans remaining to payload
        if daily_scans_remaining is not None:
            full_payload["daily_scans_remaining"] = daily_scans_remaining

        # Store in cache (2-hour TTL)
        if redis_available:
            try:
                await cache.set_json(cache_key, full_payload, ttl_s=7200)
            except Exception as e:
                print(f"[WARN] Failed to cache scan results: {e}")

        bus.emit(scan_complete(
            scan_id=scan_id,
            score=final_score_100,
            grade=grade,
            breakdown=breakdown,
            debates=debates_log,
            duration_ms=duration_ms,
            agent_count=len(verdicts),
            full_results=full_payload,
        ))
        for evt in _pending_events():
            yield evt.to_sse()

        # --- Track metrics (non-fatal) ---
        try:
            metrics = MetricsService(cache.r)
            await metrics.track("scans_total", tags={"chain": chain, "tier": tier_level.value})
            await metrics.track_duration("scan_duration", duration_ms)
        except Exception:
            pass

        # --- On-chain verdict storage (non-fatal) ---
        try:
            from ..services.solana_verdict import store_verdict_onchain
            onchain_result = await store_verdict_onchain(full_payload)
            if onchain_result:
                yield {
                    "event": "verdict:onchain",
                    "data": json.dumps(onchain_result),
                    "id": str(int(time.time() * 1000)),
                }
        except Exception as e:
            print(f"[WARN] On-chain verdict storage failed: {e}")

    return EventSourceResponse(
        event_generator(),
        ping=15,  # sse-starlette built-in keepalive interval (seconds)
    )


# ---------------------------------------------------------------------------
# Debate engine
# ---------------------------------------------------------------------------

async def _check_and_run_debates(
    bus: ScanEventBus,
    scan_id: str,
    verdicts: Dict[str, Any],
    scanner: ScannerService,
    debates_log: List[Dict[str, str]],
) -> None:
    """Check for score disagreements across agents in the same category."""

    by_category: Dict[str, List[Tuple[str, float]]] = {}
    for bot_name, v in verdicts.items():
        cat = getattr(v, "category", None) or scanner.engine.agent_category(bot_name)
        if cat is None:
            continue
        by_category.setdefault(cat, []).append((bot_name, float(v.score)))

    for cat, scores in by_category.items():
        if len(scores) < 2:
            continue
        max_score = max(s for _, s in scores)
        min_score = min(s for _, s in scores)
        if (max_score - min_score) >= DEBATE_THRESHOLD:
            agent_names = [n for n, _ in scores]
            bus.emit(debate_start(
                scan_id,
                agent_names,
                f"{cat} assessment disagreement",
                f"Score spread of {max_score - min_score:.1f} exceeds threshold ({DEBATE_THRESHOLD})",
            ))
            highest = max(scores, key=lambda x: x[1])
            lowest = min(scores, key=lambda x: x[1])
            await _run_debate_rounds(bus, scan_id, highest, lowest, cat, debates_log, verdicts)


async def _check_cross_category_debates(
    bus: ScanEventBus,
    scan_id: str,
    verdicts: Dict[str, Any],
    scanner: ScannerService,
    debates_log: List[Dict[str, str]],
) -> None:
    """Check for meaningful disagreements ACROSS categories.

    e.g., Technical scores high but Security scores low = interesting conflict.
    Only triggers 1 cross-category debate max per scan.
    """
    cat_scores: Dict[str, Tuple[str, float]] = {}
    for bot_name, v in verdicts.items():
        if bot_name == "DevilsAdvocate":
            continue
        cat = getattr(v, "category", None) or scanner.engine.agent_category(bot_name)
        if cat:
            cat_scores[cat] = (bot_name, float(v.score))

    interesting_pairs = [
        ("Technical", "Safety"),
        ("Technical", "Tokenomics"),
        ("Safety", "Social"),
        ("Tokenomics", "Social"),
    ]

    for cat_a, cat_b in interesting_pairs:
        if cat_a not in cat_scores or cat_b not in cat_scores:
            continue
        name_a, score_a = cat_scores[cat_a]
        name_b, score_b = cat_scores[cat_b]
        diff = abs(score_a - score_b)

        if diff < CROSS_CATEGORY_THRESHOLD:
            continue

        higher_name = name_a if score_a > score_b else name_b
        lower_name = name_b if score_a > score_b else name_a
        higher_score = max(score_a, score_b)
        lower_score = min(score_a, score_b)
        higher_cat = cat_a if score_a > score_b else cat_b
        lower_cat = cat_b if score_a > score_b else cat_a

        bus.emit(debate_start(
            scan_id,
            [name_a, name_b],
            f"{higher_cat} vs {lower_cat} conflict",
            f"{higher_cat} scored {higher_score:.1f} but {lower_cat} scored {lower_score:.1f}",
        ))

        # Try AI-generated cross-category analysis
        conflict_analysis = await _ai_debate_call(
            f"""Two AI agents analyzing the same crypto token disagree significantly:

{higher_cat} agent ({higher_name}) scored {higher_score:.1f}/10: {_bot_summary(verdicts.get(higher_name))[:300]}
{lower_cat} agent ({lower_name}) scored {lower_score:.1f}/10: {_bot_summary(verdicts.get(lower_name))[:300]}

In 2 sentences, explain why this conflict matters for investors. What does it mean when {higher_cat} looks good but {lower_cat} looks bad?"""
        )

        if not conflict_analysis:
            conflict_analysis = (
                f"Significant gap between {higher_cat} ({higher_score:.1f}) and "
                f"{lower_cat} ({lower_score:.1f}) assessments — investors should weigh both perspectives."
            )

        lower_meta = _AGENT_META.get(lower_name, {})
        bus.emit(debate_message(
            scan_id, lower_name, lower_meta.get("name", lower_name),
            f"⚡ Cross-examination: {conflict_analysis}",
            round_num=1, stance="challenge",
        ))

        bus.emit(debate_resolved(
            scan_id, "noted",
            f"Cross-category: {higher_cat} ({higher_score:.1f}) vs {lower_cat} ({lower_score:.1f}). {conflict_analysis[:200]}",
            confidence=0.6,
        ))

        debates_log.append({
            "topic": f"{higher_cat} vs {lower_cat}",
            "resolution": conflict_analysis[:800],
        })

        break  # Max 1 cross-category debate per scan


async def _run_debate_rounds(
    bus: ScanEventBus,
    scan_id: str,
    bull: Tuple[str, float],
    bear: Tuple[str, float],
    topic: str,
    debates_log: List[Dict[str, str]],
    verdicts: Optional[Dict[str, Any]] = None,
) -> None:
    """Multi-round debate between two agents with opposing scores."""

    bull_name, bull_score = bull
    bear_name, bear_score = bear
    bull_meta = _AGENT_META.get(bull_name, {})
    bear_meta = _AGENT_META.get(bear_name, {})

    # Extract actual reasoning for richer debate text
    bear_reasoning = _bot_summary(verdicts.get(bear_name)) if verdicts else ""
    bull_reasoning = _bot_summary(verdicts.get(bull_name)) if verdicts else ""
    bear_first = (bear_reasoning.split(".")[0].strip() + ".") if bear_reasoning else "Risk factors detected."
    bull_first = (bull_reasoning.split(".")[0].strip() + ".") if bull_reasoning else "Strong fundamentals detected."
    if len(bear_first) > 150:
        bear_first = bear_first[:147] + "..."
    if len(bull_first) > 150:
        bull_first = bull_first[:147] + "..."

    # Round 1: Bear challenges
    challenge_text = f"I scored {topic} at {bear_score:.1f}/10. {bear_first} {bull_meta.get('display_name', bull_name)} rated it {bull_score:.1f}/10 — that seems overly optimistic."
    bus.emit(debate_message(
        scan_id,
        bear_name,
        bear_meta.get("name", bear_name),
        challenge_text,
        round_num=1,
        stance="challenge",
        phase="challenge",
        target_agent=bull_name,
        target_name=bull_meta.get("display_name", bull_name),
    ))

    # Round 2: Bull defends (AI-powered)
    ai_defense = await _ai_debate_call(
        f"""You are {bull_meta.get('display_name', bull_name)} (score {bull_score:.1f}/10) for {topic}.
{bear_meta.get('display_name', bear_name)} challenged you: "{challenge_text[:300]}"
Your reasoning: "{bull_reasoning[:300]}"
In 2 sentences, defend your score with specific evidence. Be concrete."""
    )
    defense_text = ai_defense or f"My analysis: {bull_first} The data supports my {bull_score:.1f}/10 rating despite the concerns raised."
    bus.emit(debate_message(
        scan_id,
        bull_name,
        bull_meta.get("name", bull_name),
        defense_text,
        round_num=2,
        stance="defend",
        phase="defense",
        target_agent=bear_name,
        target_name=bear_meta.get("display_name", bear_name),
    ))

    # Round 3: Resolution
    midpoint = round((bull_score + bear_score) / 2, 1)
    diff = abs(bull_score - bear_score)

    if diff >= 3.0:
        outcome = "split"
        resolution = f"Split verdict on {topic}: {bull_name} maintains {bull_score:.1f}, {bear_name} maintains {bear_score:.1f}. Users see both positions."
    else:
        outcome = "compromise"
        resolution = f"Compromise reached: {topic} adjusted to {midpoint:.1f}/10 (from {bull_score:.1f} and {bear_score:.1f})"

    ai_resolution = await _ai_debate_call(
        f"""You are {bear_meta.get('display_name', bear_name)} in a debate about {topic}.
You scored {bear_score:.1f}, opponent scored {bull_score:.1f}. After hearing their defense: "{defense_text[:300]}"
{'You agree to compromise at ' + str(midpoint) + '/10.' if outcome == 'compromise' else 'You maintain your position.'}
In 1 sentence, explain your final stance. Be specific about what convinced you (or didn't)."""
    )
    resolution_msg = ai_resolution or f"After considering the evidence, the balanced assessment is closer to {midpoint:.1f}/10."
    bus.emit(debate_message(
        scan_id,
        bear_name,
        bear_meta.get("name", bear_name),
        resolution_msg,
        round_num=3,
        stance="compromise" if outcome == "compromise" else "escalate",
        phase="resolution",
    ))

    bus.emit(debate_resolved(
        scan_id,
        outcome,
        resolution,
        confidence=0.7 if outcome == "compromise" else 0.5,
        adjusted_scores={bull_name: midpoint, bear_name: midpoint} if outcome == "compromise" else None,
    ))

    debates_log.append({
        "topic": topic,
        "resolution": resolution,
        "outcome": outcome,
        "rounds": [
            {
                "phase": "challenge",
                "agent": bear_name,
                "agentName": bear_meta.get("display_name", bear_name),
                "target": bull_name,
                "targetName": bull_meta.get("display_name", bull_name),
                "content": challenge_text,
                "round": 1,
                "stance": "challenge",
            },
            {
                "phase": "defense",
                "agent": bull_name,
                "agentName": bull_meta.get("display_name", bull_name),
                "target": bear_name,
                "targetName": bear_meta.get("display_name", bear_name),
                "content": defense_text,
                "round": 2,
                "stance": "defend",
            },
            {
                "phase": "resolution",
                "agent": bear_name,
                "agentName": bear_meta.get("display_name", bear_name),
                "content": resolution_msg,
                "round": 3,
                "stance": "compromise" if outcome == "compromise" else "escalate",
            },
        ],
    })


async def _run_devils_advocate_debate(
    bus: ScanEventBus,
    scan_id: str,
    verdicts: Dict[str, Any],
    scanner: ScannerService,
    debates_log: List[Dict[str, str]],
    token_name: str = "",
    token_symbol: str = "",
) -> None:
    """Devil's Advocate always challenges the strongest claim.

    Uses real AI (Gemini Flash) to generate genuine debate arguments.
    Falls back to template text if AI calls fail.
    """

    from src.services.ai_debate import generate_agent_defense, generate_da_challenge

    # Find the agent with the highest score (excluding DA itself)
    scored_agents: List[Tuple[str, float]] = []
    for bot_name, v in verdicts.items():
        if bot_name == "DevilsAdvocate":
            continue
        scored_agents.append((bot_name, float(v.score)))

    if not scored_agents:
        return

    target_name, target_score = max(scored_agents, key=lambda x: x[1])
    target_meta = _AGENT_META.get(target_name, {})
    da_meta = _AGENT_META.get("DevilsAdvocate", {})
    da_verdict = verdicts.get("DevilsAdvocate")
    da_score = float(da_verdict.score) if da_verdict else 4.0

    target_cat = getattr(verdicts[target_name], "category", None) or scanner.engine.agent_category(target_name) or "assessment"

    bus.emit(debate_start(
        scan_id,
        ["DevilsAdvocate", target_name],
        f"Challenge: {target_name}'s {target_cat} score of {target_score:.1f}/10",
        "Devil's Advocate always challenges the strongest claim",
    ))

    # ---- Round 1: DA challenges (AI-powered) ----
    da_reasoning = _bot_summary(da_verdict)[:200] if da_verdict else "Multiple hidden risk factors detected"
    da_first_fallback = (da_reasoning.split(".")[0].strip() + ".") if da_reasoning else "Hidden risk factors detected."

    # Generate AI challenge in a thread to avoid blocking the event loop
    ai_challenge = await anyio.to_thread.run_sync(
        lambda: generate_da_challenge(
            verdicts=verdicts,
            target_name=target_name,
            target_score=target_score,
            da_score=da_score,
            token_name=token_name,
            token_symbol=token_symbol,
        )
    )

    if ai_challenge:
        challenge_text = f"⚔️ {ai_challenge}"
    else:
        # Fallback to template
        challenge_text = f"⚔️ I challenge {target_meta.get('display_name', target_name)}'s {target_score:.1f}/10. {da_first_fallback} Score gap: {abs(target_score - da_score):.1f} points."

    bus.emit(debate_message(
        scan_id,
        "DevilsAdvocate",
        da_meta.get("name", "DevilsAdvocate"),
        challenge_text,
        round_num=1,
        stance="challenge",
        phase="challenge",
        target_agent=target_name,
        target_name=target_meta.get("display_name", target_name),
    ))

    # ---- Round 2: Target defends (AI-powered) ----
    target_reasoning = _bot_summary(verdicts[target_name])[:200]
    target_first_fallback = (target_reasoning.split(".")[0].strip() + ".") if target_reasoning else "Strong metrics detected."

    # Use the AI challenge text (or fallback) as the challenge to defend against
    defense_challenge = ai_challenge or challenge_text

    ai_defense = await anyio.to_thread.run_sync(
        lambda: generate_agent_defense(
            verdicts=verdicts,
            target_name=target_name,
            target_score=target_score,
            da_challenge=defense_challenge,
            token_name=token_name,
            token_symbol=token_symbol,
        )
    )

    if ai_defense:
        defense_text = ai_defense
    else:
        # Fallback to template
        defense_text = f"My analysis is data-driven: {target_first_fallback} The metrics support a {target_score:.1f}/10."

    bus.emit(debate_message(
        scan_id,
        target_name,
        target_meta.get("name", target_name),
        defense_text,
        round_num=2,
        stance="defend",
        phase="defense",
        target_agent="DevilsAdvocate",
        target_name=da_meta.get("display_name", "Devil's Advocate"),
    ))

    # ---- Round 3: DA rebuts (AI-powered) ----
    ai_rebuttal = await _ai_debate_call(
        f"""You are the Devil's Advocate. You challenged {target_meta.get('display_name', target_name)} 
(score {target_score:.1f}/10) and they defended with: "{defense_text[:400]}"

Your original challenge was: "{(ai_challenge or challenge_text)[:400]}"

In 2 sentences, give a specific rebuttal. Don't be generic — reference their actual defense 
and explain why the risks you identified still outweigh their points. Be sharp and data-driven."""
    )
    if ai_rebuttal:
        da_rebuttal = f"⚔️ {ai_rebuttal}"
    else:
        da_second = da_reasoning.split(".")
        da_rebuttal_text = (da_second[1].strip() + ".") if len(da_second) > 1 and da_second[1].strip() else da_first_fallback
        da_rebuttal = f"Fair points, but consider: {da_rebuttal_text[:150]} These risks deserve more weight."

    bus.emit(debate_message(
        scan_id,
        "DevilsAdvocate",
        da_meta.get("name", "DevilsAdvocate"),
        da_rebuttal,
        round_num=3,
        stance="escalate",
        phase="rebuttal",
        target_agent=target_name,
        target_name=target_meta.get("display_name", target_name),
    ))

    # ---- Round 4: Resolution ----
    # Collect debate rounds for the results payload
    debate_rounds: List[Dict[str, Any]] = [
        {
            "phase": "challenge",
            "agent": "DevilsAdvocate",
            "agentName": da_meta.get("display_name", "Devil's Advocate"),
            "target": target_name,
            "targetName": target_meta.get("display_name", target_name),
            "content": challenge_text,
            "round": 1,
            "stance": "challenge",
        },
        {
            "phase": "defense",
            "agent": target_name,
            "agentName": target_meta.get("display_name", target_name),
            "target": "DevilsAdvocate",
            "targetName": da_meta.get("display_name", "Devil's Advocate"),
            "content": defense_text,
            "round": 2,
            "stance": "defend",
        },
        {
            "phase": "rebuttal",
            "agent": "DevilsAdvocate",
            "agentName": da_meta.get("display_name", "Devil's Advocate"),
            "target": target_name,
            "targetName": target_meta.get("display_name", target_name),
            "content": da_rebuttal,
            "round": 3,
            "stance": "escalate",
        },
    ]

    diff = abs(target_score - da_score)
    if diff >= 3.0:
        # AI-generated resolution for split verdict
        ai_resolution = await _ai_debate_call(
            f"""You are {target_meta.get('display_name', target_name)} defending your {target_score:.1f}/10 score.
The Devil's Advocate scored {da_score:.1f}/10 and rebutted: "{da_rebuttal[:300]}"
In 1-2 sentences, acknowledge the valid concerns but explain why you stand by your score. Be specific."""
        )
        resolution_text = ai_resolution or "I acknowledge the risk factors but maintain my position based on the on-chain evidence and market data supporting my analysis."
        bus.emit(debate_message(
            scan_id,
            target_name,
            target_meta.get("name", target_name),
            resolution_text,
            round_num=4,
            stance="defend",
            phase="resolution",
        ))
        resolution_summary = f"Split verdict: {target_name} maintains {target_score:.1f}/10, Devil's Advocate maintains {da_score:.1f}/10. Both positions presented to user."
        bus.emit(debate_resolved(
            scan_id,
            "split",
            resolution_summary,
            confidence=0.5,
        ))
        debate_rounds.append({
            "phase": "resolution",
            "agent": target_name,
            "agentName": target_meta.get("display_name", target_name),
            "content": resolution_text,
            "round": 4,
            "stance": "defend",
        })
        debates_log.append({
            "topic": f"Devil's Advocate vs {target_name}",
            "resolution": f"Split: {target_name} {target_score:.1f} vs DA {da_score:.1f}",
            "outcome": "split",
            "rounds": debate_rounds,
        })
    else:
        adjusted = round(target_score - 0.5, 1)
        ai_compromise = await _ai_debate_call(
            f"""You are {target_meta.get('display_name', target_name)}. After debate with Devil's Advocate 
(who rebutted: "{da_rebuttal[:300]}"), you're adjusting your score from {target_score:.1f} to {adjusted:.1f}.
In 1 sentence, explain what specific concern convinced you to adjust. Be concrete, not generic."""
        )
        resolution_text = ai_compromise or f"Valid concerns regarding the risks raised. Adjusting from {target_score:.1f} to {adjusted:.1f} to account for the identified vulnerabilities."
        bus.emit(debate_message(
            scan_id,
            target_name,
            target_meta.get("name", target_name),
            resolution_text,
            round_num=4,
            stance="compromise",
            phase="resolution",
        ))
        resolution_summary = f"Compromise: {target_name}'s {target_cat} score adjusted from {target_score:.1f} to {adjusted:.1f} after Devil's Advocate challenge."
        bus.emit(debate_resolved(
            scan_id,
            "compromise",
            resolution_summary,
            confidence=0.7,
            adjusted_scores={target_name: adjusted},
        ))
        debate_rounds.append({
            "phase": "resolution",
            "agent": target_name,
            "agentName": target_meta.get("display_name", target_name),
            "content": resolution_text,
            "round": 4,
            "stance": "compromise",
        })
        debates_log.append({
            "topic": f"Devil's Advocate vs {target_name}",
            "resolution": f"Compromise: {target_score:.1f} → {adjusted:.1f}",
            "outcome": "compromise",
            "rounds": debate_rounds,
        })


# ---------------------------------------------------------------------------
# SSE formatting helpers
# ---------------------------------------------------------------------------

async def _error_gen(message: str) -> AsyncGenerator[Dict[str, str], None]:
    """Yield a single error event."""
    import json as _json
    yield {
        "event": "scan:error",
        "data": _json.dumps({"message": message, "code": "API_ERROR", "retryable": False}),
    }


async def _replay_cached_scan(cached_data: Dict[str, Any], cached_at: datetime) -> AsyncGenerator[Dict[str, str], None]:
    """Replay a cached scan result as accelerated IR animation.

    Instead of jumping straight to results, we replay agent events with
    short delays so the user still gets the wow-factor animation.
    Entire replay takes ~4-5 seconds (vs 12-40s live scan).
    """
    import json as _json

    scan_id = uuid.uuid4().hex[:12]
    cached_at_str = cached_at.isoformat().replace("+00:00", "Z") if cached_at else None
    ts = lambda: str(int(time.time() * 1000))  # noqa: E731

    bots: Dict[str, Any] = cached_data.get("bots", {})
    token_data = cached_data.get("token", {})
    address = cached_data.get("address", "")
    chain = cached_data.get("chain", "")

    # Agent display info lookup
    AGENT_INFO: Dict[str, Dict[str, str]] = {
        "TechnicianBot": {"displayName": "Technician", "icon": "📊", "color": "#00D4FF", "category": "Technical"},
        "SecurityBot": {"displayName": "Security", "icon": "🔒", "color": "#FF6B6B", "category": "Safety"},
        "TokenomicsBot": {"displayName": "Tokenomics", "icon": "💰", "color": "#FFD700", "category": "Tokenomics"},
        "SocialBot": {"displayName": "Social", "icon": "🐦", "color": "#6B46C1", "category": "Social"},
        "MacroBot": {"displayName": "Macro", "icon": "🌍", "color": "#00D4AA", "category": "Macro"},
        "ScamBot": {"displayName": "Scam Detector", "icon": "🚨", "color": "#FF0055", "category": "Safety"},
        "DevilsAdvocate": {"displayName": "Devil's Advocate", "icon": "😈", "color": "#FF4444", "category": "Debate"},
        "WhaleTracker": {"displayName": "Whale Tracker", "icon": "🐋", "color": "#00BFFF", "category": "On-chain"},
    }

    # --- scan:start ---
    agents_list = []
    for i, bot_name in enumerate(bots.keys()):
        info = AGENT_INFO.get(bot_name, {"displayName": bot_name, "icon": "🤖", "color": "#888", "category": "Analysis"})
        agents_list.append({
            "id": bot_name, "name": bot_name,
            "displayName": info["displayName"], "icon": info["icon"],
            "color": info["color"], "phase": (i // 2) + 1,
            "category": info["category"], "status": "waiting",
        })

    yield {
        "event": "scan:start",
        "data": _json.dumps({
            "tokenAddress": address, "chain": chain,
            "tokenName": token_data.get("name"),
            "agentCount": len(bots),
            "agents": agents_list,
            "cached": True,
        }),
        "id": ts(),
    }
    await asyncio.sleep(0.4)

    # --- Replay each agent (accelerated) ---
    for bot_name, bot_data in bots.items():
        info = AGENT_INFO.get(bot_name, {"displayName": bot_name, "icon": "🤖", "color": "#888", "category": "Analysis"})
        category = bot_data.get("category") or info.get("category") or "Analysis"
        score = bot_data.get("score", 5.0)

        # agent:start
        yield {
            "event": "agent:start",
            "data": _json.dumps({
                "agentId": bot_name, "agentName": info["displayName"],
                "icon": info["icon"], "color": info["color"],
                "phase": 1, "category": category,
                "message": f"{info['displayName']} entering the interrogation room...",
            }),
            "id": ts(),
        }
        await asyncio.sleep(0.3)

        # agent:thinking
        yield {
            "event": "agent:thinking",
            "data": _json.dumps({
                "agentId": bot_name,
                "agentName": info["displayName"],
                "message": f"{info['displayName']} analyzing {category.lower()} data...",
            }),
            "id": ts(),
        }
        await asyncio.sleep(0.4)

        # agent:finding — replay findings from cached data
        findings = bot_data.get("findings") or []
        if not findings and bot_data.get("reasoning"):
            # Parse reasoning into synthetic findings
            reasoning = str(bot_data["reasoning"])
            sentences = [s.strip() for s in reasoning.replace(". ", ".\n").split("\n") if s.strip() and len(s.strip()) > 10]
            for s in sentences[:3]:
                findings.append({"severity": "info", "message": s})
        for finding in findings[:3]:
            yield {
                "event": "agent:finding",
                "data": _json.dumps({
                    "agentId": bot_name,
                    "agentName": info["displayName"],
                    "severity": finding.get("severity", "info"),
                    "message": finding.get("message", ""),
                    "evidence": finding.get("evidence"),
                }),
                "id": ts(),
            }
            await asyncio.sleep(0.15)

        # agent:score + agent:complete
        yield {
            "event": "agent:score",
            "data": _json.dumps({
                "agentId": bot_name, "category": category,
                "score": score, "confidence": 0.85,
            }),
            "id": ts(),
        }
        await asyncio.sleep(0.15)

        yield {
            "event": "agent:complete",
            "data": _json.dumps({
                "agentId": bot_name, "category": category,
                "score": score, "reasoning": bot_data.get("reasoning", ""),
                "message": f"{info['displayName']}: Analysis complete.",
            }),
            "id": ts(),
        }
        await asyncio.sleep(0.3)

    # --- Build breakdown from bot data ---
    breakdown: Dict[str, Any] = {}
    for bot_name, bot_data in bots.items():
        cat = bot_data.get("category") or AGENT_INFO.get(bot_name, {}).get("category") or "Analysis"
        if cat not in breakdown:
            # Rebuild findings from cached data
            cached_findings = bot_data.get("findings") or []
            if not cached_findings and bot_data.get("reasoning"):
                reasoning = str(bot_data["reasoning"])
                for s in reasoning.replace(". ", ".\n").split("\n"):
                    s = s.strip()
                    if s and len(s) > 15:
                        sev = "warning"
                        if any(w in s.lower() for w in ("critical", "exploit", "rug", "honeypot")):
                            sev = "critical"
                        elif any(w in s.lower() for w in ("verified", "mature", "strong", "significant")):
                            sev = "positive"
                        cached_findings.append({"severity": sev, "message": s})
            breakdown[cat] = {
                "score": float(bot_data.get("score", 5.0)),
                "confidence": float(bot_data.get("confidence", 0.85)),
                "summary": bot_data.get("reasoning", ""),
                "findings": cached_findings[:8],
            }

    # --- Replay debates from cached data ---
    # The frontend gates debate visuals behind displayState (derived from pacing
    # queue progress), so these won't flash — they only render after all agent
    # animations have played through the pacing queue.
    cached_debates = cached_data.get("debates", [])
    for debate in cached_debates:
        topic = debate.get("topic", "")
        rounds = debate.get("rounds", [])
        outcome = debate.get("outcome", "")
        resolution = debate.get("resolution", "")

        if not rounds:
            continue

        agents_in_debate = list({r.get("agent", "") for r in rounds if r.get("agent")})
        if not agents_in_debate:
            continue

        yield {
            "event": "debate:start",
            "data": _json.dumps({
                "agents": agents_in_debate,
                "topic": topic,
                "reason": f"Score disagreement on {topic}",
            }),
            "id": ts(),
        }
        await asyncio.sleep(0.4)

        for rnd in rounds:
            phase = rnd.get("phase", "challenge")
            stance_map = {"challenge": "challenge", "defense": "defend", "rebuttal": "challenge", "resolution": "compromise"}
            yield {
                "event": "debate:message",
                "data": _json.dumps({
                    "from": rnd.get("agent", ""),
                    "fromName": rnd.get("agentName", rnd.get("agent", "")),
                    "message": rnd.get("content", ""),
                    "round": rnd.get("round", 1),
                    "stance": rnd.get("stance", stance_map.get(phase, "challenge")),
                    "phase": phase,
                }),
                "id": ts(),
            }
            await asyncio.sleep(0.5)

        if outcome:
            yield {
                "event": "debate:resolved",
                "data": _json.dumps({
                    "outcome": outcome,
                    "resolution": resolution,
                    "confidence": 0.7 if outcome == "compromise" else 0.5,
                }),
                "id": ts(),
            }
            await asyncio.sleep(0.3)

    # --- scan:consensus (triggers lightning bolt / verdict animation) ---
    yield {
        "event": "scan:consensus",
        "data": _json.dumps({
            "score": cached_data.get("score", 0),
            "grade": cached_data.get("grade", "N/A"),
            "narrative": cached_data.get("consensus_narrative", ""),
        }),
        "id": ts(),
    }
    await asyncio.sleep(0.8)

    # --- scan:complete ---
    cached_data_with_meta = dict(cached_data)
    cached_data_with_meta["cached"] = True
    cached_data_with_meta["cached_at"] = cached_at_str

    complete_payload = {
        "score": cached_data.get("score", 0),
        "grade": cached_data.get("grade", "N/A"),
        "breakdown": breakdown,
        "debates": cached_data.get("debates", []),
        "durationMs": 0,
        "agentCount": len(bots),
        "fullResults": cached_data_with_meta,
    }

    yield {
        "event": "scan:complete",
        "data": _json.dumps(complete_payload),
        "id": ts(),
    }
