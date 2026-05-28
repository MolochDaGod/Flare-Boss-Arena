import React, { useState } from "react";
import { useListCharacters, useGetWeapons, useGetArmor, useEquipItem } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Sword, Shield as ShieldIcon } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export default function Equipment() {
  const queryClient = useQueryClient();
  const { data: characters } = useListCharacters();
  const activeChar = characters?.[0];

  const { data: weaponsData, isLoading: isLoadingWeapons } = useGetWeapons();
  const { data: armorData, isLoading: isLoadingArmor } = useGetArmor();
  
  const equipItem = useEquipItem({
    mutation: {
      onSuccess: () => {
        toast.success("Equipment bound to soul.");
        if (activeChar?.id) {
          queryClient.invalidateQueries({ queryKey: ["/api/characters"] });
          queryClient.invalidateQueries({ queryKey: ["/api/characters", activeChar.id] });
          queryClient.invalidateQueries({ queryKey: ["skills", activeChar.id] });
        }
      },
      onError: (err) => {
        toast.error("Failed to equip item.");
      }
    }
  });

  const [activeSlot, setActiveSlot] = useState<string>("mainHand");

  const slots = [
    { id: "mainHand", label: "Main Hand", type: "weapon" },
    { id: "offHand", label: "Off Hand", type: "weapon" },
    { id: "helm", label: "Helm", type: "armor" },
    { id: "chest", label: "Chest", type: "armor" },
    { id: "legs", label: "Legs", type: "armor" },
    { id: "boots", label: "Boots", type: "armor" },
    { id: "gloves", label: "Gloves", type: "armor" },
    { id: "ring1", label: "Ring 1", type: "armor" },
    { id: "ring2", label: "Ring 2", type: "armor" },
    { id: "amulet", label: "Amulet", type: "armor" }
  ];

  const handleEquip = (itemId: string) => {
    if (!activeChar) return;
    equipItem.mutate({
      id: activeChar.id,
      data: {
        slot: activeSlot,
        itemId
      }
    });
  };

  const handleUnequip = () => {
    if (!activeChar) return;
    equipItem.mutate({
      id: activeChar.id,
      data: {
        slot: activeSlot,
        itemId: null
      }
    });
  };

  const currentSlotType = slots.find(s => s.id === activeSlot)?.type;
  
  const itemsList = currentSlotType === "weapon" 
    ? (weaponsData ? Object.entries(weaponsData).map(([k, v]) => ({ id: k, ...(v as any) })) : [])
    : (armorData ? Object.entries(armorData).map(([k, v]) => ({ id: k, ...(v as any) })) : []);

  if (!activeChar) {
    return <div className="p-8 text-center font-serif text-muted-foreground tracking-widest">No character selected. Forge a warlord first.</div>;
  }

  const equippedItemId = (activeChar.equipment as any)?.[activeSlot];

  return (
    <div className="space-y-6 animate-in fade-in duration-500 h-full flex flex-col">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-4xl font-serif text-primary uppercase tracking-widest">Armory</h1>
          <p className="text-muted-foreground font-serif tracking-widest text-sm mt-2">Equipment dictates identity</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1 min-h-0">
        <div className="lg:col-span-1 space-y-4 flex flex-col min-h-0">
          <Card className="border-border/50 bg-card/80 backdrop-blur flex-1 flex flex-col min-h-0">
            <CardHeader className="pb-3 border-b border-border/50 shrink-0">
              <CardTitle className="font-serif tracking-widest uppercase text-sm text-muted-foreground">Loadout</CardTitle>
            </CardHeader>
            <CardContent className="p-2 flex-1 overflow-y-auto">
              <div className="flex flex-col gap-2">
                {slots.map(slot => {
                  const isEquipped = (activeChar.equipment as any)?.[slot.id];
                  const isActive = activeSlot === slot.id;
                  return (
                    <button
                      key={slot.id}
                      onClick={() => setActiveSlot(slot.id)}
                      className={`flex items-center gap-3 p-3 rounded text-left transition-all border ${
                        isActive 
                          ? 'border-primary bg-primary/10 shadow-[inset_0_0_20px_rgba(255,165,0,0.1)]' 
                          : 'border-transparent hover:bg-muted/50 hover:border-border/50'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded flex items-center justify-center shrink-0 border ${
                        isEquipped ? 'bg-background border-primary/50' : 'bg-muted/30 border-dashed border-muted-foreground/30'
                      }`}>
                        {slot.type === "weapon" ? <Sword className={`w-5 h-5 ${isEquipped ? 'text-primary' : 'text-muted-foreground/50'}`} /> : <ShieldIcon className={`w-5 h-5 ${isEquipped ? 'text-primary' : 'text-muted-foreground/50'}`} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-serif tracking-widest uppercase ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>{slot.label}</p>
                        <p className="text-sm font-serif truncate text-foreground mt-0.5">{isEquipped || "Empty"}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-3 flex flex-col min-h-0">
          <Card className="border-border/50 bg-card/80 backdrop-blur flex-1 flex flex-col min-h-0">
            <CardHeader className="pb-3 border-b border-border/50 shrink-0 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="font-serif tracking-widest uppercase text-lg text-primary">{slots.find(s => s.id === activeSlot)?.label} Inventory</CardTitle>
                <p className="text-xs text-muted-foreground font-serif tracking-wide mt-1">Select an item to bind it to your soul</p>
              </div>
              {equippedItemId && (
                <Button variant="outline" size="sm" onClick={handleUnequip} disabled={equipItem.isPending} className="border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive font-serif tracking-widest uppercase text-xs">
                  Unequip
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0 flex-1 min-h-0 relative">
              {(isLoadingWeapons || isLoadingArmor) ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : (
                <ScrollArea className="h-[calc(100vh-280px)] p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {itemsList.map(item => {
                      const isEquippedHere = equippedItemId === item.id;
                      return (
                        <Card 
                          key={item.id} 
                          className={`cursor-pointer transition-all border overflow-hidden flex flex-col ${
                            isEquippedHere 
                              ? 'border-primary bg-primary/5 shadow-[0_0_15px_rgba(255,165,0,0.15)] ring-1 ring-primary' 
                              : 'border-border/50 bg-background/50 hover:border-primary/50 hover:bg-muted/30'
                          }`}
                          onClick={() => handleEquip(item.id)}
                        >
                          <div className="h-24 bg-muted/30 flex items-center justify-center p-4 border-b border-border/50">
                            {item.icon ? (
                              <img src={`https://pub-e7fcf1fd4c9946ecb84b3766bbc7b50d.r2.dev/icons/pack/${slotTypePath(currentSlotType)}/${item.icon}`} alt={item.name} className="max-h-full object-contain filter drop-shadow-md" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                            ) : (
                              currentSlotType === "weapon" ? <Sword className="w-8 h-8 text-muted-foreground/30" /> : <ShieldIcon className="w-8 h-8 text-muted-foreground/30" />
                            )}
                          </div>
                          <div className="p-3 flex-1 flex flex-col">
                            <h3 className="font-serif text-sm tracking-wide truncate" title={item.name}>{item.name}</h3>
                            <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-widest">{item.type || item.category || 'Unknown'}</p>
                            
                            <div className="mt-3 pt-3 border-t border-border/30 flex-1">
                              {item.stats ? (
                                <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                                  {Object.entries(item.stats).slice(0, 4).map(([stat, val]) => (
                                    <div key={stat} className="text-[10px] flex justify-between">
                                      <span className="text-muted-foreground uppercase">{stat.slice(0,3)}</span>
                                      <span className="font-mono text-primary">{String(val)}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-[10px] text-muted-foreground italic">No stats available.</p>
                              )}
                            </div>
                            
                            <div className="mt-3 pt-3">
                              <Button 
                                variant={isEquippedHere ? "default" : "secondary"} 
                                size="sm" 
                                className="w-full text-xs h-8 font-serif tracking-widest uppercase"
                                disabled={isEquippedHere || equipItem.isPending}
                              >
                                {isEquippedHere ? "Equipped" : "Equip"}
                              </Button>
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function slotTypePath(type?: string) {
  return type === "weapon" ? "weapons" : "armor";
}
