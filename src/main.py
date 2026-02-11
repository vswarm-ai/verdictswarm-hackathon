"""Marketing-friendly VerdictSwarm CLI wrapper.

This file exists to support the original demo command shape used in marketing:

    python3 projects/verdictswarm/src/main.py --address 0x... --chain base --tier consensus --debug

It prints an intentionally verbose, colorful *simulated* SWARM DEBATE transcript
suitable for screenshots.

Notes
- The production CLI lives in `projects/verdictswarm/src/__main__.py`.
- This wrapper is stdlib-only and does not require API keys.
"""

from __future__ import annotations

import argparse
import os
import random
import sys
import time
from dataclasses import dataclass
from typing import List, Optional


# --- ANSI helpers (stdlib-only) -------------------------------------------------

RESET = "\x1b[0m"
BOLD = "\x1b[1m"
DIM = "\x1b[2m"

FG_RED = "\x1b[31m"
FG_GREEN = "\x1b[32m"
FG_YELLOW = "\x1b[33m"
FG_BLUE = "\x1b[34m"
FG_MAGENTA = "\x1b[35m"
FG_CYAN = "\x1b[36m"
FG_WHITE = "\x1b[37m"


def _supports_color() -> bool:
    # Respect common env conventions.
    if os.getenv("NO_COLOR"):
        return False
    if (os.getenv("FORCE_COLOR") or "").strip() in {"1", "true", "TRUE", "yes", "YES"}:
        return True
    if not hasattr(sys.stdout, "isatty"):
        return False
    return bool(sys.stdout.isatty())


def c(txt: str, *styles: str, enable: bool = True) -> str:
    if not enable:
        return txt
    return "".join(styles) + txt + RESET


def hr(enable: bool) -> str:
    line = "═" * 74
    return c(line, FG_CYAN, enable=enable)


# --- Simulation -----------------------------------------------------------------

@dataclass
class BotLine:
    prefix: str
    color: str
    lines: List[str]


def _typewriter(line: str, *, enable: bool, delay: float) -> None:
    # For screenshots we default delay=0; keep the option for live demos.
    if delay <= 0:
        print(line)
        return
    for ch in line:
        print(ch, end="", flush=True)
        time.sleep(delay)
    print("")


