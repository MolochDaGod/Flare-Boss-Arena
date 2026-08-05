/**
 * Modular building parts — extract props from orc_camp_set.glb (and similar
 * atlases) and scatter generative outposts / ruins across the island.
 *
 * Reuses CampBuilder atlas clone rules: bake source world matrix, ground feet,
 * avoid skinned props without mixers.
 */

import * as THREE from "three";
import type { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const PROTO = (base: string) => `${base}_proto_orc_rts_0`;

/** Best modular parts for generative outposts (static meshes only — from orc_camp_set atlas). */
export const MODULAR_PARTS = [
  "orc_cabin",
  "orc_hut_base",
  "orc_log_wall",
  "orc_stone_pillar_big",
  "orc_campfire",
  "orc_barrel",
  "orc_box_large_1",
  "orc_box_small_1",
  "orc_wood_pile_big",
  "orc_wood_pile_small",
  "orc_beam_pile",
  "orc_log",
  "orc_stone_big",
  "orc_anvil_big",
  "orc_high_stand",
  "orc_tusk_standing",
  "orc_skull",
  "orc_horned_skull",
  "orc_practice_dummy",
  "orc_throne",
  "orc_oven",
] as const;

export type ModularPartId = (typeof MODULAR_PARTS)[number];

export interface ModularScatterOpts {
  /** World half-extent for placement. */
  halfExtent: number;
  seed: number;
  /** How many generative clusters. */
  clusterCount?: number;
  /** Parts per cluster. */
  partsPerCluster?: number;
  /** Open zones to avoid (hub, cove, camps). */
  avoid?: Array<{ x: number; z: number; r: number }>;
  /** Snap to walkable if provided. */
  snapWalkable?: (x: number, z: number) => THREE.Vector3;
  /** Global scale vs ~2m player. */
  unitScale?: number;
}

export interface ModularFieldHandle {
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

function cloneProp(scene: THREE.Object3D, base: string): THREE.Object3D | null {
  let src: THREE.Object3D | null = null;
  const wanted = PROTO(base);
  scene.traverse((o) => {
    if (!src && o.name === wanted) src = o;
  });
  if (!src) {
    // Fallback: partial name match
    scene.traverse((o) => {
      if (!src && o.name.toLowerCase().includes(base.toLowerCase())) src = o;
    });
  }
  if (!src) return null;
  const node = src as THREE.Object3D;
  // Skip skinned (would need mixer)
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
): THREE.Group {
  const holder = new THREE.Group();
  holder.add(clone);
  holder.scale.setScalar(unit);
  holder.position.set(x, 0, z);
  holder.rotation.y = yaw;
  holder.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(holder);
  holder.position.y -= b.min.y;
  // Cap accidental giants from atlas scale
  const size = new THREE.Vector3();
  b.getSize(size);
  const maxFoot = Math.max(size.x, size.z);
  if (maxFoot > 14) {
    const s = 10 / maxFoot;
    holder.scale.multiplyScalar(s);
    holder.updateMatrixWorld(true);
    const b2 = new THREE.Box3().setFromObject(holder);
    holder.position.y -= b2.min.y - holder.position.y;
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
 * Load orc_camp_set atlas and scatter modular outposts across the island.
 */
export function scatterModularBuildings(
  loader: GLTFLoader,
  scene: THREE.Scene,
  atlasUrl: string,
  opts: ModularScatterOpts,
): ModularFieldHandle {
  const group = new THREE.Group();
  group.name = "ModularBuildings";
  scene.add(group);

  const rng = mulberry(opts.seed);
  const unit = opts.unitScale ?? 0.55;
  const clusters = opts.clusterCount ?? 5;
  const perCluster = opts.partsPerCluster ?? 6;
  const avoid = opts.avoid ?? [];
  let disposed = false;

  const tryPlace = (x: number, z: number): { x: number; z: number } | null => {
    for (const a of avoid) {
      if (Math.hypot(x - a.x, z - a.z) < a.r) return null;
    }
    if (Math.hypot(x, z) < 16) return null;
    if (opts.snapWalkable) {
      const w = opts.snapWalkable(x, z);
      return { x: w.x, z: w.z };
    }
    return { x, z };
  };

  loader.load(
    atlasUrl,
    (gltf) => {
      if (disposed) {
        gltf.scene.traverse((c) => {
          const m = c as THREE.Mesh;
          m.geometry?.dispose();
        });
        return;
      }
      gltf.scene.updateMatrixWorld(true);

      for (let c = 0; c < clusters; c++) {
        let cx = 0;
        let cz = 0;
        let ok = false;
        for (let attempt = 0; attempt < 24; attempt++) {
          const ang = rng() * Math.PI * 2;
          const r = 28 + rng() * (opts.halfExtent - 40);
          const p = tryPlace(Math.cos(ang) * r, Math.sin(ang) * r);
          if (p) {
            cx = p.x;
            cz = p.z;
            ok = true;
            break;
          }
        }
        if (!ok) continue;

        // Cluster themes cycle: fortlet, lumber, ruin, watch, scrap, war-throne
        const theme = c % 6;
        const pool: ModularPartId[] =
          theme === 0
            ? ["orc_cabin", "orc_log_wall", "orc_log_wall", "orc_barrel", "orc_campfire", "orc_stone_pillar_big", "orc_box_small_1"]
            : theme === 1
              ? ["orc_wood_pile_big", "orc_wood_pile_small", "orc_beam_pile", "orc_log", "orc_hut_base", "orc_barrel", "orc_box_large_1"]
              : theme === 2
                ? ["orc_skull", "orc_horned_skull", "orc_stone_big", "orc_tusk_standing", "orc_box_large_1", "orc_log_wall", "orc_stone_pillar_big"]
                : theme === 3
                  ? ["orc_high_stand", "orc_log_wall", "orc_practice_dummy", "orc_barrel", "orc_campfire", "orc_box_small_1", "orc_log"]
                  : theme === 4
                    ? ["orc_anvil_big", "orc_box_large_1", "orc_box_small_1", "orc_barrel", "orc_wood_pile_small", "orc_log", "orc_oven"]
                    : ["orc_throne", "orc_log_wall", "orc_stone_pillar_big", "orc_tusk_standing", "orc_campfire", "orc_skull", "orc_barrel"];

        for (let i = 0; i < perCluster; i++) {
          const part = pool[i % pool.length]!;
          const clone = cloneProp(gltf.scene, part);
          if (!clone) continue;
          const a = rng() * Math.PI * 2;
          const rad = 1.5 + rng() * 5.5;
          const px = cx + Math.cos(a) * rad;
          const pz = cz + Math.sin(a) * rad;
          const pos = opts.snapWalkable?.(px, pz) ?? new THREE.Vector3(px, 0, pz);
          const holder = placePart(clone, unit * (0.85 + rng() * 0.25), pos.x, pos.z, rng() * Math.PI * 2);
          holder.userData.modularPart = part;
          holder.userData.cluster = c;
          group.add(holder);
        }
      }
    },
    undefined,
    () => {
      /* atlas optional */
    },
  );

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
