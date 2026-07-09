/**
 * Weapon skill stubs — Warlords weapon-skills.json is no longer required.
 * Live combat uses data/fighterSkills + data/gameCombat exclusively.
 */

export interface WeaponSkill {
  id: string;
  name: string;
  description: string;
  icon: string;
  tier: number;
  damage: number;
  cooldown: number;
  effects: string[];
}

export interface WeaponSlot {
  type: "primary" | "secondary" | "ability" | "ultimate";
  unlockTier: number;
  label: string;
  skills: WeaponSkill[];
}

export interface WeaponTypeDef {
  id: string;
  name: string;
  icon: string;
  slots: WeaponSlot[];
}

export interface WeaponSkillsData {
  weaponTypes: Record<string, WeaponTypeDef>;
  classWeapons: Record<string, string[]>;
  slotTypes: ("primary" | "secondary" | "ability" | "ultimate")[];
}

/** Empty local catalog — no network. Equipment page degrades gracefully. */
const EMPTY: WeaponSkillsData = {
  weaponTypes: {},
  classWeapons: {},
  slotTypes: ["primary", "secondary", "ability", "ultimate"],
};

export function fetchWeaponSkills(): Promise<WeaponSkillsData> {
  return Promise.resolve(EMPTY);
}

export function classWeaponList(_data: WeaponSkillsData, _charClass: string): string[] {
  return [];
}
