/**
 * @grudge/game-data — Combat Engine
 *
 * Canonical damage pipeline and combat utilities extracted from GrudgeWars.
 * Every Grudge game should use these functions to ensure consistent combat math.
 *
 * Pipeline: base damage → buff multipliers → ability multiplier → defense
 *           → damage reduction → variance → block → crit → floor → drain → row modifiers
 */

// ── Damage Pipeline ─────────────────────────────────────────────────────────

/**
 * Calculate attack damage from attacker → defender using an ability.
 * Returns { totalDmg, isCrit, blocked, evaded, drained, absorbed }.
 *
 * @param {object} attacker - unit with stats, buffs, focusStacks, etc.
 * @param {object} defender - target unit
 * @param {object} ability  - { type, damage, guaranteedCrit, ... }
 * @param {object} [opts]   - { applyRowModifiers: fn, debug: bool }
 */
export function calculateAttackDamage(attacker, defender, ability, opts = {}) {
  const dbg = opts.debug ? (label, val) => console.log(`[DMG] ${label}:`, val) : () => {};

  // Step 1: Evasion buffs
  let evasionBonus = 0;
  (defender.buffs || []).forEach(b => {
    if (b.stat === 'evasion' && b.flat) evasionBonus += b.flat;
  });

  // Step 2: Invincibility
  const isInvincible = (defender.buffs || []).some(b => b.source === 'Invincible');
  if (isInvincible) {
    dbg('Invincible', true);
    return { totalDmg: 0, isCrit: false, blocked: false, evaded: false, drained: 0, absorbed: true };
  }

  // Step 1 cont: Evasion roll
  const totalEvasion = (defender.evasion || 0) + evasionBonus;
  if (Math.random() * 100 < totalEvasion) {
    dbg('Evaded', { totalEvasion });
    return { totalDmg: 0, isCrit: false, blocked: false, evaded: true, drained: 0 };
  }

  // Step 3: Base damage (stat + level scaling)
  const isMagic = ability.type === 'magical';
  let baseDmg = isMagic
    ? (attacker.magicDamage || attacker.damage || 0)
    : (attacker.physicalDamage || attacker.damage || 0);
  baseDmg += (attacker.level || 1) * 2;
  dbg('BaseDmg', baseDmg);

  // Step 4: Damage buffs (multiplicative stacking)
  let dmgMult = 1;
  let dmgFlat = 0;
  (attacker.buffs || []).forEach(b => {
    if (b.stat === 'damage') {
      if (b.multiplier) dmgMult *= b.multiplier;
      if (b.flat) dmgFlat += b.flat;
    }
  });
  baseDmg = Math.floor((baseDmg + dmgFlat) * dmgMult);
  dbg('After buffs', { baseDmg, dmgFlat, dmgMult });

  // Step 5: Ability multiplier
  let totalDmg = Math.floor(baseDmg * (ability.damage || 1));
  dbg('After ability mult', { mult: ability.damage || 1, totalDmg });

  // Step 6: Defense (√defense as %, capped 80%)
  let defenseVal = defender.defense || 0;
  (defender.buffs || []).forEach(b => {
    if (b.stat === 'defense' && b.flat) defenseVal += b.flat;
  });
  const attackerDefBreak = attacker.defenseBreak || 0;
  if (attackerDefBreak > 0) {
    defenseVal = Math.max(0, defenseVal * (1 - attackerDefBreak / 100));
  }
  const defReduction = Math.min(80, Math.sqrt(Math.max(0, defenseVal)));
  totalDmg = Math.floor(totalDmg * (100 - defReduction) / 100);
  dbg('After defense', { defenseVal, defReduction: defReduction.toFixed(1) + '%', totalDmg });

  // Step 7: Damage reduction (flat %, capped 80%)
  const cappedDR = Math.min(80, defender.damageReduction || 0);
  if (cappedDR > 0) {
    totalDmg = Math.floor(totalDmg * (1 - cappedDR / 100));
  }

  // Step 8: Variance [0.75, 1.25)
  const variance = 0.75 + Math.random() * 0.5;
  totalDmg = Math.floor(totalDmg * variance);

  // Step 9: Block (reduces by blockEffect %, prevents crit and drain)
  let blocked = false;
  let isCrit = false;

  if (Math.random() * 100 < (defender.block || 0)) {
    const blockFactor = Math.min(90, defender.blockEffect || 0) / 100;
    const reduction = blockFactor > 0 ? blockFactor : 0.6;
    totalDmg = Math.floor(totalDmg * (1 - reduction));
    blocked = true;
    dbg('Blocked', { blockEffect: reduction, totalDmg });
  }

  // Step 10: Crit (only if not blocked)
  if (!blocked) {
    let effectiveCritChance = attacker.critChance || 5;
    const critEvasion = defender.criticalEvasion || 0;
    effectiveCritChance = Math.max(0, effectiveCritChance - critEvasion);
    if (attacker.focusStacks > 0) {
      effectiveCritChance += attacker.focusStacks * 10;
    }
    effectiveCritChance = Math.min(100, effectiveCritChance);
    isCrit = ability.guaranteedCrit || attacker.guaranteedCrit || Math.random() * 100 < effectiveCritChance;
    if (isCrit) {
      const critFactor = 1 + ((attacker.criticalDamage || 50) / 100);
      totalDmg = Math.floor(totalDmg * critFactor);
      dbg('Crit', { effectiveCritChance, critFactor, totalDmg });
      if (attacker.focusStacks > 0) {
        attacker.focusStacks = 0;
        attacker.guaranteedCrit = false;
      }
    }
  }

  // Step 11: Floor (minimum 1 damage)
  totalDmg = Math.max(1, totalDmg);

  // Step 12: Life drain (blocked attacks don't drain)
  let drained = 0;
  if ((attacker.drainHealth || 0) > 0 && totalDmg > 0 && !blocked) {
    drained = Math.floor(totalDmg * (attacker.drainHealth / 100));
  }

  let result = { totalDmg, isCrit, blocked, evaded: false, drained };

  // Step 13: Row modifiers (optional — provided by caller)
  if (opts.applyRowModifiers) {
    result = opts.applyRowModifiers(attacker, defender, ability, result);
  }

  return result;
}

