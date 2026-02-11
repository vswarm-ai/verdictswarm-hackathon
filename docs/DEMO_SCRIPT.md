# VerdictSwarm Demo Script

*Use this as a guide if recording a demo video or walking judges through the product.*

---

## Key Talking Points

### The Problem (10 sec)
- Crypto investors lose billions to rugs, scams, and exploits every year
- Existing tools use a single AI model or simple heuristics — easy to game
- No way to verify if a security rating was tampered with

### The Solution (15 sec)
- VerdictSwarm pits **multiple independent AI models** against each other
- Gemini, Grok, Claude, Kimi — each analyzes independently, then **debates**
- Multi-model disagreement IS the signal
- Every verdict is **anchored on Solana** — immutable, verifiable proof

### Live Demo Flow (2-3 min)

#### 1. Start a Scan
- Go to [verdictswarm.io](https://verdictswarm.io)
- Paste a Solana token address (or any EVM address)
- Watch the Interrogation Room activate — hex grid, energy lines, agents lighting up

#### 2. Watch the Agents Work
- Point out: each agent is powered by a different AI model
- Security agent scans contract → Tokenomics agent checks distribution → Social agent reads sentiment
- Devil's Advocate challenges every positive finding
- If agents disagree by >2 points → adversarial debate triggers in real-time

#### 3. See the Verdict
- Score (0-100), Letter Grade, full breakdown by category
- Click into any agent to see their individual analysis and evidence
- Show the summary — written by multi-model consensus, not a single AI

#### 4. On-Chain Verification ⭐
- **"On-Chain ✓"** badge appears after signing with Phantom
- Click the Explorer link → shows the transaction on Solana
- Explain: "This verdict is now permanently on Solana. The scan_hash is a SHA-256 of the full report — anyone can verify this verdict was never tampered with."
- **This is the key differentiator** — no other crypto security tool does this

#### 5. Tier System (optional)
- Show the 5 tiers: Free (2 agents) → Consensus (20+ agents + debate)
- More agents = more perspectives = higher accuracy
- Token-gated: hold $VSWARM to unlock higher tiers

### Solana Integration Summary (10 sec)
- Solana wallet connect (Phantom + Solflare)
- SPL token scanning via Helius RPC
- On-chain verdict storage via custom Solana program
- Pinocchio framework — 16KB binary, zero dependencies
- Every verdict = immutable PDA on Solana

### Why This Matters (10 sec)
- "AIXBT finds the alpha — VerdictSwarm verifies it's not a rug"
- Multi-model AI consensus is the future of crypto security
- On-chain proofs make it trustless — don't trust VerdictSwarm, verify on Solana

---

## Good Tokens to Demo

| Token | Why |
|-------|-----|
| A popular Solana memecoin | Shows real-time analysis of active tokens |
| World Liberty Financial (WLFI) | Controversial — shows the system isn't a rubber stamp |
| A known rug/scam | Shows the system catches bad actors |
| SOL or a blue chip | Shows the system gives fair scores to legitimate projects |

## Technical Details for Judges

- **Program ID:** `5bd26batPQg9ZXWSrXp3G6V2kP9wNpEz2TPZkiytV4Tq` (devnet)
- **Architecture doc:** `docs/SOLANA_ARCHITECTURE.md`
- **Two program implementations:** `verdict-mini/` (deployed, Pinocchio) + `verdictswarm-onchain/` (Anchor, full IDL)
- **Frontend integration:** `webapp/lib/store-verdict-onchain.ts`
- **All code AI-written** — built autonomously by AI agents (Harrison/OpenClaw)

---

*Built for the Colosseum Agent Hackathon 2026*
