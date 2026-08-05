/**
 * High-level ally AI — goal/objective pipeline + brain-biased behaviors.
 * Max 2 party members. Timing lives on AllyAgent; goals from AllyGoals.
 */

import * as THREE from "three";
import type { Grudge6Instance } from "./Grudge6Character";
import type { AllyBrainId } from "../../data/grudge6Roster";
import { selectAllyGoal, planAllyAction, type AllyGoal } from "./AllyGoals";

export type AllyState = "follow" | "attack" | "heal" | "gather" | "idle" | "down";
export type { AllyGoal };

export interface AllyZoneHint {
  id: string;
  kind: string;
  x: number;
  z: number;
  radius: number;
  areaLevel: number;
  density: number;
  owner: string;
}

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
  /** Zone under player (D2-style area awareness). */
  playerZone: AllyZoneHint | null;
  /** Hot zone to clear (high density / mission path). */
  objectiveZone: AllyZoneHint | null;
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
  /** Pathfinding waypoints (world XZ). */
  path: THREE.Vector3[];
  pathRepathAt: number;
  /** Deploy mode: hold a claimed camp pad instead of following. */
  deployHold: THREE.Vector3 | null;
  /**
   * Tower manning — world position on a player-built watchtower platform.
   * When set, ally stays elevated and gains ranged reach.
   */
  towerManned: THREE.Vector3 | null;
  /** Active goal for HUD / debug (set each think). */
  currentGoal: AllyGoal | null;
}

const ALLY_MOVE_SPEED = 5.1;
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
    path: [],
    pathRepathAt: 0,
    deployHold: null,
    towerManned: null,
    currentGoal: null,
  };
}

/** Deploy ally to hold a claim pad / camp (player-issued). */
export function deployAllyTo(agent: AllyAgent, worldPos: THREE.Vector3 | null) {
  agent.deployHold = worldPos ? worldPos.clone() : null;
  agent.towerManned = null;
  agent.path = [];
  agent.pathRepathAt = 0;
  if (worldPos) agent.state = "follow";
}

/** Station ally on a watchtower man-slot (elevated lookout). */
export function manTower(agent: AllyAgent, manSlot: THREE.Vector3 | null) {
  agent.towerManned = manSlot ? manSlot.clone() : null;
  agent.deployHold = manSlot ? new THREE.Vector3(manSlot.x, 0, manSlot.z) : null;
  agent.path = [];
  agent.pathRepathAt = 0;
  if (manSlot) {
    agent.pos.set(manSlot.x, 0, manSlot.z);
    agent.state = "idle";
    agent.currentGoal = {
      kind: "hold_pad",
      priority: 90,
      targetPos: new THREE.Vector3(manSlot.x, 0, manSlot.z),
      label: "Manning tower",
    };
  }
}

/**
 * Decide next action: goal selection (brain-biased) → action plan.
 */
export function thinkAlly(
  agent: AllyAgent,
  brain: AllyBrainId,
  world: AllyWorldView,
  playerFacing: number,
): AllyAction {
  if (agent.dead) return { type: "idle" };

  agent.attackCd = Math.max(0, agent.attackCd - world.dt);
  agent.healCd = Math.max(0, agent.healCd - world.dt);
  agent.skillCd = Math.max(0, agent.skillCd - world.dt);

  // Summoner: stay close to player before other goals
  if (brain === "summoner" && agent.pos.distanceTo(world.playerPos) > 6) {
    agent.state = "follow";
    agent.currentGoal = {
      kind: "rejoin",
      priority: 99,
      targetPos: world.playerPos.clone(),
      label: "Stay with commander",
    };
    return { type: "move", targetPos: world.playerPos.clone() };
  }

  const goal = selectAllyGoal(agent, brain, world);
  agent.currentGoal = goal;
  return planAllyAction(agent, goal, brain, world, playerFacing, allyFormationOffset);
}

/** Integrate movement for an ally (uses path waypoints when set). */
export function stepAllyMovement(
  agent: AllyAgent,
  action: AllyAction,
  speed: number,
  dt: number,
  clamp: (p: THREE.Vector3) => void,
) {
  if (action.type === "move" && action.targetPos) {
    // Follow path if we have waypoints remaining
    if (agent.path.length > 0) {
      const wp = agent.path[0]!;
      const to = wp.clone().sub(agent.pos);
      const d = to.length();
      if (d < 0.4) {
        agent.path.shift();
      } else {
        to.normalize();
        agent.pos.x += to.x * speed * dt;
        agent.pos.z += to.z * speed * dt;
        agent.facing = Math.atan2(to.x, to.z);
        clamp(agent.pos);
        applyAllyLocomotion(agent, true, to, d);
        return;
      }
    }
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
