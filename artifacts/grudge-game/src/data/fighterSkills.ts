/**
 * Canonical skill kits per playable fighter (One Piece skins + Racalvin).
 *
 * Clip suffixes match bounty-rush GLBs (`_skill_a`, `_skill_b`, `_combo_a`…).
 * R-key special attacks use the richest skill clip on that model.
 */

import type { SkillElement } from "../game/combat/particles";
import type { DamageShapeKind } from "../game/combat/damageShapes";
import { getActiveFighter, RACALVIN_ID } from "./fighters";
import { annihilateFighterKit } from "./annihilateHeroes";

export type SkillTargeting = "instant" | "ground_aoe" | "slash_wave" | "self";

export interface FighterSkillDef {
  id: string;
  name: string;
  description: string;
  glyph: string;
  /** Clip name substrings (most specific first) for triggerNamed. */
  anim: string[];
  targeting: SkillTargeting;
  shape: DamageShapeKind | "slash";
  element: SkillElement;
  damageMult: number;
  manaCost: number;
  cooldown: number;
  /** Ground AoE / nova radius. */
  aoeRadius?: number;
  /** Max place range for ground AoE. */
  placeRange?: number;
  /** Slash-wave travel distance. */
  slashRange?: number;
  color?: number;
}

export interface FighterSpecialDef {
  name: string;
  description: string;
  /** Clip candidates for R special. */
  anim: string[];
  damageMult: number;
  manaCost: number;
  cooldown: number;
  element: SkillElement;
  /** Launch a traveling slash wave. */
  slashWave: boolean;
  slashRange: number;
  color: number;
  /** Evolution tier (1 = power-up R, final form = ultimate). */
  evolutionTier?: number;
  /** Marks the family's apex R ability. */
  isUltimate?: boolean;
}

export interface FighterKit {
  fighterId: string;
  special: FighterSpecialDef;
  skills: FighterSkillDef[];
}

function sk(
  partial: FighterSkillDef,
): FighterSkillDef {
  return partial;
}

