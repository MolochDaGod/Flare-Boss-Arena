import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import type { GLTF, GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import { createGltfLoader } from "@/game/threeSetup";

const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");

const fbxLoader = new FBXLoader();
const fbxCache = new Map<string, Promise<THREE.Group>>();
/** Shared GLB/GLTF promise cache — one network parse per URL per session. */
const gltfCache = new Map<string, Promise<GLTF>>();

export function loadFBX(path: string): Promise<THREE.Group> {
  const url = `${BASE}${path.startsWith("/") ? path : "/" + path}`;
  let p = fbxCache.get(url);
  if (!p) {
    p = new Promise<THREE.Group>((resolve, reject) => {
      fbxLoader.load(url, (obj) => resolve(obj), undefined, (err) => reject(err));
    });
    fbxCache.set(url, p);
  }
  return p.then((g) => cloneSkinned(g));
}

/**
 * Load a GLTF once and reuse the parsed result. Callers must clone `gltf.scene`
 * via {@link cloneGltfScene} (or re-bind skins) before mutating — the cached root is shared.
 *
 * When `loader` is omitted, uses the production shared GLTFLoader (Draco/Meshopt/SpecGloss).
 */
export function loadGLTFCached(loader: GLTFLoader | undefined, url: string): Promise<GLTF> {
  const active = loader ?? createGltfLoader();
  let p = gltfCache.get(url);
  if (!p) {
    p = new Promise<GLTF>((resolve, reject) => {
      active.load(url, resolve, undefined, reject);
    }).catch((err) => {
      gltfCache.delete(url);
      throw err;
    });
    gltfCache.set(url, p);
  }
  return p;
}

/** Drop a failed entry so a later retry can re-fetch (e.g. after CDN blip). */
export function invalidateGLTFCache(url: string) {
  gltfCache.delete(url);
}

/**
 * Clone a glTF scene graph correctly for skinned characters.
 * Prefer SkeletonUtils over Object3D.clone for any SkinnedMesh hierarchy.
 */
export function cloneGltfScene(src: THREE.Object3D): THREE.Object3D {
  return SkeletonUtils.clone(src);
}

function cloneSkinned(src: THREE.Group): THREE.Group {
  try {
    return SkeletonUtils.clone(src) as THREE.Group;
  } catch {
    const clone = src.clone(true) as THREE.Group;
    const boneMap = new Map<string, THREE.Bone>();
    clone.traverse((o) => {
      if ((o as THREE.Bone).isBone) boneMap.set(o.name, o as THREE.Bone);
    });
    clone.traverse((o) => {
      const sk = o as THREE.SkinnedMesh;
      if (sk.isSkinnedMesh) {
        const newBones = sk.skeleton.bones.map((b) => boneMap.get(b.name) ?? b);
        sk.skeleton = new THREE.Skeleton(newBones, sk.skeleton.boneInverses);
      }
    });
    return clone;
  }
}

const RIGHT_HAND_EXACT = [
  "RightHand",
  "mixamorigRightHand",
  "mixamorig:RightHand",
  "Bip001_R_Hand",
  "Bip001 R Hand",
];
const LEFT_HAND_EXACT = [
  "LeftHand",
  "mixamorigLeftHand",
  "mixamorig:LeftHand",
  "Bip001_L_Hand",
  "Bip001 L Hand",
];

const HAND_NAME_PATTERNS = [
  /^hand[_.]?r/i, /right[_.]?hand/i, /[_\s]R[_\s]Hand$/i, /\.R$/, /_R$/,
  /weapon[_.]?r/i, /grip[_.]?r/i, /palm[_.]?r/i,
  /^hand[_.]?l/i, /left[_.]?hand/i, /[_\s]L[_\s]Hand$/i, /\.L$/, /_L$/,
];

function pickHandBone(bones: THREE.Bone[], preferRight: boolean): THREE.Bone | null {
  const exact = preferRight ? RIGHT_HAND_EXACT : LEFT_HAND_EXACT;
  for (const name of exact) {
    const b = bones.find((bn) => bn.name === name);
    if (b) return b;
  }

  const rightPatterns = HAND_NAME_PATTERNS.slice(0, 7);
  const leftPatterns = HAND_NAME_PATTERNS.slice(7);
  const primary = preferRight ? rightPatterns : leftPatterns;
  const secondary = preferRight ? leftPatterns : rightPatterns;

  for (const re of primary) {
    const b = bones.find((bn) => re.test(bn.name));
    if (b) return b;
  }
  for (const re of secondary) {
    const b = bones.find((bn) => re.test(bn.name));
    if (b) return b;
  }
  const side = preferRight ? /(^|[_\s])r[_\s]?hand|right.*hand/i : /(^|[_\s])l[_\s]?hand|left.*hand/i;
  return bones.find((b) => side.test(b.name)) ?? null;
}

/** Prefer skinned-mesh skeleton joints (animated) over stray scene nodes. */
export function findHandBone(root: THREE.Object3D, preferRight = true): THREE.Bone | null {
  const skeletonBones: THREE.Bone[] = [];
  root.traverse((o) => {
    const sk = o as THREE.SkinnedMesh;
    if (!sk.isSkinnedMesh || !sk.skeleton) return;
    for (const b of sk.skeleton.bones) {
      if (!skeletonBones.includes(b)) skeletonBones.push(b);
    }
  });
  const fromSkeleton = pickHandBone(skeletonBones, preferRight);
  if (fromSkeleton) return fromSkeleton;

  const sceneBones: THREE.Bone[] = [];
  root.traverse((o) => {
    if ((o as THREE.Bone).isBone) sceneBones.push(o as THREE.Bone);
  });
  return pickHandBone(sceneBones, preferRight);
}

/** Reset every skinned skeleton under `root` to its bind pose (T-pose / A-pose). */
export function resetSkinnedToBindPose(root: THREE.Object3D) {
  const skeletons = new Set<THREE.Skeleton>();
  root.traverse((o) => {
    const sk = o as THREE.SkinnedMesh;
    if (sk.isSkinnedMesh && sk.skeleton) skeletons.add(sk.skeleton);
  });
  for (const skeleton of skeletons) {
    const { bones, boneInverses } = skeleton;
    for (let i = 0; i < bones.length; i++) {
      const inv = boneInverses[i];
      if (!inv) continue;
      const bind = inv.clone().invert();
      bind.decompose(bones[i].position, bones[i].quaternion, bones[i].scale);
    }
    skeleton.update();
  }
  root.updateMatrixWorld(true);
}

/**
 * Hold the first frame of `clip` on `mixer` — reliable for weapon placement on
 * Mixamo rigs (bind-pose matrix inversion often collapses the mesh).
 */
export function sampleClipPose(
  root: THREE.Object3D,
  mixer: THREE.AnimationMixer,
  clip: THREE.AnimationClip,
): THREE.AnimationAction {
  mixer.stopAllAction();
  const action = mixer.clipAction(clip);
  action.reset();
  action.setLoop(THREE.LoopOnce, 1);
  action.clampWhenFinished = true;
  action.setEffectiveWeight(1);
  action.play();
  action.time = 0;
  mixer.update(0);
  root.updateMatrixWorld(true);
  return action;
}

export function attachWeaponToBone(
  weaponRoot: THREE.Object3D,
  bone: THREE.Bone,
  opts: { scale?: number; offset?: THREE.Vector3; rotation?: THREE.Euler } = {},
): THREE.Object3D {
  const wrap = new THREE.Group();
  wrap.name = "WeaponMount";
  const s = opts.scale ?? 1;
  weaponRoot.scale.setScalar(s);
  if (opts.offset) weaponRoot.position.copy(opts.offset);
  if (opts.rotation) weaponRoot.rotation.copy(opts.rotation);
  wrap.add(weaponRoot);
  bone.add(wrap);
  return wrap;
}

/** Centre+scale-normalise an FBX group so its tallest dimension == targetHeight */
export function normaliseHeight(g: THREE.Object3D, targetHeight: number) {
  g.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(g);
  const size = new THREE.Vector3();
  box.getSize(size);
  const h = Math.max(size.y, 0.001);
  g.scale.multiplyScalar(targetHeight / h);
  // Re-box after scaling — feet to y=0 and XZ center on origin.
  g.updateWorldMatrix(true, true);
  const box2 = new THREE.Box3().setFromObject(g);
  const center = new THREE.Vector3();
  box2.getCenter(center);
  g.position.x -= center.x;
  g.position.z -= center.z;
  g.position.y -= box2.min.y;
}

export const TOON_CHAR_PATHS: Record<string, string> = {
  warrior: "/toon/WK/models/character.fbx",
  mage:    "/toon/ELF/models/character.fbx",
  ranger:  "/toon/ELF/models/character.fbx",
  worge:   "/toon/BRB/models/character.fbx",
  undead:  "/toon/UD/models/character.fbx",
};

/** weapon type id (SWORD, STAFF, HAMMER, …) -> FBX path */
export const TOON_WEAPON_PATHS: Record<string, string> = {
  SWORD:      "/toon/WK/equipment/sword.fbx",
  GREATSWORD: "/toon/BRB/equipment/sword.fbx",
  HAMMER:     "/toon/BRB/equipment/hammer.fbx",
  GREATAXE:   "/toon/BRB/equipment/hammer.fbx",
  AXE:        "/toon/BRB/equipment/hammer.fbx",
  STAFF:      "/toon/WK/equipment/staff.fbx",
  WAND:       "/toon/WK/equipment/staff.fbx",
  TOME:       "/toon/WK/equipment/staff.fbx",
  MACE:       "/toon/BRB/equipment/hammer.fbx",
  SPEAR:      "/toon/ELF/equipment/spear.fbx",
  SCYTHE:     "/toon/ELF/equipment/staff.fbx",
  BOW:        "/toon/ELF/equipment/spear.fbx",
  CROSSBOW:   "/toon/ELF/equipment/spear.fbx",
  GUN:        "/toon/WK/equipment/sword.fbx",
  DAGGER:     "/toon/WK/equipment/sword.fbx",
  SHIELD:     "/toon/WK/equipment/sword.fbx",
  OFFHAND_RELIC: "/toon/WK/equipment/staff.fbx",
};
