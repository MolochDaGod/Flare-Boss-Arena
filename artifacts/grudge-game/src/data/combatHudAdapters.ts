/**
 * Adapters: mode-specific engine state → UnifiedCombatHudState
 */
import type { GameState } from "@/game/GameEngine";
import type { ArenaStateUpdate } from "@/game/ArenaScene";
import type { CampStateUpdate } from "@/game/CampScene";
import type { HudSkillSlot, UnifiedCombatHudState } from "./combatHudModel";

export function skillsFromBar(
  bar: Array<{ id: string; name: string; icon?: string; glyph?: string; index?: number } | undefined>,
  skillCdPct?: number[],
  pendingIdx?: number,
): HudSkillSlot[] {
  return bar.slice(0, 5).map((s, i) => ({
    id: s?.id ?? `sk_${i}`,
    name: s?.name ?? `Skill ${i + 1}`,
    key: String(i + 1),
    icon: s?.icon,
    glyph: s?.glyph,
    readyPct: skillCdPct?.[i] ?? 1,
    pending: pendingIdx === i,
  }));
}

export function fromIslandGameState(
  state: GameState,
  opts: {
    charName: string;
    raceClass?: string;
    skills: HudSkillSlot[];
    specialReadyPct?: number;
  },
): UnifiedCombatHudState {
  return {
    mode: "island",
    loaded: state.loaded && state.mapReady,
    charName: opts.charName,
    raceClass: opts.raceClass,
    playerLevel: state.playerLevel,
    playerHp: state.playerHp,
    playerMaxHp: state.playerMaxHp,
    playerMana: state.playerMana,
    playerMaxMana: state.playerMaxMana,
    attackReadyPct: 1 - (state.playerAttackCooldown ?? 0),
    combatLabel: state.combatLabel,
    invulnerable: state.invulnerable,
    blocking: state.blocking,
    jumping: state.jumping,
    zone: state.zone,
    roundOrWave: state.islandRound,
    difficultyMult: state.difficultyMult,
    aliveCount: state.aliveEnemies ?? state.enemies.length,
    activePerks: state.activePerks,
    missionLine:
      state.missionTitle != null
        ? `${state.missionTitle} · ${state.missionKills ?? 0}/${state.missionGoal ?? 0}`
        : undefined,
    bossAlive: state.bossAlive,
    bossName: state.bossName,
    bossHp: state.bossHp,
    bossMaxHp: state.bossMaxHp,
    enemies: state.enemies.map((e) => ({
      id: e.id,
      name: e.name,
      hp: e.hp,
      maxHp: e.maxHp,
      screenX: e.screenX,
      screenY: e.screenY,
      tier: e.tier,
      isBoss: e.isBoss,
    })),
    damageNumbers: state.damageNumbers.map((d) => ({
      id: d.id,
      value: d.value,
      x: d.x,
      y: d.y,
      age: d.age,
      isPlayer: d.isPlayer,
      isCrit: d.isCrit,
    })),
    combatLog: state.combatLog,
    skills: opts.skills,
    specialReadyPct: opts.specialReadyPct ?? state.specialReadyPct,
    allies: (state.allies ?? []).map((a) => ({
      id: a.id,
      name: a.name,
      role: a.role,
      hp: a.hp,
      maxHp: a.maxHp,
      dead: a.dead,
    })),
    resources: {
      gold: state.gold,
      wood: state.resources?.wood,
      stone: state.resources?.stone,
    },
    interact: state.nearbyPirate
      ? {
          title: state.nearbyPirate.name,
          subtitle: state.nearbyPirate.title,
          hint: state.nearbyPirate.prompt,
          key: "E",
        }
      : state.nearbyClaimZone
        ? {
            title: state.nearbyClaimZone,
            subtitle: state.currentZone ?? "Frontier claim",
            hint: "Plant a claim flag · deploy allies with V",
            key: "C",
          }
        : state.nearbyHarvest
          ? { title: state.nearbyHarvest, key: "F" }
          : null,
    outcome: state.playerDead ? "defeat" : null,
  };
}

