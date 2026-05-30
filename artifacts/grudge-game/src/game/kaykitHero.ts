import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

/**
 * Shared KayKit hero utilities used by the real-time 3D scenes (`/camp`,
 * `/boss`). Keeps the animated-hero model resolution, the shared KayKit
 * animation library, the leak-safe disposal traversal, and the `HeroAnimator`
 * state machine in one place so both scenes stay in lockstep.
 */

export const OBJECTSTORE = "https://molochdagod.github.io/ObjectStore";

const CLASS_TO_MODEL: Record<string, string> = {
  warrior: "Knight",
  mage: "Mage",
  ranger: "Ranger",
  worge: "Barbarian",
  barbarian: "Barbarian",
};

const RACE_TO_MODEL_OVERRIDE: Record<string, string> = {
  human: "Knight",
  dwarf: "Barbarian",
  elf: "Ranger",
  highelf: "Mage",
  orc: "Barbarian",
  undead: "Mage",
  worge: "Barbarian",
  gnome: "Mage",
};

/** Resolve which KayKit hero GLB to render for a class/race combo. */
export function resolveModelName(className?: string, raceKey?: string): string {
  const r = (raceKey ?? "").toLowerCase();
  if (RACE_TO_MODEL_OVERRIDE[r]) return RACE_TO_MODEL_OVERRIDE[r];
  const c = (className ?? "").toLowerCase();
  return CLASS_TO_MODEL[c] ?? "Knight";
}

/**
 * Recursively dispose every geometry, material and texture under `root`.
 * Uses `.isMesh` flag checks (NOT `instanceof`) because the app can load
 * multiple Three.js instances, which breaks `instanceof`.
 */
export function disposeObject3D(root: THREE.Object3D) {
  root.traverse((c) => {
    const mesh = c as THREE.Mesh;
    if (!(mesh as unknown as { isMesh?: boolean }).isMesh) return;
    if (mesh.geometry) mesh.geometry.dispose();
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      if (!m) continue;
      const mm = m as THREE.Material & Record<string, unknown>;
      for (const key of Object.keys(mm)) {
        const val = mm[key] as { isTexture?: boolean; dispose?: () => void } | undefined;
        if (val && val.isTexture && typeof val.dispose === "function") val.dispose();
      }
      m.dispose();
    }
  });
}

// ─── Shared KayKit animation library (clip-name → clip) ───────────────────────
const KIT_BASE = `${import.meta.env.BASE_URL}models/kaykit`;
const ANIM_FILES = [
  "anim/general.glb",
  "anim/movement.glb",
  "anim/combat.glb",
  // Richer Rig_Medium clip packs (jump/dodge/run variants, ranged/spell casts,
  // special emotes). Same rig as the heroes → bone names match.
  "anim-ext/movement_advanced.glb",
  "anim-ext/combat_ranged.glb",
  "anim-ext/special.glb",
];
let animCache: THREE.AnimationClip[] | null = null;
let animPromise: Promise<THREE.AnimationClip[]> | null = null;

/** Fetch + cache the shared KayKit clip library once (module-scope residency). */
export function loadKayKitAnimLibrary(loader: GLTFLoader): Promise<THREE.AnimationClip[]> {
  if (animCache) return Promise.resolve(animCache);
  if (animPromise) return animPromise;
  animPromise = (async () => {
    const all: THREE.AnimationClip[] = [];
    await Promise.all(
      ANIM_FILES.map(
        (f) =>
          new Promise<void>((resolve) => {
            loader.load(
              `${KIT_BASE}/${f}`,
              (g) => {
                for (const clip of g.animations) all.push(clip);
                resolve();
              },
              undefined,
              () => resolve(),
            );
          }),
      ),
    );
    animCache = all;
    return all;
  })();
  return animPromise;
}

/**
 * HeroAnimator — drives a KayKit hero with a full clip set.
 *
 * Resolves logical states (idle / walk / run / attack / cast / hit / jump /
 * dodge) from candidate clip-name lists, matching whatever clips ship embedded
 * in the hero GLB and whatever is added later from the shared library. One-shot
 * states (attack/cast/hit/jump/dodge) play once then fade back to locomotion.
 * `trigger()` returns false when no clip resolves so the caller can fall back to
 * a procedural lunge.
 */
export type HeroState = "idle" | "walk" | "run" | "attack" | "cast" | "hit" | "jump" | "dodge";

