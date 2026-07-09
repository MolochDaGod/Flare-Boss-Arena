import * as THREE from "three";
import {
  BatchedRenderer,
  ParticleSystem,
  RenderMode,
  ConstantValue,
  IntervalValue,
  ConstantColor,
  Gradient,
  SphereEmitter,
  SizeOverLife,
  ColorOverLife,
  ApplyForce,
  Bezier,
  PiecewiseBezier,
  Vector3 as QVector3,
  Vector4 as QVector4,
} from "three.quarks";

/**
 * three.quarks particle bursts for skill combat. Every public call is wrapped so
 * a particle hiccup can never break gameplay (mirrors the GLB VFX philosophy).
 *
 * The system is ELEMENT-AWARE: four shared sprite textures (soft glow, sharp
 * spark-star, billowing smoke, hard ice/debris shard) are combined per element
 * (fire / ice / lightning / poison / arcane / physical) into distinct "node"
 * bursts, then arranged into shape-distinct silhouettes (`castSkillVfx`): a nova
 * ground ring, a cone fan, a line of sparks down a beam, a meteor drop, or a
 * rising column. So two skills of different element + shape never look alike.
 *
 * NOTE: three.quarks ships its OWN Vector3/Vector4 (from quarks.core) that are
 * NOT structurally compatible with three's — its particle APIs must be fed the
 * quarks vectors (aliased QVector3/QVector4 here), and emitter positions are set
 * componentwise to avoid the cross-package `.copy()` type clash.
 */

export type SkillElement =
  | "fire"
  | "ice"
  | "lightning"
  | "poison"
  | "arcane"
  | "psychic"
  | "physical";

type TexKind = "glow" | "spark" | "smoke" | "shard";

interface ElementStyle {
  /** Bright inner color (particle start). */
  core: number;
  /** Outer/fade color. */
  edge: number;
  /** Telegraph + general tint (exported via elementColor). */
  tint: number;
}

const STYLES: Record<SkillElement, ElementStyle> = {
  fire: { core: 0xffe39a, edge: 0xff3b14, tint: 0xff5a1e },
  ice: { core: 0xeafdff, edge: 0x3fa9ff, tint: 0x6fd2ff },
  lightning: { core: 0xffffff, edge: 0x7db8ff, tint: 0x9ad8ff },
  poison: { core: 0xe6ff8a, edge: 0x4fae1f, tint: 0x7fe04a },
  arcane: { core: 0xf0dcff, edge: 0x7a4bff, tint: 0x8a6bff },
  psychic: { core: 0xccffee, edge: 0x22cc66, tint: 0x44ff88 },
  physical: { core: 0xffe9c4, edge: 0x9a7b44, tint: 0xc5a059 },
};

/** The element's signature tint — used to color telegraphs so they match. */
export function elementColor(element: SkillElement): number {
  return STYLES[element].tint;
}

function v4(hex: number, a = 1): QVector4 {
  const c = new THREE.Color(hex);
  return new QVector4(c.r, c.g, c.b, a);
}

function rgb3(hex: number): QVector3 {
  const c = new THREE.Color(hex);
  return new QVector3(c.r, c.g, c.b);
}

/** Constant-color gradient that fades alpha 1 -> 0 across particle life. */
function fadeGradient(color: number): Gradient {
  return new Gradient(
    [
      [rgb3(color), 0],
      [rgb3(color), 1],
    ],
    [
      [1, 0],
      [0, 1],
    ],
  );
}

/** Hot-core gradient: bright `core` -> `edge`, alpha 1 -> 0 (energy look). */
function hotGradient(core: number, edge: number): Gradient {
  return new Gradient(
    [
      [rgb3(core), 0],
      [rgb3(edge), 0.5],
      [rgb3(edge), 1],
    ],
    [
      [1, 0],
      [0.85, 0.45],
      [0, 1],
    ],
  );
}

// ---- procedural sprite textures -------------------------------------------

function makeGlow(): THREE.Texture {
  const s = 64;
  const c = document.createElement("canvas");
  c.width = c.height = s;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.4, "rgba(255,255,255,0.55)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, s, s);
  return canvasTex(c);
}

