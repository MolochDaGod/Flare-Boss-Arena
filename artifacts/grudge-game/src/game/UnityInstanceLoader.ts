/**
 * Load Unity-exported GLB instances for Three.js (camps / dungeons / arena props).
 * Normalises scale to metres, grounds feet, enables shadows.
 */
import * as THREE from "three";
import type { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  getUnityInstance,
  resolveInstanceUrl,
  type UnityInstanceDef,
} from "../data/unityInstances";

export interface LoadedUnityInstance {
  id: string;
  def: UnityInstanceDef;
  group: THREE.Group;
  root: THREE.Object3D;
  spawns: THREE.Vector3[];
  dispose: () => void;
}

function disposeObject(root: THREE.Object3D) {
  root.traverse((c) => {
    const m = c as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    if (m.material) {
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mat of mats) {
        for (const v of Object.values(mat)) {
          if (v && (v as THREE.Texture).isTexture) (v as THREE.Texture).dispose();
        }
        mat.dispose();
      }
    }
  });
}

function normalizeToSpan(root: THREE.Object3D, targetSpanM: number) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  box.getSize(size);
  const span = Math.max(size.x, size.z, 0.01);
  const s = targetSpanM / span;
  root.scale.multiplyScalar(s);
  root.updateMatrixWorld(true);
  const box2 = new THREE.Box3().setFromObject(root);
  root.position.y -= box2.min.y;
  root.position.x -= (box2.min.x + box2.max.x) * 0.5;
  root.position.z -= (box2.min.z + box2.max.z) * 0.5;
}

/**
 * Load a registered Unity instance. Tries local then CDN.
 * Resolves null if both 404 and def.requiresExport.
 */
export function loadUnityInstance(
  id: string,
  loader: GLTFLoader,
  scene: THREE.Scene,
  origin: THREE.Vector3,
  onReady?: (inst: LoadedUnityInstance) => void,
): LoadedUnityInstance | null {
  const def = getUnityInstance(id);
  if (!def) {
    console.warn(`[UnityInstance] unknown id ${id}`);
    return null;
  }

  const group = new THREE.Group();
  group.name = `unity_instance_${id}`;
  group.position.copy(origin);
  scene.add(group);

  const spawns = def.spawns.map(
    ([x, y, z]) => new THREE.Vector3(x, y, z).add(origin),
  );

  let disposed = false;
  const handle: LoadedUnityInstance = {
    id,
    def,
    group,
    root: group,
    spawns,
    dispose: () => {
      disposed = true;
      scene.remove(group);
      disposeObject(group);
    },
  };

  if (!def.localUrl && def.kind === "arena") {
    // Procedural arena floor
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(def.targetSpanM * 0.5, 48),
      new THREE.MeshStandardMaterial({
        color: 0x2a3038,
        roughness: 0.85,
        metalness: 0.1,
      }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(def.targetSpanM * 0.48, 0.35, 8, 48),
      new THREE.MeshStandardMaterial({ color: 0x8b4513, roughness: 0.7 }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.2;
    group.add(floor, ring);
    onReady?.(handle);
    return handle;
  }

  const urls = [resolveInstanceUrl(def, false), resolveInstanceUrl(def, true)].filter(
    (u, i, a) => u && a.indexOf(u) === i,
  );

  const tryLoad = (i: number) => {
    if (i >= urls.length) {
      console.warn(
        `[UnityInstance] ${id} GLB missing — run scripts/unity-export (requiresExport=${def.requiresExport})`,
      );
      // Placeholder crystal so the slot is visible
      const ph = new THREE.Mesh(
        new THREE.BoxGeometry(4, 2, 4),
        new THREE.MeshStandardMaterial({
          color: 0x4a2060,
          emissive: 0x2a1040,
          emissiveIntensity: 0.4,
          transparent: true,
          opacity: 0.65,
        }),
      );
      ph.position.y = 1;
      group.add(ph);
      onReady?.(handle);
      return;
    }
    loader.load(
      urls[i]!,
      (gltf) => {
        if (disposed) {
          disposeObject(gltf.scene);
          return;
        }
        const root = gltf.scene;
        normalizeToSpan(root, def.targetSpanM);
        root.traverse((c) => {
          const m = c as THREE.Mesh;
          if (m.isMesh) {
            m.castShadow = true;
            m.receiveShadow = true;
            m.frustumCulled = false;
          }
        });
        group.add(root);
        handle.root = root;
        onReady?.(handle);
      },
      undefined,
      () => tryLoad(i + 1),
    );
  };
  tryLoad(0);
  return handle;
}
