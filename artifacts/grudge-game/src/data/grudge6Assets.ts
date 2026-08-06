/**
 * Canonical Grudge6 / Toon RTS asset URLs (STONE SSOT).
 *
 * ★ PLAY MESH (only):
 *   assets.grudge-studio.com/asset-packs/toon-rts-characters/glb/characters/{raceId}.glb
 *
 * Atlas:
 *   assets.grudge-studio.com/textures/grudge6/{folder}/{file}.webp
 *
 * LEGACY (fallback only — wrong bake / compare):
 *   models/grudge6/races/{PREFIX}_Characters.glb · metaverse/*
 *
 * @see skill grudge6-cdn-ssot · ObjectStore grudge6-kit loadRaceKit(toonRts)
 */

import type { RaceId } from "./characterMeshes";
import type { AllyRole } from "./grudge6Roster";
import {
  colorAtlasPublicUrl,
  type ToonColorSet,
} from "./toonRtsColorSets";

const ASSETS_CDN = "https://assets.grudge-studio.com";
/** Baked Bip001 rotation-only packs (fleet combat runtime). */
const BAKED_ANIM_BASE = "https://grudge-arena.grudge-studio.com/api/assets/anims/baked";
/** Open same-origin mirror often more reliable than raw arena for baked JSON. */
const BAKED_ANIM_FALLBACK = "https://open.grudge-studio.com/anims/baked";

export const RACE_KIT_PREFIX: Record<RaceId, string> = {
  human: "WK",
  barbarian: "BRB",
  elf: "ELF",
  dwarf: "DWF",
  orc: "ORC",
  undead: "UD",
};

export const RACE_GLB_FILES: Record<RaceId, string> = {
  human: "WK_Characters.glb",
  barbarian: "BRB_Characters.glb",
  elf: "ELF_Characters.glb",
  dwarf: "DWF_Characters.glb",
  orc: "ORC_Characters.glb",
  undead: "UD_Characters.glb",
};

/** Verified 200 atlas webp paths (grudge6-cdn-ssot). */
export const RACE_ATLAS_PATHS: Record<RaceId, string> = {
  human: "textures/grudge6/western-kingdoms/WK_Standard_Units.webp",
  barbarian: "textures/grudge6/barbarians/BRB_StandardUnits_texture.webp",
  elf: "textures/grudge6/elves/ELF_HighElves_Texture.webp",
  dwarf: "textures/grudge6/dwarves/DWF_Standard_Units.webp",
  orc: "textures/grudge6/orcs/ORC_StandardUnits.webp",
  undead: "textures/grudge6/undead/UD_Standard_Units.webp",
};

