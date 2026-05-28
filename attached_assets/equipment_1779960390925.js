import { getWeaponIcon, getArmorIcon, OBJECTSTORE_BASE } from './objectStoreIcons.js';

export const EQUIPMENT_SLOTS = ['weapon', 'offhand', 'helmet', 'armor', 'feet', 'ring', 'relic'];

export const TIERS = {
  1: { name: 'Tier 1', color: '#9ca3af', multiplier: 1.0 },
  2: { name: 'Tier 2', color: '#22c55e', multiplier: 2.5 },
  3: { name: 'Tier 3', color: '#3b82f6', multiplier: 5.0 },
  4: { name: 'Tier 4', color: '#a855f7', multiplier: 8.5 },
  5: { name: 'Tier 5', color: '#f59e0b', multiplier: 13.0 },
  6: { name: 'Tier 6', color: '#ef4444', multiplier: 20.0 },
  7: { name: 'Tier 7', color: '#06b6d4', multiplier: 30.0 },
  8: { name: 'Tier 8', color: '#f472b6', multiplier: 45.0 },
};

export const TIER_FLAT_BONUS = {
  1: 0,
  2: 1,
  3: 3,
  4: 5,
  5: 8,
  6: 12,
  7: 18,
  8: 25,
};

export const DISPLAY_STAT_MAP = {
  physicalDamage: { label: 'Damage', color: '#ef4444', icon: 'sword' },
  magicDamage: { label: 'Damage', color: '#a855f7', icon: 'wand' },
  attackSpeed: { label: 'Speed', color: '#22c55e', icon: 'lightning' },
  criticalChance: { label: 'Crit', color: '#f59e0b', icon: 'target' },
  criticalDamage: { label: 'Combo', color: '#f472b6', icon: 'sparkle' },
  block: { label: 'Block', color: '#3b82f6', icon: 'shield' },
  defense: { label: 'Defense', color: '#06b6d4', icon: 'armor' },
  health: { label: 'Health', color: '#22c55e', icon: 'heart' },
  mana: { label: 'Mana', color: '#3b82f6', icon: 'crystal' },
  evasion: { label: 'Evasion', color: '#a3e635', icon: 'wind' },
  resistance: { label: 'Resist', color: '#c084fc', icon: 'shield' },
  armorPenetration: { label: 'Pen', color: '#fb923c', icon: 'lance' },
  drainHealth: { label: 'Drain', color: '#dc2626', icon: 'skull' },
  damageReduction: { label: 'DR', color: '#64748b', icon: 'shield' },
  manaRegen: { label: 'MP Regen', color: '#60a5fa', icon: 'crystal' },
  healthRegen: { label: 'HP Regen', color: '#4ade80', icon: 'heart' },
  cooldownReduction: { label: 'CDR', color: '#c084fc', icon: 'sparkle' },
  stamina: { label: 'Stamina', color: '#fbbf24', icon: 'energy' },
};

const PRIMARY_STATS = new Set([
  'physicalDamage', 'magicDamage', 'health', 'mana', 'stamina', 'defense',
]);

export function scaleStat(baseStat, tier, statKey) {
  const mult = TIERS[tier]?.multiplier || 1;
  const flat = TIER_FLAT_BONUS[tier] || 0;
  const isPrimary = !statKey || PRIMARY_STATS.has(statKey);
  const effectiveFlat = isPrimary ? flat : Math.round(flat * 0.15);
  return Math.round((baseStat * mult + effectiveFlat) * 10) / 10;
}

export function scaleItemStats(templateStats, tier) {
  const scaled = {};
  Object.entries(templateStats).forEach(([key, val]) => {
    scaled[key] = scaleStat(val, tier, key);
  });
  return scaled;
}

export const UPGRADE_COSTS = { 1: 100, 2: 250, 3: 500, 4: 1000, 5: 2500, 6: 5000, 7: 10000 };

export const WEAPON_TYPES = {
  sword:      { name: 'Sword',      icon: 'sword',          iconUrl: getWeaponIcon('sword'),      hand: '1h' },
  axe:        { name: 'Axe',        icon: 'axe',            iconUrl: getWeaponIcon('axe'),        hand: '1h' },
  greatsword: { name: 'Greatsword', icon: 'crossed_swords', iconUrl: getWeaponIcon('greatsword'), hand: '2h' },
  greataxe:   { name: 'Greataxe',   icon: 'axe',            iconUrl: getWeaponIcon('greataxe'),   hand: '2h' },
  hammer2h:   { name: 'Warhammer',  icon: 'hammer',         iconUrl: getWeaponIcon('hammer2h'),   hand: '2h' },
  hammer1h:   { name: 'Hammer',     icon: 'hammer',         iconUrl: getWeaponIcon('hammer1h'),   hand: '1h' },
  shield:     { name: 'Shield',     icon: 'shield',         iconUrl: getWeaponIcon('shield'),     hand: '1h' },
  staff:      { name: 'Staff',      icon: 'wand',           iconUrl: getWeaponIcon('staff'),      hand: '2h' },
  dagger:     { name: 'Dagger',     icon: 'sword',          iconUrl: getWeaponIcon('dagger'),     hand: '1h' },
  bow:        { name: 'Bow',        icon: 'bow',            iconUrl: getWeaponIcon('bow'),        hand: '2h' },
  crossbow:   { name: 'Crossbow',   icon: 'bow',            iconUrl: getWeaponIcon('crossbow'),   hand: '2h' },
  gun:        { name: 'Gun',        icon: 'star',           iconUrl: getWeaponIcon('gun'),        hand: '2h' },
  lance:      { name: 'Lance',      icon: 'lance',          iconUrl: getWeaponIcon('lance'),      hand: '2h' },
  tome:       { name: 'Tome',       icon: 'book',           iconUrl: getWeaponIcon('tome'),       hand: '1h' },
  relic:      { name: 'Relic',      icon: 'crystal',        iconUrl: getWeaponIcon('relic'),      hand: '1h' },
};

