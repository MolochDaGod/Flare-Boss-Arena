/**
 * VFX presets — synced with Grudge VFX sandbox / wg-vfx-catalog.
 * Used for projectile silhouettes, cast auras, and element defaults.
 */

export type VfxProjectileKind =
  | "flame_ball"
  | "ice_ball"
  | "lightning_ball"
  | "chaos_orb"
  | "arrow_trail"
  | "bullet"
  | "holy_orb";

export interface VfxProjectilePreset {
  kind: VfxProjectileKind;
  primary: number;
  secondary: number;
  speed: number;
  gravity: number;
  size: number;
  spin: number;
}

export const VFX_PROJECTILES: Record<VfxProjectileKind, VfxProjectilePreset> = {
  flame_ball: { kind: "flame_ball", primary: 0xff4400, secondary: 0xffcc00, speed: 14, gravity: 2.5, size: 0.42, spin: 8 },
  ice_ball: { kind: "ice_ball", primary: 0x44ddff, secondary: 0xffffff, speed: 16, gravity: 1.2, size: 0.38, spin: 6 },
  lightning_ball: { kind: "lightning_ball", primary: 0xffff44, secondary: 0xaaddff, speed: 22, gravity: 0, size: 0.35, spin: 14 },
  chaos_orb: { kind: "chaos_orb", primary: 0xaa44ff, secondary: 0xff66cc, speed: 15, gravity: 0.8, size: 0.4, spin: 10 },
  arrow_trail: { kind: "arrow_trail", primary: 0xe8c878, secondary: 0xcdeac0, speed: 28, gravity: 4, size: 0.22, spin: 0 },
  bullet: { kind: "bullet", primary: 0xffee88, secondary: 0xffaa44, speed: 32, gravity: 0.5, size: 0.14, spin: 0 },
  holy_orb: { kind: "holy_orb", primary: 0xffee44, secondary: 0xffffff, speed: 14, gravity: 1, size: 0.36, spin: 5 },
};

import type { SkillElement } from "../game/combat/particles";

export function projectileForElement(element: SkillElement, skillTags?: string): VfxProjectilePreset {
  const hay = (skillTags ?? "").toLowerCase();
  if (hay.includes("arrow") || hay.includes("shot") || hay.includes("bow") || hay.includes("pierce")) {
    return VFX_PROJECTILES.arrow_trail;
  }
  if (hay.includes("gun") || hay.includes("bullet") || hay.includes("burst") || hay.includes("salvo")) {
    return VFX_PROJECTILES.bullet;
  }
  switch (element) {
    case "fire": return VFX_PROJECTILES.flame_ball;
    case "ice": return VFX_PROJECTILES.ice_ball;
    case "lightning": return VFX_PROJECTILES.lightning_ball;
    case "arcane":
    case "psychic": return VFX_PROJECTILES.chaos_orb;
    case "poison": return VFX_PROJECTILES.chaos_orb;
    default: return VFX_PROJECTILES.arrow_trail;
  }
}