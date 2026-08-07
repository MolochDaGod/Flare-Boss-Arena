/**
 * Toon RTS race GLB — plain Three.js load path (no invented pipeline):
 *
 *   GLTFLoader → SkeletonUtils.clone → unifySkeletons (multi-skin kit only)
 *   → mesh visible allow-list → Box3 fit 1.8 m + feet → AnimationMixer
 *
 * Production GLB already has embeds, Bip001, hand containers. Do not force
 * atlas scrub, art-forward yaw, mesh-scale “fixes”, or foreign absolute clips.
 */

import * as THREE from "three";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import { createGltfLoader } from "@/game/threeSetup";
import { loadGLTFCached } from "@/game/assets";
import type { RaceId } from "../../data/characterMeshes";
import { resolveVisibleMeshes } from "../../data/characterMeshes";
import type { Grudge6HeroDef } from "../../data/grudge6Roster";
import {
  animPackForRole,
  raceAtlasUrl,
  raceGlbUrl,
  raceGlbUrlCandidates,
  roleForClass,
  targetHeightForRace,
  type ToonColorSet,
} from "../../data/grudge6Assets";
import {
  defaultColorSetForHero,
  raceColorAtlasUrl,
} from "../../data/toonRtsColorSets";
import { getWarlordsLoadout } from "../../data/warlordsEquipment";
import type { AnnihilateClass } from "../../data/annihilateHeroes";
import { PlayerAnimator, buildAuthoredClips } from "../PlayerAnimator";
import { unifySkeletons } from "./skeleton";
import { applyToonRtsMaterials } from "./toonRtsMaterials";
import {
  attachCharacterFrame,
  type CharacterFrame,
  PLAYER_HEIGHT_M,
} from "./characterFrame";
// Kit anim: AnimationMixer + bind-local procedural clips (no foreign absolute bake).

/** Optional yaw if a consumer needs +Z walk after load. Not applied by default on play GLB. */
export const GRUDGE6_ART_FORWARD_YAW = Math.PI / 2;

/** Shared animator API for party allies (baked gait or authored fallback). */
export interface AllyAnimatorLike {
  setMoving(moving: boolean): void;
  setGaitFromSpeed?(speed01: number, sprint?: boolean): void;
  setLocoDirection?(dir: "forward" | "back" | "left" | "right"): void;
  triggerAttack(): void;
  triggerNamed(candidates: string[]): boolean;
  update(delta: number): void;
  dispose(): void;
  getGait?(): number;
}

export interface Grudge6PrefabDebug {
  race: RaceId;
  glbUrl: string;
  atlasUrl: string;
  /** Toon RTS Materials/Colors set (blue/red/green…). */
  colorSet: ToonColorSet;
  animPack: string;
  targetHeight: number;
  boneCount: number;
  visibleMeshes: string[];
  texturedSlots: number;
  clipNames: string[];
  animSource: "baked" | "authored" | "none";
  idleBindRatio: number | null;
  loadMs: number;
  errors: string[];
}

export interface Grudge6Instance {
  id: string;
  def: Grudge6HeroDef;
  /** World root — feet on ground; owns collider + uuid (characterFrame). */
  group: THREE.Group;
  /** Kit under group */
  model?: THREE.Object3D;
  /** Root / capsule / feet / uuid SSOT */
  frame: CharacterFrame | null;
  animator: AllyAnimatorLike | null;
  debug: Grudge6PrefabDebug;
  dispose: () => void;
}

/**
 * Exclusive wardrobe: hide every mesh, then show only allow-list names.
 * Exact name match only (case-insensitive) — endsWith over-matching caused
 * extra body/weapon islands and “scrambled armoury” looks on /select.
 */
export function applyMeshAllowList(root: THREE.Object3D, allow: string[]) {
  const want = new Set(
    allow.map((n) => n.trim().toLowerCase()).filter(Boolean),
  );
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    if (/container|auxscene|forgescene/i.test(mesh.name)) {
      mesh.visible = false;
      return;
    }
    const n = mesh.name.toLowerCase();
    let vis = want.has(n);
    if (!vis && want.size > 0) {
      // Prefix-tolerant: kit "WK_Units_Body_A" vs allow "Units_Body_A"
      for (const a of want) {
        if (n === a || (a.length >= 6 && (n.endsWith("_" + a) || n.endsWith(a)))) {
          vis = true;
          break;
        }
      }
    }
    mesh.visible = vis;
    mesh.castShadow = vis;
    mesh.receiveShadow = vis;
    if ((mesh as THREE.SkinnedMesh).isSkinnedMesh) mesh.frustumCulled = false;
  });
}

