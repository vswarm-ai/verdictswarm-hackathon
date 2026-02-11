# VerdictSwarm Webapp (MVP)

Token-gated high-risk anomaly detection dashboard.

**Stack:** Next.js (App Router) + TypeScript + Tailwind + RainbowKit + Wagmi/Viem + SIWE + Iron-Session.

## Features (MVP)

- Landing page (`/`) with hero + tier table
- Wallet connect (RainbowKit)
- SIWE verification (signature → server verification)
- Tiering based on **$VSWARM balance on Base** (contract address is a placeholder until set)
- Protected dashboard (`/dashboard`)
- Scan endpoint (`POST /api/scan`) returns **mock** bot analysis data
- Daily scan quota per wallet stored in `data/quota.json` (JSON file)

## Setup

```bash
cd webapp
npm install
```

Create `.env.local`:

```bash
# REQUIRED (32+ chars)
SESSION_PASSWORD="change-me-change-me-change-me-change-me"

# WalletConnect Project ID (recommended for best wallet support)
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=""

# Base RPC (server-side tiering balance check)
BASE_RPC_URL="https://mainnet.base.org"

# Optional: set actual token address when available
VSWARM_TOKEN_ADDRESS="0xVSWARM_TOKEN_ADDRESS"

# Optional: override SIWE domain
# SIWE_DOMAIN="localhost:3000"
```

Run dev server:

```bash
npm run dev
```

Open: http://localhost:3000

## Notes

- If `VSWARM_TOKEN_ADDRESS` remains the placeholder, tiering will default to **Scout** (0 tokens) so the flow is still testable.
- Quota storage is a simple JSON file for MVP; replace with Redis/DB for production.

## API Routes

- `POST /api/auth/siwe`
  - `{ action: "nonce" }` → `{ nonce }`
  - `{ action: "verify", message, signature }` → sets session user + tier
  - `{ action: "logout" }` → clears session
- `GET /api/user` → current session user
- `GET /api/quota` → scans remaining today
- `POST /api/scan` → consumes quota + returns mock scan data
