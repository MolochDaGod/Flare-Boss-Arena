/**
 * Toon RTS / grudge6 **color sets** — author Materials/Colors practice.
 *
 * Author pack (Desktop grudgeproduction/Toon_RTS):
 *   WesternKingdoms/…/Colors/textures/WK_StandardUnits_{black,blue,brown,green,red,white}.tga
 *   Orcs/…/color/textures/ORC_StandardUnits_{black,blue,brown,green,red}.tga
 *   Elves/…/Color/DarkElves + WoodElves atlas variants
 *   BRB / DWF / UD brown sets
 *
 * Unity .mat recipe (from WK_Standard_Units_blue.mat):
 *   _Metallic: 0 · _Glossiness: 0 · _SpecularHighlights: Off
 *   _Color: white / soft grey (~0.86) — **team hue lives in the atlas**, not multiply
 *
 * Production:
 *   Standard atlas → assets CDN (existing RACE_ATLAS_PATHS)
 *   Color sets → staged webp under public/textures/grudge6/colors/ (author bake)
 *
 * @see skill toon-rts-author · grudge6-cdn-ssot
 */

import type { RaceId } from "./characterMeshes";
import type { AllyRole } from "./grudge6Roster";

const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
const ASSETS_CDN = "https://assets.grudge-studio.com";

/** Author color set keys (team / outfit dyes). */
export type ToonColorSet =
  | "standard"
  | "black"
  | "blue"
  | "brown"
  | "green"
  | "red"
  | "white"
  | "dark_red"
  | "dark_blue"
  | "dark_green"
  | "wood_brown";

export interface ToonColorSetDef {
  id: ToonColorSet;
  label: string;
  /** Local staged webp (author color atlas). */
  localRel?: string;
  /** Future CDN path once D1-registered. */
  cdnRel?: string;
  /** Soft multiply only when atlas missing (keep mild). */
  fallbackTint: number;
}

/** Material recipe matching author Standard shader (polyart). */
export const TOON_RTS_MATERIAL = {
  /** Unity _Color ~0.858–1.0 — keep white so atlas carries hue. */
  albedo: 0xffffff,
  metalness: 0,
  /** Glossiness 0 → roughness 1.0 (polyart matte). */
  roughness: 0.96,
  envMapIntensity: 0.15,
  /** Soft warm grey if we need a non-white plate. */
  plateAlbedo: 0xdbdbdb,
} as const;

/**
 * Per-race color sets available in author pack.
 * `standard` = default CDN production atlas (no color suffix).
 */
export const RACE_COLOR_SETS: Record<RaceId, ToonColorSet[]> = {
  human: ["standard", "blue", "red", "green", "black", "white", "brown"],
  orc: ["standard", "green", "red", "blue", "black", "brown"],
  elf: ["standard", "dark_red", "dark_blue", "dark_green", "wood_brown"],
  barbarian: ["standard", "brown"],
  dwarf: ["standard", "brown"],
  undead: ["standard", "brown"],
};

/** Staged local color atlases (converted from author TGA). */
const LOCAL_COLOR_ATLAS: Partial<Record<`${RaceId}:${ToonColorSet}`, string>> = {
  "human:blue": "textures/grudge6/colors/WK_StandardUnits_blue.webp",
  "human:red": "textures/grudge6/colors/WK_StandardUnits_red.webp",
  "human:green": "textures/grudge6/colors/WK_StandardUnits_green.webp",
  "human:black": "textures/grudge6/colors/WK_StandardUnits_black.webp",
  "orc:red": "textures/grudge6/colors/ORC_StandardUnits_red.webp",
  "orc:green": "textures/grudge6/colors/ORC_StandardUnits_green.webp",
  "orc:blue": "textures/grudge6/colors/ORC_StandardUnits_blue.webp",
  "elf:dark_red": "textures/grudge6/colors/ELF_DarkElves_Red.webp",
  "elf:dark_blue": "textures/grudge6/colors/ELF_DarkElves_Blue.webp",
  "elf:wood_brown": "textures/grudge6/colors/ELF_WoodElves_Brown.webp",
  "barbarian:brown": "textures/grudge6/colors/BRB_Standard_Units_brown.webp",
  "dwarf:brown": "textures/grudge6/colors/DWF_Units_Brown.webp",
  "undead:brown": "textures/grudge6/colors/UD_Standard_Units_brown.webp",
};

