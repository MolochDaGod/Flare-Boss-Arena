import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  HeroAnimator,
  loadKayKitAnimLibrary,
  disposeObject3D,
  OBJECTSTORE,
} from "./kaykitHero";

/**
 * Ambient townsfolk / neutral NPCs built from the KayKit hero models
 * (Knight / Mage / Barbarian / Ranger / Rogue / Rogue_Hooded). These models are
 * used ONLY as scenery population — never as the player or as combatants.
 *
 * KayKit heroes ship a rig with ZERO embedded clips, so each townsperson is
 * driven by the shared KayKit animation library (idle / walk) through the same
 * `HeroAnimator` the scenes use. Townsfolk carry NO `enemyId`, so the click /
 * hover raycast can never target or damage them. Each wanders gently within a
 * radius of its home anchor, pausing between strolls.
 *
 * Loading mirrors the engine's late-load safety: the constructor adds an EMPTY
 * group immediately and streams the GLB in async; a `disposed` guard releases a
 * late-arriving load if teardown happened first.
 */

const HERO_BASE = `${import.meta.env.BASE_URL}models/kaykit/heroes`;

export const TOWNSFOLK_MODELS = [
  "Knight",
  "Mage",
  "Barbarian",
  "Ranger",
  "Rogue",
  "Rogue_Hooded",
] as const;

export interface TownsfolkOptions {
  /** Home/anchor position; the NPC wanders around this point. */
  home: THREE.Vector3;
  /** KayKit hero model name; random pick when omitted. */
  model?: string;
  /** Target world height in units (default 1.8). */
  height?: number;
  /** Wander radius around `home` (default 3). */
  wanderRadius?: number;
  /** Stroll speed in units/sec (default 1.1). */
  speed?: number;
}

export class Townsperson {
  readonly group = new THREE.Group();
  private animator: HeroAnimator | null = null;
  private disposed = false;

  private home: THREE.Vector3;
  private wanderRadius: number;
  private speed: number;
  private target: THREE.Vector3;
  private pauseT: number;

  constructor(loader: GLTFLoader, opts: TownsfolkOptions) {
    this.home = opts.home.clone();
    this.wanderRadius = opts.wanderRadius ?? 3;
    this.speed = opts.speed ?? 1.1;
    this.target = this.home.clone();
    this.pauseT = 0.5 + Math.random() * 2.5;
    this.group.position.copy(this.home);
    this.group.rotation.y = Math.random() * Math.PI * 2;

    const model =
      opts.model ?? TOWNSFOLK_MODELS[Math.floor(Math.random() * TOWNSFOLK_MODELS.length)];
    const height = opts.height ?? 1.8;
    const localUrl = `${HERO_BASE}/${model}.glb`;
    const remoteUrl = `${OBJECTSTORE}/models/characters/kaykit/${model}.glb`;

    const onLoaded = (gltf: { scene: THREE.Group; animations: THREE.AnimationClip[] }) => {
      if (this.disposed || this.group.userData.disposed) {
        disposeObject3D(gltf.scene);
        return;
      }
      const root = gltf.scene;
      const bbox = new THREE.Box3().setFromObject(root);
      const size = new THREE.Vector3();
      bbox.getSize(size);
      root.scale.setScalar(height / (size.y || 1));
      const b2 = new THREE.Box3().setFromObject(root);
      const center = new THREE.Vector3();
      b2.getCenter(center);
      root.position.set(-center.x, -b2.min.y, -center.z);
      root.traverse((c) => {
        const m = c as THREE.Mesh & { isSkinnedMesh?: boolean };
        if (m.isMesh) {
          m.castShadow = true;
          m.receiveShadow = true;
          if (m.isSkinnedMesh) m.frustumCulled = false;
        }
      });
      this.group.add(root);

      // Drive idle/walk from the shared KayKit clip library (no embedded clips).
      this.animator = new HeroAnimator(root, gltf.animations);
      loadKayKitAnimLibrary(loader).then((clips) => {
        if (this.disposed || !this.animator) return;
        this.animator.addLibraryClips(clips);
      });
    };

    loader.load(localUrl, onLoaded, undefined, () => {
      if (this.disposed) return;
      loader.load(remoteUrl, onLoaded, undefined, () => {});
    });
  }

  update(delta: number) {
    if (this.disposed) return;
    const pos = this.group.position;
    let moving = false;

    if (this.pauseT > 0) {
      this.pauseT -= delta;
    } else {
      const dx = this.target.x - pos.x;
      const dz = this.target.z - pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 0.2) {
        const inv = 1 / dist;
        pos.x += dx * inv * this.speed * delta;
        pos.z += dz * inv * this.speed * delta;
        this.group.rotation.y = Math.atan2(dx, dz);
        moving = true;
      } else {
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * this.wanderRadius;
        this.target.set(this.home.x + Math.cos(a) * r, this.home.y, this.home.z + Math.sin(a) * r);
        this.pauseT = 1.5 + Math.random() * 3.5;
      }
    }

    this.animator?.setMoving(moving);
    this.animator?.update(delta);
  }

  dispose() {
    this.disposed = true;
    this.group.userData.disposed = true;
    this.animator?.dispose();
    disposeObject3D(this.group);
  }
}

/** Spawn a batch of townsfolk at scattered anchors; returns the handles. */
export function buildTownsfolk(
  loader: GLTFLoader,
  scene: THREE.Scene,
  anchors: { x: number; z: number; model?: string }[],
  opts?: { height?: number; wanderRadius?: number },
): Townsperson[] {
  return anchors.map((a) => {
    const t = new Townsperson(loader, {
      home: new THREE.Vector3(a.x, 0, a.z),
      model: a.model,
      height: opts?.height,
      wanderRadius: opts?.wanderRadius,
    });
    scene.add(t.group);
    return t;
  });
}
