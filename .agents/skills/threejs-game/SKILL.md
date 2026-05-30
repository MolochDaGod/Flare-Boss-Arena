---
name: threejs-game
description: Three.js patterns for the Grudge Warlords browser ARPG (and similar real-time 3D scenes) — renderer/camera setup, GLB loading & normalization, skeletal + authored animation, InstancedMesh, raycasting, and leak-safe disposal. Use when adding or debugging anything under artifacts/grudge-game/src/game (GameEngine, MonsterModels, PlayerAnimator, CampBuilder, proceduralTextures) or any Three.js scene in this repo.
---

# Three.js Game Engine

The game engine lives in `artifacts/grudge-game/src/game/`. It is a **plain class
(`GameEngine.ts`), NOT React hooks** — the render loop must never trigger React
re-renders. UI ↔ engine communication is via explicit method calls and callbacks,
not props.

## Critical gotcha: `instanceof` is BANNED

The app logs "Multiple instances of Three.js" (multiple copies in the dependency
graph). That breaks `instanceof THREE.Mesh`/`Texture`/`SkinnedMesh`. **Always use
the boolean flags instead:**

```ts
obj.traverse((c) => {
  const m = c as THREE.Mesh;
  if (!m.isMesh) return;              // NOT: c instanceof THREE.Mesh
  if ((m as THREE.SkinnedMesh).isSkinnedMesh) { /* ... */ }
});
// textures:
if (val && (val as THREE.Texture).isTexture) (val as THREE.Texture).dispose();
```

## Renderer / scene / camera

- `WebGLRenderer({ antialias: true })` — wrap creation in try/catch and retry with
  `antialias: false`. **Headless/screenshot browsers have no GPU and will throw** —
  a `GameErrorBoundary` must catch this so the page degrades gracefully instead of
  white-screening. Never assume WebGL is available.
- `ACESFilmicToneMapping` + exposure, `outputColorSpace = SRGBColorSpace`.
- Shadows: `PCFSoftShadowMap`. For a large map, keep the shadow map small and make
  the `DirectionalLight` (+ its `.target`) **follow the player every frame** with a
  tight frustum (±~35u) so shadows stay sharp without a huge texture.
- Camera: `OrthographicCamera` for the fixed isometric/tactical view. Keep it
  isometric — lerp camera position toward the player each frame for a smooth follow
  (do NOT switch to third-person/perspective).
- `FogExp2` for depth/atmosphere.

## GLB loading & normalization

Return an **empty `Group` immediately**, add it to the scene, and inject the model
when the async `GLTFLoader.load` resolves. Animation/update code must no-op safely
until the model arrives (guard on null mixer / empty material list).

Normalize every loaded model:
1. `new THREE.Box3().setFromObject(scene)` → measure.
2. Uniform scale to a target height: `scale = targetHeight / size.y`.
3. Recenter on XZ to the group origin; drop feet to `y = 0` (subtract `box.min.y`).
4. `castShadow`/`receiveShadow` on every mesh.
5. On `SkinnedMesh`, set `frustumCulled = false` (else they vanish when culled in
   bind pose).

**Atlas GLBs** (many props stacked at the origin, e.g. `orc_camp_set.glb`): call
`scene.updateMatrixWorld(true)`, then clone a node, reset its local transform, and
**bake the source world matrix** with `clone.applyMatrix4(node.matrixWorld)` to
preserve the FBX→Y-up axis correction. Dedupe shared geometry/materials in `Set`s
so you don't double-dispose. Avoid cloning skinned/animated props without their
mixer — they render broken.

## Animation: native clips vs authored clips

- **Skins (One Piece models):** play the GLB's **native clips**, matched by name
  suffix convention (`_idle_a`, `_run`, `_combo_a`…). If a model has only cryptic
  numeric clips, fall back to idle-only.
- **Race models:** ship with **0 clips** but a clean 25-bone Biped skeleton
  (`Bip001 *`). `PlayerAnimator.ts` synthesizes `AnimationClip`s at runtime by
  rotating named bones relative to their bind pose; derive rotation axes from world
  axes projected into each bone's local frame so clips work across exporters.
- Drive idle/walk/attack from movement state in `update()`. Cross-fade with
  `action.fadeIn/fadeOut`; for one-shot attacks, use the mixer's `"finished"`
  listener to return to the loop. Rigged GLB enemies: single looped clip via
  `THREE.AnimationMixer`; static GLBs get a procedural sway on an inner child node
  so it never fights the facing yaw written on the outer group.
- Always `mixer.update(delta)` in the loop; branch GLB vs procedural-primitive rigs.

## InstancedMesh & procedural content

- Scatter many identical props (rocks, etc.) as ONE `InstancedMesh` = one draw call.
- Procedural geometry (`makeTerrainSkirt`): displace a `PlaneGeometry` with FBM
  value-noise, then `computeVertexNormals()`. **Match the flat playable mask to the
  movement clamp shape** — this game clamps to a SQUARE (`±(DUNGEON-1)`), so use a
  **Chebyshev** mask `max(|x|,|z|) ≤ arenaHalf`, not a circular `hypot`, or the
  reachable corners get displaced and clip the player. Keep the flat plane slightly
  below the gameplay ground (`baseY ≈ -0.08`) to avoid z-fighting.
- Procedural textures: draw to a `<canvas>` and wrap in `CanvasTexture` (color +
  bumpMap), `RepeatWrapping`, max anisotropy, SRGB — no external fetch.

## Raycasting & interaction

- One `Raycaster` for click-to-move/target and hover. Store `userData.enemyId` on
  EVERY mesh during traversal (including async GLB meshes via an onReady retag) so
  hit resolution maps back to game logic regardless of which child mesh is hit.
- Hover glow: clone/adjust emissive, store originals in a `Map`, and restore both
  emissive color AND intensity on clear. Clear hover state on kill and dispose.

## Disposal — the #1 source of leaks

Three.js does NOT garbage-collect GPU resources. Every `dispose()` must recurse:

```ts
root.traverse((c) => {
  const m = c as THREE.Mesh;
  if (!m.isMesh) return;
  m.geometry?.dispose();
  const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
  for (const mat of mats) {
    for (const v of Object.values(mat)) {
      if (v && (v as THREE.Texture).isTexture) (v as THREE.Texture).dispose();
    }
    mat.dispose();
  }
});
```

**Load-after-teardown race:** set `group.userData.disposed = true` in `dispose()`.
In every async loader callback, first check it — if disposed, dispose the
just-loaded `gltf.scene` and return instead of attaching to a dead group. Also
stop/uncache mixers, dispose the ground/terrain/instanced geometry+material+maps,
and remove DOM event listeners (e.g. mousemove) in `dispose()`.

## Verify

- `pnpm --filter @workspace/grudge-game run typecheck` (NOT `build` from bash —
  build needs workflow-injected `PORT`/`BASE_PATH`).
- You cannot screenshot the running game (no GPU in headless) — verify visuals by
  reasoning + typecheck; the error boundary covers the headless case.
