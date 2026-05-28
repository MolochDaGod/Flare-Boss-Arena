# Grudge Warlords

Browser-based isometric ARPG — forge a warlord, enter the dungeon, fight real enemies with animated sprite sheets, challenge GPT-5.1 boss encounters.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000 → proxied at /api)
- `pnpm --filter @workspace/grudge-game run dev` — run the frontend (port 22711 → proxied at /)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- Frontend: React + Vite, Tailwind, shadcn/ui, wouter, framer-motion
- 3D engine: Three.js v0.184 with GLTFLoader (real KayKit GLB models)

## Where things live

- `artifacts/api-server/src/` — Express routes: characters, bosses, gamedata
- `artifacts/grudge-game/src/` — React frontend
  - `src/game/GameEngine.ts` — Full Three.js ARPG engine (isometric, GLB models, sprite enemies)
  - `src/pages/game.tsx` — Full-screen game view at `/game`
  - `src/pages/home.tsx` — War Panel (character overview, Enter World button)
  - `src/pages/character-new.tsx` — Soul Forge (character creation)
  - `src/pages/boss.tsx` — Boss Arena (GPT-5.1 AI boss fights)
  - `src/pages/equipment.tsx` — Armory (119 weapons, 150 armor from R2)
  - `src/pages/skills.tsx` — Grimoire (skill trees)
  - `src/pages/enemies.tsx` — Bestiary (38 enemies from R2)
- `lib/api-spec/` — OpenAPI spec (source of truth for API contract)
- `lib/api-client-react/` — Generated React Query hooks
- `lib/api-zod/` — Generated Zod schemas
- `lib/db/` — Drizzle schema (characters, boss_encounters tables)

## Architecture decisions

- Contract-first API: OpenAPI spec → Orval codegen → React Query hooks + Zod schemas
- R2 CDN (`https://pub-e7fcf1fd4c9946ecb84b3766bbc7b50d.r2.dev`) serves all game data JSONs and enemy sprite sheets
- ObjectStore CDN (`https://molochdagod.github.io/ObjectStore`) serves KayKit GLB character models and icons
- Three.js game engine is a class (GameEngine.ts), not hooks — avoids React re-render thrash in the game loop
- Enemy sprites are animated sprite sheets (horizontal strip, per-animation PNG) billboarded to face the isometric camera
- Player character uses real KayKit GLB models: Knight (warrior), Mage, Ranger, Barbarian (worge)
- Boss AI uses GPT-5.1 for both generation and action narration

## Product

- **War Panel** (`/`) — Character overview, attributes, skills, equipment, Enter World / Boss Arena buttons
- **Soul Forge** (`/character/new`) — Create a warlord: 6 races in 3 factions (Crusade/Fabled/Legion), 4 classes
- **Dungeon** (`/game`) — Full isometric 3D ARPG: WASD + click-to-move, real GLB player model, 12 animated sprite enemies, combat with crits, damage numbers, floating health bars, combat log, torch flicker
- **Armory** (`/equipment`) — Browse + equip 119 weapons and 150 armor pieces
- **Grimoire** (`/skills`) — Skill trees from R2
- **Boss Arena** (`/boss`) — AI-generated boss encounters via GPT-5.1
- **Bestiary** (`/enemies`) — 38 enemies across 8 tiers

## User preferences

- Dark fantasy aesthetic, dark backgrounds, ember/amber primary color
- Font serif for headings, tracking-widest uppercase labels
- Never use console.log in server code — use req.log or logger singleton

## Gotchas

- Do NOT run `pnpm dev` at workspace root — no root dev script
- Three.js WebGLRenderer will fail in headless/screenshot browsers (no GPU) — GameErrorBoundary handles this gracefully
- Sprite sheet animation: each animation is its own PNG (horizontal strip), not rows in a single sheet
- R2 sprite URL: `${R2_BASE}/${folder}/${animationFile}` (e.g. `sprites/werewolf/idle.png`)
- Character GLB URL: `${OBJECTSTORE_BASE}/models/characters/kaykit/${ModelName}.glb`
- Available confirmed GLBs: Knight, Mage, Ranger, Barbarian

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
