/**
 * Grimoire — fighter skills with simple rank upgrades (gold).
 * Heavy "support gem" complexity removed — power comes from stones + ranks.
 */
import { useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/PageChrome";
import { getGameLoadout } from "@/data/gameCombat";
import { getActiveFighter } from "@/data/fighters";
import {
  getSkillState,
  upgradeSkill,
  resolveSkillBoost,
  levelCost,
  MAX_LEVEL,
} from "@/data/abilityUpgrades";
import { getWallet } from "@/data/wallet";
import { Tent, Book } from "lucide-react";
import { toast } from "sonner";

export default function Skills() {
  const [tick, setTick] = useState(0);
  void tick;
  const refresh = () => setTick((t) => t + 1);

  const loadout = getGameLoadout(getActiveFighter().id);
  const wallet = getWallet();

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader
        kicker="Abilities"
        title="Grimoire"
        subtitle="Rank skills for more damage, bigger AoE, faster cooldowns — socket stones for procs"
        action={
          <div className="flex gap-2">
            <Button asChild variant="outline" className="font-serif tracking-widest border-primary/40">
              <Link href="/equipment">Stones</Link>
            </Button>
            <Button asChild variant="outline" className="font-serif tracking-widest border-primary/40">
              <Link href="/game" className="flex items-center gap-2">
                <Tent className="h-4 w-4" /> Dungeon
              </Link>
            </Button>
          </div>
        }
      />

      <p className="text-sm font-serif text-muted-foreground">
        Gold: <span className="text-primary font-mono">{wallet.gold}</span>
        {" · "}
        {loadout.fighter.name} · Spell power ×{loadout.combat.spellDamageMult.toFixed(2)}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loadout.skills.map((sk) => {
          const st = getSkillState(sk.id);
          const boost = resolveSkillBoost(sk.id);
          const next = levelCost(st.level + 1);
          return (
            <Card key={sk.id} className="border-border/50 bg-card/60">
              <CardHeader className="pb-2">
                <CardTitle className="font-serif text-base uppercase tracking-widest flex items-center gap-2">
                  <span>{sk.glyph}</span> {sk.name}
                  <span className="ml-auto text-[10px] font-mono text-primary">
                    Rank {st.level}/{MAX_LEVEL}
                  </span>
                </CardTitle>
                <CardDescription className="font-serif">{sk.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-[11px] font-mono text-muted-foreground">
                  ×{boost.damageMult.toFixed(2)} dmg · ×{boost.aoeMult.toFixed(2)} AoE · CD ×
                  {boost.cooldownMult.toFixed(2)}
                </p>
                <Button
                  size="sm"
                  className="font-serif text-xs tracking-widest"
                  disabled={st.level >= MAX_LEVEL}
                  onClick={() => {
                    const r = upgradeSkill(sk.id);
                    toast[r.ok ? "success" : "error"](r.message);
                    refresh();
                  }}
                >
                  {st.level >= MAX_LEVEL ? "Maxed" : `Upgrade (${next}g)`}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="border-border/50 bg-card/50">
        <CardHeader className="pb-2">
          <CardTitle className="font-serif text-sm uppercase tracking-widest flex items-center gap-2">
            <Book className="h-4 w-4" /> How power works
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground font-serif space-y-1">
          <p>· Fighter attributes drive HP, damage, crit, defense, spell power, speed.</p>
          <p>· Attribute stones (equipment) add stats + auto-procs (bolts, novas, burn, chill…).</p>
          <p>· Skill ranks multiply damage/AoE and cut cooldowns.</p>
        </CardContent>
      </Card>
    </div>
  );
}
