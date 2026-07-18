/**
 * MOBA game mode for Flare Boss Arena.
 *
 * Three lanes (top / mid / bot), twin bases, periodic minion waves,
 * tower posts, and optional hero pick from Annihilate 24.
 * Designed as a lightweight client-side arena (no netcode).
 */

import * as THREE from "three";

export type MobaLane = "top" | "mid" | "bot";
export type MobaTeam = "radiant" | "dire";

export interface MobaTower {
  id: string;
  team: MobaTeam;
  lane: MobaLane;
  pos: THREE.Vector3;
  hp: number;
  maxHp: number;
  range: number;
  damage: number;
  destroyed: boolean;
}

export interface MobaMinion {
  id: string;
  team: MobaTeam;
  lane: MobaLane;
  pos: THREE.Vector3;
  hp: number;
  maxHp: number;
  damage: number;
  speed: number;
  targetId: string | null;
}

export interface MobaHeroState {
  team: MobaTeam;
  fighterId: string;
  pos: THREE.Vector3;
  hp: number;
  maxHp: number;
  gold: number;
  level: number;
  kills: number;
  deaths: number;
}

export interface MobaMatchState {
  time: number;
  wave: number;
  radiantScore: number;
  direScore: number;
  towers: MobaTower[];
  minions: MobaMinion[];
  player: MobaHeroState;
  /** Simple AI heroes on both teams. */
  bots: MobaHeroState[];
  winner: MobaTeam | null;
  message: string;
}

const LANE_PATHS: Record<MobaLane, THREE.Vector3[]> = {
  top: [
    new THREE.Vector3(-40, 0, -40),
    new THREE.Vector3(-40, 0, 0),
    new THREE.Vector3(-40, 0, 40),
    new THREE.Vector3(0, 0, 40),
    new THREE.Vector3(40, 0, 40),
  ],
  mid: [
    new THREE.Vector3(-40, 0, -40),
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(40, 0, 40),
  ],
  bot: [
    new THREE.Vector3(-40, 0, -40),
    new THREE.Vector3(0, 0, -40),
    new THREE.Vector3(40, 0, -40),
    new THREE.Vector3(40, 0, 0),
    new THREE.Vector3(40, 0, 40),
  ],
};

function tower(team: MobaTeam, lane: MobaLane, t: number, id: string): MobaTower {
  const path = LANE_PATHS[lane];
  const i = Math.min(path.length - 1, Math.floor(t * (path.length - 1)));
  const pos = path[i]!.clone();
  // Pull towers slightly toward team base
  if (team === "radiant") pos.multiplyScalar(0.55).add(new THREE.Vector3(-8, 0, -8));
  else pos.multiplyScalar(0.55).add(new THREE.Vector3(8, 0, 8));
  return {
    id,
    team,
    lane,
    pos,
    hp: 1200,
    maxHp: 1200,
    range: 9,
    damage: 22,
    destroyed: false,
  };
}

let _mid = 1;
function mid(): string {
  return `m${_mid++}`;
}

export function createMobaMatch(fighterId: string): MobaMatchState {
  const towers: MobaTower[] = [];
  for (const lane of ["top", "mid", "bot"] as MobaLane[]) {
    towers.push(tower("radiant", lane, 0.35, `rt_${lane}`));
    towers.push(tower("dire", lane, 0.65, `dt_${lane}`));
  }
  // Cores / bases
  towers.push({
    id: "radiant_core",
    team: "radiant",
    lane: "mid",
    pos: new THREE.Vector3(-48, 0, -48),
    hp: 2500,
    maxHp: 2500,
    range: 12,
    damage: 40,
    destroyed: false,
  });
  towers.push({
    id: "dire_core",
    team: "dire",
    lane: "mid",
    pos: new THREE.Vector3(48, 0, 48),
    hp: 2500,
    maxHp: 2500,
    range: 12,
    damage: 40,
    destroyed: false,
  });

  return {
    time: 0,
    wave: 0,
    radiantScore: 0,
    direScore: 0,
    towers,
    minions: [],
    player: {
      team: "radiant",
      fighterId,
      pos: new THREE.Vector3(-36, 0, -36),
      hp: 600,
      maxHp: 600,
      gold: 500,
      level: 1,
      kills: 0,
      deaths: 0,
    },
    bots: [
      {
        team: "dire",
        fighterId: "g6_orc_warrior",
        pos: new THREE.Vector3(36, 0, 36),
        hp: 550,
        maxHp: 550,
        gold: 500,
        level: 1,
        kills: 0,
        deaths: 0,
      },
      {
        team: "radiant",
        fighterId: "g6_elf_ranger",
        pos: new THREE.Vector3(-32, 0, -40),
        hp: 480,
        maxHp: 480,
        gold: 500,
        level: 1,
        kills: 0,
        deaths: 0,
      },
      {
        team: "dire",
        fighterId: "g6_undead_mage",
        pos: new THREE.Vector3(40, 0, 32),
        hp: 420,
        maxHp: 420,
        gold: 500,
        level: 1,
        kills: 0,
        deaths: 0,
      },
    ],
    winner: null,
    message: "MOBA — defend your core, push three lanes. Waves every 30s.",
  };
}

