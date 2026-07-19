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
    async (mode: "1v1" | "2v2" | "ffa" | "pve") => {
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
        // Prefer race mesh from runs/dist pack when available
        const raceUrl = `${window.location.origin}/models/races/human.glb`;
        await mp.connect({
          name: fighter.name,
          modelUrl: raceUrl,
          raceId: fighter.id,
        });
        if (mode === "pve") mp.joinPve("dark_elf_camp");
        else if (mode === "1v1") mp.join1v1("flare-quick");
        else if (mode === "2v2") mp.join2v2("flare-quick");
        else mp.joinArena("flare-quick", "ffa");
        setClient(mp);
        const labels = { "1v1": "1v1 Arena", "2v2": "2v2 Arena", ffa: "FFA Arena", pve: "Co-op Camp" };
        toast({
          title: `Joined ${labels[mode]}`,
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
        subtitle="Production deployment rooms — 1v1 · 2v2 · FFA · co-op. Characters from runs/dist races pack. Weapon skills use vfxgrudge.puter.site hotkey VFX."
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
                onClick={() => void connectAndJoin("1v1")}
              >
                <Swords className="mr-2 h-4 w-4" />
                Arena 1v1
              </Button>
              <Button
                className="font-serif tracking-widest"
                variant="secondary"
                disabled={status === "connecting" || status === "in_room"}
                onClick={() => void connectAndJoin("2v2")}
              >
                <Users className="mr-2 h-4 w-4" />
                Arena 2v2
              </Button>
              <Button
                variant="outline"
                className="font-serif tracking-widest"
                disabled={status === "connecting" || status === "in_room"}
                onClick={() => void connectAndJoin("ffa")}
              >
                FFA
              </Button>
              <Button
                variant="outline"
                className="font-serif tracking-widest"
                disabled={status === "connecting" || status === "in_room"}
                onClick={() => void connectAndJoin("pve")}
              >
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
              <Button asChild variant="ghost" className="font-serif tracking-widest">
                <Link href="/boss">Boss Fight</Link>
              </Button>
            </div>

            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Rooms: <code className="text-primary">arena:1v1:…</code> (cap 2) ·{" "}
              <code className="text-primary">arena:2v2:…</code> (cap 4). Character models from{" "}
              <code className="text-primary">models/races/*</code> (staged from runs/dist). Weapon skills
              fire hotkey VFX from vfxgrudge.puter.site.
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
