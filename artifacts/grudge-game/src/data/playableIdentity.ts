/**
 * Playable identity for Flare Boss Arena — fighter roster only.
 * Independent of Warlords character creation / Soul Forge.
 */
import type { FighterDef } from "./fighters";
import { getActiveFighter } from "./fighters";
import { getGameLoadout } from "./gameCombat";

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

/** Build the active fighter as a virtual character for 3D scenes + HUD. */
export function playableCharacterFromFighter(fighter: FighterDef): PlayableCharacter {
  const loadout = getGameLoadout(fighter.id);
  return {
    id: fighter.id,
    name: fighter.name,
    // Class field kept for UI labels — maps to fighter role, not Warlords class trees.
    class: fighter.role.toLowerCase().replace(/\s+/g, "_"),
    race: "human",
    level: 1,
    faction: "flare-boss-arena",
    attributes: fighterAttributes(fighter),
    equipment: { mainHand: loadout.weapon.id },
  };
}

/** Active fighter as the sole playable identity. */
export function getPlayableCharacter(): PlayableCharacter {
  return playableCharacterFromFighter(getActiveFighter());
}
