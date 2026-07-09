/**
 * Character evolution families — same-name fighters progress lowest → highest.
 * Each tier gets its own R special; the final form carries the ultimate R.
 */

export interface EvolutionMeta {
  /** Canonical character key (e.g. "shanks"). */
  familyId: string;
  /** Display name shared across tiers. */
  familyName: string;
  /** 1 = base, 2+ = powered-up / evolved. */
  tier: number;
  /** Short stage label shown in roster UI. */
  tierLabel: string;
  /** Previous tier fighter id, if any. */
  evolvesFrom?: string;
  /** True when this tier is the family's apex (ultimate R). */
  isFinalForm: boolean;
}

/** Evolution metadata keyed by fighter id. */
export const EVOLUTION_BY_FIGHTER: Record<string, EvolutionMeta> = {
  shanks: {
    familyId: "shanks",
    familyName: "Shanks",
    tier: 1,
    tierLabel: "Captain",
    isFinalForm: false,
  },
  shanks_yonko: {
    familyId: "shanks",
    familyName: "Shanks",
    tier: 2,
    tierLabel: "Yonko",
    evolvesFrom: "shanks",
    isFinalForm: true,
  },
  shiryu: {
    familyId: "shiryu",
    familyName: "Shiryu",
    tier: 1,
    tierLabel: "Rain Blade",
    isFinalForm: false,
  },
  shiryu_clear: {
    familyId: "shiryu",
    familyName: "Shiryu",
    tier: 2,
    tierLabel: "Clear-Clear",
    evolvesFrom: "shiryu",
    isFinalForm: true,
  },
  lucci: {
    familyId: "lucci",
    familyName: "Lucci",
    tier: 1,
    tierLabel: "CP0",
    isFinalForm: false,
  },
  lucci_awakened: {
    familyId: "lucci",
    familyName: "Lucci",
    tier: 2,
    tierLabel: "Awakened",
    evolvesFrom: "lucci",
    isFinalForm: true,
  },
  koby: {
    familyId: "koby",
    familyName: "Koby",
    tier: 1,
    tierLabel: "Recruit",
    isFinalForm: false,
  },
  koby_hero: {
    familyId: "koby",
    familyName: "Koby",
    tier: 2,
    tierLabel: "Hero",
    evolvesFrom: "koby",
    isFinalForm: true,
  },
  hybrid_kaido: {
    familyId: "kaido",
    familyName: "Kaido",
    tier: 1,
    tierLabel: "Hybrid",
    isFinalForm: true,
  },
};

export const EVOLUTION_FAMILY_ORDER = ["shanks", "shiryu", "lucci", "koby", "kaido"] as const;

export function getEvolutionMeta(fighterId: string | null | undefined): EvolutionMeta | undefined {
  if (!fighterId) return undefined;
  return EVOLUTION_BY_FIGHTER[fighterId];
}

export function isEvolutionFighter(fighterId: string): boolean {
  return fighterId in EVOLUTION_BY_FIGHTER;
}

/** Ordered tiers for a family (lowest first). */
export function tiersInFamily(familyId: string): EvolutionMeta[] {
  return Object.values(EVOLUTION_BY_FIGHTER)
    .filter((m) => m.familyId === familyId)
    .sort((a, b) => a.tier - b.tier);
}

/** Roster grouping: families with multiple tiers, then standalone fighters. */
export function evolutionFamilyIds(): string[] {
  return [...EVOLUTION_FAMILY_ORDER];
}