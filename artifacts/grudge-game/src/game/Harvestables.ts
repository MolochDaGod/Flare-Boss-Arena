import * as THREE from "three";
import type { ResourceId } from "../data/resources";

/**
 * Generative harvestables for the dungeon island:
 *  - Tall trees (2×–4× character height ≈ 3.8–7.6u) as wood nodes
 *  - Boulder / ore piles as stone nodes
 *
 * Trees and stones are instanced for draw-call efficiency, but each harvest
 * NODE is a CPU-side record with HP so the player can attack them like enemies.
 */

export type HarvestKind = "wood" | "stone";

export interface HarvestNode {
  id: string;
  kind: HarvestKind;
  position: THREE.Vector3;
  hp: number;
  maxHp: number;
  /** Instance index into the shared InstancedMesh (or -1 if solo mesh). */
  instanceIndex: number;
  respawnAt: number;
  yieldMin: number;
  yieldMax: number;
  /** Visual group for solo meshes (stump / rubble). */
  marker?: THREE.Object3D;
}

export interface HarvestField {
  nodes: HarvestNode[];
  treeMesh: THREE.InstancedMesh | null;
  canopyMesh: THREE.InstancedMesh | null;
  stoneMesh: THREE.InstancedMesh | null;
  root: THREE.Group;
  dispose: () => void;
}

const CHAR_HEIGHT = 1.9;
const TREE_HEIGHT_MIN = CHAR_HEIGHT * 2.2; // ~4.2u
const TREE_HEIGHT_MAX = CHAR_HEIGHT * 4.0; // ~7.6u

