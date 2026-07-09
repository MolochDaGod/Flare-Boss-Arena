/**
 * Flare Boss Arena — independent combat loadout.
 *
 * Not Warlords-era: no R2 weapon trees, no class skill catalogs, no turn-based
 * cooldowns. One fighter → one weapon profile → five skills + one R special,
 * all playable immediately in the real-time dungeon / camp / boss scenes.
 */

import { getActiveFighter, getFighter, type FighterDef, RACALVIN_ID } from "./fighters";
import {
  getFighterKit,
  type FighterKit,
  type FighterSkillDef,
  type FighterSpecialDef,
} from "./fighterSkills";

// ─── Weapons (simple profiles tied to fighter style) ──────────────────────────

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
  /** Flat damage added to fighter base. */
  damageBonus: number;
  /** Added to crit chance (0–1). */
  critBonus: number;
  /** Melee/ranged reach in world units. */
  range: number;
  description: string;
}

/** Per-fighter signature weapons — theme fits the character, not a class tree. */
const WEAPONS_BY_FIGHTER: Record<string, GameWeapon> = {
  [RACALVIN_ID]: {
    id: "wpn_brothers_keeper",
    name: "Brothers' Keeper",
    glyph: "⚔",
    style: "greatsword",
    damageBonus: 18,
    critBonus: 0.04,
    range: 3.4,
    description: "The Corsair King's greatblade — wide cuts and heavy specials.",
  },
  nightmare_luffy: {
    id: "wpn_rubber_fists",
    name: "Rubber Fists",
    glyph: "✊",
    style: "fist",
    damageBonus: 10,
    critBonus: 0.06,
    range: 3.2,
    description: "Stretching punches — combos and shockwave specials.",
  },
  ace_sabo_luffy: {
    id: "wpn_brothers_bond",
    name: "Brothers' Bond",
    glyph: "🔥",
    style: "fist",
    damageBonus: 14,
    critBonus: 0.05,
    range: 3.3,
    description: "Fire, wind, and rubber — hybrid mid-range kit.",
  },
  shanks: {
    id: "wpn_gryphon",
    name: "Gryphon",
    glyph: "🗡",
    style: "sword",
    damageBonus: 16,
    critBonus: 0.08,
    range: 3.5,
    description: "Emperor's saber — slash waves and Haki pressure.",
  },
  law: {
    id: "wpn_kikoku",
    name: "Kikoku",
    glyph: "🔪",
    style: "blade",
    damageBonus: 12,
    critBonus: 0.07,
    range: 3.3,
    description: "Nodachi of the Surgeon — ROOM circles and radio cuts.",
  },
  lucci: {
    id: "wpn_rokushiki",
    name: "Rokushiki Hands",
    glyph: "🐆",
    style: "claw",
    damageBonus: 13,
    critBonus: 0.09,
    range: 3.0,
    description: "Finger pistols and flying kicks — assassin range.",
  },
  smoker: {
    id: "wpn_nanashaku",
    name: "Nanashaku Jitte",
    glyph: "⚒",
    style: "jitte",
    damageBonus: 11,
    critBonus: 0.04,
    range: 3.4,
    description: "Seastone jitte — smoke lines and hard control.",
  },
  sanji_onigashima: {
    id: "wpn_black_leg",
    name: "Black Leg",
    glyph: "🦵",
    style: "kick",
    damageBonus: 13,
    critBonus: 0.08,
    range: 3.2,
    description: "Burning kicks — Diable waves and table courses.",
  },
  ryuma: {
    id: "wpn_shusui",
    name: "Shusui",
    glyph: "⚔",
    style: "sword",
    damageBonus: 15,
    critBonus: 0.07,
    range: 3.5,
    description: "Black blade of the Sword God — far-reaching flashes.",
  },
  page_one: {
    id: "wpn_spino",
    name: "Ancient Hide",
    glyph: "🦖",
    style: "claw",
    damageBonus: 17,
    critBonus: 0.03,
    range: 3.6,
    description: "Zoan bulk — tail sweeps and ground quakes.",
  },
  marco: {
    id: "wpn_phoenix",
    name: "Blue Flames",
    glyph: "🔥",
    style: "claw",
    damageBonus: 11,
    critBonus: 0.05,
    range: 3.3,
    description: "Phoenix fire — burns foes, mends self.",
  },
  shiryu: {
    id: "wpn_rain",
    name: "Rain Blade",
    glyph: "🌧",
    style: "sword",
    damageBonus: 14,
    critBonus: 0.09,
    range: 3.4,
    description: "Invisible cuts from the rain — ambush and execution.",
  },
  marine_mullet: {
    id: "wpn_musket",
    name: "Marine Musket",
    glyph: "🔫",
    style: "gun",
    damageBonus: 9,
    critBonus: 0.06,
    range: 8.0,
    description: "Long shot and bayonet — keep distance.",
  },
  koby: {
    id: "wpn_honesty",
    name: "Honesty Fists",
    glyph: "👊",
    style: "fist",
    damageBonus: 8,
    critBonus: 0.05,
    range: 3.0,
    description: "Raw Marine potential — shockwave specials.",
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
  description: "A reliable sidearm for any fighter.",
};

// ─── Tools (harvest only — not Warlords profession trees) ─────────────────────

export interface GameTool {
  id: string;
  name: string;
  glyph: string;
  resource: "wood" | "stone";
  description: string;
}

export const GAME_TOOLS: GameTool[] = [
  {
    id: "tool_hatchet",
    name: "Hatchet",
    glyph: "🪓",
    resource: "wood",
    description: "Chop trees for wood. Attack any tree node.",
  },
  {
    id: "tool_pick",
    name: "Pickaxe",
    glyph: "⛏",
    resource: "stone",
    description: "Quarry stone nodes. Attack any stone pile.",
  },
];

// ─── Unified loadout ──────────────────────────────────────────────────────────

export interface GameLoadout {
  fighter: FighterDef;
  kit: FighterKit;
  weapon: GameWeapon;
  skills: FighterSkillDef[];
  special: FighterSpecialDef;
  tools: GameTool[];
  /** Derived combat stats from fighter attributes + weapon. */
  combat: {
    baseDamage: number;
    critChance: number;
    maxHp: number;
    maxMana: number;
    attackRange: number;
    attackInterval: number;
  };
}

function combatFrom(fighter: FighterDef, weapon: GameWeapon) {
  const s = fighter.stats;
  // Simple real-time formulas — no Warlords diminishing returns / tiers.
  const baseDamage = 18 + s.strength * 3 + s.dexterity * 1.5 + weapon.damageBonus;
  const critChance = Math.min(0.55, 0.08 + s.dexterity * 0.015 + s.agility * 0.01 + weapon.critBonus);
  const maxHp = 280 + s.vitality * 45 + s.endurance * 20;
  const maxMana = 90 + s.intellect * 18 + s.wisdom * 10;
  const attackInterval = weapon.style === "gun" ? 0.95 : weapon.style === "fist" || weapon.style === "kick" ? 0.65 : 0.78;
  return {
    baseDamage: Math.round(baseDamage),
    critChance,
    maxHp: Math.round(maxHp),
    maxMana: Math.round(maxMana),
    attackRange: weapon.range,
    attackInterval,
  };
}

export function getWeaponForFighter(fighterId: string): GameWeapon {
  return WEAPONS_BY_FIGHTER[fighterId] ?? DEFAULT_WEAPON;
}

/** Full loadout for a fighter id (defaults to active selection). */
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
    combat: combatFrom(fighter, weapon),
  };
}

/** HUD-friendly skill row (glyph + name + cooldown + AoE flag). */
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
