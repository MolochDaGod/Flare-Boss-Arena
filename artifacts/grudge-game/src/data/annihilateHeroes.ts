/**
 * Annihilate / Warlords 24 heroes — playable fighters for Flare Boss Arena.
 *
 * Each is 1 of 6 races × 4 classes (warrior / mage / ranger / worge).
 * Models: Grudge6 Toon-RTS race GLBs (CDN) with class equipment wardrobe.
 * Skills: class kits for skill creation / HUD / combat.
 *
 * skinId format: `g6_{race}_{class}` — GameEngine loads via grudge6 path.
 */

import type { FighterDef, AttrKey } from "./fighters";
import type { FighterKit, FighterSkillDef, FighterSpecialDef } from "./fighterSkills";
import type { CombatProfile, BrainArchetype, AbilityDesign } from "./characterCombatProfiles";
import type { SkillElement } from "../game/combat/particles";

export type AnnihilateRace = "human" | "barbarian" | "elf" | "dwarf" | "orc" | "undead";
export type AnnihilateClass = "warrior" | "mage" | "ranger" | "worge";

export const ANNIHILATE_RACES: AnnihilateRace[] = [
  "human", "barbarian", "elf", "dwarf", "orc", "undead",
];
export const ANNIHILATE_CLASSES: AnnihilateClass[] = [
  "warrior", "mage", "ranger", "worge",
];

const RACE_LABEL: Record<AnnihilateRace, string> = {
  human: "Human", barbarian: "Barbarian", elf: "Elf",
  dwarf: "Dwarf", orc: "Orc", undead: "Undead",
};
const CLASS_LABEL: Record<AnnihilateClass, string> = {
  warrior: "Warrior", mage: "Mage", ranger: "Ranger", worge: "Worge",
};
const CLASS_ROLE: Record<AnnihilateClass, string> = {
  warrior: "Frontline", mage: "Arcane", ranger: "Marksman", worge: "Primal",
};
const CLASS_BRAIN: Record<AnnihilateClass, BrainArchetype> = {
  warrior: "brawler", mage: "caster", ranger: "gunner", worge: "assassin",
};
const CLASS_ELEMENT: Record<AnnihilateClass, SkillElement> = {
  warrior: "physical", mage: "arcane", ranger: "physical", worge: "fire",
};

const S = (
  strength: number, vitality: number, dexterity: number, agility: number,
  endurance: number, intellect: number, tactics: number, wisdom: number,
): Record<AttrKey, number> => ({
  strength, vitality, dexterity, agility, endurance, intellect, tactics, wisdom,
});

const CLASS_STATS: Record<AnnihilateClass, Record<AttrKey, number>> = {
  warrior: S(8, 8, 5, 5, 8, 3, 5, 4),
  mage: S(3, 5, 5, 5, 4, 9, 6, 7),
  ranger: S(5, 5, 8, 8, 5, 4, 6, 5),
  worge: S(7, 6, 6, 7, 6, 4, 5, 5),
};

const RACE_STAT_BIAS: Record<AnnihilateRace, Partial<Record<AttrKey, number>>> = {
  human: { tactics: 1, wisdom: 1 },
  barbarian: { strength: 1, vitality: 1 },
  elf: { dexterity: 1, intellect: 1 },
  dwarf: { endurance: 1, vitality: 1 },
  orc: { strength: 1, endurance: 1 },
  undead: { intellect: 1, wisdom: 1 },
};

export function annihilateHeroId(race: AnnihilateRace, classId: AnnihilateClass): string {
  return `g6_${race}_${classId}`;
}

export function parseAnnihilateHeroId(
  id: string,
): { race: AnnihilateRace; classId: AnnihilateClass } | null {
  const m = /^g6_(human|barbarian|elf|dwarf|orc|undead)_(warrior|mage|ranger|worge)$/.exec(id);
  if (!m) return null;
  return { race: m[1] as AnnihilateRace, classId: m[2] as AnnihilateClass };
}

