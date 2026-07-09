/**
 * Party — pick up to 2 Grudge6 allies (canonical Warlords roster).
 */
import { useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/PageChrome";
import {
  GRUDGE6_HEROES,
  getPartyAllyIds,
  togglePartyAlly,
  MAX_PARTY_ALLIES,
  type Grudge6HeroDef,
} from "@/data/grudge6Roster";
import { Tent, Users } from "lucide-react";
import { toast } from "sonner";

const ROLE_COLOR: Record<string, string> = {
  healer: "#7dd3fc",
  tank: "#94a3b8",
  ranger: "#86efac",
  bruiser: "#fca5a5",
  fighter: "#fcd34d",
  skirmisher: "#d8b4fe",
  unarmed: "#a3a3a3",
};

export default function Party() {
  const [tick, setTick] = useState(0);
  void tick;
  const selected = new Set(getPartyAllyIds());

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader
        kicker="Grudge6 roster"
        title="Party"
        subtitle={`Up to ${MAX_PARTY_ALLIES} allies — follow you, attack your RMB target, heal, and gather`}
        action={
          <Button asChild variant="outline" className="font-serif tracking-widest border-primary/40">
            <Link href="/game" className="flex items-center gap-2">
              <Tent className="h-4 w-4" /> Enter Dungeon
            </Link>
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border/50 bg-card/50 px-4 py-3">
        <Users className="h-5 w-5 text-primary" />
        <p className="text-sm font-serif text-muted-foreground">
          Selected{" "}
          <span className="text-primary font-mono">
            {selected.size}/{MAX_PARTY_ALLIES}
          </span>
          {" · "}
          Canonical 30 Warlords-era units (WK / ELF / DWF / ORC / UD / BRB)
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {GRUDGE6_HEROES.map((h) => (
          <HeroCard
            key={h.id}
            hero={h}
            active={selected.has(h.id)}
            onToggle={() => {
              const r = togglePartyAlly(h.id);
              toast[r.ok ? "success" : "error"](r.message);
              setTick((t) => t + 1);
            }}
          />
        ))}
      </div>
    </div>
  );
}

function HeroCard({
  hero,
  active,
  onToggle,
}: {
  hero: Grudge6HeroDef;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <Card
      className={`border-border/50 bg-card/60 overflow-hidden ${active ? "ring-1 ring-primary/60" : ""}`}
    >
      <div className="h-1" style={{ background: ROLE_COLOR[hero.role] ?? "#c5a059" }} />
      <CardHeader className="pb-2">
        <CardTitle className="font-serif text-base uppercase tracking-widest flex items-center justify-between gap-2">
          <span>{hero.displayName}</span>
          <span className="text-[10px] font-mono text-muted-foreground">{hero.faction}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-[11px] font-mono uppercase text-muted-foreground">
          {hero.role} · brain:{hero.brain} · {hero.race}
        </p>
        <p className="text-xs text-muted-foreground font-serif">
          Dmg {hero.kit.damage} · Range {hero.kit.attackRange}
          {hero.kit.healAmount > 0 ? ` · Heal ${hero.kit.healAmount}` : ""}
        </p>
        {hero.weaponMesh && (
          <p className="text-[10px] font-mono text-muted-foreground truncate">⚔ {hero.weaponMesh}</p>
        )}
        <Button
          size="sm"
          variant={active ? "default" : "outline"}
          className="w-full font-serif text-xs tracking-widest"
          onClick={onToggle}
        >
          {active ? "In party" : "Add ally"}
        </Button>
      </CardContent>
    </Card>
  );
}
