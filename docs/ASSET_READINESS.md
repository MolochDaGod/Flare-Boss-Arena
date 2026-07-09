# Asset readiness — characters, monsters, bosses

Reviewed against **D1 `grudge-assets-db` / `asset_registry`**, **R2 `assets.grudge-studio.com`**, and **Flare Boss Arena local** `public/models/`.

## D1 inventory (remote)

| Category | Count | Notes |
|----------|------:|-------|
| animation | ~3k+ | Mixamo / grudge6 / KayKit packs, locomotion, combat |
| building | 496 | Props, RTS sets |
| audio | 378 | SFX |
| terrain | 312 | Terrain tiles |
| asset | 265 | Misc |
| texture | 216 | |
| **character** | **215** | Full body heroes (many Mixamo-rigged GLB) |
| **monster** | **133** | Quaternius-style big/flying packs |
| item | 34 | |
| spell | 7 | |

Characters often include `animation_packs: [glocomotion, glocomotion_combat, gestures_basic]` and `bone_map: mixamo`.

Monsters are mostly **≤700 KB** GLB/GLTF under `models/monsters/big|flying` — excellent multi-spawn candidates.

## Game-ready rubric

| Role | Ready when | Prefer |
|------|------------|--------|
| **Hero (player)** | Native combat clips **or** retarget pack + clean skeleton; feet origin; &lt;8 MB ideal | Labelled idle/run/combo/skill |
| **Monster (fodder)** | Single loop or idle+walk+attack; &lt;2 MB; mixamo/kaykit map | KayKit skeletons, Quaternius big |
| **Boss** | Distinct silhouette, scale ≥1.5×, multi-phase VFX ok with static mesh | Large mon_ GLBs + telegraphs |
| **Rival hero (enemy)** | Same as hero **but** multi-instance cost → use **visual proxy** | kit_/mon_ proxy + AI profile |

## Local Flare Boss Arena (shipped)

### Heroes — **playable now**
All `public/models/skins/*.glb` + Racalvin:

| Asset | ~MB | Clips | Status |
|-------|----:|-------|--------|
| nightmare_luffy, lucci, sanji… | 3–6 | bounty-rush labelled | **Player ready** |
| koby | 13 | numeric scheme | **Player ready** (mapped) |
| ace_sabo_luffy | 14 | labelled | **Player ready** (heavy) |
| racalvin/base + anim/* | 8+clips | library clips | **Player ready** |
| kaykit/heroes/* | &lt;0.5 | via shared anim | NPC/fallback only |

### Monsters — **enemy ready**
| Asset | Status |
|-------|--------|
| mon_pincher, mon_cultist, mon_dante_beast, mon_medusa | **Animated enemies** |
| mon_big_scary_t2/t3 | Static + sway — OK **boss silhouette** |
| kit_skel_* | **Best fodder** (shared anim library) |
| pirates/chars/*.gltf | **NPC only** (own clips, not combat AI) |

### Bosses — **ready path**
- Dungeon: Island Colossus (`mon_big_scary_t3` scaled)
- Arena `/boss`: resolved mon_* from assetPack keywords + phases/telegraphs
- D1 monsters (Demon, Yeti, MushroomKing, Orc…) — **import candidates** (CDN path `models/monsters/big/*.glb`)

## D1 characters — readiness notes

**Strong Mixamo heroes (enemy or future player after retarget QA):**  
assassin-*, night_stalker-*, undead_grave_knight-*, elf_knight, orc_scout-*, werewolf, graatorc_*, humandeathgiver_*  

**Heavy / special (prefer single-instance boss or player only):**  
centaur_outrider-* (~17–19 MB), large Meshy exports  

**Mis-tagged / not combat characters:**  
`stylized_tree_pack` under category character — **prop**, not a fighter  

**Animations already in registry:**  
glocomotion + combat packs + grudge6_brb magic/greatsword/onehanded — enough to drive Mixamo heroes **if** retarget is wired.

## Engine systems added (this pass)

1. **`characterCombatProfiles.ts`** — ability ↔ clip map, aura element, AI brain per fighter  
2. **`heroEnemyLibrary.ts`** — unused fighters as **rivals** (proxy visuals + brains)  
3. **`combat/auras.ts`** — lag-light ground auras / skill pulses  
4. **PlayerAnimator** — `crossFadeTo` locomotion, cleaner one-shots, delta clamp  
5. **GameEngine** — DPR cap 1.5, PCF shadows, rival spawns, brain kite/flank AI  

## Recommended next imports (priority)

1. Pull 8–12 **D1 monster** GLBs (&lt;1 MB) into `public/models/monsters/cdn/` as extra fodder  
2. Pilot **one** Mixamo character (e.g. `assassin-male`) with glocomotion retarget → player or elite  
3. Meshopt/Draco compress skins &gt;6 MB (ace, koby, cultist)  
4. Boss pack: Demon + Yeti + MushroomKing as Island Colossus variants by seed  

## What is *not* game-ready yet

- Raw FBX animation folders without a retarget pipeline into the bounty-rush / KayKit mixers  
- 15+ MB characters multi-spawned (memory/lag)  
- Assets with `bone_map: null` and no embedded clips (need authored or pack binding)  
- Trees / props misfiled as characters  
