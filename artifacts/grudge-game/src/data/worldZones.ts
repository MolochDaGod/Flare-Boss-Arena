/**
 * Diablo-2-style generative world chart.
 *
 * Hierarchical seeds (world → act → area) produce deterministic zones:
 *  - Fixed narrative anchors (harbor, hub, boss)
 *  - Grid-snapped area placement with spacing (no overlapping claims)
 *  - Area level, density, spawn bias, connections (waypoint graph)
 *  - Round scales density / area level like D2 difficulty tiers
 */

export type ZoneKind =
  | "harbor"
  | "wilds"
  | "ruins"
  | "shrine"
  | "claim"
  | "boss_gate"
  | "resource"
  | "outpost"
  | "farm"
  | "cropland"
  | "dungeon_mouth"
  | "blood_moor"
  | "cold_plains";

export interface WorldZone {
  id: string;
  name: string;
  kind: ZoneKind;
  /** World center XZ */
  x: number;
  z: number;
  /** Radius of influence (claim / fog reveal / spawn bias) */
  radius: number;
  /** Color for minimap / markers */
  color: number;
  /** Player may place a claim here */
  claimable: boolean;
  /** Pre-claimed by pirates / faction */
  owner: "player" | "pirates" | "wild" | "none";
  blurb: string;
  /** Chunk grid coords for "deployed map" feel */
  chunkX: number;
  chunkZ: number;
  /** Monster area level (D2-style) — scales spawns. */
  areaLevel: number;
  /** 0–1 pack density bias for enemy spawns. */
  density: number;
  /** Deterministic sub-seed for this area alone. */
  areaSeed: number;
  /** Neighbor zone ids (waypoint / path graph). */
  links: string[];
  /** Act index 1–3 for this sail (D2 acts). */
  act: number;
}

export interface WorldChunkManifest {
  seed: number;
  round: number;
  halfExtent: number;
  /** Act seed derived from world seed + round. */
  actSeed: number;
  zones: WorldZone[];
  /** Chunks (3×3 around origin) that are "deployed" this sail */
  deployedChunks: Array<{ cx: number; cz: number; label: string }>;
  /** Ordered waypoint ids (hub → mid → boss approach). */
  waypointPath: string[];
}

