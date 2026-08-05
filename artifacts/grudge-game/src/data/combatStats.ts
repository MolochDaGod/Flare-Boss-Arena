/**
 * Shared combat vitals — stat-based mana / HP regen used by all scenes.
 */

export interface RegenStats {
  level: number;
  /** 0–20 typical from attributes */
  intellect?: number;
  wisdom?: number;
  vitality?: number;
  endurance?: number;
  /** Active combat? slower mana */
  inCombat?: boolean;
  /** Shrine / perk flat bonuses */
  manaRegenBonus?: number;
  hpRegenBonus?: number;
}

/** Mana per second from Intellect + Wisdom + level. */
export function manaRegenPerSec(s: RegenStats): number {
  const intel = s.intellect ?? 4;
  const wis = s.wisdom ?? 3;
  const base = 4.5 + intel * 0.85 + wis * 0.55 + s.level * 0.25;
  const combat = s.inCombat ? 0.55 : 1;
  return (base + (s.manaRegenBonus ?? 0)) * combat;
}

/** HP per second (out of combat higher). */
export function hpRegenPerSec(s: RegenStats): number {
  const vit = s.vitality ?? 3;
  const end_ = s.endurance ?? 2;
  const base = 2.5 + vit * 0.45 + end_ * 0.25 + s.level * 0.12;
  const combat = s.inCombat ? 0.35 : 1;
  return (base + (s.hpRegenBonus ?? 0)) * combat;
}

export function applyRegen(
  current: number,
  max: number,
  perSec: number,
  dt: number,
): number {
  if (current >= max) return max;
  return Math.min(max, current + perSec * dt);
}
