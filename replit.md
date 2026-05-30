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
  - `src/game/proceduralTextures.ts` — Runtime canvas-built ground material (cobblestone color+bump) + `makeRockField` InstancedMesh prop scatter
  - `src/game/MonsterModels.ts` — Registry + async loader for the 6 imported GLB monsters (skeletal + static)
  - `src/game/PirateNPC.ts` — KayKit Pirate Kit NEUTRAL allies: self-contained `.gltf` loader + `PirateAnimator` that plays each character's OWN embedded clips (idle/walk/wave/attack/hit/death). `PIRATE_DEFS`, `loadPirate`, `disposePirate`, `disposeGltfObject`
  - `src/game/KayKitCharacter.ts` — KayKit animated-character system: loads clip-less character GLBs + a shared KayKit animation-library GLB and plays the library clips on each character via one `AnimationMixer` (bone names match the rig exactly). `KitAnimator` (idle/walk/attack/hit/death state machine), `KIT_TEMPLATES`, `isKitMonsterId`, `loadKitMonster`, `disposeKitModel`
  - `src/pages/game.tsx` — Full-screen game view at `/game`
  - `src/pages/home.tsx` — War Panel (character overview, Enter World button)
  - `src/pages/character-new.tsx` — Soul Forge (character creation)
  - `src/pages/boss.tsx` — Boss Arena (GPT-5.1 AI boss fights) + "Call Allies" one-time pirate assault
  - `src/pages/equipment.tsx` — Armory (119 weapons, 150 armor from R2)
  - `src/pages/skills.tsx` — Grimoire (skill trees)
  - `src/pages/enemies.tsx` — Bestiary (38 enemies from R2)
  - `src/game/PlayerAnimator.ts` — authored Biped clips (idle/walk/attack) for race models + native-clip player for One Piece skins
  - `src/game/CampBuilder.ts` — extracts orc props from `orc_camp_set.glb` (atlas) and rings them around the forge
  - `src/data/skins.ts` — One Piece skin registry + `getSelectedSkin`/`setSelectedSkin` (localStorage `grudge:skin:<charId>`)
  - `src/data/classSkills.ts` — authored best-version class skills (warrior/mage/ranger/worge)
  - `src/data/skillsResolver.ts` — `resolveSkills`/`useResolvedSkills(charClass, mainCategory)` → class + weapon skills (shared by Grimoire, Armory, MainPanel, Game HUD)
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
- Six imported GLB monsters spawn in the dungeon alongside the procedural roster (see "GLB monsters" below)
- Boss AI uses GPT-5.1 for both generation and action narration

## Product

- **War Panel** (`/`) — Character overview, attributes, skills, equipment, Enter World / Boss Arena buttons
- **Soul Forge** (`/character/new`) — Create a warlord: 6 races in 3 factions (Crusade/Fabled/Legion), 4 classes
- **Dungeon** (`/game`) — Full isometric 3D ARPG: WASD + click-to-move, real GLB player model, 12 animated sprite enemies, combat with crits, damage numbers, floating health bars, combat log, torch flicker
- **Armory** (`/equipment`) — Browse + equip 119 weapons and 150 armor pieces
- **Grimoire** (`/skills`) — Skill trees from R2
- **Boss Arena** (`/boss`) — AI-generated boss encounters via GPT-5.1; "Call Allies" summons the pirate crew for a one-time damage burst (once per encounter)
- **Pirate Cove** (in `/game`) — neutral KayKit pirate NPCs + docked ship/dock/loot near the forge; the crew that aids you against bosses
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
- GLB monster assets live in `artifacts/grudge-game/public/models/monsters/` and are served via `${import.meta.env.BASE_URL}models/monsters/<file>.glb` — large files (cultist_armed ≈31 MB), loaded async/non-fatal.
- big_scary_t2 / big_scary_t3 GLBs shipped WITHOUT a skeleton or clip — they get a procedural idle sway only. True skeletal animation needs a rigged re-export from the source.

## Dungeon scale, textures & raycasting

The `/game` dungeon (`GameEngine.ts`) runs on a large map with procedural terrain:

