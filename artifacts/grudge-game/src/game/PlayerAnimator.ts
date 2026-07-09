import * as THREE from "three";
import { SKIN_CLIP_SUFFIX, KOBY_CLIPS, type SkinScheme } from "../data/skins";
import { RootMotion } from "./rootMotion";

/**
 * PlayerAnimator — drives idle / walk / attack on the player model.
 *
 * Two clip sources feed the SAME animator:
 *
 *  1. Native skins (One Piece GLBs) ship labelled clips; `pickSkinClips()`
 *     matches them by suffix (`_idle_a` / `_run` / `_combo_a`).
 *
 *  2. The grudge race GLBs ship a clean 25-bone 3ds-Max Biped skeleton but
 *     ZERO clips, so `buildAuthoredClips()` synthesises real skeletal
 *     AnimationClips (idle breathing, walk cycle, attack swing) by rotating the
 *     known Biped bones.
 *
 * Crucially, authored rotations are composed onto each bone's BIND-pose local
 * quaternion and the swing axis is derived from a desired WORLD axis projected
 * into the bone's local frame — so the motion reads correctly regardless of the
 * exporter's per-bone axis convention.
 */

type PAction = "idle" | "walk" | "attack" | "dodge" | "jump" | "hit";

export class PlayerAnimator {
  private mixer: THREE.AnimationMixer;
  private actions: Partial<Record<PAction, THREE.AnimationAction>> = {};
  private current: PAction = "idle";
  private attacking = false;
  /** All clips available for skill playback, keyed by lowercased name. */
  private pool = new Map<string, THREE.AnimationClip>();
  /** The one-shot action currently playing (attack or a named skill clip). */
  private oneShot: THREE.AnimationAction | null = null;
  /** Multi-clip blended one-shot (e.g. koby's jump attack = two clips at once). */
  private oneShotBlend: THREE.AnimationAction[] = [];
  /** Clips blended together for the primary attack (overrides a single attack). */
  private attackBlend: THREE.AnimationClip[] = [];
  /** Extracts in-clip root translation so the world position follows the anim. */
  private rm: RootMotion;

  constructor(
    root: THREE.Object3D,
    clips: Partial<Record<PAction, THREE.AnimationClip>>,
    pool?: THREE.AnimationClip[],
    opts?: { attackBlend?: THREE.AnimationClip[] },
  ) {
    this.mixer = new THREE.AnimationMixer(root);
    this.rm = new RootMotion(root);
    (Object.keys(clips) as PAction[]).forEach((key) => {
      const clip = clips[key];
      if (clip) this.actions[key] = this.mixer.clipAction(clip);
    });
    for (const c of pool ?? []) {
      const key = c.name.toLowerCase();
      if (!this.pool.has(key)) this.pool.set(key, c);
    }
    this.attackBlend = opts?.attackBlend?.filter(Boolean) ?? [];

    const idle = this.actions.idle ?? this.actions.walk;
    if (idle) idle.reset().play();
    this.current = this.actions.idle ? "idle" : "walk";

    this.mixer.addEventListener("finished", () => {
      if (!this.attacking) return; // ignore stray finishes (and the 2nd of a pair)
      this.attacking = false;
      this.rm.end();
      this.oneShot?.fadeOut(0.15);
      this.oneShot = null;
      for (const a of this.oneShotBlend) a.fadeOut(0.15);
      this.oneShotBlend = [];
      const cur = this.actions[this.current];
      cur?.reset().fadeIn(0.15).play();
    });
  }

  setMoving(moving: boolean) {
    const next: PAction = moving && this.actions.walk ? "walk" : "idle";
    if (next === this.current) return;
    const prev = this.actions[this.current];
    this.current = next;
    if (this.attacking) return; // resume happens on attack finish
    prev?.fadeOut(0.18);
    this.actions[next]?.reset().fadeIn(0.18).play();
  }

  /** True when a dedicated attack clip resolved (a labelled attack OR a blend). */
  get canAttack(): boolean {
    return !!this.actions.attack || this.attackBlend.length > 0;
  }

