/**
 * Gathered resources (wood / stone) — localStorage-backed until a server bag exists.
 * Used by harvest nodes in the dungeon and the Pirate Cove vendor.
 */

export type ResourceId = "wood" | "stone";

export interface ResourceBag {
  wood: number;
  stone: number;
}

const KEY = "grudge:resources";
const DEFAULTS: ResourceBag = { wood: 0, stone: 0 };

export function getResources(): ResourceBag {
  if (typeof localStorage === "undefined") return { ...DEFAULTS };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveResources(bag: ResourceBag) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(bag));
}

export function addResource(id: ResourceId, amount: number): ResourceBag {
  const bag = getResources();
  bag[id] = Math.max(0, (bag[id] ?? 0) + amount);
  saveResources(bag);
  return bag;
}

export function spendResource(id: ResourceId, amount: number): boolean {
  const bag = getResources();
  if ((bag[id] ?? 0) < amount) return false;
  bag[id] -= amount;
  saveResources(bag);
  return true;
}

/** Vendor catalog: pirate cove buy/sell prices. */
export interface VendorGood {
  id: string;
  name: string;
  kind: "buy" | "sell";
  resource?: ResourceId;
  /** Gold paid by player (buy) or received (sell). */
  gold: number;
  /** Resource amount exchanged (for resource goods). */
  amount: number;
  blurb: string;
}

export const VENDOR_GOODS: VendorGood[] = [
  { id: "buy_wood", name: "Oak Timber", kind: "buy", resource: "wood", gold: 18, amount: 5, blurb: "Seasoned cove lumber." },
  { id: "buy_stone", name: "Granite Chunks", kind: "buy", resource: "stone", gold: 22, amount: 5, blurb: "Shore-quarried stone." },
  { id: "sell_wood", name: "Sell Wood", kind: "sell", resource: "wood", gold: 8, amount: 5, blurb: "Anne pays for timber." },
  { id: "sell_stone", name: "Sell Stone", kind: "sell", resource: "stone", gold: 10, amount: 5, blurb: "Ballast for the ship." },
  { id: "buy_potion", name: "Grog of Mending", kind: "buy", gold: 45, amount: 1, blurb: "Restore 80 HP once (auto-use)." },
];
