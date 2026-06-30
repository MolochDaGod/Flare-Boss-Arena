import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/PageChrome";
import { PLAY_LOOP } from "@/data/gameFlow";
import { WORLD_PROPS, CAMP_PROP_PLACEMENTS, DUNGEON_COLLECTABLES } from "@/data/worldProps";
import { Swords, Tent, Skull, ChevronRight } from "lucide-react";

const MODES = [
  { href: "/camp", label: "Sanctuary Camp", icon: Tent, type: "Hub", note: "MMO garrison — stations, perk row, gumball" },
  { href: "/game", label: "Infinite Dungeon", icon: Swords, type: "ARPG", note: "Open zone combat + perk collectables" },
  { href: "/boss", label: "Boss Arena", icon: Skull, type: "Endgame", note: "Generated boss — loot to /rewards" },
] as const;

export default function Content() {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <PageHeader
        kicker="RTS tech tree · MMO atlas"
        title="Content Atlas"
        subtitle="Game modes, player loop, and 3D interactable catalog"
      />

      <section>
        <h2 className="font-serif text-sm uppercase tracking-widest text-muted-foreground mb-3">Play loop</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {PLAY_LOOP.map((step) => (
            <Card key={step.step} className="border-border/50 bg-card/50">
              <CardContent className="pt-4 flex items-start gap-3">
                <span className="font-mono text-primary text-lg w-8 shrink-0">{step.step}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-serif text-sm uppercase tracking-wide">{step.label}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{step.note}</p>
                  <Button asChild variant="link" className="h-auto p-0 mt-2 font-serif text-xs text-primary">
                    <Link href={step.route}>Go <ChevronRight className="inline h-3 w-3" /></Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-serif text-sm uppercase tracking-widest text-muted-foreground mb-3">Game modes</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {MODES.map((m) => (
            <Card key={m.href} className="border-primary/20 bg-card/40 hover:border-primary/40 transition-colors">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <m.icon className="h-5 w-5 text-primary" />
                  <CardTitle className="font-serif text-sm uppercase tracking-widest">{m.label}</CardTitle>
                </div>
                <span className="text-[9px] font-mono uppercase text-muted-foreground">{m.type}</span>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-3">{m.note}</p>
                <Button asChild size="sm" className="font-serif text-xs tracking-widest uppercase w-full">
                  <Link href={m.href}>Launch</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-serif text-sm uppercase tracking-widest text-muted-foreground mb-3">
          3D interactables ({WORLD_PROPS.length} assets)
        </h2>
        <Card className="border-border/50">
          <CardContent className="p-0">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border/50 text-[10px] font-serif uppercase tracking-widest text-muted-foreground">
                  <th className="p-3">Asset</th>
                  <th className="p-3">Kind</th>
                  <th className="p-3">Camp</th>
                  <th className="p-3">Dungeon</th>
                </tr>
              </thead>
              <tbody>
                {WORLD_PROPS.map((p) => {
                  const inCamp = CAMP_PROP_PLACEMENTS.some((c) => c.propId === p.id);
                  const inDungeon = DUNGEON_COLLECTABLES.some((d) => d.propId === p.id);
                  return (
                    <tr key={p.id} className="border-b border-border/20 hover:bg-muted/20">
                      <td className="p-3 font-serif">{p.name}</td>
                      <td className="p-3 text-xs text-muted-foreground capitalize">{p.kind.replace("_", " ")}</td>
                      <td className="p-3">{inCamp ? "✓" : "—"}</td>
                      <td className="p-3">{inDungeon ? "✓ pickup" : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}