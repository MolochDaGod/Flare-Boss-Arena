/**
 * Grudge6 ally animator — damped idle→walk→run→sprint gait blend + one-shot overlays.
 * Mirrors grudge-arena AnimationDirector bands without the full omni binder.
 */

import * as THREE from "three";

export type AllyLocoDir = "forward" | "back" | "left" | "right";
type LocoBand = "idle" | "walk" | "run" | "sprint";

const BANDS: Array<{ state: LocoBand; at: number }> = [
  { state: "idle", at: 0 },
  { state: "walk", at: 0.34 },
  { state: "run", at: 0.7 },
  { state: "sprint", at: 1 },
];

const GAIT_RATE_ACCEL = 9;
const GAIT_RATE_DECEL = 13;
const OVERLAY_EASE = 1.35;
const SPRINT_TIME_SCALE = 1.75;

export interface AllyLocoClips {
  idle: THREE.AnimationClip;
  walk: THREE.AnimationClip;
  run: THREE.AnimationClip;
  sprint: THREE.AnimationClip;
  attack?: THREE.AnimationClip;
  walkBack?: THREE.AnimationClip;
  runBack?: THREE.AnimationClip;
  strafeLeft?: THREE.AnimationClip;
  strafeRight?: THREE.AnimationClip;
}

function computeGaitTarget(speed01: number, sprint: boolean, moving: boolean): number {
  if (!moving || speed01 < 0.05) return 0;
  if (sprint) return 1;
  const t = Math.min(1, speed01);
  if (t < 0.6) return 0.34 + (t / 0.6) * 0.36;
  return 0.7 + ((t - 0.6) / 0.4) * 0.29;
}

function pickBandClip(band: LocoBand, dir: AllyLocoDir, clips: AllyLocoClips): THREE.AnimationClip {
  if (dir === "back") {
    if (band === "walk" && clips.walkBack) return clips.walkBack;
    if ((band === "run" || band === "sprint") && clips.runBack) return clips.runBack;
  }
  if (dir === "left" && band === "walk" && clips.strafeLeft) return clips.strafeLeft;
  if (dir === "right" && band === "walk" && clips.strafeRight) return clips.strafeRight;
  if (band === "sprint") return clips.sprint;
  return clips[band];
}

export class Grudge6AllyAnimator {
  private mixer: THREE.AnimationMixer;
  private clips: AllyLocoClips;
  private pool = new Map<string, THREE.AnimationClip>();
  private locoActions = new Map<string, THREE.AnimationAction>();
  private gait = 0;
  private gaitTarget = 0;
  private locoDir: AllyLocoDir = "forward";
  private activeBandKeys = "";
  private overlay: THREE.AnimationAction | null = null;
  private overlayInf = 0;
  private overlayTarget = 0;
  private overlayFade = 0.12;
  private finishing = false;
  private attacking = false;
  private onFinished: (e: THREE.Event) => void;

  constructor(root: THREE.Object3D, clips: AllyLocoClips, pool: THREE.AnimationClip[] = []) {
    this.mixer = new THREE.AnimationMixer(root);
    this.clips = clips;
    for (const c of pool) {
      const key = c.name.toLowerCase();
      if (!this.pool.has(key)) this.pool.set(key, c);
    }
    if (clips.attack) this.pool.set("attack", clips.attack);

    this.onFinished = (e: THREE.Event) => {
      const finished = (e as unknown as { action?: THREE.AnimationAction }).action;
      if (this.overlay && finished === this.overlay) {
        this.finishing = true;
        this.overlayTarget = 0;
      }
    };
    this.mixer.addEventListener("finished", this.onFinished);

    this.ensureLocoBands("forward");
    this.primeLocomotion();
  }

  private cacheKey(dir: AllyLocoDir): string {
    return BANDS.map((b) => pickBandClip(b.state, dir, this.clips).uuid).join("|");
  }

  private ensureLocoBands(dir: AllyLocoDir, fade = 0.15) {
    const key = this.cacheKey(dir);
    if (key === this.activeBandKeys && this.locoDir === dir) return;
    this.locoDir = dir;
    this.activeBandKeys = key;

    const next = new Map<LocoBand, THREE.AnimationAction>();
    for (const { state } of BANDS) {
      const clip = pickBandClip(state, dir, this.clips);
      const cacheId = `${dir}:${state}:${clip.uuid}`;
      let action = this.locoActions.get(cacheId);
      if (!action) {
        action = this.mixer.clipAction(clip);
        action.setLoop(THREE.LoopRepeat, Infinity);
        action.enabled = true;
        action.setEffectiveWeight(0);
        if (state === "sprint") action.timeScale = SPRINT_TIME_SCALE;
        action.play();
        this.locoActions.set(cacheId, action);
      }
      next.set(state, action);
    }

    for (const [, action] of this.locoActions) {
      if (![...next.values()].includes(action)) action.fadeOut(fade);
    }
    this._bandActions = next;
  }

