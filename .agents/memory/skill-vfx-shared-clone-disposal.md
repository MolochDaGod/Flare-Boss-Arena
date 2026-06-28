---
name: SkillVfx shared-clone disposal
description: How short-lived GLB VFX (tornado/cloud ring) share GPU resources across clones and what must be disposed on teardown.
---

# SkillVfx shared-clone disposal

`game/skillVfx.ts` spawns short-lived skill VFX by `clone(true)`-ing a preloaded
template GLB. Geometry AND materials (and their textures) are SHARED between the
template and every clone. Clones are torn down by simply removing them from the
scene (and uncaching their per-instance mixer root) — they must NEVER dispose
geometry/materials, or live clones sharing the same buffers break.

Only the templates own GPU disposal, and it must cover **textures too**:
`material.dispose()` does NOT dispose textures in Three.js. The shared
`disposeVfxRoot()` helper iterates each material's keys and disposes any value
whose `.isTexture` is true, then disposes the material and geometry.

**Why:** repeated scene mount/unmount (Dungeon/Camp/Boss enter-exit loop)
otherwise accumulates texture allocations → GPU memory growth.

**How to apply:**
- Each scene owns its own `SkillVfx` (constructed `new SkillVfx(scene, new GLTFLoader())`).
- Call `skillVfx.dispose()` BEFORE any scene-wide `disposeObject3D(scene)` so
  active clones are removed first and templates (never added to the scene) are
  disposed exactly once — no double-dispose of shared buffers.
- The async loader callback must dispose `gltf.scene` if the owner was already
  disposed before the load completed (late-load-after-teardown leak).