export const WEAPON_SKILLS = {
  sword: {
    slot1: [
      { id: 'ws_sword_slash', name: 'Sword Slash', icon: 'crossed_swords', description: 'A swift horizontal slash that restores resources', type: 'physical', damage: 0.9, manaCost: 0, staminaCost: 0, cooldown: 0, target: 'enemy', manaGain: 5, staminaGain: 8 },
      { id: 'ws_sword_thrust', name: 'Sword Thrust', icon: 'sword', description: 'A piercing thrust aimed at vital points', type: 'physical', damage: 1.0, manaCost: 0, staminaCost: 0, cooldown: 0, target: 'enemy', manaGain: 4, staminaGain: 9 },
    ],
    slot23: [
      { id: 'ws_riposte', name: 'Riposte', icon: 'crossed_swords', description: 'Counter with a precise strike dealing 1.6x damage', type: 'physical', damage: 1.6, manaCost: 0, staminaCost: 18, cooldown: 2, target: 'enemy' },
      { id: 'ws_blade_dance', name: 'Blade Dance', icon: 'sparkle', description: 'Rapid slashes that boost attack speed for 2 turns', type: 'physical', damage: 1.2, manaCost: 0, staminaCost: 20, cooldown: 3, target: 'enemy', effect: { stat: 'attackSpeed', flat: 15, duration: 2 } },
      { id: 'ws_mortal_wound', name: 'Mortal Wound', icon: 'target', description: 'A deep cut causing bleed for 3 turns', type: 'physical', damage: 1.3, manaCost: 0, staminaCost: 22, cooldown: 3, target: 'enemy', effect: { type: 'dot', damage: 0.12, duration: 3 } },
    ],
  },
  axe: {
    slot1: [
      { id: 'ws_axe_chop', name: 'Axe Chop', icon: 'axe', description: 'A brutal downward chop restoring resources', type: 'physical', damage: 1.0, manaCost: 0, staminaCost: 0, cooldown: 0, target: 'enemy', manaGain: 4, staminaGain: 9 },
      { id: 'ws_axe_hack', name: 'Hack', icon: 'axe', description: 'A savage hack at the enemy', type: 'physical', damage: 1.1, manaCost: 0, staminaCost: 0, cooldown: 0, target: 'enemy', manaGain: 5, staminaGain: 7 },
    ],
    slot23: [
      { id: 'ws_rend', name: 'Rend', icon: 'target', description: 'Rip into the enemy causing heavy bleed for 3 turns', type: 'physical', damage: 1.4, manaCost: 0, staminaCost: 20, cooldown: 3, target: 'enemy', effect: { type: 'dot', damage: 0.15, duration: 3 } },
      { id: 'ws_whirlwind', name: 'Whirlwind', icon: 'chaos', description: 'Spin your axe hitting all enemies', type: 'physical', damage: 1.8, manaCost: 0, staminaCost: 25, cooldown: 3, target: 'enemy', isAoE: true },
      { id: 'ws_sunder_armor', name: 'Sunder Armor', icon: 'bomb', description: 'Smash through defenses, reducing enemy damage for 2 turns', type: 'physical', damage: 1.2, manaCost: 0, staminaCost: 18, cooldown: 3, target: 'enemy', effect: { stat: 'damage', multiplier: 0.7, duration: 2 } },
    ],
  },
  greatsword: {
    slot1: [
      { id: 'ws_gs_sweep', name: 'Great Sweep', icon: 'crossed_swords', description: 'A wide sweeping strike that restores resources', type: 'physical', damage: 1.1, manaCost: 0, staminaCost: 0, cooldown: 0, target: 'enemy', manaGain: 5, staminaGain: 8 },
      { id: 'ws_gs_overhead', name: 'Overhead Slash', icon: 'crossed_swords', description: 'A powerful overhead swing', type: 'physical', damage: 1.2, manaCost: 0, staminaCost: 0, cooldown: 0, target: 'enemy', manaGain: 6, staminaGain: 7 },
    ],
    slot23: [
      { id: 'ws_gs_cleave', name: 'Greatsword Cleave', icon: 'bomb', description: 'Massive cleaving strike hitting all enemies', type: 'physical', damage: 2.0, manaCost: 0, staminaCost: 25, cooldown: 2, target: 'enemy', isAoE: true },
      { id: 'ws_gs_whirlwind', name: 'Steel Tempest', icon: 'chaos', description: 'Spin with your greatsword hitting all enemies', type: 'physical', damage: 1.7, manaCost: 0, staminaCost: 22, cooldown: 3, target: 'enemy', isAoE: true },
      { id: 'ws_gs_execute', name: 'Decapitate', icon: 'skull', description: 'Aim for the neck, dealing bonus damage to low HP targets', type: 'physical', damage: 1.5, manaCost: 0, staminaCost: 28, cooldown: 4, target: 'enemy', executeDamage: 2.5, executeThreshold: 0.3 },
    ],
  },
  greataxe: {
    slot1: [
      { id: 'ws_ga_slam', name: 'Greataxe Slam', icon: 'axe', description: 'Slam your greataxe down with fury', type: 'physical', damage: 1.2, manaCost: 0, staminaCost: 0, cooldown: 0, target: 'enemy', manaGain: 4, staminaGain: 9 },
      { id: 'ws_ga_swing', name: 'Wild Swing', icon: 'axe', description: 'A heavy arcing swing', type: 'physical', damage: 1.1, manaCost: 0, staminaCost: 0, cooldown: 0, target: 'enemy', manaGain: 5, staminaGain: 8 },
    ],
    slot23: [
      { id: 'ws_ga_rampage', name: 'Rampage', icon: 'bomb', description: 'Enter a frenzy, boosting damage by 25% for 3 turns', type: 'buff', damage: 0, manaCost: 0, staminaCost: 28, cooldown: 5, target: 'self', effect: { stat: 'damage', multiplier: 1.25, duration: 3 } },
      { id: 'ws_ga_bonecrusher', name: 'Bonecrusher', icon: 'skull', description: 'Crush the enemy with overwhelming force', type: 'physical', damage: 2.2, manaCost: 0, staminaCost: 30, cooldown: 3, target: 'enemy' },
      { id: 'ws_ga_bloodrage', name: 'Bloodrage', icon: 'target', description: 'Sacrifice HP for massive damage', type: 'physical', damage: 2.5, manaCost: 0, staminaCost: 20, cooldown: 4, target: 'enemy' },
    ],
  },
  hammer2h: {
    slot1: [
      { id: 'ws_h2_smash', name: 'Hammer Smash', icon: 'hammer', description: 'A thunderous downward smash', type: 'physical', damage: 1.1, manaCost: 0, staminaCost: 0, cooldown: 0, target: 'enemy', manaGain: 4, staminaGain: 9 },
      { id: 'ws_h2_bash', name: 'Hammer Bash', icon: 'hammer', description: 'Bash with the flat of the hammer', type: 'physical', damage: 1.0, manaCost: 0, staminaCost: 0, cooldown: 0, target: 'enemy', manaGain: 5, staminaGain: 8 },
    ],
    slot23: [
      { id: 'ws_h2_shockwave', name: 'Shockwave', icon: 'bomb', description: 'Slam the ground sending a shockwave hitting all enemies', type: 'physical', damage: 1.8, manaCost: 0, staminaCost: 25, cooldown: 3, target: 'enemy', isAoE: true, effect: { type: 'stun', duration: 1 } },
      { id: 'ws_h2_pulverize', name: 'Pulverize', icon: 'skull', description: 'Crush the target with immense force', type: 'physical', damage: 2.3, manaCost: 0, staminaCost: 30, cooldown: 4, target: 'enemy' },
      { id: 'ws_h2_earthshatter', name: 'Earthshatter', icon: 'fire', description: 'Shatter the earth hitting all enemies and reducing defense for 3 turns', type: 'physical', damage: 1.5, manaCost: 0, staminaCost: 22, cooldown: 3, target: 'enemy', isAoE: true, effect: { stat: 'defense', flat: -15, duration: 3 } },
    ],
  },
  hammer1h: {
    slot1: [
      { id: 'ws_h1_strike', name: 'Mace Strike', icon: 'hammer', description: 'A storm-charged mace blow restoring resources', type: 'physical', damage: 1.0, manaCost: 0, staminaCost: 0, cooldown: 0, target: 'enemy', manaGain: 6, staminaGain: 6 },
      { id: 'ws_h1_crack', name: 'Skull Crack', icon: 'hammer', description: 'Crack your mace against the enemy', type: 'physical', damage: 1.1, manaCost: 0, staminaCost: 0, cooldown: 0, target: 'enemy', manaGain: 5, staminaGain: 7 },
    ],
    slot23: [
      { id: 'ws_h1_concuss', name: 'Concussive Blow', icon: 'sparkle', description: 'Stun the target with a precise strike', type: 'physical', damage: 1.2, manaCost: 0, staminaCost: 18, cooldown: 3, target: 'enemy', effect: { type: 'stun', duration: 1 } },
      { id: 'ws_h1_chain_smash', name: 'Chain Smash', icon: 'battle', description: 'Rapid mace strikes building momentum', type: 'physical', damage: 1.6, manaCost: 0, staminaCost: 20, cooldown: 2, target: 'enemy' },
      { id: 'ws_h1_thunderstrike', name: 'Thunderstrike', icon: 'lightning', description: 'Channel storm energy through your mace', type: 'magical', damage: 1.8, manaCost: 20, staminaCost: 0, cooldown: 3, target: 'enemy', effect: { type: 'dot', damage: 0.1, duration: 2 } },
    ],
  },
  staff: {
    slot1: [
      { id: 'ws_staff_strike', name: 'Staff Strike', icon: 'wand', description: 'Channel arcane energy through your staff', type: 'magical', damage: 1.0, manaCost: 0, staminaCost: 0, cooldown: 0, target: 'enemy', manaGain: 8, staminaGain: 4 },
      { id: 'ws_staff_pulse', name: 'Arcane Pulse', icon: 'sparkle', description: 'Emit a pulse of raw magic', type: 'magical', damage: 0.9, manaCost: 0, staminaCost: 0, cooldown: 0, target: 'enemy', manaGain: 9, staminaGain: 3 },
    ],
    slot23: [
      { id: 'ws_staff_nova', name: 'Arcane Nova', icon: 'sparkle', description: 'Release a burst of arcane energy hitting all enemies', type: 'magical', damage: 2.0, manaCost: 30, staminaCost: 0, cooldown: 3, target: 'enemy', isAoE: true },
      { id: 'ws_staff_barrier', name: 'Arcane Barrier', icon: 'shield', description: 'Raise a magical barrier boosting defense for 3 turns', type: 'buff', damage: 0, manaCost: 25, staminaCost: 0, cooldown: 4, target: 'self', effect: { stat: 'defense', flat: 18, duration: 3 } },
      { id: 'ws_staff_drain', name: 'Spirit Drain', icon: 'chaos', description: 'Drain life force from the target', type: 'magical', damage: 1.4, manaCost: 20, staminaCost: 0, cooldown: 3, target: 'enemy', drainPercent: 0.15 },
    ],
  },
  dagger: {
    slot1: [
      { id: 'ws_dagger_stab', name: 'Quick Stab', icon: 'sword', description: 'A quick dagger stab restoring resources', type: 'physical', damage: 0.8, manaCost: 0, staminaCost: 0, cooldown: 0, target: 'enemy', manaGain: 5, staminaGain: 8 },
      { id: 'ws_dagger_slash', name: 'Dagger Slash', icon: 'sword', description: 'A swift slash across the target', type: 'physical', damage: 0.9, manaCost: 0, staminaCost: 0, cooldown: 0, target: 'enemy', manaGain: 4, staminaGain: 9 },
    ],
    slot23: [
      { id: 'ws_backstab', name: 'Backstab', icon: 'sword', description: 'Strike from the shadows for critical damage', type: 'physical', damage: 2.0, manaCost: 0, staminaCost: 22, cooldown: 3, target: 'enemy', guaranteedCrit: true },
      { id: 'ws_envenom', name: 'Envenom', icon: 'skull', description: 'Apply deadly poison dealing damage over 4 turns', type: 'physical', damage: 0.8, manaCost: 0, staminaCost: 15, cooldown: 3, target: 'enemy', effect: { type: 'dot', damage: 0.18, duration: 4 } },
      { id: 'ws_fan_of_knives', name: 'Fan of Knives', icon: 'star', description: 'Hurl a fan of knives hitting all enemies', type: 'physical', damage: 1.7, manaCost: 0, staminaCost: 20, cooldown: 3, target: 'enemy', isAoE: true },
    ],
  },
  bow: {
    slot1: [
      { id: 'ws_bow_shot', name: 'Quick Shot', icon: 'bow', description: 'A swift arrow restoring resources', type: 'physical', damage: 0.8, manaCost: 0, staminaCost: 0, cooldown: 0, target: 'enemy', manaGain: 4, staminaGain: 7 },
      { id: 'ws_bow_aim', name: 'Steady Shot', icon: 'target', description: 'A carefully aimed arrow', type: 'physical', damage: 1.0, manaCost: 0, staminaCost: 0, cooldown: 0, target: 'enemy', manaGain: 5, staminaGain: 6 },
    ],
    slot23: [
      { id: 'ws_bow_volley', name: 'Arrow Volley', icon: 'bow', description: 'Rain arrows on all enemies', type: 'physical', damage: 2.2, manaCost: 0, staminaCost: 25, cooldown: 3, target: 'enemy', isAoE: true },
      { id: 'ws_bow_pierce', name: 'Piercing Arrow', icon: 'lance', description: 'Fire an armor-piercing arrow', type: 'physical', damage: 1.8, manaCost: 0, staminaCost: 20, cooldown: 3, target: 'enemy', armorPiercing: true },
      { id: 'ws_bow_poison', name: 'Poison Arrow', icon: 'skull', description: 'Arrow tipped with deadly venom', type: 'physical', damage: 0.9, manaCost: 0, staminaCost: 15, cooldown: 3, target: 'enemy', effect: { type: 'dot', damage: 0.15, duration: 3 } },
    ],
  },
  crossbow: {
    slot1: [
      { id: 'ws_xbow_bolt', name: 'Bolt Shot', icon: 'bow', description: 'Fire a heavy crossbow bolt', type: 'physical', damage: 1.0, manaCost: 0, staminaCost: 0, cooldown: 0, target: 'enemy', manaGain: 3, staminaGain: 8 },
      { id: 'ws_xbow_snap', name: 'Snap Shot', icon: 'bow', description: 'A quick follow-up shot', type: 'physical', damage: 0.9, manaCost: 0, staminaCost: 0, cooldown: 0, target: 'enemy', manaGain: 5, staminaGain: 7 },
    ],
    slot23: [
      { id: 'ws_xbow_heavy', name: 'Heavy Bolt', icon: 'bomb', description: 'Fire a heavy bolt that staggers the target', type: 'physical', damage: 2.0, manaCost: 0, staminaCost: 22, cooldown: 3, target: 'enemy', effect: { stat: 'damage', multiplier: 0.8, duration: 1 } },
      { id: 'ws_xbow_explosive', name: 'Explosive Bolt', icon: 'bomb', description: 'Fire an explosive bolt that damages all enemies', type: 'physical', damage: 2.4, manaCost: 0, staminaCost: 28, cooldown: 4, target: 'enemy', isAoE: true },
      { id: 'ws_xbow_net', name: 'Net Bolt', icon: 'target', description: 'Fire a net bolt that stuns for 1 turn', type: 'physical', damage: 0.8, manaCost: 0, staminaCost: 15, cooldown: 4, target: 'enemy', effect: { type: 'stun', duration: 1 } },
    ],
  },
  gun: {
    slot1: [
      { id: 'ws_gun_shot', name: 'Gunshot', icon: 'star', description: 'Fire a round at the target', type: 'physical', damage: 1.1, manaCost: 0, staminaCost: 0, cooldown: 0, target: 'enemy', manaGain: 3, staminaGain: 8 },
      { id: 'ws_gun_hip', name: 'Hip Fire', icon: 'star', description: 'Quick shot from the hip', type: 'physical', damage: 0.9, manaCost: 0, staminaCost: 0, cooldown: 0, target: 'enemy', manaGain: 5, staminaGain: 7 },
    ],
    slot23: [
      { id: 'ws_gun_sniper', name: 'Sniper Round', icon: 'target', description: 'A carefully aimed shot that always crits', type: 'physical', damage: 2.0, manaCost: 0, staminaCost: 22, cooldown: 3, target: 'enemy', guaranteedCrit: true },
      { id: 'ws_gun_buckshot', name: 'Buckshot', icon: 'bomb', description: 'Blast scattered shot hitting all enemies', type: 'physical', damage: 2.2, manaCost: 0, staminaCost: 25, cooldown: 3, target: 'enemy', isAoE: true },
      { id: 'ws_gun_suppressive', name: 'Suppressive Fire', icon: 'fire', description: 'Lay down fire on all enemies, reducing damage for 2 turns', type: 'physical', damage: 1.0, manaCost: 0, staminaCost: 20, cooldown: 4, target: 'enemy', isAoE: true, effect: { stat: 'damage', multiplier: 0.65, duration: 2 } },
    ],
  },
  lance: {
    slot1: [
      { id: 'ws_lance_thrust', name: 'Lance Thrust', icon: 'lance', description: 'Thrust your lance with precision', type: 'physical', damage: 1.0, manaCost: 0, staminaCost: 0, cooldown: 0, target: 'enemy', manaGain: 4, staminaGain: 8 },
      { id: 'ws_lance_jab', name: 'Quick Jab', icon: 'lance', description: 'A rapid lance jab', type: 'physical', damage: 0.9, manaCost: 0, staminaCost: 0, cooldown: 0, target: 'enemy', manaGain: 5, staminaGain: 7 },
    ],
    slot23: [
      { id: 'ws_lance_charge', name: 'Lance Charge', icon: 'energy', description: 'Charge forward with devastating force', type: 'physical', damage: 2.2, manaCost: 0, staminaCost: 25, cooldown: 3, target: 'enemy' },
      { id: 'ws_lance_impale', name: 'Impale', icon: 'skull', description: 'Impale the target causing bleed for 3 turns', type: 'physical', damage: 1.5, manaCost: 0, staminaCost: 20, cooldown: 3, target: 'enemy', effect: { type: 'dot', damage: 0.14, duration: 3 } },
      { id: 'ws_lance_sweep', name: 'Sweeping Strike', icon: 'chaos', description: 'Sweep your lance hitting all enemies', type: 'physical', damage: 1.8, manaCost: 0, staminaCost: 22, cooldown: 3, target: 'enemy', isAoE: true },
    ],
  },
  tome: {
    slot1: [
      { id: 'ws_tome_bolt', name: 'Arcane Bolt', icon: 'sparkle', description: 'Channel a bolt of arcane energy from your tome', type: 'magical', damage: 1.0, manaCost: 0, staminaCost: 0, cooldown: 0, target: 'enemy', manaGain: 9, staminaGain: 3 },
      { id: 'ws_tome_blast', name: 'Eldritch Blast', icon: 'crystal', description: 'Unleash eldritch power from ancient pages', type: 'magical', damage: 0.9, manaCost: 0, staminaCost: 0, cooldown: 0, target: 'enemy', manaGain: 8, staminaGain: 4 },
    ],
    slot23: [
      { id: 'ws_tome_curse', name: 'Curse', icon: 'skull', description: 'Curse the target reducing their damage for 3 turns', type: 'magical', damage: 1.0, manaCost: 25, staminaCost: 0, cooldown: 3, target: 'enemy', effect: { stat: 'damage', multiplier: 0.65, duration: 3 } },
      { id: 'ws_tome_hex', name: 'Hex', icon: 'chaos', description: 'Hex the enemy with dark magic', type: 'magical', damage: 1.8, manaCost: 30, staminaCost: 0, cooldown: 3, target: 'enemy', effect: { type: 'dot', damage: 0.12, duration: 3 } },
      { id: 'ws_tome_restore', name: 'Tome of Restoration', icon: 'heart', description: 'Read a healing incantation restoring 20% HP', type: 'heal', damage: 0, manaCost: 30, staminaCost: 0, cooldown: 4, target: 'self', healPercent: 0.20 },
    ],
  },
};

