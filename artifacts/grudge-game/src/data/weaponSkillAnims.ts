/**
 * uMMORPG / Warlords weapon-skill → baked Mixamo clip map.
 *
 * Clip paths are relative to the grudge-arena baked CDN
 * (`…/api/assets/anims/baked/{path}.json`) and match warlord-genesis + boxanimations packs.
 *
 * Used by:
 *  - Grudge6 allies (BAKED_SKILL_CLIPS merge)
 *  - Annihilate 24 kits (triggerNamed candidates)
 *  - T0 practice loadouts (pack pick by mainhand category)
 */

import type { BakedAnimPack } from "./grudge6Assets";

/** CDN-relative clip (no .json). */
export type BakedClipRel = string;

export interface WeaponAnimProfile {
  /** Locomotion / primary attack pack. */
  pack: BakedAnimPack;
  /** Basic attack clip (idle combat strike). */
  basicAttack: BakedClipRel;
  /** Extra skill clips keyed for triggerNamed / pool. */
  skills: Record<string, BakedClipRel>;
  /** Optional locomotion overrides. */
  idle?: BakedClipRel;
  walk?: BakedClipRel;
  run?: BakedClipRel;
}

/**
 * uMMORPG skill categories from ObjectStore skills.json
 * (sword / axe / bow / staff / gun) + our T0 gear families.
 */
export type UmmoWeaponFamily =
  | "sword"
  | "sword_shield"
  | "sword_dagger"
  | "axe"
  | "greataxe"
  | "mace"
  | "hammer"
  | "hammer2h"
  | "spear"
  | "dagger"
  | "bow"
  | "crossbow"
  | "gun"
  | "staff"
  | "nature_staff"
  | "unarmed";

/** Map portrait / item category strings → family. */
export function categoryToFamily(category: string | null | undefined): UmmoWeaponFamily {
  const c = (category ?? "").toLowerCase();
  if (!c) return "unarmed";
  if (c.includes("shield") || c === "swords") return "sword_shield";
  if (c.includes("dagger")) return "dagger";
  if (c.includes("greataxe") || c === "axes") return "greataxe";
  if (c.includes("axe")) return "axe";
  if (c.includes("hammers2h") || c.includes("hammer")) return "hammer2h";
  if (c.includes("mace")) return "mace";
  if (c.includes("spear")) return "spear";
  if (c.includes("crossbow")) return "crossbow";
  if (c.includes("bow")) return "bow";
  if (c.includes("gun") || c.includes("rifle") || c.includes("pistol")) return "gun";
  if (c.includes("nature")) return "nature_staff";
  if (c.includes("staff") || c.includes("stave") || c.includes("wand") || c.includes("tome")) return "staff";
  if (c.includes("sword")) return "sword";
  return "unarmed";
}

/**
 * Per-family profiles. Paths verified against warlord-genesis/anims/baked + boxanimations set.
 */
