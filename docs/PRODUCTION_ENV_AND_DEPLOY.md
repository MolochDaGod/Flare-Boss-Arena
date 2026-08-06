# Production env, secrets, deps, assets, database — fleet runbook

Inventory date: 2026-07-19. **No secret values are stored in this file or in git.**

Covers: **Flare Boss Arena**, **Mine-Loader**, **Warlord Genesis**, **grudge-studio** monorepo patterns.

---

## 0. Platform rules (non-negotiable)

| Need | Platform |
|------|----------|
| Frontend SPA (React/Vite) | **Vercel** |
| Always-on API / WebSockets / Docker | **Railway** |
| Account / character / GBUX SSOT | **Railway Postgres** via `grudge-api-production-0d46` |
| Auth UI + JWT mint | **id.grudge-studio.com** |
| 3D / icon binaries | **R2** `assets.grudge-studio.com` |
| Definitions (JSON recipes, etc.) | **ObjectStore** `objectstore.grudge-studio.com` |
| Asset index (registry) | D1 via fleet asset APIs — **not** player SSOT |
| DNS / CDN / edge WS | **Cloudflare** |

**Do not:** Replit, Neon as main account DB, localStorage as player SSOT, commit `.env` with secrets, ship large GLBs as the only production source (prefer CDN).

**Same-origin API:** browser → own origin `/api/*` → `vercel.json` rewrites → Railway / ID. Puter sites call Railway + ID explicitly with CORS.

---

## 1. Local inventory (this machine)

| Repo | Path | Local `.env` secrets | `.env.example` |
|------|------|----------------------|----------------|
| Flare Boss Arena | `Documents\Flare-Boss-Arena` | **None found** | Root `.env.example` |
| Mine-Loader | `Documents\Mine-Loader-src` | **None found** | Root `.env.example` |
| Warlord Genesis | `Documents\warlord-genesis` | **None found** | Root `.env.example` |
| grudge-studio | `Documents\grudge-studio` | **None found** | Root + `artifacts/api-server` + `pvp-server` + `infra` |

Secrets live only on **Vercel / Railway / Cloudflare** dashboards (or a password manager). Clone this machine does not hold production `DATABASE_URL` / `JWT_SECRET` / R2 keys in repo roots.

### Gitignore status

| Repo | `.env` ignored? |
|------|-----------------|
| Flare | Yes (after 2026-07-19 fix: `.env`, `.env.*`, `!.env.example`) |
| Mine-Loader | Yes (`.env`, `.env.local`) |
| warlord-genesis | Yes (`.env`, `.env.*`, `!.env.example`) |
| grudge-studio | Yes |

---

## 2. Live health matrix (probed)

| Surface | URL | Result |
|---------|-----|--------|
| Account API | `grudge-api-production-0d46…/api/health` | **200** healthy |
| Grudge ID | `id.grudge-studio.com/login` | **200** |
| CDN fleet JS | `assets.grudge-studio.com/js/grudge-fleet.js` | **200** |
| ObjectStore defs | `objectstore…/api/v1/master-items.json` | **200** |
| Flare SPA | `flare-boss-arena.vercel.app/` | **200** |
| Flare → account | `flare-boss-arena.vercel.app/api/health` | **200** (proxied grudge-api) |
| Flare mp-server | `flare-mp.up.railway.app/health` | **404 — not live** |
| Flare mp proxy | `flare-boss-arena.vercel.app/api/mp/health` | **404** (rewrite target missing) |
| Mine SPA | `mine-loader.vercel.app/` | **200** |
| Mine API | `mine-loader-api-production…/api/healthz` | **200** `{"status":"ok"}` |
| Mine SSOT | `…/api/ssot` | **200** nexus voxel |
| Warlord SPA | `warlord-genesis.vercel.app/` | **200** |
| Warlord → account | `…/api/health` | **200** grudge-api |
| Warlord title API | `warlord-genesis-api-production…/api/health` | **200** `database:true` |
| Warlord title (3b5a) | `…-3b5a…/api/health` | **200** `database:false` (prefer host with DB) |
| Asset index short | `api.grudge-studio.com/assets?limit=1` | **404** (use known dash/index path) |

