/**
 * Flare Boss Arena perks — purchasable combat modifiers that actually apply
 * in the dungeon (auto-attack slash waves, longer slashes, bigger AoE).
 */

import { PERK_COLORS, PERK_LABELS, type PerkId } from "./worldProps";
import { getWallet, saveWallet } from "./wallet";

export type { PerkId };

export interface PerkCombatMods {
  /** Multiplies basic attack (F / RMB) damage. */
  autoAttackMult: number;
  /** Basic attacks also fire a short slash wave. */
  autoAttackSlash: boolean;
  /** Extra range on traveling slash / special waves. */
  slashRangeMult: number;
  /** Multiplies ground AoE / nova radii. */
  aoeRadiusMult: number;
  /** Added to crit chance (0–1). */
  critBonus: number;
  /** Multiplies attack interval (lower = faster). */
  attackSpeedMult: number;
  /** Extra fire damage fraction on hit (0–1 of base). */
  burnOnHit: number;
  /** HP regen per second while fighting. */
  regenPerSec: number;
  /** Damage taken multiplier (lower = tankier). */
  damageTakenMult: number;
}

export interface PerkDef {
  id: PerkId;
  name: string;
  tagline: string;
  description: string;
  color: number;
  /** Gold cost to unlock. */
  cost: number;
  /** Optional perk-token cost (0 = gold only). */
  tokenCost: number;
  tier: 1 | 2 | 3;
  propId: string;
  effects: string[];
  mods: Partial<PerkCombatMods>;
}

export const PERKS: PerkDef[] = [
  {
    id: "firebug",
    name: PERK_LABELS.firebug,
    tagline: "Burn & splash",
    description: "Auto-attacks leave fire trails; slash waves run hot and longer.",
    color: PERK_COLORS.firebug,
    cost: 400,
    tokenCost: 1,
    tier: 2,
    propId: "prop_perk_firebug",
    effects: [
      "+20% basic attack damage",
      "Basic attacks fire a flame slash wave",
      "+35% slash travel range",
      "+25% AoE radius",
      "Burn on hit",
    ],
    mods: {
      autoAttackMult: 1.2,
      autoAttackSlash: true,
      slashRangeMult: 1.35,
      aoeRadiusMult: 1.25,
      burnOnHit: 0.18,
    },
  },
  {
    id: "medic",
    name: PERK_LABELS.medic,
    tagline: "Stay in the fight",
    description: "Sustain and tougher trades so you can finish long island runs.",
    color: PERK_COLORS.medic,
    cost: 350,
    tokenCost: 0,
    tier: 1,
    propId: "prop_perk_medic",
    effects: ["+8 HP/s combat regen", "−15% damage taken", "+10% basic attack"],
    mods: {
      regenPerSec: 8,
      damageTakenMult: 0.85,
      autoAttackMult: 1.1,
    },
  },
  {
    id: "support",
    name: PERK_LABELS.support,
    tagline: "Bigger fields",
    description: "Skill zones expand — ground AoEs and novas hit more of the island.",
    color: PERK_COLORS.support,
    cost: 380,
    tokenCost: 1,
    tier: 1,
    propId: "prop_perk_support",
    effects: ["+40% AoE radius", "+15% slash range", "+12% basic attack"],
    mods: {
      aoeRadiusMult: 1.4,
      slashRangeMult: 1.15,
      autoAttackMult: 1.12,
    },
  },
  {
    id: "gunslinger",
    name: PERK_LABELS.gunslinger,
    tagline: "Faster, farther cuts",
    description: "Attack speed, crits, and long-range slash projectiles.",
    color: PERK_COLORS.gunslinger,
    cost: 450,
    tokenCost: 1,
    tier: 3,
    propId: "prop_perk_gunslinger",
    effects: [
      "+18% attack speed",
      "+10% crit chance",
      "Auto slash waves",
      "+50% slash travel range",
    ],
    mods: {
      attackSpeedMult: 0.82,
      critBonus: 0.1,
      autoAttackSlash: true,
      slashRangeMult: 1.5,
      autoAttackMult: 1.08,
    },
  },
];

export const PERK_BY_ID = new Map(PERKS.map((p) => [p.id, p]));

const OWNED_KEY = "flare:perks:owned";
const ACTIVE_KEY = "flare:perks:active";
const MAX_ACTIVE = 3;

export function getOwnedPerks(): PerkId[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(OWNED_KEY);
    return raw ? (JSON.parse(raw) as PerkId[]) : [];
  } catch {
    return [];
  }
}

export function getActivePerks(): PerkId[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(ACTIVE_KEY);
    const list = raw ? (JSON.parse(raw) as PerkId[]) : [];
    const owned = new Set(getOwnedPerks());
    return list.filter((id) => owned.has(id)).slice(0, MAX_ACTIVE);
  } catch {
    return [];
  }
}