export function isAnnihilateHeroId(id: string | null | undefined): boolean {
  return !!id && parseAnnihilateHeroId(id) != null;
}

function buildStats(race: AnnihilateRace, classId: AnnihilateClass): Record<AttrKey, number> {
  const base = { ...CLASS_STATS[classId] };
  const bias = RACE_STAT_BIAS[race];
  for (const [k, v] of Object.entries(bias)) {
    const key = k as AttrKey;
    base[key] = Math.min(10, base[key] + (v ?? 0));
  }
  return base;
}

/** 24 Warlords / Annihilate heroes as FighterDef entries. */
export const ANNIHILATE_FIGHTERS: FighterDef[] = ANNIHILATE_RACES.flatMap((race) =>
  ANNIHILATE_CLASSES.map((classId) => {
    const id = annihilateHeroId(race, classId);
    return {
      id,
      name: `${RACE_LABEL[race]} ${CLASS_LABEL[classId]}`,
      title: `Warlords ${CLASS_LABEL[classId]}`,
      role: CLASS_ROLE[classId],
      blurb: `Annihilate-era ${RACE_LABEL[race]} ${CLASS_LABEL[classId]} — skill kit for creation, dungeon, and MOBA.`,
      skinId: id, // special g6_ skin — GameEngine / preview resolve to race GLB
      stats: buildStats(race, classId),
      featured: classId === "warrior" && (race === "human" || race === "orc"),
    } satisfies FighterDef;
  }),
);

// ── Skill kits (class templates, cloned per hero) ────────────────────────────

function sk(partial: FighterSkillDef): FighterSkillDef {
  return partial;
}

const CLASS_KITS: Record<
  AnnihilateClass,
  { special: Omit<FighterSpecialDef, "evolutionTier" | "isUltimate">; skills: FighterSkillDef[] }
