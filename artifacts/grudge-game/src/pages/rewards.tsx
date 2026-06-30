import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/PageChrome";
import { REWARDS, REWARD_TRACKS, type RewardTrackId } from "@/data/rewards";
import { useToast } from "@/hooks/use-toast";

export default function Rewards() {
  const [track, setTrack] = useState<RewardTrackId>("daily");
  const [claimed, setClaimed] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const entries = REWARDS.filter((r) => r.track === track);

  const claim = (id: string, label: string) => {
    setClaimed((s) => new Set(s).add(id));
    toast({ title: "Reward claimed", description: label });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader
        kicker="MMO dailies · battle pass"
        title="Rewards"
        subtitle="Daily cull, war week, season pass, and permanent trophies"
      />

      <div className="flex flex-wrap gap-2">
        {REWARD_TRACKS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTrack(t.id)}
            className={`px-4 py-2 rounded font-serif text-xs tracking-widest uppercase border transition-all ${
              track === t.id
                ? "border-primary bg-primary/10 text-primary"
                : "border-border/40 text-muted-foreground hover:border-primary/40"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <p className="text-sm text-muted-foreground font-serif">
        {REWARD_TRACKS.find((t) => t.id === track)?.blurb}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {entries.map((r) => {
          const done = r.progress >= r.goal;
          const isClaimed = claimed.has(r.id) || r.claimed;
          const pct = Math.min(100, Math.round((r.progress / r.goal) * 100));
          return (
            <Card key={r.id} className="border-border/50 bg-card/60">
              <CardHeader className="pb-2">
                <CardTitle className="font-serif text-sm uppercase tracking-widest">{r.title}</CardTitle>
                <p className="text-xs text-muted-foreground">{r.description}</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="h-2 rounded-full bg-black/50 ring-1 ring-primary/20 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#7a5a23] to-[#c5a059] transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-muted-foreground">
                    {Math.min(r.progress, r.goal)} / {r.goal}
                  </span>
                  <span className="text-xs font-serif text-primary">{r.rewardLabel}</span>
                </div>
                <Button
                  size="sm"
                  className="w-full font-serif text-xs tracking-widest uppercase"
                  disabled={!done || isClaimed}
                  onClick={() => claim(r.id, r.rewardLabel)}
                >
                  {isClaimed ? "Claimed" : done ? "Claim" : "In progress"}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}