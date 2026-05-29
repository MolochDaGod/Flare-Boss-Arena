import React, { useState, useMemo, useEffect } from "react";
import { useListCharacters, useGetWeapons, useGetArmor, useEquipItem } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Sword, Shield as ShieldIcon } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { categoryToWeaponType } from "@/data/skillsResolver";
import { fetchWeaponSkills, type WeaponSkillsData } from "@/game/weaponSkills";

const OBJECTSTORE = "https://molochdagod.github.io/ObjectStore";

// Weapon category → iconBase + iconMax
const WEAPON_CAT_ICONS: Record<string, { iconBase: string; iconMax: number }> = {
  swords:          { iconBase: "Sword",     iconMax: 40 },
  axes1h:          { iconBase: "Axe",       iconMax: 30 },
  daggers:         { iconBase: "Dagger",    iconMax: 30 },
  greatswords:     { iconBase: "Sword",     iconMax: 40 },
  greataxes:       { iconBase: "Axe",       iconMax: 30 },
  hammers1h:       { iconBase: "Hammer",    iconMax: 25 },
  hammers2h:       { iconBase: "Hammer",    iconMax: 30 },
  spears:          { iconBase: "Spear",     iconMax: 30 },
  bows:            { iconBase: "Bow",       iconMax: 30 },
  crossbows:       { iconBase: "Crossbow",  iconMax: 10 },
  guns:            { iconBase: "Bolt",      iconMax: 10 },
  fireStaves:      { iconBase: "staff",     iconMax: 60 },
  frostStaves:     { iconBase: "staff",     iconMax: 60 },
  holyStaves:      { iconBase: "staff",     iconMax: 60 },
  lightningStaves: { iconBase: "staff",     iconMax: 60 },
  arcaneStaves:    { iconBase: "staff",     iconMax: 60 },
  natureStaves:    { iconBase: "Staff",     iconMax: 4  },
  tools:           { iconBase: "Res",       iconMax: 50 },
  fireTomes:       { iconBase: "Book",      iconMax: 4  },
  frostTomes:      { iconBase: "Book",      iconMax: 4  },
  natureTomes:     { iconBase: "Book",      iconMax: 4  },
  holyTomes:       { iconBase: "Book",      iconMax: 4  },
  arcaneTomes:     { iconBase: "Book",      iconMax: 4  },
  lightningTomes:  { iconBase: "Book",      iconMax: 4  },
};

// Armor type (from item.type) → slot iconBase + maxIcons
const ARMOR_SLOT_ICONS: Record<string, { iconBase: string; maxIcons: number }> = {
  Helm:      { iconBase: "Helm_",     maxIcons: 40 },
  Shoulder:  { iconBase: "Shoulder_", maxIcons: 30 },
  Chest:     { iconBase: "Chest_",    maxIcons: 40 },
  Hands:     { iconBase: "Gloves_",   maxIcons: 30 },
  Feet:      { iconBase: "Boots_",    maxIcons: 40 },
  Ring:      { iconBase: "Ring_",     maxIcons: 30 },
  Necklace:  { iconBase: "necklace_", maxIcons: 20 },
  Relic:     { iconBase: "Relic_",    maxIcons: 30 },
  Back:      { iconBase: "Back_",     maxIcons: 30 },
};

// Game slot → armor item.type (for filtering)
const SLOT_TO_ARMOR_TYPE: Record<string, string> = {
  helm:   "Helm",
  chest:  "Chest",
  legs:   "Shoulder",
  boots:  "Feet",
  gloves: "Hands",
  ring1:  "Ring",
  ring2:  "Ring",
  amulet: "Necklace",
};

interface WeaponItem {
  id: string;
  name: string;
  emoji: string;
  lore: string;
  category: string;
  catKey: string;
  iconBase: string;
  iconMax: number;
  iconNum: number;
  stats: Record<string, number>;
}

interface ArmorItem {
  id: string;
  name: string;
  emoji: string;
  lore: string;
  type: string;
  material: string;
  iconBase: string;
  iconMax: number;
  iconNum: number;
  stats: Record<string, number>;
}

