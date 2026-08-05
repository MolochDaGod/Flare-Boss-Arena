/**
 * Farm low-poly modular pack scatter — generative farmland zones.
 * Asset: models/buildings/farm_modular_pack.glb
 */

import * as THREE from "three";
import type { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { loadGLTFCached } from "./assets";

const FARM_URL = `${import.meta.env.BASE_URL}models/buildings/farm_modular_pack.glb`;

/** Best static props for farmland clusters (names from farm atlas). */
export const FARM_PARTS = [
  "DirtFlat",
  "Dirtshortgreen",
  "Dirthighgreen",
  "Dirtdry",
  "DirtSmalldry",
  "DirtWater",
  "Fence",
  "fencebroken",
  "Gate",
  "HayBale",
  "barrel",
  "bucket",
  "waterbucket",
  "Tree_1",
  "Tree_2",
  "TreeLog",
  "Log",
  "LogMossgreen",
  "RockDry1",
  "RockDry2",
  "RockDry3",
  "GrassGreen",
  "GrassDry",
  "PlantDry",
  "WaterPole",
  "Laundry",
] as const;

export type FarmPartId = (typeof FARM_PARTS)[number];

export interface FarmScatterOpts {
  halfExtent: number;
  seed: number;
  clusterCount?: number;
  partsPerCluster?: number;
  avoid?: Array<{ x: number; z: number; r: number }>;
  /** Preferred centers (farm zones). */
  zoneCenters?: Array<{ x: number; z: number; r: number }>;
  snapWalkable?: (x: number, z: number) => THREE.Vector3;
  unitScale?: number;
}

export interface FarmFieldHandle {
  group: THREE.Group;
  dispose: () => void;
}

function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function cloneNamed(scene: THREE.Object3D, base: string): THREE.Object3D | null {
  let src: THREE.Object3D | null = null;
  scene.traverse((o) => {
    if (!src && o.name === base) src = o;
  });
  if (!src) {
    const low = base.toLowerCase();
    scene.traverse((o) => {
      if (!src && o.name.toLowerCase() === low) src = o;
    });
  }
  if (!src) return null;
  const node = src as THREE.Object3D;
  let skinned = false;
  node.traverse((c) => {
    if ((c as THREE.SkinnedMesh).isSkinnedMesh) skinned = true;
  });
  if (skinned) return null;
  const clone = node.clone(true);
  clone.position.set(0, 0, 0);
  clone.quaternion.identity();
  clone.scale.set(1, 1, 1);
  clone.applyMatrix4(node.matrixWorld);
  return clone;
}

function placePart(
  clone: THREE.Object3D,
  unit: number,
  x: number,
  z: number,
  yaw: number,
  maxFoot = 12,
): THREE.Group {
  const holder = new THREE.Group();
  holder.add(clone);
  holder.scale.setScalar(unit);
  holder.position.set(x, 0, z);
  holder.rotation.y = yaw;
  holder.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(holder);
  holder.position.y -= b.min.y;
  const size = new THREE.Vector3();
  b.getSize(size);
  const foot = Math.max(size.x, size.z);
  if (foot > maxFoot) {
    holder.scale.multiplyScalar(maxFoot / foot);
    holder.updateMatrixWorld(true);
    const b2 = new THREE.Box3().setFromObject(holder);
    holder.position.y -= b2.min.y - holder.position.y;
  }
  // Height clamp — dirt pads / trees
  holder.updateMatrixWorld(true);
  const b3 = new THREE.Box3().setFromObject(holder);
  const s3 = new THREE.Vector3();
  b3.getSize(s3);
  if (s3.y > 8) {
    holder.scale.multiplyScalar(7 / s3.y);
    holder.updateMatrixWorld(true);
    const b4 = new THREE.Box3().setFromObject(holder);
    holder.position.y -= b4.min.y - holder.position.y;
  }
  holder.traverse((c) => {
    const m = c as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });
  return holder;
}

/**
 * Scatter farm modular clusters. Prefer zoneCenters when provided.
 */
export function scatterFarmModular(
  loader: GLTFLoader,
  scene: THREE.Scene,
  opts: FarmScatterOpts,
): FarmFieldHandle {
  const group = new THREE.Group();
  group.name = "FarmModular";
  scene.add(group);

  const rng = mulberry(opts.seed);
  const unit = opts.unitScale ?? 0.42;
  const clusters = opts.clusterCount ?? 4;
  const perCluster = opts.partsPerCluster ?? 8;
  const avoid = opts.avoid ?? [];
  let disposed = false;

  const blocked = (x: number, z: number) => {
    if (Math.hypot(x, z) < 16) return true;
    for (const a of avoid) {
      if (Math.hypot(x - a.x, z - a.z) < a.r) return true;
    }
    return false;
  };

  void loadGLTFCached(loader, FARM_URL).then((gltf) => {
    if (disposed) return;
    gltf.scene.updateMatrixWorld(true);

    for (let c = 0; c < clusters; c++) {
      let cx = 0;
      let cz = 0;
      let ok = false;
      const zone = opts.zoneCenters?.[c % (opts.zoneCenters?.length || 1)];
      if (zone && opts.zoneCenters?.length) {
        for (let attempt = 0; attempt < 12; attempt++) {
          const a = rng() * Math.PI * 2;
          const r = rng() * zone.r * 0.7;
          const x = zone.x + Math.cos(a) * r;
          const z = zone.z + Math.sin(a) * r;
          if (!blocked(x, z)) {
            const p = opts.snapWalkable?.(x, z) ?? new THREE.Vector3(x, 0, z);
            cx = p.x;
            cz = p.z;
            ok = true;
            break;
          }
        }
      }
      if (!ok) {
        for (let attempt = 0; attempt < 20; attempt++) {
          const ang = rng() * Math.PI * 2;
          const r = 30 + rng() * (opts.halfExtent - 42);
          const x = Math.cos(ang) * r;
          const z = Math.sin(ang) * r;
          if (blocked(x, z)) continue;
          const p = opts.snapWalkable?.(x, z) ?? new THREE.Vector3(x, 0, z);
          cx = p.x;
          cz = p.z;
          ok = true;
          break;
        }
      }
      if (!ok) continue;

      // Themes: field, paddock, orchard, well yard
      const theme = c % 4;
      const pool: FarmPartId[] =
        theme === 0
          ? ["DirtFlat", "Dirtshortgreen", "Dirthighgreen", "Fence", "Fence", "HayBale", "barrel", "GrassGreen"]
          : theme === 1
            ? ["Fence", "fencebroken", "Gate", "Dirtdry", "HayBale", "bucket", "barrel", "RockDry1"]
            : theme === 2
              ? ["Tree_1", "Tree_2", "GrassDry", "PlantDry", "Log", "LogMossgreen", "RockDry2", "DirtSmalldry"]
              : ["WaterPole", "DirtWater", "waterbucket", "Fence", "Laundry", "TreeLog", "RockDry3", "barrel"];

      for (let i = 0; i < perCluster; i++) {
        const part = pool[i % pool.length]!;
        const clone = cloneNamed(gltf.scene, part);
        if (!clone) continue;
        const a = rng() * Math.PI * 2;
        const rad = (part.startsWith("Dirt") ? 0.5 : 1.2) + rng() * 6;
        const px = cx + Math.cos(a) * rad;
        const pz = cz + Math.sin(a) * rad;
        if (blocked(px, pz)) continue;
        const pos = opts.snapWalkable?.(px, pz) ?? new THREE.Vector3(px, 0, pz);
        const isDirt = part.startsWith("Dirt");
        const isTree = part.startsWith("Tree");
        const scale =
          unit *
          (isDirt ? 1.35 + rng() * 0.4 : isTree ? 0.9 + rng() * 0.25 : 0.85 + rng() * 0.3);
        const holder = placePart(
          clone,
          scale,
          pos.x,
          pos.z,
          rng() * Math.PI * 2,
          isDirt ? 14 : isTree ? 6 : 5,
        );
        holder.userData.farmPart = part;
        holder.userData.cluster = c;
        group.add(holder);
      }
    }
  });

  return {
    group,
    dispose: () => {
      disposed = true;
      scene.remove(group);
      group.traverse((c) => {
        const m = c as THREE.Mesh;
        if (!m.isMesh) return;
        m.geometry?.dispose();
        const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
        for (const mat of mats) mat.dispose();
      });
    },
  };
}
