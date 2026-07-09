/**
 * Per-fighter weapon placement + mesh visibility rules (roster cog editor).
 * Persisted in localStorage; consumed by FighterPreview and in-game loaders.
 */
import { RACALVIN_ID } from "./fighters";

export interface WeaponMountTuning {
  targetLength: number;
  position: [number, number, number];
  /** Euler degrees (X, Y, Z) on the hand mount. */
  rotation: [number, number, number];
  gripYOffset: number;
}

export interface HiddenMeshRule {
  meshName: string;
  /** When true the mesh is always shown. */
  alwaysVisible: boolean;
  /** Clip names that reveal this mesh (e.g. cast, attack, pistol). */
  showOnClips: string[];
}

export interface FighterAssetTuning {
  version: 1;
  weapons: {
    sword: WeaponMountTuning;
    pistol: WeaponMountTuning;
  };
  hiddenMeshes: HiddenMeshRule[];
}

const STORAGE_KEY = "grudge:fighter-asset-tuning";

export const DEFAULT_SWORD_WEAPON: WeaponMountTuning = {
  targetLength: 1.36,
  position: [0.04, 0.04, -0.02],
  rotation: [90, 3.4, 90],
  gripYOffset: 0.03,
};

export const DEFAULT_PISTOL_WEAPON: WeaponMountTuning = {
  targetLength: 0.3,
  position: [0.04, 0.07, -0.02],
  rotation: [-90, 180, 6.9],
  gripYOffset: 0,
};

export const DEFAULT_RACALVIN_TUNING: FighterAssetTuning = {
  version: 1,
  weapons: {
    sword: DEFAULT_SWORD_WEAPON,
    pistol: DEFAULT_PISTOL_WEAPON,
  },
  hiddenMeshes: [],
};

function mergeWeapon(base: WeaponMountTuning, patch?: Partial<WeaponMountTuning>): WeaponMountTuning {
  if (!patch) return base;
  return {
    targetLength: patch.targetLength ?? base.targetLength,
    position: patch.position ?? base.position,
    rotation: patch.rotation ?? base.rotation,
    gripYOffset: patch.gripYOffset ?? base.gripYOffset,
  };
}

export function defaultTuningFor(fighterId: string): FighterAssetTuning {
  if (fighterId === RACALVIN_ID) return structuredClone(DEFAULT_RACALVIN_TUNING);
  return {
    version: 1,
    weapons: {
      sword: { ...DEFAULT_SWORD_WEAPON },
      pistol: { ...DEFAULT_PISTOL_WEAPON },
    },
    hiddenMeshes: [],
  };
}

type TuningStore = Record<string, FighterAssetTuning>;

function readStore(): TuningStore {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as TuningStore;
  } catch {
    return {};
  }
}

function writeStore(store: TuningStore) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function getFighterAssetTuning(fighterId: string): FighterAssetTuning {
  const saved = readStore()[fighterId];
  const base = defaultTuningFor(fighterId);
  if (!saved || saved.version !== 1) return base;
  return {
    version: 1,
    weapons: {
      sword: mergeWeapon(base.weapons.sword, saved.weapons?.sword),
      pistol: mergeWeapon(base.weapons.pistol, saved.weapons?.pistol),
    },
    hiddenMeshes: saved.hiddenMeshes ?? [],
  };
}

export function saveFighterAssetTuning(fighterId: string, tuning: FighterAssetTuning) {
  const store = readStore();
  store[fighterId] = tuning;
  writeStore(store);
}

export function resetFighterAssetTuning(fighterId: string) {
  const store = readStore();
  delete store[fighterId];
  writeStore(store);
}