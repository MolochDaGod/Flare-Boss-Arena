/**
 * Canonical boss roster (~10) for Arena + Island Colossus.
 * Each entry has a fight style that drives AI, telegraphs, and ability kits.
 */

import type { ArenaBossAbility, ArenaBossInput } from "@/game/ArenaScene";

/** How the boss plays in the arena / special AI hooks. */
export type BossFightStyle =
  | "brawler" // close-range slams, chases hard
  | "artillery" // stays mid-range, bolts + skyfall
  | "flying" // aerial dives + barrages, elevated mesh
  | "necromancer" // curses, bolts, death circles
  | "gorgon" // gaze zones, serpent coils
  | "colossus" // huge telegraphs, slow but crushing
  | "skirmisher" // darting multi-hit, pincher pressure
  | "duelist" // fast melee combos + burst
  | "elemental" // multi-circle elemental storms
  | "dragon"; // breath lines, wing gusts, dive

export interface BossDef {
  id: string;
  name: string;
  title: string;
  tier: number;
  /** Base HP before arena tier/level scale. */
  baseHp: number;
  /** Model id: boss_* (public/models/bosses), mon_* , or cdn_* */
  modelId: string;
  style: BossFightStyle;
  blurb: string;
  /** Preferred ability template ids from STYLE_ABILITY_KITS. */
  kitIds: string[];
  flying?: boolean;
  /** Arena scale multiplier on top of tier scale. */
  scale?: number;
}

/** Shared ability templates keyed by id. */
export interface AbilityTemplate {
  id: string;
  name: string;
  type: string;
  description: string;
  /** Relative damage mult. */
  dmgMul: number;
  cooldown: number;
}

export const ABILITY_LIBRARY: Record<string, AbilityTemplate> = {
  slam: {
    id: "slam",
    name: "Crushing Slam",
    type: "melee",
    description: "Heavy close blow — leave the red circle.",
    dmgMul: 1.1,
    cooldown: 2.4,
  },
  sweep: {
    id: "sweep",
    name: "Whirl Sweep",
    type: "melee",
    description: "Wide spinning arc around the boss.",
    dmgMul: 0.95,
    cooldown: 3.2,
  },
  combo: {
    id: "combo",
    name: "Blade Flurry",
    type: "melee",
    description: "Rapid dual strikes — short wind-ups.",
    dmgMul: 0.75,
    cooldown: 2.0,
  },
  bolt: {
    id: "bolt",
    name: "Hex Bolt",
    type: "ranged",
    description: "Dodgeable projectile — sidestep or Space.",
    dmgMul: 0.95,
    cooldown: 3.2,
  },
  volley: {
    id: "volley",
    name: "Grudge Volley",
    type: "ranged",
    description: "Fan of dodgeable bolts.",
    dmgMul: 0.7,
    cooldown: 4.5,
  },
  arc: {
    id: "arc",
    name: "Arcane Lance",
    type: "magic",
    description: "Homing orb — dodge through at the last second.",
    dmgMul: 1.0,
    cooldown: 4.0,
  },
  nova: {
    id: "nova",
    name: "Ruin Nova",
    type: "aoe",
    description: "Ground circle detonates after a wind-up.",
    dmgMul: 0.95,
    cooldown: 5.5,
  },
  meteor: {
    id: "meteor",
    name: "Skyfall",
    type: "aoe",
    description: "Multiple impact circles rain around you.",
    dmgMul: 0.85,
    cooldown: 7.0,
  },
  curse: {
    id: "curse",
    name: "Grudge Curse",
    type: "debuff",
    description: "Purple circle that slows if you stay in it.",
    dmgMul: 0.5,
    cooldown: 6.0,
  },
  sky_dive: {
    id: "sky_dive",
    name: "Sky Dive",
    type: "aoe",
    description: "Boss dives from the air — leave the red circle.",
    dmgMul: 1.25,
    cooldown: 7.0,
  },
  wing_barrage: {
    id: "wing_barrage",
    name: "Wing Barrage",
    type: "ranged",
    description: "Aerial projectiles — dodge with Space.",
    dmgMul: 0.8,
    cooldown: 4.0,
  },
  breath: {
    id: "breath",
    name: "Dragon Breath",
    type: "aoe",
    description: "Line of fire across the arena floor.",
    dmgMul: 1.15,
    cooldown: 6.5,
  },
  gaze: {
    id: "gaze",
    name: "Petrifying Gaze",
    type: "debuff",
    description: "Cone of stone — break free by moving out.",
    dmgMul: 0.55,
    cooldown: 5.5,
  },
  coil: {
    id: "coil",
    name: "Serpent Coil",
    type: "aoe",
    description: "Ring expands from the boss — jump the edge.",
    dmgMul: 1.0,
    cooldown: 5.0,
  },
  stomp: {
    id: "stomp",
    name: "Earthquake Stomp",
    type: "aoe",
    description: "Massive ring shockwave from the colossus.",
    dmgMul: 1.3,
    cooldown: 6.5,
  },
  pounce: {
    id: "pounce",
    name: "Pounce",
    type: "melee",
    description: "Leaping strike onto your last position.",
    dmgMul: 1.15,
    cooldown: 3.8,
  },
  storm: {
    id: "storm",
    name: "Elemental Storm",
    type: "aoe",
    description: "Three overlapping circles pulse damage.",
    dmgMul: 0.9,
    cooldown: 6.0,
  },
  death_ring: {
    id: "death_ring",
    name: "Death Ring",
    type: "aoe",
    description: "Necrotic ring under your feet.",
    dmgMul: 1.05,
    cooldown: 5.0,
  },
  staff_bolt: {
    id: "staff_bolt",
    name: "Soul Bolt",
    type: "magic",
    description: "Homing necrotic bolt.",
    dmgMul: 1.0,
    cooldown: 3.5,
  },
};

