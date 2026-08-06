/**
 * Brothers' Keeper flying sword — detach → spline path → spin → reattach.
 * Lively combat extension for Racalvin (not a second weapon system).
 */
import * as THREE from "three";
import { getRacalvinWeapons, refreshRacalvinWeaponMounts } from "./racalvinHero";

export type FlySwordMode = "orbit" | "lunge" | "spin" | "guard" | "return";

interface Flight {
  mode: FlySwordMode;
  t: number;
  duration: number;
  curve: THREE.CatmullRomCurve3;
  spinRate: number;
  damage: number;
  hitIds: Set<string>;
  color: number;
}

export class RacalvinFlyingSword {
  private scene: THREE.Scene;
  private free: THREE.Object3D | null = null;
  private flight: Flight | null = null;
  private trail: THREE.Points | null = null;
  private trailGeo: THREE.BufferGeometry | null = null;
  private trailPos: Float32Array | null = null;
  private trailI = 0;
  private disposed = false;
  private readonly _tmp = new THREE.Vector3();
  private readonly _tan = new THREE.Vector3();
  private readonly _up = new THREE.Vector3(0, 1, 0);

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  /** True while the blade is off-hand on a spline. */
  get active(): boolean {
    return !!this.flight && !!this.free;
  }

  /**
   * Launch flying sword from player hand along a combat path.
   * `dir` is XZ aim; `playerPos` feet position.
   */
  launch(
    playerRoot: THREE.Object3D,
    playerPos: THREE.Vector3,
    dir: THREE.Vector3,
    opts: {
      mode?: FlySwordMode;
      range?: number;
      damage?: number;
      color?: number;
      duration?: number;
    } = {},
  ) {
    if (this.disposed) return;
    const rig = getRacalvinWeapons(playerRoot);
    if (!rig || rig.getMode() !== "sword") return;

    this.cancel(playerRoot);

    const mode = opts.mode ?? "lunge";
    const range = opts.range ?? 9;
    const d = dir.clone().setY(0);
    if (d.lengthSq() < 1e-6) d.set(0, 0, 1);
    d.normalize();
    const side = new THREE.Vector3(-d.z, 0, d.x);
    const origin = playerPos.clone().setY(1.25);

    // Sample mount world transform for spawn
    const mount = rig.swordMount;
    const start = new THREE.Vector3();
    mount.getWorldPosition(start);
    if (start.lengthSq() < 1e-6) start.copy(origin);

    let points: THREE.Vector3[];
    switch (mode) {
      case "orbit":
        points = this.orbitPoints(origin, d, side, range * 0.55);
        break;
      case "spin":
        points = this.spinPoints(origin, d, side, range * 0.7);
        break;
      case "guard":
        points = this.guardPoints(origin, d, side);
        break;
      case "lunge":
      default:
        points = this.lungePoints(start, origin, d, range);
        break;
    }

    const curve = new THREE.CatmullRomCurve3(points, false, "catmullrom", 0.35);
    // Clone visual from mount children
    const visual = mount.children[0];
    if (!visual) return;
    const free = visual.clone(true);
    free.traverse((c) => {
      const m = c as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.frustumCulled = false;
        if (m.material) {
          const mats = Array.isArray(m.material) ? m.material : [m.material];
          m.material = mats.map((mat) => {
            const sm = (mat as THREE.MeshStandardMaterial).clone();
            if (sm.emissive) {
              sm.emissive.setHex(opts.color ?? 0x44ff88);
              sm.emissiveIntensity = 0.55;
            }
            sm.needsUpdate = true;
            return sm;
          });
          if (!Array.isArray(m.material) && Array.isArray(m.material)) {
            /* noop */
          }
          if (Array.isArray(m.material) && m.material.length === 1) {
            m.material = m.material[0]!;
          }
        }
      }
    });
    this.scene.add(free);
    this.free = free;
    mount.visible = false;

    this.ensureTrail(opts.color ?? 0x44ff88);

