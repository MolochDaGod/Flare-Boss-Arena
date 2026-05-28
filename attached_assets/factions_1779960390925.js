/**
 * @grudge/game-data — Factions
 * The three warring factions of the Grudge Warlords universe.
 */

export const FACTIONS = {
  crusade: { name: 'Crusade', color: '#c9873b', description: 'The righteous alliance of Humans and Barbarians' },
  fabled:  { name: 'Fabled',  color: '#4ade80', description: 'The ancient covenant of Elves and Dwarves' },
  legion:  { name: 'Legion',  color: '#ef4444', description: 'The relentless horde of Orcs and Undead' },
};

export const FACTION_IDS = Object.keys(FACTIONS);

export function getFaction(raceId) {
  const RACE_FACTION = {
    human: 'crusade', barbarian: 'crusade',
    elf: 'fabled', dwarf: 'fabled',
    orc: 'legion', undead: 'legion',
  };
  return RACE_FACTION[raceId] || null;
}
