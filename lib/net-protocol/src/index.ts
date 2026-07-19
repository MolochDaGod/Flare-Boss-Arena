/**
 * Shared multiplayer protocol (browser Socket.IO ↔ Node).
 * Mirror is Unity-only — web clients use this schema with Socket.IO.
 *
 * Inspired by three-player-controller multiplayer-gltf patterns:
 * join → spawn GLTF avatar → stream transform snapshots → combat events → kill feed.
 */

export const NET_PROTOCOL_VERSION = 1;

/** Default simulation tick (server broadcast Hz). */
export const NET_TICK_HZ = 20;
export const NET_TICK_MS = 1000 / NET_TICK_HZ;

export type RoomKind = "pve" | "arena";

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface PlayerPublic {
  id: string;
  name: string;
  modelUrl: string;
  /** 0..1 */
  hp: number;
  maxHp: number;
  kills: number;
  deaths: number;
  team?: string;
  ready?: boolean;
}

export interface PlayerSnapshot {
  id: string;
  p: Vec3;
  /** yaw radians */
  r: number;
  /** optional pitch for FPS */
  pitch?: number;
  /** animation state key */
  anim?: string;
  hp: number;
  seq: number;
  t: number;
}

export interface InputFrame {
  seq: number;
  /** WASD bits or axes */
  ax: number;
  az: number;
  jump?: boolean;
  fire?: boolean;
  aim?: Vec3;
  yaw: number;
  t: number;
}

export interface HitEvent {
  attackerId: string;
  targetId: string;
  damage: number;
  kind: "melee" | "projectile" | "aoe" | "env";
  pos?: Vec3;
}

export interface KillEvent {
  killerId: string;
  victimId: string;
  killerName: string;
  victimName: string;
  weapon?: string;
}

/** Client → server */
export type ClientMessage =
  | { op: "hello"; protocol: number; name: string; modelUrl?: string; raceId?: string }
  | { op: "join"; room: string; kind: RoomKind; instanceId?: string }
  | { op: "leave" }
  | { op: "input"; frame: InputFrame }
  | { op: "fire"; origin: Vec3; dir: Vec3; weapon?: string }
  | { op: "chat"; text: string }
  | { op: "ready"; ready: boolean }
  | { op: "respawn" };

/** Server → client */
export type ServerMessage =
  | { op: "welcome"; playerId: string; protocol: number; tickHz: number }
  | { op: "room"; room: string; kind: RoomKind; instanceId: string; seed: number; players: PlayerPublic[] }
  | { op: "join_player"; player: PlayerPublic }
  | { op: "leave_player"; playerId: string }
  | { op: "snapshot"; t: number; players: PlayerSnapshot[] }
  | { op: "hit"; event: HitEvent }
  | { op: "kill"; event: KillEvent }
  | { op: "chat"; playerId: string; name: string; text: string }
  | { op: "scoreboard"; players: PlayerPublic[] }
  | { op: "match_end"; winnerId?: string; reason: string }
  | { op: "error"; code: string; message: string }
  | { op: "pong"; t: number };

export function roomNamePve(instanceId: string, partyId?: string): string {
  return partyId ? `pve:${instanceId}:${partyId}` : `pve:${instanceId}`;
}

export function roomNameArena(matchId: string): string {
  return `arena:${matchId}`;
}

export function quantizePos(v: Vec3, scale = 100): Vec3 {
  return {
    x: Math.round(v.x * scale) / scale,
    y: Math.round(v.y * scale) / scale,
    z: Math.round(v.z * scale) / scale,
  };
}
