/**
 * Racalvin — the bespoke Corsair King hero.
 *
 * Brothers' Keeper: dual mind-swords. Rest on the back in an X when idle;
 * on attack they release, spin, strike, and return to the sheath pose.
 * Corsair pistol still mounts to RightHand for psychic/pistol skills.
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
/** Soft green trail for free-flying mind blades. */
export const RACALVIN_SWORD_TRAIL = 0x66ff99;

const base = () => `${import.meta.env.BASE_URL}${RACALVIN_DIR}/base.glb`;
/** Brothers' Keeper dual mind-swords (Meshy textured GLB). Prefer named file, fall back to sword.glb. */
const swordUrl = () => `${import.meta.env.BASE_URL}${RACALVIN_DIR}/brothers_keeper.glb`;
const swordUrlFallback = () => `${import.meta.env.BASE_URL}${RACALVIN_DIR}/sword.glb`;
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

/**
 * Sheathed = both blades on the back in an X.
 * Held = connected to hand bones (brief sync before release).
 * Flight states = mind-controlled free swords.
 */
export type RacalvinSwordPose = "held" | "rest";
export type BrothersFlight =
  | "sheathed"
  | "to_hands"
  | "held"
  | "releasing"
  | "orbiting"
  | "striking"
  | "returning";

export const RACALVIN_BASE_URL = base;

const SWORD_HELD_CLIP = /attack|combo|hammer|punch|cast|slash|chop|stab/i;

const USERDATA_KEY = "racalvinWeapons";

interface PropTuning {
  targetLength: number;
  position: THREE.Vector3;
  rotation: THREE.Euler;
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

/** Back-sheath local offsets (parent = spine/chest) — crossed X. */
const BACK_SHEATH_A = {
  position: new THREE.Vector3(0.12, 0.15, -0.22),
  rotation: new THREE.Euler(0.35, 0.15, 0.95),
};
const BACK_SHEATH_B = {
  position: new THREE.Vector3(-0.12, 0.15, -0.22),
  rotation: new THREE.Euler(0.35, -0.15, -0.95),
};

export class RacalvinWeapons {
  private mode: RacalvinWeaponMode = "sword";
  private swordPose: RacalvinSwordPose = "rest";
  private flight: BrothersFlight = "sheathed";
  private weapons: FighterAssetTuning["weapons"] | null = null;
  private phaseT = 0;
  private strikeTarget = new THREE.Vector3();
  private facing = 0;
  private spin = 0;
  /** Character model root (skinned) for world ↔ local. */
  private modelRoot: THREE.Object3D | null = null;
  private rightHand: THREE.Bone | null = null;
  private leftHand: THREE.Bone | null = null;
  private backBone: THREE.Object3D | null = null;
  private freeRoot: THREE.Group | null = null;
  private _tmp = new THREE.Vector3();
  private _tmpB = new THREE.Vector3();
  private _q = new THREE.Quaternion();
  private onStrikeHit: ((worldPos: THREE.Vector3) => void) | null = null;
  private hitFired = false;

  constructor(
    /** Primary (right) Brothers' Keeper mount */
    readonly swordMount: THREE.Object3D,
    /** Twin (left) Brothers' Keeper mount */
    readonly swordMountB: THREE.Object3D,
    readonly pistolMount: THREE.Object3D,
  ) {
    this.setMode("sword");
  }

  bindSkeleton(
    modelRoot: THREE.Object3D,
    rightHand: THREE.Bone,
    leftHand: THREE.Bone | null,
    backBone: THREE.Object3D | null,
  ) {
    this.modelRoot = modelRoot;
    this.rightHand = rightHand;
    this.leftHand = leftHand;
    this.backBone = backBone;
    // Free-flight container under model root (moves with character)
    if (!this.freeRoot) {
      this.freeRoot = new THREE.Group();
      this.freeRoot.name = "RacalvinMindSwords";
      modelRoot.add(this.freeRoot);
    }
    this.sheatheToBack(true);
  }

  setStrikeHitHandler(fn: ((worldPos: THREE.Vector3) => void) | null) {
    this.onStrikeHit = fn;
  }

