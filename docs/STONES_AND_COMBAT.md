# Attribute stones & combat (standalone)

Flare Boss Arena equipment is **only** eight colored stones — one socket per attribute. No Warlords armory, no complex item bases.

## The 8 stones

| Attr | Color | Primary combat role |
|------|-------|---------------------|
| strength | Crimson | Physical damage, nova/life-on-hit |
| vitality | Rose | Max HP, sustain, blur DR |
| dexterity | Amber | Crit, auto-bolts |
| agility | Jade | Move speed, attack speed, onslaught |
| endurance | Slate | Physical defense, HP |
| intellect | Azure | Spell/skill damage, AoE, burn |
| tactics | Violet | Hybrid skill power, novas, crit |
| wisdom | Moon | Mana, magic defense, chill/shock |

## Rarity → effect count

| Rarity | Effects |
|--------|--------:|
| Common | 1 |
| Uncommon | 2 |
| Rare | 3 |
| Epic | 4 |
| Legendary | 5 |

Effects are rolled from attribute-flavored pools (stats + **procs**).

## Procs (auto effects)

| Proc | Feel |
|------|------|
| Bolt | Extra projectile slash-wave |
| Nova | Splash AoE around target |
| Burn / Chill / Shock | DoT-style flags + VFX color |
| Blur | Short DR when *you* are hit |
| Particles | Extra spark intensity |
| Onslaught | Attack speed buff on kill |

## Stat formulas (`gameCombat.ts`)

```
HP     = 260 + vit×48 + end×22 + stone.health
Mana   = 85 + wis×16 + int×12 + stone.mana
Damage = 16 + str×3.2 + dex×1.2 + tac×0.8 + weapon + stone.damage
Spell  = 1 + int×0.04 + tac×0.015 + stone.spellDamage
Crit   = 6% + dex×1.8% + agi×0.8% + weapon + stone.crit
Def    = end×2% + stone.defense     (less physical taken)
MDef   = wis×2.2% + stone.magicDefense
Speed  = 1 + agi×1.5% + stone.speed
AoE    = 1 + stone.aoe + int×1%
Interval *= (1 − stone.attackSpeed) × onslaught
```

Skills multiply by **spellDamageMult** and skill ranks (`abilityUpgrades`).

## Files

| File | Role |
|------|------|
| `data/stones.ts` | Roll, stash, equip, combat mods |
| `data/procs.ts` | Hit/kill/blur resolution |
| `data/gameCombat.ts` | Loadout formulas |
| `data/abilityUpgrades.ts` | Simple skill ranks (gold) |
| `pages/equipment.tsx` | Socket UI |
| `pages/skills.tsx` | Rank UI |
| `game/GameEngine.ts` | Damage, drops, bolts/novas |

## Drop rules

- Trash: ~28% + tier + round  
- Boss: ~92%  
- Higher rarity more likely on bosses  

## Scripting pattern

1. Pure data modules — no React, no Three  
2. `localStorage` for stash/loadout  
3. Engine reads mods at hit time (always live)  
4. VFX via existing slash field + aura pulses — no new GLBs  

Keep it fun, keep it local, keep models simple.
