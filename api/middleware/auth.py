from __future__ import annotations

import base64
import hmac
import os
import re
from dataclasses import dataclass
from hashlib import sha256
from typing import Dict, Optional

from fastapi import Header, HTTPException, Request, status

from ..config import Settings, get_settings


@dataclass(frozen=True)
class ApiKeyInfo:
    api_key: str
    api_key_id: str
    tier: str
    wallet: Optional[str] = None
    token_balance: Optional[float] = None


SIGNED_RE = re.compile(
    r"^vs1_(?P<tier>[a-zA-Z0-9]+)_(?P<keyid>[a-zA-Z0-9_-]{3,})_(?P<sig>[a-zA-Z0-9_-]{20,})$"
)


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("utf-8").rstrip("=")


def _static_keys_map(settings: Settings) -> Dict[str, str]:
    # key -> tier
    out: Dict[str, str] = {}
    if not settings.vs_api_keys:
        return out

    parts = [p.strip() for p in settings.vs_api_keys.split(",") if p.strip()]
    for p in parts:
        if ":" in p:
            tier, key = p.split(":", 1)
            out[key.strip()] = (tier.strip() or "agent").lower()
        else:
            out[p] = "agent"
    return out


def verify_api_key(raw_key: str, settings: Optional[Settings] = None) -> ApiKeyInfo:
    settings = settings or get_settings()

    k = (raw_key or "").strip()
    if not k:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing X-API-Key")

    # 1) Static list
    static = _static_keys_map(settings)
    if k in static:
        tier = static[k]
        key_id = _b64url(sha256(k.encode("utf-8")).digest())[:24]
        return ApiKeyInfo(api_key=k, api_key_id=key_id, tier=tier)

    # 2) Signed format
    m = SIGNED_RE.match(k)
    if m and settings.api_keys_secret:
        tier = m.group("tier").lower()
        key_id = m.group("keyid")
        sig = m.group("sig")

        msg = f"{tier}:{key_id}".encode("utf-8")
        expected = _b64url(hmac.new(settings.api_keys_secret.encode("utf-8"), msg, sha256).digest())
        if hmac.compare_digest(expected, sig):
            return ApiKeyInfo(api_key=k, api_key_id=key_id, tier=tier)

    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid API key")


async def require_api_key(x_api_key: Optional[str] = Header(default=None, alias="X-API-Key")) -> ApiKeyInfo:
    return verify_api_key(x_api_key or "")


# --- Wallet tier helper (webapp / session) ---

def _parse_mock_balance(request: Request) -> Optional[float]:
    """Allow ?mock_balance=5000 override for testing."""

    try:
        v = request.query_params.get("mock_balance")
        if v is None or str(v).strip() == "":
            return None
        return float(v)
    except Exception:
        return None


async def get_wallet_tier(
    request: Request,
    x_wallet_address: Optional[str] = Header(default=None, alias="X-Wallet-Address"),
) -> ApiKeyInfo:
    """Resolve tier based on $VSWARM balance for a connected wallet.

    This is intentionally lightweight. If VSWARM_TOKEN_ADDRESS is not set,
    TokenGate will return 0 unless mock_balance / VSWARM_MOCK_BALANCE is provided.

    Returns an ApiKeyInfo-like object so downstream code can reuse `.tier`.
    """

    wallet = (x_wallet_address or "").strip() or None
    if not wallet:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing X-Wallet-Address")

    mock_balance = _parse_mock_balance(request)

    from src.token_gate import TokenGate

    gate = TokenGate(cache_ttl_s=int(os.getenv("VSWARM_TIER_CACHE_TTL_S", "60")))
    tier_level, bal = gate.tier_for_wallet(wallet, mock_balance=mock_balance)

    return ApiKeyInfo(
        api_key="",
        api_key_id=_b64url(sha256(wallet.encode("utf-8")).digest())[:24],
        tier=tier_level.value,
        wallet=wallet,
        token_balance=float(bal),
    )
