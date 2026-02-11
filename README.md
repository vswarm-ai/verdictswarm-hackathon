# VerdictSwarm 🐝⚡

> The first multi-model adversarial AI system for crypto token security — built on Solana.

[![Built on Solana](https://img.shields.io/badge/Built%20on-Solana-9945FF?style=flat&logo=solana)](https://solana.com)
[![Live Demo](https://img.shields.io/badge/Live-verdictswarm.io-00D4AA)](https://verdictswarm.io)
[![License: BSL 1.1](https://img.shields.io/badge/License-BSL%201.1-blue)](./LICENSE)

## 🔴 Live Demo

**[verdictswarm.io](https://verdictswarm.io)** — Scan any Solana SPL token or EVM contract address. No signup required.

### For Judges: Quick Start Guide

**Free tier works instantly — no wallet needed.** Just paste an address and scan.

To experience the full flow including **on-chain verdict storage**:

1. Install [Phantom wallet](https://phantom.app/) browser extension
2. Switch to **Devnet** (Settings → Developer Settings → Change Network → Devnet)
3. Get free devnet SOL: run `solana airdrop 2` or use the [Solana Faucet](https://faucet.solana.com/)
4. Connect wallet on verdictswarm.io → you'll be assigned **Investigator tier** (6 agents + Devil's Advocate)
5. Run a scan → at the end, sign the transaction to store the verdict on Solana
6. Click the **"On-Chain ✓"** badge to view the transaction on Solana Explorer

**Suggested tokens to scan:**
| Address | Chain | Why |
|---------|-------|-----|
| `So11111111111111111111111111111111111111112` | Solana | SOL — blue chip baseline |
| `JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN` | Solana | Jupiter — legit DeFi |
| `DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263` | Solana | BONK — popular memecoin |
| `0xdac17f958d2ee523a2206206994597c13d831ec7` | Ethereum | USDT — stablecoin |

## What is VerdictSwarm?

VerdictSwarm deploys a **swarm of 20+ specialized AI agents** powered by **5 top-tier AI providers** that independently analyze crypto tokens, then engage in **adversarial debate** to reach consensus verdicts. Unlike single-model tools (AIXBT, GoPlus, RugCheck), multi-model disagreement IS the signal.

**AIXBT finds the alpha — VerdictSwarm verifies it's not a rug.**

Every verdict is stored immutably on **Solana** as a PDA, creating a permanent, verifiable record of AI security analysis.

## How It Works

```
User → Paste token address → 20+ AI agents activate

Phase 1: Independent Analysis
  → Technician, Security agents analyze on-chain data
  
Phase 2: Cross-Verification  
  → Tokenomics, Social, Macro agents add perspectives
  → Devil's Advocate challenges all positive findings
  
Phase 3: Adversarial Debate
  → Agents with conflicting scores debate with evidence
  → Bayesian convergence until consensus or split verdict
  
Phase 4: Verdict
  → Score (0-100), Grade (A+ to F), full evidence trail
  → Stored on Solana as immutable PDA
```

## The Agent Swarm

### Phase 1 — Scout (Free Tier)
| Agent | Role | Model |
|-------|------|-------|
| 📊 Technician | On-chain metrics, contract maturity, trading patterns, liquidity | Gemini Flash |
| 🔒 Security | Smart contract audit, rug pull patterns, honeypot detection | Gemini Flash |

### Phase 2 — Investigator (Tier 1)
| Agent | Role | Model |
|-------|------|-------|
| 💰 Tokenomics | Supply distribution, inflation, holder concentration, vesting | Gemini Pro |
| 🐦 Social Intel | Community sentiment, social signals, bot detection, influencers | Grok (xAI) |
| 🌍 Macro Analyst | Market conditions, sector trends, regulatory signals | Gemini Pro |
| 😈 Devil's Advocate | Challenges every positive finding with counter-evidence | Claude |

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
| 🏪 **$VSWARM SPL Token** | Token-gated access — hold to unlock higher tiers, scans burn tokens |
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

VerdictSwarm&apos;s **adversarial consensus engine** is proprietary intellectual property and represents the platform&apos;s core differentiation.

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
