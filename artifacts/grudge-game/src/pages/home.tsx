import React from "react";
import { getPlayableCharacter } from "@/data/playableIdentity";
import { useResolvedSkills } from "@/data/skillsResolver";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";
import {
  Swords,
  Skull,
  Tent,
  Users,
  Flame,
  Shield,
  ScrollText,
  PawPrint,
  Hammer,
  ChevronRight,
  Gift,
  Wallet,
  Map,
  Sparkles,
} from "lucide-react";
import { PLAY_LOOP } from "@/data/gameFlow";
import { DeployFunnelCard } from "@/components/DeployFunnelCard";
import { getDeployReadiness } from "@/data/deployFunnel";
import {
  getActiveFighter,
  ATTR_ORDER,
  type AttrKey,
  type FighterDef,
} from "@/data/fighters";
import { FighterPreview } from "@/components/FighterPreview";
import { ParchmentPanel } from "@/components/CraftpixUI";
import { SkillIcon } from "@/components/SkillIcon";

const GOLD = "#c5a059";

const ATTR_LABEL: Record<AttrKey, string> = {
  strength: "Strength",
  vitality: "Vitality",
  dexterity: "Dexterity",
  agility: "Agility",
  endurance: "Endurance",
  intellect: "Intellect",
  tactics: "Tactics",
  wisdom: "Wisdom",
};

/** Emoji slot glyphs — render reliably and match the Main Panel's slot set. */
const EQUIP_SLOT_ICONS: Record<string, string> = {
  mainHand: "⚔️", offHand: "🛡️", helm: "🪖", chest: "🎽", legs: "👖",
  boots: "🥾", gloves: "🧤", amulet: "📿", ring1: "💍", ring2: "💍",
};

const EQUIP_SLOTS = [
  "mainHand", "offHand", "helm", "chest", "legs",
  "boots", "gloves", "amulet", "ring1", "ring2",
] as const;

function StatBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 shrink-0 font-serif text-[11px] uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-black/50 ring-1 ring-[#c5a059]/20">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#7a5a23] to-[#c5a059]"
          style={{ width: `${Math.min(100, value * 10)}%` }}
        />
      </div>
      <span className="w-5 shrink-0 text-right font-mono text-xs text-[#c5a059]">{value}</span>
    </div>
  );
}

