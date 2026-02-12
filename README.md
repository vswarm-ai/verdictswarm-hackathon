# VerdictSwarm 🐝⚡

> The first multi-model adversarial AI system for crypto token security — built on Solana.

[![Built on Solana](https://img.shields.io/badge/Built%20on-Solana-9945FF?style=flat&logo=solana)](https://solana.com)
[![Live Demo](https://img.shields.io/badge/Live-verdictswarm.io-00D4AA)](https://verdictswarm.io)
[![License: BSL 1.1](https://img.shields.io/badge/License-BSL%201.1-blue)](./LICENSE)

## 🔴 Live Demo

**[verdictswarm.io](https://verdictswarm.io)** — Scan any Solana SPL token or EVM contract address. No signup required.

### For Judges: Quick Start Guide (5 minutes)

> **⚡ We recommend connecting a Phantom wallet to experience the full 6-agent adversarial swarm + on-chain verdict storage. This is the core demo.**

1. Install [Phantom wallet](https://phantom.app/) browser extension (if you don't have it)
2. Switch Phantom to **Devnet** (Settings → Developer Settings → Change Network → Devnet) — our Solana program is deployed on devnet for the hackathon
3. Get free devnet SOL: use the [Solana Faucet](https://faucet.solana.com/) or run `solana airdrop 2` — you'll need a small amount (~0.01 SOL) to sign the on-chain verdict transaction at the end
4. Visit [verdictswarm.io](https://verdictswarm.io) and **connect your Phantom wallet** (top right) — no signing/verification needed
5. You're instantly assigned **Investigator tier** — this unlocks **6 AI agents + Devil's Advocate + adversarial debate**
6. Paste a token address (see suggestions below) and hit **Scan**
7. Watch the **Interrogation Room** — agents activate in real-time, analyze independently, then debate when they disagree
8. When the scan completes, **sign the transaction in Phantom** — this stores the verdict immutably on Solana devnet as a PDA (Program Derived Address), creating a permanent, verifiable record of the AI analysis. *The app auto-airdrops devnet SOL if your balance is low, so this should just work.* If signing fails for any reason, your scan results are still fully visible — on-chain storage is a bonus, not a blocker.
9. Click the **"On-Chain ✓"** badge to verify the transaction on Solana Explorer — you can see the verdict hash, score, grade, and agent count stored on-chain

Free tier (no wallet) also works — runs 2 agents without debate. **Disconnect your wallet to see the free tier, reconnect to see Tier 1.** The wallet-connected 6-agent experience is what we built for this hackathon.

**Suggested tokens to scan:**
| Address | Chain | Why |
|---------|-------|-----|
| `So11111111111111111111111111111111111111112` | Solana | SOL — blue chip baseline |
| `JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN` | Solana | Jupiter — legit DeFi |
| `DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263` | Solana | BONK — popular memecoin |
| `0x6982508145454Ce325dDbE47a25d4ec3d2311933` | Ethereum | PEPE — popular memecoin |

## What is VerdictSwarm?

VerdictSwarm deploys **specialized AI agents** powered by **5 top-tier AI providers** that independently analyze crypto tokens, then engage in **adversarial debate** to reach consensus verdicts. Free tier runs 2 agents; Pro tier runs 6 agents with Devil's Advocate and adversarial debate. Future tiers will scale up to 20+ agents with more advanced frontier models. Unlike single-model tools (GoPlus, RugCheck, De.Fi), multi-model disagreement IS the signal.


Every verdict is stored immutably on **Solana** as a PDA, creating a permanent, verifiable record of AI security analysis.

## How It Works

```
User → Paste token address → AI agents activate

Phase 1: Independent Analysis (all agents run in parallel)
  → TechnicianBot — on-chain metrics, contract maturity, trading patterns
  → SecurityBot — smart contract audit, rug pull detection, honeypot scan
  → TokenomicsBot — supply distribution, inflation, holder concentration
  → SocialBot — community sentiment, social signals via Grok
  → MacroBot — market conditions, sector trends, regulatory context
  
Phase 2: Adversarial Review
  → Devil's Advocate challenges all positive findings with counter-evidence
  → Cross-agent disagreements flagged for debate
  
Phase 3: Multi-Model Debate
  → Agents with conflicting scores debate with evidence
  → Bayesian convergence until consensus or split verdict
  
Phase 4: Verdict + On-Chain Storage
  → Score (0-100), Grade (A+ to F), full evidence trail
  → SHA-256 hash stored as immutable PDA on Solana
```

## The Agent Swarm

### Phase 1 — Scout (Free Tier)
| Agent | Role | Model |
|-------|------|-------|
| 📊 Technician | On-chain metrics, contract maturity, trading patterns, liquidity | Gemini Flash |
| 🔒 Security | Smart contract audit, rug pull patterns, honeypot detection | Gemini Flash |

### Phase 2 — Investigator (Tier 1, wallet-connected)
| Agent | Role | Model |
|-------|------|-------|
| 📊 Technician | On-chain metrics, contract maturity, trading patterns, liquidity | GPT-4o Mini |
| 🔒 Security | Smart contract audit, rug pull patterns, honeypot detection | Claude Haiku |
| 💰 Tokenomics | Supply distribution, inflation, holder concentration, vesting | Gemini Flash |
| 🐦 Social Intel | Community sentiment, social signals, bot detection, influencers | Grok |
| 🌍 Macro Analyst | Market conditions, sector trends, regulatory signals | Grok |
| 😈 Devil's Advocate | Challenges every positive finding with counter-evidence | Gemini Pro |

### Phase 3 — Prosecutor & Grand Jury (Tier 2-3)
| Agent | Role | Model |
|-------|------|-------|
| 👁️ VisionBot | Visual analysis of websites & marketing for red flags | Gemini Pro Vision |
| 🕵️ LLM ScamBot | Pattern recognition against 10,000+ known scam signatures | Kimi + Codex |
| ⚖️ Verdict Synthesizer | Final consensus engine, resolves disagreements | Multi-model ensemble |
| 🔗 On-Chain Recorder | Stores verdicts immutably on Solana as PDAs | Solana Anchor |

### Adversarial Debate Protocol
When agents disagree by >2 points, a real-time debate triggers. Agents present evidence, challenge findings, and iteratively update scores using Bayesian convergence. This multi-agent adversarial approach consistently outperforms single-model analysis.

## AI Models (5 Providers)

| Provider | Models | Specialization |
|----------|--------|----------------|
| **Google** | Gemini Flash, Gemini Pro, Gemini Pro Vision | Security analysis, deep research, visual analysis |
| **xAI** | Grok | Real-time social intelligence, sentiment |
| **Moonshot** | Kimi | Research, cost-effective deep analysis |
| **Anthropic** | Claude | Reasoning, architecture, Devil's Advocate |
| **OpenAI** | ChatGPT (Codex) | Code analysis, development |

Architecture is **model-agnostic** — when a better model drops, we integrate it. Agent prompts are continuously optimized with each new model release.

## Solana Integration

| Feature | Description |
|---------|-------------|
| 🔍 **SPL Token Scanning** | Native Solana token analysis via Helius RPC — deep on-chain data, holder analysis |
| 📝 **On-Chain Verdicts** | Every scan stored as immutable PDA on Solana via Anchor program |
| 🏪 **Tiered Access** | Wallet-gated tiers — connect wallet to unlock deeper multi-agent analysis |
| ⚡ **Solana Speed** | Sub-second finality for on-chain verdict storage |

### On-Chain Verdict Storage (Deployed on Devnet)

**Program ID:** [`5bd26batPQg9ZXWSrXp3G6V2kP9wNpEz2TPZkiytV4Tq`](https://explorer.solana.com/address/5bd26batPQg9ZXWSrXp3G6V2kP9wNpEz2TPZkiytV4Tq?cluster=devnet)

Every scan verdict is anchored on Solana as a **cryptographic proof**:

```
Flow:  Scan completes → SHA-256(full report) → Store on-chain as PDA

PDA Seeds: ["v", scan_hash]
Data (73 bytes):
  ├── bump           (1)   — PDA derivation bump
  ├── scan_hash      (32)  — SHA-256 of full report (address, chain, score, grade, breakdown, summary)
  ├── score          (2)   — Verdict score (u16, 0-1000)
  ├── grade          (4)   — Letter grade (A+, B, F, etc.)
  ├── agent_count    (1)   — Number of agents that participated
  ├── tier           (1)   — Scan tier (Free=0, T1-T4)
  └── authority      (32)  — Wallet that requested the scan
```

**Verification:** Anyone can independently verify a verdict by:
1. Taking the full scan report JSON
2. Computing `SHA-256(report)`
3. Deriving the PDA from `["v", hash]`
4. Comparing the on-chain data to the report

This makes every verdict **immutable, timestamped, and independently verifiable** on Solana.

Two program implementations in this repo:
- `verdict-mini/` — Deployed 16KB [Pinocchio](https://github.com/febo/pinocchio) program (zero-dependency, production-optimized)
- `verdictswarm-onchain/` — Full [Anchor](https://www.anchor-lang.com/) implementation with IDL (for ecosystem tooling integration)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 15, React, TailwindCSS, Framer Motion |
| **Backend** | Python 3.9, FastAPI, Server-Sent Events (SSE) |
| **AI** | Google Gemini, xAI Grok, Moonshot Kimi, Anthropic Claude, OpenAI Codex |
| **Blockchain** | Solana (Pinocchio + Anchor), EVM (ethers.js) |
| **Data** | Helius RPC, DexScreener, CoinGecko, Etherscan V2 |
| **Infrastructure** | Vercel (frontend), Railway (backend), Redis (caching) |

## Supported Chains

**Solana** (native, first-class), Ethereum, Base, Arbitrum, Polygon, BSC, Optimism, Avalanche

## Quick Start

### Docker (Recommended)
```bash
docker compose up
# Frontend: http://localhost:3000
# Backend:  http://localhost:8000
```

### Manual Setup

#### Frontend
```bash
cd webapp
npm install
npm run dev
```

#### Backend
```bash
pip install -r requirements.txt
cd api
uvicorn main:app --reload
```

#### Solana Program
```bash
cd verdictswarm-onchain
anchor build
anchor deploy
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/scan/stream` | GET | Stream scan with real-time agent events (SSE) |
| `/v1/scan/{address}` | GET | JSON scan result |
| `/api/scan/tier1` | GET | Tier 1 scan (6 agents + debate) |
| `/api/pdf` | POST | Generate PDF report |
| `/api/share/image` | POST | Generate shareable verdict card |

## Project Structure

```
├── webapp/                  # Next.js frontend
├── api/                     # FastAPI backend
├── src/                     # AI agents & debate engine (compiled)
├── verdict-mini/            # Deployed Solana program (Pinocchio, 16KB)
├── verdictswarm-onchain/    # Full Anchor program (with IDL)
├── docs/                    # Technical documentation
├── docker-compose.yml       # One-command Docker setup
├── .github/workflows/       # CI/CD
└── LICENSE                  # BSL 1.1
```

## Proprietary Technology

VerdictSwarm's **adversarial consensus engine** is proprietary intellectual property and represents the platform's core differentiation.

- Licensed under **BSL 1.1** (see [LICENSE](./LICENSE))
- Core consensus algorithms are distributed as compiled binaries (`.so`) and source for those components is not publicly distributed
- Agent prompts and scoring methodology are continuously optimized as model capabilities evolve
- We integrate the latest frontier AI models as they are released
- Swarm agent count and specialization expand over time to improve adversarial coverage and verdict quality

## IP Notice

Core consensus engine and AI agent implementations are provided as compiled packages for IP protection. Source available for evaluation under BSL 1.1. See [LICENSE](./LICENSE).

## Links

- 🔴 **Live:** [verdictswarm.io](https://verdictswarm.io)
- 🐦 **Twitter:** [@VswarmAi](https://x.com/VswarmAi)
- 💻 **GitHub:** [vswarm-ai/verdictswarm-hackathon](https://github.com/vswarm-ai/verdictswarm-hackathon)

---

*Built for the Colosseum Agent Hackathon 2026 · Built on Solana*
