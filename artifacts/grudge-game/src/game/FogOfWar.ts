import * as THREE from "three";

export interface FogMinimapCell {
  /** -1 unexplored, 0 explored, 1 visible */
  state: number;
}

export interface FogMinimapSnapshot {
  gridW: number;
  gridH: number;
  cells: FogMinimapCell[];
  playerNx: number;
  playerNz: number;
  coveNx: number;
  coveNz: number;
}

/**
 * Grid-based fog of war for the island arena. Unexplored tiles render as a dark
 * veil; explored tiles stay dim until the player (or allies) re-enter vision.
 */
export class FogOfWar {
  readonly gridW: number;
  readonly gridH: number;
  readonly cellSize: number;
  readonly arenaHalf: number;

  private explored: Uint8Array;
  private visible: Uint8Array;
  private texture: THREE.DataTexture;
  private mesh: THREE.Mesh;
  private data: Uint8Array;

  constructor(scene: THREE.Scene, arenaHalf: number, cellSize = 2.5) {
    this.arenaHalf = arenaHalf;
    this.cellSize = cellSize;
    this.gridW = Math.ceil((arenaHalf * 2) / cellSize);
    this.gridH = this.gridW;
    const count = this.gridW * this.gridH;
    this.explored = new Uint8Array(count);
    this.visible = new Uint8Array(count);
    this.data = new Uint8Array(count * 4);

    this.texture = new THREE.DataTexture(this.data, this.gridW, this.gridH, THREE.RGBAFormat);
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.needsUpdate = true;

    const mat = new THREE.MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      depthWrite: false,
      opacity: 0.92,
    });
    const geo = new THREE.PlaneGeometry(arenaHalf * 2, arenaHalf * 2);
    geo.rotateX(-Math.PI / 2);
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.y = 0.12;
    this.mesh.renderOrder = 5;
    scene.add(this.mesh);
  }

  /** Restore explored cells from a saved run (sparse index list). */
  loadExplored(indices: number[]) {
    for (const idx of indices) {
      if (idx >= 0 && idx < this.explored.length) this.explored[idx] = 1;
    }
    this.uploadTexture();
  }

  /** Sparse list of explored cell indices for persistence. */
  exportExplored(): number[] {
    const out: number[] = [];
    for (let i = 0; i < this.explored.length; i++) {
      if (this.explored[i]) out.push(i);
    }
    return out;
  }

  private worldToCell(x: number, z: number): { cx: number; cz: number } | null {
    const lx = x + this.arenaHalf;
    const lz = z + this.arenaHalf;
    const cx = Math.floor(lx / this.cellSize);
    const cz = Math.floor(lz / this.cellSize);
    if (cx < 0 || cz < 0 || cx >= this.gridW || cz >= this.gridH) return null;
    return { cx, cz };
  }

  private cellIndex(cx: number, cz: number): number {
    return cz * this.gridW + cx;
  }

  revealAt(x: number, z: number, radius: number) {
    const rCells = Math.ceil(radius / this.cellSize);
    const center = this.worldToCell(x, z);
    if (!center) return;
    for (let dz = -rCells; dz <= rCells; dz++) {
      for (let dx = -rCells; dx <= rCells; dx++) {
        const cx = center.cx + dx;
        const cz = center.cz + dz;
        if (cx < 0 || cz < 0 || cx >= this.gridW || cz >= this.gridH) continue;
        const wx = cx * this.cellSize - this.arenaHalf + this.cellSize * 0.5;
        const wz = cz * this.cellSize - this.arenaHalf + this.cellSize * 0.5;
        if (Math.hypot(wx - x, wz - z) <= radius) {
          const idx = this.cellIndex(cx, cz);
          this.explored[idx] = 1;
          this.visible[idx] = 1;
        }
      }
    }
  }

  update(sources: { x: number; z: number; radius: number }[]) {
    this.visible.fill(0);
    for (const s of sources) this.revealAt(s.x, s.z, s.radius);
    this.uploadTexture();
  }

  private uploadTexture() {
    for (let i = 0; i < this.explored.length; i++) {
      const o = i * 4;
      if (this.visible[i]) {
        this.data[o] = 0;
        this.data[o + 1] = 0;
        this.data[o + 2] = 0;
        this.data[o + 3] = 0;
      } else if (this.explored[i]) {
        this.data[o] = 8;
        this.data[o + 1] = 6;
        this.data[o + 2] = 14;
        this.data[o + 3] = 165;
      } else {
        this.data[o] = 4;
        this.data[o + 1] = 3;
        this.data[o + 2] = 8;
        this.data[o + 3] = 235;
      }
    }
    this.texture.needsUpdate = true;
  }

  exploredCount(): number {
    let n = 0;
    for (let i = 0; i < this.explored.length; i++) if (this.explored[i]) n++;
    return n;
  }

  getMinimap(playerX: number, playerZ: number, coveX: number, coveZ: number): FogMinimapSnapshot {
    const cells: FogMinimapCell[] = [];
    for (let i = 0; i < this.explored.length; i++) {
      cells.push({
        state: this.visible[i] ? 1 : this.explored[i] ? 0 : -1,
      });
    }
    return {
      gridW: this.gridW,
      gridH: this.gridH,
      cells,
      playerNx: playerX / this.arenaHalf,
      playerNz: playerZ / this.arenaHalf,
      coveNx: coveX / this.arenaHalf,
      coveNz: coveZ / this.arenaHalf,
    };
  }

  dispose() {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
    this.texture.dispose();
    this.mesh.parent?.remove(this.mesh);
  }
}