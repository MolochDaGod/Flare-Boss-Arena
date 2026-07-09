/**
 * Flare Boss Arena — combat loadout.
 * Fighter stats + signature weapon + equipped attribute stones.
 */

import { getActiveFighter, getFighter, type FighterDef, RACALVIN_ID, type AttrKey, ATTR_ORDER } from "./fighters";
import {
  getFighterKit,
  type FighterKit,
  type FighterSkillDef,
  type FighterSpecialDef,
} from "./fighterSkills";
import { getStoneCombatMods } from "./stones";
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
  | "staff";

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

const WEAPONS_BY_FIGHTER: Record<string, GameWeapon> = {
  [RACALVIN_ID]: {
    id: "wpn_brothers_keeper",
    name: "Brothers' Keeper",
    glyph: "⚔",
    style: "greatsword",
    damageBonus: 18,
    critBonus: 0.04,
    range: 3.4,
    description: "The Corsair King's greatblade.",
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
    id: "wpn_gryphon",
    name: "Gryphon",
    glyph: "🗡",
    style: "sword",
    damageBonus: 16,
    critBonus: 0.08,
    range: 3.5,
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
    damageBonus: 13,
    critBonus: 0.09,
    range: 3.0,
    description: "Assassin hands.",
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
    damageBonus: 14,
    critBonus: 0.09,
    range: 3.4,
    description: "Invisible cuts.",
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
    damageBonus: 8,
    critBonus: 0.05,
    range: 3.0,
    description: "Raw potential.",
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
  const out = { ...fighter.stats };
  for (const k of ATTR_ORDER) {
    out[k] = (out[k] ?? 0) + (stones.attrBonus[k] ?? 0);
  }
  return out;
}

function combatFrom(fighter: FighterDef, weapon: GameWeapon) {
  const s = effectiveAttrs(fighter);
  const st = getStoneCombatMods();

  // Strength → physical damage, Intellect → skill mult, Tactics → hybrid skill edge
  let baseDamage =
    16 +
    s.strength * 3.2 +
    s.dexterity * 1.2 +
    s.tactics * 0.8 +
    weapon.damageBonus +
    st.damage;
  const spellDamageMult = 1 + s.intellect * 0.04 + s.tactics * 0.015 + st.spellDamage;

  const critChance = Math.min(
    0.6,
    0.06 + s.dexterity * 0.018 + s.agility * 0.008 + weapon.critBonus + st.crit,
  );

  // Vitality / Endurance → life
  const maxHp = 260 + s.vitality * 48 + s.endurance * 22 + st.health;
  // Wisdom / Intellect → mana
  const maxMana = 85 + s.wisdom * 16 + s.intellect * 12 + st.mana;

  let attackInterval =
    weapon.style === "gun" ? 0.95 : weapon.style === "fist" || weapon.style === "kick" ? 0.62 : 0.78;
  attackInterval *= Math.max(0.48, 1 - s.agility * 0.012 - st.attackSpeed) * onslaughtAttackSpeedMult();

  const moveSpeedMult = 1 + s.agility * 0.015 + st.speed;
  const defense = Math.min(0.5, s.endurance * 0.02 + st.defense);
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
