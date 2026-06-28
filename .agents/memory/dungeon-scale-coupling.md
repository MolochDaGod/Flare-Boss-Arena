---
name: Dungeon arena scale coupling
description: The handful of constants that must move together when resizing the dungeon, and why the pirate cove can't just sit anywhere.
---

The dungeon's size is governed by two coupled numbers in `game/GameEngine.ts`
plus `game/DungeonMap.ts`, and several satellites that derive from them:

- `this.DUNGEON` (GameEngine) — half-extent of the playable square (±DUNGEON).
  Drives the ground plane, click plane, terrain skirt, rock field, torch grid
  (`step = DUNGEON/2`), and the player/enemy XZ clamps. Change this and those
  all scale automatically.
- `targetExtent` passed to `new DungeonMap({...})` (in `loadEnvironment`) — the
  longest XZ size the `forge-scene.glb` (the actual dungeon geometry + its BVH
  wall/floor collider) is scaled to. This is the visible/collidable dungeon; it
  is independent of `DUNGEON`, so it must be set in proportion or the forge will
  be smaller/larger than the walkable square.

**The cove constraint (why it can't sit anywhere):** the orc camp sits in the
forge's OPEN CENTER (origin), and the pirate cove (`coveCenter`) must sit on the
flat terrain ring JUST PAST the forge's edge — i.e. `coveCenter.x` a bit larger
than `targetExtent/2`, but still `< DUNGEON`. If the forge grows past the cove,
the cove ends up inside forge walls/props.

**Rule of thumb that keeps the layout intact when resizing:**
`targetExtent/2  <  coveCenter.x  <  DUNGEON`, and bump the sun shadow frustum
(`sun.shadow.camera.left/right/top/bottom` + `.far`) and ortho camera zoom `d`
(set in BOTH the constructor and `onResize`) so shadows/framing cover the bigger
map. The camera follows the player, so map size alone doesn't require a `d`
change — `d` is purely how much you see at once.

**Why:** a request to make the dungeon "much larger" only looks right if the
forge, the play clamp, and the cove offset all scale together; touching one in
isolation either shrinks the real dungeon relative to the walkable floor or
buries the cove in walls.

**Headless caveat:** you cannot screenshot-verify any of this — WebGL has no GPU
in the screenshot browser, so the game renders its error fallback. Ship sensible
proportions and have the user (real GPU) confirm framing/overlap.
