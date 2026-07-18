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

export type HarvestKind = "wood" | "stone" | "herb";

export interface HarvestNode {
  id: string;
  kind: HarvestKind;
  position: THREE.Vector3;
  hp: number;
  maxHp: number;
  /** Instance index into the shared InstancedMesh (or -1 if solo mesh). */
  instanceIndex: number;
  /**
   * For stone clusters: first instance index and count (default 1).
   * Field stones use rocksPerNode=3; island rock field uses 1 per boulder.
   */
  instanceStart?: number;
  instanceCount?: number;
  /** Which mesh bank: "stone" (harvest pile) or "rock" (island rock field). */
  meshBank?: "stone" | "rock" | "wood" | "herb" | "scripted";
  /** Original scale for rock-field respawn. */
  rockScale?: number;
  respawnAt: number;
  yieldMin: number;
  yieldMax: number;
  /** Visual group for solo meshes (stump / rubble / herb / claim node). */
  marker?: THREE.Object3D;
  /** uMMORPG scripted def id. */
  defId?: string;
  /** Scripted respawn seconds (overrides default). */
  respawnSec?: number;
  displayName?: string;
}

export interface HarvestField {
  nodes: HarvestNode[];
  treeMesh: THREE.InstancedMesh | null;
  canopyMesh: THREE.InstancedMesh | null;
  stoneMesh: THREE.InstancedMesh | null;
  /** Island decorative rocks (also minable). */
  rockMesh: THREE.InstancedMesh | null;
  rockScales: number[];
  rocksPerNode: number;
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

    const start = i * rocksPerNode;
    nodes.push({
      id: `stone_${idCounter++}`,
      kind: "stone",
      position: new THREE.Vector3(x, 0, z),
      hp: 50 + Math.floor(rng() * 40),
      maxHp: 0,
      instanceIndex: i,
      instanceStart: start,
      instanceCount: rocksPerNode,
      meshBank: "stone",
      respawnAt: 0,
      yieldMin: 2,
      yieldMax: 5,
    });
    nodes[nodes.length - 1]!.maxHp = nodes[nodes.length - 1]!.hp;
  }
  stoneMesh.instanceMatrix.needsUpdate = true;
  root.add(stoneMesh);

  // Also mark tree nodes with meshBank
  for (const n of nodes) {
    if (n.kind === "wood") n.meshBank = "wood";
  }

  const field: HarvestField = {
    nodes,
    treeMesh,
    canopyMesh,
    stoneMesh,
    rockMesh: null,
    rockScales: [],
    rocksPerNode,
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
      // rockMesh is owned by GameEngine scene dispose
    },
  };

  return field;
}

/**
 * Register island rock-field boulders as minable stone nodes (1 instance each).
 * Call after makeRockField; attaches mesh reference on the harvest field.
 */
export function attachRockFieldNodes(
  field: HarvestField,
  rockMesh: THREE.InstancedMesh,
  positions: THREE.Vector3[],
  scales: number[],
) {
  field.rockMesh = rockMesh;
  field.rockScales = scales;
  let id = field.nodes.length;
  for (let i = 0; i < positions.length; i++) {
    const p = positions[i]!;
    const s = scales[i] ?? 1;
    const hp = 35 + Math.floor(s * 28);
    field.nodes.push({
      id: `rock_${id++}`,
      kind: "stone",
      position: p.clone(),
      hp,
      maxHp: hp,
      instanceIndex: i,
      instanceStart: i,
      instanceCount: 1,
      meshBank: "rock",
      rockScale: s,
      respawnAt: 0,
      yieldMin: 1,
      yieldMax: 3 + Math.floor(s),
    });
  }
}

const _hide = new THREE.Matrix4().makeScale(0.001, 0.001, 0.001);
const _dummy = new THREE.Object3D();

export function hideHarvestNode(field: HarvestField, n: HarvestNode) {
  if (n.kind === "wood" && field.treeMesh && field.canopyMesh && n.instanceIndex >= 0) {
    field.treeMesh.setMatrixAt(n.instanceIndex, _hide);
    field.canopyMesh.setMatrixAt(n.instanceIndex, _hide);
    field.treeMesh.instanceMatrix.needsUpdate = true;
    field.canopyMesh.instanceMatrix.needsUpdate = true;
    return;
  }
  if (n.kind === "stone") {
    const bank = n.meshBank === "rock" ? field.rockMesh : field.stoneMesh;
    if (!bank) return;
    const start = n.instanceStart ?? n.instanceIndex;
    const count = n.instanceCount ?? 1;
    for (let k = 0; k < count; k++) {
      bank.setMatrixAt(start + k, _hide);
    }
    bank.instanceMatrix.needsUpdate = true;
  }
}

