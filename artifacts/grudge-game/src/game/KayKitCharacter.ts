import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { EnemyModel, Archetype, KitAnimator } from "./EnemyFactory";

/**
 * KayKit animated-character system.
 *
 * The KayKit character GLBs (Skeletons, Adventurers, Mannequin) ship with a
 * shared rig and ZERO embedded animation clips. The KayKit Character Animations
 * pack provides the clips as separate GLBs whose skeleton bone names match the
 * characters EXACTLY (hips, spine, chest, head, upperarm, hand, foot, ...). Because
 * an `AnimationClip` is just data bound by node name at play time, the library
 * clips can be played on ANY KayKit character through its own mixer — real
 * skeletal animation, not procedural sway.
 *
 * The animation library is fetched ONCE and the parsed clips are cached at
 * module scope, then reused across every KayKit enemy (one mixer per enemy).
 */

export interface KitEnemyDef {
  id: string;
  name: string;
  type: string;
  tier: number;
  hp: number;
  damage: number;
  /** File under public/models/kaykit/enemies/. */
  file: string;
  archetype: Archetype;
  height: number;
  /** Attack clip name from the shared library (varies by weapon style). */
  attackClip: string;
}

export const KIT_DEFS: KitEnemyDef[] = [
  {
    id: "kit_skel_minion", name: "Skeleton Minion", type: "undead", tier: 1,
    hp: 90, damage: 9, file: "Skeleton_Minion.glb", archetype: "humanoid",
    height: 1.7, attackClip: "Melee_Unarmed_Attack_Punch_A",
  },
  {
    id: "kit_skel_warrior", name: "Skeleton Warrior", type: "undead", tier: 2,
    hp: 180, damage: 16, file: "Skeleton_Warrior.glb", archetype: "humanoid",
    height: 1.85, attackClip: "Melee_1H_Attack_Chop",
  },
  {
    id: "kit_skel_rogue", name: "Skeleton Reaver", type: "undead", tier: 2,
    hp: 150, damage: 19, file: "Skeleton_Rogue.glb", archetype: "humanoid",
    height: 1.78, attackClip: "Melee_Dualwield_Attack_Slice",
  },
  {
    id: "kit_skel_mage", name: "Bone Conjurer", type: "undead", tier: 3,
    hp: 165, damage: 23, file: "Skeleton_Mage.glb", archetype: "humanoid",
    height: 1.78, attackClip: "Throw",
  },
];

const KIT_BY_ID = new Map(KIT_DEFS.map((d) => [d.id, d]));

/** EnemyTemplate-shaped roster the GameEngine can merge into its spawn pool. */
export const KIT_TEMPLATES = KIT_DEFS.map((d) => ({
  id: d.id, name: d.name, type: d.type, tier: d.tier, hp: d.hp, damage: d.damage,
}));

export function isKitMonsterId(id: string): boolean {
  return KIT_BY_ID.has(id);
}

const KIT_BASE = `${import.meta.env.BASE_URL}models/kaykit`;
const ANIM_FILES = ["anim/general.glb", "anim/movement.glb", "anim/combat.glb"];

/** Logical animation states → shared-library clip names. */
const CLIP = {
  idle: "Idle_A",
  walk: "Walking_C",
  hit: "Hit_A",
  death: "Death_A",
} as const;

// ─── Shared animation library cache ─────────────────────────────────────────
let animCache: Map<string, THREE.AnimationClip> | null = null;
let animPromise: Promise<Map<string, THREE.AnimationClip>> | null = null;

function loadAnimLibrary(loader: GLTFLoader): Promise<Map<string, THREE.AnimationClip>> {
  if (animCache) return Promise.resolve(animCache);
  if (animPromise) return animPromise;
  animPromise = (async () => {
    const map = new Map<string, THREE.AnimationClip>();
    await Promise.all(
      ANIM_FILES.map(
        (f) =>
          new Promise<void>((resolve) => {
            loader.load(
              `${KIT_BASE}/${f}`,
              (g) => {
                for (const clip of g.animations) if (!map.has(clip.name)) map.set(clip.name, clip);
                resolve();
              },
              undefined,
              () => resolve(), // non-fatal: missing clips just disable that state
            );
          }),
      ),
    );
    animCache = map;
    return map;
  })();
  return animPromise;
}

// ─── Per-character animator ─────────────────────────────────────────────────
class KayKitAnimatorImpl implements KitAnimator {
  private mixer: THREE.AnimationMixer;
  private actions: Record<string, THREE.AnimationAction | undefined>;
  private current?: THREE.AnimationAction;
  private oneShot?: THREE.AnimationAction;
  private wantMoving = false;
  private dead = false;
  private onFinished: (e: { action: THREE.AnimationAction }) => void;

  constructor(root: THREE.Object3D, clips: Map<string, THREE.AnimationClip>, attackClip: string) {
    this.mixer = new THREE.AnimationMixer(root);
    const mk = (name: string) => {
      const c = clips.get(name);
      return c ? this.mixer.clipAction(c) : undefined;
    };
    this.actions = {
      idle: mk(CLIP.idle),
      walk: mk(CLIP.walk),
      hit: mk(CLIP.hit),
      death: mk(CLIP.death),
      attack: mk(attackClip),
    };
    this.onFinished = (e) => {
      if (this.dead) return;
      if (this.oneShot && e.action === this.oneShot) {
        this.oneShot = undefined;
        this.crossfade(this.wantMoving ? this.actions.walk : this.actions.idle, 0.12);
      }
    };
    this.mixer.addEventListener("finished", this.onFinished as unknown as THREE.EventListener<object, "finished", THREE.AnimationMixer>);
    // Start idling immediately.
    if (this.actions.idle) {
      this.actions.idle.play();
      this.current = this.actions.idle;
    }
  }

