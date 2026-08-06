/**
 * Socket.IO multiplayer server — PvE instances + Arena PvP.
 * Protocol: @workspace/net-protocol
 */
import express from "express";
import { createServer } from "node:http";
import { Server, type Socket } from "socket.io";
import cors from "cors";
import {
  NET_PROTOCOL_VERSION,
  NET_TICK_HZ,
  NET_TICK_MS,
  quantizePos,
  type ClientMessage,
  type PlayerPublic,
  type PlayerSnapshot,
  type RoomKind,
  type Vec3,
} from "../../../lib/net-protocol/src/index.ts";

const PORT = Number(process.env.MP_PORT ?? 4100);
const CORS_ORIGIN = process.env.MP_CORS_ORIGIN ?? "*";
const TICK_HZ = Number(process.env.MP_TICK_HZ ?? NET_TICK_HZ);
const TICK_MS = 1000 / TICK_HZ;

/** Instance caps (mirrors unityInstances maxPlayers). */
const INSTANCE_CAPS: Record<string, number> = {
  dark_elf_camp: 4,
  dark_elf_encampment: 5,
  dark_elf_stronghold: 5,
  dark_elf_castle: 5,
  dark_elf_castle_lv1: 4,
  dungeon_catacombs: 5,
  dungeon_main: 4,
  dungeon_sewer: 4,
  dungeon_stronghold: 5,
  dungeon_underground_ruins: 4,
  arena_flat: 8,
  /** Production PvP deployment rooms */
  arena_1v1: 2,
  arena_2v2: 4,
};

interface NetPlayer {
  id: string;
  name: string;
  modelUrl: string;
  room: string | null;
  kind: RoomKind | null;
  instanceId: string;
  pos: Vec3;
  yaw: number;
  hp: number;
  maxHp: number;
  kills: number;
  deaths: number;
  lastInputSeq: number;
  lastFireAt: number;
  ready: boolean;
  team?: string;
}

interface RoomState {
  name: string;
  kind: RoomKind;
  instanceId: string;
  seed: number;
  players: Set<string>;
  started: boolean;
}

const players = new Map<string, NetPlayer>();
const rooms = new Map<string, RoomState>();

function publicOf(p: NetPlayer): PlayerPublic {
  return {
    id: p.id,
    name: p.name,
    modelUrl: p.modelUrl,
    hp: p.hp,
    maxHp: p.maxHp,
    kills: p.kills,
    deaths: p.deaths,
    team: p.team,
    ready: p.ready,
  };
}

function snapOf(p: NetPlayer, t: number): PlayerSnapshot {
  return {
    id: p.id,
    p: quantizePos(p.pos),
    r: Math.round(p.yaw * 1000) / 1000,
    hp: Math.round(p.hp),
    seq: p.lastInputSeq,
    t,
    anim: "idle",
  };
}

function getOrCreateRoom(name: string, kind: RoomKind, instanceId: string): RoomState {
  let r = rooms.get(name);
  if (!r) {
    r = {
      name,
      kind,
      instanceId,
      seed: (Math.random() * 0xffffffff) >>> 0,
      players: new Set(),
      started: false,
    };
    rooms.set(name, r);
  }
  return r;
}

function roomCap(instanceId: string, kind: RoomKind): number {
  if (kind === "arena") {
    if (instanceId === "arena_1v1") return 2;
    if (instanceId === "arena_2v2") return 4;
    return INSTANCE_CAPS[instanceId] ?? INSTANCE_CAPS.arena_flat ?? 8;
  }
  return INSTANCE_CAPS[instanceId] ?? 4;
}

function spawnFor(instanceId: string, slot: number): Vec3 {
  const ring = [
    { x: 12, y: 0, z: 0 },
    { x: -12, y: 0, z: 0 },
    { x: 0, y: 0, z: 12 },
    { x: 0, y: 0, z: -12 },
    { x: 8, y: 0, z: 8 },
    { x: -8, y: 0, z: -8 },
    { x: 8, y: 0, z: -8 },
    { x: -8, y: 0, z: 8 },
  ];
  return ring[slot % ring.length]!;
}

function leaveRoom(p: NetPlayer, io: Server) {
  if (!p.room) return;
  const room = rooms.get(p.room);
  if (room) {
    room.players.delete(p.id);
    io.to(p.room).emit("msg", {
      op: "leave_player",
      playerId: p.id,
    });
    if (room.players.size === 0) rooms.delete(p.room);
  }
  p.room = null;
  p.kind = null;
}

const app = express();
app.use(cors({ origin: CORS_ORIGIN === "*" ? true : CORS_ORIGIN }));
app.use(express.json({ limit: "32kb" }));
app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    protocol: NET_PROTOCOL_VERSION,
    tickHz: TICK_HZ,
    players: players.size,
    rooms: rooms.size,
    leaderboards: true,
  });
});
app.get("/instances", (_req, res) => {
  res.json({
    instances: Object.entries(INSTANCE_CAPS).map(([id, maxPlayers]) => ({
      id,
      maxPlayers,
      modes: id.startsWith("arena") ? ["pvp"] : ["pve"],
    })),
  });
});

