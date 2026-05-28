import React, { useState } from "react";
import { useLocation } from "wouter";
import { useCreateCharacter, useGetClasses, useGetRaces } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sword, Loader2, Sparkles, Shield, Wand2, Target } from "lucide-react";
import { toast } from "sonner";

export default function CharacterNew() {
  const [, setLocation] = useLocation();
  const [name, setName] = useState("");
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [selectedRace, setSelectedRace] = useState<string>("");

  const { data: classesData, isLoading: isLoadingClasses } = useGetClasses();
  const { data: racesData, isLoading: isLoadingRaces } = useGetRaces();
  
  const createCharacter = useCreateCharacter({
    mutation: {
      onSuccess: () => {
        toast.success("Warlord forged in blood.");
        setLocation("/");
      },
      onError: (err) => {
        toast.error("Failed to forge warlord. " + (err as any)?.message);
      }
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !selectedClass || !selectedRace) {
      toast.error("All fields are required to forge a warlord.");
      return;
    }
    createCharacter.mutate({
      data: {
        name,
        class: selectedClass,
        race: selectedRace
      }
    });
  };

  const classIcons: Record<string, React.ReactNode> = {
    "Warrior": <Sword className="w-5 h-5" />,
    "Mage": <Wand2 className="w-5 h-5" />,
    "Ranger": <Target className="w-5 h-5" />,
    "Worge": <Shield className="w-5 h-5" />
  };

  const classes = classesData ? Object.entries(classesData).map(([k, v]) => ({ id: k, ...(v as any) })) : [];
  const races = racesData ? Object.entries(racesData).map(([k, v]) => ({ id: k, ...(v as any) })) : [];

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500 pt-8">
      <div className="text-center space-y-2 mb-8">
        <h1 className="text-4xl font-serif text-primary uppercase tracking-widest">The Soul Forge</h1>
        <p className="text-muted-foreground font-serif tracking-widest text-sm">Mold your identity from ash and ember</p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <Card className="border-border/50 bg-card/80 backdrop-blur">
              <CardHeader>
                <CardTitle className="font-serif tracking-widest uppercase text-lg">Name</CardTitle>
              </CardHeader>
              <CardContent>
                <Input 
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Enter Warlord Name"
                  className="font-serif text-lg tracking-wider bg-background/50 border-primary/20 focus-visible:ring-primary h-14"
                />
              </CardContent>
            </Card>

            <Card className="border-border/50 bg-card/80 backdrop-blur">
              <CardHeader>
                <CardTitle className="font-serif tracking-widest uppercase text-lg">Class</CardTitle>
                <CardDescription className="font-serif tracking-wide">Defines your martial discipline</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingClasses ? (
                  <div className="flex justify-center p-4"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
                ) : (
                  <RadioGroup value={selectedClass} onValueChange={setSelectedClass} className="grid grid-cols-1 gap-4">
                    {classes.map((cls) => (
                      <Label
                        key={cls.id}
                        className={`flex items-start p-4 border rounded-md cursor-pointer transition-colors ${selectedClass === cls.id ? 'border-primary bg-primary/10' : 'border-border/50 hover:border-primary/50 bg-background/50'}`}
                      >
                        <RadioGroupItem value={cls.id} className="sr-only" />
                        <div className="flex gap-4 w-full">
                          <div className={`p-2 rounded bg-muted/50 border border-border/50 ${selectedClass === cls.id ? 'text-primary' : 'text-muted-foreground'}`}>
                            {classIcons[cls.id] || <Sparkles className="w-5 h-5" />}
                          </div>
                          <div className="flex-1 space-y-1">
                            <p className="font-serif font-bold tracking-widest uppercase text-foreground">{cls.id}</p>
                            <p className="text-xs text-muted-foreground">{cls.description || "A martial discipline of the old world."}</p>
                          </div>
                        </div>
                      </Label>
                    ))}
                  </RadioGroup>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="border-border/50 bg-card/80 backdrop-blur h-full flex flex-col">
              <CardHeader>
                <CardTitle className="font-serif tracking-widest uppercase text-lg">Race</CardTitle>
                <CardDescription className="font-serif tracking-wide">Your bloodline and heritage</CardDescription>
              </CardHeader>
              <CardContent className="flex-1">
                <ScrollArea className="h-[400px] pr-4">
                  {isLoadingRaces ? (
                     <div className="flex justify-center p-4"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
                  ) : (
                    <RadioGroup value={selectedRace} onValueChange={setSelectedRace} className="grid grid-cols-1 gap-4">
                      {races.map((race) => (
                        <Label
                          key={race.id}
                          className={`flex items-start p-4 border rounded-md cursor-pointer transition-colors ${selectedRace === race.id ? 'border-secondary bg-secondary/10' : 'border-border/50 hover:border-secondary/50 bg-background/50'}`}
                        >
                          <RadioGroupItem value={race.id} className="sr-only" />
                          <div className="space-y-2 w-full">
                            <div className="flex justify-between items-center">
                              <p className="font-serif font-bold tracking-widest uppercase text-foreground">{race.id}</p>
                              {selectedRace === race.id && <div className="w-2 h-2 rounded-full bg-secondary shadow-[0_0_10px_2px_rgba(204,0,0,0.5)]" />}
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed">{race.lore || "An ancient bloodline of the Grudge universe."}</p>
                            {race.bonuses && (
                              <div className="pt-2 flex flex-wrap gap-2">
                                {Object.entries(race.bonuses).map(([stat, val]) => (
                                  <span key={stat} className="text-[10px] font-mono px-2 py-0.5 rounded bg-muted/50 border border-border/50 text-muted-foreground uppercase">
                                    {stat} <span className="text-secondary">+{String(val)}</span>
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </Label>
                      ))}
                    </RadioGroup>
                  )}
                </ScrollArea>
              </CardContent>
              <CardFooter className="pt-6 border-t border-border/50">
                <Button 
                  type="submit" 
                  disabled={createCharacter.isPending} 
                  className="w-full h-14 font-serif text-lg tracking-widest uppercase bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {createCharacter.isPending ? <Loader2 className="w-6 h-6 animate-spin" /> : "Step into the Forge"}
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      </form>
    </div>
  );
}
