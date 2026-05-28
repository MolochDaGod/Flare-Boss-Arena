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
- Portrait GLB URL: `https://assets.grudge-studio.com/asset-packs/toon-rts-characters/glb/characters/<race>.glb`
- Available race GLBs (HTTP 200): human, elf, dwarf, orc, undead, barbarian
- KayKit ARPG models (Knight/Mage/Ranger/Barbarian) are used IN-GAME by `GameEngine.ts`, not in the portrait.

## Toon-RTS portrait meshes (allow-list visibility)

Each race's `.glb` is a single skeleton with the FULL wardrobe baked in —
every body/head/arms/legs variant + every weapon + every shield + cosmetic
quiver/bag/wood. All meshes are visible by default, so we must HIDE
EVERYTHING and explicitly allow-list the meshes for the current loadout.

Categorisation + selection lives in `artifacts/grudge-game/src/data/characterMeshes.ts`:

- `PORTRAIT_URL(race)` returns the GLB URL.
- `resolveVisibleMeshes(meshNames, race, equip, seed)` returns the SET of mesh
  names that should be `visible = true`. Everything else is hidden.

Mesh naming is class-prefixed and case-inconsistent — the categoriser uses
case-insensitive regex on the role suffix (`body`, `head`, `arms`, `legs`,
`shoulderpads`, `weapon_<type>`, `shield`, `xtra_quiver`, `xtra_bag`,
`xtra_wood`):

| Race      | Mesh prefix | Body slot infix     | Notes                                   |
| --------- | ----------- | ------------------- | --------------------------------------- |
| human     | `WK_`       | `Units_Body_*` etc. | "WK" = workers/units pack               |
| elf       | `ELF_`      | `Units_Body_*` etc. |                                         |
| dwarf     | `DWF_`      | `Units_Body_*` etc. |                                         |
| orc       | `ORC_`      | `Units_Body_*` etc. |                                         |
| undead    | `UD_`       | `Units_body_*` etc. | lowercase body/head                     |
| barbarian | `BRB_`      | `body_*`, `head_*`  | no `Units_` infix                       |

Always visible: 1× body, 1× head, 1× arms, 1× legs (variant picked
deterministically from a hash of the character name so the same warlord
always looks the same).
Conditionally visible:
- Shoulderpads → only if the Shoulder armor slot is equipped.
- Weapon → mapped from the Mainhand item's `category` via
  `WEAPON_ROLE_FOR_CATEGORY` (swords→sword, bows→bow, staves→staff, axes→axe,
  hammers/blunts/maces→hammer or mace, spears/polearms→spear,
  daggers→dagger, picks→pick). If no weapon equipped, no weapon mesh shows.
- Shield → if anything is equipped in the Offhand slot.
- Quiver → if either hand holds a bow/crossbow.

The renderer side (`PortraitCanvas.tsx`) takes a `visibilityFor(meshNames)`
prop: when present it allow-lists meshes; the legacy `hiddenMeshes` prop is
kept as a fallback for the old hide-list model.

## T0 Starter Loadout

Every new warlord spawns with (`src/data/starterGear.ts` → `starterLoadout`):

- **Class weapon (T0)** — Iron Shortsword (warrior), Apprentice Staff (mage), Hunter's Shortbow (ranger), Knotted Club (worge)
- **Worn Hatchet** 🪓 — gather wood (tool, no CD)
- **Worn Pickaxe** ⛏ — gather stone/ore (tool, no CD)
- **Lesser Healing Potion** 🧪 ×2 — restores 60 HP, 30 s CD per use
- **Hearthstone** 🔥 — 8-second channel to recall to bound camp, 30 min CD (1.8M ms)

Cooldowns are tracked in `localStorage` keyed by character id via
`startCooldown(charId, itemId, ms)` and read with `cooldownRemaining(charId, itemId)`
(returns ms remaining; reads the per-item expiry written by `startCooldown`).
Consumables/utilities are auto-displayed on hotbar slots 6/7/8 by filtering
`inventory` for `type === "consumable" || type === "utility"`.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
