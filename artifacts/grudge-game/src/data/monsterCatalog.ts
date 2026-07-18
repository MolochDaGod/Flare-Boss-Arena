/**
 * Unified Three.js monster / camp connection catalog.
 *
 * Sources wired into GameEngine spawn + resolveAnimatedModelId:
 *  - KayKit skeletons (uMMORPG undead roster) — local public/models/kaykit/enemies
 *  - Spiders / arachnids — mon_pincher + matriarch scale variants
 *  - Dark elf warband — KayKit themed + material tint
 *  - Local GLB monsters — public/models/monsters
 *  - CDN Quaternius pack — assets.grudge-studio.com
 *  - Camps — orc + dark-elf retheme of orc_camp_set.glb
 */

import type { Archetype } from "../game/EnemyFactory";
import { KIT_TEMPLATES } from "../game/KayKitCharacter";
import { ANIMATED_MONSTER_TEMPLATES, MONSTER_TEMPLATES } from "../game/MonsterModels";
import { CDN_MONSTER_TEMPLATES } from "./cdnMonsters";

export type MonsterFaction = "undead" | "dark_elf" | "arachnid" | "beast" | "orc" | "void" | "neutral";
export type MonsterSource = "kaykit" | "local_glb" | "cdn" | "procedural";

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
  /** Prefer for spawn pools tagged with this biome/camp. */
  camps?: Array<"orc" | "dark_elf" | "undead_crypt" | "spider_den">;
  /** Material tint applied after load (KayKit / mon packs). */
  tint?: number;
}

/** Dark-elf warband — uses KayKit enemy meshes with purple/cyan tint. */
export const DARK_ELF_TEMPLATES: CatalogEntry[] = [
  {
    id: "kit_delf_scout",
    name: "Dark Elf Scout",
    type: "humanoid",
    tier: 2,
    hp: 160,
    damage: 17,
    faction: "dark_elf",
    source: "kaykit",
    archetype: "humanoid",
    camps: ["dark_elf"],
    tint: 0x4a2060,
  },
  {
    id: "kit_delf_bladedancer",
    name: "Dark Elf Bladedancer",
    type: "humanoid",
    tier: 2,
    hp: 190,
    damage: 20,
    faction: "dark_elf",
    source: "kaykit",
    archetype: "humanoid",
    camps: ["dark_elf"],
    tint: 0x2a1848,
  },
  {
    id: "kit_delf_shadowmage",
    name: "Dark Elf Shadowmage",
    type: "undead",
    tier: 3,
    hp: 175,
    damage: 24,
    faction: "dark_elf",
    source: "kaykit",
    archetype: "humanoid",
    camps: ["dark_elf"],
    tint: 0x6a30a0,
  },
  {
    id: "kit_delf_captain",
    name: "Dark Elf Captain",
    type: "humanoid",
    tier: 4,
    hp: 320,
    damage: 28,
    faction: "dark_elf",
    source: "kaykit",
    archetype: "humanoid",
    camps: ["dark_elf"],
    tint: 0x1a0a30,
  },
];

/** Spider dens — pincher GLB + scaled matriarch. */
export const SPIDER_TEMPLATES: CatalogEntry[] = [
  {
    id: "mon_pincher",
    name: "Chitin Pincher",
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
    name: "Broodling",
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
    name: "Spider Matriarch",
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

/** Skeleton undead pack (uMMORPG / KayKit). */
export const SKELETON_TEMPLATES: CatalogEntry[] = KIT_TEMPLATES.map((t) => ({
  ...t,
  faction: "undead" as const,
  source: "kaykit" as const,
  archetype: "humanoid" as Archetype,
  camps: ["undead_crypt" as const, "dark_elf" as const],
}));

export const CATALOG_BY_ID = new Map<string, CatalogEntry>();

function index(entries: CatalogEntry[]) {
  for (const e of entries) CATALOG_BY_ID.set(e.id, e);
}

index(DARK_ELF_TEMPLATES);
index(SPIDER_TEMPLATES);
index(SKELETON_TEMPLATES);

for (const t of MONSTER_TEMPLATES) {
  if (!CATALOG_BY_ID.has(t.id)) {
    CATALOG_BY_ID.set(t.id, {
      ...t,
      faction: t.type === "arachnid" ? "arachnid" : t.type === "undead" ? "undead" : "beast",
      source: "local_glb",
      archetype: (t.type === "arachnid" ? "arachnid" : "humanoid") as Archetype,
    });
  }
}

for (const t of CDN_MONSTER_TEMPLATES) {
  if (!CATALOG_BY_ID.has(t.id)) {
    CATALOG_BY_ID.set(t.id, {
      ...t,
      faction: t.type === "undead" ? "undead" : t.type === "aberration" ? "void" : "beast",
      source: "cdn",
      archetype: "humanoid",
    });
  }
}

/** EnemyTemplate-shaped rows for spawn configs. */
export function catalogAsTemplates(
  entries: CatalogEntry[],
): Array<{ id: string; name: string; type: string; tier: number; hp: number; damage: number }> {
  return entries.map(({ id, name, type, tier, hp, damage }) => ({ id, name, type, tier, hp, damage }));
}

export const DARK_ELF_SPAWN_TEMPLATES = catalogAsTemplates(DARK_ELF_TEMPLATES);
export const SPIDER_SPAWN_TEMPLATES = catalogAsTemplates(SPIDER_TEMPLATES);

/** Deterministic FNV-1a for windups / special picks. */
export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Stable 0..1 from seed + salt. */
export function seededUnit(seed: number, salt = 0): number {
  let x = (seed ^ Math.imul(salt, 0x9e3779b9)) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x7feb352d);
  x = Math.imul(x ^ (x >>> 15), 0x846ca68b);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

/** Map catalog id → actual loader id (spider broodling → pincher mesh, etc.). */
export function resolveCatalogModelId(id: string): string {
  if (id === "mon_spider_broodling" || id === "mon_spider_matriarch") return "mon_pincher";
  // Dark elves reuse skeleton kit meshes with tints applied post-load.
  if (id === "kit_delf_scout") return "kit_skel_rogue";
  if (id === "kit_delf_bladedancer") return "kit_skel_warrior";
  if (id === "kit_delf_shadowmage") return "kit_skel_mage";
  if (id === "kit_delf_captain") return "kit_skel_warrior";
  return id;
}

export function catalogTint(id: string): number | undefined {
  return CATALOG_BY_ID.get(id)?.tint;
}

export function catalogScale(id: string): number {
  if (id === "mon_spider_broodling") return 0.55;
  if (id === "mon_spider_matriarch") return 1.65;
  if (id === "kit_delf_captain") return 1.12;
  return 1;
}