function listAllMeshNames(root: THREE.Object3D): string[] {
  const names: string[] = [];
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh && o.name) names.push(o.name);
  });
  return names;
}

/** Build mesh allow-list from Warlords T0 loadout (body/arms/legs/weapon) — not empty. */
function meshAllowForPlayer(
  model: THREE.Object3D,
  race: RaceId,
  classId: string,
  displayName: string,
): string[] {
  const all = listAllMeshNames(model);
  try {
    const gear = getWarlordsLoadout(race as never, classId as AnnihilateClass);
    const vis = resolveVisibleMeshes(all, race, gear.portrait, displayName);
    if (vis.size >= 3) return [...vis];
  } catch {
    /* fall through */
  }
  return [];
}

/**
 * SI fit via bone structural box (ObjectStore loadRaceKit parity).
 * PURGED setFromObject(SkinnedMesh) — unskinned modular geo under-measures.
 */
function measureBoneBox(model: THREE.Object3D): THREE.Box3 | null {
  model.updateWorldMatrix(true, true);
  model.traverse((o) => {
    const sm = o as THREE.SkinnedMesh;
    if (sm.isSkinnedMesh && sm.skeleton) sm.skeleton.update();
  });
  const names = [
    "Bip001 Head",
    "Bip001 Pelvis",
    "Bip001 L Foot",
    "Bip001 R Foot",
    "Bip001 L Hand",
    "Bip001 R Hand",
  ];
  const box = new THREE.Box3();
  const p = new THREE.Vector3();
  let n = 0;
  for (const name of names) {
    const bone = model.getObjectByName(name);
    if (!bone) continue;
    bone.getWorldPosition(p);
    if (n === 0) {
      box.min.copy(p);
      box.max.copy(p);
    } else box.expandByPoint(p);
    n++;
  }
  if (n < 2) return null;
  const h = Math.max(box.max.y - box.min.y, 1e-4);
  const pad = h * 0.1;
  box.min.y -= pad * 0.55;
  box.max.y += pad * 0.45;
  return box;
}

function fitFeetOrigin(model: THREE.Object3D, targetHeight: number) {
  model.position.set(0, 0, 0);
  model.rotation.set(0, 0, 0);
  model.scale.setScalar(1);
  model.updateWorldMatrix(true, true);
  let box = measureBoneBox(model) || new THREE.Box3().setFromObject(model);
  let h = Math.max(box.max.y - box.min.y, 1e-4);
  if (h > 40) {
    model.scale.setScalar(0.01);
    model.updateWorldMatrix(true, true);
    box = measureBoneBox(model) || new THREE.Box3().setFromObject(model);
    h = Math.max(box.max.y - box.min.y, 1e-4);
  }
  if (h > 0.001) model.scale.multiplyScalar(targetHeight / h);
  model.updateWorldMatrix(true, true);
  box = measureBoneBox(model) || new THREE.Box3().setFromObject(model);
  const center = new THREE.Vector3();
  box.getCenter(center);
  model.position.x -= center.x;
  model.position.z -= center.z;
  model.position.y -= box.min.y;
}

/**
 * Bind pose — widest skeleton once only.
 * PURGED pose() on every mesh (1-joint head skins → head-at-feet).
 */
export function resetSkeletonBindPose(scene: THREE.Object3D) {
  let widest: THREE.Skeleton | null = null;
  scene.traverse((node) => {
    const sm = node as THREE.SkinnedMesh;
    if (sm.isSkinnedMesh && sm.skeleton) {
      if (!widest || sm.skeleton.bones.length > widest.bones.length) widest = sm.skeleton;
    }
  });
  if (widest) {
    widest.pose();
    widest.update();
  }
  scene.traverse((node) => {
    const sm = node as THREE.SkinnedMesh;
    if (sm.isSkinnedMesh && sm.skeleton) sm.skeleton.update();
  });
  scene.updateMatrixWorld(true);
}

