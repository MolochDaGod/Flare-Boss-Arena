/**
 * Dark Elf Camp prefab (Unity war-camp pattern → Three.js).
 *
 * When a Unity-exported camp GLB is available, set DARK_ELF_CAMP_PREFAB_URL.
 * Until then we compose a prefab-equivalent: ring layout + dark_elf.glb sentries
 * + purple-themed structures (recolored orc_camp_set props).
 */

import * as THREE from "three";
import type { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { buildOrcCamp, type CampHandle } from "./CampBuilder";
import { darkElfCampPrefabUrl } from "../data/unityInstances";

/**
 * Unity-exported Dark Elf Camp GLB (scripts/unity-export → public/models/unity/dark_elf_camp.glb).
 * Also accepts legacy buildings/dark_elf_camp_prefab.glb path via unityInstances fallback chain.
 */
export const DARK_ELF_CAMP_PREFAB_URL = darkElfCampPrefabUrl();

export const DARK_ELF_SENTRY_URL =
  `${import.meta.env.BASE_URL}models/monsters/dark_elf.glb`;

export interface DarkElfCampHandle {
  group: THREE.Group;
  center: THREE.Vector3;
  /** Defenders spawn offsets relative to center. */
  sentrySpots: THREE.Vector3[];
  dispose: () => void;
}

function applyDarkElfTint(root: THREE.Object3D) {
  root.traverse((c) => {
    const mesh = c as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      const m = mat as THREE.MeshStandardMaterial;
      if (!m.color) continue;
      const hsl = { h: 0, s: 0, l: 0 };
      m.color.getHSL(hsl);
      m.color.setHSL(0.76, Math.min(0.6, hsl.s * 0.7 + 0.25), hsl.l * 0.65);
      if (m.emissive) {
        m.emissive.setHex(0x3a1060);
        m.emissiveIntensity = 0.22;
      }
    }
  });
}

/**
 * Build dark-elf camp prefab instance.
 * Prefers dedicated Unity GLB; falls back to themed orc_camp_set + sentries.
 */
export function buildDarkElfCampPrefab(
  loader: GLTFLoader,
  scene: THREE.Scene,
  center: THREE.Vector3,
  orcCampAtlasUrl: string,
): DarkElfCampHandle {
  const group = new THREE.Group();
  group.name = "dark_elf_camp_prefab";
  group.position.copy(center);
  scene.add(group);

  const sentrySpots: THREE.Vector3[] = [];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.4;
    sentrySpots.push(new THREE.Vector3(Math.cos(a) * 9, 0, Math.sin(a) * 9));
  }

  let atlasCamp: CampHandle | null = null;
  let prefabRoot: THREE.Object3D | null = null;
  let disposed = false;

  // Try Unity prefab GLB first.
  loader.load(
    DARK_ELF_CAMP_PREFAB_URL,
    (gltf) => {
      if (disposed) {
        gltf.scene.traverse((c) => {
          const m = c as THREE.Mesh;
          m.geometry?.dispose();
        });
        return;
      }
      prefabRoot = gltf.scene;
      applyDarkElfTint(prefabRoot);
      // Normalize footprint ~16u wide (player-scale war camp, not a fortress)
      const box = new THREE.Box3().setFromObject(prefabRoot);
      const size = new THREE.Vector3();
      box.getSize(size);
      const span = Math.max(size.x, size.z, 1);
      const target = 16;
      const s = Math.min(2.5, target / span);
      prefabRoot.scale.setScalar(s);
      prefabRoot.position.y -= box.min.y * s;
      group.add(prefabRoot);
    },
    undefined,
    () => {
      // Fallback: purple orc-camp atlas as Unity-style ring prefab.
      if (disposed) return;
      atlasCamp = buildOrcCamp(loader, scene, orcCampAtlasUrl, {
        theme: "dark_elf",
        offset: center.clone(),
        scale: 0.9,
        name: "dark_elf_camp_atlas_prefab",
      });
      // Don't double-parent — buildOrcCamp already adds to scene.
    },
  );

  // Ritual crystal + combat HP live on `buildDarkElfCrystalEvent` (GameEngine).
  // Camp prefab is backdrop structures only so the event crystal is unique.

  // Sentry placeholders (dark_elf.glb instances)
  for (const spot of sentrySpots) {
    loader.load(
      DARK_ELF_SENTRY_URL,
      (gltf) => {
        if (disposed) return;
        const s = gltf.scene.clone(true);
        const box = new THREE.Box3().setFromObject(s);
        const size = new THREE.Vector3();
        box.getSize(size);
        const h = Math.max(size.y, 0.01);
        s.scale.setScalar(2.0 / h);
        s.position.copy(spot);
        s.position.y = 0;
        s.rotation.y = Math.atan2(-spot.x, -spot.z);
        applyDarkElfTint(s);
        s.traverse((c) => {
          const m = c as THREE.Mesh;
          if (m.isMesh) {
            m.castShadow = true;
            m.receiveShadow = true;
            m.frustumCulled = false;
          }
        });
        group.add(s);
      },
      undefined,
      () => {
        /* optional */
      },
    );
  }

  return {
    group,
    center: center.clone(),
    sentrySpots: sentrySpots.map((s) => s.clone().add(center)),
    dispose: () => {
      disposed = true;
      scene.remove(group);
      atlasCamp?.dispose();
      group.traverse((c) => {
        const m = c as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        if (m.material) {
          const mats = Array.isArray(m.material) ? m.material : [m.material];
          for (const mat of mats) mat.dispose();
        }
      });
    },
  };
}
