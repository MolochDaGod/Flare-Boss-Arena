/**
 * MazeArena — procedural maze walls + large rooms for the ARPG open plane.
 *
 * Design borrowed from annihilate-reference terrain:
 *   • Box.js  — static axis-aligned solid obstacles (GROUP_SCENE style)
 *   • Level.js — mesh-backed walkable space with hard collision
 *   • index.js — obstacles live in the world; characters slide against them
 *
 * Adapted to Flare's flat arena (no Cannon): seedable grid maze, InstancedMesh
 * walls for one-draw rendering, O(1) neighbour-cell capsule push for collision.
 * Large rooms are carved periodically so combat has open arenas between corridors.
 */
import * as THREE from "three";

export interface MazeOpenZone {
  /** World XZ center. */
  x: number;
  z: number;
  /** Half-extent of open rectangle (world units). */
  half: number;
}

export interface MazeRoom {
  /** Grid cell bounds (inclusive). */
  gx0: number;
  gz0: number;
  gx1: number;
  gz1: number;
  /** World-space center for spawns / boss staging. */
  cx: number;
  cz: number;
  kind: "large" | "hub";
}

export interface MazeArenaOptions {
  /** Half-extent of playable square (±halfExtent). */
  halfExtent: number;
  /** World units per grid cell. */
  cellSize?: number;
  /** Wall height. */
  wallHeight?: number;
  /** Seed for deterministic re-sails. */
  seed: number;
  /** Forced open zones (spawn, cove, camp, boss). */
  openZones?: MazeOpenZone[];
  /** How many large combat rooms to carve (besides hub). */
  largeRoomCount?: number;
}

export class MazeArena {
  readonly group = new THREE.Group();
  readonly rooms: MazeRoom[] = [];
  readonly cellSize: number;
  readonly halfExtent: number;
  readonly cols: number;
  readonly rows: number;

  /** true = solid wall, false = walkable floor. */
  private cells: Uint8Array;
  private wallMesh: THREE.InstancedMesh | null = null;
  private disposed = false;

  private readonly wallH: number;
  private readonly _tmp = new THREE.Vector3();
  private readonly _mat = new THREE.Matrix4();
  private readonly _quat = new THREE.Quaternion();
  private readonly _scale = new THREE.Vector3();
  private readonly _pos = new THREE.Vector3();

  constructor(opts: MazeArenaOptions) {
    this.halfExtent = opts.halfExtent;
    this.cellSize = opts.cellSize ?? 5;
    this.wallH = opts.wallHeight ?? 3.2;
    // Odd grid so recursive carve has a clean center cell.
    let n = Math.floor((opts.halfExtent * 2) / this.cellSize);
    if (n % 2 === 0) n -= 1;
    n = Math.max(15, n);
    this.cols = n;
    this.rows = n;
    this.cells = new Uint8Array(n * n);
    // Start solid; carve floors.
    this.cells.fill(1);

    const rng = mulberry(opts.seed);
    this.carveMaze(rng);
    this.carveLargeRooms(rng, opts.largeRoomCount ?? 6);
    this.carveOpenZones(opts.openZones ?? []);
    // Outer ring always solid (arena border).
    this.sealPerimeter();
    this.buildMeshes();
    this.group.name = "MazeArena";
  }

  // ── Grid helpers ──────────────────────────────────────────────────────────

  private idx(gx: number, gz: number) {
    return gz * this.cols + gx;
  }

  isWallCell(gx: number, gz: number): boolean {
    if (gx < 0 || gz < 0 || gx >= this.cols || gz >= this.rows) return true;
    return this.cells[this.idx(gx, gz)] === 1;
  }

  isWalkableWorld(x: number, z: number): boolean {
    const { gx, gz } = this.worldToCell(x, z);
    return !this.isWallCell(gx, gz);
  }

  worldToCell(x: number, z: number): { gx: number; gz: number } {
    const origin = -this.cols * this.cellSize * 0.5;
    const gx = Math.floor((x - origin) / this.cellSize);
    const gz = Math.floor((z - origin) / this.cellSize);
    return { gx, gz };
  }

  cellCenter(gx: number, gz: number): { x: number; z: number } {
    const origin = -this.cols * this.cellSize * 0.5;
    return {
      x: origin + (gx + 0.5) * this.cellSize,
      z: origin + (gz + 0.5) * this.cellSize,
    };
  }