const KITS: FighterKit[] = [
  {
    fighterId: "nightmare_luffy",
    special: {
      name: "Gum-Gum Bazooka",
      description: "Stretch both arms and fire a rubber shockwave slash.",
      anim: ["skill_a", "skill_b", "combo_c"],
      damageMult: 2.6,
      manaCost: 28,
      cooldown: 8,
      element: "physical",
      slashWave: true,
      slashRange: 14,
      color: 0xff8866,
    },
    skills: [
      sk({ id: "pistol", name: "Gum-Gum Pistol", description: "A stretching straight punch.", glyph: "✊", anim: ["combo_a", "attack"], targeting: "instant", shape: "cone", element: "physical", damageMult: 1.4, manaCost: 8, cooldown: 1.2, aoeRadius: 4 }),
      sk({ id: "gatling", name: "Gum-Gum Gatling", description: "A flurry of rapid punches in a cone.", glyph: "👊", anim: ["combo_b", "combo_c"], targeting: "instant", shape: "cone", element: "physical", damageMult: 1.9, manaCost: 16, cooldown: 3.5, aoeRadius: 5.5 }),
      sk({ id: "balloon", name: "Gum-Gum Balloon", description: "Inflate and slam the ground in a circle.", glyph: "💥", anim: ["skill_b", "boost"], targeting: "ground_aoe", shape: "circle", element: "physical", damageMult: 2.1, manaCost: 22, cooldown: 5, aoeRadius: 4.5, placeRange: 9 }),
      sk({ id: "jet", name: "Jet Stamp", description: "Leap and stomp — ground nova.", glyph: "🦶", anim: ["skill_a", "jump"], targeting: "ground_aoe", shape: "nova", element: "physical", damageMult: 2.3, manaCost: 24, cooldown: 6, aoeRadius: 5.5, placeRange: 7 }),
      sk({ id: "king_kong", name: "King Kong Gun", description: "Massive rubber fist over the target area.", glyph: "🦍", anim: ["skill_b", "combo_c"], targeting: "ground_aoe", shape: "circle", element: "physical", damageMult: 2.8, manaCost: 36, cooldown: 10, aoeRadius: 5, placeRange: 10 }),
    ],
  },
  {
    fighterId: "shanks",
    special: {
      name: "Conqueror's Slash",
      description: "A budding Haki-coated sword wave — power-up R.",
      anim: ["combo_a", "skill_a"],
      damageMult: 2.2,
      manaCost: 22,
      cooldown: 7,
      element: "physical",
      slashWave: true,
      slashRange: 11,
      color: 0xcc9977,
      evolutionTier: 1,
    },
    skills: [
      sk({ id: "haki_slash", name: "Haki Slash", description: "Armament-coated cut.", glyph: "⚔", anim: ["combo_a"], targeting: "slash_wave", shape: "slash", element: "physical", damageMult: 1.3, manaCost: 8, cooldown: 1.8, slashRange: 8, color: 0xc5a059 }),
      sk({ id: "kamusari", name: "Kamusari", description: "A horizontal sword wave.", glyph: "🗡", anim: ["combo_b"], targeting: "slash_wave", shape: "slash", element: "physical", damageMult: 1.6, manaCost: 14, cooldown: 4, slashRange: 10, color: 0xffe9a0 }),
      sk({ id: "observation", name: "Observation Feint", description: "Sidestep slash into a cone.", glyph: "👁", anim: ["dodge", "combo_a"], targeting: "instant", shape: "cone", element: "physical", damageMult: 1.4, manaCost: 12, cooldown: 3.5, aoeRadius: 4.5 }),
      sk({ id: "pressure", name: "Haki Pressure", description: "Small Haki pressure zone.", glyph: "👑", anim: ["skill_b", "boost"], targeting: "ground_aoe", shape: "circle", element: "arcane", damageMult: 1.7, manaCost: 18, cooldown: 6, aoeRadius: 4, placeRange: 7 }),
    ],
  },
  {
    fighterId: "shanks_yonko",
    special: {
      name: "Divine Departure",
      description: "Ultimate R — Conqueror's-clad wave that cuts the horizon.",
      anim: ["skill_a", "skill_b", "combo_c"],
      damageMult: 3.2,
      manaCost: 34,
      cooldown: 9,
      element: "arcane",
      slashWave: true,
      slashRange: 18,
      color: 0xffd060,
      evolutionTier: 2,
      isUltimate: true,
    },
    skills: [
      sk({ id: "haki_slash", name: "Haki Slash", description: "Armament-coated cut.", glyph: "⚔", anim: ["combo_a"], targeting: "slash_wave", shape: "slash", element: "physical", damageMult: 1.5, manaCost: 10, cooldown: 1.5, slashRange: 9, color: 0xc5a059 }),
      sk({ id: "kamusari", name: "Kamusari", description: "A horizontal sword wave.", glyph: "🗡", anim: ["combo_b", "skill_a"], targeting: "slash_wave", shape: "slash", element: "arcane", damageMult: 2.0, manaCost: 18, cooldown: 4, slashRange: 12, color: 0xffe9a0 }),
      sk({ id: "observation", name: "Observation Feint", description: "Sidestep slash into a cone.", glyph: "👁", anim: ["dodge", "combo_a"], targeting: "instant", shape: "cone", element: "physical", damageMult: 1.7, manaCost: 14, cooldown: 3, aoeRadius: 5 }),
      sk({ id: "emperor_aura", name: "Emperor's Aura", description: "AoE Haki pressure zone.", glyph: "👑", anim: ["skill_b", "boost"], targeting: "ground_aoe", shape: "circle", element: "arcane", damageMult: 2.2, manaCost: 26, cooldown: 7, aoeRadius: 5.5, placeRange: 8 }),
      sk({ id: "red_hair_storm", name: "Red-Hair Storm", description: "Wide sword storm nova.", glyph: "🌪", anim: ["skill_a", "combo_c"], targeting: "ground_aoe", shape: "nova", element: "physical", damageMult: 2.5, manaCost: 30, cooldown: 9, aoeRadius: 6.5, placeRange: 6 }),
    ],
  },
  {
    fighterId: "law",
    special: {
      name: "Radio Knife",
      description: "ROOM-empowered shock blade that travels in a line.",
      anim: ["skill_a", "skill_b", "combo_c"],
      damageMult: 2.7,
      manaCost: 30,
      cooldown: 8,
      element: "lightning",
      slashWave: true,
      slashRange: 13,
      color: 0x88ddff,
    },
    skills: [
      sk({ id: "room", name: "ROOM", description: "Place a surgical circle — enemies inside take damage.", glyph: "🔵", anim: ["skill_b", "boost"], targeting: "ground_aoe", shape: "circle", element: "arcane", damageMult: 1.6, manaCost: 20, cooldown: 5, aoeRadius: 5, placeRange: 11 }),
      sk({ id: "shambles", name: "Shambles", description: "Swap-strike cone through the ROOM.", glyph: "🔀", anim: ["combo_a", "skill_a"], targeting: "instant", shape: "cone", element: "arcane", damageMult: 1.8, manaCost: 16, cooldown: 3.5, aoeRadius: 5 }),
      sk({ id: "injection", name: "Injection Shot", description: "Piercing line thrust.", glyph: "💉", anim: ["combo_b", "skill_a"], targeting: "instant", shape: "line", element: "physical", damageMult: 1.9, manaCost: 14, cooldown: 3, slashRange: 10 }),
      sk({ id: "takt", name: "Takt", description: "Levitate debris and slam the ground.", glyph: "🪨", anim: ["skill_b", "combo_c"], targeting: "ground_aoe", shape: "circle", element: "physical", damageMult: 2.2, manaCost: 24, cooldown: 6, aoeRadius: 4.2, placeRange: 10 }),
      sk({ id: "gamma", name: "Gamma Knife", description: "Internal shock AoE on a point.", glyph: "⚡", anim: ["skill_a", "combo_c"], targeting: "ground_aoe", shape: "circle", element: "lightning", damageMult: 2.6, manaCost: 32, cooldown: 9, aoeRadius: 3.5, placeRange: 9 }),
    ],
  },
  {
    fighterId: "lucci",
    special: {
      name: "Rokuogan",
      description: "Power-up R — shockwave fist blast.",
      anim: ["skill_a", "combo_e"],
      damageMult: 2.4,
      manaCost: 26,
      cooldown: 8,
      element: "physical",
      slashWave: true,
      slashRange: 9,
      color: 0xaaccff,
      evolutionTier: 1,
    },
    skills: [
      sk({ id: "shigan", name: "Shigan", description: "Finger pistol line strike.", glyph: "👉", anim: ["combo_a"], targeting: "instant", shape: "line", element: "physical", damageMult: 1.4, manaCost: 8, cooldown: 2 }),
      sk({ id: "rankyaku", name: "Rankyaku", description: "Flying kick slash wave.", glyph: "🦵", anim: ["combo_b"], targeting: "slash_wave", shape: "slash", element: "physical", damageMult: 1.6, manaCost: 14, cooldown: 4, slashRange: 9, color: 0xccddff }),
      sk({ id: "geppo", name: "Geppo Assault", description: "Air-step into a ground nova.", glyph: "☁", anim: ["jump", "combo_c"], targeting: "ground_aoe", shape: "nova", element: "physical", damageMult: 1.8, manaCost: 16, cooldown: 5.5, aoeRadius: 4, placeRange: 7 }),
      sk({ id: "tekkai", name: "Tekkai Counter", description: "Harden then explode outward.", glyph: "🛡", anim: ["boost", "skill_b"], targeting: "instant", shape: "nova", element: "physical", damageMult: 1.5, manaCost: 12, cooldown: 4.5, aoeRadius: 3.5 }),
    ],
  },
  {
    fighterId: "lucci_awakened",
    special: {
      name: "Awakened Rokuogan",
      description: "Ultimate R — Impel Down beast shockwave.",
      anim: ["skill_a", "skill_b", "combo_e"],
      damageMult: 3.4,
      manaCost: 34,
      cooldown: 8,
      element: "physical",
      slashWave: true,
      slashRange: 13,
      color: 0x88bbff,
      evolutionTier: 2,
      isUltimate: true,
    },
    skills: [
      sk({ id: "shigan", name: "Awakened Shigan", description: "Piercing finger pistols.", glyph: "👉", anim: ["combo_a"], targeting: "instant", shape: "line", element: "physical", damageMult: 1.7, manaCost: 10, cooldown: 1.8 }),
      sk({ id: "rankyaku", name: "Leopard Rankyaku", description: "Beast kick slash wave.", glyph: "🦵", anim: ["combo_b", "skill_a"], targeting: "slash_wave", shape: "slash", element: "physical", damageMult: 2.0, manaCost: 16, cooldown: 3.2, slashRange: 12, color: 0xccddff }),
      sk({ id: "geppo", name: "Geppo Assault", description: "Air-step ground nova.", glyph: "☁", anim: ["jump", "combo_c"], targeting: "ground_aoe", shape: "nova", element: "physical", damageMult: 2.1, manaCost: 18, cooldown: 5, aoeRadius: 4.8, placeRange: 8 }),
      sk({ id: "tekkai", name: "Iron Body Counter", description: "Harden and explode.", glyph: "🛡", anim: ["boost", "skill_b"], targeting: "instant", shape: "nova", element: "physical", damageMult: 1.8, manaCost: 14, cooldown: 4, aoeRadius: 4.5 }),
      sk({ id: "life_return", name: "Life Return Leopard", description: "Awakened claw devastation.", glyph: "🐆", anim: ["skill_b", "combo_e"], targeting: "ground_aoe", shape: "circle", element: "physical", damageMult: 2.6, manaCost: 30, cooldown: 7, aoeRadius: 5.5, placeRange: 7 }),
    ],
  },
  {
    fighterId: "sanji_onigashima",
    special: {
      name: "Diable Jambe: Hell Memories",
      description: "A blazing kick wave of black-leg fire.",
      anim: ["skill_a", "skill_b", "combo_c"],
      damageMult: 2.7,
      manaCost: 28,
      cooldown: 8,
      element: "fire",
      slashWave: true,
      slashRange: 12,
      color: 0xff5522,
    },
    skills: [
      sk({ id: "concasse", name: "Concasse", description: "Spinning axe kick cone.", glyph: "🦵", anim: ["combo_a"], targeting: "instant", shape: "cone", element: "physical", damageMult: 1.5, manaCost: 10, cooldown: 1.8, aoeRadius: 4.5 }),
      sk({ id: "diable", name: "Diable Jambe", description: "Ignited kick slash.", glyph: "🔥", anim: ["skill_a", "combo_b"], targeting: "slash_wave", shape: "slash", element: "fire", damageMult: 2.0, manaCost: 18, cooldown: 4, slashRange: 10, color: 0xff6633 }),
      sk({ id: "spectre", name: "Spectre", description: "Flurry cone of burning kicks.", glyph: "💫", anim: ["combo_c", "combo_b"], targeting: "instant", shape: "cone", element: "fire", damageMult: 2.1, manaCost: 20, cooldown: 5, aoeRadius: 5.5 }),
      sk({ id: "party_table", name: "Party Table Kick Course", description: "Ground fire ring.", glyph: "🍽", anim: ["skill_b", "boost"], targeting: "ground_aoe", shape: "circle", element: "fire", damageMult: 2.2, manaCost: 24, cooldown: 6, aoeRadius: 4.8, placeRange: 8 }),
      sk({ id: "ifrit", name: "Ifrit Jambe", description: "Lightning-fire stomp nova.", glyph: "⚡", anim: ["skill_b", "skill_a"], targeting: "ground_aoe", shape: "nova", element: "lightning", damageMult: 2.6, manaCost: 32, cooldown: 9, aoeRadius: 5.5, placeRange: 7 }),
    ],
  },
  {
    fighterId: "ryuma",
    special: {
      name: "Flashing Slash",
      description: "A legendary sword wave that outranges the blade.",
      anim: ["skill_a", "skill_b", "combo_c"],
      damageMult: 2.9,
      manaCost: 30,
      cooldown: 8,
      element: "physical",
      slashWave: true,
      slashRange: 15,
      color: 0xeeeeff,
    },
    skills: [
      sk({ id: "iai", name: "Iai Draw", description: "Instant slash wave.", glyph: "⚔", anim: ["combo_a", "skill_a"], targeting: "slash_wave", shape: "slash", element: "physical", damageMult: 1.6, manaCost: 10, cooldown: 1.5, slashRange: 10, color: 0xccddee }),
      sk({ id: "triple", name: "Triple Flash", description: "Three-line pierce.", glyph: "✨", anim: ["combo_b", "combo_c"], targeting: "instant", shape: "line", element: "physical", damageMult: 1.9, manaCost: 16, cooldown: 3.5 }),
      sk({ id: "dragon_slash", name: "Dragon Twister", description: "Spiral ground AoE.", glyph: "🐉", anim: ["skill_b", "boost"], targeting: "ground_aoe", shape: "circle", element: "arcane", damageMult: 2.2, manaCost: 22, cooldown: 6, aoeRadius: 4.5, placeRange: 9 }),
      sk({ id: "moonwalk", name: "Moonlit Step", description: "Dash-cut cone.", glyph: "🌙", anim: ["dodge", "combo_a"], targeting: "instant", shape: "cone", element: "physical", damageMult: 1.7, manaCost: 14, cooldown: 3, aoeRadius: 5 }),
      sk({ id: "god_blade", name: "Sword God Art", description: "Massive slash wave.", glyph: "🗡", anim: ["skill_a", "skill_b"], targeting: "slash_wave", shape: "slash", element: "arcane", damageMult: 2.5, manaCost: 28, cooldown: 8, slashRange: 14, color: 0xaaddff }),
    ],
  },
  {
    fighterId: "marco",
    special: {
      name: "Phoenix Brand",
      description: "Blue flames lance forward as a healing blaze wave.",
      anim: ["skill_a", "skill_b", "combo_c"],
      damageMult: 2.4,
      manaCost: 26,
      cooldown: 8,
      element: "fire",
      slashWave: true,
      slashRange: 12,
      color: 0x66ccff,
    },
    skills: [
      sk({ id: "blue_burst", name: "Blue Flame Burst", description: "Cone of phoenix fire.", glyph: "🔥", anim: ["combo_a", "skill_a"], targeting: "instant", shape: "cone", element: "fire", damageMult: 1.6, manaCost: 12, cooldown: 2, aoeRadius: 5 }),
      sk({ id: "regen", name: "Phoenix Regeneration", description: "Self heal (no damage).", glyph: "💙", anim: ["boost", "skill_b"], targeting: "self", shape: "nova", element: "arcane", damageMult: 0, manaCost: 20, cooldown: 8, aoeRadius: 3 }),
      sk({ id: "talon", name: "Talon Dive", description: "Dive-bomb ground circle.", glyph: "🦅", anim: ["jump", "combo_b"], targeting: "ground_aoe", shape: "circle", element: "fire", damageMult: 2.1, manaCost: 20, cooldown: 5, aoeRadius: 4.2, placeRange: 9 }),
      sk({ id: "flame_wall", name: "Flame Curtain", description: "Line of blue fire.", glyph: "🌊", anim: ["skill_a", "combo_c"], targeting: "instant", shape: "line", element: "fire", damageMult: 1.8, manaCost: 16, cooldown: 4 }),
      sk({ id: "phoenix_storm", name: "Phoenix Storm", description: "Wide regenerative nova.", glyph: "🌪", anim: ["skill_b", "skill_a"], targeting: "ground_aoe", shape: "nova", element: "fire", damageMult: 2.3, manaCost: 30, cooldown: 9, aoeRadius: 6, placeRange: 7 }),
    ],
  },
  {
    fighterId: "smoker",
    special: {
      name: "White Blow",
      description: "A dense smoke fist that rockets forward.",
      anim: ["skill_a", "skill_b", "combo_c"],
      damageMult: 2.5,
      manaCost: 26,
      cooldown: 8,
      element: "physical",
      slashWave: true,
      slashRange: 12,
      color: 0xcccccc,
    },
    skills: [
      sk({ id: "white_snake", name: "White Snake", description: "Smoke tendril line.", glyph: "🌫", anim: ["combo_a", "skill_a"], targeting: "instant", shape: "line", element: "physical", damageMult: 1.5, manaCost: 10, cooldown: 2 }),
      sk({ id: "white_out", name: "White Out", description: "Smokescreen nova.", glyph: "☁", anim: ["skill_b", "boost"], targeting: "ground_aoe", shape: "nova", element: "physical", damageMult: 1.8, manaCost: 18, cooldown: 5, aoeRadius: 5.5, placeRange: 8 }),
      sk({ id: "jitte", name: "Jitte Slam", description: "Seastone jitte cone.", glyph: "⚒", anim: ["combo_b", "combo_c"], targeting: "instant", shape: "cone", element: "physical", damageMult: 1.9, manaCost: 14, cooldown: 3.5, aoeRadius: 4.5 }),
      sk({ id: "smoke_prison", name: "Smoke Prison", description: "Trap circle of smoke.", glyph: "⛓", anim: ["skill_a", "skill_b"], targeting: "ground_aoe", shape: "circle", element: "arcane", damageMult: 2.0, manaCost: 22, cooldown: 6, aoeRadius: 4, placeRange: 9 }),
      sk({ id: "white_hunter", name: "White Hunter", description: "Expanding smoke chase wave.", glyph: "🏛", anim: ["skill_b", "combo_c"], targeting: "slash_wave", shape: "slash", element: "physical", damageMult: 2.2, manaCost: 24, cooldown: 7, slashRange: 11, color: 0xdddddd }),
    ],
  },
  {
    fighterId: "shiryu",
    special: {
      name: "Rain Blade Wave",
      description: "Power-up R — rain-soaked slash surge.",
      anim: ["combo_b", "skill_a"],
      damageMult: 2.2,
      manaCost: 22,
      cooldown: 7,
      element: "physical",
      slashWave: true,
      slashRange: 10,
      color: 0x8899aa,
      evolutionTier: 1,
    },
    skills: [
      sk({ id: "rain_cut", name: "Rain Cut", description: "Vertical line pierce.", glyph: "🌧", anim: ["combo_b"], targeting: "instant", shape: "line", element: "physical", damageMult: 1.4, manaCost: 10, cooldown: 2.5 }),
      sk({ id: "ambush", name: "Ambush Strike", description: "Sudden cone cut.", glyph: "🗡", anim: ["combo_a", "dodge"], targeting: "instant", shape: "cone", element: "physical", damageMult: 1.5, manaCost: 12, cooldown: 3, aoeRadius: 4 }),
      sk({ id: "blood", name: "Blood Mist", description: "Poison cone of cuts.", glyph: "🩸", anim: ["combo_c"], targeting: "instant", shape: "cone", element: "poison", damageMult: 1.6, manaCost: 14, cooldown: 4, aoeRadius: 4.5 }),
      sk({ id: "execution", name: "Silent Cut", description: "Mid-range slash wave.", glyph: "☠", anim: ["skill_a"], targeting: "slash_wave", shape: "slash", element: "physical", damageMult: 1.8, manaCost: 18, cooldown: 5, slashRange: 9, color: 0x8899aa }),
    ],
  },
  {
    fighterId: "shiryu_clear",
    special: {
      name: "Clear-Clear Annihilation",
      description: "Ultimate R — invisible blade erases the battlefield.",
      anim: ["skill_a", "skill_b", "combo_c"],
      damageMult: 3.3,
      manaCost: 32,
      cooldown: 8,
      element: "physical",
      slashWave: true,
      slashRange: 16,
      color: 0x99aacc,
      evolutionTier: 2,
      isUltimate: true,
    },
    skills: [
      sk({ id: "vanish", name: "Clear Step", description: "Invisible approach slash.", glyph: "👻", anim: ["dodge", "combo_a"], targeting: "slash_wave", shape: "slash", element: "physical", damageMult: 1.7, manaCost: 12, cooldown: 2.5, slashRange: 9, color: 0xaabbcc }),
      sk({ id: "rain_cut", name: "Rain Cut", description: "Vertical line pierce.", glyph: "🌧", anim: ["combo_b", "skill_a"], targeting: "instant", shape: "line", element: "physical", damageMult: 1.8, manaCost: 14, cooldown: 3 }),
      sk({ id: "ambush", name: "Ambush Circle", description: "Strike from nowhere AoE.", glyph: "🗡", anim: ["skill_b", "combo_c"], targeting: "ground_aoe", shape: "circle", element: "physical", damageMult: 2.2, manaCost: 22, cooldown: 6, aoeRadius: 3.8, placeRange: 10 }),
      sk({ id: "blood", name: "Blood Mist", description: "Poison cone of cuts.", glyph: "🩸", anim: ["combo_c", "skill_a"], targeting: "instant", shape: "cone", element: "poison", damageMult: 1.9, manaCost: 16, cooldown: 4, aoeRadius: 5 }),
      sk({ id: "execution", name: "Silent Execution", description: "Huge invisible slash wave.", glyph: "☠", anim: ["skill_a", "skill_b"], targeting: "slash_wave", shape: "slash", element: "physical", damageMult: 2.5, manaCost: 28, cooldown: 9, slashRange: 13, color: 0x8899aa }),
    ],
  },
  {
    fighterId: "page_one",
    special: {
      name: "Spino Tail Sweep",
      description: "Ancient-zoan tail shockwave.",
      anim: ["skill_a", "skill_b", "combo_c"],
      damageMult: 2.6,
      manaCost: 26,
      cooldown: 8,
      element: "physical",
      slashWave: true,
      slashRange: 11,
      color: 0x88aa66,
    },
    skills: [
      sk({ id: "bite", name: "Spino Bite", description: "Crushing cone bite.", glyph: "🦖", anim: ["combo_a"], targeting: "instant", shape: "cone", element: "physical", damageMult: 1.7, manaCost: 10, cooldown: 2, aoeRadius: 4 }),
      sk({ id: "charge", name: "Ancient Charge", description: "Line stampede.", glyph: "💥", anim: ["combo_b", "run"], targeting: "instant", shape: "line", element: "physical", damageMult: 1.9, manaCost: 14, cooldown: 3.5 }),
      sk({ id: "quake", name: "Tail Quake", description: "Ground slam circle.", glyph: "🪨", anim: ["skill_a", "combo_c"], targeting: "ground_aoe", shape: "circle", element: "physical", damageMult: 2.2, manaCost: 20, cooldown: 5, aoeRadius: 5, placeRange: 7 }),
      sk({ id: "roar", name: "Predator Roar", description: "Intimidating nova.", glyph: "📢", anim: ["skill_b", "boost"], targeting: "instant", shape: "nova", element: "physical", damageMult: 1.6, manaCost: 16, cooldown: 5, aoeRadius: 6 }),
      sk({ id: "rampage", name: "Rampage", description: "Massive stomped AoE.", glyph: "☢", anim: ["skill_b", "skill_a"], targeting: "ground_aoe", shape: "nova", element: "physical", damageMult: 2.5, manaCost: 30, cooldown: 9, aoeRadius: 6.5, placeRange: 6 }),
    ],
  },
  {
    fighterId: "ace_sabo_luffy",
    special: {
      name: "Brotherhood Flame",
      description: "Ace's fire, Sabo's wind, Luffy's will — a triple slash wave.",
      anim: ["skill_a", "skill_b", "combo_c"],
      damageMult: 2.8,
      manaCost: 30,
      cooldown: 9,
      element: "fire",
      slashWave: true,
      slashRange: 14,
      color: 0xff6622,
    },
    skills: [
      sk({ id: "hiken", name: "Hiken", description: "Ace fire fist cone.", glyph: "🔥", anim: ["combo_a", "skill_a"], targeting: "instant", shape: "cone", element: "fire", damageMult: 1.8, manaCost: 12, cooldown: 2.5, aoeRadius: 5 }),
      sk({ id: "fire_fist_aoe", name: "Hiken Rain", description: "Fireball ground circle.", glyph: "☄", anim: ["skill_b", "combo_b"], targeting: "ground_aoe", shape: "circle", element: "fire", damageMult: 2.1, manaCost: 20, cooldown: 5, aoeRadius: 4.5, placeRange: 10 }),
      sk({ id: "wind_blade", name: "Wind Blade", description: "Sabo's flying slash.", glyph: "💨", anim: ["combo_b", "skill_a"], targeting: "slash_wave", shape: "slash", element: "lightning", damageMult: 1.9, manaCost: 16, cooldown: 4, slashRange: 12, color: 0xaaddff }),
      sk({ id: "gum_barrage", name: "Gum Barrage", description: "Luffy punch cone.", glyph: "👊", anim: ["combo_c", "combo_a"], targeting: "instant", shape: "cone", element: "physical", damageMult: 1.7, manaCost: 14, cooldown: 3, aoeRadius: 5 }),
      sk({ id: "crossfire", name: "Crossfire", description: "Triple elemental nova.", glyph: "🌟", anim: ["skill_b", "skill_a"], targeting: "ground_aoe", shape: "nova", element: "fire", damageMult: 2.6, manaCost: 32, cooldown: 10, aoeRadius: 6, placeRange: 8 }),
    ],
  },
  {
    fighterId: "marine_mullet",
    special: {
      name: "Musket Volley",
      description: "A heavy musket shot that travels as a shock slug.",
      anim: ["combo_c", "combo_b", "boost"],
      damageMult: 2.2,
      manaCost: 20,
      cooldown: 6,
      element: "physical",
      slashWave: true,
      slashRange: 16,
      color: 0xffcc88,
    },
    skills: [
      sk({ id: "shot", name: "Musket Shot", description: "Long line shot.", glyph: "🔫", anim: ["combo_a"], targeting: "instant", shape: "line", element: "physical", damageMult: 1.5, manaCost: 8, cooldown: 1.5 }),
      sk({ id: "bayonet", name: "Bayonet Thrust", description: "Melee cone.", glyph: "🗡", anim: ["combo_b"], targeting: "instant", shape: "cone", element: "physical", damageMult: 1.4, manaCost: 8, cooldown: 2, aoeRadius: 3.5 }),
      sk({ id: "smoke_bomb", name: "Smoke Bomb", description: "Ground smoke circle.", glyph: "💣", anim: ["combo_c", "boost"], targeting: "ground_aoe", shape: "circle", element: "physical", damageMult: 1.6, manaCost: 14, cooldown: 5, aoeRadius: 4, placeRange: 9 }),
      sk({ id: "salvo", name: "Salvo", description: "Multi-shot cone.", glyph: "💥", anim: ["combo_c", "combo_b"], targeting: "instant", shape: "cone", element: "fire", damageMult: 1.9, manaCost: 16, cooldown: 4, aoeRadius: 6 }),
      sk({ id: "cannon", name: "Ship Cannon Cue", description: "Artillery ground blast.", glyph: "💣", anim: ["boost", "combo_c"], targeting: "ground_aoe", shape: "circle", element: "fire", damageMult: 2.3, manaCost: 24, cooldown: 8, aoeRadius: 5, placeRange: 12 }),
    ],
  },
  {
    fighterId: "koby",
    special: {
      name: "Honesty Impact",
      description: "Power-up R — sincere shockwave punch.",
      anim: ["0062", "0063"],
      damageMult: 2.0,
      manaCost: 20,
      cooldown: 7,
      element: "physical",
      slashWave: true,
      slashRange: 9,
      color: 0x99ccff,
      evolutionTier: 1,
    },
    skills: [
      sk({ id: "jab", name: "Marine Jab", description: "Basic punch cone.", glyph: "👊", anim: ["0062", "combo"], targeting: "instant", shape: "cone", element: "physical", damageMult: 1.2, manaCost: 6, cooldown: 1.4, aoeRadius: 3 }),
      sk({ id: "charge", name: "Honesty Charge", description: "Line rush.", glyph: "🏃", anim: ["0110"], targeting: "instant", shape: "line", element: "physical", damageMult: 1.4, manaCost: 10, cooldown: 3.5 }),
      sk({ id: "shock", name: "Fist Shock", description: "Ground circle shock.", glyph: "💫", anim: ["0063", "0062"], targeting: "ground_aoe", shape: "circle", element: "lightning", damageMult: 1.6, manaCost: 14, cooldown: 5.5, aoeRadius: 3.5, placeRange: 7 }),
      sk({ id: "rally", name: "Rally Cry", description: "Self buff nova.", glyph: "📢", anim: ["0011"], targeting: "self", shape: "nova", element: "arcane", damageMult: 0.4, manaCost: 12, cooldown: 7, aoeRadius: 2.5 }),
    ],
  },
  {
    fighterId: "koby_hero",
    special: {
      name: "Hero's Justice",
      description: "Ultimate R — Marineford courage shockwave.",
      anim: ["0062", "0063", "0062_Low"],
      damageMult: 2.9,
      manaCost: 28,
      cooldown: 7,
      element: "lightning",
      slashWave: true,
      slashRange: 13,
      color: 0x66aaff,
      evolutionTier: 2,
      isUltimate: true,
    },
    skills: [
      sk({ id: "jab", name: "Marine Jab", description: "Power punch cone.", glyph: "👊", anim: ["0062", "combo"], targeting: "instant", shape: "cone", element: "physical", damageMult: 1.5, manaCost: 8, cooldown: 1.2, aoeRadius: 4 }),
      sk({ id: "charge", name: "Honesty Charge", description: "Line rush.", glyph: "🏃", anim: ["0110", "0063"], targeting: "instant", shape: "line", element: "physical", damageMult: 1.7, manaCost: 12, cooldown: 3 }),
      sk({ id: "shock", name: "Fist Shock", description: "Ground circle shock.", glyph: "💫", anim: ["0063", "0062"], targeting: "ground_aoe", shape: "circle", element: "lightning", damageMult: 2.0, manaCost: 18, cooldown: 5, aoeRadius: 4.5, placeRange: 9 }),
      sk({ id: "rally", name: "Rally Cry", description: "Self buff nova.", glyph: "📢", anim: ["0011", "boost"], targeting: "self", shape: "nova", element: "arcane", damageMult: 0.6, manaCost: 14, cooldown: 6, aoeRadius: 3.5 }),
      sk({ id: "rising", name: "Rising Star", description: "Leap smash AoE.", glyph: "⭐", anim: ["0063", "0062_Low"], targeting: "ground_aoe", shape: "nova", element: "physical", damageMult: 2.4, manaCost: 24, cooldown: 7, aoeRadius: 5.5, placeRange: 8 }),
    ],
  },
  {
    fighterId: "mihawk",
    special: {
      name: "Black Blade: The Void",
      description: "Yoru releases a world-cutting slash wave.",
      anim: ["skill_a", "skill_b", "combo_c"],
      damageMult: 3.1,
      manaCost: 34,
      cooldown: 9,
      element: "physical",
      slashWave: true,
      slashRange: 18,
      color: 0x334455,
    },
    skills: [
      sk({ id: "cross_cut", name: "Cross Cut", description: "Dual-blade crossing slash wave.", glyph: "⚔", anim: ["combo_a", "skill_a"], targeting: "slash_wave", shape: "slash", element: "physical", damageMult: 1.6, manaCost: 10, cooldown: 1.5, slashRange: 11, color: 0x8899aa }),
      sk({ id: "green_slash", name: "Green Slash", description: "Long-range sword line.", glyph: "🗡", anim: ["combo_b", "skill_a"], targeting: "instant", shape: "line", element: "physical", damageMult: 1.8, manaCost: 14, cooldown: 3 }),
      sk({ id: "hawk_eye", name: "Hawk Eye", description: "Precision cone — finds the weak point.", glyph: "👁", anim: ["dodge", "combo_a"], targeting: "instant", shape: "cone", element: "physical", damageMult: 1.7, manaCost: 12, cooldown: 2.5, aoeRadius: 5 }),
      sk({ id: "world_cut", name: "World Cut", description: "Ground shockwave circle.", glyph: "🌍", anim: ["skill_b", "combo_c"], targeting: "ground_aoe", shape: "circle", element: "arcane", damageMult: 2.3, manaCost: 26, cooldown: 7, aoeRadius: 4.8, placeRange: 10 }),
      sk({ id: "night_impact", name: "Night Impact", description: "Massive overhead nova.", glyph: "🌑", anim: ["skill_a", "skill_b"], targeting: "ground_aoe", shape: "nova", element: "physical", damageMult: 2.7, manaCost: 32, cooldown: 9, aoeRadius: 6, placeRange: 8 }),
    ],
  },
  {
    fighterId: "kizaru",
    special: {
      name: "Yasakani Sacred Jewel",
      description: "A sustained laser barrage that lances the battlefield.",
      anim: ["skill_a", "skill_b", "combo_c"],
      damageMult: 2.9,
      manaCost: 32,
      cooldown: 8,
      element: "lightning",
      slashWave: true,
      slashRange: 17,
      color: 0xffee88,
    },
    skills: [
      sk({ id: "light_kick", name: "Light Kick", description: "Photon kick cone.", glyph: "🦵", anim: ["combo_a"], targeting: "instant", shape: "cone", element: "lightning", damageMult: 1.5, manaCost: 10, cooldown: 1.5, aoeRadius: 4.5 }),
      sk({ id: "laser_beam", name: "Laser Beam", description: "Piercing light line.", glyph: "💡", anim: ["skill_a", "combo_b"], targeting: "instant", shape: "line", element: "lightning", damageMult: 1.9, manaCost: 16, cooldown: 3.5 }),
      sk({ id: "light_speed", name: "Light-Speed Dash", description: "Blink slash wave.", glyph: "✨", anim: ["dodge", "skill_a"], targeting: "slash_wave", shape: "slash", element: "lightning", damageMult: 1.7, manaCost: 14, cooldown: 3, slashRange: 12, color: 0xffffaa }),
      sk({ id: "jewel_burst", name: "Sacred Jewel Burst", description: "Explosive light circle.", glyph: "☀", anim: ["skill_b", "combo_c"], targeting: "ground_aoe", shape: "circle", element: "lightning", damageMult: 2.2, manaCost: 24, cooldown: 6, aoeRadius: 4.5, placeRange: 11 }),
      sk({ id: "pika_storm", name: "Pika Storm", description: "Wide lightning nova.", glyph: "⚡", anim: ["skill_b", "skill_a"], targeting: "ground_aoe", shape: "nova", element: "lightning", damageMult: 2.6, manaCost: 30, cooldown: 9, aoeRadius: 6.5, placeRange: 9 }),
    ],
  },
  {
    fighterId: "fujitora_marijoa",
    special: {
      name: "Meteor",
      description: "Calls a meteor down — a crushing gravitational slash wave.",
      anim: ["skill_a", "skill_b", "combo_c"],
      damageMult: 3.0,
      manaCost: 34,
      cooldown: 10,
      element: "arcane",
      slashWave: true,
      slashRange: 14,
      color: 0x6633aa,
    },
    skills: [
      sk({ id: "gravity_pull", name: "Gravity Pull", description: "Drag enemies into a cone crush.", glyph: "🌀", anim: ["combo_a", "skill_b"], targeting: "instant", shape: "cone", element: "arcane", damageMult: 1.6, manaCost: 12, cooldown: 2.5, aoeRadius: 5 }),
      sk({ id: "meteor_strike", name: "Meteor Strike", description: "Place a meteor impact circle.", glyph: "☄", anim: ["skill_a", "skill_b"], targeting: "ground_aoe", shape: "circle", element: "arcane", damageMult: 2.4, manaCost: 26, cooldown: 7, aoeRadius: 5.5, placeRange: 12 }),
      sk({ id: "gravity_well", name: "Gravity Well", description: "Sustained ground trap zone.", glyph: "⬇", anim: ["skill_b", "boost"], targeting: "ground_aoe", shape: "circle", element: "arcane", damageMult: 2.0, manaCost: 22, cooldown: 6, aoeRadius: 4.2, placeRange: 10 }),
      sk({ id: "blind_justice", name: "Blind Justice", description: "Sword line through the dark.", glyph: "⚖", anim: ["combo_b", "skill_a"], targeting: "instant", shape: "line", element: "physical", damageMult: 1.8, manaCost: 14, cooldown: 3.5 }),
      sk({ id: "gravity_nova", name: "Gravitational Collapse", description: "Crush all nearby foes.", glyph: "💫", anim: ["skill_b", "combo_c"], targeting: "ground_aoe", shape: "nova", element: "arcane", damageMult: 2.7, manaCost: 32, cooldown: 9, aoeRadius: 6.5, placeRange: 7 }),
    ],
  },
  {
    fighterId: "vista",
    special: {
      name: "Flower Storm",
      description: "A blizzard of dual-sword slashes racing forward.",
      anim: ["skill_a", "skill_b", "combo_c"],
      damageMult: 2.7,
      manaCost: 28,
      cooldown: 8,
      element: "physical",
      slashWave: true,
      slashRange: 13,
      color: 0xff88aa,
    },
    skills: [
      sk({ id: "rose_cut", name: "Rose Cut", description: "Elegant slash wave.", glyph: "🌹", anim: ["combo_a", "skill_a"], targeting: "slash_wave", shape: "slash", element: "physical", damageMult: 1.5, manaCost: 10, cooldown: 1.5, slashRange: 10, color: 0xffaacc }),
      sk({ id: "dual_flourish", name: "Dual Flourish", description: "Twin-blade cone.", glyph: "⚔", anim: ["combo_b", "combo_c"], targeting: "instant", shape: "cone", element: "physical", damageMult: 1.7, manaCost: 12, cooldown: 2.5, aoeRadius: 5 }),
      sk({ id: "commander_charge", name: "Commander Charge", description: "Rush line attack.", glyph: "🏃", anim: ["run", "combo_a"], targeting: "instant", shape: "line", element: "physical", damageMult: 1.8, manaCost: 14, cooldown: 3.5 }),
      sk({ id: "petal_ring", name: "Petal Ring", description: "Ground flower AoE.", glyph: "🌸", anim: ["skill_b", "boost"], targeting: "ground_aoe", shape: "circle", element: "physical", damageMult: 2.0, manaCost: 20, cooldown: 5, aoeRadius: 4.5, placeRange: 9 }),
      sk({ id: "whitebeard_honor", name: "Whitebeard's Honor", description: "Wide commander nova.", glyph: "🌪", anim: ["skill_a", "skill_b"], targeting: "ground_aoe", shape: "nova", element: "physical", damageMult: 2.4, manaCost: 28, cooldown: 8, aoeRadius: 6, placeRange: 7 }),
    ],
  },
  {
    fighterId: "charlotte_oven",
    special: {
      name: "Heat Hell",
      description: "Superheated shockwave that scorches everything ahead.",
      anim: ["skill_a", "skill_b", "combo_c"],
      damageMult: 2.8,
      manaCost: 30,
      cooldown: 8,
      element: "fire",
      slashWave: true,
      slashRange: 12,
      color: 0xff4400,
    },
    skills: [
      sk({ id: "heat_palm", name: "Heat Palm", description: "Burning palm cone.", glyph: "🔥", anim: ["combo_a"], targeting: "instant", shape: "cone", element: "fire", damageMult: 1.6, manaCost: 10, cooldown: 2, aoeRadius: 4.5 }),
      sk({ id: "heated_net", name: "Heated Net", description: "Trap circle of scorching heat.", glyph: "🕸", anim: ["skill_b", "combo_b"], targeting: "ground_aoe", shape: "circle", element: "fire", damageMult: 2.1, manaCost: 20, cooldown: 5, aoeRadius: 4.8, placeRange: 9 }),
      sk({ id: "molten_slam", name: "Molten Slam", description: "Ground fire nova.", glyph: "💥", anim: ["skill_a", "combo_c"], targeting: "ground_aoe", shape: "nova", element: "fire", damageMult: 2.3, manaCost: 24, cooldown: 6, aoeRadius: 5.5, placeRange: 7 }),
      sk({ id: "heat_wave", name: "Heat Wave", description: "Fire slash wave.", glyph: "🌊", anim: ["combo_b", "skill_a"], targeting: "slash_wave", shape: "slash", element: "fire", damageMult: 1.9, manaCost: 16, cooldown: 4, slashRange: 10, color: 0xff6622 }),
      sk({ id: "big_mom_wrath", name: "Sweet Commander's Wrath", description: "Massive fire blast zone.", glyph: "☄", anim: ["skill_b", "skill_a"], targeting: "ground_aoe", shape: "circle", element: "fire", damageMult: 2.7, manaCost: 32, cooldown: 9, aoeRadius: 5.5, placeRange: 11 }),
    ],
  },
  {
    fighterId: "hybrid_kaido",
    special: {
      name: "Boro Breath",
      description: "Ultimate R — dragon thunder breath devastation.",
      anim: ["skill_b", "combo_c", "combo_b"],
      damageMult: 3.2,
      manaCost: 36,
      cooldown: 10,
      element: "lightning",
      slashWave: true,
      slashRange: 16,
      color: 0x88ccff,
      evolutionTier: 1,
      isUltimate: true,
    },
    skills: [
      sk({ id: "club_smash", name: "Club Smash", description: "Kanabo overhead cone.", glyph: "🔨", anim: ["combo_a"], targeting: "instant", shape: "cone", element: "physical", damageMult: 1.8, manaCost: 10, cooldown: 2, aoeRadius: 5 }),
      sk({ id: "thunder_bagua", name: "Thunder Bagua", description: "Lightning-infused ground circle.", glyph: "⚡", anim: ["skill_a", "combo_b"], targeting: "ground_aoe", shape: "circle", element: "lightning", damageMult: 2.2, manaCost: 22, cooldown: 5, aoeRadius: 5, placeRange: 8 }),
      sk({ id: "dragon_twister", name: "Dragon Twister", description: "Spinning physical nova.", glyph: "🐉", anim: ["combo_c", "skill_b"], targeting: "ground_aoe", shape: "nova", element: "physical", damageMult: 2.5, manaCost: 28, cooldown: 7, aoeRadius: 6.5, placeRange: 6 }),
      sk({ id: "conqueror_coating", name: "Conqueror's Coating", description: "Haki line strike.", glyph: "👑", anim: ["skill_a", "combo_b"], targeting: "instant", shape: "line", element: "arcane", damageMult: 2.0, manaCost: 18, cooldown: 4 }),
      sk({ id: "rampage_dragon", name: "Rampage Dragon", description: "Hybrid-form ground devastation.", glyph: "☢", anim: ["skill_b", "combo_c"], targeting: "ground_aoe", shape: "nova", element: "fire", damageMult: 2.9, manaCost: 34, cooldown: 10, aoeRadius: 7, placeRange: 7 }),
    ],
  },
  {
    fighterId: RACALVIN_ID,
    special: {
      name: "Psymic Crown",
      description: "Ultimate psychic burst — draw pistol and fire a green mind-lance.",
      anim: ["cast", "attack"],
      damageMult: 2.9,
      manaCost: 30,
      cooldown: 8,
      element: "psychic",
      slashWave: true,
      slashRange: 15,
      color: 0x44ff88,
      isUltimate: true,
    },
    skills: [
      sk({ id: "cleave", name: "Corsair Cleave", description: "Brothers' Keeper wide blade cone.", glyph: "⚔", anim: ["attack", "combo"], targeting: "instant", shape: "cone", element: "physical", damageMult: 1.7, manaCost: 10, cooldown: 1.8, aoeRadius: 5 }),
      sk({ id: "mind_shot", name: "Mind Shot", description: "Draw pistol — green psychic line shot.", glyph: "🔫", anim: ["cast", "attack"], targeting: "instant", shape: "line", element: "psychic", damageMult: 1.6, manaCost: 12, cooldown: 2.5, color: 0x44ff88 }),
      sk({ id: "psychic_push", name: "Psymic Push", description: "Telekinetic ground ring.", glyph: "🧠", anim: ["cast", "punch"], targeting: "ground_aoe", shape: "circle", element: "psychic", damageMult: 2.0, manaCost: 18, cooldown: 5, aoeRadius: 4.5, placeRange: 9, color: 0x55ff99 }),
      sk({ id: "hammer", name: "Keeper's Hammer", description: "Greatsword overhead smash.", glyph: "🔨", anim: ["hammer", "combo"], targeting: "ground_aoe", shape: "circle", element: "physical", damageMult: 2.2, manaCost: 20, cooldown: 5, aoeRadius: 4.5, placeRange: 8 }),
      sk({ id: "psychic_nova", name: "Psymic Nova", description: "Green psychic shockwave nova.", glyph: "💚", anim: ["cast", "hammer"], targeting: "ground_aoe", shape: "nova", element: "psychic", damageMult: 2.5, manaCost: 28, cooldown: 8, aoeRadius: 6, placeRange: 8, color: 0x33ee77 }),
    ],
  },
];

