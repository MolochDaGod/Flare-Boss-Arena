import * as THREE from "three";
import { getFlameTexture } from "./flameTextures";

/**
 * Imperative port of the VFX-sandbox `FireBurst` detonation, rebuilt for the
 * game's class-based engine (no React/R3F). A burst is a tight flash that
 * blooms into a volumetric flame body (point cloud) plus a break-away spray of
 * ballistic embers, lit by a short-lived point light. Designed to be picked up
 * by the bloom pass — the additive glow layer is the "bloom feed".
 *
 * Scene-agnostic: pass a THREE.Scene; call `burst()` on cast/impact,
 * `update(delta)` each frame, and `dispose()` on teardown.
 */

export type FlameKind = "default" | "fire" | "ice" | "frost" | "spark" | "poison";

/** Hot core + break-away spark tint per element. */
const PALETTE: Record<FlameKind, { core: string; spark: string }> = {
  default: { core: "#ffe7a8", spark: "#ffd27a" },
  fire: { core: "#ffe7a8", spark: "#ffb347" },
  ice: { core: "#eaffff", spark: "#bfefff" },
  frost: { core: "#eaffff", spark: "#cdebff" },
  spark: { core: "#ffffff", spark: "#fff1a8" },
  poison: { core: "#eaffb0", spark: "#a3e635" },
};

const DURATION = 0.5;

export interface BurstOptions {
  /** Element tint preset for the core/spark colors. */
  kind?: FlameKind;
  /** Outer flame color (hex), e.g. an archetype color. Defaults to the kind. */
  color?: number;
  /** Larger, brighter detonation (skills) vs. a compact hit spark. */
  big?: boolean;
  /** Uniform scale multiplier for the whole burst. */
  scale?: number;
}

interface BloomPart {
  dir: THREE.Vector3;
  dist: number;
  seed: number;
}
interface SprayPart {
  dir: THREE.Vector3;
  speed: number;
  life: number;
}

interface ActiveBurst {
  group: THREE.Group;
  core: THREE.Points;
  glow: THREE.Points;
  spray: THREE.Points;
  flash: THREE.Mesh;
  light: THREE.PointLight | null;
  bloomGeom: THREE.BufferGeometry;
  sprayGeom: THREE.BufferGeometry;
  positions: Float32Array;
  colors: Float32Array;
  sprayPos: Float32Array;
  sprayCol: Float32Array;
  parts: BloomPart[];
  sprayParts: SprayPart[];
  count: number;
  sprayCount: number;
  inner: THREE.Color;
  outer: THREE.Color;
  sprayHot: THREE.Color;
  reach: number;
  big: boolean;
  scl: number;
  baseLight: number;
  elapsed: number;
}

export class FlameVfx {
  /** Cap concurrent bursts so heavy AoE / mob density can't spike frame time. */
  private static readonly MAX_ACTIVE = 16;
  /** Point lights are the most expensive part of a burst — budget them tightly. */
  private static readonly MAX_LIGHTS = 6;