/** Hierarchical seed: world ⊕ act ⊕ slot → stable 32-bit. */
export function areaSeedOf(worldSeed: number, act: number, slot: number): number {
  let h = worldSeed >>> 0;
  h = Math.imul(h ^ (act * 0x9e3779b9), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (slot * 0xc2b2ae35), 0x27d4eb2d) >>> 0;
  return h >>> 0;
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

const ZONE_NAMES: Record<ZoneKind, string[]> = {
  harbor: ["Pirate Cove", "Grudge Quay", "Corsair Landing"],
  wilds: ["Ash Wastes", "Thorn Fields", "Bone Flats", "Ember Scrub", "Stony Field"],
  ruins: ["Fallen Keep", "Broken Colonnade", "Sunken Court", "Crypt Mouth"],
  shrine: ["Grudge Shrine", "Obelisk Glade", "Sigil Hollow", "Cairn Stones"],
  claim: ["Claim Plot", "Frontier Lot", "War Claim", "Freehold"],
  boss_gate: ["Colossus Gate", "Titan Approach", "Ruin Mouth", "Catacombs Gate"],
  resource: ["Timber Stand", "Quarry Spur", "Iron Scar", "Dark Wood"],
  outpost: ["Watch Camp", "Scout Rise", "Skirmish Pad", "Rogue Encampment"],
  farm: ["Green Acre", "Mill Paddock", "Hearth Farm", "Furrow Reach"],
  cropland: ["Barley Strip", "Hay Meadow", "Root Furrows", "Dry Pasture"],
  dungeon_mouth: ["Cave Mouth", "Sewers Gate", "Burial Shaft", "Hole Entrance"],
  blood_moor: ["Blood Moor", "Den Fringe", "Moor Edge"],
  cold_plains: ["Cold Plains", "Burial Grounds", "Tamoe Highland"],
};

const KIND_COLOR: Partial<Record<ZoneKind, number>> = {
  harbor: 0xc5a059,
  wilds: 0x8899aa,
  ruins: 0xaa8866,
  shrine: 0xcc66ff,
  claim: 0x66aaff,
  boss_gate: 0xff5577,
  resource: 0x88cc55,
  outpost: 0x53ddb0,
  farm: 0x6db36d,
  cropland: 0xc4b35a,
  dungeon_mouth: 0x886644,
  blood_moor: 0xaa4455,
  cold_plains: 0x88aacc,
};

interface AreaTemplate {
  kind: ZoneKind;
  claimable: boolean;
  owner: WorldZone["owner"];
  baseLevel: number;
  density: number;
  radius: [number, number];
  blurb: string;
  weight: number;
}

/** Weighted area pool — D2 wilderness mix. */
const AREA_POOL: AreaTemplate[] = [
  {
    kind: "claim",
    claimable: true,
    owner: "none",
    baseLevel: 2,
    density: 0.35,
    radius: [9, 13],
    blurb: "Build a camp (C) — fence + tower; enemies cannot enter.",
    weight: 3,
  },
  {
    kind: "wilds",
    claimable: false,
    owner: "wild",
    baseLevel: 3,
    density: 0.75,
    radius: [11, 16],
    blurb: "Hostile patrols and elite packs.",
    weight: 4,
  },
  {
    kind: "blood_moor",
    claimable: false,
    owner: "wild",
    baseLevel: 2,
    density: 0.85,
    radius: [12, 17],
    blurb: "Blood-stained moor — dense trash packs.",
    weight: 2,
  },
  {
    kind: "cold_plains",
    claimable: false,
    owner: "wild",
    baseLevel: 4,
    density: 0.7,
    radius: [12, 16],
    blurb: "Chill plains — mid-tier ambush routes.",
    weight: 2,
  },
  {
    kind: "ruins",
    claimable: false,
    owner: "wild",
    baseLevel: 5,
    density: 0.65,
    radius: [10, 15],
    blurb: "Fallen stone — elite ruins packs.",
    weight: 2,
  },
  {
    kind: "resource",
    claimable: true,
    owner: "wild",
    baseLevel: 3,
    density: 0.45,
    radius: [10, 14],
    blurb: "Dense harvest nodes — good camp ground.",
    weight: 2,
  },
  {
    kind: "farm",
    claimable: true,
    owner: "none",
    baseLevel: 2,
    density: 0.3,
    radius: [13, 18],
    blurb: "Farmstead — modular dirt, fences, hay.",
    weight: 2,
  },
  {
    kind: "cropland",
    claimable: true,
    owner: "none",
    baseLevel: 2,
    density: 0.25,
    radius: [12, 16],
    blurb: "Open cropland — low-poly fields.",
    weight: 2,
  },
  {
    kind: "shrine",
    claimable: false,
    owner: "wild",
    baseLevel: 4,
    density: 0.4,
    radius: [9, 12],
    blurb: "Event shrine — buffs and relics.",
    weight: 1,
  },
  {
    kind: "outpost",
    claimable: true,
    owner: "none",
    baseLevel: 3,
    density: 0.5,
    radius: [10, 13],
    blurb: "Scout outpost — secure with a camp.",
    weight: 2,
  },
  {
    kind: "dungeon_mouth",
    claimable: false,
    owner: "wild",
    baseLevel: 6,
    density: 0.9,
    radius: [9, 12],
    blurb: "Dungeon mouth — denser elites near the gate.",
    weight: 1,
  },
];

function pickWeighted(rng: () => number, pool: AreaTemplate[]): AreaTemplate {
  let total = 0;
  for (const p of pool) total += p.weight;
  let r = rng() * total;
  for (const p of pool) {
    r -= p.weight;
    if (r <= 0) return p;
  }
  return pool[pool.length - 1]!;
}

function snaps(halfExtent: number, cell: number): number[] {
  const out: number[] = [];
  for (let v = -halfExtent + cell; v <= halfExtent - cell; v += cell) out.push(v);
  return out;
}

function tooClose(
  x: number,
  z: number,
  placed: Array<{ x: number; z: number; r: number }>,
  minSep: number,
): boolean {
  for (const p of placed) {
    if (Math.hypot(x - p.x, z - p.z) < minSep + p.r * 0.35) return true;
  }
  return false;
}

/**
 * Build a full island zone graph for one map seed / round.
 * Diablo-2 pattern: anchors + grid-filled wilderness + waypoint graph.
 */
export function generateWorldChunkManifest(
  seed: number,
  round: number,
  halfExtent = 90,
): WorldChunkManifest {
  const act = 1 + ((round - 1) % 3);
  const actSeed = areaSeedOf(seed, act, 0);
  const rng = mulberry(actSeed ^ (round * 7919));
  const levelBias = Math.min(12, (round - 1) * 2 + (act - 1) * 3);

  const zones: WorldZone[] = [];
  let zid = 0;
  const placed: Array<{ x: number; z: number; r: number }> = [];

  const add = (
    partial: Omit<WorldZone, "id" | "chunkX" | "chunkZ" | "links"> & { links?: string[] },
  ) => {
    const chunkX = Math.floor((partial.x + halfExtent) / 40) - 2;
    const chunkZ = Math.floor((partial.z + halfExtent) / 40) - 2;
    const id = `zone_${zid++}`;
    zones.push({
      ...partial,
      id,
      chunkX,
      chunkZ,
      links: partial.links ?? [],
    });
    placed.push({ x: partial.x, z: partial.z, r: partial.radius });
    return id;
  };

  // ── Fixed narrative anchors (always present) ──────────────────────────
  const harborId = add({
    name: ZONE_NAMES.harbor[round % 3]!,
    kind: "harbor",
    x: 70,
    z: -14,
    radius: 16,
    color: KIND_COLOR.harbor!,
    claimable: false,
    owner: "pirates",
    blurb: "Safe cove — vendor, captain, re-sail.",
    areaLevel: 1,
    density: 0.05,
    areaSeed: areaSeedOf(seed, act, 1),
    act,
  });

  const hubId = add({
    name: "Rogue Encampment",
    kind: "outpost",
    x: 0,
    z: 0,
    radius: 12,
    color: KIND_COLOR.outpost!,
    claimable: true,
    owner: "none",
    blurb: "Landing hub — build a camp for fence, tower, and safe zone.",
    areaLevel: 1,
    density: 0.1,
    areaSeed: areaSeedOf(seed, act, 2),
    act,
  });

  // Boss gate: seeded angle in NW-ish arc but grid-snapped
  const bossAng = -2.4 + rng() * 0.6;
  const bossDist = 58 + rng() * 14;
  let bossX = Math.cos(bossAng) * bossDist;
  let bossZ = Math.sin(bossAng) * bossDist;
  bossX = Math.max(-halfExtent + 14, Math.min(halfExtent - 14, bossX));
  bossZ = Math.max(-halfExtent + 14, Math.min(halfExtent - 14, bossZ));
  const bossId = add({
    name: ZONE_NAMES.boss_gate[round % 3]!,
    kind: "boss_gate",
    x: bossX,
    z: bossZ,
    radius: 14,
    color: KIND_COLOR.boss_gate!,
    claimable: false,
    owner: "wild",
    blurb: "Colossus staging chamber — mission goal.",
    areaLevel: 8 + levelBias,
    density: 0.95,
    areaSeed: areaSeedOf(seed, act, 3),
    act,
  });

  // ── Grid-fill wilderness (D2 map tiling spirit) ───────────────────────
  const cell = 22;
  const xs = snaps(halfExtent, cell);
  const zs = snaps(halfExtent, cell);
  // Shuffle cell centers deterministically
  const cells: Array<{ x: number; z: number }> = [];
  for (const x of xs) {
    for (const z of zs) {
      if (Math.hypot(x, z) < 18) continue;
      if (Math.hypot(x - 70, z + 14) < 24) continue;
      cells.push({ x, z });
    }
  }
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = cells[i]!;
    cells[i] = cells[j]!;
    cells[j] = t;
  }

  const targetAreas = 10 + Math.min(8, Math.floor(round * 1.5) + act);
  let filled = 0;
  for (const c of cells) {
    if (filled >= targetAreas) break;
    // Jitter inside cell
    const jx = (rng() - 0.5) * cell * 0.45;
    const jz = (rng() - 0.5) * cell * 0.45;
    const x = Math.max(-halfExtent + 12, Math.min(halfExtent - 12, c.x + jx));
    const z = Math.max(-halfExtent + 12, Math.min(halfExtent - 12, c.z + jz));
    const tpl = pickWeighted(rng, AREA_POOL);
    const radius = tpl.radius[0] + rng() * (tpl.radius[1] - tpl.radius[0]);
    if (tooClose(x, z, placed, 14 + radius * 0.2)) continue;

    const names = ZONE_NAMES[tpl.kind];
    const name = names[Math.floor(rng() * names.length)]!;
    const owner =
      tpl.owner === "none" && rng() < 0.12
        ? "pirates"
        : tpl.owner;

    add({
      name,
      kind: tpl.kind,
      x,
      z,
      radius,
      color: KIND_COLOR[tpl.kind] ?? 0x8899aa,
      claimable: tpl.claimable && owner !== "pirates",
      owner,
      blurb: tpl.blurb,
      areaLevel: Math.max(1, tpl.baseLevel + levelBias + Math.floor(rng() * 2)),
      density: Math.min(1, tpl.density + (round - 1) * 0.04),
      areaSeed: areaSeedOf(seed, act, 10 + filled),
      act,
    });
    filled++;
  }

  // Ensure minimum claim pads
  const claims = zones.filter((z) => z.claimable && z.owner === "none");
  if (claims.length < 4) {
    for (let i = 0; i < 4 - claims.length; i++) {
      const ang = rng() * Math.PI * 2;
      const dist = 30 + rng() * 35;
      const x = Math.cos(ang) * dist;
      const z = Math.sin(ang) * dist;
      if (tooClose(x, z, placed, 16)) continue;
      add({
        name: `${ZONE_NAMES.claim[i % 4]} ${String.fromCharCode(65 + i)}`,
        kind: "claim",
        x: Math.max(-halfExtent + 12, Math.min(halfExtent - 12, x)),
        z: Math.max(-halfExtent + 12, Math.min(halfExtent - 12, z)),
        radius: 10 + rng() * 3,
        color: KIND_COLOR.claim!,
        claimable: true,
        owner: "none",
        blurb: "War claim pad — build camp with C, man tower with V.",
        areaLevel: 2 + levelBias,
        density: 0.3,
        areaSeed: areaSeedOf(seed, act, 90 + i),
        act,
      });
    }
  }

  // ── Waypoint / connection graph (nearest-k neighbors) ─────────────────
  for (const z of zones) {
    const others = zones
      .filter((o) => o.id !== z.id)
      .map((o) => ({ id: o.id, d: Math.hypot(o.x - z.x, o.z - z.z) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 3);
    z.links = others.map((o) => o.id);
  }

  // Path hub → mid wilds → boss (for mission AI / map)
  const midCandidates = zones
    .filter((z) => z.kind !== "harbor" && z.kind !== "boss_gate" && z.id !== hubId)
    .map((z) => ({
      id: z.id,
      score:
        Math.hypot(z.x - bossX, z.z - bossZ) * 0.6 +
        Math.hypot(z.x, z.z) * 0.4 -
        z.areaLevel * 2,
    }))
    .sort((a, b) => a.score - b.score);
  const midId = midCandidates[Math.floor(midCandidates.length * 0.35)]?.id ?? hubId;
  const waypointPath = [hubId, midId, bossId].filter(
    (id, i, arr) => arr.indexOf(id) === i,
  );

  // Deployed chunks (3×3 grid)
  const deployedChunks: WorldChunkManifest["deployedChunks"] = [];
  for (let cz = -1; cz <= 1; cz++) {
    for (let cx = -1; cx <= 1; cx++) {
      const labels = ["NW", "N", "NE", "W", "Hub", "E", "SW", "S", "SE"];
      const li = (cz + 1) * 3 + (cx + 1);
      deployedChunks.push({
        cx,
        cz,
        label: labels[li] ?? `${cx},${cz}`,
      });
    }
  }

  void harborId;
  return {
    seed,
    round,
    halfExtent,
    actSeed,
    zones,
    deployedChunks,
    waypointPath,
  };
}

export function nearestClaimableZone(
  manifest: WorldChunkManifest,
  x: number,
  z: number,
  maxDist = 14,
): WorldZone | null {
  let best: WorldZone | null = null;
  let bestD = maxDist;
  for (const z0 of manifest.zones) {
    if (!z0.claimable || z0.owner === "player") continue;
    const d = Math.hypot(z0.x - x, z0.z - z);
    if (d < bestD) {
      bestD = d;
      best = z0;
    }
  }
  return best;
}

export function zoneAt(
  manifest: WorldChunkManifest,
  x: number,
  z: number,
): WorldZone | null {
  let best: WorldZone | null = null;
  let bestScore = Infinity;
  for (const z0 of manifest.zones) {
    const d = Math.hypot(z0.x - x, z0.z - z);
    if (d <= z0.radius && d < bestScore) {
      bestScore = d;
      best = z0;
    }
  }
  return best;
}

/** Density/level for spawn systems. */
export function zoneSpawnBias(
  manifest: WorldChunkManifest | null | undefined,
  x: number,
  z: number,
): { density: number; areaLevel: number; zone: WorldZone | null } {
  if (!manifest) return { density: 0.5, areaLevel: 3, zone: null };
  const z0 = zoneAt(manifest, x, z);
  if (!z0) return { density: 0.4, areaLevel: 2 + Math.min(8, manifest.round), zone: null };
  return { density: z0.density, areaLevel: z0.areaLevel, zone: z0 };
}
