/**
 * Canonical Grudge6 D1 asset URLs for flare-boss-arena (no /cdn proxy).
 * Meshes + atlases on R2; baked Bip001 clips on assets.grudge-studio.com
 * (manifest: anims/baked/manifest.json). Paths below are verified 200s.
 */

import type { RaceId } from "./characterMeshes";
import type { AllyRole } from "./grudge6Roster";

const ARENA_CDN = "https://assets.grudge-studio.com/arena/assets/characters";
/** Primary: assets CDN mirror (reliable). Fallback: grudge-arena API. */
export const BAKED_ANIM_BASES = [
  "https://assets.grudge-studio.com/anims/baked",
  "https://grudge-arena.grudge-studio.com/api/assets/anims/baked",
] as const;
/** @deprecated use BAKED_ANIM_BASES — kept for callers that import a single base. */
const BAKED_ANIM_BASE = BAKED_ANIM_BASES[0];

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
  | "pistol"
  | "greatsword_samurai";

/** Ally role → baked locomotion/combat pack (paths that exist on CDN). */
export const ROLE_TO_BAKED_PACK: Record<AllyRole, BakedAnimPack> = {
  unarmed: "unarmed",
  healer: "magic",
  tank: "greatsword_samurai",
  ranger: "rifle",
  bruiser: "greatsword_samurai",
  fighter: "greatsword_samurai",
  skirmisher: "unarmed",
};

/**
 * Clip rels without `.json` — only paths confirmed on assets.grudge-studio.com.
 * Missing specialty clips fall back in bakedAnimLoader to locomotion/unarmed.
 */
export const ANIM_PACK_CLIPS: Record<
  BakedAnimPack,
  { idle: string; walk: string; run: string; attack: string }
> = {
  unarmed: {
    idle: "unarmed/fight_idle",
    walk: "locomotion/walking",
    run: "locomotion/running",
    attack: "unarmed/punching",
  },
  magic: {
    idle: "locomotion/idle",
    walk: "locomotion/walking",
    run: "locomotion/running",
    attack: "unarmed/lead_jab",
  },
  sword_shield: {
    idle: "greatsword_samurai/gs_samurai_idle_sword",
    walk: "greatsword_samurai/gs_samurai_walk_sword",
    run: "greatsword_samurai/gs_samurai_run_sword",
    attack: "greatsword_samurai/gs_samurai_combo_a",
  },
  longbow: {
    idle: "locomotion/idle",
    walk: "locomotion/walking",
    run: "locomotion/running",
    attack: "rifle/firing",
  },
  rifle: {
    idle: "rifle/idle",
    walk: "locomotion/walking",
    run: "locomotion/running",
    attack: "rifle/firing",
  },
  pistol: {
    idle: "locomotion/idle",
    walk: "locomotion/walking",
    run: "locomotion/running",
    attack: "pistol/gunplay",
  },
  greatsword_samurai: {
    idle: "greatsword_samurai/gs_samurai_idle_sword",
    walk: "greatsword_samurai/gs_samurai_walk_sword",
    run: "greatsword_samurai/gs_samurai_run_sword",
    attack: "greatsword_samurai/gs_samurai_combo_a",
  },
};

/** Universal locomotion fallbacks (always present on CDN). */
export const LOCO_FALLBACK = {
  idle: "locomotion/idle",
  walk: "locomotion/walking",
  run: "locomotion/running",
  attack: "unarmed/punching",
  dodge: "locomotion/dodging",
  jump: "locomotion/jump",
} as const;

/** Cardinal locomotion fallbacks — use working locomotion paths only. */
export const BAKED_DIR_RELS: Record<
  BakedAnimPack,
  { walkBack: string; runBack: string; strafeLeft: string; strafeRight: string }
