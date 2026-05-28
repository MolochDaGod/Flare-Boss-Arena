import React, { useState } from "react";
import { useGetEnemies } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Shield } from "lucide-react";

const R2_BASE = "https://pub-e7fcf1fd4c9946ecb84b3766bbc7b50d.r2.dev";

const TIER_COLORS: Record<number, { bg: string; text: string; label: string }> = {
  1: { bg: "bg-gray-500/20", text: "text-gray-400", label: "Common" },
  2: { bg: "bg-green-900/30", text: "text-green-400", label: "Uncommon" },
  3: { bg: "bg-blue-900/30", text: "text-blue-400", label: "Rare" },
  4: { bg: "bg-purple-900/30", text: "text-purple-400", label: "Epic" },
  5: { bg: "bg-yellow-900/30", text: "text-amber-400", label: "Legendary" },
  6: { bg: "bg-orange-900/30", text: "text-orange-400", label: "Mythic" },
  7: { bg: "bg-red-900/30", text: "text-red-400", label: "Ancient" },
  8: { bg: "bg-rose-900/30", text: "text-rose-300", label: "Godly" },
};

interface EnemyItem {
  id: string;
  name: string;
  tier: number;
  type: string;
  zone: string;
  hp: number;
  damage: number;
  emoji: string;
  abilities: string[];
  drops: string[];
  spriteFolder?: string;
  catName: string;
  catEmoji: string;
}

function flattenEnemies(data: unknown): EnemyItem[] {
  if (!data || typeof data !== "object") return [];
  const d = data as Record<string, unknown>;
  const categories = d.categories as Record<string, { name: string; emoji: string; items?: unknown[] }> | undefined;
  if (!categories) return [];

  const all: EnemyItem[] = [];
  for (const [, cat] of Object.entries(categories)) {
    for (const raw of cat.items ?? []) {
      const e = raw as Record<string, unknown>;
      const spriteData = e.spriteData as Record<string, unknown> | undefined;
      all.push({
        id: String(e.id ?? ""),
        name: String(e.name ?? e.id ?? "Unknown"),
        tier: Number(e.tier ?? 1),
        type: String(e.type ?? ""),
        zone: String(e.zone ?? "Unknown Zone"),
        hp: Number(e.hp ?? 0),
        damage: Number(e.damage ?? 0),
        emoji: String(e.emoji ?? "👾"),
        abilities: (e.abilities as string[]) ?? [],
        drops: (e.drops as string[]) ?? [],
        spriteFolder: spriteData ? String(spriteData.folder ?? "") : undefined,
        catName: cat.name ?? "",
        catEmoji: cat.emoji ?? "",
      });
    }
  }
  return all;
}

