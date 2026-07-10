/**
 * Persistent island run — seed, round, phase, and kill progress.
 * Drives progressive rounds and captain re-sail in /game.
 */

export type IslandPhase = "explore" | "boss_alert" | "boss_fight" | "victory" | "sail";

export interface IslandRun {
  seed: number;
  round: number;
  phase: IslandPhase;
  killsThisRound: number;
  bossId: string | null;
  bossDefeated: boolean;
  /** Sparse fog-of-war explored cell indices (persisted between sessions). */
  exploredCells?: number[];
  /** Active random island event id from {@link ISLAND_EVENT_DEFS}. */
  activeEventId?: string | null;
  /** Kills since the last event roll. */
  killsSinceEvent?: number;
  /** How many events have fired this round. */
  eventsThisRound?: number;
  /** Temporary buff flags from shrine/relic events. */
  shrineBuffUntil?: number;
}

const STORAGE_KEY = "flare:island-run";

function defaultSeed(): number {
  return (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
}

export function createFreshRun(seed = defaultSeed()): IslandRun {
  return {
    seed,
    round: 1,
    phase: "explore",
    killsThisRound: 0,
    bossId: null,
    bossDefeated: false,
    exploredCells: [],
    activeEventId: null,
    killsSinceEvent: 0,
    eventsThisRound: 0,
    shrineBuffUntil: 0,
  };
}

export function loadIslandRun(): IslandRun {
  if (typeof localStorage === "undefined") return createFreshRun();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createFreshRun();
    const parsed = JSON.parse(raw) as Partial<IslandRun>;
    return {
      seed: Number(parsed.seed) || defaultSeed(),
      round: Math.max(1, Number(parsed.round) || 1),
      phase: (parsed.phase as IslandPhase) ?? "explore",
      killsThisRound: Math.max(0, Number(parsed.killsThisRound) || 0),
      bossId: parsed.bossId ?? null,
      bossDefeated: Boolean(parsed.bossDefeated),
      exploredCells: Array.isArray(parsed.exploredCells) ? parsed.exploredCells.map(Number) : [],
      activeEventId: parsed.activeEventId ?? null,
      killsSinceEvent: Math.max(0, Number(parsed.killsSinceEvent) || 0),
      eventsThisRound: Math.max(0, Number(parsed.eventsThisRound) || 0),
      shrineBuffUntil: Number(parsed.shrineBuffUntil) || 0,
    };
  } catch {
    return createFreshRun();
  }
}

export function saveIslandRun(run: IslandRun): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(run));
}

/** README scaling: +28% HP and +18% damage per round after the first. */
export function roundScale(round: number): { hpMult: number; dmgMult: number; spawnBonus: number } {
  const r = Math.max(1, round);
  return {
    hpMult: 1 + 0.28 * (r - 1),
    dmgMult: 1 + 0.18 * (r - 1),
    spawnBonus: Math.floor((r - 1) / 2),
  };
}

export function zoneLabel(run: IslandRun): string {
  return `Grudge Armada · Island R${run.round} · Seed ${run.seed.toString(16).slice(0, 6)}`;
}