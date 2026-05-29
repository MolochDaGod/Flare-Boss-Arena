/**
 * skillsResolver — single source of truth that combines class skills
 * (authored in `classSkills.ts`) with weapon skills (loaded from
 * `public/data/weapon-skills.json`) for a given character + equipped weapon.
 *
 * The exported API is framework-light so it can be reused everywhere skills are
 * surfaced: the Grimoire (skills page), the Armory (equipment cards), the
 * MainPanel SkillsTab and the in-game HUD skill bar.
 *
 *   resolveSkills({ charClass, mainCategory })  -> async, fetches weapon data
 *   resolveSkillsFrom(data, { charClass, ... })  -> pure (data already loaded)
 *   categoryToWeaponType(category)               -> maps item category -> key
 *   useResolvedSkills(charClass, mainCategory)   -> React hook (loading state)
 */

import { useEffect, useState } from "react";
import {
  fetchWeaponSkills,
  type WeaponSkillsData,
  type WeaponTypeDef,
  type WeaponSlot,
} from "@/game/weaponSkills";
import { getClassSkills, type ClassSkillSet } from "@/data/classSkills";

export type { WeaponSkillsData, WeaponTypeDef, WeaponSlot };

export interface ResolvedSkills {
  /** Authored class skill set (warrior/mage/ranger/worge), or null. */
  classSkills: ClassSkillSet | null;
  /** Weapon type matching the equipped main-hand category, or null. */
  weaponType: WeaponTypeDef | null;
  /** Convenience: the equipped weapon's skill slots (primary/secondary/...). */
  weaponSlots: WeaponSlot[];
  /** Every weapon type this class can wield, for "Class Trees" browsing. */
  classWeaponTypes: WeaponTypeDef[];
}

/**
 * Map an inventory/equipment item category (or a raw weaponType key) onto a
 * weapon-skills.json `weaponTypes` key (SWORD, AXE, STAFF, ...).
 *
 * Handles the many category spellings used across the app:
 *   • equipment.tsx catKeys  — swords, axes1h, greataxes, fireStaves, fireTomes…
 *   • starterGear categories — swords, staves, bows, blunts
 *   • raw weaponType keys     — SWORD, GREATSWORD, OFFHAND_RELIC…
 */
export function categoryToWeaponType(category?: string | null): string | null {
  if (!category) return null;
  const c = category.trim().toLowerCase();
  if (!c) return null;

  // Order matters — check the most specific tokens first.
  const rules: Array<[RegExp, string]> = [
    [/relic|offhand_relic/, "OFFHAND_RELIC"],
    [/greatsword/, "GREATSWORD"],
    [/greataxe/, "GREATAXE"],
    [/scythe/, "SCYTHE"],
    [/crossbow/, "CROSSBOW"],
    [/dagger/, "DAGGER"],
    [/tome|book|grimoire/, "TOME"],
    [/wand/, "WAND"],
    [/stave|staff/, "STAFF"],
    [/shield/, "SHIELD"],
    [/spear|polearm|lance/, "SPEAR"],
    [/hammer|blunt|mace|club|maul/, "HAMMER"],
    [/\baxe/, "AXE"],
    [/sword|blade/, "SWORD"],
    [/\bbow/, "BOW"],
    [/gun|pistol|rifle|blackpowder/, "GUN"],
  ];

  for (const [re, key] of rules) {
    if (re.test(c)) {
      // "mace"/"club" map to HAMMER above, but MACE is its own type — refine.
      if ((c.includes("mace") || c.includes("club")) && !c.includes("hammer")) return "MACE";
      return key;
    }
  }
  return null;
}

function findWeaponType(data: WeaponSkillsData, key: string | null): WeaponTypeDef | null {
  if (!key) return null;
  const types = data.weaponTypes ?? {};
  return (
    types[key] ??
    Object.values(types).find((t) => t.id?.toUpperCase() === key.toUpperCase()) ??
    null
  );
}

/** Weapon-skills.json `classWeapons` lookup (case-insensitive class match). */
function classWeaponKeys(data: WeaponSkillsData, charClass: string): string[] {
  const map = data.classWeapons ?? {};
  const key = Object.keys(map).find((k) => k.toLowerCase() === charClass.toLowerCase());
  return key ? map[key] ?? [] : [];
}

export interface ResolveOpts {
  charClass: string;
  /** Equipped main-hand item category (or raw weaponType key). */
  mainCategory?: string | null;
}

/** Pure resolver — call when the weapon-skills data is already loaded. */
export function resolveSkillsFrom(data: WeaponSkillsData, opts: ResolveOpts): ResolvedSkills {
  const classSkills = getClassSkills(opts.charClass);

  const weaponType = findWeaponType(data, categoryToWeaponType(opts.mainCategory));
  const weaponSlots = weaponType?.slots ?? [];

  const classWeaponTypes = classWeaponKeys(data, opts.charClass)
    .map((k) => findWeaponType(data, k))
    .filter((t): t is WeaponTypeDef => !!t);

  return { classSkills, weaponType, weaponSlots, classWeaponTypes };
}

/** Async resolver — fetches (and caches) weapon-skills.json, then resolves. */
export async function resolveSkills(opts: ResolveOpts): Promise<ResolvedSkills> {
  const data = await fetchWeaponSkills();
  return resolveSkillsFrom(data, opts);
}

export interface UseResolvedSkills extends ResolvedSkills {
  isLoading: boolean;
  error: Error | null;
}

const EMPTY: ResolvedSkills = {
  classSkills: null,
  weaponType: null,
  weaponSlots: [],
  classWeaponTypes: [],
};

/** React hook wrapper that surfaces loading/error alongside resolved skills. */
export function useResolvedSkills(
  charClass: string | undefined | null,
  mainCategory?: string | null,
): UseResolvedSkills {
  const [data, setData] = useState<WeaponSkillsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let live = true;
    setIsLoading(true);
    fetchWeaponSkills()
      .then((d) => {
        if (!live) return;
        setData(d);
        setError(null);
      })
      .catch((e) => {
        if (!live) return;
        setError(e instanceof Error ? e : new Error(String(e)));
      })
      .finally(() => {
        if (live) setIsLoading(false);
      });
    return () => {
      live = false;
    };
  }, []);

  const resolved =
    data && charClass ? resolveSkillsFrom(data, { charClass, mainCategory }) : EMPTY;

  // Class skills are local — resolve them even before weapon data arrives.
  const classSkills = resolved.classSkills ?? getClassSkills(charClass);

  return { ...resolved, classSkills, isLoading, error };
}