// ── AI Action Selection ─────────────────────────────────────────────────────

/**
 * Choose an AI action for a unit.
 * @param {object} unit - the acting unit
 * @param {object[]} allUnits - all battle units
 * @param {object} [opts] - { companionDefs, getAIRowPreference }
 * @returns {{ abilityId, targetId } | { type: 'move_row', targetRow } | null}
 */
export function chooseAIAction(unit, allUnits, opts = {}) {
  const allies = allUnits.filter(u => u.team === unit.team && u.alive && u.health > 0);
  const enemies = allUnits.filter(u => u.team !== unit.team && u.alive && u.health > 0);
  if (enemies.length === 0 || !unit.abilities?.length) return null;

  // Healer AI: prioritize low allies
  if (unit.team === 'player' && (unit.classId === 'mage' || unit.classId === 'priest')) {
    const lowAlly = allies.find(a => a.health / a.maxHealth < 0.45);
    const healAbility = unit.abilities.find(a =>
      (a.type === 'heal' || a.type === 'heal_over_time') &&
      (unit.cooldowns[a.id] || 0) <= 0 && (a.manaCost || 0) <= unit.mana
    );
    if (lowAlly && healAbility) return { abilityId: healAbility.id, targetId: lowAlly.id };
  }

  const availableAbilities = unit.abilities.filter(a =>
    (unit.cooldowns[a.id] || 0) <= 0 &&
    (a.manaCost || 0) <= unit.mana &&
    (a.staminaCost || 0) <= unit.stamina &&
    !(a.isDemonBlade && unit.demonBlade)
  );
  if (availableAbilities.length === 0) return null;

  const attackAbilities = availableAbilities.filter(a => a.type === 'physical' || a.type === 'magical');
  const buffAbilities = availableAbilities.filter(a => a.type === 'buff');
  const healAbilities = availableAbilities.filter(a => a.type === 'heal');

  // Buff if no active buffs
  if (buffAbilities.length > 0 && unit.buffs.length === 0 && Math.random() < 0.3) {
    return { abilityId: buffAbilities[0].id, targetId: unit.id };
  }

  // Resurrect dead allies
  const resAbilities = availableAbilities.filter(a => a.type === 'resurrect' || a.isResurrect);
  if (resAbilities.length > 0) {
    const deadAlly = [...allies, ...enemies].find(a => a.team === unit.team && !a.alive && a.id !== unit.id);
    if (deadAlly && Math.random() < 0.7) return { abilityId: resAbilities[0].id, targetId: deadAlly.id };
  }

  // Heal low allies
  if (healAbilities.length > 0) {
    if (unit.team === 'player') {
      const lowAlly = allies.find(a => a.health / a.maxHealth < 0.45);
      if (lowAlly) return { abilityId: healAbilities[0].id, targetId: lowAlly.id };
    } else {
      const lowAlly = allies.filter(a => a.alive && a.id !== unit.id)
        .sort((a, b) => (a.health / a.maxHealth) - (b.health / b.maxHealth))[0];
      if (lowAlly && lowAlly.health / lowAlly.maxHealth < 0.5 && Math.random() < 0.6) {
        return { abilityId: healAbilities[0].id, targetId: lowAlly.id };
      }
      if (unit.health / unit.maxHealth < 0.5 && Math.random() < 0.6) {
        return { abilityId: healAbilities[0].id, targetId: unit.id };
      }
    }
  }

  // Row movement
  if (opts.getAIRowPreference) {
    const preferredRow = opts.getAIRowPreference(unit, allUnits);
    if (preferredRow && preferredRow !== unit.row && Math.random() < 0.4) {
      return { type: 'move_row', targetRow: preferredRow };
    }
  }

  // Attack selection
  const specials = attackAbilities.filter(a => a.cooldown && a.cooldown > 0);
  let ability;
  if (specials.length > 0 && Math.random() < 0.45) {
    ability = specials[Math.floor(Math.random() * specials.length)];
  } else if (attackAbilities.length > 0) {
    ability = attackAbilities[0];
  } else {
    ability = availableAbilities[0];
  }
  if (!ability) return null;

  // Target selection (taunt → low HP → random)
  let target;
  const companionDefs = opts.companionDefs || {};
  const taunter = enemies.find(e => e.isCompanion && e.companionType === 'twig_companion' && e.alive);
  if (taunter && Math.random() < (companionDefs?.twig_companion?.tauntChance || 0.30)) {
    target = taunter;
  } else if (Math.random() < 0.6) {
    target = enemies.filter(e => !e.isTotem).reduce((low, e) => e.health < low.health ? e : low, enemies.filter(e => !e.isTotem)[0]);
  } else {
    const nonTotem = enemies.filter(e => !e.isTotem);
    target = nonTotem[Math.floor(Math.random() * nonTotem.length)] || enemies[0];
  }

  return { abilityId: ability.id, targetId: target.id };
}

