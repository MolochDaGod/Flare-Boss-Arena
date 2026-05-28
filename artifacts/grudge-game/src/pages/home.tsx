import React from "react";
import { useListCharacters, useGetCharacterSkills } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";
import { Sword, Skull, Swords, Flame, Shield, Zap } from "lucide-react";

const FACTION_COLORS: Record<string, string> = {
  Crusade: "#d4891a",
  Fabled: "#22c55e",
  Legion: "#ef4444",
};

const CLASS_ICONS: Record<string, React.ReactNode> = {
  warrior: <Shield className="w-8 h-8" />,
  mage: <Zap className="w-8 h-8" />,
  ranger: <Sword className="w-8 h-8" />,
  worge: <Flame className="w-8 h-8" />,
};

function CharacterPortrait({ char }: { char: { name: string; race: string; class: string; level: number; faction?: string } }) {
  const faction = (char as { faction?: string }).faction ?? "";
  const factionColor = FACTION_COLORS[faction] ?? "#d4891a";
  const classKey = char.class?.toLowerCase() ?? "warrior";

  return (
    <div
      className="w-full min-h-[360px] flex flex-col items-center justify-center relative overflow-hidden"
      style={{ background: "radial-gradient(ellipse at center, #1a0a0030 0%, #060608 70%)" }}
    >
      {/* Ambient glow */}
      <div
        className="absolute inset-0 opacity-10"
        style={{ background: `radial-gradient(ellipse at 50% 60%, ${factionColor} 0%, transparent 65%)` }}
      />

      {/* Isometric grid lines */}
      <svg className="absolute inset-0 w-full h-full opacity-5" viewBox="0 0 400 360" preserveAspectRatio="none">
        {Array.from({ length: 10 }).map((_, i) => (
          <React.Fragment key={i}>
            <line x1={i * 44} y1="0" x2={i * 44 + 200} y2="360" stroke="#ffaa00" strokeWidth="0.5" />
            <line x1={400 - i * 44} y1="0" x2={200 - i * 44} y2="360" stroke="#ffaa00" strokeWidth="0.5" />
          </React.Fragment>
        ))}
      </svg>

      {/* Class silhouette icon */}
      <div className="relative z-10 flex flex-col items-center gap-6">
        <div
          className="w-28 h-28 rounded-full flex items-center justify-center border-2"
          style={{
            background: `radial-gradient(ellipse, ${factionColor}22 0%, #0a0a0c 70%)`,
            borderColor: `${factionColor}60`,
            boxShadow: `0 0 40px -8px ${factionColor}`,
            color: factionColor,
          }}
        >
          {CLASS_ICONS[classKey] ?? <Sword className="w-8 h-8" />}
        </div>

        <div className="text-center">
          <p className="font-serif text-3xl tracking-widest uppercase text-white">{char.name}</p>
          <p className="font-serif text-sm tracking-widest mt-1" style={{ color: factionColor }}>
            Level {char.level} · {char.race} {char.class}
          </p>
          {faction && (
            <p className="font-serif text-xs tracking-[0.3em] uppercase mt-1 text-muted-foreground">{faction} Faction</p>
          )}
        </div>

        {/* Decorative divider */}
        <div className="flex items-center gap-3 w-48">
          <div className="h-px flex-1" style={{ background: `linear-gradient(to right, transparent, ${factionColor}80)` }} />
          <Flame className="w-3 h-3" style={{ color: factionColor }} />
          <div className="h-px flex-1" style={{ background: `linear-gradient(to left, transparent, ${factionColor}80)` }} />
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [, setLocation] = useLocation();
  const { data: characters, isLoading } = useListCharacters();
  const activeChar = characters?.[0]; // Default to first char for now
  
  const { data: skills } = useGetCharacterSkills(activeChar?.id ?? 0, {
    query: { enabled: !!activeChar?.id, queryKey: ["skills", activeChar?.id] }
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-serif text-primary uppercase tracking-widest">War Panel</h1>
          <p className="text-muted-foreground font-serif tracking-widest text-sm mt-2">Prepare for the cull</p>
        </div>
        <div className="flex items-center gap-3">
          {activeChar && (
            <Button
              size="lg"
              className="font-serif tracking-widest bg-primary text-primary-foreground hover:bg-primary/80 shadow-[0_0_20px_-4px_rgba(255,165,0,0.5)]"
              onClick={() => setLocation("/game")}
            >
              <Swords className="w-5 h-5 mr-2" />
              Enter World
            </Button>
          )}
          <Button asChild size="lg" className="font-serif tracking-widest bg-secondary text-secondary-foreground hover:bg-secondary/80">
            <Link href="/boss" className="flex items-center gap-2">
              <Skull className="w-5 h-5" />
              Boss Arena
            </Link>
          </Button>
        </div>
      </div>

      {!activeChar && !isLoading && (
        <Card className="border-dashed border-muted-foreground/30 bg-card/50">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Sword className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-serif mb-2">No Warlord Found</h3>
            <p className="text-sm text-muted-foreground mb-6">Forge your identity before stepping into the arena.</p>
            <Button asChild variant="outline">
              <Link href="/character/new">Create Character</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {activeChar && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className="bg-card/40 border-primary/20 shadow-[0_0_30px_-10px_rgba(255,165,0,0.1)] relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent z-10 pointer-events-none" />
              <CardContent className="p-0 relative">
                <CharacterPortrait char={{ name: activeChar.name, race: activeChar.race, class: activeChar.class, level: activeChar.level ?? 1, faction: (activeChar as { faction?: string }).faction }} />
              </CardContent>
            </Card>

            {skills && skills.activeSkills.length > 0 && (
              <Card className="border-border/50 bg-card/50">
                <CardHeader className="pb-3 border-b border-border/50">
                  <CardTitle className="text-sm font-serif tracking-widest uppercase text-muted-foreground">Derived Active Skills</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {skills.activeSkills.map(skill => (
                      <div key={skill.id} className="p-4 rounded-md border border-border/50 bg-background/50 flex flex-col items-center text-center gap-3 hover:border-primary/50 transition-colors">
                        <div className="w-12 h-12 rounded bg-muted/50 border border-border/50 flex items-center justify-center overflow-hidden">
                          {skill.icon ? (
                            <img src={`https://molochdagod.github.io/ObjectStore/icons/skill_nobg/${skill.icon}`} alt={skill.name} className="w-8 h-8 object-contain" />
                          ) : (
                            <Sword className="w-6 h-6 text-muted-foreground" />
                          )}
                        </div>
                        <div>
                          <p className="font-serif text-sm tracking-wide">{skill.name}</p>
                          <p className="text-[10px] text-muted-foreground mt-1 uppercase">CD: {skill.cooldown || "0"}s</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-6">
            <Card className="border-border/50 bg-card/50">
              <CardHeader className="pb-3 border-b border-border/50">
                <CardTitle className="text-sm font-serif tracking-widest uppercase text-muted-foreground">Attributes</CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                {Object.entries((activeChar.attributes as Record<string, unknown>) ?? {}).map(([attr, val]) => (
                  <div key={attr} className="flex justify-between items-center">
                    <span className="text-sm font-serif tracking-widest text-muted-foreground uppercase">{attr}</span>
                    <span className="font-mono text-primary">{String(val)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-border/50 bg-card/50">
              <CardHeader className="pb-3 border-b border-border/50 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-serif tracking-widest uppercase text-muted-foreground">Equipment</CardTitle>
                <Button variant="ghost" size="sm" asChild className="h-6 text-xs tracking-widest uppercase">
                  <Link href="/equipment">Change</Link>
                </Button>
              </CardHeader>
              <CardContent className="pt-6 space-y-3">
                {["mainHand", "offHand", "helm", "chest", "legs", "boots", "gloves", "amulet", "ring1", "ring2"].map(slot => {
                  const itemId = (activeChar.equipment as any)?.[slot];
                  return (
                    <div key={slot} className="flex items-center gap-3 p-2 rounded border border-border/30 bg-background/30">
                      <div className="w-8 h-8 rounded bg-muted/50 flex items-center justify-center text-[10px] uppercase font-mono text-muted-foreground shrink-0 border border-border/50">
                        {slot.slice(0, 2)}
                      </div>
                      <div className="flex-1 truncate">
                        <p className="text-xs font-serif tracking-widest text-muted-foreground uppercase">{slot}</p>
                        <p className="text-sm font-serif truncate text-foreground mt-0.5">{itemId || "Empty"}</p>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