> = {
  warrior: {
    special: {
      name: "War Cry Cleave",
      description: "A frontline shockwave slash that opens the fight.",
      anim: ["attack", "skill_a", "combo"],
      damageMult: 2.5,
      manaCost: 26,
      cooldown: 8,
      element: "physical",
      slashWave: true,
      slashRange: 12,
      color: 0xef4444,
    },
    skills: [
      sk({ id: "slash", name: "Slash", description: "Steady blade strike.", glyph: "⚔", anim: ["attack", "combo_a"], targeting: "instant", shape: "cone", element: "physical", damageMult: 1.3, manaCost: 6, cooldown: 1.2, aoeRadius: 3.5 }),
      sk({ id: "power_strike", name: "Power Strike", description: "Heavy overhead blow.", glyph: "💥", anim: ["combo_b", "skill_a"], targeting: "instant", shape: "cone", element: "physical", damageMult: 2.0, manaCost: 14, cooldown: 3, aoeRadius: 4 }),
      sk({ id: "shield_bash", name: "Shield Bash", description: "Stun cone bash.", glyph: "🛡", anim: ["skill_b", "boost"], targeting: "instant", shape: "cone", element: "physical", damageMult: 1.5, manaCost: 12, cooldown: 4, aoeRadius: 4 }),
      sk({ id: "war_cry", name: "War Cry", description: "Self power nova.", glyph: "📢", anim: ["boost"], targeting: "self", shape: "nova", element: "physical", damageMult: 0.3, manaCost: 16, cooldown: 7, aoeRadius: 3 }),
      sk({ id: "cleave_line", name: "Cleave Line", description: "Piercing sword line.", glyph: "🗡", anim: ["skill_a", "combo_c"], targeting: "instant", shape: "line", element: "physical", damageMult: 1.8, manaCost: 14, cooldown: 4 }),
    ],
  },
  mage: {
    special: {
      name: "Meteor Storm",
      description: "Rain arcane meteors as a traveling slash of starfire.",
      anim: ["cast", "skill_a", "skill_b"],
      damageMult: 2.8,
      manaCost: 32,
      cooldown: 9,
      element: "arcane",
      slashWave: true,
      slashRange: 14,
      color: 0x8b5cf6,
    },
    skills: [
      sk({ id: "fireball", name: "Fireball", description: "Ground fire circle.", glyph: "🔥", anim: ["cast", "skill_a"], targeting: "ground_aoe", shape: "circle", element: "fire", damageMult: 1.8, manaCost: 12, cooldown: 2.5, aoeRadius: 4, placeRange: 10 }),
      sk({ id: "frost", name: "Frost Bolt", description: "Slowing ice line.", glyph: "❄", anim: ["cast", "combo_a"], targeting: "instant", shape: "line", element: "arcane", damageMult: 1.5, manaCost: 10, cooldown: 2 }),
      sk({ id: "chain", name: "Chain Lightning", description: "Forking lightning cone.", glyph: "⚡", anim: ["skill_b", "cast"], targeting: "instant", shape: "cone", element: "lightning", damageMult: 1.9, manaCost: 16, cooldown: 4, aoeRadius: 5.5 }),
      sk({ id: "mana_shield", name: "Mana Shield", description: "Self arcane barrier.", glyph: "🔮", anim: ["boost", "skill_b"], targeting: "self", shape: "nova", element: "arcane", damageMult: 0.2, manaCost: 18, cooldown: 8, aoeRadius: 2.5 }),
      sk({ id: "meteor", name: "Meteor", description: "Heavy ground nova.", glyph: "☄", anim: ["skill_a", "skill_b"], targeting: "ground_aoe", shape: "nova", element: "fire", damageMult: 2.5, manaCost: 28, cooldown: 8, aoeRadius: 5.5, placeRange: 11 }),
    ],
  },
  ranger: {
    special: {
      name: "Rain of Arrows",
      description: "A volley slash-wave of piercing shafts.",
      anim: ["attack", "skill_a", "combo"],
      damageMult: 2.6,
      manaCost: 28,
      cooldown: 8,
      element: "physical",
      slashWave: true,
      slashRange: 16,
      color: 0x22c55e,
    },
    skills: [
      sk({ id: "aimed", name: "Aimed Shot", description: "Long line shot.", glyph: "🎯", anim: ["attack", "combo_a"], targeting: "instant", shape: "line", element: "physical", damageMult: 1.6, manaCost: 8, cooldown: 1.5 }),
      sk({ id: "poison", name: "Poison Arrow", description: "Toxic cone spray.", glyph: "☠", anim: ["skill_a", "combo_b"], targeting: "instant", shape: "cone", element: "poison", damageMult: 1.5, manaCost: 12, cooldown: 3, aoeRadius: 4.5 }),
      sk({ id: "volley", name: "Volley", description: "Ground arrow rain.", glyph: "🏹", anim: ["skill_b", "boost"], targeting: "ground_aoe", shape: "circle", element: "physical", damageMult: 2.0, manaCost: 18, cooldown: 5, aoeRadius: 4.5, placeRange: 12 }),
      sk({ id: "evasion", name: "Evasion", description: "Self mobility nova.", glyph: "💨", anim: ["dodge", "boost"], targeting: "self", shape: "nova", element: "physical", damageMult: 0.2, manaCost: 10, cooldown: 6, aoeRadius: 2 }),
      sk({ id: "eagle", name: "Eagle Eye Barrage", description: "Precision multi-line.", glyph: "🦅", anim: ["skill_a", "skill_b"], targeting: "instant", shape: "line", element: "physical", damageMult: 2.2, manaCost: 22, cooldown: 6 }),
    ],
  },
  worge: {
    special: {
      name: "Primal Howl",
      description: "Beast-form shockwave — pack fury as a slash wave.",
      anim: ["attack", "skill_a", "roar"],
      damageMult: 2.7,
      manaCost: 28,
      cooldown: 8,
      element: "fire",
      slashWave: true,
      slashRange: 11,
      color: 0xf97316,
    },
    skills: [
      sk({ id: "claw", name: "Claw Swipe", description: "Wide claw cone.", glyph: "🐾", anim: ["attack", "combo_a"], targeting: "instant", shape: "cone", element: "physical", damageMult: 1.5, manaCost: 8, cooldown: 1.4, aoeRadius: 4 }),
      sk({ id: "pounce", name: "Feral Charge", description: "Gap-close line.", glyph: "🐆", anim: ["run", "combo_b"], targeting: "instant", shape: "line", element: "physical", damageMult: 1.8, manaCost: 12, cooldown: 3.5 }),
      sk({ id: "howl", name: "Primal Roar", description: "Fear nova.", glyph: "🦁", anim: ["skill_b", "boost"], targeting: "instant", shape: "nova", element: "physical", damageMult: 1.4, manaCost: 14, cooldown: 5, aoeRadius: 5.5 }),
      sk({ id: "bear", name: "Bear Form Slam", description: "Heavy ground circle.", glyph: "🐻", anim: ["skill_a", "combo_c"], targeting: "ground_aoe", shape: "circle", element: "physical", damageMult: 2.2, manaCost: 20, cooldown: 6, aoeRadius: 5, placeRange: 7 }),
      sk({ id: "pack", name: "Pack Howl", description: "Buff allies (self nova).", glyph: "🌙", anim: ["boost", "skill_b"], targeting: "self", shape: "nova", element: "arcane", damageMult: 0.3, manaCost: 16, cooldown: 8, aoeRadius: 3 }),
    ],
  },
};

