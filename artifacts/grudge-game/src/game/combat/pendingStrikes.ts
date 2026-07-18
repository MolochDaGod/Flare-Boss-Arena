/**
 * Telegraphed delayed strikes — AoE circles, line pierces, cones.
 *
 * Wind-up shows a ground telegraph; on detonation damage is applied once.
 * Used by dungeon bosses and elite enemies (ArenaScene pattern, shared shapes).
 */
import * as THREE from "three";
import type { ShapeQuery } from "./damageShapes";
import { pointInShape } from "./damageShapes";
import type { TelegraphField } from "./telegraphs";
import type { ParticleVfx } from "./particles";
import type { SkillElement } from "./particles";
import type { WarningEffectField } from "./warningEffects";

export type StrikeKind = "circle" | "nova" | "line" | "cone";

export interface PendingStrike {
  kind: StrikeKind;
  origin: THREE.Vector3;
  dir: THREE.Vector3;
  radius: number;
  length: number;
  halfWidth: number;
  halfAngle: number;
  damage: number;
  windup: number;
  age: number;
  struck: boolean;
  label: string;
  color: number;
  element: SkillElement;
  /** Who fired (boss id) — for logs / AI. */
  sourceId: string;
}

export class PendingStrikeField {
  private strikes: PendingStrike[] = [];
  private telegraphs: TelegraphField | null;
  private particles: ParticleVfx | null;
  private warnings: WarningEffectField | null;
  private disposed = false;

  constructor(
    telegraphs: TelegraphField | null,
    particles: ParticleVfx | null,
    warnings: WarningEffectField | null = null,
  ) {
    this.telegraphs = telegraphs;
    this.particles = particles;
    this.warnings = warnings;
  }

  schedule(opts: {
    kind: StrikeKind;
    origin: THREE.Vector3;
    dir?: THREE.Vector3;
    radius?: number;
    length?: number;
    halfWidth?: number;
    halfAngle?: number;
    damage: number;
    windup: number;
    label: string;
    color?: number;
    element?: SkillElement;
    sourceId: string;
    ring?: boolean;
    /** Floating "!" warning above the strike / caster. */
    warnHeight?: number;
    /** When true (default), spawn deterministic warning marker. */
    warn?: boolean;
  }) {
    if (this.disposed) return;
    const dir = (opts.dir ?? new THREE.Vector3(0, 0, 1)).clone().setY(0);
    if (dir.lengthSq() < 1e-6) dir.set(0, 0, 1);
    dir.normalize();
    const color = opts.color ?? 0xff6622;
    const origin = opts.origin.clone();
    origin.y = 0;

    const strike: PendingStrike = {
      kind: opts.kind,
      origin,
      dir,
      radius: opts.radius ?? 4,
      length: opts.length ?? 10,
      halfWidth: opts.halfWidth ?? 1.3,
      halfAngle: opts.halfAngle ?? Math.PI / 4,
      damage: opts.damage,
      windup: Math.max(0.2, opts.windup),
      age: 0,
      struck: false,
      label: opts.label,
      color,
      element: opts.element ?? "physical",
      sourceId: opts.sourceId,
    };
    this.strikes.push(strike);

    const q = this.toQuery(strike);
    this.telegraphs?.show(q, strike.windup, color, { ring: opts.ring, y: 0.07 });
    if (opts.ring && (opts.kind === "circle" || opts.kind === "nova")) {
      this.telegraphs?.show(q, strike.windup, color, { ring: true, y: 0.09 });
    }
    if (opts.warn !== false) {
      this.warnings?.spawn({
        position: origin,
        duration: strike.windup,
        color,
        height: opts.warnHeight ?? 2.6,
        label: opts.label,
        seed: `${opts.sourceId}|${opts.label}`,
      });
    }
  }

  private toQuery(s: PendingStrike): ShapeQuery {
    return {
      kind: s.kind,
      origin: s.origin,
      dir: s.dir,
      radius: s.radius,
      length: s.length,
      halfWidth: s.halfWidth,
      halfAngle: s.halfAngle,
    };
  }

  /**
   * Advance windups. Returns detonations that hit `target` this frame.
   */
  update(
    delta: number,
    target: THREE.Vector3,
    opts?: { invulnerable?: boolean },
  ): Array<{ damage: number; label: string; kind: StrikeKind }> {
    const hits: Array<{ damage: number; label: string; kind: StrikeKind }> = [];
    if (this.disposed) return hits;

    for (let i = this.strikes.length - 1; i >= 0; i--) {
      const s = this.strikes[i]!;
      s.age += delta;
      if (s.age < s.windup || s.struck) {
        if (s.age >= s.windup + 0.05) this.strikes.splice(i, 1);
        continue;
      }
      s.struck = true;

      // Detonation VFX
      const reach = s.kind === "line" ? s.length : s.radius;
      this.particles?.castSkillVfx({
        element: s.element,
        shape: s.kind,
        center: s.kind === "circle" || s.kind === "nova" ? s.origin.clone() : s.origin.clone(),
        origin: s.origin.clone(),
        dir: s.dir,
        reach,
        halfAngle: s.halfAngle,
      });
      this.particles?.impact(s.origin.clone().setY(0.5), s.color, 0.9);
      this.warnings?.impactFlash(
        s.origin,
        s.color,
        s.kind === "line" ? s.halfWidth * 3 : s.radius * 0.9,
        `${s.sourceId}|${s.label}|impact`,
      );

      if (!opts?.invulnerable && pointInShape(this.toQuery(s), target)) {
        hits.push({ damage: s.damage, label: s.label, kind: s.kind });
      }
      this.strikes.splice(i, 1);
    }
    return hits;
  }

  clear() {
    this.strikes.length = 0;
  }

  dispose() {
    this.disposed = true;
    this.clear();
  }
}
