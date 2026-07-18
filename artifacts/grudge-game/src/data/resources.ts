/**
 * Gathered resources (wood / stone) — localStorage-backed.
 * Used by harvest nodes and the Pirate Cove vendor (buy/sell for gold OR resources).
 */

export type ResourceId = "wood" | "stone" | "herb";

export interface ResourceBag {
  wood: number;
  stone: number;
  herb: number;
}

const KEY = "grudge:resources";
const DEFAULTS: ResourceBag = { wood: 0, stone: 0, herb: 0 };

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

export function spendResources(cost: Partial<ResourceBag>): boolean {
  const bag = getResources();
  const w = cost.wood ?? 0;
  const s = cost.stone ?? 0;
  if (bag.wood < w || bag.stone < s) return false;
  bag.wood -= w;
  bag.stone -= s;
  saveResources(bag);
  return true;
}

/**
 * Vendor catalog.
 * - sell: player gives resource → gets gold
 * - buy: player pays gold and/or wood/stone → gets goods (or gold via sell)
 */
export interface VendorGood {
  id: string;
  name: string;
  kind: "buy" | "sell";
  /** Resource moved on sell, or granted on resource packs. */
  resource?: ResourceId;
  /** Gold the player pays (buy) or receives (sell). 0 = free of gold. */
  gold: number;
  /** Resource amount sold/bought as bulk packs. */
  amount: number;
  /** Extra resource cost to BUY (player spends wood/stone). */
  costWood?: number;
  costStone?: number;
  blurb: string;
  /** Optional grant on buy (e.g. potion). */
  grant?: "potion" | "wood" | "stone" | "gold_bag";
}

export const VENDOR_GOODS: VendorGood[] = [
  // ── Sell harvest for gold ───────────────────────────────────────────────
  {
    id: "sell_wood",
    name: "Sell Wood ×5",
    kind: "sell",
    resource: "wood",
    gold: 10,
    amount: 5,
    blurb: "Anne pays coin for timber.",
  },
  {
    id: "sell_stone",
    name: "Sell Stone ×5",
    kind: "sell",
    resource: "stone",
    gold: 12,
    amount: 5,
    blurb: "Ballast for the hold — solid pay.",
  },
  {
    id: "sell_wood_bulk",
    name: "Sell Wood ×20",
    kind: "sell",
    resource: "wood",
    gold: 45,
    amount: 20,
    blurb: "Bulk timber deal.",
  },
  {
    id: "sell_stone_bulk",
    name: "Sell Stone ×20",
    kind: "sell",
    resource: "stone",
    gold: 55,
    amount: 20,
    blurb: "Bulk quarry sale.",
  },

  // ── Buy goods with gold ─────────────────────────────────────────────────
  {
    id: "buy_potion",
    name: "Grog of Mending",
    kind: "buy",
    gold: 40,
    amount: 1,
    blurb: "Healing grog (gold).",
    grant: "potion",
  },
  {
    id: "buy_wood_pack",
    name: "Oak Bundle ×10",
    kind: "buy",
    resource: "wood",
    gold: 28,
    amount: 10,
    blurb: "Buy timber with gold.",
    grant: "wood",
  },
  {
    id: "buy_stone_pack",
    name: "Granite Crate ×10",
    kind: "buy",
    resource: "stone",
    gold: 32,
    amount: 10,
    blurb: "Buy stone with gold.",
    grant: "stone",
  },

  // ── Buy goods with wood / stone (resource currency) ─────────────────────
  {
    id: "craft_potion_wood",
    name: "Herbal Grog",
    kind: "buy",
    gold: 0,
    amount: 1,
    costWood: 12,
    blurb: "Trade 12 wood for a healing draft.",
    grant: "potion",
  },
  {
    id: "craft_potion_stone",
    name: "Mineral Tonic",
    kind: "buy",
    gold: 0,
    amount: 1,
    costStone: 10,
    blurb: "Trade 10 stone for a tonic.",
    grant: "potion",
  },
  {
    id: "craft_gold_wood",
    name: "Timber for Coin",
    kind: "buy",
    gold: 0,
    amount: 1,
    costWood: 15,
    blurb: "Anne flips 15 wood into 25 gold.",
    grant: "gold_bag",
  },
  {
    id: "craft_gold_stone",
    name: "Stone for Coin",
    kind: "buy",
    gold: 0,
    amount: 1,
    costStone: 12,
    blurb: "12 stone → 25 gold.",
    grant: "gold_bag",
  },
  {
    id: "craft_mixed_potion",
    name: "Corsair Brew",
    kind: "buy",
    gold: 15,
    amount: 1,
    costWood: 6,
    costStone: 4,
    blurb: "15g + 6 wood + 4 stone → strong brew.",
    grant: "potion",
  },
  {
    id: "swap_wood_stone",
    name: "Timber → Stone",
    kind: "buy",
    gold: 0,
    amount: 8,
    costWood: 10,
    blurb: "Trade 10 wood for 8 stone.",
    grant: "stone",
  },
  {
    id: "swap_stone_wood",
    name: "Stone → Timber",
    kind: "buy",
    gold: 0,
    amount: 8,
    costStone: 10,
    blurb: "Trade 10 stone for 8 wood.",
    grant: "wood",
  },
];
