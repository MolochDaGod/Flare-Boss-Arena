import { useState } from "react";
import { useLocation } from "wouter";
import { useCreateCharacter } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sword, Loader2, Sparkles, Shield, Wand2, Target } from "lucide-react";
import { toast } from "sonner";

const FACTIONS = {
  crusade: { name: "Crusade", color: "#c9873b", bg: "bg-amber-950/30", border: "border-amber-600/40", text: "text-amber-400", badge: "bg-amber-900/40 text-amber-300 border-amber-700/50" },
  fabled:  { name: "Fabled",  color: "#4ade80", bg: "bg-emerald-950/30", border: "border-emerald-600/40", text: "text-emerald-400", badge: "bg-emerald-900/40 text-emerald-300 border-emerald-700/50" },
  legion:  { name: "Legion",  color: "#ef4444", bg: "bg-red-950/30", border: "border-red-700/40", text: "text-red-400", badge: "bg-red-900/40 text-red-300 border-red-800/50" },
};

const RACES = [
  {
    id: "human", name: "Human", faction: "crusade" as const,
    description: "Versatile and adaptable — masters of none, capable of all.",
    lore: "The most numerous of the Grudge War survivors, Humans thrive through sheer adaptability. Where other races rely on innate gifts, Humans forge their destiny through will and cunning.",
    bonuses: { Strength: 1, Intellect: 1, Vitality: 1, Dexterity: 1, Endurance: 1, Wisdom: 1, Agility: 1, Tactics: 1 },
    trait: "Adaptable",
  },
  {
    id: "barbarian", name: "Barbarian", faction: "crusade" as const,
    description: "Untamed fury given form — raw power and relentless aggression.",
    lore: "From the frozen steppes and scorched badlands, Barbarians reject civilization and embrace primal rage. Their ferocity in battle terrifies even hardened soldiers.",
    bonuses: { Strength: 3, Vitality: 1, Endurance: 1, Dexterity: 0, Agility: 2, Intellect: 0, Wisdom: 0, Tactics: 1 },
    trait: "Berserker Rage",
  },
  {
    id: "dwarf", name: "Dwarf", faction: "fabled" as const,
    description: "Stout mountain folk — unyielding defense and masterful craftsmanship.",
    lore: "Deep beneath the mountains, the Dwarves forged their kingdoms in stone and iron. Generations of mining and warfare have made them nearly unbreakable.",
    bonuses: { Strength: 1, Vitality: 2, Endurance: 3, Dexterity: 1, Agility: 0, Intellect: 0, Wisdom: 1, Tactics: 0 },
    trait: "Stoneborn",
  },
  {
    id: "elf", name: "Elf", faction: "fabled" as const,
    description: "Ancient and graceful — wielders of arcane arts and deadly precision.",
    lore: "The Elves walked this world before the first grudge was spoken. Their mastery of magic and movement is unrivaled, though their arrogance has earned them many enemies.",
    bonuses: { Strength: 0, Vitality: 0, Endurance: 0, Dexterity: 2, Agility: 2, Intellect: 3, Wisdom: 1, Tactics: 0 },
    trait: "Arcane Affinity",
  },
  {
    id: "orc", name: "Orc", faction: "legion" as const,
    description: "Savage brutes bred for war — crushing power and iron will.",
    lore: "Born in the blood pits of the Shattered Wastes, Orcs know nothing but battle. Their bones are dense as stone, their muscles forged by a lifetime of brutality.",
    bonuses: { Strength: 4, Vitality: 2, Endurance: 2, Dexterity: 0, Agility: 0, Intellect: 0, Wisdom: 0, Tactics: 0 },
    trait: "Bloodrage",
  },
  {
    id: "undead", name: "Undead", faction: "legion" as const,
    description: "Death-touched revenants fueled by dark energy and grudges unresolved.",
    lore: "Neither alive nor truly dead, the Undead are sustained by the grudges that bind them to this world. Their rotting flesh hides an unbreakable will and dark power.",
    bonuses: { Strength: 1, Vitality: 3, Endurance: 2, Dexterity: 0, Agility: 0, Intellect: 0, Wisdom: 2, Tactics: 0 },
    trait: "Undying Will",
  },
];

