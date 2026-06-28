/**
 * Racalvin — the bespoke Corsair King hero.
 *
 * Unlike the One Piece skins (a single self-contained GLB), Racalvin ships a
 * base skinned model plus a library of skeleton-only animation GLBs (built by
 * `scripts/build-racalvin-anims.ts`). Every clip rig shares identical bone names
 * with the base, so the clips replay directly on the base model (same trick as
 * the KayKit shared anim library — no retargeting). The "Brothers' Keeper" sword
 * is a static mesh parented to the right-hand bone.
 *
 * This module holds the asset paths + low-level loaders and a dungeon-side
 * `PlayerAnimator` builder. The Camp/Boss `HeroAnimator` wiring lives in
 * `kaykitHero.ts` (`loadRacalvinHero`) to keep this module free of a back-import.
 */
import * as THREE from "three";
import type { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { PlayerAnimator } from "./PlayerAnimator";

export const RACALVIN_DIR = "models/racalvin";

const base = () => `${import.meta.env.BASE_URL}${RACALVIN_DIR}/base.glb`;
const swordUrl = () => `${import.meta.env.BASE_URL}${RACALVIN_DIR}/sword.glb`;
const animUrl = (name: string) => `${import.meta.env.BASE_URL}${RACALVIN_DIR}/anim/${name}.glb`;

/** Logical clip names produced by the build script (see CLIPS there). */
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

export const RACALVIN_BASE_URL = base;

/** Load all Racalvin library clips (skeleton-only GLBs). Resolves with whatever
 *  loaded — a failed clip is skipped rather than rejecting the batch. */
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

/** Fit a model to `targetHeight`, feet at the wrapper origin, XZ-centred. */
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

// ─── Brothers' Keeper sword tuning ───────────────────────────────────────────
// The sword.glb is authored diagonally and centred on its *blade midpoint* (its
// pivot is NOT the grip), ships no UVs/textures, and carries an emissiveFactor of
// [1,1,1] that makes it render as flat white. These constants + `analyzeBlade`
// derive the real blade axis/length/grip from the geometry so the attach math is
// robust to the asset's odd authoring instead of assuming an axis-aligned pivot.
/** Target world-space length of the whole blade (hero is fit to ~1.9 tall). */
const SWORD_TARGET_LENGTH = 1.5;
/** Fraction up the weapon (pommel = 0, tip = 1) that sits in the palm. */
const SWORD_GRIP_FRACTION = 0.12;
/** Hand-local axis the blade runs along (RightHand local +Y = out the fingers). */
const SWORD_HAND_FORWARD = new THREE.Vector3(0, 1, 0);

/**
 * Derive the blade's principal axis (pointing toward the tip), its true length,
 * and a grip point — all in the sword model's own local space — from the mesh
 * vertices. Needed because the asset is centred on the blade midpoint and the
 * blade runs diagonally, so a bounding box underestimates the real length and
 * the origin sits mid-blade rather than at the grip.
 */
function analyzeBlade(sword: THREE.Object3D): {
  axis: THREE.Vector3;
  length: number;
  gripPoint: THREE.Vector3;
} {
  sword.updateMatrixWorld(true);
  const toLocal = new THREE.Matrix4().copy(sword.matrixWorld).invert();
  const pts: number[] = [];
  const v = new THREE.Vector3();
  sword.traverse((c) => {
    const m = c as THREE.Mesh & { isMesh?: boolean };
    if (!m.isMesh || !m.geometry) return;
    const pos = m.geometry.getAttribute("position") as THREE.BufferAttribute | undefined;
    if (!pos) return;
    const local = new THREE.Matrix4().multiplyMatrices(toLocal, m.matrixWorld);
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(local);
      pts.push(v.x, v.y, v.z);
    }
  });
  const n = pts.length / 3 || 1;
  let cx = 0, cy = 0, cz = 0;
  for (let i = 0; i < pts.length; i += 3) { cx += pts[i]; cy += pts[i + 1]; cz += pts[i + 2]; }
  cx /= n; cy /= n; cz /= n;
  // Covariance of the centred point cloud.
  let xx = 0, yy = 0, zz = 0, xy = 0, xz = 0, yz = 0;
  for (let i = 0; i < pts.length; i += 3) {
    const dx = pts[i] - cx, dy = pts[i + 1] - cy, dz = pts[i + 2] - cz;
    xx += dx * dx; yy += dy * dy; zz += dz * dz; xy += dx * dy; xz += dx * dz; yz += dy * dz;
  }
  xx /= n; yy /= n; zz /= n; xy /= n; xz /= n; yz /= n;
  // Dominant eigenvector (blade direction) via power iteration.
  let ax = 1, ay = 1, az = 1;
  for (let k = 0; k < 64; k++) {
    const nx = xx * ax + xy * ay + xz * az;
    const ny = xy * ax + yy * ay + yz * az;
    const nz = xz * ax + yz * ay + zz * az;
    const len = Math.hypot(nx, ny, nz) || 1;
    ax = nx / len; ay = ny / len; az = nz / len;
  }
  // Extent along the axis (relative to the centroid).
  let tMin = Infinity, tMax = -Infinity;
  for (let i = 0; i < pts.length; i += 3) {
    const t = (pts[i] - cx) * ax + (pts[i + 1] - cy) * ay + (pts[i + 2] - cz) * az;
    if (t < tMin) tMin = t;
    if (t > tMax) tMax = t;
  }
  const axis = new THREE.Vector3(ax, ay, az);
  // Point the axis toward the tip (the longer reach from the centroid).
  if (Math.abs(tMin) > Math.abs(tMax)) {
    axis.negate();
    const s = tMin; tMin = -tMax; tMax = -s;
  }
  const length = tMax - tMin;
  const gripT = tMin + length * SWORD_GRIP_FRACTION;
  const centroid = new THREE.Vector3(cx, cy, cz);
  const gripPoint = centroid.add(axis.clone().multiplyScalar(gripT));
  return { axis, length, gripPoint };
}

