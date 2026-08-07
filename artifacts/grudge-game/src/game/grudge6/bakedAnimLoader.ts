/**
 * Baked Bip001 rotation-only clips for Grudge6 allies.
 * Fetches JSON from grudge-arena API; remaps tracks to loaded rig bone names.
 */

import * as THREE from "three";
import {
  ANIM_PACK_CLIPS,
  BAKED_DIR_RELS,
  BAKED_SKILL_CLIPS,
  bakedAnimUrlCandidates,
  type BakedAnimPack,
} from "../../data/grudge6Assets";

const clipCache = new Map<string, THREE.AnimationClip>();

export const MIN_CLIP_BIND_RATIO = 0.45;
export const MIN_CLIP_BIND_COUNT = 8;

export class BakedAnimLoadError extends Error {
  constructor(
    message: string,
    public pack: BakedAnimPack,
    public missing: string[] = [],
  ) {
    super(message);
    this.name = "BakedAnimLoadError";
  }
}

/**
 * Mixer / bind root must own the Bip001 bone tree.
 * Never return a lone SkinnedMesh — body parts are siblings of Bip001 under
 * RootNode, so PropertyBinding would find 0 bones and baked idle fails →
 * authored fallback (looks “way off” for worge + many classes).
 */
export function getAnimationRoot(scene: THREE.Object3D): THREE.Object3D {
  let bipRoot: THREE.Object3D | undefined;
  scene.traverse((o) => {
    if (bipRoot) return;
    if (o.name === "Bip001" || /^Bip001$/i.test(o.name)) {
      bipRoot = o.parent ?? o;
    }
  });
  return bipRoot ?? scene;
}

function indexBoneName(lookup: Map<string, string>, name: string) {
  if (!name) return;
  lookup.set(name, name);
  if (name.includes("_")) {
    lookup.set(name.replace(/^Bip001_/, "Bip001 ").replace(/_/g, " "), name);
  }
  lookup.set(name.replace(/ /g, "_"), name);
}

function buildSceneBoneLookup(scene: THREE.Object3D): Map<string, string> {
  const lookup = new Map<string, string>();
  // Index every bone under the full kit (not a single mesh island)
  scene.traverse((node) => {
    if ((node as THREE.Bone).isBone) indexBoneName(lookup, node.name);
    const sm = node as THREE.SkinnedMesh;
    if (sm.isSkinnedMesh && sm.skeleton?.bones) {
      for (const bone of sm.skeleton.bones) indexBoneName(lookup, bone.name);
    }
  });
  return lookup;
}

function toRotationOnlyClip(clip: THREE.AnimationClip): THREE.AnimationClip {
  const tracks = clip.tracks.filter((t) => t.name.endsWith(".quaternion"));
  return new THREE.AnimationClip(clip.name, clip.duration, tracks, clip.blendMode);
}

/**
 * Map bone name → live Bone (kit bind pose).
 * Toon RTS Max biped rest ≠ Mixamo-origin bake rest. Absolute clip quats
 * replace spine/neck/head with the wrong rest → “bent the opposite way”.
 */
function collectBindBones(scene: THREE.Object3D): Map<string, THREE.Bone> {
  const map = new Map<string, THREE.Bone>();
  scene.traverse((o) => {
    const b = o as THREE.Bone;
    if (b.isBone && b.name) map.set(b.name, b);
  });
  return map;
}

/**
 * Retarget rotation tracks onto the kit’s bind pose:
 *   q_out(t) = q_bind * inverse(q_clip(0)) * q_clip(t)
 * t=0 stays bind (no snap); motion is the bake’s relative deltas.
 * Required for Bip001-named packs when source rest ≠ Toon ★ rest.
 */
