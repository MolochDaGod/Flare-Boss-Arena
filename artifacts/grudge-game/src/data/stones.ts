/**
 * Attribute stones — the only equipment in Flare Boss Arena.
 *
 * 8 colors = 8 attributes. Rarity gates how many effects a stone carries
 * (1 common → 5 legendary). Effects are either flat/stat or auto-procs
 * (projectiles, elemental pulses, blur bursts, etc.).
 */

import { ATTR_ORDER, type AttrKey } from "./fighters";

export type StoneRarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

export type StoneEffectId =
  | "stat_boost" // +attribute
  | "health"
  | "damage"
  | "spell_damage"
  | "defense"
  | "magic_defense"
  | "crit"
  | "speed"
  | "attack_speed"
  | "aoe"
  | "proc_bolt" // auto projectile on hit
  | "proc_nova" // auto AoE pulse on hit
  | "proc_burn"
  | "proc_frost"
  | "proc_shock"
  | "proc_blur" // brief i-frame-ish DR
  | "proc_particles" // VFX intensity / on-hit spark
  | "onslaught" // on kill attack speed
  | "life_on_hit"
  | "mana";

export interface StoneEffect {
  id: StoneEffectId;
  /** Magnitude — meaning depends on id (flat or 0–1 fraction). */
  value: number;
  label: string;
}

export interface AttributeStone {
  uid: string;
  attr: AttrKey;
  rarity: StoneRarity;
  name: string;
  /** 1–5 effects by rarity. */
  effects: StoneEffect[];
  itemLevel: number;
}

/** One equipped stone per attribute socket. */
export type StoneLoadout = Partial<Record<AttrKey, string>>; // attr → uid

export const STONE_META: Record<
  AttrKey,
  { label: string; color: string; hex: number; glyph: string; blurb: string }
> = {
  strength: { label: "Crimson", color: "#e23b3b", hex: 0xe23b3b, glyph: "🔴", blurb: "Power · physical damage" },
  vitality: { label: "Rose", color: "#ff6b9d", hex: 0xff6b9d, glyph: "💗", blurb: "Life · sustain" },
  dexterity: { label: "Amber", color: "#f0a020", hex: 0xf0a020, glyph: "🟠", blurb: "Crit · precision" },
  agility: { label: "Jade", color: "#3dd68c", hex: 0x3dd68c, glyph: "🟢", blurb: "Speed · attack rate" },
  endurance: { label: "Slate", color: "#8a9bb0", hex: 0x8a9bb0, glyph: "⚪", blurb: "Armor · physical defense" },
  intellect: { label: "Azure", color: "#4a9eff", hex: 0x4a9eff, glyph: "🔵", blurb: "Spell power · skills" },
  tactics: { label: "Violet", color: "#a855f7", hex: 0xa855f7, glyph: "🟣", blurb: "Skill CD · tactical edge" },
  wisdom: { label: "Moon", color: "#c4b5fd", hex: 0xc4b5fd, glyph: "💠", blurb: "Mana · magic defense" },
};

export const RARITY_RANK: Record<StoneRarity, number> = {
  common: 1,
  uncommon: 2,
  rare: 3,
  epic: 4,
  legendary: 5,
};

export const RARITY_COLOR: Record<StoneRarity, string> = {
  common: "#b0b0b0",
  uncommon: "#5ecf6a",
  rare: "#4a9eff",
  epic: "#c084fc",
  legendary: "#fbbf24",
};

export const RARITY_LABEL: Record<StoneRarity, string> = {
  common: "Common",
  uncommon: "Uncommon",
  rare: "Rare",
  epic: "Epic",
  legendary: "Legendary",
};

const STASH_KEY = "flare:stones:stash";
const LOADOUT_KEY = "flare:stones:loadout";

