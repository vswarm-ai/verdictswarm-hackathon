"""VerdictSwarm DataFetcher.

This module provides a dependency-free data backbone for the VerdictSwarm MVP.

Goals:
- Fetch basic market data from DexScreener (no auth)
- Fetch basic on-chain / contract metadata from Basescan (Etherscan-compatible API)
- Degrade gracefully: if one source fails, still return partial TokenData

Only Python stdlib is used (urllib/json/dataclasses).
"""

from __future__ import annotations

import json
import os
import time
import socket
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional
from urllib.error import URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

try:
    import base58
except ImportError:
    base58 = None  # type: ignore

# Extra guardrail: fail outbound HTTP within a reasonable bound to avoid CLI hangs
socket.setdefaulttimeout(10.0)


DEX_SCREENER_TOKEN_URL = "https://api.dexscreener.com/latest/dex/tokens/{address}"
# Maps symbol → (contract_address, chain). Chain is used to override the default.
TOKEN_OVERRIDES: Dict[str, tuple] = {
    "ENA": ("0x57e114B691Db790C35207b2e685D4A43181e6061", "ethereum"),
    "PEPE": ("0x6982508145454Ce325dDbE47a25d4ec3d2311933", "ethereum"),
    "UNI": ("0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984", "ethereum"),
    "LINK": ("0x514910771AF9Ca656af840dff83E8264EcF986CA", "ethereum"),
    "AAVE": ("0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9", "ethereum"),
    "ARB": ("0xB50721BCf8d664c30412Cfbc6cf7a15145234ad1", "arbitrum"),
    "DOGE": ("0x4206931337dc273a630d328dA6441786BfaD668f", "ethereum"),
    "SHIB": ("0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE", "ethereum"),
    "MATIC": ("0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0", "ethereum"),
    "MKR": ("0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2", "ethereum"),
    "CRV": ("0xD533a949740bb3306d119CC777fa900bA034cd52", "ethereum"),
    "LDO": ("0x5A98FcBEA516Cf06857215779Fd812CA3beF1B32", "ethereum"),
    "SNX": ("0xC011a73ee8576Fb46F5E1c5751cA3B9Fe0af2a6F", "ethereum"),
    "COMP": ("0xc00e94Cb662C3520282E6f5717214004A7f26888", "ethereum"),
    "GRT": ("0xc944E90C64B2c07662A292be6244BDf05Cda44a7", "ethereum"),
    "FET": ("0xaea46A60368A7bD060eec7DF8CBa43b7EF41Ad85", "ethereum"),
    "INJ": ("0xe28b3B32B6c345A34Ff64674606124Dd5Aceca30", "ethereum"),
    "RNDR": ("0x6De037ef9aD2725EB40118Bb1702EBb27e4Aeb24", "ethereum"),
    "WLD": ("0x163f8C2467924be0ae7B5347228CABF260318753", "ethereum"),
    "APE": ("0x4d224452801ACEd8B2F0aebE155379bb5D594381", "ethereum"),
    "CHZ": ("0x3506424F91fD33084466F402d5D97f05F8e3b4AF", "ethereum"),
    "SAND": ("0x3845badAde8e6dFF049820680d1F14bD3903a5d0", "ethereum"),
    "MANA": ("0x0F5D2fB29fb7d3CFeE444a200298f468908cC942", "ethereum"),
    "IMX": ("0xF57e7e7C23978C3cAEC3C3548E3D615c346e79fF", "ethereum"),
    "OP": ("0x4200000000000000000000000000000000000042", "optimism"),
    "BLUR": ("0x5283D291DBCF85356A21bA090E6db59121208b44", "ethereum"),
    "PENDLE": ("0x808507121B80c02388fAd14726482e061B8da827", "ethereum"),
    "SOL": ("So11111111111111111111111111111111111111112", "solana"),
    "JUP": ("JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN", "solana"),
    "WIF": ("EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm", "solana"),
    "BONK": ("DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", "solana"),
}
# CoinGecko: contract address lookup
COINGECKO_CONTRACT_URL = "https://api.coingecko.com/api/v3/coins/{chain}/contract/{address}"
# Etherscan V2 API (unified across all chains)
ETHERSCAN_V2_API_URL = "https://api.etherscan.io/v2/api"

# Supported chains and their IDs
CHAIN_IDS = {
    "ethereum": "1",
    "eth": "1",
    "base": "8453",
    "arbitrum": "42161",
    "arb": "42161",
    "optimism": "10",
    "op": "10",
    "polygon": "137",
    "matic": "137",
    "bsc": "56",
    "bnb": "56",
    "avalanche": "43114",
    "avax": "43114",
}
DEFAULT_CHAIN = "base"

