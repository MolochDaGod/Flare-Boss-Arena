import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MonsterCanvas } from "@/components/MonsterCanvas";
import { MONSTER_DEFS } from "@/game/MonsterModels";

const TIER_COLORS: Record<number, { bg: string; text: string; label: string; accent: string }> = {
  1: { bg: "bg-gray-500/20", text: "text-gray-400", label: "Common", accent: "#9ca3af" },
  2: { bg: "bg-green-900/30", text: "text-green-400", label: "Uncommon", accent: "#22c55e" },
  3: { bg: "bg-blue-900/30", text: "text-blue-400", label: "Rare", accent: "#3b82f6" },
  4: { bg: "bg-purple-900/30", text: "text-purple-400", label: "Epic", accent: "#a855f7" },
  5: { bg: "bg-yellow-900/30", text: "text-amber-400", label: "Legendary", accent: "#f59e0b" },
};

function titleCase(s: string): string {
  return s.replace(/(^|[\s_])\w/g, (m) => m.toUpperCase()).replace(/_/g, " ");
}

export default function Enemies() {
  const [selectedType, setSelectedType] = useState<string>("All");

  const monsters = MONSTER_DEFS;
  const types = ["All", ...Array.from(new Set(monsters.map((m) => m.type)))];
  const displayed = selectedType === "All" ? monsters : monsters.filter((m) => m.type === selectedType);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 h-full flex flex-col">
      <div className="shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-serif text-primary uppercase tracking-widest">Bestiary</h1>
          <p className="text-muted-foreground font-serif tracking-widest text-sm mt-2">
            Know thy enemy — {monsters.length} beasts forged in three dimensions
          </p>
        </div>
      </div>

      {/* Type filter */}
      <div className="shrink-0 flex flex-wrap gap-2">
        {types.map((t) => (
          <button
            key={t}
            onClick={() => setSelectedType(t)}
            className={`px-3 py-1 rounded font-serif text-xs tracking-widest uppercase border transition-all ${
              selectedType === t
                ? "border-primary bg-primary/10 text-primary"
                : "border-border/40 text-muted-foreground hover:border-primary/40 hover:text-primary/70"
            }`}
          >
            {titleCase(t)}
          </button>
        ))}
      </div>

      <Card className="flex-1 border-border/50 bg-card/80 backdrop-blur flex flex-col min-h-0">
        <CardContent className="p-0 flex-1 min-h-0">
          <ScrollArea className="h-[calc(100vh-280px)] p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {displayed.map((m) => {
                const tier = TIER_COLORS[m.tier] ?? TIER_COLORS[1];
                return (
                  <Card
                    key={m.id}
                    className="border-border/40 bg-background/50 hover:border-primary/30 transition-all duration-200 overflow-hidden flex flex-col cursor-default"
                  >
                    {/* Live 3D model preview */}
                    <div className="h-48 bg-gradient-to-b from-black/50 to-background/80 border-b border-border/40 relative overflow-hidden">
                      <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_center,_#ffffff_0%,_transparent_70%)]" />
                      <MonsterCanvas file={m.file} clip={m.clip} accent={tier.accent} />
                      <div className={`absolute top-2 right-2 px-1.5 py-0.5 rounded text-[9px] font-mono uppercase ${tier.bg} ${tier.text} border border-current/20`}>
                        T{m.tier} · {tier.label}
                      </div>
                    </div>

                    <div className="p-3 flex-1 flex flex-col gap-2">
                      <div>
                        <h3 className="font-serif text-sm tracking-wide text-foreground uppercase leading-tight">{m.name}</h3>
                        <p className="text-[10px] text-muted-foreground mt-0.5 font-serif tracking-widest">
                          {titleCase(m.type)} · {titleCase(m.archetype)}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-1 mt-1">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-serif tracking-widest uppercase text-muted-foreground">HP</span>
                          <span className="text-[10px] font-mono text-red-400">{m.hp}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-serif tracking-widest uppercase text-muted-foreground">DMG</span>
                          <span className="text-[10px] font-mono text-primary">{m.damage}</span>
                        </div>
                      </div>

                      <div className="mt-auto pt-2 border-t border-border/20">
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted/40 border border-border/30 text-muted-foreground font-mono uppercase tracking-wide">
                          {m.clip ? "Animated" : "Static Mesh"}
                        </span>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