  getMode(): RacalvinWeaponMode {
    return this.mode;
  }

  getSwordPose(): RacalvinSwordPose {
    return this.swordPose;
  }

  getFlight(): BrothersFlight {
    return this.flight;
  }

  setMode(mode: RacalvinWeaponMode) {
    this.mode = mode;
    const showSwords = mode === "sword";
    this.swordMount.visible = showSwords;
    this.swordMountB.visible = showSwords;
    this.pistolMount.visible = mode === "pistol";
    if (mode === "pistol") {
      // Holster blades on back while pistol is out
      this.sheatheToBack(true);
    }
  }

  setSwordPose(pose: RacalvinSwordPose) {
    this.swordPose = pose;
    if (this.mode !== "sword") return;
    // Idle/rest → back X; combat clips launch a strike if not already flying
    if (pose === "rest") {
      if (
        this.flight === "held" ||
        this.flight === "sheathed" ||
        this.flight === "to_hands"
      ) {
        this.sheatheToBack(false);
      }
    } else {
      // Combat clip — start release sequence if sheathed
      if (this.flight === "sheathed") {
        this.beginStrike(null);
      }
    }
  }

  /**
   * Mind-release strike. `target` is world XZ aim (enemy / cursor).
   * Swords leave the back, spin, slash the target, return to X sheath.
   */
  beginStrike(targetWorld: THREE.Vector3 | null, facingYaw = 0) {
    if (this.mode !== "sword") return;
    if (
      this.flight === "releasing" ||
      this.flight === "orbiting" ||
      this.flight === "striking" ||
      this.flight === "returning"
    ) {
      return; // already in air
    }
    this.facing = facingYaw;
    if (targetWorld) {
      this.strikeTarget.copy(targetWorld);
    } else if (this.modelRoot) {
      this.modelRoot.getWorldPosition(this._tmp);
      this.strikeTarget.set(
        this._tmp.x + Math.sin(facingYaw) * 4.5,
        this._tmp.y + 1.2,
        this._tmp.z + Math.cos(facingYaw) * 4.5,
      );
    }
    this.flight = "to_hands";
    this.phaseT = 0;
    this.hitFired = false;
    this.attachToHands();
  }

  private applySwordMount(tuning: FighterAssetTuning["weapons"]) {
    // Hand grips when held
    propToMount(this.swordMount, tuning.swordHeld);
    // Mirror for left twin
    const left: WeaponMountTuning = {
      targetLength: tuning.swordHeld.targetLength,
      position: [
        -Math.abs(tuning.swordHeld.position[0] || 0.04),
        tuning.swordHeld.position[1],
        tuning.swordHeld.position[2],
      ],
      rotation: [
        tuning.swordHeld.rotation[0],
        -tuning.swordHeld.rotation[1],
        tuning.swordHeld.rotation[2] + 180,
      ],
      gripYOffset: tuning.swordHeld.gripYOffset,
    };
    propToMount(this.swordMountB, left);
  }

  applyMountTuning(tuning: FighterAssetTuning["weapons"]) {
    this.weapons = tuning;
    if (this.flight === "held" || this.flight === "to_hands") {
      this.applySwordMount(tuning);
    }
    propToMount(this.pistolMount, tuning.pistol);
  }

  refreshAttachment() {
    if (!this.weapons) return;
    if (this.flight === "sheathed") {
      this.sheatheToBack(true);
    } else if (this.flight === "held" || this.flight === "to_hands") {
      this.attachToHands();
      this.applySwordMount(this.weapons);
    }
    propToMount(this.pistolMount, this.weapons.pistol);
  }

  private attachToHands() {
    if (!this.rightHand) return;
    this.rightHand.add(this.swordMount);
    if (this.leftHand) this.leftHand.add(this.swordMountB);
    else this.rightHand.add(this.swordMountB);
    if (this.weapons) this.applySwordMount(this.weapons);
  }

