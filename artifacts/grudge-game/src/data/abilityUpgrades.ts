/**
 * Ability upgrades + support "links" (PoE-lite).
 * Each fighter skill can be leveled and socketed with up to 2 supports that
 * grant more multipliers and procs.
 */

import { getWallet, saveWallet } from "./wallet";

export type SupportId =
  | "more_damage"
  | "added_fire"
  | "added_cold"
  | "added_lightning"
  | "increased_aoe"
  | "faster_cast"
  | "crit_chance"
  | "chance_to_bleed"
  | "chance_to_shock"
  | "onslaught"
  | "life_gain";

export interface SupportGem {
  id: SupportId;
  name: string;
  description: string;
  glyph: string;
  /** Gold cost to unlock once. */
  unlockCost: number;
}

export const SUPPORTS: SupportGem[] = [
  { id: "more_damage", name: "Controlled Destruction", description: "30% more skill damage.", glyph: "💥", unlockCost: 120 },
  { id: "added_fire", name: "Fire Penetration", description: "Adds 20% of damage as fire + burn proc.", glyph: "🔥", unlockCost: 100 },
  { id: "added_cold", name: "Hypothermia", description: "Adds 18% cold + chill on hit.", glyph: "❄", unlockCost: 100 },
  { id: "added_lightning", name: "Lightning Strike", description: "Adds 18% lightning + shock proc.", glyph: "⚡", unlockCost: 100 },
  { id: "increased_aoe", name: "Concentrated Effect", description: "35% increased area of effect.", glyph: "◎", unlockCost: 90 },
  { id: "faster_cast", name: "Faster Casting", description: "20% reduced skill cooldown.", glyph: "⏱", unlockCost: 110 },
  { id: "crit_chance", name: "Increased Critical", description: "+12% crit chance on this skill.", glyph: "✦", unlockCost: 130 },
  { id: "chance_to_bleed", name: "Chance to Bleed", description: "25% chance to bleed (DoT).", glyph: "🩸", unlockCost: 80 },
  { id: "chance_to_shock", name: "Innervate", description: "20% chance to shock (take more dmg).", glyph: "💫", unlockCost: 80 },
  { id: "onslaught", name: "Onslaught", description: "Kill → 3s attack speed.", glyph: "💨", unlockCost: 150 },
  { id: "life_gain", name: "Life Gain on Hit", description: "Recover 6 life per skill hit.", glyph: "❤", unlockCost: 90 },
];

export const SUPPORT_BY_ID = new Map(SUPPORTS.map((s) => [s.id, s]));

export interface SkillUpgradeState {
  /** 0–5 */
  level: number;
  supports: SupportId[];
}

export type UpgradeMap = Record<string, SkillUpgradeState>; // skillId → state

const UP_KEY = "flare:skill:upgrades";
const UNLOCK_KEY = "flare:skill:supports_unlocked";
const MAX_LEVEL = 5;
const MAX_LINKS = 2;

export function getSkillUpgrades(): UpgradeMap {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(UP_KEY);
    return raw ? (JSON.parse(raw) as UpgradeMap) : {};
  } catch {
    return {};
  }
}

export function saveSkillUpgrades(map: UpgradeMap) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(UP_KEY, JSON.stringify(map));
}

export function getUnlockedSupports(): SupportId[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(UNLOCK_KEY);
    return raw ? (JSON.parse(raw) as SupportId[]) : [];
  } catch {
    return [];
  }
}

export function saveUnlockedSupports(ids: SupportId[]) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(UNLOCK_KEY, JSON.stringify([...new Set(ids)]));
}

export function getSkillState(skillId: string): SkillUpgradeState {
  return getSkillUpgrades()[skillId] ?? { level: 0, supports: [] };
}

export function levelCost(nextLevel: number): number {
  return 80 + nextLevel * 60;
}

