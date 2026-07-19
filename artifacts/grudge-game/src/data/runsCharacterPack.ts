/**
 * Character + weapon meshes from D:\Games\Models\runs\dist\public
 * staged under public/models/{races,heroes,weapons,vfx}.
 *
 * Used by PvP avatar URLs, MainPanel portraits, and Nexus-era production.
 */

const BASE = import.meta.env.BASE_URL ?? "/";

export type RunsRaceId =
  | "human"
  | "orc"
  | "high_elf"
  | "dwarf"
  | "undead"
  | "barbarian";

export const RUNS_RACES: Record<
  RunsRaceId,
  { id: RunsRaceId; name: string; file: string }
> = {
  human: { id: "human", name: "Human", file: "human.glb" },
  orc: { id: "orc", name: "Orc", file: "orc.glb" },
  high_elf: { id: "high_elf", name: "High Elf", file: "high_elf.glb" },
  dwarf: { id: "dwarf", name: "Dwarf", file: "dwarf.glb" },
  undead: { id: "undead", name: "Undead", file: "undead.glb" },
  barbarian: { id: "barbarian", name: "Barbarian", file: "barbarian.glb" },
};

export function runsRaceUrl(race: RunsRaceId | string): string {
  const r = RUNS_RACES[race as RunsRaceId] ?? RUNS_RACES.human;
  return `${BASE}models/races/${r.file}`;
}

export function runsHeroUrl(): string {
  return `${BASE}models/heroes/hero.glb`;
}

export function runsWeaponUrl(weapon: string): string {
  const file = weapon.endsWith(".glb") ? weapon : `${weapon}.glb`;
  return `${BASE}models/weapons/${file}`;
}

export const RUNS_WEAPONS = [
  "sword",
  "greatsword",
  "axe",
  "bow",
  "staff",
  "spear",
  "dagger",
  "hammer",
  "mace",
  "rifle",
  "pistol",
  "shield",
] as const;
