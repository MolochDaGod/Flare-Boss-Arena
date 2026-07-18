/**
 * Deterministic cast warnings + impact animation effects for Three.js combat.
 *
 * - Floating "!" / ring above casters (boss / elite telegraphs)
 * - Seeded pulse phase so the same enemy special always feels the same
 * - Ground flash burst on detonation (pairs with TelegraphField)
 */

import * as THREE from "three";
import { hashString, seededUnit } from "../../data/monsterCatalog";

export interface WarningSpawnOpts {
  /** World position (usually enemy or strike origin). */
  position: THREE.Vector3;
  /** Wind-up seconds until impact. */
  duration: number;
  color?: number;
  /** Lift above ground / character head. */
  height?: number;
  label?: string;
  /** Deterministic seed (enemy id + ability name). */
  seed?: number | string;
  /** Scale of the marker. */
  scale?: number;
}

interface ActiveWarning {
  group: THREE.Group;
  ring: THREE.Mesh;
  glyph: THREE.Mesh;
  matRing: THREE.MeshBasicMaterial;
  matGlyph: THREE.MeshBasicMaterial;
  age: number;
  dur: number;
  phase: number;
  baseY: number;
}

function makeExclaimTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext("2d")!;
  ctx.clearRect(0, 0, 64, 64);
  ctx.fillStyle = "#1a0505";
  ctx.beginPath();
  ctx.arc(32, 32, 28, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#ff3344";
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.fillStyle = "#ffcc44";
  ctx.font = "bold 42px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("!", 32, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Field of floating warning markers + optional impact flashes.
 * Fully deterministic when `seed` is provided.
 */
export class WarningEffectField {
  private scene: THREE.Scene;
  private active: ActiveWarning[] = [];
  private flashes: Array<{ mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; age: number; dur: number }> = [];
  private glyphTex: THREE.CanvasTexture | null = null;
  private disposed = false;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  private tex(): THREE.CanvasTexture {
    if (!this.glyphTex) this.glyphTex = makeExclaimTexture();
    return this.glyphTex;
  }

  /**
   * Spawn a floating warning above a cast origin.
   * Pulse rate and start phase come from `seed` when set.
   */
  spawn(opts: WarningSpawnOpts) {
    if (this.disposed) return;
    const seedNum =
      typeof opts.seed === "string"
        ? hashString(opts.seed)
        : typeof opts.seed === "number"
          ? opts.seed
          : (Math.random() * 0xffffffff) >>> 0;
    const phase = seededUnit(seedNum, 1) * Math.PI * 2;
    const color = opts.color ?? 0xff3344;
    const height = opts.height ?? 2.4;
    const scale = opts.scale ?? 1;
    const dur = Math.max(0.25, opts.duration);

    const group = new THREE.Group();
    group.position.copy(opts.position);
    group.position.y = height;

    const matRing = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.48, 32), matRing);
    ring.rotation.x = -Math.PI / 2;
    ring.scale.setScalar(scale);
    group.add(ring);

    const matGlyph = new THREE.MeshBasicMaterial({
      map: this.tex(),
      color: 0xffffff,
      transparent: true,
      opacity: 1,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const glyph = new THREE.Mesh(new THREE.PlaneGeometry(0.7 * scale, 0.7 * scale), matGlyph);
    glyph.position.y = 0.55 * scale;
    group.add(glyph);

    this.scene.add(group);
    this.active.push({
      group,
      ring,
      glyph,
      matRing,
      matGlyph,
      age: 0,
      dur,
      phase,
      baseY: height,
    });
  }

  /** Quick radial flash at impact (detonation beat). */
  impactFlash(origin: THREE.Vector3, color = 0xffaa44, radius = 2.2, seed?: number | string) {
    if (this.disposed) return;
    const seedNum =
      typeof seed === "string" ? hashString(seed) : typeof seed === "number" ? seed : 0;
    const dur = 0.28 + seededUnit(seedNum, 7) * 0.12;
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const mesh = new THREE.Mesh(new THREE.RingGeometry(radius * 0.15, radius, 40), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(origin.x, 0.1, origin.z);
    mesh.renderOrder = 5;
    this.scene.add(mesh);
    this.flashes.push({ mesh, mat, age: 0, dur });
  }

  /**
   * Deterministic wind-up length for a named ability on an entity.
   * Same inputs → same windup every run (within map seed family).
   */
  static windupFor(entityId: string, ability: string, base = 0.7, variance = 0.35): number {
    const u = seededUnit(hashString(`${entityId}|${ability}`), 3);
    return base + u * variance;
  }

  /** Deterministic pick among N specials (0..n-1). */
  static pickIndex(entityId: string, counter: number, n: number): number {
    if (n <= 1) return 0;
    return hashString(`${entityId}|special|${counter}`) % n;
  }

  update(delta: number, camera?: THREE.Camera) {
    if (this.disposed) return;
    for (let i = this.active.length - 1; i >= 0; i--) {
      const w = this.active[i]!;
      w.age += delta;
      const p = Math.min(1, w.age / w.dur);
      // Beat faster near impact.
      const beat = Math.sin(w.age * (10 + p * 22) + w.phase);
      const pulse = 0.85 + 0.25 * beat * (0.4 + p);
      w.ring.scale.setScalar(pulse);
      w.matRing.opacity = 0.45 + 0.5 * p;
      w.matGlyph.opacity = 0.55 + 0.45 * Math.abs(beat);
      // Bob + face camera if available
      w.group.position.y = w.baseY + Math.sin(w.age * 6 + w.phase) * 0.12;
      if (camera) {
        w.glyph.quaternion.copy(camera.quaternion);
      }
      if (w.age >= w.dur) {
        this.scene.remove(w.group);
        w.matRing.dispose();
        w.matGlyph.dispose();
        (w.ring.geometry as THREE.BufferGeometry).dispose();
        (w.glyph.geometry as THREE.BufferGeometry).dispose();
        this.active.splice(i, 1);
      }
    }
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const f = this.flashes[i]!;
      f.age += delta;
      const p = Math.min(1, f.age / f.dur);
      f.mesh.scale.setScalar(1 + p * 1.8);
      f.mat.opacity = 0.7 * (1 - p);
      if (f.age >= f.dur) {
        this.scene.remove(f.mesh);
        f.mat.dispose();
        (f.mesh.geometry as THREE.BufferGeometry).dispose();
        this.flashes.splice(i, 1);
      }
    }
  }

  dispose() {
    this.disposed = true;
    for (const w of this.active) {
      this.scene.remove(w.group);
      w.matRing.dispose();
      w.matGlyph.dispose();
      (w.ring.geometry as THREE.BufferGeometry).dispose();
      (w.glyph.geometry as THREE.BufferGeometry).dispose();
    }
    this.active = [];
    for (const f of this.flashes) {
      this.scene.remove(f.mesh);
      f.mat.dispose();
      (f.mesh.geometry as THREE.BufferGeometry).dispose();
    }
    this.flashes = [];
    this.glyphTex?.dispose();
    this.glyphTex = null;
  }
}
