"""B2A (Bot-to-Agent) API - Dual Track Gateway

# B2A API - NO FREE TIER
# Bots must either:
# 1. Hold 50k+ $VSWARM (staked lane)
# 2. Pay per request via x402 (pay lane)
# Free tier is webapp-only for human users.

Two lanes:
- /staked/* - Wallet signature auth, tier from $VSWARM balance
- /pay/* - x402 micropayments, no stake needed
"""

from typing import Optional

from fastapi import APIRouter, Header, HTTPException, Depends
from pydantic import BaseModel
import time

from eth_account.messages import encode_defunct
from eth_account import Account

router = APIRouter(prefix="/api/v1", tags=["b2a"])


# --- Models ---

class ScanRequest(BaseModel):
    address: str
    chain: str = "base"


class ScanResponse(BaseModel):
    address: str
    chain: str
    score: float
    risk_level: str
    tier_used: str
    bots: dict
    scanned_at: str


class PaymentRequired(BaseModel):
    price_usd: str
    price_wei: str
    payment_address: str
    expires_at: int
    endpoint: str


# --- Staked Lane (Wallet Signature Auth) ---

def verify_wallet_signature(
    x_wallet_address: str = Header(None),
    x_wallet_signature: str = Header(None),
    x_timestamp: str = Header(None),
) -> str:
    """Verify wallet signature and return wallet address."""
    if not all([x_wallet_address, x_wallet_signature, x_timestamp]):
        raise HTTPException(401, "Missing wallet auth headers")

    # Verify timestamp is within 5 minutes
    try:
        ts = int(x_timestamp)
        if abs(time.time() - ts) > 300:
            raise HTTPException(401, "Timestamp expired")
    except ValueError:
        raise HTTPException(401, "Invalid timestamp")

    # Verify signature of message "VerdictSwarm:{timestamp}" recovers claimed address
    try:
        msg = f"VerdictSwarm:{ts}"
        signable = encode_defunct(text=msg)
        recovered = Account.recover_message(signable, signature=x_wallet_signature)
    except Exception:
        raise HTTPException(401, "Invalid wallet signature")

    if (recovered or "").strip().lower() != x_wallet_address.strip().lower():
        raise HTTPException(401, "Signature does not match wallet")

    return x_wallet_address


def get_tier_from_balance(wallet: str) -> tuple[str, set]:
    """Check on-chain balance and return (tier_name, allowed_bots).

    NOTE: B2A has NO free tier. Wallets below the TIER_1 threshold must use pay-per-request.

    TODO: Implement Redis caching (5-10 min TTL)
    """
    from src.tier_config import allowed_bots_for_tier
    from src.tiers import TierLevel
    from src.token_gate import TokenGate

    gate = TokenGate(cache_ttl_s=300)
    tier, _bal = gate.tier_for_wallet(wallet)

    # Enforce minimum tier for B2A staked lane (never FREE)
    if tier == TierLevel.FREE:
        raise HTTPException(
            status_code=403,
            detail="Insufficient $VSWARM balance. Minimum TIER_1 required. Use /api/v1/pay/* for pay-per-request.",
        )

    return tier.value, allowed_bots_for_tier(tier)


@router.post("/staked/scan", response_model=ScanResponse)
async def staked_scan(
    req: ScanRequest,
    wallet: str = Depends(verify_wallet_signature),
):
    """Scan a token using staked lane (wallet signature auth).

    Requires headers:
    - X-Wallet-Address: Your wallet address
    - X-Wallet-Signature: Signature of "VerdictSwarm:{timestamp}"
    - X-Timestamp: Unix timestamp (within 5 min)
    """
    tier_name, _allowed_bots = get_tier_from_balance(wallet)

    # Run scan with tier's allowed bots
    from ..services.scanner import ScannerService

    scanner = ScannerService()
    result = await scanner.scan(
        address=req.address,
        chain=req.chain,
        depth="full",
        tier=tier_name,
    )

    return ScanResponse(
        address=result["address"],
        chain=result["chain"],
        score=result["score"],
        risk_level=result["risk_level"],
        tier_used=tier_name,
        bots=result.get("bots", {}),
        scanned_at=result["scanned_at"],
    )


