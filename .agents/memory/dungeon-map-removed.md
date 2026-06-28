---
name: Dungeon forge-scene map removed
description: Why the forge-scene.glb dungeon model is no longer loaded and how movement still works
---

The `forge-scene.glb` dungeon model (loaded via `DungeonMap` in `GameEngine.loadEnvironment`)
was removed at the user's request — it sat centered at the origin and read as an
unwanted structure in the middle of the play area.

**Decision:** `loadEnvironment()` no longer instantiates/loads `DungeonMap`; it just
sets `mapReady = true` and notifies state so the loading veil clears. `this.dungeonMap`
stays `null`.

**Why this is safe:** every map-dependent branch in `GameEngine` is guarded by
`this.dungeonMap?.ready`. With `dungeonMap` null, all of them take the pre-existing
flat-plane fallback:
- `resolvePlayer` / `clampToArena` — square clamp to ±(DUNGEON-1), player.y = 0.
- floor picks (click-to-move, cursor-aim, hover) — raycast `this.floorPlane`.
- enemy floor-follow — enemies keep their y (flat ground).

The procedural arena (flat stone floor, terrain skirt, rock field, click plane) built
in `buildDungeon()` is untouched, as are the orc camp + pirate cove. The `DungeonMap`
class/import remain (the field type references it) but are dormant.

**How to apply:** if generative levels/zones (which were blocked on the dungeon map) are
revisited, decide deliberately whether to bring the GLB map back or build zones on the flat
procedural floor. Do not assume the forge-scene map is present.
