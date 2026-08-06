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

function getAnimationRoot(scene: THREE.Object3D): THREE.Object3D {
  let skinned: THREE.SkinnedMesh | null = null;
  scene.traverse((o) => {
    if (skinned) return;
    const m = o as THREE.SkinnedMesh;
    if (m.isSkinnedMesh) skinned = m;
  });
  if (skinned) return skinned;
  let bip: THREE.Object3D | null = null;
  scene.traverse((o) => {
    if (bip) return;
    if (/^Bip001/i.test(o.name)) bip = o;
  });
  return bip ?? scene;
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
  const root = getAnimationRoot(scene);
  root.traverse((node) => {
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
  return new THREE.AnimationClip(clip.name, clip.duration, tracks);
}

function normalizeBakedClip(clip: THREE.AnimationClip, scene: THREE.Object3D | null): THREE.AnimationClip {
  const lookup = scene ? buildSceneBoneLookup(scene) : null;
  for (const track of clip.tracks) {
    const dot = track.name.indexOf(".");
    if (dot === -1) continue;
    let bone = track.name.slice(0, dot);
    const prop = track.name.slice(dot);
    if (lookup) {
      if (lookup.has(bone)) {
        track.name = lookup.get(bone)! + prop;
      } else if (bone.startsWith("Bip001_")) {
        const spaced = bone.replace(/^Bip001_/, "Bip001 ").replace(/_/g, " ");
        if (lookup.has(spaced)) track.name = lookup.get(spaced)! + prop;
      }
    }
  }
  if (lookup) {
    clip.tracks = clip.tracks.filter((t) => {
      const dot = t.name.indexOf(".");
      if (dot === -1) return true;
      const bone = t.name.slice(0, dot);
      return lookup.has(bone);
    });
  }
  return toRotationOnlyClip(clip);
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