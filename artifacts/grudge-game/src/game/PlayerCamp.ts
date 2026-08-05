/**
 * Player-built camps — fence perimeter + watchtower (no yellow claim ring).
 * Assets:
 *   models/buildings/modular_rusty_fences.glb
 *   models/buildings/old_wooden_watchtower.glb
 *
 * Camps block enemy spawn / entry and expose a tower man-slot for Grudge6.
 */

import * as THREE from "three";
import type { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { loadGLTFCached } from "./assets";

const MODELS = `${import.meta.env.BASE_URL}models/buildings`;
export const FENCE_URL = `${MODELS}/modular_rusty_fences.glb`;
export const TOWER_URL = `${MODELS}/old_wooden_watchtower.glb`;

/** Build cost (spent from resource bag — harvest trees/rocks first). */
export const CAMP_BUILD_COST = { wood: 16, stone: 8 } as const;

/** Target tower height in world meters (~3× player). */
const TOWER_HEIGHT = 5.6;
/** Fence panel height. */
const FENCE_HEIGHT = 2.15;
/** Preferred thin panel nodes from the rusty fence atlas (good length ~2m). */
const FENCE_PANEL_NAMES = [
  "Cube_3",
  "Cube005_5",
  "Cube006_6",
  "Cube007_0",
  "Cube011_1",
  "Cube004_10",
  "Cube012_13",
];

export interface PlayerCamp {
  id: string;
  position: THREE.Vector3;
  /** Safe radius — enemies cannot spawn or enter. */
  radius: number;
  group: THREE.Group;
  towerGroup: THREE.Group;
  /** World position for a Grudge6 lookout (tower platform). */
  manSlot: THREE.Vector3;
  /** Ally instance id currently manning (Grudge6 def id). */
  mannedAllyId: string | null;
  dispose: () => void;
}

export interface PlayerCampField {
  camps: PlayerCamp[];
  root: THREE.Group;
  dispose: () => void;
}

export function createPlayerCampField(scene: THREE.Scene): PlayerCampField {
  const root = new THREE.Group();
  root.name = "PlayerCamps";
  scene.add(root);
  const camps: PlayerCamp[] = [];
  return {
    camps,
    root,
    dispose: () => {
      for (const c of camps) c.dispose();
      camps.length = 0;
      scene.remove(root);
      root.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        m.geometry?.dispose();
        const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
        for (const mat of mats) mat.dispose();
      });
    },
  };
}

export function isInsidePlayerCamp(
  field: PlayerCampField | null | undefined,
  x: number,
  z: number,
  pad = 0,
): PlayerCamp | null {
  if (!field) return null;
  for (const c of field.camps) {
    if (Math.hypot(x - c.position.x, z - c.position.z) <= c.radius + pad) return c;
  }
  return null;
}

export function nearestPlayerCamp(
  field: PlayerCampField | null | undefined,
  x: number,
  z: number,
  maxDist = 16,
): PlayerCamp | null {
  if (!field) return null;
  let best: PlayerCamp | null = null;
  let bestD = maxDist;
  for (const c of field.camps) {
    const d = Math.hypot(x - c.position.x, z - c.position.z);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

/** Push a point outward to the rim of the nearest camp (if inside). */
export function pushOutOfCamps(
  field: PlayerCampField | null | undefined,
  pos: THREE.Vector3,
  pad = 0.6,
): boolean {
  const c = isInsidePlayerCamp(field, pos.x, pos.z, 0);
  if (!c) return false;
  const dx = pos.x - c.position.x;
  const dz = pos.z - c.position.z;
  const d = Math.hypot(dx, dz) || 0.001;
  const r = c.radius + pad;
  pos.x = c.position.x + (dx / d) * r;
  pos.z = c.position.z + (dz / d) * r;
  return true;
}

function applyShadows(root: THREE.Object3D) {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
      if ((m as THREE.SkinnedMesh).isSkinnedMesh) m.frustumCulled = false;
    }
  });
}

