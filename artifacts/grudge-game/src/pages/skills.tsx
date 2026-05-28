import React from "react";
import { useListCharacters, useGetCharacterSkills, useGetSkillTrees } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Book, Flame, Shield, Loader2 } from "lucide-react";

export default function Skills() {
  const { data: characters } = useListCharacters();
  const activeChar = characters?.[0];

  const { data: skills, isLoading: isLoadingSkills } = useGetCharacterSkills(activeChar?.id ?? 0, {
    query: { enabled: !!activeChar?.id, queryKey: ["skills", activeChar?.id] }
  });

  const { data: skillTrees, isLoading: isLoadingTrees } = useGetSkillTrees();

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
                    <div className="p-8">
                       <h2 className="font-serif text-2xl mb-6 text-muted-foreground uppercase tracking-widest text-center">Ancient Knowledge</h2>
                       <div className="text-center text-muted-foreground italic font-serif">Skill tree progression is sealed in this era.</div>
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
