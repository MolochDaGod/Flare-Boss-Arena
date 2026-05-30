import React from "react";
import { useListCharacters, useGetCharacterSkills } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Book, Flame, Shield, Loader2, Sparkles, Swords } from "lucide-react";
import { useResolvedSkills } from "@/data/skillsResolver";
import { SkillIcon } from "@/components/SkillIcon";
import type { ClassSkill } from "@/data/classSkills";
import type { WeaponSlot } from "@/game/weaponSkills";

const SLOT_ACCENT: Record<string, string> = {
  primary: "border-primary/40 text-primary",
  secondary: "border-secondary/40 text-secondary",
  ability: "border-[#4a9eff]/40 text-[#4a9eff]",
  ultimate: "border-[#ffaa00]/50 text-[#ffaa00]",
};

function ClassSkillCard({ skill }: { skill: ClassSkill }) {
  return (
    <div
      className={`flex gap-3 p-3 rounded border bg-background/50 transition-colors ${
        skill.isSignature
          ? "border-[#ffaa00]/50 shadow-[inset_0_0_20px_rgba(255,170,0,0.08)]"
          : "border-border/50 hover:border-primary/30"
      }`}
    >
      <div className="w-12 h-12 rounded bg-muted/50 border border-border/50 shrink-0 flex items-center justify-center text-2xl overflow-hidden">
        <SkillIcon icon={skill.icon} glyph={skill.glyph} size={46} radius={4} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-start mb-1 gap-2">
          <h3 className="font-serif text-sm tracking-wide text-primary truncate">{skill.name}</h3>
          {skill.isSignature && (
            <span className="text-[9px] font-mono text-[#ffaa00] uppercase px-2 py-0.5 rounded bg-[#ffaa00]/10 border border-[#ffaa00]/40 shrink-0">Signature</span>
          )}
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">{skill.description}</p>
        <div className="flex flex-wrap gap-3 mt-2">
          {skill.cooldown ? <span className="text-[10px] font-mono text-muted-foreground uppercase"><span className="text-foreground">CD:</span> {skill.cooldown}t</span> : null}
          {skill.manaCost ? <span className="text-[10px] font-mono uppercase"><span className="text-[#3b82f6]">MP:</span> {skill.manaCost}</span> : null}
          {skill.staminaCost ? <span className="text-[10px] font-mono uppercase"><span className="text-[#44ff44]">SP:</span> {skill.staminaCost}</span> : null}
          {skill.damage ? <span className="text-[10px] font-mono text-muted-foreground uppercase"><span className="text-[#ff4444]">DMG:</span> {skill.damage}x</span> : null}
        </div>
        {skill.effects?.length ? (
          <div className="flex flex-wrap gap-1 mt-2">
            {skill.effects.map((e) => (
              <span key={e} className="text-[9px] font-mono text-muted-foreground uppercase px-1.5 py-0.5 rounded bg-muted/40 border border-border/40">{e}</span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function WeaponSlotBlock({ slot }: { slot: WeaponSlot }) {
  return (
    <div className="rounded border border-border/40 bg-background/40 p-3">
      <div className="flex items-center justify-between mb-2">
        <span className={`text-[10px] font-serif tracking-widest uppercase px-2 py-0.5 rounded border ${SLOT_ACCENT[slot.type] ?? "border-border/50 text-muted-foreground"}`}>{slot.label}</span>
        <span className="text-[9px] font-mono text-muted-foreground uppercase">Unlock T{slot.unlockTier}</span>
      </div>
      <div className="space-y-2">
        {slot.skills.map((sk) => (
          <div key={sk.id} className="flex items-start justify-between gap-2 text-xs">
            <div className="min-w-0">
              <span className="font-serif text-foreground/90">{sk.name}</span>
              <span className="text-muted-foreground"> — {sk.description}</span>
            </div>
            <div className="flex gap-2 shrink-0 font-mono text-[10px] text-muted-foreground">
              {sk.damage ? <span className="text-[#ff4444]">{sk.damage}</span> : null}
              {sk.cooldown ? <span>{sk.cooldown}s</span> : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Skills() {
  const { data: characters } = useListCharacters();
  const activeChar = characters?.[0];

  const { data: skills, isLoading: isLoadingSkills } = useGetCharacterSkills(activeChar?.id ?? 0, {
    query: { enabled: !!activeChar?.id, queryKey: ["skills", activeChar?.id] }
  });

  const mainHandId = activeChar?.equipment?.mainHand ?? undefined;
  const {
    classSkills,
    weaponType,
    weaponSlots,
    classWeaponTypes,
    isLoading: isLoadingTrees,
  } = useResolvedSkills(activeChar?.class, mainHandId);

  if (!activeChar) {
    return <div className="p-8 text-center font-serif text-muted-foreground tracking-widest">No character selected.</div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 h-full flex flex-col">
      <div>
        <h1 className="text-4xl font-serif text-primary uppercase tracking-widest">Grimoire</h1>
        <p className="text-muted-foreground font-serif tracking-widest text-sm mt-2">Power forged through combat</p>
      </div>

      <Tabs defaultValue="active" className="flex-1 flex flex-col min-h-0">
        <TabsList className="bg-card/50 border border-border/50 p-1">
          <TabsTrigger value="active" className="font-serif tracking-widest uppercase text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Active Loadout</TabsTrigger>
          <TabsTrigger value="trees" className="font-serif tracking-widest uppercase text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Class Trees</TabsTrigger>
        </TabsList>
        
        <TabsContent value="active" className="flex-1 min-h-0 mt-6">
          {isLoadingSkills ? (
            <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 h-full">
              <Card className="border-border/50 bg-card/80 backdrop-blur flex flex-col">
                <CardHeader className="border-b border-border/50 pb-4">
                  <div className="flex items-center gap-2">
                    <Flame className="w-5 h-5 text-primary" />
                    <CardTitle className="font-serif tracking-widest uppercase text-lg">Active Skills</CardTitle>
                  </div>
                  <CardDescription className="font-serif tracking-wide">Granted by equipped weapons</CardDescription>
                </CardHeader>
                <CardContent className="p-0 flex-1">
                  <ScrollArea className="h-full">
                    <div className="p-4 space-y-4">
                      {skills?.activeSkills?.length ? skills.activeSkills.map(skill => (
                        <div key={skill.id} className="flex gap-4 p-4 rounded border border-border/50 bg-background/50 hover:border-primary/30 transition-colors">
                          <div className="w-16 h-16 rounded bg-muted/50 border border-border/50 shrink-0 flex items-center justify-center p-1">
                             {skill.icon ? (
                              <img src={`https://molochdagod.github.io/ObjectStore/icons/skill_nobg/${skill.icon}`} alt={skill.name} className="w-full h-full object-contain" />
                            ) : (
                              <Book className="w-8 h-8 text-muted-foreground" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start mb-1">
                              <h3 className="font-serif text-base tracking-wide text-primary truncate">{skill.name}</h3>
                              <span className="text-[10px] font-mono text-muted-foreground uppercase px-2 py-0.5 rounded bg-muted/50 border border-border/50 ml-2 shrink-0">{skill.weaponType}</span>
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed">{skill.description}</p>
                            <div className="flex gap-4 mt-3">
                              {skill.cooldown && <span className="text-xs font-mono text-muted-foreground uppercase"><span className="text-foreground">CD:</span> {skill.cooldown}</span>}
                              {skill.mana && <span className="text-xs font-mono text-muted-foreground uppercase"><span className="text-[#3b82f6]">MP:</span> {skill.mana}</span>}
                            </div>
                          </div>
                        </div>
                      )) : (
                        <div className="text-center p-8 text-muted-foreground font-serif tracking-widest text-sm">No active skills. Equip weapons to gain power.</div>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              <Card className="border-border/50 bg-card/80 backdrop-blur flex flex-col">
                <CardHeader className="border-b border-border/50 pb-4">
                  <div className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-secondary" />
                    <CardTitle className="font-serif tracking-widest uppercase text-lg">Passives</CardTitle>
                  </div>
                  <CardDescription className="font-serif tracking-wide">Granted by equipped armor & accessories</CardDescription>
                </CardHeader>
                <CardContent className="p-0 flex-1">
                  <ScrollArea className="h-full">
                    <div className="p-4 space-y-4">
                      {skills?.passives?.length ? skills.passives.map(skill => (
                        <div key={skill.id} className="flex gap-4 p-4 rounded border border-border/50 bg-background/50 hover:border-secondary/30 transition-colors">
                           <div className="w-12 h-12 rounded bg-muted/50 border border-border/50 shrink-0 flex items-center justify-center p-1">
                             {skill.icon ? (
                              <img src={`https://molochdagod.github.io/ObjectStore/icons/skill_nobg/${skill.icon}`} alt={skill.name} className="w-full h-full object-contain" />
                            ) : (
                              <Shield className="w-6 h-6 text-muted-foreground" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0 py-1">
                            <h3 className="font-serif text-sm tracking-wide text-secondary mb-1">{skill.name}</h3>
                            <p className="text-xs text-muted-foreground leading-relaxed">{skill.description}</p>
                          </div>
                        </div>
                      )) : (
                        <div className="text-center p-8 text-muted-foreground font-serif tracking-widest text-sm">No passive skills. Equip armor to gain resilience.</div>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="trees" className="flex-1 min-h-0 mt-6">
           <Card className="border-border/50 bg-card/80 backdrop-blur h-full flex flex-col">
            <CardContent className="p-0 flex-1">
               {isLoadingTrees ? (
                 <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
               ) : (
                 <ScrollArea className="h-full">
                    <div className="p-6 space-y-8">
                       {/* Class skills */}
                       <section>
                         <div className="flex items-center gap-2 mb-4">
                           <Sparkles className="w-5 h-5 text-primary" />
                           <h2 className="font-serif text-xl uppercase tracking-widest text-primary">
                             {classSkills?.name ?? activeChar.class} Skills
                           </h2>
                         </div>
                         {classSkills?.skills?.length ? (
                           <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                             {classSkills.skills.map((sk) => <ClassSkillCard key={sk.id} skill={sk} />)}
                           </div>
                         ) : (
                           <div className="text-muted-foreground italic font-serif text-sm">No class skills recorded for this discipline.</div>
                         )}
                       </section>

                       {/* Equipped weapon skills */}
                       <section>
                         <div className="flex items-center gap-2 mb-4">
                           <Swords className="w-5 h-5 text-secondary" />
                           <h2 className="font-serif text-xl uppercase tracking-widest text-secondary">
                             {weaponType ? `${weaponType.name} Skills` : "Weapon Skills"}
                           </h2>
                         </div>
                         {weaponSlots.length ? (
                           <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                             {weaponSlots.map((slot) => <WeaponSlotBlock key={slot.type} slot={slot} />)}
                           </div>
                         ) : (
                           <div className="text-muted-foreground italic font-serif text-sm">Equip a weapon to channel its mastery.</div>
                         )}
                       </section>

                       {/* Class weapon mastery trees */}
                       {classWeaponTypes.length > 0 && (
                         <section>
                           <div className="flex items-center gap-2 mb-4">
                             <Book className="w-5 h-5 text-muted-foreground" />
                             <h2 className="font-serif text-xl uppercase tracking-widest text-muted-foreground">Available Masteries</h2>
                           </div>
                           <div className="flex flex-wrap gap-2">
                             {classWeaponTypes.map((wt) => (
                               <span
                                 key={wt.id}
                                 className={`text-[11px] font-serif tracking-widest uppercase px-3 py-1.5 rounded border ${
                                   weaponType?.id === wt.id
                                     ? "border-primary text-primary bg-primary/10"
                                     : "border-border/50 text-muted-foreground bg-background/40"
                                 }`}
                               >
                                 {wt.name}
                               </span>
                             ))}
                           </div>
                         </section>
                       )}
                    </div>
                 </ScrollArea>
               )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
