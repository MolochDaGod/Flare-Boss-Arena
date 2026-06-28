---
name: Dungeon map collision (forge-scene as the real dungeon)
description: Non-obvious decisions and pitfalls for using forge-scene.glb as the walkable dungeon collider; the arena-layout constraint that caps its size.
---

# forge-scene.glb IS the dungeon (game/DungeonMap.ts)

The forge GLB is the real walkable space: a `three-mesh-bvh` collider baked from
its static meshes drives floor-follow, click-to-move picks, and wall collision.
Until the BVH is ready (or if the GLB fails) the engine falls back to the old
flat plane + `±DUNGEON` clamp.

## Floor sampling must probe from the actor's feet, NOT from overhead
**Why:** a downward floor raycast from a fixed high origin returns the *topmost*
surface at that XZ, which in enclosed geometry snaps actors onto roofs/ceilings.
**How to apply:** probe downward from `currentFootY + small step-up allowance`
(~0.6 player, ~1.0 enemies) so the first hit is the floor *under* the actor and
overhead geometry is ignored. This also gives free step up/down. Seat click
markers on the picked ray-hit point, not a re-sampled floor.

## Collision model — horizontal slide + separate floor raycast (NOT a gravity capsule)
**Why:** isometric ARPG has no jumping, and a full gravity capsule jitters on the
dense forge interior. Splitting the concerns is far more stable.
**How to apply:** the capsule shapecast applies only the HORIZONTAL component of
each contact (zero the contact normal's y); vertical placement is owned entirely
by the floor raycast.

## Enemies floor-follow via userData.baseY, not position.y
**Why:** the enemy rig animator rewrites `group.position.y = userData.baseY` every
frame, so setting `position.y` directly is immediately overwritten.
**How to apply:** write `floorY + model.baseY` into `userData.baseY`. Enemies have
NO wall collision yet (player-only) — they can clip forge walls; a known follow-up.

## Async-load disposal race
Any onReady/onError callback fired by the loader must bail when the map is already
disposed, or it pushes state into a torn-down engine. Guard BOTH the success and
error paths with the `disposed` flag.

## Arena-layout constraint caps the dungeon size (~56 units)
**Why:** the orc camp is a palisade ring centered at the WORLD ORIGIN, the pirate
cove sits at ~+x30, and the player spawns at the origin. A forge scaled to fill
the arena would bury the camp and overlap the cove.
**How to apply:** keep `targetExtent` modest (~56). To make the dungeon
dramatically larger, first relocate/remove the origin-centered orc camp and the
+X pirate cove — don't just bump `targetExtent`.
