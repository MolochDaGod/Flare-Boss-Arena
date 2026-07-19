# VFX hotkeys · weapon skills · PvP rooms · character pack

## VFX (vfxgrudge.puter.site)

Catalog: `src/data/vfxHotkeys.ts`  
Runtime: `src/game/skillVfx.ts` (GLBs under `public/models/vfx/`)

| Key | Effect | GLB kind |
|-----|--------|----------|
| 1 | Fireball | fireball |
| 2 | Getsuga Slash | slash |
| 3 | Chain Lightning | lightning |
| 4 | Moon Beam | light_beam |
| 5 | Frost Wave | ring_green |
| 6 | Poison Cloud | cloud |
| 7 | Inferno | tornado |
| 8 | Ice/Lightning Burst | explosion |
| 9 | Arcane Swirl | spell_glyph |
| 0 | Fire Aura | ring_red |
| Q/E/R/F/Z/X/C/V | alt binds | see catalog |

Staged from `D:\Games\Models\runs\dist\public\models\vfx`.

## Characters

`src/data/runsCharacterPack.ts` → `public/models/races/*`, `heroes/*`, `weapons/*`  
Source: `D:\Games\Models\runs\dist\public\models`.

## PvP rooms

| Mode | Room | Cap |
|------|------|-----|
| 1v1 | `arena:1v1:{match}` | 2 |
| 2v2 | `arena:2v2:{match}` | 4 |
| FFA | `arena:ffa:{match}` | 8 |

UI: `/pvp` · mp-server `INSTANCE_CAPS.arena_1v1` / `arena_2v2`.

## Nexus MainPanel

Mine-Loader: `NexusMainPanel` + hotkey **C** on Play (arena / boss / survival).
