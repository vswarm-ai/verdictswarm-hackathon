# VerdictSwarm B2A API (Phase 2)

Public REST API that other agents/systems can call to run VerdictSwarm high-risk anomaly/risk analysis.

## Quickstart

```bash
cd projects/verdictswarm/api
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# set VS_API_KEYS and REDIS_URL

# run redis (example)
# docker run -p 6379:6379 redis:7

uvicorn api.main:app --reload --port 8080
```

Docs:
- Swagger: http://localhost:8080/docs
- ReDoc: http://localhost:8080/redoc

## Auth

Send an API key via header:

`X-API-Key: <key>`

### Static keys (MVP)

Set `VS_API_KEYS` in `.env`:

```env
VS_API_KEYS=agent:vs_live_abc123,pro:vs_live_def456
```

### Signed keys (optional)

If you set `API_KEYS_SECRET`, you may issue keys like:

`vs1_<tier>_<key_id>_<signature>`

Where:

`signature = base64url(hmac_sha256(API_KEYS_SECRET, f"{tier}:{key_id}"))`

## Endpoints

- `POST /v1/auth/verify`
- `GET /v1/scan/{address}?chain=base` (cached, depth=basic)
- `POST /v1/scan` (supports `depth` + `force_refresh`)
- `POST /v1/scan/batch`
- `GET /v1/usage`

## Caching

Redis keys: `scan:{chain}:{address}:{depth}`

TTL:
- basic/standard: 1 hour
- full/debate: 30 minutes

## Rate limiting

Redis keys: `rl:{api_key_id}:{YYYY-MM-DD}` (UTC day)

Limits are per-tier and configurable via:
- `VS_TIER_LIMIT_AGENT`
- `VS_TIER_LIMIT_PRO`
- `VS_TIER_LIMIT_ENTERPRISE`

On limit exceeded, API returns `429` with `Retry-After` header and JSON body:

```json
{ "success": false, "error": { "code": "RATE_LIMITED", "message": "Rate limit exceeded", "retry_after": 3600 } }
```

## Notes

- Scanning logic is imported from `projects/verdictswarm/src/`.
- Data fetcher currently uses public DexScreener + Etherscan V2 APIs.