export function saveOwnedPerks(ids: PerkId[]) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(OWNED_KEY, JSON.stringify([...new Set(ids)]));
}

export function saveActivePerks(ids: PerkId[]) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(ACTIVE_KEY, JSON.stringify(ids.slice(0, MAX_ACTIVE)));
}

export function isPerkOwned(id: PerkId): boolean {
  return getOwnedPerks().includes(id);
}

export function isPerkActive(id: PerkId): boolean {
  return getActivePerks().includes(id);
}

/** Unlock without cost (dungeon symbol pickup). */
export function grantPerk(id: PerkId): { ok: boolean; message: string } {
  const def = PERK_BY_ID.get(id);
  if (!def) return { ok: false, message: "Unknown perk." };
  if (isPerkOwned(id)) return { ok: false, message: "Already owned." };
  const owned = [...getOwnedPerks(), id];
  saveOwnedPerks(owned);
  const active = getActivePerks();
  if (active.length < MAX_ACTIVE) saveActivePerks([...active, id]);
  return { ok: true, message: `${def.name} unlocked!` };
}

/** Purchase unlocks the perk and auto-activates if under cap. */
export function purchasePerk(id: PerkId): { ok: boolean; message: string } {
  const def = PERK_BY_ID.get(id);
  if (!def) return { ok: false, message: "Unknown perk." };
  if (isPerkOwned(id)) return { ok: false, message: "Already owned." };

  const w = getWallet();
  if (w.gold < def.cost) return { ok: false, message: "Not enough gold." };
  if (def.tokenCost > 0 && w.perk_tokens < def.tokenCost) {
    return { ok: false, message: "Not enough perk tokens." };
  }

  saveWallet({
    ...w,
    gold: w.gold - def.cost,
    perk_tokens: w.perk_tokens - def.tokenCost,
  });
  const owned = [...getOwnedPerks(), id];
  saveOwnedPerks(owned);
  const active = getActivePerks();
  if (active.length < MAX_ACTIVE) {
    saveActivePerks([...active, id]);
  }
  return { ok: true, message: `${def.name} unlocked!` };
}

export function toggleActivePerk(id: PerkId): { ok: boolean; message: string } {
  if (!isPerkOwned(id)) return { ok: false, message: "Unlock first." };
  const active = getActivePerks();
  if (active.includes(id)) {
    saveActivePerks(active.filter((x) => x !== id));
    return { ok: true, message: `${id} unequipped.` };
  }
  if (active.length >= MAX_ACTIVE) {
    return { ok: false, message: `Max ${MAX_ACTIVE} active perks.` };
  }
  saveActivePerks([...active, id]);
  return { ok: true, message: `${id} equipped.` };
}

const IDENTITY: PerkCombatMods = {
  autoAttackMult: 1,
  autoAttackSlash: false,
  slashRangeMult: 1,
  aoeRadiusMult: 1,
  critBonus: 0,
  attackSpeedMult: 1,
  burnOnHit: 0,
  regenPerSec: 0,
  damageTakenMult: 1,
};

/** Stack all active perk mods for combat. */
export function getActivePerkMods(): PerkCombatMods {
  const mods = { ...IDENTITY };
  for (const id of getActivePerks()) {
    const def = PERK_BY_ID.get(id);
    if (!def?.mods) continue;
    const m = def.mods;
    if (m.autoAttackMult != null) mods.autoAttackMult *= m.autoAttackMult;
    if (m.autoAttackSlash) mods.autoAttackSlash = true;
    if (m.slashRangeMult != null) mods.slashRangeMult *= m.slashRangeMult;
    if (m.aoeRadiusMult != null) mods.aoeRadiusMult *= m.aoeRadiusMult;
    if (m.critBonus != null) mods.critBonus += m.critBonus;
    if (m.attackSpeedMult != null) mods.attackSpeedMult *= m.attackSpeedMult;
    if (m.burnOnHit != null) mods.burnOnHit += m.burnOnHit;
    if (m.regenPerSec != null) mods.regenPerSec += m.regenPerSec;
    if (m.damageTakenMult != null) mods.damageTakenMult *= m.damageTakenMult;
  }
  // Soft caps so stacking doesn't explode
  mods.slashRangeMult = Math.min(2.2, mods.slashRangeMult);
  mods.aoeRadiusMult = Math.min(2.0, mods.aoeRadiusMult);
  mods.autoAttackMult = Math.min(2.0, mods.autoAttackMult);
  mods.critBonus = Math.min(0.35, mods.critBonus);
  mods.damageTakenMult = Math.max(0.5, mods.damageTakenMult);
  return mods;
}

export { MAX_ACTIVE as MAX_ACTIVE_PERKS };
