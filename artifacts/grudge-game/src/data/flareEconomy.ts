/**
 * Flare production economy — Flare Grudge Tokens, character ownership, weekly free
 * rotation, boss-kill progress, and level persistence rules.
 *
 * Rules (production):
 * - All fighters locked by default.
 * - Unlock cost: spend 1 Flare Grudge Token (bought for 1000 GBUX, or earned).
 * - 5 boss kills → 1 Flare Grudge Token.
 * - New accounts start with 2 tokens.
 * - Each ISO week, 3 random fighters are free to play (test rotation only).
 * - Level progress is persisted only when the fighter is owned via token spend
 *   (weekly free does NOT save long-term levels).
 */

import { FIGHTERS } from "./fighters";

export const FLARE_TOKEN_ID = "flare_grudge_token" as const;
export const GBUX_PER_TOKEN = 1000;
export const BOSSES_PER_TOKEN = 5;
export const STARTER_TOKENS = 2;
export const WEEKLY_FREE_COUNT = 3;
export const UNLOCK_TOKEN_COST = 1;

const STATE_KEY = "flare:economy:v1";
const WELCOME_KEY = "flare:welcome:production:seen";

export type UnlockSource = "token" | "weekly" | "starter";

export interface FighterProgress {
  level: number;
  xp: number;
}

export interface FlareEconomyState {
  /** Account balance of Flare Grudge Tokens. */
  tokens: number;
  /** Account GBUX cache (synced from Railway when online). */
  gbux: number;
  /** Fighter ids permanently owned (token spend). */
  owned: string[];
  /** Boss kills toward next token (0..BOSSES_PER_TOKEN-1 progress). */
  bossKillsTowardToken: number;
  /** Total bosses killed (lifetime). */
  totalBossKills: number;
  /** ISO week key for current free rotation, e.g. "2026-W29". */
  weeklyWeekKey: string;
  /** Fighter ids free this week (test only). */
  weeklyFree: string[];
  /** Granted starter tokens once. */
  starterGranted: boolean;
  /** Per-fighter level — only meaningful for owned fighters. */
  progress: Record<string, FighterProgress>;
}

function isoWeekKey(d = new Date()): string {
  // ISO week: Thursday-based week number
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashWeek(weekKey: string): number {
  let h = 2166136261;
  for (let i = 0; i < weekKey.length; i++) {
    h ^= weekKey.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic 3 random fighter ids for a given ISO week. */
export function pickWeeklyFree(weekKey: string, rosterIds: string[] = FIGHTERS.map((f) => f.id)): string[] {
  if (rosterIds.length === 0) return [];
  const rng = mulberry32(hashWeek(weekKey));
  const pool = [...rosterIds];
  const picked: string[] = [];
  const n = Math.min(WEEKLY_FREE_COUNT, pool.length);
  for (let i = 0; i < n; i++) {
    const idx = Math.floor(rng() * pool.length);
    picked.push(pool.splice(idx, 1)[0]!);
  }
  return picked;
}

function defaultState(): FlareEconomyState {
  const week = isoWeekKey();
  return {
    tokens: 0,
    gbux: 0,
    owned: [],
    bossKillsTowardToken: 0,
    totalBossKills: 0,
    weeklyWeekKey: week,
    weeklyFree: pickWeeklyFree(week),
    starterGranted: false,
    progress: {},
  };
}

function loadRaw(): FlareEconomyState {
  if (typeof localStorage === "undefined") return defaultState();
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return defaultState();
    return { ...defaultState(), ...JSON.parse(raw) } as FlareEconomyState;
  } catch {
    return defaultState();
  }
}

function persist(state: FlareEconomyState) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STATE_KEY, JSON.stringify(state));
}

/** Ensure weekly rotation is current and starter tokens granted. Call on app boot. */
export function ensureEconomyBootstrapped(): FlareEconomyState {
  const state = loadRaw();
  let dirty = false;

  if (!state.starterGranted) {
    state.tokens = Math.max(state.tokens, 0) + STARTER_TOKENS;
    state.starterGranted = true;
    dirty = true;
  }

  const week = isoWeekKey();
  if (state.weeklyWeekKey !== week) {
    state.weeklyWeekKey = week;
    state.weeklyFree = pickWeeklyFree(week);
    dirty = true;
  } else if (!state.weeklyFree?.length) {
    state.weeklyFree = pickWeeklyFree(week);
    dirty = true;
  }

  if (dirty) persist(state);
  return state;
}

export function getEconomy(): FlareEconomyState {
  return ensureEconomyBootstrapped();
}

export function getFlareTokens(): number {
  return getEconomy().tokens;
}

export function getGbux(): number {
  return getEconomy().gbux;
}

export function setGbux(amount: number) {
  const state = getEconomy();
  state.gbux = Math.max(0, Math.floor(amount));
  persist(state);
}

/** True if permanently owned (spent Flare Grudge Token). */
export function isOwned(fighterId: string): boolean {
  return getEconomy().owned.includes(fighterId);
}

/** True if in this week's free test rotation. */
export function isWeeklyFree(fighterId: string): boolean {
  const s = getEconomy();
  return s.weeklyFree.includes(fighterId);
}