function flattenWeapons(data: unknown): WeaponItem[] {
  if (!data || typeof data !== "object") return [];
  const d = data as Record<string, unknown>;
  const categories = d.categories as Record<string, { iconBase?: string; iconMax?: number; items?: unknown[] }> | undefined;
  if (!categories) return [];

  const all: WeaponItem[] = [];
  for (const [catKey, cat] of Object.entries(categories)) {
    const catIcon = WEAPON_CAT_ICONS[catKey] ?? { iconBase: "Sword", iconMax: 40 };
    let i = 0;
    for (const raw of cat.items ?? []) {
      const w = raw as Record<string, unknown>;
      i++;
      const iconNum = ((i - 1) % catIcon.iconMax) + 1;
      all.push({
        id: String(w.id ?? ""),
        name: String(w.name ?? w.id ?? "Unknown"),
        emoji: String(w.emoji ?? "⚔️"),
        lore: String(w.lore ?? ""),
        category: String(w.category ?? catKey),
        catKey,
        iconBase: catIcon.iconBase,
        iconMax: catIcon.iconMax,
        iconNum,
        stats: (w.stats as Record<string, number>) ?? {},
      });
    }
  }
  return all;
}

function flattenArmor(data: unknown): ArmorItem[] {
  if (!data || typeof data !== "object") return [];
  const d = data as Record<string, unknown>;
  const materials = d.materials as Record<string, { items?: unknown[] }> | undefined;
  if (!materials) return [];

  const all: ArmorItem[] = [];
  for (const [, mat] of Object.entries(materials)) {
    let i = 0;
    for (const raw of mat.items ?? []) {
      const a = raw as Record<string, unknown>;
      i++;
      const itemType = String(a.type ?? "Helm");
      const slotIcon = ARMOR_SLOT_ICONS[itemType] ?? { iconBase: "Helm_", maxIcons: 40 };
      const iconNum = ((i - 1) % slotIcon.maxIcons) + 1;
      all.push({
        id: String(a.id ?? ""),
        name: String(a.name ?? a.id ?? "Unknown"),
        emoji: String(a.emoji ?? "🛡️"),
        lore: String(a.lore ?? ""),
        type: itemType,
        material: String(a.material ?? ""),
        iconBase: slotIcon.iconBase,
        iconMax: slotIcon.maxIcons,
        iconNum,
        stats: (a.stats as Record<string, number>) ?? {},
      });
    }
  }
  return all;
}

/** Names of the skills a weapon category grants (primary slot first). */
function weaponGrantedSkills(data: WeaponSkillsData | null, catKey: string): string[] {
  if (!data) return [];
  const key = categoryToWeaponType(catKey);
  if (!key) return [];
  const wt = data.weaponTypes?.[key];
  if (!wt) return [];
  const primary = wt.slots.find((s) => s.type === "primary") ?? wt.slots[0];
  return (primary?.skills ?? []).map((s) => s.name).slice(0, 3);
}

function weaponIconUrl(item: WeaponItem): string {
  return `${OBJECTSTORE}/icons/weapons_full/${item.iconBase}_${item.iconNum}.png`;
}

function armorIconUrl(item: ArmorItem): string {
  return `${OBJECTSTORE}/icons/armor_full/${item.iconBase}${item.iconNum}.png`;
}

const STAT_LABELS: Record<string, string> = {
  damageBase: "DMG", manaBase: "MANA", hpBase: "HP", critBase: "CRIT%",
  speedBase: "SPD", defenseBase: "DEF", blockBase: "BLOCK", comboBase: "COMBO",
};

function topStats(stats: Record<string, number>): Array<[string, number]> {
  return Object.entries(stats)
    .filter(([k]) => k.endsWith("Base") && STAT_LABELS[k])
    .slice(0, 4) as Array<[string, number]>;
}

const SLOTS = [
  { id: "mainHand", label: "Main Hand", type: "weapon" },
  { id: "offHand",  label: "Off Hand",  type: "weapon" },
  { id: "helm",     label: "Helm",      type: "armor"  },
  { id: "chest",    label: "Chest",     type: "armor"  },
  { id: "legs",     label: "Legs",      type: "armor"  },
  { id: "boots",    label: "Boots",     type: "armor"  },
  { id: "gloves",   label: "Gloves",    type: "armor"  },
  { id: "ring1",    label: "Ring 1",    type: "armor"  },
  { id: "ring2",    label: "Ring 2",    type: "armor"  },
  { id: "amulet",   label: "Amulet",    type: "armor"  },
];

