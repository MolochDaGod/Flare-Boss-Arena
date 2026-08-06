/**
 * Unified Three.js monster catalog — uMMORPG / local GLB only (no KayKit).
 *
 * Sources:
 *  - mon_skeleton_ummo / mon_skeleton_warrior_ummo / mon_dark_elf
 *  - mon_pincher spider den variants
 *  - Other local mon_* + CDN Quaternius
 */

import type { Archetype } from "../game/EnemyFactory";
import { ANIMATED_MONSTER_TEMPLATES, MONSTER_TEMPLATES } from "../game/MonsterModels";
import { CDN_ANIMATED_TEMPLATES, CDN_MONSTER_TEMPLATES } from "./cdnMonsters";

export type MonsterFaction = "undead" | "dark_elf" | "arachnid" | "beast" | "orc" | "void" | "neutral" | "voxel";
export type MonsterSource = "ummorpg" | "local_glb" | "cdn" | "procedural";

export interface CatalogEntry {
  id: string;
  name: string;
  type: string;
  tier: number;
  hp: number;
  damage: number;
  faction: MonsterFaction;
  source: MonsterSource;
  archetype: Archetype;
  camps?: Array<"orc" | "dark_elf" | "undead_crypt" | "spider_den">;
  tint?: number;
}

/**
 * Dark Elf — mesh is always `dark_elf.glb`. Variant ids only change stats/tint;
 * the display name stays "Dark Elf" (asset-faithful).
 */
export const DARK_ELF_TEMPLATES: CatalogEntry[] = [
  {
    id: "mon_dark_elf",
    name: "Dark Elf",
    type: "humanoid",
    tier: 3,
    hp: 280,
    damage: 22,
    faction: "dark_elf",
    source: "ummorpg",
    archetype: "humanoid",
    camps: ["dark_elf"],
  },
  {
    id: "mon_dark_elf_raider",
    name: "Dark Elf",
    type: "humanoid",
    tier: 2,
    hp: 190,
    damage: 18,
    faction: "dark_elf",
    source: "ummorpg",
    archetype: "humanoid",
    camps: ["dark_elf"],
    tint: 0x4a2060,
  },
  {
    id: "mon_dark_elf_captain",
    name: "Dark Elf",
    type: "humanoid",
    tier: 4,
    hp: 360,
    damage: 28,
    faction: "dark_elf",
    source: "ummorpg",
    archetype: "humanoid",
    camps: ["dark_elf"],
    tint: 0x1a0a30,
  },
];

/**
 * Pincher dens — every entry uses pincher.glb (scale/tint variants).
 * Names stay "Pincher" so HUD text matches the asset.
 */
export const SPIDER_TEMPLATES: CatalogEntry[] = [
  {
    id: "mon_pincher",
    name: "Pincher",
    type: "arachnid",
    tier: 2,
    hp: 190,
    damage: 14,
    faction: "arachnid",
    source: "local_glb",
    archetype: "arachnid",
    camps: ["spider_den"],
  },
  {
    id: "mon_spider_broodling",
    name: "Pincher",
    type: "arachnid",
    tier: 1,
    hp: 85,
    damage: 9,
    faction: "arachnid",
    source: "local_glb",
    archetype: "arachnid",
    camps: ["spider_den"],
  },
  {
    id: "mon_spider_matriarch",
    name: "Pincher",
    type: "arachnid",
    tier: 4,
    hp: 480,
    damage: 26,
    faction: "arachnid",
    source: "local_glb",
    archetype: "arachnid",
    camps: ["spider_den"],
  },
];

/** Skeleton meshes — names match skeleton.glb / skeleton_warrior_ummo.glb. */
export const SKELETON_TEMPLATES: CatalogEntry[] = [
  {
    id: "mon_skeleton_ummo",
    name: "Skeleton",
    type: "undead",
    tier: 2,
    hp: 200,
    damage: 16,
    faction: "undead",
    source: "ummorpg",
    archetype: "humanoid",
    camps: ["undead_crypt", "dark_elf"],
  },
  {
    id: "mon_skeleton_warrior_ummo",
    name: "Skeleton Warrior",
    type: "undead",
    tier: 2,
    hp: 210,
    damage: 18,
    faction: "undead",
    source: "ummorpg",
    archetype: "humanoid",
    camps: ["undead_crypt"],
  },
];

export const CATALOG_BY_ID = new Map<string, CatalogEntry>();

