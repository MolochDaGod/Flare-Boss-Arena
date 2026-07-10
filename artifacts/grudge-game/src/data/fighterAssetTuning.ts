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

export interface RacalvinWeaponTuning {
  /** Combat grip on RightHand — Mixamo sword-and-shield pack orientation. */
  swordHeld: WeaponMountTuning;
  /** Idle / locomotion grip on the same hand bone (blade at rest). */
  swordRest: WeaponMountTuning;
  pistol: WeaponMountTuning;
}

export interface FighterAssetTuning {
  version: 1;
  weapons: RacalvinWeaponTuning;
  hiddenMeshes: HiddenMeshRule[];
}

const STORAGE_KEY = "grudge:fighter-asset-tuning";

/** Mixamo RightHand grip used by the sword-and-shield animation pack. */
export const MIXAMO_SWORD_HELD: WeaponMountTuning = {
  targetLength: 1.36,
  position: [0, 0.02, -0.03],
  rotation: [90, 0, 90],
  gripYOffset: 0.02,
};

/** Same hand bone, blade resting along the thigh for idle / walk. */
export const MIXAMO_SWORD_REST: WeaponMountTuning = {
  targetLength: 1.36,
  position: [0.05, -0.1, 0.04],
  rotation: [12, 88, 108],
  gripYOffset: 0.02,
};

export const DEFAULT_PISTOL_WEAPON: WeaponMountTuning = {
  targetLength: 0.3,
  position: [0.04, 0.07, -0.02],
  rotation: [-90, 180, 6.9],
  gripYOffset: 0,
};

/** @deprecated Use MIXAMO_SWORD_HELD — kept for imports that still reference it. */
export const DEFAULT_SWORD_WEAPON = MIXAMO_SWORD_HELD;

export const DEFAULT_RACALVIN_TUNING: FighterAssetTuning = {
  version: 1,
  weapons: {
    swordHeld: { ...MIXAMO_SWORD_HELD },
    swordRest: { ...MIXAMO_SWORD_REST },
    pistol: { ...DEFAULT_PISTOL_WEAPON },
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

/** Legacy localStorage may still store `weapons.sword` instead of swordHeld. */
type SavedWeapons = Partial<RacalvinWeaponTuning> & { sword?: WeaponMountTuning };

function mergeWeapons(base: RacalvinWeaponTuning, saved?: SavedWeapons): RacalvinWeaponTuning {
  const legacySword = saved?.sword;
  return {
    swordHeld: mergeWeapon(base.swordHeld, saved?.swordHeld ?? legacySword),
    swordRest: mergeWeapon(base.swordRest, saved?.swordRest),
    pistol: mergeWeapon(base.pistol, saved?.pistol),
  };
}

export function defaultTuningFor(fighterId: string): FighterAssetTuning {
  if (fighterId === RACALVIN_ID) return structuredClone(DEFAULT_RACALVIN_TUNING);
  return {
    version: 1,
    weapons: {
      swordHeld: { ...MIXAMO_SWORD_HELD },
      swordRest: { ...MIXAMO_SWORD_REST },
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
  const saved = readStore()[fighterId] as (FighterAssetTuning & { weapons?: SavedWeapons }) | undefined;
  const base = defaultTuningFor(fighterId);
  if (!saved || saved.version !== 1) return base;
  return {
    version: 1,
    weapons: mergeWeapons(base.weapons, saved.weapons),
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