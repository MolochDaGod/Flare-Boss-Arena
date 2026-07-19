import * as THREE from "three";

/**
 * Shared orthographic iso camera helpers for Flare open-world + boss arena.
 * Velocity look-ahead, smooth zoom, and combat shake read better than a
 * fixed offset + instant frustum swap.
 */

export interface IsoCameraState {
  /** Live frustum half-height (smooth). */
  d: number;
  /** Wheel target frustum half-height. */
  dTarget: number;
  dMin: number;
  dMax: number;
  /** Base iso offset at default frustum (e.g. 18,18,18). */
  baseOffset: THREE.Vector3;
  /** Smoothed look-at point. */
  look: THREE.Vector3;
  /** Combat / impact shake residual (world units). */
  shake: number;
  /** Scratch for offset scaling. */
  _offset: THREE.Vector3;
  _shake: THREE.Vector3;
}

export function createIsoCameraState(opts: {
  d?: number;
  dMin?: number;
  dMax?: number;
  offset?: THREE.Vector3;
}): IsoCameraState {
  const d = opts.d ?? 16;
  return {
    d,
    dTarget: d,
    dMin: opts.dMin ?? 7,
    dMax: opts.dMax ?? 32,
    baseOffset: (opts.offset ?? new THREE.Vector3(18, 18, 18)).clone(),
    look: new THREE.Vector3(),
    shake: 0,
    _offset: new THREE.Vector3(),
    _shake: new THREE.Vector3(),
  };
}

/** Wheel handler: scroll up zooms in (smaller frustum). Shift = larger step. */
export function isoCameraWheel(state: IsoCameraState, e: WheelEvent, step = 0.8, fast = 1.6) {
  e.preventDefault();
  const s = e.shiftKey ? fast : step;
  const dir = Math.sign(e.deltaY);
  state.dTarget = THREE.MathUtils.clamp(state.dTarget + dir * s, state.dMin, state.dMax);
}

export function applyOrthoFrustum(camera: THREE.OrthographicCamera, d: number, aspect: number) {
  camera.left = -d * aspect;
  camera.right = d * aspect;
  camera.top = d;
  camera.bottom = -d;
  camera.updateProjectionMatrix();
}

/**
 * Frame update: smooth zoom, velocity look-ahead, exponential follow, shake.
 * `focus` is the player/world point (y usually 0 or playerY).
 * `velocity` is horizontal move velocity for lead framing.
 */
export function updateIsoCamera(
  camera: THREE.OrthographicCamera,
  state: IsoCameraState,
  focus: THREE.Vector3,
  velocity: THREE.Vector3,
  dt: number,
  opts: {
    /** Look-ahead seconds of velocity (0.12–0.28). */
    lead?: number;
    /** Position follow rate. */
    follow?: number;
    /** Look-at follow rate. */
    lookFollow?: number;
    /** Zoom smooth rate. */
    zoomFollow?: number;
    /** When true, scale iso offset with frustum so far zoom pulls back. */
    scaleOffsetWithZoom?: boolean;
    defaultD?: number;
  } = {},
) {
  const leadT = opts.lead ?? 0.2;
  const follow = opts.follow ?? 8;
  const lookFollow = opts.lookFollow ?? 10;
  const zoomFollow = opts.zoomFollow ?? 12;
  const defaultD = opts.defaultD ?? 16;
  const scaleOff = opts.scaleOffsetWithZoom !== false;

  // Smooth frustum zoom
  state.d += (state.dTarget - state.d) * (1 - Math.exp(-zoomFollow * dt));

  // Look-ahead in movement direction (velocity framing)
  const leadX = velocity.x * leadT;
  const leadZ = velocity.z * leadT;
  const lookGoalX = focus.x + leadX;
  const lookGoalZ = focus.z + leadZ;
  const lookGoalY = focus.y * 0.35;
  const aLook = 1 - Math.exp(-lookFollow * dt);
  state.look.x += (lookGoalX - state.look.x) * aLook;
  state.look.y += (lookGoalY - state.look.y) * aLook;
  state.look.z += (lookGoalZ - state.look.z) * aLook;

  // Offset scales gently with zoom so "out" feels more aerial
  const zoomScale = scaleOff ? THREE.MathUtils.clamp(state.d / defaultD, 0.72, 1.45) : 1;
  state._offset.copy(state.baseOffset).multiplyScalar(zoomScale);

  const aPos = 1 - Math.exp(-follow * dt);
  const wantX = state.look.x + state._offset.x;
  const wantY = state.look.y + state._offset.y;
  const wantZ = state.look.z + state._offset.z;
  camera.position.x += (wantX - camera.position.x) * aPos;
  camera.position.y += (wantY - camera.position.y) * aPos;
  camera.position.z += (wantZ - camera.position.z) * aPos;

  // Decay + apply shake (post-follow so it isn't smoothed away)
  if (state.shake > 0.001) {
    state.shake = Math.max(0, state.shake - dt * 3.2);
    const s = state.shake;
    state._shake.set(
      (Math.random() - 0.5) * s * 0.55,
      (Math.random() - 0.5) * s * 0.22,
      (Math.random() - 0.5) * s * 0.55,
    );
    camera.position.add(state._shake);
  }

  camera.lookAt(state.look);
}

export function kickCameraShake(state: IsoCameraState, amount: number) {
  state.shake = Math.min(1.2, state.shake + amount);
}
