/**
 * High-level ally AI — follow player, attack RMB target, heal, gather.
 * Max 2 party members. Stateless-ish: all timing lives on AllyAgent.
 */

import * as THREE from "three";
import type { Grudge6Instance } from "./Grudge6Character";
import type { AllyBrainId } from "../../data/grudge6Roster";

export type AllyState = "follow" | "attack" | "heal" | "gather" | "idle";

export interface AllyWorldView {
  playerPos: THREE.Vector3;
  playerHp: number;
  playerMaxHp: number;
  /** Player's current RMB / locked target position (null if none). */
  focusTarget: THREE.Vector3 | null;
  focusEnemyId: string | null;
  /** Living enemies with positions. */
  enemies: Array<{ id: string; pos: THREE.Vector3; hp: number; maxHp: number }>;
  /** Harvest nodes (trees/rocks). */
  harvest: Array<{ id: string; pos: THREE.Vector3; kind: "wood" | "stone" }>;
  dt: number;
  now: number;
}

export interface AllyAction {
  type: "move" | "attack" | "heal" | "harvest" | "idle";
  targetPos?: THREE.Vector3;
  enemyId?: string;
  healTarget?: "player" | "self" | "ally";
  harvestId?: string;
}

export interface AllyAgent {
  instance: Grudge6Instance;
  state: AllyState;
  pos: THREE.Vector3;
  facing: number;
  attackCd: number;
  healCd: number;
  skillCd: number;
  hp: number;
  maxHp: number;
  followSlot: number; // 0 or 1 — formation offset
}

const FOLLOW_DIST = 2.8;
const LEASH = 22;
const GATHER_RANGE = 2.4;

function formationOffset(slot: number, playerFacing: number): THREE.Vector3 {
  // Flank left / right behind the player
  const side = slot === 0 ? -1 : 1;
  const back = 1.6;
  const lat = 1.8 * side;
  const fx = Math.sin(playerFacing);
  const fz = Math.cos(playerFacing);
  // right vector
  const rx = fz;
  const rz = -fx;
  return new THREE.Vector3(-fx * back + rx * lat, 0, -fz * back + rz * lat);
}

export function createAllyAgent(instance: Grudge6Instance, slot: number): AllyAgent {
  const kit = instance.def.kit;
  return {
    instance,
    state: "follow",
    pos: new THREE.Vector3(),
    facing: 0,
    attackCd: 0.5 + Math.random(),
    healCd: kit.healCd * 0.3,
    skillCd: 2,
    hp: 180 + kit.damage * 8,
    maxHp: 180 + kit.damage * 8,
    followSlot: slot,
  };
}

/**
 * Decide next action for one ally. Pure-ish decision function.
 */