export const WEAPON_ANIM_PROFILES: Record<UmmoWeaponFamily, WeaponAnimProfile> = {
  sword_shield: {
    pack: "sword_shield",
    idle: "sword_shield/sword and shield idle",
    run: "sword_shield/sword and shield run",
    basicAttack: "sword_shield/sword and shield attack",
    skills: {
      slash: "sword_shield/sword and shield slash",
      slash2: "sword_shield/sword and shield slash 1",
      thrust: "sword_shield/sword and shield attack (1)",
      power_strike: "sword_shield/sword and shield attack (2)",
      cleave: "sword_shield/sword and shield attack (3)",
      block: "sword_shield/sword and shield block",
      block_idle: "sword_shield/sword and shield block idle",
      power_up: "sword_shield/sword and shield power up",
      cast: "sword_shield/sword and shield casting",
      draw: "sword_shield/draw sword 1",
      sheath: "sword_shield/sheath sword 1",
    },
  },
  sword: {
    pack: "sword_shield",
    basicAttack: "sword/one hand sword combo",
    skills: {
      slash: "sword/great sword slash",
      slash2: "sword/great sword slash (1)",
      combo: "sword/one hand sword combo",
      combo2h: "sword/two hand sword combo",
      power_strike: "sword/great sword slash",
      cleave: "sword/two hand sword combo",
    },
  },
  sword_dagger: {
    pack: "sword_shield",
    basicAttack: "dual/dual weapon combo",
    skills: {
      slash: "dual/dual weapon combo",
      combo: "dual/dual weapon combo",
      thrust: "sword/one hand sword combo",
      power_strike: "sword/great sword slash",
    },
  },
  dagger: {
    pack: "sword_shield",
    basicAttack: "dual/dual weapon combo",
    skills: {
      slash: "dual/dual weapon combo",
      thrust: "sword/one hand sword combo",
      combo: "dual/dual weapon combo",
    },
  },
  axe: {
    pack: "sword_shield",
    basicAttack: "club/one hand club combo",
    skills: {
      chop: "club/one hand club combo",
      hack: "club/two hand club combo",
      wild_swing: "club/two hand club combo",
      cleave: "sword/great sword slash",
      whirlwind: "sword/two hand sword combo",
    },
  },
  greataxe: {
    pack: "sword_shield",
    basicAttack: "club/two hand club combo",
    skills: {
      chop: "club/two hand club combo",
      power_strike: "sword/great sword slash",
      whirlwind: "sword/two hand sword combo",
      slam: "club/two hand club combo",
    },
  },
  mace: {
    pack: "sword_shield",
    basicAttack: "club/one hand club combo",
    skills: {
      smash: "club/one hand club combo",
      power_strike: "club/two hand club combo",
      bash: "club/one hand club combo",
    },
  },
  hammer: {
    pack: "sword_shield",
    basicAttack: "club/one hand club combo",
    skills: {
      smash: "club/one hand club combo",
      slam: "club/two hand club combo",
    },
  },
  hammer2h: {
    pack: "sword_shield",
    basicAttack: "club/two hand club combo",
    skills: {
      smash: "club/two hand club combo",
      slam: "club/two hand club combo",
      power_strike: "sword/great sword slash",
    },
  },
  spear: {
    pack: "sword_shield",
    basicAttack: "sword_shield/sword and shield attack (1)",
    skills: {
      thrust: "sword_shield/sword and shield attack (1)",
      pierce: "sword_shield/sword and shield attack (2)",
      throw: "sword/great sword slash",
    },
  },
  bow: {
    pack: "longbow",
    idle: "longbow/standing idle 01",
    walk: "longbow/standing walk forward",
    run: "longbow/standing run forward",
    basicAttack: "longbow/standing aim recoil",
    skills: {
      aimed: "longbow/standing aim recoil",
      quick_shot: "longbow/standing aim recoil",
      draw: "boxanimations/longbow/Standing Draw Arrow (1)",
      aim_idle: "boxanimations/longbow/Standing Aim Idle 02 Looking",
      dodge: "longbow/standing dodge forward",
      dodge_back: "longbow/standing dodge backward",
      dodge_left: "longbow/standing dodge left",
      dodge_right: "longbow/standing dodge right",
      volley: "longbow/standing aim recoil",
    },
  },
  crossbow: {
    pack: "longbow",
    basicAttack: "longbow/standing aim recoil",
    skills: {
      aimed: "longbow/standing aim recoil",
      pierce: "longbow/standing aim recoil",
      draw: "boxanimations/longbow/Standing Draw Arrow (1)",
    },
  },
  gun: {
    pack: "pistol",
    idle: "pistol/pistol idle",
    walk: "pistol/pistol walk",
    run: "pistol/pistol run",
    basicAttack: "pistol/gunplay",
    skills: {
      quick_shot: "pistol/gunplay",
      aimed: "pistol/pistol aim",
      burst: "rifle/firing",
      sniper: "rifle/firing 2",
      reload: "rifle/reloading",
      combat_roll: "boxanimations/locomotion/Quick Roll To Run (1)",
    },
  },
  staff: {
    pack: "magic",
    idle: "magic/standing idle",
    run: "magic/Standing Run Forward",
    basicAttack: "magic/standing 1h cast spell 01",
    skills: {
      bolt: "magic/standing 1h cast spell 01",
      charged: "magic/Standing 1H Magic Attack 01",
      fireball: "magic/standing 2h cast spell 01",
      ice_spike: "magic/standing 2h magic attack 01",
      chain: "magic/standing 2h magic attack 03",
      nova: "magic/standing 2h magic area attack 01",
      aoe: "magic/Standing 2H Magic Area Attack 02",
      barrier: "magic/spell casting",
      cast2h: "magic/standing 2h cast spell 01",
    },
  },
  nature_staff: {
    pack: "magic",
    basicAttack: "magic/standing 2h cast spell 01",
    skills: {
      bolt: "magic/standing 1h cast spell 01",
      grove: "magic/standing 2h magic attack 01",
      nova: "magic/standing 2h magic area attack 01",
      cast2h: "magic/standing 2h cast spell 01",
    },
  },
  unarmed: {
    pack: "unarmed",
    basicAttack: "unarmed/punching",
    skills: {
      jab: "unarmed/lead_jab",
      punch: "unarmed/punching",
      claw: "unarmed/punching",
    },
  },
};

/**
 * uMMORPG skills.json skill-id → preferred clip *keys* for triggerNamed.
 * Keys resolve through BAKED_SKILL_CLIPS + pack attack name.
 */
