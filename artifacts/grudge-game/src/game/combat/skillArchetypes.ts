import type { ClassSkill } from "../../data/classSkills";
import type { DamageShapeKind } from "./damageShapes";
import { type SkillElement, elementColor } from "./particles";

/**
 * Maps a resolved skill (plus its slot index) to a combat ARCHETYPE: the hit
 * shape, reach, damage multiplier, ELEMENT and tint used to drive telegraphs,
 * particle VFX and deployables. classSkills.ts stays framework-free — this is
 * the only place that decides "what shape + element does this skill throw?".
 */

export type DeployableKind = "fire_totem" | "turret" | "trap";
export type SkillShapeKind = DamageShapeKind | "deployable";
export type { SkillElement };

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
  /** Damage element — drives the VFX flavor + tint. */
  element: SkillElement;
  /** Tint for telegraph + particles (derived from element). */
  color: number;
  /** Seconds the ground telegraph is shown. */
  telegraph: number;
}

function hasTag(s: ClassSkill | undefined, ...tags: string[]): boolean {
  if (!s) return false;
  const hay = [s.id, s.name, ...(s.effects ?? [])].join(" ").toLowerCase();
  return tags.some((t) => hay.includes(t));
}

/** Classify a skill's damage element from its name/effects/type. */
function classifyElement(s: ClassSkill | undefined): SkillElement {
  if (hasTag(s, "psychic", "mind", "psi", "telepath", "soul", "astral")) return "psychic";
  if (hasTag(s, "frost", "ice", "cold", "freeze", "glacial", "blizzard", "chill", "winter", "shatter")) return "ice";
  if (hasTag(s, "lightning", "shock", "thunder", "spark", "volt", "tempest", "storm", "electro")) return "lightning";
  if (hasTag(s, "poison", "venom", "toxic", "plague", "acid", "pestilence", "blight", "rot", "corrosive", "disease")) return "poison";
  if (hasTag(s, "fire", "flame", "burn", "ember", "inferno", "lava", "pyre", "scorch", "meteor", "blaze", "magma", "cinder", "combust")) return "fire";
  if (s?.type === "magical" || hasTag(s, "arcane", "magic", "void", "shadow", "soul", "spirit", "astral", "rune", "glyph", "holy", "divine", "necro", "psychic", "mystic")) return "arcane";
  return "physical";
}

function elemArch(a: Omit<SkillArchetype, "color">): SkillArchetype {
  return { ...a, color: elementColor(a.element) };
}

/** Resolve the archetype for a skill in HUD slot `idx`. Safe with `undefined`. */
export function archetypeForSkill(skill: ClassSkill | undefined, idx: number): SkillArchetype {
  const element = classifyElement(skill);

  // 1) Deployables (explicit cues or summon-type skills).
  if (hasTag(skill, "totem", "brazier", "pyre", "bonfire"))
    return elemArch({ shape: "deployable", deployable: "fire_totem", range: 4.5, radius: 4.5, damageMult: 0.9, element: "fire", telegraph: 0 });
  if (hasTag(skill, "turret", "sentry", "ballista", "construct", "golem"))
    return elemArch({ shape: "deployable", deployable: "turret", range: 4.5, radius: 18, damageMult: 1.1, element: element === "physical" ? "arcane" : element, telegraph: 0 });
  if (hasTag(skill, "trap", "snare", "mine", "rune", "glyph"))
    return elemArch({ shape: "deployable", deployable: "trap", range: 4, radius: 3.2, damageMult: 2.2, element: "poison", telegraph: 0 });
  if (skill?.type === "summon")
    return elemArch({ shape: "deployable", deployable: "fire_totem", range: 4.5, radius: 4.5, damageMult: 0.9, element, telegraph: 0 });

  // 2) Shaped attacks by cue.
  if (hasTag(skill, "nova", "quake", "eruption", "storm", "roar", "shockwave", "pulse"))
    return elemArch({ shape: "nova", range: 6.5, radius: 6.5, damageMult: 2.2, element, telegraph: 0.35 });
  if (hasTag(skill, "cleave", "sweep", "cone", "whirl", "breath", "fan", "slash"))
    return elemArch({ shape: "cone", range: 5.5, radius: 5.5, halfAngle: Math.PI / 4, damageMult: 1.9, element, telegraph: 0.3 });
  if (hasTag(skill, "pierce", "beam", "bolt", "lance", "arrow", "shot", "line", "ray", "spear", "javelin"))
    return elemArch({ shape: "line", range: 9, length: 9, halfWidth: 1.3, damageMult: 1.8, element, telegraph: 0.28 });
  if (hasTag(skill, "blast", "ball", "meteor", "bomb", "circle", "aoe", "rain", "fireball"))
    return elemArch({ shape: "circle", range: 8, radius: 3.8, damageMult: 1.9, element, telegraph: 0.4 });

  // 3) Fallback variety by slot so the bar always feels broad — vary BOTH
  //    shape and element so untagged skills still look distinct per slot.
  const cycle: Omit<SkillArchetype, "color">[] = [
    { shape: "cone", range: 5, radius: 5, halfAngle: Math.PI / 5, damageMult: 1.7, element: element === "physical" ? "fire" : element, telegraph: 0.28 },
    { shape: "circle", range: 8, radius: 3.6, damageMult: 1.8, element: element === "physical" ? "arcane" : element, telegraph: 0.36 },
    { shape: "line", range: 9, length: 9, halfWidth: 1.2, damageMult: 1.7, element: element === "physical" ? "lightning" : element, telegraph: 0.26 },
    { shape: "nova", range: 6, radius: 6, damageMult: 2.0, element: element === "physical" ? "ice" : element, telegraph: 0.34 },
    {
      shape: "deployable",
      deployable: (["fire_totem", "turret", "trap"] as DeployableKind[])[idx % 3],
      range: 4.5,
      radius: 4.5,
      damageMult: 1.4,
      element: (["fire", "arcane", "poison"] as SkillElement[])[idx % 3],
      telegraph: 0,
    },
  ];
  return elemArch(cycle[idx % cycle.length]);
}