export function fromArenaState(
  hud: ArenaStateUpdate,
  opts: {
    charName: string;
    raceClass?: string;
    skills: HudSkillSlot[];
    bossStyle?: string | null;
    zone?: string;
  },
): UnifiedCombatHudState {
  return {
    mode: "boss",
    loaded: hud.loaded,
    charName: opts.charName,
    raceClass: opts.raceClass,
    playerLevel: hud.playerLevel,
    playerHp: hud.playerHp,
    playerMaxHp: hud.playerMaxHp,
    playerMana: hud.playerMana,
    playerMaxMana: hud.playerMaxMana,
    attackReadyPct: hud.attackCooldownPct,
    combatLabel: hud.outcome === "fighting" ? "FIGHT" : hud.outcome.toUpperCase(),
    zone: opts.zone ?? "Arena of Blood",
    bossAlive: hud.bossAlive,
    bossName: hud.bossName,
    bossTitle: hud.bossTitle,
    bossHp: hud.bossHp,
    bossMaxHp: hud.bossMaxHp,
    bossPhase: hud.bossPhase,
    bossMaxPhases: hud.bossMaxPhases,
    bossStyle: opts.bossStyle,
    bossTelegraph: hud.bossTelegraph,
    enemies: hud.bossAlive
      ? [
          {
            id: "arena_boss",
            name: hud.bossName,
            hp: hud.bossHp,
            maxHp: hud.bossMaxHp,
            screenX: hud.bossScreenX,
            screenY: hud.bossScreenY,
            isBoss: true,
            tier: 5,
          },
        ]
      : [],
    damageNumbers: hud.damageNumbers.map((d) => ({
      id: d.id,
      value: d.value,
      x: d.x,
      y: d.y,
      age: d.age,
      isPlayer: d.isPlayer,
      isCrit: d.isCrit,
    })),
    combatLog: hud.combatLog,
    skills: opts.skills.map((s, i) => ({
      ...s,
      readyPct: hud.skillCooldownPct[i] ?? s.readyPct ?? 1,
    })),
    specialReadyPct: 1,
    outcome: hud.outcome,
    resources: undefined,
  };
}

export function fromCampState(
  state: CampStateUpdate,
  opts: {
    charName: string;
    raceClass?: string;
    skills: HudSkillSlot[];
  },
): UnifiedCombatHudState {
  return {
    mode: "camp",
    loaded: state.loaded,
    charName: opts.charName,
    raceClass: opts.raceClass,
    playerLevel: state.playerLevel,
    playerHp: state.playerHp,
    playerMaxHp: state.playerMaxHp,
    playerMana: state.playerMana,
    playerMaxMana: state.playerMaxMana,
    attackReadyPct: state.attackCooldownPct,
    combatLabel: "TRAIN",
    zone: "Sanctuary Camp · Training Ground",
    aliveCount: state.dummies.filter((d) => d.alive).length,
    enemies: state.dummies
      .filter((d) => d.alive)
      .map((d) => ({
        id: d.id,
        name: d.name,
        hp: d.hp,
        maxHp: d.maxHp,
        screenX: d.screenX,
        screenY: d.screenY,
        tier: 1,
      })),
    damageNumbers: state.damageNumbers.map((d) => ({
      id: d.id,
      value: d.value,
      x: d.x,
      y: d.y,
      age: d.age,
      isPlayer: d.isPlayer,
      isCrit: d.isCrit,
    })),
    combatLog: state.combatLog,
    skills: opts.skills.map((s, i) => ({
      ...s,
      readyPct: state.skillCooldownPct[i] ?? s.readyPct ?? 1,
    })),
    interact: state.nearbyStationLabel
      ? {
          title: state.nearbyStationLabel,
          subtitle: state.nearbyStationDistrict ?? undefined,
          hint: state.nearbyStationHint ?? state.nearbyStationAction ?? undefined,
          key: state.promptKey || "E",
        }
      : null,
  };
}

export function fromMobaHud(
  hud: { message: string; wave: number; gold: number; hp: number; kills: number },
  opts: { charName: string; maxHp?: number },
): UnifiedCombatHudState {
  return {
    mode: "moba",
    loaded: true,
    charName: opts.charName,
    playerLevel: 1,
    playerHp: hud.hp,
    playerMaxHp: opts.maxHp ?? 600,
    playerMana: 100,
    playerMaxMana: 100,
    attackReadyPct: 1,
    combatLabel: "LANE",
    zone: "Three Lanes · Annihilate",
    roundOrWave: hud.wave,
    aliveCount: undefined,
    enemies: [],
    damageNumbers: [],
    combatLog: hud.message ? [hud.message] : [],
    skills: [],
    resources: { gold: hud.gold },
    missionLine: `Kills ${hud.kills} · Wave ${hud.wave}`,
  };
}
