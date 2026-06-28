---
name: KayKit hero characters are NPCs only
description: KayKit "hero" GLBs (Knight/Mage/Barbarian/Ranger/Rogue/Rogue_Hooded) are reserved for ambient townsfolk/NPCs and must never render as the player/combatant.
---

# KayKit hero characters are townsfolk/NPCs only

The KayKit hero models under `public/models/kaykit/heroes/` are used **only** as
ambient, non-targetable townsfolk/NPCs via `game/Townsfolk.ts` (`Townsperson`).
They must never be the player or a combatant.

**Why:** Explicit user direction — "replace the kenney characters, use them as
npcs and townsfolk but nothing else." (The repo has no "kenney" assets; the user
means the blocky KayKit adventurers.) The real player models are the One Piece
skins + Racalvin (`data/fighters.ts` / `data/skins.ts`).

**How to apply:**
- Player load: `loadActiveFighterModel` (fighter skin / Racalvin). On failure the
  scenes fall back to a plain capsule (`loadFallbackPlayer` in CampScene/ArenaScene)
  and the Dungeon falls back to the grudge race model — never a KayKit hero.
- KayKit heroes ship a rig but ZERO embedded clips, so townsfolk drive idle/walk
  through the shared KayKit anim library (`loadKayKitAnimLibrary` + `HeroAnimator`).
- Townsfolk carry NO `enemyId`, so click/hover raycasts can't target them.
- KayKit **skeleton** models (`kaykit/enemies/`) are a separate set and remain
  enemies — they are not "townsfolk."
- If adding KayKit heroes anywhere new, it must be an NPC/townsfolk role only.