# Map VerdictSwarm chain names -> CoinGecko platform ids.
# Ref: https://docs.coingecko.com/reference/coins-contract-address
COINGECKO_PLATFORMS = {
    "ethereum": "ethereum",
    "eth": "ethereum",
    "base": "base",
    "arbitrum": "arbitrum-one",
    "arb": "arbitrum-one",
    "optimism": "optimistic-ethereum",
    "op": "optimistic-ethereum",
    "polygon": "polygon-pos",
    "matic": "polygon-pos",
    "bsc": "binance-smart-chain",
    "bnb": "binance-smart-chain",
    "avalanche": "avalanche",
    "avax": "avalanche",
    "solana": "solana",
    "sol": "solana",
}

# Solana RPC endpoint (public or Helius)
SOLANA_RPC = os.environ.get("HELIUS_RPC_URL", "https://api.mainnet-beta.solana.com")


def is_solana_address(address: str) -> bool:
    """Check if address is a valid Solana address (base58, 32-44 chars)."""
    if not address or address.startswith("0x"):
        return False
    if base58 is None:
        # Fallback: pattern matching if base58 not available
        import re
        return bool(re.match(r"^[1-9A-HJ-NP-Za-km-z]{32,44}$", address))
    try:
        decoded = base58.b58decode(address)
        return len(decoded) == 32
    except Exception:
        return False


@dataclass
class TokenData:
    # Basic info
    contract_address: str
    name: str
    symbol: str

    # On-chain (from Basescan)
    contract_verified: bool
    tx_count_24h: int
    creator_address: str
    contract_age_days: int

    # Market (from DexScreener)
    price_usd: float
    price_change_24h: float
    volume_24h: float
    liquidity_usd: float
    mcap: float
    fdv: float

    # Metadata
    fetch_timestamp: int
    data_sources: List[str]

    # Optional fields (defaults)
    holder_count: Optional[int] = None
    top10_holders_pct: Optional[float] = None
    source_code: Optional[str] = None  # Contract source if verified

    # CoinGecko metadata (best-effort)
    coingecko_categories: List[str] = field(default_factory=list)

    # Chain identifier
    chain: str = "ethereum"  # ethereum, base, solana, etc.

    # Global macro context (best-effort from CoinGecko /global)
    macro_context: Optional[str] = None