function cloneGLTFScene(source: THREE.Object3D): THREE.Group {
  const clone = SkeletonUtils.clone(source) as THREE.Group;
  clone.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    mesh.material = Array.isArray(mesh.material)
      ? mesh.material.map((m) => m.clone())
      : mesh.material.clone();
  });
  return clone;
}

/**
 * Role-aware wardrobe when Warlords resolve fails — matches Polygon Blacksmith
 * author mesh names (sword_A / Bow / staff_A, not weapon_*).
 */
function fallbackAllowFromRace(root: THREE.Object3D, def: Grudge6HeroDef): string[] {
  const names: string[] = [];
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh && o.name) names.push(o.name);
  });
  const pick = (re: RegExp) => names.find((n) => re.test(n.toLowerCase()));
  const body = pick(/(^|_)body(_[a-z])?$/i) ?? pick(/body/);
  const head = pick(/(^|_)head(_[a-z])?$/i) ?? pick(/head/);
  const arms = pick(/(^|_)arms(_[a-z])?$/i) ?? pick(/arms/);
  const legs = pick(/(^|_)legs(_[a-z])?$/i) ?? pick(/legs/);
  const out = [body, head, arms, legs].filter(Boolean) as string[];

  const addWeapon = (re: RegExp) => {
    const w = names.find((n) => re.test(n.toLowerCase()) && !/container/i.test(n));
    if (w && !out.includes(w)) out.push(w);
  };

  if (def.weaponMesh) {
    const w =
      names.find((n) => n.toLowerCase() === def.weaponMesh!.toLowerCase()) ??
      names.find((n) =>
        n.toLowerCase().includes(def.weaponMesh!.toLowerCase().replace(/^[^_]+_/, "")),
      );
    if (w) out.push(w);
  } else {
    // Class / role → author weapon (Toon RTS meta names)
    switch (def.role) {
      case "ranger":
        addWeapon(/\bbow\b|_bow($|_)|crossbow/);
        break;
      case "healer":
        addWeapon(/staff/);
        break;
      case "bruiser":
        addWeapon(/\baxe\b|_axe|hammer|mace|club/);
        break;
      case "tank":
      case "fighter":
      case "skirmisher":
      default:
        addWeapon(/sword|blade/);
        break;
    }
  }
  if (def.role === "tank" || def.role === "fighter") {
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

/** Cache by race + color set (color atlases are full recolored textures). */
const atlasCache = new Map<string, THREE.Texture>();
const raceSceneCache = new Map<RaceId, { scene: THREE.Group; loading?: Promise<THREE.Group> }>();

async function loadRaceScene(race: RaceId, loader: ReturnType<typeof createGltfLoader>): Promise<THREE.Group> {
  const hit = raceSceneCache.get(race);
  if (hit?.scene && !hit.loading) return hit.scene;
  if (hit?.loading) return hit.loading;

  const p = (async () => {
    const urls = raceGlbUrlCandidates(race);
    let lastErr: unknown;
    for (const url of urls) {
      try {
        const gltf = await loadGLTFCached(loader, url);
        const scene = gltf.scene as THREE.Group;
        scene.userData.loadedUrl = url;
        scene.userData.playMesh = /toon-rts-characters/.test(url) ? "toon-rts" : "legacy-races";
        raceSceneCache.set(race, { scene });
        return scene;
      } catch (e) {
        lastErr = e;
        if (import.meta.env.DEV) {
          console.warn(`[grudge6] race GLB fail ${url}`, e);
        }
      }
    }
    throw lastErr ?? new Error(`No Toon RTS race GLB for ${race}`);
  })();
  raceSceneCache.set(race, { scene: new THREE.Group(), loading: p });
  return p;
}

async function loadRaceAtlas(
  race: RaceId,
  colorSet: ToonColorSet = "standard",
): Promise<{ tex: THREE.Texture; tint: number; url: string } | null> {
  const cacheKey = `${race}:${colorSet}`;
  const cached = atlasCache.get(cacheKey);
  if (cached) {
    const meta = raceColorAtlasUrl(race, colorSet);
    return { tex: cached, tint: meta.tint, url: raceAtlasUrl(race, colorSet) };
  }

  const url = raceAtlasUrl(race, colorSet);
  const meta = raceColorAtlasUrl(race, colorSet);
  // If color set has no local atlas, use CDN standard + soft tint
  const finalUrl = url || raceAtlasUrl(race, "standard");
  const tint = meta.source === "local_color" ? 0xffffff : meta.tint;

  return new Promise((resolve) => {
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin("anonymous");
    loader.load(
      finalUrl,
      (tex) => {
        atlasCache.set(cacheKey, tex);
        resolve({ tex, tint, url: finalUrl });
      },
      undefined,
      () => {
        // Fallback: standard CDN if color atlas 404 (one hop only)
        if (colorSet !== "standard") {
          const stdUrl = raceAtlasUrl(race, "standard");
          loader.load(
            stdUrl,
            (tex) => {
              atlasCache.set(`${race}:standard`, tex);
              resolve({
                tex,
                tint: raceColorAtlasUrl(race, colorSet).tint,
                url: stdUrl,
              });
            },
            undefined,
            () => resolve(null),
          );
        } else resolve(null);
      },
    );
  });
}

/**
 * Mixer on the kit root — Three.js standard.
 * Toon ★ race GLB has no embedded clips; use light Bip001 procedural idle/walk
 * on the live bind pose (no foreign absolute bake quats).
 */
async function buildAnimator(
  model: THREE.Object3D,
  def: Grudge6HeroDef,
  debug: Grudge6PrefabDebug,
): Promise<AllyAnimatorLike | null> {
  debug.animPack = animPackForRole(def.role);
  try {
    const clips = buildAuthoredClips(model);
    if (clips.idle || clips.walk) {
      debug.animSource = "authored";
      debug.clipNames = Object.keys(clips);
      // PlayerAnimator = AnimationMixer(model) + clipAction — standard Three.js
      return new PlayerAnimator(model, clips);
    }
  } catch (err) {
    debug.errors.push(`Animator failed: ${(err as Error).message}`);
  }
  debug.animSource = "none";
  return null;
}

/**
 * Spawn Toon RTS hero — simple Three.js:
 * load → clone → unify multi-skin → equip meshes → Box3 feet → mixer.
 */
export async function createGrudge6Character(
  def: Grudge6HeroDef,
  loader: ReturnType<typeof createGltfLoader>,
  opts: { height?: number; colorSet?: ToonColorSet } = {},
): Promise<Grudge6Instance> {
  const t0 = performance.now();
  const height = opts.height ?? targetHeightForRace(def.race);
  const colorSet =
    opts.colorSet ??
    defaultColorSetForHero({ race: def.race, role: def.role, faction: def.faction });
  const group = new THREE.Group();
  group.name = def.id;

  const debug: Grudge6PrefabDebug = {
    race: def.race,
    glbUrl: raceGlbUrl(def.race),
    atlasUrl: raceAtlasUrl(def.race, colorSet),
    colorSet,
    animPack: animPackForRole(def.role),
    targetHeight: height,
    boneCount: 0,
    visibleMeshes: [],
    texturedSlots: 0,
    clipNames: [],
    animSource: "none",
    idleBindRatio: null,
    loadMs: 0,
    errors: [],
  };

  // 1) Load + SkeletonUtils.clone (never scene.clone on SkinnedMesh)
  const raceScene = await loadRaceScene(def.race, loader);
  const model = cloneGLTFScene(raceScene);
  const loadedUrl = String(raceScene.userData.loadedUrl || raceGlbUrl(def.race));
  debug.glbUrl = loadedUrl;
  model.userData.importPipeline = "toon-rts-glb";
  model.userData.loadedUrl = loadedUrl;
  model.userData.playMesh = raceScene.userData.playMesh || "toon-rts";
  model.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
    }
  });

  // 2) Multi-skin modular kit → one bone chain (required for Toon wardrobe GLBs)
  if (!unifySkeletons(model)) {
    debug.errors.push("unifySkeletons failed");
  }

  // 3) Class wardrobe = visibility only (mesh_ids), not body GLB swap
  const classId =
    (def as Grudge6HeroDef & { classId?: string }).classId ??
    (() => {
      const m = /^player_[^_]+_(.+)$/.exec(def.id);
      return m?.[1] ?? "";
    })();
  let allow: string[] = [];
  if (classId) {
    allow = meshAllowForPlayer(model, def.race, classId, def.displayName || def.id);
  }
  if (allow.length < 3 && def.meshSample.length >= 3) allow = [...def.meshSample];
  if (allow.length < 3) allow = fallbackAllowFromRace(model, def);
  if (allow.length) applyMeshAllowList(model, allow);

  // 4) Team color dye only — standard Toon ★ keeps embedded maps
  if (colorSet !== "standard") {
    const atlasPack = await loadRaceAtlas(def.race, colorSet);
    if (atlasPack) {
      debug.atlasUrl = atlasPack.url;
      debug.texturedSlots = applyToonRtsMaterials(model, {
        atlas: atlasPack.tex,
        tintHex: atlasPack.tint,
        forceStandard: true,
      });
    }
  } else {
    debug.atlasUrl = "(embedded)";
    debug.texturedSlots = -1; // embeds left alone
  }

  // 5) Frame: root (feet world) · model fit · root-between-feet · capsule · uuid
  //    SSOT: characterFrame.ts ← Open characterDeploy + grudge-physics capsule
  group.add(model);
  const frame = attachCharacterFrame(group, model, {
    targetHeightM: height || PLAYER_HEIGHT_M,
    groundY: 0,
  });
  debug.boneCount = countBones(model);
  debug.visibleMeshes = listVisibleMeshes(model);
  group.userData.frameSummary = {
    uuid: frame.uuid,
    heightM: frame.heightM,
    capsule: { r: frame.capsule.radius, halfH: frame.capsule.halfHeight },
    feet: !!(frame.feet.left && frame.feet.right),
    pelvis: !!frame.pelvis,
  };

  // 6) AnimationMixer on kit (Three.js standard)
  resetSkeletonBindPose(model);
  const animator = await buildAnimator(model, def, debug);
  if (animator) {
    try {
      animator.update(1 / 30);
      frame.alignRootToFeet(0);
    } catch {
      /* non-fatal */
    }
  }
  debug.loadMs = Math.round(performance.now() - t0);

  const dispose = () => {
    animator?.dispose();
    frame.disposeDebug();
    group.traverse((c) => {
      const m = c as THREE.Mesh;
      if (!m.isMesh) return;
      m.geometry?.dispose();
      const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
      for (const mat of mats) mat.dispose();
    });
  };

  return {
    id: def.id,
    def,
    group,
    model,
    frame,
    animator,
    debug,
    dispose,
  };
}

