import * as THREE from "three";
import type { CombatTarget } from "./types";
import type { DeployableKind } from "./skillArchetypes";
import { ParticleVfx } from "./particles";
import { TelegraphField } from "./telegraphs";
import { createHotZoneMaterial } from "./hotZoneMaterial";

/**
 * Deployable entity system: player-summoned constructs that act on their own.
 *  - fire_totem: pulses an AoE nova every ~1.5s.
 *  - turret: auto-fires a hitscan bolt at the nearest target every ~1.0s.
 *  - trap: arms, then proximity-detonates a heavy AoE once.
 * All meshes are procedural (no assets). Damage is dealt through CombatTarget so
 * the system is identical across scenes. Teardown disposes every GPU resource.
 */

export interface DeployContext {
  targets: readonly CombatTarget[];
  particles?: ParticleVfx;
  telegraphs?: TelegraphField;
  log?: (msg: string) => void;
}

function disposeGroup(root: THREE.Object3D) {
  root.traverse((c) => {
    const m = c as THREE.Mesh;
    if (!m.isMesh) return;
    m.geometry?.dispose();
    const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
    for (const mat of mats) mat.dispose();
  });
}

function nearestTarget(from: THREE.Vector3, targets: readonly CombatTarget[], maxDist: number): CombatTarget | null {
  let best: CombatTarget | null = null;
  let bestD = maxDist * maxDist;
  for (const t of targets) {
    if (!t.isAlive()) continue;
    const dx = t.position.x - from.x;
    const dz = t.position.z - from.z;
    const d = dx * dx + dz * dz;
    if (d <= bestD) {
      bestD = d;
      best = t;
    }
  }
  return best;
}

abstract class Deployable {
  readonly group = new THREE.Group();
  protected age = 0;
  dead = false;
  protected readonly life: number;
  protected readonly color: number;
  protected readonly baseDamage: number;
  protected readonly radius: number;

  constructor(life: number, color: number, baseDamage: number, radius: number) {
    this.life = life;
    this.color = color;
    this.baseDamage = baseDamage;
    this.radius = radius;
  }

  abstract build(): void;
  protected abstract step(delta: number, ctx: DeployContext): void;

  update(delta: number, ctx: DeployContext) {
    this.age += delta;
    if (this.age >= this.life) {
      this.dead = true;
      return;
    }
    this.step(delta, ctx);
  }

  dispose() {
    disposeGroup(this.group);
  }
}

class FireTotem extends Deployable {
  private interval = 1.5;
  private timer = 0.6;
  private flameMat?: THREE.ShaderMaterial;
  private flameDisc?: THREE.Mesh;

  constructor(color: number, baseDamage: number, radius: number) {
    super(12, color, baseDamage, radius);
  }

  build() {
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.26, 1.4, 8),
      new THREE.MeshStandardMaterial({ color: 0x2a1c12, roughness: 0.8 }),
    );
    pole.position.y = 0.7;
    pole.castShadow = true;
    this.flameMat = createHotZoneMaterial(this.color, false, 0.55);
    this.flameDisc = new THREE.Mesh(new THREE.CircleGeometry(0.55, 32), this.flameMat);
    this.flameDisc.rotation.x = -Math.PI / 2;
    this.flameDisc.position.y = 1.45;
    const light = new THREE.PointLight(this.color, 3, 6, 2);
    light.position.y = 1.5;
    this.group.add(pole, this.flameDisc, light);
  }

  protected step(delta: number, ctx: DeployContext) {
    if (this.flameMat) {
      this.flameMat.uniforms.uTime!.value = this.age;
      this.flameMat.uniforms.uOpacity!.value = 0.45 + Math.sin(this.age * 5) * 0.15;
    }
    this.timer -= delta;
    if (this.timer > 0) return;
    this.timer = this.interval;
    const center = this.group.position.clone();
    ctx.telegraphs?.show({ kind: "nova", origin: center, dir: new THREE.Vector3(0, 0, 1), radius: this.radius }, 0.3, this.color);
    ctx.particles?.nova(center.clone().setY(0.4), this.radius, this.color);
    for (const t of ctx.targets) {
      if (!t.isAlive()) continue;
      const dx = t.position.x - center.x;
      const dz = t.position.z - center.z;
      if (dx * dx + dz * dz > this.radius * this.radius) continue;
      const isCrit = Math.random() < 0.12;
      t.applyDamage(this.baseDamage * (isCrit ? 1.75 : 1), isCrit);
    }
  }
}

