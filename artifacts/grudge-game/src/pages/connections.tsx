import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageChrome";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  getFleetConnections,
  probeAllConnections,
  type ConnectionProbe,
  type FleetConnection,
  FLEET,
} from "@/data/grudgeFleet";
import { bootArmadaEngine, FBA_ARMADA_MANIFEST } from "@/data/armadaEngine";
import { Link } from "wouter";
import { RefreshCw, CheckCircle2, XCircle } from "lucide-react";

export default function Connections() {
  const [conns] = useState<FleetConnection[]>(() => getFleetConnections());
  const [probes, setProbes] = useState<ConnectionProbe[]>([]);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    bootArmadaEngine();
    const r = await probeAllConnections();
    setProbes(r);
    setLoading(false);
  };

  useEffect(() => {
    void run();
  }, []);

  const byId = new Map(probes.map((p) => [p.id, p]));

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader
        kicker="Grudge Studio · production fleet"
        title="Deployment Connections"
        subtitle="Auth, Railway API, CDN, PvP multiplayer, and leaderboards for Flare Boss Arena"
      />

      <div className="flex flex-wrap gap-2 items-center">
        <Button size="sm" className="font-serif tracking-widest" onClick={() => void run()} disabled={loading}>
          <RefreshCw className={`mr-2 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Probe all
        </Button>
        <Button asChild size="sm" variant="outline" className="font-serif tracking-widest">
          <Link href="/pvp">PvP lobby</Link>
        </Button>
        <Button asChild size="sm" variant="outline" className="font-serif tracking-widest">
          <Link href="/leaderboards">Leaderboards</Link>
        </Button>
        <span className="text-[10px] font-mono text-muted-foreground">
          Engine v{FBA_ARMADA_MANIFEST.version} · {FLEET.gameId}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {conns.map((c) => {
          const p = byId.get(c.id);
          const ok = p?.ok;
          return (
            <Card key={c.id} className="border-border/50 bg-card/50">
              <CardContent className="pt-4 pb-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-serif text-sm uppercase tracking-widest text-foreground">{c.label}</p>
                    <p className="text-[11px] text-muted-foreground">{c.description}</p>
                  </div>
                  {p ? (
                    ok ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                    ) : (
                      <XCircle className="h-5 w-5 text-amber-400 shrink-0" />
                    )
                  ) : (
                    <span className="text-[10px] font-mono text-muted-foreground">…</span>
                  )}
                </div>
                <p className="font-mono text-[10px] text-primary break-all">{c.url}</p>
                {p && (
                  <p className="text-[10px] font-mono text-muted-foreground">
                    {p.detail}
                    {p.latencyMs != null ? ` · ${p.latencyMs}ms` : ""}
                    {p.status != null ? ` · HTTP ${p.status}` : ""}
                    {c.required ? " · required" : " · optional"}
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
