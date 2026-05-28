import { useEffect, useMemo, useRef, useState, type ReactNode, type MouseEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { PortraitCanvas } from "./PortraitCanvas";
import {
  CLASS_TO_MODEL, RACE_TO_MODEL, KAYKIT_URL, computeHiddenMeshes,
  type KayKitModel,
} from "@/data/characterMeshes";
import { starterLoadout } from "@/data/starterGear";

// ─── Spec-driven design tokens ─────────────────────────────────────────────────
// Mirrors https://info.grudge-studio.com/main-panel.html theme (grudge-theme.css).
const THEME = {
  bg: "#0d0908",
  panel: "#1a120c",
  card: "#221710",
  border: "#3a2a1a",
  gold: "#c9a04e",
  goldLight: "#f0d890",
  goldDark: "#8a6a30",
  goldDim: "rgba(212,175,55,0.22)",
  text: "#e8dec2",
  muted: "#9a8e7a",
  dim: "#6a5e4a",
  green: "#44ff44",
  red: "#ff4444",
  blue: "#4a9eff",
  fontDisplay: "'Cinzel Decorative','Cinzel',serif",
  fontHeading: "'Cinzel',serif",
  fontBody: "'Spectral SC','Segoe UI',serif",
  fontMono: "'JetBrains Mono',Consolas,monospace",
} as const;

const TIER_COLORS: Record<number, string> = {
  1: "#8b7355", 2: "#a8a8a8", 3: "#4a9eff", 4: "#9d4dff",
  5: "#ff4d4d", 6: "#ffaa00", 7: "#d4a84b", 8: "#f0d890",
};
const TIER_LABELS: Record<number, string> = {
  1: "Common", 2: "Uncommon", 3: "Rare", 4: "Epic",
  5: "Heroic", 6: "Mythic", 7: "Ancient", 8: "Legendary",
};

// ─── Race & class meta ─────────────────────────────────────────────────────────
type RaceId = "human" | "orc" | "elf" | "dwarf" | "undead" | "barbarian";

const RACE_IDS: RaceId[] = ["human", "orc", "elf", "dwarf", "undead", "barbarian"];
const RACE_META: Record<RaceId, { name: string; display: string; faction: string; color: string; mount: string }> = {
  human:     { name: "Human",     display: "Western Kingdoms", faction: "Crusade", color: "#c9a04e", mount: "Horse" },
  orc:       { name: "Orc",       display: "Orcs",             faction: "Legion",  color: "#8b2020", mount: "Wolf" },
  elf:       { name: "Elf",       display: "Elves",            faction: "Fabled",  color: "#7ec8e3", mount: "Stag" },
  dwarf:     { name: "Dwarf",     display: "Dwarves",          faction: "Fabled",  color: "#7ec8e3", mount: "Boar" },
  undead:    { name: "Undead",    display: "Undead",           faction: "Legion",  color: "#8b2020", mount: "Skeletal Horse" },
  barbarian: { name: "Barbarian", display: "Barbarians",       faction: "Crusade", color: "#c9a04e", mount: "Warhorse" },
};

// Portrait model resolution + asset URLs live in `@/data/characterMeshes`.

const ARMOR_SLOTS = ["Helm", "Shoulder", "Chest", "Hands", "Feet", "Relic"] as const;
const WEAPON_SLOTS = ["Mainhand", "Offhand"] as const;
const JEWELRY_SLOTS = ["Ring", "Necklace"] as const;
const ALL_SLOTS = [...ARMOR_SLOTS, ...WEAPON_SLOTS, ...JEWELRY_SLOTS] as const;
type SlotName = typeof ALL_SLOTS[number];

const SLOT_ICONS: Record<SlotName, string> = {
  Helm: "🪖", Shoulder: "🛡", Chest: "🎽", Hands: "🧤", Feet: "🥾", Relic: "🔮",
  Mainhand: "⚔", Offhand: "🛡", Ring: "💍", Necklace: "📿",
};

// ─── Public types ──────────────────────────────────────────────────────────────
export type PanelKey = "equipment" | "attributes" | "skills" | "crafting" | "quests";

const PANELS: Array<{ key: PanelKey; label: string }> = [
  { key: "equipment",  label: "Equipment" },
  { key: "attributes", label: "Attributes" },
  { key: "skills",     label: "Skills" },
  { key: "crafting",   label: "Crafting" },
  { key: "quests",     label: "Quests" },
];

export const MAIN_PANEL_KEYS: PanelKey[] = PANELS.map((p) => p.key);

export interface CharSummary {
  name: string;
  race: string;
  class: string;
  level: number;
  faction?: string;
  attributes?: Record<string, number>;
  equipment?: Record<string, string | undefined>;
  xp?: number;          // 0..1
  gold?: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  character: CharSummary;
  factionColor?: string;
  activeTab?: PanelKey;
  onActiveTabChange?: (k: PanelKey) => void;
}

// Loose item shape — matches R2 weapons.json + armor.json AND our T0 starter
// items (which add glyph/count/cooldownMs for tools, consumables, utilities).
interface AnyItem {
  id?: string;
  uuid?: string;
  name: string;
  type?: string;          // "weapon" | "armor" | "tool" | "consumable" | "utility"
  category?: string;
  tier?: number;          // 0..8 (0 = starter)
  iconUrl?: string;
  glyph?: string;         // emoji fallback for items without iconUrl
  slotType?: string;
  material?: string;
  description?: string;
  lore?: string;
  stats?: Record<string, number>;
  abilities?: string[];
  passives?: string[];
  count?: number;         // stack count for consumables
  cooldownMs?: number;    // intrinsic cooldown for usable items
}

// ─── Data fetcher (uses our R2-backed /api/gamedata; matches spec fall-through) ─
async function fetchJSON<T = unknown>(paths: string[]): Promise<T | null> {
  for (const url of paths) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      return (await res.json()) as T;
    } catch {
      /* try next */
    }
  }
  return null;
}

