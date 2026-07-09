import { useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/PageChrome";
import {
  PERKS,
  purchasePerk,
  toggleActivePerk,
  isPerkOwned,
  isPerkActive,
  MAX_ACTIVE_PERKS,
  getActivePerks,
} from "@/data/perks";
import { getWallet } from "@/data/wallet";
import { Tent, Sparkles } from "lucide-react";
import { toast } from "sonner";

function hexColor(n: number) {
  return `#${n.toString(16).padStart(6, "0")}`;
}

export default function Perks() {
  const [tick, setTick] = useState(0);
  const wallet = getWallet();
  void tick; // force re-render after purchase/toggle

  const refresh = () => setTick((t) => t + 1);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader
        kicker="Combat modifiers"
        title="Perk Machines"
        subtitle="Unlock and equip up to 3 perks — auto-attack slashes, longer waves, bigger AoE"
        action={
          <Button asChild variant="outline" className="font-serif tracking-widest border-primary/40">
            <Link href="/game" className="flex items-center gap-2">
              <Tent className="h-4 w-4" />
              Enter Dungeon
            </Link>
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border/50 bg-card/50 px-4 py-3">
        <Sparkles className="h-5 w-5 text-primary" />
        <p className="text-sm font-serif text-muted-foreground">
          Perk tokens: <span className="text-primary font-mono">{wallet.perk_tokens}</span>
          {" · "}
          Gold: <span className="text-primary font-mono">{wallet.gold}</span>
          {" · "}
          Active:{" "}
          <span className="text-primary font-mono">
            {getActivePerks().length}/{MAX_ACTIVE_PERKS}
          </span>
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {PERKS.map((p) => {
          const owned = isPerkOwned(p.id);
          const active = isPerkActive(p.id);
          return (
            <Card
              key={p.id}
              className={`border-border/50 bg-card/60 overflow-hidden ${active ? "ring-1 ring-primary/50" : ""}`}
            >
              <div className="h-1.5" style={{ background: hexColor(p.color) }} />
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="font-serif text-lg uppercase tracking-widest">{p.name}</CardTitle>
                    <p className="text-xs font-serif text-muted-foreground mt-1">{p.tagline}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded border border-border/50 text-muted-foreground">
                      Tier {p.tier}
                    </span>
                    {active && (
                      <span className="text-[9px] font-mono uppercase text-primary">Equipped</span>
                    )}
                    {owned && !active && (
                      <span className="text-[9px] font-mono uppercase text-muted-foreground">Owned</span>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground leading-relaxed">{p.description}</p>
                <ul className="space-y-1">
                  {p.effects.map((e) => (
                    <li key={e} className="text-xs font-serif text-foreground/80 flex items-center gap-2">
                      <span className="w-1 h-1 rounded-full" style={{ background: hexColor(p.color) }} />
                      {e}
                    </li>
                  ))}
                </ul>
                <div className="flex items-center justify-between pt-2 border-t border-border/30 gap-2">
                  <span className="font-mono text-sm text-primary">
                    {p.cost}g{p.tokenCost > 0 ? ` + ${p.tokenCost} token` : ""}
                  </span>
                  {!owned ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="font-serif text-xs tracking-widest uppercase"
                      onClick={() => {
                        const r = purchasePerk(p.id);
                        if (r.ok) toast.success(r.message);
                        else toast.error(r.message);
                        refresh();
                      }}
                    >
                      Purchase
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant={active ? "outline" : "default"}
                      className="font-serif text-xs tracking-widest uppercase"
                      onClick={() => {
                        const r = toggleActivePerk(p.id);
                        if (r.ok) toast.message(r.message);
                        else toast.error(r.message);
                        refresh();
                      }}
                    >
                      {active ? "Unequip" : "Equip"}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="border-primary/20 bg-card/40">
        <CardContent className="pt-6 space-y-2">
          <p className="font-serif text-xs uppercase tracking-widest text-muted-foreground">How perks work</p>
          <p className="text-sm text-muted-foreground">
            Purchase with gold (and tokens where listed), then Equip up to {MAX_ACTIVE_PERKS}. Effects apply
            live in the dungeon: stronger auto-attacks, traveling slash waves on basic hits, longer specials,
            and bigger ground circles. Dungeon perk symbols still grant ownership when collected.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
