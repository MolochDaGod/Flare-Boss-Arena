/**
 * Seeded island events — random encounters that punctuate the explore loop.
 */

export type IslandEventKind =
  | "supply_cache"
  | "ambush_wave"
  | "shrine_buff"
  | "merchant_visit"
  | "storm_front"
  | "relic_find"
  | "patrol_elite";

export interface IslandEventDef {
  id: string;
  kind: IslandEventKind;
  title: string;
  description: string;
  /** Weight in the random pool (higher = more common). */
  weight: number;
  minRound: number;
  /** Optional kill-count gate before this event can roll. */
  minKills?: number;
}

export const ISLAND_EVENT_DEFS: IslandEventDef[] = [
  {
    id: "evt_supply",
    kind: "supply_cache",
    title: "Supply Cache",
    description: "A buried war chest — wood, stone, and a mana surge.",
    weight: 14,
    minRound: 1,
  },
  {
    id: "evt_ambush",
    kind: "ambush_wave",
    title: "Hostile Ambush",
    description: "Skirmishers burst from the treeline along the road.",
    weight: 12,
    minRound: 1,
    minKills: 2,
  },
  {
    id: "evt_shrine",
    kind: "shrine_buff",
    title: "Grudge Shrine",
    description: "An ancient obelisk pulses — regen and damage swell briefly.",
    weight: 10,
    minRound: 2,
  },
  {
    id: "evt_merchant",
    kind: "merchant_visit",
    title: "Drift Merchant",
    description: "A roving trader moors at the crossroads. Quick barter available.",
    weight: 9,
    minRound: 1,
  },
  {
    id: "evt_storm",
    kind: "storm_front",
    title: "Ash Storm",
    description: "Visibility drops — fog thickens, but elites drop richer spoils.",
    weight: 8,
    minRound: 3,
  },
  {
    id: "evt_relic",
    kind: "relic_find",
    title: "Relic Unearthed",
    description: "A buried sigil grants bonus XP and a combat log prophecy.",
    weight: 7,
    minRound: 2,
    minKills: 4,
  },
  {
    id: "evt_elite",
    kind: "patrol_elite",
    title: "Elite Patrol",
    description: "A champion-class hostile marches the main road.",
    weight: 11,
    minRound: 2,
    minKills: 3,
  },
];

export interface ActiveIslandEvent {
  defId: string;
  kind: IslandEventKind;
  title: string;
  description: string;
  /** World anchor where the event triggered. */
  x: number;
  z: number;
  /** Kills remaining for ambush waves, etc. */
  charges?: number;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Roll a random island event from the seed + round context. */
export function rollIslandEvent(
  seed: number,
  round: number,
  kills: number,
  rollIndex: number,
): ActiveIslandEvent | null {
  const rng = mulberry32((seed ^ round * 13171 ^ rollIndex * 9187) >>> 0);
  const pool = ISLAND_EVENT_DEFS.filter(
    (d) => round >= d.minRound && kills >= (d.minKills ?? 0),
  );
  if (!pool.length) return null;

  const total = pool.reduce((s, d) => s + d.weight, 0);
  let pick = rng() * total;
  let chosen = pool[0]!;
  for (const d of pool) {
    pick -= d.weight;
    if (pick <= 0) {
      chosen = d;
      break;
    }
  }

  const angle = rng() * Math.PI * 2;
  const dist = 18 + rng() * 42;
  return {
    defId: chosen.id,
    kind: chosen.kind,
    title: chosen.title,
    description: chosen.description,
    x: Math.cos(angle) * dist,
    z: Math.sin(angle) * dist,
    charges: chosen.kind === "ambush_wave" ? 3 + Math.floor(rng() * 2) : undefined,
  };
}

/** How many kills between event rolls scales with round. */
export function eventRollInterval(round: number): number {
  return Math.max(3, 5 - Math.floor((round - 1) / 3));
}