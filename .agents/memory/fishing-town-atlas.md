---
name: fishing_town.glb is an atlas
description: How the fishing_town GLB is structured and how /camp consumes it
---

# fishing_town.glb (camp environment)

`public/models/buildings/fishing_town.glb` is an **atlas**, like `orc_camp_set.glb`:
every named building node — `bank_9`, `bar_25`, `guild_51`, `guild.001_49`,
`house_59`, `house.001_67`, `house.002_75`, `house.003_83` — is modelled **stacked
at the origin** (bbox centers ≈ origin; footprints ~1.7–12u). The `island*` nodes
hold spread-out terrain platforms (z≈-5.2) and are unused.

**Why it matters:** you cannot just drop the whole GLB in and read building world
positions — they all overlap at the origin. You must clone each building subtree
out by name and place it yourself.

**How `/camp` (CampScene.ts) consumes it:** `STATION_DEFS` maps each
`CampStationId` → a building node name + angle; `loadTown()` finds the node
(`findBuilding`, exact then prefix fallback) and `placeBuilding()` clones it, bakes
`src.matrixWorld` onto a transform-reset clone (preserves the glTF Y-up axis
correction), normalizes to a fixed footprint with feet at y=0, and wraps it in a
holder placed at `BUILDING_RADIUS` facing center. Glowing engage pads sit closer in
at `STATION_RADIUS`. Only 3 shared materials; no required glTF extensions.
