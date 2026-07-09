import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { PlayerAnimator, buildSkinAnim } from "./PlayerAnimator";
import { RootMotion } from "./rootMotion";
import { getActiveFighter, RACALVIN_ID } from "../data/fighters";
import { getSkin, skinUrl } from "../data/skins";
import { loadRacalvinBase, loadRacalvinClips } from "./racalvinHero";

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

/**
 * Common animator surface used by the Camp/Boss scenes. Implemented by the
 * KayKit `HeroAnimator` and by `SkinHeroAdapter` (One Piece fighter skins), so a
 * scene can drive either interchangeably and stay model-agnostic.
 */
const HERO_BASE = `${import.meta.env.BASE_URL}models/kaykit/heroes`;

export interface HeroLike {
  setMoving(moving: boolean): void;
  /** Hold sprint intent (run clip when moving). No-op when no run clip exists. */
  setSprinting?(sprinting: boolean): void;
  trigger(state: HeroState): boolean;
  /** Play the first matching clip (by substring) as a one-shot skill animation. */
  triggerNamed(candidates: string[]): boolean;
  update(delta: number): void;
  /** World-space horizontal displacement banked from root motion this frame. */
  consumeRootMotion(out: THREE.Vector3): boolean;
  addLibraryClips(clips: THREE.AnimationClip[]): void;
  dispose(): void;
}

/**
 * Per-skill-slot animation candidates (most-specific first). Spans every model
 * vocabulary — One Piece skins (`combo_a`/`skill_a`…), Racalvin (`hammer`/
 * `punch`…), and KayKit (`1h_melee_attack_chop`/`spellcast`…) — so each fighter
 * plays the richest clip it actually owns and falls back to a basic attack/cast.
 */
export function skillAnimCandidates(idx: number, isCast: boolean): string[] {
  const perSlot: string[][] = [
    ["combo_a", "slash"],
    ["skill_a", "hammer"],
    ["combo_c", "punch", "kick"],
    ["skill_b", "shout"],
    ["combo_b", "spin", "boost"],
  ];
  const base = isCast
    ? ["spellcast", "cast", "spell", "magic", "ranged", "throw", "skill_b", "skill_a"]
    : ["combo", "attack", "slash", "chop", "stab", "1h_melee", "melee", "punch"];
  return [...(perSlot[idx] ?? []), ...base];
}

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

export class HeroAnimator implements HeroLike {
  private mixer: THREE.AnimationMixer;
  private root: THREE.Object3D;
  private byName = new Map<string, THREE.AnimationClip>();
  private actions: Partial<Record<HeroState, THREE.AnimationAction>> = {};
  private current: HeroState = "idle";
  private oneShot: THREE.AnimationAction | null = null;
  private wantMoving = false;
  private wantSprint = false;
  private onFinished: (e: { action: THREE.AnimationAction }) => void;
  /** Extracts in-clip root translation so the world position follows the anim. */
  private rm: RootMotion;

