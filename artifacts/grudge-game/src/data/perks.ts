import { PERK_COLORS, PERK_LABELS, type PerkId } from "./worldProps";

export interface PerkDef {
  id: PerkId;
  name: string;
  tagline: string;
  description: string;
  color: number;
  cost: number;
  tier: 1 | 2 | 3;
  /** GLB prop id in worldProps catalog */
  propId: string;
  effects: string[];
}

export const PERKS: PerkDef[] = [
  {
    id: "firebug",
    name: PERK_LABELS.firebug,
    tagline: "Burn the horde",
    description: "Incendiary perks — DoT, splash, and ignite chains. KF2-style area denial.",
    color: PERK_COLORS.firebug,
    cost: 750,
    tier: 2,
    propId: "prop_perk_firebug",
    effects: ["+15% burn damage", "Ignite spreads on kill", "Molotov deploy unlock"],
  },
  {
    id: "medic",
    name: PERK_LABELS.medic,
    tagline: "Keep the squad alive",
    description: "Healing, regen, and revive utilities for sustained dungeon runs.",
    color: PERK_COLORS.medic,
    cost: 650,
    tier: 2,
    propId: "prop_perk_medic",
    effects: ["+20% heal potency", "Medkit cooldown −15%", "Second wind on boss kill"],
  },
  {
    id: "support",
    name: PERK_LABELS.support,
    tagline: "Buff the war machine",
    description: "Team-wide buffs, ammo economy, and utility — the MMO support fantasy.",
    color: PERK_COLORS.support,
    cost: 600,
    tier: 1,
    propId: "prop_perk_support",
    effects: ["+10% party damage aura", "Ammo regen while stationary", "Resupply drone deploy"],
  },
  {
    id: "gunslinger",
    name: PERK_LABELS.gunslinger,
    tagline: "Precision at range",
    description: "Crit chains, headshot bonuses, and reload tricks for ranged builds.",
    color: PERK_COLORS.gunslinger,
    cost: 800,
    tier: 3,
    propId: "prop_perk_gunslinger",
    effects: ["+12% crit chance", "Last-shot bonus damage", "Deadeye telegraph shrink"],
  },
];

export const PERK_BY_ID = new Map(PERKS.map((p) => [p.id, p]));