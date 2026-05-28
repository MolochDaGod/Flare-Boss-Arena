import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sword, Heart, GitBranch, Sparkles, ArrowUpCircle, Hammer, ScrollText, Users } from "lucide-react";
import { PlayerPortrait } from "@/game/PlayerPortrait";
import { fetchWeaponSkills, classWeaponList, type WeaponSkillsData, type WeaponTypeDef, type WeaponSkill } from "@/game/weaponSkills";

export type PanelKey =
  | "equipment" | "attribute" | "skillTree" | "classSkill"
  | "upgrade"   | "craft"     | "quest"     | "guild";

const PANELS: Array<{ key: PanelKey; label: string; Icon: React.ComponentType<{ className?: string }> }> = [
  { key: "equipment", label: "Equipment",  Icon: Sword },
  { key: "attribute", label: "Attribute",  Icon: Heart },
  { key: "skillTree", label: "Skill Tree", Icon: GitBranch },
  { key: "classSkill",label: "Class Skill",Icon: Sparkles },
  { key: "upgrade",   label: "Upgrade",    Icon: ArrowUpCircle },
  { key: "craft",     label: "Craft",      Icon: Hammer },
  { key: "quest",     label: "Quest",      Icon: ScrollText },
  { key: "guild",     label: "Guild",      Icon: Users },
];

export interface CharSummary {
  name: string;
  race: string;
  class: string;
  level: number;
  faction?: string;
  attributes?: Record<string, number>;
  equipment?: Record<string, string | undefined>;
}

interface Props {
  open: boolean;
  onClose: () => void;
  character: CharSummary;
  factionColor?: string;
  /** Optional: parent-controlled active tab (used by [1-8] hotkeys) */
  activeTab?: PanelKey;
  onActiveTabChange?: (k: PanelKey) => void;
}

const FACTION_COLORS: Record<string, string> = {
  Crusade: "#d4891a",
  Fabled:  "#22c55e",
  Legion:  "#ef4444",
};

