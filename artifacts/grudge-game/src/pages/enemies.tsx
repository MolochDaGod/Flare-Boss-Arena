import React from "react";
import { useGetEnemies } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Shield } from "lucide-react";

export default function Enemies() {
  const { data: enemiesData, isLoading } = useGetEnemies();

  const enemies = enemiesData ? Object.entries(enemiesData).map(([k, v]) => ({ id: k, ...(v as any) })) : [];

  return (
    <div className="space-y-6 animate-in fade-in duration-500 h-full flex flex-col">
      <div className="shrink-0 text-center mb-4">
        <h1 className="text-4xl font-serif text-primary uppercase tracking-widest">Bestiary</h1>
        <p className="text-muted-foreground font-serif tracking-widest text-sm mt-2">Know thy enemy</p>
      </div>

      <Card className="flex-1 border-border/50 bg-card/80 backdrop-blur flex flex-col min-h-0">
        <CardContent className="p-0 flex-1">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <ScrollArea className="h-full p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {enemies.map(enemy => (
                  <Card key={enemy.id} className="border-border/50 bg-background/50 hover:border-primary/30 transition-colors overflow-hidden flex flex-col">
                    <div className="h-32 bg-muted/20 border-b border-border/50 flex items-center justify-center p-4 relative">
                       {/* Subtle dark gradient overlay behind sprite */}
                       <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent z-0" />
                       {enemy.sprite ? (
                          <img src={`https://pub-e7fcf1fd4c9946ecb84b3766bbc7b50d.r2.dev/${enemy.sprite}`} alt={enemy.name || enemy.id} className="max-h-full object-contain filter drop-shadow-lg z-10" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                       ) : (
                          <Shield className="w-10 h-10 text-muted-foreground/30 z-10" />
                       )}
                    </div>
                    <div className="p-4 flex-1 flex flex-col">
                      <h3 className="font-serif text-lg tracking-wide text-foreground uppercase">{enemy.name || enemy.id}</h3>
                      <p className="text-xs text-muted-foreground mt-1 mb-4 italic font-serif leading-relaxed">
                        {enemy.description || "A creature of the dark."}
                      </p>
                      
                      <div className="mt-auto space-y-2 pt-3 border-t border-border/30">
                        {enemy.hp && (
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-serif tracking-widest text-muted-foreground uppercase">Health</span>
                            <span className="font-mono text-destructive">{enemy.hp}</span>
                          </div>
                        )}
                        {enemy.damage && (
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-serif tracking-widest text-muted-foreground uppercase">Damage</span>
                            <span className="font-mono text-primary">{enemy.damage}</span>
                          </div>
                        )}
                         {enemy.zone && (
                          <div className="flex justify-between items-center text-xs pt-2 mt-2 border-t border-border/10">
                            <span className="font-serif tracking-widest text-muted-foreground uppercase">Zone</span>
                            <span className="font-serif text-muted-foreground">{enemy.zone}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