export const ARMOR_TYPES = {
  cloth: { name: 'Cloth', icon: 'armor' },
  leather: { name: 'Leather', icon: 'armor' },
  metal: { name: 'Metal', icon: 'shield' },
};

export const HELMET_TYPES = {
  plate: { name: 'Plate Helm', icon: 'helm' },
  leather: { name: 'Leather Hood', icon: 'helm' },
  cloth: { name: 'Cloth Crown', icon: 'crown' },
};

export const FEET_TYPES = {
  plate: { name: 'Plate Greaves', icon: 'boots' },
  leather: { name: 'Leather Boots', icon: 'boots' },
  cloth: { name: 'Cloth Sandals', icon: 'boots' },
};

export const CLASS_EQUIPMENT_RULES = {
  warrior: {
    weaponTypes: ['sword', 'axe', 'greatsword', 'greataxe', 'hammer2h'],
    offhandTypes: ['shield'],
    armorTypes: ['metal'],
    helmetTypes: ['plate'],
    feetTypes: ['plate'],
  },
  worge: {
    weaponTypes: ['hammer1h', 'staff', 'dagger'],
    offhandTypes: [],
    armorTypes: ['leather', 'cloth'],
    helmetTypes: ['leather', 'cloth'],
    feetTypes: ['leather'],
  },
  ranger: {
    weaponTypes: ['bow', 'crossbow', 'gun', 'dagger', 'lance'],
    offhandTypes: [],
    armorTypes: ['leather', 'metal'],
    helmetTypes: ['leather', 'plate'],
    feetTypes: ['leather', 'plate'],
  },
  mage: {
    weaponTypes: ['staff', 'tome'],
    offhandTypes: ['relic'],
    armorTypes: ['cloth'],
    helmetTypes: ['cloth'],
    feetTypes: ['cloth'],
  },
};

