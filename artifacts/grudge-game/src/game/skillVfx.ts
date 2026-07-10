import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { heroVfxTtl } from "./combat/combatVfx";

/**
 * SkillVfx — spawns short-lived GLB visual effects (fire tornado, cloud ring)
 * at a world position when a skill fires. Both source GLBs are skinless with a
 * single transform clip, so plain `.clone(true)` + a per-instance
 * `AnimationMixer` reproduce the motion (clip tracks bind by node name).
 *
 * Geometry/materials are SHARED between the template and its clones, so clones
 * are torn down by simply removing them from the scene — only the templates
 * dispose their GPU resources (in `dispose()`).
 */

const BASE = import.meta.env.BASE_URL;
const URLS = {
  tornado: `${BASE}models/vfx/fire_tornado.glb`,
  cloud: `${BASE}models/vfx/cloud_ring.glb`,
} as const;

export type VfxKind = keyof typeof URLS;

/** Dispose every GPU resource (geometry, materials, and their textures) under a root. */
function disposeVfxRoot(root: THREE.Object3D) {
  root.traverse((c) => {
    const m = c as THREE.Mesh;
    if (!m.isMesh) return;
    m.geometry?.dispose();
    const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
    for (const mat of mats) {
      for (const key of Object.keys(mat) as (keyof typeof mat)[]) {
        const val = mat[key] as unknown;
        if (val && (val as THREE.Texture).isTexture) (val as THREE.Texture).dispose();
      }
      mat.dispose();
    }
  });
}

interface ActiveVfx {
  group: THREE.Object3D;
  mixer: THREE.AnimationMixer | null;
  age: number;
  ttl: number;
  baseScale: number;
}

interface PendingSpawn {
  kind: VfxKind;
  pos: THREE.Vector3;
  radius: number;
  ttl: number;
}

export class SkillVfx {
  private scene: THREE.Scene;
  private templates: Partial<Record<VfxKind, THREE.Object3D>> = {};
  private clips: Partial<Record<VfxKind, THREE.AnimationClip[]>> = {};
  private active: ActiveVfx[] = [];
  private pending: PendingSpawn[] = [];
  private disposed = false;

  constructor(scene: THREE.Scene, loader: GLTFLoader) {
    this.scene = scene;
    (Object.keys(URLS) as VfxKind[]).forEach((kind) => {
      loader.load(
        URLS[kind],
        (gltf) => {
          if (this.disposed) {
            disposeVfxRoot(gltf.scene);
            return;
          }
          gltf.scene.traverse((c) => {
            const m = c as THREE.Mesh;
            if (m.isMesh) m.frustumCulled = false;
          });
          this.templates[kind] = gltf.scene;
          this.clips[kind] = gltf.animations;
          this.flushPending(kind);
        },
        undefined,
        () => {}, // missing VFX must never break gameplay
      );
    });
  }

  private flushPending(kind: VfxKind) {
    const ready = this.pending.filter((p) => p.kind === kind);
    this.pending = this.pending.filter((p) => p.kind !== kind);
    for (const p of ready) this.spawn(p.kind, p.pos, p.radius, p.ttl);
  }

  /** Spawn a VFX at `pos`. `radius` sizes the effect; `ttl` seconds to live. */
  spawn(kind: VfxKind, pos: THREE.Vector3, radius = 3, ttl?: number) {
    const life = ttl ?? heroVfxTtl();
    const tpl = this.templates[kind];
    if (!tpl) {
      if (!this.disposed) this.pending.push({ kind, pos: pos.clone(), radius, ttl: life });
      return;
    }
    if (this.disposed) return;
    const inst = tpl.clone(true);

    // Fit: tornado scales to a column height ~ 1.6x radius; cloud ring to a flat
    // disc of the given radius.
    inst.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(inst);
    const size = new THREE.Vector3();
    box.getSize(size);
    let baseScale: number;
    if (kind === "tornado") {
      const h = Math.max(size.y, 0.001);
      baseScale = (radius * 1.6) / h;
    } else {
      const span = Math.max(size.x, size.z, 0.001);
      baseScale = (radius * 2) / span;
    }
    inst.scale.setScalar(baseScale * 0.6); // start small for the pop-in
    inst.position.copy(pos);
    inst.position.y = 0.05;
    inst.rotation.y = Math.random() * Math.PI * 2;
    this.scene.add(inst);

    let mixer: THREE.AnimationMixer | null = null;
    const clips = this.clips[kind];
    if (clips && clips.length) {
      mixer = new THREE.AnimationMixer(inst);
      const action = mixer.clipAction(clips[0]);
      action.play();
    }
    this.active.push({ group: inst, mixer, age: 0, ttl: life, baseScale });
  }

  update(delta: number) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const v = this.active[i];
      v.mixer?.update(delta);
      v.age += delta;
      // Scale pop-in over the first 120ms (0.6x → 1x).
      const pop = v.age < 0.12 ? 0.6 + 0.4 * (v.age / 0.12) : 1;
      v.group.scale.setScalar(v.baseScale * pop);
      if (v.age >= v.ttl) {
        this.removeInstance(v);
        this.active.splice(i, 1);
      }
    }
  }

  private removeInstance(v: ActiveVfx) {
    if (v.mixer) {
      v.mixer.stopAllAction();
      v.mixer.uncacheRoot(v.group as THREE.Object3D);
    }
    this.scene.remove(v.group);
  }

  dispose() {
    this.disposed = true;
    for (const v of this.active) this.removeInstance(v);
    this.active = [];
    for (const tpl of Object.values(this.templates)) {
      if (tpl) disposeVfxRoot(tpl);
    }
    this.templates = {};
    this.clips = {};
    this.pending = [];
  }
}
