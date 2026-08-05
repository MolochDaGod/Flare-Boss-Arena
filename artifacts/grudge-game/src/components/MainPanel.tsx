import { useEffect, useMemo, useRef, useState, type ReactNode, type MouseEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { PortraitCanvas } from "./PortraitCanvas";
import {
  PORTRAIT_URL, resolveVisibleMeshes,
  type RaceId as PortraitRaceId,
} from "@/data/characterMeshes";
import { starterLoadout } from "@/data/starterGear";
import { useResolvedSkills } from "@/data/skillsResolver";
import { SkillIcon } from "@/components/SkillIcon";
import {
  getEquipmentLoadout,
  setEquipmentLoadout,
  snapEquippedItem,
  computeEquipmentCombatMods,
} from "@/data/equipmentLoadout";
import { getActiveFighterId, ATTR_ORDER } from "@/data/fighters";
import {
  getSpendableAttributePoints,
  getAttributeAllocations,
  spendAttributePoint,
} from "@/data/attributePoints";
import {
  getSkillState,
  upgradeSkill,
  levelCost,
} from "@/data/abilityUpgrades";
import {
  RTS_BUILDINGS,
  CRAFT_RECIPES,
  getBuildingTiers,
  upgradeBuilding,
  craftRecipe,
  canCraft,
  getBuildingTier,
} from "@/data/rtsCrafting";
import { getResources } from "@/data/resources";
import { getWallet } from "@/data/wallet";

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

  // Portrait race is fixed from the active fighter sheet — no race picker UI.
  const portraitRaceId = useMemo<RaceId>(() => {
    const r = (character.race ?? "human").toLowerCase();
    return (RACE_IDS as readonly string[]).includes(r) ? (r as RaceId) : "human";
  }, [character.race]);

  const fighterId = getActiveFighterId() ?? character.name;

  const [data, setData] = useState<{ items: AnyItem[]; armor: AnyItem[] } | null>(null);
  useEffect(() => {
    let live = true;
    loadMasterData().then((d) => { if (live) setData(d); }).catch(() => { if (live) setData({ items: [], armor: [] }); });
    return () => { live = false; };
  }, []);

  // Inventory: fighter signature weapon + harvest tools + potions (independent game kit).
  // Equipped slots hydrate from persistent equipment loadout (combat boosts).
  const [equipped, setEquipped] = useState<Partial<Record<SlotName, AnyItem>>>(() => {
    const saved = getEquipmentLoadout(fighterId);
    const out: Partial<Record<SlotName, AnyItem>> = {};
    for (const [slot, snap] of Object.entries(saved)) {
      if (!snap) continue;
      if ((ALL_SLOTS as readonly string[]).includes(slot)) {
        out[slot as SlotName] = {
          id: snap.id,
          uuid: snap.id,
          name: snap.name,
          type: snap.type,
          category: snap.category,
          tier: snap.tier,
          stats: snap.stats,
          slotType: snap.slot,
        };
      }
    }
    return out;
  });
  const loadoutKey = character.name;
  const [inventory, setInventory] = useState<AnyItem[]>(() => starterLoadout(loadoutKey));

  // If the fighter changes, reset bag to that fighter's kit and reload gear.
  const characterKey = `${character.name}::${fighterId}`;
  const seededKeyRef = useRef<string>(characterKey);
  useEffect(() => {
    if (seededKeyRef.current === characterKey) return;
    seededKeyRef.current = characterKey;
    setInventory(starterLoadout(character.name));
    const saved = getEquipmentLoadout(fighterId);
    const out: Partial<Record<SlotName, AnyItem>> = {};
    for (const [slot, snap] of Object.entries(saved)) {
      if (!snap || !(ALL_SLOTS as readonly string[]).includes(slot)) continue;
      out[slot as SlotName] = {
        id: snap.id,
        uuid: snap.id,
        name: snap.name,
        type: snap.type,
        category: snap.category,
        tier: snap.tier,
        stats: snap.stats,
        slotType: snap.slot,
      };
    }
    setEquipped(out);
  }, [characterKey, character.name, fighterId]);

  // Persist equipped gear so combat loadout receives weapon/armor boosts.
  useEffect(() => {
    const map: Parameters<typeof setEquipmentLoadout>[1] = {};
    for (const [slot, item] of Object.entries(equipped)) {
      if (item) map[slot] = snapEquippedItem(slot, item);
    }
    setEquipmentLoadout(fighterId, map);
  }, [equipped, fighterId]);

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

  // ─── Derived stats from equipped weapons / armor (same math as combat) ────
  const stats = useMemo(() => {
    const mods = computeEquipmentCombatMods(equipped);
    return {
      health: 250 + mods.health,
      mana: 100 + mods.mana,
      stamina: 100,
      damage: mods.damage + mods.magicDamage,
      defense: Math.round(mods.defense * 100),
      speed: 1.0 + mods.speed,
      crit: Math.round(mods.crit * 100),
      block: Math.round(mods.block * 100),
      gearPieces: mods.pieces.length,
    };
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

  const accent = factionColor ?? RACE_META[portraitRaceId].color;

  // ─── 3D portrait: fixed race mesh for wardrobe preview (not a player choice).
  // Hide wardrobe meshes by default; show body + equipped weapon/armor only.
  const portraitRace: PortraitRaceId = portraitRaceId as PortraitRaceId;
  const visibilityFor = useMemo(() => {
    const equip = {
      mainCategory: equipped.Mainhand?.category,
      offCategory: equipped.Offhand?.category,
      hasOffhand: !!equipped.Offhand,
      hasShoulder: !!equipped.Shoulder,
    };
    const seed = `${character.name}::${portraitRace}`;
    return (names: string[]) => resolveVisibleMeshes(names, portraitRace, equip, seed);
  }, [equipped, portraitRace, character.name]);

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
                  Flare Boss Arena
                </h1>
              </div>
              <div className="flex items-center gap-3" style={{ fontSize: 12 }}>
                <span style={{ color: THEME.gold, fontFamily: THEME.fontDisplay, fontWeight: 700 }}>{character.name}</span>
                <span style={{ color: THEME.muted, fontSize: 11 }}>Lv.{character.level} · {character.class.replace(/_/g, " ")}</span>
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

                <SectionTitle style={{ marginTop: 20 }}>Champion</SectionTitle>
                <div style={{ fontSize: 11, color: THEME.muted, lineHeight: 1.6 }}>
                  Fighter: <span style={{ color: THEME.gold }}>{character.name}</span><br />
                  Role: <span style={{ color: THEME.gold }}>{character.class.replace(/_/g, " ")}</span><br />
                  Gear pieces: <span style={{ color: THEME.gold }}>{stats.gearPieces}</span><br />
                  <span style={{ color: THEME.dim, fontSize: 10 }}>Weapons &amp; armor boost damage, HP, crit, defense</span>
                </div>

                <SectionTitle style={{ marginTop: 20 }}>Armory</SectionTitle>
                <div style={{ fontSize: 9, color: THEME.dim, lineHeight: 1.6, fontFamily: THEME.fontMono }}>
                  Items: {data?.items.length ?? "…"} · Armor: {data?.armor.length ?? "…"}<br />
                  Slots: {Object.keys(equipped).length} / {ALL_SLOTS.length}<br />
                  Gear bonuses apply in combat
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
                      portraitRaceId={portraitRaceId}
                      equipped={equipped} onSlotClick={unequip} stats={stats}
                      onSlotHover={showTip} onSlotMove={moveTip} onSlotLeave={hideTip}
                      portraitRace={portraitRace} visibilityFor={visibilityFor}
                    />
                  )}
                  {active === "attributes" && <AttributesTab character={character} />}
                  {active === "skills"     && <SkillsTab character={character} mainCategory={equipped.Mainhand?.category} />}
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
  character, portraitRaceId, equipped, onSlotClick, stats,
  onSlotHover, onSlotMove, onSlotLeave, portraitRace, visibilityFor,
}: {
  character: CharSummary;
  portraitRaceId: RaceId;
  equipped: Partial<Record<SlotName, AnyItem>>;
  onSlotClick: (s: SlotName) => void;
  stats: { damage: number; defense: number; health: number; crit: number; block: number; speed: number; gearPieces?: number };
  onSlotHover: (it: AnyItem, e: MouseEvent, hint?: string) => void;
  onSlotMove: (e: MouseEvent) => void;
  onSlotLeave: () => void;
  portraitRace: PortraitRaceId;
  visibilityFor: (meshNames: string[]) => Set<string>;
}) {
  const accent = RACE_META[portraitRaceId].color;
  const roleLabel = character.class.replace(/_/g, " ");

  return (
    <div>
      {/* No race/class picker — champion is the active fighter from /select. */}
      <p style={{ textAlign: "center", fontFamily: THEME.fontHeading, fontSize: 11, color: THEME.muted, letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>
        {character.name} · {roleLabel}
      </p>
      <p style={{ textAlign: "center", fontSize: 10, color: THEME.dim, marginBottom: 10 }}>
        Equip weapons &amp; armor — bonuses apply in dungeon, boss, and camp combat
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
            background: `radial-gradient(ellipse at center, ${accent}10 0%, transparent 70%)`,
            borderLeft: `1px solid ${THEME.goldDim}`, borderRight: `1px solid ${THEME.goldDim}`, minWidth: 180,
          }}
        >
          <div style={{ fontFamily: THEME.fontDisplay, fontSize: 16, color: accent, letterSpacing: 1 }}>{character.name}</div>
          <div style={{ fontSize: 9, color: THEME.muted, textTransform: "uppercase", letterSpacing: 2, margin: "2px 0 8px" }}>
            {roleLabel} · gear boosts combat
          </div>
          <div
            style={{
              width: 200, height: 280, borderRadius: 8, overflow: "hidden",
              border: `2px solid ${accent}55`,
              background: "linear-gradient(180deg,rgba(30,20,12,0.95),rgba(20,14,8,0.8))",
              position: "relative",
            }}
          >
            {/* Three.js portrait — wardrobe follows equipped slots only. */}
            <PortraitCanvas
              src={PORTRAIT_URL(portraitRace)}
              visibilityFor={visibilityFor}
              accent={accent}
            />
          </div>
          <div style={{ fontSize: 8, color: THEME.dim, marginTop: 6 }}>
            {stats.gearPieces ?? 0} pieces equipped · +{stats.damage} dmg · +{stats.health - 250} HP
          </div>
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
  const fighterId = getActiveFighterId() ?? character.name;
  const [, setTick] = useState(0);
  const refresh = () => setTick((t) => t + 1);
  const spendable = getSpendableAttributePoints();
  const spent = getAttributeAllocations(fighterId);
  const base = character.attributes ?? {};

  const rows = ATTR_ORDER.map((k) => {
    const label = k.charAt(0).toUpperCase() + k.slice(1);
    const baseV = Number(base[label] ?? base[k] ?? 0);
    const add = spent[k] ?? 0;
    return { key: k, label, total: baseV + add, base: baseV, add };
  });

  return (
    <div>
      <SectionTitle>Character Attributes</SectionTitle>
      <div className="flex items-center flex-wrap" style={{ gap: 12, padding: "10px 0" }}>
        <span style={{ fontSize: 11, color: THEME.muted }}>Spendable:</span>
        <span style={{ fontFamily: THEME.fontMono, fontSize: 14, color: THEME.gold, fontWeight: 700 }}>
          {spendable.total}
        </span>
        <span style={{ fontSize: 10, color: THEME.dim }}>
          ({spendable.free} free · {spendable.souls} souls)
        </span>
      </div>
      <p style={{ fontSize: 10, color: THEME.dim, marginBottom: 8 }}>
        Spend free points first, then 1 soul each. Points apply permanently to this champion.
      </p>
      {rows.map((r) => (
        <div
          key={r.key}
          className="mb-2"
          style={{
            background: "linear-gradient(180deg, #221710 0%, #1a120c 100%)",
            border: `2px solid ${THEME.border}`,
            borderLeft: `3px solid ${THEME.gold}`,
            borderRadius: 8,
            padding: 12,
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <span
              style={{
                fontFamily: THEME.fontHeading,
                fontSize: 13,
                color: THEME.goldLight,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: 1,
              }}
            >
              {r.label}
            </span>
            <div className="flex items-center gap-2">
              <span style={{ fontFamily: THEME.fontMono, fontSize: 14, color: THEME.gold, fontWeight: 700 }}>
                {r.total}
                {r.add > 0 ? (
                  <span style={{ color: THEME.green, fontSize: 11 }}> (+{r.add})</span>
                ) : null}
              </span>
              <button
                type="button"
                disabled={spendable.total <= 0 || r.add >= 20}
                onClick={() => {
                  const res = spendAttributePoint(r.key, fighterId);
                  if (!res.ok) window.alert(res.message);
                  refresh();
                }}
                style={{
                  border: `1px solid ${THEME.gold}`,
                  background: spendable.total > 0 ? `${THEME.gold}22` : "transparent",
                  color: THEME.gold,
                  borderRadius: 4,
                  padding: "2px 8px",
                  fontFamily: THEME.fontMono,
                  fontSize: 12,
                  cursor: spendable.total > 0 ? "pointer" : "not-allowed",
                  opacity: spendable.total > 0 ? 1 : 0.4,
                }}
              >
                +
              </button>
            </div>
          </div>
          <div style={{ height: 6, background: "rgba(0,0,0,0.4)", borderRadius: 3, marginTop: 6, overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                width: `${Math.min(100, r.total * 5)}%`,
                background: `linear-gradient(90deg, ${THEME.goldDark}, ${THEME.gold})`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function SkillsTab({ character, mainCategory }: { character: CharSummary; mainCategory?: string }) {
  const { classSkills, weaponType, weaponSlots, isLoading, loadout } = useResolvedSkills(character.class, mainCategory);
  const [, setTick] = useState(0);
  const refresh = () => setTick((t) => t + 1);
  const gold = getWallet().gold;

  // Prefer fighter kit skills (1–5 + special) for upgrades when loadout present.
  const kitSkills = loadout?.skills ?? [];
  const special = loadout?.special;

  return (
    <div>
      <SectionTitle>
        Fighter Skills{classSkills ? ` — ${classSkills.name}` : ""}
      </SectionTitle>
      <p style={{ fontSize: 10, color: THEME.muted, marginBottom: 8 }}>
        Upgrade ranks with gold · keys 1–5 cast · R special · gold: {gold}
        {loadout ? ` · Weapon: ${loadout.weapon.glyph} ${loadout.weapon.name}` : ""}
      </p>

      {kitSkills.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 8, marginBottom: 12 }}>
          {kitSkills.map((sk, idx) => {
            const st = getSkillState(sk.id);
            const cost = levelCost(st.level + 1);
            const maxed = st.level >= 5;
            return (
              <div
                key={sk.id}
                style={{
                  display: "flex",
                  gap: 8,
                  padding: 8,
                  borderRadius: 8,
                  background: "linear-gradient(180deg,#221710,#1a120c)",
                  border: `2px solid ${THEME.border}`,
                  borderLeft: `3px solid ${THEME.gold}`,
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="flex items-center justify-between" style={{ gap: 6 }}>
                    <span style={{ fontFamily: THEME.fontHeading, fontSize: 11, color: THEME.goldLight, fontWeight: 700 }}>
                      {idx + 1}. {sk.name}
                    </span>
                    <span style={{ fontFamily: THEME.fontMono, fontSize: 9, color: THEME.gold }}>
                      R{st.level}/5
                    </span>
                  </div>
                  <p style={{ fontSize: 9, color: THEME.muted, marginTop: 2 }}>{sk.description}</p>
                  <div style={{ display: "flex", gap: 8, marginTop: 6, alignItems: "center" }}>
                    <span style={{ fontFamily: THEME.fontMono, fontSize: 8, color: THEME.dim }}>
                      +{Math.round(st.level * 8)}% dmg · CD −{Math.round(st.level * 3)}%
                    </span>
                    <button
                      type="button"
                      disabled={maxed}
                      onClick={() => {
                        const r = upgradeSkill(sk.id);
                        if (!r.ok) window.alert(r.message);
                        refresh();
                      }}
                      style={{
                        marginLeft: "auto",
                        border: `1px solid ${THEME.gold}`,
                        background: maxed ? "transparent" : `${THEME.gold}22`,
                        color: THEME.gold,
                        borderRadius: 4,
                        padding: "2px 8px",
                        fontSize: 9,
                        fontFamily: THEME.fontMono,
                        cursor: maxed ? "not-allowed" : "pointer",
                        opacity: maxed ? 0.45 : 1,
                      }}
                    >
                      {maxed ? "MAX" : `Upgrade ${cost}g`}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          {special && (
            <div
              style={{
                padding: 8,
                borderRadius: 8,
                background: "linear-gradient(180deg,#2a1a08,#1a120c)",
                border: `2px solid ${THEME.gold}`,
              }}
            >
              <div style={{ fontFamily: THEME.fontHeading, fontSize: 11, color: THEME.gold }}>
                R · {special.name}
              </div>
              <p style={{ fontSize: 9, color: THEME.muted }}>{special.description}</p>
              {(() => {
                const specialId = `special_${character.name}`;
                const st = getSkillState(specialId);
                const cost = levelCost(st.level + 1);
                const maxed = st.level >= 5;
                return (
                  <button
                    type="button"
                    disabled={maxed}
                    onClick={() => {
                      const r = upgradeSkill(specialId);
                      if (!r.ok) window.alert(r.message);
                      refresh();
                    }}
                    style={{
                      marginTop: 6,
                      border: `1px solid ${THEME.gold}`,
                      background: `${THEME.gold}22`,
                      color: THEME.gold,
                      borderRadius: 4,
                      padding: "2px 8px",
                      fontSize: 9,
                      fontFamily: THEME.fontMono,
                      cursor: maxed ? "not-allowed" : "pointer",
                    }}
                  >
                    {maxed ? `Special MAX R${st.level}` : `Upgrade special ${cost}g · R${st.level}`}
                  </button>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {classSkills?.skills?.length ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 8, marginBottom: 8 }}>
          {classSkills.skills.map((sk) => (
            <div
              key={sk.id}
              style={{
                display: "flex", gap: 8, padding: 8, borderRadius: 8,
                background: "linear-gradient(180deg,#221710,#1a120c)",
                border: `2px solid ${sk.isSignature ? THEME.gold : THEME.border}`,
                borderLeft: `3px solid ${sk.isSignature ? THEME.gold : THEME.goldDark}`,
              }}
            >
              <div style={{ width: 32, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <SkillIcon icon={sk.icon} glyph={sk.glyph} size={30} radius={5} />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="flex items-center justify-between" style={{ gap: 6 }}>
                  <span style={{ fontFamily: THEME.fontHeading, fontSize: 11, color: THEME.goldLight, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>{sk.name}</span>
                  {sk.isSignature && <span style={{ fontSize: 7, color: "#000", background: THEME.gold, padding: "1px 4px", borderRadius: 3, fontWeight: 700, textTransform: "uppercase" }}>R</span>}
                </div>
                <p style={{ fontSize: 9, color: THEME.muted, lineHeight: 1.4, margin: "2px 0 0" }}>{sk.description}</p>
              </div>
            </div>
          ))}
        </div>
      ) : !kitSkills.length ? (
        <p style={{ fontSize: 11, color: THEME.muted }}>No skills for this fighter.</p>
      ) : null}

      <SectionTitle style={{ marginTop: 18 }}>
        {weaponType ? `Weapon — ${weaponType.name}` : "Weapon"}
      </SectionTitle>
      {isLoading ? (
        <p style={{ fontSize: 11, color: THEME.muted }}>…</p>
      ) : weaponSlots.length ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 8 }}>
          {weaponSlots.map((slot) => (
            <div key={slot.type} style={{ padding: 8, borderRadius: 8, background: THEME.card, border: `2px solid ${THEME.border}` }}>
              <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
                <span style={{ fontFamily: THEME.fontHeading, fontSize: 9, color: THEME.gold, textTransform: "uppercase", letterSpacing: 1 }}>{slot.label}</span>
                <span style={{ fontFamily: THEME.fontMono, fontSize: 8, color: THEME.dim }}>T{slot.unlockTier}</span>
              </div>
              {slot.skills.map((sk) => (
                <div key={sk.id} style={{ display: "flex", justifyContent: "space-between", gap: 6, padding: "2px 0", borderTop: `1px solid rgba(255,255,255,0.03)` }}>
                  <span style={{ fontSize: 10, color: THEME.text, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sk.name}</span>
                  <span style={{ fontFamily: THEME.fontMono, fontSize: 9, color: THEME.red, flexShrink: 0 }}>{sk.damage || ""}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <p style={{ fontSize: 11, color: THEME.muted }}>Equip a weapon in your main hand to channel its mastery.</p>
      )}
    </div>
  );
}

function CraftingTab() {
  const [, setTick] = useState(0);
  const refresh = () => setTick((t) => t + 1);
  const tiers = getBuildingTiers();
  const bag = getResources();
  const gold = getWallet().gold;

  return (
    <div>
      <SectionTitle>RTS Buildings</SectionTitle>
      <p style={{ fontSize: 10, color: THEME.muted, marginBottom: 8 }}>
        Upgrade production buildings · stock: {bag.wood} wood · {bag.stone} stone · {gold} gold
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 8, marginBottom: 16 }}>
        {RTS_BUILDINGS.map((b) => {
          const t = tiers[b.id] ?? 0;
          const next = t + 1;
          const cost = b.upgradeCost(Math.min(next, b.maxTier));
          const maxed = t >= b.maxTier;
          return (
            <div
              key={b.id}
              style={{
                padding: 10,
                borderRadius: 8,
                background: THEME.card,
                border: `2px solid ${t > 0 ? THEME.gold + "66" : THEME.border}`,
              }}
            >
              <div style={{ fontFamily: THEME.fontHeading, fontSize: 12, color: THEME.gold }}>
                {b.glyph} {b.name}
              </div>
              <div style={{ fontFamily: THEME.fontMono, fontSize: 10, color: THEME.muted, margin: "4px 0" }}>
                Tier {t}/{b.maxTier}
              </div>
              <p style={{ fontSize: 9, color: THEME.dim, marginBottom: 6 }}>{b.blurb}</p>
              <button
                type="button"
                disabled={maxed}
                onClick={() => {
                  const r = upgradeBuilding(b.id);
                  if (!r.ok) window.alert(r.message);
                  refresh();
                }}
                style={{
                  width: "100%",
                  border: `1px solid ${THEME.gold}`,
                  background: maxed ? "transparent" : `${THEME.gold}18`,
                  color: THEME.gold,
                  borderRadius: 4,
                  padding: "4px 6px",
                  fontSize: 9,
                  fontFamily: THEME.fontMono,
                  cursor: maxed ? "not-allowed" : "pointer",
                }}
              >
                {maxed ? "Max tier" : `Upgrade ${cost.gold}g · ${cost.wood}w · ${cost.stone}s`}
              </button>
            </div>
          );
        })}
      </div>

      <SectionTitle>Craft Recipes</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 8 }}>
        {CRAFT_RECIPES.map((r) => {
          const ready = canCraft(r);
          const needTier = getBuildingTier(r.building);
          return (
            <div
              key={r.id}
              style={{
                padding: 10,
                borderRadius: 8,
                background: THEME.card,
                border: `2px solid ${ready ? THEME.gold + "55" : THEME.border}`,
                opacity: needTier < r.minTier ? 0.55 : 1,
              }}
            >
              <div style={{ fontFamily: THEME.fontHeading, fontSize: 11, color: THEME.goldLight }}>
                {r.glyph} {r.name}
              </div>
              <p style={{ fontSize: 9, color: THEME.muted, margin: "4px 0" }}>{r.blurb}</p>
              <div style={{ fontFamily: THEME.fontMono, fontSize: 8, color: THEME.dim }}>
                {r.building} T{r.minTier}+ · {r.cost.gold}g {r.cost.wood}w {r.cost.stone}s
              </div>
              <button
                type="button"
                disabled={!ready}
                onClick={() => {
                  const res = craftRecipe(r.id);
                  if (!res.ok) window.alert(res.message);
                  else window.alert(res.message);
                  refresh();
                }}
                style={{
                  marginTop: 6,
                  width: "100%",
                  border: `1px solid ${THEME.gold}`,
                  background: ready ? `${THEME.gold}22` : "transparent",
                  color: THEME.gold,
                  borderRadius: 4,
                  padding: "4px 6px",
                  fontSize: 9,
                  fontFamily: THEME.fontMono,
                  cursor: ready ? "pointer" : "not-allowed",
                }}
              >
                {needTier < r.minTier ? `Need ${r.building} T${r.minTier}` : "Craft"}
              </button>
            </div>
          );
        })}
      </div>
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