export function annihilateFighterKit(fighterId: string): FighterKit | null {
  const parsed = parseAnnihilateHeroId(fighterId);
  if (!parsed) return null;
  const tpl = CLASS_KITS[parsed.classId];
  return {
    fighterId,
    special: { ...tpl.special },
    skills: tpl.skills.map((s) => ({ ...s, id: `${fighterId}_${s.id}` })),
  };
}

function ab(
  id: string,
  name: string,
  anim: string[],
  element: SkillElement,
  shape: AbilityDesign["shape"],
  aiCooldown: number,
  preferredRange: number,
  notes: string,
): AbilityDesign {
  return { id, name, anim, element, shape, aiCooldown, preferredRange, notes };
}

export function annihilateCombatProfile(fighterId: string): CombatProfile | null {
  const parsed = parseAnnihilateHeroId(fighterId);
  if (!parsed) return null;
  const kit = annihilateFighterKit(fighterId)!;
  const brain = CLASS_BRAIN[parsed.classId];
  const element = CLASS_ELEMENT[parsed.classId];
  const abilities: AbilityDesign[] = kit.skills.slice(0, 4).map((s, i) =>
    ab(
      s.id,
      s.name,
      s.anim,
      s.element,
      s.shape === "slash" ? "slash" : s.shape === "line" ? "line" : s.shape === "cone" ? "cone" : "circle",
      s.cooldown + 0.5,
      s.placeRange ?? (brain === "gunner" ? 7 : brain === "caster" ? 6 : 3),
      s.description,
    ),
  );
  abilities.push(
    ab(
      kit.special.name.toLowerCase().replace(/\s+/g, "_"),
      kit.special.name,
      kit.special.anim,
      kit.special.element,
      "slash",
      kit.special.cooldown,
      5,
      kit.special.description,
    ),
  );
  return {
    fighterId,
    brain,
    auraElement: element,
    locomotion: { idle: ["idle", "fight_idle"], walk: ["walk", "run"], run: ["run", "sprint"] },
    abilities,
    enemyReady: true,
    enemyVisualProxy:
      parsed.classId === "mage"
        ? "kit_skel_mage"
        : parsed.classId === "ranger"
          ? "kit_skel_rogue"
          : parsed.race === "undead"
            ? "mon_cultist"
            : "kit_skel_warrior",
    enemyTier: parsed.classId === "mage" || parsed.classId === "worge" ? 3 : 2,
  };
}

/** All 24 combat profiles for rival / skill-creation systems. */
export function allAnnihilateCombatProfiles(): CombatProfile[] {
  return ANNIHILATE_FIGHTERS.map((f) => annihilateCombatProfile(f.id)!).filter(Boolean);
}
