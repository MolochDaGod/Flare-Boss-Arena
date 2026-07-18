/**
 * Combat projectiles for the dungeon / boss loop.
 *
 * Pattern from ArenaScene + annihilate SwordBlaster / Hadouken:
 *  • bright additive orb + ground shadow ring
 *  • linear or lightly-homing travel
 *  • tight hit radius vs larger visual (generous dodges)
 *  • optional line-beam telegraph before a pierce shot
 */
import * as THREE from "three";
import type { ParticleVfx } from "./particles";
import type { TelegraphField } from "./telegraphs";

export interface ProjectileOpts {
  origin: THREE.Vector3;
  dir: THREE.Vector3;
  damage: number;
  /** Speed world units / sec. */
  speed?: number;
  color?: number;
  /** Hit sphere radius (logical). */
  radius?: number;
  /** Homing strength 0..1 toward target each frame. */
  homing?: number;
  life?: number;
  /** Vertical spawn height. */
  y?: number;
  label?: string;
  /**
   * `enemy` bolts seek/hit the player.
   * `player` bolts hit enemies via `updateHostile` (never the player).
   */
  team?: "enemy" | "player";
}

export interface ActiveProjectile {
  sprite: THREE.Sprite;
  groundRing: THREE.Mesh | null;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  damage: number;
  radius: number;
  homing: number;
  color: number;
  trailT: number;
  label: string;
  hit: boolean;
  team: "enemy" | "player";
  /** Optional quadratic Bezier path (uMMORPG wisp-style). */
  spline?: {
    a: THREE.Vector3;
    b: THREE.Vector3;
    c: THREE.Vector3;
    u: number;
    speed: number;
  };
}

export class ProjectileField {
  private scene: THREE.Scene;
  private particles: ParticleVfx | null;
  private telegraphs: TelegraphField | null;
  private active: ActiveProjectile[] = [];
  private ringGeo: THREE.RingGeometry;
  private disposed = false;
  private _tmp = new THREE.Vector3();

  constructor(
    scene: THREE.Scene,
    particles: ParticleVfx | null = null,
    telegraphs: TelegraphField | null = null,
  ) {
    this.scene = scene;
    this.particles = particles;
    this.telegraphs = telegraphs;
    this.ringGeo = new THREE.RingGeometry(0.4, 0.65, 24);
  }

  /**
   * Fire a bolt. Returns immediately; call `update` each frame and handle
   * hits via the callback when the bolt reaches the player / dies.
   */
  spawn(opts: ProjectileOpts): ActiveProjectile | null {
    if (this.disposed) return null;
    const color = opts.color ?? 0xff5522;
    const y = opts.y ?? 1.2;
    const dir = opts.dir.clone().setY(0);
    if (dir.lengthSq() < 1e-6) dir.set(0, 0, 1);
    dir.normalize();
    const speed = opts.speed ?? 14;

    const sprite = this.particles?.projectileSprite(color, 1.35) ?? makeFallbackSprite(color);
    const start = opts.origin.clone();
    start.y = y;
    sprite.position.copy(start);
    this.scene.add(sprite);

    const ringMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const groundRing = new THREE.Mesh(this.ringGeo, ringMat);
    groundRing.rotation.x = -Math.PI / 2;
    groundRing.position.set(start.x, 0.05, start.z);
    groundRing.renderOrder = 3;
    this.scene.add(groundRing);

    this.particles?.impact(start.clone(), color, 0.55);

    const team = opts.team ?? "enemy";

    // Lead marker for linear enemy shots (player already aims).
    if (team === "enemy" && (opts.homing ?? 0) < 0.05) {
      const pred = start.clone().add(dir.clone().multiplyScalar(6));
      pred.y = 0;
      this.telegraphs?.showCircle(pred, 1.0, 0.55, color, { ring: true, y: 0.05 });
    }

    const p: ActiveProjectile = {
      sprite,
      groundRing,
      pos: start.clone(),
      vel: dir.multiplyScalar(speed),
      life: 0,
      maxLife: opts.life ?? 3.5,
      damage: opts.damage,
      radius: opts.radius ?? 0.95,
      homing: opts.homing ?? 0,
      color,
      trailT: 0,
      label: opts.label ?? "Bolt",
      hit: false,
      team,
    };
    this.active.push(p);
    return p;
  }

