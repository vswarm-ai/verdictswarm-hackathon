"""Token whitelist utilities.

Known legitimate tokens that should skip aggressive scam heuristics
or receive significant mitigation/score floors.

This is intentionally lightweight and dependency-free.
"""

from __future__ import annotations

from typing import Dict, Optional


# Known legitimate tokens that should skip aggressive checks
# or receive significant score boosts
WHITELISTED_TOKENS: Dict[str, Dict[str, Dict[str, object]]] = {
    "base": {
        "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913": {"name": "USDC", "issuer": "Circle", "min_score": 8.0},
        "0x4200000000000000000000000000000000000006": {"name": "WETH", "issuer": "Canonical", "min_score": 9.0},
        "0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b": {
            "name": "VIRTUAL",
            "issuer": "Virtuals Protocol",
            "min_score": 7.0,
        },
        "0x50dA645f148798F68EF2d7dB7C1CB22A6819bb2C": {"name": "AIXBT", "issuer": "Virtuals Protocol", "min_score": 7.0},
    },
    "ethereum": {
        "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48": {"name": "USDC", "issuer": "Circle", "min_score": 8.0},
        "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2": {"name": "WETH", "issuer": "Canonical", "min_score": 9.0},
        "0xdAC17F958D2ee523a2206206994597C13D831ec7": {"name": "USDT", "issuer": "Tether", "min_score": 7.5},
    },
}


def is_whitelisted(address: str, chain: str) -> bool:
    """Check if token is on the whitelist."""

    chain_tokens = WHITELISTED_TOKENS.get((chain or "").lower(), {})
    addr = (address or "").strip().lower()
    return addr in {k.lower() for k in chain_tokens.keys()}


def get_whitelist_info(address: str, chain: str) -> Optional[Dict[str, object]]:
    """Get whitelist info for a token."""

    chain_tokens = WHITELISTED_TOKENS.get((chain or "").lower(), {})
    addr = (address or "").strip().lower()
    for a, info in chain_tokens.items():
        if a.lower() == addr:
            return dict(info)
    return None
