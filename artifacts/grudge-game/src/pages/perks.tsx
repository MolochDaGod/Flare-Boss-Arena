import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/PageChrome";
import { PERKS } from "@/data/perks";
import { getWallet } from "@/data/wallet";
import { Tent, Sparkles } from "lucide-react";

function hexColor(n: number) {
  return `#${n.toString(16).padStart(6, "0")}`;
}

export default function Perks() {
  const wallet = getWallet();

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader
        kicker="KF2 / CoD Zombies"
        title="Perk Machines"
        subtitle="Purchase combat modifiers at the camp perk row or collect symbols in the dungeon"
        action={
          <Button asChild variant="outline" className="font-serif tracking-widest border-primary/40">
            <Link href="/camp" className="flex items-center gap-2">
              <Tent className="h-4 w-4" />
              Visit Perk Row
            </Link>
          </Button>
        }
      />

      <div className="flex items-center gap-4 rounded-lg border border-border/50 bg-card/50 px-4 py-3">
        <Sparkles className="h-5 w-5 text-primary" />
        <p className="text-sm font-serif text-muted-foreground">
          Perk tokens: <span className="text-primary font-mono">{wallet.perk_tokens}</span>
          {" · "}
          Gold: <span className="text-primary font-mono">{wallet.gold}</span>
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {PERKS.map((p) => (
          <Card key={p.id} className="border-border/50 bg-card/60 overflow-hidden">
            <div className="h-1.5" style={{ background: hexColor(p.color) }} />
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="font-serif text-lg uppercase tracking-widest">{p.name}</CardTitle>
                  <p className="text-xs font-serif text-muted-foreground mt-1">{p.tagline}</p>
                </div>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded border border-border/50 text-muted-foreground">
                  Tier {p.tier}
                </span>
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
              <div className="flex items-center justify-between pt-2 border-t border-border/30">
                <span className="font-mono text-sm text-primary">{p.cost} Gold</span>
                <Button size="sm" variant="secondary" className="font-serif text-xs tracking-widest uppercase" disabled>
                  Purchase (soon)
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-primary/20 bg-card/40">
        <CardContent className="pt-6">
          <p className="font-serif text-xs uppercase tracking-widest text-muted-foreground mb-2">Also in camp</p>
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">Gumball Machine</strong> — random perk or loot roll.
            {" "}
            <strong className="text-foreground">Weapon Panel</strong> — 3D armory UI prop opens equipment.
            {" "}
            <strong className="text-foreground">Perk Row</strong> — full machine rack GLB.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}