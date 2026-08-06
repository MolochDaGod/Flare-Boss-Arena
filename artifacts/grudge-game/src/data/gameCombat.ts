/**
 * Flare Boss Arena — combat loadout.
 * Fighter stats + signature weapon + equipped attribute stones.
 */

import {
  getActiveFighter,
  getFighter,
  type FighterDef,
  RACALVIN_ID,
  SCOURGE_ID,
  JOHN_WAYNE_ID,
  type AttrKey,
  ATTR_ORDER,
} from "./fighters";
import {
  getFighterKit,
  type FighterKit,
  type FighterSkillDef,
  type FighterSpecialDef,
} from "./fighterSkills";
import { getStoneCombatMods } from "./stones";
import { getEquipmentCombatMods } from "./equipmentLoadout";
import { getAttributeAllocations } from "./attributePoints";
import { onslaughtAttackSpeedMult } from "./procs";

export type WeaponStyle =
  | "sword"
  | "greatsword"
  | "fist"
  | "kick"
  | "gun"
  | "blade"
  | "claw"
  | "jitte"
  | "staff"
  | "chain"
  | "rifle";

export interface GameWeapon {
  id: string;
  name: string;
  glyph: string;
  style: WeaponStyle;
  damageBonus: number;
  critBonus: number;
  range: number;
  description: string;
}

/** Racalvin's sidearm — drawn automatically on psychic skills and Mind Shot. */
export const RACALVIN_PISTOL_WEAPON: GameWeapon = {
  id: "wpn_corsair_pistol",
  name: "Corsair Pistol",
  glyph: "🔫",
  style: "gun",
  damageBonus: 8,
  critBonus: 0.06,
  range: 5.5,
  description: "Psymic sidearm — auto-draws on Mind Shot and psychic abilities.",
};

