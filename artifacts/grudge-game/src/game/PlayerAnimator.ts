import * as THREE from "three";
import { SKIN_CLIP_SUFFIX, KOBY_CLIPS, type SkinScheme } from "../data/skins";
import { syncHiddenMeshesForClip } from "./assetVisibility";
import { syncRacalvinSwordPose } from "./racalvinHero";
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

type PAction = "idle" | "walk" | "run" | "attack" | "cast" | "dodge" | "jump" | "hit";

export class PlayerAnimator {
  private mixer: THREE.AnimationMixer;
  private actions: Partial<Record<PAction, THREE.AnimationAction>> = {};
  private current: PAction = "idle";
  private attacking = false;
  private wantMoving = false;
  private wantSprint = false;
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
  /**
   * Meshy / pirate crew best practice: keep idle+walk+run scheduled and blend
   * by weight from speed (no hard cut). Falls back to crossFade when only one
   * locomotion clip exists.
   */
  private weightLoco: boolean;
  private gait = 0;
  private gaitTarget = 0;
  /** Optional weapon / mesh sync after every clip change. */
  onClipChange?: (clipName: string) => void;

  constructor(
    root: THREE.Object3D,
    clips: Partial<Record<PAction, THREE.AnimationClip>>,
    pool?: THREE.AnimationClip[],
    opts?: { attackBlend?: THREE.AnimationClip[]; weightLoco?: boolean },
  ) {
    this.mixer = new THREE.AnimationMixer(root);
    this.rm = new RootMotion(root);
    this.weightLoco = opts?.weightLoco ?? !!(clips.idle && clips.walk);
    (Object.keys(clips) as PAction[]).forEach((key) => {
      const clip = clips[key];
      if (!clip) return;
      // Meshy packs: drop redundant keys once
      try {
        clip.optimize();
      } catch {
        /* optional */
      }
      const action = this.mixer.clipAction(clip);
      // Loop locomotion; one-shots configured on trigger
      if (key === "idle" || key === "walk" || key === "run") {
        action.setLoop(THREE.LoopRepeat, Infinity);
        action.clampWhenFinished = false;
        if (this.weightLoco) {
          action.enabled = true;
          action.setEffectiveWeight(key === "idle" ? 1 : 0);
          action.play();
        }
      }
      this.actions[key] = action;
    });
    for (const c of pool ?? []) {
      const key = c.name.toLowerCase();
      if (!this.pool.has(key)) this.pool.set(key, c);
    }
    this.attackBlend = opts?.attackBlend?.filter(Boolean) ?? [];

    const idle = this.actions.idle ?? this.actions.walk ?? this.actions.run;
    if (idle && !this.weightLoco) {
      idle.reset().fadeIn(0.12).play();
      if (this.actions.idle === idle) idle.timeScale = 1;
    }
    this.current = this.actions.idle ? "idle" : this.actions.walk ? "walk" : "run";
    this.syncMeshVisibility(idle?.getClip().name);

    this.mixer.addEventListener("finished", (e) => {
      if (!this.attacking) return; // ignore stray finishes (and the 2nd of a pair)
      // Only react to the primary one-shot finishing (not a secondary blend track).
      const finished = (e as unknown as { action?: THREE.AnimationAction }).action;
      if (finished && this.oneShot && finished !== this.oneShot && !this.oneShotBlend.includes(finished)) {
        return;
      }
      this.attacking = false;
      this.rm.end();
      this.oneShot?.fadeOut(0.16);
      this.oneShot = null;
      for (const a of this.oneShotBlend) a.fadeOut(0.16);
      this.oneShotBlend = [];
      // Smooth return to locomotion (crossFade / weight restore).
      this.resumeLocomotion(0.18);
    });
  }

  /** Cross-fade / weight-restore into current idle/walk without a hard cut. */
  private resumeLocomotion(fade = 0.18) {
    if (this.weightLoco) {
      this.applyWeightLoco(fade);
      const name =
        this.actions[this.current]?.getClip().name ??
        this.actions.idle?.getClip().name;
      if (name) this.syncMeshVisibility(name);
      return;
    }
    const cur = this.actions[this.current];
    if (!cur) return;
    cur.enabled = true;
    cur.setEffectiveWeight(1);
    cur.reset().fadeIn(fade).play();
    this.syncMeshVisibility(cur.getClip().name);
  }

  private syncMeshVisibility(clipName?: string) {
    const root = this.mixer.getRoot() as THREE.Object3D;
    const name =
      clipName ??
      this.oneShot?.getClip().name ??
      this.oneShotBlend[0]?.getClip().name ??
      this.actions[this.current]?.getClip().name;
    if (!name) return;
    // Clip-driven mesh hide rules (OP skins) — optional
    if (root.userData.assetVisibilityRules?.length) {
      syncHiddenMeshesForClip(root, name);
    }
    // Brothers' Keeper held/rest grip — always, even when no hide rules
    syncRacalvinSwordPose(root, name);
    this.onClipChange?.(name);
  }

