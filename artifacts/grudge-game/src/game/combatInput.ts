import { DODGE_COOLDOWN_S } from "./dodgeMath";

/** Minimum time between dodge activations (ms). Blocks key-repeat spam. */
export const DODGE_COOLDOWN_MS = Math.round(DODGE_COOLDOWN_S * 1000);

export function canDodge(lastDodgeAt: number, now = performance.now()): boolean {
  return now - lastDodgeAt >= DODGE_COOLDOWN_MS;
}