export function upgradeSkill(skillId: string): { ok: boolean; message: string } {
  const map = getSkillUpgrades();
  const st = map[skillId] ?? { level: 0, supports: [] };
  if (st.level >= MAX_LEVEL) return { ok: false, message: "Max rank (5)." };
  const cost = levelCost(st.level + 1);
  const w = getWallet();
  if (w.gold < cost) return { ok: false, message: `Need ${cost} gold.` };
  saveWallet({ ...w, gold: w.gold - cost });
  st.level += 1;
  map[skillId] = st;
  saveSkillUpgrades(map);
  return { ok: true, message: `${skillId} → rank ${st.level}` };
}

export function unlockSupport(id: SupportId): { ok: boolean; message: string } {
  const def = SUPPORT_BY_ID.get(id);
  if (!def) return { ok: false, message: "Unknown support." };
  const unlocked = getUnlockedSupports();
  if (unlocked.includes(id)) return { ok: false, message: "Already unlocked." };
  const w = getWallet();
  if (w.gold < def.unlockCost) return { ok: false, message: `Need ${def.unlockCost} gold.` };
  saveWallet({ ...w, gold: w.gold - def.unlockCost });
  saveUnlockedSupports([...unlocked, id]);
  return { ok: true, message: `${def.name} unlocked.` };
}

export function linkSupport(skillId: string, supportId: SupportId): { ok: boolean; message: string } {
  if (!getUnlockedSupports().includes(supportId)) {
    return { ok: false, message: "Unlock support first." };
  }
  const map = getSkillUpgrades();
  const st = map[skillId] ?? { level: 0, supports: [] };
  if (st.supports.includes(supportId)) return { ok: false, message: "Already linked." };
  if (st.supports.length >= MAX_LINKS) return { ok: false, message: `Max ${MAX_LINKS} links.` };
  st.supports = [...st.supports, supportId];
  map[skillId] = st;
  saveSkillUpgrades(map);
  return { ok: true, message: `Linked ${supportId}.` };
}

export function unlinkSupport(skillId: string, supportId: SupportId) {
  const map = getSkillUpgrades();
  const st = map[skillId];
  if (!st) return;
  st.supports = st.supports.filter((s) => s !== supportId);
  map[skillId] = st;
  saveSkillUpgrades(map);
}

/** Resolved multipliers for a skill cast. */
export interface SkillCombatBoost {
  damageMult: number;
  aoeMult: number;
  cooldownMult: number;
  critBonus: number;
  elemental: { fire: number; cold: number; lightning: number };
  lifeOnHit: number;
  procBleed: number;
  procShock: number;
  procOnslaughtOnKill: number;
  burnOnHit: number;
  chillOnHit: number;
}

export function resolveSkillBoost(skillId: string): SkillCombatBoost {
  const st = getSkillState(skillId);
  const boost: SkillCombatBoost = {
    damageMult: 1 + st.level * 0.08,
    aoeMult: 1 + st.level * 0.04,
    cooldownMult: Math.max(0.7, 1 - st.level * 0.03),
    critBonus: st.level * 0.01,
    elemental: { fire: 0, cold: 0, lightning: 0 },
    lifeOnHit: 0,
    procBleed: 0,
    procShock: 0,
    procOnslaughtOnKill: 0,
    burnOnHit: 0,
    chillOnHit: 0,
  };
  for (const sid of st.supports) {
    switch (sid) {
      case "more_damage":
        boost.damageMult *= 1.3;
        break;
      case "added_fire":
        boost.elemental.fire += 0.2;
        boost.burnOnHit += 0.15;
        break;
      case "added_cold":
        boost.elemental.cold += 0.18;
        boost.chillOnHit += 0.2;
        break;
      case "added_lightning":
        boost.elemental.lightning += 0.18;
        boost.procShock += 0.2;
        break;
      case "increased_aoe":
        boost.aoeMult *= 1.35;
        break;
      case "faster_cast":
        boost.cooldownMult *= 0.8;
        break;
      case "crit_chance":
        boost.critBonus += 0.12;
        break;
      case "chance_to_bleed":
        boost.procBleed += 0.25;
        break;
      case "chance_to_shock":
        boost.procShock += 0.2;
        break;
      case "onslaught":
        boost.procOnslaughtOnKill += 1;
        break;
      case "life_gain":
        boost.lifeOnHit += 6;
        break;
    }
  }
  return boost;
}

export { MAX_LEVEL, MAX_LINKS };
