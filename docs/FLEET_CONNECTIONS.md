# Flare Boss Arena — Grudge Studio fleet connections

## Favicon

Production brand: Grudox favicon from studio art.

| File | Use |
|------|-----|
| `public/favicon.png` | Default / shortcut |
| `public/favicon-32.png` | Browser tab 32px |
| `public/favicon-192.png` | PWA / high-DPI |
| `public/apple-touch-icon.png` | iOS home screen |

## Engine

`armadaEngine.ts` v2 boots with:

- Auth → `id.grudge-studio.com`
- API → same-origin `/api/*` → Railway `grudge-api-production`
- Assets → `assets.grudge-studio.com`
- **PvP** → Socket.IO `VITE_MP_URL` (default `https://flare-mp.up.railway.app`)
- **Leaderboards** → `/api/flare/leaderboards/:board` → mp-server REST

Debug: `window.__FBA_ENGINE__` after load.

## Deploy mp-server (PvP + leaderboards)

```bash
# From Flare-Boss-Arena monorepo
# Railway: root artifacts/mp-server, start pnpm start / node
pnpm --filter @workspace/mp-server dev   # local :4100
```

Env:

| Var | Service | Purpose |
|-----|---------|---------|
| `MP_PORT` | mp-server | HTTP + Socket.IO port |
| `MP_CORS_ORIGIN` | mp-server | Include `https://flare-boss-arena.vercel.app` |
| `VITE_MP_URL` | Vercel frontend | Socket.IO base URL |
| `VITE_LEADERBOARD_URL` | optional | Override board API base |

Vercel rewrites (see root `vercel.json`):

- `/api/flare/leaderboards/:board` → mp-server `/leaderboards/:board`
- `/api/mp/health` → mp-server `/health`

## Client routes

| Path | Role |
|------|------|
| `/pvp` | Lobby + connect to arena/co-op |
| `/leaderboards` | Rank tables |
| `/connections` | Fleet probe dashboard |

## Boards

`boss_kills` · `island_rounds` · `pvp_kills` · `flare_score`