/** Ten curated bosses — styles + models. */
export const BOSS_ROSTER: BossDef[] = [
  {
    id: "boss_chitin_matriarch",
    name: "Ashen Pincher",
    title: "Chitin of the Dunes",
    tier: 2,
    baseHp: 900,
    modelId: "mon_pincher",
    style: "skirmisher",
    blurb: "Darting pounces and multi-hit pressure.",
    kitIds: ["pounce", "sweep", "bolt", "nova"],
    scale: 1.35,
  },
  {
    id: "boss_grave_acolyte",
    name: "Grave Acolyte",
    title: "Cultist of the Last Oath",
    tier: 2,
    baseHp: 950,
    modelId: "mon_cultist",
    style: "necromancer",
    blurb: "Curses and soul bolts from mid range.",
    kitIds: ["staff_bolt", "curse", "death_ring", "bolt", "nova"],
    scale: 1.4,
  },
  {
    id: "boss_dante_shadow",
    name: "Dante's Shadow",
    title: "Beast of the Pit",
    tier: 3,
    baseHp: 1200,
    modelId: "mon_dante_beast",
    style: "brawler",
    blurb: "Relentless chase, slam combos, close-range fury.",
    kitIds: ["slam", "pounce", "sweep", "combo", "nova"],
    scale: 1.45,
  },
  {
    id: "boss_briar_matriarch",
    name: "Briar Matriarch",
    title: "Queen of Thorns",
    tier: 3,
    baseHp: 1150,
    modelId: "mon_medusa",
    style: "gorgon",
    blurb: "Petrifying gaze zones and expanding serpent coils.",
    kitIds: ["gaze", "coil", "bolt", "curse", "nova"],
    scale: 1.4,
  },
  {
    id: "boss_cinder_wyrmling",
    name: "Cinder Wyrmling",
    title: "Fireworm of the Depths",
    tier: 3,
    baseHp: 1100,
    modelId: "boss_fireworm",
    style: "elemental",
    blurb: "Fire storms and ground eruptions.",
    kitIds: ["storm", "meteor", "bolt", "nova", "slam"],
    scale: 1.2,
  },
  {
    id: "boss_framis",
    name: "Framis",
    title: "Dark Necromancer",
    tier: 4,
    baseHp: 1300,
    modelId: "boss_framis_necro",
    style: "necromancer",
    blurb: "Death rings, curses, and homing soul lances.",
    kitIds: ["staff_bolt", "arc", "death_ring", "curse", "meteor"],
    scale: 1.25,
  },
  {
    id: "boss_sora",
    name: "Sora",
    title: "Shifting Cloud",
    tier: 4,
    baseHp: 1250,
    modelId: "boss_sora_cloud",
    style: "elemental",
    flying: true,
    blurb: "Elemental storms and aerial hex bolts.",
    kitIds: ["storm", "wing_barrage", "arc", "nova", "sky_dive"],
    scale: 1.2,
  },
  {
    id: "boss_sun_monkey",
    name: "Sun Monkey King",
    title: "Heaven's Challenger",
    tier: 4,
    baseHp: 1400,
    modelId: "boss_sun_monkey_king",
    style: "duelist",
    blurb: "Fast flurry combos and staff-break AoEs.",
    kitIds: ["combo", "slam", "pounce", "sweep", "nova", "bolt"],
    scale: 1.3,
  },
  {
    id: "boss_wrath_colossus",
    name: "Wrath Colossus",
    title: "Lord of Endless Grudges",
    tier: 5,
    baseHp: 1800,
    modelId: "mon_big_scary_t3",
    style: "colossus",
    blurb: "Slow earthquake stomps and arena-wide rings.",
    kitIds: ["stomp", "slam", "meteor", "nova", "sweep"],
    scale: 1.5,
  },
  {
    id: "boss_noble_dragon",
    name: "Noble Dragon",
    title: "Wyrm of the Western Reach",
    tier: 5,
    baseHp: 1600,
    modelId: "boss_noble_dragon",
    style: "dragon",
    flying: true,
    blurb: "Breath lines, wing barrages, and sky dives.",
    kitIds: ["breath", "sky_dive", "wing_barrage", "meteor", "stomp"],
    scale: 1.35,
  },
];

