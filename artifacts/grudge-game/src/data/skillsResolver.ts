/**
 * skillsResolver — thin adapter for Flare Boss Arena's independent combat kit.
 *
 * Replaces the Warlords-era class + R2 weapon-skills.json pipeline. Pages that
 * still call `useResolvedSkills` get fighter skills + signature weapon instead.
 */

import { useMemo } from "react";
import { getGameLoadout, RACALVIN_PISTOL_WEAPON, type GameLoadout, type GameWeapon } from "./gameCombat";
import { RACALVIN_ID } from "./fighters";
import type { ClassSkill, ClassSkillSet } from "./classSkills";
import { getActiveFighterId } from "./fighters";
import type { WeaponSlot } from "@/game/weaponSkills";
import { pickSpellbookIconForSkill } from "./spellbookAssets";

export type { WeaponSlot };

export interface WeaponTypeDef {
  id: string;
  name: string;
  icon?: string;
  slots: WeaponSlot[];
}

export interface WeaponSkillsData {
  weaponTypes: Record<string, WeaponTypeDef>;
  classWeapons: Record<string, string[]>;
}

export interface ResolvedSkills {
  classSkills: ClassSkillSet | null;
  weaponType: WeaponTypeDef | null;
  weaponSlots: WeaponSlot[];
  classWeaponTypes: WeaponTypeDef[];
  /** Full independent loadout (preferred for new code). */
  loadout: GameLoadout;
}

function weaponSlot(w: GameWeapon, slotType: "primary" | "secondary"): WeaponSlot {
  return {
    type: slotType,
    label: w.name,
    unlockTier: 0,
    skills: [
      {
        id: w.id,
        name: w.name,
        description: w.description,
        icon: "⚔",
        tier: 0,
        cooldown: 0,
        damage: w.damageBonus,
        effects: [],
      },
    ],
  };
}

function weaponAsType(w: GameWeapon, fighterId?: string): WeaponTypeDef {
  const slots = [weaponSlot(w, "primary")];
  if (fighterId === RACALVIN_ID) {
    slots.push(weaponSlot(RACALVIN_PISTOL_WEAPON, "secondary"));
  }
  return {
    id: w.style.toUpperCase(),
    name: w.name,
    slots,
  };
}

function kitAsClassSet(loadout: GameLoadout): ClassSkillSet {
  const skills: ClassSkill[] = loadout.skills.map((s) => {
    const sb = pickSpellbookIconForSkill({
      skillId: s.id,
      skillName: s.name,
      element: s.element,
    });
    return {
      id: s.id,
      name: s.name,
      description: s.description,
      glyph: s.glyph,
      icon: sb ? `ui/craftpix/spellbook/${sb.file}` : undefined,
      type: s.element === "physical" ? "physical" : "magical",
      damage: s.damageMult,
      manaCost: s.manaCost,
      cooldown: Math.round(s.cooldown),
      target: s.targeting === "self" ? "self" : "enemy",
      effects: [
        s.targeting === "ground_aoe" ? "Ground AoE (1-5 then LMB)" : s.targeting === "slash_wave" ? "Slash wave" : String(s.shape),
        s.element,
      ],
    };
  });
  // Surface special as signature for UI pages.
  const spIcon = pickSpellbookIconForSkill({
    skillName: loadout.special.name,
    element: loadout.special.element,
  });
  skills.push({
    id: "special_" + loadout.special.name,
    name: loadout.special.name + " [R]",
    description: loadout.special.description,
    glyph: "★",
    icon: spIcon ? `ui/craftpix/spellbook/${spIcon.file}` : undefined,
    type: loadout.special.element === "physical" ? "physical" : "magical",
    damage: loadout.special.damageMult,
    manaCost: loadout.special.manaCost,
    cooldown: Math.round(loadout.special.cooldown),
    target: "enemy",
    effects: ["Special", loadout.special.element],
    isSignature: true,
  });
  return {
    id: loadout.fighter.id,
    name: loadout.fighter.name,
    color: "#c5a059",
    description: loadout.fighter.blurb,
    skills,
  };
}

/** Pure resolve — no network. `charClass` / `mainCategory` ignored (kept for call-site compat). */
export function resolveSkillsFrom(_data: unknown, opts: { charClass: string; mainCategory?: string | null }): ResolvedSkills {
  // Prefer active fighter; fall back to class-named fighter if any.
  const loadout = getGameLoadout(getActiveFighterId());
  const weaponType = weaponAsType(loadout.weapon, loadout.fighter.id);
  return {
    classSkills: kitAsClassSet(loadout),
    weaponType,
    weaponSlots: weaponType.slots,
    classWeaponTypes: [weaponType],
    loadout,
  };
}

export async function resolveSkills(opts: { charClass: string; mainCategory?: string | null }): Promise<ResolvedSkills> {
  return resolveSkillsFrom(null, opts);
}

export function categoryToWeaponType(category?: string | null): string | null {
  if (!category) return null;
  return category.toUpperCase();
}

/** React hook — always sync, no loading spinner for missing R2. */
export function useResolvedSkills(charClass: string, mainCategory?: string | null) {
  const resolved = useMemo(
    () => resolveSkillsFrom(null, { charClass, mainCategory }),
    [charClass, mainCategory],
  );
  return {
    ...resolved,
    isLoading: false,
    error: null as string | null,
  };
}

/** Preferred API for new UI. */
export function useGameLoadout(fighterId?: string | null) {
  return useMemo(() => getGameLoadout(fighterId ?? getActiveFighterId()), [fighterId]);
}