function spawnWave(state: MobaMatchState) {
  state.wave += 1;
  for (const lane of ["top", "mid", "bot"] as MobaLane[]) {
    for (let i = 0; i < 3; i++) {
      const rPath = LANE_PATHS[lane][0]!.clone().add(new THREE.Vector3(-2 + i, 0, -1));
      const dPath = LANE_PATHS[lane][LANE_PATHS[lane].length - 1]!.clone().add(
        new THREE.Vector3(2 - i, 0, 1),
      );
      state.minions.push({
        id: mid(),
        team: "radiant",
        lane,
        pos: rPath,
        hp: 120 + state.wave * 12,
        maxHp: 120 + state.wave * 12,
        damage: 10 + state.wave,
        speed: 3.2,
        targetId: null,
      });
      state.minions.push({
        id: mid(),
        team: "dire",
        lane,
        pos: dPath,
        hp: 120 + state.wave * 12,
        maxHp: 120 + state.wave * 12,
        damage: 10 + state.wave,
        speed: 3.2,
        targetId: null,
      });
    }
  }
  state.message = `Wave ${state.wave} marching all lanes.`;
}

function nearestEnemyTower(state: MobaMatchState, team: MobaTeam, from: THREE.Vector3): MobaTower | null {
  let best: MobaTower | null = null;
  let bd = Infinity;
  for (const t of state.towers) {
    if (t.destroyed || t.team === team) continue;
    const d = t.pos.distanceTo(from);
    if (d < bd) {
      bd = d;
      best = t;
    }
  }
  return best;
}

function stepMinion(m: MobaMinion, state: MobaMatchState, dt: number) {
  if (m.hp <= 0) return;
  const path = LANE_PATHS[m.lane];
  const goal =
    m.team === "radiant"
      ? path[path.length - 1]!.clone()
      : path[0]!.clone();
  // Prefer attacking enemy minions / towers in range
  let targetPos = goal;
  let attackTarget: { hp: number; maxHp: number; damage?: number } | null = null;

  for (const o of state.minions) {
    if (o.team === m.team || o.hp <= 0) continue;
    if (o.pos.distanceTo(m.pos) < 2.4) {
      attackTarget = o;
      targetPos = o.pos;
      break;
    }
  }
  if (!attackTarget) {
    const tw = nearestEnemyTower(state, m.team, m.pos);
    if (tw && tw.pos.distanceTo(m.pos) < tw.range * 0.85) {
      attackTarget = tw;
      targetPos = tw.pos;
    }
  }

  if (attackTarget && m.pos.distanceTo(targetPos) < 2.2) {
    attackTarget.hp -= m.damage * dt;
    if (attackTarget.hp <= 0 && "destroyed" in attackTarget) {
      (attackTarget as MobaTower).destroyed = true;
      (attackTarget as MobaTower).hp = 0;
      if (m.team === "radiant") state.radiantScore += 1;
      else state.direScore += 1;
    }
    return;
  }

  const dir = targetPos.clone().sub(m.pos);
  dir.y = 0;
  const len = dir.length() || 1;
  dir.multiplyScalar((m.speed * dt) / len);
  m.pos.add(dir);
}