/* ── Flare / Grudge Studio leaderboards (in-memory, best-effort fleet) ── */
type LbEntry = {
  accountId: string;
  displayName: string;
  fighterId?: string;
  fighterName?: string;
  score: number;
  updatedAt: number;
};
const leaderboards = new Map<string, Map<string, LbEntry>>();
const LB_BOARDS = new Set(["boss_kills", "island_rounds", "pvp_kills", "flare_score"]);

function lbMap(board: string): Map<string, LbEntry> {
  let m = leaderboards.get(board);
  if (!m) {
    m = new Map();
    leaderboards.set(board, m);
  }
  return m;
}

function lbSorted(board: string, limit = 25): LbEntry[] {
  return [...lbMap(board).values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.min(50, Math.max(1, limit)));
}

app.get("/leaderboards/:board", (req, res) => {
  const board = String(req.params.board || "");
  if (!LB_BOARDS.has(board)) {
    res.status(404).json({ error: "unknown_board", boards: [...LB_BOARDS] });
    return;
  }
  const limit = Number(req.query.limit ?? 25);
  const entries = lbSorted(board, limit).map((e, i) => ({ ...e, rank: i + 1 }));
  res.json({ board, entries, ts: Date.now() });
});

app.post("/leaderboards/:board", (req, res) => {
  const board = String(req.params.board || "");
  if (!LB_BOARDS.has(board)) {
    res.status(404).json({ error: "unknown_board" });
    return;
  }
  const body = req.body as Partial<LbEntry>;
  const accountId = String(body.accountId || "").slice(0, 64);
  if (!accountId) {
    res.status(400).json({ error: "accountId_required" });
    return;
  }
  const score = Math.max(0, Math.floor(Number(body.score) || 0));
  const prev = lbMap(board).get(accountId);
  // Only accept equal or higher scores (anti-regress)
  if (prev && score < prev.score) {
    res.json({ ok: true, kept: true, entry: { ...prev, rank: 0 } });
    return;
  }
  const entry: LbEntry = {
    accountId,
    displayName: String(body.displayName || "Hunter").slice(0, 32),
    fighterId: body.fighterId ? String(body.fighterId).slice(0, 48) : undefined,
    fighterName: body.fighterName ? String(body.fighterName).slice(0, 48) : undefined,
    score,
    updatedAt: Date.now(),
  };
  lbMap(board).set(accountId, entry);
  res.json({ ok: true, entry });
});


const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: CORS_ORIGIN === "*" ? true : CORS_ORIGIN },
  transports: ["websocket", "polling"],
});

