# Grudge Warlords

Browser-based isometric ARPG — forge a warlord, enter the dungeon, fight real enemies with animated sprite sheets, challenge GPT-5.1 boss encounters.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — API server (port 5000 → proxied at /api)
- `pnpm --filter @workspace/grudge-game run dev` — frontend (proxied at /)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks + Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 · DB: PostgreSQL + Drizzle ORM · Validation: Zod (`zod/v4`) + `drizzle-zod`
- API codegen: Orval (from OpenAPI spec) · Build: esbuild (CJS bundle)
- Frontend: React + Vite, Tailwind, shadcn/ui, wouter, framer-motion
- 3D engine: Three.js v0.184 + GLTFLoader (real KayKit GLB models)

## Where things live

- `lib/api-spec/` — OpenAPI spec (contract source of truth); `lib/api-client-react/` — generated React Query hooks; `lib/api-zod/` — generated Zod schemas; `lib/db/` — Drizzle schema (characters, boss_encounters)
- `artifacts/api-server/src/` — Express routes: characters, bosses, gamedata
- `artifacts/grudge-game/src/` — React frontend
  - `pages/` — `home.tsx` (War Panel `/`), `character-new.tsx` (Soul Forge), `game.tsx` (Dungeon `/game`), `camp.tsx` (Training Ground `/camp`), `boss.tsx` (Boss Arena `/boss`), `equipment.tsx` (Armory), `skills.tsx` (Grimoire), `enemies.tsx` (Bestiary)
  - `game/` — Three.js engines + loaders (see Subsystems): `GameEngine.ts`, `CampScene.ts`, `MonsterModels.ts`, `KayKitCharacter.ts`, `PirateNPC.ts`, `PlayerAnimator.ts`, `CampBuilder.ts`, `proceduralTextures.ts`
  - `data/` — `classSkills.ts` + `skillsResolver.ts` (skills source of truth), `skins.ts`, `starterGear.ts`, `characterMeshes.ts`, `skillIcons.ts`
  - `components/` — `CraftpixUI.tsx` (forged UI primitives: `ParchmentPanel`, `WarningBanner`, `BarGauge`, `OrbGauge`, `Separator`), `SkillIcon.tsx`

## Architecture decisions

- Contract-first API: OpenAPI spec → Orval codegen → React Query hooks + Zod schemas
- Three.js engines are classes (not React hooks) — avoids re-render thrash in the game loop
- CDNs: R2 (`https://pub-e7fcf1fd4c9946ecb84b3766bbc7b50d.r2.dev`) serves game-data JSONs + enemy sprite sheets; ObjectStore (`https://molochdagod.github.io/ObjectStore`) serves KayKit icons. Large GLBs are bundled in `public/models/` and served via `import.meta.env.BASE_URL`.
- Enemies are animated sprite sheets (per-animation horizontal-strip PNG) billboarded to the iso camera, PLUS six imported skeletal/static GLB monsters
- Boss AI uses GPT-5.1 for generation + action narration

## Product

- **War Panel** (`/`) — character overview, attributes, skills, equipment, Champion Skin picker, Enter World / Boss Arena
- **Soul Forge** (`/character/new`) — create a warlord: 6 races in 3 factions, 4 classes
- **Dungeon** (`/game`) — isometric 3D ARPG: WASD + click-to-move, GLB player, animated enemies, crits/damage numbers/health bars/combat log, Pirate Cove
- **Training Ground** (`/camp`) — combat testbed: KayKit hero vs dummies, fishing-town environment with per-building stations
- **Armory** (`/equipment`) — 119 weapons + 150 armor · **Grimoire** (`/skills`) — skill trees · **Bestiary** (`/enemies`) — 38 enemies
- **Boss Arena** (`/boss`) — GPT-5.1 boss encounters; one-time "Call Allies" pirate burst per encounter

## User preferences

- Dark fantasy aesthetic, dark backgrounds, ember/amber primary (gold `#c5a059`)
- Serif (Cinzel) headings, tracking-widest uppercase labels
- Never use `console.log` in server code — use `req.log` or the `logger` singleton

