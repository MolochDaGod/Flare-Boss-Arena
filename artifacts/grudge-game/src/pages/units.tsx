import { useState } from "react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PageHeader } from "@/components/PageChrome";
import { FighterRosterThumb } from "@/components/FighterRosterThumb";
import {
  FIGHTERS,
  ATTR_ORDER,
  getActiveFighterId,
  type FighterDef,
  type AttrKey,
} from "@/data/fighters";
import { Users } from "lucide-react";

const ATTR_LABEL: Record<AttrKey, string> = {
  strength: "STR",
  vitality: "VIT",
  dexterity: "DEX",
  agility: "AGI",
  endurance: "END",
  intellect: "INT",
  tactics: "TAC",
  wisdom: "WIS",
};

const ROLES = ["All", ...Array.from(new Set(FIGHTERS.map((f) => f.role)))];

export default function Units() {
  const [roleFilter, setRoleFilter] = useState("All");
  const activeId = getActiveFighterId();
  const shown = roleFilter === "All" ? FIGHTERS : FIGHTERS.filter((f) => f.role === roleFilter);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 h-full flex flex-col">
      <PageHeader
        kicker="RTS / MMO roster"
        title="Unit Roster"
        subtitle={`${FIGHTERS.length} playable champions — StarCraft compendium meets MMO character journal`}
        action={
          <Button asChild variant="outline" className="font-serif tracking-widest border-primary/40">
            <Link href="/select" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Deploy Fighter
            </Link>
          </Button>
        }
      />

      <div className="flex flex-wrap gap-2">
        {ROLES.map((r) => (
          <button
            key={r}
            onClick={() => setRoleFilter(r)}
            className={`px-3 py-1 rounded font-serif text-xs tracking-widest uppercase border transition-all ${
              roleFilter === r
                ? "border-primary bg-primary/10 text-primary"
                : "border-border/40 text-muted-foreground hover:border-primary/40"
            }`}
          >
            {r}
          </button>
        ))}
      </div>

      <Card className="flex-1 border-border/50 bg-card/80 backdrop-blur min-h-0">
        <CardContent className="p-0 flex-1 min-h-0">
          <ScrollArea className="h-[calc(100vh-280px)] p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {shown.map((f: FighterDef) => (
                <Card
                  key={f.id}
                  className={`overflow-hidden border-border/40 bg-background/50 flex flex-col ${
                    f.id === activeId ? "ring-1 ring-primary/60 border-primary/40" : ""
                  }`}
                >
                  <div className="h-44 relative overflow-hidden bg-gradient-to-b from-black/60 to-background/80">
                    <FighterRosterThumb fighter={f} />
                    {f.featured && (
                      <span className="absolute top-2 left-2 text-[9px] font-serif uppercase tracking-widest px-2 py-0.5 rounded bg-primary/20 text-primary border border-primary/30">
                        Featured
                      </span>
                    )}
                    {f.id === activeId && (
                      <span className="absolute top-2 right-2 text-[9px] font-serif uppercase tracking-widest px-2 py-0.5 rounded bg-green-900/40 text-green-400 border border-green-500/30">
                        Active
                      </span>
                    )}
                  </div>
                  <div className="p-3 space-y-2">
                    <div>
                      <h3 className="font-serif text-sm uppercase tracking-wide">{f.name}</h3>
                      <p className="text-[10px] text-muted-foreground font-serif tracking-widest">
                        {f.title} · {f.role}
                      </p>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">{f.blurb}</p>
                    <div className="grid grid-cols-4 gap-1 pt-1">
                      {ATTR_ORDER.map((k) => (
                        <div key={k} className="text-center rounded bg-muted/30 py-1">
                          <p className="text-[8px] text-muted-foreground font-serif">{ATTR_LABEL[k]}</p>
                          <p className="text-[10px] font-mono text-primary">{f.stats[k]}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}