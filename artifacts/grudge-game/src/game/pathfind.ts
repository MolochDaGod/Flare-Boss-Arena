/**
 * Grid A* pathfinding for MazeArena — used by enemy wander/chase and ally moves.
 * Paths are world-space waypoints (cell centers), re-planned periodically.
 */
import type { MazeArena } from "./MazeArena";
import * as THREE from "three";

export interface PathRequest {
  fromX: number;
  fromZ: number;
  toX: number;
  toZ: number;
  /** Cap explored nodes (keeps AI cheap at scale). */
  maxNodes?: number;
}

const DIRS: Array<[number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

/**
 * A* on maze cells. Returns world waypoints including goal (may be empty if blocked).
 */
export function findPath(maze: MazeArena, req: PathRequest): THREE.Vector3[] {
  const maxNodes = req.maxNodes ?? 900;
  const start = maze.worldToCell(req.fromX, req.fromZ);
  const goal = maze.worldToCell(req.toX, req.toZ);

  // Snap start/goal to walkable
  let sgx = start.gx;
  let sgz = start.gz;
  let ggx = goal.gx;
  let ggz = goal.gz;
  if (maze.isWallCell(sgx, sgz)) {
    const w = maze.nearestWalkable(req.fromX, req.fromZ);
    const c = maze.worldToCell(w.x, w.z);
    sgx = c.gx;
    sgz = c.gz;
  }
  if (maze.isWallCell(ggx, ggz)) {
    const w = maze.nearestWalkable(req.toX, req.toZ);
    const c = maze.worldToCell(w.x, w.z);
    ggx = c.gx;
    ggz = c.gz;
  }
  if (sgx === ggx && sgz === ggz) {
    return [new THREE.Vector3(req.toX, 0, req.toZ)];
  }

  const key = (gx: number, gz: number) => gz * maze.cols + gx;
  const open: number[] = [];
  const came = new Map<number, number>();
  const gScore = new Map<number, number>();
  const fScore = new Map<number, number>();
  const startK = key(sgx, sgz);
  const goalK = key(ggx, ggz);
  open.push(startK);
  gScore.set(startK, 0);
  fScore.set(startK, heuristic(sgx, sgz, ggx, ggz));

  let expanded = 0;
  while (open.length && expanded < maxNodes) {
    expanded++;
    // Pop lowest f
    let bestI = 0;
    let bestF = Infinity;
    for (let i = 0; i < open.length; i++) {
      const f = fScore.get(open[i]!) ?? Infinity;
      if (f < bestF) {
        bestF = f;
        bestI = i;
      }
    }
    const current = open.splice(bestI, 1)[0]!;
    if (current === goalK) {
      return reconstruct(maze, came, current, req.toX, req.toZ);
    }
    const cgx = current % maze.cols;
    const cgz = Math.floor(current / maze.cols);
    for (const [dx, dz] of DIRS) {
      const nx = cgx + dx;
      const nz = cgz + dz;
      if (maze.isWallCell(nx, nz)) continue;
      // Block diagonal corner-cutting
      if (dx !== 0 && dz !== 0) {
        if (maze.isWallCell(cgx + dx, cgz) || maze.isWallCell(cgx, cgz + dz)) continue;
      }
      const nk = key(nx, nz);
      const step = dx !== 0 && dz !== 0 ? 1.414 : 1;
      const tent = (gScore.get(current) ?? Infinity) + step;
      if (tent < (gScore.get(nk) ?? Infinity)) {
        came.set(nk, current);
        gScore.set(nk, tent);
        fScore.set(nk, tent + heuristic(nx, nz, ggx, ggz));
        if (!open.includes(nk)) open.push(nk);
      }
    }
  }
  // Partial: return best-known toward goal
  let bestK = startK;
  let bestH = Infinity;
  for (const [k, g] of gScore) {
    const gx = k % maze.cols;
    const gz = Math.floor(k / maze.cols);
    const h = heuristic(gx, gz, ggx, ggz) + g * 0.05;
    if (h < bestH) {
      bestH = h;
      bestK = k;
    }
  }
  if (bestK === startK) return [];
  return reconstruct(maze, came, bestK, req.toX, req.toZ);
}

function heuristic(ax: number, az: number, bx: number, bz: number) {
  const dx = Math.abs(ax - bx);
  const dz = Math.abs(az - bz);
  return dx + dz + (Math.SQRT2 - 2) * Math.min(dx, dz);
}

function reconstruct(
  maze: MazeArena,
  came: Map<number, number>,
  current: number,
  goalX: number,
  goalZ: number,
): THREE.Vector3[] {
  const cells: number[] = [current];
  while (came.has(current)) {
    current = came.get(current)!;
    cells.push(current);
  }
  cells.reverse();
  // Simplify: keep every 2nd cell + end for smoother long paths
  const pts: THREE.Vector3[] = [];
  for (let i = 1; i < cells.length; i++) {
    if (i < cells.length - 1 && i % 2 === 0) continue;
    const k = cells[i]!;
    const gx = k % maze.cols;
    const gz = Math.floor(k / maze.cols);
    const c = maze.cellCenter(gx, gz);
    pts.push(new THREE.Vector3(c.x, 0, c.z));
  }
  if (pts.length) {
    pts[pts.length - 1] = new THREE.Vector3(goalX, 0, goalZ);
  }
  return pts;
}

/** Advance along path; returns true if still moving. */
export function advanceAlongPath(
  pos: THREE.Vector3,
  path: THREE.Vector3[],
  speed: number,
  dt: number,
): { moved: boolean; facing: number; path: THREE.Vector3[] } {
  if (!path.length) return { moved: false, facing: 0, path };
  const target = path[0]!;
  const dx = target.x - pos.x;
  const dz = target.z - pos.z;
  const dist = Math.hypot(dx, dz);
  if (dist < 0.35) {
    path.shift();
    if (!path.length) return { moved: false, facing: Math.atan2(dx, dz), path };
    return advanceAlongPath(pos, path, speed, dt);
  }
  const step = Math.min(dist, speed * dt);
  pos.x += (dx / dist) * step;
  pos.z += (dz / dist) * step;
  return { moved: true, facing: Math.atan2(dx, dz), path };
}
