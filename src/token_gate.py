"""Token-gating utilities.

Token gating is based on an ERC-20 balance on Base.

Goals for MVP:
- stdlib-first, but allow optional web3 if installed
- cache balance lookups (TTL)
- support mock balances when token not configured

Environment:
- BASE_RPC_URL / VSWARM_RPC_URL: Base JSON-RPC endpoint
- VSWARM_TOKEN_ADDRESS: ERC-20 token contract address (set after listing)
- VSWARM_MOCK_BALANCE: integer/float token balance returned for any wallet (dev)
- VSWARM_TIER_1_THRESHOLD: default 1000 tokens
- VSWARM_TIER_2_THRESHOLD: default 5000 tokens

Query param support (wired in auth middleware):
- ?mock_balance=5000 overrides balance for testing
"""

from __future__ import annotations

import os
import time
from dataclasses import dataclass
from typing import Callable, Dict, Optional, Tuple

from .tiers import TierLevel


BalanceProvider = Callable[[str], float]


def _env_int(name: str, default: int) -> int:
    v = os.getenv(name)
    if v is None or str(v).strip() == "":
        return int(default)
    try:
        return int(float(v))
    except ValueError:
        return int(default)


def get_tier_for_balance(balance: float) -> str:
    """Map a human-readable token balance to tier string."""

    tier_1 = float(_env_int("VSWARM_TIER_1_THRESHOLD", 1000))
    tier_2 = float(_env_int("VSWARM_TIER_2_THRESHOLD", 5000))

    b = float(balance or 0.0)
    if b >= tier_2:
        return "TIER_2"
    if b >= tier_1:
        return "TIER_1"
    return "FREE"


def _tierlevel_from_tier_str(tier: str) -> TierLevel:
    t = (tier or "").strip().upper()
    if t == "TIER_2":
        return TierLevel.TIER_2
    if t == "TIER_1":
        return TierLevel.TIER_1
    return TierLevel.FREE


@dataclass
class _CacheEntry:
    ts: float
    balance: float


class TokenGate:
    """Resolve a wallet's token balance and map it to a tier."""

    def __init__(
        self,
        *,
        balance_provider: Optional[BalanceProvider] = None,
        cache_ttl_s: int = 60,
    ) -> None:
        self._cache_ttl_s = int(cache_ttl_s)
        self._cache: Dict[str, _CacheEntry] = {}
        self._balance_provider = balance_provider or self._default_balance_provider

    def _default_balance_provider(self, wallet: str) -> float:
        """Default provider.

        Order of precedence:
        1) VSWARM_MOCK_BALANCE env var (dev)
        2) On-chain ERC-20 balanceOf on Base (if token + RPC configured)
        3) Fallback to 0

        Returns a *human readable* balance (tokens, not wei).
        """

        mock = os.getenv("VSWARM_MOCK_BALANCE")
        if mock is not None and str(mock).strip() != "":
            try:
                return float(mock)
            except ValueError:
                return 0.0

        token_addr = os.getenv("VSWARM_TOKEN_ADDRESS", "0x0000000000000000000000000000000000000000")
        rpc_url = os.getenv("BASE_RPC_URL") or os.getenv("VSWARM_RPC_URL")
        if not rpc_url or token_addr.lower() == "0x0000000000000000000000000000000000000000":
            return 0.0

        # Prefer web3.py if available (already installed in many envs)
        try:
            from web3 import Web3

            w3 = Web3(Web3.HTTPProvider(rpc_url))
            if not w3.is_connected():
                return 0.0

            abi = [
                {
                    "name": "balanceOf",
                    "type": "function",
                    "stateMutability": "view",
                    "inputs": [{"name": "account", "type": "address"}],
                    "outputs": [{"name": "", "type": "uint256"}],
                },
                {
                    "name": "decimals",
                    "type": "function",
                    "stateMutability": "view",
                    "inputs": [],
                    "outputs": [{"name": "", "type": "uint8"}],
                },
            ]
            contract = w3.eth.contract(address=Web3.to_checksum_address(token_addr), abi=abi)
            decimals = int(contract.functions.decimals().call())
            raw = int(contract.functions.balanceOf(Web3.to_checksum_address(wallet)).call())
            return raw / (10 ** decimals)
        except Exception:
            pass

        # Fallback: raw JSON-RPC eth_call (assumes decimals=18 if decimals() fails)
        try:
            import httpx

            selector_balance = "70a08231"  # balanceOf(address)
            addr = wallet.lower().replace("0x", "").rjust(64, "0")
            data = "0x" + selector_balance + addr
            payload = {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "eth_call",
                "params": [{"to": token_addr, "data": data}, "latest"],
            }
            with httpx.Client(timeout=10.0) as client:
                r = client.post(rpc_url, json=payload)
                r.raise_for_status()
                j = r.json()

            result = j.get("result")
            if not isinstance(result, str) or not result.startswith("0x"):
                return 0.0
            raw = int(result, 16)

            # Try decimals()
            selector_decimals = "313ce567"  # decimals()
            payload_dec = {
                "jsonrpc": "2.0",
                "id": 2,
                "method": "eth_call",
                "params": [{"to": token_addr, "data": "0x" + selector_decimals}, "latest"],
            }
            decimals = 18
            try:
                with httpx.Client(timeout=10.0) as client:
                    r2 = client.post(rpc_url, json=payload_dec)
                    r2.raise_for_status()
                    j2 = r2.json()
                res2 = j2.get("result")
                if isinstance(res2, str) and res2.startswith("0x"):
                    decimals = int(res2, 16)
            except Exception:
                decimals = 18

            return raw / (10 ** int(decimals))
        except Exception:
            return 0.0

    def get_balance(self, wallet: str) -> float:
        wallet_n = (wallet or "").strip().lower()
        if not wallet_n:
            return 0.0

        now = time.time()
        cached = self._cache.get(wallet_n)
        if cached and (now - cached.ts) <= self._cache_ttl_s:
            return cached.balance

        balance = float(self._balance_provider(wallet_n) or 0.0)
        self._cache[wallet_n] = _CacheEntry(ts=now, balance=balance)
        return balance

    def tier_for_wallet(self, wallet: str, *, mock_balance: Optional[float] = None) -> Tuple[TierLevel, float]:
        """Return (TierLevel, human_balance) for a wallet."""

        bal = float(mock_balance) if mock_balance is not None else self.get_balance(wallet)
        tier_str = get_tier_for_balance(bal)
        return _tierlevel_from_tier_str(tier_str), bal