const BASE = (typeof window !== "undefined" ? (import.meta.env.BASE_URL ?? "/") : "/").replace(/\/$/, "");
const R2 = "https://pub-e7fcf1fd4c9946ecb84b3766bbc7b50d.r2.dev/api/v1";

async function loadMasterData(): Promise<{ items: AnyItem[]; armor: AnyItem[] }> {
  // R2 returns categorical structures, not flat arrays — flatten on the way in.
  const [wpn, arm] = await Promise.all([
    fetchJSON<{ categories?: Record<string, { items: AnyItem[] }> }>([`${R2}/weapons.json`]),
    fetchJSON<{ materials?: Record<string, { items: AnyItem[] }> }>([`${R2}/armor.json`]),
  ]);
  const items: AnyItem[] = [];
  if (wpn?.categories) {
    for (const [cat, group] of Object.entries(wpn.categories)) {
      for (const it of group.items ?? []) items.push({ ...it, type: "weapon", category: cat });
    }
  }
  const armor: AnyItem[] = [];
  if (arm?.materials) {
    for (const [mat, group] of Object.entries(arm.materials)) {
      for (const it of group.items ?? []) armor.push({ ...it, type: "armor", material: mat });
    }
  }
  return { items, armor };
}

// ─── Component ─────────────────────────────────────────────────────────────────
export function MainPanel({ open, onClose, character, factionColor, activeTab, onActiveTabChange }: Props) {
  const [activeLocal, setActiveLocal] = useState<PanelKey>("equipment");
  const active = activeTab ?? activeLocal;
  const setActive = (k: PanelKey) => { onActiveTabChange?.(k); setActiveLocal(k); };

  const initialRace = useMemo<RaceId>(() => {
    const r = (character.race ?? "human").toLowerCase();
    return (RACE_IDS as readonly string[]).includes(r) ? (r as RaceId) : "human";
  }, [character.race]);
  const [selectedRace, setSelectedRace] = useState<RaceId>(initialRace);
  useEffect(() => { setSelectedRace(initialRace); }, [initialRace]);

  const [data, setData] = useState<{ items: AnyItem[]; armor: AnyItem[] } | null>(null);
  useEffect(() => {
    let live = true;
    loadMasterData().then((d) => { if (live) setData(d); }).catch(() => { if (live) setData({ items: [], armor: [] }); });
    return () => { live = false; };
  }, []);

  // Equipped slots + inventory. Inventory is seeded with the T0 starter loadout
  // (class weapon + hatchet + pickaxe + 2× lesser healing potion + hearthstone)
  // immediately on mount, so a freshly-created warlord always has tools/portal.
  // Once R2 master data loads we top up the inventory with a handful of T1/T2
  // demo items so the panel has interesting things to equip.
  const [equipped, setEquipped] = useState<Partial<Record<SlotName, AnyItem>>>({});
  const [inventory, setInventory] = useState<AnyItem[]>(() => starterLoadout(character.class));

  // If the character identity changes (different warlord opened), reset to
  // their own starter loadout instead of carrying state across characters.
  const characterKey = `${character.name}::${character.class}`;
  const seededKeyRef = useRef<string>(characterKey);
  useEffect(() => {
    if (seededKeyRef.current === characterKey) return;
    seededKeyRef.current = characterKey;
    setInventory(starterLoadout(character.class));
    setEquipped({});
  }, [characterKey, character.class]);

  useEffect(() => {
    if (!data) return;
    // Demo: auto-equip a T1 set so the slots aren't all empty.
    const next: Partial<Record<SlotName, AnyItem>> = {};
    for (const s of ARMOR_SLOTS) {
      const piece = data.armor.find((i) => i.slotType === s && i.tier === 1);
      if (piece) next[s] = piece;
    }
    for (const s of JEWELRY_SLOTS) {
      const j = data.armor.find((i) => i.slotType === s && i.tier === 1);
      if (j) next[s] = j;
    }
    setEquipped((cur) => ({ ...next, ...cur })); // don't clobber user equips

    // Top up inventory with a few R2 samples — but never duplicate starter items.
    // Depends on `characterKey` too so switching characters re-runs the top-up
    // (the character-switch effect above wipes inventory to the new starter
    // loadout, and this effect then adds R2 samples back in).
    setInventory((cur) => {
      const have = new Set(cur.map((i) => i.uuid ?? i.id));
      const extras: AnyItem[] = [];
      for (const w of data.items.filter((i) => i.type === "weapon" && (i.tier ?? 1) <= 2).slice(0, 6)) {
        if (!have.has(w.uuid ?? w.id)) extras.push(w);
      }
      for (const a of data.armor.filter((i) => (i.tier ?? 1) === 2).slice(0, 4)) {
        if (!have.has(a.uuid ?? a.id)) extras.push(a);
      }
      return [...cur, ...extras];
    });
  }, [data, characterKey]);

  // ─── Derived stats (spec's computeStats, simplified) ─────────────────────────
  const stats = useMemo(() => {
    const s = { health: 250, mana: 100, stamina: 100, damage: 0, defense: 0, speed: 1.0, crit: 0, block: 0 };
    for (const it of Object.values(equipped)) {
      if (!it?.stats) continue;
      for (const [k, v] of Object.entries(it.stats)) {
        if (k.startsWith("damage")) s.damage += v;
        else if (k.startsWith("defense") || k === "armor") s.defense += v;
        else if (k === "crit") s.crit += v;
        else if (k === "block") s.block += v;
        else if (k === "speed") s.speed += v / 100;
        else if (k === "hp" || k === "health" || k === "healthBase") s.health += v;
        else if (k === "mana" || k === "manaBase") s.mana += v;
      }
    }
    return s;
  }, [equipped]);

  // ─── Hover tooltip (single fixed element, fed by data-uuid) ───────────────────
  const [tooltip, setTooltip] = useState<{ item: AnyItem; x: number; y: number; hint?: string } | null>(null);
  const showTip = (item: AnyItem, e: MouseEvent, hint?: string) => setTooltip({ item, x: e.clientX, y: e.clientY, hint });
  const moveTip = (e: MouseEvent) => setTooltip((t) => (t ? { ...t, x: e.clientX, y: e.clientY } : t));
  const hideTip = () => setTooltip(null);

  // ─── Equip / unequip ─────────────────────────────────────────────────────────
  const slotFor = (item: AnyItem): SlotName | null => {
    if (item.type === "armor" && item.slotType && (ALL_SLOTS as readonly string[]).includes(item.slotType)) {
      return item.slotType as SlotName;
    }
    if (item.type === "weapon") {
      const offCats = new Set(["shields", "tomes", "daggers"]);
      return offCats.has(item.category ?? "") ? "Offhand" : "Mainhand";
    }
    return null;
  };
  // Atomic equip/unequip: compute prev inside the functional updater so both
  // setState calls see the same authoritative `equipped` snapshot, then commit
  // inventory using the captured prev (no closure staleness, no nested setState).
  const equipFromInv = (item: AnyItem) => {
    const slot = slotFor(item);
    if (!slot) return;
    let displaced: AnyItem | undefined;
    setEquipped((e) => { displaced = e[slot]; return { ...e, [slot]: item }; });
    setInventory((inv) => {
      const itemKey = item.uuid ?? item.id;
      const next = inv.filter((i) => (i.uuid ?? i.id) !== itemKey);
      if (displaced) next.push(displaced);
      return next;
    });
    hideTip();
  };
  const unequip = (slot: SlotName) => {
    let removed: AnyItem | undefined;
    setEquipped((e) => { removed = e[slot]; const n = { ...e }; delete n[slot]; return n; });
    setInventory((inv) => (removed ? [...inv, removed] : inv));
    hideTip();
  };

  const accent = factionColor ?? RACE_META[selectedRace].color;

  // ─── 3D portrait: pick model by class, hide meshes by equipped slots ─────────
  // Class drives the body (warrior→Knight, mage→Mage, …); falls back to race
  // mapping for unknown classes, then Knight as a final default.
  const portraitModel: KayKitModel =
    CLASS_TO_MODEL[character.class?.toLowerCase() ?? ""] ??
    RACE_TO_MODEL[selectedRace] ??
    "Knight";
  const hiddenMeshes = useMemo(() => {
    const slots = new Set(Object.keys(equipped));
    const hasRanged =
      equipped.Mainhand?.category === "bows" ||
      equipped.Mainhand?.category === "crossbows" ||
      equipped.Offhand?.category === "bows" ||
      equipped.Offhand?.category === "crossbows";
    return computeHiddenMeshes(portraitModel, slots, hasRanged);
  }, [equipped, portraitModel]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="main-panel"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[60] flex items-stretch justify-center"
          style={{ background: "rgba(0,0,0,0.78)", backdropFilter: "blur(4px)", fontFamily: THEME.fontBody, color: THEME.text }}
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            initial={{ scale: 0.96, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96 }}
            transition={{ type: "spring", stiffness: 280, damping: 26 }}
            className="m-auto w-[min(1280px,96vw)] h-[min(820px,94vh)] overflow-hidden flex flex-col"
            style={{ background: THEME.bg, border: `2px solid ${THEME.gold}`, borderRadius: 8, boxShadow: `0 20px 80px rgba(0,0,0,0.6), 0 0 40px ${accent}33` }}
          >
            {/* ── Top bar ─────────────────────────────────────────────────── */}
            <header
              className="flex items-center justify-between px-4 py-2"
              style={{ background: "linear-gradient(90deg,#1a100a,#221710,#1a100a)", borderBottom: `2px solid ${THEME.gold}` }}
            >
              <div className="flex items-center gap-3">
                <h1 style={{ fontFamily: THEME.fontDisplay, fontSize: 15, color: THEME.gold, letterSpacing: 2, textTransform: "uppercase" }}>
                  Grudge Warlords
                </h1>
              </div>
              <div className="flex items-center gap-3" style={{ fontSize: 12 }}>
                <span style={{ color: THEME.gold, fontFamily: THEME.fontDisplay, fontWeight: 700 }}>{character.name}</span>
                <span style={{ color: THEME.muted, fontSize: 11 }}>Lv.{character.level} {character.class}</span>
                <div style={{ width: 120, height: 6, background: "#2a1e14", borderRadius: 3, border: `1px solid ${THEME.border}`, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.round((character.xp ?? 0.35) * 100)}%`, background: `linear-gradient(90deg, ${THEME.goldDark}, ${THEME.gold})`, transition: "width 0.3s" }} />
                </div>
                <button
                  onClick={onClose}
                  title="Close [C / Esc]"
                  className="ml-2 transition-colors"
                  style={{ color: THEME.muted, background: "transparent", border: 0, cursor: "pointer", padding: 4 }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = THEME.gold)}
                  onMouseLeave={(e) => (e.currentTarget.style.color = THEME.muted)}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </header>

            {/* ── 3-col body ──────────────────────────────────────────────── */}
            <div className="flex-1 flex min-h-0">
              {/* Left: combat stats + data sources */}
              <aside
                className="overflow-y-auto p-3 hidden lg:block"
                style={{ width: 260, flexShrink: 0, background: THEME.panel, borderRight: `2px solid ${THEME.border}` }}
              >
                <SectionTitle>Combat Stats</SectionTitle>
                <StatRow k="Health"  v={String(stats.health)} />
                <StatRow k="Mana"    v={String(stats.mana)} />
                <StatRow k="Stamina" v={String(stats.stamina)} />
                <StatRow k="Damage"  v={String(stats.damage)} positive />
                <StatRow k="Crit %"  v={`${stats.crit}%`} />
                <StatRow k="Defense" v={String(stats.defense)} />
                <StatRow k="Block %" v={`${stats.block}%`} />
                <StatRow k="Speed"   v={stats.speed.toFixed(1)} />

                <SectionTitle style={{ marginTop: 20 }}>Identity</SectionTitle>
                <div style={{ fontSize: 11, color: THEME.muted, lineHeight: 1.6 }}>
                  Race: <span style={{ color: THEME.gold }}>{RACE_META[selectedRace].name}</span><br />
                  Class: <span style={{ color: THEME.gold }}>{character.class}</span><br />
                  Faction: <span style={{ color: THEME.gold }}>{character.faction ?? RACE_META[selectedRace].faction}</span><br />
                  Mount: <span style={{ color: THEME.gold }}>{RACE_META[selectedRace].mount}</span>
                </div>

                <SectionTitle style={{ marginTop: 20 }}>Data Sources</SectionTitle>
                <div style={{ fontSize: 9, color: THEME.dim, lineHeight: 1.6, fontFamily: THEME.fontMono }}>
                  Items: {data?.items.length ?? "…"}<br />
                  Armor: {data?.armor.length ?? "…"}<br />
                  Slots filled: {Object.keys(equipped).length} / {ALL_SLOTS.length}<br />
                  Source: r2.dev / api v1
                </div>
              </aside>

              {/* Center: tab strip + content */}
              <main className="flex-1 flex flex-col min-w-0">
                <nav
                  className="flex overflow-x-auto"
                  style={{ background: "#14100a", borderBottom: `2px solid ${THEME.gold}`, flexShrink: 0 }}
                >
                  {PANELS.map(({ key, label }) => {
                    const isActive = active === key;
                    return (
                      <button
                        key={key}
                        onClick={() => setActive(key)}
                        style={{
                          border: 0,
                          background: isActive ? "rgba(255,215,0,0.08)" : "transparent",
                          color: isActive ? THEME.gold : THEME.muted,
                          cursor: "pointer",
                          padding: "10px 16px",
                          fontFamily: THEME.fontHeading,
                          fontSize: 10,
                          textTransform: "uppercase",
                          letterSpacing: 1,
                          fontWeight: 700,
                          borderBottom: `2px solid ${isActive ? THEME.gold : "transparent"}`,
                          whiteSpace: "nowrap",
                          transition: "all 0.15s",
                        }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </nav>

                <div className="flex-1 overflow-y-auto p-4">
                  {active === "equipment" && (
                    <EquipmentTab
                      character={character}
                      selectedRace={selectedRace} setSelectedRace={setSelectedRace}
                      equipped={equipped} onSlotClick={unequip} stats={stats}
                      onSlotHover={showTip} onSlotMove={moveTip} onSlotLeave={hideTip}
                      portraitModel={portraitModel} hiddenMeshes={hiddenMeshes}
                    />
                  )}
                  {active === "attributes" && <AttributesTab character={character} />}
                  {active === "skills"     && <SkillsTab character={character} />}
                  {active === "crafting"   && <CraftingTab />}
                  {active === "quests"     && <QuestsTab />}
                </div>
              </main>

              {/* Right: inventory */}
              <aside
                className="hidden lg:flex flex-col"
                style={{ width: 280, flexShrink: 0, background: THEME.panel, borderLeft: `2px solid ${THEME.border}` }}
              >
                <div className="flex items-center justify-between" style={{ padding: "10px 12px", borderBottom: `1px solid ${THEME.border}` }}>
                  <h3 style={{ fontFamily: THEME.fontHeading, fontSize: 12, color: THEME.gold, textTransform: "uppercase" }}>Inventory</h3>
                  <div className="flex items-center gap-2">
                    <span style={{ fontSize: 10, color: THEME.dim }}>{inventory.length}/42</span>
                    <span style={{ fontFamily: THEME.fontMono, fontSize: 12, color: THEME.gold }}>{character.gold ?? 250} Gold</span>
                  </div>
                </div>
                <div
                  className="grid flex-1 overflow-y-auto"
                  style={{ gridTemplateColumns: "repeat(6,1fr)", gap: 4, padding: 8, alignContent: "start" }}
                >
                  {Array.from({ length: 42 }).map((_, i) => {
                    const it = inventory[i];
                    if (!it) {
                      return <div key={i} style={{ aspectRatio: "1", border: `2px solid ${THEME.border}`, borderRadius: 6, background: THEME.card }} />;
                    }
                    const tier = it.tier ?? 1;
                    const tc = TIER_COLORS[tier];
                    return (
                      <button
                        key={(it.uuid ?? it.id ?? "") + i}
                        onClick={() => equipFromInv(it)}
                        onMouseEnter={(e) => showTip(it, e, "Click to equip")}
                        onMouseMove={moveTip}
                        onMouseLeave={hideTip}
                        style={{
                          aspectRatio: "1", border: `2px solid ${tc}`, borderRadius: 6,
                          background: THEME.card, cursor: "pointer", padding: 0, position: "relative",
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}
                      >
                        {it.iconUrl ? (
                          <img src={it.iconUrl} alt={it.name} style={{ width: "100%", height: "100%", objectFit: "contain", padding: 4, imageRendering: "pixelated" }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                        ) : it.glyph ? (
                          <span style={{ fontSize: 26 }}>{it.glyph}</span>
                        ) : (
                          <span style={{ fontSize: 18, opacity: 0.4 }}>{SLOT_ICONS[(it.slotType as SlotName) ?? "Mainhand"] ?? "◻"}</span>
                        )}
                        <span style={{ position: "absolute", top: 1, right: 2, fontSize: 7, fontWeight: 700, padding: "0 3px", borderRadius: 2, background: tc, color: "#000" }}>T{tier}</span>
                        {(it.count ?? 1) > 1 && (
                          <span style={{ position: "absolute", bottom: 1, right: 2, fontSize: 9, fontWeight: 700, padding: "0 3px", borderRadius: 2, background: "rgba(0,0,0,0.7)", color: THEME.gold }}>×{it.count}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </aside>
            </div>

            {/* ── Bottom hotbar ───────────────────────────────────────────── */}
            <footer
              className="flex items-center justify-center"
              style={{ padding: 6, background: "#120c06", borderTop: `2px solid ${THEME.gold}`, gap: 4, flexShrink: 0 }}
            >
              {[1, 2, 3, 4].map((n) => <HotSlot key={n} num={n} item={undefined} kind="skill" />)}
              <div style={{ width: 2, height: 30, background: THEME.border, margin: "0 4px", borderRadius: 1 }} />
              {(() => {
                // Hotbar consumables/utilities are pulled from the inventory so the
                // T0 hearthstone + healing potions appear without manual placement.
                const usables = inventory.filter((i) => i.type === "consumable" || i.type === "utility").slice(0, 3);
                return [6, 7, 8].map((n, i) => (
                  <HotSlot key={n} num={n} item={usables[i]} kind="consumable" onHover={showTip} onMove={moveTip} onLeave={hideTip} />
                ));
              })()}
            </footer>

            {/* ── Hotkey hint ─────────────────────────────────────────────── */}
            <div
              className="flex justify-between"
              style={{ borderTop: `1px solid ${THEME.border}`, padding: "4px 12px", fontSize: 9, fontFamily: THEME.fontMono, color: THEME.dim, letterSpacing: 2, textTransform: "uppercase", flexShrink: 0 }}
            >
              <span>[ C ] toggle</span><span>[ Esc ] close</span><span>[ 1–5 ] tab</span>
            </div>
          </motion.div>

          {/* Tooltip — pointer-events none, follows cursor */}
          {tooltip && <Tooltip item={tooltip.item} x={tooltip.x} y={tooltip.y} hint={tooltip.hint} />}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Hotkey hook (ref-stable, no remount churn) ────────────────────────────────
export function useMainPanelHotkeys(
  onToggle: () => void,
  onClose: () => void,
  isOpen: boolean,
  onSelectTab?: (idx: number) => void,
) {
  const refs = useRef({ onToggle, onClose, isOpen, onSelectTab });
  refs.current = { onToggle, onClose, isOpen, onSelectTab };
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      const r = refs.current;
      if (e.key === "c" || e.key === "C") { e.preventDefault(); r.onToggle(); return; }
      if (e.key === "Escape" && r.isOpen) { e.preventDefault(); r.onClose(); return; }
      if (r.isOpen && r.onSelectTab && /^[1-5]$/.test(e.key)) {
        e.preventDefault();
        r.onSelectTab(parseInt(e.key, 10) - 1);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
}

// ─── Sub-views ─────────────────────────────────────────────────────────────────

function EquipmentTab({
  character, selectedRace, setSelectedRace, equipped, onSlotClick, stats,
  onSlotHover, onSlotMove, onSlotLeave, portraitModel, hiddenMeshes,
}: {
  character: CharSummary;
  selectedRace: RaceId; setSelectedRace: (r: RaceId) => void;
  equipped: Partial<Record<SlotName, AnyItem>>;
  onSlotClick: (s: SlotName) => void;
  stats: { damage: number; defense: number; health: number; crit: number; block: number; speed: number };
  onSlotHover: (it: AnyItem, e: MouseEvent, hint?: string) => void;
  onSlotMove: (e: MouseEvent) => void;
  onSlotLeave: () => void;
  portraitModel: KayKitModel;
  hiddenMeshes: Set<string>;
}) {
  const rm = RACE_META[selectedRace];

  return (
    <div>
      {/* Race pills */}
      <div className="flex justify-center flex-wrap" style={{ gap: 6, marginBottom: 10 }}>
        {RACE_IDS.map((id) => {
          const m = RACE_META[id];
          const a = id === selectedRace;
          return (
            <button
              key={id}
              onClick={() => setSelectedRace(id)}
              style={{
                border: `2px solid ${a ? m.color : THEME.border}`,
                background: a ? `${m.color}22` : "transparent",
                color: a ? m.color : THEME.muted,
                padding: "4px 12px", borderRadius: 16,
                fontSize: 10, fontFamily: THEME.fontHeading, cursor: "pointer",
                fontWeight: a ? 700 : 400, letterSpacing: 1, textTransform: "uppercase",
                transition: "all 0.15s",
              }}
            >
              {m.name}
            </button>
          );
        })}
      </div>

      <p style={{ textAlign: "center", fontFamily: THEME.fontHeading, fontSize: 11, color: THEME.muted, letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>
        {rm.name} · {character.class}
      </p>

      {/* 3-column equipment layout */}
      <div className="flex items-stretch" style={{ minHeight: 420 }}>
        <div className="flex flex-col justify-center" style={{ gap: 6, padding: "8px 6px", width: 92, flexShrink: 0 }}>
          {ARMOR_SLOTS.map((s) => (
            <EqSlot key={s} name={s} item={equipped[s]} onClick={() => equipped[s] && onSlotClick(s)} onHover={onSlotHover} onMove={onSlotMove} onLeave={onSlotLeave} />
          ))}
        </div>

        <div
          className="flex-1 flex flex-col items-center justify-center"
          style={{
            background: `radial-gradient(ellipse at center, ${rm.color}10 0%, transparent 70%)`,
            borderLeft: `1px solid ${THEME.goldDim}`, borderRight: `1px solid ${THEME.goldDim}`, minWidth: 180,
          }}
        >
          <div style={{ fontFamily: THEME.fontDisplay, fontSize: 16, color: rm.color, letterSpacing: 1 }}>{rm.name}</div>
          <div style={{ fontSize: 9, color: THEME.muted, textTransform: "uppercase", letterSpacing: 2, margin: "2px 0 8px" }}>
            {rm.display} · {rm.faction}
          </div>
          <div
            style={{
              width: 200, height: 280, borderRadius: 8, overflow: "hidden",
              border: `2px solid ${rm.color}55`,
              background: "linear-gradient(180deg,rgba(30,20,12,0.95),rgba(20,14,8,0.8))",
              position: "relative",
            }}
          >
            {/* Three.js portrait — hides KayKit meshes that map to empty slots */}
            <PortraitCanvas
              src={KAYKIT_URL(portraitModel)}
              hiddenMeshes={hiddenMeshes}
              accent={rm.color}
            />
          </div>
          <div style={{ fontSize: 8, color: THEME.dim, marginTop: 6 }}>Mount: {rm.mount}</div>
        </div>

        <div className="flex flex-col justify-center" style={{ gap: 6, padding: "8px 6px", width: 92, flexShrink: 0 }}>
          {[...WEAPON_SLOTS, ...JEWELRY_SLOTS].map((s) => (
            <EqSlot key={s} name={s} item={equipped[s]} onClick={() => equipped[s] && onSlotClick(s)} onHover={onSlotHover} onMove={onSlotMove} onLeave={onSlotLeave} />
          ))}
        </div>
      </div>

      {/* Stat summary */}
      <div
        className="flex justify-center flex-wrap"
        style={{ gap: 12, marginTop: 14, padding: 10, background: "rgba(0,0,0,0.2)", borderRadius: 8, border: `1px solid ${THEME.goldDim}` }}
      >
        <SumStat label="Damage" v={stats.damage} />
        <SumStat label="Defense" v={stats.defense} />
        <SumStat label="Health" v={stats.health} />
        <SumStat label="Crit" v={`${stats.crit}%`} />
        <SumStat label="Block" v={`${stats.block}%`} />
        <SumStat label="Speed" v={stats.speed.toFixed(1)} />
      </div>

      <p style={{ textAlign: "center", marginTop: 10, fontSize: 10, color: THEME.dim }}>
        Click an inventory item to equip · Click an equipped slot to unequip
      </p>
    </div>
  );
}

function EqSlot({
  name, item, onClick, onHover, onMove, onLeave,
}: {
  name: SlotName; item: AnyItem | undefined; onClick: () => void;
  onHover: (it: AnyItem, e: MouseEvent, hint?: string) => void;
  onMove: (e: MouseEvent) => void; onLeave: () => void;
}) {
  const tier = item?.tier ?? 0;
  const tc = item ? TIER_COLORS[tier] ?? THEME.border : THEME.border;
  return (
    <button
      onClick={onClick}
      onMouseEnter={item ? (e) => onHover(item, e, "Click to unequip") : undefined}
      onMouseMove={item ? onMove : undefined}
      onMouseLeave={item ? onLeave : undefined}
      style={{
        width: 76, height: 76,
        border: `2px solid ${item ? tc : THEME.goldDim}`,
        borderRadius: 8,
        background: item
          ? `linear-gradient(180deg, ${tc}22 0%, #221710 100%)`
          : "linear-gradient(180deg, #2e1f14 0%, #221710 100%)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        cursor: item ? "pointer" : "default", fontSize: 8, color: THEME.muted,
        textTransform: "uppercase", position: "relative",
        boxShadow: "inset 0 2px 4px rgba(0,0,0,0.4)",
        transition: "all 0.2s", padding: 0,
      }}
    >
      {item ? (
        <>
          {item.iconUrl ? (
            <img src={item.iconUrl} alt={item.name} style={{ width: 48, height: 48, objectFit: "contain", imageRendering: "pixelated", filter: "drop-shadow(0 0 4px rgba(212,175,55,0.3))" }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
          ) : (
            <span style={{ fontSize: 26 }}>{SLOT_ICONS[name]}</span>
          )}
          <span style={{ position: "absolute", top: 2, right: 3, fontSize: 7, fontWeight: 700, padding: "1px 4px", borderRadius: 3, background: tc, color: "#000" }}>T{tier}</span>
        </>
      ) : (
        <>
          <span style={{ fontSize: 20, opacity: 0.18, marginBottom: 2 }}>{SLOT_ICONS[name]}</span>
          <span style={{ fontSize: 7, color: THEME.dim, letterSpacing: 1 }}>{name}</span>
        </>
      )}
    </button>
  );
}

function AttributesTab({ character }: { character: CharSummary }) {
  const entries = Object.entries(character.attributes ?? {});
  return (
    <div>
      <SectionTitle>Character Attributes</SectionTitle>
      <div className="flex items-center" style={{ gap: 12, padding: "10px 0" }}>
        <span style={{ fontSize: 11, color: THEME.muted }}>Available Points:</span>
        <span style={{ fontFamily: THEME.fontMono, fontSize: 14, color: THEME.gold, fontWeight: 700 }}>20</span>
      </div>
      {entries.length === 0 && <p style={{ fontSize: 11, color: THEME.muted }}>No attributes recorded.</p>}
      {entries.map(([k, v]) => (
        <div key={k} className="mb-2" style={{ background: "linear-gradient(180deg, #221710 0%, #1a120c 100%)", border: `2px solid ${THEME.border}`, borderLeft: `3px solid ${THEME.gold}`, borderRadius: 8, padding: 12 }}>
          <div className="flex items-center justify-between">
            <span style={{ fontFamily: THEME.fontHeading, fontSize: 13, color: THEME.goldLight, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>{k}</span>
            <span style={{ fontFamily: THEME.fontMono, fontSize: 14, color: THEME.gold, fontWeight: 700 }}>{v}</span>
          </div>
          <div style={{ height: 6, background: "rgba(0,0,0,0.4)", borderRadius: 3, marginTop: 6, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${Math.min(100, Number(v) * 5)}%`, background: `linear-gradient(90deg, ${THEME.goldDark}, ${THEME.gold})` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function SkillsTab(_: { character: CharSummary }) {
  return (
    <div>
      <SectionTitle>Skill Trees</SectionTitle>
      <p style={{ fontSize: 11, color: THEME.muted }}>Class skill trees and weapon skills load from R2. Detailed editor coming next.</p>
    </div>
  );
}

function CraftingTab() {
  return (
    <div>
      <SectionTitle>Crafting</SectionTitle>
      <p style={{ fontSize: 11, color: THEME.muted }}>Recipe browser coming next. Pulls from <span style={{ fontFamily: THEME.fontMono, color: THEME.gold }}>master-recipes.json</span> when published.</p>
    </div>
  );
}

function QuestsTab() {
  return (
    <div>
      <SectionTitle>Active Quests</SectionTitle>
      <p style={{ fontSize: 11, color: THEME.muted }}>No active quests. Connect to the Grudge backend to surface live objectives.</p>
    </div>
  );
}

// ─── Small UI atoms ────────────────────────────────────────────────────────────

function SectionTitle({ children, style }: { children: ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        fontFamily: THEME.fontHeading, fontSize: 12, color: THEME.gold,
        textTransform: "uppercase", letterSpacing: 1, margin: "10px 0 10px",
        paddingLeft: 10, borderLeft: `3px solid ${THEME.gold}`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function StatRow({ k, v, positive }: { k: string; v: string; positive?: boolean }) {
  return (
    <div className="flex justify-between" style={{ padding: "4px 0", fontSize: 12, borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
      <span style={{ color: THEME.muted, fontWeight: 600 }}>{k}</span>
      <span style={{ fontFamily: THEME.fontMono, fontSize: 11, color: positive ? THEME.green : THEME.text }}>{v}</span>
    </div>
  );
}

function SumStat({ label, v }: { label: string; v: number | string }) {
  return (
    <div style={{ textAlign: "center", minWidth: 56 }}>
      <div style={{ fontFamily: THEME.fontMono, fontSize: 13, fontWeight: 700, color: THEME.green }}>{v}</div>
      <div style={{ fontSize: 8, color: THEME.dim, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
    </div>
  );
}

function HotSlot({
  num, kind, item, onHover, onMove, onLeave,
}: {
  num: number;
  kind: "skill" | "consumable";
  item?: AnyItem;
  onHover?: (it: AnyItem, e: MouseEvent, hint?: string) => void;
  onMove?: (e: MouseEvent) => void;
  onLeave?: () => void;
}) {
  return (
    <div
      onMouseEnter={item && onHover ? (e) => onHover(item, e, item.cooldownMs ? `CD ${Math.round(item.cooldownMs / 1000)}s` : undefined) : undefined}
      onMouseMove={item && onMove ? onMove : undefined}
      onMouseLeave={item && onLeave ? onLeave : undefined}
      style={{
        width: 44, height: 44, borderRadius: 6,
        border: `2px solid ${kind === "skill" ? "#4a3520" : "#2a3520"}`,
        background: "#2a1e14", display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 9, color: THEME.dim, position: "relative", cursor: item ? "pointer" : "default",
      }}
    >
      <span style={{ position: "absolute", top: 2, left: 4, fontSize: 8, color: THEME.muted, fontFamily: THEME.fontMono, zIndex: 1 }}>{num}</span>
      {item && (
        <>
          <span style={{ fontSize: 22 }}>{item.glyph ?? "◻"}</span>
          {(item.count ?? 1) > 1 && (
            <span style={{ position: "absolute", bottom: 1, right: 3, fontSize: 9, fontWeight: 700, color: THEME.gold, textShadow: "0 0 2px #000" }}>×{item.count}</span>
          )}
        </>
      )}
    </div>
  );
}

function Tooltip({ item, x, y, hint }: { item: AnyItem; x: number; y: number; hint?: string }) {
  const tier = item.tier ?? 1;
  const tc = TIER_COLORS[tier];
  const tl = TIER_LABELS[tier];
  const W = 320;
  const left = x + W + 16 > window.innerWidth ? x - W - 16 : x + 16;
  const top = Math.max(8, Math.min(y + 16, window.innerHeight - 420));
  return (
    <div
      style={{
        position: "fixed", left, top, zIndex: 9999, width: W, maxHeight: 480, overflowY: "auto",
        background: "linear-gradient(180deg, hsl(225 25% 14%) 0%, hsl(225 28% 10%) 50%, hsl(225 25% 8%) 100%)",
        border: `2px solid ${tc}`, borderRadius: 8, padding: 14, pointerEvents: "none",
        boxShadow: "0 8px 32px rgba(0,0,0,0.7), 0 0 16px rgba(212,175,55,0.15)",
        fontFamily: THEME.fontBody, color: THEME.text,
      }}
    >
      <div className="flex" style={{ gap: 12, alignItems: "flex-start", marginBottom: 10 }}>
        <div style={{ width: 52, height: 52, borderRadius: 8, border: `2px solid ${tc}`, background: `linear-gradient(135deg,${tc}33,rgba(0,0,0,0.3))`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
          {item.iconUrl ? <img src={item.iconUrl} alt={item.name} style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <span style={{ fontSize: 24 }}>{SLOT_ICONS[(item.slotType as SlotName) ?? "Mainhand"] ?? "◻"}</span>}
        </div>
        <div>
          <div style={{ fontFamily: THEME.fontHeading, fontSize: 14, fontWeight: 700, color: tc, letterSpacing: 0.5 }}>{item.name}</div>
          <div style={{ color: THEME.muted, fontSize: 10, marginTop: 2, textTransform: "uppercase", letterSpacing: 1 }}>
            {item.type ?? ""}{item.category ? ` · ${item.category}` : ""}
          </div>
          <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 3, fontSize: 9, fontWeight: 700, marginTop: 4, background: tc, color: "#000" }}>{tl} — T{tier}</span>
        </div>
      </div>
      {item.stats && Object.keys(item.stats).length > 0 && (
        <Section title="Stats">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
            {Object.entries(item.stats).map(([k, v]) => (
              <div key={k} style={{ background: "rgba(0,0,0,0.3)", padding: "4px 8px", borderRadius: 4, borderLeft: `2px solid ${THEME.green}` }}>
                <div style={{ fontSize: 8, color: THEME.dim, textTransform: "uppercase" }}>{k.replace(/([A-Z])/g, " $1").trim()}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: THEME.green, fontFamily: THEME.fontMono }}>+{v}</div>
              </div>
            ))}
          </div>
        </Section>
      )}
      {item.abilities && item.abilities.length > 0 && (
        <Section title="Abilities">
          {item.abilities.map((a, i) => <div key={i} style={{ padding: "3px 0", fontSize: 10, borderBottom: "1px solid rgba(255,255,255,0.03)" }}>⚡ {a}</div>)}
        </Section>
      )}
      {(item.lore || item.description) && (
        <Section title="Lore">
          <p style={{ fontStyle: "italic", color: THEME.dim, fontSize: 10, lineHeight: 1.4 }}>“{item.lore ?? item.description}”</p>
        </Section>
      )}
      {(item.uuid || item.id) && (
        <div style={{ fontFamily: THEME.fontMono, fontSize: 8, color: THEME.dim, marginTop: 8, wordBreak: "break-all" }}>{item.uuid ?? item.id}</div>
      )}
      {hint && (
        <div style={{ fontSize: 9, color: THEME.gold, marginTop: 8, textAlign: "center", padding: 4, background: "rgba(212,175,55,0.08)", borderRadius: 4 }}>{hint}</div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid rgba(212,175,55,0.15)" }}>
      <div style={{ fontSize: 8, textTransform: "uppercase", color: THEME.dim, letterSpacing: 1, marginBottom: 6, fontWeight: 700 }}>{title}</div>
      {children}
    </div>
  );
}
