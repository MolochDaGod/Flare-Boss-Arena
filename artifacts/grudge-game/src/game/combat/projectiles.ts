/**
 * Combat projectiles for the dungeon / boss loop.
 *
 * Pattern from ArenaScene + annihilate SwordBlaster / Hadouken:
 *  • bright additive orb + ground shadow ring
 *  • linear or lightly-homing travel
 *  • tight hit radius vs larger visual (dodges win if timed)
 *  • spline / arc bolts: physics + gravity + mild seek (dodgeable)
 *  • optional line-beam telegraph before a pierce shot
 */
import * as THREE from "three";
import type { ParticleVfx } from "./particles";
import type { TelegraphField } from "./telegraphs";

/** World gravity for ballistic / spline bolts (m/s²). */
export const PROJECTILE_GRAVITY = 14.5;
/** Floor Y — bolts die or skip on impact. */
export const PROJECTILE_FLOOR_Y = 0.12;

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
  /** Lateral seek strength (0 = none). Linear bolts use this as 0..1 scale. */
  homing: number;
  color: number;
  trailT: number;
  label: string;
  hit: boolean;
  team: "enemy" | "player";
  /**
   * Ballistic arc bolt (wisp spline style).
   * Mild seek + gravity — not a locked Bezier rail, so dodges work.
   */
  ballistic?: {
    /** Seek acceleration toward live target (units/s²). Low = dodgeable. */
    seekAccel: number;
    /** Gravity scale (1 = PROJECTILE_GRAVITY). */
    gravity: number;
    /** Air drag 0..1 per second (velocity damp). */
    drag: number;
    /** Max turn rate for seek (rad/s) — caps tracking. */
    maxTurn: number;
    /** Min height for a hit (player dodge/jump clears low arcs). */
    hitHeightHalf: number;
  };
  /** @deprecated legacy pure-Bezier; migrated to ballistic. */
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
   * Arc / “spline” bolt — ballistic with light target seek + gravity.
   *
   * Not a locked Bezier rail: initial loft aims near `control`, then mild
   * seek steers toward the live target. Side-steps and dodges clear the
   * small hit sphere when timed well.
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
    /** Seek accel toward target (default ~5.5 — light tracking). */
    seekAccel?: number;
    /** Gravity mult (default 1). */
    gravityScale?: number;
  }): ActiveProjectile | null {
    if (this.disposed) return null;
    const color = opts.color ?? 0xaa66ff;
    const a = opts.origin.clone();
    const b = opts.control.clone();
    const c = opts.target.clone();
    const speed = opts.speed ?? 13.2;

    // Launch toward control point with loft (physics carries the arc).
    const launch = b.clone().sub(a);
    if (launch.lengthSq() < 1e-4) launch.copy(c).sub(a);
    launch.normalize();
    // Bias upward so gravity creates a readable parabola
    launch.y = Math.max(0.35, launch.y + 0.55);
    launch.normalize();
    const vel = launch.multiplyScalar(speed);
    // Extra loft for longer shots
    const horiz = Math.hypot(c.x - a.x, c.z - a.z);
    vel.y += Math.min(6.5, horiz * 0.22);

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

    // Ground telegraph near predicted landing (dodge cue)
    const team = opts.team ?? "enemy";
    if (team === "enemy") {
      const land = c.clone();
      land.y = 0;
      this.telegraphs?.showCircle(land, 1.15, 0.7, color, { ring: true, y: 0.05 });
    }

    const p: ActiveProjectile = {
      sprite,
      groundRing,
      pos: a.clone(),
      vel,
      life: 0,
      maxLife: opts.life ?? Math.max(1.8, horiz / speed + 1.1),
      damage: opts.damage,
      // Tighter than linear bolts so a timed dodge clears
      radius: opts.radius ?? 0.62,
      homing: 0.22,
      color,
      trailT: 0,
      label: opts.label ?? "Spline Bolt",
      hit: false,
      team,
      ballistic: {
        seekAccel: opts.seekAccel ?? 5.5,
        gravity: opts.gravityScale ?? 1,
        drag: 0.08,
        maxTurn: 1.35,
        hitHeightHalf: 1.05,
      },
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

    const aimY = 1.15; // torso aim for seek / hit checks
    for (let i = this.active.length - 1; i >= 0; i--) {
      const p = this.active[i]!;
      p.life += delta;
      const dt = Math.min(delta, 0.05);

      if (p.ballistic) {
        // ── Physics arc: gravity + light seek toward live target ──────────
        const bal = p.ballistic;
        p.vel.y -= PROJECTILE_GRAVITY * bal.gravity * dt;

        // Mild seek — steers but cannot snap; timed dodges break the line
        if (p.team === "enemy" && bal.seekAccel > 0) {
          const dx = playerPos.x - p.pos.x;
          const dy = aimY - p.pos.y;
          const dz = playerPos.z - p.pos.z;
          const dist = Math.hypot(dx, dy, dz);
          if (dist > 0.2) {
            const inv = 1 / dist;
            const ux = dx * inv;
            const uy = dy * inv;
            const uz = dz * inv;
            const speed = Math.max(0.5, p.vel.length());
            // Desired vel toward target (weak pull)
            let sx = ux * speed - p.vel.x;
            let sy = uy * speed - p.vel.y;
            let sz = uz * speed - p.vel.z;
            const maxDelta = bal.seekAccel * dt;
            const sl = Math.hypot(sx, sy, sz);
            if (sl > maxDelta && sl > 1e-6) {
              const k = maxDelta / sl;
              sx *= k;
              sy *= k;
              sz *= k;
            }
            // Horizontal turn clamp
            const hLen = Math.hypot(p.vel.x, p.vel.z);
            const wLen = Math.hypot(ux, uz);
            if (hLen > 1e-4 && wLen > 1e-4) {
              const hx = p.vel.x / hLen;
              const hz = p.vel.z / hLen;
              const wx = ux / wLen;
              const wz = uz / wLen;
              const cross = hx * wz - hz * wx;
              const maxYaw = bal.maxTurn * dt;
              const yaw = THREE.MathUtils.clamp(cross * 2.2 * dt, -maxYaw, maxYaw);
              const cs = Math.cos(yaw);
              const sn = Math.sin(yaw);
              const vx = p.vel.x * cs - p.vel.z * sn;
              const vz = p.vel.x * sn + p.vel.z * cs;
              p.vel.x = vx;
              p.vel.z = vz;
            }
            p.vel.x += sx;
            p.vel.y += sy * 0.55; // less vertical snatch — gravity owns the arc
            p.vel.z += sz;
          }
        }

        // Light air drag
        if (bal.drag > 0) {
          const damp = Math.max(0, 1 - bal.drag * dt);
          p.vel.multiplyScalar(damp);
        }

        p.pos.x += p.vel.x * dt;
        p.pos.y += p.vel.y * dt;
        p.pos.z += p.vel.z * dt;

        // Ground impact — bolt dies, no hit unless player was already overlapping
        if (p.pos.y <= PROJECTILE_FLOOR_Y) {
          p.pos.y = PROJECTILE_FLOOR_Y;
          this.particles?.impact(p.pos.clone(), p.color, 0.5);
          this.killAt(i);
          continue;
        }

        p.sprite.position.copy(p.pos);
        if (p.groundRing) {
          p.groundRing.position.x = p.pos.x;
          p.groundRing.position.z = p.pos.z;
          // Shadow scales slightly with height
          const s = 0.85 + Math.min(1.4, p.pos.y * 0.12);
          p.groundRing.scale.setScalar(s);
        }
      } else if (p.spline) {
        // Legacy pure-Bezier fallback → convert once to ballistic mid-flight
        const u = Math.min(1, (p.spline.u += p.spline.speed * dt));
        const omu = 1 - u;
        const { a, b, c } = p.spline;
        const prev = p.pos.clone();
        p.pos.set(
          omu * omu * a.x + 2 * omu * u * b.x + u * u * c.x,
          omu * omu * a.y + 2 * omu * u * b.y + u * u * c.y,
          omu * omu * a.z + 2 * omu * u * b.z + u * u * c.z,
        );
        p.vel.copy(p.pos).sub(prev).multiplyScalar(1 / Math.max(1e-4, dt));
        p.sprite.position.copy(p.pos);
        if (p.groundRing) {
          p.groundRing.position.x = p.pos.x;
          p.groundRing.position.z = p.pos.z;
        }
      } else {
        if (p.team === "enemy" && p.homing > 0) {
          const to = this._tmp.set(playerPos.x - p.pos.x, 0, playerPos.z - p.pos.z);
          if (to.lengthSq() > 1e-4) {
            to.normalize();
            const speed = p.vel.length();
            p.vel.x += to.x * p.homing * 18 * dt;
            p.vel.z += to.z * p.homing * 18 * dt;
            p.vel.setY(0).normalize().multiplyScalar(speed);
          }
        }

        p.pos.x += p.vel.x * dt;
        p.pos.z += p.vel.z * dt;
        p.sprite.position.copy(p.pos);
        if (p.groundRing) {
          p.groundRing.position.x = p.pos.x;
          p.groundRing.position.z = p.pos.z;
        }
      }

      p.trailT += dt;
      if (p.trailT > 0.05) {
        p.trailT = 0;
        this.particles?.impact(p.pos.clone(), p.color, 0.2);
      }

      // Hit volume: horizontal disk + height band (ballistic) so jumps/dodges clear
      const hitR = p.ballistic ? p.radius + 0.28 : p.radius + 0.45;
      const hitY = p.ballistic?.hitHeightHalf ?? 99;
      if (p.team === "enemy" && !p.hit) {
        const dx = p.pos.x - playerPos.x;
        const dz = p.pos.z - playerPos.z;
        const dy = Math.abs(p.pos.y - aimY);
        if (dx * dx + dz * dz <= hitR * hitR && dy <= hitY) {
          p.hit = true;
          // Invulnerable frames (dodge) fully ignore — classic i-frame dodge
          if (!opts?.invulnerable) {
            playerHits.push({ damage: p.damage, label: p.label, pos: p.pos.clone() });
            this.particles?.impact(p.pos.clone(), p.color, 0.85);
          } else {
            // Whiff VFX when dodged through
            this.particles?.impact(p.pos.clone(), 0xffffff, 0.35);
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
