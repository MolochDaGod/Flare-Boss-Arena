/**
 * Tileable pixel pack loader — **cube foundations as a graph**, props ON TOP.
 *
 * Critical rules (camp look SSOT):
 * 1. Atlas meshes are stacked at origin — always clone + bake world matrix.
 * 2. Instanced floors MUST bake normalize into **geometry** (not Object3D.position).
 *    Previously instance matrices ignored normalize → every tile meshed at origin.
 * 3. Scatter/buildings sit on **foundation top** (cube height), never y=0 inside cubes.
 */

import * as THREE from "three";
import type { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  TILEABLE_PACK_URL,
  TILEABLE_MESH_BY_ID,
  type TileableFloorConfig,
  type TileablePlacement,
  type TileableScaleMode,
} from "../data/tileablePixelPack";
import { loadGLTFCached } from "./assets";

export interface TileablePackHandle {
  group: THREE.Group;
  /** World Y of the walkable foundation top (props place at this height). */
  foundationTopY: number;
  dispose: () => void;
}

function resolveMeshName(meshOrId: string): string {
  const def = TILEABLE_MESH_BY_ID.get(meshOrId);
  return def?.mesh ?? meshOrId;
}

/** Find a mesh node by exact name and return a world-matrix-baked clone. */
function cloneMeshBaked(scene: THREE.Object3D, meshName: string): THREE.Object3D | null {
  let src: THREE.Object3D | null = null;
  scene.traverse((o) => {
    if (!src && o.name === meshName) src = o;
  });
  if (!src) return null;

  const node = src as THREE.Object3D;
  const clone = node.clone(true);
  clone.position.set(0, 0, 0);
  clone.quaternion.identity();
  clone.scale.set(1, 1, 1);
  clone.applyMatrix4(node.matrixWorld);
  return clone;
}

/** Crisp nearest-neighbour sampling for pixel-art textures. */
function applyPixelTextures(root: THREE.Object3D) {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      const rec = mat as THREE.Material & Record<string, unknown>;
      for (const key of Object.keys(rec)) {
        const val = rec[key] as THREE.Texture | undefined;
        if (!val?.isTexture) continue;
        val.magFilter = THREE.NearestFilter;
        val.minFilter = THREE.NearestFilter;
        val.generateMipmaps = false;
        val.needsUpdate = true;
      }
    }
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  });
}

function measureBox(root: THREE.Object3D) {
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  return { box, size, center };
}

/**
 * Scale + center XZ + feet to local y=0 on a hierarchy (for non-instanced scatter).
 */
function normalizeClone(
  clone: THREE.Object3D,
  scaleMode: TileableScaleMode,
  scaleTarget: number,
): void {
  const { size } = measureBox(clone);
  let scale = 1;
  if (scaleMode === "cell" || scaleMode === "footprint") {
    const footprint = Math.max(size.x, size.z) || 1;
    scale = scaleTarget / footprint;
  } else if (scaleMode === "height") {
    scale = scaleTarget / (size.y || 1);
  }
  if (scaleMode !== "native" && scale > 0 && Number.isFinite(scale)) {
    clone.scale.multiplyScalar(scale);
  }

  clone.updateMatrixWorld(true);
  const b2 = new THREE.Box3().setFromObject(clone);
  const c2 = new THREE.Vector3();
  b2.getCenter(c2);
  clone.position.x -= c2.x;
  clone.position.z -= c2.z;
  clone.position.y -= b2.min.y;
  clone.updateMatrixWorld(true);
}

/**
 * Bake Object3D world matrix into BufferGeometry so InstancedMesh placement is honest.
 * Geometry ends feet-at-origin, XZ centered, scaled to target footprint/height.
 */
function bakeNormalizedGeometry(
  clone: THREE.Object3D,
  scaleMode: TileableScaleMode,
  scaleTarget: number,
): { geometry: THREE.BufferGeometry; material: THREE.Material; height: number } | null {
  normalizeClone(clone, scaleMode, scaleTarget);
  clone.updateMatrixWorld(true);

  let mesh: THREE.Mesh | null = null;
  clone.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!mesh && m.isMesh && m.geometry) mesh = m;
  });
  if (!mesh) return null;

  const m = mesh as THREE.Mesh;
  m.updateWorldMatrix(true, false);
  let geometry = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
  geometry.applyMatrix4(m.matrixWorld);

  // Re-center after bake (world bake can leave residual offset)
  geometry.computeBoundingBox();
  const bb = geometry.boundingBox!;
  const cx = (bb.min.x + bb.max.x) * 0.5;
  const cz = (bb.min.z + bb.max.z) * 0.5;
  const minY = bb.min.y;
  geometry.translate(-cx, -minY, -cz);
  geometry.computeBoundingBox();
  const h = geometry.boundingBox!.max.y - geometry.boundingBox!.min.y;

  const material = Array.isArray(m.material) ? m.material[0]! : m.material;
  return { geometry, material, height: Math.max(0.05, h) };
}

