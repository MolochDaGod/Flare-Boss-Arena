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
 * A single soft radial sprite + additive material is shared across all bursts;
 * per-burst color comes from the particle `startColor`. Systems are tracked and
 * culled by age; the shared texture/material are disposed once on teardown.
 *
 * NOTE: three.quarks ships its OWN Vector3/Vector4 (from quarks.core) that are
 * NOT structurally compatible with three's — its particle APIs must be fed the
 * quarks vectors (aliased QVector3/QVector4 here), and emitter positions are set
 * componentwise to avoid the cross-package `.copy()` type clash.
 */

function radialSprite(): THREE.Texture {
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
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
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

interface Live {
  ps: ParticleSystem;
  age: number;
  max: number;
}

export class ParticleVfx {
  private scene: THREE.Scene;
  private batch: BatchedRenderer;
  private tex: THREE.Texture;
  private mat: THREE.MeshBasicMaterial;
  private live: Live[] = [];
  private disposed = false;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.batch = new BatchedRenderer();
    scene.add(this.batch);
    this.tex = radialSprite();
    this.mat = new THREE.MeshBasicMaterial({
      map: this.tex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
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

  /** Quick directional spark burst (skill/melee impact on a target). */
  impact(pos: THREE.Vector3, color: number, scale = 1) {
    if (this.disposed) return;
    try {
      const ps = new ParticleSystem({
        duration: 0.6,
        looping: false,
        worldSpace: true,
        startLife: new IntervalValue(0.2, 0.45),
        startSpeed: new IntervalValue(3 * scale, 7 * scale),
        startSize: new IntervalValue(0.22 * scale, 0.55 * scale),
        startColor: new ConstantColor(v4(color, 1)),
        emissionOverTime: new ConstantValue(0),
        emissionBursts: [
          { time: 0, count: new ConstantValue(Math.round(22 * scale)), cycle: 1, interval: 0.01, probability: 1 },
        ],
        shape: new SphereEmitter({ radius: 0.2, thickness: 1, arc: Math.PI * 2 }),
        material: this.mat,
        renderMode: RenderMode.BillBoard,
      });
      ps.addBehavior(new SizeOverLife(new PiecewiseBezier([[new Bezier(1, 0.7, 0.35, 0), 0]])));
      ps.addBehavior(new ColorOverLife(fadeGradient(color)));
      ps.addBehavior(new ApplyForce(new QVector3(0, -1, 0), new ConstantValue(9)));
      ps.emitter.position.set(pos.x, pos.y, pos.z);
      this.add(ps, 1.0);
    } catch {
      /* ignore */
    }
  }

  /** Expanding ground-hugging ring (nova / AoE detonation). */
  nova(pos: THREE.Vector3, radius: number, color: number) {
    if (this.disposed) return;
    try {
      const ps = new ParticleSystem({
        duration: 0.7,
        looping: false,
        worldSpace: true,
        startLife: new IntervalValue(0.35, 0.6),
        startSpeed: new IntervalValue(radius * 2.2, radius * 3.2),
        startSize: new IntervalValue(0.4, 0.9),
        startColor: new ConstantColor(v4(color, 1)),
        emissionOverTime: new ConstantValue(0),
        emissionBursts: [
          { time: 0, count: new ConstantValue(48), cycle: 1, interval: 0.01, probability: 1 },
        ],
        shape: new SphereEmitter({ radius: 0.3, thickness: 0.1, arc: Math.PI * 2 }),
        material: this.mat,
        renderMode: RenderMode.BillBoard,
      });
      ps.addBehavior(new SizeOverLife(new PiecewiseBezier([[new Bezier(1, 0.9, 0.5, 0), 0]])));
      ps.addBehavior(new ColorOverLife(fadeGradient(color)));
      ps.emitter.position.set(pos.x, pos.y, pos.z);
      this.add(ps, 1.1);
    } catch {
      /* ignore */
    }
  }

  /** Rising fire column (deployable placement / fire totem pulse). */
  fireColumn(pos: THREE.Vector3, color: number) {
    if (this.disposed) return;
    try {
      const ps = new ParticleSystem({
        duration: 0.9,
        looping: false,
        worldSpace: true,
        startLife: new IntervalValue(0.5, 0.9),
        startSpeed: new IntervalValue(0.5, 1.6),
        startSize: new IntervalValue(0.4, 0.85),
        startColor: new ConstantColor(v4(color, 1)),
        emissionOverTime: new ConstantValue(0),
        emissionBursts: [
          { time: 0, count: new ConstantValue(30), cycle: 1, interval: 0.02, probability: 1 },
        ],
        shape: new SphereEmitter({ radius: 0.45, thickness: 1, arc: Math.PI * 2 }),
        material: this.mat,
        renderMode: RenderMode.BillBoard,
      });
      ps.addBehavior(new SizeOverLife(new PiecewiseBezier([[new Bezier(1, 0.8, 0.4, 0), 0]])));
      ps.addBehavior(new ColorOverLife(fadeGradient(color)));
      ps.addBehavior(new ApplyForce(new QVector3(0, 1, 0), new ConstantValue(7)));
      ps.emitter.position.set(pos.x, pos.y, pos.z);
      this.add(ps, 1.3);
    } catch {
      /* ignore */
    }
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
    this.mat.dispose();
    this.tex.dispose();
  }
}
