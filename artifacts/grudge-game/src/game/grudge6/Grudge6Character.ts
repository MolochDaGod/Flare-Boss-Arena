/**
 * Grudge6 / Toon RTS prefab loader — STONE SSOT pipeline:
 * production GLB → SkeletonUtils clone → **unifySkeletons** → force uniform mesh
 * scales → race atlas (flipY=false) → mesh_ids allow-list → Box3 feet ground →
 * art-forward +π/2 → baked Bip001 clips.
 *
 * Without unifySkeletons the kit has ~14 disconnected skins and looks stretched /
 * half T-pose. See grudge-character-correctness + Open grudge/skeleton.ts.
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
import { loadBakedPackForAlly } from "./bakedAnimLoader";
import { Grudge6AllyAnimator } from "./Grudge6AllyAnimator";
import { forceUniformMeshScales, unifySkeletons } from "./skeleton";
import { applyToonRtsMaterials } from "./toonRtsMaterials";

/** Toon RTS FBX art faces +X; controller walks +Z — apply once on group. */
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
  group: THREE.Group;
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

/** Skinned body only — ignore hidden equip for height/feet (grudge6-full-stack). */
function bodyBox(root: THREE.Object3D): THREE.Box3 {
  const box = new THREE.Box3();
  let any = false;
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    const m = o as THREE.SkinnedMesh;
    if (!m.isSkinnedMesh || !m.visible) return;
    if (!any) {
      box.setFromObject(m, true);
      any = true;
    } else box.expandByObject(m);
  });
  if (!any) box.setFromObject(root, true);
  return box;
}

/**
 * Uniform SI height fit from skinned body min.y (feet) — never non-uniform
 * axes (stretch) and never pelvis-as-feet.
 */