const BY_ID = new Map(KITS.map((k) => [k.fighterId, k]));

/** Default kit used when a fighter has no custom entry. */
const FALLBACK: FighterKit = {
  fighterId: "default",
  special: {
    name: "Finishing Blow",
    description: "A powerful special attack.",
    anim: ["skill_a", "skill_b", "combo_c", "attack"],
    damageMult: 2.4,
    manaCost: 24,
    cooldown: 7,
    element: "physical",
    slashWave: true,
    slashRange: 11,
    color: 0xffaa66,
  },
  skills: [
    sk({ id: "slash", name: "Slash", description: "Basic cut.", glyph: "⚔", anim: ["combo_a", "attack"], targeting: "slash_wave", shape: "slash", element: "physical", damageMult: 1.4, manaCost: 8, cooldown: 1.2, slashRange: 8, color: 0xffcc88 }),
    sk({ id: "blast", name: "Blast", description: "Ground blast.", glyph: "💥", anim: ["skill_a", "combo_b"], targeting: "ground_aoe", shape: "circle", element: "fire", damageMult: 1.8, manaCost: 16, cooldown: 4, aoeRadius: 4, placeRange: 9 }),
    sk({ id: "sweep", name: "Sweep", description: "Cone sweep.", glyph: "🌀", anim: ["combo_b", "combo_c"], targeting: "instant", shape: "cone", element: "physical", damageMult: 1.6, manaCost: 12, cooldown: 3, aoeRadius: 5 }),
    sk({ id: "bolt", name: "Bolt", description: "Line bolt.", glyph: "⚡", anim: ["skill_b", "cast"], targeting: "instant", shape: "line", element: "lightning", damageMult: 1.7, manaCost: 14, cooldown: 3.5 }),
    sk({ id: "meteor", name: "Meteor", description: "Heavy ground AoE.", glyph: "☄", anim: ["skill_b", "skill_a"], targeting: "ground_aoe", shape: "nova", element: "fire", damageMult: 2.3, manaCost: 26, cooldown: 8, aoeRadius: 5.5, placeRange: 10 }),
  ],
};

export function getFighterKit(fighterId?: string | null): FighterKit {
  if (fighterId && BY_ID.has(fighterId)) return BY_ID.get(fighterId)!;
  // Annihilate / Warlords 24 — generated class skill kits for creation
  if (fighterId) {
    const g6 = annihilateFighterKit(fighterId);
    if (g6) return g6;
  }
  return FALLBACK;
}

/** Kit for the currently selected fighter. */
export function getActiveFighterKit(): FighterKit {
  return getFighterKit(getActiveFighter().id);
}

/** Map fighter skills into ClassSkill-shaped objects for the HUD skill bar. */
export function fighterSkillsAsClassSkills(kit: FighterKit) {
  return kit.skills.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    glyph: s.glyph,
    type: s.element === "physical" ? ("physical" as const) : ("magical" as const),
    damage: s.damageMult,
    manaCost: s.manaCost,
    cooldown: s.cooldown,
    target: s.targeting === "self" ? ("self" as const) : ("enemy" as const),
    effects: [
      s.targeting === "ground_aoe" ? "Ground AoE" : s.targeting === "slash_wave" ? "Slash Wave" : s.shape,
      s.element,
    ],
  }));
}