  private crossfade(next: THREE.AnimationAction | undefined, fade = 0.2) {
    if (!next || next === this.current) return;
    next.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).play();
    if (this.current) this.current.crossFadeTo(next, fade, false);
    this.current = next;
  }

  private playOnce(action: THREE.AnimationAction | undefined) {
    if (this.dead || !action || this.oneShot) return;
    action.reset();
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = false;
    this.crossfade(action, 0.1);
    this.oneShot = action;
  }

  update(delta: number) {
    this.mixer.update(delta);
  }

  setMoving(moving: boolean) {
    this.wantMoving = moving;
    if (this.dead || this.oneShot) return;
    this.crossfade(moving ? this.actions.walk : this.actions.idle);
  }

  attack() {
    this.playOnce(this.actions.attack);
  }

  hit() {
    this.playOnce(this.actions.hit);
  }

  die() {
    if (this.dead) return;
    this.dead = true;
    this.oneShot = undefined;
    const a = this.actions.death;
    if (a) {
      a.reset();
      a.setLoop(THREE.LoopOnce, 1);
      a.clampWhenFinished = true;
      this.crossfade(a, 0.15);
    }
  }

  dispose() {
    this.mixer.removeEventListener("finished", this.onFinished as unknown as THREE.EventListener<object, "finished", THREE.AnimationMixer>);
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.mixer.getRoot());
  }
}

// ─── Resource disposal ──────────────────────────────────────────────────────
function disposeMaterialTextures(mat: THREE.Material) {
  const m = mat as unknown as Record<string, unknown>;
  for (const key of Object.keys(m)) {
    const val = m[key];
    if (val && (val as THREE.Texture).isTexture) (val as THREE.Texture).dispose();
  }
}

function disposeSceneResources(root: THREE.Object3D) {
  root.traverse((c) => {
    const mesh = c as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    if (mesh.material) {
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) { disposeMaterialTextures(m); m.dispose(); }
    }
  });
}

/** Fully release a KayKit EnemyModel: animator + geometry/material/textures. */
export function disposeKitModel(model: EnemyModel) {
  if (model.kit) { model.kit.dispose(); model.kit = null; }
  model.mixer = null;
  disposeSceneResources(model.group);
}

/**
 * Build a KayKit-backed EnemyModel. Returns immediately with an empty group
 * (safe to add to the scene); the character GLB + shared animation library are
 * fetched asynchronously and injected once ready. Same normalization rules as
 * the monster loader: uniform scale to a target height, recenter XZ, drop feet
 * to y=0, shadows on, frustumCulled=false on skinned meshes. A
 * `group.userData.disposed` guard releases late-arriving loads.
 */
export function loadKitMonster(
  id: string,
  loader: GLTFLoader,
  onReady?: (model: EnemyModel) => void,
): EnemyModel {
  const def = KIT_BY_ID.get(id);
  if (!def) throw new Error(`Unknown kit monster id: ${id}`);

  const group = new THREE.Group();
  group.userData.baseY = 0;
  group.userData.baseRotY = 0;

  const model: EnemyModel = {
    group,
    archetype: def.archetype,
    rig: {},
    baseY: 0,
    height: def.height,
    bodyMats: [],
    originalColors: [],
    isGLB: true,
    mixer: null,
    kit: null,
  };

  loader.load(
    `${KIT_BASE}/enemies/${def.file}`,
    (gltf) => {
      if (group.userData.disposed) {
        disposeSceneResources(gltf.scene);
        return;
      }
      const inner = gltf.scene;

      const bbox = new THREE.Box3().setFromObject(inner);
      const size = new THREE.Vector3(); bbox.getSize(size);
      const center = new THREE.Vector3(); bbox.getCenter(center);

      const scale = def.height / (size.y || 1);
      inner.scale.setScalar(scale);
      inner.position.set(-center.x * scale, -bbox.min.y * scale, -center.z * scale);

      inner.traverse((child) => {
        const mesh = child as THREE.Mesh & { isSkinnedMesh?: boolean };
        if (mesh.isMesh) {
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          if (mesh.isSkinnedMesh) mesh.frustumCulled = false;
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          for (const m of mats) {
            if (m && (m as THREE.MeshStandardMaterial).color) {
              const sm = m as THREE.MeshStandardMaterial;
              model.bodyMats.push(sm);
              model.originalColors.push(sm.color.getHex());
            }
          }
        }
      });

      group.add(inner);

      // Attach the shared-library animator once clips are available. No second
      // onReady here: the animator wraps the SAME meshes that are already
      // attached below, so the single re-tag after attach covers every mesh.
      loadAnimLibrary(loader).then((clips) => {
        if (group.userData.disposed) return;
        model.kit = new KayKitAnimatorImpl(inner, clips, def.attackClip);
      });

      // Fire once now that the real meshes are in the group so callers (e.g.
      // enemyId re-tagging) see the final mesh set.
      onReady?.(model);
    },
    undefined,
    (err) => {
      // eslint-disable-next-line no-console
      console.warn(`[KayKitCharacter] failed to load ${def.file}:`, err);
    },
  );

  return model;
}