  /** Play a one-shot role clip (dodge / jump / hit / attack). Returns false if missing. */
  triggerRole(role: Exclude<PAction, "idle" | "walk">): boolean {
    if (this.attacking) return role === "attack" || role === "dodge";
    if (role === "attack") {
      this.triggerAttack();
      return this.canAttack;
    }
    const a = this.actions[role];
    if (!a) return false;
    this.attacking = true;
    this.oneShot = a;
    a.reset();
    a.setLoop(THREE.LoopOnce, 1);
    a.clampWhenFinished = true;
    a.fadeIn(0.06).play();
    this.actions[this.current]?.fadeOut(0.06);
    this.rm.begin();
    return true;
  }

  triggerAttack() {
    if (this.attacking) return;
    // Blended attack (e.g. koby's jump attack): play all clips at once so the
    // mixer averages their poses into one combined strike.
    if (this.attackBlend.length) {
      this.attacking = true;
      this.oneShotBlend = this.attackBlend.map((c) => this.mixer.clipAction(c));
      for (const a of this.oneShotBlend) {
        a.reset();
        a.setLoop(THREE.LoopOnce, 1);
        a.clampWhenFinished = true;
        a.setEffectiveWeight(1);
        a.fadeIn(0.06).play();
      }
      this.actions[this.current]?.fadeOut(0.06);
      this.rm.begin();
      return;
    }
    const a = this.actions.attack;
    if (!a) return;
    this.attacking = true;
    this.oneShot = a;
    a.reset();
    a.setLoop(THREE.LoopOnce, 1);
    a.clampWhenFinished = true;
    a.fadeIn(0.06).play();
    this.actions[this.current]?.fadeOut(0.06);
    this.rm.begin();
  }

  /** Play the first pool clip whose name includes one of `candidates` as a
   *  one-shot. Falls back to the attack clip. Returns false if nothing plays. */
  triggerNamed(candidates: string[]): boolean {
    if (this.attacking) return true;
    let clip: THREE.AnimationClip | undefined;
    for (const cand of candidates) {
      for (const [name, c] of this.pool) {
        if (name.includes(cand)) {
          clip = c;
          break;
        }
      }
      if (clip) break;
    }
    if (!clip) {
      if (this.canAttack) {
        this.triggerAttack();
        return true;
      }
      return false;
    }
    const action = this.mixer.clipAction(clip);
    this.attacking = true;
    this.oneShot = action;
    action.reset();
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.fadeIn(0.06).play();
    this.actions[this.current]?.fadeOut(0.06);
    this.rm.begin();
    return true;
  }

  update(delta: number) {
    this.mixer.update(delta);
    this.rm.sample(delta);
  }

  /** World-space horizontal displacement banked from root motion this frame. */
  consumeRootMotion(out: THREE.Vector3): boolean {
    return this.rm.consume(out);
  }

  dispose() {
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.mixer.getRoot() as THREE.Object3D);
  }
}

/* ── Native-skin clip selection ───────────────────────────────────────────── */

function findBySuffix(clips: THREE.AnimationClip[], suffixes: readonly string[]): THREE.AnimationClip | undefined {
  for (const sfx of suffixes) {
    const hit = clips.find((c) => c.name.toLowerCase().endsWith(sfx));
    if (hit) return hit;
  }
  return undefined;
}

export function pickSkinClips(
  clips: THREE.AnimationClip[],
  scheme: "bountyrush" | "cryptic",
): Partial<Record<PAction, THREE.AnimationClip>> {
  if (clips.length === 0) return {};
  if (scheme === "cryptic") {
    // No usable labels — play the first clip as a static idle.
    return { idle: clips[0] };
  }
  return {
    idle: findBySuffix(clips, SKIN_CLIP_SUFFIX.idle) ?? clips[0],
    walk: findBySuffix(clips, SKIN_CLIP_SUFFIX.walk),
    attack: findBySuffix(clips, SKIN_CLIP_SUFFIX.attack),
    dodge: findBySuffix(clips, SKIN_CLIP_SUFFIX.dodge),
    jump: findBySuffix(clips, SKIN_CLIP_SUFFIX.jump),
    hit: findBySuffix(clips, SKIN_CLIP_SUFFIX.hit),
  };
}

