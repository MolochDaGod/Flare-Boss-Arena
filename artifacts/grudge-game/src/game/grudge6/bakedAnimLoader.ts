/**
 * Baked Bip001 rotation-only clips for Grudge6 allies.
 * Fetches JSON from grudge-arena API; remaps tracks to loaded rig bone names.
 */

import * as THREE from "three";
import {
  ANIM_PACK_CLIPS,
  BAKED_SKILL_CLIPS,
  bakedAnimUrl,
  type BakedAnimPack,
} from "../../data/grudge6Assets";

const clipCache = new Map<string, THREE.AnimationClip>();

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
    if (sm.isSkinnedMesh?.skeleton?.bones) {
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

async function loadBakedClip(rel: string, scene: THREE.Object3D | null): Promise<THREE.AnimationClip | null> {
  const cacheKey = `${rel}::${scene?.uuid ?? "none"}`;
  const cached = clipCache.get(cacheKey);
  if (cached) return cached.clone();

  const url = bakedAnimUrl(rel);
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    let clip = normalizeBakedClip(THREE.AnimationClip.parse(json), scene);
    clipCache.set(cacheKey, clip);
    return clip.clone();
  } catch {
    return null;
  }
}

export interface BakedPackResult {
  pack: BakedAnimPack;
  clips: Partial<Record<"idle" | "walk" | "run" | "attack", THREE.AnimationClip>>;
  pool: THREE.AnimationClip[];
  sources: Record<string, string>;
}

/** Load locomotion + attack + skill clips for an ally anim pack. */
export async function loadBakedPackForAlly(
  pack: BakedAnimPack,
  scene: THREE.Object3D,
): Promise<BakedPackResult> {
  const defs = ANIM_PACK_CLIPS[pack];
  const rels: Record<string, string> = {
    idle: defs.idle,
    walk: defs.walk,
    run: defs.run,
    attack: defs.attack,
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

  for (const [name, rel] of Object.entries(rels)) sources[name] = rel;
  for (const entry of entries) {
    if (!entry) continue;
    const [name, clip] = entry;
    pool.push(clip);
    if (name === "idle" || name === "walk" || name === "run" || name === "attack") {
      clips[name] = clip;
    }
  }

  return { pack, clips, pool, sources };
}