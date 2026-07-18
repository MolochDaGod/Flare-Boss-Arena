/**
 * CDN / D1 monster pack — lightweight Quaternius-style GLBs on assets.grudge-studio.com.
 * Loaded at runtime (not bundled) so the SPA stays small.
 */

import type { Archetype } from "../game/EnemyFactory";

const CDN = "https://assets.grudge-studio.com";

export interface CdnMonsterDef {
  id: string;
  name: string;
  type: string;
  tier: number;
  hp: number;
  damage: number;
  /** Full URL to GLB/GLTF. */
  url: string;
  archetype: Archetype;
  height: number;
  /** Prefer first matching clip name fragment; null = procedural sway. */
  clipHint: string | null;
}

/** Curated game-ready set from D1 asset_registry (monster category). */
export const CDN_MONSTER_DEFS: CdnMonsterDef[] = [
  { id: "cdn_demon", name: "Pit Demon", type: "beast", tier: 4, hp: 480, damage: 28, url: `${CDN}/models/monsters/big/Demon.glb`, archetype: "golem", height: 2.8, clipHint: null },
  { id: "cdn_yeti", name: "Frost Yeti", type: "beast", tier: 3, hp: 380, damage: 24, url: `${CDN}/models/monsters/big/Yeti.glb`, archetype: "quadruped", height: 2.6, clipHint: null },
  { id: "cdn_mushroom", name: "Mushroom King", type: "plant", tier: 3, hp: 340, damage: 20, url: `${CDN}/models/monsters/big/MushroomKing.glb`, archetype: "golem", height: 2.4, clipHint: null },
  { id: "cdn_orc", name: "Warband Orc", type: "humanoid", tier: 2, hp: 260, damage: 18, url: `${CDN}/models/monsters/big/Orc.glb`, archetype: "humanoid", height: 2.1, clipHint: null },
  { id: "cdn_orc_skull", name: "Skull Orc", type: "undead", tier: 3, hp: 300, damage: 22, url: `${CDN}/models/monsters/big/Orc_Skull.glb`, archetype: "humanoid", height: 2.15, clipHint: null },
  { id: "cdn_ninja", name: "Shadow Ninja", type: "humanoid", tier: 2, hp: 220, damage: 20, url: `${CDN}/models/monsters/big/Ninja.glb`, archetype: "humanoid", height: 1.95, clipHint: null },
  { id: "cdn_alien", name: "Void Alien", type: "aberration", tier: 3, hp: 310, damage: 23, url: `${CDN}/models/monsters/big/Alien.glb`, archetype: "humanoid", height: 2.2, clipHint: null },
  { id: "cdn_cactoro", name: "Cactoro", type: "plant", tier: 2, hp: 240, damage: 16, url: `${CDN}/models/monsters/big/Cactoro.glb`, archetype: "golem", height: 2.0, clipHint: null },
  { id: "cdn_monkroose", name: "Monkroose", type: "beast", tier: 2, hp: 230, damage: 17, url: `${CDN}/models/monsters/big/Monkroose.glb`, archetype: "quadruped", height: 2.0, clipHint: null },
  { id: "cdn_ghost", name: "Wailing Ghost", type: "undead", tier: 2, hp: 180, damage: 15, url: `${CDN}/models/monsters/flying/Ghost.gltf`, archetype: "flying", height: 1.8, clipHint: null },
  { id: "cdn_ghost_skull", name: "Skull Ghost", type: "undead", tier: 3, hp: 210, damage: 19, url: `${CDN}/models/monsters/flying/Ghost_Skull.gltf`, archetype: "flying", height: 1.9, clipHint: null },
  // Flying elite / boss-adjacent flyers (Mixamo retarget when clipHint null)
  { id: "cdn_sky_horror", name: "Sky Horror", type: "dragon", tier: 5, hp: 720, damage: 36, url: `${CDN}/models/monsters/big/Demon.glb`, archetype: "flying", height: 3.2, clipHint: null },
  { id: "cdn_storm_drake", name: "Storm Drake", type: "dragon", tier: 4, hp: 560, damage: 30, url: `${CDN}/models/monsters/big/Yeti.glb`, archetype: "flying", height: 2.9, clipHint: null },
  // Extra undead / void bodies when CDN paths resolve (local kit skeletons still preferred for skeleton fights).
  { id: "cdn_undead_brute", name: "Undead Brute", type: "undead", tier: 3, hp: 340, damage: 22, url: `${CDN}/models/monsters/big/Orc_Skull.glb`, archetype: "humanoid", height: 2.2, clipHint: null },
  { id: "cdn_void_shade", name: "Void Shade", type: "aberration", tier: 3, hp: 250, damage: 21, url: `${CDN}/models/monsters/flying/Ghost_Skull.gltf`, archetype: "flying", height: 1.95, clipHint: null },
];

export const CDN_MONSTER_BY_ID = new Map(CDN_MONSTER_DEFS.map((d) => [d.id, d]));

export function isCdnMonsterId(id: string): boolean {
  return CDN_MONSTER_BY_ID.has(id);
}

export const CDN_MONSTER_TEMPLATES = CDN_MONSTER_DEFS.map((d) => ({
  id: d.id,
  name: d.name,
  type: d.type,
  tier: d.tier,
  hp: d.hp,
  damage: d.damage,
}));