export function retargetRotationClipToKitBind(
  clip: THREE.AnimationClip,
  scene: THREE.Object3D,
): THREE.AnimationClip {
  const bones = collectBindBones(scene);
  if (bones.size === 0) return clip;

  const src0 = new THREE.Quaternion();
  const src0Inv = new THREE.Quaternion();
  const qClip = new THREE.Quaternion();
  const qRel = new THREE.Quaternion();
  const qOut = new THREE.Quaternion();
  const bindQ = new THREE.Quaternion();

  const nextTracks: THREE.KeyframeTrack[] = [];
  for (const track of clip.tracks) {
    if (!track.name.endsWith(".quaternion")) {
      nextTracks.push(track);
      continue;
    }
    const boneName = track.name.slice(0, -".quaternion".length);
    const bone = bones.get(boneName);
    const values = track.values as Float32Array;
    if (!bone || values.length < 4) {
      nextTracks.push(track);
      continue;
    }

    bindQ.copy(bone.quaternion).normalize();
    src0.set(values[0]!, values[1]!, values[2]!, values[3]!).normalize();
    // Skip near-identity relative (already matches) — still rewrite for safety
    src0Inv.copy(src0).invert();

    const out = new Float32Array(values.length);
    for (let i = 0; i < values.length; i += 4) {
      qClip.set(values[i]!, values[i + 1]!, values[i + 2]!, values[i + 3]!).normalize();
      // relative motion in source space, then apply on kit bind
      qRel.copy(src0Inv).multiply(qClip);
      qOut.copy(bindQ).multiply(qRel).normalize();
      out[i] = qOut.x;
      out[i + 1] = qOut.y;
      out[i + 2] = qOut.z;
      out[i + 3] = qOut.w;
    }
    nextTracks.push(
      new THREE.QuaternionKeyframeTrack(
        track.name,
        Array.from(track.times as ArrayLike<number>),
        Array.from(out),
      ),
    );
  }
  return new THREE.AnimationClip(clip.name, clip.duration, nextTracks, clip.blendMode);
}

function normalizeBakedClip(clip: THREE.AnimationClip, scene: THREE.Object3D | null): THREE.AnimationClip {
  const lookup = scene ? buildSceneBoneLookup(scene) : null;
  // Clone tracks so we never mutate cached source arrays in place across scenes
  const renamed: THREE.KeyframeTrack[] = [];
  for (const track of clip.tracks) {
    const dot = track.name.indexOf(".");
    if (dot === -1) {
      renamed.push(track);
      continue;
    }
    const bone = track.name.slice(0, dot);
    const prop = track.name.slice(dot);
    let resolved = bone;
    if (lookup) {
      if (lookup.has(bone)) resolved = lookup.get(bone)!;
      else if (bone.startsWith("Bip001_")) {
        const spaced = bone.replace(/^Bip001_/, "Bip001 ").replace(/_/g, " ");
        if (lookup.has(spaced)) resolved = lookup.get(spaced)!;
      }
      if (!lookup.has(resolved) && !lookup.has(bone)) continue; // drop unbound
    }
    if (resolved !== bone) {
      const Ctor = track.constructor as new (
        name: string,
        times: ArrayLike<number>,
        values: ArrayLike<number>,
      ) => THREE.KeyframeTrack;
      renamed.push(
        new Ctor(
          `${resolved}${prop}`,
          (track.times as Float32Array).slice(),
          (track.values as Float32Array).slice(),
        ),
      );
    } else {
      renamed.push(track);
    }
  }
  let out = new THREE.AnimationClip(clip.name, clip.duration, renamed, clip.blendMode);
  out = toRotationOnlyClip(out);
  if (scene) out = retargetRotationClipToKitBind(out, scene);
  return out;
}

export function validateClipBinding(
  clip: THREE.AnimationClip,
  root: THREE.Object3D,
): { ok: boolean; bound: number; total: number; ratio: number } {
  const mixer = new THREE.AnimationMixer(root);
  const action = mixer.clipAction(clip, root);
  const bindings = (action as unknown as { _propertyBindings?: Array<{ binding?: { node?: unknown } }> })
    ._propertyBindings ?? [];
  let bound = 0;
  for (const b of bindings) {
    if (b?.binding?.node) bound++;
  }
  const total = bindings.length;
  const ratio = total > 0 ? bound / total : 0;
  mixer.stopAllAction();
  mixer.uncacheRoot(root);
  return {
    ok: bound >= MIN_CLIP_BIND_COUNT && ratio >= MIN_CLIP_BIND_RATIO,
    bound,
    total,
    ratio,
  };
}