function FighterStage({ fighter }: { fighter: FighterDef }) {
  return (
    <div
      className="relative min-h-[460px] w-full overflow-hidden"
      style={{ background: "radial-gradient(ellipse at center, #1a0a0030 0%, #060608 70%)" }}
    >
      {/* Ambient ember glow */}
      <div
        className="pointer-events-none absolute inset-0 opacity-15"
        style={{ background: `radial-gradient(ellipse at 50% 55%, ${GOLD} 0%, transparent 60%)` }}
      />

      {/* Isometric grid lines */}
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.06]"
        viewBox="0 0 400 360"
        preserveAspectRatio="none"
      >
        {Array.from({ length: 10 }).map((_, i) => (
          <React.Fragment key={i}>
            <line x1={i * 44} y1="0" x2={i * 44 + 200} y2="360" stroke="#ffaa00" strokeWidth="0.5" />
            <line x1={400 - i * 44} y1="0" x2={200 - i * 44} y2="360" stroke="#ffaa00" strokeWidth="0.5" />
          </React.Fragment>
        ))}
      </svg>

      {fighter.featured && (
        <span className="absolute left-4 top-4 z-20 rounded-full border border-[#c5a059]/50 bg-black/50 px-3 py-1 font-serif text-[10px] uppercase tracking-widest text-[#c5a059]">
          Featured
        </span>
      )}

      {/* Live 3D fighter */}
      <div className="absolute inset-0">
        <FighterPreview skinId={fighter.skinId} fighterId={fighter.id} />
      </div>

      {/* Name plate */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col items-center gap-2 bg-gradient-to-t from-[#060608] via-[#060608]/80 to-transparent px-6 pb-6 pt-12 text-center">
        <p className="font-serif text-3xl uppercase tracking-widest text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
          {fighter.name}
        </p>
        <p className="font-serif text-sm uppercase tracking-[0.25em]" style={{ color: GOLD }}>
          {fighter.title} · {fighter.role}
        </p>
        <p className="mt-1 max-w-md font-serif text-xs leading-relaxed text-muted-foreground">
          {fighter.blurb}
        </p>
        <div className="mt-2 flex w-48 items-center gap-3">
          <div className="h-px flex-1" style={{ background: `linear-gradient(to right, transparent, ${GOLD}80)` }} />
          <Flame className="h-3 w-3" style={{ color: GOLD }} />
          <div className="h-px flex-1" style={{ background: `linear-gradient(to left, transparent, ${GOLD}80)` }} />
        </div>
      </div>
    </div>
  );
}

const WAR_ROOM: { href: string; label: string; sub: string; icon: React.ElementType }[] = [
  { href: "/select", label: "Choose Fighter", sub: "Active champion", icon: Users },
  { href: "/party", label: "Party Allies", sub: "Up to 2 Grudge6 units", icon: PawPrint },
  { href: "/equipment", label: "Stone Sockets", sub: "8 attribute stones", icon: Sparkles },
  { href: "/skills", label: "Grimoire", sub: "Skill ranks", icon: ScrollText },
  { href: "/perks", label: "Perks", sub: "Combat machines", icon: Flame },
  { href: "/units", label: "Unit Roster", sub: "Champion compendium", icon: Shield },
  { href: "/enemies", label: "Bestiary", sub: "Enemy units", icon: Skull },
  { href: "/rewards", label: "Rewards", sub: "Dailies & season", icon: Gift },
  { href: "/account", label: "Wallet", sub: "Currencies", icon: Wallet },
  { href: "/content", label: "Atlas", sub: "Modes & props", icon: Map },
  { href: "/character/new", label: "Profile", sub: "Account sheet", icon: Hammer },
];

export default function Home() {
  const [, setLocation] = useLocation();
  const activeChar = getPlayableCharacter();
  const mainHandId = activeChar.equipment?.mainHand ?? undefined;
  const { classSkills: classSkillSet } = useResolvedSkills(activeChar.class, mainHandId);
  const classSkills = classSkillSet?.skills ?? [];

  const [fighter] = React.useState<FighterDef>(() => getActiveFighter());
  const deploy = React.useMemo(() => getDeployReadiness(), []);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-[#c5a059]/20 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-serif text-xs uppercase tracking-[0.3em] text-muted-foreground">
            Prepare for the cull
          </p>
          <h1 className="font-serif text-4xl uppercase tracking-widest text-primary">War Panel</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            size="lg"
            className="font-serif tracking-widest bg-primary text-primary-foreground shadow-[0_0_20px_-4px_rgba(255,165,0,0.5)] hover:bg-primary/80"
            onClick={() => setLocation(deploy.deployHref)}
          >
            <Swords className="mr-2 h-5 w-5" />
            {deploy.deployLabel}
          </Button>
          <Button
            asChild
            size="lg"
            className="font-serif tracking-widest bg-secondary text-secondary-foreground hover:bg-secondary/80"
          >
            <Link href="/boss" className="flex items-center gap-2">
              <Skull className="h-5 w-5" />
              Boss Arena
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main column — fighter showcase + skills */}
        <div className="space-y-6 lg:col-span-2">
          <Card className="relative overflow-hidden border-primary/20 bg-card/40 shadow-[0_0_30px_-10px_rgba(255,165,0,0.12)]">
            <CardContent className="relative p-0">
              <FighterStage fighter={fighter} />
            </CardContent>
          </Card>

          {/* Battle actions */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <Button
              variant="outline"
              className="h-auto flex-col gap-1 border-primary/40 py-4 font-serif tracking-widest text-primary hover:bg-primary/10"
              onClick={() => setLocation("/select")}
            >
              <Users className="h-5 w-5" />
              <span className="text-xs">Choose Fighter</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto flex-col gap-1 border-primary/40 py-4 font-serif tracking-widest text-primary hover:bg-primary/10"
              onClick={() => setLocation("/game")}
            >
              <Swords className="h-5 w-5" />
              <span className="text-xs">Enter World</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto flex-col gap-1 border-primary/40 py-4 font-serif tracking-widest text-primary hover:bg-primary/10"
              onClick={() => setLocation("/camp")}
            >
              <Tent className="h-5 w-5" />
              <span className="text-xs">Visit Camp</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto flex-col gap-1 border-primary/40 py-4 font-serif tracking-widest text-primary hover:bg-primary/10"
              onClick={() => setLocation("/boss")}
            >
              <Skull className="h-5 w-5" />
              <span className="text-xs">Boss Arena</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto flex-col gap-1 border-primary/40 py-4 font-serif tracking-widest text-primary hover:bg-primary/10"
              onClick={() => setLocation("/moba")}
            >
              <Map className="h-5 w-5" />
              <span className="text-xs">MOBA Mode</span>
            </Button>
          </div>

          {classSkills.length > 0 && (
            <Card className="border-border/50 bg-card/50">
              <CardHeader className="border-b border-border/50 pb-3">
                <CardTitle className="font-serif text-sm uppercase tracking-widest text-muted-foreground">
                  Class Skills
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  {classSkills.slice(0, 8).map((skill) => (
                    <div
                      key={skill.id}
                      className="flex flex-col items-center gap-3 rounded-md border border-border/50 bg-background/50 p-4 text-center transition-colors hover:border-primary/50"
                    >
                      <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded border border-border/50 bg-muted/50">
                        <SkillIcon icon={skill.icon} glyph={skill.glyph} size={32} radius={4} />
                      </div>
                      <div>
                        <p className="font-serif text-sm tracking-wide">{skill.name}</p>
                        {skill.cooldown ? (
                          <p className="mt-1 text-[10px] uppercase text-muted-foreground">
                            CD: {skill.cooldown}t
                          </p>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Side column — deploy funnel, combat profile, equipment, war room */}
        <div className="space-y-6">
          <DeployFunnelCard />

          <ParchmentPanel className="overflow-hidden">
            <div className="border-b border-[#c5a059]/30 px-6 pb-3 pt-4">
              <h2 className="font-serif text-sm uppercase tracking-widest" style={{ color: GOLD }}>
                Combat Profile
              </h2>
            </div>
            <div className="space-y-4 px-6 pb-6 pt-6">
              {ATTR_ORDER.map((key) => (
                <StatBar key={key} label={ATTR_LABEL[key]} value={fighter.stats[key]} />
              ))}
            </div>
          </ParchmentPanel>

          <Card className="border-border/50 bg-card/50">
            <CardHeader className="flex flex-row items-center justify-between border-b border-border/50 pb-3">
              <CardTitle className="font-serif text-sm uppercase tracking-widest text-muted-foreground">
                Equipment
              </CardTitle>
              <Button variant="ghost" size="sm" asChild className="h-6 text-xs uppercase tracking-widest">
                <Link href="/equipment">Change</Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-3 pt-6">
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Loadout follows your active fighter from Choose Fighter — no separate character creation.
              </p>
              {activeChar &&
                EQUIP_SLOTS.map((slot) => {
                  const itemId = (activeChar.equipment as Record<string, string | undefined> | undefined)?.[slot];
                  return (
                    <div
                      key={slot}
                      className="flex items-center gap-3 rounded border border-border/30 bg-background/30 p-2"
                    >
                      <div
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-border/50 bg-muted/50 text-base"
                        style={{ opacity: itemId ? 1 : 0.4 }}
                      >
                        {EQUIP_SLOT_ICONS[slot] ?? "▫️"}
                      </div>
                      <div className="flex-1 truncate">
                        <p className="font-serif text-xs uppercase tracking-widest text-muted-foreground">{slot}</p>
                        <p className="mt-0.5 truncate font-serif text-sm text-foreground">{itemId || "Empty"}</p>
                      </div>
                    </div>
                  );
                })}
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/50">
            <CardHeader className="border-b border-border/50 pb-3">
              <CardTitle className="font-serif text-sm uppercase tracking-widest text-muted-foreground">
                War Room
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-2 pt-6">
              {WAR_ROOM.map(({ href, label, sub, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="group flex items-center gap-3 rounded border border-border/30 bg-background/30 p-3 transition-colors hover:border-primary/50 hover:bg-primary/5"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-border/50 bg-muted/40 text-primary">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <p className="font-serif text-sm uppercase tracking-widest text-foreground">{label}</p>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{sub}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                </Link>
              ))}
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/50">
            <CardHeader className="border-b border-border/50 pb-3">
              <CardTitle className="font-serif text-sm uppercase tracking-widest text-muted-foreground">
                Play Loop
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-4">
              {PLAY_LOOP.map((step) => (
                <Link
                  key={step.step}
                  href={step.route}
                  className="flex items-center gap-2 rounded border border-border/20 px-2 py-1.5 text-xs hover:border-primary/40 transition-colors"
                >
                  <span className="font-mono text-primary w-4">{step.step}</span>
                  <span className="font-serif uppercase tracking-wide flex-1">{step.label}</span>
                  <ChevronRight className="h-3 w-3 text-muted-foreground" />
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
