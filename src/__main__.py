"""VerdictSwarm CLI (real data MVP).

Goal usage:
    python3 -m projects.verdictswarm.src 0x... --chain base

This entrypoint fetches real TokenData via DataFetcher, runs the MVP agents,
aggregates with ScoringEngine, and prints a formatted scorecard.

Token gating:
- You can pass --wallet to auto-resolve a tier from token balance.
- Or pass --tier to override (useful for testing).
- --debate is only allowed for the SWARM_DEBATE tier.

Notes:
- SocialBot and MacroBot are still mock placeholders.
- We keep dependencies stdlib-only.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from typing import Dict, List, Optional, Set

try:
    from .agents import DevilsAdvocate, MacroBot, SecurityBot, SocialBot, TechnicianBot, TokenomicsBot  # type: ignore
    from .agents.scam_bot import ScamBot  # type: ignore
    from .data_fetcher import DataFetcher, TokenData  # type: ignore
    from .scoring_engine import AgentVerdict, ScoringEngine  # type: ignore
    from .tier_config import allowed_bots_for_tier, can_use_swarm_debate, get_rate_limit  # type: ignore
    from .tiers import TierLevel, tier_badge, tier_name  # type: ignore
    from .token_gate import TokenGate  # type: ignore
    from .model_router import get_models_for_tier  # type: ignore
    from .rate_limiter import RateLimiter, RateLimitExceeded  # type: ignore
    from .burn_tracker import BurnTracker  # type: ignore
    from .token_whitelist import get_whitelist_info  # type: ignore
except ImportError:  # pragma: no cover
    from agents import DevilsAdvocate, MacroBot, SecurityBot, SocialBot, TechnicianBot, TokenomicsBot
    from agents.scam_bot import ScamBot
    from data_fetcher import DataFetcher, TokenData
    from scoring_engine import AgentVerdict, ScoringEngine
    from tier_config import allowed_bots_for_tier, can_use_swarm_debate, get_rate_limit
    from tiers import TierLevel, tier_badge, tier_name
    from token_gate import TokenGate
    from model_router import get_models_for_tier
    from rate_limiter import RateLimiter, RateLimitExceeded
    from burn_tracker import BurnTracker
    from token_whitelist import get_whitelist_info


BORDER = "═" * 51


_ADDR_RE = __import__("re").compile(r"^0x[a-fA-F0-9]{40}$")


def _validate_address(addr: str) -> str:
    a = (addr or "").strip()
    if not _ADDR_RE.match(a):
        raise ValueError("Invalid address format (expected 0x + 40 hex chars)")
    return a


def _sentiment_label(score: float) -> str:
    if score >= 6.5:
        return "bullish"
    if score <= 3.5:
        return "bearish"
    return "neutral"


def _category_reasoning(engine: ScoringEngine, verdicts: Dict[str, AgentVerdict], category: str) -> str:
    by_cat = engine.verdict_breakdown_by_category(verdicts)
    items = by_cat.get(category, [])
    if not items:
        return "(no data)"
    # One agent per category in MVP; join if more.
    reasons = []
    for agent, v in items:
        r = (v.reasoning or "").strip()
        if r:
            reasons.append(r)
        else:
            reasons.append(f"{agent}: (no reasoning)")
    return " | ".join(reasons)


def _print_scorecard(
    *,
    token_data: TokenData,
    chain: str,
    engine: ScoringEngine,
    verdicts: Dict[str, AgentVerdict],
    result,
    flags: List[str],
    tier: TierLevel,
    balance: int,
    debate: bool,
    quota_limit: int,
    quota_remaining: int,
) -> None:
    name = token_data.name or "Unknown"
    symbol = token_data.symbol or "?"
    address = token_data.contract_address

    print(BORDER)
    print(f" VERDICTSWARM ANALYSIS: {name} ({symbol})")
    print(f" Chain: {chain} | Contract: {address}")
    print(f" Access: {tier_badge(tier)} {tier_name(tier)} | Balance: {balance:,}")
    if quota_limit > 0:
        print(f" Quota: {quota_remaining}/{quota_limit} remaining today")
    if debate:
        print(" Mode: SWARM DEBATE (multi-model consensus)")
    print(BORDER)
    print()

    sentiment = _sentiment_label(result.final_score)
    confidence_pct = int(round(float(result.confidence or 0.0) * 100))

    print(f" FINAL SCORE: {result.final_score:.2f}/10 ({sentiment})")
    print(f" Confidence: {confidence_pct}%")
    print()

    print(" Category Breakdown:")
    for cat, label in [
        ("Technical", "Technical"),
        ("Safety", "Safety"),
        ("Tokenomics", "Tokenomics"),
        ("Social", "Social"),
        ("Macro", "Macro"),
    ]:
        s = result.category_scores.get(cat, None)
        s_out = f"{s:.2f}/10" if s is not None else "(n/a)"
        reasoning = _category_reasoning(engine, verdicts, cat)
        print(f"   {label:<10} {s_out:<8} - {reasoning}")

    print()
    print(" Flags:")
    if not flags:
        print("   (none)")
    else:
        for f in flags:
            for line in str(f).splitlines() or [str(f)]:
                print(f"   {line}")

    print()
    print(BORDER)


def _run_agents(
    token_data: TokenData,
    allowed: Set[str],
    *,
    model_plan: Optional[Dict[str, object]] = None,
) -> Dict[str, AgentVerdict]:
    # NOTE: SocialBot/MacroBot are AI-backed; if the relevant provider/context isn't
    # available, we skip them so the scoring engine renormalizes weights instead of
    # dragging scores toward 5.0.
    try:
        from .agents.ai_client import AIClient  # type: ignore
    except Exception:  # pragma: no cover
        from agents.ai_client import AIClient  # type: ignore

    bots = [
        TechnicianBot,
        SecurityBot,
        TokenomicsBot,
        SocialBot,
        MacroBot,
        DevilsAdvocate,
    ]

    # Map bot → routing key
    bot_key = {
        "TechnicianBot": "technical",
        "TechnicalBot": "technical",
        "SecurityBot": "security",
        "TokenomicsBot": "tokenomics",
        "SocialBot": "social",
        "MacroBot": "macro",
        "DevilsAdvocate": "devils_advocate",
    }

    verdicts: Dict[str, AgentVerdict] = {}
    for bot_cls in bots:
        # Instantiate first so we can check its stable name.
        tmp = bot_cls()
        if tmp.name not in allowed:
            continue

        if bool(str(__import__("os").environ.get("VERDICTSWARM_DEBUG", "")).strip()):
            print(f"[debug] agent start: {tmp.name}", file=__import__("sys").stderr, flush=True)

        key = bot_key.get(tmp.name)
        routed = None
        if key and isinstance(model_plan, dict):
            routed = model_plan.get(key)
        provider_model = routed if isinstance(routed, tuple) and len(routed) == 2 else None

        # Skip AI-only agents if provider/context isn't available.
        if tmp.name == "SocialBot":
            # SocialBot requires xAI (or routed provider).
            client = AIClient()
            p = (provider_model[0] if provider_model else "xai")
            if not client.has_provider(p):
                continue
        if tmp.name == "MacroBot":
            # MacroBot only makes sense when macro_context is attached OR AI is available.
            macro_context = getattr(token_data, "macro_context", None)
            client = AIClient()
            p = (provider_model[0] if provider_model else "gemini")
            if macro_context is None and not client.has_provider(p):
                continue

        bot = bot_cls(provider_model=provider_model)
        verdicts[bot.name] = bot.analyze(token_data)

        if bool(str(__import__("os").environ.get("VERDICTSWARM_DEBUG", "")).strip()):
            print(f"[debug] agent done: {bot.name}", file=__import__("sys").stderr, flush=True)

    return verdicts


def _scam_flags(token_data: TokenData) -> List[str]:
    scam = getattr(token_data, "scam_analysis", None)
    if scam is None:
        return []

    out: List[str] = []
    rec = str(getattr(scam, "recommendation", "") or "").strip()
    scam_score = float(getattr(scam, "scam_score", 0.0) or 0.0)
    signals = getattr(scam, "signals_detected", []) or []

    # Whitelist note (if present)
    details = getattr(scam, "signal_details", {}) or {}
    wl = details.get("whitelist") if isinstance(details, dict) else None
    if isinstance(wl, dict) and wl.get("is_whitelisted") and isinstance(wl.get("info"), dict):
        info = wl.get("info") or {}
        out.append(f"Note: This token is on the VerdictSwarm whitelist ({info.get('name')} by {info.get('issuer')})")

    if rec:
        out.append(f"ScamBot: {rec} (score {scam_score:.0f}/100)")
    if signals:
        sig_names = [getattr(s, "value", str(s)) for s in signals]
        out.append("Signals: " + ", ".join(sig_names))

    explanation = str(getattr(scam, "explanation", "") or "").strip()
    if explanation:
        out.append(explanation)

    return out


def _parse_tier(s: Optional[str]) -> Optional[TierLevel]:
    if not s:
        return None
    s2 = str(s).strip().lower()
    for t in TierLevel:
        if s2 == t.value:
            return t
    # convenience aliases
    aliases = {
        "investigator": TierLevel.TIER_1,
        "vigilante": TierLevel.TIER_2,
        "whale": TierLevel.TIER_3,
        "swarm": TierLevel.SWARM_DEBATE,
        "debate": TierLevel.SWARM_DEBATE,
    }
    return aliases.get(s2)


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="verdictswarm", add_help=True)

    # CLI shape:
    #   python -m verdictswarm report 0x... --chain ethereum --format md
    # Back-compat:
    #   python -m verdictswarm 0x...
    #   python -m verdictswarm analyze 0x...
    p.add_argument("command", nargs="?", help="Subcommand: report|analyze (default: report)")
    p.add_argument("address", nargs="?", help="Token contract address (0x…)")
    p.add_argument("address2", nargs="?", help=argparse.SUPPRESS)

    p.add_argument("--chain", default="base", help="Chain name (default: base)")

    p.add_argument("--wallet", default=None, help="Wallet address for token-gated tier resolution")
    p.add_argument(
        "--tier",
        default=None,
        help="Override tier (free|tier_1|tier_2|tier_3|swarm_debate) or aliases (investigator/vigilante/whale)",
    )
    p.add_argument(
        "--debate",
        action="store_true",
        help="Enable Swarm Debate mode (requires swarm_debate tier)",
    )
    p.add_argument(
        "--format",
        default="cli",
        choices=["cli", "md", "json", "tweet"],
        help="Output format (default: cli). Debate mode supports md/json.",
    )

    p.add_argument(
        "--check-quota",
        action="store_true",
        help="Print remaining daily quota for the resolved tier/wallet and exit.",
    )

    return p


def main(argv: Optional[List[str]] = None) -> int:
    args = build_parser().parse_args(argv)

    debug = bool(str(__import__("os").environ.get("VERDICTSWARM_DEBUG", "")).strip())
    def dprint(msg: str) -> None:
        if debug:
            print(f"[debug] {msg}", file=sys.stderr, flush=True)

    # Command parsing:
    # - If the first token is a known subcommand, use it.
    # - Otherwise treat it as the address and default to `report`.
    command = (args.command or "").strip().lower()

    if command in {"report", "analyze"}:
        address = args.address
        # Back-compat: `python -m verdictswarm analyze 0x...` previously used positional shift.
        if not address and args.address2:
            address = args.address2
    else:
        address = args.command  # first positional is actually the address
        command = "report"

    if address == "analyze":  # super-legacy shape: `python -m ... analyze 0x...`
        address = args.address
        command = "analyze"

    if not address:
        sys.stderr.write("Error: contract address required\n")
        return 2

    try:
        address = _validate_address(str(address))
    except ValueError as e:
        sys.stderr.write(f"Error: {e}\n")
        return 2

    chain = str(args.chain or "base")

    dprint("parsed args")

    # Resolve tier
    override_tier = _parse_tier(args.tier)
    wallet = (args.wallet or "").strip()
    balance = 0

    if override_tier is not None:
        tier = override_tier
    elif wallet:
        gate = TokenGate()
        tier, balance = gate.tier_for_wallet(wallet)
    else:
        tier = TierLevel.FREE

    # Enforce Swarm Debate restrictions
    debate = bool(args.debate)
    if debate and not can_use_swarm_debate(tier):
        sys.stderr.write("Error: --debate requires SWARM_DEBATE tier\n")
        return 2

    # Model routing (per tier)
    model_plan = get_models_for_tier(tier)

    # Rate limiting (local JSON-backed)
    limiter = RateLimiter()
    quota = limiter.get_quota(wallet=wallet or "local", tier=tier)

    if bool(args.check_quota):
        # No network calls; just print quota.
        if quota.limit > 0:
            print(f"Tier: {tier.value} ({tier_name(tier)})")
            print(f"Daily limit: {quota.limit}")
            print(f"Used today: {quota.used}")
            print(f"Remaining today: {quota.remaining}")
            if tier == TierLevel.SWARM_DEBATE:
                print("Note: SWARM_DEBATE allows over-limit usage via burn-per-extra debate.")
        else:
            print(f"Tier: {tier.value} ({tier_name(tier)})")
            print("Daily limit: unlimited")
        return 0

    # Enforce limits before any analysis work.
    try:
        quota_after, exceeded = limiter.check_and_increment(
            wallet=wallet or "local",
            tier=tier,
            units=1,
            allow_overage=bool(tier == TierLevel.SWARM_DEBATE and debate),
        )
    except RateLimitExceeded as e:
        sys.stderr.write(
            f"Error: daily quota exceeded for {e.tier.value}: used {e.used}/{e.limit}. "
            "Try again tomorrow or upgrade tiers.\n"
        )
        return 2

    burn_notice: Optional[str] = None
    if exceeded and tier == TierLevel.SWARM_DEBATE and debate:
        # Over-limit debates require simulated burn logging.
        burn = BurnTracker()
        extra_index = max(1, quota_after.used - quota.limit)
        ev = burn.record_extra_debate(wallet=wallet or "local", extra_index=extra_index)
        burn_notice = f"Extra debate #{extra_index} today → simulated burn {ev.burn_amount} $VSWARM (logged)"

    allowed = allowed_bots_for_tier(tier)

    fetcher = DataFetcher()

    # Validate that the address is actually a contract (EOA => clear error).
    dprint("checking is_contract_address")
    is_contract = fetcher.is_contract_address(address, chain=chain)
    dprint(f"is_contract_address={is_contract}")
    if is_contract is False:
        sys.stderr.write("Error: Not a contract address (EOA has no code)\n")
        return 2

    dprint("fetching token data")
    token_data = fetcher.fetch(address, chain=chain)
    dprint(f"token data fetched (sources={token_data.data_sources})")

    # ScamBot gating
    if "ScamBot" in allowed and token_data.source_code:
        scam = asyncio.run(
            ScamBot().analyze(
                {
                    "contract_source": token_data.source_code,
                    "contract_address": token_data.contract_address,
                    "chain": chain,
                    "contract_age_days": token_data.contract_age_days,
                    "volume_24h": token_data.volume_24h,
                    "contract_verified": token_data.contract_verified,
                    "liquidity_usd": token_data.liquidity_usd,
                }
            )
        )
        setattr(token_data, "scam_analysis", scam)

    if debate:
        # Swarm Debate mode: multi-model protocol (Gemini/Grok/Kimi/Codex) to reach consensus.
        try:
            from .debate_integration import format_debate_report_md, run_swarm_debate  # type: ignore
        except ImportError:  # pragma: no cover
            from debate_integration import format_debate_report_md, run_swarm_debate

        try:
            debate_payload = asyncio.run(
                run_swarm_debate(
                    token_data,
                    chain=chain,
                    max_rounds=4,
                    models=model_plan.get("swarm_debate") or ["gemini", "grok", "kimi", "codex"],
                )
            )
        except Exception as e:
            sys.stderr.write(f"Error running swarm debate: {e}\n")
            return 2

        if burn_notice:
            sys.stderr.write(burn_notice + "\n")

        # Output
        fmt = str(args.format or "cli").strip().lower()
        if fmt in {"md", "cli"}:
            md = format_debate_report_md(
                token_data=token_data,
                chain=chain,
                tier_label=f"{tier_badge(tier)} {tier_name(tier)}",
                balance=balance,
                debate_result=debate_payload,
            )
            print(md)
        elif fmt == "json":
            print(json.dumps(debate_payload, ensure_ascii=False, indent=2))
        else:
            sys.stderr.write("Error: --format tweet is not supported in --debate mode\n")
            return 2

        return 0

    # Normal (non-debate) scoring pipeline
    dprint("running agents")
    verdicts = _run_agents(token_data, allowed, model_plan=model_plan)
    dprint(f"agents complete: {list(verdicts.keys())}")

    # Whitelist boost: if token is known legit, apply a final score floor.
    wl_info = get_whitelist_info(address, chain)
    wl_floor = None
    if isinstance(wl_info, dict) and wl_info.get("min_score") is not None:
        try:
            base_floor = float(wl_info.get("min_score"))
            bonus = 0.0
            # Extra boost when we have other strong "safe" confirmations.
            if bool(getattr(token_data, "contract_verified", False)):
                bonus += 0.2
            scam = getattr(token_data, "scam_analysis", None)
            if scam is not None:
                scam_score = float(getattr(scam, "scam_score", 100.0) or 100.0)
                rec = str(getattr(scam, "recommendation", "") or "").upper().strip()
                if scam_score < 20 and rec == "SAFE":
                    bonus += 0.3
            wl_floor = min(10.0, base_floor + bonus)
        except Exception:
            wl_floor = None

    # If no scorable categories are present, fall back to neutral scoring.
    engine = ScoringEngine(missing_category_policy="neutral" if not verdicts else "renormalize")
    result = engine.score(verdicts, title=f"{token_data.symbol or address}", final_floor=wl_floor)

    # Flags: ScamBot + DevilsAdvocate
    flags: List[str] = []
    flags.extend(_scam_flags(token_data))

    da = verdicts.get("DevilsAdvocate")
    if da and (da.reasoning or "").strip():
        flags.append(f"DevilsAdvocate: {da.reasoning.strip()}")

    _print_scorecard(
        token_data=token_data,
        chain=chain,
        engine=engine,
        verdicts=verdicts,
        result=result,
        flags=flags,
        tier=tier,
        balance=balance,
        debate=debate,
        quota_limit=quota_after.limit,
        quota_remaining=quota_after.remaining,
    )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
