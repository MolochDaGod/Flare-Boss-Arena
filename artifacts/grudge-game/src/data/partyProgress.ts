/**
 * Party progression — game-earned ally unlocks, ranks, and spellbook ally skills.
 *
 * Extends grudge6Roster + skillBooks (not a parallel roster).
 * Currencies: gold (dungeon/boss loot) for recruit + rank + equip books.
 * Spell primers (CraftPix pack) are **ally skill tomes**, not free player unlocks.
 */

import {
  GRUDGE6_BY_ID,
  GRUDGE6_HEROES,
  MAX_PARTY_ALLIES,
  getPartyAllyIds,
  setPartyAllyIds,
  suggestParty,
  type AllyRole,
  type Grudge6HeroDef,
} from "./grudge6Roster";
import { getWallet, saveWallet } from "./wallet";
import {
  FIRST_SKILL_BOOKS,
  type FirstBookDef,
  type SpellSchoolId,
  pickSpellbookIconForSkill,
  schoolById,
  spellbookIconUrl,
} from "./spellbookAssets";
import { getLearnedBookIds, isBookLearned } from "./skillBooks";

const STATE_KEY = "flare:party:progress:v1";
export const MAX_ALLY_RANK = 5;
export const MAX_ALLY_SKILL_SLOTS = 2;

/** Role → primary elemental school for ally skill tomes. */
export const ROLE_SCHOOL: Record<AllyRole, SpellSchoolId> = {
  unarmed: "earth",
  healer: "water",
  tank: "earth",
  ranger: "air",
  bruiser: "fire",
  fighter: "fire",
  skirmisher: "air",
};

export interface AllySkillDef {
  id: string;
  bookId: string;
  school: SpellSchoolId;
  name: string;
  blurb: string;
  /** Combat modifiers applied when equipped. */
  mods: {
    damageFlat: number;
    damageMult: number;
    healFlat: number;
    healMult: number;
    hpMult: number;
    attackCdMult: number;
    rangeFlat: number;
    skillMultBonus: number;
  };
  iconId?: string;
}

/** Built from firstBooks + school flavor — ally combat skills, not player hotbar. */
export function allySkillsFromBooks(): AllySkillDef[] {
  return FIRST_SKILL_BOOKS.flatMap((book) => {
    const school = book.school;
    const base = schoolMods(school);
    return book.unlockSkillIds.map((sid, i) => {
      const icon = pickSpellbookIconForSkill({
        skillId: sid,
        skillName: sid,
        element: school,
      });
      const name = humanizeSkillId(sid);
      return {
        id: sid,
        bookId: book.id,
        school,
        name,
        blurb:
          i === 0
            ? `${book.title}: primary ${school} art for allies.`
            : `${book.title}: secondary ${school} ward for allies.`,
        mods: i === 0 ? base.primary : base.secondary,
        iconId: icon?.id,
      };
    });
  });
}

function schoolMods(school: SpellSchoolId): {
  primary: AllySkillDef["mods"];
  secondary: AllySkillDef["mods"];
} {
  const z = {
    damageFlat: 0,
    damageMult: 1,
    healFlat: 0,
    healMult: 1,
    hpMult: 1,
    attackCdMult: 1,
    rangeFlat: 0,
    skillMultBonus: 0,
  };
  switch (school) {
    case "fire":
      return {
        primary: { ...z, damageFlat: 6, damageMult: 1.12, skillMultBonus: 0.12 },
        secondary: { ...z, damageMult: 1.08, skillMultBonus: 0.08, hpMult: 1.05 },
      };
    case "water":
      return {
        primary: { ...z, healFlat: 18, healMult: 1.2, skillMultBonus: 0.1 },
        secondary: { ...z, healFlat: 10, healMult: 1.1, hpMult: 1.08 },
      };
    case "earth":
      return {
        primary: { ...z, hpMult: 1.22, damageFlat: 3, skillMultBonus: 0.06 },
        secondary: { ...z, hpMult: 1.12, damageMult: 1.05 },
      };
    case "air":
      return {
        primary: { ...z, attackCdMult: 0.88, rangeFlat: 1.2, skillMultBonus: 0.1 },
        secondary: { ...z, attackCdMult: 0.92, rangeFlat: 0.6, damageMult: 1.06 },
      };
  }
}

