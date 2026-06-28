---
name: Skill/weapon icon CDN routing
description: Where skill & weapon icons actually live, and the SPA-fallback trap when probing local icon paths.
---

Skill/weapon icon `src` resolution must go through `skillIconSrc()` in
`data/skillIcons.ts`. Two distinct icon sources exist and must NOT be conflated:

- `icons/skilltree/**` — bundled in `grudge-game/public/`; served from the app's
  own `BASE_URL`.
- everything else under `icons/**` (e.g. `icons/pack/weapons/Sword_01.png`,
  which the skills API returns as `icon`) — lives ONLY on the ObjectStore CDN
  `https://molochdagod.github.io/ObjectStore`. It is NOT bundled locally.

**Trap:** curling a local pack-icon path (e.g. `localhost/icons/pack/...`)
returns HTTP 200 — but it's the Vite SPA `index.html` fallback
(`content-type: text/html`), NOT a real image. Always check `content-type`, not
just the status code, when verifying an asset path.

**Why this broke before:** several pages hardcoded
`https://molochdagod.github.io/ObjectStore/icons/skill_nobg/${icon}`. With the
API now returning `icon = "/icons/pack/weapons/Sword_01.png"`, that produced a
malformed `.../skill_nobg//icons/pack/...` URL → 404 → the UI fell back to
2-letter text placeholders. The `skill_nobg/` subfolder does not exist for these
icons.

**How to apply:** never build skill icon URLs inline. Use the `<SkillIcon>`
component (graceful emoji fallback) or `skillIconSrc()` everywhere class/weapon
skills are surfaced (home, game, camp, boss, skills pages).
