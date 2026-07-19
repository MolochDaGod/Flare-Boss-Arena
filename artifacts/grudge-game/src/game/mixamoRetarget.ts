/**
 * Mixamo → monster skeletal retarget (rotation-only clip remap).
 *
 * Mixamo assets often ship with no clips on the creature GLB. This helper:
 *  1. Loads a Mixamo animation GLB (library URL or local)
 *  2. Remaps track names from mixamorig:* to target skeleton bone names
 *  3. Keeps rotation tracks (stable across scales) — drops root translation
 *
 * Used by MonsterModels for mon_* assets with clip: null.
 */

import * as THREE from "three";
import { createGltfLoader } from "@/game/threeSetup";

const loader = createGltfLoader();
const clipCache = new Map<string, Promise<THREE.AnimationClip[]>>();

/** Common Mixamo free animation CDN mirrors (fallback chain). */
export const MIXAMO_CLIP_URLS = {
  idle: [
    `${import.meta.env.BASE_URL}models/anims/mixamo/idle.glb`,
    "https://assets.grudge-studio.com/animations/mixamo/idle.glb",
  ],
  walk: [
    `${import.meta.env.BASE_URL}models/anims/mixamo/walk.glb`,
    "https://assets.grudge-studio.com/animations/mixamo/walk.glb",
  ],
  run: [
    `${import.meta.env.BASE_URL}models/anims/mixamo/run.glb`,
    "https://assets.grudge-studio.com/animations/mixamo/run.glb",
  ],
  attack: [
    `${import.meta.env.BASE_URL}models/anims/mixamo/punch.glb`,
    "https://assets.grudge-studio.com/animations/mixamo/punch.glb",
  ],
} as const;

export type MixamoClipRole = keyof typeof MIXAMO_CLIP_URLS;

function boneAliasMap(targetBones: string[]): Map<string, string> {
  const map = new Map<string, string>();
  const lower = new Map(targetBones.map((b) => [b.toLowerCase().replace(/[^a-z0-9]/g, ""), b]));

  const pairs: Array<[string, string[]]> = [
    ["hips", ["hips", "hip", "pelvis", "bip001pelvis", "root"]],
    ["spine", ["spine", "spine1", "bip001spine"]],
    ["spine1", ["spine1", "spine2", "chest"]],
    ["spine2", ["spine2", "chest", "spine3"]],
    ["neck", ["neck", "bip001neck"]],
    ["head", ["head", "bip001head"]],
    ["leftupleg", ["leftupleg", "leftthigh", "l_upleg", "bip001lthigh"]],
    ["leftleg", ["leftleg", "leftcalf", "l_leg", "bip001lcalf"]],
    ["leftfoot", ["leftfoot", "l_foot", "bip001lfoot"]],
    ["rightupleg", ["rightupleg", "rightthigh", "r_upleg", "bip001rthigh"]],
    ["rightleg", ["rightleg", "rightcalf", "r_leg", "bip001rcalf"]],
    ["rightfoot", ["rightfoot", "r_foot", "bip001rfoot"]],
    ["leftarm", ["leftarm", "l_upperarm", "bip001lupperarm"]],
    ["leftforearm", ["leftforearm", "l_forearm", "bip001lforearm"]],
    ["lefthand", ["lefthand", "l_hand", "bip001lhand"]],
    ["rightarm", ["rightarm", "r_upperarm", "bip001rupperarm"]],
    ["rightforearm", ["rightforearm", "r_forearm", "bip001rforearm"]],
    ["righthand", ["righthand", "r_hand", "bip001rhand"]],
  ];

  for (const [mixamoKey, aliases] of pairs) {
    for (const a of aliases) {
      const hit = lower.get(a);
      if (hit) {
        map.set(mixamoKey, hit);
        break;
      }
    }
  }
  return map;
}

