/**
 * Playable identity for Flare Boss Arena — fighter roster only.
 * Level is account-persisted only when the fighter is owned via Flare Grudge Token.
 */
import type { FighterDef } from "./fighters";
import { getActiveFighter } from "./fighters";
import { getGameLoadout } from "./gameCombat";
import { getFighterLevel, isOwned } from "./flareEconomy";
import { getEquipmentLoadout } from "./equipmentLoadout";
import { getAttributeAllocations } from "./attributePoints";
import { ATTR_ORDER } from "./fighters";

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
  const spent = getAttributeAllocations(fighter.id);
  const label: Record<(typeof ATTR_ORDER)[number], string> = {
    strength: "Strength",
    vitality: "Vitality",
    dexterity: "Dexterity",
    agility: "Agility",
    endurance: "Endurance",
    intellect: "Intellect",
    tactics: "Tactics",
    wisdom: "Wisdom",
  };
  const out: Record<string, number> = {};
  for (const k of ATTR_ORDER) {
    out[label[k]] = (s[k] ?? 0) + (spent[k] ?? 0);
  }
  return out;
}

/** Build the active fighter as a virtual character for 3D scenes + HUD. */
export function playableCharacterFromFighter(fighter: FighterDef): PlayableCharacter {
  const loadout = getGameLoadout(fighter.id);
  const owned = isOwned(fighter.id);
  const gear = getEquipmentLoadout(fighter.id);
  const equipment: Record<string, string | undefined> = {
    mainHand: gear.Mainhand?.id ?? loadout.weapon.id,
    offHand: gear.Offhand?.id,
    helm: gear.Helm?.id,
    chest: gear.Chest?.id,
  };
  return {
    id: fighter.id,
    name: fighter.name,
    // Role label only — not a Warlords race/class creation choice.
    class: fighter.role.toLowerCase().replace(/\s+/g, "_"),
    race: "human",
    // Level only from account if owned; weekly free always reads as 1.
    level: owned ? getFighterLevel(fighter.id) : 1,
    owned,
    faction: "flare-boss-arena",
    attributes: fighterAttributes(fighter),
    equipment,
  };
}

/** Active fighter as the sole playable identity. */
export function getPlayableCharacter(): PlayableCharacter {
  return playableCharacterFromFighter(getActiveFighter());
}
