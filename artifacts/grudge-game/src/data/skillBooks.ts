/**
 * Ally skill tomes — CraftPix spellbook primers that unlock **ally skills**.
 * Progress: localStorage flare:skillbooks:v1
 *
 * Studying a primer costs gold (earned in dungeon/boss). Equipping the resulting
 * skills onto party allies is handled in partyProgress.ts (Party page).
 */

import {
  FIRST_SKILL_BOOKS,
  type FirstBookDef,
  type SpellSchoolId,
  iconsForSchool,
  schoolById,
  spellbookIconUrl,
} from "./spellbookAssets";
import { getWallet, saveWallet } from "./wallet";

const STATE_KEY = "flare:skillbooks:v1";

/** Gold cost to study a first primer (ally skill tome). */
export const STUDY_TOME_GOLD = 160;

export interface SkillBookState {
  /** Book ids the player has studied (unlocked ally skill tomes). */
  learned: string[];
  /** Active school filter on grimoire UI. */
  focusSchool: SpellSchoolId | "all";
}

function defaultState(): SkillBookState {
  return { learned: [], focusSchool: "all" };
}

function load(): SkillBookState {
  if (typeof localStorage === "undefined") return defaultState();
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return defaultState();
    return { ...defaultState(), ...JSON.parse(raw) } as SkillBookState;
  } catch {
    return defaultState();
  }
}

function save(s: SkillBookState) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STATE_KEY, JSON.stringify(s));
}

export function getSkillBookState(): SkillBookState {
  return load();
}

export function isBookLearned(bookId: string): boolean {
  return load().learned.includes(bookId);
}

export function getLearnedBookIds(): string[] {
  return [...load().learned];
}

export function getFocusSchool(): SpellSchoolId | "all" {
  return load().focusSchool;
}

export function setFocusSchool(school: SpellSchoolId | "all") {
  const s = load();
  s.focusSchool = school;
  save(s);
}

export type LearnBookResult =
  | { ok: true; book: FirstBookDef; already: boolean; cost: number }
  | { ok: false; reason: "unknown_book" | "need_gold"; need?: number; have?: number };

/**
 * Study an ally skill tome — costs gold once.
 * Unlocks the book's skill ids for equipping on party allies (/party).
 */
export function learnSkillBook(bookId: string): LearnBookResult {
  const book = FIRST_SKILL_BOOKS.find((b) => b.id === bookId);
  if (!book) return { ok: false, reason: "unknown_book" };
  const s = load();
  if (s.learned.includes(bookId)) return { ok: true, book, already: true, cost: 0 };

  const w = getWallet();
  if (w.gold < STUDY_TOME_GOLD) {
    return {
      ok: false,
      reason: "need_gold",
      need: STUDY_TOME_GOLD,
      have: w.gold,
    };
  }
  saveWallet({ ...w, gold: w.gold - STUDY_TOME_GOLD });

  s.learned.push(bookId);
  if (s.focusSchool === "all") s.focusSchool = book.school;
  save(s);
  return { ok: true, book, already: false, cost: STUDY_TOME_GOLD };
}

export function listFirstBooks(): Array<
  FirstBookDef & {
    learned: boolean;
    coverIconUrl: string | null;
    schoolLabel: string;
    accent: string;
    studyCost: number;
    allySkillIds: string[];
  }
> {
  const learned = new Set(load().learned);
  return FIRST_SKILL_BOOKS.map((b) => {
    const school = schoolById(b.school);
    const cover = iconsForSchool(b.school)[0];
    return {
      ...b,
      learned: learned.has(b.id),
      coverIconUrl: cover ? spellbookIconUrl(cover.id) : null,
      schoolLabel: school?.label ?? b.school,
      accent: school?.accent ?? "#c5a059",
      studyCost: STUDY_TOME_GOLD,
      allySkillIds: [...b.unlockSkillIds],
    };
  });
}

/** True if any primer for this school is studied (opens school icon browser). */
export function schoolUnlocked(school: SpellSchoolId): boolean {
  const books = FIRST_SKILL_BOOKS.filter((b) => b.school === school);
  if (!books.length) return true;
  const learned = new Set(load().learned);
  return books.some((b) => learned.has(b.id));
}
