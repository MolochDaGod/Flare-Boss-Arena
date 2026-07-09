/**
 * Per-character combat design — abilities mapped to animation clips, AI brain
 * archetypes, aura elements, and enemy-roster readiness.
 *
 * Animation candidates match bounty-rush suffixes / koby numerics / racalvin
 * clip labels used by PlayerAnimator.triggerNamed.
 */

import type { SkillElement } from "../game/combat/particles";
import { FIGHTERS, getActiveFighterId, type FighterDef } from "./fighters";

/** How an enemy AI using this profile should fight. */
export type BrainArchetype =
  | "brawler" // rush, short CD melee, low kite
  | "assassin" // high speed, hit-and-run, flanks
  | "skirmisher" // mid-range, kites at edge of attack range
  | "tank" // slow, high HP bias, short steps, heavy hits
  | "caster" // keeps distance, longer windups, ground zones
  | "support" // self-regen bias, cautious approach
  | "gunner"; // long range preferred, freezes to shoot

export interface AbilityDesign {
  id: string;
  name: string;
  /** Clip name fragments preferred for this ability. */
  anim: string[];
  element: SkillElement;
  /** Shape family for telegraphs / VFX. */
  shape: "cone" | "circle" | "nova" | "line" | "slash";
  /** Seconds between uses when AI-driven. */
  aiCooldown: number;
  /** Ideal distance to player when casting. */
  preferredRange: number;
  notes: string;
}

export interface CombatProfile {
  fighterId: string;
  brain: BrainArchetype;
  /** Signature aura color / element while in combat. */
  auraElement: SkillElement;
  /** Primary locomotion clips (suffix fragments). */
  locomotion: { idle: string[]; walk: string[]; run?: string[] };
  abilities: AbilityDesign[];
  /** Enemy roster: can this fighter appear as a hostile? */
  enemyReady: boolean;
  /** Visual proxy model id when skin GLB is too heavy for multi-spawn. */
  enemyVisualProxy: string;
  /** Difficulty tier as enemy (1–5). */
  enemyTier: number;
}

const P = (
  fighterId: string,
  brain: BrainArchetype,
  auraElement: SkillElement,
  enemyVisualProxy: string,
  enemyTier: number,
  abilities: AbilityDesign[],
  enemyReady = true,
): CombatProfile => ({
  fighterId,
  brain,
  auraElement,
  locomotion: {
    idle: ["_idle_a", "idle"],
    walk: ["_run", "walk", "run"],
    run: ["_run", "sprint"],
  },
  abilities,
  enemyReady,
  enemyVisualProxy,
  enemyTier,
});

function ab(
  id: string,
  name: string,
  anim: string[],
  element: SkillElement,
  shape: AbilityDesign["shape"],
  aiCooldown: number,
  preferredRange: number,
  notes: string,
): AbilityDesign {
  return { id, name, anim, element, shape, aiCooldown, preferredRange, notes };
}

