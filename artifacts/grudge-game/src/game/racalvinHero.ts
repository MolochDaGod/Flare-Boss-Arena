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

export const RACALVIN_BASE_URL = base;

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

/**
 * Greatsword rest pose — blade hangs straight down along the right thigh
 * (matches roster back-view reference). Mesh long axis is ~Z; rotate to -Y.
 */
const SWORD_TUNING: PropTuning = {
  targetLength: 1.36,
  position: new THREE.Vector3(0.04, 0.04, -0.02),
  rotation: new THREE.Euler(Math.PI / 2, 0.06, Math.PI / 2),
  gripYOffset: 0.03,
};

const PISTOL_TUNING: PropTuning = {
  targetLength: 0.3,
  position: new THREE.Vector3(0.04, 0.07, -0.02),
  rotation: new THREE.Euler(-Math.PI / 2, Math.PI, 0.12),
  gripYOffset: 0,
};

export class RacalvinWeapons {
  private mode: RacalvinWeaponMode = "sword";

  constructor(
    readonly swordMount: THREE.Object3D,
    readonly pistolMount: THREE.Object3D,
  ) {
    this.setMode("sword");
  }

  getMode(): RacalvinWeaponMode {
    return this.mode;
  }

  setMode(mode: RacalvinWeaponMode) {
    this.mode = mode;
    this.swordMount.visible = mode === "sword";
    this.pistolMount.visible = mode === "pistol";
  }
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

function findRightHand(root: THREE.Object3D): THREE.Object3D | null {
  let hand: THREE.Object3D | null = null;
  root.traverse((o) => {
    if (hand) return;
    const n = o.name;
    if (n === "RightHand" || n === "mixamorigRightHand" || n.endsWith("RightHand")) hand = o;
  });
  return hand;
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
  prop.position.y -= box2.min.y + (tuning.gripYOffset ?? 0);

  const holder = new THREE.Group();
  holder.add(prop);
  holder.position.copy(tuning.position);
  holder.rotation.copy(tuning.rotation);
  return holder;
}

function handCompensation(hand: THREE.Object3D): number {
  hand.updateWorldMatrix(true, false);
  const sc = new THREE.Vector3();
  hand.getWorldScale(sc);
  return sc.x > 1e-6 ? 1 / sc.x : 1;
}

/** @deprecated Alias — use attachRacalvinWeapons. */
export function attachSword(
  root: THREE.Object3D,
  loader: GLTFLoader,
  isDisposed?: () => boolean,
) {
  attachRacalvinWeapons(root, loader, isDisposed);
}

/** Brothers' Keeper + Corsair pistol on the right hand. */
export function attachRacalvinWeapons(
  root: THREE.Object3D,
  loader: GLTFLoader,
  isDisposed?: () => boolean,
): RacalvinWeapons | null {
  const hand = findRightHand(root);
  if (!hand) return null;

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

  loader.load(swordUrl(), (gltf) => {
    if (isDisposed?.()) {
      disposeProp(gltf.scene);
      return;
    }
    steelMaterial(gltf.scene);
    swordMount.clear();
    swordMount.add(buildPropHolder(gltf.scene, SWORD_TUNING));
  });

  loader.load(pistolUrl(), (gltf) => {
    if (isDisposed?.()) {
      disposeProp(gltf.scene);
      return;
    }
    pistolMaterial(gltf.scene);
    pistolMount.clear();
    pistolMount.add(buildPropHolder(gltf.scene, PISTOL_TUNING));
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
      const weapons = attachRacalvinWeapons(model, loader);
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
      const weapons = attachRacalvinWeapons(model, loader);
      onReady(wrapper, model, gltf.animations, weapons);
    },
    undefined,
    () => onMiss(),
  );
}