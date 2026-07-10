/**
 * Grudge6 ally prefab loader — production D1 pipeline:
 * CDN race GLB → SkeletonUtils clone → atlas texture → mesh allow-list → baked Bip001 clips.
 */

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkinnedHierarchy } from "three/addons/utils/SkeletonUtils.js";
import type { RaceId } from "../../data/characterMeshes";
import type { Grudge6HeroDef } from "../../data/grudge6Roster";
import { animPackForRole, raceAtlasUrl, raceGlbUrl } from "../../data/grudge6Assets";
import { PlayerAnimator, buildAuthoredClips } from "../PlayerAnimator";
import { loadBakedPackForAlly } from "./bakedAnimLoader";

export interface Grudge6PrefabDebug {
  race: RaceId;
  glbUrl: string;
  atlasUrl: string;
  animPack: string;
  boneCount: number;
  visibleMeshes: string[];
  texturedSlots: number;
  clipNames: string[];
  animSource: "baked" | "authored" | "none";
  loadMs: number;
  errors: string[];
}

export interface Grudge6Instance {
  id: string;
  def: Grudge6HeroDef;
  group: THREE.Group;
  animator: PlayerAnimator | null;
  debug: Grudge6PrefabDebug;
  dispose: () => void;
}

/** Hide everything, then show only meshes whose names match the allow list (case-insensitive). */
export function applyMeshAllowList(root: THREE.Object3D, allow: string[]) {
  const want = new Set(allow.map((n) => n.toLowerCase()));
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const n = mesh.name.toLowerCase();
    let vis = want.has(n);
    if (!vis) {
      for (const a of want) {
        if (n === a || n.endsWith(a) || a.endsWith(n)) {
          vis = true;
          break;
        }
      }
    }
    if (/container|auxscene|forgescene/i.test(mesh.name)) vis = false;
    mesh.visible = vis;
    mesh.castShadow = vis;
    mesh.receiveShadow = vis;
    if ((mesh as THREE.SkinnedMesh).isSkinnedMesh) mesh.frustumCulled = false;
  });
}

function fitFeetOrigin(model: THREE.Object3D, targetHeight: number) {
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
}

function cloneGLTFScene(source: THREE.Object3D): THREE.Group {
  const clone = cloneSkinnedHierarchy(source) as THREE.Group;
  clone.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    mesh.material = Array.isArray(mesh.material)
      ? mesh.material.map((m) => m.clone())
      : mesh.material.clone();
  });
  return clone;
}

function fallbackAllowFromRace(root: THREE.Object3D, def: Grudge6HeroDef): string[] {
  const names: string[] = [];
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh && o.name) names.push(o.name);
  });
  const pick = (re: RegExp) => names.find((n) => re.test(n.toLowerCase()));
  const body = pick(/body_[a-e]$|units_body/);
  const head = pick(/head_[a-n]$|units_head/);
  const arms = pick(/arms_[a-e]$|units_arms/);
  const legs = pick(/legs_[a-d]$|units_legs/);
  const out = [body, head, arms, legs].filter(Boolean) as string[];
  if (def.weaponMesh) {
    const w =
      names.find((n) => n.toLowerCase() === def.weaponMesh!.toLowerCase()) ??
      names.find((n) => n.toLowerCase().includes(def.weaponMesh!.toLowerCase().replace(/^[^_]+_/, "")));
    if (w) out.push(w);
  }
  if (def.role === "tank") {
    const sh = names.find((n) => /shield/i.test(n) && !/container/i.test(n));
    if (sh) out.push(sh);
  }
  if (def.role === "ranger") {
    const q = names.find((n) => /quiver/i.test(n));
    if (q) out.push(q);
  }
  return out.length ? out : names.filter((n) => /body|head|arms|legs/i.test(n)).slice(0, 6);
}

function countBones(root: THREE.Object3D): number {
  let n = 0;
  root.traverse((o) => {
    if ((o as THREE.Bone).isBone) n++;
  });
  return n;
}

function listVisibleMeshes(root: THREE.Object3D): string[] {
  const out: string[] = [];
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && m.visible && o.name) out.push(o.name);
  });
  return out;
}

const atlasCache = new Map<RaceId, THREE.Texture>();
const raceSceneCache = new Map<RaceId, { scene: THREE.Group; loading?: Promise<THREE.Group> }>();

function loadGltf(url: string, loader: GLTFLoader): Promise<THREE.Group> {
  return new Promise((resolve, reject) => {
    loader.load(url, (g) => resolve(g.scene), undefined, (e) => reject(e));
  });
}

async function loadRaceScene(race: RaceId, loader: GLTFLoader): Promise<THREE.Group> {
  const hit = raceSceneCache.get(race);
  if (hit?.scene && !hit.loading) return hit.scene;
  if (hit?.loading) return hit.loading;

  const p = loadGltf(raceGlbUrl(race), loader).then((scene) => {
    raceSceneCache.set(race, { scene });
    return scene;
  });
  raceSceneCache.set(race, { scene: new THREE.Group(), loading: p });
  return p;
}

