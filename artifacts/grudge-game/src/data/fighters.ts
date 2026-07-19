/**
 * Playable fighters — the One Piece champions (and Racalvin, the Corsair King)
 * offered on the "Choose Fighter" lobby.
 *
 * Selecting a fighter FULLY becomes the player's character: its model is loaded
 * consistently across the Dungeon / Camp / Boss scenes, and its `stats` drive
 * the War Panel attribute block. The selection is global (one active fighter per
 * account, persisted in localStorage) — NOT per-API-character.
 *
 * Each fighter references a `skinId` from `data/skins.ts` (the GLB model + its
 * native animation scheme). Every fighter on the roster animates: the
 * bounty-rush skins ship labelled idle/run/attack clips, and `koby` ships
 * cryptic numeric clips wired (idle/run/cast + a blended jump attack) via the
 * "koby" scheme. Animationless models are not offered as fighters.
 */

import { SKINS, getSkin, type SkinDef } from "./skins";
import { ANNIHILATE_FIGHTERS } from "./annihilateHeroes";

export type AttrKey =
  | "strength"
  | "vitality"
  | "dexterity"
  | "agility"
  | "endurance"
  | "intellect"
  | "tactics"
  | "wisdom";

export const ATTR_ORDER: AttrKey[] = [
  "strength",
  "vitality",
  "dexterity",
  "agility",
  "endurance",
  "intellect",
  "tactics",
  "wisdom",
];

export interface FighterDef {
  /** Stable id (matches the skin id for One Piece fighters). */
  id: string;
  /** Display name. */
  name: string;
  /** Short epithet shown under the name. */
  title: string;
  /** Archetype / class label. */
  role: string;
  /** One-line flavour blurb. */
  blurb: string;
  /** Model to load (skin id in data/skins.ts). */
  skinId: string;
  /** Default attributes (1–10 scale). */
  stats: Record<AttrKey, number>;
  /** Featured (e.g. Racalvin) — surfaced first on the lobby. */
  featured?: boolean;
}

const S = (
  strength: number,
  vitality: number,
  dexterity: number,
  agility: number,
  endurance: number,
  intellect: number,
  tactics: number,
  wisdom: number,
): Record<AttrKey, number> => ({
  strength,
  vitality,
  dexterity,
  agility,
  endurance,
  intellect,
  tactics,
  wisdom,
});

/** Racalvin is the bespoke Corsair King hero — its model is NOT a `skins.ts`
 *  entry; the 3D scenes special-case this id to load `models/racalvin/`. */
export const RACALVIN_ID = "racalvin";

