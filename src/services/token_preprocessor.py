"""Token Preprocessor (Fact Oracle) for VerdictSwarm.

Runs a single AI call *before* any agents to produce a verified fact sheet
about the token.  This fixes the #1 quality problem: agents reasoning on
bad data (e.g. JUP showing as 0 days old).

**Provider cascade** (try in order, stop on first success):
  1. Gemini 2.5 Pro  (Google)
  2. Gemini 2.5 Flash (Google — same API key, cheaper)
  3. Grok             (xAI   — true provider redundancy)
  4. None             (skip  — agents run with raw TokenData only)

**Cache:** Redis (key ``preprocess:{chain}:{address}``, 24 h TTL).

**Fallback:** If ALL providers fail the scan continues unchanged.
"""

from __future__ import annotations

import json
import os
import traceback
from dataclasses import asdict, dataclass, field
from typing import Any, Dict, List, Optional

from src.agents.ai_client import AIClient

# ---------------------------------------------------------------------------
# Structured output dataclass
# ---------------------------------------------------------------------------

@dataclass
class PreprocessedFacts:
    """Verified fact sheet produced by the preprocessor."""

    # Fixed identification fields
    token_type: str = "unknown"                      # Meme, DeFi governance, wrapped, stablecoin, LST, …
    project_name: str = "Unknown"                    # Full project name
    project_description: str = ""                    # One-line description
    contract_age_days: int = 0                       # Verified deploy age
    deploy_date: str = ""                            # YYYY-MM-DD (or "unknown")
    team_status: str = "unknown"                     # Doxxed / anon / pseudonymous / known project
    is_wrapper: bool = False                         # Wrapped version of another token?
    known_project: bool = False                      # Recognised, established project?
    liquidity_status: str = ""                       # Locked / burned / LP description
    contract_verified: bool = False                  # Source code verified on explorer

    # Quality / confidence
    data_gaps: List[str] = field(default_factory=list)   # What data sources were missing
    confidence: float = 0.5                               # 0-1 self-assessed confidence

    # Category-specific context strings (injected into specialist agents)
    technical_context: str = ""
    security_context: str = ""
    tokenomics_context: str = ""
    social_context: str = ""
    macro_context: str = ""

    # Catch-all
    notable_facts: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "PreprocessedFacts":
        """Construct from a dict, ignoring unknown keys."""
        valid = {f.name for f in cls.__dataclass_fields__.values()}  # type: ignore[attr-defined]
        filtered = {k: v for k, v in d.items() if k in valid}
        return cls(**filtered)


# ---------------------------------------------------------------------------
# JSON schema (included verbatim in the prompt so the model knows exactly
# what fields + types to return)
# ---------------------------------------------------------------------------

_OUTPUT_SCHEMA = """\
{
  "token_type": "<string: meme | DeFi governance | wrapped | stablecoin | LST | utility | L1/L2 native | other>",
  "project_name": "<string: full project name>",
  "project_description": "<string: one-line description>",
  "contract_age_days": <integer: verified days since deployment, 0 if unknown>,
  "deploy_date": "<string: YYYY-MM-DD or 'unknown'>",
  "team_status": "<string: doxxed | anon | pseudonymous | known project | unknown>",
  "is_wrapper": <boolean>,
  "known_project": <boolean>,
  "liquidity_status": "<string: description of LP/lock/burn status>",
  "contract_verified": <boolean>,
  "data_gaps": ["<string: describe each data source that was missing or failed>"],
  "confidence": <number 0-1>,
  "technical_context": "<string: key technical/on-chain context for a Technical analyst>",
  "security_context": "<string: key security context for a Security auditor>",
  "tokenomics_context": "<string: key tokenomics context for a Tokenomics specialist>",
  "social_context": "<string: key social/community context for a Social analyst>",
  "macro_context": "<string: key macro/sector context for a Macro strategist>",
  "notable_facts": ["<string: important facts agents should know>"]
}"""

# ---------------------------------------------------------------------------
# Token-type–aware context guidance (included in the prompt)
# ---------------------------------------------------------------------------