  private sheatheToBack(instant: boolean) {
    const parent = this.backBone ?? this.modelRoot;
    if (!parent) return;
    parent.add(this.swordMount);
    parent.add(this.swordMountB);
    this.swordMount.position.copy(BACK_SHEATH_A.position);
    this.swordMount.rotation.copy(BACK_SHEATH_A.rotation);
    this.swordMountB.position.copy(BACK_SHEATH_B.position);
    this.swordMountB.rotation.copy(BACK_SHEATH_B.rotation);
    this.flight = "sheathed";
    this.phaseT = 0;
    if (!instant) {
      /* snap is fine — return path already lerped in free flight */
    }
  }

  private toFreeFlight() {
    if (!this.freeRoot || !this.modelRoot) return;
    // Preserve world transforms while reparenting
    for (const m of [this.swordMount, this.swordMountB]) {
      m.updateWorldMatrix(true, true);
      this.modelRoot.updateWorldMatrix(true, true);
      const wp = new THREE.Vector3();
      const wq = new THREE.Quaternion();
      const ws = new THREE.Vector3();
      m.getWorldPosition(wp);
      m.getWorldQuaternion(wq);
      m.getWorldScale(ws);
      this.freeRoot.add(m);
      this.freeRoot.worldToLocal(wp);
      m.position.copy(wp);
      // Local rotation approx
      const inv = new THREE.Quaternion();
      this.freeRoot.getWorldQuaternion(inv);
      inv.invert();
      m.quaternion.copy(inv.multiply(wq));
    }
  }

  /**
   * Per-frame mind-sword simulation. Call from the game loop for Racalvin.
   */
  update(dt: number, facingYaw: number) {
    if (this.mode !== "sword") return;
    this.facing = facingYaw;
    this.spin += dt * 14;
    this.phaseT += dt;

    switch (this.flight) {
      case "sheathed":
        // subtle idle float on back
        this.swordMount.position.y = BACK_SHEATH_A.position.y + Math.sin(this.spin * 0.35) * 0.01;
        this.swordMountB.position.y = BACK_SHEATH_B.position.y + Math.sin(this.spin * 0.35 + 1) * 0.01;
        break;
      case "to_hands":
        // Brief hand connect then release
        if (this.phaseT > 0.12) {
          this.toFreeFlight();
          this.flight = "releasing";
          this.phaseT = 0;
        }
        break;
      case "releasing": {
        // Lift off hands / back into orbit ahead of character
        const t = Math.min(1, this.phaseT / 0.22);
        this.placeOrbitPair(0.6 + t * 0.8, 1.1 + t * 0.3, this.spin);
        if (t >= 1) {
          this.flight = "orbiting";
          this.phaseT = 0;
        }
        break;
      }
      case "orbiting": {
        // Spin pair in front then lunge
        this.placeOrbitPair(1.5, 1.35, this.spin * 1.4);
        // Green psychic spin cue via slight scale pulse
        const pulse = 1 + Math.sin(this.spin * 3) * 0.04;
        this.swordMount.scale.setScalar(pulse);
        this.swordMountB.scale.setScalar(pulse);
        if (this.phaseT > 0.28) {
          this.flight = "striking";
          this.phaseT = 0;
          this.hitFired = false;
        }
        break;
      }
      case "striking": {
        // Dash both blades toward strike target (world → freeRoot local)
        if (!this.freeRoot || !this.modelRoot) break;
        this.freeRoot.updateWorldMatrix(true, false);
        const localTarget = this.strikeTarget.clone();
        this.freeRoot.worldToLocal(localTarget);
        const t = Math.min(1, this.phaseT / 0.28);
        const ease = t * t * (3 - 2 * t);
        // Start from orbit positions
        const oA = this.orbitLocal(1.5, 1.35, this.spin, 0);
        const oB = this.orbitLocal(1.5, 1.35, this.spin, Math.PI);
        this.swordMount.position.lerpVectors(oA, localTarget, ease);
        this.swordMountB.position.lerpVectors(oB, localTarget.clone().add(new THREE.Vector3(0.25, 0.1, 0)), ease);
        this.swordMount.rotation.z = this.spin * 3;
        this.swordMountB.rotation.z = -this.spin * 3;
        if (t > 0.55 && !this.hitFired) {
          this.hitFired = true;
          this.onStrikeHit?.(this.strikeTarget.clone());
        }
        if (t >= 1) {
          this.flight = "returning";
          this.phaseT = 0;
        }
        break;
      }
      case "returning": {
        // Fly back to sheath slots
        if (!this.freeRoot || !this.backBone) {
          this.sheatheToBack(true);
          break;
        }
        const t = Math.min(1, this.phaseT / 0.35);
        const ease = t * t * (3 - 2 * t);
        // World sheath positions
        this.backBone.updateWorldMatrix(true, false);
        const sheathA = BACK_SHEATH_A.position.clone();
        const sheathB = BACK_SHEATH_B.position.clone();
        this.backBone.localToWorld(sheathA);
        this.backBone.localToWorld(sheathB);
        this.freeRoot.worldToLocal(sheathA);
        this.freeRoot.worldToLocal(sheathB);
        this.swordMount.position.lerp(sheathA, ease);
        this.swordMountB.position.lerp(sheathB, ease);
        this.swordMount.rotation.z = this.spin * (1 - t);
        this.swordMountB.rotation.z = -this.spin * (1 - t);
        if (t >= 1) {
          this.sheatheToBack(true);
        }
        break;
      }
      case "held":
        if (this.weapons) this.applySwordMount(this.weapons);
        break;
      default:
        break;
    }
  }

