/**
 * Rival / unused hero library — fighters that can spawn as elite enemies.
 *
 * Visuals use lightweight mon_/kit_ proxies (full skin GLBs are 3–14MB each and
 * would thrash memory if multi-spawned). Combat AI + names come from
 * characterCombatProfiles. When a hero is the active player they are excluded
 * from the rival pool.
 */

import { getActiveFighterId } from "./fighters";
import {
  COMBAT_PROFILES,
  brainTuning,
  fighterDisplayName,
  getCombatProfile,
  type BrainArchetype,
} from "./characterCombatProfiles";

export interface HeroEnemyTemplate {
  id: string;
  name: string;
  type: string;
  tier: number;
  hp: number;
  damage: number;
  /** Real model loader id (kit_* / mon_*). */
  visualId: string;
  fighterId: string;
  brain: BrainArchetype;
  aggroRange: number;
  attackRange: number;
  speed: number;
}

function buildTemplate(fighterId: string): HeroEnemyTemplate | null {
  const p = getCombatProfile(fighterId);
  if (!p?.enemyReady) return null;
  const t = brainTuning(p.brain);
  const tier = p.enemyTier;
  return {
    id: `hero_${fighterId}`,
    name: `${fighterDisplayName(fighterId)} (Rival)`,
    type: p.brain,
    tier,
    hp: Math.round(140 + tier * 95),
    damage: Math.round(10 + tier * 5),
    visualId: p.enemyVisualProxy,
    fighterId,
    brain: p.brain,
    aggroRange: (7 + tier * 0.5) * t.aggroMult,
    attackRange: (1.9 + tier * 0.15) * t.attackRangeMult,
    speed: (2.1 + tier * 0.2) * t.speedMult,
  };
}

/** All rival-ready heroes (excluding active player). */
export function getHeroEnemyTemplates(activeFighterId?: string | null): HeroEnemyTemplate[] {
  const active = activeFighterId ?? getActiveFighterId() ?? "nightmare_luffy";
  return COMBAT_PROFILES.filter((p) => p.enemyReady && p.fighterId !== active)
    .map((p) => buildTemplate(p.fighterId))
    .filter((x): x is HeroEnemyTemplate => !!x);
}

/** Convert to the structural EnemyTemplate used by GameEngine. */
export function heroEnemyAsTemplate(h: HeroEnemyTemplate): {
  id: string;
  name: string;
  type: string;
  tier: number;
  hp: number;
  damage: number;
} {
  // visualId is encoded in id prefix so resolveAnimatedModelId can map it.
  return {
    id: h.visualId.startsWith("kit_") || h.visualId.startsWith("mon_")
      ? h.visualId
      : h.id,
    name: h.name,
    type: h.type,
    tier: h.tier,
    hp: h.hp,
    damage: h.damage,
  };
}

/** Pick N rivals for a seed (deterministic). */
export function pickHeroEnemies(seed: number, count: number, activeFighterId?: string | null): HeroEnemyTemplate[] {
  const pool = getHeroEnemyTemplates(activeFighterId);
  if (!pool.length) return [];
  const out: HeroEnemyTemplate[] = [];
  let s = seed >>> 0;
  const used = new Set<string>();
  for (let i = 0; i < count && used.size < pool.length; i++) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const idx = s % pool.length;
    const pick = pool[idx]!;
    if (used.has(pick.fighterId)) {
      i--;
      continue;
    }
    used.add(pick.fighterId);
    out.push(pick);
  }
  return out;
}