/** Parent the Brothers' Keeper sword to the right-hand bone, gripped by the
 *  handle, correctly sized, and with a lit steel material (the GLB ships no
 *  textures and a stray full-white emissive). */
export function attachSword(root: THREE.Object3D, loader: GLTFLoader) {
  let hand: THREE.Object3D | null = null;
  root.traverse((o) => {
    if (!hand && o.name === "RightHand") hand = o;
  });
  if (!hand) return;
  const handBone = hand as THREE.Object3D;
  loader.load(swordUrl(), (gltf) => {
    const sword = gltf.scene;
    sword.traverse((c) => {
      const m = c as THREE.Mesh & { isMesh?: boolean };
      if (!m.isMesh) return;
      m.castShadow = true;
      m.frustumCulled = false;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mat of mats) {
        const sm = mat as THREE.MeshStandardMaterial;
        if (!sm) continue;
        // Kill the flat full-white glow shipped in the GLB and give the
        // (texture-less) blade a lit steel look. Moderate metalness so it still
        // reads without a scene environment map.
        if (sm.emissive) sm.emissive.setRGB(0, 0, 0);
        sm.emissiveIntensity = 0;
        if (!sm.map) sm.color.setHex(0xc2c7d2);
        sm.metalness = 0.55;
        sm.roughness = 0.35;
        sm.needsUpdate = true;
      }
    });

    const { axis, length, gripPoint } = analyzeBlade(sword);

    // Compensate for the hand bone's world scale so the blade's world length is
    // SWORD_TARGET_LENGTH regardless of the rig/fit scale.
    handBone.updateWorldMatrix(true, false);
    const handScale = new THREE.Vector3();
    handBone.getWorldScale(handScale);
    const handCompensation = handScale.x > 1e-6 ? 1 / handScale.x : 1;
    const innerScale = length > 1e-6 ? SWORD_TARGET_LENGTH / length : 1;

    // inner: orient the blade onto the hand-forward axis + scale to size.
    const inner = new THREE.Group();
    inner.add(sword);
    const q = new THREE.Quaternion().setFromUnitVectors(
      axis.clone().normalize(),
      SWORD_HAND_FORWARD,
    );
    inner.quaternion.copy(q);
    inner.scale.setScalar(innerScale);
    // Seat the grip point at the mount origin (handle in the palm).
    const gripInInner = gripPoint.clone().multiplyScalar(innerScale).applyQuaternion(q);
    inner.position.copy(gripInInner).multiplyScalar(-1);

    const mount = new THREE.Group();
    mount.name = "RacalvinSwordMount";
    mount.add(inner);
    mount.scale.setScalar(handCompensation);
    handBone.add(mount);
  });
}

/** Build the dungeon player (PlayerAnimator) from the Racalvin base + library. */
export function loadRacalvinForDungeon(
  loader: GLTFLoader,
  targetHeight: number,
  onReady: (wrapper: THREE.Group, anim: PlayerAnimator) => void,
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
      attachSword(model, loader);
      loadRacalvinClips(loader).then((clips) => {
        const by = (n: string) => clips.find((c) => c.name === n);
        const anim = new PlayerAnimator(model, {
          idle: by("idle"),
          walk: by("walk") ?? by("run"),
          attack: by("attack") ?? by("combo"),
        }, clips);
        onReady(wrapper, anim);
      });
    },
    undefined,
    () => onMiss(),
  );
}

/** Load the Racalvin base model + library clips for the Camp/Boss `HeroAnimator`
 *  path. `kaykitHero.loadRacalvinHero` supplies the animator factory so this
 *  module needs no back-import. */
export function loadRacalvinBase(
  loader: GLTFLoader,
  targetHeight: number,
  onReady: (wrapper: THREE.Group, root: THREE.Object3D, baseClips: THREE.AnimationClip[]) => void,
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
      attachSword(model, loader);
      onReady(wrapper, model, gltf.animations);
    },
    undefined,
    () => onMiss(),
  );
}
