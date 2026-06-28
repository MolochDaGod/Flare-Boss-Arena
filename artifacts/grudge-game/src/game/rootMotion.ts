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
 */

const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scl = new THREE.Vector3();
const _d = new THREE.Vector3();

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

  /** Arm extraction for a freshly-started one-shot clip. */
  begin() {
    if (!this.bone) return;
    this.active = true;
    this.pendingEnd = false;
    this.prev = null; // first sample establishes the baseline (no delta)
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
      const lim = 0.75 * Math.max(1, delta * 60);
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
 * Resolve the bone that carries root motion: the top-most bone of the first
 * skinned mesh's skeleton (the one whose parent is outside the skeleton), with
 * a fallback to the first bone found in the hierarchy. Uses `.isSkinnedMesh` /
 * `.isBone` flag checks (NOT `instanceof`) because the app can load multiple
 * Three.js instances, which breaks `instanceof`.
 */
function findRootMotionBone(root: THREE.Object3D): THREE.Object3D | null {
  let skinned: THREE.SkinnedMesh | null = null;
  root.traverse((o) => {
    if (!skinned && (o as unknown as { isSkinnedMesh?: boolean }).isSkinnedMesh) {
      skinned = o as unknown as THREE.SkinnedMesh;
    }
  });
  const sk = skinned as THREE.SkinnedMesh | null;
  if (sk && sk.skeleton?.bones?.length) {
    const bones = sk.skeleton.bones;
    const set = new Set<THREE.Object3D>(bones);
    for (const b of bones) {
      if (!b.parent || !set.has(b.parent)) return b;
    }
    return bones[0];
  }
  let bone: THREE.Object3D | null = null;
  root.traverse((o) => {
    if (!bone && (o as unknown as { isBone?: boolean }).isBone) bone = o;
  });
  return bone;
}