/** Full combat design table for every roster fighter. */
export const COMBAT_PROFILES: CombatProfile[] = [
  P("nightmare_luffy", "brawler", "physical", "kit_skel_warrior", 3, [
    ab("pistol", "Gum-Gum Pistol", ["combo_a", "attack"], "physical", "cone", 1.4, 2.2, "Stretch punch — open with this"),
    ab("gatling", "Gum-Gum Gatling", ["combo_b", "combo_c"], "physical", "cone", 3.8, 2.5, "Multi-hit cone flurry"),
    ab("balloon", "Balloon Slam", ["skill_b", "boost"], "physical", "circle", 5.5, 3.5, "Ground slam after gap-close"),
    ab("jet", "Jet Stamp", ["skill_a", "jump"], "physical", "nova", 6.5, 3.0, "Leap nova — use when player clusters"),
    ab("bazooka", "Bazooka Wave", ["skill_a", "skill_b"], "physical", "slash", 8.5, 4.0, "Special slash wave"),
  ]),
  P("shanks", "skirmisher", "arcane", "mon_medusa", 4, [
    ab("haki", "Haki Slash", ["combo_a"], "physical", "slash", 1.6, 3.5, "Quick sword wave"),
    ab("kamusari", "Kamusari", ["combo_b", "skill_a"], "arcane", "slash", 4.2, 5.0, "Long horizontal cut"),
    ab("feint", "Observation Feint", ["dodge", "combo_a"], "physical", "cone", 3.5, 2.8, "Dodge then cut"),
    ab("aura", "Emperor Aura", ["skill_b", "boost"], "arcane", "circle", 7.0, 4.0, "Pressure zone"),
    ab("storm", "Red-Hair Storm", ["skill_a", "combo_c"], "physical", "nova", 9.5, 3.5, "Wide nova ultimate"),
  ], true),
  P("law", "caster", "lightning", "kit_skel_mage", 4, [
    ab("room", "ROOM", ["skill_b", "boost"], "arcane", "circle", 5.5, 7.0, "Place control circle first"),
    ab("shambles", "Shambles", ["combo_a", "skill_a"], "arcane", "cone", 3.8, 5.0, "Through-room strike"),
    ab("injection", "Injection", ["combo_b"], "physical", "line", 3.2, 6.0, "Piercing line"),
    ab("takt", "Takt", ["skill_b", "combo_c"], "physical", "circle", 6.5, 6.5, "Debris slam"),
    ab("gamma", "Gamma Knife", ["skill_a", "combo_c"], "lightning", "circle", 9.0, 5.5, "High burst point AoE"),
  ]),
  P("lucci", "assassin", "physical", "kit_skel_rogue", 4, [
    ab("shigan", "Shigan", ["combo_a"], "physical", "line", 2.0, 3.0, "Finger pistol poke"),
    ab("rankyaku", "Rankyaku", ["combo_b", "skill_a"], "physical", "slash", 3.6, 4.5, "Kick slash wave"),
    ab("geppo", "Geppo", ["jump", "combo_c"], "physical", "nova", 5.2, 3.5, "Air-step nova"),
    ab("tekkai", "Tekkai", ["boost", "skill_b"], "physical", "nova", 4.5, 2.0, "Counter explode when player close"),
    ab("leopard", "Life Return", ["skill_b", "combo_e"], "physical", "circle", 8.5, 2.8, "Beast form AoE"),
  ]),
  P("smoker", "tank", "physical", "mon_cultist", 3, [
    ab("whiteout", "White Out", ["skill_b", "boost"], "physical", "nova", 5.0, 3.5, "Smoke nova"),
    ab("jitte", "Jitte Slam", ["combo_b", "combo_c"], "physical", "cone", 3.5, 2.5, "Heavy melee cone"),
    ab("prison", "Smoke Prison", ["skill_a", "skill_b"], "arcane", "circle", 6.5, 4.0, "Trap circle"),
    ab("hunter", "White Hunter", ["skill_b", "combo_c"], "physical", "slash", 7.0, 5.0, "Chase wave"),
  ]),
  P("sanji_onigashima", "assassin", "fire", "kit_skel_rogue", 3, [
    ab("concasse", "Concasse", ["combo_a"], "physical", "cone", 1.8, 2.2, "Axe kick"),
    ab("diable", "Diable Jambe", ["skill_a", "combo_b"], "fire", "slash", 4.0, 3.5, "Fire kick wave"),
    ab("spectre", "Spectre", ["combo_c", "combo_b"], "fire", "cone", 5.0, 2.8, "Flurry cone"),
    ab("party", "Party Table", ["skill_b", "boost"], "fire", "circle", 6.0, 3.5, "Fire ring"),
    ab("ifrit", "Ifrit Jambe", ["skill_b", "skill_a"], "lightning", "nova", 9.0, 3.0, "Ultimate stomp"),
  ]),
  P("ryuma", "skirmisher", "arcane", "kit_skel_warrior", 4, [
    ab("iai", "Iai Draw", ["combo_a", "skill_a"], "physical", "slash", 1.6, 4.0, "Instant draw-cut"),
    ab("dragon", "Dragon Twister", ["skill_b", "boost"], "arcane", "circle", 6.0, 4.5, "Spiral ground AoE"),
    ab("moon", "Moonlit Step", ["dodge", "combo_a"], "physical", "cone", 3.2, 3.0, "Dash-cut"),
    ab("god", "Sword God Art", ["skill_a", "skill_b"], "arcane", "slash", 8.5, 6.0, "Massive slash wave"),
  ]),
  P("page_one", "tank", "physical", "mon_dante_beast", 4, [
    ab("bite", "Spino Bite", ["combo_a"], "physical", "cone", 2.2, 2.5, "Crushing bite"),
    ab("quake", "Tail Quake", ["skill_a", "combo_c"], "physical", "circle", 5.0, 3.5, "Ground slam"),
    ab("roar", "Predator Roar", ["skill_b", "boost"], "physical", "nova", 5.5, 4.0, "Intimidate nova"),
    ab("rampage", "Rampage", ["skill_b", "skill_a"], "physical", "nova", 9.0, 3.0, "Massive stomp"),
  ]),
  P("marco", "support", "fire", "kit_skel_mage", 3, [
    ab("blue", "Blue Burst", ["combo_a", "skill_a"], "fire", "cone", 2.2, 3.5, "Phoenix fire cone"),
    ab("regen", "Regeneration", ["boost", "skill_b"], "arcane", "nova", 8.0, 0, "Self heal — AI uses under 40% HP"),
    ab("talon", "Talon Dive", ["jump", "combo_b"], "fire", "circle", 5.0, 4.0, "Dive-bomb"),
    ab("storm", "Phoenix Storm", ["skill_b", "skill_a"], "fire", "nova", 9.0, 3.5, "Wide regenerative nova"),
  ]),
  P("shiryu", "assassin", "physical", "kit_skel_rogue", 4, [
    ab("vanish", "Clear Step", ["dodge", "combo_a"], "physical", "slash", 2.6, 3.5, "Invisible approach slash"),
    ab("ambush", "Ambush", ["skill_b", "combo_c"], "physical", "circle", 6.0, 4.5, "From nowhere AoE"),
    ab("blood", "Blood Mist", ["combo_c", "skill_a"], "poison", "cone", 4.2, 3.0, "Poison cone"),
    ab("exec", "Silent Execution", ["skill_a", "skill_b"], "physical", "slash", 9.0, 5.0, "Huge invisible slash"),
  ]),
  P("marine_mullet", "gunner", "fire", "kit_skel_mage", 2, [
    ab("bayonet", "Bayonet", ["combo_b"], "physical", "cone", 2.0, 2.5, "Melee when closed"),
    ab("smoke", "Smoke Bomb", ["combo_c", "boost"], "physical", "circle", 5.0, 5.0, "Disengage tool"),
    ab("salvo", "Salvo", ["combo_c", "combo_b"], "fire", "cone", 4.0, 7.0, "Multi-shot cone"),
    ab("cannon", "Ship Cannon", ["boost", "combo_c"], "fire", "circle", 8.0, 9.0, "Artillery blast"),
  ]),
  P("koby", "brawler", "lightning", "kit_skel_minion", 2, [
    ab("jab", "Marine Jab", ["0062", "combo"], "physical", "cone", 1.4, 2.0, "Basic punch"),
    ab("shock", "Fist Shock", ["0063", "0062"], "lightning", "circle", 5.0, 3.0, "Ground shock"),
    ab("rally", "Rally Cry", ["0011", "boost"], "arcane", "nova", 6.5, 0, "Self buff"),
    ab("rising", "Rising Star", ["0063", "0062_Low"], "physical", "nova", 7.0, 3.0, "Leap smash"),
  ]),
  P("ace_sabo_luffy", "skirmisher", "fire", "mon_cultist", 4, [
    ab("hiken", "Hiken", ["combo_a", "skill_a"], "fire", "cone", 2.5, 3.5, "Fire fist"),
    ab("rain", "Hiken Rain", ["skill_b", "combo_b"], "fire", "circle", 5.0, 5.0, "Fireball zone"),
    ab("wind", "Wind Blade", ["combo_b", "skill_a"], "lightning", "slash", 4.0, 5.0, "Sabo slash"),
    ab("barrage", "Gum Barrage", ["combo_c", "combo_a"], "physical", "cone", 3.2, 2.8, "Luffy punches"),
    ab("cross", "Crossfire", ["skill_b", "skill_a"], "fire", "nova", 10.0, 4.0, "Triple elemental nova"),
  ]),
  P(
    "racalvin",
    "tank",
    "arcane",
    "mon_dante_beast",
    5,
    [
      ab("cleave", "Corsair Cleave", ["attack", "slash", "combo"], "physical", "cone", 1.8, 2.8, "Wide blade cone"),
      ab("hammer", "Keeper's Hammer", ["hammer", "combo"], "physical", "circle", 5.0, 3.5, "Overhead smash"),
      ab("wave", "Tide Cut", ["combo", "attack"], "physical", "slash", 4.0, 5.0, "Horizontal wave"),
      ab("shout", "Warlord Shout", ["shout", "cast"], "arcane", "nova", 5.5, 4.0, "Intimidate"),
      ab("judgment", "Pirate Judgment", ["hammer", "punch"], "arcane", "nova", 10.0, 4.0, "Massive judgment"),
    ],
    true,
  ),
];