function index(entries: CatalogEntry[]) {
  for (const e of entries) CATALOG_BY_ID.set(e.id, e);
}

index(DARK_ELF_TEMPLATES);
index(SPIDER_TEMPLATES);
index(SKELETON_TEMPLATES);

/** Voxel / pixel humanoid roster (local GLB multi-clip). */
export const VOXEL_TEMPLATES: CatalogEntry[] = [
  {
    id: "mon_pixel_morocc",
    name: "Pixel Morocc",
    type: "voxel",
    tier: 2,
    hp: 240,
    damage: 18,
    faction: "voxel",
    source: "local_glb",
    archetype: "humanoid",
  },
];

index(VOXEL_TEMPLATES);

for (const t of MONSTER_TEMPLATES) {
  if (!CATALOG_BY_ID.has(t.id)) {
    const faction: MonsterFaction =
      t.type === "arachnid"
        ? "arachnid"
        : t.type === "undead"
          ? "undead"
          : t.type === "voxel"
            ? "voxel"
            : "beast";
    CATALOG_BY_ID.set(t.id, {
      ...t,
      faction,
      source: "local_glb",
      archetype: (t.type === "arachnid" ? "arachnid" : "humanoid") as Archetype,
    });
  }
}

for (const t of CDN_MONSTER_TEMPLATES) {
  if (!CATALOG_BY_ID.has(t.id)) {
    const arch: Archetype =
      t.type === "dragon" || t.type === "insect"
        ? "flying"
        : t.type === "plant" || t.type === "giant" || t.type === "demon"
          ? "golem"
          : t.type === "humanoid" || t.type === "undead"
            ? "humanoid"
            : t.type === "arachnid"
              ? "arachnid"
              : "quadruped";
    CATALOG_BY_ID.set(t.id, {
      ...t,
      faction:
        t.type === "undead"
          ? "undead"
          : t.type === "aberration" || t.type === "demon"
            ? "void"
            : t.type === "humanoid" && /orc/i.test(t.name)
              ? "orc"
              : "beast",
      source: "cdn",
      archetype: arch,
    });
  }
}

/** CDN monsters preferred for spawn (authored multi-clip packs). */
export const CDN_SPAWN_TEMPLATES = CDN_ANIMATED_TEMPLATES;

export function catalogAsTemplates(
  entries: CatalogEntry[],
): Array<{ id: string; name: string; type: string; tier: number; hp: number; damage: number }> {
  return entries.map(({ id, name, type, tier, hp, damage }) => ({ id, name, type, tier, hp, damage }));
}

export const DARK_ELF_SPAWN_TEMPLATES = catalogAsTemplates(DARK_ELF_TEMPLATES);
export const SPIDER_SPAWN_TEMPLATES = catalogAsTemplates(SPIDER_TEMPLATES);
export const SKELETON_SPAWN_TEMPLATES = catalogAsTemplates(SKELETON_TEMPLATES);
export const VOXEL_SPAWN_TEMPLATES = catalogAsTemplates(VOXEL_TEMPLATES);
/** Prefer animated local mon packs that still have clips. */
export const UMMORPG_ANIMATED_SPAWN = ANIMATED_MONSTER_TEMPLATES.filter(
  (t) => !t.id.startsWith("kit_"),
);

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function seededUnit(seed: number, salt = 0): number {
  let x = (seed ^ Math.imul(salt, 0x9e3779b9)) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x7feb352d);
  x = Math.imul(x ^ (x >>> 15), 0x846ca68b);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

export function resolveCatalogModelId(id: string): string {
  if (id === "mon_spider_broodling" || id === "mon_spider_matriarch") return "mon_pincher";
  // All dark elf variants use dark_elf.glb
  if (id.startsWith("mon_dark_elf")) return "mon_dark_elf";
  if (id === "mon_skeleton" || id === "skeleton") return "mon_skeleton_ummo";
  // Never resolve to KayKit
  if (id.startsWith("kit_")) return "mon_skeleton_ummo";
  return id;
}

export function catalogTint(id: string): number | undefined {
  return CATALOG_BY_ID.get(id)?.tint;
}

export function catalogScale(id: string): number {
  if (id === "mon_spider_broodling") return 0.55;
  if (id === "mon_spider_matriarch") return 1.65;
  if (id === "mon_dark_elf_captain") return 1.12;
  if (id === "mon_dark_elf_raider") return 0.95;
  return 1;
}