def simulate_swarm_debate(*, address: str, chain: str, debug: bool, enable_color: bool, delay: float) -> int:
    rand = random.Random(42)  # deterministic transcript for repeatable screenshots

    title = f"VERDICTSWARM // SWARM DEBATE // {chain.upper()}"
    _typewriter(hr(enable_color), enable=enable_color, delay=delay)
    _typewriter(c(f"{title}", BOLD, FG_WHITE, enable=enable_color), enable=enable_color, delay=delay)
    _typewriter(c(f"Target: {address}", FG_WHITE, enable=enable_color), enable=enable_color, delay=delay)
    _typewriter(c("Tier: CONSENSUS  |  Mode: multi-model quorum  |  Trace: --debug", DIM, FG_WHITE, enable=enable_color), enable=enable_color, delay=delay)
    _typewriter(hr(enable_color), enable=enable_color, delay=delay)

    # Phase 0
    _typewriter(c("⚖️  Consensus Protocol Initiated...", BOLD, FG_MAGENTA, enable=enable_color), enable=enable_color, delay=delay)
    _typewriter(c("[orchestrator] quorum=4  threshold=0.70  max_rounds=3  scoring=0–10", FG_MAGENTA, enable=enable_color), enable=enable_color, delay=delay)
    if debug:
        _typewriter(c("[router] models: Gemini(Security), Grok(Social), Codex(Technical), Kimi(Devil'sAdvocate)", DIM, FG_MAGENTA, enable=enable_color), enable=enable_color, delay=delay)
        _typewriter(c("[router] chain=base  datasource=onchain+indexers+social  cache=warm", DIM, FG_MAGENTA, enable=enable_color), enable=enable_color, delay=delay)

    _typewriter("", enable=enable_color, delay=delay)

    # Phase 1
    sections: List[BotLine] = [
        BotLine(
            prefix="🤖 SecurityBot (Gemini)",
            color=FG_CYAN,
            lines=[
                "analyzing bytecode fingerprints…",
                "checking proxy/upgrade patterns…",
                "scanning admin / owner privileges…",
                "simulating transfer() + allowance edge cases…",
                "reviewing liquidity + mint/burn surfaces…",
            ],
        ),
        BotLine(
            prefix="🐦 SocialBot (Grok)",
            color=FG_BLUE,
            lines=[
                "scanning X for narratives + virality…",
                "sampling influencer graph + engagement velocity…",
                "detecting bot-like amplification clusters…",
                "cross-checking ticker collisions + impersonators…",
                "estimating sentiment skew (24h/7d)…",
            ],
        ),
        BotLine(
            prefix="🛠️ TechnicalBot (Codex)",
            color=FG_YELLOW,
            lines=[
                "reconstructing ABI + event surfaces…",
                "reviewing contract ergonomics + integration risk…",
                "checking revert reasons + safe math usage…",
                "profiling gas + common failure modes…",
            ],
        ),
        BotLine(
            prefix="😈 DevilsAdvocate (Kimi)",
            color=FG_RED,
            lines=[
                "stress-testing optimistic assumptions…",
                "enumerating worst-case rug pathways…",
                "flagging unknowns / missing disclosures…",
                "probing distribution + whale concentration risk…",
            ],
        ),
    ]

    for bot in sections:
        _typewriter(c(f"{bot.prefix} ", BOLD, bot.color, enable=enable_color) + c("starting…", bot.color, enable=enable_color), enable=enable_color, delay=delay)
        for step in bot.lines:
            jitter = rand.randint(9, 99)
            suffix = f"{DIM}[{jitter:02d}ms]{RESET}" if enable_color else f"[{jitter:02d}ms]"
            _typewriter(c("  • ", bot.color, enable=enable_color) + c(step, bot.color, enable=enable_color) + " " + suffix, enable=enable_color, delay=delay)
        if debug:
            # Add a few extra "technical" debug lines per bot.
            if "SecurityBot" in bot.prefix:
                _typewriter(c("  ↳ heuristics: honeypot=low  blacklist=none  tax=none  proxy=unknown", DIM, bot.color, enable=enable_color), enable=enable_color, delay=delay)
            if "SocialBot" in bot.prefix:
                _typewriter(c("  ↳ signal: mindshare↑  negative_cluster=small  spam_score=0.12", DIM, bot.color, enable=enable_color), enable=enable_color, delay=delay)
            if "TechnicalBot" in bot.prefix:
                _typewriter(c("  ↳ static: bytecode_size=OK  selector_collisions=none  reentrancy=unlikely", DIM, bot.color, enable=enable_color), enable=enable_color, delay=delay)
            if "DevilsAdvocate" in bot.prefix:
                _typewriter(c("  ↳ pessimistic prior applied: unknown_team penalty=-0.6  docs_gap penalty=-0.4", DIM, bot.color, enable=enable_color), enable=enable_color, delay=delay)
        _typewriter(c("  ✓ subreport committed to quorum buffer", DIM, FG_WHITE, enable=enable_color), enable=enable_color, delay=delay)
        _typewriter("", enable=enable_color, delay=delay)

    # Phase 2
    _typewriter(c("🧠 Round 2: Cross-examination + conflict resolution", BOLD, FG_MAGENTA, enable=enable_color), enable=enable_color, delay=delay)
    _typewriter(c("[moderator] seeking agreement on: safety invariants, social authenticity, execution risk", FG_MAGENTA, enable=enable_color), enable=enable_color, delay=delay)
    if debug:
        _typewriter(c("[moderator] disagreements detected: {" + "social_confidence:±0.12, upgradeability:unknown" + "}", DIM, FG_MAGENTA, enable=enable_color), enable=enable_color, delay=delay)

    _typewriter("", enable=enable_color, delay=delay)

    # Phase 3 (verdict)
    _typewriter(hr(enable_color), enable=enable_color, delay=delay)
    _typewriter(c("✅ VERDICT: SAFE", BOLD, FG_GREEN, enable=enable_color), enable=enable_color, delay=delay)
    _typewriter(c("Score: 8.5/10", BOLD, FG_GREEN, enable=enable_color), enable=enable_color, delay=delay)
    _typewriter(c("Confidence: 78%  |  Risk profile: low–moderate (missing data penalties applied)", FG_GREEN, enable=enable_color), enable=enable_color, delay=delay)
    _typewriter("", enable=enable_color, delay=delay)

    _typewriter(c("Key factors (quorum-shared):", BOLD, FG_WHITE, enable=enable_color), enable=enable_color, delay=delay)
    bullets = [
        "No obvious transfer restrictions or toxic taxes observed in simulated paths",
        "No clear admin backdoors surfaced in quick heuristics (upgradeability remains an unknown)",
        "Liquidity + usage signals appear consistent with organic interest",
        "Social narrative is coherent; low impersonation noise relative to peers",
    ]
    for b in bullets:
        _typewriter(c("  + ", FG_GREEN, enable=enable_color) + c(b, FG_WHITE, enable=enable_color), enable=enable_color, delay=delay)

    _typewriter("", enable=enable_color, delay=delay)
    _typewriter(c("Caveats (DevilsAdvocate):", BOLD, FG_WHITE, enable=enable_color), enable=enable_color, delay=delay)
    caveats = [
        "Verify deployer history + any proxy admin onchain before allocating size",
        "Confirm audits / docs and monitor for sudden permissions changes",
    ]
    for b in caveats:
        _typewriter(c("  - ", FG_YELLOW, enable=enable_color) + c(b, FG_WHITE, enable=enable_color), enable=enable_color, delay=delay)

    _typewriter(hr(enable_color), enable=enable_color, delay=delay)
    return 0


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="verdictswarm", add_help=True)
    p.add_argument("--address", required=True, help="Token contract address (0x…)")
    p.add_argument("--chain", default="base", help="Chain name (default: base)")
    p.add_argument("--tier", default="consensus", help="Tier (marketing aliases: consensus)")
    p.add_argument("--debug", action="store_true", help="Verbose trace output")
    p.add_argument(
        "--delay",
        type=float,
        default=0.0,
        help="Optional typewriter delay per character (seconds). Default 0 for screenshots.",
    )
    return p


def main(argv: Optional[List[str]] = None) -> int:
    args = build_parser().parse_args(argv)

    # Marketing alias: "consensus" implies a swarm debate transcript.
    tier = str(args.tier or "").strip().lower()
    if tier not in {"consensus", "swarm", "swarm_debate", "debate"}:
        # Keep it permissive; still run simulation.
        pass

    enable_color = _supports_color()
    return simulate_swarm_debate(
        address=str(args.address),
        chain=str(args.chain or "base"),
        debug=bool(args.debug),
        enable_color=enable_color,
        delay=float(args.delay or 0.0),
    )


if __name__ == "__main__":
    raise SystemExit(main())
