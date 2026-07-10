import * as THREE from "three";
import { makeGroundMaterial } from "./proceduralTextures";

export interface PathNode {
  id: string;
  x: number;
  z: number;
  kind: "spawn" | "cove" | "shrine" | "boss_gate" | "junction" | "crossroads";
}

export interface PathSegment {
  ax: number;
  az: number;
  bx: number;
  bz: number;
  width: number;
}

export interface IslandPathMap {
  seed: number;
  arenaHalf: number;
  nodes: PathNode[];
  segments: PathSegment[];
  /** Default corridor half-width in world units (thick roads). */
  pathHalfWidth: number;
  isOnPath: (x: number, z: number) => boolean;
  nearestPathPoint: (x: number, z: number) => THREE.Vector3;
  sampleSpawnPoint: (rng: () => number) => THREE.Vector3;
  buildVisual: (anisotropy: number) => THREE.Group;
  flattenTerrain: (terrain: THREE.Mesh) => void;
}

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

function distToSegment(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const abx = bx - ax;
  const abz = bz - az;
  const len2 = abx * abx + abz * abz;
  if (len2 < 0.001) return Math.hypot(px - ax, pz - az);
  let t = ((px - ax) * abx + (pz - az) * abz) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + abx * t;
  const cz = az + abz * t;
  return Math.hypot(px - cx, pz - cz);
}

function connectSegments(nodes: PathNode[], width: number): PathSegment[] {
  const segs: PathSegment[] = [];
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const edges: [string, string][] = [
    ["spawn", "cross"],
    ["cross", "cove"],
    ["cross", "shrine_a"],
    ["cross", "boss_gate"],
    ["shrine_a", "junction_n"],
    ["junction_n", "boss_gate"],
    ["shrine_a", "junction_w"],
    ["junction_w", "cove"],
    ["spawn", "junction_s"],
    ["junction_s", "shrine_b"],
    ["shrine_b", "cove"],
  ];
  for (const [a, b] of edges) {
    const na = byId.get(a);
    const nb = byId.get(b);
    if (!na || !nb) continue;
    segs.push({ ax: na.x, az: na.z, bx: nb.x, bz: nb.z, width });
  }
  return segs;
}

/**
 * Seed-driven island road network — thick cobble corridors linking spawn,
 * Pirate Cove, shrines, and the boss gate. Terrain is flattened along paths.
 */
