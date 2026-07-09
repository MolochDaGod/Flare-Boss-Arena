/**
 * Grudge Harbor — the expanded camp hub layout (5× the original training yard).
 * Positions, districts, station metadata, NPC anchors, and prop scatter.
 */

export type CampStationId =
  | "anvil"
  | "skills"
  | "stats"
  | "quests"
  | "stash"
  | "portal_dungeon"
  | "portal_boss"
  | "perk_machines"
  | "gumball"
  | "perk_firebug"
  | "perk_medic"
  | "perk_support"
  | "perk_gunslinger"
  | "weapon_panel";

/** Perk station marker colors — kept local to avoid campTown ↔ worldProps cycle. */
const PERK_COLORS = {
  firebug: 0xff5522,
  medic: 0xff3366,
  support: 0x3388ff,
  gunslinger: 0xffcc33,
} as const;

export const CAMP_SCALE = 5;
export const CAMP_BOUNDS = 90;
/** How close the player must be to see the engage prompt. */
export const CAMP_STATION_PROXIMITY = 9;
export const CAMP_BUILDING_PAD = 2.8;

export type CampStationCategory = "service" | "portal" | "perk" | "training" | "boss";

export interface CampStationLayout {
  id: CampStationId;
  label: string;
  shortLabel: string;
  hint: string;
  category: CampStationCategory;
  x: number;
  z: number;
  color: number;
  building: string;
  /** React engage CTA verb */
  action: string;
  district: string;
}

export const CAMP_STATION_LAYOUTS: CampStationLayout[] = [
  {
    id: "stash",
    label: "Vault & Stash",
    shortLabel: "Stash",
    hint: "Equip weapons and armor from your war chest.",
    category: "service",
    x: 44,
    z: 10,
    color: 0x66ddaa,
    building: "bank_9",
    action: "Open Stash",
    district: "Market Row",
  },
  {
    id: "weapon_panel",
    label: "Armory Rack",
    shortLabel: "Armory",
    hint: "Swap main-hand weapons and review loadouts.",
    category: "service",
    x: 52,
    z: -6,
    color: 0xc5a059,
    building: "house_59",
    action: "Open Armory",
    district: "Market Row",
  },
  {
    id: "skills",
    label: "Skill Obelisk",
    shortLabel: "Skills",
    hint: "Spend skill points across your class trees.",
    category: "service",
    x: 30,
    z: -36,
    color: 0x44aaff,
    building: "guild_51",
    action: "Study Skills",
    district: "Guild Quarter",
  },
  {
    id: "stats",
    label: "Soul Altar",
    shortLabel: "Attributes",
    hint: "Distribute attribute stones on your fighter.",
    category: "service",
    x: 10,
    z: -46,
    color: 0xaa44ff,
    building: "guild.001_49",
    action: "Channel Souls",
    district: "Guild Quarter",
  },
  {
    id: "quests",
    label: "War Board",
    shortLabel: "Quests",
    hint: "Read boss intel, bounties, and active hunts.",
    category: "service",
    x: -24,
    z: -40,
    color: 0xffcc33,
    building: "bar_25",
    action: "Read Board",
    district: "Tavern Green",
  },
  {
    id: "anvil",
    label: "Grudge Forge",
    shortLabel: "Forge",
    hint: "Craft, repair, and temper your gear.",
    category: "service",
    x: -40,
    z: -14,
    color: 0xff7733,
    building: "house_59",
    action: "Enter Forge",
    district: "Smithy Lane",
  },
  {
    id: "portal_dungeon",
    label: "Dungeon Gate",
    shortLabel: "Dungeon",
    hint: "Step into the infinite dungeon crawl.",
    category: "portal",
    x: 6,
    z: 56,
    color: 0xff4422,
    building: "house.001_67",
    action: "Enter Dungeon",
    district: "South Gate",
  },
  {
    id: "portal_boss",
    label: "Boss Sigil",
    shortLabel: "Boss Arena",
    hint: "Face a procedurally generated elemental boss. Dodge telegraphs, burn phases, claim spoils.",
    category: "boss",
    x: -62,
    z: 6,
    color: 0xff22aa,
    building: "house.002_75",
    action: "Challenge Boss",
    district: "Sigil Wastes",
  },
];

export interface CampPropLayout {
  propId: string;
  x: number;
  z: number;
  rotY: number;
  stationId?: CampStationId;
  label?: string;
  hint?: string;
  color?: number;
}

