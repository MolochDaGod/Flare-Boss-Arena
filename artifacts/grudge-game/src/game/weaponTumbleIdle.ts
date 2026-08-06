/**
 * Weapon tumble idle — taught from Minecraft Leviathan axe "Idol" clip.
 *
 * Source: D:\Games\Models\my_minecraft_skin_with_axe.glb → animation "Idol"
 * Node: leviathan axe_45 (child of rightarm) — throw up, spin, catch back.
 *
 * Minecraft is rigid hierarchy (no skin), so we cannot retarget body bones to
 * Bip001/Mixamo. We teach the **weapon local motion** onto any hand-mounted
 * weapon: rest pose + sampled offset keyframes.
 */
import * as THREE from "three";
import keys from "./weaponTumbleKeys.json";

export type WeaponTumbleKeys = typeof keys;

/** Minecraft block → SI meters for a human-scale hand toss (~0.55 m apex). */
export const TUMBLE_POS_SCALE = 0.42;

/** Full cycle: tumble then rest pause (seconds). */
export const TUMBLE_CYCLE_SEC = 3.4;

function sampleVec3(
  times: number[],
  values: number[][],
  t: number,
  out: THREE.Vector3,
): THREE.Vector3 {
  if (times.length === 0) return out.set(0, 0, 0);
  if (t <= times[0]!) {
    const v = values[0]!;
    return out.set(v[0]!, v[1]!, v[2]!);
  }
  const last = times.length - 1;
  if (t >= times[last]!) {
    const v = values[last]!;
    return out.set(v[0]!, v[1]!, v[2]!);
  }
  let i = 0;
  while (i < last && times[i + 1]! < t) i++;
  const t0 = times[i]!;
  const t1 = times[i + 1]!;
  const u = (t - t0) / Math.max(1e-6, t1 - t0);
  const a = values[i]!;
  const b = values[i + 1]!;
  out.set(
    a[0]! + (b[0]! - a[0]!) * u,
    a[1]! + (b[1]! - a[1]!) * u,
    a[2]! + (b[2]! - a[2]!) * u,
  );
  return out;
}

function sampleQuat(
  times: number[],
  values: number[][],
  t: number,
  out: THREE.Quaternion,
): THREE.Quaternion {
  if (times.length === 0) return out.identity();
  if (t <= times[0]!) {
    const v = values[0]!;
    return out.set(v[0]!, v[1]!, v[2]!, v[3]!);
  }
  const last = times.length - 1;
  if (t >= times[last]!) {
    const v = values[last]!;
    return out.set(v[0]!, v[1]!, v[2]!, v[3]!);
  }
  let i = 0;
  while (i < last && times[i + 1]! < t) i++;
  const t0 = times[i]!;
  const t1 = times[i + 1]!;
  const u = (t - t0) / Math.max(1e-6, t1 - t0);
  const a = values[i]!;
  const b = values[i + 1]!;
  const qa = new THREE.Quaternion(a[0]!, a[1]!, a[2]!, a[3]!);
  const qb = new THREE.Quaternion(b[0]!, b[1]!, b[2]!, b[3]!);
  return out.copy(qa).slerp(qb, u);
}

/**
 * Drives a hand-parented weapon with the taught Minecraft axe tumble.
 * Call `bind(weapon)` once rest pose is correct; `update` each frame while idle.
 */
export class WeaponTumbleIdle {
  private weapon: THREE.Object3D | null = null;
  private basePos = new THREE.Vector3();
  private baseQuat = new THREE.Quaternion();
  private baseScale = new THREE.Vector3(1, 1, 1);
  private time = 0;
  private enabled = true;
  private active = false;
  private restPos = new THREE.Vector3();
  private restQuat = new THREE.Quaternion();
  private restQuatInv = new THREE.Quaternion();
  private readonly _pos = new THREE.Vector3();
  private readonly _quat = new THREE.Quaternion();
  private readonly _deltaPos = new THREE.Vector3();
  private readonly _deltaQuat = new THREE.Quaternion();
  private posScale = TUMBLE_POS_SCALE;
  private tumbleDur = 1.4;
  private cycleDur = TUMBLE_CYCLE_SEC;

  constructor() {
    const rt = keys.restTranslation as number[];
    const rr = keys.restRotation as number[];
    this.restPos.set(rt[0]!, rt[1]!, rt[2]!);
    this.restQuat.set(rr[0]!, rr[1]!, rr[2]!, rr[3]!).normalize();
    this.restQuatInv.copy(this.restQuat).invert();
    const times = keys.translation.times as number[];
    this.tumbleDur = times[times.length - 1] ?? 1.4;
  }

  /**
   * Capture current local transform as rest (hand grip).
   * Safe to re-bind after grip tuning.
   */
  bind(weapon: THREE.Object3D, opts?: { posScale?: number; cycleSec?: number }) {
    this.weapon = weapon;
    this.basePos.copy(weapon.position);
    this.baseQuat.copy(weapon.quaternion);
    this.baseScale.copy(weapon.scale);
    if (opts?.posScale != null) this.posScale = opts.posScale;
    if (opts?.cycleSec != null) this.cycleDur = opts.cycleSec;
    this.time = 0;
    this.active = true;
  }

  unbind() {
    this.snapRest();
    this.weapon = null;
    this.active = false;
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    if (!on) this.snapRest();
  }

  isBound() {
    return !!this.weapon;
  }

  /** Force rest grip immediately. */
  snapRest() {
    if (!this.weapon) return;
    this.weapon.position.copy(this.basePos);
    this.weapon.quaternion.copy(this.baseQuat);
    this.weapon.scale.copy(this.baseScale);
  }

  /**
   * @param dt seconds
   * @param allow when false (combat/move/attack) holds rest pose
   */
  update(dt: number, allow: boolean) {
    if (!this.weapon || !this.active) return;
    if (!this.enabled || !allow) {
      this.snapRest();
      // Keep phase so we don't restart mid-toss every frame when re-entering idle
      this.time = 0;
      return;
    }

    this.time += dt;
    const cycleT = this.time % this.cycleDur;

    // After tumble duration: hold rest until next cycle
    if (cycleT > this.tumbleDur) {
      this.snapRest();
      return;
    }

    const tTimes = keys.translation.times as number[];
    const tVals = keys.translation.values as number[][];
    const rTimes = keys.rotation.times as number[];
    const rVals = keys.rotation.values as number[][];

    sampleVec3(tTimes, tVals, cycleT, this._pos);
    sampleQuat(rTimes, rVals, cycleT, this._quat);

    // Offset from Minecraft rest → apply on our grip rest
    this._deltaPos.subVectors(this._pos, this.restPos).multiplyScalar(this.posScale);
    // Relative rotation: rest^{-1} * key
    this._deltaQuat.copy(this.restQuatInv).multiply(this._quat);

    this.weapon.position.copy(this.basePos).add(this._deltaPos);
    this.weapon.quaternion.copy(this.baseQuat).multiply(this._deltaQuat);
  }
}

/** Shared default driver (optional singleton helpers). */
export function createWeaponTumbleIdle(): WeaponTumbleIdle {
  return new WeaponTumbleIdle();
}