/**
 * Playable = owned OR weekly free.
 * Selecting is allowed only when playable.
 */
export function isPlayable(fighterId: string): boolean {
  return isOwned(fighterId) || isWeeklyFree(fighterId);
}

export function isLocked(fighterId: string): boolean {
  return !isPlayable(fighterId);
}

export type UnlockResult =
  | { ok: true; source: "token"; tokensLeft: number }
  | { ok: false; reason: "already_owned" | "insufficient_tokens" | "unknown_fighter" };

/** Spend 1 Flare Grudge Token to permanently unlock a fighter. */
export function unlockWithToken(fighterId: string): UnlockResult {
  if (!FIGHTERS.some((f) => f.id === fighterId)) {
    return { ok: false, reason: "unknown_fighter" };
  }
  const state = getEconomy();
  if (state.owned.includes(fighterId)) {
    return { ok: false, reason: "already_owned" };
  }
  if (state.tokens < UNLOCK_TOKEN_COST) {
    return { ok: false, reason: "insufficient_tokens" };
  }
  state.tokens -= UNLOCK_TOKEN_COST;
  state.owned.push(fighterId);
  if (!state.progress[fighterId]) {
    state.progress[fighterId] = { level: 1, xp: 0 };
  }
  persist(state);
  return { ok: true, source: "token", tokensLeft: state.tokens };
}

export type BuyTokenResult =
  | { ok: true; tokens: number; gbux: number }
  | { ok: false; reason: "insufficient_gbux" };

/** Convert 1000 GBUX → 1 Flare Grudge Token (local cache; Railway spend when wired). */
export function buyTokenWithGbux(): BuyTokenResult {
  const state = getEconomy();
  if (state.gbux < GBUX_PER_TOKEN) {
    return { ok: false, reason: "insufficient_gbux" };
  }
  state.gbux -= GBUX_PER_TOKEN;
  state.tokens += 1;
  persist(state);
  return { ok: true, tokens: state.tokens, gbux: state.gbux };
}

/**
 * Record a boss kill. Every BOSSES_PER_TOKEN kills grants 1 token.
 * Returns tokens earned this call (0 or 1+).
 */
export function recordBossKill(): { tokensEarned: number; progress: number; total: number } {
  const state = getEconomy();
  state.totalBossKills += 1;
  state.bossKillsTowardToken += 1;
  let tokensEarned = 0;
  while (state.bossKillsTowardToken >= BOSSES_PER_TOKEN) {
    state.bossKillsTowardToken -= BOSSES_PER_TOKEN;
    state.tokens += 1;
    tokensEarned += 1;
  }
  persist(state);
  return {
    tokensEarned,
    progress: state.bossKillsTowardToken,
    total: state.totalBossKills,
  };
}

export function getBossKillProgress(): { current: number; needed: number; total: number } {
  const s = getEconomy();
  return {
    current: s.bossKillsTowardToken,
    needed: BOSSES_PER_TOKEN,
    total: s.totalBossKills,
  };
}

export function getFighterLevel(fighterId: string): number {
  const s = getEconomy();
  // Owned: use saved progress. Weekly free / locked: always level 1 (no save).
  if (!isOwned(fighterId)) return 1;
  return s.progress[fighterId]?.level ?? 1;
}

/**
 * Add XP / level up — ONLY persists if fighter is owned via token.
 * Weekly free sessions do not write long-term progress.
 */
export function grantFighterXp(
  fighterId: string,
  xpAmount: number,
): { saved: boolean; level: number; xp: number } {
  if (!isOwned(fighterId)) {
    return { saved: false, level: 1, xp: 0 };
  }
  const state = getEconomy();
  const cur = state.progress[fighterId] ?? { level: 1, xp: 0 };
  let { level, xp } = cur;
  xp += Math.max(0, xpAmount);
  // Simple curve: 100 * level XP per level
  let need = 100 * level;
  while (xp >= need && level < 99) {
    xp -= need;
    level += 1;
    need = 100 * level;
  }
  state.progress[fighterId] = { level, xp };
  persist(state);
  return { saved: true, level, xp };
}

export function getWeeklyFreeIds(): string[] {
  return [...getEconomy().weeklyFree];
}

export function getOwnedIds(): string[] {
  return [...getEconomy().owned];
}

export function shouldShowProductionWelcome(): boolean {
  if (typeof localStorage === "undefined") return true;
  return localStorage.getItem(WELCOME_KEY) !== "1";
}

export function dismissProductionWelcome() {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(WELCOME_KEY, "1");
}

export function economySummary() {
  const s = getEconomy();
  return {
    tokens: s.tokens,
    gbux: s.gbux,
    ownedCount: s.owned.length,
    weeklyFree: s.weeklyFree,
    weekKey: s.weeklyWeekKey,
    bossProgress: s.bossKillsTowardToken,
    bossesPerToken: BOSSES_PER_TOKEN,
    unlockCostGbux: GBUX_PER_TOKEN,
    starterTokens: STARTER_TOKENS,
  };
}