## Gotchas

- Do NOT run `pnpm dev` at the workspace root — no root dev script. Use per-artifact filters / workflows.
- Three.js WebGLRenderer fails in headless/screenshot browsers (no GPU) — the game pages' error boundaries handle this gracefully (now via `WarningBanner`).
- Sprite-sheet animation: each animation is its OWN PNG (horizontal strip), not rows in one sheet. R2 URL: `${R2_BASE}/${folder}/${animationFile}`.
- Mesh detection across the codebase uses `.isMesh`/`.isSkinnedMesh` flags, NOT `instanceof` — the app loads multiple Three.js instances, which breaks `instanceof`.
- All GLB loaders return an EMPTY group immediately + async-inject, gated by a `group.userData.disposed` (and engine-level `this.disposed`) flag so a late load after teardown releases its own resources instead of attaching to a dead group.

## Subsystems (deep-dive pointers)

These are large but stable. Read the named file (and the linked memory note) before changing one — most carry non-obvious asset/rig constraints.

- **Dungeon scale + terrain** (`GameEngine.ts`, `proceduralTextures.ts`) — `DUNGEON=50` drives a 100×100 square; runtime-canvas cobblestone ground, `makeRockField` InstancedMesh scatter, `makeTerrainSkirt` (Chebyshev mask matches the square movement clamp), ACES tone mapping, player-following sun/shadow rig, hover raycasting.
- **GLB monsters** (`MonsterModels.ts`) — six imported monsters (`mon_*`); rigged ones loop a single clip via `AnimationMixer`, `big_scary_*` are static (procedural sway only — shipped with no skeleton).
- **KayKit animated characters** (`KayKitCharacter.ts`) — character GLBs ship a rig but 0 clips; the shared anim-library GLBs (`public/models/kaykit/anim/*`) play directly because bone names match the rig exactly (no retargeting). `KitAnimator` state machine.
- **Pirate Cove + boss allies** (`PirateNPC.ts`, `GameEngine.buildPirateCove`, `boss.tsx`) — Pirate Kit `.gltf` are self-contained with their OWN embedded clips (native-clip path). Neutral pirates carry no `enemyId` so raycasts can't target them.
- **Camp / Training Ground** (`CampScene.ts`, `camp.tsx`) — `fishing_town.glb` is an atlas (`fishing-town-atlas.md`); `HeroAnimator` resolves clips from the hero GLB + shared library; `emitState()` throttled to ~30 Hz.
- **Orc war-camp** (`CampBuilder.ts`) — `orc_camp_set.glb` is an atlas (props stacked at origin); clone each by node name + bake its source world matrix; skip skinned/animated props.
- **Portrait meshes** (`characterMeshes.ts`, `PortraitCanvas.tsx`) — each race GLB bakes the full wardrobe; hide everything, then allow-list meshes for the loadout via case-insensitive role regex. Body/head/arms/legs variant is hashed from the character name (deterministic).
- **Skills** (`classSkills.ts` + `skillsResolver.ts`) — single source of truth; `useResolvedSkills(charClass, mainCategory)` feeds Grimoire, Armory, MainPanel, and both game/camp HUD skill bars.
- **Champion skins** (`skins.ts`, `PlayerAnimator.ts`) — default race GLB + authored Biped clips; optional One Piece skin (native labelled clips) persisted to `localStorage` `grudge:skin:<charId>`; switching requires re-entering the world.
- **T0 starter loadout** (`starterGear.ts`) — class weapon + hatchet/pickaxe tools + 2 healing potions + hearthstone; cooldowns in `localStorage` via `startCooldown`/`cooldownRemaining`.
- **UI primitives** (`CraftpixUI.tsx`) — CraftPix-textured forged components. Bar/orb gauges seat a CSS fill inside the frame's recessed channel via tunable `insetX`/`insetY`/`inset` props. See `.agents/memory/craftpix-ui-psd-packs.md`.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- Deeper, non-obvious implementation notes live in `.agents/memory/`
