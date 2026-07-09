/**
 * Armada-era Grudge Engine manifest — local boot contract for Flare Boss Arena.
 * Mirrors survival/lib/grudge-engine armada-defaults (era=armada).
 */

export const ARMADA_ERA = "armada" as const;

export const FBA_ENGINE_GAME = {
  id: "flare-boss-arena",
  label: "Flare Boss Arena",
  route: "/game",
  deployUrl: "https://flare-boss-arena.vercel.app",
  package: "@workspace/grudge-game",
  modes: ["dungeon", "camp", "boss"] as const,
  playLoop: [
    "choose-fighter",
    "party",
    "equipment",
    "skills",
    "island-rounds",
    "boss-arena",
  ] as const,
};

/** Minimal client-side manifest slice used at dungeon boot. */
export const FBA_ARMADA_MANIFEST = {
  version: 1,
  era: ARMADA_ERA,
  game: FBA_ENGINE_GAME,
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
    cdnBase: typeof window !== "undefined" ? window.location.origin : "https://flare-boss-arena.vercel.app",
    models: "/models",
    gamedata: "/api/gamedata",
  },
} as const;

export function bootArmadaEngine(): typeof FBA_ARMADA_MANIFEST {
  if (typeof localStorage !== "undefined") {
    localStorage.setItem("grudge:engine-era", ARMADA_ERA);
    localStorage.setItem("grudge:active-game", FBA_ENGINE_GAME.id);
  }
  return FBA_ARMADA_MANIFEST;
}