import * as THREE from "three";
import type { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { WORLD_PROP_BY_ID, type WorldPropDef } from "../data/worldProps";
import { loadGLTFCached } from "./assets";

export interface LoadedWorldProp {
  holder: THREE.Group;
  mixer: THREE.AnimationMixer | null;
  def: WorldPropDef;
}

const MODELS_BASE = import.meta.env.BASE_URL + "models";

function applyShadows(root: THREE.Object3D) {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      if ((mesh as THREE.SkinnedMesh).isSkinnedMesh) mesh.frustumCulled = false;
    }
  });
}

function normalizeRoot(root: THREE.Object3D, def: WorldPropDef) {
  const bbox = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  bbox.getSize(size);
  bbox.getCenter(center);

  const denom =
    def.scaleMode === "height"
      ? size.y || 1
      : Math.max(size.x, size.z) || 1;
  const scale = def.scaleTarget / denom;
  root.scale.setScalar(scale);

  const b2 = new THREE.Box3().setFromObject(root);
  const c2 = new THREE.Vector3();
  b2.getCenter(c2);
  root.position.set(-c2.x, -b2.min.y, -c2.z);
}

function pickClip(clips: THREE.AnimationClip[], preferred: string | null | undefined) {
  if (!clips.length) return null;
  if (preferred) {
    const hit = clips.find((c) => c.name === preferred || c.name.toLowerCase().includes(preferred.toLowerCase()));
    if (hit) return hit;
  }
  return clips[0] ?? null;
}

/**
 * Load a catalogued world prop. Returns a holder group immediately; the GLB
 * streams in asynchronously (same pattern as MonsterModels / cove props).
 */
export function loadWorldProp(
  propId: string,
  loader: GLTFLoader,
  opts: {
    position?: THREE.Vector3;
    rotationY?: number;
    onReady?: (loaded: LoadedWorldProp) => void;
  } = {},
): LoadedWorldProp {
  const def = WORLD_PROP_BY_ID.get(propId);
  if (!def) throw new Error(`Unknown world prop: ${propId}`);

  const holder = new THREE.Group();
  if (opts.position) holder.position.copy(opts.position);
  if (opts.rotationY != null) holder.rotation.y = opts.rotationY;
  holder.userData.propId = propId;
  holder.userData.collectable = def.kind === "collectable" || def.kind === "perk_symbol";

  const loaded: LoadedWorldProp = { holder, mixer: null, def };
  const url = `${MODELS_BASE}/${def.folder}/${def.file}`;

  loadGLTFCached(loader, url).then(
    (gltf) => {
      if (holder.userData.disposed) return;

      // Cached template is shared — clone before normalize / scene attach.
      const root = gltf.scene.clone(true);
      normalizeRoot(root, def);
      applyShadows(root);
      holder.add(root);

      if (gltf.animations.length) {
        const clip = pickClip(gltf.animations, def.clip);
        if (clip) {
          const mixer = new THREE.AnimationMixer(root);
          const action = mixer.clipAction(clip);
          action.loop = THREE.LoopRepeat;
          action.play();
          loaded.mixer = mixer;
          holder.userData.mixer = mixer;
        }
      }

      opts.onReady?.(loaded);
    },
    (err) => {
      if (import.meta.env.DEV) console.warn(`[WorldProp] failed to load ${propId}:`, err);
    },
  );

  return loaded;
}

export function disposeWorldProp(loaded: LoadedWorldProp) {
  loaded.holder.userData.disposed = true;
  if (loaded.mixer) {
    loaded.mixer.stopAllAction();
    loaded.mixer.uncacheRoot(loaded.mixer.getRoot());
    loaded.mixer = null;
  }
  loaded.holder.traverse((c) => {
    const mesh = c as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    if (mesh.material) {
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) m.dispose();
    }
  });
  loaded.holder.clear();
}