  /**
   * Nearest walkable world point (for spawns that land in a wall after reseed).
   * Spiral search from the requested position.
   */
  nearestWalkable(x: number, z: number, maxR = 24): THREE.Vector3 {
    if (this.isWalkableWorld(x, z)) return new THREE.Vector3(x, 0, z);
    const { gx: sgx, gz: sgz } = this.worldToCell(x, z);
    for (let r = 1; r <= maxR; r++) {
      for (let dz = -r; dz <= r; dz++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue;
          const gx = sgx + dx;
          const gz = sgz + dz;
          if (!this.isWallCell(gx, gz)) {
            const c = this.cellCenter(gx, gz);
            return new THREE.Vector3(c.x, 0, c.z);
          }
        }
      }
    }
    return new THREE.Vector3(0, 0, 0);
  }

  // ── Generation ────────────────────────────────────────────────────────────

  private carveMaze(rng: () => number) {
    // Recursive backtracking on odd cells (classic grid maze).
    const stack: Array<[number, number]> = [];
    const startX = 1;
    const startZ = 1;
    this.cells[this.idx(startX, startZ)] = 0;
    stack.push([startX, startZ]);

    const dirs: Array<[number, number]> = [
      [0, -2],
      [2, 0],
      [0, 2],
      [-2, 0],
    ];

    while (stack.length) {
      const [cx, cz] = stack[stack.length - 1];
      // Shuffle neighbours.
      for (let i = dirs.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        const t = dirs[i];
        dirs[i] = dirs[j];
        dirs[j] = t;
      }
      let carved = false;
      for (const [dx, dz] of dirs) {
        const nx = cx + dx;
        const nz = cz + dz;
        if (nx <= 0 || nz <= 0 || nx >= this.cols - 1 || nz >= this.rows - 1) continue;
        if (this.cells[this.idx(nx, nz)] === 0) continue;
        // Knock wall between.
        this.cells[this.idx(cx + dx / 2, cz + dz / 2)] = 0;
        this.cells[this.idx(nx, nz)] = 0;
        stack.push([nx, nz]);
        carved = true;
        break;
      }
      if (!carved) stack.pop();
    }
  }

  private carveRect(gx0: number, gz0: number, gx1: number, gz1: number) {
    const x0 = Math.max(1, Math.min(gx0, gx1));
    const z0 = Math.max(1, Math.min(gz0, gz1));
    const x1 = Math.min(this.cols - 2, Math.max(gx0, gx1));
    const z1 = Math.min(this.rows - 2, Math.max(gz0, gz1));
    for (let gz = z0; gz <= z1; gz++) {
      for (let gx = x0; gx <= x1; gx++) {
        this.cells[this.idx(gx, gz)] = 0;
      }
    }
    return { gx0: x0, gz0: z0, gx1: x1, gz1: z1 };
  }

  private carveLargeRooms(rng: () => number, count: number) {
    // Hub room at center — always present (player drop-in).
    const mid = Math.floor(this.cols / 2);
    const hub = this.carveRect(mid - 3, mid - 3, mid + 3, mid + 3);
    const hc = this.cellCenter(mid, mid);
    this.rooms.push({ ...hub, cx: hc.x, cz: hc.z, kind: "hub" });

    let placed = 0;
    let attempts = 0;
    while (placed < count && attempts < count * 40) {
      attempts++;
      // Room size 5–9 cells (large combat floors).
      const rw = 5 + Math.floor(rng() * 5);
      const rh = 5 + Math.floor(rng() * 5);
      const gx0 = 2 + Math.floor(rng() * (this.cols - rw - 4));
      const gz0 = 2 + Math.floor(rng() * (this.rows - rh - 4));
      const gx1 = gx0 + rw - 1;
      const gz1 = gz0 + rh - 1;
      // Skip if overlaps hub too tightly (keep some maze between rooms).
      const cx = (gx0 + gx1) / 2;
      const cz = (gz0 + gz1) / 2;
      if (Math.hypot(cx - mid, cz - mid) < 6) continue;
      // Avoid stacking on an existing large room.
      let overlap = false;
      for (const r of this.rooms) {
        if (gx0 <= r.gx1 + 2 && gx1 >= r.gx0 - 2 && gz0 <= r.gz1 + 2 && gz1 >= r.gz0 - 2) {
          overlap = true;
          break;
        }
      }
      if (overlap) continue;

      const rect = this.carveRect(gx0, gz0, gx1, gz1);
      // Guarantee at least one corridor link: punch a 1-cell tunnel toward hub.
      this.punchCorridor(Math.floor(cx), Math.floor(cz), mid, mid, rng);
      const wc = this.cellCenter(Math.floor(cx), Math.floor(cz));
      this.rooms.push({ ...rect, cx: wc.x, cz: wc.z, kind: "large" });
      placed++;
    }
  }

  private punchCorridor(x0: number, z0: number, x1: number, z1: number, rng: () => number) {
    let x = x0;
    let z = z0;
    // L-shaped tunnel with slight random mid bend.
    const horizFirst = rng() > 0.5;
    if (horizFirst) {
      while (x !== x1) {
        this.cells[this.idx(x, z)] = 0;
        x += x < x1 ? 1 : -1;
      }
      while (z !== z1) {
        this.cells[this.idx(x, z)] = 0;
        z += z < z1 ? 1 : -1;
      }
    } else {
      while (z !== z1) {
        this.cells[this.idx(x, z)] = 0;
        z += z < z1 ? 1 : -1;
      }
      while (x !== x1) {
        this.cells[this.idx(x, z)] = 0;
        x += x < x1 ? 1 : -1;
      }
    }
    this.cells[this.idx(x1, z1)] = 0;
  }

  private carveOpenZones(zones: MazeOpenZone[]) {
    for (const z of zones) {
      const halfCells = Math.max(1, Math.ceil(z.half / this.cellSize));
      const { gx, gz } = this.worldToCell(z.x, z.z);
      this.carveRect(gx - halfCells, gz - halfCells, gx + halfCells, gz + halfCells);
    }
  }

  private sealPerimeter() {
    for (let gx = 0; gx < this.cols; gx++) {
      this.cells[this.idx(gx, 0)] = 1;
      this.cells[this.idx(gx, this.rows - 1)] = 1;
    }
    for (let gz = 0; gz < this.rows; gz++) {
      this.cells[this.idx(0, gz)] = 1;
      this.cells[this.idx(this.cols - 1, gz)] = 1;
    }
  }

  // ── Rendering (annihilate Box-style solids, instanced) ────────────────────

  private buildMeshes() {
    const wallCells: Array<{ gx: number; gz: number }> = [];
    for (let gz = 0; gz < this.rows; gz++) {
      for (let gx = 0; gx < this.cols; gx++) {
        if (this.cells[this.idx(gx, gz)] === 1) wallCells.push({ gx, gz });
      }
    }

    // Slightly thinner than cell so corridor width feels open.
    const boxW = this.cellSize * 0.92;
    const geo = new THREE.BoxGeometry(boxW, this.wallH, boxW);
    // Dark-fantasy stone — matches cobble floor mood.
    const mat = new THREE.MeshStandardMaterial({
      color: 0x2a2420,
      roughness: 0.92,
      metalness: 0.05,
      flatShading: true,
    });
    // Trim cap colour variation via emissive edge feel (cheap).
    const mesh = new THREE.InstancedMesh(geo, mat, wallCells.length);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = "MazeWalls";
    mesh.frustumCulled = true;

    const y = this.wallH * 0.5;
    for (let i = 0; i < wallCells.length; i++) {
      const { gx, gz } = wallCells[i];
      const c = this.cellCenter(gx, gz);
      this._pos.set(c.x, y, c.z);
      this._quat.identity();
      this._scale.set(1, 1, 1);
      this._mat.compose(this._pos, this._quat, this._scale);
      mesh.setMatrixAt(i, this._mat);
    }
    mesh.instanceMatrix.needsUpdate = true;
    this.wallMesh = mesh;
    this.group.add(mesh);

    // Low coping strip on top of walls for silhouette (shared geo, unlit-ish).
    const capGeo = new THREE.BoxGeometry(boxW * 1.05, 0.18, boxW * 1.05);
    const capMat = new THREE.MeshStandardMaterial({
      color: 0x3d342c,
      roughness: 0.85,
      metalness: 0.08,
    });
    const caps = new THREE.InstancedMesh(capGeo, capMat, wallCells.length);
    caps.castShadow = false;
    caps.receiveShadow = true;
    caps.name = "MazeWallCaps";
    const capY = this.wallH + 0.09;
    for (let i = 0; i < wallCells.length; i++) {
      const { gx, gz } = wallCells[i];
      const c = this.cellCenter(gx, gz);
      this._pos.set(c.x, capY, c.z);
      this._mat.compose(this._pos, this._quat, this._scale);
      caps.setMatrixAt(i, this._mat);
    }
    caps.instanceMatrix.needsUpdate = true;
    this.group.add(caps);
  }

  // ── Collision (capsule vs axis-aligned wall cells) ────────────────────────

  /**
   * Slide a foot-position capsule out of solid wall cells. Matches the spirit of
   * annihilate Box colliders + DungeonMap.collideHorizontal: only XZ is mutated.
   */
  collideHorizontal(pos: THREE.Vector3, radius: number) {
    if (this.disposed) return;
    const origin = -this.cols * this.cellSize * 0.5;
    const half = this.cellSize * 0.46; // match visual boxW/2

    // Iterative resolve against neighbouring cells (covers corners).
    for (let iter = 0; iter < 4; iter++) {
      const { gx, gz } = this.worldToCell(pos.x, pos.z);
      let moved = false;
      for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          const cx = gx + dx;
          const cz = gz + dz;
          if (!this.isWallCell(cx, cz)) continue;
          const c = this.cellCenter(cx, cz);
          // AABB expand by radius.
          const minX = c.x - half - radius;
          const maxX = c.x + half + radius;
          const minZ = c.z - half - radius;
          const maxZ = c.z + half + radius;
          if (pos.x <= minX || pos.x >= maxX || pos.z <= minZ || pos.z >= maxZ) continue;

          // Push out along shallowest axis (classic AABB resolve).
          const pushL = pos.x - minX;
          const pushR = maxX - pos.x;
          const pushD = pos.z - minZ;
          const pushU = maxZ - pos.z;
          const m = Math.min(pushL, pushR, pushD, pushU);
          if (m === pushL) pos.x = minX;
          else if (m === pushR) pos.x = maxX;
          else if (m === pushD) pos.z = minZ;
          else pos.z = maxZ;
          moved = true;
        }
      }
      // Also clamp to maze outer bounds.
      const pad = radius + 0.2;
      const min = origin + this.cellSize + pad;
      const max = origin + this.cols * this.cellSize - this.cellSize - pad;
      if (pos.x < min) { pos.x = min; moved = true; }
      if (pos.x > max) { pos.x = max; moved = true; }
      if (pos.z < min) { pos.z = min; moved = true; }
      if (pos.z > max) { pos.z = max; moved = true; }
      if (!moved) break;
    }
  }

  /** Random walkable world point (for patrol / loot), biased to open cells. */
  randomWalkable(rng: () => number): THREE.Vector3 {
    for (let i = 0; i < 80; i++) {
      const gx = 1 + Math.floor(rng() * (this.cols - 2));
      const gz = 1 + Math.floor(rng() * (this.rows - 2));
      if (this.cells[this.idx(gx, gz)] === 0) {
        const c = this.cellCenter(gx, gz);
        return new THREE.Vector3(c.x, 0, c.z);
      }
    }
    return this.nearestWalkable(0, 0);
  }

  /** Prefer large rooms for boss / elite staging. */
  randomLargeRoomCenter(rng: () => number): THREE.Vector3 {
    const large = this.rooms.filter((r) => r.kind === "large");
    if (large.length === 0) return this.randomWalkable(rng);
    const r = large[Math.floor(rng() * large.length)];
    return new THREE.Vector3(r.cx, 0, r.cz);
  }

  dispose() {
    this.disposed = true;
    this.group.traverse((c) => {
      const m = c as THREE.Mesh;
      if (!m.isMesh) return;
      m.geometry?.dispose();
      const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
      for (const mat of mats) mat.dispose();
    });
    this.group.parent?.remove(this.group);
    this.wallMesh = null;
  }
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