/** Everything PlayerAnimator needs for a native-skin model. */
export interface SkinAnim {
  actions: Partial<Record<PAction, THREE.AnimationClip>>;
  /** Clips searchable by `triggerNamed` (named skill candidates). */
  pool: THREE.AnimationClip[];
  /** Clips blended together for the primary attack, if any. */
  attackBlend?: THREE.AnimationClip[];
}

function byExactName(clips: THREE.AnimationClip[], name: string): THREE.AnimationClip | undefined {
  const lc = name.toLowerCase();
  return clips.find((c) => c.name.toLowerCase() === lc);
}

/**
 * Resolve a skin's role clips + skill pool + optional blended attack.
 *
 * The `koby` scheme maps its cryptic numeric clips by EXACT name (see
 * `KOBY_CLIPS`): idle ← 0011, run ← 0110, and a primary attack BLENDED from
 * 0063 + 0062_Low (a leaping strike). 0062 is aliased into the pool as a
 * "spellcast" clip so cast/skill triggers resolve to it.
 */
export function buildSkinAnim(clips: THREE.AnimationClip[], scheme: SkinScheme): SkinAnim {
  if (scheme === "koby") {
    const idle = byExactName(clips, KOBY_CLIPS.idle);
    const run = byExactName(clips, KOBY_CLIPS.run);
    const cast = byExactName(clips, KOBY_CLIPS.cast);
    const jumpA = byExactName(clips, KOBY_CLIPS.jumpAttackA);
    const jumpB = byExactName(clips, KOBY_CLIPS.jumpAttackB);
    const attackBlend = [jumpA, jumpB].filter((c): c is THREE.AnimationClip => !!c);

    // Alias the cast clip to a labelled name so `triggerNamed(["cast"...])`
    // (and any "spell"/"skill" candidates) resolve to it for koby.
    const pool = [...clips];
    if (cast) {
      const alias = cast.clone();
      alias.name = "koby_spellcast";
      pool.push(alias);
    }
    return {
      actions: { idle: idle ?? clips[0], walk: run },
      pool,
      attackBlend: attackBlend.length ? attackBlend : undefined,
    };
  }
  return { actions: pickSkinClips(clips, scheme), pool: clips };
}

/* ── Authored Biped clips for the race models ─────────────────────────────── */

const RIGHT = new THREE.Vector3(1, 0, 0); // world lateral axis → limb forward/back swing
const UP = new THREE.Vector3(0, 1, 0);    // world vertical axis → spine twist

interface BoneRef {
  bone: THREE.Object3D;
  bindQuat: THREE.Quaternion;
  worldQuat: THREE.Quaternion;
}

function findBone(root: THREE.Object3D, name: string): BoneRef | null {
  let found: THREE.Object3D | null = null;
  root.traverse((o) => {
    if (!found && o.name === name) found = o;
  });
  if (!found) return null;
  const node = found as THREE.Object3D;
  const worldQuat = new THREE.Quaternion();
  node.getWorldQuaternion(worldQuat);
  return { bone: node, bindQuat: node.quaternion.clone(), worldQuat };
}

/** Local-space delta that rotates this bone around the given WORLD axis. */
function localDelta(ref: BoneRef, worldAxis: THREE.Vector3, angle: number): THREE.Quaternion {
  const localAxis = worldAxis.clone().applyQuaternion(ref.worldQuat.clone().invert()).normalize();
  return new THREE.Quaternion().setFromAxisAngle(localAxis, angle);
}

/** Build a QuaternionKeyframeTrack for one bone from a per-time angle fn. */
function track(
  ref: BoneRef,
  worldAxis: THREE.Vector3,
  times: number[],
  angleAt: (t: number) => number,
): THREE.QuaternionKeyframeTrack {
  const values: number[] = [];
  const q = new THREE.Quaternion();
  for (const t of times) {
    q.copy(ref.bindQuat).multiply(localDelta(ref, worldAxis, angleAt(t)));
    values.push(q.x, q.y, q.z, q.w);
  }
  return new THREE.QuaternionKeyframeTrack(`${ref.bone.name}.quaternion`, times, values);
}

function linspace(duration: number, n: number): number[] {
  return Array.from({ length: n }, (_, i) => (i / (n - 1)) * duration);
}

