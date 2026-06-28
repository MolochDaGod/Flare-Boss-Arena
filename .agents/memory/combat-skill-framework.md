---
name: ARPG skill/combat framework
description: How skill archetypes, damage shapes, telegraphs, deployables, and particles are wired across the three Three.js scenes.
---

# ARPG skill framework (`src/game/combat/`)

Six modules form a scene-agnostic combat layer used by all three Three.js scene
classes (`GameEngine` dungeon, `CampScene` training, `ArenaScene` boss):

- `types.ts` — `ShapeQuery` (kind/origin/dir/radius/halfAngle/length/halfWidth), `DamageShapeKind`, `DeployableKind`.
- `damageShapes.ts` — `pointInShape(q, p)` + `targetsInShape<T extends {position}>()`; all math is on the XZ plane (y ignored).
- `skillArchetypes.ts` — `archetypeForSkill(skill, idx)` maps a `ClassSkill` (or undefined) + slot index to a shape + tuned params + color/telegraph/damageMult. `SkillShapeKind = DamageShapeKind | "deployable"`.
- `particles.ts` — three.quarks wrapper (`ParticleVfx.nova/impact`).
- `telegraphs.ts` — `TelegraphField.show(query, duration, color)` native-shader ground decals.
- `deployables.ts` — `DeployableManager.deploy(kind, pos, color, baseDamage, radius)` persistent entities (fire_totem/turret/trap).

## Cast flow
`useSkill(idx)` → `archetypeForSkill` → resolve aim dir (auto-aim nearest /
cursor-aim while mouse held in dungeon) → if shape is `deployable` deploy (dungeon)
else telegraph + `skillVfx` GLB (tornado/cloud) + particles + `targetsInShape` damage.

## Scene differences (intentional)
- **Dungeon (`GameEngine`)** — full feature set incl. persistent deployables + dual aiming.
- **Camp / Arena** — auto-aim only (nearest dummy / the boss). Deployables are
  downgraded to an instant nova pulse: `const kind = arch.shape === "deployable" ? "nova" : arch.shape`.
  Persistent deployables stay dungeon-only on purpose.

## Gotchas
- **three.quarks bundles its OWN `Vector3`/`Vector4`** (from `quarks.core`),
  incompatible with three's. Import them aliased: `import { Vector3 as QVector3, Vector4 as QVector4 } from "three.quarks"`.
  Use QVectors for `ApplyForce` dir + `startColor` v4. Set `emitter.position.set(x,y,z)`
  (do NOT `.copy()` a three Vector3). Burst count must be `ConstantValue`, not a number.
  `ColorOverLife` needs a `Gradient` (FunctionColorGenerator), not a `ColorRange`.
- **ArenaScene field-name collision**: it already had `telegraphs: Telegraph[]` (boss
  windup decals). The new `TelegraphField` is named `skillTelegraphs` to avoid the clash.
- Pages call `engine.setHudSkills(resolvedClassSkills.slice(0,5))` both at init and in a
  live effect keyed on `hudClassSkills`, so the slot→skill archetype mapping stays current.
- All VFX is wrapped in try/catch — Three.js WebGLRenderer fails headless (no GPU), so VFX
  is unverifiable via screenshots.