function fitFeetOrigin(model: THREE.Object3D, targetHeight: number) {
  model.updateWorldMatrix(true, true);
  // Force parent scale uniform before measuring
  {
    const sx = Math.abs(model.scale.x) || 1;
    const sy = Math.abs(model.scale.y) || 1;
    const sz = Math.abs(model.scale.z) || 1;
    const base = (sx + sy + sz) / 3;
    model.scale.setScalar(base);
  }
  let box = bodyBox(model);
  const size = box.getSize(new THREE.Vector3());
  if (size.y > 0.001) {
    // Decade unit snap first (classic 100×) then residual fit — unclamped decade
    const decade = Math.pow(10, Math.round(Math.log10(targetHeight / size.y)));
    let s = decade;
    model.scale.multiplyScalar(s);
    model.updateWorldMatrix(true, true);
    box = bodyBox(model);
    const size2 = box.getSize(new THREE.Vector3());
    if (size2.y > 0.001) {
      const residual = targetHeight / size2.y;
      // Aesthetic residual only — clamp so we never explode partial allow-lists
      const clamped = THREE.MathUtils.clamp(residual, 0.35, 3.5);
      model.scale.multiplyScalar(clamped);
    }
  }
  model.updateWorldMatrix(true, true);
  box = bodyBox(model);
  const center = box.getCenter(new THREE.Vector3());
  model.position.x -= center.x;
  model.position.z -= center.z;
  model.position.y -= box.min.y;
  model.updateWorldMatrix(true, true);
  // Second pass: feet exact after scale/center
  box = bodyBox(model);
  model.position.y += 0 - box.min.y;
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

/** Reset skinned meshes to bind pose before applying baked clips (prevents T-pose pop). */
export function resetSkeletonBindPose(scene: THREE.Object3D) {
  scene.traverse((node) => {
    const sm = node as THREE.SkinnedMesh;
    if (sm.isSkinnedMesh && sm.skeleton) sm.skeleton.pose();
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

async function buildAnimator(
  model: THREE.Object3D,
  def: Grudge6HeroDef,
  debug: Grudge6PrefabDebug,
): Promise<AllyAnimatorLike | null> {
  const pack = animPackForRole(def.role);
  debug.animPack = pack;

  try {
    const baked = await loadBakedPackForAlly(pack, model);
    const { idle, walk, run, sprint, attack, walkBack, runBack, strafeLeft, strafeRight } = baked.clips;
    if (idle && walk && run && sprint && attack) {
      debug.animSource = "baked";
      debug.idleBindRatio = baked.idleBindRatio;
      debug.clipNames = baked.pool.map((c) => c.name);
      return new Grudge6AllyAnimator(
        model,
        { idle, walk, run, sprint, attack, walkBack, runBack, strafeLeft, strafeRight },
        baked.pool,
      );
    }
    debug.errors.push("Baked pack incomplete — missing idle/walk/run/sprint/attack");
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
 * Applies Toon RTS color sets + author material recipe (metal 0 / gloss 0).
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

  // 1) Uniform mesh scales BEFORE skeleton bind (heads ship 2.41×2.54×2.54).
  //    Changing scale after bind = broken skinning (head-at-feet / stretch).
  const fixedScales = forceUniformMeshScales(model);
  if (fixedScales > 0) {
    debug.errors.push(`normalized ${fixedScales} non-uniform mesh scale(s)`);
  }

  // 2) Unify multi-skin kit onto one Bip001 chain (after scales are final)
  const unified = unifySkeletons(model);
  if (!unified) {
    debug.errors.push("unifySkeletons failed — multi-skin kit may not animate");
  }

  // 3) Mesh allow-list: ALWAYS Warlords T0 portrait for player classId;
  //    roster meshSample only when no class (party NPCs).
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
  if (allow.length < 3 && def.meshSample.length >= 3) {
    allow = [...def.meshSample];
  }
  if (allow.length < 3) {
    allow = fallbackAllowFromRace(model, def);
  }
  // Guarantee body + class weapon (Toon RTS exclusive wardrobe)
  if (allow.length) {
    const allNames = listAllMeshNames(model);
    const hasBody = allow.some((n) => /body/i.test(n));
    if (!hasBody) {
      const b = allNames.find((n) => /(^|_)body(_|$)/i.test(n));
      if (b) allow.push(b);
    }
    const hasWeapon = allow.some((n) =>
      /sword|bow|staff|axe|hammer|spear|dagger|mace|shield|pick/i.test(n),
    );
    if (!hasWeapon && def.role !== "unarmed") {
      const fb = fallbackAllowFromRace(model, def);
      for (const n of fb) {
        if (
          /sword|bow|staff|axe|hammer|spear|dagger|mace|shield|pick/i.test(n) &&
          !allow.includes(n)
        ) {
          allow.push(n);
        }
      }
    }
  }
  applyMeshAllowList(model, allow);

  // 4) Toon RTS color set atlas + author material (metal 0 · gloss 0 · white plate)
  //    Keep embeds when already present; only force rebuild if atlas load succeeds.
  const atlasPack = await loadRaceAtlas(def.race, colorSet);
  if (atlasPack) {
    debug.atlasUrl = atlasPack.url;
    debug.texturedSlots = applyToonRtsMaterials(model, {
      atlas: atlasPack.tex,
      tintHex: atlasPack.tint,
      // Toon ★ play GLBs often ship correct maps — soft rebind, not hard scrub
      forceStandard: colorSet !== "standard",
    });
  } else {
    debug.errors.push(`Atlas failed: ${debug.atlasUrl}`);
  }

  // 5) Uniform height fit + feet ground (skinned body only)
  fitFeetOrigin(model, height);
  group.add(model);
  // Art-forward once on GROUP (Toon RTS art +X → controller walks +Z) — never double-yaw model+group
  group.rotation.y = GRUDGE6_ART_FORWARD_YAW;
  group.userData.artForwardSet = true;
  group.userData.artForwardYaw = GRUDGE6_ART_FORWARD_YAW;
  model.userData.artForwardSet = true;

  debug.boneCount = countBones(model);
  debug.visibleMeshes = listVisibleMeshes(model);
  if (debug.boneCount < 10) {
    debug.errors.push(`Low bone count (${debug.boneCount}) — expect Bip001 skeleton`);
  }

  resetSkeletonBindPose(model);
  const animator = await buildAnimator(model, def, debug);
  // Re-ground feet after first idle sample (position tracks stripped in baked path)
  if (animator) {
    try {
      animator.update(1 / 30);
      model.updateWorldMatrix(true, true);
      const box = bodyBox(model);
      model.position.y += 0 - box.min.y;
    } catch {
      /* non-fatal */
    }
  }
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