import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageChrome";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  LEADERBOARD_BOARDS,
  fetchLeaderboard,
  getMyScores,
  type LeaderboardBoardId,
  type LeaderboardEntry,
} from "@/data/flareLeaderboards";
import { getLeaderboardApiBase, probeConnection, getFleetConnections } from "@/data/grudgeFleet";
import { Trophy, RefreshCw, Wifi, WifiOff } from "lucide-react";

export default function Leaderboards() {
  const [board, setBoard] = useState<LeaderboardBoardId>("boss_kills");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [source, setSource] = useState<"remote" | "local">("local");
  const [loading, setLoading] = useState(false);
  const [remoteOk, setRemoteOk] = useState<boolean | null>(null);
  const mine = getMyScores();

  const load = async (id: LeaderboardBoardId) => {
    setLoading(true);
    const r = await fetchLeaderboard(id);
    setEntries(r.entries);
    setSource(r.source);
    setLoading(false);
  };

  useEffect(() => {
    void load(board);
    const lb = getFleetConnections().find((c) => c.id === "leaderboards");
    if (lb) {
      void probeConnection(lb).then((p) => setRemoteOk(p.ok));
    }
  }, [board]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader
        kicker="Grudge Studio · fleet ranks"
        title="Leaderboards"
        subtitle="Boss kills, island rounds, arena PvP — published to the production leaderboard API when online"
      />

      <div className="flex flex-wrap items-center gap-3 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          {remoteOk ? (
            <Wifi className="h-3.5 w-3.5 text-emerald-400" />
          ) : (
            <WifiOff className="h-3.5 w-3.5 text-amber-400" />
          )}
          {remoteOk ? "Remote board online" : "Local cache (remote offline)"}
        </span>
        <span className="truncate max-w-md opacity-70">{getLeaderboardApiBase()}</span>
        <Button
          size="sm"
          variant="outline"
          className="h-7 font-serif text-[10px] tracking-widest"
          onClick={() => void load(board)}
          disabled={loading}
        >
          <RefreshCw className={`mr-1 h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {(
          [
            ["boss_kills", mine.boss_kills],
            ["island_rounds", mine.island_rounds],
            ["pvp_kills", mine.pvp_kills],
            ["flare_score", mine.flare_score],
          ] as const
        ).map(([k, v]) => (
          <Card key={k} className="border-border/40 bg-card/50">
            <CardContent className="pt-3 pb-3 text-center">
              <p className="text-[9px] font-serif uppercase tracking-widest text-muted-foreground">{k}</p>
              <p className="font-mono text-xl text-primary mt-1">{v}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {LEADERBOARD_BOARDS.map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => setBoard(b.id)}
            className={`px-4 py-2 rounded font-serif text-xs tracking-widest uppercase border transition-all ${
              board === b.id
                ? "border-primary bg-primary/10 text-primary"
                : "border-border/40 text-muted-foreground hover:border-primary/40"
            }`}
          >
            {b.label}
          </button>
        ))}
      </div>

      <p className="text-sm text-muted-foreground font-serif">
        {LEADERBOARD_BOARDS.find((b) => b.id === board)?.description} · source {source}
      </p>

      <Card className="border-border/50 bg-card/40">
        <CardContent className="p-0">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border/50 text-[10px] font-serif uppercase tracking-widest text-muted-foreground">
                <th className="p-3 w-12">#</th>
                <th className="p-3">Hunter</th>
                <th className="p-3">Fighter</th>
                <th className="p-3 text-right">Score</th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-muted-foreground font-serif text-sm">
                    <Trophy className="inline h-4 w-4 mr-2 text-[#c5a059]" />
                    No scores yet — win bosses or arena matches to climb.
                  </td>
                </tr>
              )}
              {entries.map((e) => (
                <tr key={e.accountId} className="border-b border-border/20 hover:bg-muted/20">
                  <td className="p-3 font-mono text-primary">{e.rank ?? "—"}</td>
                  <td className="p-3 font-serif">{e.displayName}</td>
                  <td className="p-3 text-xs text-muted-foreground">{e.fighterName ?? "—"}</td>
                  <td className="p-3 text-right font-mono text-[#c5a059]">{e.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
