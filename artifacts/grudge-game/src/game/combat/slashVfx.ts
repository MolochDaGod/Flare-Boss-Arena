import * as THREE from "three";
import type { ParticleVfx } from "./particles";

/**
 * Traveling slash / shockwave projectiles — thin glowing crescents that fly
 * farther than a melee strike and damage anything they pass through.
 */

export interface SlashWave {
  mesh: THREE.Mesh;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  damage: number;
  radius: number;
  color: number;
  hitIds: Set<string>;
  trailT: number;
}

export class SlashWaveField {
  private scene: THREE.Scene;
  private particles: ParticleVfx | null;
  private waves: SlashWave[] = [];
  private geo: THREE.PlaneGeometry;
  private disposed = false;

  constructor(scene: THREE.Scene, particles: ParticleVfx | null) {
    this.scene = scene;
    this.particles = particles;
    // Thin vertical plane — reads as a slash crescent in the iso view.
    this.geo = new THREE.PlaneGeometry(1.8, 0.55);
  }

  /**
   * Fire a slash wave from `origin` along `dir` (XZ).
   * Travels `range` units over ~0.45s.
   */
  spawn(
    origin: THREE.Vector3,
    dir: THREE.Vector3,
    opts: {
      damage: number;
      range?: number;
      color?: number;
      radius?: number;
      speed?: number;
    },
  ) {
    if (this.disposed) return;
    const color = opts.color ?? 0xffcc66;
    const range = opts.range ?? 12;
    const speed = opts.speed ?? 28;
    const d = dir.clone().setY(0);
    if (d.lengthSq() < 1e-6) d.set(0, 0, 1);
    d.normalize();

    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.92,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const mesh = new THREE.Mesh(this.geo, mat);
    mesh.position.copy(origin).setY(1.15);
    // Face along travel direction (plane normal perpendicular to path).
    mesh.rotation.y = Math.atan2(d.x, d.z);
    mesh.rotation.x = -0.35;
    mesh.scale.set(1.4, 1.1, 1);
    mesh.renderOrder = 5;
    this.scene.add(mesh);

    this.particles?.impact(origin.clone().setY(1.2), color, 0.6);

    this.waves.push({
      mesh,
      pos: origin.clone().setY(1.15),
      vel: d.multiplyScalar(speed),
      life: 0,
      maxLife: range / speed,
      damage: opts.damage,
      radius: opts.radius ?? 1.35,
      color,
      hitIds: new Set(),
      trailT: 0,
    });
  }

  /**
   * Advance waves. Caller supplies living enemies; returns list of
   * { enemyId, damage } hits this frame (once per enemy per wave).
   */
  update(
    delta: number,
    enemies: Array<{ id: string; position: THREE.Vector3; alive: boolean }>,
  ): Array<{ enemyId: string; damage: number; color: number }> {
    const hits: Array<{ enemyId: string; damage: number; color: number }> = [];
    for (let i = this.waves.length - 1; i >= 0; i--) {
      const w = this.waves[i]!;
      w.life += delta;
      w.pos.addScaledVector(w.vel, delta);
      w.mesh.position.copy(w.pos);
      // Pulse scale.
      const pulse = 1 + Math.sin(w.life * 28) * 0.08;
      w.mesh.scale.set(1.4 * pulse, 1.1 * pulse, 1);
      const mat = w.mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.92 * Math.max(0, 1 - w.life / w.maxLife);

      w.trailT += delta;
      if (w.trailT >= 0.04) {
        w.trailT = 0;
        this.particles?.impact(w.pos.clone(), w.color, 0.28);
      }

      for (const en of enemies) {
        if (!en.alive || w.hitIds.has(en.id)) continue;
        const d = Math.hypot(en.position.x - w.pos.x, en.position.z - w.pos.z);
        if (d <= w.radius + 0.6) {
          w.hitIds.add(en.id);
          hits.push({ enemyId: en.id, damage: w.damage, color: w.color });
        }
      }

      if (w.life >= w.maxLife) {
        this.scene.remove(w.mesh);
        mat.dispose();
        this.waves.splice(i, 1);
      }
    }
    return hits;
  }

  dispose() {
    this.disposed = true;
    for (const w of this.waves) {
      this.scene.remove(w.mesh);
      (w.mesh.material as THREE.Material).dispose();
    }
    this.waves = [];
    this.geo.dispose();
  }
}
