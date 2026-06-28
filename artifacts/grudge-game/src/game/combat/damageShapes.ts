import * as THREE from "three";

/**
 * Pure geometry helpers for ARPG skill hit-detection. Everything is evaluated on
 * the XZ ground plane (y ignored). Shared by every scene so a skill behaves the
 * same in the Dungeon, the Training Ground and the Boss Arena.
 */

export type DamageShapeKind = "circle" | "cone" | "line" | "nova";

export interface ShapeQuery {
  kind: DamageShapeKind;
  /** Apex (cone/line) or center (circle/nova). */
  origin: THREE.Vector3;
  /** Normalized forward direction on XZ. */
  dir: THREE.Vector3;
  /** Circle / nova / cone reach. */
  radius?: number;
  /** Cone half-angle in radians. */
  halfAngle?: number;
  /** Line length. */
  length?: number;
  /** Line half-width. */
  halfWidth?: number;
}

/** True if point `p` falls inside the shape described by `q`. */
export function pointInShape(q: ShapeQuery, p: THREE.Vector3): boolean {
  const ox = p.x - q.origin.x;
  const oz = p.z - q.origin.z;
  switch (q.kind) {
    case "circle":
    case "nova": {
      const r = q.radius ?? 4;
      return ox * ox + oz * oz <= r * r;
    }
    case "cone": {
      const r = q.radius ?? 5;
      const dist2 = ox * ox + oz * oz;
      if (dist2 <= 1e-6) return true; // at the apex
      if (dist2 > r * r) return false;
      const len = Math.sqrt(dist2);
      const cos = (ox * q.dir.x + oz * q.dir.z) / len;
      const half = q.halfAngle ?? Math.PI / 4;
      return cos >= Math.cos(half);
    }
    case "line": {
      const fwd = ox * q.dir.x + oz * q.dir.z; // forward projection
      if (fwd < 0 || fwd > (q.length ?? 8)) return false;
      const side = ox * q.dir.z - oz * q.dir.x; // signed perpendicular (dir is unit)
      return Math.abs(side) <= (q.halfWidth ?? 1.2);
    }
  }
}

/** Return the subset of `targets` (anything with a `position`) inside the shape. */
export function targetsInShape<T extends { position: THREE.Vector3 }>(
  q: ShapeQuery,
  targets: readonly T[],
  isAlive?: (t: T) => boolean,
): T[] {
  const out: T[] = [];
  for (const t of targets) {
    if (isAlive && !isAlive(t)) continue;
    if (pointInShape(q, t.position)) out.push(t);
  }
  return out;
}