export function generateIslandPaths(seed: number, arenaHalf: number): IslandPathMap {
  const rng = mulberry32(seed);
  const pathHalfWidth = 4.2;

  const coveX = 70;
  const coveZ = -14;
  const shrineA = { x: -32 - rng() * 12, z: 28 + rng() * 16 };
  const shrineB = { x: 38 + rng() * 14, z: 42 + rng() * 10 };
  const bossGate = { x: -48 - rng() * 18, z: -36 - rng() * 14 };

  const nodes: PathNode[] = [
    { id: "spawn", x: 0, z: 0, kind: "spawn" },
    { id: "cross", x: 16 + rng() * 8, z: 8 + rng() * 6, kind: "crossroads" },
    { id: "cove", x: coveX, z: coveZ, kind: "cove" },
    { id: "shrine_a", x: shrineA.x, z: shrineA.z, kind: "shrine" },
    { id: "shrine_b", x: shrineB.x, z: shrineB.z, kind: "shrine" },
    { id: "boss_gate", x: bossGate.x, z: bossGate.z, kind: "boss_gate" },
    { id: "junction_n", x: -8 + rng() * 10, z: 52 + rng() * 8, kind: "junction" },
    { id: "junction_w", x: 24 + rng() * 10, z: -8 - rng() * 8, kind: "junction" },
    { id: "junction_s", x: -18 - rng() * 8, z: -22 - rng() * 10, kind: "junction" },
  ];

  const segments = connectSegments(nodes, pathHalfWidth * 2);

  const isOnPath = (x: number, z: number) => {
    for (const s of segments) {
      if (distToSegment(x, z, s.ax, s.az, s.bx, s.bz) <= pathHalfWidth) return true;
    }
    return false;
  };

  const nearestPathPoint = (x: number, z: number) => {
    let best = new THREE.Vector3(x, 0, z);
    let bestD = Infinity;
    for (const s of segments) {
      const abx = s.bx - s.ax;
      const abz = s.bz - s.az;
      const len2 = abx * abx + abz * abz;
      let t = len2 < 0.001 ? 0 : ((x - s.ax) * abx + (z - s.az) * abz) / len2;
      t = Math.max(0, Math.min(1, t));
      const cx = s.ax + abx * t;
      const cz = s.az + abz * t;
      const d = Math.hypot(x - cx, z - cz);
      if (d < bestD) {
        bestD = d;
        best = new THREE.Vector3(cx, 0, cz);
      }
    }
    return best;
  };

  const sampleSpawnPoint = (r: () => number) => {
    const seg = segments[Math.floor(r() * segments.length)] ?? segments[0]!;
    const t = 0.15 + r() * 0.7;
    const x = seg.ax + (seg.bx - seg.ax) * t + (r() - 0.5) * 3;
    const z = seg.az + (seg.bz - seg.az) * t + (r() - 0.5) * 3;
    const clamped = new THREE.Vector3(
      Math.max(-arenaHalf + 4, Math.min(arenaHalf - 4, x)),
      0,
      Math.max(-arenaHalf + 4, Math.min(arenaHalf - 4, z)),
    );
    if (Math.hypot(clamped.x, clamped.z) < 8) {
      return nearestPathPoint(22 + r() * 20, (r() - 0.5) * 30);
    }
    return clamped;
  };

  const buildVisual = (anisotropy: number) => {
    const group = new THREE.Group();
    group.name = "IslandPaths";

    const mat = makeGroundMaterial(4, anisotropy);
    mat.color.setHex(0x9a9080);
    mat.roughness = 0.88;

    const tile = 2.4;
    const positions: THREE.Vector3[] = [];

    for (const s of segments) {
      const len = Math.hypot(s.bx - s.ax, s.bz - s.az);
      const steps = Math.ceil(len / (tile * 0.65));
      const perpX = -(s.bz - s.az) / (len || 1);
      const perpZ = (s.bx - s.ax) / (len || 1);
      const lanes = 3;
      for (let i = 0; i <= steps; i++) {
        const t = steps === 0 ? 0 : i / steps;
        const cx = s.ax + (s.bx - s.ax) * t;
        const cz = s.az + (s.bz - s.az) * t;
        for (let lane = -lanes; lane <= lanes; lane++) {
          const ox = perpX * lane * (pathHalfWidth / lanes);
          const oz = perpZ * lane * (pathHalfWidth / lanes);
          positions.push(new THREE.Vector3(cx + ox, 0.03, cz + oz));
        }
      }
    }

    const geo = new THREE.PlaneGeometry(tile, tile);
    geo.rotateX(-Math.PI / 2);
    const mesh = new THREE.InstancedMesh(geo, mat, positions.length);
    mesh.receiveShadow = true;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3(1, 1, 1);
    positions.forEach((p, i) => {
      m.compose(p, q, s);
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
    group.add(mesh);

    // Path edge markers (low stone curbs).
    const curbMat = new THREE.MeshStandardMaterial({ color: 0x4a4035, roughness: 1 });
    const curbGeo = new THREE.BoxGeometry(0.5, 0.22, 1.8);
    const curbCount = segments.length * 8;
    const curbs = new THREE.InstancedMesh(curbGeo, curbMat, curbCount);
    let ci = 0;
    for (const seg of segments) {
      const len = Math.hypot(seg.bx - seg.ax, seg.bz - seg.az);
      const perpX = -(seg.bz - seg.az) / (len || 1);
      const perpZ = (seg.bx - seg.ax) / (len || 1);
      for (let i = 0; i < 8; i++) {
        const t = (i + 0.5) / 8;
        const cx = seg.ax + (seg.bx - seg.ax) * t;
        const cz = seg.az + (seg.bz - seg.az) * t;
        for (const side of [-1, 1]) {
          const px = cx + perpX * side * (pathHalfWidth + 0.35);
          const pz = cz + perpZ * side * (pathHalfWidth + 0.35);
          m.makeRotationY(Math.atan2(seg.bx - seg.ax, seg.bz - seg.az));
          m.setPosition(px, 0.11, pz);
          curbs.setMatrixAt(ci++, m);
        }
      }
    }
    curbs.count = ci;
    curbs.instanceMatrix.needsUpdate = true;
    group.add(curbs);

    return group;
  };

  const flattenTerrain = (terrain: THREE.Mesh) => {
    const geo = terrain.geometry as THREE.BufferGeometry;
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      let minDist = Infinity;
      for (const s of segments) {
        minDist = Math.min(minDist, distToSegment(x, z, s.ax, s.az, s.bx, s.bz));
      }
      if (minDist <= pathHalfWidth + 2) {
        const blend = 1 - Math.min(1, minDist / (pathHalfWidth + 2));
        const y = pos.getY(i);
        const flatY = -0.06;
        pos.setY(i, THREE.MathUtils.lerp(y, flatY, blend * 0.92));
      }
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
  };

  return {
    seed,
    arenaHalf,
    nodes,
    segments,
    pathHalfWidth,
    isOnPath,
    nearestPathPoint,
    sampleSpawnPoint,
    buildVisual,
    flattenTerrain,
  };
}