/**
 * Canonical Grudge6 hero roster — 30 Warlords-era units from the
 * `30grudge6characters.glb` atlas (wardrobe already curated per unit).
 *
 * Single source of truth for allies / pets / summons / codex world.
 * Visuals: CDN race GLB + mesh allow-list (or optional local atlas clone).
 */

import rosterJson from "./grudge6Roster.generated.json";
import type { RaceId } from "./characterMeshes";

export type AllyRole =
  | "unarmed"
  | "healer"
  | "tank"
  | "ranger"
  | "bruiser"
  | "fighter"
  | "skirmisher";

/** High-level AI brain for party units. */
export type AllyBrainId =
  | "bodyguard" // stay near player, attack RMB target
  | "healer" // heal low allies/player, light damage
  | "skirmish" // kite / ranged
  | "gatherer" // mine/chop when idle
  | "assassin"; // focus low HP enemies

export interface Grudge6HeroDef {
  id: string;
  index: number;
  rootIndex: number;
  race: RaceId;
  faction: string;
  role: AllyRole;
  displayName: string;
  weaponMesh: string | null;
  /** Exact meshes that must stay visible (from atlas export). */
  meshSample: string[];
  meshCount: number;
  brain: AllyBrainId;
  /** Combat kit flavor. */
  kit: {
    damage: number;
    attackRange: number;
    attackCd: number;
    healAmount: number;
    healCd: number;
    skillMult: number;
  };
}

const BRAIN_FOR_ROLE: Record<AllyRole, AllyBrainId> = {
  unarmed: "gatherer",
  healer: "healer",
  tank: "bodyguard",
  ranger: "skirmish",
  bruiser: "bodyguard",
  fighter: "bodyguard",
  skirmisher: "assassin",
};

const KIT_FOR_ROLE: Record<AllyRole, Grudge6HeroDef["kit"]> = {
  unarmed: { damage: 8, attackRange: 2.2, attackCd: 1.1, healAmount: 0, healCd: 99, skillMult: 1 },
  healer: { damage: 10, attackRange: 3.5, attackCd: 1.4, healAmount: 45, healCd: 5.5, skillMult: 1.3 },
  tank: { damage: 14, attackRange: 2.6, attackCd: 1.2, healAmount: 0, healCd: 99, skillMult: 1.1 },
  ranger: { damage: 16, attackRange: 9.0, attackCd: 1.35, healAmount: 0, healCd: 99, skillMult: 1.2 },
  bruiser: { damage: 20, attackRange: 2.8, attackCd: 1.15, healAmount: 0, healCd: 99, skillMult: 1.25 },
  fighter: { damage: 15, attackRange: 2.7, attackCd: 1.0, healAmount: 0, healCd: 99, skillMult: 1.15 },
  skirmisher: { damage: 17, attackRange: 3.2, attackCd: 0.95, healAmount: 0, healCd: 99, skillMult: 1.2 },
};

function asRace(r: string): RaceId {
  const ok: RaceId[] = ["human", "elf", "dwarf", "orc", "undead", "barbarian"];
  return (ok.includes(r as RaceId) ? r : "human") as RaceId;
}

export const GRUDGE6_HEROES: Grudge6HeroDef[] = (rosterJson.heroes as Array<Record<string, unknown>>).map((h) => {
  const role = (h.role as AllyRole) || "fighter";
  return {
    id: String(h.id),
    index: Number(h.index),
    rootIndex: Number(h.rootIndex),
    race: asRace(String(h.race)),
    faction: String(h.faction),
    role,
    displayName: String(h.displayName),
    weaponMesh: h.weaponMesh ? String(h.weaponMesh) : null,
    meshSample: (h.meshSample as string[]) ?? [],
    meshCount: Number(h.meshCount ?? 0),
    brain: BRAIN_FOR_ROLE[role] ?? "bodyguard",
    kit: { ...KIT_FOR_ROLE[role] },
  };
});

export const GRUDGE6_BY_ID = new Map(GRUDGE6_HEROES.map((h) => [h.id, h]));

export function getGrudge6Hero(id: string | null | undefined): Grudge6HeroDef | undefined {
  if (!id) return undefined;
  return GRUDGE6_BY_ID.get(id);
}

/** Healers first, then tanks, then DPS — good default party suggestions. */
export function suggestParty(count = 2): Grudge6HeroDef[] {
  const order: AllyRole[] = ["healer", "tank", "ranger", "bruiser", "fighter", "skirmisher", "unarmed"];
  const picked: Grudge6HeroDef[] = [];
  for (const role of order) {
    const h = GRUDGE6_HEROES.find((x) => x.role === role && !picked.includes(x));
    if (h) picked.push(h);
    if (picked.length >= count) break;
  }
  return picked;
}

export const MAX_PARTY_ALLIES = 2;

const PARTY_KEY = "flare:party:allies";

export function getPartyAllyIds(): string[] {
  if (typeof localStorage === "undefined") return suggestParty(2).map((h) => h.id);
  try {
    const raw = localStorage.getItem(PARTY_KEY);
    if (!raw) {
      const def = suggestParty(2).map((h) => h.id);
      localStorage.setItem(PARTY_KEY, JSON.stringify(def));
      return def;
    }
    const ids = (JSON.parse(raw) as string[]).filter((id) => GRUDGE6_BY_ID.has(id));
    return ids.slice(0, MAX_PARTY_ALLIES);
  } catch {
    return suggestParty(2).map((h) => h.id);
  }
}

export function setPartyAllyIds(ids: string[]) {
  if (typeof localStorage === "undefined") return;
  const clean = [...new Set(ids)].filter((id) => GRUDGE6_BY_ID.has(id)).slice(0, MAX_PARTY_ALLIES);
  localStorage.setItem(PARTY_KEY, JSON.stringify(clean));
}

export function togglePartyAlly(id: string): { ok: boolean; message: string; ids: string[] } {
  if (!GRUDGE6_BY_ID.has(id)) return { ok: false, message: "Unknown hero.", ids: getPartyAllyIds() };
  let ids = getPartyAllyIds();
  if (ids.includes(id)) {
    ids = ids.filter((x) => x !== id);
    setPartyAllyIds(ids);
    return { ok: true, message: "Removed from party.", ids };
  }
  if (ids.length >= MAX_PARTY_ALLIES) {
    return { ok: false, message: `Max ${MAX_PARTY_ALLIES} allies.`, ids };
  }
  ids = [...ids, id];
  setPartyAllyIds(ids);
  return { ok: true, message: "Added to party.", ids };
}