_TOKEN_TYPE_GUIDANCE = """\
Tailor the category context fields to what matters most for each token type:

| Token Type       | Emphasise in category contexts                                          |
|-----------------|-------------------------------------------------------------------------|
| Meme coin        | Launch date, distribution, pump/dump history, copycat risk              |
| DeFi governance  | TVL, protocol revenue, governance participation, treasury               |
| Wrapped / LST    | Underlying asset, peg stability, redemption mechanism                   |
| Stablecoin       | Backing composition, depeg history, audit frequency                     |
| New launch (<30d)| Deployer wallet history, initial LP lock, honeypot signals              |
| L1/L2 native     | Network adoption, TVL, validator/staker count, ecosystem growth         |
| Utility          | Real usage metrics, revenue, token burn/buyback, competitive landscape  |
"""

# ---------------------------------------------------------------------------
# Prompt builder
# ---------------------------------------------------------------------------

def _build_prompt(token_data: Any, chain: str, address: str) -> tuple[str, str]:
    """Return (system_prompt, user_prompt) for the preprocessor AI call."""

    system = (
        "You are VerdictSwarm's Token Preprocessor — a factual research layer that runs "
        "BEFORE specialist AI agents. Your job is to produce a verified, structured fact "
        "sheet about the token. You are NOT providing opinions, risk scores, or investment "
        "advice. Only verified facts.\n\n"
        "RULES:\n"
        "1. Cross-reference: If raw data says contract_age_days = 0 but you KNOW this is "
        "   an established project (e.g. Jupiter, Uniswap), use your knowledge and note the "
        "   discrepancy in data_gaps.\n"
        "2. TRUST API DATA for numeric fields: If the API provides a non-zero contract_age_days, "
        "   price, mcap, or volume, COPY the API value exactly — do NOT override with your own estimate. "
        "   For contract_age_days specifically: the API value comes from the blockchain explorer and is "
        "   ALWAYS more accurate than your training data. Only override when API says 0 AND you know better.\n"
        "3. No hallucination: If you don't know something, say 'unknown'. Never guess dates, "
        "   team members, or financial figures.\n"
        "3. Confidence: Set confidence based on how many fields you could verify (1.0 = all "
        "   fields solid, 0.3 = mostly guessing).\n"
        "4. Token-type awareness: Identify the token type FIRST, then fill category contexts "
        "   with what matters most for that type.\n\n"
        f"{_TOKEN_TYPE_GUIDANCE}\n\n"
        "OUTPUT: Return ONLY a valid JSON object matching this schema (no markdown, no extra text):\n"
        f"{_OUTPUT_SCHEMA}"
    )

    # Pull raw fields from TokenData (defensive getattr for every field).
    def _g(attr: str, default: Any = "") -> Any:
        return getattr(token_data, attr, default) or default

    raw_fields = (
        f"Chain: {chain}\n"
        f"Contract/Mint address: {address}\n"
        f"Token name: {_g('name')}\n"
        f"Token symbol: {_g('symbol')}\n"
        f"Contract verified: {bool(_g('contract_verified', False))}\n"
        f"Contract age (days, from API): {int(_g('contract_age_days', 0))}\n"
        f"Creator address: {_g('creator_address')}\n"
        f"Price (USD): {float(_g('price_usd', 0.0))}\n"
        f"Price change 24h (%): {float(_g('price_change_24h', 0.0))}\n"
        f"Volume 24h (USD): {float(_g('volume_24h', 0.0)):,.2f}\n"
        f"Liquidity (USD): {float(_g('liquidity_usd', 0.0)):,.2f}\n"
        f"Market cap (USD): {float(_g('mcap', 0.0)):,.2f}\n"
        f"FDV (USD): {float(_g('fdv', 0.0)):,.2f}\n"
        f"Holder count: {int(_g('holder_count', 0))}\n"
        f"Top 10 holders %: {float(_g('top10_holders_pct', 0.0))}\n"
        f"Tx count 24h: {int(_g('tx_count_24h', 0))}\n"
        f"CoinGecko categories: {_g('coingecko_categories', [])}\n"
        f"Data sources used: {_g('data_sources', [])}\n"
    )

    user = (
        f"Produce a verified fact sheet for this token.\n\n"
        f"== RAW TOKEN DATA (from APIs — may contain errors) ==\n"
        f"{raw_fields}\n"
        f"== END RAW DATA ==\n\n"
        "Cross-reference the raw data with your knowledge. Correct obvious errors "
        "(e.g. contract_age_days = 0 for a well-known project). Fill ALL fields in "
        "the output schema. Return JSON only."
    )

    return system, user