  constructor(root: THREE.Object3D, embedded: THREE.AnimationClip[]) {
    this.root = root;
    this.mixer = new THREE.AnimationMixer(root);
    this.rm = new RootMotion(root);
    this.indexClips(embedded);
    this.rebuildActions();

    this.onFinished = (e) => {
      if (this.oneShot && e.action === this.oneShot) {
        this.oneShot = null;
        this.rm.end();
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
    if (this.wantSprint && this.actions.run) return "run";
    return this.actions.walk ? "walk" : this.actions.run ? "run" : "idle";
  }

  setSprinting(sprinting: boolean) {
    this.wantSprint = sprinting;
    if (this.oneShot || !this.wantMoving) return;
    const next = this.locomotion();
    if (next === this.current) return;
    const prev = this.actions[this.current];
    const nextA = this.actions[next];
    if (!nextA) return;
    prev?.fadeOut(0.12);
    nextA.reset().fadeIn(0.12).play();
    this.current = next;
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

  /** Play a one-shot state. Returns false if no clip resolves or one is active. */
  trigger(state: HeroState): boolean {
    const a = this.actions[state];
    if (!a) return false;
    if (this.oneShot) return false;
    this.oneShot = a;
    a.reset();
    a.setLoop(THREE.LoopOnce, 1);
    a.clampWhenFinished = false;
    a.fadeIn(0.06).play();
    this.actions[this.current]?.fadeOut(0.06);
    this.rm.begin();
    return true;
  }

  /** Play the first clip whose name includes one of `candidates` as a one-shot. */
  triggerNamed(candidates: string[]): boolean {
    if (this.oneShot) return true;
    let clip: THREE.AnimationClip | undefined;
    for (const cand of candidates) {
      for (const [name, c] of this.byName) {
        if (name.includes(cand)) {
          clip = c;
          break;
        }
      }
      if (clip) break;
    }
    if (!clip) return this.trigger("attack");
    const a = this.mixer.clipAction(clip);
    this.oneShot = a;
    a.reset();
    a.setLoop(THREE.LoopOnce, 1);
    a.clampWhenFinished = false;
    a.fadeIn(0.06).play();
    this.actions[this.current]?.fadeOut(0.06);
    this.rm.begin();
    return true;
  }

  update(delta: number) {
    this.mixer.update(delta);
    this.rm.sample(delta);
  }

  consumeRootMotion(out: THREE.Vector3): boolean {
    return this.rm.consume(out);
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

/**
 * Wraps a `PlayerAnimator` (idle/walk/attack on One Piece fighter skins) behind
 * the `HeroLike` surface so the Camp/Boss scenes drive a fighter skin exactly as
 * they drive a KayKit hero. Action states without a dedicated skin clip
 * (jump/dodge/hit) return false so the caller falls back to its procedural lunge.
 */
/** Wraps a race-model `PlayerAnimator` (authored Biped clips) as `HeroLike`. */
export class PlayerHeroAdapter implements HeroLike {
  constructor(private readonly inner: PlayerAnimator) {}

  setMoving(moving: boolean) {
    this.inner.setMoving(moving);
  }

  setSprinting() {}

  trigger(state: HeroState): boolean {
    if (state === "attack" || state === "cast") {
      if (!this.inner.canAttack) return false;
      this.inner.triggerAttack();
      return true;
    }
    if (state === "dodge" || state === "jump" || state === "hit") {
      return this.inner.triggerNamed(
        state === "dodge" ? ["dodge", "roll", "evade"] : state === "jump" ? ["jump", "leap"] : ["hit", "damage"],
      );
    }
    return false;
  }

  triggerNamed(candidates: string[]): boolean {
    return this.inner.triggerNamed(candidates);
  }

  update(delta: number) {
    this.inner.update(delta);
  }

  consumeRootMotion(out: THREE.Vector3): boolean {
    return this.inner.consumeRootMotion(out);
  }

  addLibraryClips(_clips: THREE.AnimationClip[]) {}

  dispose() {
    this.inner.dispose();
  }
}

export class SkinHeroAdapter implements HeroLike {
  constructor(private readonly inner: PlayerAnimator) {}

  setMoving(moving: boolean) {
    this.inner.setMoving(moving);
  }

  setSprinting() {}

  trigger(state: HeroState): boolean {
    if (state === "attack" || state === "cast") {
      if (!this.inner.canAttack) return false;
      this.inner.triggerAttack();
      return true;
    }
    if (state === "dodge") return this.inner.triggerNamed(["dodge", "roll", "evade"]);
    if (state === "jump") return this.inner.triggerNamed(["jump", "leap", "jump_full"]);
    if (state === "hit") return this.inner.triggerNamed(["hit", "damage", "hit_a"]);
    return false;
  }

  triggerNamed(candidates: string[]): boolean {
    return this.inner.triggerNamed(candidates);
  }

  update(delta: number) {
    this.inner.update(delta);
  }

  consumeRootMotion(out: THREE.Vector3): boolean {
    return this.inner.consumeRootMotion(out);
  }

  // Skins are self-contained (labelled clips ship in the GLB) — no shared library.
  addLibraryClips(_clips: THREE.AnimationClip[]) {}

  dispose() {
    this.inner.dispose();
  }
}

/**
 * Load the globally-selected fighter's skin GLB, fit it to `targetHeight` (feet
 * at the wrapper origin, XZ-centred), and hand back a `HeroLike` adapter. Calls
 * `onMiss` when no skin resolves or the GLB fails to load so the caller can fall
 * back to the KayKit hero path.
 */
export function loadActiveFighterModel(
  loader: GLTFLoader,
  targetHeight: number,
  onReady: (root: THREE.Group, anim: HeroLike) => void,
  onMiss: () => void,
) {
  if (getActiveFighter().id === RACALVIN_ID) {
    loadRacalvinHero(loader, targetHeight, onReady, onMiss);
    return;
  }
  const skin = getSkin(getActiveFighter().skinId);
  if (!skin) {
    onMiss();
    return;
  }
  loader.load(
    skinUrl(skin),
    (gltf) => {
      const model = gltf.scene;
      model.traverse((c) => {
        const m = c as THREE.Mesh & { isSkinnedMesh?: boolean };
        if (m.isMesh) {
          m.castShadow = true;
          m.receiveShadow = true;
          m.frustumCulled = false;
        }
      });
      const wrapper = new THREE.Group();
      model.updateWorldMatrix(true, true);
      const box = new THREE.Box3().setFromObject(model);
      const size = new THREE.Vector3();
      box.getSize(size);
      if (size.y > 0.001) model.scale.setScalar(targetHeight / size.y);
      model.updateWorldMatrix(true, true);
      const box2 = new THREE.Box3().setFromObject(model);
      const center = new THREE.Vector3();
      box2.getCenter(center);
      model.position.x -= center.x;
      model.position.z -= center.z;
      model.position.y -= box2.min.y;
      wrapper.add(model);
      const { actions, pool, attackBlend } = buildSkinAnim(gltf.animations, skin.scheme);
      onReady(wrapper, new SkinHeroAdapter(new PlayerAnimator(model, actions, pool, { attackBlend })));
    },
    undefined,
    () => onMiss(),
  );
}

/**
 * Load the bespoke Racalvin (Corsair King) hero for the Camp/Boss scenes: base
 * skinned model + library clips driven through `HeroAnimator` (the clip names —
 * idle/walk/run/attack/cast/dodge/hit/jump — match the `HERO_CANDIDATES`
 * substrings directly), with the Brothers' Keeper sword on the hand bone.
 */
export function loadRacalvinHero(
  loader: GLTFLoader,
  targetHeight: number,
  onReady: (root: THREE.Group, anim: HeroLike) => void,
  onMiss: () => void,
) {
  loadRacalvinBase(
    loader,
    targetHeight,
    (wrapper, root, baseClips) => {
      const hero = new HeroAnimator(root, baseClips);
      loadRacalvinClips(loader).then((clips) => hero.addLibraryClips(clips));
      onReady(wrapper, hero);
    },
    onMiss,
  );
}

/**
 * KayKit hero fallback — class/race KayKit GLB + shared animation library via
 * `HeroAnimator`. Used by `/game` when no fighter skin resolves.
 */
export function loadKayKitHeroModel(
  loader: GLTFLoader,
  className: string | undefined,
  raceKey: string | undefined,
  targetHeight: number,
  onReady: (root: THREE.Group, anim: HeroLike) => void,
  onMiss: () => void,
) {
  const modelName = resolveModelName(className, raceKey);
  const localUrl = `${HERO_BASE}/${modelName}.glb`;
  const remoteUrl = `${OBJECTSTORE}/models/characters/kaykit/${modelName}.glb`;

  const fitHero = (root: THREE.Object3D) => {
    const wrapper = new THREE.Group();
    root.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(root);
    const size = new THREE.Vector3();
    box.getSize(size);
    if (size.y > 0.001) root.scale.setScalar(targetHeight / size.y);
    root.updateWorldMatrix(true, true);
    const box2 = new THREE.Box3().setFromObject(root);
    const center = new THREE.Vector3();
    box2.getCenter(center);
    root.position.x -= center.x;
    root.position.z -= center.z;
    root.position.y -= box2.min.y;
    root.traverse((c) => {
      const m = c as THREE.Mesh & { isSkinnedMesh?: boolean };
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
        if (m.isSkinnedMesh) m.frustumCulled = false;
      }
    });
    wrapper.add(root);
    return wrapper;
  };

  const onGltf = (gltf: { scene: THREE.Group; animations: THREE.AnimationClip[] }) => {
    const wrapper = fitHero(gltf.scene);
    const hero = new HeroAnimator(gltf.scene, gltf.animations);
    loadKayKitAnimLibrary(loader).then((clips) => hero.addLibraryClips(clips));
    onReady(wrapper, hero);
  };

  loader.load(localUrl, onGltf, undefined, () => {
    loader.load(remoteUrl, onGltf, undefined, () => onMiss());
  });
}
