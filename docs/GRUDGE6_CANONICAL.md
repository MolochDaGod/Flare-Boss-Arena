# Grudge6 canonical character system

**Single high-quality path** for Warlords-era units (meshes, wardrobe, Bip001, ally AI).  
No parallel “another character loader” — everything party/codex/allies-shaped should go through here.

## Source of truth

| Piece | Location |
|-------|----------|
| 30-pack atlas (local, 262MB) | `public/models/grudge6/30characters.glb` (**gitignored**) |
| Desktop source | `Desktop/MouseWithoutBorders/30grudge6characters.glb` |
| Roster JSON | `src/data/grudge6Roster.generated.json` |
| Roster API | `src/data/grudge6Roster.ts` |
| Loader + wardrobe | `src/game/grudge6/Grudge6Character.ts` |
| Ally AI | `src/game/grudge6/AllyBrain.ts` |
| Party UI | `/party` |
| Race CDN fallback | `assets.grudge-studio.com/.../toon-rts-characters/glb/characters/<race>.glb` |

## The 30 heroes

Parsed from the atlas: **30 roots**, each a curated wardrobe on a **Bip001** (21 bones).  
Races: WK (human), ELF, DWF, ORC, UD, BRB.  
Roles inferred from weapons: healer (staff), tank (shield), ranger (bow), bruiser (axe), unarmed (body only), fighter.

Atlas has **no clips** — motion is **authored Biped clips** (`PlayerAnimator.buildAuthoredClips`) with bone-name normalization (`Bip001_L_Thigh` ↔ `Bip001 L Thigh`).

## Loading strategy (avoid duplication)

```
createGrudge6Character(def)
  1. Load CDN race GLB (cached per race) — deploy-friendly
  2. applyMeshAllowList(def.meshSample) — match 30-pack look
  3. normalizeBipedBoneNames + authored idle/walk/attack
  4. Optional: local atlas clone by rootIndex if 30characters.glb present
```

Do **not** add a second wardrobe system. Extend `characterMeshes.ts` classifiers only if mesh naming needs it.

## Party (max 2)

- `getPartyAllyIds()` / `setPartyAllyIds()` / `togglePartyAlly()`
- Default suggestion: healer + tank
- `GameEngine.spawnPartyAllies()` after map ready
- Brains: `bodyguard` | `healer` | `skirmish` | `gatherer` | `assassin`

### Ally behaviors

| Brain | Behavior |
|-------|----------|
| bodyguard | Formation follow; attack player RMB focus |
| healer | Heal player under ~72% HP; light damage otherwise |
| skirmish | Ranged kit; kite if too close |
| gatherer | Chop/mine when no combat focus |
| assassin | Prefer low-HP% enemies |

Allies share player **RMB target** (`attackHeld` / `targetEnemy`).

## Codex world (`codex.grudge-studio.com/game/world`)

Use the **same** packages:

1. Copy or npm-link `grudge6Roster.ts` + `Grudge6Character.ts` + `AllyBrain.ts`
2. Point race URLs at the same CDN `PORTRAIT_URL`
3. Keep roster JSON as the unit catalog (ids must not fork)

When splitting a monorepo package later: `@grudge/grudge6-characters`.

## Regenerating the roster

```bash
# From Flare-Boss-Arena root — re-parse desktop atlas
node scripts/parse-grudge6-atlas.mjs   # or the inline node extract used in session
```

Manifest fields: `id`, `rootIndex`, `race`, `role`, `meshSample`, `weaponMesh`.

## Do not

- Ship the 262MB atlas to Vercel without R2/CDN
- Create a second “ToonLoader” / “WarlordsUnit” path
- Load full atlas wardrobe without allow-list (walking armory)
- Embed one-off animations per unit when shared Bip001 clips exist

## AI learning notes

- Brains are pure functions (`thinkAlly`) — easy to unit-test and swap for GOAP later
- Formation slots 0/1 = left/right rear of player facing
- Skill timing: per-agent `attackCd` / `healCd` from kit table
