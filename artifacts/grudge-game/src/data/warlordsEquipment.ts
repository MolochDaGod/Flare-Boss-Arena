/**
 * Warlords / Annihilate 24 — T0 armor + class weapons (practice loadouts).
 *
 * Armor materials:
 *   warrior → metal (plate)
 *   ranger  → leather
 *   mage    → cloth
 *   worge   → leather + cloth mix
 *
 * Weapons (per race, faction partners never share the same kit):
 *   warrior — one sword+shield, one sword+dagger per faction
 *   ranger  — T0 gun / bow / crossbow / spear / dagger / mace (unique per race)
 *   mage    — T1 staff (unique elemental family per race)
 *   worge   — 2H hammer / mace / axe / nature staff
 */

import type { RaceId } from "./characterMeshes";
import type { PortraitEquip } from "./characterMeshes";
import type { AnnihilateClass, AnnihilateRace } from "./annihilateHeroes";

export type ArmorMaterial = "metal" | "leather" | "cloth" | "leather_cloth";
export type GearTier = 0 | 1;

export interface WarlordsLoadout {
  race: AnnihilateRace;
  classId: AnnihilateClass;
  faction: "crusade" | "fabled" | "legion";
  /** Armor family for UI / future material tints. */
  armor: ArmorMaterial;
  /** Wardrobe body/arms/legs variant letters (A=plate, B=leather, C=cloth, D=primal). */
  armorVariants: { body: string; arms: string; legs: string; head: string | null; shoulders: boolean };
  /** Display name of mainhand. */
  mainhandName: string;
  mainhandCategory: string;
  mainhandTier: GearTier;
  /** Offhand: shield, dagger, or null for 2H. */
  offhandName: string | null;
  offhandCategory: string | null;
  /** True when offhand is a shield (not dual-wield weapon). */
  offhandIsShield: boolean;
  /** Quiver for bow/crossbow. */
  hasQuiver: boolean;
  /** Portrait/equip resolution for Toon-RTS multi-mesh. */
  portrait: PortraitEquip;
  blurb: string;
}

const FACTION: Record<AnnihilateRace, WarlordsLoadout["faction"]> = {
  human: "crusade",
  barbarian: "crusade",
  elf: "fabled",
  dwarf: "fabled",
  orc: "legion",
  undead: "legion",
};

/** Per faction: first race = sword+shield, second = sword+dagger. */
const WARRIOR_STYLE: Record<AnnihilateRace, "sword_shield" | "sword_dagger"> = {
  human: "sword_shield",
  barbarian: "sword_dagger",
  elf: "sword_shield",
  dwarf: "sword_dagger",
  orc: "sword_shield",
  undead: "sword_dagger",
};

/** Rangers — unique T0 weapon per race; partners differ. */
const RANGER_WEAPON: Record<
  AnnihilateRace,
  { name: string; category: string; quiver: boolean }
> = {
  human: { name: "T0 Recurve Bow", category: "bows", quiver: true },
  barbarian: { name: "T0 Frontier Gun", category: "guns", quiver: false },
  elf: { name: "T0 Star Crossbow", category: "crossbows", quiver: true },
  dwarf: { name: "T0 Tunnel Spear", category: "spears", quiver: false },
  orc: { name: "T0 War Dagger", category: "daggers", quiver: false },
  undead: { name: "T0 Bone Mace", category: "maces", quiver: false },
};

/** Mages — unique T1 staff family per race. */
const MAGE_STAFF: Record<AnnihilateRace, { name: string; category: string }> = {
  human: { name: "T1 Arcane Staff", category: "arcaneStaves" },
  barbarian: { name: "T1 Storm Staff", category: "lightningStaves" },
  elf: { name: "T1 Grove Staff", category: "natureStaves" },
  dwarf: { name: "T1 Forge Staff", category: "fireStaves" },
  orc: { name: "T1 Hex Staff", category: "shadowStaves" },
  undead: { name: "T1 Frost Staff", category: "frostStaves" },
};

/** Worges — 2H hammer, mace, axe, nature staff (cycled; partners differ). */
const WORGE_2H: Record<AnnihilateRace, { name: string; category: string }> = {
  human: { name: "T0 War Axe", category: "greataxes" },
  barbarian: { name: "T0 Battle Hammer", category: "hammers2h" },
  elf: { name: "T0 Nature Staff", category: "natureStaves" },
  dwarf: { name: "T0 Spiked Mace", category: "maces" },
  orc: { name: "T0 Crushing Axe", category: "axes" },
  undead: { name: "T0 Grave Hammer", category: "hammers2h" },
};

const CLASS_ARMOR: Record<
  AnnihilateClass,
  { material: ArmorMaterial; variants: WarlordsLoadout["armorVariants"] }