const HERO_CANDIDATES: Record<HeroState, string[]> = {
  idle: ["idle_a", "idle", "idle_b"],
  walk: ["walking_c", "walking_b", "walking_a", "walk", "walking"],
  run: ["running_a", "running_b", "running", "jog", "sprint", "run"],
  attack: [
    "1h_melee_attack_chop",
    "melee_1h_attack_chop",
    "2h_melee_attack_chop",
    "melee_2h_attack",
    "unarmed_attack",
    "attack",
    "slash",
    "chop",
    "slice",
    "stab",
    "punch",
  ],
  cast: ["spellcast", "spell", "cast", "2h_ranged", "ranged", "shoot", "throw", "magic"],
  hit: ["hit_a", "hit_b", "hit", "damage"],
  jump: ["jump_full", "jump", "jumping"],
  dodge: ["dodge", "roll", "evade"],
};

export class HeroAnimator {
  private mixer: THREE.AnimationMixer;
  private root: THREE.Object3D;
  private byName = new Map<string, THREE.AnimationClip>();
  private actions: Partial<Record<HeroState, THREE.AnimationAction>> = {};
  private current: HeroState = "idle";
  private oneShot: THREE.AnimationAction | null = null;
  private wantMoving = false;
  private onFinished: (e: { action: THREE.AnimationAction }) => void;

  constructor(root: THREE.Object3D, embedded: THREE.AnimationClip[]) {
    this.root = root;
    this.mixer = new THREE.AnimationMixer(root);
    this.indexClips(embedded);
    this.rebuildActions();

    this.onFinished = (e) => {
      if (this.oneShot && e.action === this.oneShot) {
        this.oneShot = null;
        const back = this.actions[this.wantMoving ? this.locomotion() : "idle"];
        if (back) {
          back.reset().fadeIn(0.12).play();
          this.current = this.wantMoving ? this.locomotion() : "idle";
        }
      }
    };
    this.mixer.addEventListener(
      "finished",
      this.onFinished as unknown as THREE.EventListener<object, "finished", THREE.AnimationMixer>,
    );

    const idle = this.actions.idle ?? this.actions.walk;
    if (idle) {
      idle.reset().play();
      this.current = this.actions.idle ? "idle" : "walk";
    }
  }

  private indexClips(clips: THREE.AnimationClip[]) {
    for (const c of clips) {
      const key = c.name.toLowerCase();
      if (!this.byName.has(key)) this.byName.set(key, c);
    }
  }

  private resolve(state: HeroState): THREE.AnimationClip | undefined {
    for (const cand of HERO_CANDIDATES[state]) {
      for (const [name, clip] of this.byName) {
        if (name.includes(cand)) return clip;
      }
    }
    return undefined;
  }

  private rebuildActions() {
    (Object.keys(HERO_CANDIDATES) as HeroState[]).forEach((state) => {
      if (this.actions[state]) return;
      const clip = this.resolve(state);
      if (clip) this.actions[state] = this.mixer.clipAction(clip);
    });
  }

  /** Add clips from the shared library after async load and re-resolve states. */
  addLibraryClips(clips: THREE.AnimationClip[]) {
    this.indexClips(clips);
    this.rebuildActions();
    // If we were idling with nothing, start idle now.
    if (!this.oneShot && this.actions[this.current]) {
      this.actions[this.current]!.play();
    }
  }

  private locomotion(): HeroState {
    return this.actions.walk ? "walk" : this.actions.run ? "run" : "idle";
  }

  setMoving(moving: boolean) {
    this.wantMoving = moving;
    if (this.oneShot) return;
    const next: HeroState = moving ? this.locomotion() : "idle";
    if (next === this.current) return;
    const prev = this.actions[this.current];
    const nextA = this.actions[next];
    if (!nextA) return;
    prev?.fadeOut(0.18);
    nextA.reset().fadeIn(0.18).play();
    this.current = next;
  }

  /** Play a one-shot state. Returns false if no clip resolves. */
  trigger(state: HeroState): boolean {
    const a = this.actions[state];
    if (!a || this.oneShot) return !!a;
    this.oneShot = a;
    a.reset();
    a.setLoop(THREE.LoopOnce, 1);
    a.clampWhenFinished = false;
    a.fadeIn(0.06).play();
    this.actions[this.current]?.fadeOut(0.06);
    return true;
  }

  update(delta: number) {
    this.mixer.update(delta);
  }

  dispose() {
    this.mixer.removeEventListener(
      "finished",
      this.onFinished as unknown as THREE.EventListener<object, "finished", THREE.AnimationMixer>,
    );
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.root);
  }
}
