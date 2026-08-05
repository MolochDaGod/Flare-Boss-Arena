/**
 * Goal / objective AI for Grudge6 party allies.
 *
 * Pipeline: world view → select goal (brain-biased) → plan action → movement.
 * Goals are short-lived objectives; brains prefer different goal priorities.
 */

import * as THREE from "three";
import type { AllyBrainId } from "../../data/grudge6Roster";
import type { AllyAction, AllyAgent, AllyWorldView } from "./AllyBrain";

export type AllyGoalKind =
  | "protect_player"
  | "eliminate_threat"
  | "finish_weak"
  | "hold_pad"
  | "harvest"
  | "heal_player"
  | "heal_self"
  | "flank_threat"
  | "siege_push"
  | "patrol_sweep"
  | "rejoin"
  | "clear_zone"
  | "hold_zone";

export interface AllyGoal {
  kind: AllyGoalKind;
  /** Priority 0–100 (higher wins). */
  priority: number;
  enemyId?: string;
  targetPos?: THREE.Vector3;
  harvestId?: string;
  /** Human-readable for HUD / debug. */
  label: string;
}

const LEASH = 22;

function nearestEnemy(
  world: AllyWorldView,
  from: THREE.Vector3,
  maxDist = 16,
): { id: string; pos: THREE.Vector3; hp: number; maxHp: number } | null {
  let best: (typeof world.enemies)[0] | null = null;
  let bestD = maxDist;
  for (const e of world.enemies) {
    const d = e.pos.distanceTo(from);
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  return best;
}

function weakestEnemy(
  world: AllyWorldView,
  from: THREE.Vector3,
  maxDist = 14,
): { id: string; pos: THREE.Vector3; hp: number; maxHp: number } | null {
  let best: (typeof world.enemies)[0] | null = null;
  let bestRatio = 2;
  for (const e of world.enemies) {
    if (e.pos.distanceTo(from) > maxDist) continue;
    const r = e.hp / Math.max(1, e.maxHp);
    if (r < bestRatio) {
      bestRatio = r;
      best = e;
    }
  }
  return best;
}

function furthestFromPlayer(world: AllyWorldView): (typeof world.enemies)[0] | null {
  let best: (typeof world.enemies)[0] | null = null;
  let bestD = 0;
  for (const e of world.enemies) {
    const d = e.pos.distanceTo(world.playerPos);
    if (d > bestD) {
      bestD = d;
      best = e;
    }
  }
  return bestD > 4 ? best : null;
}

/**
 * Score and pick the active goal for this brain + world snapshot.
 */
export function selectAllyGoal(
  agent: AllyAgent,
  brain: AllyBrainId,
  world: AllyWorldView,
): AllyGoal {
  const goals: AllyGoal[] = [];
  const distPlayer = agent.pos.distanceTo(world.playerPos);
  const kit = agent.instance.def.kit;

  // Universal: rejoin if leashed out
  if (distPlayer > LEASH) {
    return {
      kind: "rejoin",
      priority: 100,
      targetPos: world.playerPos.clone(),
      label: "Rejoin commander",
    };
  }

  // Zone intelligence (D2-style): clear dense packs near player / objective
  const pz = world.playerZone;
  if (pz && pz.density >= 0.55 && !agent.towerManned) {
    const inZone = nearestEnemy(
      world,
      new THREE.Vector3(pz.x, 0, pz.z),
      pz.radius + 4,
    );
    if (inZone) {
      goals.push({
        kind: "clear_zone",
        priority: brain === "siege" || brain === "assassin" ? 86 : 74,
        enemyId: inZone.id,
        targetPos: inZone.pos.clone(),
        label: `Clear ${pz.kind} (L${pz.areaLevel})`,
      });
    } else if (brain === "patrol" || brain === "siege") {
      goals.push({
        kind: "hold_zone",
        priority: 48,
        targetPos: new THREE.Vector3(pz.x, 0, pz.z),
        label: `Sweep ${pz.kind}`,
      });
    }
  }
  const oz = world.objectiveZone;
  if (oz && brain === "siege" && !agent.towerManned) {
    const dObj = Math.hypot(agent.pos.x - oz.x, agent.pos.z - oz.z);
    if (dObj > oz.radius * 0.8 && dObj < 40) {
      goals.push({
        kind: "siege_push",
        priority: 72,
        targetPos: new THREE.Vector3(oz.x, 0, oz.z),
        label: `Push ${oz.kind}`,
      });
    }
  }

  // Heal goals
  if (kit.healAmount > 0 && agent.healCd <= 0) {
    if (world.playerHp < world.playerMaxHp * 0.72) {
      goals.push({
        kind: "heal_player",
        priority: brain === "healer" ? 95 : 70,
        label: "Heal commander",
      });
    }
    if (agent.hp < agent.maxHp * 0.45) {
      goals.push({
        kind: "heal_self",
        priority: brain === "healer" ? 88 : 55,
        label: "Self-heal",
      });
    }
  }

  // Focus target from player RMB
  if (world.focusTarget && world.focusEnemyId) {
    goals.push({
      kind: "eliminate_threat",
      priority: brain === "bodyguard" || brain === "skirmish" ? 92 : 80,
      enemyId: world.focusEnemyId,
      targetPos: world.focusTarget.clone(),
      label: "Engage focus target",
    });
  }

  // Threat near player
  const nearPlayer = nearestEnemy(world, world.playerPos, 12);
  if (nearPlayer) {
    goals.push({
      kind: "protect_player",
      priority: brain === "bodyguard" ? 90 : 75,
      enemyId: nearPlayer.id,
      targetPos: nearPlayer.pos.clone(),
      label: "Protect commander",
    });
  }

  // Assassin: finish weak
  if (brain === "assassin") {
    const weak = weakestEnemy(world, agent.pos, 14);
    if (weak && weak.hp / Math.max(1, weak.maxHp) < 0.45) {
      goals.push({
        kind: "finish_weak",
        priority: 93,
        enemyId: weak.id,
        targetPos: weak.pos.clone(),
        label: "Finish wounded foe",
      });
    }
  }

  // Flyer / skirmish: flank nearest
  if (brain === "flyer" || brain === "skirmish") {
    const near = nearestEnemy(world, agent.pos, 16);
    if (near) {
      goals.push({
        kind: "flank_threat",
        priority: 82,
        enemyId: near.id,
        targetPos: near.pos.clone(),
        label: "Flank threat",
      });
    }
  }

  // Siege: push furthest
  if (brain === "siege") {
    const far = furthestFromPlayer(world);
    if (far) {
      goals.push({
        kind: "siege_push",
        priority: 78,
        enemyId: far.id,
        targetPos: far.pos.clone(),
        label: "Push frontline",
      });
    }
  }

  // Tower manning — stay put, snipe threats in extended range
  if (agent.towerManned) {
    const slot = agent.towerManned;
    goals.push({
      kind: "hold_pad",
      priority: 95,
      targetPos: new THREE.Vector3(slot.x, 0, slot.z),
      label: "Manning tower",
    });
    const towerThreat = nearestEnemy(world, new THREE.Vector3(slot.x, 0, slot.z), 16);
    if (towerThreat) {
      goals.push({
        kind: "eliminate_threat",
        priority: 96,
        enemyId: towerThreat.id,
        targetPos: towerThreat.pos.clone(),
        label: "Tower shot",
      });
    }
  }

  // Deploy hold (ground pad)
  if (agent.deployHold && !agent.towerManned) {
    goals.push({
      kind: "hold_pad",
      priority: world.focusEnemyId ? 60 : 85,
      targetPos: agent.deployHold.clone(),
      label: "Hold camp pad",
    });
    const padThreat = nearestEnemy(world, agent.deployHold, 11);
    if (padThreat) {
      goals.push({
        kind: "eliminate_threat",
        priority: 91,
        enemyId: padThreat.id,
        targetPos: padThreat.pos.clone(),
        label: "Defend pad",
      });
    }
  }

  // Harvest / patrol when quiet
  if (
    !world.focusEnemyId &&
    world.harvest.length &&
    (brain === "gatherer" || brain === "patrol" || brain === "bodyguard")
  ) {
    let nearest = world.harvest[0]!;
    let nd = nearest.pos.distanceTo(agent.pos);
    for (const h of world.harvest) {
      const d = h.pos.distanceTo(agent.pos);
      if (d < nd) {
        nd = d;
        nearest = h;
      }
    }
    if (nd < 14 && nearest.pos.distanceTo(world.playerPos) < 16) {
      goals.push({
        kind: brain === "patrol" ? "patrol_sweep" : "harvest",
        priority: brain === "gatherer" ? 72 : 50,
        harvestId: nearest.id,
        targetPos: nearest.pos.clone(),
        label: brain === "patrol" ? "Patrol harvest" : "Gather resources",
      });
    }
  }

  // Default escort
  goals.push({
    kind: "protect_player",
    priority: 40,
    targetPos: world.playerPos.clone(),
    label: "Escort formation",
  });

  goals.sort((a, b) => b.priority - a.priority);
  return goals[0]!;
}

/**
 * Convert a goal into a concrete AllyAction for the movement/combat stepper.
 */
export function planAllyAction(
  agent: AllyAgent,
  goal: AllyGoal,
  brain: AllyBrainId,
  world: AllyWorldView,
  playerFacing: number,
  formationOffset: (slot: number, facing: number) => THREE.Vector3,
): AllyAction {
  const kit = agent.instance.def.kit;

  switch (goal.kind) {
    case "rejoin":
      agent.state = "follow";
      return { type: "move", targetPos: goal.targetPos ?? world.playerPos.clone() };

    case "heal_player":
      agent.state = "heal";
      agent.healCd = kit.healCd;
      return { type: "heal", healTarget: "player" };

    case "heal_self":
      agent.state = "heal";
      agent.healCd = kit.healCd * 0.85;
      return { type: "heal", healTarget: "self" };

    case "eliminate_threat":
    case "protect_player":
    case "finish_weak":
    case "flank_threat":
    case "siege_push": {
      if (!goal.targetPos || !goal.enemyId) break;
      const dist = Math.hypot(goal.targetPos.x - agent.pos.x, goal.targetPos.z - agent.pos.z);
      let range =
        brain === "skirmish" || brain === "summoner"
          ? kit.attackRange * 1.15
          : brain === "flyer"
            ? kit.attackRange * 1.25
            : kit.attackRange;
      // Watchtower lookout — extended range, no kite/move
      if (agent.towerManned) {
        range = Math.max(range * 2.2, 14);
        if (dist <= range && agent.attackCd <= 0) {
          agent.state = "attack";
          agent.attackCd = kit.attackCd * 0.9;
          return {
            type: "attack",
            enemyId: goal.enemyId,
            targetPos: goal.targetPos.clone(),
          };
        }
        agent.state = "attack";
        return { type: "idle" };
      }
      // Skirmish kite
      if (
        (brain === "skirmish" || brain === "flyer" || brain === "summoner") &&
        dist < range * 0.55
      ) {
        const away = agent.pos.clone().sub(goal.targetPos).normalize();
        agent.state = "attack";
        return { type: "move", targetPos: agent.pos.clone().add(away.multiplyScalar(2.5)) };
      }
      if (dist > range * 0.92) {
        agent.state = "attack";
        return { type: "move", targetPos: goal.targetPos.clone() };
      }
      if (agent.attackCd <= 0) {
        agent.state = "attack";
        agent.attackCd = kit.attackCd;
        return {
          type: "attack",
          enemyId: goal.enemyId,
          targetPos: goal.targetPos.clone(),
        };
      }
      agent.state = "attack";
      return { type: "idle" };
    }

    case "hold_pad":
    case "hold_zone": {
      const hold = goal.targetPos ?? agent.deployHold;
      if (!hold) break;
      const dh = Math.hypot(hold.x - agent.pos.x, hold.z - agent.pos.z);
      if (dh > (goal.kind === "hold_zone" ? 3.5 : 1.4)) {
        agent.state = "follow";
        return { type: "move", targetPos: hold.clone() };
      }
      agent.state = "idle";
      return { type: "idle" };
    }

    case "clear_zone": {
      if (!goal.targetPos || !goal.enemyId) break;
      const dist = Math.hypot(goal.targetPos.x - agent.pos.x, goal.targetPos.z - agent.pos.z);
      const range = kit.attackRange * (brain === "skirmish" ? 1.2 : 1);
      if (dist > range * 0.95) {
        agent.state = "attack";
        return { type: "move", targetPos: goal.targetPos.clone() };
      }
      if (agent.attackCd <= 0) {
        agent.state = "attack";
        agent.attackCd = kit.attackCd;
        return { type: "attack", enemyId: goal.enemyId, targetPos: goal.targetPos.clone() };
      }
      agent.state = "attack";
      return { type: "idle" };
    }

    case "harvest":
    case "patrol_sweep": {
      if (!goal.targetPos) break;
      const nd = goal.targetPos.distanceTo(agent.pos);
      if (nd > 2.4) {
        agent.state = "gather";
        return { type: "move", targetPos: goal.targetPos.clone() };
      }
      if (agent.attackCd <= 0 && goal.harvestId) {
        agent.attackCd = 0.9;
        agent.state = "gather";
        return {
          type: "harvest",
          harvestId: goal.harvestId,
          targetPos: goal.targetPos.clone(),
        };
      }
      return { type: "idle" };
    }

    default:
      break;
  }

  // Escort formation
  agent.state = "follow";
  const form = world.playerPos.clone().add(formationOffset(agent.followSlot, playerFacing));
  if (agent.pos.distanceTo(form) > 2.8 * 0.45) {
    return { type: "move", targetPos: form };
  }
  return { type: "idle" };
}
