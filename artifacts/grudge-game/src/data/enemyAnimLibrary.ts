/**
 * Enemy animation library — clip role classification + CDN / baked / Mixamo sources.
 *
 * Rules:
 *  • Display names must match the asset (file stem), never arbitrary fantasy labels
 *    on the wrong mesh (e.g. no "Storm Drake" on Yeti.glb).
 *  • Prefer authored multi-clip tracks inside the GLB/GLTF (Quaternius packs).
 *  • Fall back to Mixamo retarget library, then Grudge baked Bip001 packs.
 *
 * Quaternius Ultimate Monsters typically embed Idle / Walk / Run / Attack / Death
 * (and Bite_*, HitReact, etc.). GlbClipBank + classifyEnemyClips map those roles.
 */

import type { Archetype } from "../game/EnemyFactory";

/** Canonical locomotion / combat roles every enemy bank should try to fill. */
export type EnemyAnimRole =
  | "idle"
  | "walk"
  | "run"
  | "attack"
  | "hit"
  | "death"
  | "special";

/**
 * Name fragments (case-insensitive) used to classify embedded GLB tracks.
 * Ordered most-specific first within each role.
 */
export const ENEMY_CLIP_PATTERNS: Record<EnemyAnimRole, RegExp[]> = {
  idle: [
    /^idle$/i,
    /idle|stand|standing|breath|wait|rest|fight_idle|combat_idle/i,
  ],
  walk: [/walk|walking|trot|locom|move(?!ment)/i],
  run: [/run|running|sprint|jog|gallop|fly(?!ing_idle)/i],
  attack: [
    /attack|strike|slash|punch|swing|bite|cast|shoot|combo|melee|combat|headbutt|slap|claw|sting|spit|roar_attack/i,
  ],
  hit: [/hit|hurt|damage|react|flinch|impact|gethit|get_hit/i],
  death: [/death|die|dead|collapse|defeat|ko\b/i],
  special: [/special|skill|spell|howl|roar(?!_attack)|taunt|power|ultimate/i],
};

/**
 * Pick the best clip for a role from a list of AnimationClip-like names.
 * Exported for unit-style tests and GlbClipBank.
 */
export function pickClipByRole(
  clipNames: string[],
  role: EnemyAnimRole,
): string | undefined {
  const patterns = ENEMY_CLIP_PATTERNS[role];
  for (const re of patterns) {
    const hit = clipNames.find((n) => re.test(n));
    if (hit) return hit;
  }
  return undefined;
}

/** Map archetype → preferred Mixamo / baked pack flavour for fallback. */
export function animFallbackForArchetype(arch: Archetype): {
  mixamoRoles: Array<"idle" | "walk" | "run" | "attack">;
  bakedPack?: "unarmed" | "magic" | "sword_shield";
} {
  switch (arch) {
    case "flying":
      return { mixamoRoles: ["idle", "walk", "attack"], bakedPack: "unarmed" };
    case "quadruped":
    case "arachnid":
      return { mixamoRoles: ["idle", "walk", "run", "attack"] };
    case "golem":
      return { mixamoRoles: ["idle", "walk", "attack"], bakedPack: "unarmed" };
    case "humanoid":
    default:
      return { mixamoRoles: ["idle", "walk", "run", "attack"], bakedPack: "sword_shield" };
  }
}

/**
 * Grudge-arena baked Bip001 clip CDN (same library as allies / toon packs).
 * Used when a humanoid mesh has a Bip001 skeleton but no authored tracks.
 */
export const BAKED_ANIM_API =
  "https://grudge-arena.grudge-studio.com/api/assets/anims/baked";

/** Mixamo rotation-library paths (local first, then CDN mirrors if uploaded). */
export const MIXAMO_LIBRARY = {
  idle: [
    "models/anims/mixamo/idle.glb",
    "animations/mixamo/idle.glb",
  ],
  walk: [
    "models/anims/mixamo/walk.glb",
    "animations/mixamo/walk.glb",
  ],
  run: [
    "models/anims/mixamo/run.glb",
    "animations/mixamo/run.glb",
  ],
  attack: [
    "models/anims/mixamo/punch.glb",
    "animations/mixamo/punch.glb",
  ],
} as const;

/**
 * Human-readable label from a CDN path / file stem.
 * `.../Orc_Skull.glb` → `Orc Skull`, `MushroomKing` → `Mushroom King`.
 */
export function displayNameFromAssetPath(urlOrFile: string): string {
  const base = urlOrFile.split(/[/\\]/).pop() ?? urlOrFile;
  const stem = base.replace(/\.(glb|gltf)$/i, "");
  // Split CamelCase and underscores, then title-case each word (wolf → Wolf).
  return stem
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((w) => (w ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/** Stable id from asset stem: `Orc_Skull` → `cdn_orc_skull`. */
export function cdnIdFromStem(stem: string): string {
  const slug = stem
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .toLowerCase();
  return `cdn_${slug}`;
}
