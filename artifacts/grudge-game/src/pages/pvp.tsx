import { useCallback, useEffect, useState } from "react";
import { Link } from "wouter";
import { PageHeader } from "@/components/PageChrome";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MultiplayerClient } from "@/net/MultiplayerClient";
import { getMpServerUrl, probeConnection, type ConnectionProbe } from "@/data/grudgeFleet";
import { getActiveFighter } from "@/data/fighters";
import { getMyScores } from "@/data/flareLeaderboards";
import { getAuthToken } from "@/data/grudgeAuth";
import { Crosshair, Swords, Wifi, WifiOff, Users, Skull } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function PvpLobby() {
  const { toast } = useToast();
  const [mpUrl] = useState(() => getMpServerUrl());
  const [health, setHealth] = useState<ConnectionProbe | null>(null);
  const [status, setStatus] = useState<"idle" | "connecting" | "in_room" | "error">("idle");
  const [roomInfo, setRoomInfo] = useState<string>("");
  const [players, setPlayers] = useState<{ id: string; name: string; kills: number }[]>([]);
  const [client, setClient] = useState<MultiplayerClient | null>(null);
  const fighter = getActiveFighter();
  const scores = getMyScores();

  useEffect(() => {
    void probeConnection({
      id: "mp_pvp",
      label: "PvP",
      description: "",
      url: mpUrl,
      kind: "ws",
      required: false,
    }).then(setHealth);
  }, [mpUrl]);

  useEffect(() => {
    return () => {
      client?.disconnect();
    };
  }, [client]);

  const connectAndJoin = useCallback(
    async (mode: "arena" | "pve") => {
      if (!getAuthToken()) {
        toast({
          title: "Sign in required",
          description: "Verified Grudge ID token needed for fleet PvP.",
          variant: "destructive",
        });
        return;
      }
      setStatus("connecting");
      const mp = new MultiplayerClient({ url: mpUrl });
      mp.handlers = {
        onWelcome: (id) => setRoomInfo(`Session ${id.slice(0, 8)}…`),
        onRoom: (info) => {
          setStatus("in_room");
          setRoomInfo(`${info.kind} · ${info.room} · seed ${info.seed}`);
          setPlayers(
            info.players.map((p) => ({ id: p.id, name: p.name, kills: p.kills ?? 0 })),
          );
        },
        onJoin: (p) => {
          setPlayers((prev) => [...prev.filter((x) => x.id !== p.id), { id: p.id, name: p.name, kills: p.kills ?? 0 }]);
        },
        onLeave: (id) => setPlayers((prev) => prev.filter((p) => p.id !== id)),
        onScoreboard: (list) => {
          setPlayers(list.map((p) => ({ id: p.id, name: p.name, kills: p.kills ?? 0 })));
        },
        onKill: (ev) => {
          toast({
            title: "Kill",
            description: `${ev.killerName} → ${ev.victimName}`,
          });
        },
        onError: (code, message) => {
          setStatus("error");
          toast({ title: code, description: message, variant: "destructive" });
        },
        onDisconnect: () => {
          setStatus("idle");
          setRoomInfo("");
        },
      };
      try {
        await mp.connect({
          name: fighter.name,
          modelUrl: `${window.location.origin}/models/skins/${fighter.skinId}.glb`,
          raceId: fighter.id,
        });
        if (mode === "arena") mp.joinArena("flare-quick");
        else mp.joinPve("dark_elf_camp");
        setClient(mp);
        toast({
          title: mode === "arena" ? "Joined PvP arena" : "Joined co-op PvE",
          description: mpUrl,
        });
      } catch (e) {
        setStatus("error");
        toast({
          title: "PvP connect failed",
          description: e instanceof Error ? e.message : "Server unreachable — set VITE_MP_URL",
          variant: "destructive",
        });
        mp.disconnect();
      }
    },
    [fighter, mpUrl, toast],
  );

  const leave = () => {
    client?.leave();
    client?.disconnect();
    setClient(null);
    setStatus("idle");
    setPlayers([]);
    setRoomInfo("");
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader
        kicker="Grudge Studio · multiplayer"
        title="PvP Arena"
        subtitle="Socket.IO fleet rooms — free-for-all arena or co-op instance. Engine uses VITE_MP_URL / production mp-server."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="border-primary/30 bg-card/50 lg:col-span-2">
          <CardHeader>
            <CardTitle className="font-serif text-sm uppercase tracking-widest flex items-center gap-2">
              <Crosshair className="h-4 w-4 text-primary" />
              Deployment connection
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border border-border/40 bg-black/30 p-3 font-mono text-[11px] space-y-1">
              <p className="flex items-center gap-2">
                {health?.ok ? (
                  <Wifi className="h-3.5 w-3.5 text-emerald-400" />
                ) : (
                  <WifiOff className="h-3.5 w-3.5 text-amber-400" />
                )}
                <span className="text-muted-foreground">MP host</span>
                <span className="text-primary truncate">{mpUrl}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Health</span>{" "}
                {health
                  ? health.ok
                    ? `up · ${health.latencyMs}ms`
                    : `down · ${health.detail}`
                  : "probing…"}
              </p>
              <p>
                <span className="text-muted-foreground">Status</span> {status}
                {roomInfo ? ` · ${roomInfo}` : ""}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                className="font-serif tracking-widest"
                disabled={status === "connecting" || status === "in_room"}
                onClick={() => void connectAndJoin("arena")}
              >
                <Swords className="mr-2 h-4 w-4" />
                Quickmatch Arena
              </Button>
              <Button
                variant="outline"
                className="font-serif tracking-widest"
                disabled={status === "connecting" || status === "in_room"}
                onClick={() => void connectAndJoin("pve")}
              >
                <Users className="mr-2 h-4 w-4" />
                Co-op Camp
              </Button>
              {status === "in_room" && (
                <Button variant="destructive" className="font-serif tracking-widest" onClick={leave}>
                  Leave room
                </Button>
              )}
              <Button asChild variant="ghost" className="font-serif tracking-widest">
                <Link href="/leaderboards">Leaderboards</Link>
              </Button>
            </div>

            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Full 3D PvP combat still runs through the arena instance once the room is up. This lobby
              verifies the grudge-studio multiplayer connection and scoreboard hooks. Deploy{" "}
              <code className="text-primary">artifacts/mp-server</code> on Railway and set{" "}
              <code className="text-primary">VITE_MP_URL</code> on Vercel.
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50">
          <CardHeader>
            <CardTitle className="font-serif text-sm uppercase tracking-widest">Your ranks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm font-mono">
            <p>
              <span className="text-muted-foreground">Fighter</span>{" "}
              <span className="text-primary">{fighter.name}</span>
            </p>
            <p>
              <span className="text-muted-foreground">Arena kills</span> {scores.pvp_kills}
            </p>
            <p>
              <span className="text-muted-foreground">Boss kills</span> {scores.boss_kills}
            </p>
            <p>
              <span className="text-muted-foreground">Flare score</span> {scores.flare_score}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="font-serif text-sm uppercase tracking-widest flex items-center gap-2">
            <Skull className="h-4 w-4" /> Room scoreboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          {players.length === 0 ? (
            <p className="text-sm text-muted-foreground font-serif">Join a room to see pilots.</p>
          ) : (
            <ul className="space-y-2">
              {players
                .slice()
                .sort((a, b) => b.kills - a.kills)
                .map((p, i) => (
                  <li
                    key={p.id}
                    className="flex justify-between border-b border-border/20 pb-2 font-mono text-sm"
                  >
                    <span>
                      <span className="text-primary mr-2">#{i + 1}</span>
                      {p.name}
                    </span>
                    <span className="text-[#c5a059]">{p.kills} kills</span>
                  </li>
                ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
