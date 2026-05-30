import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

/**
 * Neutral pirate NPCs from the KayKit Pirate Kit.
 *
 * Unlike the KayKit Skeleton minions (clip-less rigs that borrow the shared
 * animation library), the Pirate Kit characters are SELF-CONTAINED `.gltf`
 * files: embedded buffer + embedded textures + their OWN embedded animation
 * clips (Idle / Walk / Run / Sword / Punch / HitReact / Death / Wave ...).
 * Their rig uses Capitalised bone names (Hips, UpperArm.L, Root,
 * CharacterArmature) which do NOT match the lowercase KayKit anim-library rig —
 * but that is irrelevant because every character plays its OWN native clips
 * through a single `AnimationMixer`.
 *
 * Pirates are NEUTRAL: they live in their own array on the engine, never enter
 * the enemy combat pipeline, and their meshes carry NO `enemyId`, so the
 * click/hover raycast can never target or damage them.
 */

const PIRATE_BASE = `${import.meta.env.BASE_URL}models/pirates`;

export interface PirateDef {
  id: string;
  name: string;
  title: string;
  file: string; // under chars/
  height: number; // target world height in units
}

export const PIRATE_DEFS: PirateDef[] = [
  { id: "anne", name: "Anne Bonny", title: "Corsair Quartermaster", file: "Anne.gltf", height: 1.9 },
  { id: "barbarossa", name: "Capt. Barbarossa", title: "Dread Admiral", file: "Captain_Barbarossa.gltf", height: 2.05 },
  { id: "henry", name: "Henry Morgan", title: "Privateer", file: "Henry.gltf", height: 1.95 },
  { id: "sharky", name: "Sharky", title: "Master Gunner", file: "Sharky.gltf", height: 1.9 },
  { id: "mako", name: "Mako", title: "Bosun", file: "Mako.gltf", height: 1.95 },
];

export type PirateAction = "idle" | "walk" | "wave" | "attack" | "hit" | "death";

/** Embedded clip names per logical action (matched case-insensitively). */
const CLIP_NAMES: Record<PirateAction, string[]> = {
  idle: ["Idle"],
  walk: ["Walk", "Run"],
  wave: ["Wave"],
  attack: ["Sword", "Punch"],
  hit: ["HitReact"],
  death: ["Death"],
};

/**
 * Plays a pirate character's own embedded clips. idle/walk crossfade;
 * wave/attack/hit are one-shots that return to the held locomotion state;
 * death clamps on the final frame and latches (never returns).
 */
export class PirateAnimator {
  private mixer: THREE.AnimationMixer;
  private actions: Partial<Record<PirateAction, THREE.AnimationAction>> = {};
  private current: PirateAction = "idle";
  private oneShot = false;
  private dead = false;

  constructor(root: THREE.Object3D, clips: THREE.AnimationClip[]) {
    this.mixer = new THREE.AnimationMixer(root);
    (Object.keys(CLIP_NAMES) as PirateAction[]).forEach((act) => {
      let clip: THREE.AnimationClip | undefined;
      for (const n of CLIP_NAMES[act]) {
        clip = clips.find((c) => c.name.toLowerCase() === n.toLowerCase());
        if (clip) break;
      }
      if (clip) this.actions[act] = this.mixer.clipAction(clip);
    });

    const idle = this.actions.idle ?? this.actions.walk;
    if (idle) idle.reset().play();
    this.current = this.actions.idle ? "idle" : "walk";

    this.mixer.addEventListener("finished", () => {
      if (this.dead) return; // death is a terminal clamp
      this.oneShot = false;
      const cur = this.actions[this.current];
      cur?.reset().fadeIn(0.2).play();
    });
  }

  setMoving(moving: boolean) {
    if (this.oneShot || this.dead) return;
    const next: PirateAction = moving && this.actions.walk ? "walk" : "idle";
    if (next === this.current) return;
    this.actions[this.current]?.fadeOut(0.2);
    this.current = next;
    this.actions[next]?.reset().fadeIn(0.2).play();
  }

