/**
 * Playable identity for Flare Boss Arena — fighter roster only.
 * Level is account-persisted only when the fighter is owned via Flare Grudge Token.
 */
import type { FighterDef } from "./fighters";
import { getActiveFighter, SCOURGE_ID, JOHN_WAYNE_ID, RACALVIN_ID } from "./fighters";
import { getGameLoadout } from "./gameCombat";
import { getFighterLevel, isOwned } from "./flareEconomy";
import { parseAnnihilateHeroId } from "./annihilateHeroes";

/** Virtual character shape consumed by dungeon/camp/boss stat helpers. */
export interface PlayableCharacter {
  id: string;
  name: string;
  class: string;
  race: string;
  level: number;
  faction?: string;
  /** True when permanent unlock (token); false for weekly free test. */
  owned: boolean;
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

/**
 * Resolve race / class for HUD, traveler tutorial, and reticle.
 * - g6_{race}_{class} → Warlords race + class
 * - Racalvin crew → pirate race + combat role
 * - One Piece / default → human + role slug
 */
export function resolveFighterRaceClass(fighter: FighterDef): { race: string; classId: string } {
  const g6 = parseAnnihilateHeroId(fighter.id);
  if (g6) {
    return { race: g6.race, classId: g6.classId };
  }
  if (fighter.id === RACALVIN_ID) {
    return { race: "human", classId: "corsair_king" };
  }
  if (fighter.id === SCOURGE_ID) {
    return { race: "human", classId: "chain_tank" };
  }
  if (fighter.id === JOHN_WAYNE_ID) {
    return { race: "human", classId: "ranged_engineer" };
  }
  // Role label slug — feeds CombatCrosshair keyword matching (gunner, mage, …)
  return {
    race: "human",
    classId: fighter.role.toLowerCase().replace(/\s+/g, "_"),
  };
}

/** Build the active fighter as a virtual character for 3D scenes + HUD. */
export function playableCharacterFromFighter(fighter: FighterDef): PlayableCharacter {
  const loadout = getGameLoadout(fighter.id);
  const owned = isOwned(fighter.id);
  const { race, classId } = resolveFighterRaceClass(fighter);
  return {
    id: fighter.id,
    name: fighter.name,
    class: classId,
    race,
    // Level only from account if owned; weekly free / starter free always reads as 1.
    level: owned ? getFighterLevel(fighter.id) : 1,
    owned,
    faction: "flare-boss-arena",
    attributes: fighterAttributes(fighter),
    equipment: { mainHand: loadout.weapon.id },
  };
}

/** Active fighter as the sole playable identity. */
export function getPlayableCharacter(): PlayableCharacter {
  return playableCharacterFromFighter(getActiveFighter());
}