// ── Status Effect Helpers ───────────────────────────────────────────────────

/** Tick all buff/debuff durations, removing expired ones. Returns cleaned array. */
export function tickBuffs(buffs) {
  return (buffs || [])
    .map(b => ({ ...b, duration: (b.duration || 0) - 1 }))
    .filter(b => b.duration > 0);
}

/** Tick DoTs, returning { damage, expired }. */
export function tickDoTs(dots, unit) {
  let totalDmg = 0;
  const remaining = [];
  for (const dot of (dots || [])) {
    const dmg = Math.max(1, Math.floor((unit.maxHealth || 100) * (dot.damage || 0)));
    totalDmg += dmg;
    const next = { ...dot, duration: (dot.duration || 0) - 1 };
    if (next.duration > 0) remaining.push(next);
  }
  return { damage: totalDmg, remaining };
}

/** Calculate speed-based turn order for a list of units. */
export function calculateTurnOrder(units) {
  return [...units]
    .filter(u => u.alive)
    .sort((a, b) => (b.speed || 0) - (a.speed || 0))
    .map(u => u.id);
}

// ── Stat Calculation ────────────────────────────────────────────────────────

/**
 * Calculate combat power score for a unit (used for ranking).
 * @param {object} stats - computed stats object
 * @returns {number} combat power score
 */
export function calculateCombatPower(stats) {
  return Math.floor(
    (stats.health || 0) * 0.5 +
    (stats.physicalDamage || 0) * 3 +
    (stats.magicDamage || 0) * 3 +
    (stats.defense || 0) * 2 +
    (stats.mana || 0) * 0.3 +
    (stats.stamina || 0) * 0.3 +
    (stats.criticalChance || 0) * 2 +
    (stats.evasion || 0) * 1.5 +
    (stats.block || 0) * 1.5
  );
}