/** Clone a named prop from an atlas, baking source world matrix, feet-planted. */
function cloneNamedProp(scene: THREE.Object3D, name: string): THREE.Object3D | null {
  let src: THREE.Object3D | null = null;
  scene.traverse((o) => {
    if (!src && o.name === name) src = o;
  });
  if (!src) {
    scene.traverse((o) => {
      if (!src && o.name.toLowerCase().includes(name.toLowerCase())) src = o;
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

function fitHeight(holder: THREE.Group, targetH: number) {
  holder.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(holder);
  const size = new THREE.Vector3();
  b.getSize(size);
  if (size.y > 0.05) {
    holder.scale.multiplyScalar(targetH / size.y);
  }
  holder.updateMatrixWorld(true);
  const b2 = new THREE.Box3().setFromObject(holder);
  holder.position.y -= b2.min.y;
}

function fitPanelAlongZ(holder: THREE.Group, targetH: number) {
  fitHeight(holder, targetH);
  // Re-center XZ under origin for ring placement
  holder.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(holder);
  const c = new THREE.Vector3();
  b.getCenter(c);
  holder.position.x -= c.x;
  holder.position.z -= c.z;
  holder.updateMatrixWorld(true);
  const b2 = new THREE.Box3().setFromObject(holder);
  holder.position.y -= b2.min.y;
}

/**
 * Build a fenced camp with watchtower at `position`.
 * Returns immediately with empty group; meshes stream in async.
 */
export function buildPlayerCamp(
  field: PlayerCampField,
  loader: GLTFLoader,
  opts: {
    position: THREE.Vector3;
    radius?: number;
    seed?: number;
    id?: string;
  },
): PlayerCamp {
  const radius = opts.radius ?? 11;
  const id = opts.id ?? `camp_${field.camps.length}_${(opts.seed ?? Date.now()) >>> 0}`;
  const group = new THREE.Group();
  group.name = id;
  group.position.copy(opts.position);
  group.position.y = 0;
  field.root.add(group);

  const towerGroup = new THREE.Group();
  towerGroup.name = "Watchtower";
  // Slight offset so tower isn't dead-center of harvest nodes
  towerGroup.position.set(0.4, 0, -0.6);
  group.add(towerGroup);

  // Soft ground disc (subtle, not yellow ring)
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(radius * 0.92, 32),
    new THREE.MeshStandardMaterial({
      color: 0x3a3428,
      roughness: 0.95,
      metalness: 0.05,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0.03;
  ground.receiveShadow = true;
  group.add(ground);

  // Small claim flag pole (not the yellow ring)
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.07, 2.2, 8),
    new THREE.MeshStandardMaterial({ color: 0x2a241c, roughness: 0.7, metalness: 0.2 }),
  );
  pole.position.set(-radius * 0.35, 1.1, radius * 0.2);
  pole.castShadow = true;
  group.add(pole);
  const banner = new THREE.Mesh(
    new THREE.PlaneGeometry(0.9, 0.55),
    new THREE.MeshStandardMaterial({
      color: 0xc5a059,
      side: THREE.DoubleSide,
      roughness: 0.6,
    }),
  );
  banner.position.set(-radius * 0.35 + 0.45, 1.85, radius * 0.2);
  group.add(banner);

  // Manning height estimate until tower loads (~72% of tower height)
  const manSlot = new THREE.Vector3(
    opts.position.x + towerGroup.position.x,
    TOWER_HEIGHT * 0.72,
    opts.position.z + towerGroup.position.z,
  );

  let disposed = false;
  const camp: PlayerCamp = {
    id,
    position: opts.position.clone(),
    radius,
    group,
    towerGroup,
    manSlot,
    mannedAllyId: null,
    dispose: () => {
      disposed = true;
      field.root.remove(group);
      group.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        m.geometry?.dispose();
        const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
        for (const mat of mats) mat.dispose();
      });
    },
  };
  field.camps.push(camp);

  // --- Fence ring ---
  void loadGLTFCached(loader, FENCE_URL).then((gltf) => {
    if (disposed) return;
    gltf.scene.updateMatrixWorld(true);
    const panels: THREE.Object3D[] = [];
    for (const n of FENCE_PANEL_NAMES) {
      const c = cloneNamedProp(gltf.scene, n);
      if (c) panels.push(c);
    }
    // Fallback: any Cube* child under root
    if (!panels.length) {
      gltf.scene.traverse((o) => {
        if (/^Cube\d*/i.test(o.name) && o.children.some((ch) => (ch as THREE.Mesh).isMesh)) {
          const c = cloneNamedProp(gltf.scene, o.name);
          if (c) panels.push(c);
        }
      });
    }
    if (!panels.length) return;

    // Circumference / panel length ≈ count
    const panelLen = 2.05;
    const count = Math.max(8, Math.round((Math.PI * 2 * radius) / panelLen));
    for (let i = 0; i < count; i++) {
      const ang = (i / count) * Math.PI * 2;
      const src = panels[i % panels.length]!;
      const clone = src.clone(true);
      const holder = new THREE.Group();
      holder.add(clone);
      fitPanelAlongZ(holder, FENCE_HEIGHT);
      // Place along ring; face outward
      const x = Math.sin(ang) * radius;
      const z = Math.cos(ang) * radius;
      holder.position.set(x, 0, z);
      holder.rotation.y = ang + Math.PI; // panel faces outward
      applyShadows(holder);
      holder.userData.fencePanel = true;
      group.add(holder);
    }
  });

  // --- Watchtower ---
  void loadGLTFCached(loader, TOWER_URL).then((gltf) => {
    if (disposed) return;
    const root = gltf.scene.clone(true);
    const holder = new THREE.Group();
    holder.add(root);
    // Reset scale then fit height
    root.position.set(0, 0, 0);
    root.scale.set(1, 1, 1);
    holder.updateMatrixWorld(true);
    fitHeight(holder, TOWER_HEIGHT);
    // Cap footprint so tower doesn't eat half the yard
    holder.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(holder);
    const s = new THREE.Vector3();
    b.getSize(s);
    const foot = Math.max(s.x, s.z);
    if (foot > 4.5) {
      holder.scale.multiplyScalar(4.2 / foot);
      holder.updateMatrixWorld(true);
      const b2 = new THREE.Box3().setFromObject(holder);
      holder.position.y -= b2.min.y;
    }
    applyShadows(holder);
    towerGroup.add(holder);

    // Recompute man slot from final tower bbox (platform ~70% height)
    towerGroup.updateMatrixWorld(true);
    const worldBox = new THREE.Box3().setFromObject(towerGroup);
    const topY = worldBox.max.y;
    const botY = worldBox.min.y;
    const platformY = botY + (topY - botY) * 0.68;
    const center = new THREE.Vector3();
    worldBox.getCenter(center);
    camp.manSlot.set(center.x, platformY, center.z);
  });

  return camp;
}