# ---------------------------------------------------------------------------
# Provider cascade
# ---------------------------------------------------------------------------

_CASCADE: list[tuple[str, Optional[str]]] = [
    # (provider, model_override_or_None)
    ("gemini", None),    # will use gemini_pro_model via _call_provider
    ("gemini", None),    # second attempt uses flash (see logic below)
    ("xai", None),       # Grok
]


def _call_provider(
    client: AIClient,
    provider: str,
    model: Optional[str],
    system: str,
    user: str,
    *,
    use_flash: bool = False,
) -> Dict[str, Any]:
    """Make a single chat_json call to a provider. Raises on failure."""

    if not client.has_provider(provider):
        raise RuntimeError(f"Provider {provider} not configured")

    # For Gemini, choose pro or flash explicitly
    if provider == "gemini":
        if use_flash:
            model = model or client.gemini_flash_model
        else:
            model = model or client.gemini_pro_model

    return client.chat_json(
        provider=provider,
        model=model or None,
        system=system,
        user=user,
        temperature=0.1,
        max_output_tokens=1500,
    )


def _run_cascade(
    client: AIClient,
    system: str,
    user: str,
) -> Optional[Dict[str, Any]]:
    """Try providers in cascade order. Return first successful JSON dict or None."""

    cascade_steps = [
        ("gemini", True),    # Gemini Flash (fastest, most reliable)
        ("xai", False),      # Grok (different provider fallback)
    ]

    for provider, use_flash in cascade_steps:
        try:
            if not client.has_provider(provider):
                continue
            result = _call_provider(
                client, provider, None, system, user, use_flash=use_flash,
            )
            if isinstance(result, dict) and result.get("token_type"):
                label = f"{provider}{'(flash)' if use_flash else '(pro)'}"
                print(f"[INFO] Token preprocessor succeeded via {label}")
                return result
        except Exception as e:
            label = f"{provider}{'(flash)' if use_flash else '(pro)'}"
            print(f"[WARN] Token preprocessor {label} failed: {e}")
            continue

    return None


# ---------------------------------------------------------------------------
# Redis cache helpers (async, uses the api Cache service)
# ---------------------------------------------------------------------------

async def _cache_get(cache: Any, chain: str, address: str) -> Optional[PreprocessedFacts]:
    """Try to load cached preprocessed facts. Returns None on miss or error."""
    try:
        key = f"preprocess:{chain}:{address.lower()}"
        result = await cache.r.get(key)
        if result is None:
            return None
        data = json.loads(result if isinstance(result, str) else result.decode("utf-8"))
        return PreprocessedFacts.from_dict(data)
    except Exception as e:
        print(f"[WARN] Preprocessor cache get failed: {e}")
        return None


async def _cache_set(cache: Any, chain: str, address: str, facts: PreprocessedFacts) -> None:
    """Store preprocessed facts in Redis with 24h TTL."""
    try:
        key = f"preprocess:{chain}:{address.lower()}"
        payload = json.dumps(facts.to_dict())
        await cache.r.set(key, payload, ex=86400)  # 24 hours
    except Exception as e:
        print(f"[WARN] Preprocessor cache set failed: {e}")


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def preprocess_token(
    token_data: Any,
    chain: str,
    address: str,
    *,
    cache: Any = None,
) -> Optional[PreprocessedFacts]:
    """Run the Token Preprocessor (Fact Oracle).

    Args:
        token_data: A ``TokenData`` instance from the data fetcher.
        chain: Blockchain identifier (e.g. ``"solana"``, ``"base"``).
        address: Token contract / mint address.
        cache: Optional ``Cache`` instance (with async Redis ``cache.r``).

    Returns:
        ``PreprocessedFacts`` on success, ``None`` if all providers failed
        (agents will run with raw data — current behaviour).
    """

    # --- 1. Check cache ---
    if cache is not None:
        cached = await _cache_get(cache, chain, address)
        if cached is not None:
            print(f"[INFO] Preprocessor cache hit for {chain}:{address}")
            return cached

    # --- 2. Build prompt ---
    try:
        system, user = _build_prompt(token_data, chain, address)
    except Exception as e:
        print(f"[ERROR] Preprocessor prompt build failed: {e}")
        traceback.print_exc()
        return None

    # --- 3. Run provider cascade (synchronous AI calls) ---
    try:
        import anyio
        client = AIClient()
        client.timeout_s = 15.0  # Per-provider timeout (generous for rate limit retries)
        raw = await anyio.to_thread.run_sync(
            lambda: _run_cascade(client, system, user)
        )
    except Exception as e:
        print(f"[ERROR] Preprocessor cascade failed: {e}")
        traceback.print_exc()
        return None

    if raw is None:
        print("[WARN] All preprocessor providers failed — agents will use raw data")
        return None

    # --- 4. Parse into dataclass ---
    try:
        facts = PreprocessedFacts.from_dict(raw)
    except Exception as e:
        print(f"[ERROR] Preprocessor result parsing failed: {e}")
        traceback.print_exc()
        return None

    # --- 5. Store in cache ---
    if cache is not None:
        await _cache_set(cache, chain, address, facts)

    return facts


