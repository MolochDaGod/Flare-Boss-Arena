/**
 * Character frame SSOT for Toon RTS / grudge6 on Flare.
 *
 * Ports Open fleet contracts — does NOT invent a second physics/IK stack:
 *   · hierarchy   — grudge6-full-stack Object3D contract
 *   · Box3 feet   — characterDeploy / fitCharacterHeight
 *   · capsule     — @workspace/grudge-physics PLAYER_CAPSULE
 *   · feet plant  — min feet IK = sampleHeight (full dual-foot CCD optional)
 *   · ids         — grudge-runtime UUID prefixes
 *
 * Hierarchy:
 *   root (group)  — world feet XZ + groundY; yaw = facing; locomotion owns this
 *    └── model    — kit scale + local feet @ 0; Bip001 + wardrobe
 *
 * Root between feet: world XZ = midpoint of L/R foot bones (fallback pelvis/body).
 * Collider centre = feetY + (radius + halfHeight). Never pelvis-as-feet.
 */

import * as THREE from "three";

// ── SI / capsule (Open grudge-physics constants.ts) ─────────────────────────

export const PLAYER_HEIGHT_M = 1.8;

/** KCC capsule metres — total ≈ 2*r + 2*halfH ≈ 1.8 m human. */
export const PLAYER_CAPSULE = {
  radius: 0.35,
  halfHeight: 0.55,
  controllerOffset: 0.08,
} as const;

export function capsuleCenterOffset(
  radius = PLAYER_CAPSULE.radius,
  halfHeight = PLAYER_CAPSULE.halfHeight,
): number {
  return radius + halfHeight;
}

// ── UUID / fleet ids (Open grudge-runtime ids.ts) ───────────────────────────

let idCounter = 0;

export const ID_PREFIX = {
  character: "char_",
  hero: "HERO-",
  entity: "ent_",
  instance: "inst_",
  root: "root_",
  collider: "col_",
} as const;

export type IdKind = keyof typeof ID_PREFIX;

export function newUuid(prefix = ""): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  const base =
    c && typeof c.randomUUID === "function"
      ? c.randomUUID()
      : `${Date.now().toString(36)}-${(idCounter++).toString(36)}-${Math.random()
          .toString(36)
          .slice(2, 10)}`;
  return prefix ? `${prefix}${base}` : base;
}

export function newGrudgeId(kind: IdKind): string {
  return newUuid(ID_PREFIX[kind]);
}

// ── Math / Box3 ────────────────────────────────────────────────────────────

/** Force skeleton + world matrices current before any Box3 measure. */
export function prepareSkinnedMeasure(root: THREE.Object3D): void {
  root.updateWorldMatrix(true, true);
  root.traverse((o) => {
    const sk = o as THREE.SkinnedMesh;
    if (sk.isSkinnedMesh && sk.skeleton) sk.skeleton.update();
  });
  root.updateWorldMatrix(true, true);
}

