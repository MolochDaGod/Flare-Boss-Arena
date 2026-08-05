/**
 * RTS building upgrades + crafting recipes.
 * Uses wood/stone (resources) + gold (wallet), mirrors camp/RTS production chain:
 * Lumber Mill → Forge → Barracks → Workshop.
 */

import { getResources, saveResources, type ResourceBag } from "./resources";
import { getWallet, saveWallet } from "./wallet";

export type RtsBuildingId = "lumber_mill" | "quarry" | "forge" | "barracks" | "workshop" | "armory";

export interface RtsBuildingDef {
  id: RtsBuildingId;
  name: string;
  glyph: string;
  blurb: string;
  /** Max upgrade tier (1..5). */
  maxTier: number;
  /** Gold + resources to raise tier from current → current+1. */
  upgradeCost: (nextTier: number) => { gold: number; wood: number; stone: number };
  /** Bonus flavor when tier ≥ 1. */
  unlockNote: string;
}

export interface CraftRecipe {
  id: string;
  name: string;
  glyph: string;
  /** Building that must be at least this tier. */
  building: RtsBuildingId;
  minTier: number;
  cost: { gold: number; wood: number; stone: number };
  /** Output granted on craft. */
  output: {
    kind: "resource" | "gold" | "item" | "souls" | "perk_token";
    /** resource id or item label */
    id: string;
    amount: number;
  };
  blurb: string;
}

const BLD_KEY = "flare:rts:buildings.v1";

export const RTS_BUILDINGS: RtsBuildingDef[] = [
  {
    id: "lumber_mill",
    name: "Lumber Mill",
    glyph: "🪓",
    blurb: "Processes timber for construction and weapon stocks.",
    maxTier: 5,
    upgradeCost: (t) => ({ gold: 40 * t, wood: 0, stone: 8 * t }),
    unlockNote: "Unlocks refined wood crafts",
  },
  {
    id: "quarry",
    name: "Quarry",
    glyph: "⛏",
    blurb: "Cuts stone and ore for walls and plate.",
    maxTier: 5,
    upgradeCost: (t) => ({ gold: 40 * t, wood: 8 * t, stone: 0 }),
    unlockNote: "Unlocks refined stone crafts",
  },
  {
    id: "forge",
    name: "Forge",
    glyph: "🔥",
    blurb: "Smelts and hammers arms & armor pieces.",
    maxTier: 5,
    upgradeCost: (t) => ({ gold: 80 * t, wood: 12 * t, stone: 12 * t }),
    unlockNote: "Weapon / armor blanks",
  },
  {
    id: "barracks",
    name: "Barracks",
    glyph: "🏕",
    blurb: "Trains Grudge6 line units and recruits.",
    maxTier: 5,
    upgradeCost: (t) => ({ gold: 100 * t, wood: 15 * t, stone: 15 * t }),
    unlockNote: "Cheaper unit recruitment",
  },
  {
    id: "workshop",
    name: "Workshop",
    glyph: "⚙",
    blurb: "Tools, gadgets, and siege kits.",
    maxTier: 4,
    upgradeCost: (t) => ({ gold: 70 * t, wood: 10 * t, stone: 10 * t }),
    unlockNote: "Utility crafts",
  },
  {
    id: "armory",
    name: "Armory",
    glyph: "🛡",
    blurb: "Stores finished gear and grants plate crafts.",
    maxTier: 4,
    upgradeCost: (t) => ({ gold: 90 * t, wood: 8 * t, stone: 18 * t }),
    unlockNote: "Armor crafts + stash capacity",
  },
];

export const RTS_BUILDING_BY_ID = new Map(RTS_BUILDINGS.map((b) => [b.id, b]));