/** Extra high-tier rotations (still valid encounters). */
export const BOSS_ROSTER_EXTRA: BossDef[] = [
  {
    id: "boss_tarisland",
    name: "Tarisland Drake",
    title: "Sky Terror of the Ruins",
    tier: 5,
    baseHp: 1700,
    modelId: "boss_tarisland_dragon",
    style: "dragon",
    flying: true,
    blurb: "Heavier dragon kit — denser skyfalls.",
    kitIds: ["breath", "sky_dive", "meteor", "wing_barrage", "stomp", "nova"],
    scale: 1.3,
  },
  {
    id: "boss_flying_demon",
    name: "Demon",
    title: "Flying Demon",
    tier: 5,
    baseHp: 1550,
    // Asset: models/monsters/flying/Demon.glb — name matches mesh, not a rebadge.
    modelId: "cdn_flying_demon",
    style: "flying",
    flying: true,
    blurb: "Aerial artillery with dive bombs.",
    kitIds: ["sky_dive", "wing_barrage", "meteor", "arc", "volley"],
    scale: 1.25,
  },
  {
    id: "boss_dragon",
    name: "Dragon",
    title: "Sky Terror",
    tier: 5,
    baseHp: 1750,
    // Asset: models/monsters/flying/Dragon.gltf
    modelId: "cdn_dragon",
    style: "dragon",
    flying: true,
    blurb: "Authored dragon mesh with multi-clip bank.",
    kitIds: ["breath", "sky_dive", "meteor", "wing_barrage", "stomp", "nova"],
    scale: 1.35,
  },
];

export const ALL_BOSSES: BossDef[] = [...BOSS_ROSTER, ...BOSS_ROSTER_EXTRA];

export const BOSS_BY_ID = new Map(ALL_BOSSES.map((b) => [b.id, b]));

