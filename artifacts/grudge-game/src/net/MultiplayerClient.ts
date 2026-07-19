/**
 * Browser multiplayer client (Socket.IO + GLTF avatar URLs).
 * Mirrors three-player-controller multiplayer-gltf flow:
 * hello → join room → snapshot stream → fire/hit/kill/chat.
 */
import { io, type Socket } from "socket.io-client";
import type {
  ClientMessage,
  PlayerPublic,
  PlayerSnapshot,
  RoomKind,
  ServerMessage,
  Vec3,
} from "@workspace/net-protocol";
import { NET_PROTOCOL_VERSION } from "@workspace/net-protocol";
import { getMpServerUrl } from "@/data/grudgeFleet";
import { recordScoreEvent } from "@/data/flareLeaderboards";

export interface MpClientOpts {
  url?: string;
  autoConnect?: boolean;
}

export type MpHandlers = {
  onWelcome?: (playerId: string) => void;
  onRoom?: (info: {
    room: string;
    kind: RoomKind;
    instanceId: string;
    seed: number;
    players: PlayerPublic[];
  }) => void;
  onJoin?: (p: PlayerPublic) => void;
  onLeave?: (playerId: string) => void;
  onSnapshot?: (t: number, players: PlayerSnapshot[]) => void;
  onHit?: (ev: Extract<ServerMessage, { op: "hit" }>["event"]) => void;
  onKill?: (ev: Extract<ServerMessage, { op: "kill" }>["event"]) => void;
  onChat?: (playerId: string, name: string, text: string) => void;
  onScoreboard?: (players: PlayerPublic[]) => void;
  onError?: (code: string, message: string) => void;
  onDisconnect?: () => void;
};

export class MultiplayerClient {
  private socket: Socket | null = null;
  private url: string;
  private seq = 0;
  playerId: string | null = null;
  room: string | null = null;
  kind: RoomKind | null = null;
  instanceId: string | null = null;
  players = new Map<string, PlayerPublic>();
  lastSnaps = new Map<string, PlayerSnapshot>();
  handlers: MpHandlers = {};

  constructor(opts: MpClientOpts = {}) {
    // Production: VITE_MP_URL / fleet getMpServerUrl(); local: :4100
    this.url = opts.url ?? getMpServerUrl();
  }

  get serverUrl(): string {
    return this.url;
  }

  connect(identity: { name: string; modelUrl?: string; raceId?: string }): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = io(this.url, {
        transports: ["websocket", "polling"],
        autoConnect: true,
      });
      const s = this.socket;
      const t = setTimeout(() => reject(new Error("mp connect timeout")), 8000);
      s.on("connect", () => {
        this.send({
          op: "hello",
          protocol: NET_PROTOCOL_VERSION,
          name: identity.name,
          modelUrl: identity.modelUrl,
          raceId: identity.raceId,
        });
      });
      s.on("msg", (raw: ServerMessage) => {
        this.onServer(raw);
        if (raw.op === "welcome") {
          clearTimeout(t);
          resolve();
        }
      });
      s.on("connect_error", (err) => {
        clearTimeout(t);
        reject(err);
      });
      s.on("disconnect", () => this.handlers.onDisconnect?.());
    });
  }

  private onServer(msg: ServerMessage) {
    switch (msg.op) {
      case "welcome":
        this.playerId = msg.playerId;
        this.handlers.onWelcome?.(msg.playerId);
        break;
      case "room":
        this.room = msg.room;
        this.kind = msg.kind;
        this.instanceId = msg.instanceId;
        this.players.clear();
        for (const p of msg.players) this.players.set(p.id, p);
        this.handlers.onRoom?.(msg);
        break;
      case "join_player":
        this.players.set(msg.player.id, msg.player);
        this.handlers.onJoin?.(msg.player);
        break;
      case "leave_player":
        this.players.delete(msg.playerId);
        this.lastSnaps.delete(msg.playerId);
        this.handlers.onLeave?.(msg.playerId);
        break;
      case "snapshot":
        for (const s of msg.players) this.lastSnaps.set(s.id, s);
        this.handlers.onSnapshot?.(msg.t, msg.players);
        break;
      case "hit":
        this.handlers.onHit?.(msg.event);
        break;
      case "kill":
        this.handlers.onKill?.(msg.event);
        // Fleet leaderboard: credit PvP kill when we are the killer
        if (this.playerId && msg.event && (msg.event as { killerId?: string }).killerId === this.playerId) {
          void recordScoreEvent({ type: "pvp_kill" });
        }
        break;
      case "chat":
        this.handlers.onChat?.(msg.playerId, msg.name, msg.text);
        break;
      case "scoreboard":
        for (const p of msg.players) this.players.set(p.id, p);
        this.handlers.onScoreboard?.(msg.players);
        break;
      case "error":
        this.handlers.onError?.(msg.code, msg.message);
        break;
      default:
        break;
    }
  }

  private send(msg: ClientMessage) {
    this.socket?.emit("msg", msg);
  }

  joinPve(instanceId: string, partyId?: string) {
    const room = partyId ? `pve:${instanceId}:${partyId}` : `pve:${instanceId}`;
    this.send({ op: "join", room, kind: "pve", instanceId });
  }

  /**
   * Join PvP arena.
   * @param matchId room suffix (e.g. "quick", "ranked")
   * @param mode 1v1 (max 2) or 2v2 (max 4) deployment rooms
   */
  joinArena(matchId = "quick", mode: "1v1" | "2v2" | "ffa" = "1v1") {
    const room = `arena:${mode}:${matchId}`;
    this.send({
      op: "join",
      room,
      kind: "arena",
      instanceId: mode === "2v2" ? "arena_2v2" : mode === "1v1" ? "arena_1v1" : "arena_flat",
    });
  }

  join1v1(matchId = "quick") {
    this.joinArena(matchId, "1v1");
  }

  join2v2(matchId = "quick") {
    this.joinArena(matchId, "2v2");
  }

  leave() {
    this.send({ op: "leave" });
    this.room = null;
  }

  /** Send movement sample (call from game loop ~20–30 Hz). */
  sendInput(opts: {
    ax: number;
    az: number;
    yaw: number;
    jump?: boolean;
    fire?: boolean;
    aim?: Vec3;
  }) {
    this.seq++;
    this.send({
      op: "input",
      frame: {
        seq: this.seq,
        ax: opts.ax,
        az: opts.az,
        yaw: opts.yaw,
        jump: opts.jump,
        fire: opts.fire,
        aim: opts.aim,
        t: Date.now(),
      },
    });
  }

  fire(origin: Vec3, dir: Vec3, weapon?: string) {
    this.send({ op: "fire", origin, dir, weapon });
  }

  chat(text: string) {
    this.send({ op: "chat", text });
  }

  respawn() {
    this.send({ op: "respawn" });
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
  }
}

/** Lerp remote avatars between snapshots. */
export function interpolateSnap(
  a: PlayerSnapshot,
  b: PlayerSnapshot,
  alpha: number,
): { x: number; y: number; z: number; yaw: number } {
  const t = Math.min(1, Math.max(0, alpha));
  let dyaw = b.r - a.r;
  while (dyaw > Math.PI) dyaw -= Math.PI * 2;
  while (dyaw < -Math.PI) dyaw += Math.PI * 2;
  return {
    x: a.p.x + (b.p.x - a.p.x) * t,
    y: a.p.y + (b.p.y - a.p.y) * t,
    z: a.p.z + (b.p.z - a.p.z) * t,
    yaw: a.r + dyaw * t,
  };
}