function mulberry32(seed: number) {
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
 * Build a generative forest + rock-node field.
 * @param seed - island generation seed (captain re-sails change this)
 * @param arenaHalf - playable half-extent (DUNGEON)
 */
export function buildHarvestField(
  seed: number,
  arenaHalf: number,
  opts?: { treeCount?: number; stoneCount?: number },
): HarvestField {
  const rng = mulberry32(seed);
  const treeCount = opts?.treeCount ?? 48;
  const stoneCount = opts?.stoneCount ?? 28;
  const root = new THREE.Group();
  root.name = "HarvestField";

  const nodes: HarvestNode[] = [];
  let idCounter = 0;

  // ── Trees: trunk (cylinder) + canopy (cone stack) as two InstancedMeshes ──
  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.38, 1, 7);
  trunkGeo.translate(0, 0.5, 0); // pivot at base
  const canopyGeo = new THREE.ConeGeometry(1, 1.4, 8);
  canopyGeo.translate(0, 0.7, 0);

  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3d2a18, roughness: 0.92 });
  const canopyMat = new THREE.MeshStandardMaterial({ color: 0x1f4a28, roughness: 0.85 });

  const treeMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCount);
  const canopyMesh = new THREE.InstancedMesh(canopyGeo, canopyMat, treeCount);
  treeMesh.castShadow = canopyMesh.castShadow = true;
  treeMesh.receiveShadow = canopyMesh.receiveShadow = true;
  treeMesh.frustumCulled = canopyMesh.frustumCulled = false;

  const dummy = new THREE.Object3D();
  const innerClear = 10; // keep spawn clear
  const outer = arenaHalf - 6;

  for (let i = 0; i < treeCount; i++) {
    let x = 0;
    let z = 0;
    let tries = 0;
    do {
      const a = rng() * Math.PI * 2;
      const r = innerClear + rng() * (outer - innerClear);
      x = Math.cos(a) * r;
      z = Math.sin(a) * r;
      // Bias trees away from cove (east) and center combat.
      if (x > 50 && Math.abs(z + 14) < 18) {
        x -= 20;
      }
      tries++;
    } while (Math.hypot(x, z) < innerClear && tries < 12);

    const h = TREE_HEIGHT_MIN + rng() * (TREE_HEIGHT_MAX - TREE_HEIGHT_MIN);
    const trunkH = h * 0.42;
    const canopyH = h * 0.62;
    const canopyR = 1.1 + rng() * 1.4;
    const yaw = rng() * Math.PI * 2;

    dummy.position.set(x, 0, z);
    dummy.rotation.set(0, yaw, 0);
    dummy.scale.set(0.85 + rng() * 0.4, trunkH, 0.85 + rng() * 0.4);
    dummy.updateMatrix();
    treeMesh.setMatrixAt(i, dummy.matrix);

    dummy.position.set(x, trunkH * 0.72, z);
    dummy.scale.set(canopyR, canopyH, canopyR);
    dummy.updateMatrix();
    canopyMesh.setMatrixAt(i, dummy.matrix);

    nodes.push({
      id: `tree_${idCounter++}`,
      kind: "wood",
      position: new THREE.Vector3(x, 0, z),
      hp: 40 + Math.floor(rng() * 30),
      maxHp: 0, // filled below
      instanceIndex: i,
      respawnAt: 0,
      yieldMin: 2,
      yieldMax: 5,
    });
    nodes[nodes.length - 1]!.maxHp = nodes[nodes.length - 1]!.hp;
  }
  treeMesh.instanceMatrix.needsUpdate = true;
  canopyMesh.instanceMatrix.needsUpdate = true;
  root.add(treeMesh);
  root.add(canopyMesh);

  // ── Stone nodes: stacked dodecahedra clusters ──
  const stoneGeo = new THREE.DodecahedronGeometry(0.55, 0);
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x5a554c, roughness: 0.95, flatShading: true });
  // 3 rocks per node
  const rocksPerNode = 3;
  const stoneMesh = new THREE.InstancedMesh(stoneGeo, stoneMat, stoneCount * rocksPerNode);
  stoneMesh.castShadow = true;
  stoneMesh.receiveShadow = true;
  stoneMesh.frustumCulled = false;

  let stoneInst = 0;
  for (let i = 0; i < stoneCount; i++) {
    let x = 0;
    let z = 0;
    let tries = 0;
    do {
      x = (rng() * 2 - 1) * (outer * 0.92);
      z = (rng() * 2 - 1) * (outer * 0.92);
      tries++;
    } while (Math.hypot(x, z) < 8 && tries < 16);

    for (let k = 0; k < rocksPerNode; k++) {
      const ox = (rng() - 0.5) * 1.1;
      const oz = (rng() - 0.5) * 1.1;
      const s = 0.7 + rng() * 1.1;
      dummy.position.set(x + ox, s * 0.35, z + oz);
      dummy.rotation.set(rng() * 1.2, rng() * Math.PI * 2, rng() * 0.8);
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      stoneMesh.setMatrixAt(stoneInst++, dummy.matrix);
    }

    nodes.push({
      id: `stone_${idCounter++}`,
      kind: "stone",
      position: new THREE.Vector3(x, 0, z),
      hp: 50 + Math.floor(rng() * 40),
      maxHp: 0,
      instanceIndex: i,
      respawnAt: 0,
      yieldMin: 2,
      yieldMax: 4,
    });
    nodes[nodes.length - 1]!.maxHp = nodes[nodes.length - 1]!.hp;
  }
  stoneMesh.instanceMatrix.needsUpdate = true;
  root.add(stoneMesh);

  const hideMatrix = new THREE.Matrix4().makeScale(0, 0, 0);

  const field: HarvestField = {
    nodes,
    treeMesh,
    canopyMesh,
    stoneMesh,
    root,
    dispose: () => {
      root.removeFromParent();
      trunkGeo.dispose();
      canopyGeo.dispose();
      stoneGeo.dispose();
      trunkMat.dispose();
      canopyMat.dispose();
      stoneMat.dispose();
      treeMesh.dispose();
      canopyMesh.dispose();
      stoneMesh.dispose();
    },
  };

  // Helpers attached via closure for hide/show on harvest
  (field as HarvestField & { hideNode: (n: HarvestNode) => void; showNode: (n: HarvestNode) => void }).hideNode =
    (n: HarvestNode) => {
      if (n.kind === "wood" && treeMesh && canopyMesh && n.instanceIndex >= 0) {
        treeMesh.setMatrixAt(n.instanceIndex, hideMatrix);
        canopyMesh.setMatrixAt(n.instanceIndex, hideMatrix);
        treeMesh.instanceMatrix.needsUpdate = true;
        canopyMesh.instanceMatrix.needsUpdate = true;
      }
      // Stone nodes stay as rubble (scale down cluster) — leave visible small
    };

  (field as HarvestField & { showNode: (n: HarvestNode) => void }).showNode = (n: HarvestNode) => {
    // Respawn handled by rebuild or re-apply stored matrices — simple full respawn:
    // regenerate matrices from node position for trees.
    if (n.kind === "wood" && treeMesh && canopyMesh && n.instanceIndex >= 0) {
      const h = TREE_HEIGHT_MIN + ((n.instanceIndex * 17) % 100) / 100 * (TREE_HEIGHT_MAX - TREE_HEIGHT_MIN);
      const trunkH = h * 0.42;
      const canopyH = h * 0.62;
      dummy.position.copy(n.position);
      dummy.rotation.set(0, n.instanceIndex, 0);
      dummy.scale.set(1, trunkH, 1);
      dummy.updateMatrix();
      treeMesh.setMatrixAt(n.instanceIndex, dummy.matrix);
      dummy.position.set(n.position.x, trunkH * 0.72, n.position.z);
      dummy.scale.set(1.4, canopyH, 1.4);
      dummy.updateMatrix();
      canopyMesh.setMatrixAt(n.instanceIndex, dummy.matrix);
      treeMesh.instanceMatrix.needsUpdate = true;
      canopyMesh.instanceMatrix.needsUpdate = true;
    }
  };

  return field;
}