  private scene: THREE.Scene;
  private tex: THREE.Texture;
  private active: ActiveBurst[] = [];
  private time = 0;
  private disposed = false;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.tex = getFlameTexture();
  }

  /** Spawn a flame detonation at a world position. */
  burst(pos: THREE.Vector3, opts: BurstOptions = {}) {
    if (this.disposed) return;
    // Recycle the oldest burst when at the concurrency cap so the worst case
    // (dense AoE) stays bounded instead of unbounded geometry/material churn.
    while (this.active.length >= FlameVfx.MAX_ACTIVE) {
      this.disposeBurst(this.active.shift()!);
    }
    const scl = opts.scale ?? 1;
    const big = !!opts.big;
    const reach = (big ? 2.4 : 1.55) * scl;
    const count = big ? 80 : 50;
    const sprayCount = big ? 70 : 46;

    const kind = opts.kind ?? "fire";
    const pal = PALETTE[kind] ?? PALETTE.default;

    const inner = new THREE.Color(pal.core).multiplyScalar(2.3);
    const outer = new THREE.Color(opts.color ?? pal.core).multiplyScalar(1.9);
    const sprayHot = new THREE.Color(pal.spark).multiplyScalar(2.6);

    // Central bloom: outward directions biased slightly upward.
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const parts: BloomPart[] = Array.from({ length: count }, () => {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(1 - Math.random() * 1.6);
      const dir = new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta),
        Math.abs(Math.cos(phi)) * 0.9 + 0.25,
        Math.sin(phi) * Math.sin(theta),
      ).normalize();
      return { dir, dist: 0.55 + Math.random() * 0.55, seed: Math.random() * 100 };
    });

    // Break-away spray: ballistic embers that arc out and fall.
    const sprayPos = new Float32Array(sprayCount * 3);
    const sprayCol = new Float32Array(sprayCount * 3);
    const sprayParts: SprayPart[] = Array.from({ length: sprayCount }, () => {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(1 - Math.random() * 1.5);
      const dir = new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta),
        Math.abs(Math.cos(phi)) * 0.8 + 0.5,
        Math.sin(phi) * Math.sin(theta),
      ).normalize();
      return {
        dir,
        speed: (4.4 + Math.random() * 4.2) * scl,
        life: 0.4 + Math.random() * 0.22,
      };
    });

    const group = new THREE.Group();
    group.position.copy(pos);

    // Flash sphere — a tight hot core that fades immediately.
    const flash = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 18, 18),
      new THREE.MeshBasicMaterial({
        map: this.tex,
        color: inner,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    group.add(flash);

    // Flame body (normal-blended) gives the burst real volume.
    const bloomGeom = new THREE.BufferGeometry();
    bloomGeom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    bloomGeom.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const core = new THREE.Points(
      bloomGeom,
      new THREE.PointsMaterial({
        map: this.tex,
        size: (big ? 0.6 : 0.42) * scl,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.92,
        depthWrite: false,
        vertexColors: true,
        blending: THREE.NormalBlending,
      }),
    );
    core.renderOrder = 1;
    group.add(core);

    // Additive glow over the SAME positions — the bloom feed.
    const glow = new THREE.Points(
      bloomGeom,
      new THREE.PointsMaterial({
        map: this.tex,
        size: (big ? 0.98 : 0.68) * scl,
        sizeAttenuation: true,
        transparent: true,
        depthWrite: false,
        vertexColors: true,
        blending: THREE.AdditiveBlending,
      }),
    );
    glow.renderOrder = 2;
    group.add(glow);

    // Break-away spray.
    const sprayGeom = new THREE.BufferGeometry();
    sprayGeom.setAttribute("position", new THREE.BufferAttribute(sprayPos, 3));
    sprayGeom.setAttribute("color", new THREE.BufferAttribute(sprayCol, 3));
    const spray = new THREE.Points(
      sprayGeom,
      new THREE.PointsMaterial({
        map: this.tex,
        size: (big ? 0.32 : 0.22) * scl,
        sizeAttenuation: true,
        transparent: true,
        depthWrite: false,
        vertexColors: true,
        blending: THREE.AdditiveBlending,
      }),
    );
    spray.renderOrder = 3;
    group.add(spray);

    // Only the brightest few bursts carry a real light — extra dynamic lights
    // are the dominant per-burst cost and add little once bloom is doing the work.
    const baseLight = (big ? 14 : 9) * scl;
    let light: THREE.PointLight | null = null;
    if (this.activeLightCount() < FlameVfx.MAX_LIGHTS) {
      light = new THREE.PointLight(outer, baseLight, 10 * scl);
      group.add(light);
    }

    this.scene.add(group);
    this.active.push({
      group,
      core,
      glow,
      spray,
      flash,
      light,
      bloomGeom,
      sprayGeom,
      positions,
      colors,
      sprayPos,
      sprayCol,
      parts,
      sprayParts,
      count,
      sprayCount,
      inner,
      outer,
      sprayHot,
      reach,
      big,
      scl,
      baseLight,
      elapsed: 0,
    });
  }

  update(delta: number) {
    if (this.disposed || this.active.length === 0) return;
    const dt = Math.min(delta, 0.05);
    this.time += dt;
    const t = this.time;

    for (let bi = this.active.length - 1; bi >= 0; bi--) {
      const b = this.active[bi];
      b.elapsed += dt;
      const e = b.elapsed;
      const k = Math.min(1, e / DURATION);
      const ease = 1 - (1 - k) * (1 - k); // easeOutQuad — fast spread, soft settle

      // Central bloom.
      const { positions, colors, parts, inner, outer, count, reach, scl } = b;
      for (let i = 0; i < count; i++) {
        const pt = parts[i];
        const r = pt.dist * reach * ease;
        positions[i * 3] = pt.dir.x * r + Math.sin(t * 6 + pt.seed) * 0.04 * scl;
        positions[i * 3 + 1] =
          pt.dir.y * r + ease * 0.25 * scl + Math.cos(t * 5 + pt.seed) * 0.04 * scl;
        positions[i * 3 + 2] = pt.dir.z * r + Math.cos(t * 6 + pt.seed) * 0.04 * scl;

        const mix = Math.min(1, k * 1.4);
        const fade = (1 - k) * 1.7;
        colors[i * 3] = (inner.r + (outer.r - inner.r) * mix) * fade;
        colors[i * 3 + 1] = (inner.g + (outer.g - inner.g) * mix) * fade;
        colors[i * 3 + 2] = (inner.b + (outer.b - inner.b) * mix) * fade;
      }
      b.bloomGeom.attributes.position.needsUpdate = true;
      b.bloomGeom.attributes.color.needsUpdate = true;

      // Break-away spray — ballistic embers that arc out, drop, then fade.
      const { sprayPos, sprayCol, sprayParts, sprayCount, sprayHot } = b;
      const g = 7.0 * scl;
      for (let i = 0; i < sprayCount; i++) {
        const pt = sprayParts[i];
        const lt = Math.min(e, pt.life);
        sprayPos[i * 3] = pt.dir.x * pt.speed * lt;
        sprayPos[i * 3 + 1] = pt.dir.y * pt.speed * lt - 0.5 * g * lt * lt;
        sprayPos[i * 3 + 2] = pt.dir.z * pt.speed * lt;
        const sk = THREE.MathUtils.clamp(e / pt.life, 0, 1);
        const fade = (1 - sk) * 2.0;
        sprayCol[i * 3] = sprayHot.r * fade;
        sprayCol[i * 3 + 1] = sprayHot.g * fade;
        sprayCol[i * 3 + 2] = sprayHot.b * fade;
      }
      b.sprayGeom.attributes.position.needsUpdate = true;
      b.sprayGeom.attributes.color.needsUpdate = true;

      // Flash sphere swells and fades.
      const s = ((b.big ? 0.5 : 0.32) + ease * (b.big ? 1.3 : 0.8)) * scl;
      b.flash.scale.setScalar(s);
      (b.flash.material as THREE.MeshBasicMaterial).opacity = 1 - k;

      // Light decays out (only present on the brightest budgeted bursts).
      if (b.light) b.light.intensity = b.baseLight * (1 - k);

      if (k >= 1) {
        this.disposeBurst(b);
        this.active.splice(bi, 1);
      }
    }
  }

  private activeLightCount(): number {
    let n = 0;
    for (const b of this.active) if (b.light) n++;
    return n;
  }

  private disposeBurst(b: ActiveBurst) {
    this.scene.remove(b.group);
    b.bloomGeom.dispose();
    b.sprayGeom.dispose();
    (b.core.material as THREE.Material).dispose();
    (b.glow.material as THREE.Material).dispose();
    (b.spray.material as THREE.Material).dispose();
    b.flash.geometry.dispose();
    (b.flash.material as THREE.Material).dispose();
    // Shared cached flame texture is intentionally NOT disposed here.
  }

  dispose() {
    this.disposed = true;
    for (const b of this.active) this.disposeBurst(b);
    this.active = [];
  }
}