const CLASSES = [
  { id: "warrior", name: "Warrior", icon: Sword, color: "#ef4444", description: "A fearless frontline fighter specializing in raw power and defense.", lore: "Forged in the crucible of the Grudge Wars, Warriors are the backbone of any warband." },
  { id: "mage", name: "Mage Priest", icon: Wand2, color: "#8b5cf6", description: "Master of arcane magic and divine healing arts.", lore: "Drawing power from ancient ley lines and forgotten gods, Mage Priests wield both destruction and healing." },
  { id: "ranger", name: "Ranger", icon: Target, color: "#22c55e", description: "A deadly marksman with precise long-range attacks.", lore: "Silent and patient, Rangers strike from the shadows with lethal precision." },
  { id: "worge", name: "Worge", icon: Shield, color: "#d97706", description: "A shapeshifter wielding nature and storm magic, then transforming into a devastating beast.", lore: "Worges walk between worlds — scholars of storm in mortal guise, unstoppable predators in beast form." },
];

const FACTION_GROUPS = [
  { factionId: "crusade" as const, races: ["human", "barbarian"] },
  { factionId: "fabled" as const,  races: ["dwarf", "elf"] },
  { factionId: "legion" as const,  races: ["orc", "undead"] },
];

export default function CharacterNew() {
  const [, setLocation] = useLocation();
  const [name, setName] = useState("");
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [selectedRace, setSelectedRace] = useState<string>("");

  const createCharacter = useCreateCharacter({
    mutation: {
      onSuccess: () => {
        toast.success("Warlord forged in blood.");
        setLocation("/");
      },
      onError: (err) => {
        toast.error("Failed to forge warlord. " + (err as { message?: string })?.message);
      }
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !selectedClass || !selectedRace) {
      toast.error("All fields are required to forge a warlord.");
      return;
    }
    createCharacter.mutate({ data: { name: name.trim(), class: selectedClass, race: selectedRace } });
  };

  const selectedRaceData = RACES.find(r => r.id === selectedRace);
  const selectedClassData = CLASSES.find(c => c.id === selectedClass);

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500 pt-8 pb-16">
      <div className="text-center space-y-2 mb-10">
        <h1 className="text-4xl font-serif text-primary uppercase tracking-widest">The Soul Forge</h1>
        <p className="text-muted-foreground font-serif tracking-widest text-sm">Mold your identity from ash and ember</p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left column: name + class */}
          <div className="space-y-6">
            <Card className="border-border/50 bg-card/80 backdrop-blur">
              <CardHeader className="pb-3">
                <CardTitle className="font-serif tracking-widest uppercase text-base">Warlord Name</CardTitle>
              </CardHeader>
              <CardContent>
                <Input
                  data-testid="input-character-name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Enter name..."
                  className="font-serif text-base tracking-wider bg-background/50 border-primary/20 focus-visible:ring-primary h-12"
                />
              </CardContent>
            </Card>

            <Card className="border-border/50 bg-card/80 backdrop-blur">
              <CardHeader className="pb-3">
                <CardTitle className="font-serif tracking-widest uppercase text-base">Class</CardTitle>
                <CardDescription className="font-serif tracking-wide text-xs">Defines your martial discipline</CardDescription>
              </CardHeader>
              <CardContent>
                <RadioGroup value={selectedClass} onValueChange={setSelectedClass} className="space-y-2">
                  {CLASSES.map((cls) => {
                    const Icon = cls.icon;
                    const active = selectedClass === cls.id;
                    return (
                      <Label
                        key={cls.id}
                        data-testid={`class-option-${cls.id}`}
                        className={`flex items-start p-3 border rounded-md cursor-pointer transition-all ${active ? 'border-primary bg-primary/10 shadow-[0_0_12px_-4px_rgba(255,170,0,0.3)]' : 'border-border/50 hover:border-primary/40 bg-background/30'}`}
                      >
                        <RadioGroupItem value={cls.id} className="sr-only" />
                        <div className="flex gap-3 w-full">
                          <div className={`p-2 rounded border shrink-0 ${active ? 'border-primary/50 text-primary' : 'border-border/50 text-muted-foreground'}`} style={active ? { background: cls.color + '22' } : {}}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-serif font-bold tracking-widest uppercase text-sm" style={{ color: active ? cls.color : undefined }}>{cls.name}</p>
                            <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{cls.description}</p>
                          </div>
                        </div>
                      </Label>
                    );
                  })}
                </RadioGroup>
              </CardContent>
            </Card>
          </div>

          {/* Middle column: race picker by faction */}
          <div className="lg:col-span-2">
            <Card className="border-border/50 bg-card/80 backdrop-blur h-full flex flex-col">
              <CardHeader className="pb-3">
                <CardTitle className="font-serif tracking-widest uppercase text-base">Race & Faction</CardTitle>
                <CardDescription className="font-serif tracking-wide text-xs">Your bloodline and allegiance</CardDescription>
              </CardHeader>
              <CardContent className="flex-1">
                <ScrollArea className="h-[480px] pr-2">
                  <RadioGroup value={selectedRace} onValueChange={setSelectedRace} className="space-y-6">
                    {FACTION_GROUPS.map(({ factionId, races }) => {
                      const faction = FACTIONS[factionId];
                      const factionRaces = RACES.filter(r => races.includes(r.id));
                      return (
                        <div key={factionId}>
                          <div className="flex items-center gap-2 mb-3">
                            <div className="h-px flex-1 bg-border/30" />
                            <span className={`text-[10px] font-serif uppercase tracking-[0.2em] px-2 py-0.5 rounded border ${faction.badge}`}>
                              {faction.name}
                            </span>
                            <div className="h-px flex-1 bg-border/30" />
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {factionRaces.map((race) => {
                              const active = selectedRace === race.id;
                              const f = FACTIONS[race.faction];
                              const bonusEntries = Object.entries(race.bonuses).filter(([, v]) => v > 0);
                              return (
                                <Label
                                  key={race.id}
                                  data-testid={`race-option-${race.id}`}
                                  className={`flex flex-col p-4 border rounded-md cursor-pointer transition-all ${active ? `${f.border} ${f.bg}` : 'border-border/40 hover:border-border/70 bg-background/30'}`}
                                >
                                  <RadioGroupItem value={race.id} className="sr-only" />
                                  <div className="flex items-start justify-between mb-2">
                                    <div>
                                      <p className={`font-serif font-bold tracking-widest uppercase text-sm ${active ? f.text : 'text-foreground'}`}>{race.name}</p>
                                      <p className={`text-[10px] font-serif tracking-widest uppercase ${active ? f.text : 'text-muted-foreground'} opacity-70`}>{race.trait}</p>
                                    </div>
                                    {active && <div className={`w-2 h-2 rounded-full mt-1 shrink-0`} style={{ background: f.color, boxShadow: `0 0 8px 2px ${f.color}55` }} />}
                                  </div>
                                  <p className="text-[11px] text-muted-foreground leading-relaxed mb-3">{race.description}</p>
                                  <div className="flex flex-wrap gap-1.5 mt-auto">
                                    {bonusEntries.map(([stat, val]) => (
                                      <span key={stat} className={`text-[10px] font-mono px-1.5 py-0.5 rounded border uppercase ${active ? `${f.badge}` : 'border-border/40 text-muted-foreground bg-muted/30'}`}>
                                        {stat.slice(0,3)} <span className={active ? f.text : ''}>+{val}</span>
                                      </span>
                                    ))}
                                  </div>
                                </Label>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </RadioGroup>
                </ScrollArea>
              </CardContent>
              <CardFooter className="border-t border-border/50 pt-4 flex flex-col gap-3">
                {/* Summary */}
                {(selectedClassData || selectedRaceData) && (
                  <div className="w-full p-3 rounded border border-border/40 bg-background/40 flex items-center gap-4 text-xs font-serif">
                    {selectedClassData && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground uppercase tracking-widest">Class</span>
                        <span className="tracking-wide" style={{ color: selectedClassData.color }}>{selectedClassData.name}</span>
                      </div>
                    )}
                    {selectedClassData && selectedRaceData && <div className="text-muted-foreground/40">|</div>}
                    {selectedRaceData && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground uppercase tracking-widest">Race</span>
                        <span className={FACTIONS[selectedRaceData.faction].text + " tracking-wide"}>{selectedRaceData.name}</span>
                        <span className={`px-1.5 py-0.5 rounded border uppercase tracking-widest text-[9px] ${FACTIONS[selectedRaceData.faction].badge}`}>{FACTIONS[selectedRaceData.faction].name}</span>
                      </div>
                    )}
                    {name && (
                      <>
                        <div className="text-muted-foreground/40">|</div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-muted-foreground uppercase tracking-widest">Name</span>
                          <span className="text-primary tracking-wide">{name}</span>
                        </div>
                      </>
                    )}
                  </div>
                )}
                <Button
                  type="submit"
                  data-testid="button-submit-character"
                  disabled={createCharacter.isPending || !name.trim() || !selectedClass || !selectedRace}
                  className="w-full h-14 font-serif text-lg tracking-widest uppercase bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_20px_-5px_rgba(255,170,0,0.3)] disabled:opacity-40"
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
