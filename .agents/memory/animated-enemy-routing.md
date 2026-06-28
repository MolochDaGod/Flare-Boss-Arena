---
name: Animated-only enemy routing
description: Why every dungeon enemy must render as an animated GLB, never the procedural-primitive placeholder.
---

# Animated-only enemy routing

Every spawned dungeon enemy must be a REAL animated GLB — a KayKit skeleton
(`kit_*`, full idle/walk/attack/hit/death state machine) or a clip-driven
monster (`mon_*` with a non-null `clip`). The crude procedural-primitive
box/cone builder (`createEnemyModel`) is a defensive fallback ONLY; it must not
be the visual for normal spawns.

**Why:** The user explicitly rejected placeholder ("map") enemy units and asked
for animated enemies with AI brains. Previously every data-driven bestiary
template (none of whose ids match a GLB roster id) fell through to
`createEnemyModel`, so almost all enemies were blocky placeholders.

**How to apply:**
- `GameEngine.resolveAnimatedModelId(template)` maps any non-roster template to
  an animated GLB id by `archetypeFor(type)` + tier (deterministic via an
  FNV-1a hash of the id/name). Extend its per-archetype pools when adding new
  animated GLBs — never point a pool at a static/rig-less model.
- The two static rig-less `big_scary_*` monsters are excluded from the spawn
  pool via `ANIMATED_MONSTER_TEMPLATES` (clip-only). Don't put them back into
  the auto-spawn roster as "animated" units.
- Enemy disposal branches on the model's real type (`model.kit` then
  `model.isGLB`), NOT `template.id` — because a bestiary template now loads a
  GLB whose own id is unrelated to the template id. Keep it that way.