export default function Equipment() {
  const queryClient = useQueryClient();
  const { data: characters } = useListCharacters();
  const activeChar = characters?.[0];

  const { data: weaponsData, isLoading: loadW } = useGetWeapons();
  const { data: armorData,   isLoading: loadA } = useGetArmor();

  const equipItem = useEquipItem({
    mutation: {
      onSuccess: () => {
        toast.success("Equipment bound to soul.");
        if (activeChar?.id) {
          queryClient.invalidateQueries({ queryKey: ["/api/characters"] });
        }
      },
      onError: () => toast.error("Failed to equip item."),
    },
  });

  const [activeSlot, setActiveSlot] = useState("mainHand");
  const [search, setSearch] = useState("");
  const [weaponSkills, setWeaponSkills] = useState<WeaponSkillsData | null>(null);

  useEffect(() => {
    let live = true;
    fetchWeaponSkills().then((d) => { if (live) setWeaponSkills(d); }).catch(() => {});
    return () => { live = false; };
  }, []);

  const allWeapons = useMemo(() => flattenWeapons(weaponsData), [weaponsData]);
  const allArmor   = useMemo(() => flattenArmor(armorData),    [armorData]);

  const currentSlot = SLOTS.find((s) => s.id === activeSlot)!;
  const isWeaponSlot = currentSlot?.type === "weapon";

  const filteredItems = useMemo(() => {
    const q = search.toLowerCase();
    if (isWeaponSlot) {
      return allWeapons.filter((w) => !q || w.name.toLowerCase().includes(q) || w.catKey.includes(q));
    }
    const armorType = SLOT_TO_ARMOR_TYPE[activeSlot];
    const base = armorType ? allArmor.filter((a) => a.type === armorType) : allArmor;
    return base.filter((a) => !q || a.name.toLowerCase().includes(q) || a.material.toLowerCase().includes(q));
  }, [isWeaponSlot, allWeapons, allArmor, activeSlot, search]);

  const handleEquip = (itemId: string) => {
    if (!activeChar) return;
    equipItem.mutate({ id: activeChar.id, data: { slot: activeSlot, itemId } });
  };

  const handleUnequip = () => {
    if (!activeChar) return;
    equipItem.mutate({ id: activeChar.id, data: { slot: activeSlot, itemId: null } });
  };

  if (!activeChar) {
    return (
      <div className="p-8 text-center font-serif text-muted-foreground tracking-widest">
        No character selected. Forge a warlord first.
      </div>
    );
  }

  const equippedItemId = (activeChar.equipment as Record<string, string>)?.[activeSlot];

  return (
    <div className="space-y-6 animate-in fade-in duration-500 h-full flex flex-col">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-4xl font-serif text-primary uppercase tracking-widest">Armory</h1>
          <p className="text-muted-foreground font-serif tracking-widest text-sm mt-2">
            {allWeapons.length} weapons · {allArmor.length} armor pieces
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1 min-h-0">
        {/* Loadout sidebar */}
        <div className="lg:col-span-1 flex flex-col min-h-0">
          <Card className="border-border/50 bg-card/80 backdrop-blur flex-1 flex flex-col min-h-0">
            <CardHeader className="pb-3 border-b border-border/50 shrink-0">
              <CardTitle className="font-serif tracking-widest uppercase text-sm text-muted-foreground">Loadout</CardTitle>
            </CardHeader>
            <CardContent className="p-2 flex-1 overflow-y-auto">
              <div className="flex flex-col gap-1">
                {SLOTS.map((slot) => {
                  const isEquipped = (activeChar.equipment as Record<string, string>)?.[slot.id];
                  const isActive = activeSlot === slot.id;
                  return (
                    <button
                      key={slot.id}
                      onClick={() => { setActiveSlot(slot.id); setSearch(""); }}
                      className={`flex items-center gap-3 p-2.5 rounded text-left transition-all border ${
                        isActive
                          ? "border-primary bg-primary/10 shadow-[inset_0_0_20px_rgba(255,165,0,0.1)]"
                          : "border-transparent hover:bg-muted/40 hover:border-border/40"
                      }`}
                    >
                      <div className={`w-9 h-9 rounded flex items-center justify-center shrink-0 border ${
                        isEquipped ? "bg-background border-primary/50" : "bg-muted/20 border-dashed border-muted-foreground/20"
                      }`}>
                        {slot.type === "weapon"
                          ? <Sword className={`w-4 h-4 ${isEquipped ? "text-primary" : "text-muted-foreground/40"}`} />
                          : <ShieldIcon className={`w-4 h-4 ${isEquipped ? "text-primary" : "text-muted-foreground/40"}`} />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-[11px] font-serif tracking-widest uppercase ${isActive ? "text-primary" : "text-muted-foreground"}`}>{slot.label}</p>
                        <p className="text-xs font-serif truncate text-foreground/80 mt-0.5">{isEquipped || "—"}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Item grid */}
        <div className="lg:col-span-3 flex flex-col min-h-0">
          <Card className="border-border/50 bg-card/80 backdrop-blur flex-1 flex flex-col min-h-0">
            <CardHeader className="pb-3 border-b border-border/50 shrink-0">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <CardTitle className="font-serif tracking-widest uppercase text-base text-primary">{currentSlot?.label} Inventory</CardTitle>
                  <p className="text-xs text-muted-foreground font-serif mt-0.5 tracking-wide">{filteredItems.length} items</p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Search..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-8 px-3 text-xs bg-background border border-border/50 rounded font-mono text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 w-36"
                  />
                  {equippedItemId && (
                    <Button
                      variant="outline" size="sm"
                      onClick={handleUnequip}
                      disabled={equipItem.isPending}
                      className="border-destructive/60 text-destructive hover:bg-destructive/10 font-serif tracking-widest uppercase text-[10px] h-8"
                    >
                      Unequip
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0 flex-1 min-h-0">
              {(loadW || loadA) ? (
                <div className="flex items-center justify-center h-48">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="flex items-center justify-center h-48 text-muted-foreground font-serif tracking-widest text-sm">
                  No items found.
                </div>
              ) : (
                <ScrollArea className="h-[calc(100vh-300px)] p-3">
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                    {filteredItems.map((item, idx) => {
                      const isEquippedHere = equippedItemId === item.id;
                      const iconUrl = isWeaponSlot
                        ? weaponIconUrl(item as WeaponItem)
                        : armorIconUrl(item as ArmorItem);
                      const stats = topStats(item.stats);
                      const grantedSkills = isWeaponSlot
                        ? weaponGrantedSkills(weaponSkills, (item as WeaponItem).catKey)
                        : [];

                      return (
                        <Card
                          key={item.id}
                          className={`cursor-pointer transition-all duration-150 border overflow-hidden flex flex-col ${
                            isEquippedHere
                              ? "border-primary bg-primary/8 shadow-[0_0_16px_-4px_rgba(255,165,0,0.4)] ring-1 ring-primary/60"
                              : "border-border/40 bg-background/40 hover:border-primary/40 hover:bg-muted/20"
                          }`}
                          onClick={() => handleEquip(item.id)}
                        >
                          {/* Icon */}
                          <div className="h-20 bg-gradient-to-b from-black/30 to-background/60 flex items-center justify-center p-3 border-b border-border/30 relative">
                            <img
                              src={iconUrl}
                              alt={item.name}
                              className="max-h-full max-w-full object-contain drop-shadow-md"
                              onError={(e) => {
                                const t = e.currentTarget;
                                t.style.display = "none";
                                const fb = t.nextElementSibling as HTMLElement;
                                if (fb) fb.style.display = "flex";
                              }}
                            />
                            <div className="hidden items-center justify-center text-2xl">{item.emoji}</div>
                            {isEquippedHere && (
                              <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-primary shadow-[0_0_4px_#ffaa00]" />
                            )}
                          </div>

                          {/* Info */}
                          <div className="p-2 flex-1 flex flex-col gap-1.5">
                            <h3 className="font-serif text-[11px] tracking-wide leading-tight text-foreground" title={item.name}>{item.name}</h3>
                            <p className="text-[9px] text-muted-foreground uppercase tracking-widest">
                              {"material" in item ? `${item.material} · ${item.type}` : (item as WeaponItem).catKey.replace(/([A-Z])/g, " $1")}
                            </p>

                            {stats.length > 0 && (
                              <div className="grid grid-cols-2 gap-x-1 gap-y-0.5 mt-auto">
                                {stats.map(([k, v]) => (
                                  <div key={k} className="flex justify-between items-center">
                                    <span className="text-[9px] text-muted-foreground uppercase">{STAT_LABELS[k] ?? k.slice(0,3)}</span>
                                    <span className="text-[9px] font-mono text-primary">{v}</span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {grantedSkills.length > 0 && (
                              <div className={`${stats.length > 0 ? "" : "mt-auto"} pt-1 border-t border-border/30`}>
                                <p className="text-[8px] text-muted-foreground/70 uppercase tracking-widest mb-0.5">Grants</p>
                                <div className="flex flex-wrap gap-0.5">
                                  {grantedSkills.map((sk) => (
                                    <span key={sk} className="text-[8px] font-serif text-secondary/90 px-1 py-0.5 rounded bg-secondary/10 border border-secondary/20 leading-none" title={sk}>
                                      {sk}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            <Button
                              variant={isEquippedHere ? "default" : "secondary"}
                              size="sm"
                              className="w-full h-6 text-[10px] font-serif tracking-widest uppercase mt-1"
                              disabled={isEquippedHere || equipItem.isPending}
                            >
                              {isEquippedHere ? "Equipped" : "Equip"}
                            </Button>
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