class Turret extends Deployable {
  private interval = 1.0;
  private timer = 0.4;
  private barrel?: THREE.Mesh;

  constructor(color: number, baseDamage: number, radius: number) {
    super(14, color, baseDamage, radius);
  }

  build() {
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.4, 0.5, 0.5, 10),
      new THREE.MeshStandardMaterial({ color: 0x3a3026, roughness: 0.7, metalness: 0.3 }),
    );
    base.position.y = 0.25;
    base.castShadow = true;
    const barrel = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.22, 1.1),
      new THREE.MeshStandardMaterial({ color: this.color, emissive: this.color, emissiveIntensity: 0.5, roughness: 0.4, metalness: 0.4 }),
    );
    barrel.position.y = 0.6;
    barrel.position.z = 0.35;
    this.barrel = barrel;
    this.group.add(base, barrel);
  }

  protected step(delta: number, ctx: DeployContext) {
    const origin = this.group.position.clone().setY(0.6);
    const target = nearestTarget(this.group.position, ctx.targets, this.radius);
    if (this.barrel && target) {
      const yaw = Math.atan2(target.position.x - this.group.position.x, target.position.z - this.group.position.z);
      this.group.rotation.y = yaw;
    }
    this.timer -= delta;
    if (this.timer > 0 || !target) return;
    this.timer = this.interval;
    const tp = target.position.clone().setY(0.6);
    ctx.particles?.impact(tp, this.color, 0.7);
    ctx.telegraphs?.show(
      {
        kind: "line",
        origin,
        dir: new THREE.Vector3(tp.x - origin.x, 0, tp.z - origin.z).normalize(),
        length: origin.distanceTo(tp),
        halfWidth: 0.25,
      },
      0.18,
      this.color,
    );
    const isCrit = Math.random() < 0.15;
    target.applyDamage(this.baseDamage * (isCrit ? 1.75 : 1), isCrit);
  }
}

class Trap extends Deployable {
  private armed = false;
  private rune?: THREE.Mesh;

  constructor(color: number, baseDamage: number, radius: number) {
    super(20, color, baseDamage, radius);
  }

  build() {
    const rune = new THREE.Mesh(
      new THREE.RingGeometry(this.radius * 0.45, this.radius * 0.55, 24),
      new THREE.MeshBasicMaterial({ color: this.color, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }),
    );
    rune.rotation.x = -Math.PI / 2;
    rune.position.y = 0.04;
    this.rune = rune;
    this.group.add(rune);
  }

  protected step(delta: number, ctx: DeployContext) {
    if (!this.armed) {
      if (this.age >= 0.6) this.armed = true;
      return;
    }
    if (this.rune) {
      const mat = this.rune.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.35 + 0.3 * Math.abs(Math.sin(this.age * 5));
    }
    const center = this.group.position.clone();
    let triggered = false;
    for (const t of ctx.targets) {
      if (!t.isAlive()) continue;
      const dx = t.position.x - center.x;
      const dz = t.position.z - center.z;
      if (dx * dx + dz * dz <= this.radius * this.radius) {
        triggered = true;
        break;
      }
    }
    if (!triggered) return;
    ctx.telegraphs?.show({ kind: "nova", origin: center, dir: new THREE.Vector3(0, 0, 1), radius: this.radius }, 0.3, this.color);
    ctx.particles?.nova(center.clone().setY(0.4), this.radius, this.color);
    ctx.particles?.impact(center.clone().setY(0.5), this.color, 1.4);
    for (const t of ctx.targets) {
      if (!t.isAlive()) continue;
      const dx = t.position.x - center.x;
      const dz = t.position.z - center.z;
      if (dx * dx + dz * dz > this.radius * this.radius) continue;
      const isCrit = Math.random() < 0.2;
      t.applyDamage(this.baseDamage * (isCrit ? 1.75 : 1), isCrit);
    }
    ctx.log?.("A rune-trap detonates!");
    this.dead = true;
  }
}

/** Ghost preview materials — transparent, non-interactive. */
function ghostMat(color: number, opacity = 0.45): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.35,
    transparent: true,
    opacity,
    depthWrite: false,
    roughness: 0.55,
    metalness: 0.15,
  });
}

/**
 * Build a translucent ghost of a deployable for mouse placement preview.
 * Not added to the manager items list — caller owns scene attach + dispose.
 */