/** Shared loader for party batching. */
export class Grudge6Factory {
  private loader = createGltfLoader();

  async create(def: Grudge6HeroDef, height?: number, colorSet?: ToonColorSet) {
    return createGrudge6Character(def, this.loader, {
      height: height ?? targetHeightForRace(def.race),
      colorSet,
    });
  }

  /**
   * Player spawn from race + class (camp / dungeon / boss).
   * Uses production race kit + Bip001 baked pack + Toon RTS color set.
   * Never KayKit/Mixamo player path.
   */
  async createPlayer(opts: {
    race: RaceId;
    classId: string;
    displayName?: string;
    height?: number;
    colorSet?: ToonColorSet;
  }) {
    const role = roleForClass(opts.classId);
    const def: Grudge6HeroDef & { classId: string } = {
      id: `player_${opts.race}_${opts.classId}`,
      index: 0,
      rootIndex: 0,
      race: opts.race,
      faction: "player",
      role,
      displayName: opts.displayName ?? `${opts.race} ${opts.classId}`,
      weaponMesh: null,
      // Filled after clone via resolveVisibleMeshes (Warlords T0) in createGrudge6Character
      meshSample: [],
      meshCount: 0,
      brain: "bodyguard",
      classId: opts.classId,
      kit: {
        damage: 18,
        attackRange: role === "ranger" ? 18 : role === "healer" ? 14 : 2.6,
        attackCd: 1.0,
        healAmount: role === "healer" ? 40 : 0,
        healCd: 6,
        skillMult: 1.15,
      },
    };
    return this.create(def, opts.height, opts.colorSet);
  }
}