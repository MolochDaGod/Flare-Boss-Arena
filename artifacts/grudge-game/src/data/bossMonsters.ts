/**
 * Curated boss GLBs — dragons + ML in-game bosses from imports.
 * Files live under `public/models/bosses/`. These never spawn as trash mobs;
 * dungeon island boss + boss arena resolve them by id / assetPack keyword.
 */
import type { Archetype } from "../game/EnemyFactory";
import { pickDungeonBossDef } from "./bossRoster";

export interface BossMonsterDef {
  id: string;
  name: string;
  type: string;
  tier: number;
  hp: number;
  damage: number;
  file: string;
  archetype: Archetype;
  height: number;
  /** Clip name or substring for idle loop. */
  clip: string;
  /** Extra Y rotation after load (horizontal dragon meshes). */
  spawnRotY?: number;
  /** Boss scale multiplier on top of height fit. */
  bossScale?: number;
}

export const BOSS_MONSTER_DEFS: BossMonsterDef[] = [
  {
    id: "boss_fireworm",
    name: "Cinder Wyrmling",
    type: "dragon",
    tier: 3,
    hp: 520,
    damage: 30,
    file: "fireworm.glb",
    archetype: "dragon",
    height: 3.2,
    clip: "F_idle",
    spawnRotY: Math.PI / 2,
    bossScale: 1.15,
  },
  {
    id: "boss_noble_dragon",
    name: "Noble Dragon",
    type: "dragon",
    tier: 5,
    hp: 1280,
    damage: 52,
    file: "noble_dragon.glb",
    archetype: "dragon",
    height: 6.5,
    clip: "Action Stash",
    spawnRotY: Math.PI / 2,
    bossScale: 1.25,
  },
  {
    id: "boss_tarisland_dragon",
    name: "Tarisland Dragon",
    type: "dragon",
    tier: 5,
    hp: 1500,
    damage: 58,
    file: "tarisland_dragon.glb",
    archetype: "dragon",
    height: 7.0,
    clip: "Qishilong_stand",
    bossScale: 1.2,
  },
  {
    id: "boss_framis_necro",
    name: "Framis",
    type: "undead",
    tier: 4,
    hp: 540,
    damage: 32,
    file: "framis_necro.glb",
    archetype: "humanoid",
    height: 2.3,
    clip: "fight_idle",
    bossScale: 1.1,
  },
  {
    id: "boss_sora_cloud",
    name: "Sora",
    type: "elemental",
    tier: 4,
    hp: 560,
    damage: 34,
    file: "sora_cloud.glb",
    archetype: "humanoid",
    height: 2.5,
    clip: "shifting_cloud_in_game_fight_idle",
    bossScale: 1.1,
  },
  {
    id: "boss_sun_monkey_king",
    name: "Sun Monkey King",
    type: "beast",
    tier: 4,
    hp: 980,
    damage: 50,
    file: "sun_monkey_king.glb",
    archetype: "humanoid",
    height: 2.4,
    clip: "fight_idle",
    bossScale: 1.15,
  },
];

export const BOSS_MONSTER_BY_ID = new Map(BOSS_MONSTER_DEFS.map((d) => [d.id, d]));

export const BOSS_MONSTER_TEMPLATES = BOSS_MONSTER_DEFS.map((d) => ({
  id: d.id,
  name: d.name,
  type: d.type,
  tier: d.tier,
  hp: d.hp,
  damage: d.damage,
}));

/** Dragon bosses only — for keyword routing. */
export const DRAGON_BOSS_IDS = BOSS_MONSTER_DEFS.filter((d) => d.type === "dragon").map((d) => d.id);

export function isBossMonsterId(id: string): boolean {
  return BOSS_MONSTER_BY_ID.has(id);
}

/** Prefer roster model id (may be mon_* / boss_* / cdn_*). */
export function pickDungeonBossId(seed: number, round: number): string {
  const def = pickDungeonBossDef(seed, round);
  return def.modelId;
}
