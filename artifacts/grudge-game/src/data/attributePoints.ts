/**
 * Spendable attribute points — souls (wallet) convert into permanent
 * per-fighter allocations that stack on base fighter.stats.
 */

import { ATTR_ORDER, type AttrKey, getActiveFighterId } from "./fighters";
import { getWallet, saveWallet } from "./wallet";

const ALLOC_KEY = "flare:attr:alloc.v1";
const POOL_KEY = "flare:attr:free_pool.v1";

/** Souls spent per +1 on an attribute. */
export const SOUL_COST_PER_POINT = 1;
/** Max total free pool points a player can bank from level rewards. */
export const MAX_FREE_POOL = 99;
/** Cap per attribute from spending (on top of base). */
export const MAX_ALLOC_PER_ATTR = 20;

type AllocMap = Record<string, Partial<Record<AttrKey, number>>>;

function readAlloc(): AllocMap {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(ALLOC_KEY);
    return raw ? (JSON.parse(raw) as AllocMap) : {};
  } catch {
    return {};
  }
}

function writeAlloc(m: AllocMap) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(ALLOC_KEY, JSON.stringify(m));
}

function fighterKey(fighterId?: string | null): string {
  return fighterId || getActiveFighterId() || "default";
}

/** Points allocated on this fighter (spent). */
export function getAttributeAllocations(
  fighterId?: string | null,
): Record<AttrKey, number> {
  const row = readAlloc()[fighterKey(fighterId)] ?? {};
  const out = {} as Record<AttrKey, number>;
  for (const k of ATTR_ORDER) out[k] = Math.max(0, Math.floor(row[k] ?? 0));
  return out;
}

/** Free pool points (from rewards) that don't cost souls. */
export function getFreeAttributePool(): number {
  if (typeof localStorage === "undefined") return 0;
  try {
    const n = Number(localStorage.getItem(POOL_KEY) ?? "0");
    return Number.isFinite(n) ? Math.max(0, Math.min(MAX_FREE_POOL, Math.floor(n))) : 0;
  } catch {
    return 0;
  }
}

export function setFreeAttributePool(n: number) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(POOL_KEY, String(Math.max(0, Math.min(MAX_FREE_POOL, Math.floor(n)))));
}

/** Grant free points (e.g. quest/level rewards). */
export function grantAttributePoints(amount: number): number {
  const next = getFreeAttributePool() + Math.max(0, Math.floor(amount));
  setFreeAttributePool(next);
  return getFreeAttributePool();
}

/**
 * Spendable total right now:
 * free pool + wallet souls (1 soul = 1 point).
 */
export function getSpendableAttributePoints(): {
  free: number;
  souls: number;
  total: number;
} {
  const free = getFreeAttributePool();
  const souls = Math.max(0, Math.floor(getWallet().souls ?? 0));
  return { free, souls, total: free + souls };
}

/**
 * Allocate +1 to an attribute on the fighter.
 * Prefers free pool, then spends 1 soul.
 */
export function spendAttributePoint(
  attr: AttrKey,
  fighterId?: string | null,
): { ok: boolean; message: string } {
  if (!ATTR_ORDER.includes(attr)) return { ok: false, message: "Unknown attribute." };
  const key = fighterKey(fighterId);
  const map = readAlloc();
  const row = { ...(map[key] ?? {}) };
  const cur = Math.floor(row[attr] ?? 0);
  if (cur >= MAX_ALLOC_PER_ATTR) {
    return { ok: false, message: `Max +${MAX_ALLOC_PER_ATTR} on ${attr}.` };
  }

  const free = getFreeAttributePool();
  if (free > 0) {
    setFreeAttributePool(free - 1);
  } else {
    const w = getWallet();
    if ((w.souls ?? 0) < SOUL_COST_PER_POINT) {
      return { ok: false, message: "Need 1 soul (or free attribute point)." };
    }
    saveWallet({ ...w, souls: w.souls - SOUL_COST_PER_POINT });
  }

  row[attr] = cur + 1;
  map[key] = row;
  writeAlloc(map);
  return { ok: true, message: `+1 ${attr} (now ${cur + 1} spent).` };
}

/** Total points already spent on this fighter. */
export function totalAllocated(fighterId?: string | null): number {
  const a = getAttributeAllocations(fighterId);
  return ATTR_ORDER.reduce((s, k) => s + (a[k] ?? 0), 0);
}