export const CRAFT_RECIPES: CraftRecipe[] = [
  {
    id: "craft_planks",
    name: "Cut Planks",
    glyph: "🪵",
    building: "lumber_mill",
    minTier: 1,
    cost: { gold: 0, wood: 5, stone: 0 },
    output: { kind: "gold", id: "gold", amount: 25 },
    blurb: "Mill rough timber into trade planks.",
  },
  {
    id: "craft_bricks",
    name: "Cut Bricks",
    glyph: "🧱",
    building: "quarry",
    minTier: 1,
    cost: { gold: 0, wood: 0, stone: 5 },
    output: { kind: "gold", id: "gold", amount: 25 },
    blurb: "Dress stone for walls and pads.",
  },
  {
    id: "craft_iron_ingot",
    name: "Iron Ingot",
    glyph: "⛓",
    building: "forge",
    minTier: 1,
    cost: { gold: 15, wood: 2, stone: 4 },
    output: { kind: "item", id: "item.iron_ingot", amount: 1 },
    blurb: "Basic metal for arms.",
  },
  {
    id: "craft_blade_blank",
    name: "Blade Blank",
    glyph: "⚔",
    building: "forge",
    minTier: 2,
    cost: { gold: 40, wood: 3, stone: 6 },
    output: { kind: "item", id: "weapon.blade_blank.t1", amount: 1 },
    blurb: "Unfinished main-hand stock (+damage when equipped via panel).",
  },
  {
    id: "craft_plate_sheet",
    name: "Plate Sheet",
    glyph: "🛡",
    building: "armory",
    minTier: 1,
    cost: { gold: 35, wood: 2, stone: 8 },
    output: { kind: "item", id: "armor.plate_sheet.t1", amount: 1 },
    blurb: "Chest armor blank (+HP / defense).",
  },
  {
    id: "craft_soul_tincture",
    name: "Soul Tincture",
    glyph: "💀",
    building: "workshop",
    minTier: 2,
    cost: { gold: 50, wood: 4, stone: 4 },
    output: { kind: "souls", id: "souls", amount: 2 },
    blurb: "Brewed for the Soul Altar — attribute points.",
  },
  {
    id: "craft_recruit_banner",
    name: "Recruit Banner",
    glyph: "🏳",
    building: "barracks",
    minTier: 1,
    cost: { gold: 80, wood: 10, stone: 6 },
    output: { kind: "item", id: "item.recruit_token", amount: 1 },
    blurb: "Signals the barracks to open a hire slot.",
  },
  {
    id: "craft_perk_token",
    name: "Forge Perk Token",
    glyph: "🎰",
    building: "workshop",
    minTier: 3,
    cost: { gold: 120, wood: 8, stone: 8 },
    output: { kind: "perk_token", id: "perk_tokens", amount: 1 },
    blurb: "Machine token for the gumball / perk line.",
  },
  {
    id: "craft_bulk_wood",
    name: "Bundle Timber",
    glyph: "📦",
    building: "lumber_mill",
    minTier: 2,
    cost: { gold: 20, wood: 0, stone: 2 },
    output: { kind: "resource", id: "wood", amount: 8 },
    blurb: "Trade gold for milled wood stock.",
  },
  {
    id: "craft_bulk_stone",
    name: "Bundle Stone",
    glyph: "📦",
    building: "quarry",
    minTier: 2,
    cost: { gold: 20, wood: 2, stone: 0 },
    output: { kind: "resource", id: "stone", amount: 8 },
    blurb: "Trade gold for cut stone.",
  },
];

export type BuildingTiers = Record<RtsBuildingId, number>;

function defaultTiers(): BuildingTiers {
  return {
    lumber_mill: 1,
    quarry: 1,
    forge: 0,
    barracks: 0,
    workshop: 0,
    armory: 0,
  };
}

export function getBuildingTiers(): BuildingTiers {
  if (typeof localStorage === "undefined") return defaultTiers();
  try {
    const raw = localStorage.getItem(BLD_KEY);
    if (!raw) return defaultTiers();
    return { ...defaultTiers(), ...JSON.parse(raw) };
  } catch {
    return defaultTiers();
  }
}