- `DUNGEON = 50` → 100×100-unit playable square (~10× the old 16 area). All
  movement/click clamping, enemy spawn bounds, and the click plane derive from
  `this.DUNGEON`, so changing it rescales everything.
- **Ground**: `makeGroundMaterial(repeat, anisotropy)` builds a tiling
  cobblestone `MeshStandardMaterial` at runtime from `<canvas>` (color + bump,
  `RepeatWrapping`, max anisotropy, SRGB) — no external texture fetch. Repeat is
  `DUNGEON/2`. Added in `buildDungeon()` as a shadow-receiving plane.
- **Props**: `makeRockField(220, DUNGEON*0.35, DUNGEON-4)` scatters 220 rocks as
  a single `InstancedMesh` (one draw call) in an annulus around the central forge.
- **Forge landmark**: `loadEnvironment()` scales `forge-scene.glb` to a FIXED
  40-unit extent (not the full map) so it reads as a central hub, with the
  textured ground + rocks filling the rest.
- **Lighting best-practices**: ACES Filmic tone mapping + exposure on the
  renderer; a `HemisphereLight` for sky/ground bounce; the directional sun +
  `sun.target` rig FOLLOWS the player each frame in `update()` so a tight ±35
  shadow frustum stays sharp across the big map; torches distributed on a grid
  scaled to `DUNGEON`.
- **Hover raycasting**: `handleHover()` (mousemove) raycasts live enemy groups
  and applies an emissive glow + pointer cursor; `clearHover()` restores both
  emissive color AND intensity. Hover state is cleared in `killEnemy()` and
  `dispose()`. Enemy hit resolution uses `userData.enemyId` (set on every mesh,
  including async GLB monsters via onReady retag), same as click-to-target.
- **Disposal**: `dispose()` releases the ground geometry/material/map/bumpMap and
  the rock field geometry/material, and removes the mousemove listener.

## GLB monsters

Six user-imported monsters are registered in `src/game/MonsterModels.ts`
(`MONSTER_DEFS`) and spawned once each by `GameEngine.spawnInitialEnemies()`
alongside the procedural roster. They flow through the same enemy pipeline:
`createEnemy()` branches on `isMonsterId(template.id)` to call
`loadMonsterModel()` instead of `createEnemyModel()`.

| id (`mon_*`)      | name           | rig + clip          | tier | target height |
| ----------------- | -------------- | ------------------- | ---- | ------------- |
| pincher           | Chitin Pincher | ✅ `pincheranim`    | 2    | 1.7           |
| cultist           | Armed Cultist  | ✅ `idle`           | 2    | 2.0           |
| big_scary_t2      | Gloomhulk      | ❌ static (sway)    | 3    | 2.6           |
| dante_beast       | Dante's Beast  | ✅ `dante2anim`     | 4    | 2.8           |
| medusa            | Medusa         | ✅ `medusa2anim`    | 4    | 2.6           |
| big_scary_t3      | Dread Colossus | ❌ static (sway)    | 5    | 4.2           |

Loader best-practices (`loadMonsterModel`):
- Returns an EMPTY group immediately (safe to add to scene); the GLB streams
  in async and is injected on load. `updateEnemyAnimation` no-ops safely until
  then (`isGLB` set, `mixer` null, empty `bodyMats`).
- Uniform scale to `def.height` (`scale = height / size.y`), recenter XZ to
  origin, drop feet to y=0.
- `castShadow`/`receiveShadow` on every mesh; `frustumCulled = false` on
  skinned meshes (else they vanish when culled in bind pose).
- Rigged GLBs: single clip played looped via `THREE.AnimationMixer`.
  `updateEnemyAnimation`'s `isGLB` branch calls `mixer.update(delta)` and skips
  the procedural-primitive rig path; hurt-flash / death tip-over / attack lunge
  are layered on the group. Static GLBs sway the inner child node so it never
  fights the facing yaw GameEngine writes onto the group.
- Mesh detection uses `.isMesh`/`.isSkinnedMesh` flags (NOT `instanceof`) — the
  app logs "Multiple instances of Three.js", which would break `instanceof`.
