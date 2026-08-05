/**
 * CDN monster pack — Quaternius-style GLBs on assets.grudge-studio.com.
 *
 * Naming rule (hard): `name` always matches the asset file stem
 * (e.g. Yeti.glb → "Yeti", Orc_Skull.glb → "Orc Skull"). Never rebadge a mesh
 * as a different creature (no "Storm Drake" on Yeti, no "Sky Horror" on Demon).
 *
 * Prefer `.glb` when present (binary multi-clip); fall back to `.gltf`.
 * Loaded at runtime so the SPA stays small. Clips are driven by GlbClipBank +
 * enemyAnimLibrary classification.
 */

import type { Archetype } from "../game/EnemyFactory";
import {
  cdnIdFromStem,
  displayNameFromAssetPath,
} from "./enemyAnimLibrary";

const CDN = "https://assets.grudge-studio.com";

export interface CdnMonsterDef {
  id: string;
  /** Must match asset stem (see displayNameFromAssetPath). */
  name: string;
  type: string;
  tier: number;
  hp: number;
  damage: number;
  /** Full URL to GLB/GLTF on Cloudflare R2. */
  url: string;
  /** File stem as stored on CDN (source of truth for the name). */
  assetStem: string;
  archetype: Archetype;
  height: number;
  /**
   * Prefer this clip name fragment for attack when classifying multi-clip packs.
   * null = let enemyAnimLibrary / GlbClipBank auto-classify.
   */
  clipHint: string | null;
  /** True when the pack is known to ship idle/walk/attack tracks. */
  hasAuthoredAnims: boolean;
}

function def(
  folder: "big" | "flying" | "root" | "creatures",
  stem: string,
  ext: "glb" | "gltf",
  opts: {
    type: string;
    tier: number;
    hp: number;
    damage: number;
    archetype: Archetype;
    height: number;
    clipHint?: string | null;
    hasAuthoredAnims?: boolean;
  },
): CdnMonsterDef {
  const path =
    folder === "root"
      ? `models/monsters/${stem}.${ext}`
      : folder === "creatures"
        ? `models/creatures/${stem}.${ext}`
        : `models/monsters/${folder}/${stem}.${ext}`;
  const name = displayNameFromAssetPath(`${stem}.${ext}`);
  return {
    id: cdnIdFromStem(stem),
    name,
    type: opts.type,
    tier: opts.tier,
    hp: opts.hp,
    damage: opts.damage,
    url: `${CDN}/${path}`,
    assetStem: stem,
    archetype: opts.archetype,
    height: opts.height,
    clipHint: opts.clipHint ?? null,
    // Quaternius Ultimate Monsters / creatures typically embed multi-clip banks
    hasAuthoredAnims: opts.hasAuthoredAnims ?? true,
  };
}

/**
 * Curated set — every entry verified present on assets.grudge-studio.com.
 * Names = asset stems only.
 */
