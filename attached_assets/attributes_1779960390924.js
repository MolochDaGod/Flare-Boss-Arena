import { CLASS_TIERS } from './classes';

export const TOTAL_POINTS_AT_LEVEL = (level) => 20 + (level * 7);
export const MAX_LEVEL = 20;
export const POINTS_PER_LEVEL = 7;
export const STARTING_POINTS = 20;

export const attributeDefinitions = {
  Strength: {
    description: "Physical might and raw power.",
    fullDescription: "Increases raw damage output, physical defense, and health. Warriors and melee builds scale heavily with Strength.",
    color: '#ef4444',
    icon: '/images/attributes/strength.png',
    gains: {
      health: { label: "Health", value: 5 },
      physicalDamage: { label: "Physical Damage", value: 1.25 },
      defense: { label: "Physical Defense", value: 4 },
      block: { label: "Block Chance", value: 0.2 },
      drainHealth: { label: "Lifesteal", value: 0.075 },
      stagger: { label: "Stagger on Hit", value: 0.04 },
      mana: { label: "Mana Pool", value: 1 },
      stamina: { label: "Stamina", value: 0.8 },
      accuracy: { label: "Attack Accuracy", value: 0.08 },
      healthRegen: { label: "Health Regen/s", value: 0.02 },
      damageReduction: { label: "Damage Reduction", value: 0.02 },
    }
  },
  Intellect: {
    description: "Mental acuity and spellcasting power.",
    fullDescription: "Powers magical damage, mana regeneration, and ability cooldown reduction. Casters scale directly with Intellect.",
    color: '#3b82f6',
    icon: '/images/attributes/intellect.png',
    gains: {
      mana: { label: "Mana Pool", value: 9 },
      magicDamage: { label: "Magic Damage", value: 1.5 },
      defense: { label: "Magical Defense", value: 2 },
      manaRegen: { label: "Mana Regen/s", value: 0.04 },
      cooldownReduction: { label: "Cooldown Reduction", value: 0.075 },
      spellAccuracy: { label: "Spell Accuracy", value: 0.15 },
      health: { label: "Health", value: 3 },
      stamina: { label: "Stamina", value: 0.4 },
      accuracy: { label: "Attack Accuracy", value: 0.1 },
      abilityCost: { label: "Ability Cost Reduction", value: 0.05 },
    }
  },
  Vitality: {
    description: "Physical endurance and life force.",
    fullDescription: "Maximizes health pool and provides passive health regeneration. Vital for tanks and sustained damage builds.",
    color: '#22c55e',
    icon: '/images/attributes/vitality.png',
    gains: {
      health: { label: "Health", value: 25 },
      defense: { label: "Physical Defense", value: 1.5 },
      healthRegen: { label: "Health Regen/s", value: 0.06 },
      damageReduction: { label: "Damage Reduction", value: 0.04 },
      bleedResist: { label: "Bleed Resistance", value: 0.15 },
      mana: { label: "Mana Pool", value: 1.5 },
      stamina: { label: "Stamina", value: 1 },
      resistance: { label: "Magic Resistance", value: 0.08 },
      armor: { label: "Armor Rating", value: 0.2 },
    }
  },
  Dexterity: {
    description: "Hand-eye coordination and finesse.",
    fullDescription: "Dominates critical chance, attack speed, and accuracy. Rogues and archers scale with Dexterity.",
    color: '#f59e0b',
    icon: '/images/attributes/dexterity.png',
    gains: {
      physicalDamage: { label: "Physical Damage", value: 0.9 },
      criticalChance: { label: "Critical Chance", value: 0.3 },
      accuracy: { label: "Attack Accuracy", value: 0.25 },
      attackSpeed: { label: "Attack Speed", value: 0.2 },
      evasion: { label: "Evasion Chance", value: 0.125 },
      criticalDamage: { label: "Critical Damage", value: 0.2 },
      defense: { label: "Physical Defense", value: 1.2 },
      stamina: { label: "Stamina", value: 0.6 },
      movementSpeed: { label: "Movement Speed", value: 0.08 },
      health: { label: "Health", value: 3 },
    }
  },
  Endurance: {
    description: "Stamina reserves and physical resistance.",
    fullDescription: "Builds stamina for abilities and provides armor scaling. High Endurance enables higher block effectiveness.",
    color: '#6b7280',
    icon: '/images/attributes/endurance.png',
    gains: {
      stamina: { label: "Stamina", value: 6 },
      defense: { label: "Physical Defense", value: 5 },
      blockEffect: { label: "Block Effectiveness", value: 0.175 },
      ccResistance: { label: "CC Duration Reduction", value: 0.1 },
      armor: { label: "Armor Rating", value: 0.6 },
      defenseBreakResist: { label: "Armor Break Resistance", value: 0.125 },
      health: { label: "Health", value: 8 },
      mana: { label: "Mana Pool", value: 1 },
      healthRegen: { label: "Health Regen/s", value: 0.02 },
      block: { label: "Block Chance", value: 0.12 },
    }
  },
  Wisdom: {
    description: "Mental fortitude and magical resilience.",
    fullDescription: "Primary counter to magical damage. Scales resistance and provides magic immunity scaling.",
    color: '#a855f7',
    icon: '/images/attributes/wisdom.png',
    gains: {
      mana: { label: "Mana Pool", value: 6 },
      magicDamage: { label: "Magic Damage", value: 0.8 },
      defense: { label: "Magical Defense", value: 5.5 },
      resistance: { label: "Magic Resistance", value: 0.25 },
      cdrResist: { label: "CDR Resistance", value: 0.2 },
      statusEffect: { label: "Status Effect Duration Reduction", value: 0.075 },
      spellblock: { label: "Spell Block Chance", value: 0.125 },
      health: { label: "Health", value: 4 },
      stamina: { label: "Stamina", value: 0.5 },
      damageReduction: { label: "Damage Reduction", value: 0.03 },
      spellAccuracy: { label: "Spell Accuracy", value: 0.1 },
    }
  },
  Agility: {
    description: "Speed, reflexes, and positioning.",
    fullDescription: "Increases movement speed, dodge chance, and evasion. Synergizes with high-risk playstyles.",
    color: '#06b6d4',
    icon: '/images/attributes/agility.png',
    gains: {
      movementSpeed: { label: "Movement Speed", value: 0.15 },
      evasion: { label: "Evasion Chance", value: 0.225 },
      dodge: { label: "Dodge Cooldown Reduction", value: 0.15 },
      criticalEvasion: { label: "Crit Evasion", value: 0.25 },
      stamina: { label: "Stamina", value: 1 },
      accuracy: { label: "Attack Accuracy", value: 0.1 },
      attackSpeed: { label: "Attack Speed", value: 0.05 },
      physicalDamage: { label: "Physical Damage", value: 0.3 },
      health: { label: "Health", value: 3 },
    }
  },
  Tactics: {
    description: "Strategic thinking and ability control.",
    fullDescription: "Expertise in ability execution and resource management. Grants scaling bonus to all stats based on invested points.",
    color: '#64748b',
    icon: '/images/attributes/tactics.png',
    gains: {
      stamina: { label: "Stamina", value: 3 },
      abilityCost: { label: "Ability Cost Reduction", value: 0.075 },
      armorPenetration: { label: "Armor Penetration", value: 0.2 },
      blockPenetration: { label: "Block Penetration", value: 0.175 },
      defenseBreak: { label: "Defense Break Power", value: 0.1 },
      comboCooldownRed: { label: "Combo Cooldown Reduction", value: 0.125 },
      physicalDamage: { label: "Physical Damage", value: 0.25 },
      magicDamage: { label: "Magic Damage", value: 0.15 },
      defense: { label: "Physical Defense", value: 1 },
      mana: { label: "Mana Pool", value: 1.5 },
      cooldownReduction: { label: "Cooldown Reduction", value: 0.05 },
      health: { label: "Health", value: 3 },
    }
  }
};

