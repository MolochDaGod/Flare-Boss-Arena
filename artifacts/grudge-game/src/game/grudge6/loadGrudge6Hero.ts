/**
 * Load a playable Annihilate / Warlords g6_{race}_{class} hero for select preview
 * and GameEngine player — CDN Toon-RTS race GLB, wardrobe, correct height, baked anims.
 */

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkinnedHierarchy } from "three/addons/utils/SkeletonUtils.js";
import type { RaceId } from "../../data/characterMeshes";
import { resolveVisibleMeshes } from "../../data/characterMeshes";
import {
  parseAnnihilateHeroId,
  type AnnihilateClass,
  type AnnihilateRace,
} from "../../data/annihilateHeroes";
import { getWarlordsLoadout } from "../../data/warlordsEquipment";
import {
  animPackForRole,
  raceAtlasUrl,
  raceGlbUrl,
  targetHeightForRace,
  type BakedAnimPack,
} from "../../data/grudge6Assets";
import type { AllyRole } from "../../data/grudge6Roster";
import { PlayerAnimator, buildAuthoredClips } from "../PlayerAnimator";
import { loadBakedPackForAlly } from "./bakedAnimLoader";
import { resetSkeletonBindPose } from "./Grudge6Character";

const CLASS_TO_ROLE: Record<AnnihilateClass, AllyRole> = {
  warrior: "tank",
  mage: "healer",
  ranger: "ranger",
  worge: "bruiser",
};

const CLASS_TO_PACK: Record<AnnihilateClass, BakedAnimPack> = {
  warrior: "greatsword_samurai",
  mage: "magic",
  ranger: "rifle",
  worge: "unarmed",
};

const raceSceneCache = new Map<RaceId, Promise<THREE.Group>>();
const atlasCache = new Map<RaceId, Promise<THREE.Texture | null>>();

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

async function loadRaceScene(race: RaceId, loader: GLTFLoader): Promise<THREE.Group> {
  let p = raceSceneCache.get(race);
  if (!p) {
    p = new Promise((resolve, reject) => {
      loader.load(
        raceGlbUrl(race),
        (gltf) => resolve(gltf.scene as THREE.Group),
        undefined,
        reject,
      );
    });
    raceSceneCache.set(race, p);
  }
  return p;
}

async function loadAtlas(race: RaceId): Promise<THREE.Texture | null> {
  let p = atlasCache.get(race);
  if (!p) {
    p = new Promise((resolve) => {
      const loader = new THREE.TextureLoader();
      loader.load(
        raceAtlasUrl(race),
        (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.flipY = false;
          resolve(tex);
        },
        undefined,
        () => resolve(null),
      );
    });
    atlasCache.set(race, p);
  }
  return p;
}

function applyAtlas(scene: THREE.Object3D, atlas: THREE.Texture) {
  scene.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      if (!mat) continue;
      const m = mat as THREE.MeshStandardMaterial;
      if (m.map !== undefined) m.map = atlas;
      if (m.color) m.color.set(0xffffff);
      if (typeof m.metalness === "number") m.metalness = Math.min(m.metalness, 0.3);
      if (typeof m.roughness === "number") m.roughness = Math.max(m.roughness, 0.5);
      m.needsUpdate = true;
    }
  });
}

function fitFeetOrigin(model: THREE.Object3D, targetHeight: number) {
  model.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(model);
  const size = new THREE.Vector3();
  box.getSize(size);
  // Prefer visible-mesh height for multi-mesh wardrobe
  if (size.y > 0.001) model.scale.setScalar(targetHeight / size.y);
  model.updateWorldMatrix(true, true);
  const box2 = new THREE.Box3().setFromObject(model);
  const center = new THREE.Vector3();
  box2.getCenter(center);
  model.position.x -= center.x;
  model.position.z -= center.z;
  model.position.y -= box2.min.y;
}

export interface Grudge6HeroLoadResult {
  wrapper: THREE.Group;
  model: THREE.Object3D;
  animator: PlayerAnimator;
  race: AnnihilateRace;
  classId: AnnihilateClass;
  height: number;
  clipNames: string[];
  animSource: "baked" | "authored";
}

/**
 * Load g6 hero by fighter/skin id (`g6_human_warrior`).
 */
export async function loadGrudge6PlayableHero(
  heroId: string,
  loader: GLTFLoader,
  opts?: { height?: number },
): Promise<Grudge6HeroLoadResult | null> {
  const parsed = parseAnnihilateHeroId(heroId);
  if (!parsed) return null;
  const { race, classId } = parsed;
  const raceId = race as RaceId;
  const gear = getWarlordsLoadout(race, classId);
  const height = opts?.height ?? targetHeightForRace(raceId);

  const raceScene = await loadRaceScene(raceId, loader);
  const model = cloneGLTFScene(raceScene);
  model.name = heroId;

  const names: string[] = [];
  model.traverse((c) => {
    if ((c as THREE.Mesh).isMesh && c.name) names.push(c.name);
  });
  const visible = resolveVisibleMeshes(
    names,
    raceId,
    {
      mainCategory: gear.portrait.mainCategory,
      hasOffhand: gear.portrait.hasOffhand,
      offCategory: gear.portrait.offCategory,
      offhandIsShield: gear.portrait.offhandIsShield,
      hasShoulder: gear.portrait.hasShoulder,
    },
    heroId,
  );
  model.traverse((c) => {
    const m = c as THREE.Mesh;
    if (!m.isMesh) return;
    m.visible = visible.has(m.name);
    m.castShadow = true;
    m.receiveShadow = true;
    if ((m as THREE.SkinnedMesh).isSkinnedMesh) m.frustumCulled = false;
  });

  const atlas = await loadAtlas(raceId);
  if (atlas) applyAtlas(model, atlas);

  fitFeetOrigin(model, height);
  resetSkeletonBindPose(model);

  const wrapper = new THREE.Group();
  wrapper.name = `player_${heroId}`;
  wrapper.add(model);

  let animator: PlayerAnimator;
  let clipNames: string[] = [];
  let animSource: "baked" | "authored" = "authored";

  const pack = CLASS_TO_PACK[classId] ?? animPackForRole(CLASS_TO_ROLE[classId]);
  try {
    const baked = await loadBakedPackForAlly(pack, model);
    const { idle, walk, run, attack } = baked.clips;
    if (idle || walk || attack) {
      animSource = "baked";
      clipNames = baked.pool.map((c) => c.name);
      animator = new PlayerAnimator(
        model,
        {
          idle: idle ?? walk ?? attack,
          walk: walk ?? run ?? idle,
          attack: attack ?? idle,
        },
        baked.pool,
      );
    } else {
      throw new Error("incomplete baked pack");
    }
  } catch {
    const clips = buildAuthoredClips(model);
    clipNames = Object.keys(clips);
    animator = new PlayerAnimator(model, clips);
    animSource = "authored";
  }

  return { wrapper, model, animator, race, classId, height, clipNames, animSource };
}

export function isGrudge6HeroSkinId(id: string | null | undefined): boolean {
  return !!id && parseAnnihilateHeroId(id) != null;
}