function placeClone(
  clone: THREE.Object3D,
  x: number,
  z: number,
  rotY = 0,
  scaleMode: TileableScaleMode = "native",
  scaleTarget = 2,
  foundationTopY = 0,
): THREE.Group {
  if (scaleMode !== "native") normalizeClone(clone, scaleMode, scaleTarget);
  else {
    // Still drop feet to local 0 so foundation offset is predictable
    clone.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(clone);
    clone.position.y -= b.min.y;
  }

  const holder = new THREE.Group();
  // Sit ON the cube foundation top — not meshed through the cube volume
  holder.position.set(x, foundationTopY, z);
  holder.rotation.y = rotY;
  holder.add(clone);
  applyPixelTextures(holder);
  holder.userData.foundationTopY = foundationTopY;
  return holder;
}

function buildFloorGrid(
  scene: THREE.Object3D,
  parent: THREE.Group,
  config: TileableFloorConfig,
  geoms: Set<THREE.BufferGeometry>,
  mats: Set<THREE.Material>,
): number {
  const cell = config.cell ?? 2;
  const half = config.bounds - cell * 0.5;
  const cols = Math.floor((half * 2) / cell);
  const rows = cols;
  const grassMesh = config.grassMesh ?? "Grass_Tiles2_0";
  const stoneMesh = config.stoneMesh ?? "StoneTile_Tiles2_0";
  const ring = config.stoneRingCells ?? 2;

  const grassClone = cloneMeshBaked(scene, grassMesh);
  if (!grassClone) return 0;
  const grassBaked = bakeNormalizedGeometry(grassClone, "cell", cell);
  if (!grassBaked) return 0;

  let stoneBaked: ReturnType<typeof bakeNormalizedGeometry> = null;
  if (stoneMesh) {
    const sc = cloneMeshBaked(scene, stoneMesh);
    if (sc) stoneBaked = bakeNormalizedGeometry(sc, "cell", cell);
  }

  // Foundation top = max cube height (stone often thicker). Keep modest so camp
  // isn't a cliff — clamp visual cube height for walkability.
  const rawH = Math.max(grassBaked.height, stoneBaked?.height ?? 0);
  // Prefer a low foundation pad look (0.18–0.55 m) instead of full voxel pillars
  const foundationH = THREE.MathUtils.clamp(rawH > 1.2 ? 0.28 : rawH, 0.12, 0.55);

  // If author cubes are taller than our pad, squash geometry Y so top is foundationH
  const squashY = (geo: THREE.BufferGeometry, h: number) => {
    if (h < 1e-4) return;
    const s = foundationH / h;
    if (Math.abs(s - 1) < 0.02) return;
    geo.scale(1, s, 1);
    geo.computeBoundingBox();
  };
  squashY(grassBaked.geometry, grassBaked.height);
  if (stoneBaked) squashY(stoneBaked.geometry, stoneBaked.height);

  const grassCount = cols * rows;
  const grassInst = new THREE.InstancedMesh(
    grassBaked.geometry,
    grassBaked.material,
    grassCount,
  );
  grassInst.name = "campFloor_grass";
  grassInst.userData.campFoundation = true;
  geoms.add(grassBaked.geometry);
  mats.add(grassBaked.material);

  const stonePositions: THREE.Matrix4[] = [];
  const m = new THREE.Matrix4();
  const p = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3(1, 1, 1);
  let gi = 0;

  const col0 = -((cols - 1) * cell) / 2;
  const row0 = -((rows - 1) * cell) / 2;

  const roads = config.roads;
  const spokeHalf = roads?.spokeHalfWidth ?? 0.2;
  const ringRoads = roads?.ringCells ?? [];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cx = col - (cols - 1) / 2;
      const cz = row - (rows - 1) / 2;
      const dist = Math.max(Math.abs(cx), Math.abs(cz));
      const wx = col0 + col * cell;
      const wz = row0 + row * cell;
      const distWorld = Math.hypot(wx, wz);

      let isRoad = false;
      if (roads && distWorld > cell * 0.4) {
        if (roads.crossAxes && (Math.abs(cx) <= 0.55 || Math.abs(cz) <= 0.55)) {
          isRoad = true;
        }
        for (const ringCell of ringRoads) {
          if (Math.abs(dist - ringCell) < 0.55) isRoad = true;
        }
        if (roads.spokeAnglesDeg.length) {
          const angle = Math.atan2(wz, wx);
          for (const spokeDeg of roads.spokeAnglesDeg) {
            const spoke = (spokeDeg * Math.PI) / 180;
            let diff = Math.abs(angle - spoke);
            diff = Math.min(diff, Math.PI * 2 - diff);
            if (diff < spokeHalf && distWorld < half - cell) isRoad = true;
          }
        }
      }

      const isStone = stoneBaked && (isRoad || (dist <= ring && dist > 0));

      // Instance origin is cube FEET; top is foundationH. Place feet at y=0.
      p.set(wx, 0, wz);
      m.compose(p, q, s);

      if (isStone) {
        stonePositions.push(m.clone());
      } else {
        grassInst.setMatrixAt(gi++, m);
      }
    }
  }
  grassInst.count = gi;
  grassInst.instanceMatrix.needsUpdate = true;
  grassInst.receiveShadow = true;
  grassInst.castShadow = false;
  applyPixelTextures(grassInst);
  parent.add(grassInst);

  if (stoneBaked && stonePositions.length) {
    const stoneInst = new THREE.InstancedMesh(
      stoneBaked.geometry,
      stoneBaked.material,
      stonePositions.length,
    );
    stoneInst.name = "campFloor_stone";
    stoneInst.userData.campFoundation = true;
    geoms.add(stoneBaked.geometry);
    mats.add(stoneBaked.material);
    stonePositions.forEach((mat, i) => stoneInst.setMatrixAt(i, mat));
    stoneInst.instanceMatrix.needsUpdate = true;
    stoneInst.receiveShadow = true;
    stoneInst.castShadow = false;
    applyPixelTextures(stoneInst);
    parent.add(stoneInst);
  }

  parent.userData.foundationTopY = foundationH;
  parent.userData.floorCell = cell;
  return foundationH;
}