export function createDeployableGhost(
  kind: DeployableKind,
  color: number,
  radius: number,
): THREE.Group {
  const g = new THREE.Group();
  g.name = `ghost_${kind}`;
  g.renderOrder = 8;
  const mat = ghostMat(color, 0.5);
  const ringMat = ghostMat(color, 0.35);

  if (kind === "fire_totem") {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.26, 1.4, 8), mat);
    pole.position.y = 0.7;
    const flame = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 12), ghostMat(color, 0.55));
    flame.position.y = 1.5;
    g.add(pole, flame);
  } else if (kind === "turret") {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 0.5, 10), mat);
    base.position.y = 0.25;
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 1.1), mat);
    barrel.position.set(0, 0.6, 0.35);
    g.add(base, barrel);
  } else {
    // trap
    const disc = new THREE.Mesh(
      new THREE.RingGeometry(radius * 0.4, radius * 0.55, 28),
      ringMat,
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = 0.05;
    g.add(disc);
  }

  // Footprint ring
  const foot = new THREE.Mesh(
    new THREE.RingGeometry(Math.max(0.8, radius * 0.35), Math.max(1.0, radius * 0.45), 36),
    ringMat,
  );
  foot.rotation.x = -Math.PI / 2;
  foot.position.y = 0.04;
  g.add(foot);

  g.traverse((o) => {
    o.userData.ghost = true;
    const m = o as THREE.Mesh;
    if (m.isMesh) m.raycast = () => {};
  });
  return g;
}

/**
 * Lightweight camp ghost — fence ring posts + tower stub (real GLBs load on confirm).
 */
export function createCampGhost(radius: number): THREE.Group {
  const g = new THREE.Group();
  g.name = "ghost_camp";
  g.renderOrder = 8;
  const wood = ghostMat(0xc5a059, 0.42);
  const postMat = ghostMat(0x8a7050, 0.5);

  // Ground disc
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(radius * 0.92, 40),
    ghostMat(0x3a3428, 0.22),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0.03;
  g.add(ground);

  // Fence posts + rails
  const count = Math.max(10, Math.round((Math.PI * 2 * radius) / 2.1));
  for (let i = 0; i < count; i++) {
    const ang = (i / count) * Math.PI * 2;
    const x = Math.sin(ang) * radius;
    const z = Math.cos(ang) * radius;
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.0, 0.18), postMat);
    post.position.set(x, 1.0, z);
    g.add(post);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 2.0), wood);
    rail.position.set(x, 1.15, z);
    rail.rotation.y = ang;
    g.add(rail);
  }

  // Watchtower stub
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.35, 1.6), wood);
  base.position.set(0.3, 0.18, -0.4);
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(1.1, 3.2, 1.1), postMat);
  shaft.position.set(0.3, 1.9, -0.4);
  const platform = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.2, 2.0), wood);
  platform.position.set(0.3, 3.6, -0.4);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.4, 0.9, 4), wood);
  roof.position.set(0.3, 4.2, -0.4);
  roof.rotation.y = Math.PI / 4;
  g.add(base, shaft, platform, roof);

  g.traverse((o) => {
    o.userData.ghost = true;
    const m = o as THREE.Mesh;
    if (m.isMesh) m.raycast = () => {};
  });
  return g;
}

export class DeployableManager {
  private scene: THREE.Scene;
  private items: Deployable[] = [];
  private disposed = false;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  /** Place a live deployable at world XZ. Returns true if spawned. */
  deploy(kind: DeployableKind, pos: THREE.Vector3, color: number, baseDamage: number, radius: number): boolean {
    if (this.disposed) return false;
    let d: Deployable;
    if (kind === "fire_totem") d = new FireTotem(color, baseDamage, radius);
    else if (kind === "turret") d = new Turret(color, baseDamage, radius);
    else d = new Trap(color, baseDamage, radius);
    d.build();
    d.group.position.set(pos.x, 0, pos.z);
    this.scene.add(d.group);
    this.items.push(d);
    return true;
  }

  update(delta: number, ctx: DeployContext): boolean {
    let damaged = false;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const d = this.items[i];
      const before = ctx.targets.filter((t) => t.isAlive()).length;
      d.update(delta, ctx);
      if (ctx.targets.filter((t) => t.isAlive()).length !== before) damaged = true;
      if (d.dead) {
        this.scene.remove(d.group);
        d.dispose();
        this.items.splice(i, 1);
      }
    }
    return damaged;
  }

  get count() {
    return this.items.length;
  }

  dispose() {
    this.disposed = true;
    for (const d of this.items) {
      this.scene.remove(d.group);
      d.dispose();
    }
    this.items = [];
  }
}
