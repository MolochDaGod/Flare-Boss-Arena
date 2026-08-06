/**
 * Codex production UI pack staged into Flare:
 *  - build-yourself sprite_pieces (slots / gems sheet)
 *  - roguelite status icons
 *  - cold-biome GLB accents (optional décor)
 *
 * Disk SSOT: D:\Games\Models\_codex_prod\ui\…
 * App path:  public/ui/codex/**
 */

import type { StoneEffectId } from "./stones";
import type { AttrKey } from "./fighters";

const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");

export function codexUrl(rel: string): string {
  return `${BASE}/ui/codex/${rel.replace(/^\//, "")}`;
}

export const CODEX_SPRITE_SHEET = codexUrl("sprites/sprite_pieces.png");

/** Roguelite status icon ids (128×128 PNGs). */
export const STATUS_ICON_IDS = [
  "bleed",
  "blind",
  "burn",
  "curse",
  "freeze",
  "haste",
  "invincible",
  "invisible",
  "lifesteal",
  "lucky",
  "poison",
  "rage",
  "regen",
  "shield",
  "silence",
  "slow",
  "strength",
  "stun",
  "thorns",
  "weakness",
] as const;

export type StatusIconId = (typeof STATUS_ICON_IDS)[number];

export function statusIconUrl(id: StatusIconId | string): string {
  return codexUrl(`status/${id}.png`);
}

/** Cold-biome décor GLBs (compact set for UI/scene accents). */
export const COLD_BIOME_PROPS = [
  { id: "groundice", file: "cold/groundice.glb", label: "Ice ground" },
  { id: "icycle", file: "cold/icycle.glb", label: "Icicle" },
  { id: "decoratedstone", file: "cold/decoratedstone.glb", label: "Rune stone" },
  { id: "axe", file: "cold/axe.glb", label: "Frost axe" },
  { id: "snowman", file: "cold/snowman.glb", label: "Snowman" },
  { id: "berrybush", file: "cold/berrybush.glb", label: "Berry bush" },
] as const;

export function coldBiomeUrl(file: string): string {
  return codexUrl(file);
}

/** Map stone effect ids → roguelite status art. */
export const EFFECT_STATUS_ICON: Partial<Record<StoneEffectId, StatusIconId>> = {
  damage: "strength",
  health: "regen",
  spell_damage: "curse",
  defense: "shield",
  magic_defense: "shield",
  crit: "lucky",
  speed: "haste",
  attack_speed: "haste",
  aoe: "rage",
  proc_bolt: "stun",
  proc_nova: "rage",
  proc_burn: "burn",
  proc_frost: "freeze",
  proc_shock: "stun",
  proc_blur: "invisible",
  proc_particles: "lucky",
  onslaught: "rage",
  life_on_hit: "lifesteal",
  mana: "regen",
  stat_boost: "strength",
};

/** Attribute socket → primary status icon for empty/filled chrome. */
export const ATTR_STATUS_ICON: Record<AttrKey, StatusIconId> = {
  strength: "strength",
  vitality: "regen",
  dexterity: "lucky",
  agility: "haste",
  endurance: "shield",
  intellect: "curse",
  tactics: "rage",
  wisdom: "freeze",
};

/** Cold frost UI tokens (equipment / ally chrome). */
export const CODEX_FROST = {
  panelBg: "linear-gradient(165deg, rgba(12,28,42,0.94) 0%, rgba(8,14,22,0.96) 55%, rgba(6,18,28,0.98) 100%)",
  panelBorder: "rgba(120, 190, 230, 0.35)",
  accent: "#7ec8e8",
  accentDim: "#4a8fb0",
  ice: "#b8e4ff",
  gold: "#c5a059",
  slotEmpty: "rgba(30, 50, 70, 0.85)",
  slotFill: "rgba(40, 70, 95, 0.9)",
  glow: "0 0 18px rgba(100, 180, 220, 0.25)",
} as const;
