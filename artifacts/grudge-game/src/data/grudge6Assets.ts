/**
 * Canonical Grudge6 D1 asset URLs for flare-boss-arena (no /cdn proxy).
 * Meshes + atlases on R2; baked Bip001 clips on grudge-arena API.
 */

import type { RaceId } from "./characterMeshes";
import type { AllyRole } from "./grudge6Roster";

const ARENA_CDN = "https://assets.grudge-studio.com/arena/assets/characters";
const BAKED_ANIM_BASE = "https://grudge-arena.grudge-studio.com/api/assets/anims/baked";

export const RACE_GLB_FILES: Record<RaceId, string> = {
  human: "WK_Characters.glb",
  barbarian: "BRB_Characters.glb",
  elf: "ELF_Characters.glb",
  dwarf: "DWF_Characters.glb",
  orc: "ORC_Characters.glb",
  undead: "UD_Characters.glb",
};

export const RACE_ATLAS_FILES: Record<RaceId, string> = {
  human: "Map__9.png",
  barbarian: "Map__9.png",
  elf: "Map__9.png",
  dwarf: "Map__12.png",
  orc: "Map__11.png",
  undead: "Map__11.png",
};

export type BakedAnimPack =
  | "unarmed"
  | "magic"
  | "sword_shield"
  | "longbow"
  | "rifle"
  | "pistol";

/** Ally role → baked locomotion/combat pack. */
export const ROLE_TO_BAKED_PACK: Record<AllyRole, BakedAnimPack> = {
  unarmed: "unarmed",
  healer: "magic",
  tank: "sword_shield",
  ranger: "longbow",
  bruiser: "sword_shield",
  fighter: "sword_shield",
  skirmisher: "sword_shield",
};

export const ANIM_PACK_CLIPS: Record<
  BakedAnimPack,
  { idle: string; walk: string; run: string; attack: string }
> = {
  unarmed: {
    idle: "unarmed/fight_idle",
    walk: "locomotion/walking",
    run: "uploads_2026_06/locomotion/torch run forward",
    attack: "unarmed/punching",
  },
  magic: {
    idle: "magic/standing idle",
    walk: "locomotion/walking",
    run: "magic/Standing Run Forward",
    attack: "magic/standing 1h cast spell 01",
  },
  sword_shield: {
    idle: "sword_shield/sword and shield idle",
    walk: "locomotion/walking",
    run: "sword_shield/sword and shield run",
    attack: "sword_shield/sword and shield attack",
  },
  longbow: {
    idle: "longbow/standing idle 01",
    walk: "locomotion/walking",
    run: "longbow/standing run forward",
    attack: "longbow/standing aim recoil",
  },
  rifle: {
    idle: "rifle/idle",
    walk: "rifle/walk forward",
    run: "rifle/run forward",
    attack: "rifle/firing",
  },
  pistol: {
    idle: "pistol/pistol idle",
    walk: "pistol/pistol walk",
    run: "pistol/pistol run",
    attack: "pistol/gunplay",
  },
};

/** Cardinal locomotion fallbacks per baked pack (4-way). */
export const BAKED_DIR_RELS: Record<
  BakedAnimPack,
  { walkBack: string; runBack: string; strafeLeft: string; strafeRight: string }
> = {
  unarmed: {
    walkBack: "longbow/standing walk back",
    runBack: "longbow/standing aim walk back",
    strafeLeft: "locomotion/left strafe walking",
    strafeRight: "locomotion/right strafe walking",
  },
  magic: {
    walkBack: "longbow/standing walk back",
    runBack: "longbow/standing aim walk back",
    strafeLeft: "locomotion/left strafe walking",
    strafeRight: "locomotion/right strafe walking",
  },
  sword_shield: {
    walkBack: "longbow/standing walk back",
    runBack: "longbow/standing aim walk back",
    strafeLeft: "locomotion/left strafe walking",
    strafeRight: "locomotion/right strafe walking",
  },
  longbow: {
    walkBack: "longbow/standing walk back",
    runBack: "longbow/standing run back",
    strafeLeft: "longbow/standing walk left",
    strafeRight: "longbow/standing walk right",
  },
  rifle: {
    walkBack: "rifle/walk backward",
    runBack: "rifle/run backward",
    strafeLeft: "rifle/walk forward",
    strafeRight: "rifle/walk forward",
  },
  pistol: {
    walkBack: "pistol/pistol walk backward",
    runBack: "pistol/pistol run backward",
    strafeLeft: "pistol/pistol strafe",
    strafeRight: "pistol/pistol strafe",
  },
};

/** Extra one-shot clips keyed for triggerNamed(). */
export const BAKED_SKILL_CLIPS: Record<string, string> = {
  cast: "magic/standing 1h cast spell 01",
  cast2H: "magic/standing 2h cast spell 01",
  dodge: "locomotion/dodging",
  hit: "uploads/action/Aerial_Evade",
};

export function raceGlbUrl(race: RaceId): string {
  return `${ARENA_CDN}/${race}/${RACE_GLB_FILES[race]}`;
}

export function raceAtlasUrl(race: RaceId): string {
  return `${ARENA_CDN}/${race}/textures/${RACE_ATLAS_FILES[race]}`;
}

export function bakedAnimUrl(rel: string): string {
  const p = rel.startsWith("/") ? rel.slice(1) : rel;
  return `${BAKED_ANIM_BASE}/${p}.json`;
}

export function animPackForRole(role: AllyRole): BakedAnimPack {
  return ROLE_TO_BAKED_PACK[role] ?? "sword_shield";
}

/** Base human height (m) — multiplied by per-race scale (grudge-arena RaceConfig). */
export const GRUDGE6_BASE_HEIGHT = 1.75;

export const RACE_HEIGHT_SCALE: Record<RaceId, number> = {
  human: 1.0,
  barbarian: 1.12,
  elf: 1.05,
  dwarf: 0.85,
  orc: 1.08,
  undead: 0.95,
};

export function targetHeightForRace(race: RaceId): number {
  return GRUDGE6_BASE_HEIGHT * (RACE_HEIGHT_SCALE[race] ?? 1);
}