  private orbitLocal(radius: number, height: number, spin: number, phase: number): THREE.Vector3 {
    const ang = spin + phase;
    return new THREE.Vector3(
      Math.sin(this.facing + ang) * radius * 0.35 + Math.sin(this.facing) * radius * 0.65,
      height,
      Math.cos(this.facing + ang) * radius * 0.35 + Math.cos(this.facing) * radius * 0.65,
    );
  }

  private placeOrbitPair(radius: number, height: number, spin: number) {
    if (!this.freeRoot) return;
    // Ensure free-flight parenting
    if (this.swordMount.parent !== this.freeRoot) this.toFreeFlight();
    const a = this.orbitLocal(radius, height, spin, 0);
    const b = this.orbitLocal(radius, height, spin, Math.PI);
    this.swordMount.position.copy(a);
    this.swordMountB.position.copy(b);
    this.swordMount.rotation.set(1.2, this.facing, spin * 2);
    this.swordMountB.rotation.set(1.2, this.facing, -spin * 2);
  }
}

export function racalvinSwordPoseForClip(clipName: string): RacalvinSwordPose {
  return SWORD_HELD_CLIP.test(clipName.toLowerCase()) ? "held" : "rest";
}

/** Sheath / launch mind-swords from animation clip changes. */
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

/** Drive psychic sword flight from the game loop. */
export function updateRacalvinMindSwords(
  root: THREE.Object3D,
  dt: number,
  facingYaw: number,
) {
  getRacalvinWeapons(root)?.update(dt, facingYaw);
}

/** Trigger a mind-sword strike toward a world position. */
export function launchRacalvinMindStrike(
  root: THREE.Object3D,
  targetWorld: THREE.Vector3 | null,
  facingYaw: number,
) {
  getRacalvinWeapons(root)?.beginStrike(targetWorld, facingYaw);
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

export function findRacalvinLeftHand(root: THREE.Object3D): THREE.Bone | null {
  return findHandBone(root, false);
}

/** Prefer upper spine / chest for back sheath. */
export function findRacalvinBackBone(root: THREE.Object3D): THREE.Object3D | null {
  const preferred = [
    "mixamorigSpine2",
    "mixamorig:Spine2",
    "Spine2",
    "spine2",
    "mixamorigSpine1",
    "mixamorig:Spine1",
    "Spine1",
    "mixamorigSpine",
    "Spine",
    "Chest",
    "chest",
    "mixamorigChest",
  ];
  let found: THREE.Object3D | null = null;
  root.traverse((o) => {
    if (found) return;
    if ((o as THREE.Bone).isBone || o.type === "Bone") {
      if (preferred.some((n) => o.name === n || o.name.endsWith(n))) found = o;
    }
  });
  if (found) return found;
  // Fallback: hips / root of skeleton
  root.traverse((o) => {
    if (found) return;
    if ((o as THREE.Bone).isBone && /hips|pelvis|root/i.test(o.name)) found = o;
  });
  return found;
}

function ensureMountsOnHand(rig: RacalvinWeapons, hand: THREE.Bone) {
  // Pistol always on right hand; swords may be free-flying / on back
  if (rig.pistolMount.parent !== hand) {
    hand.add(rig.pistolMount);
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

function handCompensation(hand: THREE.Object3D, root: THREE.Object3D): number {
  hand.updateWorldMatrix(true, false);
  root.updateWorldMatrix(true, false);
  const handSc = new THREE.Vector3();
  const rootSc = new THREE.Vector3();
  hand.getWorldScale(handSc);
  root.getWorldScale(rootSc);
  // Counter only the root uniform scale so mounts stay in hand-local units.
  const rootUniform = rootSc.x > 1e-6 ? rootSc.x : 1;
  return 1 / rootUniform;
}

/** Re-parent weapon mounts after skeleton pose changes (idle freeze / clips). */
export function refreshRacalvinWeaponMounts(root: THREE.Object3D) {
  const rig = getRacalvinWeapons(root);
  const hand = findRacalvinRightHand(root);
  if (!rig || !hand) return;
  ensureMountsOnHand(rig, hand);
  root.updateMatrixWorld(true);
  rig.refreshAttachment();
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

/** Dual Brothers' Keeper + Corsair pistol. Swords default to back X sheath. */
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
  const leftHand = findRacalvinLeftHand(root);
  const back = findRacalvinBackBone(root);

  const comp = handCompensation(hand, root);
  const swordMount = new THREE.Group();
  swordMount.name = "RacalvinSwordMount_A";
  swordMount.scale.setScalar(comp);

  const swordMountB = new THREE.Group();
  swordMountB.name = "RacalvinSwordMount_B";
  swordMountB.scale.setScalar(comp);

  const pistolMount = new THREE.Group();
  pistolMount.name = "RacalvinPistolMount";
  pistolMount.scale.setScalar(comp);
  hand.add(pistolMount);

  const rig = new RacalvinWeapons(swordMount, swordMountB, pistolMount);
  root.userData[USERDATA_KEY] = rig;
  root.userData.racalvinHandBone = hand.name;
  rig.bindSkeleton(root, hand, leftHand, back);
  ensureMountsOnHand(rig, hand);
  rig.applyMountTuning(tuning.weapons);
  applyHiddenMeshRules(root, tuning.hiddenMeshes);

  // Primary + twin blades from Brothers' Keeper Meshy GLB (scaled to hand length).
  const mountBrothersBlade = (gltfScene: THREE.Object3D) => {
    if (isDisposed?.()) {
      disposeProp(gltfScene);
      return;
    }
    steelMaterial(gltfScene);
    // Psychic green edge glow on both twins
    gltfScene.traverse((c) => {
      const m = c as THREE.Mesh;
      if (!m.isMesh) return;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mat of mats) {
        const sm = mat as THREE.MeshStandardMaterial;
        if (sm?.emissive) {
          sm.emissive.setHex(RACALVIN_PSYCHIC_COLOR);
          sm.emissiveIntensity = 0.22;
        }
      }
    });
    const swordTuning = tuning.weapons.swordHeld;
    // Meshy exports are often huge — buildPropHolder normalizes to targetLength
    const holderA = buildPropHolder(gltfScene.clone(true), weaponToProp(swordTuning));
    const holderB = buildPropHolder(gltfScene.clone(true), weaponToProp(swordTuning));
    swordMount.clear();
    swordMountB.clear();
    swordMount.add(holderA);
    swordMountB.add(holderB);
    swordMount.userData.bakedLength = swordTuning.targetLength;
    swordMountB.userData.bakedLength = swordTuning.targetLength;
    rig.applyMountTuning(tuning.weapons);
    rig.refreshAttachment();
  };
  loader.load(
    swordUrl(),
    (gltf) => mountBrothersBlade(gltf.scene),
    undefined,
    () => {
      loader.load(swordUrlFallback(), (gltf) => mountBrothersBlade(gltf.scene));
    },
  );

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