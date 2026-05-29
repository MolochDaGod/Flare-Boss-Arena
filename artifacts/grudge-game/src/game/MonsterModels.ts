import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { EnemyModel, Archetype } from "./EnemyFactory";

/**
 * GLB monster registry.
 *
 * These are real imported models served from `public/models/monsters/`. Four
 * of them ship with a skeleton + a single skeletal clip (driven by an
 * AnimationMixer); two are static meshes (`big_scary_t2/t3`) that have no rig
 * baked in — those fall back to a procedural idle sway in EnemyFactory.
 *
 * `EnemyTemplate` (defined in GameEngine) is structurally matched here so the
 * existing spawn/combat pipeline treats a monster like any other enemy.
 */
export interface MonsterDef {
  id: string;
  name: string;
  type: string;       // logical type (affects palette/AI elsewhere)
  tier: number;
  hp: number;
  damage: number;
  /** File under public/models/monsters/. */
  file: string;
  /** Logical archetype — drives AI speed / attack range in GameEngine. */
  archetype: Archetype;
  /** Target in-game height in world units (model is uniformly scaled to fit). */
  height: number;
  /** Name of the skeletal clip to loop, or null for static (rig-less) GLBs. */
  clip: string | null;
}

export const MONSTER_DEFS: MonsterDef[] = [
  {
    id: "mon_pincher", name: "Chitin Pincher", type: "arachnid", tier: 2,
    hp: 190, damage: 14, file: "pincher.glb", archetype: "arachnid",
    height: 1.7, clip: "pincheranim",
  },
  {
    id: "mon_cultist", name: "Armed Cultist", type: "undead", tier: 2,
    hp: 220, damage: 16, file: "cultist_armed.glb", archetype: "humanoid",
    height: 2.0, clip: "idle",
  },
  {
    id: "mon_big_scary_t2", name: "Gloomhulk", type: "beast", tier: 3,
    hp: 360, damage: 22, file: "big_scary_t2.glb", archetype: "quadruped",
    height: 2.6, clip: null,
  },
  {
    id: "mon_dante_beast", name: "Dante's Beast", type: "beast", tier: 4,
    hp: 520, damage: 30, file: "dante_beast.glb", archetype: "quadruped",
    height: 2.8, clip: "dante2anim",
  },
  {
    id: "mon_medusa", name: "Medusa", type: "egyptian", tier: 4,
    hp: 500, damage: 28, file: "medusa.glb", archetype: "humanoid",
    height: 2.6, clip: "medusa2anim",
  },
  {
    id: "mon_big_scary_t3", name: "Dread Colossus", type: "titan", tier: 5,
    hp: 850, damage: 42, file: "big_scary_t3.glb", archetype: "golem",
    height: 4.2, clip: null,
  },
];

const MONSTER_BY_ID = new Map(MONSTER_DEFS.map((d) => [d.id, d]));

/** EnemyTemplate-shaped roster the GameEngine can merge into its spawn pool. */
export const MONSTER_TEMPLATES = MONSTER_DEFS.map((d) => ({
  id: d.id, name: d.name, type: d.type, tier: d.tier, hp: d.hp, damage: d.damage,
}));

export function isMonsterId(id: string): boolean {
  return MONSTER_BY_ID.has(id);
}

const MODELS_BASE = `${import.meta.env.BASE_URL}models/monsters`;

/** Dispose every texture referenced by a material. */
function disposeMaterialTextures(mat: THREE.Material) {
  const m = mat as unknown as Record<string, unknown>;
  for (const key of Object.keys(m)) {
    const val = m[key];
    if (val && (val as THREE.Texture).isTexture) (val as THREE.Texture).dispose();
  }
}

/**
 * Fully release a GLB-backed EnemyModel's GPU resources: stop + uncache the
 * mixer, then dispose geometries, materials, and their textures. Safe to call
 * whether or not the GLB has finished streaming in.
 */
export function disposeMonsterModel(model: EnemyModel) {
  if (model.mixer) {
    model.mixer.stopAllAction();
    model.mixer.uncacheRoot(model.mixer.getRoot());
    model.mixer = null;
  }
  model.group.traverse((c) => {
    const mesh = c as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    if (mesh.material) {
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) { disposeMaterialTextures(m); m.dispose(); }
    }
  });
}

/**
 * Build a GLB-backed EnemyModel. Returns immediately with an empty group that
 * is already safe to add to the scene; the GLB is fetched asynchronously and
 * its contents are injected (scaled, recentered, shadowed, mixer-driven) once
 * loaded. Best practices applied:
 *   • uniform scale to a consistent in-game height,
 *   • recenter XZ to the group origin and drop feet to y=0,
 *   • castShadow / receiveShadow on every mesh,
 *   • frustumCulled = false on skinned meshes (avoids them vanishing when the
 *     bounding box is computed in bind pose),
 *   • AnimationMixer playing the model's looped skeletal clip.
 */
export function loadMonsterModel(
  id: string,
  loader: GLTFLoader,
  onReady?: (model: EnemyModel) => void,
): EnemyModel {
  const def = MONSTER_BY_ID.get(id);
  if (!def) throw new Error(`Unknown monster id: ${id}`);

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
  };

  loader.load(
    `${MODELS_BASE}/${def.file}`,
    (gltf) => {
      // If the enemy was removed/disposed before the GLB finished streaming,
      // release the freshly-loaded resources immediately instead of attaching
      // them to a dead group (prevents a GPU memory leak under fast teardown).
      if (group.userData.disposed) {
        gltf.scene.traverse((c) => {
          const mesh = c as THREE.Mesh;
          if (mesh.geometry) mesh.geometry.dispose();
          if (mesh.material) {
            const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            for (const m of mats) { disposeMaterialTextures(m); m.dispose(); }
          }
        });
        return;
      }
      const inner = gltf.scene;

      // Measure pre-scale bbox to derive uniform scale + recenter offsets.
      const bbox = new THREE.Box3().setFromObject(inner);
      const size = new THREE.Vector3(); bbox.getSize(size);
      const center = new THREE.Vector3(); bbox.getCenter(center);

      const scale = def.height / (size.y || 1);
      inner.scale.setScalar(scale);
      // Recenter XZ to origin; drop feet (min Y) to y=0.
      inner.position.set(-center.x * scale, -bbox.min.y * scale, -center.z * scale);

      // Collect materials for the hurt-flash tint + enable shadows/culling.
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

      // Skeletal clip → AnimationMixer (rigged GLBs only).
      if (def.clip && gltf.animations.length > 0) {
        const clip =
          gltf.animations.find((a) => a.name === def.clip) ??
          gltf.animations.find((a) => /idle/i.test(a.name)) ??
          gltf.animations[0];
        if (clip) {
          const mixer = new THREE.AnimationMixer(inner);
          const action = mixer.clipAction(clip);
          action.setLoop(THREE.LoopRepeat, Infinity);
          action.play();
          model.mixer = mixer;
        }
      }

      onReady?.(model);
    },
    undefined,
    (err) => {
      // Non-fatal: the (empty) group stays in the scene; combat still works.
      // eslint-disable-next-line no-console
      console.warn(`[MonsterModels] failed to load ${def.file}:`, err);
    },
  );

  return model;
}