- Cleanup: `disposeMonsterModel()` stops + uncaches the mixer and disposes
  geometry, materials, AND textures. A `group.userData.disposed` guard makes a
  late-arriving load callback release its resources instead of attaching to a
  dead group (kill/teardown race safety).

## KayKit animated characters (shared animation library)

`KayKitCharacter.ts` adds REAL skeletal animation for KayKit character GLBs
(Skeletons = enemies, Adventurers = heroes/skins). Key facts:

- KayKit character GLBs ship a rig but **0 embedded clips**. The KayKit Character
  Animations pack provides clips as separate GLBs whose bone names match the
  character rig EXACTLY (hips/spine/chest/head/upperarm/hand/foot ...). An
  `AnimationClip` is just node-name-bound data, so library clips play directly on
  any KayKit character through its own `AnimationMixer` — no retargeting.
- Assets live in `public/models/kaykit/`: `anim/{general,movement,combat}.glb`,
  `enemies/Skeleton_*.glb`, `heroes/*.glb` (served via `import.meta.env.BASE_URL`).
- `loadAnimLibrary(loader)` fetches the library GLBs ONCE and caches the parsed
  clips at module scope (persistent residency — intentional, never disposed),
  reused across every KayKit enemy. One mixer per enemy.
- Clip names: `Idle_A/B`, `Walking_A/B/C`, `Running_A/B`,
  `Melee_1H_Attack_Chop`, `Melee_2H_Attack_Chop`, `Death_A`, `Hit_A`,
  `Spawn_Ground`, etc.
- `KitAnimator` (idle/walk crossfade; attack/hit one-shot via `LoopOnce` +
  `finished` listener; `die` → `Death_A` clamped on last frame). `EnemyModel`
  carries an optional `kit` field; `updateEnemyAnimation`'s `isGLB` branch checks
  `model.kit` FIRST, drives state from AI flags, and returns early. The death
  clip lays the body down, so the kit path does NOT apply the group tip-over used
  for other GLBs.
- Enemy pipeline: `KIT_TEMPLATES` spawn in `spawnInitialEnemies`; `createEnemy`
  branches `isKitMonsterId` → `loadKitMonster` (empty group now, async inject,
  `enemyId` re-tag onReady); both disposal sites (`killEnemy` + full `dispose`)
  branch to `disposeKitModel` (animator + geometry + materials + textures, with
  the `group.userData.disposed` load-after-teardown guard).

## In-game HUD theme (stone/gold)

`game.tsx` HUD uses a forged stone/gold theme (per the UIlayer mockup): a shared
`stonePanel` style (dark gradient + 2px gold `#c5a059` rim + inset shadow) and a
`<Rivets />` corner-rivet component, applied to the player HUD, the skill/hotbar
slots, and the action-button bar. Cinzel (`font-serif`) headings, gold accents.
`Rivets` are `position:absolute`; their wrappers are already `absolute`, which
establishes the containing block so rivets anchor to panel corners.

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

## Champion skins (player model override)

- Each warlord renders in-world as their **race GLB** (real skeleton) by default,
  animated with authored Biped clips from `PlayerAnimator.ts`. Players can pick a
  **One Piece skin** in the War Panel's "Champion Skin" card (`home.tsx`); the
  choice persists to `localStorage` (`grudge:skin:<charId>`) via `setSelectedSkin`.
- `game.tsx` reads `getSelectedSkin(char.id)` and passes `skinId` +
  `equipMainCategory` into `GameEngine.init`. `loadPlayerModel` branches:
  skin → `loadSkinModel` (native labelled clips); else → race model + authored clips.
- Skins use their own native animation clips (bounty-rush scheme); `koby` is
  cryptic-clip and falls back to idle-only. Switching skins requires re-entering
  the world (the engine builds the model once on init).

## Orc war-camp + terrain skirt

