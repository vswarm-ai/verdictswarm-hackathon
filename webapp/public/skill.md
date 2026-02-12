# VerdictSwarm Agent Integration

> AI-powered token risk scanner. Get safety scores before you ape.

## Quick Start

Two ways to access VerdictSwarm:

### Option 1: Staked Lane (Token Holders)
Connect your Solana wallet for premium access.

**Auth:** Sign a message with your wallet, include headers.

```bash
# Sign message: "VerdictSwarm:{timestamp}"
TIMESTAMP=$(date +%s)
MESSAGE="VerdictSwarm:$TIMESTAMP"
# Sign with your wallet...

curl -X POST "https://verdictswarm-production.up.railway.app/api/v1/staked/scan" \
  -H "Content-Type: application/json" \
  -H "X-Wallet-Address: 0xYourWallet" \
  -H "X-Wallet-Signature: 0xYourSignature" \
  -H "X-Timestamp: $TIMESTAMP" \
  -d '{"address": "0xTokenAddress", "chain": "base"}'
```

**Tiers:**
| Access Level | Tier | Bots Available |
|-----------------|------|----------------|
| 50k+ | TIER_1 | ScamBot, Technician, Security, Tokenomics, Social |
| 150k+ | TIER_2 | + Macro, DevilsAdvocate, VisionBot, API |
| 500k+ | TIER_3 | + Priority queue, real-time alerts |
| 1M+ | SWARM_DEBATE | + 20 agents, full consensus debate |

### Option 2: Pay Lane (x402 Micropayments)
Pay per request, no tokens needed.

```bash
# First request returns 402 with payment details
curl -X POST "https://verdictswarm-production.up.railway.app/api/v1/pay/scan" \
  -H "Content-Type: application/json" \
  -d '{"address": "0xTokenAddress", "chain": "base"}'

# Response: 402 Payment Required
# {
#   "price_usd": "0.02",
#   "price_wei": "20000000000000000",
#   "payment_address": "0xd7bE12aCa32240ce13949d341f2eD7e3bAFc55Ac",
#   "expires_at": 1234567890
# }

# Pay, then retry with signature
curl -X POST "https://verdictswarm-production.up.railway.app/api/v1/pay/scan" \
  -H "Content-Type: application/json" \
  -H "X-Payment-Signature: 0xYourPaymentProof" \
  -d '{"address": "0xTokenAddress", "chain": "base"}'
```

**Pricing:**
| Endpoint | Price |
|----------|-------|
| /pay/scan | $0.02 |
| /pay/debate | $0.10 |

## Response Format

```json
{
  "address": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  "chain": "base",
  "score": 7.5,
  "risk_level": "MEDIUM",
  "tier_used": "TIER_1",
  "bots": {
    "ScamBot": {"scam_score": 85, "recommendation": "SAFE"},
    "SecurityBot": {"score": 7.2, "reasoning": "..."}
  },
  "scanned_at": "2026-02-04T21:00:00Z"
}
```

## For OpenClaw Agents

Add to your TOOLS.md:

```
### VerdictSwarm
- **Skill:** /path/to/verdictswarm/skill.md
- **Use for:** Token risk analysis before trades
- **Auth:** Wallet signature or x402 payment
```

## Chains Supported
- Base (chain: "base")
- Ethereum (chain: "eth")
- Arbitrum (chain: "arb")
- Optimism (chain: "op")
- Polygon (chain: "polygon")

## Rate Limits
- Staked: Based on tier (50-unlimited/day)
- Pay: Unlimited (pay per request)

## Support
- Docs: https://docs.verdictswarm.io
- Discord: https://discord.gg/vswarm