const weaponTemplates = [
  { id: 'bloodfeud_blade', name: 'Bloodfeud Blade', slot: 'weapon', weaponType: 'sword', icon: 'sword', classReq: ['warrior'], stats: { physicalDamage: 6, criticalChance: 3, block: 2 } },
  { id: 'wraithfang', name: 'Wraithfang', slot: 'weapon', weaponType: 'sword', icon: 'sword', classReq: ['warrior'], stats: { physicalDamage: 7, criticalChance: 5, drainHealth: 2 } },
  { id: 'oathbreaker', name: 'Oathbreaker', slot: 'weapon', weaponType: 'sword', icon: 'sword', classReq: ['warrior'], stats: { physicalDamage: 5, block: 4, defense: 3 } },
  { id: 'kinrend', name: 'Kinrend', slot: 'weapon', weaponType: 'sword', icon: 'sword', classReq: ['warrior'], stats: { physicalDamage: 6, criticalChance: 4, attackSpeed: 3 } },
  { id: 'dusksinger', name: 'Dusksinger', slot: 'weapon', weaponType: 'sword', icon: 'sword', classReq: ['warrior'], stats: { physicalDamage: 6, criticalChance: 6, criticalDamage: 5 } },
  { id: 'emberclad', name: 'Emberclad', slot: 'weapon', weaponType: 'sword', icon: 'sword', classReq: ['warrior'], stats: { physicalDamage: 7, criticalChance: 4, block: 3 } },

  { id: 'gorehowl', name: 'Gorehowl', slot: 'weapon', weaponType: 'axe', icon: 'axe', classReq: ['warrior'], stats: { physicalDamage: 8, criticalDamage: 6 } },
  { id: 'skullsplitter', name: 'Skullsplitter', slot: 'weapon', weaponType: 'axe', icon: 'axe', classReq: ['warrior'], stats: { physicalDamage: 8, criticalDamage: 4, armorPenetration: 2 } },
  { id: 'veinreaver', name: 'Veinreaver', slot: 'weapon', weaponType: 'axe', icon: 'axe', classReq: ['warrior'], stats: { physicalDamage: 7, criticalDamage: 5, drainHealth: 2 } },
  { id: 'ironmaw', name: 'Ironmaw', slot: 'weapon', weaponType: 'axe', icon: 'axe', classReq: ['warrior'], stats: { physicalDamage: 8, block: 3, defense: 3 } },
  { id: 'dreadcleaver', name: 'Dreadcleaver', slot: 'weapon', weaponType: 'axe', icon: 'axe', classReq: ['warrior'], stats: { physicalDamage: 7, criticalDamage: 5, attackSpeed: 3 } },
  { id: 'bonehew', name: 'Bonehew', slot: 'weapon', weaponType: 'axe', icon: 'axe', classReq: ['warrior'], stats: { physicalDamage: 9, block: 4, defense: 2 } },

  { id: 'nightfang', name: 'Nightfang', slot: 'weapon', weaponType: 'dagger', icon: 'dagger', classReq: ['worge', 'ranger'], stats: { physicalDamage: 5, criticalChance: 8, drainHealth: 2 } },
  { id: 'bloodshiv', name: 'Bloodshiv', slot: 'weapon', weaponType: 'dagger', icon: 'dagger', classReq: ['worge', 'ranger'], stats: { physicalDamage: 5, criticalChance: 9, attackSpeed: 3 } },
  { id: 'wraithclaw', name: 'Wraithclaw', slot: 'weapon', weaponType: 'dagger', icon: 'dagger', classReq: ['worge', 'ranger'], stats: { physicalDamage: 4, criticalChance: 10, evasion: 3 } },
  { id: 'emberfang', name: 'Emberfang', slot: 'weapon', weaponType: 'dagger', icon: 'dagger', classReq: ['worge', 'ranger'], stats: { physicalDamage: 5, criticalChance: 7, magicDamage: 2 } },
  { id: 'ironspike', name: 'Ironspike', slot: 'weapon', weaponType: 'dagger', icon: 'dagger', classReq: ['worge', 'ranger'], stats: { physicalDamage: 4, criticalChance: 6, block: 3, defense: 2 } },
  { id: 'duskblade', name: 'Duskblade', slot: 'weapon', weaponType: 'dagger', icon: 'dagger', classReq: ['worge', 'ranger'], stats: { physicalDamage: 5, criticalChance: 11, criticalDamage: 8 } },

  { id: 'skullsunder', name: 'Skullsunder', slot: 'weapon', weaponType: 'greataxe', icon: 'axe', classReq: ['warrior'], stats: { physicalDamage: 12, criticalDamage: 8, armorPenetration: 3 } },
  { id: 'bloodreaver_ga', name: 'Bloodreaver', slot: 'weapon', weaponType: 'greataxe', icon: 'axe', classReq: ['warrior'], stats: { physicalDamage: 13, criticalDamage: 6, drainHealth: 3 } },
  { id: 'wraithhew', name: 'Wraithhew', slot: 'weapon', weaponType: 'greataxe', icon: 'axe', classReq: ['warrior'], stats: { physicalDamage: 11, criticalDamage: 7, attackSpeed: 3 } },
  { id: 'embermaul', name: 'Embermaul', slot: 'weapon', weaponType: 'greataxe', icon: 'axe', classReq: ['warrior'], stats: { physicalDamage: 12, criticalDamage: 6, magicDamage: 3 } },
  { id: 'ironrend', name: 'Ironrend', slot: 'weapon', weaponType: 'greataxe', icon: 'axe', classReq: ['warrior'], stats: { physicalDamage: 13, block: 4, defense: 4 } },
  { id: 'dusksplitter', name: 'Dusksplitter', slot: 'weapon', weaponType: 'greataxe', icon: 'axe', classReq: ['warrior'], stats: { physicalDamage: 11, criticalDamage: 9, criticalChance: 4 } },

  { id: 'doomspire', name: 'Doomspire', slot: 'weapon', weaponType: 'greatsword', icon: 'crossed_swords', classReq: ['warrior'], stats: { physicalDamage: 11, criticalChance: 4, armorPenetration: 3 } },
  { id: 'bloodspire', name: 'Bloodspire', slot: 'weapon', weaponType: 'greatsword', icon: 'crossed_swords', classReq: ['warrior'], stats: { physicalDamage: 12, drainHealth: 3, defense: 3 } },
  { id: 'wraithblade_gs', name: 'Wraithblade', slot: 'weapon', weaponType: 'greatsword', icon: 'crossed_swords', classReq: ['warrior'], stats: { physicalDamage: 10, criticalChance: 5, criticalDamage: 8 } },
  { id: 'emberbrand', name: 'Emberbrand', slot: 'weapon', weaponType: 'greatsword', icon: 'crossed_swords', classReq: ['warrior'], stats: { physicalDamage: 11, magicDamage: 3, criticalChance: 4 } },
  { id: 'ironwrath', name: 'Ironwrath', slot: 'weapon', weaponType: 'greatsword', icon: 'crossed_swords', classReq: ['warrior'], stats: { physicalDamage: 12, block: 5, defense: 4 } },
  { id: 'duskreaver_gs', name: 'Duskreaver', slot: 'weapon', weaponType: 'greatsword', icon: 'crossed_swords', classReq: ['warrior'], stats: { physicalDamage: 10, criticalChance: 6, attackSpeed: 4 } },

  { id: 'titanmaul', name: 'Titanmaul', slot: 'weapon', weaponType: 'hammer2h', icon: 'hammer', classReq: ['warrior'], stats: { physicalDamage: 14, defense: 5, block: 4 } },
  { id: 'bloodcrusher', name: 'Bloodcrusher', slot: 'weapon', weaponType: 'hammer2h', icon: 'hammer', classReq: ['warrior'], stats: { physicalDamage: 14, drainHealth: 3, armorPenetration: 3 } },
  { id: 'wraithmaul', name: 'Wraithmaul', slot: 'weapon', weaponType: 'hammer2h', icon: 'hammer', classReq: ['warrior'], stats: { physicalDamage: 13, criticalDamage: 6, defense: 4 } },
  { id: 'emberforge', name: 'Emberforge', slot: 'weapon', weaponType: 'hammer2h', icon: 'hammer', classReq: ['warrior'], stats: { physicalDamage: 14, magicDamage: 3, block: 5 } },
  { id: 'ironbreaker', name: 'Ironbreaker', slot: 'weapon', weaponType: 'hammer2h', icon: 'hammer', classReq: ['warrior'], stats: { physicalDamage: 15, block: 6, defense: 5 } },
  { id: 'duskmallet', name: 'Duskmallet', slot: 'weapon', weaponType: 'hammer2h', icon: 'hammer', classReq: ['warrior'], stats: { physicalDamage: 13, attackSpeed: 3, criticalDamage: 7 } },

  { id: 'ironfist', name: 'Ironfist', slot: 'weapon', weaponType: 'hammer1h', icon: 'hammer', classReq: ['worge'], stats: { physicalDamage: 4, magicDamage: 2, defense: 3, attackSpeed: 3 } },
  { id: 'bloodmaul', name: 'Bloodmaul', slot: 'weapon', weaponType: 'hammer1h', icon: 'hammer', classReq: ['worge'], stats: { physicalDamage: 5, magicDamage: 2, drainHealth: 2, attackSpeed: 3 } },
  { id: 'wraithknocker', name: 'Wraithknocker', slot: 'weapon', weaponType: 'hammer1h', icon: 'hammer', classReq: ['worge'], stats: { physicalDamage: 4, magicDamage: 3, evasion: 3, attackSpeed: 3 } },
  { id: 'embermallet', name: 'Embermallet', slot: 'weapon', weaponType: 'hammer1h', icon: 'hammer', classReq: ['worge'], stats: { physicalDamage: 4, magicDamage: 3, defense: 3, block: 3 } },
  { id: 'ironshard', name: 'Ironshard', slot: 'weapon', weaponType: 'hammer1h', icon: 'hammer', classReq: ['worge'], stats: { physicalDamage: 5, magicDamage: 1, block: 5, defense: 4 } },
  { id: 'duskhammer', name: 'Duskhammer', slot: 'weapon', weaponType: 'hammer1h', icon: 'hammer', classReq: ['worge'], stats: { physicalDamage: 4, magicDamage: 2, criticalChance: 5, attackSpeed: 4 } },

  { id: 'wraithbone_bow', name: 'Wraithbone Bow', slot: 'weapon', weaponType: 'bow', icon: 'bow', classReq: ['ranger'], stats: { physicalDamage: 6, criticalChance: 6, accuracy: 4 } },
  { id: 'bloodstring_bow', name: 'Bloodstring Bow', slot: 'weapon', weaponType: 'bow', icon: 'bow', classReq: ['ranger'], stats: { physicalDamage: 7, criticalChance: 7, attackSpeed: 3 } },
  { id: 'shadowflight_bow', name: 'Shadowflight Bow', slot: 'weapon', weaponType: 'bow', icon: 'bow', classReq: ['ranger'], stats: { physicalDamage: 6, criticalChance: 8, criticalDamage: 6 } },
  { id: 'emberthorn_bow', name: 'Emberthorn Bow', slot: 'weapon', weaponType: 'bow', icon: 'bow', classReq: ['ranger'], stats: { physicalDamage: 7, criticalChance: 5, magicDamage: 2 } },
  { id: 'ironvine_bow', name: 'Ironvine Bow', slot: 'weapon', weaponType: 'bow', icon: 'bow', classReq: ['ranger'], stats: { physicalDamage: 6, criticalChance: 4, defense: 3, accuracy: 5 } },
  { id: 'duskreaver_bow', name: 'Duskreaver Bow', slot: 'weapon', weaponType: 'bow', icon: 'bow', classReq: ['ranger'], stats: { physicalDamage: 7, criticalChance: 9, criticalDamage: 8 } },

  { id: 'ironveil_repeater', name: 'Ironveil Repeater', slot: 'weapon', weaponType: 'crossbow', icon: 'bow', classReq: ['ranger'], stats: { physicalDamage: 8, criticalDamage: 7, accuracy: 4 } },
  { id: 'skullpiercer', name: 'Skullpiercer', slot: 'weapon', weaponType: 'crossbow', icon: 'bow', classReq: ['ranger'], stats: { physicalDamage: 9, criticalDamage: 9, armorPenetration: 3 } },
  { id: 'bloodreaver_xbow', name: 'Bloodreaver Crossbow', slot: 'weapon', weaponType: 'crossbow', icon: 'bow', classReq: ['ranger'], stats: { physicalDamage: 8, drainHealth: 2, criticalDamage: 6 } },
  { id: 'wraithspike', name: 'Wraithspike', slot: 'weapon', weaponType: 'crossbow', icon: 'bow', classReq: ['ranger'], stats: { physicalDamage: 8, criticalDamage: 8, evasion: 3 } },
  { id: 'emberbolt', name: 'Emberbolt', slot: 'weapon', weaponType: 'crossbow', icon: 'bow', classReq: ['ranger'], stats: { physicalDamage: 8, magicDamage: 2, criticalDamage: 6 } },
  { id: 'duskpiercer_xbow', name: 'Duskpiercer', slot: 'weapon', weaponType: 'crossbow', icon: 'bow', classReq: ['ranger'], stats: { physicalDamage: 9, criticalDamage: 10, attackSpeed: 3 } },

  { id: 'bloodshot_flintlock', name: 'Bloodshot Flintlock', slot: 'weapon', weaponType: 'gun', icon: 'star', classReq: ['ranger'], stats: { physicalDamage: 10, criticalDamage: 8, accuracy: 3 } },
  { id: 'wraithfire_pistol', name: 'Wraithfire Pistol', slot: 'weapon', weaponType: 'gun', icon: 'star', classReq: ['ranger'], stats: { physicalDamage: 10, magicDamage: 3, criticalDamage: 6 } },
  { id: 'embercannon', name: 'Embercannon', slot: 'weapon', weaponType: 'gun', icon: 'star', classReq: ['ranger'], stats: { physicalDamage: 12, criticalDamage: 10, armorPenetration: 4 } },
  { id: 'ironbore_musket', name: 'Ironbore Musket', slot: 'weapon', weaponType: 'gun', icon: 'star', classReq: ['ranger'], stats: { physicalDamage: 11, armorPenetration: 5, accuracy: 4 } },
  { id: 'duskshot_repeater', name: 'Duskshot Repeater', slot: 'weapon', weaponType: 'gun', icon: 'star', classReq: ['ranger'], stats: { physicalDamage: 9, attackSpeed: 5, criticalChance: 4 } },
  { id: 'skullblast_cannon', name: 'Skullblast Cannon', slot: 'weapon', weaponType: 'gun', icon: 'star', classReq: ['ranger'], stats: { physicalDamage: 13, criticalDamage: 12 } },

  { id: 'bloodspear', name: 'Bloodspear', slot: 'weapon', weaponType: 'lance', icon: 'lance', classReq: ['ranger'], stats: { physicalDamage: 7, criticalChance: 4, accuracy: 5 } },
  { id: 'wraithpike', name: 'Wraithpike', slot: 'weapon', weaponType: 'lance', icon: 'lance', classReq: ['ranger'], stats: { physicalDamage: 7, criticalChance: 5, evasion: 3 } },
  { id: 'emberlance', name: 'Emberlance', slot: 'weapon', weaponType: 'lance', icon: 'lance', classReq: ['ranger'], stats: { physicalDamage: 8, magicDamage: 2, criticalChance: 3 } },
  { id: 'ironthrust', name: 'Ironthrust', slot: 'weapon', weaponType: 'lance', icon: 'lance', classReq: ['ranger'], stats: { physicalDamage: 8, armorPenetration: 3, accuracy: 5 } },
  { id: 'duskpiercer_lance', name: 'Duskpiercer Lance', slot: 'weapon', weaponType: 'lance', icon: 'lance', classReq: ['ranger'], stats: { physicalDamage: 7, criticalChance: 6, criticalDamage: 6 } },
  { id: 'skullimpaler', name: 'Skullimpaler', slot: 'weapon', weaponType: 'lance', icon: 'lance', classReq: ['ranger'], stats: { physicalDamage: 9, armorPenetration: 4, accuracy: 4 } },

  { id: 'bloodthorn_staff', name: 'Bloodthorn Staff', slot: 'weapon', weaponType: 'staff', icon: 'staff', classReq: ['mage', 'worge'], stats: { magicDamage: 5, mana: 20, drainHealth: 2 } },
  { id: 'wraithwood_staff', name: 'Wraithwood Staff', slot: 'weapon', weaponType: 'staff', icon: 'staff', classReq: ['mage', 'worge'], stats: { magicDamage: 5, mana: 25, manaRegen: 1 } },
  { id: 'emberspire_staff', name: 'Emberspire Staff', slot: 'weapon', weaponType: 'staff', icon: 'staff', classReq: ['mage', 'worge'], stats: { magicDamage: 6, mana: 20, criticalChance: 3 } },
  { id: 'ironsoul_staff', name: 'Ironsoul Staff', slot: 'weapon', weaponType: 'staff', icon: 'staff', classReq: ['mage', 'worge'], stats: { magicDamage: 4, mana: 30, defense: 3, resistance: 3 } },
  { id: 'duskweaver_staff', name: 'Duskweaver Staff', slot: 'weapon', weaponType: 'staff', icon: 'staff', classReq: ['mage', 'worge'], stats: { magicDamage: 6, mana: 20, cooldownReduction: 3 } },
  { id: 'skullshroud_staff', name: 'Skullshroud Staff', slot: 'weapon', weaponType: 'staff', icon: 'staff', classReq: ['mage', 'worge'], stats: { magicDamage: 7, mana: 15, drainHealth: 3 } },

  { id: 'grimoire_grudges', name: 'Grimoire of Grudges', slot: 'weapon', weaponType: 'tome', icon: 'book', classReq: ['mage'], stats: { magicDamage: 5, mana: 25, cooldownReduction: 2 } },
  { id: 'bloodscript_tome', name: 'Bloodscript Tome', slot: 'weapon', weaponType: 'tome', icon: 'book', classReq: ['mage'], stats: { magicDamage: 6, mana: 20, drainHealth: 2 } },
  { id: 'wraith_codex', name: 'Wraith Codex', slot: 'weapon', weaponType: 'tome', icon: 'book', classReq: ['mage'], stats: { magicDamage: 5, mana: 30, manaRegen: 1.5 } },
  { id: 'ember_lexicon', name: 'Ember Lexicon', slot: 'weapon', weaponType: 'tome', icon: 'book', classReq: ['mage'], stats: { magicDamage: 6, mana: 20, criticalChance: 4 } },
  { id: 'ironsoul_grimoire', name: 'Ironsoul Grimoire', slot: 'weapon', weaponType: 'tome', icon: 'book', classReq: ['mage'], stats: { magicDamage: 4, mana: 30, defense: 3, resistance: 4 } },
  { id: 'duskbound_tome', name: 'Duskbound Tome', slot: 'weapon', weaponType: 'tome', icon: 'book', classReq: ['mage'], stats: { magicDamage: 7, mana: 15, cooldownReduction: 3 } },

  // ── Nature / Worge staves ─────────────────────────────────────────────────
  { id: 'verdant_wrath', name: 'Verdant Wrath', slot: 'weapon', weaponType: 'staff', icon: 'staff', classReq: ['mage', 'worge'], stats: { magicDamage: 4, mana: 25, healthRegen: 2, health: 15 } },
  { id: 'thorn_grudge', name: 'Thorn Grudge', slot: 'weapon', weaponType: 'staff', icon: 'staff', classReq: ['mage', 'worge'], stats: { magicDamage: 7, mana: 20, criticalChance: 3 } },
  { id: 'wild_oathbreaker', name: 'Wild Oathbreaker', slot: 'weapon', weaponType: 'staff', icon: 'staff', classReq: ['mage', 'worge'], stats: { magicDamage: 5, mana: 25, defense: 3, resistance: 3 } },
  { id: 'grove_guardian', name: 'Grove Guardian', slot: 'weapon', weaponType: 'staff', icon: 'staff', classReq: ['mage', 'worge'], stats: { magicDamage: 4, mana: 30, healthRegen: 2, manaRegen: 1 } },
  { id: 'blossom_fury', name: 'Blossom Fury', slot: 'weapon', weaponType: 'staff', icon: 'staff', classReq: ['mage', 'worge'], stats: { magicDamage: 6, mana: 20, criticalChance: 4, criticalDamage: 5 } },
  { id: 'root_warden', name: 'Root Warden', slot: 'weapon', weaponType: 'staff', icon: 'staff', classReq: ['mage', 'worge'], stats: { magicDamage: 5, mana: 25, defense: 4, health: 20 } },

  // ── Arcane / General staves ───────────────────────────────────────────────
  { id: 'arcane_fury', name: 'Arcane Fury', slot: 'weapon', weaponType: 'staff', icon: 'staff', classReq: ['mage', 'worge'], stats: { magicDamage: 7, mana: 20, armorPenetration: 2 } },
  { id: 'thunder_spire', name: 'Thunder Spire', slot: 'weapon', weaponType: 'staff', icon: 'staff', classReq: ['mage', 'worge'], stats: { magicDamage: 6, mana: 20, criticalDamage: 6, criticalChance: 3 } },
  { id: 'redemption_staff', name: 'Redemption Staff', slot: 'weapon', weaponType: 'staff', icon: 'staff', classReq: ['mage', 'worge'], stats: { magicDamage: 4, mana: 30, healthRegen: 3, resistance: 3 } },

  // ── Named tomes ───────────────────────────────────────────────────────────
  { id: 'crimson_inferno_tome', name: 'Crimson Inferno Tome', slot: 'weapon', weaponType: 'tome', icon: 'book', classReq: ['mage'], stats: { magicDamage: 6, mana: 20, drainHealth: 2, criticalChance: 3 } },
  { id: 'blazewrath_grimoire', name: 'Blazewrath Grimoire', slot: 'weapon', weaponType: 'tome', icon: 'book', classReq: ['mage'], stats: { magicDamage: 7, mana: 15, drainHealth: 3 } },
  { id: 'frozen_glacier_tome', name: 'Frozen Glacier Tome', slot: 'weapon', weaponType: 'tome', icon: 'book', classReq: ['mage'], stats: { magicDamage: 5, mana: 25, defense: 3, resistance: 3 } },
  { id: 'ancient_verdant_tome', name: 'Ancient Verdant Tome', slot: 'weapon', weaponType: 'tome', icon: 'book', classReq: ['mage'], stats: { magicDamage: 4, mana: 30, healthRegen: 2, manaRegen: 1 } },
  { id: 'radiant_dawn_tome', name: 'Radiant Dawn Tome', slot: 'weapon', weaponType: 'tome', icon: 'book', classReq: ['mage'], stats: { magicDamage: 5, mana: 25, healthRegen: 2, resistance: 3 } },
];

