/**
 * Co-op (PvE) + Arena PvP connect UI — Socket.IO MultiplayerClient.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { MultiplayerClient } from "@/net/MultiplayerClient";
import type { PlayerPublic, PlayerSnapshot } from "@workspace/net-protocol";
import { Button } from "@/components/ui/button";
import { Users, Swords, Wifi, WifiOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getActiveFighter } from "@/data/fighters";
import { cn } from "@/lib/utils";

const GOLD = "#c5a059";

export type MpMode = "pve" | "arena";

export interface MultiplayerPanelProps {
  mode: MpMode;
  /** Instance id for PvE (unityInstances) or match id for arena. */
  roomKey?: string;
  /** Called with client after connect; parent owns disconnect. */
  onClient?: (client: MultiplayerClient | null) => void;
  /** Snapshot stream for remote avatars. */
  onSnapshots?: (t: number, players: PlayerSnapshot[], localId: string | null) => void;
  /** Scoreboard / kill feed hooks. */
  onKill?: (killer: string, victim: string) => void;
  className?: string;
  compact?: boolean;
}

export function MultiplayerPanel({
  mode,
  roomKey,
  onClient,
  onSnapshots,
  onKill,
  className,
  compact,
}: MultiplayerPanelProps) {
  const clientRef = useRef<MultiplayerClient | null>(null);
  const [status, setStatus] = useState<"idle" | "connecting" | "online" | "error">("idle");
  const [room, setRoom] = useState<string | null>(null);
  const [players, setPlayers] = useState<PlayerPublic[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const fighter = getActiveFighter();

  const disconnect = useCallback(() => {
    const c = clientRef.current;
    if (c) {
      try {
        c.leave();
        c.disconnect();
      } catch {
        /* ignore */
      }
      clientRef.current = null;
    }
    setStatus("idle");
    setRoom(null);
    setPlayers([]);
    onClient?.(null);
  }, [onClient]);

  useEffect(() => () => disconnect(), [disconnect]);

  const connect = async () => {
    setErr(null);
    setStatus("connecting");
    const client = new MultiplayerClient();
    client.handlers = {
      onWelcome: () => {
        /* joined protocol */
      },
      onRoom: (info) => {
        setRoom(info.room);
        setPlayers(info.players);
        setStatus("online");
        toast.success(mode === "arena" ? "Joined PvP arena" : "Joined co-op instance", {
          description: info.room,
        });
      },
      onJoin: (p) => {
        setPlayers((prev) => {
          if (prev.some((x) => x.id === p.id)) return prev;
          return [...prev, p];
        });
      },
      onLeave: (id) => setPlayers((prev) => prev.filter((p) => p.id !== id)),
      onSnapshot: (t, snaps) => {
        onSnapshots?.(t, snaps, client.playerId);
      },
      onKill: (ev) => {
        onKill?.(ev.killerName, ev.victimName);
        toast.message(`${ev.killerName} downed ${ev.victimName}`);
      },
      onScoreboard: (list) => setPlayers(list),
      onError: (code, message) => {
        setErr(`${code}: ${message}`);
        toast.error(message);
        if (code === "protocol" || code === "room_full") setStatus("error");
      },
      onDisconnect: () => {
        setStatus("idle");
        setRoom(null);
        onClient?.(null);
      },
    };

    try {
      await client.connect({
        name: fighter.name.slice(0, 24),
        raceId: fighter.id,
      });
      clientRef.current = client;
      onClient?.(client);
      if (mode === "arena") {
        client.joinArena(roomKey ?? "quick");
      } else {
        client.joinPve(roomKey ?? "dark_elf_camp");
      }
      setStatus("online");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErr(msg);
      setStatus("error");
      toast.error("Multiplayer connect failed", {
        description: "Start mp-server: pnpm mp:dev (port 4100)",
      });
      client.disconnect();
      clientRef.current = null;
      onClient?.(null);
    }
  };

  return (
    <div
      className={cn(
        "rounded border border-white/15 bg-black/75 backdrop-blur-sm text-left shadow-lg",
        compact ? "p-2 space-y-1.5" : "p-3 space-y-2",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        {mode === "arena" ? (
          <Swords className="w-3.5 h-3.5" style={{ color: GOLD }} />
        ) : (
          <Users className="w-3.5 h-3.5" style={{ color: GOLD }} />
        )}
        <span className="text-[10px] font-serif uppercase tracking-widest" style={{ color: GOLD }}>
          {mode === "arena" ? "Arena PvP" : "Co-op Island"}
        </span>
        {status === "online" ? (
          <Wifi className="w-3 h-3 text-emerald-400 ml-auto" />
        ) : status === "connecting" ? (
          <Loader2 className="w-3 h-3 text-muted-foreground ml-auto animate-spin" />
        ) : (
          <WifiOff className="w-3 h-3 text-muted-foreground ml-auto" />
        )}
      </div>

      {room && (
        <p className="text-[9px] font-mono text-muted-foreground truncate" title={room}>
          {room} · {players.length} player{players.length === 1 ? "" : "s"}
        </p>
      )}

      {players.length > 0 && (
        <ul className="space-y-0.5 max-h-20 overflow-y-auto">
          {players.map((p) => (
            <li key={p.id} className="text-[9px] font-mono flex justify-between gap-2">
              <span className="truncate text-foreground/90">{p.name}</span>
              <span className="text-muted-foreground shrink-0">
                {Math.round(p.hp)}/{p.maxHp} · K{p.kills}
              </span>
            </li>
          ))}
        </ul>
      )}

      {err && <p className="text-[9px] text-red-400/90 font-mono leading-snug">{err}</p>}

      <div className="flex gap-1.5">
        {status !== "online" ? (
          <Button
            size="sm"
            className="h-7 flex-1 text-[10px] font-serif tracking-widest uppercase"
            disabled={status === "connecting"}
            onClick={() => void connect()}
          >
            {status === "connecting" ? "Connecting…" : mode === "arena" ? "Join PvP" : "Join Co-op"}
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="h-7 flex-1 text-[10px] font-serif tracking-widest uppercase border-white/20"
            onClick={disconnect}
          >
            Leave
          </Button>
        )}
      </div>
    </div>
  );
}

/** Hook: push local input + fire to MP client from a game loop. */
export function useMpNetTick(
  client: MultiplayerClient | null,
  getInput: () => {
    ax: number;
    az: number;
    yaw: number;
    jump?: boolean;
    fire?: boolean;
    aim?: { x: number; y: number; z: number };
  } | null,
) {
  useEffect(() => {
    if (!client) return;
    let last = 0;
    let raf = 0;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (now - last < 50) return; // ~20 Hz
      last = now;
      const frame = getInput();
      if (frame) client.sendInput(frame);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [client, getInput]);
}