export function bossesForTier(tier: number): BossDef[] {
  const t = Math.max(1, Math.min(5, Math.round(tier) || 1));
  // Prefer exact tier; include adjacent tiers if pool thin.
  let pool = ALL_BOSSES.filter((b) => b.tier === t);
  if (pool.length < 2) pool = ALL_BOSSES.filter((b) => Math.abs(b.tier - t) <= 1);
  if (!pool.length) pool = ALL_BOSSES.slice();
  return pool;
}

export function pickBossDef(tier: number, salt = 0): BossDef {
  const pool = bossesForTier(tier);
  return pool[Math.abs(salt) % pool.length]!;
}

export function pickBossByIndex(index: number): BossDef {
  return ALL_BOSSES[Math.abs(index) % ALL_BOSSES.length]!;
}

function buildKit(def: BossDef, tier: number, level: number): ArenaBossAbility[] {
  const baseDmg = 16 + tier * 11 + level * 2;
  const out: ArenaBossAbility[] = [];
  for (let i = 0; i < def.kitIds.length; i++) {
    const key = def.kitIds[i]!;
    const t = ABILITY_LIBRARY[key];
    if (!t) continue;
    out.push({
      id: `${def.id}_${t.id}_${i}`,
      name: t.name,
      type: t.type,
      description: t.description,
      damage: Math.round(baseDmg * t.dmgMul * (1 + i * 0.04)),
      cooldown: t.cooldown + tier * 0.15,
    });
  }
  // Guarantee at least melee + bolt + aoe if kit empty
  if (!out.length) {
    for (const key of ["slam", "bolt", "nova"] as const) {
      const t = ABILITY_LIBRARY[key]!;
      out.push({
        id: `${def.id}_${t.id}`,
        name: t.name,
        type: t.type,
        description: t.description,
        damage: Math.round(baseDmg * t.dmgMul),
        cooldown: t.cooldown,
      });
    }
  }
  return out;
}

export interface LocalBossRequest {
  tier: number;
  playerClass?: string;
  playerLevel?: number;
  /** Optional fixed roster index / id for rematches & QA (?boss=). */
  bossId?: string;
  bossIndex?: number;
}

/** Build a fully playable ArenaBossInput from the curated roster. */
export function generateRosterBoss(req: LocalBossRequest): ArenaBossInput & {
  style: BossFightStyle;
  modelId: string;
  flying?: boolean;
  bossScale?: number;
  rosterId: string;
} {
  const tier = Math.max(1, Math.min(5, Math.round(req.tier) || 1));
  const level = Math.max(1, Math.round(req.playerLevel ?? 1));
  let def: BossDef | undefined;
  if (req.bossId) def = BOSS_BY_ID.get(req.bossId);
  if (!def && req.bossIndex != null) def = pickBossByIndex(req.bossIndex);
  if (!def) {
    const salt = (Date.now() + tier * 17) % 997;
    def = pickBossDef(tier, salt);
  }

  const abilities = buildKit(def, tier, level);
  const maxHp = Math.round(def.baseHp + tier * 200 + level * 90);

  return {
    id: -(Math.abs(hashStr(def.id)) % 900000) - 1,
    name: def.name,
    title: def.title,
    maxHp,
    phases: 3,
    tier: Math.max(tier, def.tier),
    assetPack: def.modelId,
    abilities,
    style: def.style,
    modelId: def.modelId,
    flying: def.flying,
    bossScale: def.scale,
    rosterId: def.id,
  };
}

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Dungeon island colossus pick by seed/round. */
export function pickDungeonBossDef(seed: number, round: number): BossDef {
  const idx = (seed ^ round * 7919) >>> 0;
  // Unlock higher tiers as rounds climb
  const maxTier = Math.min(5, 2 + Math.floor((round - 1) / 2));
  const pool = ALL_BOSSES.filter((b) => b.tier <= maxTier);
  const use = pool.length ? pool : ALL_BOSSES;
  return use[idx % use.length]!;
}
