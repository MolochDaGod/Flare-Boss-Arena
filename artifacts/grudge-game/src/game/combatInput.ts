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
 * OS mouse cursor is always visible; engine sets contextual Kenney pixel cursors.
 * Assets: public/cursors/pixel/* (Kenney Cursor Pixel Pack, CC0).
 */

/** Minimum time between dodge activations (ms). Blocks key-repeat spam. */
export const DODGE_COOLDOWN_MS = 450;

export function canDodge(lastDodgeAt: number, now = performance.now()): boolean {
  return now - lastDodgeAt >= DODGE_COOLDOWN_MS;
}

/**
 * Contextual cursor modes for /game.
 * Pixel pack: lock/unlock, ally, enemy, harvest, dungeon, boat, claim, skill…
 */
export type CombatCursorMode =
  | "default"
  | "crosshair"
  | "combat"
  | "enemy"
  | "ally"
  | "locked"
  | "unlocked"
  | "harvest_wood"
  | "harvest_stone"
  | "talk"
  | "trade"
  | "sail"
  | "boat"
  | "dungeon"
  | "claim"
  | "build"
  | "skill"
  | "move"
  | "attack"
  | "interact"
  | "travel"
  | "not-allowed"
  /** Legacy aliases kept for older call sites. */
  | "pointer"
  | "cell"
  | "grabbing";

const CURSOR_BASE = `${import.meta.env.BASE_URL}cursors/pixel`;

/** Kenney pixel 32×32 PNG + hotspot + CSS fallback. */
function pixel(
  file: string,
  hx: number,
  hy: number,
  fallback: string,
): string {
  return `url("${CURSOR_BASE}/${file}") ${hx} ${hy}, ${fallback}`;
}

/**
 * Contextual CSS cursor for the 3D mount.
 * Kenney Cursor Pixel Pack (CC0) with system fallbacks.
 */
export function cursorCssForMode(mode: CombatCursorMode): string {
  switch (mode) {
    case "locked":
      return pixel("lock.png", 8, 8, "not-allowed");
    case "unlocked":
      return pixel("unlock.png", 8, 8, "pointer");
    case "enemy":
    case "pointer":
      return pixel("sword.png", 4, 4, "pointer");
    case "ally":
      return pixel("talk.png", 4, 4, "pointer");
    case "harvest_wood":
      return pixel("axe.png", 4, 4, "crosshair");
    case "harvest_stone":
      return pixel("pickaxe.png", 4, 4, "crosshair");
    case "talk":
      return pixel("hand_point.png", 6, 2, "pointer");
    case "trade":
      return pixel("hand_open.png", 8, 4, "pointer");
    case "sail":
    case "travel":
      return pixel("travel_ne.png", 16, 16, "pointer");
    case "boat":
      return pixel("door_open.png", 8, 4, "pointer");
    case "dungeon":
      return pixel("door.png", 8, 4, "pointer");
    case "claim":
      return pixel("house.png", 8, 4, "cell");
    case "build":
      return pixel("hammer.png", 4, 4, "cell");
    case "skill":
    case "cell":
      return pixel("ring.png", 16, 16, "cell");
    case "move":
      return pixel("pointer_soft.png", 2, 2, "move");
    case "attack":
      return pixel("crosshair.png", 16, 16, "crosshair");
    case "interact":
      return pixel("loot.png", 8, 4, "pointer");
    case "not-allowed":
      return pixel("ban.png", 8, 8, "not-allowed");
    case "grabbing":
      return pixel("hand_closed.png", 10, 8, "grabbing");
    case "combat":
    case "crosshair":
      return pixel("cross.png", 16, 16, "crosshair");
    case "default":
    default:
      return pixel("default.png", 2, 2, "default");
  }
}

export type HarvestCursorKind = "wood" | "stone" | "herb";

export type PirateCursorRole = "vendor" | "captain" | "crew" | "traveler";

/**
 * Resolve cursor mode from live world + combat state.
 *
 * Priority (high → low):
 *  dead → skill place → hard lock → hover enemy → hover ally → pirate role
 *  → boat/dungeon → harvest → claim/build → RMB attack → LMB drag
 *  → proximity talk/harvest → combat default
 */
export function resolveCombatCursor(opts: {
  skillTargeting?: boolean;
  /** Hard target lock (RMB locked foe). */
  targetLocked?: boolean;
  hoverEnemy?: boolean;
  /** Party ally under cursor. */
  hoverAlly?: boolean;
  hoverPirate?: boolean;
  pirateRole?: PirateCursorRole | null;
  hoverHarvest?: HarvestCursorKind | null;
  nearbyHarvest?: HarvestCursorKind | null;
  hoverBoat?: boolean;
  hoverDock?: boolean;
  hoverDungeon?: boolean;
  hoverClaim?: boolean;
  hoverInteract?: boolean;
  /** Soft RTS place mode (C plants claim; show house/hammer when ready). */
  claimReady?: boolean;
  nearbyPirate?: boolean;
  nearbyPirateRole?: PirateCursorRole | null;
  lmbHeld?: boolean;
  rmbHeld?: boolean;
  dead?: boolean;
}): CombatCursorMode {
  if (opts.dead) return "not-allowed";
  if (opts.skillTargeting) return "skill";

  // Hard lock on enemy → padlock
  if (opts.targetLocked) return "locked";

  if (opts.hoverEnemy) return "enemy";
  if (opts.hoverAlly) return "ally";

  // Hovered pirate (raycast) beats proximity
  if (opts.hoverPirate) {
    const role = opts.pirateRole ?? "crew";
    if (role === "captain") return "sail";
    if (role === "vendor") return "trade";
    return "talk";
  }

  if (opts.hoverBoat) return "boat";
  if (opts.hoverDungeon) return "dungeon";
  if (opts.hoverDock) return "travel";
  if (opts.hoverInteract) return "interact";

  const harvest = opts.hoverHarvest ?? null;
  if (harvest === "wood") return "harvest_wood";
  if (harvest === "stone" || harvest === "herb") return "harvest_stone";

  if (opts.hoverClaim) return "claim";

  if (opts.rmbHeld) return "attack";
  if (opts.lmbHeld) return "move";

  // Proximity interactables (E talk / sail, F/RMB harvest)
  if (opts.nearbyPirate) {
    const role = opts.nearbyPirateRole ?? "crew";
    if (role === "captain") return "sail";
    if (role === "vendor") return "trade";
    return "talk";
  }

  const nearH = opts.nearbyHarvest ?? null;
  if (nearH === "wood") return "harvest_wood";
  if (nearH === "stone" || nearH === "herb") return "harvest_stone";

  // Soft RTS claim affordance only when flag is ready and nothing else active
  if (opts.claimReady) return "build";

  return "combat";
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