/**
 * Synthesise idle / walk / attack clips for a Biped skeleton found under `root`.
 * Returns only the clips whose required bones are present.
 */
export function buildAuthoredClips(root: THREE.Object3D): Partial<Record<PAction, THREE.AnimationClip>> {
  const B = (n: string) => findBone(root, n);
  const lThigh = B("Bip001 L Thigh"), rThigh = B("Bip001 R Thigh");
  const lCalf = B("Bip001 L Calf"), rCalf = B("Bip001 R Calf");
  const lArm = B("Bip001 L UpperArm"), rArm = B("Bip001 R UpperArm");
  const rFore = B("Bip001 R Forearm");
  const spine = B("Bip001 Spine");

  const out: Partial<Record<PAction, THREE.AnimationClip>> = {};
  const TAU = Math.PI * 2;

  // ── Walk: 0.9s loop, opposing limb swing ──
  {
    const dur = 0.9;
    const t = linspace(dur, 13);
    const tracks: THREE.QuaternionKeyframeTrack[] = [];
    const ph = (x: number) => (x / dur) * TAU;
    const A = 0.55; // leg swing amplitude (rad)
    if (lThigh) tracks.push(track(lThigh, RIGHT, t, (x) => A * Math.sin(ph(x))));
    if (rThigh) tracks.push(track(rThigh, RIGHT, t, (x) => A * Math.sin(ph(x) + Math.PI)));
    if (lCalf) tracks.push(track(lCalf, RIGHT, t, (x) => -0.45 * Math.max(0, Math.sin(ph(x) + 0.5))));
    if (rCalf) tracks.push(track(rCalf, RIGHT, t, (x) => -0.45 * Math.max(0, Math.sin(ph(x) + Math.PI + 0.5))));
    if (lArm) tracks.push(track(lArm, RIGHT, t, (x) => -A * 0.6 * Math.sin(ph(x))));
    if (rArm) tracks.push(track(rArm, RIGHT, t, (x) => -A * 0.6 * Math.sin(ph(x) + Math.PI)));
    if (spine) tracks.push(track(spine, UP, t, (x) => 0.08 * Math.sin(ph(x))));
    if (tracks.length) out.walk = new THREE.AnimationClip("authored_walk", dur, tracks);
  }

  // ── Idle: 3.2s breathing ──
  {
    const dur = 3.2;
    const t = linspace(dur, 9);
    const tracks: THREE.QuaternionKeyframeTrack[] = [];
    const ph = (x: number) => (x / dur) * TAU;
    if (spine) tracks.push(track(spine, RIGHT, t, (x) => 0.035 * Math.sin(ph(x))));
    if (lArm) tracks.push(track(lArm, RIGHT, t, (x) => 0.03 * Math.sin(ph(x)) - 0.04));
    if (rArm) tracks.push(track(rArm, RIGHT, t, (x) => 0.03 * Math.sin(ph(x) + 0.4) - 0.04));
    if (tracks.length) out.idle = new THREE.AnimationClip("authored_idle", dur, tracks);
  }

  // ── Attack: 0.6s one-shot overhand swing (right arm) ──
  {
    const dur = 0.6;
    const t = linspace(dur, 10);
    const tracks: THREE.QuaternionKeyframeTrack[] = [];
    // Windup back (negative) then strike forward (positive) then settle.
    const swing = (x: number) => {
      const p = x / dur;
      if (p < 0.35) return -1.1 * (p / 0.35);          // raise back
      if (p < 0.6) return -1.1 + 2.0 * ((p - 0.35) / 0.25); // strike forward
      return 0.9 * (1 - (p - 0.6) / 0.4);              // recover to neutral
    };
    if (rArm) tracks.push(track(rArm, RIGHT, t, swing));
    if (rFore) tracks.push(track(rFore, RIGHT, t, (x) => -0.5 - 0.4 * Math.sin((x / dur) * Math.PI)));
    if (spine) tracks.push(track(spine, UP, t, (x) => -0.25 * Math.sin((x / dur) * Math.PI)));
    if (tracks.length) out.attack = new THREE.AnimationClip("authored_attack", dur, tracks);
  }

  return out;
}