- `orc_camp_set.glb` is an **atlas**: all 198 base props sit stacked at the origin
  (only the leveled showcase buildings carry translations). `CampBuilder.ts` finds
  each prop by its mesh-node name `<base>_proto_orc_rts_0`, **bakes the source
  world matrix** into a clone (preserving the FBX→Y-up axis correction), wraps it
  in a holder, scales the whole camp uniformly by a `unit` derived from the cabin
  width (~7u target), places a curated ring + palisade around the forge, and drops
  each prop's feet to y=0. Skinned/animated props (banners, cauldron, lanterns)
  are avoided — cloning them without their mixer renders broken. Shared
  geometry/materials are deduped in `Set`s; a late-arriving load after `dispose()`
  releases its own resources (`group.userData.disposed` guard).
- `proceduralTextures.makeTerrainSkirt(arenaHalf)` builds a large noise-displaced
  plane ringing the flat arena: rolling foothills rising into a distant mountain
  ridge, with recomputed normals. The flat center uses a **Chebyshev** mask
  (`max(|x|,|z|) ≤ arenaHalf`) to match the SQUARE movement clamp (±(DUNGEON-1)),
  so every reachable coordinate — including corners — stays on y≈0. `baseY=-0.08`
  keeps the flat terrain just under the cobble ground to avoid z-fighting. Added
  in `buildDungeon()`; disposed in `dispose()`.

## Pirate Cove + boss allies (KayKit Pirate Kit)

Neutral pirate NPCs from the KayKit Pirate Kit, integrated as the crew that
offers "boat assistance" and fights as "allies against bosses".

- **Assets** live in `public/models/pirates/`: `chars/*.gltf` (characters) and
  `world/*.gltf` (Ship_Small, Environment_Dock, Prop_Chest_Gold, Prop_Barrel,
  Prop_Anchor), served via `import.meta.env.BASE_URL`. The Pirate Kit `.gltf`
  files are SELF-CONTAINED (embedded buffer + embedded textures + their OWN
  embedded animation clips) — unlike the KayKit *character* GLBs which are
  clip-less and need the shared anim library. So pirates animate NATIVELY: one
  `AnimationMixer` per character plays its embedded clips by name (Idle / Walk /
  Run / Sword / Punch / HitReact / Death / Wave). Their rig uses Capitalised
  bone names (Hips, UpperArm.L, Root, CharacterArmature), incompatible with the
  lowercase KayKit anim-library rig — irrelevant since clips are embedded.
- `PirateNPC.ts` mirrors the loader best-practices used elsewhere: empty group
  returned now + async GLTF inject; `group.userData.disposed` teardown-race
  guard (late load releases its scene); `.isMesh`/`.isSkinnedMesh` flags (not
  `instanceof`); `frustumCulled=false` on skinned meshes; leak-safe
  `disposePirate`/`disposeGltfObject` (geometry + materials + textures).
  `PirateAnimator`: idle/walk crossfade, wave/attack/hit one-shots that return
  to locomotion on `finished`, death is a terminal clamp (`dead` latch).
- **GameEngine `buildPirateCove()`**: spawns a docked ship + dock + loot props
  and 3 NEUTRAL pirates ringing `coveCenter` (30, 0, -6). Pirates are NOT added
  to `this.enemies` and carry NO `enemyId`, so click/hover raycasts (which only
  iterate `this.enemies`) can never target or attack them. The `update()` loop
  advances each pirate mixer and, when the player is within ~11 units, turns the
  pirate to face the player and triggers an occasional wave. `loadCoveProp()`
  and the pirate loader both gate their async callbacks on the engine-level
  `this.disposed` flag / `group.userData.disposed`; `dispose()` removes cove
  objects from the scene and releases all pirate/prop/label resources.
- **Boss Arena allies** (`boss.tsx`): a one-time "Call Allies" button (anchor
  icon, gold) deals a pirate-crew damage burst to the boss with flavored combat
  log lines; `alliesCalled` gates re-use and resets per generated encounter.

## Skills system (all tabs)

- `classSkills.ts` + `skillsResolver.ts` are the single source of truth.
  `useResolvedSkills(charClass, mainCategory)` returns `{ classSkills, weaponType,
  weaponSlots, classWeaponTypes }`. `mainCategory` comes from the equipped
  main-hand (or `CLASS_STARTER_WEAPON[class].category`) and is mapped to a weapon
  type via `categoryToWeaponType`.
