import * as THREE from "three";
import type { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  TILEABLE_PACK_URL,
  TILEABLE_MESH_BY_ID,
  type TileableFloorConfig,
  type TileablePlacement,
  type TileableScaleMode,
} from "../data/tileablePixelPack";

export interface TileablePackHandle {
  group: THREE.Group;
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

function normalizeClone(
  clone: THREE.Object3D,
  scaleMode: TileableScaleMode,
  scaleTarget: number,
): void {
  const { box, size, center } = measureBox(clone);
  let scale = 1;
  if (scaleMode === "cell" || scaleMode === "footprint") {
    const footprint = Math.max(size.x, size.z) || 1;
    scale = scaleTarget / footprint;
  } else if (scaleMode === "height") {
    scale = scaleTarget / (size.y || 1);
  }
  if (scaleMode !== "native" && scale > 0) clone.scale.multiplyScalar(scale);

  clone.updateMatrixWorld(true);
  const b2 = new THREE.Box3().setFromObject(clone);
  const c2 = new THREE.Vector3();
  b2.getCenter(c2);
  clone.position.x -= c2.x;
  clone.position.z -= c2.z;
  clone.position.y -= b2.min.y;
}

function placeClone(
  clone: THREE.Object3D,
  x: number,
  z: number,
  rotY = 0,
  scaleMode: TileableScaleMode = "native",
  scaleTarget = 2,
): THREE.Group {
  if (scaleMode !== "native") normalizeClone(clone, scaleMode, scaleTarget);

  const holder = new THREE.Group();
  holder.position.set(x, 0, z);
  holder.rotation.y = rotY;
  holder.add(clone);
  applyPixelTextures(holder);
  return holder;
}

function extractInstancedSource(
  scene: THREE.Object3D,
  meshName: string,
): { geometry: THREE.BufferGeometry; material: THREE.Material } | null {
  const clone = cloneMeshBaked(scene, meshName);
  if (!clone) return null;

  let geometry: THREE.BufferGeometry | null = null;
  let material: THREE.Material | null = null;
  clone.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || geometry) return;
    geometry = m.geometry;
    material = Array.isArray(m.material) ? m.material[0] : m.material;
  });
  if (!geometry || !material) return null;

  normalizeClone(clone, "cell", 2);
  clone.updateMatrixWorld(true);
  return { geometry, material };
}

function buildFloorGrid(
  scene: THREE.Object3D,
  parent: THREE.Group,
  config: TileableFloorConfig,
  geoms: Set<THREE.BufferGeometry>,
  mats: Set<THREE.Material>,
) {
  const cell = config.cell ?? 2;
  const half = config.bounds - cell * 0.5;
  const cols = Math.floor((half * 2) / cell);
  const rows = cols;
  const grassMesh = config.grassMesh ?? "Grass_Tiles2_0";
  const stoneMesh = config.stoneMesh ?? "StoneTile_Tiles2_0";
  const ring = config.stoneRingCells ?? 2;

  const grassSrc = extractInstancedSource(scene, grassMesh);
  const stoneSrc = extractInstancedSource(scene, stoneMesh);
  if (!grassSrc) return;

  const grassCount = cols * rows;
  const grassInst = new THREE.InstancedMesh(grassSrc.geometry, grassSrc.material, grassCount);
  geoms.add(grassSrc.geometry);
  mats.add(grassSrc.material);

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

      const isStone = stoneSrc && (isRoad || (dist <= ring && dist > 0));

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
  applyPixelTextures(grassInst);
  parent.add(grassInst);

  if (stoneSrc && stonePositions.length) {
    const stoneInst = new THREE.InstancedMesh(
      stoneSrc.geometry,
      stoneSrc.material,
      stonePositions.length,
    );
    geoms.add(stoneSrc.geometry);
    mats.add(stoneSrc.material);
    stonePositions.forEach((mat, i) => stoneInst.setMatrixAt(i, mat));
    stoneInst.instanceMatrix.needsUpdate = true;
    stoneInst.receiveShadow = true;
    applyPixelTextures(stoneInst);
    parent.add(stoneInst);
  }
}

function placeScatter(
  scene: THREE.Object3D,
  parent: THREE.Group,
  placements: TileablePlacement[],
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
    parent.add(
      placeClone(
        clone,
        place.x,
        place.z,
        place.rotY ?? 0,
        place.scaleMode ?? "native",
        place.scaleTarget ?? 2,
      ),
    );
  }
}

/**
 * Load the tileable pixel atlas and build a modular camp environment:
 * instanced grass/stone floor grid plus scattered trees, rocks, walls, and buildings.
 */
export function buildTileableCamp(
  loader: GLTFLoader,
  scene: THREE.Scene,
  opts: {
    url?: string;
    floor?: TileableFloorConfig;
    scatter?: TileablePlacement[];
  } = {},
): TileablePackHandle {
  const group = new THREE.Group();
  group.name = "tileable_camp";
  scene.add(group);

  const geoms = new Set<THREE.BufferGeometry>();
  const mats = new Set<THREE.Material>();

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

  loader.load(
    opts.url ?? TILEABLE_PACK_URL,
    (gltf) => {
      if (group.userData.disposed) {
        disposeTree(gltf.scene);
        return;
      }
      gltf.scene.updateMatrixWorld(true);
      applyPixelTextures(gltf.scene);

      if (opts.floor) buildFloorGrid(gltf.scene, group, opts.floor, geoms, mats);
      if (opts.scatter?.length) placeScatter(gltf.scene, group, opts.scatter);
    },
    undefined,
    (err) => {
      if (import.meta.env.DEV) console.warn("[TileablePack] load failed:", err);
    },
  );

  return {
    group,
    dispose: () => {
      group.userData.disposed = true;
      scene.remove(group);
      disposeTree(group);
    },
  };
}