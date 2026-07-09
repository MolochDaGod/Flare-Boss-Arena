import * as THREE from "three";

/**
 * RootMotion — extracts horizontal root-bone translation ("root motion") from
 * whatever clip is currently playing so the character's LOGICAL world position
 * can follow the animation, instead of the mesh sliding away from its wrapper
 * and snapping back when the clip ends.
 *
 * Only active while explicitly armed (one-shot action clips — dodge / jump /
 * lunging attacks / skills). Looping locomotion stays input-driven, so an
 * in-place walk/run is unaffected and a clip with no root track contributes
 * nothing.
 *
 * Each frame after `mixer.update()` the caller calls `sample()`, which banks the
 * frame's local root delta (mapped into world space via the bone's parent
 * world matrix, so model scale + facing are honoured) and then cancels the
 * bone's horizontal offset so the mesh stays centred on its wrapper. The scene
 * then `consume()`s the accumulated world displacement and folds it into the
 * player position before its own clamp / collision pass.
 *
 * Bone preference matters: One Piece bounty-rush skins put locomotion on
 * `world_joint_*` / `Body_Pelvis_*`, NOT on the container `_rootJoint`. Sampling
 * the wrong bone is what made skills "zoom forward then snap back".
 */

const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scl = new THREE.Vector3();
const _d = new THREE.Vector3();

/** Name patterns for bones that typically carry authored travel, most-specific first. */
const PREFERRED_ROOT_NAMES: RegExp[] = [
  /^world_joint/i,
  /^hips$/i,
  /^hip$/i,
  /^body_pelvis/i,
  /^pelvis$/i,
  /^bip001[_\s-]?pelvis/i,
  /^mixamorig:?hips$/i,
  /^root$/i, // KayKit `root` (not `_rootJoint`)
];

/** Container-only joints that almost never hold travel tracks. */
const SKIP_ROOT_NAMES = /^(_root|rootjoint|armature|scene|master)$/i;

export class RootMotion {
  private bone: THREE.Object3D | null;
  private bindX = 0;
  private bindZ = 0;
  private prev: THREE.Vector3 | null = null;
  private active = false;
  private pendingEnd = false;
  private accum = new THREE.Vector3();

  constructor(root: THREE.Object3D) {
    this.bone = findRootMotionBone(root);
    if (this.bone) {
      this.bindX = this.bone.position.x;
      this.bindZ = this.bone.position.z;
    }
  }

  /** True when a locomotion root bone was resolved. */
  get hasBone(): boolean {
    return !!this.bone;
  }

  /** Arm extraction for a freshly-started one-shot clip. */
  begin() {
    if (!this.bone) return;
    this.active = true;
    this.pendingEnd = false;
    this.prev = null; // first sample establishes the baseline (no delta)
    // Keep constructor bind pose — do NOT re-sample from a mid-clip offset.
    this.bone.position.x = this.bindX;
    this.bone.position.z = this.bindZ;
  }

  /**
   * Request disarm when the one-shot ends. The mixer fires `finished` *during*
   * `mixer.update()`, before the frame's `sample()` runs, so we only flag the
   * end here and let the next `sample()` bank the terminal frame's delta before
   * actually disarming — otherwise the final step of the clip would be dropped.
   */
  end() {
    this.pendingEnd = true;
  }

  /** Whether extraction is currently armed (one-shot in flight). */
  get isActive(): boolean {
    return this.active;
  }

  /**
   * Sample after `mixer.update()`: bank this frame's horizontal delta, then
   * cancel the bone's horizontal drift so the mesh stays centred on its wrapper.
   * Vertical (jump arc) is intentionally left intact. `delta` makes the
   * discontinuity guard frame-rate independent so low-FPS frames (with larger
   * legitimate per-frame deltas) aren't wrongly discarded.
   */
  sample(delta: number) {
    const b = this.bone;
    if (!this.active || !b) return;
    const cur = b.position;
    if (this.prev) {
      const dx = cur.x - this.prev.x;
      const dz = cur.z - this.prev.z;
      // Guard against clip-start / cross-fade discontinuities producing a jump.
      // Scale the per-frame limit by how long this frame was vs a 60 FPS step.
      // Skill lunges can move ~1–2 m over a second; allow a generous per-frame cap.
      const lim = 1.4 * Math.max(1, delta * 60);
      if (Math.abs(dx) < lim && Math.abs(dz) < lim) {
        const parent = b.parent;
        if (parent) {
          parent.updateWorldMatrix(true, false);
          parent.matrixWorld.decompose(_pos, _quat, _scl);
          _d.set(dx, 0, dz).multiply(_scl).applyQuaternion(_quat);
          this.accum.x += _d.x;
          this.accum.z += _d.z;
        } else {
          this.accum.x += dx;
          this.accum.z += dz;
        }
      }
      this.prev.set(cur.x, cur.y, cur.z);
    } else {
      this.prev = new THREE.Vector3(cur.x, cur.y, cur.z);
    }
    b.position.x = this.bindX;
    b.position.z = this.bindZ;
    // Disarm only after the terminal frame's delta has been banked above.
    if (this.pendingEnd) {
      this.active = false;
      this.pendingEnd = false;
      this.prev = null;
    }
  }

  /**
   * Hand the accumulated world-space horizontal displacement to the caller and
   * reset. Returns false when there is nothing meaningful to apply.
   */
  consume(out: THREE.Vector3): boolean {
    if (this.accum.lengthSq() < 1e-8) {
      out.set(0, 0, 0);
      return false;
    }
    out.copy(this.accum);
    this.accum.set(0, 0, 0);
    return true;
  }
}

/**
 * Resolve the bone that carries root motion.
 *
 * Prefer named locomotion roots (world_joint / hips / pelvis) over the skeleton
 * container (`_rootJoint`), which rarely has travel tracks on bounty-rush skins.
 * Falls back to the top-most non-container bone of the first skinned mesh.
 * Uses `.isSkinnedMesh` / `.isBone` flags (NOT `instanceof`) for multi-Three safety.
 */
function findRootMotionBone(root: THREE.Object3D): THREE.Object3D | null {
  const bones: THREE.Object3D[] = [];
  root.traverse((o) => {
    if ((o as unknown as { isBone?: boolean }).isBone) bones.push(o);
  });
  if (bones.length === 0) return null;

  for (const re of PREFERRED_ROOT_NAMES) {
    const hit = bones.find((b) => re.test(b.name));
    if (hit) return hit;
  }

  // Top-most bone of the first skinned skeleton, skipping pure containers.
  let skinned: THREE.SkinnedMesh | null = null;
  root.traverse((o) => {
    if (!skinned && (o as unknown as { isSkinnedMesh?: boolean }).isSkinnedMesh) {
      skinned = o as unknown as THREE.SkinnedMesh;
    }
  });
  const sk = skinned as THREE.SkinnedMesh | null;
  if (sk && sk.skeleton?.bones?.length) {
    const skBones = sk.skeleton.bones;
    const set = new Set<THREE.Object3D>(skBones);
    for (const b of skBones) {
      if ((!b.parent || !set.has(b.parent)) && !SKIP_ROOT_NAMES.test(b.name)) return b;
    }
    for (const b of skBones) {
      if (!SKIP_ROOT_NAMES.test(b.name)) return b;
    }
    return skBones[0];
  }

  return bones.find((b) => !SKIP_ROOT_NAMES.test(b.name)) ?? bones[0];
}
