/**
 * Playable champion skins (imported One Piece models).
 *
 * Each skin GLB lives at `${BASE_URL}models/skins/<file>.glb` and is fully
 * rigged with its OWN animation clips. The bounty-rush models share a clean,
 * labelled clip scheme:
 *
 *   pl_<name>_<variant>_idle_a   → idle
 *   pl_<name>_<variant>_run      → locomotion
 *   pl_<name>_<variant>_combo_a  → attack
 *   pl_<name>_<variant>_damage   → hurt (unused for now)
 *
 * We therefore match clips by SUFFIX (endsWith) so the per-file prefix doesn't
 * matter. `koby` ships only cryptic numeric clips (0011, 0012…) with no usable
 * labels, so it falls back to playing its first clip as a static idle.
 */

export type SkinScheme = "bountyrush" | "cryptic";

export interface SkinDef {
  id: string;
  name: string;
  file: string;
  scheme: SkinScheme;
  /** Target standing height in world units (model is uniformly scaled to fit). */
  height?: number;
}

export const SKINS: SkinDef[] = [
  { id: "nightmare_luffy", name: "Luffy — Nightmare", file: "nightmare_luffy", scheme: "bountyrush" },
  { id: "law",            name: "Trafalgar Law",     file: "law",            scheme: "bountyrush" },
  { id: "lucci",          name: "Rob Lucci",         file: "lucci",          scheme: "bountyrush" },
  { id: "smoker",         name: "Smoker",            file: "smoker",         scheme: "bountyrush" },
  { id: "sanji_onigashima", name: "Sanji",           file: "sanji_onigashima", scheme: "bountyrush" },
  { id: "ryuma",          name: "Ryuma",             file: "ryuma",          scheme: "bountyrush" },
  { id: "page_one",       name: "Page One",          file: "page_one",       scheme: "bountyrush" },
  { id: "marco",          name: "Marco",             file: "marco",          scheme: "bountyrush" },
  { id: "jozu",           name: "Jozu",              file: "jozu",           scheme: "bountyrush" },
  { id: "mr_5",           name: "Mr. 5",             file: "mr_5",           scheme: "bountyrush" },
  { id: "marine_mullet",  name: "Marine Grunt",      file: "marine_mullet",  scheme: "bountyrush" },
  { id: "shiryu",         name: "Shiryu",            file: "shiryu",         scheme: "bountyrush" },
  { id: "ace_sabo_luffy", name: "Ace · Sabo · Luffy", file: "ace_sabo_luffy", scheme: "bountyrush" },
  { id: "koby",           name: "Koby",              file: "koby",           scheme: "cryptic" },
];

export function getSkin(id: string | null | undefined): SkinDef | undefined {
  if (!id) return undefined;
  return SKINS.find((s) => s.id === id);
}

export function skinUrl(def: SkinDef): string {
  const base = import.meta.env.BASE_URL ?? "/";
  return `${base}models/skins/${def.file}.glb`;
}

/** Clip-name suffixes for the bounty-rush labelled scheme. */
export const SKIN_CLIP_SUFFIX = {
  idle: ["_idle_a", "_idlehome_a"],
  walk: ["_run"],
  attack: ["_combo_a", "_combo_b", "_skill_a"],
} as const;

/* ── Per-character selected skin (localStorage) ───────────────────────────── */

const SKIN_KEY = (charId: string | number) => `grudge:skin:${charId}`;

export function getSelectedSkin(charId: string | number): string | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(SKIN_KEY(charId));
}

export function setSelectedSkin(charId: string | number, skinId: string | null) {
  if (typeof localStorage === "undefined") return;
  if (skinId) localStorage.setItem(SKIN_KEY(charId), skinId);
  else localStorage.removeItem(SKIN_KEY(charId));
}
