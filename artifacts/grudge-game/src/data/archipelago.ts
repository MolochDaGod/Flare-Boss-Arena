/**
 * Generative archipelago — islands around the home hub (Pirate Cove / Grudge Harbor).
 * Diablo-2-style hierarchical seeds; home island is always present and accurately placed.
 */

export type IslandKind =
  | "home_harbor"
  | "wild_isle"
  | "fort_rock"
  | "farm_cay"
  | "boss_spire"
  | "trade_atoll"
  | "wreck_shoal";

export interface ArchipelagoIsland {
  id: string;
  name: string;
  kind: IslandKind;
  /** World XZ of island center (open-water chart). Home hub near cove. */
  x: number;
  z: number;
  /** Approx shoreline radius (land playable radius when docked). */
  radius: number;
  /** Monster / voyage difficulty. */
  areaLevel: number;
  color: number;
  blurb: string;
  /** Sub-seed for that island's interior generation. */
  islandSeed: number;
  /** Can land / sail-to for a new dungeon round. */
  landable: boolean;
  /** Home hub — always the remade shops island. */
  isHome: boolean;
}

export interface ArchipelagoChart {
  worldSeed: number;
  round: number;
  islands: ArchipelagoIsland[];
  /** Open-water half-extent for ocean plane. */
  seaHalfExtent: number;
}

function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function islandSeedOf(world: number, slot: number): number {
  return (Math.imul(world ^ (slot * 0x9e3779b9), 0x85ebca6b) >>> 0);
}

const NAMES: Record<IslandKind, string[]> = {
  home_harbor: ["Grudge Harbor", "Pirate Cove Isle", "Corsair Landing"],
  wild_isle: ["Thorn Cay", "Bone Skerry", "Ash Atoll", "Ember Reach"],
  fort_rock: ["Watch Bastion", "Iron Spit", "Redoubt Rock"],
  farm_cay: ["Green Acre Cay", "Mill Shoal", "Hay Spit"],
  boss_spire: ["Colossus Spire", "Titan Needle", "Ruin Fang"],
  trade_atoll: ["Merchant Ring", "Barter Reef", "Coin Lagoon"],
  wreck_shoal: ["Broken Keel", "Ghost Rig", "Salt Wreck"],
};

const KIND_COLOR: Record<IslandKind, number> = {
  home_harbor: 0xc5a059,
  wild_isle: 0x6a8a6a,
  fort_rock: 0x887766,
  farm_cay: 0x6db36d,
  boss_spire: 0xff5577,
  trade_atoll: 0x66aaff,
  wreck_shoal: 0xaa8866,
};

/**
 * Build archipelago chart. Home island anchors at cove (70, -14) matching GameEngine.coveCenter.
 */
export function generateArchipelago(
  worldSeed: number,
  round: number,
  opts?: { seaHalfExtent?: number; coveX?: number; coveZ?: number },
): ArchipelagoChart {
  const seaHalfExtent = opts?.seaHalfExtent ?? 220;
  const coveX = opts?.coveX ?? 70;
  const coveZ = opts?.coveZ ?? -14;
  const rng = mulberry(worldSeed ^ (round * 0xc0ffee));
  const levelBias = Math.min(10, (round - 1) * 2);

  const islands: ArchipelagoIsland[] = [];

  islands.push({
    id: "isle_home",
    name: NAMES.home_harbor[round % 3]!,
    kind: "home_harbor",
    x: coveX,
    z: coveZ,
    radius: 28,
    areaLevel: 1,
    color: KIND_COLOR.home_harbor,
    blurb: "Remade harbor of shops, training, and docks — human-scaled island hub.",
    islandSeed: islandSeedOf(worldSeed, 0),
    landable: true,
    isHome: true,
  });

  const kinds: IslandKind[] = [
    "wild_isle",
    "fort_rock",
    "farm_cay",
    "trade_atoll",
    "wreck_shoal",
    "wild_isle",
    "boss_spire",
    "trade_atoll",
  ];
  const count = 5 + Math.min(6, round + 1);
  for (let i = 0; i < count; i++) {
    const kind = kinds[i % kinds.length]!;
    const ang = (i / count) * Math.PI * 2 + rng() * 0.5;
    const dist = 95 + rng() * (seaHalfExtent - 120);
    let x = Math.cos(ang) * dist;
    let z = Math.sin(ang) * dist;
    // Keep clear of home
    if (Math.hypot(x - coveX, z - coveZ) < 70) {
      x += Math.cos(ang) * 40;
      z += Math.sin(ang) * 40;
    }
    x = Math.max(-seaHalfExtent + 30, Math.min(seaHalfExtent - 30, x));
    z = Math.max(-seaHalfExtent + 30, Math.min(seaHalfExtent - 30, z));

    const names = NAMES[kind];
    islands.push({
      id: `isle_${i + 1}`,
      name: names[Math.floor(rng() * names.length)]!,
      kind,
      x,
      z,
      radius: 14 + rng() * 12,
      areaLevel: (kind === "boss_spire" ? 8 : 2 + (i % 4)) + levelBias,
      color: KIND_COLOR[kind],
      blurb:
        kind === "boss_spire"
          ? "Colossus landfall — sail here after clearing the home mission."
          : kind === "trade_atoll"
            ? "Trade posts and repair berths."
            : kind === "farm_cay"
              ? "Farm modular cay — supplies and calm waters."
              : "Hostile shoreline — board for a new island run.",
      islandSeed: islandSeedOf(worldSeed, i + 1),
      landable: true,
      isHome: false,
    });
  }

  return { worldSeed, round, islands, seaHalfExtent };
}

export function nearestLandableIsland(
  chart: ArchipelagoChart,
  x: number,
  z: number,
  maxDist = 22,
): ArchipelagoIsland | null {
  let best: ArchipelagoIsland | null = null;
  let bestD = maxDist;
  for (const isle of chart.islands) {
    if (!isle.landable) continue;
    const d = Math.hypot(isle.x - x, isle.z - z) - isle.radius * 0.35;
    if (d < bestD) {
      bestD = d;
      best = isle;
    }
  }
  return best;
}
