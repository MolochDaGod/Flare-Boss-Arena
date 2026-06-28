---
name: meshy-retexture
description: Reskin existing GLB characters into the Grudge Warlords dark-fantasy house style with Meshy's Retexture API. Use when bringing generic asset-pack models (KayKit heroes, etc.) back to branded "original Grudge" characters, or when batch-retexturing game models. Covers best-practice API params, prompt craft, the pipeline script, and how to re-integrate results.
---

# Meshy Retexture — Grudge Warlords

Turn generic, asset-pack-looking GLB characters into cohesive **original Grudge
Warlords** characters: grim dark fantasy, blackened battle-worn metal, weathered
leather, and the signature ember / antique-gold accent (`#c5a059`). Meshy
*retexture* keeps the mesh + rig and replaces only the textures, so animations,
bone names, and material slots survive — ideal for the KayKit hero GLBs that were
demoted to NPCs because they looked off-brand.

## Auth & cost

- The API key lives in the **`MESHY_API_KEY`** managed secret. Never hard-code,
  log, or echo it. (If it was ever pasted in plaintext, rotate it.)
- `POST /openapi/v1/retexture` spends credits per task (≈10 for a standard PBR
  run; 4K/`hd_texture` costs more). Always `--dry-run` first to confirm the
  payload, and validate **one** character before batch-running the roster.

## The pipeline

```bash
# 1. Inspect the request — spends NO credits:
pnpm --filter @workspace/scripts run meshy:retexture -- --preset knight --dry-run

# 2. Run one character to validate quality:
pnpm --filter @workspace/scripts run meshy:retexture -- --preset knight

# 3. Once approved, run the rest (knight barbarian mage ranger rogue rogue_hooded).
```

Results land in `scripts/.meshy-out/<name>/` (`.glb`, PBR map PNGs, a preview,
and `task.json`). **Meshy output URLs expire** — the script downloads local
copies immediately; never store a Meshy URL as a long-lived asset reference.

- Source + art direction per character: `scripts/src/meshy-presets.ts`.
- Pipeline + best-practice defaults: `scripts/src/meshy-retexture.ts`.

## Best-practice API parameters (and why)

These are the baked-in defaults in the pipeline. They target rigged, game-ready
GLBs rendered by Three.js `MeshStandardMaterial`.

| Param | Default | Why |
| --- | --- | --- |
| `ai_model` | `meshy-6` | Newest; unlocks `remove_lighting`, emission map, and 4K. |
| `enable_original_uv` | `true` | KayKit heroes ship **clean game UVs**. Keep them so the rig, atlas regions, and material slots stay aligned. Only pass `--fresh-uv` for models with bad/no UVs. |
| `enable_pbr` | `true` | The game lights models itself — it needs metallic/roughness/normal maps, not just base color, to read as real armor/leather. |
| `remove_lighting` | `true` | Strips baked highlights/shadows so the base color stays flat and obeys the game's own sun/shadow rig. Double-baked lighting looks muddy. |
| `hd_texture` | `false` | 4K (`--hd`) is worth it for hero close-ups/portraits; skip for crowd NPCs to save credits and task time. |
| `target_formats` | `["glb"]` | Three.js only needs GLB; fewer formats = faster task. |

Use `--image-url` (a 2D style reference) instead of a text prompt when you have a
concrete look to match — it overrides the text prompt and is more faithful, but
only if the reference's silhouette roughly matches the model.

## Prompt craft — the heart of "bringing it back to Grudge"

A retexture prompt describes **materials, palette, and wear — never geometry**
(Meshy can't change the mesh, and shape words just confuse it).

1. **Lead with the character fantasy**, then materials: *"a grim warlord knight in
   blackened battle-scarred steel plate…"*.
2. **Name specific materials**: blackened iron, tarnished steel, oxblood cloth,
   weathered leather, charred robes, dark fur, blackened bronze.
3. **Lock the palette every time** via the shared `GRUDGE_STYLE_SUFFIX`
   (`meshy-presets.ts`): blackened iron / charcoal / deep oxblood / antique
   ember-gold `#c5a059`. Reusing one suffix across all six characters is what
   makes them read as **one cohesive set** instead of six unrelated models.
4. **Describe wear**: soot and rust in the crevices, dents, scuffs, frayed edges,
   ash and dried war-paint. Wear is what separates "original Grudge" from a clean
   store-bought asset.
5. **Negatives matter**: "no bright saturated colors, no glossy plastic, no
   cartoon shading" steers Meshy away from the default cheerful asset-pack look.
6. **Use the ember-gold accent sparingly** — filigree, runes, buckles, trim — as
   a highlight, not a base. It echoes the UI gold and ties characters to the brand.
7. **600-char cap**: `buildPrompt()` enforces it and always preserves the brand
   suffix; keep the core description tight.

## Re-integrating results

1. Eyeball `scripts/.meshy-out/<name>/<name>.preview.png` first (the game's
   Three.js renderer can't screenshot headless — no GPU).
2. The output GLB is a drop-in for the source mesh. Optimize before bundling
   (KayKit heroes are ~350KB; a 4K-PBR retexture can balloon) — run it through a
   `@gltf-transform` prune/texture-resize pass like `build-racalvin-anims.ts`
   does, then place it under `artifacts/grudge-game/public/models/...` and load it
   via `import.meta.env.BASE_URL`.
3. Verify animations still play — `enable_original_uv: true` preserves the rig,
   but always confirm clips after swapping the mesh.

## Gotchas

- **Inline size cap**: the script base64-inlines local GLBs, capped at ~12MB.
  KayKit heroes (<0.5MB) are fine; large monsters (`cultist_armed.glb` ~30MB)
  must be hosted and passed via `--model-url` (a publicly reachable URL).
- **Don't retexture static/atlas props** (`big_scary_*`, `fishing_town.glb`,
  `orc_camp_set.glb`) the same way — atlases pack many objects into one UV space,
  so a single style prompt smears across all of them.
- **Output URLs expire** (see `expires_at`); download immediately (the pipeline
  does this).