const WEAPONS_BY_FIGHTER: Record<string, GameWeapon> = {
  [RACALVIN_ID]: {
    id: "wpn_brothers_keeper",
    name: "Brothers' Keeper",
    glyph: "⚔",
    style: "greatsword",
    damageBonus: 18,
    critBonus: 0.04,
    range: 3.4,
    description: "Greatsword melee — swap to pistol for psymic skills (Mind Shot).",
  },
  [SCOURGE_ID]: {
    id: "wpn_cryoshard_chain",
    name: "Cryoshard Chain-Anchor",
    glyph: "⚓",
    style: "chain",
    damageBonus: 16,
    critBonus: 0.03,
    range: 7.5,
    description: "Boat-anchor warpick on chain — throw mid-range, reel prey back into slam range.",
  },
  [JOHN_WAYNE_ID]: {
    id: "wpn_pathfinder_kit",
    name: "Pathfinder Field Kit",
    glyph: "🔧",
    style: "rifle",
    damageBonus: 12,
    critBonus: 0.08,
    range: 14,
    description: "Engineer longarm + gadgets — snipe, mines, and portable turrets.",
  },
  nightmare_luffy: {
    id: "wpn_rubber_fists",
    name: "Rubber Fists",
    glyph: "✊",
    style: "fist",
    damageBonus: 10,
    critBonus: 0.06,
    range: 3.2,
    description: "Stretching punches.",
  },
  ace_sabo_luffy: {
    id: "wpn_brothers_bond",
    name: "Brothers' Bond",
    glyph: "🔥",
    style: "fist",
    damageBonus: 14,
    critBonus: 0.05,
    range: 3.3,
    description: "Fire, wind, and rubber.",
  },
  shanks: {
    id: "wpn_gryphon_trainee",
    name: "Training Saber",
    glyph: "🗡",
    style: "sword",
    damageBonus: 10,
    critBonus: 0.05,
    range: 3.2,
    description: "Captain's blade — growing edge.",
  },
  shanks_yonko: {
    id: "wpn_gryphon",
    name: "Gryphon",
    glyph: "🗡",
    style: "sword",
    damageBonus: 18,
    critBonus: 0.1,
    range: 3.6,
    description: "Emperor's saber.",
  },
  law: {
    id: "wpn_kikoku",
    name: "Kikoku",
    glyph: "🔪",
    style: "blade",
    damageBonus: 12,
    critBonus: 0.07,
    range: 3.3,
    description: "Nodachi of the Surgeon.",
  },
  lucci: {
    id: "wpn_rokushiki",
    name: "Rokushiki Hands",
    glyph: "🐆",
    style: "claw",
    damageBonus: 11,
    critBonus: 0.07,
    range: 3.0,
    description: "CP0 assassin hands.",
  },
  lucci_awakened: {
    id: "wpn_awakened_claws",
    name: "Awakened Claws",
    glyph: "🐆",
    style: "claw",
    damageBonus: 16,
    critBonus: 0.1,
    range: 3.2,
    description: "Zoan-awakened leopard talons.",
  },
  smoker: {
    id: "wpn_nanashaku",
    name: "Nanashaku Jitte",
    glyph: "⚒",
    style: "jitte",
    damageBonus: 11,
    critBonus: 0.04,
    range: 3.4,
    description: "Seastone jitte.",
  },
  sanji_onigashima: {
    id: "wpn_black_leg",
    name: "Black Leg",
    glyph: "🦵",
    style: "kick",
    damageBonus: 13,
    critBonus: 0.08,
    range: 3.2,
    description: "Burning kicks.",
  },
  ryuma: {
    id: "wpn_shusui",
    name: "Shusui",
    glyph: "⚔",
    style: "sword",
    damageBonus: 15,
    critBonus: 0.07,
    range: 3.5,
    description: "Black blade.",
  },
  page_one: {
    id: "wpn_spino",
    name: "Ancient Hide",
    glyph: "🦖",
    style: "claw",
    damageBonus: 17,
    critBonus: 0.03,
    range: 3.6,
    description: "Zoan bulk.",
  },
  marco: {
    id: "wpn_phoenix",
    name: "Blue Flames",
    glyph: "🔥",
    style: "claw",
    damageBonus: 11,
    critBonus: 0.05,
    range: 3.3,
    description: "Phoenix fire.",
  },
  shiryu: {
    id: "wpn_rain",
    name: "Rain Blade",
    glyph: "🌧",
    style: "sword",
    damageBonus: 10,
    critBonus: 0.06,
    range: 3.2,
    description: "Rain-soaked warden blade.",
  },
  shiryu_clear: {
    id: "wpn_clear_blade",
    name: "Clear-Clear Blade",
    glyph: "👻",
    style: "blade",
    damageBonus: 15,
    critBonus: 0.11,
    range: 3.5,
    description: "Invisible assassin cuts.",
  },
  marine_mullet: {
    id: "wpn_musket",
    name: "Marine Musket",
    glyph: "🔫",
    style: "gun",
    damageBonus: 9,
    critBonus: 0.06,
    range: 8.0,
    description: "Long shot.",
  },
  koby: {
    id: "wpn_honesty",
    name: "Honesty Fists",
    glyph: "👊",
    style: "fist",
    damageBonus: 7,
    critBonus: 0.04,
    range: 2.8,
    description: "Recruit fists.",
  },
  koby_hero: {
    id: "wpn_hero_fists",
    name: "Hero's Fists",
    glyph: "⭐",
    style: "fist",
    damageBonus: 12,
    critBonus: 0.08,
    range: 3.2,
    description: "Marineford courage.",
  },
  mihawk: {
    id: "wpn_yoru",
    name: "Yoru",
    glyph: "🗡",
    style: "greatsword",
    damageBonus: 18,
    critBonus: 0.1,
    range: 3.8,
    description: "The black blade that splits the sea.",
  },
  kizaru: {
    id: "wpn_light_kicks",
    name: "Light Kicks",
    glyph: "💡",
    style: "kick",
    damageBonus: 12,
    critBonus: 0.08,
    range: 3.4,
    description: "Photon-speed strikes.",
  },
  fujitora_marijoa: {
    id: "wpn_gravity_blade",
    name: "Gravity Blade",
    glyph: "⬇",
    style: "sword",
    damageBonus: 14,
    critBonus: 0.05,
    range: 3.5,
    description: "Blind swordsman's shirasaya.",
  },
  vista: {
    id: "wpn_flower_swords",
    name: "Flower Swords",
    glyph: "🌹",
    style: "sword",
    damageBonus: 13,
    critBonus: 0.07,
    range: 3.4,
    description: "Twin commander blades.",
  },
  charlotte_oven: {
    id: "wpn_heat_hands",
    name: "Heat Hands",
    glyph: "🔥",
    style: "fist",
    damageBonus: 14,
    critBonus: 0.04,
    range: 3.2,
    description: "Superheated palms.",
  },
  hybrid_kaido: {
    id: "wpn_kanabo",
    name: "Hassaikai",
    glyph: "🔨",
    style: "greatsword",
    damageBonus: 20,
    critBonus: 0.03,
    range: 3.8,
    description: "Emperor's spiked club.",
  },
};

const DEFAULT_WEAPON: GameWeapon = {
  id: "wpn_basic",
  name: "Sidearm",
  glyph: "⚔",
  style: "sword",
  damageBonus: 8,
  critBonus: 0.03,
  range: 3.0,
  description: "A reliable sidearm.",
};

export interface GameTool {
  id: string;
  name: string;
  glyph: string;
  resource: "wood" | "stone";
  description: string;
}

