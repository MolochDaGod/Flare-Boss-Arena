/**
 * High-level ally AI — follow player, attack RMB target, heal, gather.
 * Max 2 party members. Stateless-ish: all timing lives on AllyAgent.
 */

import * as THREE from "three";
import type { Grudge6Instance } from "./Grudge6Character";
import type { AllyBrainId } from "../../data/grudge6Roster";

export type AllyState = "follow" | "attack" | "heal" | "gather" | "idle" | "down";

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
  dead: boolean;
  /** Unix seconds — auto-respawn at cove when elapsed (0 = no timer). */
  respawnAt: number;
  hurtFlash: number;
}

const FOLLOW_DIST = 2.8;
const LEASH = 22;
const GATHER_RANGE = 2.4;
const ALLY_MOVE_SPEED = 4.5;
const ALLY_SPRINT_DIST = 5.5;

function applyAllyLocomotion(
  agent: AllyAgent,
  moving: boolean,
  moveDir?: THREE.Vector3,
  distToTarget?: number,
) {
  const anim = agent.instance.animator;
  if (!anim) return;
  if (!moving) {
    if (anim.setGaitFromSpeed) anim.setGaitFromSpeed(0, false);
    else anim.setMoving(false);
    anim.setLocoDirection?.("forward");
    return;
  }
  const speed01 = Math.min(1, ALLY_MOVE_SPEED / 6.5);
  const sprint = (distToTarget ?? 0) > ALLY_SPRINT_DIST;
  if (anim.setGaitFromSpeed) anim.setGaitFromSpeed(speed01, sprint);
  else anim.setMoving(true);

  if (moveDir && anim.setLocoDirection) {
    const fx = Math.sin(agent.facing);
    const fz = Math.cos(agent.facing);
    const dot = moveDir.x * fx + moveDir.z * fz;
    const cross = moveDir.x * fz - moveDir.z * fx;
    if (dot < -0.35) anim.setLocoDirection("back");
    else if (cross > 0.35) anim.setLocoDirection("right");
    else if (cross < -0.35) anim.setLocoDirection("left");
    else anim.setLocoDirection("forward");
  }
}

/** Formation offset behind/flanking the player (exported for cove respawn). */
export function allyFormationOffset(slot: number, playerFacing: number): THREE.Vector3 {
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
    dead: false,
    respawnAt: 0,
    hurtFlash: 0,
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
  if (agent.dead) return { type: "idle" };

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

  // Flyer brain: wider leash to flank
  if (brain === "flyer" && world.enemies.length) {
    let best = world.enemies[0]!;
    let bestD = best.pos.distanceTo(agent.pos);
    for (const e of world.enemies) {
      const d = e.pos.distanceTo(agent.pos);
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    focus = best.pos;
    focusId = best.id;
  }

  // Summoner: hang near player, only engage mid-range
  if (brain === "summoner" && focus && focusId) {
    const distP = world.playerPos.distanceTo(agent.pos);
    if (distP > 6) {
      agent.state = "follow";
      return { type: "move", targetPos: world.playerPos.clone() };
    }
  }

  // Siege: ignore distant skirmishes — push toward furthest enemy from base (player)
  if (brain === "siege" && world.enemies.length && !world.focusEnemyId) {
    let best = world.enemies[0]!;
    let bestD = 0;
    for (const e of world.enemies) {
      const d = e.pos.distanceTo(world.playerPos);
      if (d > bestD) {
        bestD = d;
        best = e;
      }
    }
    if (bestD > 4) {
      focus = best.pos;
      focusId = best.id;
    }
  }

  // Patrol: sweep harvest nodes when no combat
  if (brain === "patrol" && !world.focusEnemyId && world.harvest.length) {
    const h = world.harvest[Math.floor(world.now * 0.15) % world.harvest.length]!;
    if (h.pos.distanceTo(agent.pos) > 2.5) {
      agent.state = "gather";
      return { type: "move", targetPos: h.pos.clone() };
    }
  }

  if (focus && focusId && (brain !== "gatherer" || world.focusEnemyId)) {
    const dist = focus.distanceTo(agent.pos);
    const range =
      brain === "skirmish" || brain === "summoner"
        ? kit.attackRange * 1.15
        : brain === "flyer"
          ? kit.attackRange * 1.25
          : kit.attackRange;
    if (dist > range * 0.92) {
      agent.state = "attack";
      // Skirmishers / flyers / summoners keep distance
      if (
        (brain === "skirmish" || brain === "flyer" || brain === "summoner") &&
        dist < range * 0.55
      ) {
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
  const form = world.playerPos.clone().add(allyFormationOffset(agent.followSlot, playerFacing));
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
      applyAllyLocomotion(agent, true, to, d);
      return;
    }
  }
  if (action.type === "attack" && action.targetPos) {
    agent.facing = Math.atan2(action.targetPos.x - agent.pos.x, action.targetPos.z - agent.pos.z);
    applyAllyLocomotion(agent, false);
    agent.instance.animator?.triggerAttack();
    return;
  }
  if (action.type === "heal" || action.type === "harvest") {
    applyAllyLocomotion(agent, false);
    agent.instance.animator?.triggerNamed(["cast", "attack", "boost"]);
    return;
  }
  applyAllyLocomotion(agent, false);
}