> = {
  // Metal plate
  warrior: {
    material: "metal",
    variants: { body: "A", arms: "A", legs: "A", head: "A", shoulders: true },
  },
  // Leather
  ranger: {
    material: "leather",
    variants: { body: "B", arms: "B", legs: "B", head: null, shoulders: false },
  },
  // Cloth robes
  mage: {
    material: "cloth",
    variants: { body: "C", arms: "C", legs: "B", head: null, shoulders: false },
  },
  // Leather + cloth primal mix
  worge: {
    material: "leather_cloth",
    variants: { body: "D", arms: "A", legs: "C", head: null, shoulders: false },
  },
};

function buildLoadout(race: AnnihilateRace, classId: AnnihilateClass): WarlordsLoadout {
  const faction = FACTION[race];
  const armor = CLASS_ARMOR[classId];

  if (classId === "warrior") {
    const style = WARRIOR_STYLE[race];
    const swordShield = style === "sword_shield";
    return {
      race,
      classId,
      faction,
      armor: armor.material,
      armorVariants: armor.variants,
      mainhandName: "T0 War Sword",
      mainhandCategory: "swords",
      mainhandTier: 0,
      offhandName: swordShield ? "T0 Kite Shield" : "T0 Side Dagger",
      offhandCategory: swordShield ? "shields" : "daggers",
      offhandIsShield: swordShield,
      hasQuiver: false,
      portrait: {
        mainCategory: "swords",
        offCategory: swordShield ? undefined : "daggers",
        hasOffhand: true,
        offhandIsShield: swordShield,
        hasShoulder: true,
      },
      blurb: swordShield
        ? "Metal plate · sword & shield (faction primary)"
        : "Metal plate · sword & dagger (faction partner)",
    };
  }

  if (classId === "ranger") {
    const w = RANGER_WEAPON[race];
    return {
      race,
      classId,
      faction,
      armor: armor.material,
      armorVariants: armor.variants,
      mainhandName: w.name,
      mainhandCategory: w.category,
      mainhandTier: 0,
      offhandName: null,
      offhandCategory: null,
      offhandIsShield: false,
      hasQuiver: w.quiver,
      portrait: {
        mainCategory: w.category,
        hasOffhand: false,
        hasShoulder: false,
      },
      blurb: `Leather · ${w.name}`,
    };
  }

  if (classId === "mage") {
    const s = MAGE_STAFF[race];
    return {
      race,
      classId,
      faction,
      armor: armor.material,
      armorVariants: armor.variants,
      mainhandName: s.name,
      mainhandCategory: s.category,
      mainhandTier: 1,
      offhandName: null,
      offhandCategory: null,
      offhandIsShield: false,
      hasQuiver: false,
      portrait: {
        mainCategory: s.category,
        hasOffhand: false,
        hasShoulder: false,
      },
      blurb: `Cloth · ${s.name}`,
    };
  }

  // worge
  const w = WORGE_2H[race];
  return {
    race,
    classId,
    faction,
    armor: armor.material,
    armorVariants: armor.variants,
    mainhandName: w.name,
    mainhandCategory: w.category,
    mainhandTier: 0,
    offhandName: null,
    offhandCategory: null,
    offhandIsShield: false,
    hasQuiver: false,
    portrait: {
      mainCategory: w.category,
      hasOffhand: false,
      hasShoulder: false,
    },
    blurb: `Leather/cloth · 2H ${w.name}`,
  };
}

const CACHE = new Map<string, WarlordsLoadout>();

export function getWarlordsLoadout(
  race: AnnihilateRace | RaceId,
  classId: AnnihilateClass | string,
): WarlordsLoadout {
  const key = `${race}_${classId}`;
  let hit = CACHE.get(key);
  if (!hit) {
    hit = buildLoadout(race as AnnihilateRace, classId as AnnihilateClass);
    CACHE.set(key, hit);
  }
  return hit;
}

export function getWarlordsLoadoutByHeroId(heroId: string): WarlordsLoadout | null {
  const m = /^g6_(human|barbarian|elf|dwarf|orc|undead)_(warrior|mage|ranger|worge)$/.exec(heroId);
  if (!m) return null;
  return getWarlordsLoadout(m[1] as AnnihilateRace, m[2] as AnnihilateClass);
}

/** All 24 loadouts for UI / codex. */
export function allWarlordsLoadouts(): WarlordsLoadout[] {
  const races: AnnihilateRace[] = ["human", "barbarian", "elf", "dwarf", "orc", "undead"];
  const classes: AnnihilateClass[] = ["warrior", "mage", "ranger", "worge"];
  return races.flatMap((r) => classes.map((c) => getWarlordsLoadout(r, c)));
}
