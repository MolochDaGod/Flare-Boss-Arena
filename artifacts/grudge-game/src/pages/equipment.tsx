/**
 * Stone sockets — 8 attribute stones with rarity (common→legendary).
 */
import { useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/PageChrome";
import {
  ATTR_ORDER,
  type AttrKey,
} from "@/data/fighters";
import {
  STONE_META,
  RARITY_COLOR,
  RARITY_LABEL,
  getStoneStash,
  getStoneLoadout,
  getEquippedStones,
  getStoneCombatMods,
  equipStone,
  unequipStone,
  type AttributeStone,
} from "@/data/stones";
import { getGameLoadout } from "@/data/gameCombat";
import { getActiveFighter } from "@/data/fighters";
import { getEquipmentCombatMods } from "@/data/equipmentLoadout";
import { Tent, Gem } from "lucide-react";
import { toast } from "sonner";

export default function Equipment() {
  const [tick, setTick] = useState(0);
  void tick;
  const refresh = () => setTick((t) => t + 1);

  const stash = getStoneStash();
  const loadout = getStoneLoadout();
  const mods = getStoneCombatMods();
  const fighter = getActiveFighter();
  const combat = getGameLoadout(fighter.id).combat;
  const gear = getEquipmentCombatMods(fighter.id);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader
        kicker="Attribute stones + gear"
        title="Stone Sockets"
        subtitle="Stones + Main Panel weapons/armor both boost combat stats"
        action={
          <Button asChild variant="outline" className="font-serif tracking-widest border-primary/40">
            <Link href="/game" className="flex items-center gap-2">
              <Tent className="h-4 w-4" /> Enter Dungeon
            </Link>
          </Button>
        }
      />

      {/* Live combat summary (stones + equipped weapons/armor) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
        {[
          ["HP", combat.maxHp],
          ["DMG", combat.baseDamage],
          ["Spell", `×${combat.spellDamageMult.toFixed(2)}`],
          ["Crit", `${(combat.critChance * 100).toFixed(0)}%`],
          ["Def", `${(combat.defense * 100).toFixed(0)}%`],
          ["MDef", `${(combat.magicDefense * 100).toFixed(0)}%`],
          ["Speed", `×${combat.moveSpeedMult.toFixed(2)}`],
          ["AoE", `×${combat.aoeMult.toFixed(2)}`],
        ].map(([k, v]) => (
          <div key={String(k)} className="rounded border border-border/40 bg-card/50 px-2 py-2 text-center">
            <p className="text-[9px] font-mono uppercase text-muted-foreground">{k}</p>
            <p className="text-sm font-mono text-primary">{v}</p>
          </div>
        ))}
      </div>
      {gear.pieces.length > 0 && (
        <p className="text-[11px] text-muted-foreground font-mono">
          Gear bonus: +{gear.damage} dmg · +{gear.health} HP · +{Math.round(gear.crit * 100)}% crit ·{" "}
          {gear.pieces.slice(0, 4).join(", ")}
          {gear.pieces.length > 4 ? "…" : ""} (equip in Main Panel · C)
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 8 sockets */}
        <Card className="border-border/50 bg-card/60 lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="font-serif text-sm uppercase tracking-widest flex items-center gap-2">
              <Gem className="h-4 w-4 text-primary" /> Sockets
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {ATTR_ORDER.map((attr) => {
              const meta = STONE_META[attr];
              const uid = loadout[attr];
              const stone = uid ? stash.find((s) => s.uid === uid) : undefined;
              return (
                <div
                  key={attr}
                  className="rounded border px-3 py-2 bg-background/40"
                  style={{ borderColor: meta.color + "66" }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[10px] font-mono uppercase" style={{ color: meta.color }}>
                        {meta.glyph} {meta.label} · {attr}
                      </p>
                      {stone ? (
                        <p className="text-xs font-serif truncate" style={{ color: RARITY_COLOR[stone.rarity] }}>
                          {stone.name}
                        </p>
                      ) : (
                        <p className="text-[11px] text-muted-foreground italic">Empty socket</p>
                      )}
                    </div>
                    {stone && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-[10px]"
                        onClick={() => {
                          unequipStone(attr);
                          refresh();
                        }}
                      >
                        ✕
                      </Button>
                    )}
                  </div>
                  {stone && (
                    <ul className="mt-1 space-y-0.5">
                      {stone.effects.map((e, i) => (
                        <li key={i} className="text-[10px] font-mono text-muted-foreground">
                          {e.label}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
            <p className="text-[10px] font-mono text-muted-foreground pt-2">
              Procs: bolt {(mods.procBolt * 100).toFixed(0)}% · nova {(mods.procNova * 100).toFixed(0)}% ·
              burn {(mods.procBurn * 100).toFixed(0)}% · onslaught {(mods.onslaught * 100).toFixed(0)}%
            </p>
          </CardContent>
        </Card>

        {/* Stash */}
        <Card className="border-border/50 bg-card/60 lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="font-serif text-sm uppercase tracking-widest">
              Stone pouch ({stash.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stash.length === 0 ? (
              <p className="text-sm text-muted-foreground font-serif">
                Defeat enemies to drop colored stones. Higher tier foes and bosses drop rarer stones with more effects.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[560px] overflow-y-auto">
                {stash.map((stone) => (
                  <StoneCard
                    key={stone.uid}
                    stone={stone}
                    equipped={Object.values(loadout).includes(stone.uid)}
                    onEquip={() => {
                      const r = equipStone(stone.uid);
                      toast[r.ok ? "success" : "error"](r.message);
                      refresh();
                    }}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StoneCard({
  stone,
  equipped,
  onEquip,
}: {
  stone: AttributeStone;
  equipped: boolean;
  onEquip: () => void;
}) {
  const meta = STONE_META[stone.attr];
  return (
    <div
      className="rounded border px-3 py-2 bg-background/50"
      style={{ borderColor: RARITY_COLOR[stone.rarity] + "99" }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-serif" style={{ color: RARITY_COLOR[stone.rarity] }}>
            {meta.glyph} {stone.name}
          </p>
          <p className="text-[10px] font-mono uppercase text-muted-foreground">
            {RARITY_LABEL[stone.rarity]} · {stone.effects.length} effects · iLvl {stone.itemLevel}
          </p>
        </div>
        <Button size="sm" variant={equipped ? "secondary" : "outline"} className="text-[10px]" disabled={equipped} onClick={onEquip}>
          {equipped ? "In" : "Socket"}
        </Button>
      </div>
      <ul className="mt-1.5 space-y-0.5">
        {stone.effects.map((e, i) => (
          <li key={i} className="text-[11px] font-mono" style={{ color: meta.color }}>
            {e.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