export const GAME_TOOLS: GameTool[] = [
  { id: "tool_hatchet", name: "Hatchet", glyph: "🪓", resource: "wood", description: "Chop trees." },
  { id: "tool_pick", name: "Pickaxe", glyph: "⛏", resource: "stone", description: "Mine rock." },
];

export interface GameLoadout {
  fighter: FighterDef;
  kit: FighterKit;
  weapon: GameWeapon;
  skills: FighterSkillDef[];
  special: FighterSpecialDef;
  tools: GameTool[];
  /** Effective attributes after stones. */
  attributes: Record<AttrKey, number>;
  combat: {
    baseDamage: number;
    spellDamageMult: number;
    critChance: number;
    maxHp: number;
    maxMana: number;
    attackRange: number;
    attackInterval: number;
    moveSpeedMult: number;
    defense: number;
    magicDefense: number;
    aoeMult: number;
  };
}

function effectiveAttrs(fighter: FighterDef): Record<AttrKey, number> {
  const stones = getStoneCombatMods();
  const spent = getAttributeAllocations(fighter.id);
  const out = { ...fighter.stats };
  for (const k of ATTR_ORDER) {
    out[k] = (out[k] ?? 0) + (stones.attrBonus[k] ?? 0) + (spent[k] ?? 0);
  }
  return out;
}

function combatFrom(fighter: FighterDef, weapon: GameWeapon) {
  const s = effectiveAttrs(fighter);
  const st = getStoneCombatMods();
  // Weapons + armor from MainPanel / equipment loadout
  const eq = getEquipmentCombatMods(fighter.id);

  // Strength → physical damage, Intellect → skill mult, Tactics → hybrid skill edge
  // Equipped mainhand/armor stats stack on top of the signature weapon bonus.
  let baseDamage =
    16 +
    s.strength * 3.2 +
    s.dexterity * 1.2 +
    s.tactics * 0.8 +
    weapon.damageBonus +
    st.damage +
    eq.damage;
  const spellDamageMult =
    1 + s.intellect * 0.04 + s.tactics * 0.015 + st.spellDamage + eq.magicDamage * 0.01;

  const critChance = Math.min(
    0.6,
    0.06 + s.dexterity * 0.018 + s.agility * 0.008 + weapon.critBonus + st.crit + eq.crit,
  );

  // Vitality / Endurance → life (+ armor HP)
  const maxHp = 260 + s.vitality * 48 + s.endurance * 22 + st.health + eq.health;
  // Wisdom / Intellect → mana
  const maxMana = 85 + s.wisdom * 16 + s.intellect * 12 + st.mana + eq.mana;

  let attackInterval =
    weapon.style === "gun" ? 0.95 : weapon.style === "fist" || weapon.style === "kick" ? 0.62 : 0.78;
  attackInterval *= Math.max(0.48, 1 - s.agility * 0.012 - st.attackSpeed) * onslaughtAttackSpeedMult();

  const moveSpeedMult = 1 + s.agility * 0.015 + st.speed + eq.speed;
  const defense = Math.min(0.55, s.endurance * 0.02 + st.defense + eq.defense + eq.block * 0.5);
  const magicDefense = Math.min(0.5, s.wisdom * 0.022 + st.magicDefense);
  const aoeMult = 1 + st.aoe + s.intellect * 0.01;

  return {
    baseDamage: Math.round(baseDamage),
    spellDamageMult,
    critChance,
    maxHp: Math.round(maxHp),
    maxMana: Math.round(maxMana),
    attackRange: weapon.range,
    attackInterval,
    moveSpeedMult,
    defense,
    magicDefense,
    aoeMult,
  };
}

export function getWeaponForFighter(fighterId: string): GameWeapon {
  return WEAPONS_BY_FIGHTER[fighterId] ?? DEFAULT_WEAPON;
}

export function getGameLoadout(fighterId?: string | null): GameLoadout {
  const fighter = (fighterId ? getFighter(fighterId) : null) ?? getActiveFighter();
  const kit = getFighterKit(fighter.id);
  const weapon = getWeaponForFighter(fighter.id);
  return {
    fighter,
    kit,
    weapon,
    skills: kit.skills,
    special: kit.special,
    tools: GAME_TOOLS,
    attributes: effectiveAttrs(fighter),
    combat: combatFrom(fighter, weapon),
  };
}

export function loadoutSkillBar(loadout: GameLoadout) {
  return loadout.skills.map((s, i) => ({
    index: i,
    id: s.id,
    name: s.name,
    glyph: s.glyph,
    description: s.description,
    cooldown: s.cooldown,
    manaCost: s.manaCost,
    isAoe: s.targeting === "ground_aoe",
    isSlash: s.targeting === "slash_wave" || s.shape === "slash",
  }));
}