function humanizeSkillId(id: string): string {
  return id
    .replace(/^(fire|water|earth|air)_/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export const ALLY_SKILL_BY_ID = new Map(allySkillsFromBooks().map((s) => [s.id, s]));

export interface AllyProgress {
  /** 0–MAX_ALLY_RANK */
  rank: number;
  /** Equipped ally skill ids (from spell books). Max MAX_ALLY_SKILL_SLOTS. */
  skills: string[];
}

export interface PartyProgressState {
  /** Ally hero ids permanently unlocked (recruited). */
  unlocked: string[];
  /** Per-ally rank + equipped skills. */
  allies: Record<string, AllyProgress>;
}

function freeStarterIds(): string[] {
  return suggestParty(2).map((h) => h.id);
}

function defaultState(): PartyProgressState {
  const free = freeStarterIds();
  const allies: Record<string, AllyProgress> = {};
  for (const id of free) allies[id] = { rank: 0, skills: [] };
  return { unlocked: [...free], allies };
}

function load(): PartyProgressState {
  if (typeof localStorage === "undefined") return defaultState();
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) {
      const d = defaultState();
      save(d);
      return d;
    }
    const parsed = { ...defaultState(), ...JSON.parse(raw) } as PartyProgressState;
    // Always ensure starter free unlocks
    const free = freeStarterIds();
    const unlocked = new Set([...parsed.unlocked, ...free].filter((id) => GRUDGE6_BY_ID.has(id)));
    parsed.unlocked = [...unlocked];
    if (!parsed.allies) parsed.allies = {};
    for (const id of free) {
      if (!parsed.allies[id]) parsed.allies[id] = { rank: 0, skills: [] };
    }
    return parsed;
  } catch {
    return defaultState();
  }
}

function save(s: PartyProgressState) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STATE_KEY, JSON.stringify(s));
}

export function getPartyProgress(): PartyProgressState {
  return load();
}

export function isAllyUnlocked(heroId: string): boolean {
  return load().unlocked.includes(heroId);
}

export function getAllyProgress(heroId: string): AllyProgress {
  const s = load();
  return s.allies[heroId] ?? { rank: 0, skills: [] };
}

/** Gold cost to recruit a locked ally — scales with role value. */
export function recruitCost(hero: Grudge6HeroDef): number {
  const roleBase: Record<AllyRole, number> = {
    unarmed: 80,
    fighter: 140,
    skirmisher: 180,
    ranger: 220,
    bruiser: 260,
    healer: 300,
    tank: 300,
  };
  return roleBase[hero.role] + hero.index * 8;
}

/** Gold cost to raise rank (next level). */
export function rankUpgradeCost(currentRank: number): number {
  if (currentRank >= MAX_ALLY_RANK) return 0;
  return 90 + (currentRank + 1) * 70;
}

/** Gold cost to equip an already-studied book skill onto an ally. */
export function equipSkillCost(): number {
  return 40;
}

export function recruitAlly(heroId: string): { ok: boolean; message: string } {
  const hero = GRUDGE6_BY_ID.get(heroId);
  if (!hero) return { ok: false, message: "Unknown ally." };
  const s = load();
  if (s.unlocked.includes(heroId)) return { ok: false, message: "Already recruited." };
  const cost = recruitCost(hero);
  const w = getWallet();
  if (w.gold < cost) return { ok: false, message: `Need ${cost} gold (earned in dungeon/boss).` };
  saveWallet({ ...w, gold: w.gold - cost });
  s.unlocked.push(heroId);
  if (!s.allies[heroId]) s.allies[heroId] = { rank: 0, skills: [] };
  save(s);
  return { ok: true, message: `Recruited ${hero.displayName} (−${cost} gold).` };
}

export function upgradeAllyRank(heroId: string): { ok: boolean; message: string } {
  if (!isAllyUnlocked(heroId)) return { ok: false, message: "Recruit ally first." };
  const s = load();
  const st = s.allies[heroId] ?? { rank: 0, skills: [] };
  if (st.rank >= MAX_ALLY_RANK) return { ok: false, message: `Max rank ${MAX_ALLY_RANK}.` };
  const cost = rankUpgradeCost(st.rank);
  const w = getWallet();
  if (w.gold < cost) return { ok: false, message: `Need ${cost} gold.` };
  saveWallet({ ...w, gold: w.gold - cost });
  st.rank += 1;
  s.allies[heroId] = st;
  save(s);
  const name = GRUDGE6_BY_ID.get(heroId)?.displayName ?? heroId;
  return { ok: true, message: `${name} → rank ${st.rank} (−${cost} gold).` };
}