**Highest priority gap:** deploy **Flare mp-server** to Railway under a stable host and set `VITE_MP_URL` + `MP_CORS_ORIGIN` so PvP/leaderboards stop 404.

---

## 3. Env keys by service (names only)

### 3.1 Shared fleet (every game frontend)

| Key | Where | Secret? | Purpose |
|-----|-------|---------|---------|
| *(none for auth secrets)* | Vercel | Public rewrites only | Same-origin `/api/*` → Railway / ID |
| `VITE_ASSETS_URL` | Vercel optional | No | CDN base `https://assets.grudge-studio.com` |
| `VITE_MP_URL` / `VITE_PVP_SERVER_URL` | Vercel | No | Socket.IO host (wss/https) |
| `VITE_LEADERBOARD_URL` | Vercel optional | No | Override boards REST base |

### 3.2 Railway `grudge-api-production` (SSOT — owned by grudge-backend)

| Key | Secret? |
|-----|---------|
| `DATABASE_URL` | **Yes** |
| `JWT_SECRET` | **Yes** |
| `CORS_ORIGINS` | No (list) |
| `R2_*` / object storage | **Yes** (if API uploads) |
| OAuth client secrets | **Yes** |

Games do **not** re-host this DB. They rewrite to it.

### 3.3 Flare

**Vercel (`flare-boss-arena`)**

| Key | Notes |
|-----|--------|
| `VITE_MP_URL` | Target Railway mp-server once deployed |
| Build | `pnpm --filter @workspace/grudge-game run build` |
| Output | `artifacts/grudge-game/dist/public` |

**Railway (`flare-mp` / `@workspace/mp-server`)**

| Key | Notes |
|-----|--------|
| `MP_PORT` | Railway injects `PORT`; map or use platform PORT |
| `MP_CORS_ORIGIN` | Include `https://flare-boss-arena.vercel.app` |
| `MP_TICK_HZ` | Optional |

**Rewrites already in `vercel.json`:** auth/account/characters/wallet → grudge-api; leaderboards + `/api/mp/*` → `flare-mp.up.railway.app`.

### 3.4 Mine-Loader

**Vercel**

| Key | Notes |
|-----|--------|
| Build only public | `node scripts/vercel-build.mjs` → `artifacts/voxelcraft/dist/public` |
| Rewrites | auth → ID; characters/account/wallet → grudge-api; other `/api/*` → mine-loader-api |

**Railway (Dockerfile.api)**

| Key | Secret? |
|-----|---------|
| `DATABASE_URL` | **Yes** (Postgres plugin) |
| `PORT` | 8080 |
| `NODE_ENV` | production |
| `GRUDGE_API_BASE` | Prefer `https://grudge-api-production-0d46.up.railway.app` |
| `PUBLIC_API_URL` / `PUBLIC_SPA_URL` / `PUBLIC_EDGE_URL` | No |
| `OBJECT_STORAGE_PUBLIC_URL` | No → assets CDN |
| `LOG_LEVEL` | No |

**Scale:** **1 replica** (in-memory world authority). Health: `/api/healthz`.

### 3.5 Warlord Genesis

**Vercel**

| Key | Notes |
|-----|--------|
| Public fleet URLs | See root `.env.example` |
| `VITE_MP_URL` / `WARLORD_MP_URL` | MOBA Socket.IO host |
| Deploy | `pnpm deploy` / `node scripts/deploy.mjs` |

**Railway `warlord-genesis-api`**

| Key | Secret? |
|-----|---------|
| `DATABASE_URL` | **Yes** (title matches / boards) |
| `JWT_SECRET` | **Yes** (if local verify) |
| `GRUDGE_API_URL` | No — canonical account API |
| `PORT` | 8787 default |
| CORS | `warstrat.grudge-studio.com`, `warlord-genesis.vercel.app` |

Prefer Railway host that reports **`database:true`** in `/api/health`.

### 3.6 grudge-studio monorepo (editors / pvp-server / R2 pipeline)

