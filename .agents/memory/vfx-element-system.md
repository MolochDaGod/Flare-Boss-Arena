---
name: Element-aware skill VFX
description: How combat skill visuals are made distinct per element + shape, and the classification gotcha
---

# Element-aware skill VFX

`game/combat/particles.ts` is the VFX core. It is ELEMENT-aware, not one recolored blob.

- Four procedural sprite textures (glow / spark / smoke / shard) each get their own additive material.
- `STYLES[element]` palette (fire/ice/lightning/poison/arcane/physical) drives core/edge/tint colors.
- `node(element, pos, scale)` is the atomic per-element burst (the element's "DNA"). Shapes are built by arranging many nodes.
- `castSkillVfx({element, shape, center, origin, dir, reach, halfAngle})` is the high-level entry: nova→ground ring, circle→meteor drop, cone→forward fan, line→beam of sparks, deployable→rising column.
- Back-compat primitives `impact/nova/fireColumn/projectileSprite` remain for boss bolts / melee / detonations.

`game/combat/skillArchetypes.ts` owns element classification + tint:
- `SkillArchetype.element` is required; `color` is derived via `elementColor(element)` (never hand-set per archetype anymore).
- `classifyElement(skill)` keys off id/name/effects substrings + `skill.type`.

**Why distinct silhouettes, not just color:** the user rejected the previous system as "same effects over and over" — every skill fired the same radial-blob nova/impact + the same cloud/tornado GLB. The GLB is now only used for nova/circle; cone/line rely purely on the particle silhouette.

**Gotcha — substring classification collisions:** `classifyElement` matches with `hay.includes(tag)`, so short tags can match unintended words. `"arc"` was removed from the lightning list because it matched `"arcane"`. **How to apply:** before adding any short (≤4 char) element tag, check it isn't a substring of another element's words (e.g. avoid `"ice"` colliding with "slice"/"sacrifice", `"rot"` with "protect"). Compound skill names (Fireball, Frostbolt) RELY on substring matching, so do not switch to strict word-boundary matching.

# 3 cast sites routed through castSkillVfx
`GameEngine.useSkill`, `ArenaScene`, `CampScene` all build `arch=archetypeForSkill(...)` then call `particles.castSkillVfx`. VFX is centered on the actual damage area (origin for circle/nova, since `pointInShape` centers those at origin).
