# VerdictSwarm Deployment Guide

This repo ships 3 deployable components:

- **Webapp** (Next.js) → deploy to **Vercel**
- **API** (FastAPI) → deploy to **Railway**
- **Landing** (static HTML/CSS/JS) → deploy to **Cloudflare Pages**

> Paths in this doc are relative to the repo root.

---

## 0) Prereqs

- A GitHub repo connected to each platform.
- For the API: a **Redis** instance (Railway Redis add-on or external).

---

## 1) Webapp (Next.js) → Vercel

### 1.1 Configure

- **Project Root Directory**: `projects/verdictswarm/webapp`
- Framework preset: **Next.js** (auto)
- Build command: `npm run build`
- Output directory: `.next`

A `vercel.json` is provided at:

- `projects/verdictswarm/webapp/vercel.json`

### 1.2 Environment variables (Vercel)

Create these in **Vercel → Project → Settings → Environment Variables**:

- `NEXT_PUBLIC_API_URL` — base URL of the deployed API (used for SSE)
  - Example: `https://verdictswarm-api.up.railway.app`

Use the template:

- `projects/verdictswarm/webapp/.env.example`

### 1.3 Deploy

- Import the repo in Vercel
- Set the Root Directory
- Add env vars
- Deploy

---

## 2) API (FastAPI) → Railway

### 2.1 Configure

- **Project Root Directory**: `projects/verdictswarm/api`
- Start command:

```bash
uvicorn main:app --host 0.0.0.0 --port $PORT
```

A `railway.toml` is provided at:

- `projects/verdictswarm/api/railway.toml`

### 2.2 Provision Redis

Option A (recommended): add **Railway Redis** plugin and copy its `REDIS_URL`.

Option B: use any external Redis and set `REDIS_URL` accordingly.

### 2.3 Environment variables (Railway)

Set these in **Railway → Service → Variables**:

**Required**
- `REDIS_URL`
- Choose one API-key strategy:
  - `VS_API_KEYS` (comma-separated allowlist, supports tiers), OR
  - `API_KEYS_SECRET` (HMAC signing secret)

**If using upstream models**
- `GEMINI_API_KEY`
- `XAI_API_KEY`

**Recommended**
- `ENV=prod`
- `LOG_LEVEL=info`

**Optional tier limits**
- `VS_TIER_LIMIT_AGENT`
- `VS_TIER_LIMIT_PRO`
- `VS_TIER_LIMIT_ENTERPRISE`

Template:

- `projects/verdictswarm/api/.env.example`

### 2.4 Health check

Railway health check endpoint:

- `GET /health`

### 2.5 Deploy

- Create a new Railway project
- Add a service from GitHub
- Set root dir to `projects/verdictswarm/api`
- Add variables
- Deploy

---

## 3) Landing (static) → Cloudflare Pages

### 3.1 Configure

In **Cloudflare Pages → Create a project**:

- **Project root directory**: `projects/verdictswarm/landing`
- Framework preset: **None / Static**
- Build command: *(leave empty)*
- Build output directory: `.`

A minimal `wrangler.toml` is included (optional for Pages, useful for consistency):

- `projects/verdictswarm/landing/wrangler.toml`

### 3.2 Environment variables

None required for the static landing page.

### 3.3 Deploy

- Connect GitHub
- Select the repo
- Configure the settings above
- Deploy

---

## 4) Wire them together

After deploys:

1. Copy the Railway API public URL
2. Set it in Vercel as:

- `NEXT_PUBLIC_API_URL=https://<your-railway-api-domain>`

3. Redeploy the webapp (or trigger a new build).

---

## 5) Post-deploy checks

- Webapp loads with no console errors
- API health:
  - `curl https://<api-domain>/health`
- SSE endpoints work from the webapp to the API (network tab)
- Redis connection is healthy (API logs show successful connect)
