/**
 * Stone sockets — Codex UI (sprite slots + roguelite status icons + frost chrome).
 */
import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/PageChrome";
import { ATTR_ORDER, type AttrKey } from "@/data/fighters";
import {
  STONE_META,
  RARITY_COLOR,
  RARITY_LABEL,
  getStoneStash,
  getStoneLoadout,
  getStoneCombatMods,
  equipStone,
  unequipStone,
  type AttributeStone,
  type StoneEffectId,
} from "@/data/stones";
import { getGameLoadout } from "@/data/gameCombat";
import { getActiveFighter } from "@/data/fighters";
import {
  ATTR_STATUS_ICON,
  CODEX_FROST,
  EFFECT_STATUS_ICON,
  type StatusIconId,
} from "@/data/codexUiAssets";
import {
  CodexPanel,
  CodexSlot,
  CodexStatChip,
  StatusIcon,
  StatusIconRow,
} from "@/components/CodexUi";
import { Tent, Snowflake, Package } from "lucide-react";
import { toast } from "sonner";

function effectIcons(stone: AttributeStone): StatusIconId[] {
  const out: StatusIconId[] = [];
  for (const e of stone.effects) {
    const id = EFFECT_STATUS_ICON[e.id as StoneEffectId];
    if (id && !out.includes(id)) out.push(id);
  }
  return out;
}

