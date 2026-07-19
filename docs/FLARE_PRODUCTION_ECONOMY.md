# Flare Boss Arena — Production Economy

## Scheme

| Currency | Role |
|----------|------|
| **Flare Grudge Token** | Permanent fighter unlock (1 token = 1 fighter) |
| **GBUX** | Account currency from Grudge Studio wallet — **1000 GBUX = 1 token** |
| Gold / Embers / Souls / Perk Tokens | Session / legacy loot |

## Rules

1. **All fighters locked** by default.
2. **Unlock:** spend **1 Flare Grudge Token**, or play if in **weekly free rotation** (3 random per ISO week, test only).
3. **Earn tokens:** **5 boss kills → 1 token**.
4. **Starter:** **2 tokens** granted once on first economy bootstrap.
5. **Level save:** only when fighter is **owned** (token spend). Weekly free does **not** persist levels.
6. **Auth:** login via Grudge ID (`id.grudge-studio.com`) or paste **verified JWT** on entry.

## Backend

- Vercel SPA rewrites `/api/auth/*`, `/api/account/*`, `/api/characters/*`, `/api/wallet/*` → Railway **grudge-api-production**.
- Local economy state key: `flare:economy:v1` (tokens, owned, weekly free, boss kills, progress).
- GBUX mirrored from `/api/auth/me` or `/api/account/resources` when online.

## Madarame

- Fighter id / skin: `ikkaku_madarame` — visual shell under shared weapon/class systems.
- GLB: `public/models/skins/ikkaku_madarame.glb`

## UI surfaces

| Surface | Behavior |
|---------|----------|
| Auth gate | Login or verified token required |
| Home | “Welcome production” alert |
| Account | Wallet + GBUX + tokens + SSO |
| Select | Locks, unlock button, weekly free badges |
| Boss victory | Kill progress + XP only if owned |