    this.flight = {
      mode,
      t: 0,
      duration: opts.duration ?? (mode === "orbit" || mode === "spin" ? 0.85 : 0.55),
      curve,
      spinRate: mode === "spin" ? 22 : mode === "orbit" ? 14 : 10,
      damage: opts.damage ?? 12,
      hitIds: new Set(),
      color: opts.color ?? 0x44ff88,
    };
  }

  private lungePoints(start: THREE.Vector3, origin: THREE.Vector3, d: THREE.Vector3, range: number) {
    const mid1 = origin.clone().addScaledVector(d, range * 0.35).setY(1.4);
    const tip = origin.clone().addScaledVector(d, range).setY(1.2);
    const mid2 = origin.clone().addScaledVector(d, range * 0.55).add(new THREE.Vector3(-d.z, 0, d.x).multiplyScalar(1.2)).setY(1.55);
    const back = start.clone().setY(1.2);
    return [start.clone(), mid1, tip, mid2, back];
  }

  private orbitPoints(origin: THREE.Vector3, d: THREE.Vector3, side: THREE.Vector3, r: number) {
    const o = origin.clone().setY(1.3);
    return [
      o.clone().addScaledVector(d, 0.6),
      o.clone().addScaledVector(side, r),
      o.clone().addScaledVector(d, -r * 0.4),
      o.clone().addScaledVector(side, -r),
      o.clone().addScaledVector(d, 0.8),
      o.clone().addScaledVector(d, 0.3),
    ];
  }

  private spinPoints(origin: THREE.Vector3, d: THREE.Vector3, side: THREE.Vector3, r: number) {
    const o = origin.clone().setY(1.35);
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      pts.push(
        o
          .clone()
          .addScaledVector(d, Math.cos(a) * r)
          .addScaledVector(side, Math.sin(a) * r)
          .setY(1.2 + Math.sin(a * 2) * 0.25),
      );
    }
    return pts;
  }

  private guardPoints(origin: THREE.Vector3, d: THREE.Vector3, side: THREE.Vector3) {
    const o = origin.clone().setY(1.4);
    return [
      o.clone().addScaledVector(d, 0.4).addScaledVector(side, 0.3),
      o.clone().addScaledVector(d, 0.9),
      o.clone().addScaledVector(d, 0.4).addScaledVector(side, -0.3),
      o.clone().addScaledVector(d, 0.5),
    ];
  }

  private ensureTrail(color: number) {
    if (this.trail) return;
    const n = 48;
    this.trailPos = new Float32Array(n * 3);
    this.trailGeo = new THREE.BufferGeometry();
    this.trailGeo.setAttribute("position", new THREE.BufferAttribute(this.trailPos, 3));
    const mat = new THREE.PointsMaterial({
      color,
      size: 0.12,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    this.trail = new THREE.Points(this.trailGeo, mat);
    this.trail.frustumCulled = false;
    this.scene.add(this.trail);
  }

  private pushTrail(p: THREE.Vector3) {
    if (!this.trailPos || !this.trailGeo) return;
    const i = this.trailI % (this.trailPos.length / 3);
    this.trailPos[i * 3] = p.x;
    this.trailPos[i * 3 + 1] = p.y;
    this.trailPos[i * 3 + 2] = p.z;
    this.trailI++;
    (this.trailGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  }

  /**
   * Advance flight. Returns hit queries for GameEngine to resolve damage.
   */
  update(
    dt: number,
    playerRoot: THREE.Object3D | null,
    enemies: Array<{ id: string; pos: THREE.Vector3; alive: boolean }>,
  ): Array<{ enemyId: string; damage: number }> {
    const hits: Array<{ enemyId: string; damage: number }> = [];
    if (!this.flight || !this.free) return hits;

    this.flight.t += dt;
    const u = Math.min(1, this.flight.t / this.flight.duration);
    const p = this.flight.curve.getPoint(u);
    const tan = this.flight.curve.getTangent(u).normalize();
    this.free.position.copy(p);
    // Align blade roughly along path + continuous spin
    this.free.lookAt(p.clone().add(tan));
    this.free.rotateX(Math.PI / 2);
    this.free.rotateY(this.flight.t * this.flight.spinRate);
    this.pushTrail(p);

    // Hit test near blade
    for (const en of enemies) {
      if (!en.alive || this.flight.hitIds.has(en.id)) continue;
      const dist = en.pos.distanceTo(this._tmp.copy(p).setY(en.pos.y));
      if (dist < 1.35) {
        this.flight.hitIds.add(en.id);
        hits.push({ enemyId: en.id, damage: this.flight.damage });
      }
    }

    if (u >= 1) {
      if (playerRoot) this.reattach(playerRoot);
      else this.cancel(null);
    }
    return hits;
  }

  private reattach(playerRoot: THREE.Object3D) {
    const rig = getRacalvinWeapons(playerRoot);
    if (this.free) {
      this.scene.remove(this.free);
      this.free.traverse((c) => {
        const m = c as THREE.Mesh;
        if (m.isMesh && m.material) {
          const mats = Array.isArray(m.material) ? m.material : [m.material];
          for (const mat of mats) mat.dispose();
        }
      });
      this.free = null;
    }
    if (rig) {
      rig.swordMount.visible = true;
      refreshRacalvinWeaponMounts(playerRoot);
    }
    this.flight = null;
  }

  cancel(playerRoot: THREE.Object3D | null) {
    if (this.free) {
      this.scene.remove(this.free);
      this.free = null;
    }
    if (playerRoot) {
      const rig = getRacalvinWeapons(playerRoot);
      if (rig) rig.swordMount.visible = true;
    }
    this.flight = null;
  }

  dispose() {
    this.disposed = true;
    this.cancel(null);
    if (this.trail) {
      this.scene.remove(this.trail);
      this.trailGeo?.dispose();
      (this.trail.material as THREE.Material).dispose();
      this.trail = null;
    }
  }
}
