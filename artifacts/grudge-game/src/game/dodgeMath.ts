/**
 * Shared dodge direction + distance math for island / boss / camp.
 *
 * Rules (player request):
 *  • WASD + Shift → dodge along the same isometric WASD vector as walk
 *  • Shift alone  → dodge away from the most obvious threat (nearest foe/boss)
 *  • fallbacks    → pointer aim, then current facing
 *
 * Distance is engine-controlled (not left to clip root motion alone) so rolls
 * feel consistent across skins with or without dodge clips.
 */

/** World units of a directed (WASD) dodge. */
export const DODGE_DISTANCE = 4.8;
/** Slightly longer when escaping a threat with no WASD held. */
export const DODGE_DISTANCE_ESCAPE = 5.4;
/** Back-dodge (S or away-from-threat relative) gets a touch more space. */
export const DODGE_DISTANCE_BACK = 5.1;
/** I-frame / FSM duration (seconds). */
export const DODGE_IFRAME_S = 0.4;
/** Cooldown between dodges (seconds). */
export const DODGE_COOLDOWN_S = 0.9;

export type DodgeMode = "wasd" | "threat" | "aim" | "facing";

export interface DodgeResolveInput {
  keys: ReadonlySet<string>;
  /** Player yaw (atan2(x, z)), same convention as GameEngine / Arena. */
  facingYaw: number;
  playerX: number;
  playerZ: number;
  /** Live threat positions (enemies, boss, dummies). Closest wins. */
  threats?: ReadonlyArray<{ x: number; z: number }>;
  /** Optional mouse ground aim (cursor dodge). */
  aimX?: number | null;
  aimZ?: number | null;
  /** Max range to consider a threat "obvious" (world units). */
  threatRange?: number;
}

export interface DodgeResolveResult {
  dirX: number;
  dirZ: number;
  mode: DodgeMode;
  distance: number;
  /** Relative to facing: used for directional clip pick. */
  relative: "forward" | "back" | "left" | "right";
}

/**
 * Isometric WASD → world XZ, matching GameEngine / ArenaScene locomotion:
 *   W: (-1,-1)  S: (+1,+1)  A: (-1,+1)  D: (+1,-1)
 * Returns length 0 when no move key is held.
 */
export function wasdIsoXZ(keys: ReadonlySet<string>): { x: number; z: number } {
  let x = 0;
  let z = 0;
  if (keys.has("KeyW") || keys.has("ArrowUp")) {
    x -= 1;
    z -= 1;
  }
  if (keys.has("KeyS") || keys.has("ArrowDown")) {
    x += 1;
    z += 1;
  }
  if (keys.has("KeyA") || keys.has("ArrowLeft")) {
    x -= 1;
    z += 1;
  }
  if (keys.has("KeyD") || keys.has("ArrowRight")) {
    x += 1;
    z -= 1;
  }
  return { x, z };
}

export function facingForwardXZ(yaw: number): { x: number; z: number } {
  return { x: Math.sin(yaw), z: Math.cos(yaw) };
}

/** Classify dash direction relative to facing (for left/right/back clips). */
export function classifyRelative(
  facingYaw: number,
  dirX: number,
  dirZ: number,
): "forward" | "back" | "left" | "right" {
  const fx = Math.sin(facingYaw);
  const fz = Math.cos(facingYaw);
  // Facing-local: forward = face, right = perpendicular (fz, -fx) wait:
  // right of facing = (cos(yaw), -sin(yaw))? Face (sin, cos); right = (cos, -sin).
  const rx = Math.cos(facingYaw);
  const rz = -Math.sin(facingYaw);
  const fwd = dirX * fx + dirZ * fz;
  const side = dirX * rx + dirZ * rz;
  if (Math.abs(fwd) >= Math.abs(side)) {
    return fwd >= 0 ? "forward" : "back";
  }
  return side >= 0 ? "right" : "left";
}

/**
 * Clip name candidates for a relative dodge, most-specific first.
 * Controllers that only have a generic "dodge" still match later entries.
 */
export function dodgeClipCandidates(
  relative: "forward" | "back" | "left" | "right",
): string[] {
  switch (relative) {
    case "back":
      return ["dodge_back", "dodgeBack", "standing dodge backward", "roll", "dodge", "evade"];
    case "left":
      return ["dodge_left", "dodgeLeft", "standing dodge left", "dodge", "roll", "evade"];
    case "right":
      return ["dodge_right", "dodgeRight", "standing dodge right", "dodge", "roll", "evade"];
    default:
      return ["dodge", "standing dodge forward", "roll", "evade", "dodging"];
  }
}

/**
 * Resolve dodge direction + distance.
 * Priority: WASD → nearest threat (away) → pointer aim → facing forward.
 */
export function resolveDodge(input: DodgeResolveInput): DodgeResolveResult {
  const threatRange = input.threatRange ?? 22;
  const move = wasdIsoXZ(input.keys);
  const moveLen = Math.hypot(move.x, move.z);

  let dirX: number;
  let dirZ: number;
  let mode: DodgeMode;
  let distance: number;

  if (moveLen > 1e-6) {
    dirX = move.x / moveLen;
    dirZ = move.z / moveLen;
    mode = "wasd";
    const rel = classifyRelative(input.facingYaw, dirX, dirZ);
    distance = rel === "back" ? DODGE_DISTANCE_BACK : DODGE_DISTANCE;
  } else {
    // Shift alone — flee the most obvious threat.
    let best: { x: number; z: number; d: number } | null = null;
    for (const t of input.threats ?? []) {
      const dx = t.x - input.playerX;
      const dz = t.z - input.playerZ;
      const d = Math.hypot(dx, dz);
      if (d < 0.05 || d > threatRange) continue;
      if (!best || d < best.d) best = { x: t.x, z: t.z, d };
    }
    if (best) {
      // Away from threat.
      dirX = (input.playerX - best.x) / best.d;
      dirZ = (input.playerZ - best.z) / best.d;
      mode = "threat";
      distance = DODGE_DISTANCE_ESCAPE;
    } else if (
      input.aimX != null &&
      input.aimZ != null &&
      Number.isFinite(input.aimX) &&
      Number.isFinite(input.aimZ)
    ) {
      dirX = input.aimX - input.playerX;
      dirZ = input.aimZ - input.playerZ;
      const len = Math.hypot(dirX, dirZ);
      if (len > 1e-4) {
        dirX /= len;
        dirZ /= len;
        mode = "aim";
        distance = DODGE_DISTANCE;
      } else {
        const f = facingForwardXZ(input.facingYaw);
        dirX = f.x;
        dirZ = f.z;
        mode = "facing";
        distance = DODGE_DISTANCE;
      }
    } else {
      const f = facingForwardXZ(input.facingYaw);
      dirX = f.x;
      dirZ = f.z;
      mode = "facing";
      distance = DODGE_DISTANCE;
    }
  }

  const relative = classifyRelative(input.facingYaw, dirX, dirZ);
  return { dirX, dirZ, mode, distance, relative };
}

/** Apply a horizontal dash; returns the new position (does not mutate input). */
export function applyDash(
  x: number,
  z: number,
  dirX: number,
  dirZ: number,
  distance: number,
): { x: number; z: number } {
  return { x: x + dirX * distance, z: z + dirZ * distance };
}