  /**
   * Quadratic Bezier projectile (wisp curved bolts).
   * Travels along a→b→c at approximately `speed` world units / sec.
   */
  spawnSpline(opts: {
    origin: THREE.Vector3;
    control: THREE.Vector3;
    target: THREE.Vector3;
    damage: number;
    speed?: number;
    color?: number;
    radius?: number;
    life?: number;
    label?: string;
    team?: "enemy" | "player";
  }): ActiveProjectile | null {
    if (this.disposed) return null;
    const color = opts.color ?? 0xaa66ff;
    const a = opts.origin.clone();
    const b = opts.control.clone();
    const c = opts.target.clone();
    // Approximate curve length for u-speed
    const len =
      a.distanceTo(b) + b.distanceTo(c);
    const speed = opts.speed ?? 13.2;
    const sprite = this.particles?.projectileSprite(color, 1.45) ?? makeFallbackSprite(color);
    sprite.position.copy(a);
    this.scene.add(sprite);
    const ringMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const groundRing = new THREE.Mesh(this.ringGeo, ringMat);
    groundRing.rotation.x = -Math.PI / 2;
    groundRing.position.set(a.x, 0.05, a.z);
    this.scene.add(groundRing);
    const p: ActiveProjectile = {
      sprite,
      groundRing,
      pos: a.clone(),
      vel: new THREE.Vector3(),
      life: 0,
      maxLife: opts.life ?? Math.max(1.2, len / speed + 0.4),
      damage: opts.damage,
      radius: opts.radius ?? 0.9,
      homing: 0,
      color,
      trailT: 0,
      label: opts.label ?? "Spline Bolt",
      hit: false,
      team: opts.team ?? "enemy",
      spline: { a, b, c, u: 0, speed: speed / Math.max(1, len) },
    };
    this.active.push(p);
    return p;
  }