const offhandTemplates = [
  { id: 'bloodward_shield', name: 'Bloodward Shield', slot: 'offhand', weaponType: 'shield', icon: 'shield', classReq: ['warrior'], stats: { defense: 5, block: 6, health: 20 } },
  { id: 'wraithguard_bulwark', name: 'Wraithguard Bulwark', slot: 'offhand', weaponType: 'shield', icon: 'shield', classReq: ['warrior'], stats: { defense: 6, block: 8, resistance: 4 } },
  { id: 'emberbulwark', name: 'Emberbulwark', slot: 'offhand', weaponType: 'shield', icon: 'shield', classReq: ['warrior'], stats: { defense: 6, block: 7, health: 25, damageReduction: 2 } },
  { id: 'ironfort_shield', name: 'Ironfort Shield', slot: 'offhand', weaponType: 'shield', icon: 'shield', classReq: ['warrior'], stats: { defense: 8, block: 10, health: 30 } },
  { id: 'duskwall', name: 'Duskwall', slot: 'offhand', weaponType: 'shield', icon: 'shield', classReq: ['warrior'], stats: { defense: 5, block: 6, evasion: 4, attackSpeed: 2 } },
  { id: 'skullshield', name: 'Skullshield', slot: 'offhand', weaponType: 'shield', icon: 'shield', classReq: ['warrior'], stats: { defense: 7, block: 9, damageReduction: 3, health: 15 } },

  { id: 'bloodstone_orb', name: 'Bloodstone Orb', slot: 'offhand', weaponType: 'relic', icon: 'crystal', classReq: ['mage'], stats: { magicDamage: 3, mana: 20, drainHealth: 2 } },
  { id: 'wraithsoul_crystal', name: 'Wraithsoul Crystal', slot: 'offhand', weaponType: 'relic', icon: 'crystal', classReq: ['mage'], stats: { magicDamage: 3, mana: 25, manaRegen: 1 } },
  { id: 'emberheart_focus', name: 'Emberheart Focus', slot: 'offhand', weaponType: 'relic', icon: 'crystal', classReq: ['mage'], stats: { magicDamage: 4, mana: 20, criticalChance: 3 } },
  { id: 'ironsoul_relic', name: 'Ironsoul Relic', slot: 'offhand', weaponType: 'relic', icon: 'crystal', classReq: ['mage'], stats: { magicDamage: 2, mana: 30, resistance: 4, defense: 2 } },
  { id: 'duskbound_skull', name: 'Duskbound Skull', slot: 'offhand', weaponType: 'relic', icon: 'crystal', classReq: ['mage'], stats: { magicDamage: 4, mana: 20, cooldownReduction: 3 } },
  { id: 'voidheart_relic', name: 'Voidheart Relic', slot: 'offhand', weaponType: 'relic', icon: 'crystal', classReq: ['mage'], stats: { magicDamage: 5, mana: 30, manaRegen: 1.5, drainHealth: 2 } },
];