export function hideHarvestNode(field: HarvestField, n: HarvestNode) {
  const hideMatrix = new THREE.Matrix4().makeScale(0.001, 0.001, 0.001);
  if (n.kind === "wood" && field.treeMesh && field.canopyMesh && n.instanceIndex >= 0) {
    field.treeMesh.setMatrixAt(n.instanceIndex, hideMatrix);
    field.canopyMesh.setMatrixAt(n.instanceIndex, hideMatrix);
    field.treeMesh.instanceMatrix.needsUpdate = true;
    field.canopyMesh.instanceMatrix.needsUpdate = true;
  }
}

export function showHarvestNode(field: HarvestField, n: HarvestNode) {
  if (n.kind !== "wood" || !field.treeMesh || !field.canopyMesh || n.instanceIndex < 0) return;
  const dummy = new THREE.Object3D();
  const h = TREE_HEIGHT_MIN + ((n.instanceIndex * 17) % 100) / 100 * (TREE_HEIGHT_MAX - TREE_HEIGHT_MIN);
  const trunkH = h * 0.42;
  const canopyH = h * 0.62;
  dummy.position.copy(n.position);
  dummy.rotation.set(0, n.instanceIndex * 0.7, 0);
  dummy.scale.set(1, trunkH, 1);
  dummy.updateMatrix();
  field.treeMesh.setMatrixAt(n.instanceIndex, dummy.matrix);
  dummy.position.set(n.position.x, trunkH * 0.72, n.position.z);
  dummy.scale.set(1.4, canopyH, 1.4);
  dummy.updateMatrix();
  field.canopyMesh.setMatrixAt(n.instanceIndex, dummy.matrix);
  field.treeMesh.instanceMatrix.needsUpdate = true;
  field.canopyMesh.instanceMatrix.needsUpdate = true;
}

export function resourceForKind(kind: HarvestKind): ResourceId {
  return kind === "wood" ? "wood" : "stone";
}

export function nearestHarvestNode(
  nodes: HarvestNode[],
  pos: THREE.Vector3,
  maxDist: number,
  now: number,
): HarvestNode | null {
  let best: HarvestNode | null = null;
  let bestD = maxDist;
  for (const n of nodes) {
    if (n.hp <= 0 && now < n.respawnAt) continue;
    if (n.hp <= 0) continue;
    const d = Math.hypot(n.position.x - pos.x, n.position.z - pos.z);
    if (d < bestD) {
      bestD = d;
      best = n;
    }
  }
  return best;
}
