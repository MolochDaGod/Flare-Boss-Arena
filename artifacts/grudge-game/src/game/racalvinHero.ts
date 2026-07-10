/**
 * Racalvin — the bespoke Corsair King hero.
 *
 * Base skinned model + skeleton-only animation GLBs. Brothers' Keeper greatsword
 * and Corsair pistol parent to RightHand with tuned Mixamo grips. Weapon mode
 * swaps on psychic / pistol skills vs melee.
 */
import * as THREE from "three";
import type { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { PlayerAnimator } from "./PlayerAnimator";
import type { FighterSkillDef, FighterSpecialDef } from "../data/fighterSkills";
import type { FighterAssetTuning, WeaponMountTuning } from "../data/fighterAssetTuning";
import { DEFAULT_RACALVIN_TUNING, getFighterAssetTuning } from "../data/fighterAssetTuning";
import { RACALVIN_ID } from "../data/fighters";
import { applyHiddenMeshRules } from "./assetVisibility";
import { findHandBone } from "./assets";

export const RACALVIN_DIR = "models/racalvin";
export const RACALVIN_PSYCHIC_COLOR = 0x44ff88;

const base = () => `${import.meta.env.BASE_URL}${RACALVIN_DIR}/base.glb`;
const swordUrl = () => `${import.meta.env.BASE_URL}${RACALVIN_DIR}/sword.glb`;
const pistolUrl = () => `${import.meta.env.BASE_URL}${RACALVIN_DIR}/pistol.glb`;
const animUrl = (name: string) => `${import.meta.env.BASE_URL}${RACALVIN_DIR}/anim/${name}.glb`;

export const RACALVIN_ANIMS = [
  "idle",
  "walk",
  "run",
  "attack",
  "cast",
  "dodge",
  "hit",
  "jump",
  "hammer",
  "combo",
  "punch",
] as const;
export type RacalvinClipName = (typeof RACALVIN_ANIMS)[number];

export type RacalvinWeaponMode = "sword" | "pistol";

/** Which RightHand sword transform is active (combat vs idle locomotion). */
export type RacalvinSwordPose = "held" | "rest";

export const RACALVIN_BASE_URL = base;

const SWORD_HELD_CLIP = /attack|combo|hammer|punch|cast|slash|chop|stab/i;

const USERDATA_KEY = "racalvinWeapons";

interface PropTuning {
  targetLength: number;
  /** Local position after scale (grip in palm). */
  position: THREE.Vector3;
  /** Local rotation (radians). */
  rotation: THREE.Euler;
  /** Shift grip along bbox Y after scale (0 = min Y at origin). */
  gripYOffset?: number;
}

function weaponToProp(w: WeaponMountTuning): PropTuning {
  const d2r = Math.PI / 180;
  return {
    targetLength: w.targetLength,
    position: new THREE.Vector3(w.position[0], w.position[1], w.position[2]),
    rotation: new THREE.Euler(w.rotation[0] * d2r, w.rotation[1] * d2r, w.rotation[2] * d2r),
    gripYOffset: w.gripYOffset,
  };
}

function propToMount(mount: THREE.Object3D, w: WeaponMountTuning) {
  mount.position.set(w.position[0], w.position[1], w.position[2]);
  const d2r = Math.PI / 180;
  mount.rotation.set(w.rotation[0] * d2r, w.rotation[1] * d2r, w.rotation[2] * d2r);
  const baked = mount.userData.bakedLength as number | undefined;
  const holder = mount.children[0] as THREE.Object3D | undefined;
  if (holder && baked && baked > 1e-6) {
    const ratio = w.targetLength / baked;
    holder.scale.setScalar(ratio);
  }
  const baseMinY = holder?.userData.baseMinY as number | undefined;
  const prop = holder?.children[0];
  if (prop && baseMinY !== undefined) {
    prop.position.y = -baseMinY - (w.gripYOffset ?? 0);
  }
}

export class RacalvinWeapons {
  private mode: RacalvinWeaponMode = "sword";
  private swordPose: RacalvinSwordPose = "rest";
  private weapons: FighterAssetTuning["weapons"] | null = null;

  constructor(
    readonly swordMount: THREE.Object3D,
    readonly pistolMount: THREE.Object3D,
  ) {
    this.setMode("sword");
  }

  getMode(): RacalvinWeaponMode {
    return this.mode;
  }

  getSwordPose(): RacalvinSwordPose {
    return this.swordPose;
  }

  setMode(mode: RacalvinWeaponMode) {
    this.mode = mode;
    this.swordMount.visible = mode === "sword";
    this.pistolMount.visible = mode === "pistol";
  }

  setSwordPose(pose: RacalvinSwordPose) {
    if (this.swordPose === pose && this.weapons) return;
    this.swordPose = pose;
    if (this.weapons) this.applySwordMount(this.weapons);
  }

  private applySwordMount(tuning: FighterAssetTuning["weapons"]) {
    const w = this.swordPose === "held" ? tuning.swordHeld : tuning.swordRest;
    propToMount(this.swordMount, w);
  }

  applyMountTuning(tuning: FighterAssetTuning["weapons"]) {
    this.weapons = tuning;
    this.applySwordMount(tuning);
    propToMount(this.pistolMount, tuning.pistol);
  }
}

export function racalvinSwordPoseForClip(clipName: string): RacalvinSwordPose {
  return SWORD_HELD_CLIP.test(clipName.toLowerCase()) ? "held" : "rest";
}

/** Swap held/rest sword grip when the active animation clip changes. */
export function syncRacalvinSwordPose(root: THREE.Object3D, clipName: string) {
  const rig = getRacalvinWeapons(root);
  if (!rig || rig.getMode() !== "sword") return;
  rig.setSwordPose(racalvinSwordPoseForClip(clipName));
}

export function applyRacalvinAssetTuning(root: THREE.Object3D, tuning: FighterAssetTuning) {
  getRacalvinWeapons(root)?.applyMountTuning(tuning.weapons);
  applyHiddenMeshRules(root, tuning.hiddenMeshes);
}

export function getRacalvinWeapons(root: THREE.Object3D): RacalvinWeapons | null {
  return (root.userData[USERDATA_KEY] as RacalvinWeapons | undefined) ?? null;
}

/** Psychic / pistol skills holster the blade and draw the Corsair pistol. */
export function racalvinWeaponModeForSkill(skill: FighterSkillDef | FighterSpecialDef): RacalvinWeaponMode {
  const id = "id" in skill ? String(skill.id) : "";
  const name = skill.name.toLowerCase();
  if (
    skill.element === "psychic" ||
    id.includes("pistol") ||
    id.includes("mind") ||
    id.includes("psychic") ||
    id.includes("psymic") ||
    name.includes("pistol") ||
    name.includes("mind") ||
    name.includes("psymic")
  ) {
    return "pistol";
  }
  return "sword";
}

export function loadRacalvinClips(loader: GLTFLoader): Promise<THREE.AnimationClip[]> {
  return Promise.all(
    RACALVIN_ANIMS.map(
      (name) =>
        new Promise<THREE.AnimationClip | null>((resolve) => {
          loader.load(
            animUrl(name),
            (gltf) => {
              const clip = gltf.animations[0];
              if (clip) clip.name = name;
              resolve(clip ?? null);
            },
            undefined,
            () => resolve(null),
          );
        }),
    ),
  ).then((clips) => clips.filter((c): c is THREE.AnimationClip => !!c));
}

function fitWrapper(model: THREE.Object3D, targetHeight: number): THREE.Group {
  const wrapper = new THREE.Group();
  model.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(model);
  const size = new THREE.Vector3();
  box.getSize(size);
  if (size.y > 0.001) model.scale.setScalar(targetHeight / size.y);
  model.updateWorldMatrix(true, true);
  const box2 = new THREE.Box3().setFromObject(model);
  const center = new THREE.Vector3();
  box2.getCenter(center);
  model.position.x -= center.x;
  model.position.z -= center.z;
  model.position.y -= box2.min.y;
  wrapper.add(model);
  return wrapper;
}

export function findRacalvinRightHand(root: THREE.Object3D): THREE.Bone | null {
  return findHandBone(root, true);
}

function ensureMountsOnHand(rig: RacalvinWeapons, hand: THREE.Bone) {
  for (const mount of [rig.swordMount, rig.pistolMount]) {
    if (mount.parent !== hand) {
      hand.add(mount);
    }
  }
}

function disposeProp(obj: THREE.Object3D) {
  obj.traverse((c) => {
    const m = c as THREE.Mesh & { isMesh?: boolean };
    if (!m.isMesh) return;
    m.geometry?.dispose();
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    for (const mat of mats) (mat as THREE.Material | undefined)?.dispose();
  });
}

function steelMaterial(mesh: THREE.Object3D) {
  mesh.traverse((c) => {
    const m = c as THREE.Mesh & { isMesh?: boolean };
    if (!m.isMesh) return;
    m.castShadow = true;
    m.frustumCulled = false;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    for (const mat of mats) {
      const sm = mat as THREE.MeshStandardMaterial;
      if (!sm) continue;
      if (sm.emissive) sm.emissive.setRGB(0, 0, 0);
      sm.emissiveIntensity = 0;
      if (!sm.map) sm.color.setHex(0xc2c7d2);
      sm.metalness = 0.55;
      sm.roughness = 0.35;
      sm.needsUpdate = true;
    }
  });
}

function pistolMaterial(mesh: THREE.Object3D) {
  mesh.traverse((c) => {
    const m = c as THREE.Mesh & { isMesh?: boolean };
    if (!m.isMesh) return;
    m.castShadow = true;
    m.frustumCulled = false;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    for (const mat of mats) {
      const sm = mat as THREE.MeshStandardMaterial;
      if (!sm) continue;
      if (sm.emissive) sm.emissive.setRGB(0, 0, 0);
      sm.emissiveIntensity = 0;
      if (!sm.map) sm.color.setHex(0x2a2a30);
      sm.metalness = 0.7;
      sm.roughness = 0.28;
      sm.needsUpdate = true;
    }
  });
}

/** Scale prop to target length, seat grip at mount origin, apply tuned rotation. */
function buildPropHolder(prop: THREE.Object3D, tuning: PropTuning): THREE.Group {
  prop.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(prop);
  const size = new THREE.Vector3();
  box.getSize(size);
  const maxDim = Math.max(size.x, size.y, size.z, 1e-4);
  const s = tuning.targetLength / maxDim;
  prop.scale.setScalar(s);
  prop.updateWorldMatrix(true, true);
  const box2 = new THREE.Box3().setFromObject(prop);
  const center = new THREE.Vector3();
  box2.getCenter(center);
  prop.position.x -= center.x;
  prop.position.z -= center.z;
  prop.position.y = -box2.min.y - (tuning.gripYOffset ?? 0);

  const holder = new THREE.Group();
  holder.userData.baseMinY = box2.min.y;
  holder.add(prop);
  return holder;
}

function handCompensation(hand: THREE.Object3D): number {
  hand.updateWorldMatrix(true, false);
  const sc = new THREE.Vector3();
  hand.getWorldScale(sc);
  return sc.x > 1e-6 ? 1 / sc.x : 1;
}

export interface RacalvinAttachOpts {
  tuning?: FighterAssetTuning;
  isDisposed?: () => boolean;
}

/** @deprecated Alias — use attachRacalvinWeapons. */
export function attachSword(
  root: THREE.Object3D,
  loader: GLTFLoader,
  isDisposed?: () => boolean,
) {
  attachRacalvinWeapons(root, loader, { isDisposed });
}

/** Brothers' Keeper + Corsair pistol on the right hand. */
export function attachRacalvinWeapons(
  root: THREE.Object3D,
  loader: GLTFLoader,
  opts?: RacalvinAttachOpts | (() => boolean),
): RacalvinWeapons | null {
  const options: RacalvinAttachOpts =
    typeof opts === "function" ? { isDisposed: opts } : (opts ?? {});
  const tuning = options.tuning ?? DEFAULT_RACALVIN_TUNING;
  const isDisposed = options.isDisposed;
  root.updateMatrixWorld(true);
  const hand = findRacalvinRightHand(root);
  if (!hand) {
    console.warn("[racalvin] RightHand bone not found — weapons cannot attach.");
    return null;
  }

  const comp = handCompensation(hand);
  const swordMount = new THREE.Group();
  swordMount.name = "RacalvinSwordMount";
  swordMount.scale.setScalar(comp);
  hand.add(swordMount);

  const pistolMount = new THREE.Group();
  pistolMount.name = "RacalvinPistolMount";
  pistolMount.scale.setScalar(comp);
  hand.add(pistolMount);

  const rig = new RacalvinWeapons(swordMount, pistolMount);
  root.userData[USERDATA_KEY] = rig;
  root.userData.racalvinHandBone = hand.name;
  ensureMountsOnHand(rig, hand);
  rig.applyMountTuning(tuning.weapons);
  applyHiddenMeshRules(root, tuning.hiddenMeshes);

  loader.load(swordUrl(), (gltf) => {
    if (isDisposed?.()) {
      disposeProp(gltf.scene);
      return;
    }
    steelMaterial(gltf.scene);
    ensureMountsOnHand(rig, hand);
    swordMount.clear();
    const swordTuning = tuning.weapons.swordHeld;
    swordMount.add(buildPropHolder(gltf.scene, weaponToProp(swordTuning)));
    swordMount.userData.bakedLength = swordTuning.targetLength;
    rig.applyMountTuning(tuning.weapons);
  });

  loader.load(pistolUrl(), (gltf) => {
    if (isDisposed?.()) {
      disposeProp(gltf.scene);
      return;
    }
    pistolMaterial(gltf.scene);
    ensureMountsOnHand(rig, hand);
    pistolMount.clear();
    pistolMount.add(buildPropHolder(gltf.scene, weaponToProp(tuning.weapons.pistol)));
    pistolMount.userData.bakedLength = tuning.weapons.pistol.targetLength;
    propToMount(pistolMount, tuning.weapons.pistol);
  });

  return rig;
}

export function loadRacalvinForDungeon(
  loader: GLTFLoader,
  targetHeight: number,
  onReady: (wrapper: THREE.Group, anim: PlayerAnimator, weapons: RacalvinWeapons | null) => void,
  onMiss: () => void,
) {
  loader.load(
    base(),
    (gltf) => {
      const model = gltf.scene;
      model.traverse((c) => {
        const m = c as THREE.Mesh;
        if (m.isMesh) {
          m.castShadow = true;
          m.receiveShadow = true;
          m.frustumCulled = false;
        }
      });
      const wrapper = fitWrapper(model, targetHeight);
      const weapons = attachRacalvinWeapons(model, loader, {
        tuning: getFighterAssetTuning(RACALVIN_ID),
      });
      loadRacalvinClips(loader).then((clips) => {
        const by = (n: string) => clips.find((c) => c.name === n);
        const anim = new PlayerAnimator(model, {
          idle: by("idle"),
          walk: by("walk") ?? by("run"),
          attack: by("attack") ?? by("combo"),
        }, clips);
        onReady(wrapper, anim, weapons);
      });
    },
    undefined,
    () => onMiss(),
  );
}

export function loadRacalvinBase(
  loader: GLTFLoader,
  targetHeight: number,
  onReady: (wrapper: THREE.Group, root: THREE.Object3D, baseClips: THREE.AnimationClip[], weapons: RacalvinWeapons | null) => void,
  onMiss: () => void,
) {
  loader.load(
    base(),
    (gltf) => {
      const model = gltf.scene;
      model.traverse((c) => {
        const m = c as THREE.Mesh;
        if (m.isMesh) {
          m.castShadow = true;
          m.receiveShadow = true;
          m.frustumCulled = false;
        }
      });
      const wrapper = fitWrapper(model, targetHeight);
      const weapons = attachRacalvinWeapons(model, loader, {
        tuning: getFighterAssetTuning(RACALVIN_ID),
      });
      onReady(wrapper, model, gltf.animations, weapons);
    },
    undefined,
    () => onMiss(),
  );
}