async function loadBakedClip(rel: string, scene: THREE.Object3D | null): Promise<THREE.AnimationClip | null> {
  const cacheKey = `${rel}::${scene?.uuid ?? "none"}`;
  const cached = clipCache.get(cacheKey);
  if (cached) return cached.clone();

  for (const url of bakedAnimUrlCandidates(rel)) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const json = await res.json();
      const clip = normalizeBakedClip(THREE.AnimationClip.parse(json), scene);
      clipCache.set(cacheKey, clip);
      return clip.clone();
    } catch {
      /* try next mirror */
    }
  }
  return null;
}

export interface BakedPackResult {
  pack: BakedAnimPack;
  clips: Partial<
    Record<
      | "idle"
      | "walk"
      | "run"
      | "sprint"
      | "attack"
      | "walkBack"
      | "runBack"
      | "strafeLeft"
      | "strafeRight",
      THREE.AnimationClip
    >
  >;
  pool: THREE.AnimationClip[];
  sources: Record<string, string>;
  idleBindRatio: number | null;
  missing: string[];
}

const REQUIRED_LOCO = ["idle", "walk", "run"] as const;

/** Load locomotion + attack + skill + directional clips for an ally anim pack. */
export async function loadBakedPackForAlly(
  pack: BakedAnimPack,
  scene: THREE.Object3D,
): Promise<BakedPackResult> {
  const defs = ANIM_PACK_CLIPS[pack];
  const dirRels = BAKED_DIR_RELS[pack];
  const rels: Record<string, string> = {
    idle: defs.idle,
    walk: defs.walk,
    run: defs.run,
    attack: defs.attack,
    walkBack: dirRels.walkBack,
    runBack: dirRels.runBack,
    strafeLeft: dirRels.strafeLeft,
    strafeRight: dirRels.strafeRight,
    ...BAKED_SKILL_CLIPS,
  };

  const entries = await Promise.all(
    Object.entries(rels).map(async ([name, rel]) => {
      const clip = await loadBakedClip(rel, scene);
      if (!clip) return null;
      clip.name = name;
      return [name, clip] as const;
    }),
  );

  const clips: BakedPackResult["clips"] = {};
  const pool: THREE.AnimationClip[] = [];
  const sources: Record<string, string> = {};
  const missing: string[] = [];

  for (const [name, rel] of Object.entries(rels)) sources[name] = rel;
  for (const entry of entries) {
    if (!entry) continue;
    const [name, clip] = entry;
    pool.push(clip);
    clips[name as keyof BakedPackResult["clips"]] = clip;
  }

  for (const name of REQUIRED_LOCO) {
    if (!clips[name]) missing.push(name);
  }
  if (!clips.attack) missing.push("attack");

  const animRoot = getAnimationRoot(scene);
  let idleBindRatio: number | null = null;
  if (clips.idle) {
    const bind = validateClipBinding(clips.idle, animRoot);
    idleBindRatio = bind.ratio;
    if (!bind.ok) {
      throw new BakedAnimLoadError(
        `Idle bind ${bind.bound}/${bind.total} (${Math.round(bind.ratio * 100)}%, need ≥${Math.round(MIN_CLIP_BIND_RATIO * 100)}%)`,
        pack,
        ["idle-bind"],
      );
    }
  }

  if (clips.run) {
    const sprint = clips.run.clone();
    sprint.name = "sprint";
    clips.sprint = sprint;
    pool.push(sprint);
  }

  if (missing.length) {
    throw new BakedAnimLoadError(
      `Baked locomotion incomplete: missing ${missing.join(", ")}`,
      pack,
      missing,
    );
  }

  return { pack, clips, pool, sources, idleBindRatio, missing };
}