function stripMixamoPrefix(name: string): string {
  return name
    .replace(/^mixamorig[:_]?/i, "")
    .replace(/^Armature\|/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Remap a Mixamo clip onto a target skeleton (rotation tracks only).
 */
export function retargetMixamoClip(
  source: THREE.AnimationClip,
  targetRoot: THREE.Object3D,
  name = source.name || "mixamo",
): THREE.AnimationClip | null {
  const bones: string[] = [];
  targetRoot.traverse((o) => {
    if ((o as THREE.Bone).isBone || o.type === "Bone") bones.push(o.name);
  });
  // Also collect Object3D named like bones (some GLBs lack Bone type)
  if (bones.length < 4) {
    targetRoot.traverse((o) => {
      if (/hip|spine|arm|leg|hand|foot|head|neck|pelvis|bip/i.test(o.name)) {
        bones.push(o.name);
      }
    });
  }
  if (bones.length < 3) return null;

  const aliases = boneAliasMap(bones);
  const tracks: THREE.KeyframeTrack[] = [];

  for (const track of source.tracks) {
    // mixamorig:Hips.quaternion → bone
    const m = /^([^.]+)\.(quaternion|rotation)$/.exec(track.name);
    if (!m) continue; // drop position / scale for retarget stability
    const raw = stripMixamoPrefix(m[1]!);
    const targetBone =
      aliases.get(raw) ??
      bones.find((b) => stripMixamoPrefix(b) === raw) ??
      bones.find((b) => stripMixamoPrefix(b).includes(raw) || raw.includes(stripMixamoPrefix(b)));
    if (!targetBone) continue;

    const prop = m[2] === "rotation" ? "quaternion" : m[2];
    const cloned = track.clone();
    cloned.name = `${targetBone}.${prop}`;
    tracks.push(cloned);
  }

  if (tracks.length < 3) return null;
  return new THREE.AnimationClip(name, source.duration, tracks);
}

async function loadClipsFromUrls(urls: string[]): Promise<THREE.AnimationClip[]> {
  for (const url of urls) {
    const key = url;
    let p = clipCache.get(key);
    if (!p) {
      p = new Promise((resolve) => {
        if (!url.startsWith("/") && !url.startsWith(".")) {
          loader.setCrossOrigin("anonymous");
        }
        loader.load(
          url,
          (gltf) => resolve(gltf.animations ?? []),
          undefined,
          () => resolve([]),
        );
      });
      clipCache.set(key, p);
    }
    const clips = await p;
    if (clips.length) return clips;
  }
  return [];
}

/**
 * Build idle/walk/attack clips for a monster that has no authored animation.
 * Returns empty array if Mixamo sources fail (caller keeps procedural sway).
 */
export async function buildMixamoBankForMonster(
  targetRoot: THREE.Object3D,
): Promise<{ idle?: THREE.AnimationClip; walk?: THREE.AnimationClip; attack?: THREE.AnimationClip }> {
  const out: {
    idle?: THREE.AnimationClip;
    walk?: THREE.AnimationClip;
    attack?: THREE.AnimationClip;
  } = {};

  const roles: Array<"idle" | "walk" | "attack"> = ["idle", "walk", "attack"];
  for (const role of roles) {
    const sources = await loadClipsFromUrls([...MIXAMO_CLIP_URLS[role]]);
    for (const src of sources) {
      const retargeted = retargetMixamoClip(src, targetRoot, role);
      if (retargeted) {
        out[role] = retargeted;
        break;
      }
    }
  }
  return out;
}

/** Simple multi-clip bank matching MonsterModels clipBank API. */
export function createMixamoClipBank(
  root: THREE.Object3D,
  clips: { idle?: THREE.AnimationClip; walk?: THREE.AnimationClip; attack?: THREE.AnimationClip },
): {
  update(delta: number): void;
  setMoving(moving: boolean): void;
  playAttack(): void;
  playHit(): void;
  playDeath(): void;
  dispose(): void;
} | null {
  if (!clips.idle && !clips.walk && !clips.attack) return null;
  const mixer = new THREE.AnimationMixer(root);
  const actions: Record<string, THREE.AnimationAction> = {};
  if (clips.idle) actions.idle = mixer.clipAction(clips.idle);
  if (clips.walk) actions.walk = mixer.clipAction(clips.walk);
  if (clips.attack) {
    actions.attack = mixer.clipAction(clips.attack);
    actions.attack.setLoop(THREE.LoopOnce, 1);
    actions.attack.clampWhenFinished = true;
  }

  let current = "idle";
  const play = (name: string, fade = 0.2) => {
    const next = actions[name] ?? actions.idle;
    if (!next) return;
    if (current === name && next.isRunning()) return;
    const prev = actions[current];
    next.reset().play();
    if (prev && prev !== next) prev.crossFadeTo(next, fade, false);
    current = name;
  };

  play("idle", 0);

  return {
    update(delta: number) {
      mixer.update(delta);
    },
    setMoving(moving: boolean) {
      play(moving && actions.walk ? "walk" : "idle");
    },
    playAttack() {
      if (actions.attack) play("attack", 0.1);
    },
    playHit() {
      /* optional */
    },
    playDeath() {
      mixer.stopAllAction();
    },
    dispose() {
      mixer.stopAllAction();
    },
  };
}
