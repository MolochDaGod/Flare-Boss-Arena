/**
 * Client-side boss encounter generator.
 *
 * Production on Vercel ships the static Vite frontend only — POST /api/bosses/generate
 * is not available (405). Always use the curated roster so the boss arena works offline.
 */

import {
  generateRosterBoss,
  type LocalBossRequest,
  ALL_BOSSES,
  BOSS_ROSTER,
} from "./bossRoster";
import type { ArenaBossInput } from "@/game/ArenaScene";

export type { LocalBossRequest } from "./bossRoster";
export { ALL_BOSSES, BOSS_ROSTER };

/** Build a deterministic-enough local boss for the given tier / player context. */
export function generateLocalBoss(req: LocalBossRequest): ArenaBossInput {
  return generateRosterBoss(req);
}

/** Parse `?boss=noble` / `?boss=3` / `?boss=boss_framis` from the URL. */
export function bossQueryFromSearch(search: string): Partial<LocalBossRequest> {
  try {
    const q = new URLSearchParams(search.startsWith("?") ? search : `?${search}`);
    const raw = q.get("boss");
    if (!raw) return {};
    if (/^\d+$/.test(raw)) return { bossIndex: Number(raw) };
    const byId = ALL_BOSSES.find(
      (b) =>
        b.id === raw ||
        b.id.endsWith(raw) ||
        b.name.toLowerCase().replace(/\s+/g, "_") === raw.toLowerCase() ||
        b.modelId === raw,
    );
    if (byId) return { bossId: byId.id };
    return {};
  } catch {
    return {};
  }
}
