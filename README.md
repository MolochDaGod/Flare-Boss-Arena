# Flare Boss Arena

Browser 3D action-RPG island crawler: pick a fighter kit, clear a generative pirate island, harvest wood/stone, buy perks, and re-sail into **progressively tougher rounds**.

**Live:** [https://flare-boss-arena-src.vercel.app](https://flare-boss-arena-src.vercel.app) · [flare-boss-arena.vercel.app](https://flare-boss-arena.vercel.app)  
**Game:** [/game](https://flare-boss-arena-src.vercel.app/game)  
**Repo:** [github.com/MolochDaGod/Flare-Boss-Arena](https://github.com/MolochDaGod/Flare-Boss-Arena)

---

## grudge6 / Toon RTS ★ heroes (play SSOT)

Production player + party allies load **Toon RTS race GLBs only** as primary:

```
https://assets.grudge-studio.com/asset-packs/toon-rts-characters/glb/characters/{raceId}.glb
```

| Code | Role |
|------|------|
| `src/data/grudge6Assets.ts` | `raceGlbUrl` ★ · candidates · atlases · baked anim packs |
| `src/game/grudge6/Grudge6Character.ts` | SkeletonUtils clone · mesh allow-list · SI height · load order |
| `src/game/grudge6/AllyBrain.ts` | bodyguard / gatherer / healer / skirmish / … |
| `src/components/PartyHud.tsx` | **Defend · Harvest · Auto** party AI UI |
| `docs/GRUDGE6_CANONICAL.md` | Full ally + load contract |

- **SI:** human ~1.8 m; race height bias (orc/barb taller, dwarf shorter)  
- **Legacy** `models/grudge6/races/*_Characters.glb` = fallback only  
- **Forbidden primary:** metaverse kits, Meshy/capsule as production hero  
- Annihilate skins `g6_{race}_{class}` resolve to the same Toon race GLB + class loadout  

Party: recruit on `/party`, field max 2 allies; in `/game` use Party panel AI stances.

---

## Play loop

1. **War Panel** (`/`) — character, loadout, enter world or boss arena.
2. **Dungeon** (`/game`) — generative island: enemies, trees, rocks, dungeon boss, Pirate Cove.
3. Harvest **wood** (trees) and **stone** (rocks) with F / RMB; set allies to **Harvest** stance.
4. Visit the **vendor** (E) for trades; equip **perks** on `/perks`.
5. Talk to the **captain** (E) to re-sail → **next island round** (harder foes, new seed/layout/boss).
6. Optional **Boss Arena** (`/boss`) — standalone arena fight with telegraphs and phases.

Each captain re-sail increments `islandRound`. Enemy HP scales (~+28%/round), damage (~+18%/round), extra packs spawn, and the Island Colossus scales with the round.

---

## Controls (dungeon)

| Key | Action |
|-----|--------|
| WASD / click | Move |
| Space | Jump |
| Shift | Dodge (i-frames) |
| Q | Block |
| F / RMB | Attack / harvest |
| E | Interact (vendor, captain, crew) |
| R | Character special (slash / nova) |
| 1–5 | Fighter skills (ground AoE: press then LMB to place) |
| Esc | Cancel skill targeting |
| Party HUD | Defend / Harvest / Auto (ally brains) |

---

## Perks (`/perks`)

Unlock with gold (and sometimes perk tokens). Equip up to **3**. Mods stack with soft caps and apply in combat:

| Perk | Highlights |
|------|------------|
| **Firebug** | Auto-attack slash waves, longer slashes, bigger AoE, burn |
| **Medic** | Combat regen, less damage taken |
| **Support** | Large AoE radius, more slash range |
| **Gunslinger** | Attack speed, crit, auto slash waves, long slash travel |

---

## Features

- **Toon RTS ★ grudge6 heroes** — modular wardrobe, party AI, Bip001 baked packs.
- **Fighter kits** — independent skill sets (slash waves, ground AoE place-cast, cones, novas).
- **Generative islands** — seed-based layout, harvest field, pirate cove, dungeon boss.
- **Progressive rounds** — captain re-sail increases difficulty and enemy density.
- **Harvest economy** — wood/stone → vendor trades; ally auto-harvest stance.
- **Boss arena** (`/boss`) — offline-capable local boss path; circle telegraphs, phases, dodgeable projectiles.
- **3D engine** — Three.js r185, GLB heroes/monsters, Draco/Meshopt, slash VFX, telegraphs.

---

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React, Vite, Tailwind, wouter, Three.js |
| Monorepo | pnpm workspaces, TypeScript 5.9 |
| Deploy | Vercel static SPA (`vercel.json`) — project `flare-boss-arena-src` |
| Optional API | Express 5 (`artifacts/api-server`) — not required for static play |
| Auth | Grudge ID (`id.grudge-studio.com`) — app label `flare-boss-arena` |

Boss roster / combat can run fully client-side via `localBoss` when the API is unavailable (e.g. pure Vercel static hosting).

---

## Local development

**Requirements:** Node 20+, [pnpm](https://pnpm.io)

```bash
# from repo root
pnpm install

# game only (usual path)
pnpm --filter @workspace/grudge-game run dev

# typecheck game
pnpm --filter @workspace/grudge-game run typecheck

# production build (same as Vercel)
pnpm --filter @workspace/grudge-game run build
# → artifacts/grudge-game/dist/public
```

Optional API (local full stack):

```bash
pnpm --filter @workspace/api-server run dev   # :5000, proxied at /api when configured
```

Do **not** run a bare `pnpm dev` at the workspace root — there is no root dev script.

---

## Deploy (Vercel)

Config is in root `vercel.json`:

- **Install:** `pnpm install`
- **Build:** `pnpm --filter @workspace/grudge-game run build`
- **Output:** `artifacts/grudge-game/dist/public`
- **SPA rewrite:** all non-`/api/*` routes → `index.html`
- **Gamedata rewrites:** `/api/gamedata/*` → public R2 JSON

### Git-connected (recommended)

Push to `main` on GitHub; Vercel rebuilds production if the project is linked to this repo.

```bash
git push origin main
```

### CLI

```bash
# first time in this clone
vercel link

# production
vercel --prod
```

Production URL: **https://flare-boss-arena.vercel.app**

---

## Repo layout

```
artifacts/grudge-game/     # Vite SPA + Three.js game
  src/pages/               # routes: home, game, boss, camp, perks, …
  src/game/                # GameEngine, combat, pirates, harvest, VFX
  src/data/                # fighters, perks, skills, wallet, localBoss
artifacts/api-server/      # optional Express API
lib/                       # shared OpenAPI / Zod / DB packages
vercel.json                # Vercel build + SPA rewrites
```

---

## License

MIT (see package metadata). Assets under `public/models/` and third-party packs retain their original licenses.
