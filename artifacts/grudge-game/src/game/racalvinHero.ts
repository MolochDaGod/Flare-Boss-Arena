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

/** Parent the Brothers' Keeper sword to the right-hand bone. */
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
      const m = c as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.frustumCulled = false;
      }
    });
    // Scale the blade so its longest dimension reads as a sizeable greatblade
    // relative to the hand-bone's world scale.
    const box = new THREE.Box3().setFromObject(sword);
    const size = new THREE.Vector3();
    box.getSize(size);
    const longest = Math.max(size.x, size.y, size.z) || 1;
    const worldScale = new THREE.Vector3();
    handBone.getWorldScale(worldScale);
    const local = worldScale.x > 0.0001 ? 1 / worldScale.x : 1;
    sword.scale.setScalar((1.6 / longest) * local);
    // Orient the blade to run forward out of the fist and sit in the palm.
    sword.rotation.set(Math.PI / 2, 0, 0);
    sword.position.set(0, 0.02 * local, 0);
    handBone.add(sword);
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
