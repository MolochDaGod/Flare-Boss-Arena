/**
 * Scene bake + GPU-friendly loaders for the island ARPG.
 *
 * - Draco decoder on GLTFLoader (compressed meshes decode client-side)
 * - Static mesh freeze (matrixAutoUpdate off after world bake)
 * - InstancedMesh helpers for mass props (rocks, posts, debris)
 * - Optional geometry merge for pure-static, same-material batches
 *
 * NOTE: Multiple three copies in monorepo — never use `instanceof`.
 */

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

let dracoShared: DRACOLoader | null = null;

/**
 * Attach a shared Draco decoder to a GLTFLoader.
 * Uses Google's hosted wasm decoder (same as three.js examples).
 * Safe to call multiple times — one decoder per session.
 */
export function configureDracoLoader(loader: GLTFLoader): GLTFLoader {
  if (!dracoShared) {
    dracoShared = new DRACOLoader();
    // Official three.js examples decoder path (CDN). Works offline fallback if 404 → uncompressed GLBs still load.
    dracoShared.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.7/");
    dracoShared.setDecoderConfig({ type: "js" });
    dracoShared.preload();
  }
  loader.setDRACOLoader(dracoShared);
  return loader;
}

export function disposeDracoLoader() {
  dracoShared?.dispose();
  dracoShared = null;
}

/**
 * Freeze a static subtree: bake world matrices, disable matrix auto-update.
 * Skips SkinnedMesh / animated roots (userData.dynamic / hasMixer).
 */
export function bakeStaticSubtree(root: THREE.Object3D, opts?: { force?: boolean }) {
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    if (o.userData?.dynamic || o.userData?.noBake) return;
    if ((o as THREE.SkinnedMesh).isSkinnedMesh) return;
    if (o.userData?.hasMixer) return;
    if (!opts?.force && o.userData?.baked) return;
    o.matrixAutoUpdate = false;
    o.updateMatrix();
    o.userData.baked = true;
  });
}

/**
 * After all generative props are in, freeze the named static groups.
 * Leaves player, enemies, allies, VFX dynamic.
 */
export function bakeIslandScene(scene: THREE.Scene) {
  const staticNames = new Set([
    "ModularBuildings",
    "FarmModular",
    "WorldChunkMap",
    "PlayerCamps",
    "ClaimFlags",
    "terrain_skirt",
    "rock_field",
    "ground",
    "maze",
  ]);
  scene.traverse((o) => {
    if (o === scene) return;
    const n = o.name || "";
    if (staticNames.has(n) || o.userData?.bakeStatic) {
      bakeStaticSubtree(o);
    }
  });
  // Ground / terrain often unnamed — freeze Mesh with receiveShadow + no parent anim
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    if (m.userData?.dynamic || m.userData?.baked) return;
    if ((m as THREE.SkinnedMesh).isSkinnedMesh) return;
    if (m.userData?.enemyId || m.userData?.ally || m.userData?.ghost) return;
    // Large static receivers only
    if (m.receiveShadow && !m.castShadow && m.geometry) {
      m.matrixAutoUpdate = false;
      m.updateMatrix();
      m.userData.baked = true;
    }
  });
}

export interface InstancedScatterItem {
  position: THREE.Vector3;
  scale?: number;
  yaw?: number;
}

/**
 * Build one InstancedMesh from a prototype geometry/material and placements.
 * Single draw call for N identical props.
 */
export function createInstancedScatter(
  geometry: THREE.BufferGeometry,
  material: THREE.Material | THREE.Material[],
  items: InstancedScatterItem[],
  opts?: { castShadow?: boolean; receiveShadow?: boolean; name?: string },
): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(geometry, material, items.length);
  mesh.name = opts?.name ?? "InstancedScatter";
  mesh.castShadow = opts?.castShadow ?? true;
  mesh.receiveShadow = opts?.receiveShadow ?? true;
  mesh.frustumCulled = true;
  const m = new THREE.Matrix4();
  const p = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3(1, 1, 1);
  const e = new THREE.Euler(0, 0, 0);
  for (let i = 0; i < items.length; i++) {
    const it = items[i]!;
    p.copy(it.position);
    e.set(0, it.yaw ?? 0, 0);
    q.setFromEuler(e);
    const sc = it.scale ?? 1;
    s.set(sc, sc, sc);
    m.compose(p, q, s);
    mesh.setMatrixAt(i, m);
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.matrixAutoUpdate = false;
  mesh.updateMatrix();
  mesh.userData.baked = true;
  mesh.userData.bakeStatic = true;
  return mesh;
}