export function showHarvestNode(field: HarvestField, n: HarvestNode) {
  if (n.kind === "wood" && field.treeMesh && field.canopyMesh && n.instanceIndex >= 0) {
    const h = TREE_HEIGHT_MIN + ((n.instanceIndex * 17) % 100) / 100 * (TREE_HEIGHT_MAX - TREE_HEIGHT_MIN);
    const trunkH = h * 0.42;
    const canopyH = h * 0.62;
    _dummy.position.copy(n.position);
    _dummy.rotation.set(0, n.instanceIndex * 0.7, 0);
    _dummy.scale.set(1, trunkH, 1);
    _dummy.updateMatrix();
    field.treeMesh.setMatrixAt(n.instanceIndex, _dummy.matrix);
    _dummy.position.set(n.position.x, trunkH * 0.72, n.position.z);
    _dummy.scale.set(1.4, canopyH, 1.4);
    _dummy.updateMatrix();
    field.canopyMesh.setMatrixAt(n.instanceIndex, _dummy.matrix);
    field.treeMesh.instanceMatrix.needsUpdate = true;
    field.canopyMesh.instanceMatrix.needsUpdate = true;
    return;
  }
  if (n.kind === "stone" && n.meshBank === "rock" && field.rockMesh) {
    const s = n.rockScale ?? 1;
    _dummy.position.set(n.position.x, s * 0.45 - 0.05, n.position.z);
    _dummy.rotation.set(0.3, n.instanceIndex * 0.9, 0.2);
    _dummy.scale.set(s, s * 0.8, s);
    _dummy.updateMatrix();
    field.rockMesh.setMatrixAt(n.instanceIndex, _dummy.matrix);
    field.rockMesh.instanceMatrix.needsUpdate = true;
    return;
  }
  if (n.kind === "stone" && field.stoneMesh) {
    const start = n.instanceStart ?? n.instanceIndex * field.rocksPerNode;
    const count = n.instanceCount ?? field.rocksPerNode;
    for (let k = 0; k < count; k++) {
      const ox = ((k * 0.7) % 1.1) - 0.55;
      const oz = ((k * 0.5) % 1.1) - 0.55;
      const s = 0.75 + k * 0.15;
      _dummy.position.set(n.position.x + ox, s * 0.35, n.position.z + oz);
      _dummy.rotation.set(0.4, k, 0.2);
      _dummy.scale.setScalar(s);
      _dummy.updateMatrix();
      field.stoneMesh.setMatrixAt(start + k, _dummy.matrix);
    }
    field.stoneMesh.instanceMatrix.needsUpdate = true;
  }
}

export function resourceForKind(kind: HarvestKind): ResourceId {
  if (kind === "wood") return "wood";
  if (kind === "herb") return "herb";
  return "stone";
}

/**
 * Spawn uMMORPG-scripted harvest nodes (claim flags, event dens).
 * Uses dedicated marker meshes so they don't steal instanced slots.
 */
export function spawnScriptedHarvestNodes(
  field: HarvestField,
  spawns: Array<{
    defId: string;
    name: string;
    kind: HarvestKind;
    position: THREE.Vector3;
    hp: number;
    yieldMin: number;
    yieldMax: number;
    respawnSec: number;
  }>,
): HarvestNode[] {
  const created: HarvestNode[] = [];
  for (const s of spawns) {
    const marker = new THREE.Group();
    marker.position.copy(s.position);
    if (s.kind === "wood") {
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.32, 2.4, 7),
        new THREE.MeshStandardMaterial({ color: 0x3d2a18, roughness: 0.9 }),
      );
      trunk.position.y = 1.2;
      trunk.castShadow = true;
      const canopy = new THREE.Mesh(
        new THREE.ConeGeometry(1.1, 1.6, 8),
        new THREE.MeshStandardMaterial({ color: 0x1f4a28, roughness: 0.85 }),
      );
      canopy.position.y = 2.6;
      canopy.castShadow = true;
      marker.add(trunk, canopy);
    } else if (s.kind === "herb") {
      const mat = new THREE.MeshStandardMaterial({
        color: 0x3a8a4a,
        emissive: 0x1a4020,
        emissiveIntensity: 0.35,
        roughness: 0.7,
      });
      for (let i = 0; i < 5; i++) {
        const blade = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.55, 5), mat);
        blade.position.set((i % 3) * 0.25 - 0.25, 0.25, Math.floor(i / 3) * 0.22 - 0.1);
        blade.rotation.z = (i - 2) * 0.15;
        marker.add(blade);
      }
    } else {
      const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.55, 0),
        new THREE.MeshStandardMaterial({ color: 0x6a6660, roughness: 0.92, metalness: 0.15 }),
      );
      rock.position.y = 0.4;
      rock.castShadow = true;
      marker.add(rock);
    }
    field.root.add(marker);
    const node: HarvestNode = {
      id: `scripted_${field.nodes.length}_${s.defId}`,
      kind: s.kind,
      position: s.position.clone(),
      hp: s.hp,
      maxHp: s.hp,
      instanceIndex: -1,
      meshBank: "scripted",
      respawnAt: 0,
      yieldMin: s.yieldMin,
      yieldMax: s.yieldMax,
      marker,
      defId: s.defId,
      respawnSec: s.respawnSec,
      displayName: s.name,
    };
    field.nodes.push(node);
    created.push(node);
  }
  return created;
}

/** Apply melee damage to a harvest node; returns yield granted on depletion. */
export function damageHarvestNode(
  field: HarvestField,
  node: HarvestNode,
  damage: number,
  now: number,
): { depleted: boolean; yieldAmount: number } {
  if (node.hp <= 0) return { depleted: false, yieldAmount: 0 };
  node.hp = Math.max(0, node.hp - damage);
  if (node.hp > 0) return { depleted: false, yieldAmount: 0 };

  hideHarvestNode(field, node);
  if (node.marker) node.marker.visible = false;
  const span = Math.max(0, node.yieldMax - node.yieldMin);
  const yieldAmount = node.yieldMin + Math.floor(Math.random() * (span + 1));
  const respawn = node.respawnSec ?? 45 + Math.random() * 30;
  node.respawnAt = now + respawn;
  return { depleted: true, yieldAmount };
}

export function tickHarvestRespawns(field: HarvestField, now: number) {
  for (const n of field.nodes) {
    if (n.hp <= 0 && now >= n.respawnAt) {
      n.hp = n.maxHp;
      n.respawnAt = 0;
      showHarvestNode(field, n);
      if (n.marker) n.marker.visible = true;
    }
  }
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