  /** Resolve idle / walk / run from move + sprint intent. */
  private locomotion(): PAction {
    if (!this.wantMoving) return this.actions.idle ? "idle" : this.actions.walk ? "walk" : "run";
    if (this.wantSprint && this.actions.run) return "run";
    if (this.actions.walk) return "walk";
    if (this.actions.run) return "run";
    return "idle";
  }

  /**
   * Best-practice locomotion blend: weight mix (Meshy) or `crossFadeTo`.
   * Skipped while a one-shot owns the mixer.
   */
  setMoving(moving: boolean) {
    this.wantMoving = moving;
    this.gaitTarget = moving ? (this.wantSprint ? 1 : 0.45) : 0;
    if (this.weightLoco) this.applyWeightLoco(0.2);
    else this.applyLocomotion(0.2);
  }

  /** Sprint intent when a run clip exists (crew / skins with run packs). */
  setSprinting(sprinting: boolean) {
    this.wantSprint = sprinting;
    if (this.wantMoving) this.gaitTarget = sprinting ? 1 : 0.45;
    if (!this.wantMoving) return;
    if (this.weightLoco) this.applyWeightLoco(0.14);
    else this.applyLocomotion(0.14);
  }

  /** Speed 0..1 → idle / walk / run (shared gait helper — preferred for crew). */
  setGaitFromSpeed(speed01: number, sprinting = false) {
    this.wantMoving = speed01 > 0.08;
    this.wantSprint = sprinting || speed01 > 0.72;
    this.gaitTarget = !this.wantMoving
      ? 0
      : this.wantSprint
        ? 1
        : THREE.MathUtils.clamp(speed01, 0.12, 0.85);
    if (this.weightLoco) this.applyWeightLoco(0.16);
    else this.applyLocomotion(0.16);
  }

  /**
   * Simultaneous idle/walk/run weight blend (Three.js AnimationAction weights).
   * gait 0 = idle, ~0.4 walk, 1 = run/sprint.
   */
  private applyWeightLoco(smooth = 0.18) {
    if (this.attacking) return;
    const idle = this.actions.idle;
    const walk = this.actions.walk;
    const run = this.actions.run;
    if (!idle && !walk && !run) return;

    // Ease gait toward target each apply (caller may call often)
    this.gait += (this.gaitTarget - this.gait) * Math.min(1, smooth * 4);

    let wi = 0;
    let ww = 0;
    let wr = 0;
    const g = this.gait;
    if (g < 0.08) {
      wi = 1;
    } else if (g < 0.55) {
      const t = (g - 0.08) / 0.47;
      wi = 1 - t;
      ww = t;
    } else {
      const t = Math.min(1, (g - 0.55) / 0.45);
      ww = 1 - t;
      wr = t;
    }
    // Normalize available clips
    if (!run) {
      ww += wr;
      wr = 0;
    }
    if (!walk) {
      if (wr > 0) {
        /* keep run */
      } else wi = 1;
      ww = 0;
    }
    if (!idle) {
      ww += wi;
      wi = 0;
    }

    const setW = (a: THREE.AnimationAction | undefined, w: number) => {
      if (!a) return;
      a.enabled = true;
      a.setLoop(THREE.LoopRepeat, Infinity);
      if (!a.isRunning()) a.play();
      // Smooth weight (Three recommended setEffectiveWeight)
      const cur = a.getEffectiveWeight();
      a.setEffectiveWeight(cur + (w - cur) * Math.min(1, smooth * 3));
      a.timeScale = w > 0.02 ? 1 : a.timeScale;
    };
    setW(idle, wi);
    setW(walk, ww);
    setW(run, wr);

    this.current = wr > ww && wr > wi ? "run" : ww > wi ? "walk" : "idle";
  }

  private applyLocomotion(fade: number) {
    if (this.weightLoco) {
      this.applyWeightLoco(fade);
      return;
    }
    const next = this.locomotion();
    if (next === this.current) return;
    const prevA = this.actions[this.current];
    const nextA = this.actions[next];
    this.current = next;
    if (this.attacking) return; // resume happens on attack finish
    if (!nextA) return;
    nextA.enabled = true;
    nextA.setEffectiveWeight(1);
    nextA.setLoop(THREE.LoopRepeat, Infinity);
    nextA.reset().play();
    if (prevA && prevA !== nextA) {
      prevA.crossFadeTo(nextA, fade, true);
    } else {
      nextA.fadeIn(Math.min(0.16, fade));
    }
    this.syncMeshVisibility(nextA.getClip().name);
  }