export const FIGHTERS: FighterDef[] = [
  {
    id: RACALVIN_ID,
    name: "Racalvin",
    title: "King of Pirates",
    role: "Corsair King",
    blurb:
      "The Corsair King himself — a towering warlord who carries the Brothers' Keeper greatblade into every grudge.",
    skinId: RACALVIN_ID,
    stats: S(10, 9, 7, 7, 9, 6, 8, 7),
    featured: true,
  },
  {
    id: "nightmare_luffy",
    name: "Luffy",
    title: "Nightmare",
    role: "Rubber Brawler",
    blurb: "A relentless close-range fighter who overwhelms with rapid rubber strikes.",
    skinId: "nightmare_luffy",
    stats: S(8, 7, 6, 9, 7, 3, 5, 4),
  },
  {
    id: "ace_sabo_luffy",
    name: "Ace · Sabo · Luffy",
    title: "Brothers' Bond",
    role: "Trio Vanguard",
    blurb: "Three sworn brothers fighting as one — balanced power across every front.",
    skinId: "ace_sabo_luffy",
    stats: S(8, 8, 7, 8, 8, 6, 7, 6),
    featured: true,
  },
  {
    id: "shanks",
    name: "Shanks",
    title: "Red-Haired Captain",
    role: "Swordsman",
    blurb: "A rising pirate captain — Haki-coated cuts and a growing Conqueror's edge. R: Conqueror's Slash.",
    skinId: "shanks",
    stats: S(7, 7, 7, 7, 7, 6, 7, 6),
  },
  {
    id: "shanks_yonko",
    name: "Shanks",
    title: "Yonko Emperor",
    role: "Emperor",
    blurb: "Final form — one of the Four Emperors. Ultimate R: Divine Departure severs the horizon.",
    skinId: "shanks_yonko",
    stats: S(10, 9, 8, 8, 9, 8, 10, 9),
    featured: true,
  },
  {
    id: "law",
    name: "Trafalgar Law",
    title: "Surgeon of Death",
    role: "Tactician",
    blurb: "Warps space with the Op-Op fruit; rewards precise, cerebral play.",
    skinId: "law",
    stats: S(6, 6, 7, 7, 6, 9, 9, 8),
  },
  {
    id: "lucci",
    name: "Lucci",
    title: "CP0 Assassin",
    role: "Assassin",
    blurb: "Base form — lightning Rokushiki. R: Rokuogan shock fist.",
    skinId: "lucci",
    stats: S(6, 6, 8, 8, 6, 5, 6, 5),
  },
  {
    id: "lucci_awakened",
    name: "Lucci",
    title: "Awakened Leopard",
    role: "Beast Assassin",
    blurb: "Evolved zoan — awakened claws and Impel Down fury. Ultimate R: Awakened Rokuogan.",
    skinId: "lucci_awakened",
    stats: S(9, 7, 9, 9, 7, 5, 7, 5),
    featured: true,
  },
  {
    id: "smoker",
    name: "Smoker",
    title: "White Hunter",
    role: "Warden",
    blurb: "An immovable Marine wall of smoke that grinds enemies down.",
    skinId: "smoker",
    stats: S(7, 9, 6, 5, 9, 5, 7, 6),
  },
  {
    id: "sanji_onigashima",
    name: "Sanji",
    title: "Black Leg",
    role: "Striker",
    blurb: "Burning kicks delivered with impossible agility.",
    skinId: "sanji_onigashima",
    stats: S(7, 6, 7, 9, 7, 5, 6, 5),
  },
  {
    id: "ryuma",
    name: "Ryuma",
    title: "Sword God",
    role: "Swordmaster",
    blurb: "A legendary samurai whose blade has never known defeat.",
    skinId: "ryuma",
    stats: S(9, 7, 8, 7, 7, 5, 7, 6),
  },
  {
    id: "page_one",
    name: "Page One",
    title: "Spinosaurus",
    role: "Dragon Brute",
    blurb: "An ancient-zoan juggernaut that trades finesse for raw devastation.",
    skinId: "page_one",
    stats: S(9, 9, 5, 6, 9, 3, 4, 3),
  },
  {
    id: "marco",
    name: "Marco",
    title: "The Phoenix",
    role: "Phoenix Guardian",
    blurb: "Blue regenerative flames keep him fighting long past defeat.",
    skinId: "marco",
    stats: S(6, 9, 6, 7, 8, 6, 7, 9),
  },
  {
    id: "shiryu",
    name: "Shiryu",
    title: "of the Rain",
    role: "Blademaster",
    blurb: "Base form — rain-soaked ambush cuts. R: Rain Blade Wave.",
    skinId: "shiryu",
    stats: S(7, 6, 7, 7, 6, 5, 5, 5),
  },
  {
    id: "shiryu_clear",
    name: "Shiryu",
    title: "Clear-Clear Fruit",
    role: "Phantom Blade",
    blurb: "Final form — invisible assassin of Impel Down. Ultimate R: Clear-Clear Annihilation.",
    skinId: "shiryu_clear",
    stats: S(9, 6, 9, 9, 6, 5, 7, 5),
    featured: true,
  },
  {
    id: "marine_mullet",
    name: "Marine Grunt",
    title: "Musketeer",
    role: "Gunner",
    blurb: "A rank-and-file Marine handy with a musket at range.",
    skinId: "marine_mullet",
    stats: S(4, 5, 7, 5, 5, 4, 5, 4),
  },
  {
    id: "koby",
    name: "Koby",
    title: "Marine Recruit",
    role: "Recruit",
    blurb: "Base form — earnest fists learning justice. R: Honesty Impact.",
    skinId: "koby",
    stats: S(4, 5, 5, 5, 5, 6, 6, 6),
  },
  {
    id: "koby_hero",
    name: "Koby",
    title: "Marine Hero",
    role: "Captain",
    blurb: "Evolved — the hero who stood at Marineford. Ultimate R: Hero's Justice.",
    skinId: "koby_hero",
    stats: S(7, 7, 7, 7, 7, 7, 8, 7),
  },
  {
    id: "mihawk",
    name: "Mihawk",
    title: "World's Strongest Swordsman",
    role: "Swordmaster",
    blurb: "Yoru cleaves horizons — every slash is a lesson in absolute mastery.",
    skinId: "mihawk",
    stats: S(10, 7, 10, 8, 7, 6, 9, 7),
    featured: true,
  },
  {
    id: "kizaru",
    name: "Kizaru",
    title: "Marine Admiral",
    role: "Light Admiral",
    blurb: "Moves at the speed of light — laser kicks and photon judgment from range.",
    skinId: "kizaru",
    stats: S(8, 7, 9, 10, 6, 7, 8, 6),
    featured: true,
  },
  {
    id: "fujitora_marijoa",
    name: "Fujitora",
    title: "Gravity Admiral",
    role: "Gravity Knight",
    blurb: "Blind justice that crushes foes under meteoric gravitational force.",
    skinId: "fujitora_marijoa",
    stats: S(9, 8, 6, 5, 9, 8, 9, 8),
  },
  {
    id: "vista",
    name: "Vista",
    title: "Flower Sword",
    role: "Commander",
    blurb: "Whitebeard's fifth division commander — elegant two-sword flourishes.",
    skinId: "vista",
    stats: S(8, 7, 8, 7, 7, 5, 7, 6),
  },
  {
    id: "charlotte_oven",
    name: "Oven",
    title: "Heat Commander",
    role: "Pyro Brute",
    blurb: "Netsu Netsu no Mi — superheated palms that melt armor and terrain.",
    skinId: "charlotte_oven",
    stats: S(9, 8, 6, 5, 8, 4, 5, 4),
  },
  {
    id: "hybrid_kaido",
    name: "Kaido",
    title: "Hybrid Emperor",
    role: "Dragon Emperor",
    blurb: "Apex form — strongest creature alive. Ultimate R: Boro Breath.",
    skinId: "hybrid_kaido",
    stats: S(10, 10, 6, 5, 10, 5, 6, 5),
    featured: true,
  },
  {
    id: "ikkaku_madarame",
    name: "Madarame",
    title: "Ikkaku",
    role: "Spear Fighter",
    blurb:
      "Grudge Studio visual shell — Madarame mesh with shared weapon/class skills. Combat uses fleet systems, not character-exclusive animations.",
    skinId: "ikkaku_madarame",
    stats: S(8, 8, 7, 7, 8, 5, 7, 6),
    featured: true,
  },
  // ── Annihilate / Warlords 24 (skill creation + MOBA + dungeon) ──
  ...ANNIHILATE_FIGHTERS,
];

export const DEFAULT_FIGHTER_ID = "nightmare_luffy";

export function getFighter(id: string | null | undefined): FighterDef | undefined {
  if (!id) return undefined;
  return FIGHTERS.find((f) => f.id === id);
}

/** The skin model backing a fighter. */
export function fighterSkin(f: FighterDef): SkinDef | undefined {
  return getSkin(f.skinId);
}

/* ── Global active-fighter selection (localStorage) ───────────────────────── */

const ACTIVE_KEY = "grudge:fighter";

export function getActiveFighterId(): string | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(ACTIVE_KEY);
}

export function setActiveFighterId(id: string | null) {
  if (typeof localStorage === "undefined") return;
  if (id) localStorage.setItem(ACTIVE_KEY, id);
  else localStorage.removeItem(ACTIVE_KEY);
}

/** Resolve the active fighter, falling back to the default roster entry. */
export function getActiveFighter(): FighterDef {
  return getFighter(getActiveFighterId()) ?? getFighter(DEFAULT_FIGHTER_ID) ?? FIGHTERS[0];
}

/** Skin id to load for the active fighter (used by the 3D scenes). */
export function getActiveFighterSkinId(): string {
  return getActiveFighter().skinId;
}

void SKINS;
