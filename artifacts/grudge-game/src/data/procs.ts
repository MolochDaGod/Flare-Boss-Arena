/**
 * Stone-driven combat procs — bolts, novas, elemental flags, onslaught, blur.
 * Keep pure; GameEngine applies damage + VFX.
 */

import { getStoneCombatMods } from "./stones";

export interface ProcContext {
  isCrit: boolean;
  isSkill: boolean;
  /** Skill damage mult already applied to baseDamage. */
  baseDamage: number;
  spellPower?: number; // 1 + spellDamage from stones
}

export interface ProcResult {
  extraDamage: number;
  heal: number;
  labels: string[];
  fireBolt: boolean;
  nova: boolean;
  burn: boolean;
  frost: boolean;
  shock: boolean;
  particles: boolean;
  onslaughtSec: number;
  /** Element for auto projectile / nova color */
  elementColor: number;
}

const ONSLAUGHT_KEY = "flare:combat:onslaught_until";
const BLUR_KEY = "flare:combat:blur_until";

export function getOnslaughtUntil(): number {
  if (typeof sessionStorage === "undefined") return 0;
  return Number(sessionStorage.getItem(ONSLAUGHT_KEY) ?? 0);
}

export function grantOnslaught(sec: number) {
  if (typeof sessionStorage === "undefined") return;
  const until = Math.max(getOnslaughtUntil(), performance.now() + sec * 1000);
  sessionStorage.setItem(ONSLAUGHT_KEY, String(until));
}

export function isOnslaughtActive(): boolean {
  return performance.now() < getOnslaughtUntil();
}

export function onslaughtAttackSpeedMult(): number {
  return isOnslaughtActive() ? 0.75 : 1;
}

export function grantBlur(sec: number) {
  if (typeof sessionStorage === "undefined") return;
  const until = Math.max(getBlurUntil(), performance.now() + sec * 1000);
  sessionStorage.setItem(BLUR_KEY, String(until));
}

export function getBlurUntil(): number {
  if (typeof sessionStorage === "undefined") return 0;
  return Number(sessionStorage.getItem(BLUR_KEY) ?? 0);
}

export function isBlurActive(): boolean {
  return performance.now() < getBlurUntil();
}

/** Less damage taken while blur is up. */
export function blurDamageMult(): number {
  return isBlurActive() ? 0.45 : 1;
}

export function resolveHitProcs(ctx: ProcContext): ProcResult {
  const s = getStoneCombatMods();
  const spell = ctx.spellPower ?? 1 + s.spellDamage;
  const out: ProcResult = {
    extraDamage: 0,
    heal: 0,
    labels: [],
    fireBolt: false,
    nova: false,
    burn: false,
    frost: false,
    shock: false,
    particles: false,
    onslaughtSec: 0,
    elementColor: 0xffcc66,
  };

  if (s.lifeOnHit > 0) out.heal += Math.round(s.lifeOnHit);

  if (s.procBolt > 0 && Math.random() < s.procBolt) {
    out.fireBolt = true;
    out.extraDamage += Math.floor(ctx.baseDamage * 0.55 * spell);
    out.labels.push("BOLT");
    out.elementColor = 0x66aaff;
  }
  if (s.procNova > 0 && Math.random() < s.procNova) {
    out.nova = true;
    out.extraDamage += Math.floor(ctx.baseDamage * 0.4 * spell);
    out.labels.push("NOVA");
    out.elementColor = 0xff8844;
  }
  if (s.procBurn > 0 && Math.random() < s.procBurn) {
    out.burn = true;
    out.extraDamage += Math.floor(ctx.baseDamage * 0.25);
    out.labels.push("BURN");
    out.elementColor = 0xff5522;
  }
  if (s.procFrost > 0 && Math.random() < s.procFrost) {
    out.frost = true;
    out.labels.push("CHILL");
    out.elementColor = 0x88ddff;
  }
  if (s.procShock > 0 && Math.random() < s.procShock) {
    out.shock = true;
    out.extraDamage += Math.floor(ctx.baseDamage * 0.2);
    out.labels.push("SHOCK");
    out.elementColor = 0xaaddff;
  }
  if (s.procParticles > 0 && Math.random() < s.procParticles) {
    out.particles = true;
  }
  if (ctx.isCrit && s.procNova > 0 && Math.random() < s.procNova * 0.5) {
    out.nova = true;
    out.extraDamage += Math.floor(ctx.baseDamage * 0.35);
    out.labels.push("CRIT NOVA");
  }

  return out;
}

export function resolveKillProcs(): ProcResult {
  const s = getStoneCombatMods();
  const out: ProcResult = {
    extraDamage: 0,
    heal: 0,
    labels: [],
    fireBolt: false,
    nova: false,
    burn: false,
    frost: false,
    shock: false,
    particles: false,
    onslaughtSec: 0,
    elementColor: 0xffee88,
  };
  if (s.onslaught > 0 && Math.random() < s.onslaught) {
    out.onslaughtSec = 3;
    out.labels.push("ONSLAUGHT");
    grantOnslaught(3);
  }
  return out;
}

/** When player is hit — chance to blur. */
export function tryBlurOnHitTaken(): boolean {
  const s = getStoneCombatMods();
  if (s.procBlur > 0 && Math.random() < s.procBlur) {
    grantBlur(1.2);
    return true;
  }
  return false;
}