const armorTemplates = [
  { id: 'bloodforged_mail', name: 'Bloodforged Mail', slot: 'armor', armorType: 'metal', icon: 'armor', classReq: ['warrior', 'ranger'], stats: { defense: 6, health: 25 } },
  { id: 'wraithsteel_plate', name: 'Wraithsteel Plate', slot: 'armor', armorType: 'metal', icon: 'armor', classReq: ['warrior', 'ranger'], stats: { defense: 7, health: 20, resistance: 4 } },
  { id: 'emberguard_plate', name: 'Emberguard Plate', slot: 'armor', armorType: 'metal', icon: 'armor', classReq: ['warrior', 'ranger'], stats: { defense: 7, health: 25, damageReduction: 2 } },
  { id: 'ironbound_armor', name: 'Ironbound Armor', slot: 'armor', armorType: 'metal', icon: 'armor', classReq: ['warrior', 'ranger'], stats: { defense: 9, health: 30, block: 3 } },
  { id: 'duskthorn_plate', name: 'Duskthorn Plate', slot: 'armor', armorType: 'metal', icon: 'armor', classReq: ['warrior', 'ranger'], stats: { defense: 6, health: 20, evasion: 3, attackSpeed: 2 } },
  { id: 'skullforge_plate', name: 'Skullforge Plate', slot: 'armor', armorType: 'metal', icon: 'armor', classReq: ['warrior', 'ranger'], stats: { defense: 8, health: 25, damageReduction: 3 } },

  { id: 'bloodhide_vest', name: 'Bloodhide Vest', slot: 'armor', armorType: 'leather', icon: 'armor', classReq: ['worge', 'ranger'], stats: { defense: 4, health: 20, evasion: 3 } },
  { id: 'wraithskin_leather', name: 'Wraithskin Leather', slot: 'armor', armorType: 'leather', icon: 'armor', classReq: ['worge', 'ranger'], stats: { defense: 4, health: 15, evasion: 4, resistance: 3 } },
  { id: 'emberscale_hide', name: 'Emberscale Hide', slot: 'armor', armorType: 'leather', icon: 'armor', classReq: ['worge', 'ranger'], stats: { defense: 5, health: 20, evasion: 3, damageReduction: 2 } },
  { id: 'ironweave_leather', name: 'Ironweave Leather', slot: 'armor', armorType: 'leather', icon: 'armor', classReq: ['worge', 'ranger'], stats: { defense: 6, health: 25, evasion: 2 } },
  { id: 'duskcloak', name: 'Duskcloak', slot: 'armor', armorType: 'leather', icon: 'armor', classReq: ['worge', 'ranger'], stats: { defense: 3, health: 15, evasion: 6, attackSpeed: 3 } },
  { id: 'skullthorn_hide', name: 'Skullthorn Hide', slot: 'armor', armorType: 'leather', icon: 'armor', classReq: ['worge', 'ranger'], stats: { defense: 5, health: 20, evasion: 3, criticalChance: 3 } },

  { id: 'bloodweave_robe', name: 'Bloodweave Robe', slot: 'armor', armorType: 'cloth', icon: 'armor', classReq: ['mage', 'worge'], stats: { defense: 2, mana: 25, resistance: 4, drainHealth: 1 } },
  { id: 'wraithshroud_vestment', name: 'Wraithshroud Vestment', slot: 'armor', armorType: 'cloth', icon: 'armor', classReq: ['mage', 'worge'], stats: { defense: 2, mana: 30, resistance: 5, manaRegen: 1 } },
  { id: 'emberwoven_robe', name: 'Emberwoven Robe', slot: 'armor', armorType: 'cloth', icon: 'armor', classReq: ['mage', 'worge'], stats: { defense: 3, mana: 25, resistance: 3, magicDamage: 2 } },
  { id: 'ironsoul_vestment', name: 'Ironsoul Vestment', slot: 'armor', armorType: 'cloth', icon: 'armor', classReq: ['mage', 'worge'], stats: { defense: 4, mana: 20, resistance: 6, health: 15 } },
  { id: 'duskthread_robe', name: 'Duskthread Robe', slot: 'armor', armorType: 'cloth', icon: 'armor', classReq: ['mage', 'worge'], stats: { defense: 2, mana: 25, resistance: 3, cooldownReduction: 3 } },
  { id: 'skullveil_robe', name: 'Skullveil Robe', slot: 'armor', armorType: 'cloth', icon: 'armor', classReq: ['mage', 'worge'], stats: { defense: 3, mana: 30, resistance: 4, magicDamage: 3 } },
];

const helmetTemplates = [
  { id: 'bloodforged_helm', name: 'Bloodforged Helm', slot: 'helmet', helmetType: 'plate', icon: 'helm', classReq: ['warrior', 'ranger'], stats: { defense: 4, health: 20, damageReduction: 1 } },
  { id: 'wraithsteel_helm', name: 'Wraithsteel Helm', slot: 'helmet', helmetType: 'plate', icon: 'helm', classReq: ['warrior', 'ranger'], stats: { defense: 5, health: 15, resistance: 3 } },
  { id: 'emberguard_helm', name: 'Emberguard Helm', slot: 'helmet', helmetType: 'plate', icon: 'helm', classReq: ['warrior', 'ranger'], stats: { defense: 5, health: 25, block: 2 } },
  { id: 'ironbound_helm', name: 'Ironbound Helm', slot: 'helmet', helmetType: 'plate', icon: 'helm', classReq: ['warrior', 'ranger'], stats: { defense: 6, health: 30 } },
  { id: 'duskthorn_helm', name: 'Duskthorn Helm', slot: 'helmet', helmetType: 'plate', icon: 'helm', classReq: ['warrior', 'ranger'], stats: { defense: 4, health: 15, criticalChance: 2, evasion: 2 } },
  { id: 'skullforge_helm', name: 'Skullforge Helm', slot: 'helmet', helmetType: 'plate', icon: 'helm', classReq: ['warrior', 'ranger'], stats: { defense: 5, health: 20, armorPenetration: 2 } },

  { id: 'bloodhide_hood', name: 'Bloodhide Hood', slot: 'helmet', helmetType: 'leather', icon: 'helm', classReq: ['worge', 'ranger'], stats: { defense: 3, evasion: 3, criticalChance: 2 } },
  { id: 'wraithskin_hood', name: 'Wraithskin Hood', slot: 'helmet', helmetType: 'leather', icon: 'helm', classReq: ['worge', 'ranger'], stats: { defense: 3, evasion: 4, resistance: 2 } },
  { id: 'emberscale_hood', name: 'Emberscale Hood', slot: 'helmet', helmetType: 'leather', icon: 'helm', classReq: ['worge', 'ranger'], stats: { defense: 3, evasion: 3, attackSpeed: 3 } },
  { id: 'ironweave_hood', name: 'Ironweave Hood', slot: 'helmet', helmetType: 'leather', icon: 'helm', classReq: ['worge', 'ranger'], stats: { defense: 4, evasion: 2, health: 15 } },
  { id: 'duskcloak_hood', name: 'Duskcloak Hood', slot: 'helmet', helmetType: 'leather', icon: 'helm', classReq: ['worge', 'ranger'], stats: { defense: 2, evasion: 5, criticalChance: 3 } },
  { id: 'skullthorn_hood', name: 'Skullthorn Hood', slot: 'helmet', helmetType: 'leather', icon: 'helm', classReq: ['worge', 'ranger'], stats: { defense: 3, evasion: 3, physicalDamage: 2 } },

  { id: 'bloodweave_crown', name: 'Bloodweave Crown', slot: 'helmet', helmetType: 'cloth', icon: 'crown', classReq: ['mage', 'worge'], stats: { mana: 20, resistance: 3, magicDamage: 2 } },
  { id: 'wraithshroud_crown', name: 'Wraithshroud Crown', slot: 'helmet', helmetType: 'cloth', icon: 'crown', classReq: ['mage', 'worge'], stats: { mana: 25, resistance: 4, manaRegen: 1 } },
  { id: 'emberwoven_crown', name: 'Emberwoven Crown', slot: 'helmet', helmetType: 'cloth', icon: 'crown', classReq: ['mage', 'worge'], stats: { mana: 20, magicDamage: 3, criticalChance: 2 } },
  { id: 'ironsoul_crown', name: 'Ironsoul Crown', slot: 'helmet', helmetType: 'cloth', icon: 'crown', classReq: ['mage', 'worge'], stats: { mana: 20, defense: 3, resistance: 4 } },
  { id: 'duskthread_crown', name: 'Duskthread Crown', slot: 'helmet', helmetType: 'cloth', icon: 'crown', classReq: ['mage', 'worge'], stats: { mana: 20, magicDamage: 2, cooldownReduction: 3 } },
  { id: 'skullveil_crown', name: 'Skullveil Crown', slot: 'helmet', helmetType: 'cloth', icon: 'crown', classReq: ['mage', 'worge'], stats: { mana: 25, magicDamage: 3, drainHealth: 1 } },
];