async function loadRaceAtlas(race: RaceId): Promise<THREE.Texture | null> {
  const cached = atlasCache.get(race);
  if (cached) return cached;

  const url = raceAtlasUrl(race);
  return new Promise((resolve) => {
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin("anonymous");
    loader.load(
      url,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.flipY = true;
        atlasCache.set(race, tex);
        resolve(tex);
      },
      undefined,
      () => resolve(null),
    );
  });
}

function applyAtlasToScene(scene: THREE.Object3D, atlas: THREE.Texture): number {
  let patched = 0;
  scene.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material || !mesh.geometry?.attributes?.uv) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      if (!mat) continue;
      mat.map = atlas;
      mat.color.set(0xffffff);
      if ((mat as THREE.MeshBasicMaterial).isMeshBasicMaterial) {
        mat.toneMapped = false;
      }
      if (mat.metalness !== undefined) mat.metalness = Math.min(mat.metalness, 0.3);
      if (mat.roughness !== undefined) mat.roughness = Math.max(mat.roughness, 0.5);
      mat.needsUpdate = true;
      patched++;
    }
  });
  return patched;
}

async function buildAnimator(
  model: THREE.Object3D,
  def: Grudge6HeroDef,
  debug: Grudge6PrefabDebug,
): Promise<PlayerAnimator | null> {
  const pack = animPackForRole(def.role);
  debug.animPack = pack;

  try {
    const baked = await loadBakedPackForAlly(pack, model);
    const { idle, run, attack } = baked.clips;
    if (idle && (run || baked.clips.walk) && attack) {
      debug.animSource = "baked";
      debug.clipNames = baked.pool.map((c) => c.name);
      return new PlayerAnimator(
        model,
        {
          idle,
          walk: run ?? baked.clips.walk,
          attack,
        },
        baked.pool,
      );
    }
    debug.errors.push("Baked pack incomplete — missing idle/run/attack");
  } catch (err) {
    debug.errors.push(`Baked anim load failed: ${(err as Error).message}`);
  }

  try {
    const clips = buildAuthoredClips(model);
    if (clips.idle || clips.walk) {
      debug.animSource = "authored";
      debug.clipNames = Object.keys(clips);
      return new PlayerAnimator(model, clips);
    }
  } catch (err) {
    debug.errors.push(`Authored fallback failed: ${(err as Error).message}`);
  }

  debug.animSource = "none";
  return null;
}

/**
 * Spawn a Grudge6 hero instance with proper mesh, texture, and animation prefab.
 */
export async function createGrudge6Character(
  def: Grudge6HeroDef,
  loader: GLTFLoader,
  opts: { height?: number } = {},
): Promise<Grudge6Instance> {
  const t0 = performance.now();
  const height = opts.height ?? 1.75;
  const group = new THREE.Group();
  group.name = def.id;

  const debug: Grudge6PrefabDebug = {
    race: def.race,
    glbUrl: raceGlbUrl(def.race),
    atlasUrl: raceAtlasUrl(def.race),
    animPack: animPackForRole(def.role),
    boneCount: 0,
    visibleMeshes: [],
    texturedSlots: 0,
    clipNames: [],
    animSource: "none",
    loadMs: 0,
    errors: [],
  };

  const raceScene = await loadRaceScene(def.race, loader);
  const model = cloneGLTFScene(raceScene);
  model.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
    }
  });

  const allow = def.meshSample.length >= 3 ? def.meshSample : fallbackAllowFromRace(model, def);
  applyMeshAllowList(model, allow);

  const atlas = await loadRaceAtlas(def.race);
  if (atlas) {
    debug.texturedSlots = applyAtlasToScene(model, atlas);
  } else {
    debug.errors.push(`Atlas failed: ${debug.atlasUrl}`);
  }

  fitFeetOrigin(model, height);
  group.add(model);

  debug.boneCount = countBones(model);
  debug.visibleMeshes = listVisibleMeshes(model);

  const animator = await buildAnimator(model, def, debug);
  debug.loadMs = Math.round(performance.now() - t0);

  const dispose = () => {
    animator?.dispose();
    group.traverse((c) => {
      const m = c as THREE.Mesh;
      if (!m.isMesh) return;
      m.geometry?.dispose();
      const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
      for (const mat of mats) mat.dispose();
    });
  };

  return { id: def.id, def, group, animator, debug, dispose };
}

/** Shared loader for party batching. */
export class Grudge6Factory {
  private loader = new GLTFLoader();

  async create(def: Grudge6HeroDef, height = 1.85) {
    return createGrudge6Character(def, this.loader, { height });
  }
}