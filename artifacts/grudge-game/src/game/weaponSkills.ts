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

const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");

let cache: Promise<WeaponSkillsData> | null = null;

export function fetchWeaponSkills(): Promise<WeaponSkillsData> {
  if (!cache) {
    cache = fetch(`${BASE}/data/weapon-skills.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`weapon-skills.json HTTP ${r.status}`);
        return r.json() as Promise<WeaponSkillsData>;
      })
      .catch((err) => {
        cache = null;
        throw err;
      });
  }
  return cache;
}

export function classWeaponList(data: WeaponSkillsData, charClass: string): string[] {
  const map = data.classWeapons;
  const key = (Object.keys(map).find((k) => k.toLowerCase() === charClass.toLowerCase())) ?? Object.keys(map)[0];
  return map[key] ?? [];
}