const feetTemplates = [
  { id: 'bloodforged_greaves', name: 'Bloodforged Greaves', slot: 'feet', feetType: 'plate', icon: 'boots', classReq: ['warrior', 'ranger'], stats: { defense: 3, health: 15, block: 2 } },
  { id: 'wraithsteel_greaves', name: 'Wraithsteel Greaves', slot: 'feet', feetType: 'plate', icon: 'boots', classReq: ['warrior', 'ranger'], stats: { defense: 4, health: 10, resistance: 2 } },
  { id: 'emberguard_greaves', name: 'Emberguard Greaves', slot: 'feet', feetType: 'plate', icon: 'boots', classReq: ['warrior', 'ranger'], stats: { defense: 4, health: 20, damageReduction: 1 } },
  { id: 'ironbound_greaves', name: 'Ironbound Greaves', slot: 'feet', feetType: 'plate', icon: 'boots', classReq: ['warrior', 'ranger'], stats: { defense: 5, health: 20, block: 3 } },
  { id: 'duskthorn_greaves', name: 'Duskthorn Greaves', slot: 'feet', feetType: 'plate', icon: 'boots', classReq: ['warrior', 'ranger'], stats: { defense: 3, attackSpeed: 3, evasion: 2 } },
  { id: 'skullforge_greaves', name: 'Skullforge Greaves', slot: 'feet', feetType: 'plate', icon: 'boots', classReq: ['warrior', 'ranger'], stats: { defense: 4, health: 15, armorPenetration: 2 } },

  { id: 'bloodhide_boots', name: 'Bloodhide Boots', slot: 'feet', feetType: 'leather', icon: 'boots', classReq: ['worge', 'ranger'], stats: { evasion: 4, attackSpeed: 3 } },
  { id: 'wraithskin_boots', name: 'Wraithskin Boots', slot: 'feet', feetType: 'leather', icon: 'boots', classReq: ['worge', 'ranger'], stats: { evasion: 5, resistance: 2 } },
  { id: 'emberscale_boots', name: 'Emberscale Boots', slot: 'feet', feetType: 'leather', icon: 'boots', classReq: ['worge', 'ranger'], stats: { evasion: 3, attackSpeed: 4, criticalChance: 2 } },
  { id: 'ironweave_boots', name: 'Ironweave Boots', slot: 'feet', feetType: 'leather', icon: 'boots', classReq: ['worge', 'ranger'], stats: { defense: 3, evasion: 3, health: 10 } },
  { id: 'duskcloak_boots', name: 'Duskcloak Boots', slot: 'feet', feetType: 'leather', icon: 'boots', classReq: ['worge', 'ranger'], stats: { evasion: 6, attackSpeed: 4 } },
  { id: 'skullthorn_boots', name: 'Skullthorn Boots', slot: 'feet', feetType: 'leather', icon: 'boots', classReq: ['worge', 'ranger'], stats: { evasion: 3, criticalChance: 3, physicalDamage: 1 } },

  { id: 'bloodweave_sandals', name: 'Bloodweave Sandals', slot: 'feet', feetType: 'cloth', icon: 'boots', classReq: ['mage', 'worge'], stats: { mana: 15, resistance: 2, manaRegen: 1 } },
  { id: 'wraithshroud_sandals', name: 'Wraithshroud Sandals', slot: 'feet', feetType: 'cloth', icon: 'boots', classReq: ['mage', 'worge'], stats: { mana: 20, resistance: 3 } },
  { id: 'emberwoven_sandals', name: 'Emberwoven Sandals', slot: 'feet', feetType: 'cloth', icon: 'boots', classReq: ['mage', 'worge'], stats: { mana: 15, magicDamage: 2, cooldownReduction: 2 } },
  { id: 'ironsoul_sandals', name: 'Ironsoul Sandals', slot: 'feet', feetType: 'cloth', icon: 'boots', classReq: ['mage', 'worge'], stats: { mana: 15, defense: 2, resistance: 3 } },
  { id: 'duskthread_sandals', name: 'Duskthread Sandals', slot: 'feet', feetType: 'cloth', icon: 'boots', classReq: ['mage', 'worge'], stats: { mana: 15, evasion: 3, attackSpeed: 2 } },
  { id: 'skullveil_sandals', name: 'Skullveil Sandals', slot: 'feet', feetType: 'cloth', icon: 'boots', classReq: ['mage', 'worge'], stats: { mana: 20, magicDamage: 2, drainHealth: 1 } },
];

const ringTemplates = [
  { id: 'bloodrage_ring', name: 'Bloodrage Ring', slot: 'ring', icon: 'ring', stats: { physicalDamage: 3, criticalChance: 3 } },
  { id: 'wraithfury_band', name: 'Wraithfury Band', slot: 'ring', icon: 'ring', stats: { physicalDamage: 3, attackSpeed: 4 } },
  { id: 'emberflame_signet', name: 'Emberflame Signet', slot: 'ring', icon: 'ring', stats: { magicDamage: 3, criticalDamage: 6 } },
  { id: 'ironwill_ring', name: 'Ironwill Ring', slot: 'ring', icon: 'ring', stats: { physicalDamage: 2, defense: 4 } },
  { id: 'duskstrike_ring', name: 'Duskstrike Ring', slot: 'ring', icon: 'ring', stats: { criticalChance: 4, criticalDamage: 8 } },
  { id: 'skullcrush_band', name: 'Skullcrush Band', slot: 'ring', icon: 'ring', stats: { physicalDamage: 3, armorPenetration: 3 } },
  { id: 'swiftblade_trinket', name: 'Swiftblade Trinket', slot: 'ring', icon: 'lightning', stats: { attackSpeed: 5, criticalChance: 3 } },
  { id: 'shadow_step_ring', name: 'Shadow Step Ring', slot: 'ring', icon: 'lightning', stats: { evasion: 5, attackSpeed: 4 } },
  { id: 'ember_quickness', name: 'Ember Quickness Charm', slot: 'ring', icon: 'lightning', stats: { attackSpeed: 5, cooldownReduction: 3 } },
  { id: 'ironside_buckle', name: 'Ironside Buckle', slot: 'ring', icon: 'lightning', stats: { block: 5, defense: 3 } },
  { id: 'duskrunner_boots', name: 'Duskrunner Boots', slot: 'ring', icon: 'lightning', stats: { evasion: 4, attackSpeed: 5 } },
  { id: 'grudgebearer_seal', name: 'Grudgebearer Seal', slot: 'ring', icon: 'lightning', stats: { physicalDamage: 2, magicDamage: 2, criticalChance: 2, criticalDamage: 4 } },
];

const relicTemplates = [
  { id: 'bloodward_amulet', name: 'Bloodward Amulet', slot: 'relic', icon: 'crystal', stats: { defense: 4, health: 25 } },
  { id: 'wraithshield_pendant', name: 'Wraithshield Pendant', slot: 'relic', icon: 'crystal', stats: { resistance: 5, evasion: 3 } },
  { id: 'emberbark_talisman', name: 'Emberbark Talisman', slot: 'relic', icon: 'crystal', stats: { defense: 3, damageReduction: 3 } },
  { id: 'ironheart_medallion', name: 'Ironheart Medallion', slot: 'relic', icon: 'crystal', stats: { health: 30, block: 4 } },
  { id: 'duskguard_charm', name: 'Duskguard Charm', slot: 'relic', icon: 'crystal', stats: { defense: 3, resistance: 4 } },
  { id: 'skullfort_talisman', name: 'Skullfort Talisman', slot: 'relic', icon: 'crystal', stats: { damageReduction: 3, health: 20 } },
  { id: 'bloodmoon_crystal', name: 'Bloodmoon Crystal', slot: 'relic', icon: 'crystal', stats: { magicDamage: 4, mana: 25 } },
  { id: 'wraithsoul_gem', name: 'Wraithsoul Gem', slot: 'relic', icon: 'crystal', stats: { magicDamage: 3, manaRegen: 2 } },
  { id: 'embervoid_prism', name: 'Embervoid Prism', slot: 'relic', icon: 'crystal', stats: { magicDamage: 3, cooldownReduction: 4 } },
  { id: 'ironsoul_shard', name: 'Ironsoul Shard', slot: 'relic', icon: 'crystal', stats: { mana: 30, resistance: 4 } },
  { id: 'duskweaver_stone', name: 'Duskweaver Stone', slot: 'relic', icon: 'crystal', stats: { magicDamage: 4, mana: 20 } },
  { id: 'void_crystal', name: 'Void Crystal', slot: 'relic', icon: 'crystal', stats: { magicDamage: 4, drainHealth: 3 } },
  { id: 'lifesblood_totem', name: 'Lifesblood Totem', slot: 'relic', icon: 'nature', stats: { healthRegen: 3, health: 30 } },
  { id: 'wraithbalm_idol', name: 'Wraithbalm Idol', slot: 'relic', icon: 'nature', stats: { healthRegen: 2, manaRegen: 2 } },
  { id: 'emberheart_totem', name: 'Emberheart Totem', slot: 'relic', icon: 'nature', stats: { health: 25, resistance: 4 } },
  { id: 'ironpulse_stone', name: 'Ironpulse Stone', slot: 'relic', icon: 'nature', stats: { healthRegen: 3, defense: 3 } },
  { id: 'duskleaf_charm', name: 'Duskleaf Charm', slot: 'relic', icon: 'nature', stats: { healthRegen: 2, evasion: 4 } },
  { id: 'natures_heart', name: "Nature's Heart", slot: 'relic', icon: 'nature', stats: { health: 25, manaRegen: 2 } },
];

export const allEquipmentTemplates = [...weaponTemplates, ...offhandTemplates, ...armorTemplates, ...helmetTemplates, ...feetTemplates, ...ringTemplates, ...relicTemplates];

export function canClassEquip(classId, item) {
  if (!classId || !item) return false;
  if (item.classReq && !item.classReq.includes(classId)) return false;
  const rules = CLASS_EQUIPMENT_RULES[classId];
  if (!rules) return true;
  if (item.slot === 'weapon' && item.weaponType) {
    return rules.weaponTypes.includes(item.weaponType);
  }
  if (item.slot === 'offhand' && item.weaponType) {
    return rules.offhandTypes.includes(item.weaponType);
  }
  if (item.slot === 'armor' && item.armorType) {
    return rules.armorTypes.includes(item.armorType);
  }
  if (item.slot === 'helmet' && item.helmetType) {
    return rules.helmetTypes ? rules.helmetTypes.includes(item.helmetType) : true;
  }
  if (item.slot === 'feet' && item.feetType) {
    return rules.feetTypes ? rules.feetTypes.includes(item.feetType) : true;
  }
  if (item.slot === 'ring' || item.slot === 'relic') {
    return true;
  }
  return true;
}

