/**
 * Canonical Grudge6 character loader — ONE system for Warlords-era units.
 *
 * Strategy (no duplication):
 * 1) Prefer CDN race GLB (toon-rts characters) — already deployed, small.
 * 2) Apply mesh allow-list from the 30-pack roster so looks match the atlas.
 * 3) Optional local atlas `models/grudge6/30characters.glb` for exact clones.
 * 4) Drive Bip001 with authored clips (underscore + space bone names).
 */

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { PORTRAIT_URL, type RaceId } from "../../data/characterMeshes";
import type { Grudge6HeroDef } from "../../data/grudge6Roster";
import { PlayerAnimator, buildAuthoredClips } from "../PlayerAnimator";

const ATLAS_URL = `${import.meta.env.BASE_URL}models/grudge6/30characters.glb`;

export interface Grudge6Instance {
  id: string;
  def: Grudge6HeroDef;
  group: THREE.Group;
  animator: PlayerAnimator | null;
  dispose: () => void;
}

/** Normalize Bip001 bone names so authored tracks bind (spaces vs underscores). */
export function normalizeBipedBoneNames(root: THREE.Object3D) {
  root.traverse((o) => {
    if (!o.name) return;
    // Bip001_L_Thigh → Bip001 L Thigh (PlayerAnimator convention)
    if (/^Bip001[_ ]/.test(o.name) || o.name.startsWith("Bip001")) {
      o.name = o.name.replace(/_/g, " ").replace(/\s+/g, " ").trim();
    }
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

/** Hide everything, then show only meshes whose names match the allow list (case-insensitive). */
export function applyMeshAllowList(root: THREE.Object3D, allow: string[]) {
  const want = new Set(allow.map((n) => n.toLowerCase()));
  // Also allow partial role matches if exact list is short
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
    // Always hide pure helper containers
    if (/container|auxscene|forgescene/i.test(mesh.name)) vis = false;
    mesh.visible = vis;
    mesh.castShadow = vis;
    mesh.receiveShadow = vis;
    if ((mesh as THREE.SkinnedMesh).isSkinnedMesh) mesh.frustumCulled = false;
  });
}

/** Infer allow-list from a race GLB when only weapon + body slots known. */
function fallbackAllowFromRace(root: THREE.Object3D, def: Grudge6HeroDef): string[] {
  const names: string[] = [];
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh && o.name) names.push(o.name);
  });
  const lower = names.map((n) => n.toLowerCase());
  const pick = (re: RegExp, prefer?: string) => {
    if (prefer) {
      const hit = names.find((n) => n.toLowerCase() === prefer.toLowerCase());
      if (hit) return hit;
    }
    return names.find((n) => re.test(n.toLowerCase()));
  };
  const body = pick(/body_[a-e]$|units_body/);
  const head = pick(/head_[a-n]$|units_head/);
  const arms = pick(/arms_[a-e]$|units_arms/);
  const legs = pick(/legs_[a-d]$|units_legs/);
  const out = [body, head, arms, legs].filter(Boolean) as string[];
  if (def.weaponMesh) {
    const w = names.find((n) => n.toLowerCase() === def.weaponMesh!.toLowerCase())
      ?? names.find((n) => n.toLowerCase().includes(def.weaponMesh!.toLowerCase().replace(/^[^_]+_/, "")));
    if (w) out.push(w);
  }
  // Role extras
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

type CacheEntry = { scene: THREE.Group; loading?: Promise<THREE.Group> };
const raceCache = new Map<RaceId, CacheEntry>();
let atlasPromise: Promise<THREE.Group | null> | null = null;

function loadGltf(url: string, loader: GLTFLoader): Promise<THREE.Group> {
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (g) => resolve(g.scene),
      undefined,
      (e) => reject(e),
    );
  });
}

async function loadRaceScene(race: RaceId, loader: GLTFLoader): Promise<THREE.Group> {
  const hit = raceCache.get(race);
  if (hit?.scene) return hit.scene;
  if (hit?.loading) return hit.loading;
  const p = loadGltf(PORTRAIT_URL(race), loader).then((scene) => {
    raceCache.set(race, { scene });
    return scene;
  });
  raceCache.set(race, { scene: new THREE.Group(), loading: p });
  return p;
}

/** Try local 30-pack atlas (dev only if file present). */
async function tryLoadAtlas(loader: GLTFLoader): Promise<THREE.Group | null> {
  if (atlasPromise) return atlasPromise;
  atlasPromise = loadGltf(ATLAS_URL, loader)
    .then((s) => s)
    .catch(() => null);
  return atlasPromise;
}

/**
 * Spawn a Grudge6 hero instance.
 */
export async function createGrudge6Character(
  def: Grudge6HeroDef,
  loader: GLTFLoader,
  opts: { height?: number } = {},
): Promise<Grudge6Instance> {
  const height = opts.height ?? 1.85;
  const group = new THREE.Group();
  group.name = def.id;

  // Prefer CDN race wardrobe (reliable online). Atlas optional for exact topology.
  const raceScene = await loadRaceScene(def.race, loader);
  const model = raceScene.clone(true);
  normalizeBipedBoneNames(model);
  const allow =
    def.meshSample.length >= 3 ? def.meshSample : fallbackAllowFromRace(model, def);
  applyMeshAllowList(model, allow);
  fitFeetOrigin(model, height);
  group.add(model);

  // Animator from authored biped clips
  let animator: PlayerAnimator | null = null;
  try {
    const clips = buildAuthoredClips(model);
    animator = new PlayerAnimator(model, clips);
  } catch {
    animator = null;
  }

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

  return { id: def.id, def, group, animator, dispose };
}

/** Shared loader for party batching. */
export class Grudge6Factory {
  private loader = new GLTFLoader();

  async create(def: Grudge6HeroDef, height = 1.85) {
    return createGrudge6Character(def, this.loader, { height });
  }
}
