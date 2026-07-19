/**
 * Grudge Studio fleet connections for Flare Boss Arena.
 * SSOT for production deploy wiring: auth, API, assets, PvP, leaderboards.
 *
 * Override via Vite env:
 *   VITE_MP_URL / VITE_PVP_SERVER_URL — Socket.IO multiplayer host
 *   VITE_API_BASE — optional absolute API (prefer same-origin /api)
 *   VITE_LEADERBOARD_URL — optional absolute leaderboard base
 */

export const FLARE_ORIGIN =
  typeof window !== "undefined" ? window.location.origin : "https://flare-boss-arena.vercel.app";

export const FLEET = {
  gameId: "flare-boss-arena",
  gameLabel: "Flare Boss Arena",
  deployUrl: "https://flare-boss-arena.vercel.app",
  studio: "https://grudge-studio.com",
  id: "https://id.grudge-studio.com",
  assets: "https://assets.grudge-studio.com",
  objectstore: "https://objectstore.grudge-studio.com",
  info: "https://info.grudge-studio.com",
  /** Railway Postgres game API (characters, account, GBUX). */
  railwayApi: "https://grudge-api-production-0d46.up.railway.app",
  /** Dash / fleet console. */
  dash: "https://dash.grudge-studio.com",
  /** Mech pvp-server reference (grudge-studio monorepo). */
  mechPvpDocs: "https://grudge-space-rts.vercel.app",
} as const;

function env(key: string): string | undefined {
  try {
    const v = (import.meta as ImportMeta & { env?: Record<string, string> }).env?.[key];
    return v && v.trim() ? v.trim() : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Socket.IO multiplayer / PvP base URL.
 * Production: set VITE_MP_URL to Railway mp-server (or grudge-studio pvp-server).
 * Dev default: localhost:4100 (artifacts/mp-server).
 */
export function getMpServerUrl(): string {
  return (
    env("VITE_MP_URL") ||
    env("VITE_PVP_SERVER_URL") ||
    // Same-origin path works when edge proxies WS (optional)
    (typeof window !== "undefined" && window.location.hostname === "localhost"
      ? "http://localhost:4100"
      : env("VITE_MP_FALLBACK") || "https://flare-mp.up.railway.app")
  );
}

/** REST leaderboard base (same-origin preferred). */
export function getLeaderboardApiBase(): string {
  return env("VITE_LEADERBOARD_URL") || `${FLARE_ORIGIN}/api/flare/leaderboards`;
}

/** Same-origin API base for auth/account (Vercel → Railway). */
export function getGameApiBase(): string {
  return env("VITE_API_BASE") || "";
}

export type FleetConnectionId =
  | "auth"
  | "account_api"
  | "assets"
  | "objectstore"
  | "mp_pvp"
  | "leaderboards"
  | "health";

export interface FleetConnection {
  id: FleetConnectionId;
  label: string;
  description: string;
  url: string;
  kind: "http" | "ws" | "cdn";
  required: boolean;
}

export function getFleetConnections(): FleetConnection[] {
  const mp = getMpServerUrl();
  return [
    {
      id: "auth",
      label: "Grudge ID",
      description: "Login / SSO token mint",
      url: `${FLEET.id}/login`,
      kind: "http",
      required: true,
    },
    {
      id: "account_api",
      label: "Account & characters",
      description: "Railway production API (via /api/*)",
      url: `${FLARE_ORIGIN}/api/health`,
      kind: "http",
      required: true,
    },
    {
      id: "assets",
      label: "Assets CDN",
      description: "R2 meshes, icons, fleet JS",
      url: FLEET.assets,
      kind: "cdn",
      required: true,
    },
    {
      id: "objectstore",
      label: "ObjectStore",
      description: "Gamedata definitions",
      url: `${FLEET.objectstore}/api/v1/`,
      kind: "http",
      required: false,
    },
    {
      id: "mp_pvp",
      label: "PvP / multiplayer",
      description: "Socket.IO rooms (arena + co-op)",
      url: mp,
      kind: "ws",
      required: false,
    },
    {
      id: "leaderboards",
      label: "Leaderboards",
      description: "Boss, island, arena ranks",
      url: getLeaderboardApiBase(),
      kind: "http",
      required: false,
    },
    {
      id: "health",
      label: "MP health",
      description: "Multiplayer server liveness",
      url: `${mp.replace(/\/$/, "")}/health`,
      kind: "http",
      required: false,
    },
  ];
}

export interface ConnectionProbe {
  id: FleetConnectionId;
  ok: boolean;
  status?: number;
  latencyMs?: number;
  detail?: string;
}

/** Best-effort HTTP probe (WS hosts use /health). */
export async function probeConnection(c: FleetConnection): Promise<ConnectionProbe> {
  const start = performance.now();
  let url = c.url;
  if (c.kind === "ws") {
    url = `${c.url.replace(/\/$/, "")}/health`;
  }
  try {
    const res = await fetch(url, {
      method: "GET",
      mode: "cors",
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    });
    return {
      id: c.id,
      ok: res.ok || res.status === 204,
      status: res.status,
      latencyMs: Math.round(performance.now() - start),
      detail: res.ok ? "up" : `HTTP ${res.status}`,
    };
  } catch (e) {
    return {
      id: c.id,
      ok: false,
      latencyMs: Math.round(performance.now() - start),
      detail: e instanceof Error ? e.message : "unreachable",
    };
  }
}

export async function probeAllConnections(): Promise<ConnectionProbe[]> {
  const list = getFleetConnections();
  return Promise.all(list.map(probeConnection));
}