function stepBot(bot: MobaHeroState, state: MobaMatchState, dt: number) {
  if (bot.hp <= 0) {
    bot.hp = bot.maxHp;
    bot.deaths += 1;
    bot.pos.set(
      bot.team === "radiant" ? -36 : 36,
      0,
      bot.team === "radiant" ? -36 : 36,
    );
    return;
  }
  const enemyCore = state.towers.find(
    (t) => t.id === (bot.team === "radiant" ? "dire_core" : "radiant_core"),
  );
  const target = enemyCore && !enemyCore.destroyed ? enemyCore.pos : new THREE.Vector3(0, 0, 0);
  const dir = target.clone().sub(bot.pos);
  dir.y = 0;
  const d = dir.length() || 1;
  dir.multiplyScalar((3.8 * dt) / d);
  bot.pos.add(dir);

  // Damage nearby enemy minions / towers
  for (const m of state.minions) {
    if (m.team === bot.team || m.hp <= 0) continue;
    if (m.pos.distanceTo(bot.pos) < 2.5) m.hp -= 28 * dt;
  }
  for (const t of state.towers) {
    if (t.team === bot.team || t.destroyed) continue;
    if (t.pos.distanceTo(bot.pos) < 3) t.hp -= 18 * dt;
    if (t.hp <= 0) {
      t.destroyed = true;
      t.hp = 0;
    }
  }
}

/** Towers shoot nearest enemy unit. */
function stepTowers(state: MobaMatchState, dt: number) {
  for (const t of state.towers) {
    if (t.destroyed) continue;
    let best: MobaMinion | null = null;
    let bd = t.range;
    for (const m of state.minions) {
      if (m.team === t.team || m.hp <= 0) continue;
      const d = m.pos.distanceTo(t.pos);
      if (d < bd) {
        bd = d;
        best = m;
      }
    }
    if (best) best.hp -= t.damage * dt;

    // Core also damages player if close
    if (t.id.endsWith("_core")) {
      const foe = t.team === "radiant" ? null : state.player;
      if (foe && foe.team !== t.team && foe.pos.distanceTo(t.pos) < t.range) {
        foe.hp -= t.damage * 0.6 * dt;
      }
    }
  }
}

export function updateMobaMatch(
  state: MobaMatchState,
  dt: number,
  playerInput: { x: number; z: number; attack: boolean },
): MobaMatchState {
  if (state.winner) return state;

  state.time += dt;
  if (state.time > 5 && state.minions.length === 0) spawnWave(state);
  if (state.time > 30 * (state.wave + 1) && state.wave < 30) spawnWave(state);

  // Player move
  const p = state.player;
  if (p.hp > 0) {
    p.pos.x += playerInput.x * 5.5 * dt;
    p.pos.z += playerInput.z * 5.5 * dt;
    p.pos.x = Math.max(-55, Math.min(55, p.pos.x));
    p.pos.z = Math.max(-55, Math.min(55, p.pos.z));
    if (playerInput.attack) {
      for (const m of state.minions) {
        if (m.team === p.team || m.hp <= 0) continue;
        if (m.pos.distanceTo(p.pos) < 3) {
          m.hp -= 55 * dt;
          if (m.hp <= 0) {
            p.gold += 25;
            p.kills += 0; // creeps don't count as hero kills
          }
        }
      }
      for (const t of state.towers) {
        if (t.team === p.team || t.destroyed) continue;
        if (t.pos.distanceTo(p.pos) < 3.2) t.hp -= 35 * dt;
        if (t.hp <= 0) {
          t.destroyed = true;
          t.hp = 0;
          p.gold += 150;
          state.message = `${t.id} destroyed!`;
        }
      }
      for (const b of state.bots) {
        if (b.team === p.team || b.hp <= 0) continue;
        if (b.pos.distanceTo(p.pos) < 2.8) {
          b.hp -= 40 * dt;
          if (b.hp <= 0) {
            p.kills += 1;
            p.gold += 200;
            state.message = `Hero kill — ${b.fighterId}`;
          }
        }
      }
    }
  } else {
    p.deaths += 1;
    p.hp = p.maxHp;
    p.pos.set(-36, 0, -36);
  }

  for (const m of state.minions) stepMinion(m, state, dt);
  state.minions = state.minions.filter((m) => m.hp > 0);
  for (const b of state.bots) stepBot(b, state, dt);
  stepTowers(state, dt);

  const rCore = state.towers.find((t) => t.id === "radiant_core");
  const dCore = state.towers.find((t) => t.id === "dire_core");
  if (rCore?.destroyed) {
    state.winner = "dire";
    state.message = "Dire victory — radiant core fallen.";
  } else if (dCore?.destroyed) {
    state.winner = "radiant";
    state.message = "Radiant victory — dire core fallen!";
  }

  return state;
}

export function mobaLaneWaypoints(lane: MobaLane): THREE.Vector3[] {
  return LANE_PATHS[lane].map((p) => p.clone());
}