export function equipAllySkill(
  heroId: string,
  skillId: string,
): { ok: boolean; message: string } {
  if (!isAllyUnlocked(heroId)) return { ok: false, message: "Recruit ally first." };
  const skill = ALLY_SKILL_BY_ID.get(skillId);
  if (!skill) return { ok: false, message: "Unknown ally skill." };
  if (!isBookLearned(skill.bookId)) {
    return { ok: false, message: "Study the spellbook primer first (Skills → Ally Tomes)." };
  }
  const hero = GRUDGE6_BY_ID.get(heroId);
  if (!hero) return { ok: false, message: "Unknown ally." };
  // Soft affinity: prefer matching school, allow any with note
  const s = load();
  const st = s.allies[heroId] ?? { rank: 0, skills: [] };
  if (st.skills.includes(skillId)) return { ok: false, message: "Already equipped." };
  if (st.skills.length >= MAX_ALLY_SKILL_SLOTS) {
    return { ok: false, message: `Max ${MAX_ALLY_SKILL_SLOTS} ally skills — unequip one.` };
  }
  const cost = equipSkillCost();
  const w = getWallet();
  if (w.gold < cost) return { ok: false, message: `Need ${cost} gold to bind skill.` };
  saveWallet({ ...w, gold: w.gold - cost });
  st.skills = [...st.skills, skillId];
  s.allies[heroId] = st;
  save(s);
  const affinity =
    ROLE_SCHOOL[hero.role] === skill.school ? "affinity match" : "off-role (weaker synergy)";
  return {
    ok: true,
    message: `Bound ${skill.name} on ${hero.displayName} (${affinity}).`,
  };
}

export function unequipAllySkill(heroId: string, skillId: string): void {
  const s = load();
  const st = s.allies[heroId];
  if (!st) return;
  st.skills = st.skills.filter((x) => x !== skillId);
  s.allies[heroId] = st;
  save(s);
}

export type ResolvedAllyKit = Grudge6HeroDef["kit"] & {
  maxHpBonus: number;
  equippedSkillIds: string[];
  rank: number;
};

/** Resolve base role kit + rank + equipped spellbook ally skills for combat. */
export function resolveAllyKit(heroId: string): ResolvedAllyKit | null {
  const hero = GRUDGE6_BY_ID.get(heroId);
  if (!hero) return null;
  const prog = getAllyProgress(heroId);
  const kit = { ...hero.kit };
  // Rank: +8% damage/heal/skill per rank, slight CD cut
  const r = prog.rank;
  kit.damage = Math.round(kit.damage * (1 + r * 0.08) + r * 1.5);
  kit.healAmount = kit.healAmount > 0 ? Math.round(kit.healAmount * (1 + r * 0.1) + r * 4) : 0;
  kit.skillMult = kit.skillMult * (1 + r * 0.05);
  kit.attackCd = Math.max(0.55, kit.attackCd * (1 - r * 0.03));
  kit.attackRange = kit.attackRange + r * 0.15;

  let maxHpBonus = r * 18;
  const preferred = ROLE_SCHOOL[hero.role];

  for (const sid of prog.skills) {
    const sk = ALLY_SKILL_BY_ID.get(sid);
    if (!sk) continue;
    const affinity = sk.school === preferred ? 1 : 0.72;
    const m = sk.mods;
    kit.damage = Math.round(kit.damage * (1 + (m.damageMult - 1) * affinity) + m.damageFlat * affinity);
    if (kit.healAmount > 0 || m.healFlat > 0) {
      kit.healAmount = Math.round(
        (kit.healAmount || 0) * (1 + (m.healMult - 1) * affinity) + m.healFlat * affinity,
      );
    }
    kit.skillMult *= 1 + m.skillMultBonus * affinity;
    kit.attackCd = Math.max(0.5, kit.attackCd * (1 - (1 - m.attackCdMult) * affinity));
    kit.attackRange += m.rangeFlat * affinity;
    maxHpBonus += Math.round(40 * (m.hpMult - 1) * affinity);
  }

  return {
    ...kit,
    maxHpBonus,
    equippedSkillIds: [...prog.skills],
    rank: prog.rank,
  };
}