export const baseStats = {
  health: 250, mana: 100, stamina: 100, physicalDamage: 0, magicDamage: 0, defense: 0,
  block: 0, blockEffect: 0, evasion: 0, accuracy: 0, criticalChance: 0,
  criticalDamage: 50, attackSpeed: 0, movementSpeed: 0, resistance: 0,
  cdrResist: 0, defenseBreakResist: 0, armorPenetration: 0, blockPenetration: 0,
  defenseBreak: 0, drainHealth: 0, manaRegen: 0, healthRegen: 0,
  cooldownReduction: 0, abilityCost: 0, spellAccuracy: 0, stagger: 0,
  ccResistance: 0, armor: 0, damageReduction: 0, bleedResist: 0,
  statusEffect: 0, spellblock: 0, dodge: 0, criticalEvasion: 0,
  comboCooldownRed: 0
};

export const statCaps = {
  block: 75, criticalChance: 75, blockEffect: 90, criticalDamage: 300,
  accuracy: 95, resistance: 95, drainHealth: 50, evasion: 60,
  damageReduction: 60, spellblock: 50
};

export function calculateEffectivePoints(rawPoints) {
  if (rawPoints <= 25) return rawPoints;
  if (rawPoints <= 50) return 25 + (rawPoints - 25) * 0.5;
  return 25 + 12.5 + (rawPoints - 50) * 0.25;
}

export function calculateStats(attributePoints, level = 0) {
  const stats = { ...baseStats };
  stats.health += level * 10;
  stats.mana += level * 5;
  stats.stamina += level * 3;
  stats.physicalDamage += level * 2;
  stats.magicDamage += level * 1.5;
  stats.defense += level * 2;

  const tacticsPoints = attributePoints.Tactics || 0;

  Object.entries(attributePoints).forEach(([attr, points]) => {
    const def = attributeDefinitions[attr];
    if (def && points > 0) {
      const effective = calculateEffectivePoints(points);
      Object.entries(def.gains).forEach(([key, gain]) => {
        if (stats[key] !== undefined) {
          stats[key] += gain.value * effective;
        }
      });
    }
  });

  if (tacticsPoints > 0) {
    const tacticsBonus = tacticsPoints * 0.5;
    Object.entries(stats).forEach(([key, value]) => {
      if (key !== 'health' && key !== 'mana' && key !== 'stamina' && typeof value === 'number') {
        stats[key] *= (1 + (tacticsBonus / 100));
      }
    });
  }

  Object.entries(statCaps).forEach(([key, cap]) => {
    if (stats[key] > cap) stats[key] = cap;
  });

  return stats;
}