| Key | Service |
|-----|---------|
| `DATABASE_URL`, `JWT_SECRET`, `ALLOWED_ORIGINS` | api-server |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `ASSET_BASE_URL` | upload + API |
| `ALLOWED_ORIGINS`, `TICK_HZ`, `MAX_PILOTS_PER_ROOM`, `PVP_VERIFY_URL` | pvp-server |
| `VITE_PVP_SERVER_URL`, `VITE_ASSET_BASE_URL` | Vercel frontends |

---

## 4. Dependencies (workspace high level)

| Package / surface | Runtime stack |
|-------------------|---------------|
| Flare game | React, Vite, Three.js, TanStack Query, wouter, Radix, Tailwind (pnpm workspace) |
| Flare mp-server | Express 5, Socket.IO 4, cors, zod, `@workspace/net-protocol` |
| Flare lib/db | drizzle-orm, pg (local schema; production accounts on grudge-api) |
| Mine-Loader | pnpm ≥10.26, Node ≥22, Docker API, voxelcraft SPA |
| Warlord API | Express 5, pg, cors (slim `api/` folder for Railway) |
| Warlord SPA | Static/Vite build via monorepo scripts |
| studio assets pipeline | `@aws-sdk/client-s3`, gltf-transform, sharp |

Package managers: **pnpm** only (Flare/Mine preinstall enforces). Node 20+ (Mine 22+).

---

## 5. Assets & resources best practices

| Layer | Authority | URL / host |
|-------|-----------|------------|
| Player state | Railway Postgres | grudge-api `/api/characters`, `/api/account`, wallet |
| Title/game-specific boards | Title API Postgres | warlord-genesis-api; Flare boards on mp-server REST |
| World blocks (Nexus) | Mine-Loader Railway | `/api/blocks`, `/api/worlds`, `/api/ssot` |
| Definitions | ObjectStore | `…/api/v1/*.json` |
| Binaries | R2 CDN | `https://assets.grudge-studio.com/...` |
| Index | D1 registry | fleet asset APIs / dash |

Rules:

1. Prefer **CDN keys + catalogs** over git megameshes for production.
2. Magic-byte check GLBs (reject HTML fake-200).
3. No Meshy/permanent capsules as shipped heroes.
4. Flare VFX: skill catalog + SkillVfx GLB paths; large packs stay on CDN or staged public only when size-safe.
5. Runs character pack: prefer staged `public` + CDN fallback, not node_modules.

Upload pattern (studio / warlord):

```bash
# After bake (grudge-convert / gltf-transform)
# Set R2_* in shell or infra/.env (never commit)
pnpm assets:upload-r2   # warlord or studio script name
```

---

## 6. Database map

| Database | Owner service | Used by |
|----------|---------------|---------|
| Account / characters / GBUX / inventory | grudge-api Railway Postgres | All games via rewrites |
| Mine world / voxels | Mine-Loader Postgres plugin | Mine API only |
| Warlord matches / title LB | warlord-genesis-api Postgres | Genesis only |
| Flare optional drizzle | Only if you provision a Flare-specific DB | Prefer account API + mp-server memory/REST for boards |
| D1 asset registry | Cloudflare | Asset index — **not** characters |

Migrations:

- grudge-api: owned by grudge-backend (`drizzle-kit push` / migrations there)
- Mine: `pnpm --filter @workspace/db run push` / Railway one-off
- Warlord API: `cd api && npm run db:migrate` (startCommand already runs migrate)

---

## 7. Deploy checklists

### 7.1 Frontend (Vercel) — any game

```bash
cd <repo>
pnpm install
# set production env (names from .env.example) via:
#   vercel env add <KEY> production
# or Dashboard → Environment Variables
pnpm build   # or project-specific build
vercel deploy --prod --yes
```

Smoke:

- `HEAD https://<app>.vercel.app/` → 200 HTML  
- `GET https://<app>.vercel.app/api/health` → grudge-api JSON  
- Login → `id.grudge-studio.com` return allowlist includes origin  

### 7.2 Backend / WS (Railway)

```bash
# Link service once: railway link
# Set vars: railway variables set KEY=value   (interactive; do not echo secrets into logs)
railway up
# or GitHub auto-deploy from main
```

