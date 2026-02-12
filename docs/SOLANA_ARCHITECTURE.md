# VerdictSwarm — Solana Architecture

## Overview

VerdictSwarm uses Solana as an **immutable verification layer** for AI-generated security verdicts. Every scan produces a cryptographic proof stored on-chain, making verdicts independently verifiable by anyone.

## Why On-Chain?

The crypto security space has a trust problem. When a single API tells you a token is "safe," you're trusting one company's black box. VerdictSwarm solves this with two layers of trust:

1. **Multi-model adversarial consensus** — Multiple independent AI models must agree, not just one
2. **On-chain proof** — The verdict is anchored on Solana, immutable and verifiable

No one — not even VerdictSwarm — can alter a verdict after it's stored.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    User's Browser                    │
│                                                      │
│  1. Paste token address                              │
│  2. AI agents scan (5 providers, 20+ agents)         │
│  3. Adversarial debate resolves disagreements        │
│  4. Verdict generated: score, grade, full breakdown  │
│                                                      │
│  5. SHA-256( full report JSON )  →  scan_hash        │
│  6. Wallet signs transaction (Phantom/Solflare)      │
│  7. Verdict PDA created on Solana                    │
│                                                      │
│  ✓ "On-Chain ✓" badge with Explorer link             │
└─────────────┬───────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────┐
│              Solana Devnet Program                    │
│  5bd26batPQg9ZXWSrXp3G6V2kP9wNpEz2TPZkiytV4Tq      │
│                                                      │
│  PDA = findProgramAddress(["v", scan_hash], program) │
│                                                      │
│  ┌─────────────────────────────────────────────┐    │
│  │ Verdict PDA (73 bytes)                       │    │
│  │                                               │    │
│  │  bump           1B   PDA derivation           │    │
│  │  scan_hash     32B   SHA-256 of full report   │    │
│  │  score          2B   0-1000 (u16 LE)          │    │
│  │  grade          4B   "A+", "B-", "F" etc      │    │
│  │  agent_count    1B   agents that participated  │    │
│  │  tier           1B   0=Free, 1-4=paid tiers   │    │
│  │  authority     32B   requester's wallet        │    │
│  └─────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

## Verification Protocol

Anyone can verify a VerdictSwarm verdict:

```
1. Get the full scan report (JSON)
2. Compute: hash = SHA-256(JSON.stringify({
     address, chain, score, grade, agentCount,
     tier, breakdown, summary, timestamp
   }))
3. Derive PDA: findProgramAddress(["v", hash], PROGRAM_ID)
4. Fetch PDA data from Solana
5. Compare: on-chain score, grade, agent_count == report values
```

If the on-chain data matches, the verdict is verified as authentic and unaltered.

## Program Implementations

### verdict-mini (Deployed)
- **Framework:** [Pinocchio](https://github.com/febo/pinocchio) — zero-dependency Solana framework
- **Binary size:** 16KB (optimized with `opt-level = "z"`, LTO, single codegen unit)
- **Deployed to:** Solana Devnet
- **Program ID:** `5bd26batPQg9ZXWSrXp3G6V2kP9wNpEz2TPZkiytV4Tq`
- **Why Pinocchio:** 16KB vs 212KB for Anchor — 13x smaller, deployable with minimal devnet SOL

### verdictswarm-onchain (Full Implementation)
- **Framework:** [Anchor](https://www.anchor-lang.com/) 0.31.1
- **Features:** Full IDL generation, richer data model, ecosystem tooling compatibility
- **Status:** Built and tested, ready for mainnet deployment with full Anchor tooling support

## Wallet Integration

- **Solana Wallet Adapter** with Phantom + Solflare support
- Connected wallet → tier-gated access based on wallet authentication
- Wallet signs on-chain verdict transactions (user pays ~0.002 SOL per verdict)
- Hackathon mode: any connected Solana wallet gets Tier 1 access

## Frontend Flow

```typescript
// After scan completes:
1. storeVerdictOnchain(connection, publicKey, signTransaction, verdictData)
2. → buildScanHash(verdictData)         // SHA-256 of full report
3. → derive PDA from ["v", scanHash]    // deterministic address
4. → build transaction instruction       // 40-byte payload
5. → wallet signs transaction            // Phantom popup
6. → send to Solana devnet              // ~400ms confirmation
7. → UI shows "On-Chain ✓" badge        // with Explorer link
```

## Cost Analysis

| Operation | Cost |
|-----------|------|
| Verdict PDA creation | ~0.001 SOL (rent-exempt minimum for 73 bytes) |
| Transaction fee | ~0.000005 SOL |
| **Total per verdict** | **~0.001 SOL (~$0.15 at current prices)** |

## Security Considerations

- **Immutability:** Once stored, verdicts cannot be modified or deleted
- **Authority tracking:** Every verdict records which wallet requested it
- **Hash binding:** The scan_hash cryptographically binds on-chain data to the full off-chain report
- **PDA uniqueness:** Each unique report produces a unique PDA — no collisions, no overwrites
- **Upgrade authority:** Program upgrade authority held by deployer for bug fixes during hackathon

## Future: Mainnet

For mainnet deployment:
- Deploy the full Anchor program (richer data model, IDL for tooling)
- Add per-scan credit pricing for premium tiers
- On-chain verdict lookup API (query by token address)
- Cross-reference system: link multiple scans of the same token over time
- Governance: community can flag suspicious verdicts for re-analysis

---

*Built for the Colosseum Agent Hackathon 2026*