function placeScatter(
  scene: THREE.Object3D,
  parent: THREE.Group,
  placements: TileablePlacement[],
  foundationTopY: number,
) {
  for (const place of placements) {
    const meshName = resolveMeshName(place.mesh);
    const clone = cloneMeshBaked(scene, meshName);
    if (!clone) {
      if (import.meta.env.DEV) {
        console.warn(`[TileablePack] mesh not found: ${meshName}`);
      }
      continue;
    }
    // Extra lift for walls so they sit on the pad lip cleanly
    const cat = TILEABLE_MESH_BY_ID.get(place.mesh)?.category;
    const yBoost = cat === "wall" || cat === "corner" ? foundationTopY : foundationTopY;
    parent.add(
      placeClone(
        clone,
        place.x,
        place.z,
        place.rotY ?? 0,
        place.scaleMode ?? "native",
        place.scaleTarget ?? 2,
        yBoost,
      ),
    );
  }
}

/**
 * Load the tileable pack as a **graphed** camp floor (roads + rings) with props
 * on foundation tops — never stacked atlas origin.
 */
export function buildTileableCamp(
  loader: GLTFLoader,
  scene: THREE.Scene,
  opts: {
    url?: string;
    floor?: TileableFloorConfig;
    scatter?: TileablePlacement[];
    onReady?: (group: THREE.Group, foundationTopY: number) => void;
  } = {},
): TileablePackHandle {
  const group = new THREE.Group();
  group.name = "tileable_camp";
  scene.add(group);

  const geoms = new Set<THREE.BufferGeometry>();
  const mats = new Set<THREE.Material>();
  let foundationTopY = 0.22;

  const disposeTree = (root: THREE.Object3D) => {
    root.traverse((c) => {
      const mesh = c as THREE.Mesh;
      if (!mesh.isMesh) return;
      if (mesh.geometry && !geoms.has(mesh.geometry)) {
        mesh.geometry.dispose();
        geoms.add(mesh.geometry);
      }
      const list = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
      for (const mat of list) {
        if (!mat || mats.has(mat)) continue;
        const rec = mat as THREE.Material & Record<string, unknown>;
        for (const key of Object.keys(rec)) {
          const val = rec[key] as THREE.Texture | undefined;
          if (val?.isTexture) val.dispose();
        }
        mat.dispose();
        mats.add(mat);
      }
    });
  };

  loadGLTFCached(loader, opts.url ?? TILEABLE_PACK_URL).then(
    (gltf) => {
      if (group.userData.disposed) {
        return;
      }
      gltf.scene.updateMatrixWorld(true);
      applyPixelTextures(gltf.scene);

      if (opts.floor) {
        foundationTopY = buildFloorGrid(gltf.scene, group, opts.floor, geoms, mats) || foundationTopY;
      }
      if (opts.scatter?.length) {
        placeScatter(gltf.scene, group, opts.scatter, foundationTopY);
      }
      group.userData.foundationTopY = foundationTopY;
      opts.onReady?.(group, foundationTopY);
    },
    (err) => {
      if (import.meta.env.DEV) console.warn("[TileablePack] load failed:", err);
      opts.onReady?.(group, foundationTopY);
    },
  );

  return {
    group,
    get foundationTopY() {
      return (group.userData.foundationTopY as number) ?? foundationTopY;
    },
    dispose: () => {
      group.userData.disposed = true;
      scene.remove(group);
      disposeTree(group);
    },
  };
}
