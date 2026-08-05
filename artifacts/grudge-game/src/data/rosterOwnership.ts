/**
 * Owned roster units — Grudge6 standard characters + recruited fighter heroes.
 * Party / field deploys only allow units the player owns or has purchased.
 */

import { GRUDGE6_HEROES, GRUDGE6_BY_ID, suggestParty, type Grudge6HeroDef } from "./grudge6Roster";
import { FIGHTERS, type FighterDef, getFighter } from "./fighters";
import { getWallet, saveWallet } from "./wallet";
import { getBuildingTier } from "./rtsCrafting";

const OWNED_G6_KEY = "flare:roster:owned_g6.v1";
const OWNED_HERO_KEY = "flare:roster:owned_heroes.v1";

/** Base gold to buy a Grudge6 unit (discounted by barracks tier). */
export const G6_HIRE_GOLD = 150;
/** Gold to recruit a fighter hero into the warband. */
export const HERO_RECRUIT_GOLD = 400;

function readIds(key: string): string[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function writeIds(key: string, ids: string[]) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(key, JSON.stringify([...new Set(ids)]));
}

/** Starter free Grudge6 units (same as default party suggestions). */
export function starterOwnedGrudge6(): string[] {
  return suggestParty(2).map((h) => h.id);
}

export function getOwnedGrudge6Ids(): string[] {
  const ids = readIds(OWNED_G6_KEY).filter((id) => GRUDGE6_BY_ID.has(id));
  if (ids.length === 0) {
    const starter = starterOwnedGrudge6();
    writeIds(OWNED_G6_KEY, starter);
    return starter;
  }
  return ids;
}

export function isGrudge6Owned(id: string): boolean {
  return getOwnedGrudge6Ids().includes(id);
}

export function getOwnedGrudge6(): Grudge6HeroDef[] {
  return getOwnedGrudge6Ids()
    .map((id) => GRUDGE6_BY_ID.get(id))
    .filter((h): h is Grudge6HeroDef => !!h);
}

export function hireCostForGrudge6(id: string): number {
  const barracks = getBuildingTier("barracks");
  const discount = Math.min(0.45, barracks * 0.08);
  void id;
  return Math.max(40, Math.round(G6_HIRE_GOLD * (1 - discount)));
}

export function purchaseGrudge6(id: string): { ok: boolean; message: string } {
  if (!GRUDGE6_BY_ID.has(id)) return { ok: false, message: "Unknown unit." };
  if (isGrudge6Owned(id)) return { ok: false, message: "Already owned." };
  if (getBuildingTier("barracks") < 1) {
    return { ok: false, message: "Upgrade Barracks to tier 1 first (Crafting)." };
  }
  const cost = hireCostForGrudge6(id);
  const w = getWallet();
  if (w.gold < cost) return { ok: false, message: `Need ${cost} gold.` };
  saveWallet({ ...w, gold: w.gold - cost });
  writeIds(OWNED_G6_KEY, [...getOwnedGrudge6Ids(), id]);
  const h = GRUDGE6_BY_ID.get(id)!;
  return { ok: true, message: `Hired ${h.displayName}.` };
}

/** Grant ownership without cost (rewards / starter). */
export function grantGrudge6(id: string): boolean {
  if (!GRUDGE6_BY_ID.has(id)) return false;
  if (isGrudge6Owned(id)) return true;
  writeIds(OWNED_G6_KEY, [...getOwnedGrudge6Ids(), id]);
  return true;
}

// ── Recruited fighter heroes (player champions available as allies) ──────────

export function getOwnedHeroIds(): string[] {
  const ids = readIds(OWNED_HERO_KEY).filter((id) => !!getFighter(id));
  // Active fighter is always "owned"
  try {
    const active = localStorage.getItem("grudge:fighter");
    if (active && getFighter(active) && !ids.includes(active)) {
      return [...ids, active];
    }
  } catch {
    /* ignore */
  }
  return ids;
}

export function isHeroOwned(id: string): boolean {
  return getOwnedHeroIds().includes(id);
}

export function getOwnedHeroes(): FighterDef[] {
  return getOwnedHeroIds()
    .map((id) => getFighter(id))
    .filter((f): f is FighterDef => !!f);
}

export function recruitHeroCost(id: string): number {
  const f = getFighter(id);
  if (!f) return HERO_RECRUIT_GOLD;
  // Featured / high-stat fighters cost more
  const power =
    f.stats.strength + f.stats.vitality + f.stats.intellect + f.stats.endurance;
  return Math.round(HERO_RECRUIT_GOLD + power * 8);
}

export function purchaseHero(id: string): { ok: boolean; message: string } {
  const f = getFighter(id);
  if (!f) return { ok: false, message: "Unknown hero." };
  if (isHeroOwned(id)) return { ok: false, message: "Already recruited." };
  if (getBuildingTier("barracks") < 2) {
    return { ok: false, message: "Barracks tier 2 required to recruit heroes." };
  }
  const cost = recruitHeroCost(id);
  const w = getWallet();
  if (w.gold < cost) return { ok: false, message: `Need ${cost} gold.` };
  saveWallet({ ...w, gold: w.gold - cost });
  writeIds(OWNED_HERO_KEY, [...getOwnedHeroIds(), id]);
  return { ok: true, message: `Recruited ${f.name}.` };
}

export function grantHero(id: string): boolean {
  if (!getFighter(id)) return false;
  if (isHeroOwned(id)) return true;
  writeIds(OWNED_HERO_KEY, [...getOwnedHeroIds(), id]);
  return true;
}

/** Catalog for hire UI — not yet owned Grudge6. */
export function hireableGrudge6(): Grudge6HeroDef[] {
  const owned = new Set(getOwnedGrudge6Ids());
  return GRUDGE6_HEROES.filter((h) => !owned.has(h.id));
}

/** Fighters not yet recruited (exclude active is fine to show as owned). */
export function recruitableHeroes(): FighterDef[] {
  const owned = new Set(getOwnedHeroIds());
  return FIGHTERS.filter((f) => !owned.has(f.id));
}
