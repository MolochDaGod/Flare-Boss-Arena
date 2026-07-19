/**
 * Game-ready Three.js instance registry for Unity-exported uMMORPG prefabs.
 *
 * Export pipeline: scripts/unity-export/
 * Runtime loader: game/UnityInstanceLoader.ts
 * Dark Elf Camp slot: game/DarkElfCamp.ts → DARK_ELF_CAMP_PREFAB_URL
 */

export type UnityInstanceKind = "camp" | "dungeon" | "arena" | "prop";
export type UnityInstanceMode = "pve" | "pvp" | "hub";

export interface UnityInstanceDef {
  id: string;
  name: string;
  kind: UnityInstanceKind;
  /** Local public path (preferred after export). */
  localUrl: string;
  /** Optional CDN mirror when uploaded to R2. */
  cdnUrl?: string;
  /** Target footprint width (m) for auto-scale. */
  targetSpanM: number;
  /** Suggested player spawn offsets (local). */
  spawns: Array<[number, number, number]>;
  /** Max co-op players (PvE) or arena seats (PvP). */
  maxPlayers: number;
  modes: UnityInstanceMode[];
  /** Nav / combat hints */
  combat: {
    bossSlots?: number;
    aggroRadius?: number;
    respawnSec?: number;
  };
  tags: string[];
  /** True when GLB has been exported into public/models/unity */
  requiresExport: boolean;
}

const LOCAL = (id: string) => `${import.meta.env.BASE_URL}models/unity/${id}.glb`;
const CDN = "https://assets.grudge-studio.com/models/unity";

