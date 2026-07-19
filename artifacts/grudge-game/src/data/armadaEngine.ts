/**
 * Armada-era Grudge Engine manifest — production boot contract for Flare Boss Arena.
 * Includes Grudge Studio fleet connections: auth, API, PvP, leaderboards, CDN.
 */

import {
  FLEET,
  FLARE_ORIGIN,
  getFleetConnections,
  getLeaderboardApiBase,
  getMpServerUrl,
} from "./grudgeFleet";

export const ARMADA_ERA = "armada" as const;

export const FBA_ENGINE_GAME = {
  id: "flare-boss-arena",
  label: "Flare Boss Arena",
  route: "/game",
  deployUrl: FLEET.deployUrl,
  package: "@workspace/grudge-game",
  modes: ["dungeon", "camp", "boss", "pvp", "moba"] as const,
  playLoop: [
    "choose-fighter",
    "party",
    "equipment",
    "skills",
    "island-rounds",
    "boss-arena",
    "pvp-arena",
    "leaderboards",
  ] as const,
};

/** Production fleet wiring for the engine runtime. */
export const FBA_FLEET_CONNECTIONS = {
  auth: {
    loginOrigin: FLEET.id,
    tokenKeys: ["grudge_auth_token", "grudge_session_token", "grudge.token", "sso_token"],
  },
  api: {
    /** Same-origin; Vercel rewrites → Railway production. */
    sameOrigin: true,
    health: "/api/health",
    account: "/api/account",
    characters: "/api/characters",
    railway: FLEET.railwayApi,
  },
  assets: {
    cdn: FLEET.assets,
    objectstore: FLEET.objectstore,
  },
  multiplayer: {
    /** Socket.IO PvP / co-op (artifacts/mp-server or VITE_MP_URL). */
    protocol: "socket.io",
    url: typeof window !== "undefined" ? getMpServerUrl() : "http://localhost:4100",
    healthPath: "/health",
    rooms: {
      pve: "pve:{instanceId}",
      pvp: "arena:{matchId}",
    },
  },
  leaderboards: {
    boards: ["boss_kills", "island_rounds", "pvp_kills", "flare_score"] as const,
    apiBase: typeof window !== "undefined" ? getLeaderboardApiBase() : "/api/flare/leaderboards",
  },
} as const;

/** Minimal client-side manifest slice used at dungeon / PvP boot. */
export const FBA_ARMADA_MANIFEST = {
  version: 2,
  era: ARMADA_ERA,
  game: FBA_ENGINE_GAME,
  studio: "grudge-studio",
  camera: {
    id: "fba-iso-fixed",
    mode: "arpg" as const,
    orthoSpan: 18,
  },
  controller: {
    id: "fba-isometric-hero",
    animationLibraryId: "kaykit-bountyrush",
  },
  pipeline: {
    cdnBase: typeof window !== "undefined" ? window.location.origin : FLEET.deployUrl,
    models: "/models",
    gamedata: "/api/gamedata",
    assetsCdn: FLEET.assets,
  },
  fleet: FBA_FLEET_CONNECTIONS,
  origin: typeof window !== "undefined" ? FLARE_ORIGIN : FLEET.deployUrl,
} as const;

export function bootArmadaEngine(): typeof FBA_ARMADA_MANIFEST {
  if (typeof localStorage !== "undefined") {
    localStorage.setItem("grudge:engine-era", ARMADA_ERA);
    localStorage.setItem("grudge:active-game", FBA_ENGINE_GAME.id);
    localStorage.setItem("grudge:engine-version", String(FBA_ARMADA_MANIFEST.version));
    try {
      localStorage.setItem(
        "grudge:engine-mp-url",
        getMpServerUrl(),
      );
      localStorage.setItem(
        "grudge:engine-leaderboard-url",
        getLeaderboardApiBase(),
      );
    } catch {
      /* ignore */
    }
  }
  // Expose for debug / dash
  if (typeof window !== "undefined") {
    (window as unknown as { __FBA_ENGINE__?: unknown }).__FBA_ENGINE__ = {
      ...FBA_ARMADA_MANIFEST,
      connections: getFleetConnections(),
      mpUrl: getMpServerUrl(),
      leaderboardUrl: getLeaderboardApiBase(),
    };
  }
  return FBA_ARMADA_MANIFEST;
}

export function getEngineMpUrl(): string {
  return getMpServerUrl();
}
