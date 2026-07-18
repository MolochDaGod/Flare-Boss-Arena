/**
 * uMMORPG-style harvest node scripting (ObjectStore harvest-nodes schema).
 * Used by Harvestables + ClaimFlag to spawn typed nodes with respawn/yield.
 */

export type HarvestProfession = "Mining" | "Logging" | "Herbalism";
export type HarvestNodeType = "ore" | "wood" | "herb";
export type HarvestRarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

export interface HarvestDropDef {
  itemId: string;
  quantity: number;
  chance: number;
  rarity: HarvestRarity;
}

export interface HarvestNodeDef {
  id: string;
  name: string;
  type: HarvestNodeType;
  tier: number;
  profession: HarvestProfession;
  requiredLevel: number;
  baseYield: number;
  /** Seconds to channel (UI / future hold-to-harvest). */
  harvestTime: number;
  /** Seconds until respawn after depletion. */
  respawnTime: number;
  xpReward: number;
  drops: HarvestDropDef[];
  description: string;
  /** Combat HP for melee chop/mine. */
  hp: number;
  /** Map resource bag key. */
  resourceId: "wood" | "stone" | "herb";
}

/** Canonical practice set aligned with ObjectStore sources/harvest-nodes.json. */
export const HARVEST_NODE_DEFS: HarvestNodeDef[] = [
  {
    id: "copper-ore-node",
    name: "Copper Deposit",
    type: "ore",
    tier: 1,
    profession: "Mining",
    requiredLevel: 1,
    baseYield: 2,
    harvestTime: 3,
    respawnTime: 60,
    xpReward: 10,
    drops: [{ itemId: "ORE_COPPER_ORE_T1", quantity: 2, chance: 1, rarity: "common" }],
    description: "A rich deposit of copper ore.",
    hp: 45,
    resourceId: "stone",
  },
  {
    id: "pine-tree-node",
    name: "Pine Tree",
    type: "wood",
    tier: 1,
    profession: "Logging",
    requiredLevel: 1,
    baseYield: 3,
    harvestTime: 3,
    respawnTime: 60,
    xpReward: 10,
    drops: [{ itemId: "WOOD_PINE_LOG_T1", quantity: 3, chance: 1, rarity: "common" }],
    description: "A tall pine tree suitable for logging.",
    hp: 55,
    resourceId: "wood",
  },
  {
    id: "basic-herb-node",
    name: "Herb Patch",
    type: "herb",
    tier: 1,
    profession: "Herbalism",
    requiredLevel: 1,
    baseYield: 2,
    harvestTime: 2,
    respawnTime: 45,
    xpReward: 8,
    drops: [{ itemId: "POT_RED_FLOWER", quantity: 2, chance: 0.8, rarity: "common" }],
    description: "A small patch of medicinal herbs.",
    hp: 25,
    resourceId: "herb",
  },
  {
    id: "iron-ore-node",
    name: "Iron Deposit",
    type: "ore",
    tier: 2,
    profession: "Mining",
    requiredLevel: 10,
    baseYield: 2,
    harvestTime: 4,
    respawnTime: 90,
    xpReward: 20,
    drops: [{ itemId: "ORE_IRON_ORE_T2", quantity: 2, chance: 1, rarity: "common" }],
    description: "Hard iron veins in the rock.",
    hp: 80,
    resourceId: "stone",
  },
  {
    id: "oak-tree-node",
    name: "Oak Tree",
    type: "wood",
    tier: 2,
    profession: "Logging",
    requiredLevel: 10,
    baseYield: 3,
    harvestTime: 4,
    respawnTime: 90,
    xpReward: 20,
    drops: [{ itemId: "WOOD_OAK_LOG_T2", quantity: 3, chance: 1, rarity: "common" }],
    description: "Sturdy oak timber.",
    hp: 90,
    resourceId: "wood",
  },
  {
    id: "uncommon-herb-node",
    name: "Moonleaf Patch",
    type: "herb",
    tier: 2,
    profession: "Herbalism",
    requiredLevel: 10,
    baseYield: 2,
    harvestTime: 3,
    respawnTime: 70,
    xpReward: 16,
    drops: [{ itemId: "POT_MOONLEAF", quantity: 2, chance: 0.85, rarity: "uncommon" }],
    description: "Glowing herbs favored by dark-elf alchemists.",
    hp: 40,
    resourceId: "herb",
  },
];

export const HARVEST_DEF_BY_ID = new Map(HARVEST_NODE_DEFS.map((d) => [d.id, d]));

export function harvestDefsForClaim(tier = 1): HarvestNodeDef[] {
  return HARVEST_NODE_DEFS.filter((d) => d.tier <= tier);
}

/** Deterministic pick of N node defs for a claim parcel. */
export function pickClaimNodeDefs(seed: number, count: number, maxTier = 2): HarvestNodeDef[] {
  const pool = HARVEST_NODE_DEFS.filter((d) => d.tier <= maxTier);
  const out: HarvestNodeDef[] = [];
  let s = seed >>> 0;
  for (let i = 0; i < count; i++) {
    s = Math.imul(s ^ (s >>> 16), 0x7feb352d);
    s = Math.imul(s ^ (s >>> 15), 0x846ca68b);
    s ^= s >>> 16;
    out.push(pool[(s >>> 0) % pool.length]!);
  }
  return out;
}
