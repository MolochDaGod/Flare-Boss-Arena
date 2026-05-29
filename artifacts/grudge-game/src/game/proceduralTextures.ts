import * as THREE from "three";

/**
 * Procedurally-generated environment assets for the dungeon floor and props.
 * Everything is built at runtime on a <canvas> so there are no external texture
 * fetches — keeps the large map self-contained and instant to load.
 */

/** Draw a tiling cobblestone color + bump pair onto canvases. */
function drawStoneCanvases(px: number): { color: HTMLCanvasElement; bump: HTMLCanvasElement } {
  const color = document.createElement("canvas");
  const bump = document.createElement("canvas");
  color.width = color.height = px;
  bump.width = bump.height = px;
  const cc = color.getContext("2d")!;
  const bc = bump.getContext("2d")!;

  // Base earth.
  cc.fillStyle = "#221d17";
  cc.fillRect(0, 0, px, px);
  bc.fillStyle = "#808080";
  bc.fillRect(0, 0, px, px);

  // Cobble grid with per-cell variation. Cells wrap seamlessly because we draw
  // a fixed integer number of cells across the texture.
  const cells = 6;
  const cw = px / cells;
  const palette = ["#2b251d", "#332a20", "#241f18", "#3a3026", "#2e271e"];
  for (let gx = 0; gx < cells; gx++) {
    for (let gy = 0; gy < cells; gy++) {
      const pad = cw * 0.08;
      const x = gx * cw + pad;
      const y = gy * cw + pad;
      const w = cw - pad * 2;
      const tone = palette[(gx * 7 + gy * 13) % palette.length];
      // Color stone.
      cc.fillStyle = tone;
      roundRect(cc, x, y, w, w, cw * 0.18);
      cc.fill();
      // Bump: stones raised (light), grout recessed (dark base already).
      const lift = 150 + ((gx * 31 + gy * 17) % 70);
      bc.fillStyle = `rgb(${lift},${lift},${lift})`;
      roundRect(bc, x, y, w, w, cw * 0.18);
      bc.fill();
    }
  }

  // Speckle noise for grit on both maps.
  for (let i = 0; i < px * 14; i++) {
    const x = Math.random() * px;
    const y = Math.random() * px;
    const a = Math.random() * 0.18;
    cc.fillStyle = Math.random() > 0.5 ? `rgba(255,230,180,${a})` : `rgba(0,0,0,${a})`;
    cc.fillRect(x, y, 1, 1);
    const v = Math.floor(120 + Math.random() * 80);
    bc.fillStyle = `rgba(${v},${v},${v},${Math.random() * 0.15})`;
    bc.fillRect(x, y, 1, 1);
  }

  return { color, bump };
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Build the large textured floor material. `repeat` controls how many times the
 * cobble pattern tiles across the ground; `anisotropy` should be the renderer's
 * max for crisp grazing-angle detail on a big plane.
 */
export function makeGroundMaterial(repeat: number, anisotropy: number): THREE.MeshStandardMaterial {
  const { color, bump } = drawStoneCanvases(512);

  const map = new THREE.CanvasTexture(color);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(repeat, repeat);
  map.anisotropy = anisotropy;
  map.colorSpace = THREE.SRGBColorSpace;

  const bumpMap = new THREE.CanvasTexture(bump);
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(repeat, repeat);
  bumpMap.anisotropy = anisotropy;

  return new THREE.MeshStandardMaterial({
    map,
    bumpMap,
    bumpScale: 0.6,
    roughness: 0.95,
    metalness: 0.0,
    color: 0x8a8278,
  });
}

/**
 * Scatter `count` rocks across an annulus (inner..outer radius) as a single
 * InstancedMesh — hundreds of props in one draw call. Returns the mesh ready to
 * add to the scene; dispose its geometry/material on teardown.
 */
/** Cheap deterministic value-noise (hash-based) + fractal sum for terrain. */
function hash2(x: number, z: number): number {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function valueNoise(x: number, z: number): number {
  const xi = Math.floor(x), zi = Math.floor(z);
  const xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf);
  const v = zf * zf * (3 - 2 * zf);
  const a = hash2(xi, zi), b = hash2(xi + 1, zi);
  const c = hash2(xi, zi + 1), d = hash2(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x: number, z: number): number {
  let amp = 0.5, freq = 1, sum = 0;
  for (let o = 0; o < 4; o++) {
    sum += amp * valueNoise(x * freq, z * freq);
    freq *= 2.07;
    amp *= 0.5;
  }
  return sum;
}

/**
 * A large noise-displaced terrain "skirt" that rings the flat playable arena.
 * The center (within `arenaHalf`) is held flat at `baseY` so gameplay stays on
 * y≈0; displacement ramps in beyond the arena edge into rolling foothills and a
 * distant mountain ridge. Normals are recomputed for correct lighting. Returns
 * a ground-plane mesh (already rotated into XZ) ready to add to the scene.
 */
export function makeTerrainSkirt(arenaHalf: number, size = 460, seg = 220, baseY = -0.08): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2); // into XZ, +y up
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const half = size / 2;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    // The playable area is a SQUARE clamp (±arenaHalf), not a circle — use the
    // Chebyshev distance so every reachable corner stays flat (a circular mask
    // would leave the ±arenaHalf corners displaced and clipping the player).
    const dist = Math.max(Math.abs(x), Math.abs(z));
    let y = baseY;
    if (dist > arenaHalf) {
      // 0 at arena edge → 1 at outer extent (eased so the seam is gentle).
      const t = Math.min(1, (dist - arenaHalf) / (half - arenaHalf));
      const ramp = t * t;
      const hills = (fbm(x * 0.03, z * 0.03) - 0.5) * 10;
      const ridge = ramp * ramp * 46; // distant mountains
      y = baseY + ramp * (hills + 4) + ridge;
    }
    pos.setY(i, y);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    color: 0x2a241d,
    roughness: 1.0,
    metalness: 0.0,
    flatShading: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.position.y = 0;
  return mesh;
}

export function makeRockField(count: number, inner: number, outer: number): THREE.InstancedMesh {
  const geo = new THREE.DodecahedronGeometry(1, 0);
  const mat = new THREE.MeshStandardMaterial({ color: 0x3a352e, roughness: 1.0, metalness: 0.0, flatShading: true });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  const dummy = new THREE.Object3D();
  for (let i = 0; i < count; i++) {
    const ang = Math.random() * Math.PI * 2;
    const r = inner + Math.random() * (outer - inner);
    const x = Math.cos(ang) * r;
    const z = Math.sin(ang) * r;
    const s = 0.35 + Math.random() * 1.25;
    dummy.position.set(x, s * 0.45 - 0.1, z);
    dummy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    dummy.scale.set(s, s * (0.6 + Math.random() * 0.5), s);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}
