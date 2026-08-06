/**
 * Combat pointer + movement input SSOT for Flare Boss Arena dungeon.
 *
 * Buttons (iso world — not FPS free-look):
 *  - LMB click: select enemy OR click-to-move ground
 *  - LMB hold:  drag-move toward ground under cursor (RTS)
 *  - RMB hold:  attack / chase locked or nearest foe (harvest if none)
 *  - Wheel:     smooth ortho zoom (Shift = larger steps)
 *  - MMB click: reset zoom to default
 *
 * OS mouse cursor is always visible; engine sets contextual cursor CSS.
 */

/** Minimum time between dodge activations (ms). Blocks key-repeat spam. */
export const DODGE_COOLDOWN_MS = 450;

export function canDodge(lastDodgeAt: number, now = performance.now()): boolean {
  return now - lastDodgeAt >= DODGE_COOLDOWN_MS;
}

export type CombatCursorMode =
  | "default"
  | "crosshair"
  | "pointer"
  | "move"
  | "cell"
  | "grabbing"
  | "not-allowed";

/** Contextual CSS cursor for the 3D mount. */
export function cursorCssForMode(mode: CombatCursorMode): string {
  switch (mode) {
    case "pointer":
      return "pointer";
    case "crosshair":
      return "crosshair";
    case "move":
      return "move";
    case "cell":
      return "cell";
    case "grabbing":
      return "grabbing";
    case "not-allowed":
      return "not-allowed";
    default:
      return "default";
  }
}

/**
 * Resolve cursor mode from live combat state.
 * Priority: skill targeting > hover enemy > LMB drag move > RMB attack > default crosshair.
 */
export function resolveCombatCursor(opts: {
  skillTargeting: boolean;
  hoverEnemy: boolean;
  lmbHeld: boolean;
  rmbHeld: boolean;
  dead?: boolean;
}): CombatCursorMode {
  if (opts.dead) return "not-allowed";
  if (opts.skillTargeting) return "cell";
  if (opts.hoverEnemy) return "pointer";
  if (opts.rmbHeld) return "crosshair";
  if (opts.lmbHeld) return "move";
  return "crosshair";
}

/** Normalize wheel delta to ~line units (cross browser). */
export function normalizeWheelDelta(e: WheelEvent): number {
  // deltaMode: 0=pixel, 1=line, 2=page
  if (e.deltaMode === 1) return e.deltaY;
  if (e.deltaMode === 2) return Math.sign(e.deltaY) * 16;
  // pixels → approximate lines
  return e.deltaY / 40;
}

export const WHEEL_ZOOM_STEP = 0.85;
export const WHEEL_ZOOM_FAST = 1.65;
export const WHEEL_DEFAULT_D = 16;

/** Middle-mouse / auxiliary button index. */
export const MOUSE_MMB = 1;
export const MOUSE_LMB = 0;
export const MOUSE_RMB = 2;