export function calculateCombatPower(stats) {
  const ehp = stats.health * (1 + (stats.defense / 100)) * (1 + (stats.resistance / 100));
  const bestDmg = Math.max(stats.physicalDamage || 0, stats.magicDamage || 0);
  const dps = (bestDmg + 10) * (1 + (stats.criticalChance / 100) * (stats.criticalDamage / 100)) * (1 + (stats.attackSpeed / 100));
  const utility = (stats.cooldownReduction * 2) + (stats.manaRegen * 10) + (stats.movementSpeed * 2);
  return Math.floor((ehp * 0.4) + (dps * 2.5) + (utility * 5));
}

const CLASS_NAMES = (() => {
  const n = [];
  const p = ["Void", "Solar", "Lunar", "Star", "Chaos", "Holy", "Dark", "Blood", "Iron", "Storm", "Frost", "Fire", "Wind", "Earth", "Spirit", "Mind", "Soul", "Time", "Space", "Life"];
  const r = ["Walker", "Weaver", "Lord", "King", "Queen", "God", "Titan", "Slayer", "Breaker", "Maker", "Seer", "Sage", "Guard", "Blade", "Fist", "Shield", "Heart", "Eye", "Hand", "Wing"];
  n.push("Primordial God-King", "Eternal Void Walker", "Celestial Archon", "Omniscient Sage", "Timeless Sentinel", "Reality Weaver", "Abyssal Sovereign", "Divine Arbiter", "Cosmic Guardian", "Transcendent Being");
  for (let i = 0; i < 40; i++) n.push(`${p[i % 20]} ${r[i % 20]} Warlord`);
  for (let i = 0; i < 50; i++) n.push(`Epic ${p[i % 20]} ${r[i % 20]}`);
  for (let i = 0; i < 100; i++) n.push(`${p[i % 20]} ${r[i % 20]}`);
  for (let i = 0; i < 100; i++) n.push(`Novice ${r[i % 20]}`);
  return n;
})();

export function calculateBuildScore(stats, attributePoints) {
  const cp = calculateCombatPower(stats);
  let score = (cp / 6000) * 100;

  const totalPts = Object.values(attributePoints).reduce((a, b) => a + b, 0);
  if (totalPts === 0) return 0;

  const norm = {};
  for (const k of Object.keys(attributePoints)) {
    norm[k] = (attributePoints[k] || 0) / Math.max(totalPts, 1);
  }

  const synergy = Math.max(
    (norm.Strength || 0) + (norm.Vitality || 0) + (norm.Endurance || 0),
    (norm.Intellect || 0) + (norm.Wisdom || 0) + (norm.Tactics || 0),
    (norm.Dexterity || 0) + (norm.Agility || 0) + (norm.Strength || 0),
    (norm.Tactics || 0) + (norm.Endurance || 0) + (norm.Wisdom || 0),
  ) * 20;

  return Math.min(100, score + synergy);
}

export function getBuildClassification(stats, attributePoints) {
  const score = calculateBuildScore(stats, attributePoints);
  const rank = Math.max(1, Math.min(300, Math.floor(301 - (score * 3))));
  const tier = CLASS_TIERS.find(t => rank >= t.minRank && rank <= t.maxRank) || CLASS_TIERS[CLASS_TIERS.length - 1];
  const name = CLASS_NAMES[rank - 1] || 'Unknown Entity';

  let rating = 'F';
  if (score > 90) rating = 'S+';
  else if (score > 80) rating = 'S';
  else if (score > 70) rating = 'A';
  else if (score > 60) rating = 'B';
  else if (score > 50) rating = 'C';
  else if (score > 30) rating = 'D';

  return { name, tier: tier.name, rank, tierColor: tier.color, desc: tier.desc, rating, score };
}

export function getRadarData(stats) {
  const maxHP = 3000;
  const maxDmg = 500;
  return {
    labels: ['Survivability', 'Damage', 'Utility', 'Mobility', 'Control', 'Magic'],
    values: [
      Math.min(100, ((stats.health || 0) / maxHP) * 100 + ((stats.defense || 0) / 500) * 50),
      Math.min(100, (Math.max(stats.physicalDamage || 0, stats.magicDamage || 0) / maxDmg) * 100 + (stats.criticalChance || 0)),
      Math.min(100, (stats.cooldownReduction || 0) * 2 + (stats.manaRegen || 0) * 5),
      Math.min(100, (stats.movementSpeed || 0) * 5 + (stats.evasion || 0)),
      Math.min(100, (stats.block || 0) + (stats.stagger || 0) * 2),
      Math.min(100, (stats.resistance || 0) + (stats.mana || 0) / 20),
    ],
  };
}