  private _bandActions = new Map<LocoBand, THREE.AnimationAction>();

  primeLocomotion() {
    this.gait = 0;
    this.gaitTarget = 0;
    for (const { state } of BANDS) {
      const a = this._bandActions.get(state);
      if (a) a.setEffectiveWeight(state === "idle" ? 1 : 0);
    }
    this.mixer.update(0);
  }

  setLocoDirection(dir: AllyLocoDir) {
    if (this.attacking) return;
    this.ensureLocoBands(dir);
  }

  setGaitFromSpeed(speed01: number, sprint = false) {
    if (this.attacking) return;
    const moving = speed01 >= 0.05;
    this.gaitTarget = computeGaitTarget(speed01, sprint, moving);
  }

  /** Binary compat with PlayerAnimator — maps to mid walk gait. */
  setMoving(moving: boolean) {
    this.setGaitFromSpeed(moving ? 0.55 : 0, false);
  }

  triggerAttack() {
    const clip = this.clips.attack ?? this.pool.get("attack");
    if (!clip) return;
    this.playOneShot(clip, 0.08);
  }

  triggerNamed(candidates: string[]): boolean {
    if (this.attacking) return true;
    const sorted = [...candidates].sort((a, b) => b.length - a.length);
    for (const cand of sorted) {
      const lc = cand.toLowerCase();
      for (const [name, clip] of this.pool) {
        if (name.includes(lc)) {
          this.playOneShot(clip, 0.1);
          return true;
        }
      }
    }
    if (this.clips.attack) {
      this.triggerAttack();
      return true;
    }
    return false;
  }

  private playOneShot(clip: THREE.AnimationClip, fadeIn = 0.1) {
    if (this.overlay) this.overlay.stop();
    const action = this.mixer.clipAction(clip);
    action.reset();
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.setEffectiveWeight(1);
    action.fadeIn(fadeIn).play();
    this.overlay = action;
    this.overlayTarget = 1;
    this.overlayInf = 0;
    this.overlayFade = fadeIn;
    this.finishing = false;
    this.attacking = true;
  }

  update(delta: number) {
    const dt = Math.min(delta, 0.05);
    const gaitRate = this.gaitTarget < this.gait ? GAIT_RATE_DECEL : GAIT_RATE_ACCEL;
    this.gait += (this.gaitTarget - this.gait) * (1 - Math.exp(-gaitRate * dt));

    const w: Record<LocoBand, number> = { idle: 0, walk: 0, run: 0, sprint: 0 };
    if (this.gait >= 1) {
      w.sprint = 1;
    } else {
      for (let i = 0; i < BANDS.length - 1; i++) {
        const a = BANDS[i]!;
        const b = BANDS[i + 1]!;
        if (this.gait >= a.at && this.gait <= b.at) {
          const t = (this.gait - a.at) / (b.at - a.at);
          w[a.state] = 1 - t;
          w[b.state] = t;
          break;
        }
      }
    }

    if (this.overlay) {
      const k = 1 - Math.exp(-(OVERLAY_EASE / Math.max(0.02, this.overlayFade)) * dt);
      this.overlayInf += (this.overlayTarget - this.overlayInf) * k;
      if (this.finishing && this.overlayInf < 0.02) {
        this.overlay.stop();
        this.overlay = null;
        this.finishing = false;
        this.overlayInf = 0;
        this.attacking = false;
      }
    } else {
      this.overlayInf = 0;
    }

    const locoScale = 1 - this.overlayInf;
    for (const { state } of BANDS) {
      const action = this._bandActions.get(state);
      if (action) action.setEffectiveWeight(w[state] * locoScale);
    }
    if (this.overlay) this.overlay.setEffectiveWeight(this.overlayInf);

    this.mixer.update(dt);
  }

  /** Current smoothed gait 0–1 (debug). */
  getGait(): number {
    return this.gait;
  }

  dispose() {
    this.mixer.removeEventListener("finished", this.onFinished);
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.mixer.getRoot() as THREE.Object3D);
    this.locoActions.clear();
    this._bandActions.clear();
    this.pool.clear();
  }
}