# ---------------------------------------------------------------------------
# Fact sheet formatting for agent prompt injection
# ---------------------------------------------------------------------------

# Agent name → PreprocessedFacts field for category-specific context
_AGENT_CONTEXT_MAP: Dict[str, str] = {
    "TechnicianBot": "technical_context",
    "SecurityBot": "security_context",
    "TokenomicsBot": "tokenomics_context",
    "SocialBot": "social_context",
    "MacroBot": "macro_context",
    "DevilsAdvocate": "",  # DA gets all context, no specific highlight
}


def format_fact_sheet_for_agent(
    facts: PreprocessedFacts,
    agent_name: str,
) -> str:
    """Format the verified fact sheet as a prompt prefix for a specific agent.

    Returns a string to be prepended to the agent's user prompt. Includes:
    1. Full fact sheet JSON with trust instruction
    2. Category-specific context highlight
    3. Role shift instruction
    """

    fact_dict = facts.to_dict()
    fact_json = json.dumps(fact_dict, indent=2)

    parts: List[str] = []

    # 1. Full fact sheet with trust instruction
    parts.append(
        "== VERIFIED TOKEN FACTS (from preprocessing) ==\n"
        f"{fact_json}\n"
        "== END VERIFIED FACTS ==\n\n"
        "IMPORTANT: The above facts have been verified across multiple data sources. "
        "Use them as ground truth. Do NOT contradict verified facts (e.g., if contract "
        "age is 753 days, do not describe the token as 'newly launched'). If a fact "
        "seems wrong, note the discrepancy but defer to the verified value."
    )

    # 2. Category-specific context highlight
    context_field = _AGENT_CONTEXT_MAP.get(agent_name, "")
    if context_field:
        context_value = getattr(facts, context_field, "")
        if context_value:
            parts.append(
                f"\n\n== KEY CONTEXT FOR YOUR ANALYSIS ==\n"
                f"{context_value}\n"
                f"== END KEY CONTEXT =="
            )

    # 3. Role shift
    parts.append(
        "\n\nYour role is to assess RISK and provide EXPERT OPINION based on the verified "
        "facts above. Focus your analysis on interpretation and implications, not on "
        "re-deriving basic information."
    )

    return "\n".join(parts)


def build_fact_preamble(facts: PreprocessedFacts, agent_category: str = "") -> str:
    """Build the fact sheet preamble to prepend to agent prompts.

    This is a convenience wrapper around :func:`format_fact_sheet_for_agent`
    that accepts a category name instead of an agent name.  Useful when the
    caller has a category string (e.g. "Technical") rather than a bot ID.
    """

    # Reverse-lookup: category → agent name for the context map
    _CATEGORY_TO_AGENT: Dict[str, str] = {
        "Technical": "TechnicianBot",
        "Safety": "SecurityBot",
        "Tokenomics": "TokenomicsBot",
        "Social": "SocialBot",
        "Macro": "MacroBot",
        "Contrarian": "DevilsAdvocate",
    }

    agent_name = _CATEGORY_TO_AGENT.get(agent_category, "")
    return format_fact_sheet_for_agent(facts, agent_name)


def format_degraded_mode_notice() -> str:
    """Return the fallback text when no fact sheet is available."""
    return (
        "No preprocessed fact sheet is available for this token. Analyze the raw token "
        "data directly using your best judgment. Be especially careful about basic facts "
        "like contract age and project identity — verify them from context where possible."
    )


__all__ = [
    "PreprocessedFacts",
    "build_fact_preamble",
    "preprocess_token",
    "format_fact_sheet_for_agent",
    "format_degraded_mode_notice",
]