/** @deprecated Use RACE_ATLAS_PATHS — kept for log labels only. */
export const RACE_ATLAS_FILES: Record<RaceId, string> = {
  human: "WK_Standard_Units.webp",
  barbarian: "BRB_StandardUnits_texture.webp",
  elf: "ELF_HighElves_Texture.webp",
  dwarf: "DWF_Standard_Units.webp",
  orc: "ORC_StandardUnits.webp",
  undead: "UD_Standard_Units.webp",
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

/**
 * Extra one-shot clips keyed for triggerNamed().
 * Expanded for uMMORPG weapon skills (sword/axe/bow/staff/gun) + Warlords T0 kits.
 * Paths: warlord-genesis + boxanimations baked on grudge-arena CDN.
 */
export const BAKED_SKILL_CLIPS: Record<string, string> = {
  // Magic
  cast: "magic/standing 1h cast spell 01",
  cast2H: "magic/standing 2h cast spell 01",
  cast2h: "magic/standing 2h cast spell 01",
  fireball: "magic/standing 2h cast spell 01",
  ice_spike: "magic/standing 2h magic attack 01",
  chain: "magic/standing 2h magic attack 03",
  nova: "magic/standing 2h magic area attack 01",
  aoe: "magic/Standing 2H Magic Area Attack 02",
  barrier: "magic/spell casting",
  bolt: "magic/standing 1h cast spell 01",
  charged: "magic/Standing 1H Magic Attack 01",
  // Sword / shield melee
  slash: "sword_shield/sword and shield slash",
  slash2: "sword_shield/sword and shield slash 1",
  thrust: "sword_shield/sword and shield attack (1)",
  power_strike: "sword_shield/sword and shield attack (2)",
  cleave: "sword_shield/sword and shield attack (3)",
  block: "sword_shield/sword and shield block",
  block_idle: "sword_shield/sword and shield block idle",
  power_up: "sword_shield/sword and shield power up",
  draw: "sword_shield/draw sword 1",
  sheath: "sword_shield/sheath sword 1",
  // 1H/2H sword + dual
  combo: "sword/one hand sword combo",
  combo2h: "sword/two hand sword combo",
  great_slash: "sword/great sword slash",
  dual_combo: "dual/dual weapon combo",
  // Club / axe / mace / hammer proxies
  chop: "club/one hand club combo",
  hack: "club/two hand club combo",
  wild_swing: "club/two hand club combo",
  whirlwind: "sword/two hand sword combo",
  smash: "club/one hand club combo",
  slam: "club/two hand club combo",
  // Bow
  aimed: "longbow/standing aim recoil",
  quick_shot: "longbow/standing aim recoil",
  volley: "longbow/standing aim recoil",
  aim_idle: "boxanimations/longbow/Standing Aim Idle 02 Looking",
  draw_arrow: "boxanimations/longbow/Standing Draw Arrow (1)",
  dodge_left: "longbow/standing dodge left",
  dodge_right: "longbow/standing dodge right",
  dodge_back: "longbow/standing dodge backward",
  // Gun
  fire: "pistol/gunplay",
  burst: "rifle/firing",
  sniper: "rifle/firing 2",
  reload: "rifle/reloading",
  // Mobility / reaction
  dodge: "locomotion/dodging",
  combat_roll: "boxanimations/locomotion/Quick Roll To Run (1)",
  hit: "boxanimations/reactions/Hit Reaction",
  death: "boxanimations/reactions/Dying",
  jump: "locomotion/jump",
  // Unarmed / worge
  jab: "unarmed/lead_jab",
  punch: "unarmed/punching",
  claw: "unarmed/punching",
};

/**
 * Production play URL — Toon RTS ★ race kit (human.glb, orc.glb, …).
 * Never metaverse or PREFIX_Characters as primary.
 */
export function raceGlbUrl(race: RaceId): string {
  return `${ASSETS_CDN}/asset-packs/toon-rts-characters/glb/characters/${race}.glb`;
}

/** Load order: Toon CDN ★ → same-origin public mirror → legacy races bake. */
export function raceGlbUrlCandidates(race: RaceId): string[] {
  const file = RACE_GLB_FILES[race];
  return [
    raceGlbUrl(race),
    `/models/races/${race}.glb`,
    `${ASSETS_CDN}/models/grudge6/races/${file}`,
  ];
}

/** @deprecated Wrong play path — use raceGlbUrl. Kept for scripts that purge/compare. */
export function legacyRaceGlbUrl(race: RaceId): string {
  return `${ASSETS_CDN}/models/grudge6/races/${RACE_GLB_FILES[race]}`;
}

/**
 * Race atlas URL. When `colorSet` is a Toon RTS Materials/Colors variant and a
 * local webp exists, prefer that (team/outfit dye). Otherwise CDN standard.
 * @see toonRtsColorSets.ts
 */
export function raceAtlasUrl(race: RaceId, colorSet: ToonColorSet = "standard"): string {
  if (colorSet !== "standard") {
    const local = colorAtlasPublicUrl(race, colorSet);
    if (local) return local;
  }
  return `${ASSETS_CDN}/${RACE_ATLAS_PATHS[race]}`;
}

export type { ToonColorSet };

export function bakedAnimUrl(rel: string): string {
  const p = rel.startsWith("/") ? rel.slice(1) : rel.replace(/\.json$/i, "");
  return `${BAKED_ANIM_BASE}/${p}.json`;
}

/** Prefer Open baked mirror when arena API is cold. */
export function bakedAnimUrlCandidates(rel: string): string[] {
  const p = rel.startsWith("/") ? rel.slice(1) : rel.replace(/\.json$/i, "");
  return [
    `${BAKED_ANIM_BASE}/${p}.json`,
    `${BAKED_ANIM_FALLBACK}/${p}.json`,
  ];
}

/** Class string → ally combat role → anim pack. */
export function roleForClass(classId: string): AllyRole {
  const c = (classId || "").toLowerCase();
  if (c === "mage" || c === "healer" || c.includes("magic")) return "healer";
  if (c === "ranger" || c === "archer" || c.includes("bow")) return "ranger";
  if (c === "worge" || c === "barbarian" || c === "bruiser") return "bruiser";
  if (c === "tank" || c === "guardian") return "tank";
  if (c === "skirmisher" || c === "rogue") return "skirmisher";
  return "fighter";
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

/**
 * SI yardstick (grudge-world-scale / character-correctness):
 * human ~1.8 m · orc ~2.0 m · dwarf shorter · never 100× giants.
 */
export const GRUDGE6_BASE_HEIGHT = 1.8;

export const RACE_HEIGHT_SCALE: Record<RaceId, number> = {
  human: 1.0, // 1.80 m
  barbarian: 1.11, // ~2.00 m
  elf: 1.03, // ~1.85 m
  dwarf: 0.83, // ~1.50 m
  orc: 1.11, // ~2.00 m
  undead: 0.97, // ~1.75 m
};

export function targetHeightForRace(race: RaceId): number {
  return GRUDGE6_BASE_HEIGHT * (RACE_HEIGHT_SCALE[race] ?? 1);
}