- Surfaced on: Grimoire (`skills.tsx`), Armory weapon cards (`equipment.tsx`),
  MainPanel SkillsTab, and the **Game HUD skill bar** (`game.tsx`, bottom-center
  above the action buttons: class glyph cells + weapon-slot skill icons).

## Camp / Training Ground (`/camp`)

`CampScene.ts` + `camp.tsx` turn `/camp` into a combat testing ground: a real
KayKit hero with a full animation set fighting passive training dummies, with a
stone/gold combat HUD ported from the in-game HUD.

- **Fishing-town environment + per-house interactions**: the camp is dressed with
  `public/models/buildings/fishing_town.glb`, an ATLAS (every named building is
  modelled stacked at the origin — see `.agents/memory/fishing-town-atlas.md`). Each
  of the 7 camp interactions is hosted by a distinct building: `STATION_DEFS` maps
  `CampStationId` → building node + angle + color. `loadTown()` async-loads the GLB
  (disposed-guarded, non-fatal), `findBuilding()` resolves nodes (exact + prefix
  fallback), and `placeBuilding()` clones each subtree, bakes `src.matrixWorld`
  (preserving the Y-up correction), normalizes to a 5.5u footprint with feet at y=0,
  and places it at `BUILDING_RADIUS` facing center. `addStation()` puts a glowing
  doorway pad + floating glyph + label + light at the inner `STATION_RADIUS`; engage
  proximity is `d < 3.4`. Station IDs are unchanged so `camp.tsx` engage/panel
  routing is untouched.
- **Player model + animation**: loads the LOCAL hero GLB
  (`public/models/kaykit/heroes/<Name>.glb`, ObjectStore→capsule fallback) and
  drives it with a module-scope `HeroAnimator` — a candidate-based clip resolver
  over the GLB's embedded clips PLUS the shared KayKit clip library
  (`anim/{general,movement,combat}.glb` + `anim-ext/{movement_advanced,combat_ranged,special}.glb`).
  All library GLBs are Rig_Medium (byte-identical to the KayKit pack's
  Rig_Medium_* files), the SAME rig as the heroes, so library clips play directly
  (node-name-bound, no retargeting). States: idle/walk/run/attack/cast/hit/jump/
  dodge. One-shots use `LoopOnce` + `finished` → crossfade back to locomotion.
  `trigger()` returns `false` when no clip resolves so callers fall back to
  `proceduralLunge`. `loadCampAnimLibrary` caches parsed clips at module scope.
- **Combat**: 3 passive dummies (HP bars, hit-flash, death tip-over + 3 s
  respawn), click-raycast targeting, `attackNearest()` auto-approach + basic
  attack loop, `useSkill(idx)` (mana cost / cooldown / AoE damage / VFX ring,
  even slots melee / odd slots cast), `doJump()`/`doDodge()`, damage numbers,
  combat log.
- **HUD** (`camp.tsx`): `stonePanel`/`Rivets` theme, player HP/MP/atk-cd, skill
  bar via `useResolvedSkills` (click + 1–5 keys → `sceneRef.useSkill`), action
  buttons (Attack[F]/Panel[C]/Dungeon/Boss). Keybinds: F=attack, Space=jump,
  Q/Shift=dodge, E=engage station, C=panel. Keeps stations engage + MainPanel.
- **Lifecycle safety**: a scene-level `this.disposed` flag guards every async
  callback (`loader.load` success/error, `loadCampAnimLibrary().then`, RAF helper
  loops) so late results after teardown are ignored/disposed and `onStateUpdate`
  is never called post-dispose. `dispose()` traverses the whole scene via
  module-scope `disposeObject3D` (geometry + materials + textures incl. label
  CanvasTextures) then `scene.clear()`. `emitState()` is throttled to ~30 Hz in
  the render loop (accumulator) to avoid a full React rerender every frame;
  direct one-off `emitState()` calls (init/skill/load) still fire immediately.
- **FBX packs skipped**: Mixamo/grudge6 Action/Magic packs are FBX-only with no
  in-repo converter → not used (only cleanly-converting KayKit GLB clips).

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
