---
name: Boss arena attack VFX
description: Boss projectile/telegraph/detonation visuals must use the shared VFX systems, not primitives
---

Boss attacks in `ArenaScene` must render through the existing VFX systems, never
primitive geometry. A code review rejected an earlier version that used raw
`SphereGeometry` (bolts), `RingGeometry`/`CircleGeometry` (telegraphs + shockwaves).

**Rule:**
- Projectile body → `ParticleVfx.projectileSprite(color, size)` — a glowing additive
  billboard reusing the shared soft-radial particle texture. Caller adds/moves it and
  disposes the returned `SpriteMaterial` (texture is shared, freed in `ParticleVfx.dispose`).
- Projectile trail/muzzle/impact → `ParticleVfx.impact`.
- Telegraph wind-up warning → `skillTelegraphs.show(ShapeQuery, windup, color)`
  (TelegraphField native-shader ground decal). The `ArenaScene` `Telegraph` entry only
  tracks strike timing; it owns no meshes.
- Detonation/strike/phase/death → `ParticleVfx.nova` + `impact` (via `spawnVfx`), plus
  a `SkillVfx.spawn("cloud"/"tornado")` GLB flourish.

**Why:** keeps boss VFX consistent with player skill VFX and the "use shipped GLB/particle
assets, not primitives" requirement. ONE particle burst system (ParticleVfx) — do not add a
parallel one.