export const PROFILE_BY_ID = new Map(COMBAT_PROFILES.map((p) => [p.fighterId, p]));

export function getCombatProfile(fighterId: string | null | undefined): CombatProfile | undefined {
  if (!fighterId) return undefined;
  return PROFILE_BY_ID.get(fighterId);
}

export function getActiveCombatProfile(): CombatProfile {
  return (
    getCombatProfile(getActiveFighterId()) ??
    getCombatProfile("nightmare_luffy") ??
    COMBAT_PROFILES[0]!
  );
}

/** Fighters not currently selected — eligible for enemy/rival roster. */
export function getRivalFighterIds(activeId?: string | null): string[] {
  const active = activeId ?? getActiveFighterId() ?? "nightmare_luffy";
  return FIGHTERS.filter((f) => f.id !== active).map((f) => f.id);
}

/** AI movement / combat modifiers for brains. */
export interface BrainTuning {
  aggroMult: number;
  attackRangeMult: number;
  speedMult: number;
  /** Prefer backing off when closer than this fraction of attack range. */
  kiteBelow: number;
  /** Chance 0–1 to use special ability slot instead of basic melee. */
  specialBias: number;
}

export function brainTuning(brain: BrainArchetype): BrainTuning {
  switch (brain) {
    case "assassin":
      return { aggroMult: 1.25, attackRangeMult: 0.95, speedMult: 1.35, kiteBelow: 0.35, specialBias: 0.45 };
    case "skirmisher":
      return { aggroMult: 1.1, attackRangeMult: 1.35, speedMult: 1.15, kiteBelow: 0.55, specialBias: 0.4 };
    case "tank":
      return { aggroMult: 0.9, attackRangeMult: 1.05, speedMult: 0.75, kiteBelow: 0.15, specialBias: 0.3 };
    case "caster":
      return { aggroMult: 1.05, attackRangeMult: 1.6, speedMult: 0.95, kiteBelow: 0.7, specialBias: 0.55 };
    case "support":
      return { aggroMult: 0.85, attackRangeMult: 1.2, speedMult: 1.0, kiteBelow: 0.5, specialBias: 0.5 };
    case "gunner":
      return { aggroMult: 1.0, attackRangeMult: 1.8, speedMult: 0.9, kiteBelow: 0.75, specialBias: 0.5 };
    case "brawler":
    default:
      return { aggroMult: 1.15, attackRangeMult: 0.9, speedMult: 1.1, kiteBelow: 0.2, specialBias: 0.25 };
  }
}

export function fighterDisplayName(id: string): string {
  const f: FighterDef | undefined = FIGHTERS.find((x) => x.id === id);
  return f?.name ?? id;
}