/** Mild tint only when a color atlas is unavailable. */
const FALLBACK_TINT: Record<ToonColorSet, number> = {
  standard: 0xffffff,
  black: 0xb0b0b8,
  blue: 0xc8d8ff,
  brown: 0xe8d4b8,
  green: 0xc8f0c8,
  red: 0xffc8c0,
  white: 0xffffff,
  dark_red: 0xe8b0c0,
  dark_blue: 0xc0b8e8,
  dark_green: 0xb8e0c8,
  wood_brown: 0xe0d0a8,
};

export function colorSetLabel(set: ToonColorSet): string {
  const labels: Record<ToonColorSet, string> = {
    standard: "Standard",
    black: "Black",
    blue: "Blue",
    brown: "Brown",
    green: "Green",
    red: "Red",
    white: "White",
    dark_red: "Dark Red",
    dark_blue: "Dark Blue",
    dark_green: "Dark Green",
    wood_brown: "Wood Brown",
  };
  return labels[set];
}

/**
 * Default color set by race + role — readable team identity in party/game.
 * Matches common Toon RTS “sets” usage (blue WK, green orc, dark elf red…).
 */
export function defaultColorSetForHero(opts: {
  race: RaceId;
  role?: AllyRole | string;
  faction?: string;
}): ToonColorSet {
  const { race, role, faction } = opts;
  const f = (faction ?? "").toUpperCase();

  if (race === "human") {
    if (role === "healer") return "white";
    if (role === "ranger") return "green";
    if (role === "bruiser" || role === "tank") return "red";
    if (role === "skirmisher") return "black";
    return "blue"; // fighter / default kingdom blue
  }
  if (race === "orc") {
    if (role === "healer") return "blue";
    if (role === "ranger" || role === "skirmisher") return "black";
    if (role === "bruiser") return "red";
    return "green";
  }
  if (race === "elf") {
    if (/wood|ELF_W/i.test(f) || role === "ranger") return "wood_brown";
    if (/dark|UD|void/i.test(f) || role === "skirmisher") return "dark_red";
    if (role === "healer") return "dark_blue";
    return "dark_green";
  }
  if (race === "barbarian" || race === "dwarf" || race === "undead") return "brown";
  return "standard";
}

/** Resolve atlas URL for race + color set (local color first, else CDN standard). */
export function raceColorAtlasUrl(race: RaceId, colorSet: ToonColorSet = "standard"): {
  url: string;
  source: "local_color" | "cdn_standard";
  colorSet: ToonColorSet;
  tint: number;
} {
  if (colorSet !== "standard") {
    const key = `${race}:${colorSet}` as keyof typeof LOCAL_COLOR_ATLAS;
    const rel = LOCAL_COLOR_ATLAS[key];
    if (rel) {
      return {
        url: `${BASE}/${rel}`,
        source: "local_color",
        colorSet,
        tint: 0xffffff, // hue in atlas
      };
    }
  }
  // Standard CDN path handled by caller via raceAtlasUrl — return placeholder
  return {
    url: "",
    source: "cdn_standard",
    colorSet: colorSet === "standard" ? "standard" : colorSet,
    tint: FALLBACK_TINT[colorSet] ?? 0xffffff,
  };
}

export function localColorAtlasRel(race: RaceId, colorSet: ToonColorSet): string | null {
  if (colorSet === "standard") return null;
  return LOCAL_COLOR_ATLAS[`${race}:${colorSet}` as keyof typeof LOCAL_COLOR_ATLAS] ?? null;
}

export function colorAtlasPublicUrl(race: RaceId, colorSet: ToonColorSet): string | null {
  const rel = localColorAtlasRel(race, colorSet);
  return rel ? `${BASE}/${rel}` : null;
}

/** CDN standard atlas (existing production). */
export function cdnStandardAtlasUrl(cdnRel: string): string {
  return `${ASSETS_CDN}/${cdnRel.replace(/^\//, "")}`;
}