function makeSpark(): THREE.Texture {
  const s = 64;
  const c = document.createElement("canvas");
  c.width = c.height = s;
  const g = c.getContext("2d")!;
  const h = s / 2;
  // bright tight core
  const core = g.createRadialGradient(h, h, 0, h, h, 10);
  core.addColorStop(0, "rgba(255,255,255,1)");
  core.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = core;
  g.fillRect(0, 0, s, s);
  // four-point star streaks
  g.globalCompositeOperation = "lighter";
  const draw = (horiz: boolean) => {
    const lg = horiz
      ? g.createLinearGradient(0, h, s, h)
      : g.createLinearGradient(h, 0, h, s);
    lg.addColorStop(0, "rgba(255,255,255,0)");
    lg.addColorStop(0.5, "rgba(255,255,255,0.9)");
    lg.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = lg;
    if (horiz) g.fillRect(0, h - 1.5, s, 3);
    else g.fillRect(h - 1.5, 0, 3, s);
  };
  draw(true);
  draw(false);
  return canvasTex(c);
}

function makeSmoke(): THREE.Texture {
  const s = 64;
  const c = document.createElement("canvas");
  c.width = c.height = s;
  const g = c.getContext("2d")!;
  // a few overlapping soft blobs for a billowing, irregular puff
  const blob = (x: number, y: number, r: number, a: number) => {
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, `rgba(255,255,255,${a})`);
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, s, s);
  };
  blob(32, 32, 30, 0.5);
  blob(24, 26, 16, 0.35);
  blob(42, 38, 18, 0.3);
  blob(36, 22, 12, 0.3);
  return canvasTex(c);
}

