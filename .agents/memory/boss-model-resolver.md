---
name: Boss model resolver (assetPack → monster GLB)
description: How the AI-generated boss assetPack string is mapped to an actual in-repo model in ArenaScene.
---

# Boss model resolver

The boss-generation API stores an AI-generated `assetPack` string (e.g.
`Boss_Character_Hunter`, `Boss_Character_<Name>`, or `Boss_Character_Default`).

**There are NO dedicated Boss GLBs and no R2 boss-asset convention in this project.**
The shipped 3D bodies are the six monster GLBs in `public/models/monsters/`
(`mon_pincher`, `mon_cultist`, `mon_dante_beast`, `mon_medusa`, `mon_big_scary_t2`,
`mon_big_scary_t3`). The big_scary pair are static (no skeleton — procedural sway only);
the rest are rigged.

`ArenaScene.resolveBossModelId(assetPack, tier)` drives `loadBoss()`:
1. Empty / `boss_character_default` → tier-based `bossMonsterId(tier)`.
2. Thematic keyword match on the lowercased pack (titan/colossus → big_scary_t3,
   thorn/medusa → mon_medusa, hunter/beast → dante_beast, cult/undead → cultist,
   spider/chitin → pincher, etc.).
3. No match → deterministic FNV-1a hash of the pack picks from a rigged-first pool,
   so the same boss always gets the same (varied) body.

`loadBoss()` still guards the result with `isMonsterId` and falls back to
`bossMonsterId(tier)` if a resolved id is somehow not a shipped monster.

**Why:** the requirement was to drive boss identity from the generated `assetPack`,
not tier alone. Inventing R2 URLs would create silent 404 failures, so the honest
path is to map onto assets that actually ship.

**How to apply:** if real Boss GLBs are ever added (R2 or in-repo), extend
`resolveBossModelId` to prefer them and keep this monster mapping as the fallback.