export default function Enemies() {
  const { data: enemiesData, isLoading } = useGetEnemies();
  const [selectedCat, setSelectedCat] = useState<string>("All");
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const allEnemies = flattenEnemies(enemiesData);

  const categories = ["All", ...Array.from(new Set(allEnemies.map((e) => e.catName))).filter(Boolean)];

  const displayed = selectedCat === "All" ? allEnemies : allEnemies.filter((e) => e.catName === selectedCat);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 h-full flex flex-col">
      <div className="shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-serif text-primary uppercase tracking-widest">Bestiary</h1>
          <p className="text-muted-foreground font-serif tracking-widest text-sm mt-2">
            Know thy enemy — {allEnemies.length} creatures catalogued
          </p>
        </div>
      </div>

      {/* Category filter */}
      <div className="shrink-0 flex flex-wrap gap-2">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCat(cat)}
            className={`px-3 py-1 rounded font-serif text-xs tracking-widest uppercase border transition-all ${
              selectedCat === cat
                ? "border-primary bg-primary/10 text-primary"
                : "border-border/40 text-muted-foreground hover:border-primary/40 hover:text-primary/70"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <Card className="flex-1 border-border/50 bg-card/80 backdrop-blur flex flex-col min-h-0">
        <CardContent className="p-0 flex-1 min-h-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : displayed.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-muted-foreground font-serif tracking-widest">
              No enemies found.
            </div>
          ) : (
            <ScrollArea className="h-[calc(100vh-280px)] p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {displayed.map((enemy) => {
                  const tier = TIER_COLORS[enemy.tier] ?? TIER_COLORS[1];
                  const spriteUrl = enemy.spriteFolder
                    ? `${R2_BASE}/${enemy.spriteFolder}/idle.png`
                    : null;

                  return (
                    <Card
                      key={enemy.id}
                      className={`border-border/40 bg-background/50 hover:border-primary/30 transition-all duration-200 overflow-hidden flex flex-col cursor-default ${
                        hoveredId === enemy.id ? "shadow-[0_0_20px_-8px_rgba(255,165,0,0.4)]" : ""
                      }`}
                      onMouseEnter={() => setHoveredId(enemy.id)}
                      onMouseLeave={() => setHoveredId(null)}
                    >
                      {/* Sprite preview */}
                      <div className="h-28 bg-gradient-to-b from-black/40 to-background/80 border-b border-border/40 flex items-center justify-center p-3 relative overflow-hidden">
                        <div className="absolute inset-0 opacity-5 bg-[radial-gradient(ellipse_at_center,_#ffffff_0%,_transparent_70%)]" />
                        {spriteUrl ? (
                          <img
                            src={spriteUrl}
                            alt={enemy.name}
                            className="max-h-full max-w-full object-contain drop-shadow-[0_0_8px_rgba(255,100,0,0.4)] z-10 pixelated"
                            style={{ imageRendering: "pixelated" }}
                            onError={(e) => {
                              const t = e.currentTarget;
                              t.style.display = "none";
                              const fb = t.nextElementSibling as HTMLElement;
                              if (fb) fb.style.display = "flex";
                            }}
                          />
                        ) : null}
                        <div
                          className="text-4xl z-10 flex items-center justify-center"
                          style={{ display: spriteUrl ? "none" : "flex" }}
                        >
                          {enemy.emoji}
                        </div>

                        {/* Tier badge */}
                        <div className={`absolute top-2 right-2 px-1.5 py-0.5 rounded text-[9px] font-mono uppercase ${tier.bg} ${tier.text} border border-current/20`}>
                          T{enemy.tier}
                        </div>
                      </div>

                      <div className="p-3 flex-1 flex flex-col gap-2">
                        <div>
                          <h3 className="font-serif text-sm tracking-wide text-foreground uppercase leading-tight">{enemy.name}</h3>
                          <p className="text-[10px] text-muted-foreground mt-0.5 font-serif tracking-widest">{enemy.catName} · {enemy.zone}</p>
                        </div>

                        {/* Stats */}
                        <div className="grid grid-cols-2 gap-1 mt-1">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-serif tracking-widest uppercase text-muted-foreground">HP</span>
                            <span className="text-[10px] font-mono text-red-400">{enemy.hp}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-serif tracking-widest uppercase text-muted-foreground">DMG</span>
                            <span className="text-[10px] font-mono text-primary">{enemy.damage}</span>
                          </div>
                        </div>

                        {/* Abilities */}
                        {enemy.abilities.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {enemy.abilities.slice(0, 3).map((ab) => (
                              <span key={ab} className="text-[9px] px-1.5 py-0.5 rounded bg-muted/40 border border-border/30 text-muted-foreground font-mono uppercase tracking-wide">
                                {ab}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Drops */}
                        {enemy.drops.length > 0 && (
                          <div className="mt-auto pt-2 border-t border-border/20">
                            <p className="text-[9px] font-serif tracking-widest uppercase text-muted-foreground/60 mb-1">Drops</p>
                            <p className="text-[10px] text-muted-foreground font-serif italic truncate">
                              {enemy.drops.slice(0, 2).join(", ")}
                              {enemy.drops.length > 2 ? ` +${enemy.drops.length - 2}` : ""}
                            </p>
                          </div>
                        )}
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
  );
}
