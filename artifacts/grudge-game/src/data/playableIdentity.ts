/**
 * Playable identity for Flare Boss Arena — derived from the in-game fighter roster,
 * not Warlords character creation / API records.
 */
import type { FighterDef } from "./fighters";
import { getActiveFighter } from "./fighters";
import { CLASS_STARTER_WEAPON } from "./starterGear";

/** Virtual character shape consumed by dungeon/camp/boss stat helpers. */
export interface PlayableCharacter {
  id: string;
  name: string;
  class: string;
  race: string;
  level: number;
  faction?: string;
  attributes: Record<string, number>;
  equipment: Record<string, string | undefined>;
}

const ROLE_CLASS: Record<string, string> = {
  "Corsair King": "warrior",
  "Rubber Brawler": "warrior",
  "Trio Vanguard": "warrior",
  Emperor: "warrior",
  Tactician: "mage",
  Assassin: "ranger",
  Warden: "warrior",
  Gunner: "ranger",
  Recruit: "warrior",
  "Marine Recruit": "warrior",
};

function fighterClass(fighter: FighterDef): string {
  return ROLE_CLASS[fighter.role] ?? "warrior";
}

function fighterAttributes(fighter: FighterDef): Record<string, number> {
  const s = fighter.stats;
  return {
    Strength: s.strength,
    Vitality: s.vitality,
    Dexterity: s.dexterity,
    Agility: s.agility,
    Endurance: s.endurance,
    Intellect: s.intellect,
    Tactics: s.tactics,
    Wisdom: s.wisdom,
  };
}

/** Build the active fighter as a virtual character record for 3D scenes + HUD. */
export function playableCharacterFromFighter(fighter: FighterDef): PlayableCharacter {
  const charClass = fighterClass(fighter);
  const mainHand = CLASS_STARTER_WEAPON[charClass]?.id ?? CLASS_STARTER_WEAPON.warrior.id;
  return {
    id: fighter.id,
    name: fighter.name,
    class: charClass,
    race: "human",
    level: 1,
    faction: "grudge-studio",
    attributes: fighterAttributes(fighter),
    equipment: { mainHand },
  };
}

/** Active fighter as the sole playable identity (no API / Soul Forge gate). */
export function getPlayableCharacter(): PlayableCharacter {
  return playableCharacterFromFighter(getActiveFighter());
}