export default function Equipment() {
  const [tick, setTick] = useState(0);
  const [focus, setFocus] = useState<AttrKey | "all">("all");
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  void tick;
  const refresh = () => setTick((t) => t + 1);

  const stash = getStoneStash();
  const loadout = getStoneLoadout();
  const mods = getStoneCombatMods();
  const combat = getGameLoadout(getActiveFighter().id).combat;
  const fighter = getActiveFighter();

  const filteredStash = useMemo(() => {
    let list = [...stash];
    if (focus !== "all") list = list.filter((s) => s.attr === focus);
    list.sort((a, b) => {
      const ra = Object.values(loadout).includes(a.uid) ? 0 : 1;
      const rb = Object.values(loadout).includes(b.uid) ? 0 : 1;
      if (ra !== rb) return ra - rb;
      return b.itemLevel - a.itemLevel;
    });
    return list;
  }, [stash, focus, loadout, tick]);

  const selected = selectedUid ? stash.find((s) => s.uid === selectedUid) : undefined;
  const socketedCount = ATTR_ORDER.filter((a) => loadout[a]).length;

  return (
    <div className="space-y-5 animate-in fade-in duration-500 pb-8">
      <PageHeader
        kicker="Codex · cold forge"
        title="Equipment"
        subtitle="Eight attribute sockets · sprite slots · status icons · frost chrome"
        action={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" className="font-serif tracking-widest border-cyan-700/50 text-cyan-100/90">
              <Link href="/party" className="flex items-center gap-2">
                <Package className="h-4 w-4" /> Party
              </Link>
            </Button>
            <Button asChild variant="outline" className="font-serif tracking-widest border-primary/40">
              <Link href="/game" className="flex items-center gap-2">
                <Tent className="h-4 w-4" /> Enter Dungeon
              </Link>
            </Button>
          </div>
        }
      />

      {/* Live combat strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
        {(
          [
            ["HP", combat.maxHp, "regen"],
            ["DMG", combat.baseDamage, "strength"],
            ["Spell", `×${combat.spellDamageMult.toFixed(2)}`, "curse"],
            ["Crit", `${(combat.critChance * 100).toFixed(0)}%`, "lucky"],
            ["Def", `${(combat.defense * 100).toFixed(0)}%`, "shield"],
            ["MDef", `${(combat.magicDefense * 100).toFixed(0)}%`, "shield"],
            ["Speed", `×${combat.moveSpeedMult.toFixed(2)}`, "haste"],
            ["AoE", `×${combat.aoeMult.toFixed(2)}`, "rage"],
          ] as const
        ).map(([k, v, icon]) => (
          <CodexStatChip key={k} label={k} value={v} statusId={icon} accent={CODEX_FROST.accent} />
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        {/* Socket board */}
        <CodexPanel
          className="xl:col-span-5"
          kicker={`${fighter.name} · ${socketedCount}/8 socketed`}
          title="Attribute sockets"
          icon="freeze"
        >
          <p className="text-[11px] font-mono text-muted-foreground mb-3 leading-relaxed">
            Click a socket to filter the pouch. Status art shows stone procs (burn, freeze, shield…).
          </p>
          <div className="grid grid-cols-4 sm:grid-cols-4 gap-3 justify-items-center">
            {ATTR_ORDER.map((attr) => {
              const meta = STONE_META[attr];
              const uid = loadout[attr];
              const stone = uid ? stash.find((s) => s.uid === uid) : undefined;
              const filled = !!stone;
              const statusId = stone
                ? effectIcons(stone)[0] ?? ATTR_STATUS_ICON[attr]
                : ATTR_STATUS_ICON[attr];
              return (
                <div key={attr} className="relative">
                  <CodexSlot
                    size={72}
                    filled={filled}
                    accent={meta.color}
                    statusId={statusId}
                    label={meta.label}
                    sublabel={filled ? RARITY_LABEL[stone!.rarity] : "empty"}
                    selected={focus === attr}
                    onClick={() => setFocus((f) => (f === attr ? "all" : attr))}
                  />
                  {filled && (
                    <button
                      type="button"
                      className="absolute -top-1 -right-1 z-10 w-5 h-5 rounded-full text-[10px] font-mono border bg-black/80 hover:bg-red-950/80"
                      style={{ borderColor: `${meta.color}88`, color: meta.color }}
                      title="Unequip"
                      onClick={(e) => {
                        e.stopPropagation();
                        unequipStone(attr);
                        if (selectedUid === stone?.uid) setSelectedUid(null);
                        refresh();
                      }}
                    >
                      ×
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <div
            className="mt-4 rounded border px-3 py-2 flex flex-wrap gap-3 items-center"
            style={{ borderColor: "rgba(120,190,230,0.2)", background: "rgba(0,0,0,0.25)" }}
          >
            <Snowflake className="w-3.5 h-3.5" style={{ color: CODEX_FROST.accent }} />
            <span className="text-[10px] font-mono text-muted-foreground">
              Procs · bolt {(mods.procBolt * 100).toFixed(0)}% · nova {(mods.procNova * 100).toFixed(0)}% ·
              burn {(mods.procBurn * 100).toFixed(0)}% · frost {(mods.procFrost * 100).toFixed(0)}% ·
              onslaught {(mods.onslaught * 100).toFixed(0)}%
            </span>
            <div className="flex gap-1 ml-auto">
              {(["burn", "freeze", "stun", "shield", "rage", "lifesteal"] as const).map((id) => (
                <StatusIcon key={id} id={id} size={18} title={id} dimmed={false} />
              ))}
            </div>
          </div>
        </CodexPanel>

        {/* Pouch */}
        <CodexPanel
          className="xl:col-span-4"
          kicker={`Pouch · ${filteredStash.length}${focus !== "all" ? ` · ${focus}` : ""}`}
          title="Stone pouch"
          icon="lucky"
          actions={
            focus !== "all" ? (
              <button
                type="button"
                className="text-[10px] font-mono uppercase tracking-widest px-2 py-1 rounded border"
                style={{ borderColor: CODEX_FROST.panelBorder, color: CODEX_FROST.accent }}
                onClick={() => setFocus("all")}
              >
                Clear filter
              </button>
            ) : null
          }
        >
          {filteredStash.length === 0 ? (
            <p className="text-sm text-muted-foreground font-serif leading-relaxed">
              {stash.length === 0
                ? "Defeat enemies to drop colored stones. Bosses drop rarer gems with more status affixes."
                : "No stones match this socket filter."}
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-2 max-h-[520px] overflow-y-auto pr-1">
              {filteredStash.map((stone) => {
                const equipped = Object.values(loadout).includes(stone.uid);
                const meta = STONE_META[stone.attr];
                const icons = effectIcons(stone);
                const active = selectedUid === stone.uid;
                return (
                  <button
                    key={stone.uid}
                    type="button"
                    onClick={() => setSelectedUid(stone.uid)}
                    className="w-full text-left rounded-md border px-2.5 py-2 flex gap-2.5 items-start transition-colors"
                    style={{
                      borderColor: active
                        ? RARITY_COLOR[stone.rarity]
                        : `${RARITY_COLOR[stone.rarity]}55`,
                      background: active ? "rgba(20,40,60,0.75)" : "rgba(6,12,18,0.55)",
                      boxShadow: active ? `0 0 12px ${RARITY_COLOR[stone.rarity]}33` : undefined,
                    }}
                  >
                    <CodexSlot
                      size={48}
                      filled
                      accent={meta.color}
                      statusId={icons[0] ?? ATTR_STATUS_ICON[stone.attr]}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p
                            className="text-sm font-serif truncate"
                            style={{ color: RARITY_COLOR[stone.rarity] }}
                          >
                            {stone.name}
                          </p>
                          <p className="text-[9px] font-mono uppercase text-muted-foreground">
                            {RARITY_LABEL[stone.rarity]} · {meta.label} · iLvl {stone.itemLevel}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant={equipped ? "secondary" : "outline"}
                          className="text-[10px] h-7 shrink-0"
                          disabled={equipped}
                          onClick={(e) => {
                            e.stopPropagation();
                            const r = equipStone(stone.uid);
                            toast[r.ok ? "success" : "error"](r.message);
                            refresh();
                          }}
                        >
                          {equipped ? "Socketed" : "Socket"}
                        </Button>
                      </div>
                      <div className="mt-1.5">
                        <StatusIconRow ids={icons} size={18} max={5} />
                      </div>
                      <ul className="mt-1 space-y-0.5">
                        {stone.effects.slice(0, 3).map((e, i) => (
                          <li key={i} className="text-[10px] font-mono text-muted-foreground truncate">
                            {e.label}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </CodexPanel>

        {/* Detail / legend */}
        <CodexPanel className="xl:col-span-3" kicker="Inspect" title="Stone detail" icon="shield">
          {selected ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <CodexSlot
                  size={80}
                  filled
                  accent={STONE_META[selected.attr].color}
                  statusId={effectIcons(selected)[0] ?? ATTR_STATUS_ICON[selected.attr]}
                />
                <div className="min-w-0">
                  <p className="font-serif text-base" style={{ color: RARITY_COLOR[selected.rarity] }}>
                    {selected.name}
                  </p>
                  <p className="text-[10px] font-mono uppercase text-muted-foreground">
                    {RARITY_LABEL[selected.rarity]} · {STONE_META[selected.attr].label}
                  </p>
                  <p className="text-[10px] font-mono text-muted-foreground mt-0.5">
                    {STONE_META[selected.attr].blurb}
                  </p>
                </div>
              </div>
              <StatusIconRow ids={effectIcons(selected)} size={26} max={8} />
              <ul className="space-y-1.5">
                {selected.effects.map((e, i) => {
                  const sid = EFFECT_STATUS_ICON[e.id as StoneEffectId];
                  return (
                    <li
                      key={i}
                      className="flex items-center gap-2 text-[11px] font-mono rounded border px-2 py-1.5"
                      style={{ borderColor: "rgba(120,190,230,0.2)", background: "rgba(0,0,0,0.25)" }}
                    >
                      {sid ? <StatusIcon id={sid} size={22} /> : <span className="w-[22px]" />}
                      <span style={{ color: STONE_META[selected.attr].color }}>{e.label}</span>
                    </li>
                  );
                })}
              </ul>
              <Button
                className="w-full font-serif tracking-widest text-xs"
                disabled={Object.values(loadout).includes(selected.uid)}
                onClick={() => {
                  const r = equipStone(selected.uid);
                  toast[r.ok ? "success" : "error"](r.message);
                  refresh();
                }}
              >
                {Object.values(loadout).includes(selected.uid) ? "Already socketed" : "Socket to attribute"}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-[12px] font-serif text-muted-foreground leading-relaxed">
                Select a stone in the pouch to inspect affixes. Icons come from the roguelite status pack;
                frames from build-yourself sprite pieces; chrome is cold-biome frost.
              </p>
              <div className="grid grid-cols-5 gap-1.5">
                {(
                  [
                    "burn",
                    "freeze",
                    "poison",
                    "bleed",
                    "stun",
                    "shield",
                    "regen",
                    "haste",
                    "rage",
                    "lifesteal",
                    "strength",
                    "lucky",
                    "curse",
                    "thorns",
                    "weakness",
                  ] as const
                ).map((id) => (
                  <div
                    key={id}
                    className="flex flex-col items-center gap-0.5 rounded border p-1"
                    style={{ borderColor: "rgba(120,190,230,0.15)" }}
                  >
                    <StatusIcon id={id} size={24} />
                    <span className="text-[7px] font-mono text-muted-foreground uppercase truncate w-full text-center">
                      {id}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CodexPanel>
      </div>
    </div>
  );
}
