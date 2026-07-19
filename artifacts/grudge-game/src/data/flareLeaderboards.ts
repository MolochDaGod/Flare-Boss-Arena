/**
 * Flare leaderboards — local cache + optional fleet API publish.
 * Boards: boss_kills, island_rounds, pvp_kills, flare_tokens_earned
 */

import { getAuthToken, getAccountId } from "./grudgeAuth";
import { getActiveFighter } from "./fighters";
import { getLeaderboardApiBase } from "./grudgeFleet";
import { getEconomy } from "./flareEconomy";

export type LeaderboardBoardId =
  | "boss_kills"
  | "island_rounds"
  | "pvp_kills"
  | "flare_score";

export interface LeaderboardEntry {
  rank?: number;
  accountId: string;
  displayName: string;
  fighterId?: string;
  fighterName?: string;
  score: number;
  updatedAt: number;
}

export interface LeaderboardBoard {
  id: LeaderboardBoardId;
  label: string;
  description: string;
}

export const LEADERBOARD_BOARDS: LeaderboardBoard[] = [
  { id: "boss_kills", label: "Boss Kills", description: "Lifetime boss arena victories" },
  { id: "island_rounds", label: "Island Rounds", description: "Highest island round cleared" },
  { id: "pvp_kills", label: "Arena Kills", description: "PvP arena eliminations" },
  { id: "flare_score", label: "Flare Score", description: "Composite: kills + rounds + tokens" },
];

const LOCAL_KEY = "flare:leaderboards:v1";
const LOCAL_SCORES_KEY = "flare:my-scores:v1";

export interface MyScores {
  boss_kills: number;
  island_rounds: number;
  pvp_kills: number;
  flare_score: number;
}

function defaultScores(): MyScores {
  return { boss_kills: 0, island_rounds: 0, pvp_kills: 0, flare_score: 0 };
}

export function getMyScores(): MyScores {
  if (typeof localStorage === "undefined") return defaultScores();
  try {
    const raw = localStorage.getItem(LOCAL_SCORES_KEY);
    if (!raw) return defaultScores();
    return { ...defaultScores(), ...JSON.parse(raw) };
  } catch {
    return defaultScores();
  }
}

function saveMyScores(s: MyScores) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(LOCAL_SCORES_KEY, JSON.stringify(s));
}

function recomputeFlareScore(s: MyScores): MyScores {
  const eco = getEconomy();
  s.flare_score =
    s.boss_kills * 100 + s.island_rounds * 50 + s.pvp_kills * 75 + eco.totalBossKills * 10;
  return s;
}

function displayName(): string {
  if (typeof localStorage === "undefined") return "Hunter";
  return (
    localStorage.getItem("grudge_display_name") ||
    getActiveFighter().name ||
    "Hunter"
  );
}

function accountKey(): string {
  return getAccountId() || `local:${typeof crypto !== "undefined" ? crypto.randomUUID?.() ?? "anon" : "anon"}`;
}

/** Ensure stable local anon id. */
function ensureLocalAccount(): string {
  if (typeof localStorage === "undefined") return "anon";
  let id = getAccountId();
  if (!id) {
    const existing = localStorage.getItem("flare:local_player_id");
    if (existing) return existing;
    id = `local_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem("flare:local_player_id", id);
  }
  return id;
}

function readLocalBoard(board: LeaderboardBoardId): LeaderboardEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return [];
    const all = JSON.parse(raw) as Record<string, LeaderboardEntry[]>;
    return all[board] ?? [];
  } catch {
    return [];
  }
}

function writeLocalBoard(board: LeaderboardBoardId, entries: LeaderboardEntry[]) {
  if (typeof localStorage === "undefined") return;
  let all: Record<string, LeaderboardEntry[]> = {};
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (raw) all = JSON.parse(raw);
  } catch {
    /* empty */
  }
  all[board] = entries
    .sort((a, b) => b.score - a.score)
    .slice(0, 50)
    .map((e, i) => ({ ...e, rank: i + 1 }));
  localStorage.setItem(LOCAL_KEY, JSON.stringify(all));
}

function upsertLocal(board: LeaderboardBoardId, entry: LeaderboardEntry) {
  const list = readLocalBoard(board).filter((e) => e.accountId !== entry.accountId);
  list.push(entry);
  writeLocalBoard(board, list);
}

async function publishRemote(board: LeaderboardBoardId, entry: LeaderboardEntry): Promise<boolean> {
  const base = getLeaderboardApiBase();
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    const token = getAuthToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${base.replace(/\/$/, "")}/${board}`, {
      method: "POST",
      headers,
      body: JSON.stringify(entry),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchLeaderboard(
  board: LeaderboardBoardId,
): Promise<{ entries: LeaderboardEntry[]; source: "remote" | "local" }> {
  const base = getLeaderboardApiBase();
  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/${board}?limit=25`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const data = (await res.json()) as { entries?: LeaderboardEntry[] };
      const entries = (data.entries ?? []).map((e, i) => ({ ...e, rank: e.rank ?? i + 1 }));
      if (entries.length) {
        writeLocalBoard(board, entries);
        return { entries, source: "remote" };
      }
    }
  } catch {
    /* fall through */
  }
  return { entries: readLocalBoard(board), source: "local" };
}

export type ScoreEvent =
  | { type: "boss_kill" }
  | { type: "island_round"; round: number }
  | { type: "pvp_kill"; count?: number };

/** Apply score event, update local boards, best-effort publish to fleet. */
export async function recordScoreEvent(ev: ScoreEvent): Promise<MyScores> {
  const scores = getMyScores();
  if (ev.type === "boss_kill") scores.boss_kills += 1;
  if (ev.type === "island_round") scores.island_rounds = Math.max(scores.island_rounds, ev.round);
  if (ev.type === "pvp_kill") scores.pvp_kills += ev.count ?? 1;
  recomputeFlareScore(scores);
  saveMyScores(scores);

  const fighter = getActiveFighter();
  const entryBase = {
    accountId: ensureLocalAccount(),
    displayName: displayName(),
    fighterId: fighter.id,
    fighterName: fighter.name,
    updatedAt: Date.now(),
  };

  const maps: { board: LeaderboardBoardId; score: number }[] = [
    { board: "boss_kills", score: scores.boss_kills },
    { board: "island_rounds", score: scores.island_rounds },
    { board: "pvp_kills", score: scores.pvp_kills },
    { board: "flare_score", score: scores.flare_score },
  ];

  for (const m of maps) {
    const entry: LeaderboardEntry = { ...entryBase, score: m.score };
    upsertLocal(m.board, entry);
    void publishRemote(m.board, entry);
  }

  return scores;
}