function uid() {
  return `st_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function mulberry(seed: number) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
}

function rollRarity(rng: () => number, boss: boolean): StoneRarity {
  const r = rng();
  if (boss) {
    if (r > 0.92) return "legendary";
    if (r > 0.7) return "epic";
    if (r > 0.35) return "rare";
    return "uncommon";
  }
  if (r > 0.97) return "legendary";
  if (r > 0.88) return "epic";
  if (r > 0.65) return "rare";
  if (r > 0.35) return "uncommon";
  return "common";
}

/** Effect pool weighted by attribute flavor. */
function effectPool(attr: AttrKey): Array<{ id: StoneEffectId; min: number; max: number; label: (v: number) => string; w: number }> {
  const shared = [
    { id: "stat_boost" as const, min: 1, max: 3, label: (v: number) => `+${Math.round(v)} ${attr}`, w: 12 },
    { id: "proc_particles" as const, min: 0.15, max: 0.45, label: (v: number) => `${Math.round(v * 100)}% on-hit sparks`, w: 6 },
  ];
  switch (attr) {
    case "strength":
      return [
        ...shared,
        { id: "damage", min: 4, max: 22, label: (v) => `+${Math.round(v)} Damage`, w: 14 },
        { id: "proc_nova", min: 0.08, max: 0.22, label: (v) => `${Math.round(v * 100)}% chance to Shockwave on Hit`, w: 5 },
        { id: "life_on_hit", min: 2, max: 8, label: (v) => `Recover ${Math.round(v)} Life on Hit`, w: 5 },
      ];
    case "vitality":
      return [
        ...shared,
        { id: "health", min: 25, max: 120, label: (v) => `+${Math.round(v)} Life`, w: 16 },
        { id: "life_on_hit", min: 3, max: 10, label: (v) => `Recover ${Math.round(v)} Life on Hit`, w: 7 },
        { id: "proc_blur", min: 0.06, max: 0.18, label: (v) => `${Math.round(v * 100)}% chance to Blur (DR) on Hit Taken`, w: 4 },
      ];
    case "dexterity":
      return [
        ...shared,
        { id: "crit", min: 0.03, max: 0.12, label: (v) => `+${Math.round(v * 100)}% Critical Chance`, w: 14 },
        { id: "proc_bolt", min: 0.1, max: 0.28, label: (v) => `${Math.round(v * 100)}% chance to Fire Bolt on Hit`, w: 7 },
        { id: "damage", min: 2, max: 12, label: (v) => `+${Math.round(v)} Damage`, w: 6 },
      ];
    case "agility":
      return [
        ...shared,
        { id: "speed", min: 0.05, max: 0.18, label: (v) => `+${Math.round(v * 100)}% Move Speed`, w: 12 },
        { id: "attack_speed", min: 0.06, max: 0.2, label: (v) => `+${Math.round(v * 100)}% Attack Speed`, w: 12 },
        { id: "onslaught", min: 0.15, max: 0.4, label: (v) => `${Math.round(v * 100)}% chance Onslaught on Kill`, w: 5 },
      ];
    case "endurance":
      return [
        ...shared,
        { id: "defense", min: 0.04, max: 0.16, label: (v) => `${Math.round(v * 100)}% less Physical Damage Taken`, w: 14 },
        { id: "health", min: 15, max: 70, label: (v) => `+${Math.round(v)} Life`, w: 8 },
        { id: "proc_blur", min: 0.08, max: 0.2, label: (v) => `${Math.round(v * 100)}% Blur when Hit`, w: 5 },
      ];
    case "intellect":
      return [
        ...shared,
        { id: "spell_damage", min: 0.08, max: 0.32, label: (v) => `+${Math.round(v * 100)}% Skill Damage`, w: 14 },
        { id: "aoe", min: 0.08, max: 0.3, label: (v) => `+${Math.round(v * 100)}% Area of Effect`, w: 8 },
        { id: "proc_burn", min: 0.1, max: 0.28, label: (v) => `${Math.round(v * 100)}% chance to Ignite`, w: 6 },
        { id: "proc_bolt", min: 0.08, max: 0.22, label: (v) => `${Math.round(v * 100)}% Arcane Bolt on Hit`, w: 5 },
      ];
    case "tactics":
      return [
        ...shared,
        { id: "crit", min: 0.02, max: 0.08, label: (v) => `+${Math.round(v * 100)}% Critical Chance`, w: 8 },
        { id: "spell_damage", min: 0.05, max: 0.18, label: (v) => `+${Math.round(v * 100)}% Skill Damage`, w: 8 },
        { id: "attack_speed", min: 0.04, max: 0.14, label: (v) => `+${Math.round(v * 100)}% Attack Speed`, w: 7 },
        { id: "proc_nova", min: 0.1, max: 0.25, label: (v) => `${Math.round(v * 100)}% Tactical Nova on Hit`, w: 6 },
        { id: "aoe", min: 0.06, max: 0.22, label: (v) => `+${Math.round(v * 100)}% Area of Effect`, w: 6 },
      ];
    case "wisdom":
      return [
        ...shared,
        { id: "mana", min: 15, max: 60, label: (v) => `+${Math.round(v)} Mana`, w: 12 },
        { id: "magic_defense", min: 0.05, max: 0.18, label: (v) => `${Math.round(v * 100)}% less Magical Damage Taken`, w: 12 },
        { id: "proc_frost", min: 0.1, max: 0.26, label: (v) => `${Math.round(v * 100)}% chance to Chill`, w: 6 },
        { id: "proc_shock", min: 0.08, max: 0.22, label: (v) => `${Math.round(v * 100)}% chance to Shock`, w: 5 },
      ];
  }
}

function pickEffect(
  pool: ReturnType<typeof effectPool>,
  rng: () => number,
  used: Set<StoneEffectId>,
): StoneEffect | null {
  const avail = pool.filter((p) => !used.has(p.id));
  if (!avail.length) return null;
  const total = avail.reduce((s, p) => s + p.w, 0);
  let r = rng() * total;
  for (const p of avail) {
    r -= p.w;
    if (r <= 0) {
      const value = p.min + (p.max - p.min) * rng();
      return { id: p.id, value, label: p.label(value) };
    }
  }
  const p = avail[avail.length - 1]!;
  const value = p.min + (p.max - p.min) * rng();
  return { id: p.id, value, label: p.label(value) };
}

/** Roll a stone drop. */
export function rollStoneDrop(opts: {
  itemLevel?: number;
  seed?: number;
  boss?: boolean;
  forceAttr?: AttrKey;
  forceRarity?: StoneRarity;
}): AttributeStone {
  const rng = mulberry(opts.seed ?? (Math.random() * 0xffffffff) >>> 0);
  const attr = opts.forceAttr ?? ATTR_ORDER[Math.floor(rng() * ATTR_ORDER.length)]!;
  const rarity = opts.forceRarity ?? rollRarity(rng, !!opts.boss);
  const n = RARITY_RANK[rarity];
  const pool = effectPool(attr);
  const used = new Set<StoneEffectId>();
  const effects: StoneEffect[] = [];
  for (let i = 0; i < n; i++) {
    const e = pickEffect(pool, rng, used);
    if (!e) break;
    used.add(e.id);
    effects.push(e);
  }
  const meta = STONE_META[attr];
  return {
    uid: uid(),
    attr,
    rarity,
    name: `${RARITY_LABEL[rarity]} ${meta.label} Stone`,
    effects,
    itemLevel: opts.itemLevel ?? 1,
  };
}

export function getStoneStash(): AttributeStone[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STASH_KEY);
    return raw ? (JSON.parse(raw) as AttributeStone[]) : [];
  } catch {
    return [];
  }
}

export function saveStoneStash(items: AttributeStone[]) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STASH_KEY, JSON.stringify(items.slice(0, 64)));
}

export function getStoneLoadout(): StoneLoadout {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(LOADOUT_KEY);
    return raw ? (JSON.parse(raw) as StoneLoadout) : {};
  } catch {
    return {};
  }
}

export function saveStoneLoadout(lo: StoneLoadout) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(LOADOUT_KEY, JSON.stringify(lo));
}

export function addStone(stone: AttributeStone) {
  const s = getStoneStash();
  s.unshift(stone);
  saveStoneStash(s);
}

export function equipStone(uidStr: string): { ok: boolean; message: string } {
  const stone = getStoneStash().find((x) => x.uid === uidStr);
  if (!stone) return { ok: false, message: "Stone not found." };
  const lo = { ...getStoneLoadout() };
  lo[stone.attr] = stone.uid;
  saveStoneLoadout(lo);
  return { ok: true, message: `Socketed ${stone.name}.` };
}

export function unequipStone(attr: AttrKey) {
  const lo = { ...getStoneLoadout() };
  delete lo[attr];
  saveStoneLoadout(lo);
}

export function getEquippedStones(): AttributeStone[] {
  const lo = getStoneLoadout();
  const stash = getStoneStash();
  const out: AttributeStone[] = [];
  for (const attr of ATTR_ORDER) {
    const id = lo[attr];
    if (!id) continue;
    const s = stash.find((x) => x.uid === id);
    if (s) out.push(s);
  }
  return out;
}

/** Aggregated combat stats from all equipped stones. */
export interface StoneCombatMods {
  attrBonus: Record<AttrKey, number>;
  health: number;
  damage: number;
  spellDamage: number;
  defense: number;
  magicDefense: number;
  crit: number;
  speed: number;
  attackSpeed: number;
  aoe: number;
  mana: number;
  lifeOnHit: number;
  /** Proc chances 0–1 */
  procBolt: number;
  procNova: number;
  procBurn: number;
  procFrost: number;
  procShock: number;
  procBlur: number;
  procParticles: number;
  onslaught: number;
}

export function getStoneCombatMods(): StoneCombatMods {
  const mods: StoneCombatMods = {
    attrBonus: {
      strength: 0,
      vitality: 0,
      dexterity: 0,
      agility: 0,
      endurance: 0,
      intellect: 0,
      tactics: 0,
      wisdom: 0,
    },
    health: 0,
    damage: 0,
    spellDamage: 0,
    defense: 0,
    magicDefense: 0,
    crit: 0,
    speed: 0,
    attackSpeed: 0,
    aoe: 0,
    mana: 0,
    lifeOnHit: 0,
    procBolt: 0,
    procNova: 0,
    procBurn: 0,
    procFrost: 0,
    procShock: 0,
    procBlur: 0,
    procParticles: 0,
    onslaught: 0,
  };

  for (const stone of getEquippedStones()) {
    for (const e of stone.effects) {
      switch (e.id) {
        case "stat_boost":
          mods.attrBonus[stone.attr] += e.value;
          break;
        case "health":
          mods.health += e.value;
          break;
        case "damage":
          mods.damage += e.value;
          break;
        case "spell_damage":
          mods.spellDamage += e.value;
          break;
        case "defense":
          mods.defense += e.value;
          break;
        case "magic_defense":
          mods.magicDefense += e.value;
          break;
        case "crit":
          mods.crit += e.value;
          break;
        case "speed":
          mods.speed += e.value;
          break;
        case "attack_speed":
          mods.attackSpeed += e.value;
          break;
        case "aoe":
          mods.aoe += e.value;
          break;
        case "mana":
          mods.mana += e.value;
          break;
        case "life_on_hit":
          mods.lifeOnHit += e.value;
          break;
        case "proc_bolt":
          mods.procBolt += e.value;
          break;
        case "proc_nova":
          mods.procNova += e.value;
          break;
        case "proc_burn":
          mods.procBurn += e.value;
          break;
        case "proc_frost":
          mods.procFrost += e.value;
          break;
        case "proc_shock":
          mods.procShock += e.value;
          break;
        case "proc_blur":
          mods.procBlur += e.value;
          break;
        case "proc_particles":
          mods.procParticles += e.value;
          break;
        case "onslaught":
          mods.onslaught += e.value;
          break;
      }
    }
  }

  // Soft caps so stacked legendaries don't explode
  mods.crit = Math.min(0.4, mods.crit);
  mods.defense = Math.min(0.45, mods.defense);
  mods.magicDefense = Math.min(0.45, mods.magicDefense);
  mods.speed = Math.min(0.35, mods.speed);
  mods.attackSpeed = Math.min(0.4, mods.attackSpeed);
  mods.spellDamage = Math.min(1.0, mods.spellDamage);
  mods.aoe = Math.min(0.9, mods.aoe);
  mods.procBolt = Math.min(0.55, mods.procBolt);
  mods.procNova = Math.min(0.45, mods.procNova);
  mods.procBurn = Math.min(0.5, mods.procBurn);
  mods.procFrost = Math.min(0.5, mods.procFrost);
  mods.procShock = Math.min(0.5, mods.procShock);
  mods.procBlur = Math.min(0.4, mods.procBlur);
  mods.onslaught = Math.min(0.75, mods.onslaught);
  return mods;
}