io.on("connection", (socket: Socket) => {
  const p: NetPlayer = {
    id: socket.id,
    name: "Player",
    modelUrl: "https://assets.grudge-studio.com/asset-packs/toon-rts-characters/glb/characters/human.glb",
    room: null,
    kind: null,
    instanceId: "arena_flat",
    pos: { x: 0, y: 0, z: 0 },
    yaw: 0,
    hp: 100,
    maxHp: 100,
    kills: 0,
    deaths: 0,
    lastInputSeq: 0,
    lastFireAt: 0,
    ready: false,
  };
  players.set(socket.id, p);

  socket.emit("msg", {
    op: "welcome",
    playerId: p.id,
    protocol: NET_PROTOCOL_VERSION,
    tickHz: TICK_HZ,
  });

  socket.on("msg", (raw: ClientMessage) => {
    try {
      handleClient(socket, p, raw, io);
    } catch (e) {
      socket.emit("msg", {
        op: "error",
        code: "handler",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  });

  socket.on("disconnect", () => {
    leaveRoom(p, io);
    players.delete(p.id);
  });
});

function handleClient(socket: Socket, p: NetPlayer, msg: ClientMessage, io: Server) {
  switch (msg.op) {
    case "hello": {
      if (msg.protocol !== NET_PROTOCOL_VERSION) {
        socket.emit("msg", {
          op: "error",
          code: "protocol",
          message: `Expected protocol ${NET_PROTOCOL_VERSION}`,
        });
        return;
      }
      p.name = (msg.name || "Player").slice(0, 24);
      if (msg.modelUrl) p.modelUrl = msg.modelUrl.slice(0, 512);
      break;
    }
    case "join": {
      leaveRoom(p, io);
      const instanceId = msg.instanceId || (msg.kind === "arena" ? "arena_flat" : "dark_elf_camp");
      const roomName =
        msg.kind === "arena"
          ? msg.room.startsWith("arena:")
            ? msg.room
            : `arena:${msg.room || "quick"}`
          : msg.room.startsWith("pve:")
            ? msg.room
            : `pve:${instanceId}`;
      const room = getOrCreateRoom(roomName, msg.kind, instanceId);
      const cap = roomCap(instanceId, msg.kind);
      if (room.players.size >= cap) {
        socket.emit("msg", {
          op: "error",
          code: "room_full",
          message: `Room full (${cap})`,
        });
        return;
      }
      p.room = roomName;
      p.kind = msg.kind;
      p.instanceId = instanceId;
      p.hp = p.maxHp;
      p.pos = spawnFor(instanceId, room.players.size);
      p.yaw = Math.atan2(-p.pos.x, -p.pos.z);
      room.players.add(p.id);
      socket.join(roomName);
      const list = [...room.players].map((id) => publicOf(players.get(id)!));
      socket.emit("msg", {
        op: "room",
        room: roomName,
        kind: msg.kind,
        instanceId,
        seed: room.seed,
        players: list,
      });
      socket.to(roomName).emit("msg", { op: "join_player", player: publicOf(p) });
      break;
    }
    case "leave": {
      if (p.room) socket.leave(p.room);
      leaveRoom(p, io);
      break;
    }
    case "input": {
      const f = msg.frame;
      if (f.seq <= p.lastInputSeq) return;
      p.lastInputSeq = f.seq;
      // Simple kinematic integrate (authoritative position from client for now —
      // production: validate speed caps; full server sim later).
      const SPEED = 7.5;
      const sp = SPEED * Math.min(0.1, Math.max(0.016, 1 / TICK_HZ));
      // Trust yaw; move on ax/az in local space simplified as world axes
      p.yaw = f.yaw;
      p.pos.x += f.ax * sp * 8;
      p.pos.z += f.az * sp * 8;
      // Soft bounds
      const B = 80;
      p.pos.x = Math.max(-B, Math.min(B, p.pos.x));
      p.pos.z = Math.max(-B, Math.min(B, p.pos.z));
      break;
    }
    case "fire": {
      if (!p.room) return;
      const now = Date.now();
      if (now - p.lastFireAt < 120) return; // rate limit
      p.lastFireAt = now;
      // Hitscan validation vs room players
      const origin = msg.origin;
      const dir = msg.dir;
      const len = Math.hypot(dir.x, dir.y, dir.z) || 1;
      const dx = dir.x / len;
      const dy = dir.y / len;
      const dz = dir.z / len;
      const RANGE = 28;
      const HIT_R = 0.85;
      let best: NetPlayer | null = null;
      let bestT = RANGE;
      const room = rooms.get(p.room);
      if (!room) return;
      for (const id of room.players) {
        if (id === p.id) continue;
        const o = players.get(id);
        if (!o || o.hp <= 0) continue;
        // Ray vs sphere at torso
        const ox = o.pos.x - origin.x;
        const oy = o.pos.y + 1.1 - origin.y;
        const oz = o.pos.z - origin.z;
        const t = ox * dx + oy * dy + oz * dz;
        if (t < 0.2 || t > bestT) continue;
        const px = origin.x + dx * t;
        const py = origin.y + dy * t;
        const pz = origin.z + dz * t;
        const dist = Math.hypot(px - o.pos.x, py - (o.pos.y + 1.1), pz - o.pos.z);
        if (dist <= HIT_R) {
          bestT = t;
          best = o;
        }
      }
      if (best) {
        const dmg = p.kind === "arena" ? 22 : 18;
        best.hp = Math.max(0, best.hp - dmg);
        io.to(p.room).emit("msg", {
          op: "hit",
          event: {
            attackerId: p.id,
            targetId: best.id,
            damage: dmg,
            kind: "projectile",
            pos: best.pos,
          },
        });
        if (best.hp <= 0) {
          best.deaths++;
          p.kills++;
          io.to(p.room).emit("msg", {
            op: "kill",
            event: {
              killerId: p.id,
              victimId: best.id,
              killerName: p.name,
              victimName: best.name,
              weapon: msg.weapon ?? "bolt",
            },
          });
          // Auto-respawn delay signal via scoreboard; client calls respawn
          io.to(p.room).emit("msg", {
            op: "scoreboard",
            players: [...room.players].map((id) => publicOf(players.get(id)!)),
          });
        }
      }
      break;
    }
    case "respawn": {
      if (p.hp > 0) return;
      p.hp = p.maxHp;
      p.pos = spawnFor(p.instanceId, Math.floor(Math.random() * 8));
      break;
    }
    case "chat": {
      if (!p.room) return;
      const text = (msg.text || "").slice(0, 80);
      if (!text) return;
      io.to(p.room).emit("msg", {
        op: "chat",
        playerId: p.id,
        name: p.name,
        text,
      });
      break;
    }
    case "ready": {
      p.ready = !!msg.ready;
      break;
    }
    default:
      break;
  }
}

// Snapshot broadcast loop
setInterval(() => {
  const t = Date.now();
  for (const room of rooms.values()) {
    if (room.players.size === 0) continue;
    const snaps: PlayerSnapshot[] = [];
    for (const id of room.players) {
      const pl = players.get(id);
      if (pl) snaps.push(snapOf(pl, t));
    }
    io.to(room.name).emit("msg", { op: "snapshot", t, players: snaps });
  }
}, TICK_MS);

httpServer.listen(PORT, () => {
  console.log(`[mp-server] Socket.IO on :${PORT}  tick=${TICK_HZ}Hz  protocol=${NET_PROTOCOL_VERSION}`);
  console.log(`[mp-server] PvE rooms pve:{instanceId} · Arena rooms arena:{matchId}`);
  console.log(`[mp-server] Mirror is Unity-only — browsers use this Socket.IO stack.`);
});