export function thinkAlly(
  agent: AllyAgent,
  brain: AllyBrainId,
  world: AllyWorldView,
  playerFacing: number,
): AllyAction {
  const kit = agent.instance.def.kit;
  agent.attackCd = Math.max(0, agent.attackCd - world.dt);
  agent.healCd = Math.max(0, agent.healCd - world.dt);
  agent.skillCd = Math.max(0, agent.skillCd - world.dt);

  const toPlayer = world.playerPos.clone().sub(agent.pos);
  const distPlayer = toPlayer.length();

  // Leash: always rejoin if too far
  if (distPlayer > LEASH) {
    agent.state = "follow";
    return { type: "move", targetPos: world.playerPos.clone() };
  }

  // Healer priority: player low HP
  if (brain === "healer" && kit.healAmount > 0 && agent.healCd <= 0) {
    if (world.playerHp < world.playerMaxHp * 0.72) {
      agent.state = "heal";
      agent.healCd = kit.healCd;
      return { type: "heal", healTarget: "player" };
    }
    if (agent.hp < agent.maxHp * 0.5) {
      agent.state = "heal";
      agent.healCd = kit.healCd * 0.85;
      return { type: "heal", healTarget: "self" };
    }
  }

  // Combat: prefer player's focus (RMB), else nearest threat to player
  let focus = world.focusTarget;
  let focusId = world.focusEnemyId;
  if (!focus || !focusId) {
    let best: (typeof world.enemies)[0] | null = null;
    let bestD = 12;
    for (const e of world.enemies) {
      const d = e.pos.distanceTo(world.playerPos);
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    if (best) {
      focus = best.pos;
      focusId = best.id;
    }
  }

  // Assassin: prefer lowest HP% in range
  if (brain === "assassin" && world.enemies.length) {
    let best = world.enemies[0]!;
    let bestRatio = best.hp / Math.max(1, best.maxHp);
    for (const e of world.enemies) {
      const r = e.hp / Math.max(1, e.maxHp);
      if (r < bestRatio && e.pos.distanceTo(agent.pos) < 14) {
        bestRatio = r;
        best = e;
      }
    }
    focus = best.pos;
    focusId = best.id;
  }

  if (focus && focusId && (brain !== "gatherer" || world.focusEnemyId)) {
    const dist = focus.distanceTo(agent.pos);
    const range = brain === "skirmish" ? kit.attackRange : kit.attackRange;
    if (dist > range * 0.92) {
      agent.state = "attack";
      // Skirmishers keep distance
      if (brain === "skirmish" && dist < range * 0.55) {
        const away = agent.pos.clone().sub(focus).normalize();
        return { type: "move", targetPos: agent.pos.clone().add(away.multiplyScalar(2.5)) };
      }
      return { type: "move", targetPos: focus.clone() };
    }
    if (agent.attackCd <= 0) {
      agent.state = "attack";
      agent.attackCd = kit.attackCd;
      return { type: "attack", enemyId: focusId, targetPos: focus.clone() };
    }
    // Hold position facing target
    agent.state = "attack";
    return { type: "idle" };
  }

  // Gatherer / idle: mine nearby resource
  if ((brain === "gatherer" || brain === "bodyguard") && world.harvest.length && !world.focusEnemyId) {
    let nearest = world.harvest[0]!;
    let nd = nearest.pos.distanceTo(agent.pos);
    for (const h of world.harvest) {
      const d = h.pos.distanceTo(agent.pos);
      if (d < nd) {
        nd = d;
        nearest = h;
      }
    }
    // Only gather if close to player corridor
    if (nd < 14 && nearest.pos.distanceTo(world.playerPos) < 16) {
      if (nd > GATHER_RANGE) {
        agent.state = "gather";
        return { type: "move", targetPos: nearest.pos.clone() };
      }
      if (agent.attackCd <= 0) {
        agent.attackCd = 0.9;
        agent.state = "gather";
        return { type: "harvest", harvestId: nearest.id, targetPos: nearest.pos.clone() };
      }
    }
  }

  // Default follow formation
  agent.state = "follow";
  const form = world.playerPos.clone().add(formationOffset(agent.followSlot, playerFacing));
  if (agent.pos.distanceTo(form) > FOLLOW_DIST * 0.45) {
    return { type: "move", targetPos: form };
  }
  return { type: "idle" };
}

/** Integrate movement for an ally. */
export function stepAllyMovement(
  agent: AllyAgent,
  action: AllyAction,
  speed: number,
  dt: number,
  clamp: (p: THREE.Vector3) => void,
) {
  if (action.type === "move" && action.targetPos) {
    const to = action.targetPos.clone().sub(agent.pos);
    const d = to.length();
    if (d > 0.12) {
      to.normalize();
      agent.pos.x += to.x * speed * dt;
      agent.pos.z += to.z * speed * dt;
      agent.facing = Math.atan2(to.x, to.z);
      clamp(agent.pos);
      agent.instance.animator?.setMoving(true);
      return;
    }
  }
  if (action.type === "attack" && action.targetPos) {
    agent.facing = Math.atan2(action.targetPos.x - agent.pos.x, action.targetPos.z - agent.pos.z);
    agent.instance.animator?.setMoving(false);
    agent.instance.animator?.triggerAttack();
    return;
  }
  if (action.type === "heal" || action.type === "harvest") {
    agent.instance.animator?.setMoving(false);
    agent.instance.animator?.triggerNamed(["cast", "attack", "boost"]);
    return;
  }
  agent.instance.animator?.setMoving(false);
}