  private playOnce(act: PirateAction) {
    const a = this.actions[act];
    if (!a || this.oneShot || this.dead) return;
    this.oneShot = true;
    a.reset();
    a.setLoop(THREE.LoopOnce, 1);
    a.clampWhenFinished = false;
    a.fadeIn(0.1).play();
    this.actions[this.current]?.fadeOut(0.1);
  }

  wave() {
    this.playOnce("wave");
  }
  attack() {
    this.playOnce("attack");
  }
  hit() {
    this.playOnce("hit");
  }

  die() {
    const a = this.actions.death;
    if (!a || this.dead) return;
    this.dead = true;
    this.oneShot = true;
    Object.values(this.actions).forEach((x) => x?.fadeOut(0.15));
    a.reset();
    a.setLoop(THREE.LoopOnce, 1);
    a.clampWhenFinished = true;
    a.fadeIn(0.15).play();
  }

  update(delta: number) {
    this.mixer.update(delta);
  }

  dispose() {
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.mixer.getRoot() as THREE.Object3D);
  }
}

export interface PirateHandle {
  def: PirateDef;
  group: THREE.Group;
  animator: PirateAnimator | null;
  ready: boolean;
}

/** Deep-dispose geometry + materials + every texture under an object. */
export function disposeGltfObject(obj: THREE.Object3D) {
  obj.traverse((c) => {
    const m = c as THREE.Mesh;
    if (!m.isMesh) return;
    m.geometry?.dispose();
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    for (const mat of mats) {
      if (!mat) continue;
      for (const key of Object.keys(mat)) {
        const v = (mat as unknown as Record<string, unknown>)[key];
        if (v && (v as THREE.Texture).isTexture) (v as THREE.Texture).dispose();
      }
      mat.dispose();
    }
  });
}

/**
 * Returns an EMPTY group immediately (safe to add to the scene); the GLB
 * streams in async and the real model is injected on load. A
 * `group.userData.disposed` guard releases the late-arriving load if teardown
 * happened first (kill/teardown race safety).
 */
export function loadPirate(
  def: PirateDef,
  loader: GLTFLoader,
  onReady?: (h: PirateHandle) => void,
): PirateHandle {
  const group = new THREE.Group();
  const handle: PirateHandle = { def, group, animator: null, ready: false };
  const url = `${PIRATE_BASE}/chars/${def.file}`;

  loader.load(
    url,
    (gltf) => {
      if (group.userData.disposed) {
        disposeGltfObject(gltf.scene);
        return;
      }
      const model = gltf.scene;

      // Uniform scale to the target height, recenter XZ to origin, feet at y=0.
      const bbox = new THREE.Box3().setFromObject(model);
      const size = new THREE.Vector3();
      bbox.getSize(size);
      model.scale.setScalar(def.height / (size.y || 1));
      const b2 = new THREE.Box3().setFromObject(model);
      const center = new THREE.Vector3();
      b2.getCenter(center);
      model.position.set(-center.x, -b2.min.y, -center.z);

      model.traverse((c) => {
        const m = c as THREE.Mesh;
        if (m.isMesh) {
          m.castShadow = true;
          m.receiveShadow = true;
        }
        if ((c as THREE.SkinnedMesh).isSkinnedMesh) (c as THREE.Mesh).frustumCulled = false;
      });

      group.add(model);
      handle.animator = new PirateAnimator(model, gltf.animations);
      handle.ready = true;
      onReady?.(handle);
    },
    undefined,
    (err) => {
      // eslint-disable-next-line no-console
      console.warn(`[PirateNPC] failed to load ${def.id}:`, err);
    },
  );

  return handle;
}

export function disposePirate(handle: PirateHandle) {
  handle.group.userData.disposed = true;
  handle.animator?.dispose();
  disposeGltfObject(handle.group);
}