  /** Merge additional skill/locomotion clips after progressive load. */
  addLibraryClips(clips: THREE.AnimationClip[]) {
    for (const c of clips) {
      const key = c.name.toLowerCase();
      if (!this.pool.has(key)) this.pool.set(key, c);
      // Fill missing role slots from new pack
      const roleMap: Array<[PAction, string[]]> = [
        ["idle", ["idle"]],
        ["walk", ["walk"]],
        ["run", ["run"]],
        ["attack", ["attack", "combo", "slash"]],
        ["cast", ["cast", "special"]],
        ["dodge", ["dodge"]],
        ["jump", ["jump"]],
        ["hit", ["hit"]],
      ];
      for (const [role, names] of roleMap) {
        if (this.actions[role]) continue;
        if (names.some((n) => key === n || key.includes(n))) {
          const a = this.mixer.clipAction(c);
          if (role === "idle" || role === "walk" || role === "run") {
            a.setLoop(THREE.LoopRepeat, Infinity);
          }
          this.actions[role] = a;
        }
      }
    }
  }

  /** Cross-fade into a one-shot role/skill clip from locomotion. */
  private playOneShot(action: THREE.AnimationAction, fadeIn = 0.1) {
    action.reset();
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.enabled = true;
    action.setEffectiveWeight(1);
    action.fadeIn(fadeIn).play();
    // Drop loco weights so attack pose isn't averaged with walk (Meshy)
    if (this.weightLoco) {
      for (const key of ["idle", "walk", "run"] as const) {
        const a = this.actions[key];
        if (a && a !== action) a.fadeOut(fadeIn);
      }
    } else {
      const loco = this.actions[this.current];
      if (loco && loco !== action) loco.fadeOut(fadeIn);
    }
    this.syncMeshVisibility(action.getClip().name);
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
    this.playOneShot(a, 0.08);
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
        a.fadeIn(0.08).play();
      }
      this.oneShot = this.oneShotBlend[0] ?? null;
      this.actions[this.current]?.fadeOut(0.08);
      this.rm.begin();
      return;
    }
    const a = this.actions.attack;
    if (!a) return;
    this.attacking = true;
    this.oneShot = a;
    this.playOneShot(a, 0.08);
    this.rm.begin();
  }

  /**
   * Play the first pool clip matching `candidates` as a one-shot.
   * Prefer exact name, then includes. Falls back to attack.
   */
  triggerNamed(candidates: string[]): boolean {
    if (this.attacking) {
      // Allow dodge to cancel attack (best practice for combat feel)
      const wantsDodge = candidates.some((c) => /dodge|roll|evade/i.test(c));
      if (!wantsDodge) return true;
    }
    let clip: THREE.AnimationClip | undefined;
    const sorted = [...candidates].sort((a, b) => b.length - a.length);
    // 1) Exact match
    for (const cand of sorted) {
      const lc = cand.toLowerCase();
      const exact = this.pool.get(lc);
      if (exact) {
        clip = exact;
        break;
      }
    }
    // 2) Includes match
    if (!clip) {
      for (const cand of sorted) {
        const lc = cand.toLowerCase();
        for (const [name, c] of this.pool) {
          if (name === lc || name.includes(lc) || lc.includes(name)) {
            clip = c;
            break;
          }
        }
        if (clip) break;
      }
    }
    if (!clip) {
      if (this.canAttack) {
        this.triggerAttack();
        return true;
      }
      return false;
    }
    // Fade out any prior one-shot
    if (this.oneShot) this.oneShot.fadeOut(0.08);
    for (const a of this.oneShotBlend) a.fadeOut(0.08);
    this.oneShotBlend = [];

    const action = this.mixer.clipAction(clip);
    this.attacking = true;
    this.oneShot = action;
    this.playOneShot(action, 0.09);
    // Root motion for dodge / jump / lunging attacks only
    const n = clip.name.toLowerCase();
    if (/dodge|roll|jump|lunge|charge|slam|combo|slash|skill/.test(n)) {
      this.rm.begin();
    }
    return true;
  }

  update(delta: number) {
    const d = Math.min(delta, 0.05);
    // Keep gait weights tracking while moving (Meshy weighted loco)
    if (this.weightLoco && !this.attacking) {
      this.applyWeightLoco(0.12);
    }
    // Clamp mixer steps so a long frame hitch doesn't explode root-motion travel.
    this.mixer.update(d);
    this.rm.sample(d);
  }

  /** World-space horizontal displacement banked from root motion this frame. */
  consumeRootMotion(out: THREE.Vector3): boolean {
    return this.rm.consume(out);
  }

  /** True while a one-shot attack/skill/dodge is extracting root travel. */
  isRootMotionActive(): boolean {
    return this.rm.isActive;
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
  const candidates = [
    name,
    name.replace(/ /g, "_"),
    name.replace(/_/g, " "),
  ];
  let found: THREE.Object3D | null = null;
  root.traverse((o) => {
    if (found || !o.name) return;
    const n = o.name;
    if (candidates.includes(n)) found = o;
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
