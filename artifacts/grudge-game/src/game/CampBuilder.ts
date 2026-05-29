import * as THREE from "three";
import type { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

/**
 * Orc war-camp builder.
 *
 * `orc_camp_set.glb` is an ATLAS: all 198 base props sit stacked at the origin
 * (only the leveled showcase buildings carry translations). So we extract each
 * prop by its mesh-node name (`<base>_proto_orc_rts_0`), bake the source world
 * transform (which carries the FBX→Y-up axis correction + scale) into a clone,
 * then place clones ourselves in a ring around the central forge.
 *
 * Everything is uniformly scaled by a single `unit` derived from the cabin's
 * natural width so the whole camp is scale-accurate relative to the ~1.9-unit
 * player. Skinned/animated props (banners, cauldron, lanterns) are avoided —
 * cloning them without their mixer would render them broken.
 */

const PROTO = (base: string) => `${base}_proto_orc_rts_0`;

interface Placement {
  base: string;
  r: number;   // ring radius (world units)
  deg: number; // angle around the forge
}

// Curated war-camp layout. Buildings anchor the ring; clutter fills between.
const LAYOUT: Placement[] = [
  { base: "orc_cabin",        r: 29, deg: 35 },
  { base: "orc_hut_base",     r: 30, deg: 150 },
  { base: "orc_high_stand",   r: 28, deg: 255 },
  { base: "orc_throne",       r: 23, deg: 200 },
  { base: "orc_anvil_big",    r: 22, deg: 60 },
  { base: "orc_oven",         r: 25, deg: 95 },
  { base: "orc_practice_dummy", r: 21, deg: 300 },
  { base: "orc_campfire",     r: 17, deg: 330 },
  { base: "orc_barrel",       r: 20, deg: 45 },
  { base: "orc_box_large_1",  r: 22, deg: 120 },
  { base: "orc_box_small_1",  r: 19, deg: 138 },
  { base: "orc_wood_pile_big", r: 24, deg: 172 },
  { base: "orc_wood_pile_small", r: 20, deg: 212 },
  { base: "orc_beam_pile",    r: 26, deg: 232 },
  { base: "orc_log",          r: 19, deg: 282 },
  { base: "orc_stone_big",    r: 27, deg: 315 },
  { base: "orc_tusk_standing", r: 31, deg: 12 },
  { base: "orc_horned_skull", r: 32, deg: 75 },
  { base: "orc_stone_pillar_big", r: 33, deg: 188 },
  { base: "orc_skull",        r: 22, deg: 242 },
];

// Palisade ring of repeated log walls.
const PALISADE_BASE = "orc_log_wall";
const PALISADE_RADIUS = 36;
const PALISADE_COUNT = 22;

export interface CampHandle {
  group: THREE.Group;
  dispose: () => void;
}

/** Find a prop's source mesh node and return a transform-baked clone. */
function cloneProp(scene: THREE.Object3D, base: string): THREE.Object3D | null {
  let src: THREE.Object3D | null = null;
  const wanted = PROTO(base);
  scene.traverse((o) => { if (!src && o.name === wanted) src = o; });
  if (!src) return null;
  const node = src as THREE.Object3D;
  const clone = node.clone(true);
  // Replace the clone's local transform with the SOURCE world transform so the
  // axis-correction baked into the GLB hierarchy is preserved at our new root.
  clone.position.set(0, 0, 0);
  clone.quaternion.identity();
  clone.scale.set(1, 1, 1);
  clone.applyMatrix4(node.matrixWorld);
  return clone;
}

/** Wrap a baked clone in a holder, scale + place it, drop its feet to y=0. */
function placeHolder(clone: THREE.Object3D, unit: number, x: number, z: number, faceCenter: boolean, tangent = false): THREE.Group {
  const holder = new THREE.Group();
  holder.add(clone);
  holder.scale.setScalar(unit);
  holder.position.set(x, 0, z);
  if (tangent) holder.rotation.y = Math.atan2(x, z) + Math.PI / 2;
  else if (faceCenter) holder.rotation.y = Math.atan2(-x, -z);
  holder.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(holder);
  holder.position.y -= b.min.y; // feet to ground
  holder.traverse((c) => {
    const m = c as THREE.Mesh;
    if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; }
  });
  return holder;
}

export function buildOrcCamp(loader: GLTFLoader, scene: THREE.Scene, url: string): CampHandle {
  const group = new THREE.Group();
  group.name = "orc_camp";
  scene.add(group);

  const geoms = new Set<THREE.BufferGeometry>();
  const mats = new Set<THREE.Material>();
  const collect = (root: THREE.Object3D) => root.traverse((c) => {
    const m = c as THREE.Mesh;
    if (m.isMesh) {
      if (m.geometry) geoms.add(m.geometry);
      const mm = m.material;
      if (Array.isArray(mm)) mm.forEach((x) => mats.add(x));
      else if (mm) mats.add(mm);
    }
  });

  // Release every geometry/material/texture under an object (used when a load
  // arrives after teardown so the GLB's resources don't leak).
  const disposeTree = (root: THREE.Object3D) => root.traverse((c) => {
    const m = c as THREE.Mesh;
    if (!m.isMesh) return;
    m.geometry?.dispose();
    const list = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
    for (const mat of list) {
      for (const v of Object.values(mat)) {
        if (v && (v as THREE.Texture).isTexture) (v as THREE.Texture).dispose();
      }
      mat.dispose();
    }
  });

  loader.load(
    url,
    (gltf) => {
      // Teardown happened before the GLB finished streaming — release the loaded
      // scene's resources instead of attaching them to a dead group.
      if (group.userData.disposed) { disposeTree(gltf.scene); return; }
      gltf.scene.updateMatrixWorld(true);

      // Derive the camp-wide scale from the cabin's natural width (target ~7u).
      let unit = 1;
      const cabin = cloneProp(gltf.scene, "orc_cabin");
      if (cabin) {
        const probe = new THREE.Group();
        probe.add(cabin);
        probe.updateMatrixWorld(true);
        const size = new THREE.Vector3();
        new THREE.Box3().setFromObject(probe).getSize(size);
        const w = Math.max(size.x, size.z);
        if (w > 0.001) unit = 7 / w;
      }

      for (const p of LAYOUT) {
        const clone = cloneProp(gltf.scene, p.base);
        if (!clone) continue;
        const rad = (p.deg * Math.PI) / 180;
        const x = Math.cos(rad) * p.r;
        const z = Math.sin(rad) * p.r;
        const holder = placeHolder(clone, unit, x, z, true);
        collect(holder);
        group.add(holder);
      }

      // Palisade ring.
      for (let i = 0; i < PALISADE_COUNT; i++) {
        const clone = cloneProp(gltf.scene, PALISADE_BASE);
        if (!clone) break;
        const rad = (i / PALISADE_COUNT) * Math.PI * 2;
        const x = Math.cos(rad) * PALISADE_RADIUS;
        const z = Math.sin(rad) * PALISADE_RADIUS;
        const holder = placeHolder(clone, unit, x, z, false, true);
        collect(holder);
        group.add(holder);
      }
    },
    undefined,
    () => { /* non-fatal: camp is decorative */ },
  );

  return {
    group,
    dispose: () => {
      group.userData.disposed = true;
      scene.remove(group);
      for (const g of geoms) g.dispose();
      for (const m of mats) m.dispose();
    },
  };
}