> = {
  unarmed: {
    walkBack: "locomotion/walking",
    runBack: "locomotion/running",
    strafeLeft: "locomotion/walking",
    strafeRight: "locomotion/walking",
  },
  magic: {
    walkBack: "locomotion/walking",
    runBack: "locomotion/running",
    strafeLeft: "locomotion/walking",
    strafeRight: "locomotion/walking",
  },
  sword_shield: {
    walkBack: "greatsword_samurai/gs_samurai_walk_sword",
    runBack: "greatsword_samurai/gs_samurai_run_sword",
    strafeLeft: "locomotion/walking",
    strafeRight: "locomotion/walking",
  },
  longbow: {
    walkBack: "locomotion/walking",
    runBack: "locomotion/running",
    strafeLeft: "locomotion/walking",
    strafeRight: "locomotion/walking",
  },
  rifle: {
    walkBack: "locomotion/walking",
    runBack: "locomotion/running",
    strafeLeft: "locomotion/walking",
    strafeRight: "locomotion/walking",
  },
  pistol: {
    walkBack: "locomotion/walking",
    runBack: "locomotion/running",
    strafeLeft: "locomotion/walking",
    strafeRight: "locomotion/walking",
  },
  greatsword_samurai: {
    walkBack: "greatsword_samurai/gs_samurai_walk_sword",
    runBack: "greatsword_samurai/gs_samurai_run_sword",
    strafeLeft: "locomotion/walking",
    strafeRight: "locomotion/walking",
  },
};

/**
 * Extra one-shot clips for triggerNamed() — only CDN-verified paths.
 * Unknown names fall back to attack/punch in the loader.
 */
export const BAKED_SKILL_CLIPS: Record<string, string> = {
  cast: "unarmed/lead_jab",
  cast2H: "unarmed/punching",
  cast2h: "unarmed/punching",
  fireball: "unarmed/lead_jab",
  ice_spike: "unarmed/lead_jab",
  chain: "unarmed/punching",
  nova: "unarmed/punching",
  aoe: "unarmed/punching",
  barrier: "locomotion/idle",
  bolt: "unarmed/lead_jab",
  charged: "unarmed/punching",
  slash: "greatsword_samurai/gs_samurai_combo_a",
  slash2: "greatsword_samurai/gs_samurai_combo_b",
  thrust: "greatsword_samurai/gs_samurai_combo_a",
  power_strike: "greatsword_samurai/gs_samurai_combo_b",
  cleave: "greatsword_samurai/gs_samurai_combo_a",
  block: "locomotion/idle",
  block_idle: "locomotion/idle",
  power_up: "greatsword_samurai/gs_samurai_idle_sword",
  draw: "greatsword_samurai/gs_samurai_idle_sword",
  sheath: "greatsword_samurai/gs_samurai_idle",
  combo: "greatsword_samurai/gs_samurai_combo_a",
  combo2h: "greatsword_samurai/gs_samurai_combo_b",
  great_slash: "greatsword_samurai/gs_samurai_combo_a",
  dual_combo: "greatsword_samurai/gs_samurai_combo_b",
  chop: "unarmed/punching",
  hack: "greatsword_samurai/gs_samurai_combo_a",
  wild_swing: "greatsword_samurai/gs_samurai_combo_b",
  whirlwind: "greatsword_samurai/gs_samurai_combo_a",
  smash: "unarmed/punching",
  slam: "greatsword_samurai/gs_samurai_combo_b",
  aimed: "rifle/firing",
  quick_shot: "rifle/firing",
  volley: "rifle/firing",
  aim_idle: "rifle/idle",
  draw_arrow: "rifle/idle",
  dodge_left: "locomotion/dodging",
  dodge_right: "locomotion/dodging",
  dodge_back: "locomotion/dodging",
  fire: "pistol/gunplay",
  burst: "rifle/firing",
  sniper: "rifle/firing",
  reload: "rifle/reloading",
  dodge: "locomotion/dodging",
  combat_roll: "locomotion/dodging",
  hit: "locomotion/idle",
  death: "locomotion/idle",
  jump: "locomotion/jump",
  jab: "unarmed/lead_jab",
  punch: "unarmed/punching",
  claw: "unarmed/punching",
  dash: "greatsword_samurai/gs_samurai_dash_opener",
  teleport: "greatsword_samurai/gs_samurai_dash_opener",
};

export function raceGlbUrl(race: RaceId): string {
  return `${ARENA_CDN}/${race}/${RACE_GLB_FILES[race]}`;
}

export function raceAtlasUrl(race: RaceId): string {
  return `${ARENA_CDN}/${race}/textures/${RACE_ATLAS_FILES[race]}`;
}