export const UMMO_SKILL_ANIM_CANDIDATES: Record<string, string[]> = {
  // Sword
  slash: ["slash", "attack", "combo"],
  thrust: ["thrust", "attack"],
  "power-strike": ["power_strike", "slash2", "attack"],
  rend: ["slash", "combo", "attack"],
  cleave: ["cleave", "combo2h", "attack"],
  parry: ["block", "block_idle"],
  sidestep: ["dodge", "combat_roll"],
  riposte: ["slash2", "thrust", "attack"],
  // Axe
  chop: ["chop", "attack"],
  hack: ["hack", "power_strike", "attack"],
  "wild-swing": ["wild_swing", "cleave", "attack"],
  "cleave-axe": ["cleave", "whirlwind", "attack"],
  "double-chop": ["chop", "combo", "attack"],
  whirlwind: ["whirlwind", "combo2h", "attack"],
  "throw-axe": ["throw", "slash", "attack"],
  // Bow
  "quick-shot": ["quick_shot", "aimed", "attack"],
  "aimed-shot": ["aimed", "attack"],
  "multi-shot": ["volley", "aimed", "attack"],
  "piercing-arrow": ["aimed", "attack"],
  "rain-of-arrows": ["volley", "aimed", "attack"],
  "evasive-roll": ["dodge", "dodge_back", "combat_roll"],
  // Staff
  bolt: ["bolt", "cast", "attack"],
  "charged-bolt": ["charged", "cast2h", "attack"],
  fireball: ["fireball", "cast2h", "attack"],
  "ice-spike": ["ice_spike", "cast2h", "attack"],
  "chain-lightning": ["chain", "nova", "attack"],
  barrier: ["barrier", "cast", "power_up"],
  blink: ["dodge", "cast"],
  // Gun
  "quick-shot-gun": ["quick_shot", "attack", "fire"],
  "aimed-shot-gun": ["aimed", "attack"],
  "sniper-shot": ["sniper", "burst", "attack"],
  "burst-fire": ["burst", "attack"],
  "explosive-round": ["burst", "sniper", "attack"],
  "combat-roll": ["combat_roll", "dodge"],
  "smoke-bomb": ["combat_roll", "dodge"],
};

/** Flat skill-clip table merged into ally pack loads (name → rel path). */
export function allWeaponSkillClipRels(): Record<string, BakedClipRel> {
  const out: Record<string, BakedClipRel> = {
    // Shared mobility / reaction
    dodge: "locomotion/dodging",
    dodge_back: "boxanimations/locomotion/Dodging Back",
    combat_roll: "boxanimations/locomotion/Quick Roll To Run (1)",
    hit: "boxanimations/reactions/Hit Reaction",
    death: "boxanimations/reactions/Dying",
    jump: "locomotion/jump",
    cast: "magic/standing 1h cast spell 01",
    cast2h: "magic/standing 2h cast spell 01",
  };
  for (const profile of Object.values(WEAPON_ANIM_PROFILES)) {
    for (const [k, rel] of Object.entries(profile.skills)) {
      if (!out[k]) out[k] = rel;
    }
  }
  return out;
}

export function profileForCategory(category: string | null | undefined): WeaponAnimProfile {
  return WEAPON_ANIM_PROFILES[categoryToFamily(category)];
}

export function packForCategory(category: string | null | undefined): BakedAnimPack {
  return profileForCategory(category).pack;
}

/**
 * Resolve anim candidates for a skill id (uMMORPG or annihilate kit).
 * Falls back to attack / slash / cast.
 */
export function animCandidatesForSkill(skillId: string, family?: UmmoWeaponFamily): string[] {
  const direct = UMMO_SKILL_ANIM_CANDIDATES[skillId] ?? UMMO_SKILL_ANIM_CANDIDATES[skillId.replace(/_/g, "-")];
  if (direct) return direct;
  const id = skillId.toLowerCase();
  if (/slash|rend|cleave|chop|hack|claw/.test(id)) return ["slash", "cleave", "attack"];
  if (/thrust|pierce|stab|spear/.test(id)) return ["thrust", "attack"];
  if (/shot|arrow|volley|aimed|gun|fire/.test(id)) return ["aimed", "quick_shot", "attack"];
  if (/cast|bolt|fireball|frost|meteor|nova|chain|hex|storm/.test(id)) return ["cast2h", "cast", "fireball", "attack"];
  if (/block|bash|parry|shield/.test(id)) return ["block", "power_strike", "attack"];
  if (/dodge|roll|evasion|blink|sidestep/.test(id)) return ["dodge", "combat_roll"];
  if (family === "staff" || family === "nature_staff") return ["cast", "cast2h", "attack"];
  if (family === "bow" || family === "crossbow" || family === "gun") return ["aimed", "attack"];
  return ["attack", "slash", "combo"];
}

/** Warriors: shield style vs dual dagger. */
export function warriorFamily(offhandIsShield: boolean): UmmoWeaponFamily {
  return offhandIsShield ? "sword_shield" : "sword_dagger";
}