export function saveBuildingTiers(t: BuildingTiers) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(BLD_KEY, JSON.stringify(t));
}

export function getBuildingTier(id: RtsBuildingId): number {
  return getBuildingTiers()[id] ?? 0;
}

function canPay(cost: { gold: number; wood: number; stone: number }): boolean {
  const bag = getResources();
  const w = getWallet();
  return w.gold >= cost.gold && bag.wood >= cost.wood && bag.stone >= cost.stone;
}

function pay(cost: { gold: number; wood: number; stone: number }): boolean {
  if (!canPay(cost)) return false;
  const bag = getResources();
  bag.wood -= cost.wood;
  bag.stone -= cost.stone;
  saveResources(bag);
  const w = getWallet();
  saveWallet({ ...w, gold: w.gold - cost.gold });
  return true;
}

export function upgradeBuilding(id: RtsBuildingId): { ok: boolean; message: string } {
  const def = RTS_BUILDING_BY_ID.get(id);
  if (!def) return { ok: false, message: "Unknown building." };
  const tiers = getBuildingTiers();
  const cur = tiers[id] ?? 0;
  if (cur >= def.maxTier) return { ok: false, message: "Max tier." };
  const cost = def.upgradeCost(cur + 1);
  if (!pay(cost)) {
    return {
      ok: false,
      message: `Need ${cost.gold}g · ${cost.wood} wood · ${cost.stone} stone.`,
    };
  }
  tiers[id] = cur + 1;
  saveBuildingTiers(tiers);
  return { ok: true, message: `${def.name} → tier ${cur + 1}.` };
}

export function canCraft(recipe: CraftRecipe): boolean {
  const tier = getBuildingTier(recipe.building);
  if (tier < recipe.minTier) return false;
  return canPay(recipe.cost);
}

export function craftRecipe(recipeId: string): { ok: boolean; message: string } {
  const recipe = CRAFT_RECIPES.find((r) => r.id === recipeId);
  if (!recipe) return { ok: false, message: "Unknown recipe." };
  const tier = getBuildingTier(recipe.building);
  if (tier < recipe.minTier) {
    return { ok: false, message: `Need ${recipe.building} tier ${recipe.minTier}.` };
  }
  if (!pay(recipe.cost)) {
    return {
      ok: false,
      message: `Need ${recipe.cost.gold}g · ${recipe.cost.wood} wood · ${recipe.cost.stone} stone.`,
    };
  }
  const out = recipe.output;
  if (out.kind === "resource") {
    const bag = getResources();
    const id = out.id as keyof ResourceBag;
    if (id === "wood" || id === "stone" || id === "herb") {
      bag[id] = (bag[id] ?? 0) + out.amount;
      saveResources(bag);
    }
  } else if (out.kind === "gold") {
    const w = getWallet();
    saveWallet({ ...w, gold: w.gold + out.amount });
  } else if (out.kind === "souls") {
    const w = getWallet();
    saveWallet({ ...w, souls: (w.souls ?? 0) + out.amount });
  } else if (out.kind === "perk_token") {
    const w = getWallet();
    saveWallet({ ...w, perk_tokens: (w.perk_tokens ?? 0) + out.amount });
  }
  // item outputs: stored as soft flags for inventory UI later
  if (out.kind === "item") {
    try {
      const key = "flare:rts:crafted_items.v1";
      const raw = localStorage.getItem(key);
      const list = raw ? (JSON.parse(raw) as string[]) : [];
      for (let i = 0; i < out.amount; i++) list.push(out.id);
      localStorage.setItem(key, JSON.stringify(list.slice(-40)));
    } catch {
      /* ignore */
    }
  }
  return { ok: true, message: `Crafted ${recipe.name} ×${out.amount}.` };
}

export function getCraftedItemIds(): string[] {
  try {
    const raw = localStorage.getItem("flare:rts:crafted_items.v1");
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}