export const UNITY_INSTANCES: UnityInstanceDef[] = [
  {
    id: "dark_elf_camp",
    name: "Dark Elf Camp",
    kind: "camp",
    localUrl: LOCAL("dark_elf_camp"),
    cdnUrl: `${CDN}/dark_elf_camp.glb`,
    targetSpanM: 36,
    spawns: [
      [0, 0, 14],
      [8, 0, 10],
      [-8, 0, 10],
      [0, 0, -12],
    ],
    maxPlayers: 4,
    modes: ["pve", "hub"],
    combat: { bossSlots: 1, aggroRadius: 22, respawnSec: 90 },
    tags: ["dark_elf", "camp", "unity", "ummorpg"],
    requiresExport: true,
  },
  {
    id: "dark_elf_encampment",
    name: "Dark Elf Encampment",
    kind: "camp",
    localUrl: LOCAL("dark_elf_encampment"),
    cdnUrl: `${CDN}/dark_elf_encampment.glb`,
    targetSpanM: 48,
    spawns: [
      [0, 0, 18],
      [12, 0, 12],
      [-12, 0, 12],
    ],
    maxPlayers: 5,
    modes: ["pve"],
    combat: { bossSlots: 1, aggroRadius: 28, respawnSec: 100 },
    tags: ["dark_elf", "camp", "unity"],
    requiresExport: true,
  },
  {
    id: "dark_elf_stronghold",
    name: "Dark Elf Stronghold",
    kind: "dungeon",
    localUrl: LOCAL("dark_elf_stronghold"),
    cdnUrl: `${CDN}/dark_elf_stronghold.glb`,
    targetSpanM: 64,
    spawns: [
      [0, 0, 24],
      [10, 0, 20],
      [-10, 0, 20],
      [0, 0, 16],
    ],
    maxPlayers: 5,
    modes: ["pve"],
    combat: { bossSlots: 2, aggroRadius: 32, respawnSec: 120 },
    tags: ["dark_elf", "dungeon", "unity"],
    requiresExport: true,
  },
  {
    id: "dark_elf_castle",
    name: "Dark Elf Castle",
    kind: "dungeon",
    localUrl: LOCAL("dark_elf_castle"),
    cdnUrl: `${CDN}/dark_elf_castle.glb`,
    targetSpanM: 80,
    spawns: [
      [0, 0, 30],
      [14, 0, 26],
      [-14, 0, 26],
    ],
    maxPlayers: 5,
    modes: ["pve"],
    combat: { bossSlots: 3, aggroRadius: 40, respawnSec: 150 },
    tags: ["dark_elf", "dungeon", "castle", "unity"],
    requiresExport: true,
  },
  {
    id: "dark_elf_castle_lv1",
    name: "Dark Elf Castle Lv1",
    kind: "dungeon",
    localUrl: LOCAL("dark_elf_castle_lv1"),
    cdnUrl: `${CDN}/dark_elf_castle_lv1.glb`,
    targetSpanM: 72,
    spawns: [
      [0, 0, 28],
      [12, 0, 22],
    ],
    maxPlayers: 4,
    modes: ["pve"],
    combat: { bossSlots: 2, aggroRadius: 36, respawnSec: 130 },
    tags: ["dark_elf", "dungeon", "castle", "unity"],
    requiresExport: true,
  },
  {
    id: "dungeon_catacombs",
    name: "Catacombs",
    kind: "dungeon",
    localUrl: LOCAL("dungeon_catacombs"),
    cdnUrl: `${CDN}/dungeon_catacombs.glb`,
    targetSpanM: 60,
    spawns: [
      [0, 0, 20],
      [8, 0, 16],
      [-8, 0, 16],
    ],
    maxPlayers: 5,
    modes: ["pve"],
    combat: { bossSlots: 1, aggroRadius: 24, respawnSec: 100 },
    tags: ["dungeon", "undead", "unity"],
    requiresExport: true,
  },
  {
    id: "dungeon_main",
    name: "Dungeon",
    kind: "dungeon",
    localUrl: LOCAL("dungeon_main"),
    cdnUrl: `${CDN}/dungeon_main.glb`,
    targetSpanM: 55,
    spawns: [
      [0, 0, 18],
      [6, 0, 14],
    ],
    maxPlayers: 4,
    modes: ["pve"],
    combat: { bossSlots: 1, aggroRadius: 22, respawnSec: 90 },
    tags: ["dungeon", "unity"],
    requiresExport: true,
  },
  {
    id: "dungeon_sewer",
    name: "Sewer",
    kind: "dungeon",
    localUrl: LOCAL("dungeon_sewer"),
    cdnUrl: `${CDN}/dungeon_sewer.glb`,
    targetSpanM: 50,
    spawns: [
      [0, 0, 16],
      [5, 0, 12],
    ],
    maxPlayers: 4,
    modes: ["pve"],
    combat: { bossSlots: 1, aggroRadius: 20, respawnSec: 90 },
    tags: ["dungeon", "unity"],
    requiresExport: true,
  },
  {
    id: "dungeon_stronghold",
    name: "Stronghold",
    kind: "dungeon",
    localUrl: LOCAL("dungeon_stronghold"),
    cdnUrl: `${CDN}/dungeon_stronghold.glb`,
    targetSpanM: 70,
    spawns: [
      [0, 0, 22],
      [10, 0, 18],
      [-10, 0, 18],
    ],
    maxPlayers: 5,
    modes: ["pve", "pvp"],
    combat: { bossSlots: 2, aggroRadius: 30, respawnSec: 110 },
    tags: ["dungeon", "arena-capable", "unity"],
    requiresExport: true,
  },
  {
    id: "dungeon_underground_ruins",
    name: "Underground Ruins",
    kind: "dungeon",
    localUrl: LOCAL("dungeon_underground_ruins"),
    cdnUrl: `${CDN}/dungeon_underground_ruins.glb`,
    targetSpanM: 58,
    spawns: [
      [0, 0, 18],
      [7, 0, 14],
    ],
    maxPlayers: 4,
    modes: ["pve"],
    combat: { bossSlots: 1, aggroRadius: 24, respawnSec: 100 },
    tags: ["dungeon", "ruins", "unity"],
    requiresExport: true,
  },
  {
    id: "arena_flat",
    name: "Arena Pit",
    kind: "arena",
    /** Procedural fallback — no Unity export required */
    localUrl: "",
    targetSpanM: 40,
    spawns: [
      [12, 0, 0],
      [-12, 0, 0],
      [0, 0, 12],
      [0, 0, -12],
      [8, 0, 8],
      [-8, 0, -8],
      [8, 0, -8],
      [-8, 0, 8],
    ],
    maxPlayers: 8,
    modes: ["pvp"],
    combat: { respawnSec: 5 },
    tags: ["arena", "pvp", "procedural"],
    requiresExport: false,
  },
];

export const UNITY_INSTANCE_BY_ID = new Map(UNITY_INSTANCES.map((d) => [d.id, d]));

export function getUnityInstance(id: string): UnityInstanceDef | undefined {
  return UNITY_INSTANCE_BY_ID.get(id);
}

export function listInstances(filter?: {
  kind?: UnityInstanceKind;
  mode?: UnityInstanceMode;
  tag?: string;
}): UnityInstanceDef[] {
  return UNITY_INSTANCES.filter((d) => {
    if (filter?.kind && d.kind !== filter.kind) return false;
    if (filter?.mode && !d.modes.includes(filter.mode)) return false;
    if (filter?.tag && !d.tags.includes(filter.tag)) return false;
    return true;
  });
}

/** Prefer local public path; CDN as fallback when online. */
export function resolveInstanceUrl(def: UnityInstanceDef, preferCdn = false): string {
  if (!def.localUrl && def.cdnUrl) return def.cdnUrl;
  if (preferCdn && def.cdnUrl) return def.cdnUrl;
  return def.localUrl || def.cdnUrl || "";
}

/** Dark Elf Camp public URL used by DarkElfCamp.ts */
export function darkElfCampPrefabUrl(): string {
  const def = UNITY_INSTANCE_BY_ID.get("dark_elf_camp");
  return def ? resolveInstanceUrl(def) : `${import.meta.env.BASE_URL}models/buildings/dark_elf_camp_prefab.glb`;
}