export const CDN_MONSTER_DEFS: CdnMonsterDef[] = [
  // ── Ground (big/) ────────────────────────────────────────────────────────
  def("big", "Demon", "glb", { type: "demon", tier: 4, hp: 480, damage: 28, archetype: "golem", height: 2.8 }),
  def("big", "Yeti", "glb", { type: "beast", tier: 3, hp: 380, damage: 24, archetype: "quadruped", height: 2.6 }),
  def("big", "MushroomKing", "glb", { type: "plant", tier: 3, hp: 340, damage: 20, archetype: "golem", height: 2.4 }),
  def("big", "Orc", "glb", { type: "humanoid", tier: 2, hp: 260, damage: 18, archetype: "humanoid", height: 2.1 }),
  def("big", "Orc_Skull", "glb", { type: "undead", tier: 3, hp: 300, damage: 22, archetype: "humanoid", height: 2.15 }),
  def("big", "Ninja", "glb", { type: "humanoid", tier: 2, hp: 220, damage: 20, archetype: "humanoid", height: 1.95 }),
  def("big", "Alien", "glb", { type: "aberration", tier: 3, hp: 310, damage: 23, archetype: "humanoid", height: 2.2 }),
  def("big", "Cactoro", "glb", { type: "plant", tier: 2, hp: 240, damage: 16, archetype: "golem", height: 2.0 }),
  def("big", "Monkroose", "glb", { type: "beast", tier: 2, hp: 230, damage: 17, archetype: "quadruped", height: 2.0 }),
  def("big", "Bunny", "glb", { type: "beast", tier: 1, hp: 120, damage: 10, archetype: "quadruped", height: 1.4 }),
  def("big", "Fish", "glb", { type: "beast", tier: 1, hp: 100, damage: 9, archetype: "quadruped", height: 1.2 }),
  def("big", "Dino", "glb", { type: "beast", tier: 3, hp: 400, damage: 26, archetype: "quadruped", height: 2.5 }),
  def("big", "Frog", "glb", { type: "beast", tier: 1, hp: 110, damage: 11, archetype: "quadruped", height: 1.3 }),

  // ── Flying ───────────────────────────────────────────────────────────────
  def("flying", "Ghost", "glb", { type: "undead", tier: 2, hp: 180, damage: 15, archetype: "flying", height: 1.8 }),
  def("flying", "Ghost_Skull", "glb", { type: "undead", tier: 3, hp: 210, damage: 19, archetype: "flying", height: 1.9 }),
  def("flying", "Armabee", "glb", { type: "insect", tier: 2, hp: 160, damage: 14, archetype: "flying", height: 1.5 }),
  def("flying", "Armabee_Evolved", "glb", { type: "insect", tier: 3, hp: 260, damage: 20, archetype: "flying", height: 1.85 }),
  def("flying", "Demon", "glb", { type: "demon", tier: 4, hp: 440, damage: 27, archetype: "flying", height: 2.6 }),
  def("flying", "Dragon", "gltf", { type: "dragon", tier: 5, hp: 720, damage: 36, archetype: "flying", height: 3.2 }),
  def("flying", "Pigeon", "gltf", { type: "beast", tier: 1, hp: 90, damage: 8, archetype: "flying", height: 1.1 }),

  // ── Root monsters/ (gltf pack) ───────────────────────────────────────────
  def("root", "Bat", "gltf", { type: "beast", tier: 1, hp: 95, damage: 9, archetype: "flying", height: 1.0 }),
  def("root", "Cyclops", "gltf", { type: "giant", tier: 4, hp: 520, damage: 30, archetype: "golem", height: 3.0 }),
  def("root", "Cthulhu", "gltf", { type: "aberration", tier: 5, hp: 680, damage: 34, archetype: "golem", height: 2.9 }),
  def("root", "Crab", "gltf", { type: "beast", tier: 2, hp: 200, damage: 16, archetype: "arachnid", height: 1.4 }),
  def("root", "Chicken", "gltf", { type: "beast", tier: 1, hp: 80, damage: 7, archetype: "quadruped", height: 1.0 }),
  def("root", "Pig", "gltf", { type: "beast", tier: 1, hp: 110, damage: 9, archetype: "quadruped", height: 1.15 }),
  def("root", "Deer", "gltf", { type: "beast", tier: 1, hp: 130, damage: 10, archetype: "quadruped", height: 1.6 }),
  def("root", "Mushroom", "gltf", { type: "plant", tier: 2, hp: 200, damage: 14, archetype: "golem", height: 1.7 }),

  // ── Creatures pack ───────────────────────────────────────────────────────
  def("creatures", "wolf", "glb", { type: "beast", tier: 2, hp: 210, damage: 17, archetype: "quadruped", height: 1.5 }),
  def("creatures", "bear", "glb", { type: "beast", tier: 3, hp: 360, damage: 24, archetype: "quadruped", height: 2.2 }),

  // ── threejs-games R2 neutrals (FBX) ──────────────────────────────────────
  ...([
    ["tjg_goblin", "Goblin", "goblin/model.fbx", "creep", 1, 35, 6, "humanoid", 1.35],
    ["tjg_orc", "Orc", "orc/model.fbx", "creep", 2, 55, 10, "humanoid", 1.85],
    ["tjg_skeleton", "Skeleton", "skeleton/model.fbx", "creep", 1, 40, 8, "humanoid", 1.8],
    ["tjg_troll", "Troll", "troll/model.fbx", "creep", 3, 110, 13, "humanoid", 2.3],
    ["tjg_golem", "Golem", "golem/model.fbx", "creep", 4, 140, 16, "golem", 2.4],
    ["tjg_demon", "Demon", "demon/model.fbx", "creep", 3, 90, 14, "humanoid", 2.2],
    ["tjg_witch", "Witch", "witch/model.fbx", "creep", 2, 48, 11, "humanoid", 1.7],
    ["tjg_sorceress", "Sorceress", "sorceress/model.fbx", "creep", 2, 45, 12, "humanoid", 1.75],
    ["tjg_orc_ogre", "Orc Ogre", "orc-ogre/model.fbx", "creep", 3, 120, 18, "golem", 2.5],
    ["tjg_zombie", "Zombie", "zombie/zombie-barefoot.fbx", "creep", 1, 50, 9, "humanoid", 1.75],
    ["tjg_zombie_guard", "Zombie Guard", "zombie/zombie-guard.fbx", "creep", 2, 70, 11, "humanoid", 1.85],
    ["tjg_zombie_cop", "Zombie Cop", "zombie/zombie-cop.fbx", "creep", 2, 60, 10, "humanoid", 1.8],
  ] as const).map(
    ([id, name, rel, type, tier, hp, damage, archetype, height]) =>
      ({
        id,
        name,
        type,
        tier,
        hp,
        damage,
        url: `${CDN}/models/creeps/threejs-games/${rel}`,
        assetStem: name.replace(/\s+/g, "_"),
        archetype: archetype as Archetype,
        height,
        clipHint: "idle",
        hasAuthoredAnims: true,
      }) satisfies CdnMonsterDef,
  ),
];

// Deduplicate by id (flying Demon vs big Demon → keep both with unique stems)
// big Demon = cdn_demon, flying Demon would collide — fix flying to stem path prefix
// Rebuild flying Demon id to be unique:
{
  const flyingDemon = CDN_MONSTER_DEFS.find(
    (d) => d.assetStem === "Demon" && d.url.includes("/flying/"),
  );
  if (flyingDemon) {
    flyingDemon.id = "cdn_flying_demon";
    // Name still matches asset: "Demon" — distinguish in name with folder? User wants asset name.
    // Keep name "Demon"; id unique for lookups.
  }
}

export const CDN_MONSTER_BY_ID = new Map(CDN_MONSTER_DEFS.map((d) => [d.id, d]));

export function isCdnMonsterId(id: string): boolean {
  return CDN_MONSTER_BY_ID.has(id);
}

/** Templates for spawn pools — id + name always track the CDN asset. */
export const CDN_MONSTER_TEMPLATES = CDN_MONSTER_DEFS.map((d) => ({
  id: d.id,
  name: d.name,
  type: d.type,
  tier: d.tier,
  hp: d.hp,
  damage: d.damage,
}));

/** Prefer entries known to ship multi-clip packs for combat showcases. */
export const CDN_ANIMATED_TEMPLATES = CDN_MONSTER_DEFS.filter((d) => d.hasAuthoredAnims).map(
  (d) => ({
    id: d.id,
    name: d.name,
    type: d.type,
    tier: d.tier,
    hp: d.hp,
    damage: d.damage,
  }),
);