/** Perk alley + environment scatter (5× original camp props). */
export const CAMP_PROP_LAYOUTS: CampPropLayout[] = [
  {
    propId: "prop_perk_machines",
    x: -52,
    z: 22,
    rotY: Math.PI * 0.55,
    stationId: "perk_machines",
    label: "Perk Row",
    hint: "Browse combat mods and passive upgrades.",
    color: 0xff6622,
  },
  {
    propId: "prop_gumball",
    x: -46,
    z: 40,
    rotY: Math.PI * 0.7,
    stationId: "gumball",
    label: "Gumball",
    hint: "Spin for a random perk or loot roll.",
    color: 0xff88cc,
  },
  {
    propId: "prop_perk_firebug",
    x: -58,
    z: 4,
    rotY: 0,
    stationId: "perk_firebug",
    label: "Firebug",
    hint: "Incendiary perks — burn damage and splash.",
    color: PERK_COLORS.firebug,
  },
  {
    propId: "prop_perk_medic",
    x: -54,
    z: -18,
    rotY: 0.2,
    stationId: "perk_medic",
    label: "Medic",
    hint: "Healing and sustain perks.",
    color: PERK_COLORS.medic,
  },
  {
    propId: "prop_perk_support",
    x: -42,
    z: -36,
    rotY: 0.5,
    stationId: "perk_support",
    label: "Support",
    hint: "Team buffs and utility perks.",
    color: PERK_COLORS.support,
  },
  {
    propId: "prop_perk_gunslinger",
    x: -24,
    z: -48,
    rotY: 0.9,
    stationId: "perk_gunslinger",
    label: "Gunslinger",
    hint: "Ranged and crit-focused perks.",
    color: PERK_COLORS.gunslinger,
  },
  { propId: "prop_gunslinger_hero", x: -18, z: -56, rotY: 1.1 },
  { propId: "prop_grass_trenches", x: 68, z: 28, rotY: -0.4 },
  { propId: "prop_grass_trenches", x: -68, z: -28, rotY: 2.1 },
  { propId: "prop_grass_trenches", x: 28, z: 68, rotY: 1.4 },
  { propId: "prop_grass_trenches", x: -30, z: 62, rotY: 0.8 },
];

export interface CampFighterNpcLayout {
  fighterId: string;
  skinId: string;
  name: string;
  x: number;
  z: number;
  wanderRadius?: number;
  faceY?: number;
}

/** Real roster champions wandering the harbor (skins + Racalvin). */
export const CAMP_FIGHTER_NPCS: CampFighterNpcLayout[] = [
  { fighterId: "racalvin", skinId: "racalvin", name: "Racalvin", x: 14, z: 2, wanderRadius: 6, faceY: -0.4 },
  { fighterId: "shanks", skinId: "shanks", name: "Shanks", x: -20, z: -34, wanderRadius: 5 },
  { fighterId: "law", skinId: "law", name: "Law", x: 26, z: -30, wanderRadius: 4.5 },
  { fighterId: "ace_sabo_luffy", skinId: "ace_sabo_luffy", name: "Brothers", x: -6, z: 10, wanderRadius: 5 },
  { fighterId: "lucci", skinId: "lucci", name: "Lucci", x: 50, z: 50, wanderRadius: 6 },
  { fighterId: "marco", skinId: "marco", name: "Marco", x: -50, z: -14, wanderRadius: 4 },
  { fighterId: "sanji_onigashima", skinId: "sanji_onigashima", name: "Sanji", x: 40, z: 14, wanderRadius: 5 },
  { fighterId: "smoker", skinId: "smoker", name: "Smoker", x: 4, z: 44, wanderRadius: 5 },
  { fighterId: "ryuma", skinId: "ryuma", name: "Ryuma", x: -36, z: -10, wanderRadius: 4 },
  { fighterId: "koby", skinId: "koby", name: "Koby", x: 18, z: 20, wanderRadius: 6 },
  { fighterId: "mihawk", skinId: "mihawk", name: "Mihawk", x: -72, z: 38, wanderRadius: 5, faceY: 0.6 },
  { fighterId: "kizaru", skinId: "kizaru", name: "Kizaru", x: 62, z: -42, wanderRadius: 6 },
  { fighterId: "fujitora_marijoa", skinId: "fujitora_marijoa", name: "Fujitora", x: -58, z: -52, wanderRadius: 4.5 },
  { fighterId: "vista", skinId: "vista", name: "Vista", x: -14, z: -58, wanderRadius: 5 },
  { fighterId: "charlotte_oven", skinId: "charlotte_oven", name: "Oven", x: 72, z: 12, wanderRadius: 4 },
  { fighterId: "hybrid_kaido", skinId: "hybrid_kaido", name: "Kaido", x: -38, z: 72, wanderRadius: 7, faceY: -1.2 },
];

/** KayKit ambient NPCs fill out the crowd. */
export const CAMP_KAYKIT_NPCS: { x: number; z: number; model: string }[] = [
  { x: -12, z: 28, model: "Knight" },
  { x: 22, z: 24, model: "Mage" },
  { x: -28, z: 18, model: "Ranger" },
  { x: 32, z: -8, model: "Rogue" },
  { x: -8, z: -22, model: "Barbarian" },
  { x: 8, z: -28, model: "Rogue_Hooded" },
];

export const CAMP_DUMMY_SPOTS: { x: number; z: number; name: string }[] = [
  { x: 46, z: 48, name: "Training Dummy" },
  { x: 54, z: 54, name: "Straw Knight" },
  { x: 48, z: 62, name: "Practice Post" },
  { x: 58, z: 46, name: "Spar Target" },
];

export const CAMP_STATION_BY_ID = new Map(CAMP_STATION_LAYOUTS.map((s) => [s.id, s]));

/** Minimap markers for HUD (normalized later in scene). */
export function campStationMarkers(): { id: CampStationId; x: number; z: number; color: number; category: CampStationCategory }[] {
  const fromLayouts = CAMP_STATION_LAYOUTS.map((s) => ({
    id: s.id,
    x: s.x,
    z: s.z,
    color: s.color,
    category: s.category,
  }));
  const fromProps = CAMP_PROP_LAYOUTS.filter((p) => p.stationId).map((p) => ({
    id: p.stationId!,
    x: p.x,
    z: p.z,
    color: p.color ?? 0xffffff,
    category: "perk" as CampStationCategory,
  }));
  return [...fromLayouts, ...fromProps];
}