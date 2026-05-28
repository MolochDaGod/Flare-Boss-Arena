/**
 * @grudge/game-data — Canonical game data for all Grudge Warlords projects
 *
 * Import specific modules:
 *   import { raceDefinitions } from '@grudge/game-data/races';
 *   import { classDefinitions } from '@grudge/game-data/classes';
 *   import { calculateAttackDamage } from '@grudge/game-data/combat';
 *
 * Or import everything:
 *   import * as GameData from '@grudge/game-data';
 */

export { raceDefinitions, raceList, FACTIONS } from './races.js';
export { classDefinitions, CLASS_TIERS } from './classes.js';
export { calculateStats, TOTAL_POINTS_AT_LEVEL, POINTS_PER_LEVEL, calculateCombatPower, getBuildClassification } from './attributes.js';
export {
  EQUIPMENT_SLOTS, TIERS, WEAPON_TYPES, WEAPON_SKILLS,
  scaleStat, scaleItemStats, generateLoot, getEquipmentStatBonuses,
  getStartingEquipment, canClassEquip, upgradeItem, UPGRADE_COSTS,
  getItemPrice, getSellPrice, generateShopInventory, allEquipmentTemplates,
} from './equipment.js';
export { default as skillTrees } from './skillTrees.js';
export {
  getDefaultRow, getRowPositions, applyRowCombatModifiers,
  getAdjacentRows, getRowName, getAIRowPreference, isUnitRanged,
  PLAYER_ROWS, ENEMY_ROWS,
} from './battleRows.js';
export { FACTION_IDS, getFaction } from './factions.js';
export {
  calculateAttackDamage, chooseAIAction, tickBuffs, tickDoTs,
  calculateTurnOrder, calculateCombatPower as combatPower,
} from './combat.js';
export {
  OBJECTSTORE_BASE, getWeaponIcon, getArmorIcon, getClassSkillIcon,
  getNamedWeaponIcon, getMaterialIcon,
} from './objectStoreIcons.js';