Smoke:

- `/api/health` or `/api/healthz` → 200  
- CORS preflight from game origin  
- WS: Socket.IO handshake if PvP  

### 7.3 Flare PvP (currently broken — deploy this)

```bash
cd C:\Users\nugye\Documents\Flare-Boss-Arena
# Option A: Railway root = artifacts/mp-server
#   start: pnpm start  (needs pnpm + workspace or package standalone)
# Option B: monorepo service with Root Directory / start:
#   pnpm --filter @workspace/mp-server start

# Required vars:
#   MP_CORS_ORIGIN=https://flare-boss-arena.vercel.app
#   PORT or MP_PORT aligned with Railway

# Vercel:
#   VITE_MP_URL=https://<actual-railway-domain>
# Redeploy Flare SPA after setting VITE_*
```

Confirm:

- `GET https://flare-mp…/health` → 200  
- `GET https://flare-boss-arena.vercel.app/api/mp/health` → 200  
- Browser PvP lobby connects Socket.IO  

### 7.4 Secrets attach (do with user approval)

Never paste secrets into chat logs or commit them.

```bash
# Vercel (per project, production)
vercel env add JWT_SECRET production   # only if that project needs server secrets
vercel env add VITE_MP_URL production  # public value OK

# Railway
railway variables set DATABASE_URL=...  # from plugin or password manager
railway variables set JWT_SECRET=...
railway variables set MP_CORS_ORIGIN=https://flare-boss-arena.vercel.app
```

Pull for local (still gitignored):

```bash
vercel env pull .env.local
# or railway variables → copy into .env.local manually
```

---

## 8. CORS / SSO allowlist (ops)

When adding a new production origin:

1. Railway `CORS_ORIGINS` / `ALLOWED_ORIGINS` / `MP_CORS_ORIGIN`  
2. grudge-api auth return allowlist (`authReturn.ts` / fleet)  
3. ID hub return hosts  

Current primary game origins:

- `https://flare-boss-arena.vercel.app`
- `https://mine-loader.vercel.app` (+ `mine.grudge-studio.com` edge if used)
- `https://warlord-genesis.vercel.app` / `https://warstrat.grudge-studio.com`

---

## 9. Anti-patterns

| Bad | Good |
|-----|------|
| Second character DB per game | grudge-api only |
| Hardcoded Railway host in client for account CRUD | Relative `/api` + rewrites |
| Secrets in VITE_* | Only public config in Vite; secrets server-side |
| `MP_CORS_ORIGIN=*` forever | Explicit production origins |
| localStorage as sole GBUX/token truth | Account API + server economy rules |
| Committing R2 keys | Railway/Vercel secret stores |

---

## 10. Quick commands reference

```bash
# Health
curl -s https://grudge-api-production-0d46.up.railway.app/api/health
curl -s https://mine-loader-api-production.up.railway.app/api/healthz
curl -s https://warlord-genesis-api-production.up.railway.app/api/health
curl -sI https://assets.grudge-studio.com/js/grudge-fleet.js

# Flare
cd C:\Users\nugye\Documents\Flare-Boss-Arena
pnpm install
pnpm --filter @workspace/grudge-game build
pnpm --filter @workspace/mp-server dev   # local :4100

# Mine
cd C:\Users\nugye\Documents\Mine-Loader-src
pnpm install
pnpm build:web
# Railway uses Dockerfile.api

# Warlord
cd C:\Users\nugye\Documents\warlord-genesis
pnpm install
pnpm deploy
pnpm api:dev
```

---

## 11. Next actions (ops)

1. **Deploy Flare mp-server** on Railway; fix domain used by `vercel.json` rewrites and `VITE_MP_URL`.  
2. Confirm **warlord** Vercel rewrites point at the Railway API host with **`database:true`**.  
3. Attach any missing production vars from password manager → Vercel/Railway (no git).  
4. Optional: provision Flare-specific tables only if product needs them beyond account + mp boards.  
5. Re-smoke matrix in §2 after deploys.

When ready to write live secrets or run `railway up` / `vercel env add`, approve explicitly so values stay out of transcripts.
