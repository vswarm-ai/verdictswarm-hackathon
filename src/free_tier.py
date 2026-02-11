"""Free-tier legitimacy scan.

The FREE tier should be a cheap, credibility-preserving "legitimacy checker".

Key principles:
- No AI calls
- No numeric 0-10 scoring
- Only basic, explainable vitals

This module is stdlib-only.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from typing import Any, Dict, Optional

from .data_fetcher import CHAIN_IDS, COINGECKO_PLATFORMS, DataFetcher, TokenData


@dataclass(frozen=True)
class FreeTierResult:
    verdict: str  # HEALTHY | UNHEALTHY | UNKNOWN
    reason: str = ""
    label: str = ""  # e.g., "Verified Blue Chip"
    checks: Dict[str, Any] | None = None


def _norm_addr(addr: str) -> str:
    return (addr or "").strip().lower()


def _load_bluechip_whitelist() -> Dict[str, Dict[str, str]]:
    """Load whitelist mapping: {chain: {symbol_or_name: address}}.

    File lives at repo_root/data/bluechip_whitelist.json.
    """

    here = os.path.dirname(__file__)
    repo_root = os.path.abspath(os.path.join(here, os.pardir))
    path = os.path.join(repo_root, "data", "bluechip_whitelist.json")
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, dict):
            return data  # type: ignore[return-value]
    except Exception:
        pass
    return {}


def _is_bluechip(address: str, chain: str) -> Optional[str]:
    wl = _load_bluechip_whitelist()
    chain_key = (chain or "").lower().strip()
    by_chain = wl.get(chain_key)
    if not isinstance(by_chain, dict):
        return None

    addr_n = _norm_addr(address)
    for symbol, addr in by_chain.items():
        if isinstance(addr, str) and _norm_addr(addr) == addr_n:
            return str(symbol)
    return None


def free_tier_scan(
    address: str,
    chain: str,
    *,
    fetcher: Optional[DataFetcher] = None,
    token_data: Optional[TokenData] = None,
) -> FreeTierResult:
    """Run FREE tier legitimacy scan.

    Uses the existing DataFetcher (DexScreener + Etherscan V2) to keep costs low.
    """

    chain_l = (chain or "base").lower().strip()

    bluechip_symbol = _is_bluechip(address, chain_l)
    if bluechip_symbol:
        return FreeTierResult(
            verdict="HEALTHY",
            reason="Token is on the blue-chip whitelist.",
            label=f"Verified Blue Chip ({bluechip_symbol})",
            checks={"bluechip": True, "bluechip_symbol": bluechip_symbol},
        )

    f = fetcher or DataFetcher()
    td = token_data or f.fetch(address, chain_l)

    token_age_days = int(getattr(td, "contract_age_days", 0) or 0)
    liquidity_usd = float(getattr(td, "liquidity_usd", 0.0) or 0.0)
    holder_count = int(getattr(td, "holder_count", 0) or 0)
    contract_verified = bool(getattr(td, "contract_verified", False))

    checks: Dict[str, Any] = {
        "contract_verified": contract_verified,
        "token_age_days": token_age_days,
        "liquidity_usd": liquidity_usd,
        "holder_count": holder_count,
        "has_liquidity_pool": bool(liquidity_usd > 0),
        "data_sources": list(getattr(td, "data_sources", []) or []),
        "chain": chain_l,
        "chain_id": CHAIN_IDS.get(chain_l),
        "coingecko_platform": COINGECKO_PLATFORMS.get(chain_l),
    }

    if not contract_verified:
        return FreeTierResult(verdict="UNHEALTHY", reason="Contract not verified", checks=checks)
    if liquidity_usd < 1000:
        return FreeTierResult(verdict="UNHEALTHY", reason="Very low liquidity", checks=checks)
    if token_age_days < 1 and liquidity_usd < 10000:
        return FreeTierResult(verdict="UNKNOWN", reason="Too new to assess", checks=checks)

    return FreeTierResult(verdict="HEALTHY", reason="Basic vitals look healthy", checks=checks)