function makeShard(): THREE.Texture {
  const s = 64;
  const c = document.createElement("canvas");
  c.width = c.height = s;
  const g = c.getContext("2d")!;
  g.translate(s / 2, s / 2);
  g.rotate(Math.PI / 4);
  const grad = g.createLinearGradient(-s / 2, 0, s / 2, 0);
  grad.addColorStop(0, "rgba(255,255,255,0)");
  grad.addColorStop(0.5, "rgba(255,255,255,1)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  const d = s * 0.42;
  g.fillRect(-d / 2, -d / 2, d, d);
  return canvasTex(c);
}

function canvasTex(c: HTMLCanvasElement): THREE.Texture {
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Rotate an XZ vector around +Y by `a` radians. */
function rotY(v: THREE.Vector3, a: number): THREE.Vector3 {
  const cs = Math.cos(a);
  const sn = Math.sin(a);
  return new THREE.Vector3(v.x * cs + v.z * sn, 0, -v.x * sn + v.z * cs);
}

interface Live {
  ps: ParticleSystem;
  age: number;
  max: number;
}

interface EmitCfg {
  tex: TexKind;
  pos: THREE.Vector3;
  count: number;
  duration: number;
  life: [number, number];
  speed: [number, number];
  size: [number, number];
  core: number;
  edge: number;
  /** Emitter shell radius. */
  emit?: number;
  thickness?: number;
  arc?: number;
  /** Directional force (e.g. gravity / updraft). */
  force?: [number, number, number];
  forceMag?: number;
  /** Size-over-life bezier control points (start..end). */
  sizeCurve?: [number, number, number, number];
  /** Tracked lifetime before culling. */
  max: number;
}

export class ParticleVfx {
  private scene: THREE.Scene;
  private batch: BatchedRenderer;
  private texes: Record<TexKind, THREE.Texture>;
  private mats: Record<TexKind, THREE.MeshBasicMaterial>;
  private live: Live[] = [];
  private disposed = false;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.batch = new BatchedRenderer();
    scene.add(this.batch);
    this.texes = {
      glow: makeGlow(),
      spark: makeSpark(),
      smoke: makeSmoke(),
      shard: makeShard(),
    };
    const mk = (t: THREE.Texture) =>
      new THREE.MeshBasicMaterial({
        map: t,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
    this.mats = {
      glow: mk(this.texes.glow),
      spark: mk(this.texes.spark),
      smoke: mk(this.texes.smoke),
      shard: mk(this.texes.shard),
    };
  }

  private add(ps: ParticleSystem, max: number) {
    try {
      this.scene.add(ps.emitter);
      this.batch.addSystem(ps);
      this.live.push({ ps, age: 0, max });
    } catch {
      /* never break gameplay */
    }
  }

  /** Low-level burst. All higher-level effects compose one or more of these. */
  private emit(cfg: EmitCfg) {
    if (this.disposed) return;
    try {
      const ps = new ParticleSystem({
        duration: cfg.duration,
        looping: false,
        worldSpace: true,
        startLife: new IntervalValue(cfg.life[0], cfg.life[1]),
        startSpeed: new IntervalValue(cfg.speed[0], cfg.speed[1]),
        startSize: new IntervalValue(cfg.size[0], cfg.size[1]),
        startColor: new ConstantColor(v4(cfg.core, 1)),
        emissionOverTime: new ConstantValue(0),
        emissionBursts: [
          { time: 0, count: new ConstantValue(cfg.count), cycle: 1, interval: 0.01, probability: 1 },
        ],
        shape: new SphereEmitter({
          radius: cfg.emit ?? 0.2,
          thickness: cfg.thickness ?? 1,
          arc: cfg.arc ?? Math.PI * 2,
        }),
        material: this.mats[cfg.tex],
        renderMode: RenderMode.BillBoard,
      });
      const sc = cfg.sizeCurve ?? [1, 0.7, 0.35, 0];
      ps.addBehavior(new SizeOverLife(new PiecewiseBezier([[new Bezier(sc[0], sc[1], sc[2], sc[3]), 0]])));
      ps.addBehavior(new ColorOverLife(hotGradient(cfg.core, cfg.edge)));
      if (cfg.force && cfg.forceMag)
        ps.addBehavior(new ApplyForce(new QVector3(cfg.force[0], cfg.force[1], cfg.force[2]), new ConstantValue(cfg.forceMag)));
      ps.emitter.position.set(cfg.pos.x, cfg.pos.y, cfg.pos.z);
      this.add(ps, cfg.max);
    } catch {
      /* ignore */
    }
  }

  /**
   * Atomic element "node" burst at a point — the visual DNA of each element.
   * `scale` shrinks counts/size so shapes built from many nodes stay cheap.
   */
  private node(element: SkillElement, pos: THREE.Vector3, scale = 1) {
    const s = STYLES[element];
    const n = (c: number) => Math.max(4, Math.round(c * scale));
    const p = pos.clone();
    p.y = Math.max(p.y, 0.15);
    switch (element) {
      case "fire":
        // rising embers + a dark smoke wisp
        this.emit({ tex: "spark", pos: p, count: n(16), duration: 0.6, life: [0.3, 0.6], speed: [1.5 * scale, 4 * scale], size: [0.25 * scale, 0.6 * scale], core: s.core, edge: s.edge, emit: 0.25 * scale, force: [0, 1, 0], forceMag: 5, max: 1.0 });
        this.emit({ tex: "smoke", pos: p, count: n(6), duration: 0.9, life: [0.5, 0.95], speed: [0.4, 1.2], size: [0.6 * scale, 1.3 * scale], core: 0xdd6a3a, edge: 0x2a0e04, force: [0, 1, 0], forceMag: 2, sizeCurve: [0.4, 0.8, 1, 0.6], max: 1.3 });
        break;
      case "ice":
        // sharp crystalline shards flung outward
        this.emit({ tex: "shard", pos: p, count: n(18), duration: 0.6, life: [0.25, 0.5], speed: [4 * scale, 8 * scale], size: [0.3 * scale, 0.7 * scale], core: s.core, edge: s.edge, emit: 0.2, thickness: 0.4, force: [0, -1, 0], forceMag: 6, max: 0.9 });
        this.emit({ tex: "glow", pos: p, count: n(6), duration: 0.5, life: [0.2, 0.4], speed: [0.5, 1.5], size: [0.5 * scale, 1.0 * scale], core: 0xeafdff, edge: s.edge, max: 0.8 });
        break;
      case "lightning":
        // ultra-fast bright sparks + a hot flash
        this.emit({ tex: "spark", pos: p, count: n(22), duration: 0.4, life: [0.1, 0.28], speed: [7 * scale, 14 * scale], size: [0.2 * scale, 0.5 * scale], core: s.core, edge: s.edge, emit: 0.15, thickness: 0.3, max: 0.7 });
        this.emit({ tex: "glow", pos: p, count: n(4), duration: 0.3, life: [0.08, 0.18], speed: [0, 0.5], size: [1.0 * scale, 2.2 * scale], core: 0xffffff, edge: s.edge, sizeCurve: [1, 0.4, 0.1, 0], max: 0.5 });
        break;
      case "poison":
        // slow, lingering toxic motes that sink + bubble
        this.emit({ tex: "glow", pos: p, count: n(14), duration: 1.2, life: [0.8, 1.4], speed: [1 * scale, 2.5 * scale], size: [0.35 * scale, 0.8 * scale], core: s.core, edge: s.edge, emit: 0.4, force: [0, -1, 0], forceMag: 1.5, max: 1.6 });
        this.emit({ tex: "smoke", pos: p, count: n(6), duration: 1.3, life: [0.9, 1.5], speed: [0.3, 1.0], size: [0.7 * scale, 1.5 * scale], core: 0x6fae2a, edge: 0x12300a, max: 1.7 });
        break;
      case "arcane":
        // swirling violet motes + fine sparks
        this.emit({ tex: "glow", pos: p, count: n(16), duration: 0.8, life: [0.4, 0.8], speed: [2 * scale, 5 * scale], size: [0.3 * scale, 0.7 * scale], core: s.core, edge: s.edge, emit: 0.35, force: [0, 1, 0], forceMag: 2.5, max: 1.1 });
        this.emit({ tex: "spark", pos: p, count: n(8), duration: 0.7, life: [0.3, 0.6], speed: [3 * scale, 6 * scale], size: [0.2 * scale, 0.45 * scale], core: 0xffffff, edge: s.edge, max: 1.0 });
        break;
      case "psychic":
        // green mind-motes + sharp psychic sparks
        this.emit({ tex: "glow", pos: p, count: n(18), duration: 0.75, life: [0.35, 0.75], speed: [2.5 * scale, 5.5 * scale], size: [0.35 * scale, 0.75 * scale], core: s.core, edge: s.edge, emit: 0.3, force: [0, 0.6, 0], forceMag: 2, max: 1.1 });
        this.emit({ tex: "spark", pos: p, count: n(12), duration: 0.55, life: [0.2, 0.45], speed: [4 * scale, 8 * scale], size: [0.18 * scale, 0.4 * scale], core: 0xeafff5, edge: s.edge, emit: 0.2, max: 0.95 });
        break;
      case "physical":
        // gritty debris flung out + a dust kick
        this.emit({ tex: "shard", pos: p, count: n(16), duration: 0.55, life: [0.25, 0.5], speed: [3 * scale, 7 * scale], size: [0.25 * scale, 0.6 * scale], core: s.core, edge: s.edge, emit: 0.2, force: [0, -1, 0], forceMag: 9, max: 0.9 });
        this.emit({ tex: "smoke", pos: p, count: n(6), duration: 0.8, life: [0.4, 0.8], speed: [0.5, 1.5], size: [0.7 * scale, 1.4 * scale], core: 0xb59a6a, edge: 0x2a221a, force: [0, 1, 0], forceMag: 1.5, max: 1.1 });
        break;
    }
  }

  /**
   * High-level skill cast — composes element nodes into a shape-distinct
   * silhouette so each (element, shape) reads uniquely.
   */
  castSkillVfx(o: {
    element: SkillElement;
    shape: string;
    /** AoE/impact center (nova/circle). */
    center: THREE.Vector3;
    /** Caster position (cone/line project forward from here). */
    origin: THREE.Vector3;
    dir: THREE.Vector3;
    reach: number;
    halfAngle?: number;
  }) {
    if (this.disposed) return;
    const fwd = o.dir.clone().setY(0);
    if (fwd.lengthSq() < 1e-4) fwd.set(0, 0, 1);
    fwd.normalize();
    const { element, reach } = o;
    try {
      switch (o.shape) {
        case "nova":
          this.shapeNova(element, o.center, reach);
          break;
        case "circle":
          this.shapeMeteor(element, o.center, reach);
          break;
        case "cone":
          this.shapeCone(element, o.origin, fwd, reach, o.halfAngle ?? Math.PI / 4);
          break;
        case "line":
          this.shapeLine(element, o.origin, fwd, reach);
          break;
        case "deployable":
          this.shapeColumn(element, o.center);
          break;
        default:
          this.node(element, o.center, 1.2);
      }
    } catch {
      /* ignore */
    }
  }

  /** Ground-hugging ring of nodes + a central pop. */
  private shapeNova(element: SkillElement, center: THREE.Vector3, radius: number) {
    const c = center.clone();
    c.y = 0.3;
    const n = Math.min(14, Math.max(8, Math.round(radius)));
    const r = Math.max(1.5, radius * 0.85);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const p = new THREE.Vector3(c.x + Math.cos(a) * r, 0.3, c.z + Math.sin(a) * r);
      this.node(element, p, 0.5);
    }
    this.node(element, c, 1.0);
    // wide low ground flash
    this.emit({ tex: "glow", pos: c, count: 18, duration: 0.6, life: [0.25, 0.5], speed: [radius * 2, radius * 3], size: [0.5, 1.0], core: STYLES[element].core, edge: STYLES[element].edge, emit: 0.3, thickness: 0.15, max: 1.0 });
  }

  /** Meteor/blast: a streak crashing down + a ground burst. */
  private shapeMeteor(element: SkillElement, center: THREE.Vector3, radius: number) {
    const s = STYLES[element];
    const above = center.clone();
    above.y = 7;
    // descending streak
    this.emit({ tex: "spark", pos: above, count: 14, duration: 0.5, life: [0.18, 0.32], speed: [10, 16], size: [0.4, 0.9], core: s.core, edge: s.edge, emit: 0.3, thickness: 0.5, force: [0, -1, 0], forceMag: 20, max: 0.7 });
    // ground impact ring of nodes
    const n = 6;
    const r = Math.max(1.2, radius * 0.6);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      this.node(element, new THREE.Vector3(center.x + Math.cos(a) * r, 0.3, center.z + Math.sin(a) * r), 0.5);
    }
    this.node(element, center.clone().setY(0.4), 1.3);
  }

  /** Forward fan of nodes filling a cone. */
  private shapeCone(element: SkillElement, origin: THREE.Vector3, fwd: THREE.Vector3, reach: number, half: number) {
    const rings = [reach * 0.55, reach * 0.9];
    for (const dist of rings) {
      const steps = 4;
      for (let i = 0; i <= steps; i++) {
        const a = -half + (2 * half * i) / steps;
        const d = rotY(fwd, a).multiplyScalar(dist);
        const p = new THREE.Vector3(origin.x + d.x, 0.6, origin.z + d.z);
        this.node(element, p, 0.45);
      }
    }
  }

  /** A line of sparks down a beam, brighter at the far end. */
  private shapeLine(element: SkillElement, origin: THREE.Vector3, fwd: THREE.Vector3, reach: number) {
    const steps = 7;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const d = fwd.clone().multiplyScalar(reach * t);
      const p = new THREE.Vector3(origin.x + d.x, 0.7, origin.z + d.z);
      this.node(element, p, i === steps ? 0.9 : 0.4);
    }
  }

  /** Tall rising column (deployable placement / totem pulse). */
  private shapeColumn(element: SkillElement, pos: THREE.Vector3) {
    const s = STYLES[element];
    const p = pos.clone();
    p.y = 0.3;
    this.emit({ tex: "spark", pos: p, count: 26, duration: 0.9, life: [0.5, 0.95], speed: [1, 3], size: [0.4, 0.9], core: s.core, edge: s.edge, emit: 0.5, thickness: 0.6, force: [0, 1, 0], forceMag: 9, sizeCurve: [1, 0.85, 0.45, 0], max: 1.3 });
    this.emit({ tex: "smoke", pos: p, count: 10, duration: 1.0, life: [0.6, 1.1], speed: [0.4, 1.2], size: [0.8, 1.6], core: s.edge, edge: 0x1a1208, force: [0, 1, 0], forceMag: 3, max: 1.4 });
    this.node(element, p, 0.8);
  }

  // ---- back-compat primitives (boss bolts, melee hits, detonations) --------

  /** Quick directional spark burst (skill/melee impact on a target). */
  impact(pos: THREE.Vector3, color: number, scale = 1) {
    this.emit({
      tex: "spark",
      pos: pos.clone(),
      count: Math.round(22 * scale),
      duration: 0.6,
      life: [0.2, 0.45],
      speed: [3 * scale, 7 * scale],
      size: [0.22 * scale, 0.55 * scale],
      core: 0xffffff,
      edge: color,
      emit: 0.2,
      force: [0, -1, 0],
      forceMag: 9,
      max: 1.0,
    });
  }

  /** Expanding ground-hugging ring (nova / AoE detonation). */
  nova(pos: THREE.Vector3, radius: number, color: number) {
    this.emit({
      tex: "glow",
      pos: pos.clone(),
      count: 48,
      duration: 0.7,
      life: [0.35, 0.6],
      speed: [radius * 2.2, radius * 3.2],
      size: [0.4, 0.9],
      core: 0xffffff,
      edge: color,
      emit: 0.3,
      thickness: 0.1,
      sizeCurve: [1, 0.9, 0.5, 0],
      max: 1.1,
    });
  }

  /** Rising fire column (deployable placement / fire totem pulse). */
  fireColumn(pos: THREE.Vector3, color: number) {
    this.emit({
      tex: "spark",
      pos: pos.clone(),
      count: 30,
      duration: 0.9,
      life: [0.5, 0.9],
      speed: [0.5, 1.6],
      size: [0.4, 0.85],
      core: 0xffe39a,
      edge: color,
      emit: 0.45,
      force: [0, 1, 0],
      forceMag: 7,
      sizeCurve: [1, 0.8, 0.4, 0],
      max: 1.3,
    });
  }

  /**
   * A glowing additive billboard for a tracked projectile body (boss bolts).
   * Reuses the shared soft-radial particle texture so projectiles match the
   * burst VFX instead of being flat-shaded primitive spheres. The caller adds
   * it to the scene, moves it each frame, and disposes the returned material
   * (the texture is shared and freed once on `dispose()`).
   */
  projectileSprite(color: number, size = 1): THREE.Sprite {
    const mat = new THREE.SpriteMaterial({
      map: this.texes.glow,
      color: new THREE.Color(color),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.setScalar(size);
    return sprite;
  }

  update(delta: number) {
    if (this.disposed) return;
    try {
      this.batch.update(delta);
    } catch {
      /* ignore */
    }
    for (let i = this.live.length - 1; i >= 0; i--) {
      const l = this.live[i];
      l.age += delta;
      if (l.age >= l.max) {
        try {
          this.batch.deleteSystem(l.ps);
        } catch {
          /* ignore */
        }
        try {
          this.scene.remove(l.ps.emitter);
        } catch {
          /* ignore */
        }
        this.live.splice(i, 1);
      }
    }
  }

  dispose() {
    this.disposed = true;
    for (const l of this.live) {
      try {
        this.batch.deleteSystem(l.ps);
      } catch {
        /* ignore */
      }
      try {
        this.scene.remove(l.ps.emitter);
      } catch {
        /* ignore */
      }
    }
    this.live = [];
    try {
      this.scene.remove(this.batch);
    } catch {
      /* ignore */
    }
    for (const m of Object.values(this.mats)) m.dispose();
    for (const t of Object.values(this.texes)) t.dispose();
  }
}