export function MainPanel({ open, onClose, character, factionColor, activeTab, onActiveTabChange }: Props) {
  const [activeLocal, setActiveLocal] = useState<PanelKey>("equipment");
  const active = activeTab ?? activeLocal;
  const setActive = (k: PanelKey) => { onActiveTabChange?.(k); setActiveLocal(k); };
  const [equippedWeapon, setEquippedWeapon] = useState<string>("SWORD");
  const [skillsData, setSkillsData] = useState<WeaponSkillsData | null>(null);
  const portraitRef = useRef<HTMLDivElement>(null);
  const portraitInst = useRef<PlayerPortrait | null>(null);
  const color = factionColor ?? FACTION_COLORS[character.faction ?? ""] ?? "#d4891a";

  // Load weapon-skills JSON once
  useEffect(() => {
    fetchWeaponSkills().then(setSkillsData).catch(() => {});
  }, []);

  // Default weapon = first weapon allowed for the char's class
  useEffect(() => {
    if (skillsData) {
      const allowed = classWeaponList(skillsData, character.class);
      if (allowed.length && !allowed.includes(equippedWeapon)) {
        setEquippedWeapon(allowed[0]);
      }
    }
  }, [skillsData, character.class, equippedWeapon]);

  // Mount/dispose the Three.js portrait
  useEffect(() => {
    if (!open || !portraitRef.current) return;
    const p = new PlayerPortrait({ charClass: character.class, weaponType: equippedWeapon, factionColor: color });
    portraitInst.current = p;
    p.mount(portraitRef.current);
    return () => {
      portraitInst.current = null;
      p.dispose();
    };
  }, [open, character.class, color]); // intentionally not equippedWeapon

  // Live weapon swap without remounting the whole scene
  useEffect(() => {
    portraitInst.current?.setWeapon(equippedWeapon);
  }, [equippedWeapon]);

  return (
    <AnimatePresence>
      {open && (
      <motion.div
        key="main-panel"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 z-[60] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <motion.div
          initial={{ scale: 0.95, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95 }}
          transition={{ type: "spring", stiffness: 280, damping: 26 }}
          className="w-full max-w-6xl h-[88vh] bg-[#08080b] border rounded-md overflow-hidden flex flex-col shadow-2xl"
          style={{ borderColor: `${color}55`, boxShadow: `0 0 60px -10px ${color}66` }}
        >
          {/* Tab bar */}
          <div className="flex items-center border-b" style={{ borderColor: `${color}33` }}>
            <div className="px-4 py-2 border-r" style={{ borderColor: `${color}33` }}>
              <p className="font-serif text-[10px] tracking-[0.3em] uppercase text-muted-foreground">Warlord</p>
              <p className="font-serif text-base tracking-widest uppercase" style={{ color }}>{character.name}</p>
            </div>
            <div className="flex-1 flex overflow-x-auto">
              {PANELS.map(({ key, label, Icon }) => {
                const isActive = active === key;
                return (
                  <button
                    key={key}
                    onClick={() => setActive(key)}
                    className="px-4 py-3 flex items-center gap-2 font-serif text-[11px] tracking-widest uppercase transition-colors whitespace-nowrap border-r"
                    style={{
                      color: isActive ? color : "#8a8580",
                      background: isActive ? `${color}14` : "transparent",
                      borderColor: `${color}22`,
                      borderBottom: isActive ? `2px solid ${color}` : "2px solid transparent",
                    }}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {label}
                  </button>
                );
              })}
            </div>
            <button
              onClick={onClose}
              className="px-4 py-3 text-muted-foreground hover:text-white transition-colors"
              title="Close [C / Esc]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body — 3-column: left(stats) | middle(portrait) | right(panel content) */}
          <div className="flex-1 grid grid-cols-12 gap-0 overflow-hidden">
            {/* Left: persistent character info */}
            <div className="col-span-3 border-r p-4 overflow-y-auto" style={{ borderColor: `${color}22` }}>
              <p className="font-serif text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Identity</p>
              <div className="space-y-1 mb-5">
                <p className="font-serif text-sm text-white">{character.race} {character.class}</p>
                <p className="font-serif text-xs" style={{ color }}>Level {character.level}</p>
                {character.faction && <p className="font-serif text-[10px] tracking-widest uppercase text-muted-foreground">{character.faction} Faction</p>}
              </div>

              <p className="font-serif text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Attributes</p>
              <div className="space-y-1.5">
                {Object.entries(character.attributes ?? {}).map(([k, v]) => (
                  <div key={k} className="flex justify-between text-xs">
                    <span className="font-serif tracking-widest uppercase text-muted-foreground">{k}</span>
                    <span className="font-mono" style={{ color }}>{v}</span>
                  </div>
                ))}
                {(!character.attributes || Object.keys(character.attributes).length === 0) && (
                  <p className="text-[10px] text-muted-foreground font-mono">No attributes</p>
                )}
              </div>
            </div>

            {/* Middle: 3D self-camera portrait */}
            <div className="col-span-5 relative overflow-hidden" style={{ background: `radial-gradient(ellipse at center, ${color}18 0%, #050507 70%)` }}>
              <div ref={portraitRef} className="absolute inset-0" />
              {/* Equipped weapon strip — overlaid bottom */}
              <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
                <p className="font-serif text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-2">Equipped Weapon</p>
                <p className="font-serif text-sm tracking-widest uppercase" style={{ color }}>{equippedWeapon}</p>
              </div>
            </div>

            {/* Right: tab-specific content */}
            <div className="col-span-4 border-l overflow-y-auto" style={{ borderColor: `${color}22` }}>
              {active === "equipment"  && <EquipmentPanel character={character} skillsData={skillsData} equippedWeapon={equippedWeapon} setEquippedWeapon={setEquippedWeapon} color={color} />}
              {active === "attribute"  && <AttributePanel character={character} color={color} />}
              {active === "skillTree"  && <SkillTreePanel character={character} color={color} />}
              {active === "classSkill" && <ClassSkillPanel skillsData={skillsData} equippedWeapon={equippedWeapon} color={color} />}
              {active === "upgrade"    && <StubPanel title="Upgrade" hint="Reforge equipment with grudge essence." color={color} />}
              {active === "craft"      && <StubPanel title="Craft"   hint="Forge new gear from dungeon loot." color={color} />}
              {active === "quest"      && <StubPanel title="Quest"   hint="Active grudges to be settled." color={color} />}
              {active === "guild"      && <StubPanel title="Guild"   hint="Your clan and clan wars." color={color} />}
            </div>
          </div>

          <div className="border-t px-4 py-2 flex justify-between text-[10px] font-mono tracking-widest uppercase text-muted-foreground" style={{ borderColor: `${color}22` }}>
            <span>[ C ] toggle panel</span>
            <span>[ Esc ] close</span>
            <span>[ 1-8 ] tab</span>
          </div>
        </motion.div>
      </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Hook: open with hotkey C, close with Esc, [1-8] selects tab when open. */
export function useMainPanelHotkeys(
  onToggle: () => void,
  onClose: () => void,
  isOpen: boolean,
  onSelectTab?: (idx: number) => void,
) {
  const toggleRef = useRef(onToggle);
  const closeRef = useRef(onClose);
  const tabRef = useRef(onSelectTab);
  const openRef = useRef(isOpen);
  toggleRef.current = onToggle;
  closeRef.current = onClose;
  tabRef.current = onSelectTab;
  openRef.current = isOpen;
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.key === "c" || e.key === "C") { e.preventDefault(); toggleRef.current(); return; }
      if (e.key === "Escape" && openRef.current) { e.preventDefault(); closeRef.current(); return; }
      if (openRef.current && tabRef.current && /^[1-8]$/.test(e.key)) {
        e.preventDefault();
        tabRef.current(parseInt(e.key, 10) - 1);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
}

/** Exported so callers can wire [1-8] hotkeys to setActive. */
export const MAIN_PANEL_KEYS: PanelKey[] = PANELS.map((p) => p.key);

// ─── Sub-panels ────────────────────────────────────────────────────────────────

function EquipmentPanel({
  character, skillsData, equippedWeapon, setEquippedWeapon, color,
}: { character: CharSummary; skillsData: WeaponSkillsData | null; equippedWeapon: string; setEquippedWeapon: (s: string) => void; color: string }) {
  const slots = ["mainHand", "offHand", "helm", "chest", "legs", "boots", "gloves", "amulet", "ring1", "ring2"];
  const allowed = useMemo(
    () => (skillsData ? classWeaponList(skillsData, character.class) : []),
    [skillsData, character.class],
  );
  return (
    <div className="p-4 space-y-5">
      <div>
        <p className="font-serif text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Weapon Loadout</p>
        <div className="grid grid-cols-3 gap-2">
          {allowed.map((w) => {
            const active = w === equippedWeapon;
            return (
              <button
                key={w}
                onClick={() => setEquippedWeapon(w)}
                className="rounded p-2 border text-[10px] font-serif tracking-widest uppercase transition-all"
                style={{
                  borderColor: active ? color : "#222226",
                  background: active ? `${color}1a` : "#0c0c10",
                  color: active ? color : "#9a958e",
                }}
              >
                {w}
              </button>
            );
          })}
          {allowed.length === 0 && <p className="col-span-3 text-[10px] text-muted-foreground font-mono">Loading…</p>}
        </div>
      </div>

      <div>
        <p className="font-serif text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Slots</p>
        <div className="space-y-1.5">
          {slots.map((s) => {
            const id = character.equipment?.[s];
            return (
              <div key={s} className="flex items-center gap-2 p-2 rounded border" style={{ borderColor: "#222226", background: "#0c0c10" }}>
                <div className="w-7 h-7 rounded bg-black/60 border border-white/10 flex items-center justify-center text-[9px] uppercase font-mono text-muted-foreground shrink-0">
                  {s.slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] font-serif tracking-widest text-muted-foreground uppercase">{s}</p>
                  <p className="text-xs font-serif truncate" style={{ color: id ? color : "#5a554f" }}>{id || "— empty —"}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function AttributePanel({ character, color }: { character: CharSummary; color: string }) {
  const entries = Object.entries(character.attributes ?? {});
  return (
    <div className="p-4 space-y-3">
      <p className="font-serif text-[10px] uppercase tracking-widest text-muted-foreground">Allocated Attributes</p>
      {entries.length === 0 && <p className="text-xs text-muted-foreground font-mono">None recorded.</p>}
      {entries.map(([k, v]) => (
        <div key={k} className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="font-serif tracking-widest uppercase">{k}</span>
            <span className="font-mono" style={{ color }}>{v}</span>
          </div>
          <div className="h-1.5 bg-black/50 rounded-sm overflow-hidden">
            <div className="h-full rounded-sm" style={{ width: `${Math.min(100, v * 8)}%`, background: color }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function SkillTreePanel({ character, color }: { character: CharSummary; color: string }) {
  const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
  // Map class → which icon pack to feature
  const classMap: Record<string, string> = {
    mage: "FireMage_Free", warrior: "EarthMage_Free", ranger: "Hunter_Free", worge: "Necromancer_Free",
  };
  const pack = classMap[character.class.toLowerCase()] ?? "EarthMage_Free";
  // Hardcoded short icon list (icons we copied via skill-tree zip).
  // Rather than fetch a directory listing, sample known filenames from `contact-sheets`.
  const sample = ["mage-mana-shield.png"];
  return (
    <div className="p-4 space-y-3">
      <p className="font-serif text-[10px] uppercase tracking-widest text-muted-foreground">Skill Tree — {pack.replace("_Free", "")}</p>
      <img
        src={`${BASE}/icons/skilltree/${pack}-sheet.png`}
        alt={pack}
        className="w-full rounded border"
        style={{ borderColor: `${color}33`, background: "#0a0a0c" }}
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
      />
      <div className="grid grid-cols-5 gap-2">
        {sample.map((s) => (
          <img key={s} src={`${BASE}/icons/skilltree/${s}`} alt={s}
            className="aspect-square rounded border object-contain" style={{ borderColor: `${color}33`, background: "#0a0a0c" }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground font-mono">Full tree editor coming.</p>
    </div>
  );
}

function ClassSkillPanel({ skillsData, equippedWeapon, color }: { skillsData: WeaponSkillsData | null; equippedWeapon: string; color: string }) {
  if (!skillsData) return <div className="p-4 text-xs text-muted-foreground font-mono">Loading weapon skills…</div>;
  const def: WeaponTypeDef | undefined = skillsData.weaponTypes[equippedWeapon];
  if (!def) return <div className="p-4 text-xs text-muted-foreground font-mono">No data for {equippedWeapon}.</div>;
  return (
    <div className="p-4 space-y-4">
      <div>
        <p className="font-serif text-[10px] uppercase tracking-widest text-muted-foreground">Weapon Skills</p>
        <p className="font-serif text-base tracking-widest uppercase" style={{ color }}>{def.name}</p>
      </div>
      {def.slots.map((slot) => (
        <div key={slot.type} className="space-y-2">
          <p className="text-[10px] font-mono tracking-[0.3em] uppercase text-muted-foreground">{slot.label} · unlock t{slot.unlockTier}</p>
          <div className="space-y-1.5">
            {slot.skills.map((s: WeaponSkill) => (
              <div key={s.id} className="p-2 rounded border" style={{ borderColor: `${color}22`, background: "#0a0a0c" }}>
                <div className="flex justify-between items-baseline">
                  <span className="font-serif text-xs" style={{ color }}>{s.name}</span>
                  <span className="text-[9px] font-mono text-muted-foreground">
                    T{s.tier} · {s.damage} dmg · {s.cooldown}s
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">{s.description}</p>
                {s.effects?.length > 0 && (
                  <p className="text-[9px] font-mono mt-1" style={{ color: `${color}99` }}>
                    {s.effects.join(" · ")}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function StubPanel({ title, hint, color }: { title: string; hint: string; color: string }) {
  return (
    <div className="p-6 flex flex-col items-center justify-center text-center h-full gap-3">
      <p className="font-serif text-sm tracking-widest uppercase" style={{ color }}>{title}</p>
      <p className="text-xs text-muted-foreground font-serif max-w-xs">{hint}</p>
      <p className="text-[10px] font-mono tracking-widest uppercase text-muted-foreground/60 mt-3">— Coming soon —</p>
    </div>
  );
}
