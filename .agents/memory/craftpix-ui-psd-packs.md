---
name: CraftPix RPG/MMO UI PSD packs
description: How to extract usable UI textures from the two craftpix UI asset packs (PSD-only) and which are on-theme
---

# CraftPix UI packs (attached_assets)

Two UI asset packs were provided as **PSD-only** (no PNGs shipped):
- `craftpix-net-226770-rpg-mmo-user-interface*.zip` → one PSD `RPG_&_MMO_User_Interface.psd`
- `craftpix-net-149019-rpg-ui-elements*.zip` → `fant_UI_1.psd`, `fant_UI_2.psd`, `fant_UI_3.psd`

## Theme fit (vs the game's dark-fantasy ember/gold)
- **Pack 226770 (RPG_&_MMO)** — GREEN/wood themed. OFF-theme; avoid unless recolored.
- **fant_UI_1** — ON-theme (dark + ember): Menu bar, Globe (health orb), Loading Bar, Cast Bar, Unitframe, Action Bar slots, Scale bars, Checkbox/Radio, Separator, window Container.
- **fant_UI_2** — 32 monochrome GRAY glyph icons (need tinting to gold).
- **fant_UI_3** — ON-theme (best match): red "!" warning/notification banner, parchment dialog boxes, inner containers.

## Extraction (how to get usable transparent PNGs)
- These PSDs are "vectors + Layer Styles" but the styling is **baked into shape fills**, NOT non-destructive layer effects (psd_tools reports `effects` empty / `fx=False`). So:
  - `magick "file.psd[0]"` → fully-styled FLATTENED composite (whole sheet, has baked brown background — not transparent).
  - **psd_tools composite-by-named-group → transparent, styled element PNGs.** Layers are well-grouped & named (e.g. `Menu`, `Unitframe`, `Action Bar`, `Loading Bar`, `Globe`, `--- Seperator`, `Cast Bar / Simple Unitframe`). This is the way to get individual sprites.
- Gotcha: don't name a python script `inspect.py` — it shadows stdlib `inspect` and psd_tools fails to import (circular import error).
- Tooling: `pip install psd-tools` (Pillow/numpy pulled in). ImageMagick `magick` present.
- Gotcha: psd_tools `composite()` does NOT render non-destructive Layer FX (bevel/glow/stroke); groups that rely on FX export as FLAT GRAY. Such elements (panel-frame, slot-frame, action-bar, unitframe, menu-bar, avatar-frame) had to be dropped; only baked-fill elements survive (globe, bar-frame/fill, cast/scale frame, separator, warning banner+icon, parchment panel).

## Runtime usage (CraftpixUI.tsx primitives)
- A frame texture (bar-frame/cast-frame/scale-frame) has a recessed inner CHANNEL; the CSS fill must be **inset by %** so it seats INSIDE the frame, not over the bezel. Insets are per-frame and need eyeball tuning (used ~5.5% left/right, ~32% top/bottom for bars). The OrbGauge seats a colored fill behind the glossy globe PNG and blends with an overlay at ~0.45 opacity.
- Always build asset URLs from a normalized `import.meta.env.BASE_URL` (vite.config enforces a non-root `base`); root-relative `/ui/...` breaks under the path prefix.