class DataFetcher:
    """Fetch token data from public APIs.

    Supports multiple chains via Etherscan V2 API:
        - ethereum/eth, base, arbitrum/arb, optimism/op
        - polygon/matic, bsc/bnb, avalanche/avax

    Timeouts:
        Each request uses a 5s timeout to keep scoring responsive.
    """

    def __init__(self, *, timeout_s: float = 5.0) -> None:
        self._timeout_s = float(timeout_s)

    def is_contract_address(self, address: str, chain: str = DEFAULT_CHAIN) -> Optional[bool]:
        """Best-effort check whether an address has contract code.

        Uses the Etherscan V2 "proxy" module (eth_getCode).

        Returns:
            True/False when determinable, otherwise None on network/API errors.
        """

        addr = (address or "").strip()
        chain_lower = (chain or DEFAULT_CHAIN).lower().strip()
        chain_id = CHAIN_IDS.get(chain_lower, CHAIN_IDS[DEFAULT_CHAIN])

        try:
            payload = self._etherscan_call(
                {
                    "module": "proxy",
                    "action": "eth_getCode",
                    "address": addr,
                    "tag": "latest",
                },
                chain_id,
            )
            code = payload.get("result")
            if not isinstance(code, str):
                return None
            # Common results: "0x" (EOA), or "0x6000..." (contract)
            if code.strip().lower() in {"0x", "0x0", ""}:
                return False
            return True
        except Exception:
            return None

    def fetch(self, contract_address: str, chain: str = DEFAULT_CHAIN) -> TokenData:
        """Fetch TokenData for the given contract address.
        
        Args:
            contract_address: The token contract address or symbol override (e.g., ENA).
            chain: Chain name (base, ethereum, arbitrum, optimism, polygon, bsc, avalanche).
                   Aliases supported: eth, arb, op, matic, bnb, avax.
        """
        resolved = (contract_address or "").strip()
        override = TOKEN_OVERRIDES.get(resolved.upper())
        if override:
            addr, override_chain = override
            chain_lower = override_chain.lower()
        else:
            addr = resolved
            chain_lower = chain.lower().strip()
        chain_id = CHAIN_IDS.get(chain_lower, CHAIN_IDS[DEFAULT_CHAIN])
        ts = int(time.time())
        data_sources: List[str] = []

        # Defaults (partial results are fine).
        out = TokenData(
            contract_address=addr,
            name="",
            symbol="",
            chain=chain_lower,
            coingecko_categories=[],
            contract_verified=False,
            tx_count_24h=0,
            holder_count=None,
            top10_holders_pct=None,
            creator_address="",
            contract_age_days=0,
            price_usd=0.0,
            price_change_24h=0.0,
            volume_24h=0.0,
            liquidity_usd=0.0,
            mcap=0.0,
            fdv=0.0,
            source_code=None,
            fetch_timestamp=ts,
            data_sources=data_sources,
        )

        # CoinGecko metadata (categories)
        try:
            cats = self._fetch_coingecko_categories(addr, chain_lower)
            if cats:
                out.coingecko_categories = cats
                data_sources.append("coingecko")
        except Exception:
            pass

        # Market data (DexScreener)
        dex_tx_count = 0
        try:
            dex = self._fetch_dexscreener(addr)
            if dex:
                out.name = dex.get("name", out.name)
                out.symbol = dex.get("symbol", out.symbol)
                out.price_usd = dex.get("price_usd", out.price_usd)
                out.price_change_24h = dex.get("price_change_24h", out.price_change_24h)
                out.volume_24h = dex.get("volume_24h", out.volume_24h)
                out.liquidity_usd = dex.get("liquidity_usd", out.liquidity_usd)
                out.mcap = dex.get("mcap", out.mcap)
                out.fdv = dex.get("fdv", out.fdv)
                dex_tx_count = int(dex.get("tx_count_24h", 0) or 0)
                # Use pair age as fallback for contract age if Etherscan fails
                pair_age = int(dex.get("pair_age_days", 0) or 0)
                if pair_age > 0 and not out.contract_age_days:
                    out.contract_age_days = pair_age
                data_sources.append("dexscreener")
        except Exception:
            # Degrade gracefully.
            pass

        # On-chain data (Etherscan V2)
        try:
            base = self._fetch_etherscan(addr, chain_id)
            if base:
                out.contract_verified = bool(base.get("contract_verified", out.contract_verified))
                out.source_code = base.get("source_code", out.source_code)
                out.creator_address = base.get("creator_address", out.creator_address)
                etherscan_tx = int(base.get("tx_count_24h", 0) or 0)
                # Prefer DexScreener tx count if Etherscan returns 0 (common for proxy contracts)
                out.tx_count_24h = etherscan_tx if etherscan_tx > 0 else dex_tx_count
                raw_holders = base.get("holder_count")
                out.holder_count = int(raw_holders) if raw_holders else out.holder_count
                raw_top10 = base.get("top10_holders_pct")
                out.top10_holders_pct = float(raw_top10) if raw_top10 else out.top10_holders_pct
                out.contract_age_days = int(base.get("contract_age_days", out.contract_age_days) or 0)

                # Prefer Basescan name/symbol only if DexScreener didn't give it.
                if not out.name:
                    out.name = base.get("name", out.name)
                if not out.symbol:
                    out.symbol = base.get("symbol", out.symbol)

                # Keep legacy label used in tests/docs.
                data_sources.append("basescan")
        except Exception:
            pass

        # Final fallback: use DexScreener tx count if still 0
        if out.tx_count_24h == 0 and dex_tx_count > 0:
            out.tx_count_24h = dex_tx_count

        try:
            macro = self._fetch_macro_context()
            if macro:
                out.macro_context = macro
        except Exception:
            pass  # macro context is best-effort, never block the scan

        return out

    def fetch_solana_token_data(self, mint_address: str) -> TokenData:
        """Fetch TokenData for a Solana token.

        Args:
            mint_address: The Solana mint address.

        Returns:
            TokenData with Solana-specific fields populated.
        """
        addr = (mint_address or "").strip()
        ts = int(time.time())
        data_sources: List[str] = []

        # Defaults
        out = TokenData(
            contract_address=addr,
            name="",
            symbol="",
            chain="solana",
            coingecko_categories=[],
            contract_verified=False,
            tx_count_24h=0,
            holder_count=None,
            top10_holders_pct=None,
            creator_address="",
            contract_age_days=0,
            price_usd=0.0,
            price_change_24h=0.0,
            volume_24h=0.0,
            liquidity_usd=0.0,
            mcap=0.0,
            fdv=0.0,
            source_code=None,
            fetch_timestamp=ts,
            data_sources=data_sources,
        )

        # 1) Market data (DexScreener — works for Solana!)
        try:
            dex = self._fetch_dexscreener(addr)
            if dex:
                out.name = dex.get("name", out.name)
                out.symbol = dex.get("symbol", out.symbol)
                out.price_usd = dex.get("price_usd", out.price_usd)
                out.price_change_24h = dex.get("price_change_24h", out.price_change_24h)
                out.volume_24h = dex.get("volume_24h", out.volume_24h)
                out.liquidity_usd = dex.get("liquidity_usd", out.liquidity_usd)
                out.mcap = dex.get("mcap", out.mcap)
                out.fdv = dex.get("fdv", out.fdv)
                out.tx_count_24h = int(dex.get("tx_count_24h", 0) or 0)
                # Use pair creation date for contract age on Solana (no Etherscan equivalent)
                pair_age = int(dex.get("pair_age_days", 0) or 0)
                if pair_age > 0:
                    out.contract_age_days = pair_age
                data_sources.append("dexscreener")
        except Exception:
            pass

        # 2) On-chain data (Solana RPC)
        try:
            # Get account info to verify token exists
            account_info = self._solana_rpc_call("getAccountInfo", [
                addr,
                {"encoding": "jsonParsed"}
            ])

            result = account_info.get("result")
            if result and result.get("value"):
                # Token account exists on-chain. Note: Solana SPL tokens do NOT have
                # the same concept of "verified source code" as EVM contracts.
                # We keep contract_verified=False — the chain-aware AI prompts handle this.
                parsed_data = result.get("value", {}).get("data")
                if isinstance(parsed_data, dict) and parsed_data.get("parsed"):
                    data_sources.append("solana-rpc")

                    # Try to extract token info from parsed data
                    parsed = parsed_data.get("parsed", {})
                    if isinstance(parsed, dict):
                        info = parsed.get("info", {})
                        if isinstance(info, dict):
                            # Some tokens have metadata in the info field
                            pass

            # Get token supply
            try:
                supply_resp = self._solana_rpc_call("getTokenSupply", [addr])
                supply_result = supply_resp.get("result")
                if supply_result and "value" in supply_result:
                    # Supply data available
                    pass
            except Exception:
                pass

        except Exception:
            # Solana RPC failed — degrade gracefully
            pass

        # 2b) Holder count + top holder analysis via Helius getTokenAccounts
        try:
            helius_url = os.environ.get("HELIUS_RPC_URL", "").strip()
            if helius_url:
                import urllib.request, json as _json

                def _helius_get_token_accounts(mint: str, limit: int = 1000, page: int = 1) -> dict:
                    payload = _json.dumps({
                        "jsonrpc": "2.0",
                        "id": "holder-count",
                        "method": "getTokenAccounts",
                        "params": {"mint": mint, "limit": limit, "page": page}
                    }).encode()
                    req = urllib.request.Request(helius_url, data=payload, headers={"Content-Type": "application/json"})
                    with urllib.request.urlopen(req, timeout=8.0) as resp:
                        return _json.loads(resp.read())

                # Page 1: get total count + first batch of holders
                result = _helius_get_token_accounts(addr, limit=1000, page=1)
                token_accounts = result.get("result", {}).get("token_accounts", [])
                total = result.get("result", {}).get("total", 0)

                if total and int(total) > 0:
                    out.holder_count = int(total)
                    data_sources.append("helius-holders")
                    print(f"[SolanaFetch] Holder count for {addr}: {out.holder_count}")

                    # Calculate top 10 holder concentration from the first page
                    # Sort by amount (descending) to find largest holders
                    amounts = []
                    for acct in token_accounts:
                        amt = float(acct.get("amount", 0) or 0)
                        if amt > 0:
                            amounts.append(amt)

                    if amounts:
                        amounts.sort(reverse=True)
                        total_in_page = sum(amounts)
                        top10_sum = sum(amounts[:10])

                        # Get total supply for accurate % calculation
                        try:
                            supply_resp = self._solana_rpc_call("getTokenSupply", [addr])
                            supply_val = supply_resp.get("result", {}).get("value", {})
                            total_supply = float(supply_val.get("amount", 0) or 0)
                            decimals = int(supply_val.get("decimals", 0) or 0)
                            if total_supply > 0 and decimals > 0:
                                # amounts from Helius are raw (no decimals), supply amount is also raw
                                top10_pct = (top10_sum / total_supply) * 100.0
                                out.top10_holders_pct = round(top10_pct, 2)
                                print(f"[SolanaFetch] Top10 holders for {addr}: {out.top10_holders_pct}%")
                        except Exception as e:
                            print(f"[SolanaFetch] Supply fetch for top10 calc failed: {e}")
        except Exception as e:
            print(f"[SolanaFetch] Helius holder data failed (non-fatal): {type(e).__name__}: {e}")

        # 3) CoinGecko (if Solana token is listed)
        try:
            cats = self._fetch_coingecko_categories(addr, "solana")
            if cats:
                out.coingecko_categories = cats
                data_sources.append("coingecko")
        except Exception:
            pass

        # 4) Well-known Solana tokens — ALWAYS override (DexScreener returns "Wrapped SOL" for native SOL)
        _KNOWN_SOLANA: Dict[str, dict] = {
            "So11111111111111111111111111111111111111111": {
                "name": "Solana", "symbol": "SOL",
                "contract_age_days": 1600, "contract_verified": True,
                "holder_count": 500_000_000, "top10_holders_pct": 3.5,
                "mcap": 95_000_000_000, "volume_24h": 3_000_000_000,
                "liquidity_usd": 50_000_000_000,
            },
            "So11111111111111111111111111111111111111112": {
                "name": "Solana", "symbol": "SOL",
                "contract_age_days": 1600, "contract_verified": True,
                "holder_count": 500_000_000, "top10_holders_pct": 3.5,
                "mcap": 95_000_000_000, "volume_24h": 3_000_000_000,
                "liquidity_usd": 50_000_000_000,
            },
            "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v": {
                "name": "USD Coin", "symbol": "USDC",
                "contract_age_days": 1400, "contract_verified": True,
            },
            "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB": {
                "name": "Tether USD", "symbol": "USDT",
                "contract_age_days": 1200, "contract_verified": True,
            },
        }
        known = _KNOWN_SOLANA.get(addr)
        if known:
            out.name = known["name"]
            out.symbol = known["symbol"]
            # Enrich with known metadata so AI doesn't get sparse data
            if known.get("contract_age_days") and not out.contract_age_days:
                out.contract_age_days = known["contract_age_days"]
            if known.get("contract_verified"):
                out.contract_verified = True
            # Populate market/holder data for native tokens that DexScreener misses
            if known.get("holder_count") and not out.holder_count:
                out.holder_count = known["holder_count"]
            if known.get("top10_holders_pct") and not out.top10_holders_pct:
                out.top10_holders_pct = known["top10_holders_pct"]
            if known.get("mcap") and not out.mcap:
                out.mcap = known["mcap"]
            if known.get("volume_24h") and not out.volume_24h:
                out.volume_24h = known["volume_24h"]
            if known.get("liquidity_usd") and not out.liquidity_usd:
                out.liquidity_usd = known["liquidity_usd"]
        elif not out.name:
            out.name = "Solana Token"
            out.symbol = addr[:6]

        try:
            macro = self._fetch_macro_context()
            if macro:
                out.macro_context = macro
        except Exception:
            pass  # macro context is best-effort, never block the scan

        return out

    # -------------------- Solana RPC helpers --------------------

    def _solana_rpc_call(self, method: str, params: List[Any]) -> Dict[str, Any]:
        """Make a Solana RPC call."""
        payload = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": method,
            "params": params,
        }
        req = Request(
            SOLANA_RPC,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
        )
        try:
            with urlopen(req, timeout=self._timeout_s) as resp:
                raw = resp.read().decode("utf-8")
            return json.loads(raw)
        except Exception:
            raise

    # -------------------- HTTP helpers --------------------

    def _http_get_json(self, url: str) -> Dict[str, Any]:
        """HTTP GET → JSON with hard timeouts.

        Note: urlopen(timeout=...) does not always protect against indefinite stalls
        on some macOS/Python TLS handshake edge cases. We also set a global socket
        timeout and keep request timeouts small.
        """
        req = Request(
            url,
            headers={
                "Accept": "application/json",
                "User-Agent": "VerdictSwarm/0.1 (stdlib; +https://github.com/vswarm-ai/verdictswarm)",
            },
        )
        try:
            with urlopen(req, timeout=self._timeout_s) as resp:
                raw = resp.read().decode("utf-8")
            return json.loads(raw)
        except Exception:
            # Re-raise to allow caller to degrade gracefully.
            raise

    @staticmethod
    def _safe_float(x: Any, default: float = 0.0) -> float:
        try:
            if x is None:
                return default
            return float(x)
        except (TypeError, ValueError):
            return default

    @staticmethod
    def _safe_int(x: Any, default: int = 0) -> int:
        try:
            if x is None:
                return default
            return int(float(x))
        except (TypeError, ValueError):
            return default

    # -------------------- CoinGecko --------------------

    def _fetch_macro_context(self) -> Optional[str]:
        """Fetch global crypto market data from CoinGecko. Best-effort, never blocks scan."""
        try:
            resp = requests.get(
                "https://api.coingecko.com/api/v3/global",
                timeout=5,
                headers={"accept": "application/json"},
            )
            resp.raise_for_status()
            data = resp.json().get("data", {})

            btc_dom = data.get("market_cap_percentage", {}).get("btc", 0)
            eth_dom = data.get("market_cap_percentage", {}).get("eth", 0)
            total_mcap = data.get("total_market_cap", {}).get("usd", 0)
            mcap_change = data.get("market_cap_change_percentage_24h_usd", 0)
            total_volume = data.get("total_volume", {}).get("usd", 0)
            active_coins = data.get("active_cryptocurrencies", 0)

            return (
                f"BTC dominance: {btc_dom:.1f}%, ETH dominance: {eth_dom:.1f}%, "
                f"Total crypto market cap: ${total_mcap / 1e9:.1f}B (24h change: {mcap_change:+.1f}%), "
                f"Total 24h volume: ${total_volume / 1e9:.1f}B, "
                f"Active cryptocurrencies: {active_coins:,}"
            )
        except Exception:
            return None

    def _fetch_coingecko_categories(self, address: str, chain: str) -> List[str]:
        platform = COINGECKO_PLATFORMS.get((chain or DEFAULT_CHAIN).lower().strip(), COINGECKO_PLATFORMS[DEFAULT_CHAIN])
        url = COINGECKO_CONTRACT_URL.format(chain=platform, address=address)
        payload = self._http_get_json(url)

        cats = payload.get("categories")
        if not isinstance(cats, list):
            return []

        out: List[str] = []
        for c in cats:
            if not isinstance(c, str):
                continue
            s = c.strip().lower()
            if s:
                out.append(s)
        return out

    # -------------------- DexScreener --------------------

    def _fetch_dexscreener(self, address: str) -> Dict[str, Any]:
        url = DEX_SCREENER_TOKEN_URL.format(address=address)
        payload = self._http_get_json(url)

        pairs = payload.get("pairs") or []
        if not isinstance(pairs, list) or not pairs:
            return {}

        # Choose the most liquid pair where the queried address is the BASE token.
        # DexScreener returns pairs where the address appears as either base or quote,
        # so without this filter we might pick e.g. sENA/ENA when querying for ENA.
        addr_lower = address.lower()

        def liquidity_usd(pair: Dict[str, Any]) -> float:
            liq = pair.get("liquidity") or {}
            if isinstance(liq, dict):
                return self._safe_float(liq.get("usd"), 0.0)
            return 0.0

        def is_base_token(pair: Dict[str, Any]) -> bool:
            base = pair.get("baseToken") or {}
            return (base.get("address") or "").lower() == addr_lower

        base_pairs = [p for p in pairs if isinstance(p, dict) and is_base_token(p)]
        # Fall back to all pairs if the address doesn't appear as base in any
        candidates = base_pairs if base_pairs else [p for p in pairs if isinstance(p, dict)]
        best = max(candidates, key=liquidity_usd, default=None)
        if best and len(candidates) > 1:
            best_liq = liquidity_usd(best)
            ethereum_candidates = [p for p in candidates if str(p.get("chainId", "")).lower() == "ethereum"]
            best_ethereum = max(ethereum_candidates, key=liquidity_usd, default=None)
            if best_ethereum and best_liq > 0 and liquidity_usd(best_ethereum) >= 0.5 * best_liq:
                best = best_ethereum

            selected_liq = liquidity_usd(best)
            if selected_liq < 100_000:
                other_chains_high_liq = [
                    p for p in candidates
                    if str(p.get("chainId", "")).lower() != str(best.get("chainId", "")).lower()
                    and liquidity_usd(p) > selected_liq * 2
                ]
                if other_chains_high_liq:
                    alt = max(other_chains_high_liq, key=liquidity_usd)
                    print(
                        f"[WARN] DexScreener: low-liq pair selected for {address} "
                        f"(chain={best.get('chainId')} liq=${selected_liq:,.0f}), "
                        f"higher-liq alt exists (chain={alt.get('chainId')} liq=${liquidity_usd(alt):,.0f})"
                    )
        if not best:
            return {}

        base_token = best.get("baseToken") or {}
        name = base_token.get("name") or ""
        symbol = base_token.get("symbol") or ""

        price_usd = self._safe_float(best.get("priceUsd"), 0.0)
        price_change_24h = self._safe_float((best.get("priceChange") or {}).get("h24"), 0.0)
        volume_24h = self._safe_float((best.get("volume") or {}).get("h24"), 0.0)
        liquidity = liquidity_usd(best)

        mcap = self._safe_float(best.get("marketCap"), 0.0)
        fdv = self._safe_float(best.get("fdv"), 0.0)

        # Extract 24h transaction count from DexScreener
        txns = best.get("txns") or {}
        txns_h24 = txns.get("h24") or {}
        tx_count_24h = self._safe_int(txns_h24.get("buys"), 0) + self._safe_int(txns_h24.get("sells"), 0)

        # Extract pair creation time for contract age estimation
        pair_created_at = best.get("pairCreatedAt", 0)
        pair_age_days = 0
        if pair_created_at and isinstance(pair_created_at, (int, float)) and pair_created_at > 0:
            pair_age_days = max(1, int((time.time() * 1000 - pair_created_at) / (24 * 60 * 60 * 1000)))

        return {
            "name": name,
            "symbol": symbol,
            "price_usd": price_usd,
            "price_change_24h": price_change_24h,
            "volume_24h": volume_24h,
            "liquidity_usd": liquidity,
            "mcap": mcap,
            "fdv": fdv,
            "tx_count_24h": tx_count_24h,
            "pair_age_days": pair_age_days,
        }

    # -------------------- Etherscan V2 (multi-chain) --------------------

    def _etherscan_call(self, params: Dict[str, str], chain_id: str) -> Dict[str, Any]:
        api_key = os.environ.get("BASESCAN_API_KEY", "").strip()
        params = dict(params)
        params["chainid"] = chain_id
        if api_key:
            params["apikey"] = api_key

        url = ETHERSCAN_V2_API_URL + "?" + urlencode(params)
        return self._http_get_json(url)

    def _fetch_etherscan(self, address: str, chain_id: str) -> Dict[str, Any]:
        out: Dict[str, Any] = {}

        # 1) Contract source (and creator, if available)
        try:
            source_payload = self._etherscan_call(
                {
                    "module": "contract",
                    "action": "getsourcecode",
                    "address": address,
                },
                chain_id,
            )
            parsed = self._parse_basescan_source(source_payload)
            out.update(parsed)
        except Exception:
            # Don't fail the whole Etherscan branch.
            pass

        # 1b) Contract age from oldest transaction (more reliable than txlist desc)
        try:
            age_days = self._get_contract_age_from_first_tx(address, chain_id)
            if age_days > 0:
                out["contract_age_days"] = age_days
        except Exception:
            pass

        # 2) Transactions (for age + 24h tx count)
        try:
            tx_payload = self._etherscan_call(
                {
                    "module": "account",
                    "action": "txlist",
                    "address": address,
                    "startblock": "0",
                    "endblock": "99999999",
                    "page": "1",
                    "offset": "10000",
                    "sort": "desc",
                },
                chain_id,
            )
            tx_parsed = self._parse_basescan_txlist(tx_payload)
            # Only take tx_count_24h from txlist (contract_age_days from step 1b is more reliable)
            if "tx_count_24h" in tx_parsed:
                out["tx_count_24h"] = tx_parsed["tx_count_24h"]
            # Fall back to txlist age only if we don't have it yet
            if "contract_age_days" not in out and "contract_age_days" in tx_parsed:
                out["contract_age_days"] = tx_parsed["contract_age_days"]
        except Exception:
            pass

        # 3) Holders
        try:
            holders_payload = self._etherscan_call(
                {
                    "module": "token",
                    "action": "tokenholderlist",
                    "contractaddress": address,
                    "page": "1",
                    "offset": "100",
                },
                chain_id,
            )
            holders_parsed = self._parse_basescan_holders(holders_payload)
            out.update(holders_parsed)
        except Exception:
            # Endpoint may not exist; ignore.
            pass

        return out

    def _parse_basescan_source(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        # Etherscan-like schema: {"status":"1","message":"OK","result":[{...}]}
        result = payload.get("result")
        if not isinstance(result, list) or not result:
            return {}
        row = result[0] if isinstance(result[0], dict) else {}

        source_code = row.get("SourceCode") or ""
        abi = row.get("ABI") or ""
        contract_name = row.get("ContractName") or ""

        verified = False
        if isinstance(abi, str) and abi and abi != "Contract source code not verified":
            verified = True
        if isinstance(source_code, str) and source_code.strip():
            verified = True

        creator = row.get("ContractCreator") or row.get("contractCreator") or ""

        # Name/symbol may be present on some scanners; keep optional.
        name = row.get("TokenName") or row.get("name") or ""
        symbol = row.get("TokenSymbol") or row.get("symbol") or ""

        source_out: Optional[str] = None
        if verified and isinstance(source_code, str) and source_code.strip():
            # Some scanners wrap multi-file sources in extra braces. Keep raw.
            source_out = source_code

        return {
            "contract_verified": verified,
            "source_code": source_out,
            "creator_address": creator,
            "name": name,
            "symbol": symbol,
            "contract_name": contract_name,
        }

    def _parse_basescan_txlist(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        result = payload.get("result")
        if not isinstance(result, list) or not result:
            return {}

        now = int(time.time())
        cutoff = now - 24 * 60 * 60

        tx_24h = 0
        timestamps: List[int] = []
        # txlist sorted desc (newest first)
        for tx in result:
            if not isinstance(tx, dict):
                continue
            ts = self._safe_int(tx.get("timeStamp"), default=0)
            if ts:
                timestamps.append(ts)
            if ts >= cutoff:
                tx_24h += 1
            else:
                # since sorted desc, we can break early once older than cutoff
                break

        # Age: use the oldest timestamp we can see in this response.
        # If API returned descending only up to 10k, age can be under-estimated; acceptable for MVP.
        age_days = 0
        if timestamps:
            oldest = min(timestamps)
            if oldest > 0 and oldest <= now:
                age_days = int((now - oldest) / (24 * 60 * 60))

        return {
            "tx_count_24h": tx_24h,
            "contract_age_days": age_days,
        }

    def _get_contract_age_from_first_tx(self, address: str, chain_id: str) -> int:
        """Get contract age by fetching the oldest internal transaction (includes contract creation)."""
        # Try internal transactions first (faster for contracts, includes creation)
        try:
            payload = self._etherscan_call(
                {
                    "module": "account",
                    "action": "txlistinternal",
                    "address": address,
                    "startblock": "0",
                    "endblock": "99999999",
                    "page": "1",
                    "offset": "1",
                    "sort": "asc",  # Oldest first
                },
                chain_id,
            )
            result = payload.get("result")
            if isinstance(result, list) and result:
                row = result[0] if isinstance(result[0], dict) else {}
                ts = self._safe_int(row.get("timeStamp"), 0)
                if ts > 0:
                    now = int(time.time())
                    return int((now - ts) / (24 * 60 * 60))
        except Exception:
            pass
        
        # Fallback to regular txlist (slower for high-volume contracts)
        try:
            payload = self._etherscan_call(
                {
                    "module": "account",
                    "action": "txlist",
                    "address": address,
                    "startblock": "0",
                    "endblock": "99999999",
                    "page": "1",
                    "offset": "1",
                    "sort": "asc",
                },
                chain_id,
            )
            result = payload.get("result")
            if isinstance(result, list) and result:
                row = result[0] if isinstance(result[0], dict) else {}
                ts = self._safe_int(row.get("timeStamp"), 0)
                if ts > 0:
                    now = int(time.time())
                    return int((now - ts) / (24 * 60 * 60))
        except Exception:
            pass
        return 0

    def _parse_basescan_holders(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        result = payload.get("result")
        if not isinstance(result, list) or not result:
            return {}

        # Attempt to read holder_count if provided.
        holder_count = len([r for r in result if isinstance(r, dict)])

        # Compute top10 pct.
        # Supported formats (vary by explorer):
        # - {"TokenHolderShare":"1.23"} where share is a percentage
        # - {"TokenHolderQuantity":"123"} where quantity is token amount; can't compute pct without total supply
        shares: List[float] = []
        quantities: List[float] = []

        for row in result[:10]:
            if not isinstance(row, dict):
                continue
            if "TokenHolderShare" in row:
                shares.append(self._safe_float(row.get("TokenHolderShare"), 0.0))
            elif "share" in row:
                shares.append(self._safe_float(row.get("share"), 0.0))
            if "TokenHolderQuantity" in row:
                quantities.append(self._safe_float(row.get("TokenHolderQuantity"), 0.0))
            elif "quantity" in row:
                quantities.append(self._safe_float(row.get("quantity"), 0.0))

        top10_pct = 0.0
        if shares:
            # Shares are already percentages.
            top10_pct = float(sum(shares))
        else:
            # Without total supply, we can't compute a real percentage.
            top10_pct = 0.0

        return {
            "holder_count": holder_count,
            "top10_holders_pct": top10_pct,
        }


__all__ = ["DataFetcher", "TokenData", "is_solana_address"]
