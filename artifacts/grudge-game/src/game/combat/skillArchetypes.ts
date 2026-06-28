import type { ClassSkill } from "../../data/classSkills";
import type { DamageShapeKind } from "./damageShapes";

/**
 * Maps a resolved skill (plus its slot index) to a combat ARCHETYPE: the hit
 * shape, reach, damage multiplier and ember/gold tint used to drive telegraphs,
 * particle VFX and deployables. classSkills.ts stays framework-free — this is
 * the only place that decides "what shape does this skill throw?".
 */

export type DeployableKind = "fire_totem" | "turret" | "trap";
export type SkillShapeKind = DamageShapeKind | "deployable";

export interface SkillArchetype {
  shape: SkillShapeKind;
  deployable?: DeployableKind;
  /** Forward reach (also placement distance for deployables). */
  range: number;
  radius?: number;
  halfAngle?: number;
  length?: number;
  halfWidth?: number;
  damageMult: number;
  /** Tint for telegraph + particles (ember/gold family). */
  color: number;
  /** Seconds the ground telegraph is shown. */
  telegraph: number;
}

const GOLD = 0xc5a059;
const EMBER = 0xff7a1e;
const ARCANE = 0x8a6bff;
const POISON = 0x7fe04a;

function hasTag(s: ClassSkill | undefined, ...tags: string[]): boolean {
  if (!s) return false;
  const hay = [s.id, s.name, ...(s.effects ?? [])].join(" ").toLowerCase();
  return tags.some((t) => hay.includes(t));
}

/** Resolve the archetype for a skill in HUD slot `idx`. Safe with `undefined`. */
export function archetypeForSkill(skill: ClassSkill | undefined, idx: number): SkillArchetype {
  // 1) Deployables (explicit cues or summon-type skills).
  if (hasTag(skill, "totem", "brazier", "pyre", "bonfire"))
    return { shape: "deployable", deployable: "fire_totem", range: 4.5, radius: 4.5, damageMult: 0.9, color: EMBER, telegraph: 0 };
  if (hasTag(skill, "turret", "sentry", "ballista", "construct", "golem"))
    return { shape: "deployable", deployable: "turret", range: 4.5, radius: 18, damageMult: 1.1, color: GOLD, telegraph: 0 };
  if (hasTag(skill, "trap", "snare", "mine", "rune", "glyph"))
    return { shape: "deployable", deployable: "trap", range: 4, radius: 3.2, damageMult: 2.2, color: POISON, telegraph: 0 };
  if (skill?.type === "summon")
    return { shape: "deployable", deployable: "fire_totem", range: 4.5, radius: 4.5, damageMult: 0.9, color: EMBER, telegraph: 0 };

  const color = skill?.type === "magical" ? ARCANE : EMBER;

  // 2) Shaped attacks by cue.
  if (hasTag(skill, "nova", "quake", "eruption", "storm", "roar", "shockwave", "pulse"))
    return { shape: "nova", range: 6.5, radius: 6.5, damageMult: 2.2, color, telegraph: 0.35 };
  if (hasTag(skill, "cleave", "sweep", "cone", "whirl", "breath", "fan", "slash"))
    return { shape: "cone", range: 5.5, radius: 5.5, halfAngle: Math.PI / 4, damageMult: 1.9, color, telegraph: 0.3 };
  if (hasTag(skill, "pierce", "beam", "bolt", "lance", "arrow", "shot", "line", "ray", "spear", "javelin"))
    return { shape: "line", range: 9, length: 9, halfWidth: 1.3, damageMult: 1.8, color, telegraph: 0.28 };
  if (hasTag(skill, "blast", "ball", "meteor", "bomb", "circle", "aoe", "rain", "fireball"))
    return { shape: "circle", range: 8, radius: 3.8, damageMult: 1.9, color, telegraph: 0.4 };

  // 3) Fallback variety by slot so the bar always feels broad.
  const cycle: SkillArchetype[] = [
    { shape: "cone", range: 5, radius: 5, halfAngle: Math.PI / 5, damageMult: 1.7, color: EMBER, telegraph: 0.28 },
    { shape: "circle", range: 8, radius: 3.6, damageMult: 1.8, color: ARCANE, telegraph: 0.36 },
    { shape: "line", range: 9, length: 9, halfWidth: 1.2, damageMult: 1.7, color: GOLD, telegraph: 0.26 },
    { shape: "nova", range: 6, radius: 6, damageMult: 2.0, color: EMBER, telegraph: 0.34 },
    {
      shape: "deployable",
      deployable: (["fire_totem", "turret", "trap"] as DeployableKind[])[idx % 3],
      range: 4.5,
      radius: 4.5,
      damageMult: 1.4,
      color: GOLD,
      telegraph: 0,
    },
  ];
  return cycle[idx % cycle.length];
}
