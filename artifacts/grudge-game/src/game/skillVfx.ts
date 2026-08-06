import * as THREE from "three";
import type { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { heroVfxTtl } from "./combat/combatVfx";
import type { CombatVfxKind } from "../data/vfxHotkeys";
import { loadGLTFCached } from "./assets";
import { createGltfLoader } from "./threeSetup";

/**
 * SkillVfx — spawns short-lived GLB VFX at world positions.
 * Catalog aligned with https://vfxgrudge.puter.site/ hotkeys +
 * D:\Games\Models\runs\dist\public\models\vfx (staged under public/models/vfx).
 *
 * Geometry is shared from templates; clones are removed after TTL.
 */

const BASE = import.meta.env.BASE_URL;

/** All combat VFX GLB URLs (hotkey sandbox + runs pack). */
const URLS: Record<CombatVfxKind, string> = {
  tornado: `${BASE}models/vfx/fire_tornado.glb`,
  cloud: `${BASE}models/vfx/cloud_ring.glb`,
  fireball: `${BASE}models/vfx/fireball.glb`,
  lightning: `${BASE}models/vfx/lightning.glb`,
  explosion: `${BASE}models/vfx/explosion.glb`,
  slash: `${BASE}models/vfx/attack-slashes.glb`,
  light_slash: `${BASE}models/vfx/light-of-slash.glb`,
  energy_beam: `${BASE}models/vfx/energy-beam.glb`,
  laser_beam: `${BASE}models/vfx/laser-beam.glb`,
  light_beam: `${BASE}models/vfx/light-beam.glb`,
  spell_glyph: `${BASE}models/vfx/spell-glyph.glb`,
  chaos_glyph: `${BASE}models/vfx/chaos-glyph.glb`,
  explosive_orb: `${BASE}models/vfx/explosive-orb.glb`,
  muzzle: `${BASE}models/vfx/muzzle.glb`,
  ring_red: `${BASE}models/vfx/ring-red.glb`,
  ring_green: `${BASE}models/vfx/ring-green.glb`,
  aoe_warning: `${BASE}models/vfx/aoe-warning.glb`,
  crystals: `${BASE}models/vfx/crystals.glb`,
  strawberry_strike: `${BASE}models/vfx/strawberry-strike.glb`,
  yellow_light: `${BASE}models/vfx/yellow-light.glb`,
  location: `${BASE}models/vfx/location.glb`,
};

export type VfxKind = CombatVfxKind;

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

  constructor(scene: THREE.Scene, loader?: GLTFLoader) {
    this.scene = scene;
    const active = loader ?? createGltfLoader();
    (Object.keys(URLS) as VfxKind[]).forEach((kind) => {
      // Shared promise cache — camp/boss/dungeon skills reuse one network parse.
      loadGLTFCached(active, URLS[kind]).then(
        (gltf) => {
          if (this.disposed) {
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
        () => {
          // missing VFX must never break gameplay — soft fail
        },
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

    inst.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(inst);
    const size = new THREE.Vector3();
    box.getSize(size);
    let baseScale: number;
    if (kind === "tornado" || kind === "light_beam" || kind === "laser_beam" || kind === "energy_beam") {
      const h = Math.max(size.y, 0.001);
      baseScale = (radius * 1.6) / h;
    } else if (kind === "slash" || kind === "light_slash" || kind === "strawberry_strike") {
      const span = Math.max(size.x, size.y, size.z, 0.001);
      baseScale = (radius * 1.4) / span;
    } else {
      const span = Math.max(size.x, size.z, 0.001);
      baseScale = (radius * 2) / span;
    }
    inst.scale.setScalar(baseScale * 0.55);
    inst.position.copy(pos);
    // Lift beams / columns slightly
    if (kind === "light_beam" || kind === "laser_beam" || kind === "tornado") {
      inst.position.y += radius * 0.2;
    }

    this.scene.add(inst);
    let mixer: THREE.AnimationMixer | null = null;
    const clips = this.clips[kind];
    if (clips && clips.length) {
      mixer = new THREE.AnimationMixer(inst);
      const action = mixer.clipAction(clips[0]!);
      action.reset().play();
    }

    this.active.push({
      group: inst,
      mixer,
      age: 0,
      ttl: life,
      baseScale,
    });
  }

  update(dt: number) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const a = this.active[i]!;
      a.age += dt;
      a.mixer?.update(dt);
      // Pop-in scale
      const t = Math.min(1, a.age / 0.12);
      a.group.scale.setScalar(a.baseScale * (0.55 + 0.45 * t));
      // Fade out near end
      if (a.age > a.ttl - 0.2) {
        const fade = Math.max(0, (a.ttl - a.age) / 0.2);
        a.group.traverse((c) => {
          const m = c as THREE.Mesh;
          if (m.isMesh && m.material) {
            const mats = Array.isArray(m.material) ? m.material : [m.material];
            for (const mat of mats) {
              const sm = mat as THREE.MeshStandardMaterial;
              if (sm.transparent !== undefined) {
                sm.transparent = true;
                sm.opacity = fade;
              }
            }
          }
        });
      }
      if (a.age >= a.ttl) {
        this.scene.remove(a.group);
        a.mixer?.stopAllAction();
        this.active.splice(i, 1);
      }
    }
  }

  dispose() {
    this.disposed = true;
    for (const a of this.active) {
      this.scene.remove(a.group);
      a.mixer?.stopAllAction();
    }
    this.active = [];
    this.pending = [];
    for (const kind of Object.keys(this.templates) as VfxKind[]) {
      const t = this.templates[kind];
      if (t) disposeVfxRoot(t);
    }
    this.templates = {};
    this.clips = {};
  }
}
