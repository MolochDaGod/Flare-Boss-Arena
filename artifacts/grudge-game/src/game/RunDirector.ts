import type { EnemyTemplate } from "./GameEngine";
import {
  createFreshRun,
  loadIslandRun,
  saveIslandRun,
  roundScale,
  zoneLabel,
  type IslandPhase,
  type IslandRun,
} from "@/data/islandRun";
import { missionForRound, type RoundMission } from "@/data/missions";
import { pickDungeonBossId } from "@/data/bossMonsters";

export type RunEvent =
  | { type: "mission_progress"; kills: number; goal: number }
  | { type: "boss_alert"; bossId: string }
  | { type: "boss_defeated" }
  | { type: "sail"; round: number; seed: number };

export class RunDirector {
  run: IslandRun;
  mission: RoundMission;

  constructor() {
    this.run = loadIslandRun();
    this.mission = missionForRound(this.run.round);
  }

  get phase(): IslandPhase {
    return this.run.phase;
  }

  get zone(): string {
    return zoneLabel(this.run);
  }

  scaledTemplate(template: EnemyTemplate): EnemyTemplate {
    const { hpMult, dmgMult } = roundScale(this.run.round);
    return {
      ...template,
      hp: Math.round(template.hp * hpMult),
      damage: Math.round(template.damage * dmgMult),
    };
  }

  extraSpawnPacks(): number {
    return roundScale(this.run.round).spawnBonus;
  }

  onKill(isBoss: boolean): RunEvent[] {
    const events: RunEvent[] = [];
    if (isBoss) {
      this.run.bossDefeated = true;
      this.run.phase = "victory";
      saveIslandRun(this.run);
      events.push({ type: "boss_defeated" });
      return events;
    }

    if (this.run.phase === "boss_fight" || this.run.phase === "victory") {
      return events;
    }

    this.run.killsThisRound += 1;
    saveIslandRun(this.run);
    events.push({
      type: "mission_progress",
      kills: this.run.killsThisRound,
      goal: this.mission.killGoal,
    });

    if (this.run.killsThisRound >= this.mission.killGoal && !this.run.bossId) {
      const bossId = pickDungeonBossId(this.run.seed, this.run.round);
      this.run.bossId = bossId;
      this.run.phase = "boss_alert";
      saveIslandRun(this.run);
      events.push({ type: "boss_alert", bossId });
    }
    return events;
  }

  beginBossFight(): string | null {
    if (!this.run.bossId) return null;
    this.run.phase = "boss_fight";
    saveIslandRun(this.run);
    return this.run.bossId;
  }

  canSail(): boolean {
    return this.run.phase === "victory" && this.run.bossDefeated;
  }

  sailToNextIsland(): RunEvent {
    const nextRound = this.run.round + 1;
    const seed = (this.run.seed + nextRound * 9973) >>> 0;
    this.run = {
      seed,
      round: nextRound,
      phase: "explore",
      killsThisRound: 0,
      bossId: null,
      bossDefeated: false,
    };
    this.mission = missionForRound(this.run.round);
    saveIslandRun(this.run);
    return { type: "sail", round: this.run.round, seed: this.run.seed };
  }

  resetRun(): void {
    this.run = createFreshRun();
    this.mission = missionForRound(this.run.round);
    saveIslandRun(this.run);
  }
}