/** Visible skinned body AABB only — gear must not lift feet. */
export function bodyBox(root: THREE.Object3D): THREE.Box3 {
  prepareSkinnedMeasure(root);
  const box = new THREE.Box3();
  let any = false;
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

export function findBone(root: THREE.Object3D, names: string[]): THREE.Bone | null {
  const want = names.map((n) => n.toLowerCase());
  let hit: THREE.Bone | null = null;
  root.traverse((o) => {
    if (hit) return;
    const b = o as THREE.Bone;
    if (!b.isBone || !b.name) return;
    if (want.includes(b.name.toLowerCase())) hit = b;
  });
  return hit;
}

export function findPelvisBone(root: THREE.Object3D): THREE.Bone | null {
  return (
    findBone(root, ["Bip001 Pelvis", "Bip001_Pelvis", "pelvis", "mixamorigHips", "Hips"]) ??
    (() => {
      let best: THREE.Bone | null = null;
      let score = -1;
      root.traverse((o) => {
        const b = o as THREE.Bone;
        if (!b.isBone || !b.name) return;
        const n = b.name.toLowerCase().replace(/[^a-z0-9]/g, "");
        let s = 0;
        if (n === "bip001pelvis" || n === "pelvis") s = 100;
        else if (n.endsWith("pelvis")) s = 90;
        else if (n.includes("hips")) s = 70;
        if (s > score) {
          score = s;
          best = b;
        }
      });
      return best;
    })()
  );
}

export function findFootBones(root: THREE.Object3D): {
  left: THREE.Bone | null;
  right: THREE.Bone | null;
} {
  return {
    left: findBone(root, ["Bip001 L Foot", "Bip001_L_Foot", "mixamorigLeftFoot", "LeftFoot"]),
    right: findBone(root, ["Bip001 R Foot", "Bip001_R_Foot", "mixamorigRightFoot", "RightFoot"]),
  };
}

/** Fit model height (SI human), feet local y=0, XZ center on pelvis. */
export function fitModelHeightAndFeet(
  model: THREE.Object3D,
  targetHeight = PLAYER_HEIGHT_M,
): { heightM: number; scale: number } {
  prepareSkinnedMeasure(model);
  let box = bodyBox(model);
  const size = box.getSize(new THREE.Vector3());
  let scale = 1;
  if (size.y > 1e-4) {
    scale = targetHeight / size.y;
    model.scale.multiplyScalar(scale);
    model.updateWorldMatrix(true, true);
    box = bodyBox(model);
  }
  // XZ on pelvis (not full prop bbox)
  const pelvis = findPelvisBone(model);
  if (pelvis) {
    const wp = new THREE.Vector3();
    pelvis.getWorldPosition(wp);
    const origin = new THREE.Vector3();
    model.getWorldPosition(origin);
    model.position.x -= wp.x - origin.x;
    model.position.z -= wp.z - origin.z;
  } else {
    const c = box.getCenter(new THREE.Vector3());
    model.position.x -= c.x;
    model.position.z -= c.z;
  }
  model.updateWorldMatrix(true, true);
  box = bodyBox(model);
  model.position.y -= box.min.y;
  model.updateWorldMatrix(true, true);
  const h = bodyBox(model).getSize(new THREE.Vector3()).y;
  return { heightM: h, scale };
}

export function groundFeetLocal(model: THREE.Object3D, groundY = 0): number {
  prepareSkinnedMeasure(model);
  const box = bodyBox(model);
  if (!Number.isFinite(box.min.y)) return 0;
  const dy = groundY - box.min.y;
  if (Math.abs(dy) > 1e-5) {
    model.position.y += dy;
    model.updateWorldMatrix(true, true);
  }
  return dy;
}

// ── Root between feet ──────────────────────────────────────────────────────

const _l = new THREE.Vector3();
const _r = new THREE.Vector3();
const _mid = new THREE.Vector3();

/**
 * World XZ midpoint of L/R feet (fallback: pelvis, then body box center).
 * Y is not taken from bones — caller supplies groundY (sampleHeight).
 */
export function sampleRootBetweenFeet(
  model: THREE.Object3D,
  out = new THREE.Vector3(),
): THREE.Vector3 {
  prepareSkinnedMeasure(model);
  const { left, right } = findFootBones(model);
  if (left && right) {
    left.getWorldPosition(_l);
    right.getWorldPosition(_r);
    out.set((_l.x + _r.x) * 0.5, 0, (_l.z + _r.z) * 0.5);
    return out;
  }
  const pelvis = findPelvisBone(model);
  if (pelvis) {
    pelvis.getWorldPosition(out);
    out.y = 0;
    return out;
  }
  const box = bodyBox(model);
  box.getCenter(out);
  out.y = 0;
  return out;
}

/**
 * Align root so its world XZ is between feet and Y = groundY.
 * Model stays child of root with local feet @ 0.
 */
export function placeRootBetweenFeet(
  root: THREE.Object3D,
  model: THREE.Object3D,
  groundY = 0,
  worldXZ?: { x: number; z: number },
): void {
  if (!model.parent) root.add(model);
  groundFeetLocal(model, 0);
  prepareSkinnedMeasure(model);
  sampleRootBetweenFeet(model, _mid);
  // Shift model so foot midpoint sits on root local origin XZ
  const rootWp = new THREE.Vector3();
  root.getWorldPosition(rootWp);
  // model world foot mid → pull into root local 0,0
  const parent = model.parent!;
  parent.updateWorldMatrix(true, true);
  const localMid = parent.worldToLocal(_mid.clone());
  model.position.x -= localMid.x;
  model.position.z -= localMid.z;
  groundFeetLocal(model, 0);

  if (worldXZ) {
    root.position.x = worldXZ.x;
    root.position.z = worldXZ.z;
  }
  root.position.y = groundY;
  root.updateWorldMatrix(true, true);
}

// ── Capsule collider (math only — host wires Rapier/BVH) ───────────────────

export interface CapsuleColliderSpec {
  id: string;
  /** World centre of capsule */
  center: THREE.Vector3;
  radius: number;
  halfHeight: number;
  /** Feet world Y this capsule was aligned to */
  feetY: number;
}

/** Capsule centre from root feet position (root.position = feet). */
export function capsuleFromRoot(
  root: THREE.Object3D,
  opts?: Partial<typeof PLAYER_CAPSULE> & { id?: string },
): CapsuleColliderSpec {
  const radius = opts?.radius ?? PLAYER_CAPSULE.radius;
  const halfHeight = opts?.halfHeight ?? PLAYER_CAPSULE.halfHeight;
  const feetY = root.position.y;
  const center = new THREE.Vector3(
    root.position.x,
    feetY + capsuleCenterOffset(radius, halfHeight),
    root.position.z,
  );
  return {
    id: opts?.id ?? newGrudgeId("collider"),
    center,
    radius,
    halfHeight,
    feetY,
  };
}

// ── Feet plant (minimum IK — not full CCD) ─────────────────────────────────

export type HeightSample = (x: number, z: number) => number;

/**
 * Plant root on heightfield. Same SSOT as grass/harvest: one sampleHeight.
 * Call each frame after loco moves XZ. Full dual-foot bone IK is optional polish.
 */
export function plantRootOnHeightfield(
  root: THREE.Object3D,
  sampleHeight: HeightSample,
): number {
  const y = sampleHeight(root.position.x, root.position.z);
  root.position.y = y;
  return y;
}

/**
 * Soft foot plant: nudge model local Y so skinned soles match root feet plane.
 * Does not solve dual-foot bone CCD — that stays optional.
 */
export function rePlantModelSoles(model: THREE.Object3D, localGroundY = 0): number {
  return groundFeetLocal(model, localGroundY);
}

// ── Frame attach (one call after kit load) ─────────────────────────────────

export interface CharacterFrame {
  /** World locomotion root — feet on ground, yaw facing */
  root: THREE.Group;
  /** Kit under root */
  model: THREE.Object3D;
  /** Fleet runtime id for this body */
  uuid: string;
  /** Capsule id (stable for multiplayer / debug) */
  colliderId: string;
  heightM: number;
  pelvis: THREE.Bone | null;
  feet: { left: THREE.Bone | null; right: THREE.Bone | null };
  /** Latest capsule math (not a live Rapier body) */
  capsule: CapsuleColliderSpec;
  /** Recompute capsule after root moves */
  refreshCapsule: () => CapsuleColliderSpec;
  /** plantRootOnHeightfield + rePlantModelSoles */
  plant: (sampleHeight: HeightSample) => void;
  /** placeRootBetweenFeet after anim sample */
  alignRootToFeet: (groundY?: number) => void;
  /** Optional debug helpers (caller adds to scene) */
  createDebugHelpers: () => THREE.Group;
  disposeDebug: () => void;
}

/**
 * Attach frame bookkeeping to an existing root+model (after clone/equip/fit).
 */
export function attachCharacterFrame(
  root: THREE.Group,
  model: THREE.Object3D,
  opts?: {
    uuid?: string;
    targetHeightM?: number;
    worldXZ?: { x: number; z: number };
    groundY?: number;
    skipFit?: boolean;
  },
): CharacterFrame {
  const uuid = opts?.uuid ?? newGrudgeId("entity");
  root.name = root.name || `root_${uuid.slice(0, 12)}`;
  root.userData.grudgeUuid = uuid;
  root.userData.role = "character-root";

  if (!model.parent) root.add(model);
  model.userData.role = "character-kit";

  let heightM = opts?.targetHeightM ?? PLAYER_HEIGHT_M;
  if (!opts?.skipFit) {
    const fit = fitModelHeightAndFeet(model, heightM);
    heightM = fit.heightM;
  } else {
    groundFeetLocal(model, 0);
  }

  placeRootBetweenFeet(root, model, opts?.groundY ?? 0, opts?.worldXZ);

  const colliderId = newGrudgeId("collider");
  let capsule = capsuleFromRoot(root, { id: colliderId });
  root.userData.colliderId = colliderId;
  root.userData.capsule = capsule;

  let debugGroup: THREE.Group | null = null;

  const frame: CharacterFrame = {
    root,
    model,
    uuid,
    colliderId,
    heightM,
    pelvis: findPelvisBone(model),
    feet: findFootBones(model),
    capsule,
    refreshCapsule() {
      capsule = capsuleFromRoot(root, { id: colliderId });
      root.userData.capsule = capsule;
      frame.capsule = capsule;
      return capsule;
    },
    plant(sampleHeight) {
      plantRootOnHeightfield(root, sampleHeight);
      rePlantModelSoles(model, 0);
      frame.refreshCapsule();
    },
    alignRootToFeet(groundY = root.position.y) {
      placeRootBetweenFeet(root, model, groundY, {
        x: root.position.x,
        z: root.position.z,
      });
      frame.refreshCapsule();
    },
    createDebugHelpers() {
      if (debugGroup) return debugGroup;
      debugGroup = new THREE.Group();
      debugGroup.name = `debug_${uuid.slice(0, 8)}`;
      const box = bodyBox(model);
      const helper = new THREE.Box3Helper(box, 0x44ff88);
      debugGroup.add(helper);
      // Capsule stand-in (wire cylinder)
      const cap = frame.refreshCapsule();
      const geo = new THREE.CapsuleGeometry(cap.radius, cap.halfHeight * 2, 4, 8);
      const mat = new THREE.MeshBasicMaterial({
        color: 0x66aaff,
        wireframe: true,
        depthTest: true,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(cap.center).sub(root.position);
      // local to root
      mesh.position.set(0, capsuleCenterOffset(), 0);
      debugGroup.add(mesh);
      // Root marker between feet
      const mark = new THREE.AxesHelper(0.35);
      debugGroup.add(mark);
      root.add(debugGroup);
      return debugGroup;
    },
    disposeDebug() {
      if (!debugGroup) return;
      root.remove(debugGroup);
      debugGroup.traverse((c) => {
        const m = c as THREE.Mesh;
        if (m.isMesh) {
          m.geometry?.dispose();
          (m.material as THREE.Material)?.dispose?.();
        }
      });
      debugGroup = null;
    },
  };

  root.userData.characterFrame = frame;
  return frame;
}

/** Type guard for userData.characterFrame */
export function getCharacterFrame(root: THREE.Object3D): CharacterFrame | null {
  return (root.userData.characterFrame as CharacterFrame) ?? null;
}
