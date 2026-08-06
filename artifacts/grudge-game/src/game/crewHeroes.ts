/**
 * Racalvin's pirate crew — Meshy biped playables.
 *
 *  - scourge  (Crimson Warbrute / Scourge Faithbearer) — mid-range tank;
 *    Cryoshard Warpick + chain on right hand (throw / reel-back).
 *  - johnwayne (Gadgeteer Pathfinder / Cap'n John Wayne) — ranged engineer.
 *
 * Layout mirrors models/racalvin: base.glb + anim/*.glb (+ scourge/anchor.glb).
 */
import * as THREE from "three";
import type { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { findHandBone } from "./assets";
import { loadGLTFCached } from "./assets";

export const SCOURGE_ID = "scourge_faithbearer";
export const JOHN_WAYNE_ID = "capt_john_wayne";

export type CrewId = typeof SCOURGE_ID | typeof JOHN_WAYNE_ID;

export const CREW_DIR: Record<CrewId, string> = {
  [SCOURGE_ID]: "models/crew/scourge",
  [JOHN_WAYNE_ID]: "models/crew/johnwayne",
};

export const SCOURGE_ANIMS = [
  "idle",
  "walk",
  "run",
  "attack",
  "combo",
  "slam",
  "slash",
  "skill1",
  "skill2",
  "skill3",
  "dodge",
  "hit",
] as const;

export const JOHN_ANIMS = [
  "idle",
  "walk",
  "run",
  "attack",
  "combo",
  "combo2",
  "slash",
  "special",
  "cast",
  "hit",
  "jump",
  "dodge",
  "charge",
] as const;

const CREW_ANIMS: Record<CrewId, readonly string[]> = {
  [SCOURGE_ID]: SCOURGE_ANIMS,
  [JOHN_WAYNE_ID]: JOHN_ANIMS,
};

/**
 * Deployment layout (One Piece / Racalvin pattern):
 *   models/crew/{id}/base.glb      — skinned mesh only (optimized GLB)
 *   models/crew/{id}/anim/*.glb    — skeleton-only clips (~30–90 KB each)
 *   models/crew/{id}/anchor.glb    — warpick mesh (scourge)
 * File type: model/gltf-binary (glTF 2.0). SI: 1 unit = 1 m; fit ~1.85–2.05 m.
 */
function baseUrl(crew: CrewId) {
  return `${import.meta.env.BASE_URL}${CREW_DIR[crew]}/base.glb`;
}
function animUrl(crew: CrewId, name: string) {
  return `${import.meta.env.BASE_URL}${CREW_DIR[crew]}/anim/${name}.glb`;
}
function anchorUrl() {
  return `${import.meta.env.BASE_URL}${CREW_DIR[SCOURGE_ID]}/anchor.glb`;
}

/** Viewport / game SI height (matches skins.ts default ~2.1, human 1.8). */
export const CREW_VIEWPORT_HEIGHT = 2.0;
export const CREW_GAME_HEIGHT = 1.9;

export function isCrewFighterId(id: string | null | undefined): id is CrewId {
  return id === SCOURGE_ID || id === JOHN_WAYNE_ID;
}

/** Skinned-body Box3 when possible (ignore weapon/chain helpers). */
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

function fitWrapper(model: THREE.Object3D, targetHeight: number): THREE.Group {
  const wrapper = new THREE.Group();
  wrapper.name = "crewRoot";
  model.updateWorldMatrix(true, true);
  let box = bodyBox(model);
  const size = box.getSize(new THREE.Vector3());
  // Uniform SI fit — same math as One Piece skins / Racalvin
  if (size.y > 0.001) {
    const s = targetHeight / size.y;
    model.scale.setScalar(s);
  }
  model.updateWorldMatrix(true, true);
  box = bodyBox(model);
  const center = box.getCenter(new THREE.Vector3());
  model.position.x -= center.x;
  model.position.z -= center.z;
  model.position.y -= box.min.y;
  // Second pass feet lock
  model.updateWorldMatrix(true, true);
  box = bodyBox(model);
  model.position.y += 0 - box.min.y;
  wrapper.add(model);
  return wrapper;
}

/** True for 1-frame baselayer / bind embeds (useless as locomotion). */
export function isStaticBindClip(clip: THREE.AnimationClip): boolean {
  if (/baselayer|bindpose|bind_pose|t[-_]?pose|restpose/i.test(clip.name)) return true;
  if (clip.duration > 0 && clip.duration < 0.06) return true;
  const t0 = clip.tracks[0]?.times;
  return !!t0 && t0.length <= 1;
}

const ROOT_POS_BONE = /^(hips|hip|pelvis|root|bip001[_\s-]?pelvis|mixamorig:?hips)$/i;

/**
 * Strip motion that lifts feet off ground.
 * - locomotion (idle/walk/run): drop all position/scale — feet-locked cycles
 * - oneshot (attack/skill/dodge/jump): keep Hips/root position for RootMotion
 *   extraction; drop limb positions and all scales.
 */
export function stripPositionTracks(
  clip: THREE.AnimationClip,
  mode: "locomotion" | "oneshot" = "locomotion",
): THREE.AnimationClip {
  const byBone = new Map<string, THREE.KeyframeTrack>();
  const rootPos: THREE.KeyframeTrack[] = [];

  for (const t of clip.tracks) {
    if (t.name.endsWith(".scale")) continue;
    if (t.name.endsWith(".position")) {
      if (mode === "oneshot") {
        const bone = t.name.replace(/\.position$/i, "").split(/[/:]/).pop() ?? "";
        if (ROOT_POS_BONE.test(bone)) rootPos.push(t);
      }
      continue;
    }
    if (!t.name.endsWith(".quaternion") && !t.name.endsWith(".rotation")) continue;
    const bone = t.name.replace(/\.(quaternion|rotation)$/i, "");
    const isQuat = t.name.endsWith(".quaternion");
    const prev = byBone.get(bone);
    if (!prev || isQuat) byBone.set(bone, t);
  }
  const cleaned = [...byBone.values(), ...rootPos];
  let duration = 0;
  for (const t of cleaned) {
    const last = t.times[t.times.length - 1] ?? 0;
    if (last > duration) duration = last;
  }
  return new THREE.AnimationClip(clip.name, duration || clip.duration, cleaned);
}

/**
 * Rebind skeleton-only clip tracks onto a live skinned root by bone name.
 * Handles path prefixes (`Armature/Hips.quaternion` → `Hips.quaternion`).
 */
export function rebindClipToSkeleton(
  clip: THREE.AnimationClip,
  root: THREE.Object3D,
  mode: "locomotion" | "oneshot" = "locomotion",
): THREE.AnimationClip {
  const bones = new Set<string>();
  root.traverse((o) => {
    if (o.name) bones.add(o.name);
  });
  const tracks: THREE.KeyframeTrack[] = [];
  for (const src of clip.tracks) {
    const m = /(?:^|\/|:)([^./]+)(\.(quaternion|rotation|position|scale))$/i.exec(src.name);
    if (!m) continue;
    const bone = m[1]!;
    const prop = m[2]!;
    if (!bones.has(bone)) continue;
    if (prop === ".scale") continue;
    if (prop === ".position") {
      if (mode !== "oneshot" || !ROOT_POS_BONE.test(bone)) continue;
    }
    const t = src.clone();
    t.name = `${bone}${prop === ".rotation" ? ".quaternion" : prop}`;
    tracks.push(t);
  }
  let duration = 0;
  for (const t of tracks) {
    const last = t.times[t.times.length - 1] ?? 0;
    if (last > duration) duration = last;
  }
  return new THREE.AnimationClip(clip.name, duration || clip.duration, tracks);
}

/** Prep a loaded skeleton-only pack clip for a live crew mesh. */
export function prepareCrewClip(
  clip: THREE.AnimationClip,
  name: string,
  root?: THREE.Object3D,
): THREE.AnimationClip {
  let c = clip.clone();
  c.name = name;
  const mode: "locomotion" | "oneshot" = /^(idle|walk|run)$/i.test(name)
    ? "locomotion"
    : "oneshot";
  c = stripPositionTracks(c, mode);
  if (root) c = rebindClipToSkeleton(c, root, mode);
  return c;
}

/**
 * Pick locomotion / combat role clips for PlayerAnimator / HeroAnimator.
 * Shared map so /game, camp, and previews resolve the same vocabulary.
 */
export function pickCrewRoleClips(
  clips: THREE.AnimationClip[],
): Partial<
  Record<"idle" | "walk" | "run" | "attack" | "dodge" | "jump" | "hit" | "cast", THREE.AnimationClip>
> {
  const by = new Map(clips.map((c) => [c.name.toLowerCase(), c]));
  const pick = (...names: string[]) => {
    for (const n of names) {
      const c = by.get(n.toLowerCase());
      if (c && !isStaticBindClip(c)) return c;
    }
    // substring fallback (e.g. idle_a)
    for (const n of names) {
      for (const [k, c] of by) {
        if (k.includes(n.toLowerCase()) && !isStaticBindClip(c)) return c;
      }
    }
    return undefined;
  };
  return {
    // Standing: walk first — Meshy "idle" packs for these crews are get-up recoveries
    idle: pick("walk", "run", "idle", "attack"),
    walk: pick("walk", "run", "idle"),
    run: pick("run", "walk"),
    attack: pick("attack", "combo", "slash", "skill1", "combo2"),
    dodge: pick("dodge", "hit"),
    jump: pick("jump", "dodge"),
    hit: pick("hit", "dodge"),
    cast: pick("cast", "special", "skill2", "charge"),
  };
}

function prepMeshes(root: THREE.Object3D) {
  root.traverse((c) => {
    const m = c as THREE.Mesh;
    if (!m.isMesh) return;
    m.castShadow = true;
    m.receiveShadow = true;
    m.frustumCulled = false;
    if ((m as THREE.SkinnedMesh).isSkinnedMesh) m.frustumCulled = false;
    // Meshy asset materials — SRGB albedo, less plastic, stable skinning
    const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
    for (const mat of mats) {
      const sm = mat as THREE.MeshStandardMaterial;
      if (!sm?.isMeshStandardMaterial && !(sm as THREE.Material)?.type?.includes("Standard")) {
        if (sm?.map) {
          sm.map.colorSpace = THREE.SRGBColorSpace;
          sm.map.needsUpdate = true;
        }
        continue;
      }
      if (sm.map) {
        sm.map.colorSpace = THREE.SRGBColorSpace;
        sm.map.anisotropy = 4;
        sm.map.needsUpdate = true;
      }
      if (typeof sm.metalness === "number") sm.metalness = Math.min(sm.metalness, 0.35);
      if (typeof sm.roughness === "number") sm.roughness = Math.max(sm.roughness ?? 0.5, 0.5);
      sm.vertexColors = false;
      sm.needsUpdate = true;
    }
  });
}

/**
 * Map fighter skill anim ids → crew pack clip names (priority order).
 * Used by GameEngine so Scourge/John Wayne play skill1/slam/charge etc.
 */
export function crewSkillAnimCandidates(
  skillAnim: string[] | undefined,
  skillId?: string,
): string[] {
  const out: string[] = [];
  if (skillAnim?.length) out.push(...skillAnim);
  const id = (skillId ?? "").toLowerCase();
  if (/anchor|throw|skill1/.test(id)) out.push("skill1", "slash", "attack");
  if (/yank|skill2|chain/.test(id)) out.push("skill2", "combo");
  if (/slam|reef|ground/.test(id)) out.push("slam", "skill3");
  if (/snipe|field|attack/.test(id)) out.push("attack", "cast");
  if (/mine|gadget|cast/.test(id)) out.push("cast", "combo");
  if (/turret|burst|combo2/.test(id)) out.push("combo2", "slash");
  if (/charge|path/.test(id)) out.push("charge", "combo");
  if (/special|barrage|calibrate|shout/.test(id)) out.push("special", "cast");
  out.push("attack", "combo", "slash", "idle");
  // unique preserve order
  const seen = new Set<string>();
  return out.filter((n) => {
    const k = n.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/**
 * Load skeleton-only anim packs (post convert-crew-assets).
 * Prefer progressive: pass `priority` for viewport (idle/walk first).
 */
export async function loadCrewClips(
  loader: GLTFLoader,
  crew: CrewId,
  opts?: {
    names?: readonly string[];
    stripRootMotion?: boolean;
    /** Live mesh root — rebind track bone names for reliable mixer binding. */
    bindRoot?: THREE.Object3D;
  },
): Promise<THREE.AnimationClip[]> {
  const names = opts?.names ?? CREW_ANIMS[crew];
  const strip = opts?.stripRootMotion !== false;
  const clips: THREE.AnimationClip[] = [];
  await Promise.all(
    names.map(async (name) => {
      try {
        const gltf = await loadGLTFCached(loader, animUrl(crew, name));
        const clip = gltf.animations[0];
        if (!clip) return;
        let c = strip
          ? prepareCrewClip(clip, name, opts?.bindRoot)
          : (() => {
              const x = clip.clone();
              x.name = name;
              return x;
            })();
        if (isStaticBindClip(c)) return;
        clips.push(c);
      } catch {
        /* soft-miss */
      }
    }),
  );
  // Prefer stable order: idle → walk → run → combat
  const order = new Map(names.map((n, i) => [n.toLowerCase(), i]));
  clips.sort(
    (a, b) => (order.get(a.name.toLowerCase()) ?? 99) - (order.get(b.name.toLowerCase()) ?? 99),
  );
  return clips;
}

/** Essential locomotion for /select + /units viewport (fast first paint). */
export const CREW_VIEWPORT_ANIMS = ["walk", "run", "attack", "idle"] as const;

/**
 * Portrait default / standing loop.
 * Meshy idle packs for Scourge + Cap'n John are get-up / floor recoveries —
 * prefer walk → run → attack so previews never open on get-up.
 */
/**
 * Prefer attack (weapon motion) then run — idle packs are get-ups.
 * "attack" is the select portrait default users preferred for crew.
 */
export const CREW_PREVIEW_STAND_CANDIDATES = [
  "attack",
  "run",
  "walk",
  "slash",
  "combo",
  "idle",
] as const;

/** Portrait showcase — attack loop first (weapon flair), then loco. */
export const CREW_SHOWCASE_CYCLE = [
  { name: "attack", seconds: 2.8 },
  { name: "run", seconds: 2.0 },
  { name: "walk", seconds: 2.4 },
  { name: "attack", seconds: 2.2 },
] as const;

/**
 * Pick a standing loop for /select + roster thumbs.
 * Never prefer a clip that is only a get-up-named idle when walk/attack exist.
 */
export function pickCrewPreviewStandClip(
  clips: THREE.AnimationClip[],
): THREE.AnimationClip | undefined {
  const by = new Map(clips.map((c) => [c.name.toLowerCase(), c]));
  for (const n of CREW_PREVIEW_STAND_CANDIDATES) {
    const c = by.get(n);
    if (c && !isStaticBindClip(c)) return c;
  }
  return clips.find((c) => !isStaticBindClip(c)) ?? clips[0];
}

/**
 * Meshy "idle" packs for Scourge / Cap'n John are floor get-ups.
 * Promote walk (or run/attack) to the name `idle` so HeroAnimator / previews
 * stand correctly; keep the raw get-up as `getup` for optional one-shots.
 */
export function promoteCrewStandIdle(clips: THREE.AnimationClip[]): THREE.AnimationClip[] {
  if (!clips.length) return clips;
  const by = new Map(clips.map((c) => [c.name.toLowerCase(), c]));
  // Prefer attack (weapon) then run/walk as standing "idle" for game + preview
  const stand =
    by.get("attack") ?? by.get("run") ?? by.get("walk") ?? by.get("slash");
  const badIdle = by.get("idle");
  if (!stand) return clips;
  // Already standing-named and no better stand source
  if (!badIdle && stand.name.toLowerCase() === "idle") return clips;

  const out: THREE.AnimationClip[] = [];
  if (badIdle) {
    const getup = badIdle.clone();
    getup.name = "getup";
    out.push(getup);
  }
  const idleAlias = stand.clone();
  idleAlias.name = "idle";
  out.push(idleAlias);
  for (const c of clips) {
    const k = c.name.toLowerCase();
    if (k === "idle") continue; // replaced
    out.push(c);
  }
  return out;
}

/**
 * Chain + warpick mount for Scourge.
 * rest: short chain, pick by hand. throw: extend chain mid-range (~6–9 m intent).
 */
export class ScourgeChainWeapon {
  readonly mount = new THREE.Group();
  readonly pickRoot = new THREE.Group();
  private chain: THREE.Group;
  private links: THREE.Mesh[] = [];
  private mode: "rest" | "throw" = "rest";
  private throwT = 0;
  /** Minecraft Idol axe tumble — throw / spin / catch while idle at rest. */
  private tumble: import("./weaponTumbleIdle").WeaponTumbleIdle | null = null;

  constructor() {
    this.mount.name = "ScourgeChainMount";
    this.chain = new THREE.Group();
    this.chain.name = "AnchorChain";
    const linkMat = new THREE.MeshStandardMaterial({
      color: 0x4a5560,
      metalness: 0.85,
      roughness: 0.35,
    });
    const n = 10;
    for (let i = 0; i < n; i++) {
      const link = new THREE.Mesh(
        new THREE.TorusGeometry(0.045, 0.014, 6, 10),
        linkMat,
      );
      link.rotation.x = Math.PI / 2;
      link.castShadow = true;
      this.links.push(link);
      this.chain.add(link);
    }
    this.mount.add(this.chain);
    this.pickRoot.name = "Warpick";
    this.mount.add(this.pickRoot);
    this.layoutRest();
    // Lazy-bind tumble after first rest layout (hand grip)
    void import("./weaponTumbleIdle").then(({ WeaponTumbleIdle }) => {
      this.tumble = new WeaponTumbleIdle();
      this.tumble.bind(this.pickRoot, { posScale: 0.38, cycleSec: 3.6 });
    });
  }

  attachPick(mesh: THREE.Object3D) {
    while (this.pickRoot.children.length) this.pickRoot.remove(this.pickRoot.children[0]!);
    prepMeshes(mesh);
    // Scale warpick to ~1.1 m
    mesh.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(mesh);
    const size = box.getSize(new THREE.Vector3());
    const maxD = Math.max(size.x, size.y, size.z, 1e-4);
    mesh.scale.setScalar(1.1 / maxD);
    mesh.updateWorldMatrix(true, true);
    const b2 = new THREE.Box3().setFromObject(mesh);
    const c = b2.getCenter(new THREE.Vector3());
    mesh.position.set(-c.x, -b2.min.y - 0.05, -c.z);
    // Point pick along chain axis
    mesh.rotation.set(0, 0, -Math.PI / 2);
    this.pickRoot.add(mesh);
    // Re-bind tumble rest after warpick is mounted (constructor bind was empty)
    this.tumble?.bind(this.pickRoot, { posScale: 0.42, cycleSec: 3.2 });
  }

  private layoutRest() {
    const spacing = 0.09;
    this.links.forEach((link, i) => {
      link.position.set(0, -0.05 - i * spacing, 0.08);
      link.rotation.z = (i % 2) * 0.4;
      link.visible = i < 4;
    });
    this.pickRoot.position.set(0.05, -0.12, 0.12);
    this.pickRoot.rotation.set(0.2, 0.4, -0.3);
    this.pickRoot.scale.setScalar(1);
  }

  private layoutThrow(t: number) {
    // t 0→1 extend, then holds mid-range
    const extend = 0.35 + t * 2.8;
    const spacing = extend / Math.max(1, this.links.length - 1);
    this.links.forEach((link, i) => {
      link.visible = true;
      link.position.set(0, -0.04, 0.1 + i * spacing);
      link.rotation.z = (i % 2) * 0.5;
    });
    this.pickRoot.position.set(0.02, -0.06, 0.12 + extend);
    this.pickRoot.rotation.set(Math.PI / 2, 0, 0);
  }

  setMode(mode: "rest" | "throw") {
    this.mode = mode;
    if (mode === "rest") {
      this.throwT = 0;
      this.layoutRest();
      // Re-capture rest grip after layout so tumble offsets from correct pose
      this.tumble?.bind(this.pickRoot, { posScale: 0.38, cycleSec: 3.6 });
    } else {
      this.throwT = 0;
      this.tumble?.snapRest();
    }
  }

  getMode() {
    return this.mode;
  }

  /**
   * Drive throw extension OR idle tumble (Minecraft Idol teach).
   * @param idleAllow true when player is standing (not attacking / sprinting)
   */
  update(dt: number, idleAllow = true) {
    if (this.mode === "throw") {
      this.throwT = Math.min(1, this.throwT + dt * 2.4);
      this.layoutThrow(this.throwT);
      return;
    }
    // Rest: teach weapon throw-spin-catch on warpick
    this.tumble?.update(dt, idleAllow);
  }
}

const UD_CHAIN = "scourgeChain";

export function getScourgeChain(root: THREE.Object3D): ScourgeChainWeapon | null {
  return (root.userData[UD_CHAIN] as ScourgeChainWeapon | undefined) ?? null;
}

export function syncScourgeWeaponForClip(root: THREE.Object3D, clipName: string) {
  const chain = getScourgeChain(root);
  if (!chain) return;
  const n = clipName.toLowerCase();
  if (/skill1|skill2|throw|slam|slash|combo|attack|skill3/.test(n)) {
    chain.setMode("throw");
  } else {
    chain.setMode("rest");
  }
}

export function loadCrewBase(
  loader: GLTFLoader,
  crew: CrewId,
  targetHeight: number,
  onReady: (wrapper: THREE.Group, root: THREE.Object3D, baseClips: THREE.AnimationClip[]) => void,
  onMiss: () => void,
) {
  loader.load(
    baseUrl(crew),
    async (gltf) => {
      const model = gltf.scene;
      prepMeshes(model);
      const wrapper = fitWrapper(model, targetHeight);
      const baseClips = gltf.animations.map((c, i) => {
        const x = c.clone();
        if (!x.name || x.name === "Animation") x.name = i === 0 ? "idle" : `clip_${i}`;
        return x;
      });

      if (crew === SCOURGE_ID) {
        const hand = findHandBone(model, true);
        const chain = new ScourgeChainWeapon();
        try {
          const pickGltf = await loadGLTFCached(loader, anchorUrl());
          const pick = pickGltf.scene.clone(true);
          chain.attachPick(pick);
        } catch {
          // Procedural fallback pick
          const geo = new THREE.ConeGeometry(0.12, 0.9, 8);
          const mat = new THREE.MeshStandardMaterial({
            color: 0x88ccee,
            metalness: 0.7,
            roughness: 0.25,
            emissive: 0x113344,
            emissiveIntensity: 0.35,
          });
          chain.attachPick(new THREE.Mesh(geo, mat));
        }
        if (hand) {
          hand.add(chain.mount);
          // Mixamo RightHand — grip in palm, pick along finger axis (positional accuracy)
          chain.mount.position.set(0.04, 0.09, 0.03);
          chain.mount.rotation.set(-0.35, 0.15, Math.PI * 0.5);
          // Counter non-uniform Meshy hand scale
          hand.updateWorldMatrix(true, false);
          const hs = new THREE.Vector3();
          hand.getWorldScale(hs);
          const hu = (Math.abs(hs.x) + Math.abs(hs.y) + Math.abs(hs.z)) / 3;
          if (hu > 1e-4 && hu < 50) chain.mount.scale.setScalar(1 / hu);
        } else {
          model.add(chain.mount);
          chain.mount.position.set(0.35, 1.1, 0.25);
        }
        wrapper.userData[UD_CHAIN] = chain;
        model.userData[UD_CHAIN] = chain;
      }

      onReady(wrapper, model, baseClips);
    },
    undefined,
    () => onMiss(),
  );
}

/**
 * Full load: base mesh + skeleton-only library.
 * Viewport mode loads essentials first so select/units show mesh ASAP.
 * Library clips always win over 1-frame baselayer embeds.
 */
export function loadCrewHero(
  loader: GLTFLoader,
  crew: CrewId,
  targetHeight: number,
  onReady: (
    wrapper: THREE.Group,
    root: THREE.Object3D,
    clips: THREE.AnimationClip[],
  ) => void,
  onMiss: () => void,
  opts?: {
    viewportFirst?: boolean;
    /** Called when the full skill pack merges after progressive essentials. */
    onClipsUpdated?: (clips: THREE.AnimationClip[]) => void;
  },
) {
  const h =
    targetHeight > 0
      ? Math.min(2.15, Math.max(1.75, targetHeight))
      : CREW_GAME_HEIGHT;

  loadCrewBase(
    loader,
    crew,
    h,
    (wrapper, root, baseClips) => {
      const strippedBase = baseClips
        .map((c, i) => {
          const name =
            !c.name || c.name === "Animation" || /baselayer|clip0/i.test(c.name)
              ? `base_${i}`
              : c.name;
          return prepareCrewClip(c, name, root);
        })
        .filter((c) => !isStaticBindClip(c));

      const merge = (lib: THREE.AnimationClip[]) => {
        // Library first so real idle/walk beat any residual base clips
        const byName = new Map<string, THREE.AnimationClip>();
        for (const c of [...lib, ...strippedBase]) {
          const key = c.name.toLowerCase();
          if (!byName.has(key)) byName.set(key, c);
        }
        // Guarantee an idle: fall back to walk/run if idle pack missing
        if (!byName.has("idle")) {
          const fb = byName.get("walk") ?? byName.get("run") ?? lib[0] ?? strippedBase[0];
          if (fb) {
            const alias = fb.clone();
            alias.name = "idle";
            byName.set("idle", alias);
          }
        }
        return [...byName.values()];
      };

      const finish = (lib: THREE.AnimationClip[], notifyUpdate = false) => {
        // walk → idle so previews / HeroAnimator never open on Meshy get-up packs
        const all = promoteCrewStandIdle(merge(lib));
        if (notifyUpdate) opts?.onClipsUpdated?.(all);
        else onReady(wrapper, root, all);
      };

      if (opts?.viewportFirst) {
        // Phase 1: idle/walk/run/attack for portrait (bound to live skeleton)
        loadCrewClips(loader, crew, {
          names: CREW_VIEWPORT_ANIMS,
          bindRoot: root,
        }).then((ess) => {
          finish(ess, false);
          // Phase 2: remaining skills — merge into same character
          const rest = CREW_ANIMS[crew].filter(
            (n) => !(CREW_VIEWPORT_ANIMS as readonly string[]).includes(n),
          );
          void loadCrewClips(loader, crew, { names: rest, bindRoot: root }).then((extra) => {
            finish([...ess, ...extra], true);
          });
        });
      } else {
        loadCrewClips(loader, crew, { bindRoot: root }).then((lib) => finish(lib, false));
      }
    },
    onMiss,
  );
}