function getDropTier(playerLevel, isBoss) {
  let baseTier = 1;
  if (playerLevel >= 16) baseTier = 4;
  else if (playerLevel >= 12) baseTier = 3;
  else if (playerLevel >= 7) baseTier = 2;
  else baseTier = 1;

  if (isBoss) baseTier = Math.min(8, baseTier + 1);

  const roll = Math.random();
  if (roll < 0.05 && baseTier < 8) return Math.min(8, baseTier + 2);
  if (roll < 0.20 && baseTier < 8) return Math.min(8, baseTier + 1);
  return baseTier;
}

export function generateLoot(enemyTemplateId, playerLevel, isBoss = false) {
  const drops = [];
  const dropChance = isBoss ? 1.0 : 0.35;

  if (Math.random() > dropChance) return drops;

  const itemCount = isBoss ? (1 + Math.floor(Math.random() * 2)) : 1;

  for (let i = 0; i < itemCount; i++) {
    const template = allEquipmentTemplates[Math.floor(Math.random() * allEquipmentTemplates.length)];
    const tier = getDropTier(playerLevel, isBoss);
    const scaledStats = scaleItemStats(template.stats, tier);

    drops.push({
      id: `${template.id}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      grudgeUuid: null,
      templateId: template.id,
      name: template.name,
      slot: template.slot,
      icon: template.icon,
      weaponType: template.weaponType || null,
      armorType: template.armorType || null,
      helmetType: template.helmetType || null,
      feetType: template.feetType || null,
      relicType: template.relicType || null,
      tier,
      classReq: template.classReq || null,
      stats: scaledStats,
    });
  }

  const potionDropChance = isBoss ? 0.6 : 0.15;
  if (Math.random() < potionDropChance) {
    const potionPool = ['health_potion', 'mana_potion', 'stamina_potion'];
    if (isBoss) potionPool.push('speed_potion', 'cure_potion');
    if (isBoss && Math.random() < 0.3) potionPool.push('rezzy');
    const pick = potionPool[Math.floor(Math.random() * potionPool.length)];
    const consumable = createConsumable(pick);
    if (consumable) drops.push(consumable);
  }

  return drops;
}

export function upgradeItem(item) {
  if (!item || item.tier >= 8) return null;
  const cost = UPGRADE_COSTS[item.tier];
  if (!cost) return null;

  const newTier = item.tier + 1;
  const template = allEquipmentTemplates.find(t => t.id === item.templateId);
  if (!template) return null;

  const scaledStats = scaleItemStats(template.stats, newTier);

  return {
    ...item,
    tier: newTier,
    stats: scaledStats,
  };
}

function createStarterItem(template) {
  return {
    id: `${template.id}_starter_${Math.random().toString(36).slice(2, 6)}`,
    templateId: template.id,
    name: template.name,
    slot: template.slot,
    icon: template.icon,
    weaponType: template.weaponType || null,
    armorType: template.armorType || null,
    helmetType: template.helmetType || null,
    feetType: template.feetType || null,
    relicType: template.relicType || null,
    tier: 1,
    classReq: template.classReq || null,
    stats: { ...template.stats },
  };
}

export function getStartingEquipment(classId) {
  const equipment = {};
  const classWeapons = {
    warrior: 'bloodfeud_blade',
    worge: 'ironfist',
    mage: 'bloodthorn_staff',
    ranger: 'wraithbone_bow',
  };
  const classOffhands = {
    warrior: 'bloodward_shield',
    mage: 'bloodstone_orb',
  };
  const classArmor = {
    warrior: 'bloodforged_mail',
    worge: 'bloodhide_vest',
    mage: 'bloodweave_robe',
    ranger: 'bloodforged_mail',
  };

  const weaponId = classWeapons[classId];
  if (weaponId) {
    const tmpl = weaponTemplates.find(t => t.id === weaponId);
    if (tmpl) equipment.weapon = createStarterItem(tmpl);
  }

  const offhandId = classOffhands[classId];
  if (offhandId) {
    const tmpl = offhandTemplates.find(t => t.id === offhandId);
    if (tmpl) equipment.offhand = createStarterItem(tmpl);
  }

  const armorId = classArmor[classId];
  if (armorId) {
    const tmpl = armorTemplates.find(t => t.id === armorId);
    if (tmpl) equipment.armor = createStarterItem(tmpl);
  }

  const classHelmets = {
    warrior: 'bloodforged_helm',
    worge: 'bloodhide_hood',
    mage: 'bloodweave_crown',
    ranger: 'bloodhide_hood',
  };
  const classBoots = {
    warrior: 'bloodforged_greaves',
    worge: 'bloodhide_boots',
    mage: 'bloodweave_sandals',
    ranger: 'bloodhide_boots',
  };

  const helmetId = classHelmets[classId];
  if (helmetId) {
    const tmpl = helmetTemplates.find(t => t.id === helmetId);
    if (tmpl) equipment.helmet = createStarterItem(tmpl);
  }

  const bootsId = classBoots[classId];
  if (bootsId) {
    const tmpl = feetTemplates.find(t => t.id === bootsId);
    if (tmpl) equipment.feet = createStarterItem(tmpl);
  }

  const ringTmpl = ringTemplates.find(t => t.id === 'bloodrage_ring');
  if (ringTmpl) equipment.ring = createStarterItem(ringTmpl);

  return equipment;
}

export function getEquipmentStatBonuses(equipment) {
  const bonuses = {};
  EQUIPMENT_SLOTS.forEach(slot => {
    const item = equipment[slot];
    if (item && item.stats) {
      Object.entries(item.stats).forEach(([key, val]) => {
        bonuses[key] = (bonuses[key] || 0) + val;
      });
    }
  });
  return bonuses;
}

export function getItemPrice(item) {
  if (item.slot === 'consumable') return item.price || 20;
  const statWeights = {
    physicalDamage: 8, magicDamage: 8, defense: 6, health: 0.8, mana: 0.6, stamina: 0.5,
    criticalChance: 7, criticalDamage: 3, block: 5, evasion: 6, resistance: 5,
    attackSpeed: 6, armorPenetration: 7, drainHealth: 10, damageReduction: 8,
    accuracy: 4, healthRegen: 8, manaRegen: 6, cooldownReduction: 7,
    blockEffect: 3, defenseBreak: 5, criticalEvasion: 5,
  };
  
  let statValue = 0;
  if (item.stats) {
    Object.entries(item.stats).forEach(([key, val]) => {
      statValue += Math.abs(val) * (statWeights[key] || 3);
    });
  }
  
  const slotMult = { weapon: 1.2, offhand: 1.0, helmet: 0.95, armor: 1.1, feet: 0.9, ring: 0.85, relic: 0.85 };
  const mult = slotMult[item.slot] || 1.0;
  
  const tierPremium = { 1: 1, 2: 1.5, 3: 2.2, 4: 3.2, 5: 4.5, 6: 6, 7: 8, 8: 11 };
  const tierMult = tierPremium[item.tier] || 1;
  
  const basePrice = Math.max(5, Math.floor(statValue * mult * tierMult));
  return basePrice;
}

export function getSellPrice(item) {
  if (item.slot === 'consumable') return Math.max(1, Math.floor((item.price || 20) * 0.4));
  return Math.max(1, Math.floor(getItemPrice(item) * 0.4));
}

export const CONSUMABLE_ITEMS = [
  { id: 'health_potion', name: 'Hearty Steak', icon: 'food_steak', slot: 'consumable', consumableType: 'health', description: 'Restores 40% HP to one ally', price: 50 },
  { id: 'mana_potion', name: 'Mystic Ramen', icon: 'food_ramen', slot: 'consumable', consumableType: 'mana', description: 'Restores 40% MP to one ally', price: 45 },
  { id: 'stamina_potion', name: 'Power Burger', icon: 'food_burger', slot: 'consumable', consumableType: 'stamina', description: 'Restores 40% SP to one ally', price: 40 },
  { id: 'speed_potion', name: 'Spicy Curry', icon: 'food_curry', slot: 'consumable', consumableType: 'speed', description: 'Boosts speed by 50% for 3 turns', price: 60 },
  { id: 'cure_potion', name: 'Golden Salmon', icon: 'food_salmon', slot: 'consumable', consumableType: 'cure', description: 'Removes all debuffs and DoTs from one ally', price: 55 },
  { id: 'rezzy', name: 'Phoenix Pizza', icon: 'food_pizza', slot: 'consumable', consumableType: 'resurrect', description: 'Resurrects a fallen ally with 30% HP', price: 200 },
];

export function createConsumable(templateId) {
  const template = CONSUMABLE_ITEMS.find(c => c.id === templateId);
  if (!template) return null;
  return {
    ...template,
    id: `${template.id}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    grudgeUuid: null,
    templateId: template.id,
    stats: {},
    tier: 0,
  };
}

export function generateShopInventory(playerLevel, classId) {
  const shopItems = [];
  const maxTier = Math.min(8, Math.max(1, Math.ceil(playerLevel / 3)));
  
  const availableTemplates = allEquipmentTemplates.filter(t => {
    if (t.classReq && !t.classReq.includes(classId)) return false;
    return true;
  });
  
  const shuffled = [...availableTemplates].sort(() => Math.random() - 0.5);
  const count = 8 + Math.floor(Math.random() * 5);
  
  for (let i = 0; i < Math.min(count, shuffled.length); i++) {
    const template = shuffled[i];
    let tier = maxTier;
    const roll = Math.random();
    if (roll < 0.3) tier = Math.max(1, maxTier - 1);
    if (roll < 0.1) tier = Math.max(1, maxTier - 2);
    
    const scaledStats = scaleItemStats(template.stats, tier);
    
    const item = {
      id: `shop_${template.id}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      grudgeUuid: null,
      templateId: template.id,
      name: template.name,
      slot: template.slot,
      icon: template.icon,
      weaponType: template.weaponType || null,
      armorType: template.armorType || null,
      helmetType: template.helmetType || null,
      feetType: template.feetType || null,
      relicType: template.relicType || null,
      tier,
      classReq: template.classReq || null,
      stats: scaledStats,
    };
    shopItems.push(item);
  }

  const potionTypes = ['health_potion', 'mana_potion', 'stamina_potion'];
  for (const pId of potionTypes) {
    const qty = 2 + Math.floor(Math.random() * 3);
    for (let j = 0; j < qty; j++) {
      shopItems.push(createConsumable(pId));
    }
  }
  const extraConsumables = ['speed_potion', 'cure_potion', 'rezzy'];
  for (const cId of extraConsumables) {
    if (Math.random() < (cId === 'rezzy' ? 0.5 : 0.7)) {
      const qty = cId === 'rezzy' ? 1 : (1 + Math.floor(Math.random() * 2));
      for (let j = 0; j < qty; j++) {
        shopItems.push(createConsumable(cId));
      }
    }
  }
  
  return shopItems;
}