/** List recruitable roster with unlock + progress for Party UI. */
export function listPartyRoster(): Array<
  Grudge6HeroDef & {
    unlocked: boolean;
    inParty: boolean;
    rank: number;
    skills: AllySkillDef[];
    recruitGold: number;
    nextRankGold: number;
    preferredSchool: SpellSchoolId;
    resolved: ResolvedAllyKit;
  }
> {
  const s = load();
  const party = new Set(getPartyAllyIds());
  const unlocked = new Set(s.unlocked);
  return GRUDGE6_HEROES.map((h) => {
    const prog = s.allies[h.id] ?? { rank: 0, skills: [] };
    const skills = prog.skills
      .map((id) => ALLY_SKILL_BY_ID.get(id))
      .filter((x): x is AllySkillDef => !!x);
    const resolved = resolveAllyKit(h.id)!;
    return {
      ...h,
      unlocked: unlocked.has(h.id),
      inParty: party.has(h.id),
      rank: prog.rank,
      skills,
      recruitGold: recruitCost(h),
      nextRankGold: rankUpgradeCost(prog.rank),
      preferredSchool: ROLE_SCHOOL[h.role],
      resolved,
    };
  });
}

/** Available ally skills player can equip (book studied). */
export function listAvailableAllySkills(heroId?: string): Array<
  AllySkillDef & {
    studied: boolean;
    equipped: boolean;
    iconUrl: string | null;
    schoolLabel: string;
    accent: string;
    affinity: boolean;
  }
> {
  const learned = new Set(getLearnedBookIds());
  const equipped = new Set(heroId ? getAllyProgress(heroId).skills : []);
  const preferred = heroId ? ROLE_SCHOOL[GRUDGE6_BY_ID.get(heroId)?.role ?? "fighter"] : null;
  return allySkillsFromBooks().map((sk) => {
    const school = schoolById(sk.school);
    const icon = sk.iconId
      ? spellbookIconUrl(sk.iconId)
      : spellbookIconUrl(
          pickSpellbookIconForSkill({ skillId: sk.id, element: sk.school })?.id ?? "",
        );
    return {
      ...sk,
      studied: learned.has(sk.bookId),
      equipped: equipped.has(sk.id),
      iconUrl: icon,
      schoolLabel: school?.label ?? sk.school,
      accent: school?.accent ?? "#c5a059",
      affinity: preferred ? sk.school === preferred : true,
    };
  });
}

/**
 * Safe party toggle — only unlocked allies may enter the active 2 slots.
 */
export function togglePartyAllyGated(id: string): { ok: boolean; message: string; ids: string[] } {
  if (!GRUDGE6_BY_ID.has(id)) return { ok: false, message: "Unknown hero.", ids: getPartyAllyIds() };
  if (!isAllyUnlocked(id)) {
    return { ok: false, message: "Recruit this ally first (spend gold).", ids: getPartyAllyIds() };
  }
  let ids = getPartyAllyIds().filter((x) => isAllyUnlocked(x));
  if (ids.includes(id)) {
    ids = ids.filter((x) => x !== id);
    setPartyAllyIds(ids);
    return { ok: true, message: "Removed from party.", ids };
  }
  if (ids.length >= MAX_PARTY_ALLIES) {
    return { ok: false, message: `Max ${MAX_PARTY_ALLIES} allies in party.`, ids };
  }
  ids = [...ids, id];
  setPartyAllyIds(ids);
  return { ok: true, message: "Added to party.", ids };
}

/** Prune party selection if unlocks changed (e.g. corrupt storage). */
export function sanitizePartySelection(): string[] {
  const ids = getPartyAllyIds().filter((id) => isAllyUnlocked(id)).slice(0, 2);
  if (ids.length === 0) {
    const free = freeStarterIds().slice(0, 2);
    setPartyAllyIds(free);
    return free;
  }
  setPartyAllyIds(ids);
  return ids;
}

export function partyProgressSummary(): {
  unlocked: number;
  total: number;
  gold: number;
  activeRanks: number;
  skillsBound: number;
} {
  const s = load();
  let ranks = 0;
  let skills = 0;
  for (const id of s.unlocked) {
    const p = s.allies[id] ?? { rank: 0, skills: [] };
    ranks += p.rank;
    skills += p.skills.length;
  }
  return {
    unlocked: s.unlocked.length,
    total: GRUDGE6_HEROES.length,
    gold: getWallet().gold,
    activeRanks: ranks,
    skillsBound: skills,
  };
}
