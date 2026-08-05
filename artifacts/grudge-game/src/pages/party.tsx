/**
 * Party — deploy owned Grudge6 units + recruited fighter heroes only.
 * Purchase / hire from Barracks-backed roster shop.
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
import {
  getOwnedGrudge6Ids,
  purchaseGrudge6,
  hireCostForGrudge6,
  getOwnedHeroes,
  isHeroOwned,
  purchaseHero,
  recruitHeroCost,
  hireableGrudge6,
  recruitableHeroes,
} from "@/data/rosterOwnership";
import { getBuildingTier } from "@/data/rtsCrafting";
import { getWallet } from "@/data/wallet";
import { Tent, Users, ShoppingBag } from "lucide-react";
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
  const refresh = () => setTick((t) => t + 1);

  const selected = new Set(getPartyAllyIds());
  const ownedG6 = new Set(getOwnedGrudge6Ids());
  const ownedHeroes = getOwnedHeroes();
  const barracks = getBuildingTier("barracks");
  const gold = getWallet().gold;
  const hireable = hireableGrudge6();
  const recruitable = recruitableHeroes().slice(0, 24);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader
        kicker="Owned roster only"
        title="Party & Barracks"
        subtitle={`Deploy up to ${MAX_PARTY_ALLIES} owned Grudge6 allies · hire units · recruit heroes`}
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
          Deployed{" "}
          <span className="text-primary font-mono">
            {selected.size}/{MAX_PARTY_ALLIES}
          </span>
          {" · "}
          Owned Grudge6 <span className="text-primary font-mono">{ownedG6.size}</span>
          {" · "}
          Heroes <span className="text-primary font-mono">{ownedHeroes.length}</span>
          {" · "}
          Barracks T{barracks} · {gold}g
        </p>
      </div>

      {/* Active deploy slots */}
      <section className="space-y-3">
        <h2 className="font-serif text-sm uppercase tracking-widest text-primary">Deploy (owned only)</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {GRUDGE6_HEROES.filter((h) => ownedG6.has(h.id)).map((h) => (
            <HeroCard
              key={h.id}
              hero={h}
              active={selected.has(h.id)}
              owned
              onToggle={() => {
                const r = togglePartyAlly(h.id);
                toast[r.ok ? "success" : "error"](r.message);
                refresh();
              }}
            />
          ))}
          {ownedG6.size === 0 && (
            <p className="text-sm text-muted-foreground col-span-full">
              No owned units — hire from the Barracks shop below (starter pack grants 2 free).
            </p>
          )}
        </div>
      </section>

      {ownedHeroes.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-serif text-sm uppercase tracking-widest text-primary">Recruited heroes</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {ownedHeroes.map((f) => (
              <Card key={f.id} className="border-border/50 bg-card/60">
                <CardHeader className="pb-2">
                  <CardTitle className="font-serif text-base uppercase tracking-widest">
                    {f.name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground font-serif">{f.title} · {f.role}</p>
                  <p className="text-[10px] font-mono text-muted-foreground mt-1">Owned · warband recruit</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Hire Grudge6 */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <ShoppingBag className="h-4 w-4 text-primary" />
          <h2 className="font-serif text-sm uppercase tracking-widest text-primary">
            Hire Grudge6 (Barracks T{Math.max(1, barracks)})
          </h2>
        </div>
        {barracks < 1 && (
          <p className="text-xs text-amber-200/80 font-serif">
            Upgrade Barracks to tier 1 in Main Panel → Crafting to unlock hiring.
          </p>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {hireable.slice(0, 18).map((h) => {
            const cost = hireCostForGrudge6(h.id);
            return (
              <Card key={h.id} className="border-border/40 bg-card/50">
                <CardHeader className="pb-2">
                  <CardTitle className="font-serif text-sm uppercase tracking-widest flex justify-between gap-2">
                    <span>{h.displayName}</span>
                    <span className="text-[10px] font-mono text-muted-foreground">{h.faction}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-[11px] font-mono uppercase text-muted-foreground">
                    {h.role} · {h.race}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full font-serif text-xs tracking-widest"
                    disabled={barracks < 1}
                    onClick={() => {
                      const r = purchaseGrudge6(h.id);
                      toast[r.ok ? "success" : "error"](r.message);
                      refresh();
                    }}
                  >
                    Hire · {cost}g
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Recruit fighter heroes */}
      <section className="space-y-3">
        <h2 className="font-serif text-sm uppercase tracking-widest text-primary">
          Recruit heroes (Barracks T2+)
        </h2>
        {barracks < 2 && (
          <p className="text-xs text-muted-foreground font-serif">
            Barracks tier 2 unlocks recruiting fighter champions into your warband.
          </p>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {recruitable.map((f) => {
            const cost = recruitHeroCost(f.id);
            const owned = isHeroOwned(f.id);
            return (
              <Card key={f.id} className="border-border/40 bg-card/50">
                <CardHeader className="pb-2">
                  <CardTitle className="font-serif text-sm uppercase tracking-widest">
                    {f.name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-xs text-muted-foreground font-serif">{f.role}</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full font-serif text-xs tracking-widest"
                    disabled={barracks < 2 || owned}
                    onClick={() => {
                      const r = purchaseHero(f.id);
                      toast[r.ok ? "success" : "error"](r.message);
                      refresh();
                    }}
                  >
                    {owned ? "Recruited" : `Recruit · ${cost}g`}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function HeroCard({
  hero,
  active,
  owned,
  onToggle,
}: {
  hero: Grudge6HeroDef;
  active: boolean;
  owned: boolean;
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
          disabled={!owned}
        >
          {active ? "In party" : "Deploy"}
        </Button>
      </CardContent>
    </Card>
  );
}
