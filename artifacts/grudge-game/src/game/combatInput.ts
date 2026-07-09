/** Minimum time between dodge activations (ms). Blocks key-repeat spam. */
export const DODGE_COOLDOWN_MS = 450;

export function canDodge(lastDodgeAt: number, now = performance.now()): boolean {
  return now - lastDodgeAt >= DODGE_COOLDOWN_MS;
}