/** Encode each path segment for spaces in clip names. */
export function bakedAnimUrl(rel: string, baseIndex = 0): string {
  const p = rel.replace(/\.json$/i, "").replace(/^\//, "");
  const base = BAKED_ANIM_BASES[baseIndex] ?? BAKED_ANIM_BASES[0];
  const enc = p
    .split("/")
    .map((s) => encodeURIComponent(s))
    .join("/");
  return `${base}/${enc}.json`;
}

/** All candidate URLs for a clip (primary + mirrors). */
export function bakedAnimUrls(rel: string): string[] {
  return BAKED_ANIM_BASES.map((_, i) => bakedAnimUrl(rel, i));
}

export function animPackForRole(role: AllyRole): BakedAnimPack {
  return ROLE_TO_BAKED_PACK[role] ?? "sword_shield";
}

/** Toon soldier class -> rifle/pistol pack (chicken_gun multipack). */
export type ToonSoldierClass =
  | "scout"
  | "engineer"
  | "gunner"
  | "infantry"
  | "medic"
  | "sniper";

export const TOON_SOLDIER_PACK: Record<ToonSoldierClass, BakedAnimPack> = {
  scout: "pistol",
  engineer: "rifle",
  gunner: "rifle",
  infantry: "rifle",
  medic: "pistol",
  sniper: "rifle",
};

export const TOON_SOLDIERS_CDN =
  "https://assets.grudge-studio.com/models/toon-soldiers";

export function toonSoldierGlbUrl(
  cls: ToonSoldierClass,
  variant: "a" | "b" = "a",
): string {
  return `${TOON_SOLDIERS_CDN}/${cls}/${cls}-${variant}.glb`;
}

export function animPackForToonClass(cls: ToonSoldierClass): BakedAnimPack {
  return TOON_SOLDIER_PACK[cls] ?? "rifle";
}

/** Toon gameplay modes including Mixamo-retargeted packs. */
export type ToonWeaponMode =
  | "pistol"
  | "rifle"
  | "shooter"
  | "longbow"
  | "adventure"
  | "native";

export const TOON_CLASS_DEFAULT_MODE: Record<ToonSoldierClass, ToonWeaponMode> = {
  scout: "pistol",
  engineer: "rifle",
  gunner: "rifle",
  infantry: "shooter",
  medic: "pistol",
  sniper: "rifle",
};

/** Longbow attack/dodge set for Nexus Era bows on toon characters. */
export const TOON_LONGBOW_CLIPS = {
  idle: "longbow/standing idle 01",
  walk: "longbow/standing walk forward",
  run: "longbow/standing run forward",
  attack: "longbow/standing aim recoil",
  dodge: "longbow/standing dodge forward",
  dodgeBack: "longbow/standing dodge backward",
  dodgeLeft: "longbow/standing dodge left",
  dodgeRight: "longbow/standing dodge right",
  draw: "boxanimations/longbow/Standing Draw Arrow (1)",
  aimIdle: "boxanimations/longbow/Standing Aim Idle 02 Looking",
} as const;

/** Adventure traversal blends - Mixamo swim family + climb/crouch. */
export const TOON_ADVENTURE_CLIPS = {
  climb: "boxanimations/traversal/Climbing To Top",
  climbDown: "boxanimations/traversal/Climbing Down Wall",
  swim: "locomotion/swimming",
  swimIdle: "locomotion/treading-water",
  swimToLedge: "locomotion/swimming-to-ledge",
  crouch: "boxanimations/locomotion/Crouch Walk",
  sneak: "boxanimations/locomotion/Sneak Walk",
  jump: "locomotion/jump",
  dodge: "locomotion/dodging",
  roll: "boxanimations/locomotion/Quick Roll To Run (1)",
} as const;

export function toonLongbowUrl(rel: keyof typeof TOON_LONGBOW_CLIPS): string {
  return bakedAnimUrl(TOON_LONGBOW_CLIPS[rel]);
}

export function toonAdventureUrl(rel: keyof typeof TOON_ADVENTURE_CLIPS): string {
  return bakedAnimUrl(TOON_ADVENTURE_CLIPS[rel]);
}

/** Base human height (m) - multiplied by per-race scale (grudge-arena RaceConfig). */
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