  /** Fan of linear bolts (annihilate / arena volley). */
  spawnVolley(
    origin: THREE.Vector3,
    toward: THREE.Vector3,
    count: number,
    base: Omit<ProjectileOpts, "origin" | "dir">,
  ) {
    const n = Math.max(1, Math.min(7, count));
    const baseAng = Math.atan2(toward.x - origin.x, toward.z - origin.z);
    const spread = (Math.PI / 8) * (n - 1);
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0.5 : i / (n - 1);
      const ang = baseAng - spread / 2 + t * spread;
      const dir = new THREE.Vector3(Math.sin(ang), 0, Math.cos(ang));
      this.spawn({
        ...base,
        origin,
        dir,
        damage: Math.round(base.damage * (Math.abs(t - 0.5) < 0.01 ? 1 : 0.72)),
        homing: Math.abs(t - 0.5) < 0.01 ? base.homing : 0,
      });
    }
  }

  /**
   * Advance projectiles.
   * - Enemy bolts: home/hit `playerPos`
   * - Player bolts: hit first entry in `enemies` within radius
   */
  update(
    delta: number,
    playerPos: THREE.Vector3,
    opts?: {
      invulnerable?: boolean;
      enemies?: Array<{ id: string; position: THREE.Vector3; alive: boolean }>;
    },
  ): {
    playerHits: Array<{ damage: number; label: string; pos: THREE.Vector3 }>;
    enemyHits: Array<{ enemyId: string; damage: number; pos: THREE.Vector3 }>;
  } {
    const playerHits: Array<{ damage: number; label: string; pos: THREE.Vector3 }> = [];
    const enemyHits: Array<{ enemyId: string; damage: number; pos: THREE.Vector3 }> = [];
    if (this.disposed) return { playerHits, enemyHits };

    for (let i = this.active.length - 1; i >= 0; i--) {
      const p = this.active[i]!;
      p.life += delta;

      if (p.spline) {
        // Quadratic Bezier: B(u) = (1-u)^2 A + 2(1-u)u B + u^2 C
        p.spline.u = Math.min(1, p.spline.u + p.spline.speed * delta);
        const u = p.spline.u;
        const omu = 1 - u;
        const { a, b, c } = p.spline;
        p.pos.set(
          omu * omu * a.x + 2 * omu * u * b.x + u * u * c.x,
          omu * omu * a.y + 2 * omu * u * b.y + u * u * c.y,
          omu * omu * a.z + 2 * omu * u * b.z + u * u * c.z,
        );
        p.sprite.position.copy(p.pos);
        if (p.groundRing) {
          p.groundRing.position.x = p.pos.x;
          p.groundRing.position.z = p.pos.z;
        }
        if (u >= 1) {
          // Final impact check handled below; force hit test at end
        }
      } else {
        if (p.team === "enemy" && p.homing > 0) {
          const to = this._tmp.set(playerPos.x - p.pos.x, 0, playerPos.z - p.pos.z);
          if (to.lengthSq() > 1e-4) {
            to.normalize();
            const speed = p.vel.length();
            p.vel.x += to.x * p.homing * 18 * delta;
            p.vel.z += to.z * p.homing * 18 * delta;
            p.vel.setY(0).normalize().multiplyScalar(speed);
          }
        }

        p.pos.x += p.vel.x * delta;
        p.pos.z += p.vel.z * delta;
        p.sprite.position.copy(p.pos);
        if (p.groundRing) {
          p.groundRing.position.x = p.pos.x;
          p.groundRing.position.z = p.pos.z;
        }
      }

      p.trailT += delta;
      if (p.trailT > 0.06) {
        p.trailT = 0;
        this.particles?.impact(p.pos.clone().setY(0.3), p.color, 0.22);
      }

      const hitR = p.radius + 0.45;
      if (p.team === "enemy" && !p.hit) {
        const dx = p.pos.x - playerPos.x;
        const dz = p.pos.z - playerPos.z;
        if (dx * dx + dz * dz <= hitR * hitR) {
          p.hit = true;
          if (!opts?.invulnerable) {
            playerHits.push({ damage: p.damage, label: p.label, pos: p.pos.clone() });
            this.particles?.impact(p.pos.clone(), p.color, 0.85);
          }
          this.killAt(i);
          continue;
        }
      } else if (p.team === "player" && !p.hit && opts?.enemies) {
        for (const en of opts.enemies) {
          if (!en.alive) continue;
          const dx = p.pos.x - en.position.x;
          const dz = p.pos.z - en.position.z;
          if (dx * dx + dz * dz <= hitR * hitR) {
            p.hit = true;
            enemyHits.push({ enemyId: en.id, damage: p.damage, pos: p.pos.clone() });
            this.particles?.impact(p.pos.clone(), p.color, 0.85);
            this.killAt(i);
            break;
          }
        }
        if (p.hit) continue;
      }

      if (p.life >= p.maxLife) {
        this.killAt(i);
      }
    }
    return { playerHits, enemyHits };
  }

  private killAt(i: number) {
    const p = this.active[i]!;
    this.scene.remove(p.sprite);
    (p.sprite.material as THREE.Material).dispose();
    if (p.groundRing) {
      this.scene.remove(p.groundRing);
      (p.groundRing.material as THREE.Material).dispose();
    }
    this.active.splice(i, 1);
  }

  clear() {
    for (let i = this.active.length - 1; i >= 0; i--) this.killAt(i);
  }

  dispose() {
    this.disposed = true;
    this.clear();
    this.ringGeo.dispose();
  }
}

function makeFallbackSprite(color: number): THREE.Sprite {
  const mat = new THREE.SpriteMaterial({
    color,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const s = new THREE.Sprite(mat);
  s.scale.setScalar(1.2);
  return s;
}
