/**
 * Persistent weapon / armor loadout — equipment grants real combat boosts.
 *
 * MainPanel writes here on equip/unequip; gameCombat reads on every loadout
 * resolve so dungeon / boss / camp share the same gear bonuses.
 */

import { getActiveFighterId } from "./fighters";

export type GearSlot =
  | "Mainhand"
  | "Offhand"
  | "Helm"
  | "Shoulder"
  | "Chest"
  | "Hands"
  | "Feet"
  | "Relic"
  | "Ring"
  | "Necklace";

export interface EquippedItemSnap {
  id: string;
  name: string;
  type?: string;
  category?: string;
  slot: GearSlot | string;
  tier?: number;
  stats?: Record<string, number>;
}

export interface EquipmentCombatMods {
  /** Flat added to base physical damage. */
  damage: number;
  /** Flat magic / spell damage. */
  magicDamage: number;
  /** Flat HP. */
  health: number;
  /** Flat mana. */
  mana: number;
  /** Additive crit chance (0–1). */
  crit: number;
  /** Damage reduction fraction (0–1). */
  defense: number;
  /** Block chance (0–1). */
  block: number;
  /** Move speed multiplier bonus (e.g. 0.05 = +5%). */
  speed: number;
  /** Item names currently contributing (for HUD). */
  pieces: string[];
}

const STORAGE_KEY = "fba.equipmentLoadout.v1";

type Store = Record<string, Partial<Record<string, EquippedItemSnap>>>;

function readStore(): Store {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Store;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeStore(s: Store) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* quota */
  }
}

function fighterKey(fighterId?: string | null): string {
  return fighterId || getActiveFighterId() || "default";
}

/** Full equipment map for a fighter (slot → item). */
export function getEquipmentLoadout(
  fighterId?: string | null,
): Partial<Record<string, EquippedItemSnap>> {
  const store = readStore();
  return { ...(store[fighterKey(fighterId)] ?? {}) };
}

/** Replace entire loadout (used when seeding from MainPanel). */
export function setEquipmentLoadout(
  fighterId: string | null | undefined,
  loadout: Partial<Record<string, EquippedItemSnap>>,
) {
  const store = readStore();
  store[fighterKey(fighterId)] = loadout;
  writeStore(store);
}

/** Equip or clear a single slot. */
export function setEquipmentSlot(
  fighterId: string | null | undefined,
  slot: string,
  item: EquippedItemSnap | null,
) {
  const store = readStore();
  const key = fighterKey(fighterId);
  const cur = { ...(store[key] ?? {}) };
  if (item) cur[slot] = item;
  else delete cur[slot];
  store[key] = cur;
  writeStore(store);
}

/**
 * Aggregate combat mods from equipped weapons & armor.
 * Accepts either the stored loadout or a live MainPanel map of items with `.stats`.
 */
export function computeEquipmentCombatMods(
  equipped: Partial<Record<string, { name?: string; stats?: Record<string, number> } | undefined>>,
): EquipmentCombatMods {
  const out: EquipmentCombatMods = {
    damage: 0,
    magicDamage: 0,
    health: 0,
    mana: 0,
    crit: 0,
    defense: 0,
    block: 0,
    speed: 0,
    pieces: [],
  };

  for (const it of Object.values(equipped)) {
    if (!it?.stats) continue;
    if (it.name) out.pieces.push(it.name);
    for (const [k, raw] of Object.entries(it.stats)) {
      const v = Number(raw);
      if (!Number.isFinite(v) || v === 0) continue;
      const key = k.toLowerCase();
      if (key === "damage" || key === "damagebase" || key === "physicaldamage" || key.startsWith("damage_")) {
        out.damage += v;
      } else if (key === "magicdamage" || key === "spelldamage" || key === "magic") {
        out.magicDamage += v;
      } else if (key === "hp" || key === "health" || key === "healthbase" || key === "maxhp") {
        out.health += v;
      } else if (key === "mana" || key === "manabase" || key === "maxmana") {
        out.mana += v;
      } else if (key === "crit" || key === "critchance" || key === "critical") {
        // R2 data often uses percent points (5 = 5%)
        out.crit += v > 1 ? v / 100 : v;
      } else if (key === "defense" || key === "armor" || key === "armour" || key.startsWith("defense")) {
        // Large values treated as flat armor → soft DR
        out.defense += v > 1 ? Math.min(0.35, v * 0.004) : v;
      } else if (key === "block" || key === "blockchance") {
        out.block += v > 1 ? v / 100 : v;
      } else if (key === "speed" || key === "movespeed" || key === "haste") {
        out.speed += v > 1 ? v / 100 : v;
      }
    }
  }

  out.crit = Math.min(0.35, out.crit);
  out.defense = Math.min(0.45, out.defense);
  out.block = Math.min(0.4, out.block);
  out.speed = Math.min(0.4, out.speed);
  return out;
}

/** Live mods for the active (or given) fighter from localStorage. */
export function getEquipmentCombatMods(fighterId?: string | null): EquipmentCombatMods {
  return computeEquipmentCombatMods(getEquipmentLoadout(fighterId));
}

/** Snapshot an AnyItem-like object into storage shape. */
export function snapEquippedItem(
  slot: string,
  item: {
    id?: string;
    uuid?: string;
    name: string;
    type?: string;
    category?: string;
    tier?: number;
    stats?: Record<string, number>;
  },
): EquippedItemSnap {
  return {
    id: item.uuid ?? item.id ?? item.name,
    name: item.name,
    type: item.type,
    category: item.category,
    slot,
    tier: item.tier,
    stats: item.stats ? { ...item.stats } : undefined,
  };
}