# --- Pay Lane (x402 Micropayments) ---

PRICING = {
    "basic": {"usd": "0.05", "description": "Regex only"},
    "standard": {"usd": "0.15", "description": "Gemini Flash AI"},
    "pro": {"usd": "0.50", "description": "Gemini Pro + VisionBot"},
    "premium": {"usd": "1.50", "description": "Grok 4"},
    "swarm": {"usd": "5.00", "description": "Full multi-model debate"},
}

TREASURY_ADDRESS = os.environ.get("VSWARM_TREASURY_ADDRESS", "0x0000000000000000000000000000000000000000")  # VSwarm treasury


def _payment_required_detail(*, tier: str, endpoint: str) -> dict:
    price = PRICING[tier]
    # NOTE: price_wei is not yet computed; placeholder until x402 settlement is wired.
    return PaymentRequired(
        price_usd=price["usd"],
        price_wei="0",
        payment_address=TREASURY_ADDRESS,
        expires_at=int(time.time()) + 300,
        endpoint=endpoint,
    ).model_dump()


async def _pay_scan_impl(req: ScanRequest, *, tier: str, price_key: str, depth: str, x_payment_signature: Optional[str], endpoint: str) -> ScanResponse:
    """Shared implementation for pay-per-request endpoints."""
    if not x_payment_signature:
        raise HTTPException(status_code=402, detail=_payment_required_detail(tier=price_key, endpoint=endpoint))

    # TODO: Verify payment signature (x402). For now, trust the header.

    from ..services.scanner import ScannerService

    scanner = ScannerService()
    result = await scanner.scan(
        address=req.address,
        chain=req.chain,
        depth=depth,
        tier=tier.upper() if tier != "swarm" else "SWARM_DEBATE",
    )

    return ScanResponse(
        address=result["address"],
        chain=result["chain"],
        score=result["score"],
        risk_level=result["risk_level"],
        tier_used="PAYG",
        bots=result.get("bots", {}),
        scanned_at=result["scanned_at"],
    )


@router.post("/pay/scan/basic", response_model=ScanResponse)
async def pay_scan_basic(req: ScanRequest, x_payment_signature: str = Header(None)):
    return await _pay_scan_impl(
        req,
        tier="free",  # run FREE tier bot matrix (regex/scambot)
        price_key="basic",
        depth="basic",
        x_payment_signature=x_payment_signature,
        endpoint="/api/v1/pay/scan/basic",
    )


@router.post("/pay/scan/standard", response_model=ScanResponse)
async def pay_scan_standard(req: ScanRequest, x_payment_signature: str = Header(None)):
    return await _pay_scan_impl(
        req,
        tier="tier_1",
        price_key="standard",
        depth="standard",
        x_payment_signature=x_payment_signature,
        endpoint="/api/v1/pay/scan/standard",
    )


@router.post("/pay/scan/pro", response_model=ScanResponse)
async def pay_scan_pro(req: ScanRequest, x_payment_signature: str = Header(None)):
    return await _pay_scan_impl(
        req,
        tier="tier_2",
        price_key="pro",
        depth="full",
        x_payment_signature=x_payment_signature,
        endpoint="/api/v1/pay/scan/pro",
    )


@router.post("/pay/scan/premium", response_model=ScanResponse)
async def pay_scan_premium(req: ScanRequest, x_payment_signature: str = Header(None)):
    return await _pay_scan_impl(
        req,
        tier="tier_3",
        price_key="premium",
        depth="full",
        x_payment_signature=x_payment_signature,
        endpoint="/api/v1/pay/scan/premium",
    )


@router.post("/pay/scan/swarm", response_model=ScanResponse)
async def pay_scan_swarm(req: ScanRequest, x_payment_signature: str = Header(None)):
    return await _pay_scan_impl(
        req,
        tier="swarm",
        price_key="swarm",
        depth="debate",
        x_payment_signature=x_payment_signature,
        endpoint="/api/v1/pay/scan/swarm",
    )
