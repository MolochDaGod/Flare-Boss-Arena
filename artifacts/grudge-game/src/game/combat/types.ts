import * as THREE from "three";

/**
 * Scene-agnostic combat target. Lets the shared damage-shape helper and the
 * deployable system operate identically across the Dungeon (EnemyInstance),
 * the Training Ground (dummies) and the Boss Arena (boss) — each scene adapts
 * its own entity into this tiny interface.
 */
export interface CombatTarget {
  /** World position; only xz are used for shape tests. */
  readonly position: THREE.Vector3;
  isAlive(): boolean;
  /** Apply damage; the scene maps this onto its own hp / numbers / death logic. */
  applyDamage(amount: number, isCrit: boolean): void;
}