/**
 * Merge an array of same-material meshes into one BufferGeometry mesh (bake).
 * Returns null if nothing mergeable. Input meshes are NOT disposed (caller decides).
 */
export function mergeStaticMeshes(
  meshes: THREE.Mesh[],
  material: THREE.Material,
): THREE.Mesh | null {
  if (!meshes.length) return null;
  const geos: THREE.BufferGeometry[] = [];
  for (const m of meshes) {
    if (!m.geometry || (m as THREE.SkinnedMesh).isSkinnedMesh) continue;
    m.updateMatrixWorld(true);
    const g = m.geometry.clone();
    g.applyMatrix4(m.matrixWorld);
    geos.push(g);
  }
  if (!geos.length) return null;
  const merged = mergeGeometries(geos, false);
  for (const g of geos) g.dispose();
  if (!merged) return null;
  const mesh = new THREE.Mesh(merged, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.matrixAutoUpdate = false;
  mesh.updateMatrix();
  mesh.userData.baked = true;
  mesh.userData.bakeStatic = true;
  return mesh;
}

/** Seeded mulberry32 — shared with zone gen for deterministic scatters. */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Diablo-2-ish debris field: instanced low-poly rocks/stumps around zone rings.
 */
export function scatterZoneDebris(
  scene: THREE.Scene,
  zones: Array<{ x: number; z: number; radius: number; kind: string }>,
  seed: number,
): { group: THREE.Group; dispose: () => void } {
  const group = new THREE.Group();
  group.name = "ZoneDebrisBaked";
  group.userData.bakeStatic = true;
  const rng = mulberry32(seed ^ 0xdeb15);

  const rockGeo = new THREE.DodecahedronGeometry(0.45, 0);
  const rockMat = new THREE.MeshStandardMaterial({
    color: 0x4a4438,
    roughness: 0.92,
    metalness: 0.05,
  });
  const stumpGeo = new THREE.CylinderGeometry(0.28, 0.35, 0.55, 6);
  const stumpMat = new THREE.MeshStandardMaterial({
    color: 0x3a2e22,
    roughness: 0.95,
  });

  const rocks: InstancedScatterItem[] = [];
  const stumps: InstancedScatterItem[] = [];

  for (const z of zones) {
    if (z.kind === "harbor" || z.kind === "boss_gate") continue;
    const n = 4 + Math.floor(rng() * 8);
    for (let i = 0; i < n; i++) {
      const ang = rng() * Math.PI * 2;
      const r = z.radius * (0.55 + rng() * 0.7);
      const x = z.x + Math.cos(ang) * r;
      const zz = z.z + Math.sin(ang) * r;
      if (Math.hypot(x, zz) < 12) continue;
      const item: InstancedScatterItem = {
        position: new THREE.Vector3(x, 0, zz),
        scale: 0.6 + rng() * 1.1,
        yaw: rng() * Math.PI * 2,
      };
      if (rng() < 0.35) stumps.push(item);
      else rocks.push(item);
    }
  }

  if (rocks.length) {
    const im = createInstancedScatter(rockGeo, rockMat, rocks, { name: "DebrisRocks" });
    // plant feet roughly
    for (let i = 0; i < rocks.length; i++) {
      const m = new THREE.Matrix4();
      im.getMatrixAt(i, m);
      const p = new THREE.Vector3();
      const q = new THREE.Quaternion();
      const s = new THREE.Vector3();
      m.decompose(p, q, s);
      p.y = s.y * 0.25;
      m.compose(p, q, s);
      im.setMatrixAt(i, m);
    }
    im.instanceMatrix.needsUpdate = true;
    group.add(im);
  }
  if (stumps.length) {
    const im = createInstancedScatter(stumpGeo, stumpMat, stumps, { name: "DebrisStumps" });
    for (let i = 0; i < stumps.length; i++) {
      const m = new THREE.Matrix4();
      im.getMatrixAt(i, m);
      const p = new THREE.Vector3();
      const q = new THREE.Quaternion();
      const s = new THREE.Vector3();
      m.decompose(p, q, s);
      p.y = s.y * 0.28;
      m.compose(p, q, s);
      im.setMatrixAt(i, m);
    }
    im.instanceMatrix.needsUpdate = true;
    group.add(im);
  }

  scene.add(group);
  bakeStaticSubtree(group, { force: true });

  return {
    group,
    dispose: () => {
      scene.remove(group);
      group.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        m.geometry?.dispose();
        const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
        for (const mat of mats) mat.dispose();
      });
    },
  };
}
