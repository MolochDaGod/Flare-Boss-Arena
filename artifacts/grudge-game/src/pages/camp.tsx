import { Component, useCallback, useEffect, useMemo, useRef, useState, type ErrorInfo, type ReactNode } from "react";
import { useLocation } from "wouter";
import { getPlayableCharacter } from "@/data/playableIdentity";
import { getActiveFighterId, DEFAULT_FIGHTER_ID } from "@/data/fighters";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Flame,
  LayoutGrid,
  Loader2,
  MapPin,
  Skull,
  Sparkles,
  Swords,
  DoorOpen,
  Wrench,
  Target,
} from "lucide-react";
import { CampScene, type CampStateUpdate, type CampStationId } from "@/game/CampScene";
import type { CampStationCategory } from "@/data/campTown";
import { MainPanel, useMainPanelHotkeys, MAIN_PANEL_KEYS, type CharSummary, type PanelKey } from "@/components/MainPanel";
import { CLASS_STARTER_WEAPON } from "@/data/starterGear";
import { useResolvedSkills } from "@/data/skillsResolver";
import { skillIconSrc } from "@/data/skillIcons";
import { WarningBanner } from "@/components/CraftpixUI";
import { UnifiedCombatHud } from "@/components/UnifiedCombatHud";
import { fromCampState } from "@/data/combatHudAdapters";
import type { HudSkillSlot } from "@/data/combatHudModel";

class CampErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; message: string }> {
  state = { hasError: false, message: "" };
  static getDerivedStateFromError(err: Error) {
    return { hasError: true, message: err.message };
  }
  componentDidCatch(_err: Error, _info: ErrorInfo) {}
  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 bg-black flex flex-col items-center justify-center gap-6 z-50 p-6">
          <WarningBanner title="Camp Unavailable" className="max-w-md w-full">
            {this.state.message || "WebGL is required to enter the camp."}
          </WarningBanner>
          <button
            className="font-serif text-xs tracking-widest uppercase text-primary border border-primary/40 px-6 py-2 rounded hover:bg-primary/10 transition-colors"
            onClick={() => window.history.back()}
          >
            Return
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const STATION_TO_PANEL: Partial<Record<CampStationId, PanelKey>> = {
  anvil: "crafting",
  skills: "skills",
  stats: "attributes",
  quests: "quests",
  stash: "equipment",
  perk_machines: "skills",
  perk_firebug: "skills",
  perk_medic: "skills",
  perk_support: "skills",
  perk_gunslinger: "skills",
  weapon_panel: "equipment",
};

const PERK_STATIONS: CampStationId[] = [
  "perk_machines",
  "gumball",
  "perk_firebug",
  "perk_medic",
  "perk_support",
  "perk_gunslinger",
];

// ─── Stone/gold HUD theme (shared with the dungeon HUD) ─────────────────────────
const GOLD = "#c5a059";
const stonePanel: React.CSSProperties = {
  background: "linear-gradient(to bottom, #2a2a2a, #111)",
  border: `2px solid ${GOLD}`,
  boxShadow: "inset 0 0 10px #000, 0 0 12px rgba(0,0,0,0.8), inset 1px 1px 0 rgba(255,255,255,0.18)",
  borderRadius: 8,
};
const CATEGORY_STYLE: Record<
  CampStationCategory,
  { accent: string; bg: string; Icon: typeof Sparkles; label: string }
> = {
  service: { accent: "#66ddaa", bg: "rgba(102,221,170,0.12)", Icon: Wrench, label: "Service" },
  portal: { accent: "#ff6644", bg: "rgba(255,102,68,0.12)", Icon: DoorOpen, label: "Portal" },
  perk: { accent: "#ff88cc", bg: "rgba(255,136,204,0.12)", Icon: Sparkles, label: "Perk" },
  training: { accent: "#f59e0b", bg: "rgba(245,158,11,0.12)", Icon: Target, label: "Training" },
  boss: { accent: "#ff22aa", bg: "rgba(255,34,170,0.18)", Icon: Skull, label: "Boss Sigil" },
};

function hexColor(n: number) {
  return `#${n.toString(16).padStart(6, "0")}`;
}

function CampMinimap({ state }: { state: CampStateUpdate }) {
  const size = 128;
  const pad = 10;
  const inner = size - pad * 2;
  const toPx = (nx: number, nz: number) => ({
    left: pad + ((nx + 1) / 2) * inner,
    top: pad + ((nz + 1) / 2) * inner,
  });
  const player = toPx(state.playerMapX, state.playerMapZ);
  return (
    <div
      className="pointer-events-none absolute top-16 right-4 z-10 rounded-lg border border-white/15 bg-black/70 backdrop-blur-sm p-2"
      style={{ width: size + 8 }}
    >
      <p className="text-[8px] font-serif uppercase tracking-[0.2em] text-[#c5a059] mb-1.5 text-center">
        Harbor Map
      </p>
      <div
        className="relative mx-auto rounded-full border border-white/10 bg-[#0a0a12]"
        style={{ width: size, height: size }}
      >
        <div className="absolute inset-[18%] rounded-full border border-dashed border-white/10" />
        {state.mapMarkers.map((m) => {
          const p = toPx(m.nx, m.nz);
          const col = hexColor(m.color);
          return (
            <span
              key={`${m.id}-${m.nx}`}
              className="absolute rounded-full -translate-x-1/2 -translate-y-1/2"
              style={{
                left: p.left,
                top: p.top,
                width: m.category === "boss" ? 7 : 5,
                height: m.category === "boss" ? 7 : 5,
                background: col,
                boxShadow: `0 0 6px ${col}`,
              }}
              title={m.id}
            />
          );
        })}
        <span
          className="absolute rounded-full -translate-x-1/2 -translate-y-1/2 border-2 border-white bg-[#c5a059]"
          style={{ left: player.left, top: player.top, width: 8, height: 8 }}
        />
      </div>
    </div>
  );
}

function Rivets() {
  const dot: React.CSSProperties = {
    position: "absolute",
    width: 6,
    height: 6,
    background: GOLD,
    border: "1px solid #fff",
    boxShadow: "0 0 3px " + GOLD,
    borderRadius: 1,
  };
  return (
    <>
      <span style={{ ...dot, top: 3, left: 3 }} />
      <span style={{ ...dot, top: 3, right: 3 }} />
      <span style={{ ...dot, bottom: 3, left: 3 }} />
      <span style={{ ...dot, bottom: 3, right: 3 }} />
    </>
  );
}

function Camp() {
  const [, setLocation] = useLocation();
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<CampScene | null>(null);

  const [state, setState] = useState<CampStateUpdate | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelTab, setPanelTab] = useState<PanelKey>("equipment");
  const [showHint, setShowHint] = useState(true);
  const [perkToast, setPerkToast] = useState<string | null>(null);

  useMainPanelHotkeys(
    () => setPanelOpen((v) => !v),
    () => setPanelOpen(false),
    panelOpen,
    (idx) => {
      const k = MAIN_PANEL_KEYS[idx];
      if (k) setPanelTab(k);
    },
  );

  const fighterId = getActiveFighterId() ?? DEFAULT_FIGHTER_ID;
  const char = useMemo(() => getPlayableCharacter(), [fighterId]);

  // Resolve class + weapon skills for the camp HUD skill bar.
  const hudClass = String(char.class ?? "warrior").toLowerCase();
  const hudMainCategory = hudClass ? CLASS_STARTER_WEAPON[hudClass]?.category : null;
  const { classSkills: hudClassSkills, weaponSlots: hudWeaponSlots } = useResolvedSkills(hudClass, hudMainCategory);

  const handleState = useCallback((s: CampStateUpdate) => setState(s), []);

  const handleEngage = useCallback(
    (id: CampStationId) => {
      if (id === "portal_dungeon") {
        setLocation("/game");
        return;
      }
      if (id === "portal_boss") {
        setLocation("/boss");
        return;
      }
      if (id === "gumball") {
        setPerkToast("Gumball spun — perk roll coming soon!");
        window.setTimeout(() => setPerkToast(null), 2800);
        return;
      }
      if (PERK_STATIONS.includes(id)) {
        // Route to full perk shop — machines sell real combat mods.
        setLocation("/perks");
        setPerkToast(`Opening ${id.replace("perk_", "").replace("_", " ")} perks…`);
        window.setTimeout(() => setPerkToast(null), 1800);
      }
      const panel = STATION_TO_PANEL[id];
      if (panel) {
        setPanelTab(panel);
        setPanelOpen(true);
      }
    },
    [setLocation],
  );

  useEffect(() => {
    if (!mountRef.current) return;
    const c = char as unknown as Record<string, unknown>;
    const attrs = (c.attributes as Record<string, number>) ?? {};
    const level = Number(c.level ?? 1);
    const scene = new CampScene({
      className: c.class as string,
      raceKey: c.race as string,
      level,
      maxHp: 400 + (attrs.Vitality ?? 0) * 40 + level * 40,
      maxMana: 150 + (attrs.Intellect ?? 0) * 20 + level * 15,
      baseDamage: 28 + (attrs.Strength ?? 0) * 4 + level * 4,
      critChance: 0.12 + (attrs.Dexterity ?? 0) * 0.01,
      onStateUpdate: handleState,
      onStationEngage: handleEngage,
    });
    scene.init(mountRef.current);
    scene.setHudSkills(hudClassSkills?.skills.slice(0, 5) ?? []);
    sceneRef.current = scene;
    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fighterId]);

  // Keep the scene's archetype mapping in sync with resolved class skills.
  useEffect(() => {
    sceneRef.current?.setHudSkills(hudClassSkills?.skills.slice(0, 5) ?? []);
  }, [hudClassSkills]);

  useEffect(() => {
    const t = setTimeout(() => setShowHint(false), 7500);
    return () => clearTimeout(t);
  }, []);

  const charSummary = useMemo<CharSummary>(() => ({
    name: char.name,
    race: char.race,
    class: char.class,
    level: char.level,
    faction: char.faction,
    attributes: char.attributes,
    equipment: char.equipment,
  }), [char]);

  const loaded = state?.loaded ?? false;
  const nearby = state?.nearbyStationLabel ?? null;
  const nearbyCat = state?.nearbyStationCategory ?? null;
  const catStyle = nearbyCat ? CATEGORY_STYLE[nearbyCat] : null;
  const isBossSigil = state?.nearbyStationId === "portal_boss";


  return (
    <div className="fixed inset-0 bg-black flex flex-col" style={{ zIndex: 50 }}>
      <div ref={mountRef} className="absolute inset-0" style={{ cursor: "crosshair" }} />

      {/* Loading overlay */}
      {!loaded && (
        <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center gap-4 z-20">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="font-serif text-primary uppercase tracking-widest text-sm animate-pulse">Kindling the Camp...</p>
        </div>
      )}

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 flex items-start justify-between px-4 pt-3 z-10 pointer-events-none">
        <button
          className="pointer-events-auto flex items-center gap-2 px-3 py-1.5 bg-black/60 border border-white/10 rounded text-xs font-serif tracking-widest uppercase text-muted-foreground hover:text-white hover:border-white/30 transition-colors backdrop-blur-sm"
          onClick={() => setLocation("/")}
        >
          <ArrowLeft className="w-3 h-3" />
          War Panel
        </button>

        <div className="flex items-center gap-2 px-3 py-1.5 bg-black/55 border border-primary/30 rounded backdrop-blur-sm">
          <Flame className="w-3.5 h-3.5 text-primary" />
          <p className="text-[10px] font-serif uppercase tracking-[0.25em] text-primary">Grudge Harbor</p>
        </div>

        <div className="pointer-events-auto bg-black/60 border border-white/10 backdrop-blur-sm rounded px-3 py-1.5 text-right">
          <p className="text-[10px] font-serif uppercase tracking-widest text-primary">{char.name as string}</p>
          <p className="text-[9px] font-mono text-muted-foreground">
            Lv {(char.level as number) ?? 1} · {char.race as string} {char.class as string}
          </p>
        </div>
      </div>

      {state && loaded && <CampMinimap state={state} />}

      {/* Engage prompt — district-aware station cards */}
      <AnimatePresence>
        {loaded && nearby && catStyle && (
          <motion.div
            key={state?.nearbyStationId}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            className="absolute left-1/2 -translate-x-1/2 z-10 pointer-events-none w-[min(92vw,26rem)]"
            style={{ bottom: isBossSigil ? "34%" : "28%" }}
          >
            <div
              className="rounded-lg px-5 py-4 text-center backdrop-blur-md shadow-lg"
              style={{
                background: isBossSigil
                  ? "linear-gradient(180deg, rgba(40,8,32,0.92), rgba(10,5,12,0.95))"
                  : "rgba(0,0,0,0.82)",
                border: `2px solid ${catStyle.accent}`,
                boxShadow: `0 0 32px -6px ${catStyle.accent}88`,
              }}
            >
              <div className="flex items-center justify-center gap-2 mb-2">
                <span
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[9px] font-serif uppercase tracking-widest"
                  style={{ background: catStyle.bg, color: catStyle.accent }}
                >
                  <catStyle.Icon className="w-3 h-3" />
                  {catStyle.label}
                </span>
                {state?.nearbyStationDistrict && (
                  <span className="inline-flex items-center gap-1 text-[9px] font-mono text-muted-foreground/90">
                    <MapPin className="w-3 h-3" />
                    {state.nearbyStationDistrict}
                  </span>
                )}
              </div>
              <p className="font-serif uppercase tracking-widest text-lg" style={{ color: catStyle.accent }}>
                {nearby}
              </p>
              {state?.nearbyStationHint && (
                <p className="text-[11px] font-mono text-muted-foreground/90 mt-2 leading-relaxed">
                  {state.nearbyStationHint}
                </p>
              )}
              {isBossSigil && (
                <ul className="mt-3 text-left text-[10px] font-mono text-fuchsia-200/80 space-y-1 max-w-xs mx-auto">
                  <li>· Procedural elemental boss each run</li>
                  <li>· Telegraph dodge windows + phase bursts</li>
                  <li>· Spoils feed your session wallet</li>
                </ul>
              )}
              <div className="mt-3 inline-flex items-center gap-2">
                <kbd
                  className="font-mono text-[10px] tracking-widest px-2.5 py-1 rounded border"
                  style={{ borderColor: `${catStyle.accent}99`, color: catStyle.accent, background: catStyle.bg }}
                >
                  {state?.promptKey ?? "E"}
                </kbd>
                <span className="text-[11px] font-serif tracking-widest uppercase text-white/90">
                  {state?.nearbyStationAction ?? "Engage"}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {perkToast && (
          <motion.div
            key={perkToast}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="absolute top-24 left-1/2 -translate-x-1/2 z-20 pointer-events-none"
          >
            <div className="bg-black/85 border border-amber-500/50 rounded px-4 py-2 text-center backdrop-blur-sm">
              <p className="text-xs font-serif tracking-widest uppercase text-amber-300">{perkToast}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Unified combat HUD — camp training ground */}
      {state && loaded && (
        <UnifiedCombatHud
          state={fromCampState(state, {
            charName: String(char.name ?? "Fighter"),
            raceClass: `${String(char.race ?? "")} ${String(char.class ?? "")}`.trim(),
            skills: (() => {
              const slots: HudSkillSlot[] = [];
              for (const s of hudClassSkills?.skills.slice(0, 5) ?? []) {
                slots.push({
                  id: s.id,
                  name: s.name,
                  key: String(slots.length + 1),
                  glyph: s.glyph as string | undefined,
                  icon: skillIconSrc(s.icon) ?? undefined,
                  isSignature: s.isSignature,
                  readyPct: state.skillCooldownPct[slots.length] ?? 1,
                });
              }
              for (const slot of hudWeaponSlots) {
                if (slots.length >= 5) break;
                const sk = slot.skills[0];
                if (!sk) continue;
                slots.push({
                  id: sk.id ?? slot.type,
                  name: sk.name ?? slot.label,
                  key: String(slots.length + 1),
                  glyph: "⚔",
                  icon: skillIconSrc(sk.icon) ?? undefined,
                  readyPct: state.skillCooldownPct[slots.length] ?? 1,
                });
              }
              return slots;
            })(),
          })}
          onSkill={(idx) => sceneRef.current?.useSkill(idx)}
          onAttack={() => sceneRef.current?.attackNearest()}
          bottomActions={
            <>
              <button
                type="button"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] tracking-widest uppercase"
                style={{ border: "1px solid rgba(197,160,89,0.4)", background: "rgba(13,18,24,0.7)", color: GOLD }}
                onClick={() => setPanelOpen(true)}
              >
                <LayoutGrid className="w-3.5 h-3.5" /> C
              </button>
              <button
                type="button"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] tracking-widest uppercase"
                style={{ border: "1px solid rgba(239,68,68,0.4)", background: "rgba(13,18,24,0.7)", color: "#fca5a5" }}
                onClick={() => setLocation("/game")}
              >
                <Swords className="w-3.5 h-3.5" /> Dungeon
              </button>
              <button
                type="button"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] tracking-widest uppercase"
                style={{ border: "1px solid rgba(217,70,239,0.4)", background: "rgba(13,18,24,0.7)", color: "#e879f9" }}
                onClick={() => setLocation("/boss")}
              >
                <Skull className="w-3.5 h-3.5" /> Boss
              </button>
            </>
          }
        />
      )}

      {/* MainPanel overlay */}
      {charSummary && (
        <MainPanel
          open={panelOpen}
          onClose={() => setPanelOpen(false)}
          activeTab={panelTab}
          onActiveTabChange={setPanelTab}
          character={charSummary}
        />
      )}

      {/* Hint */}
      <AnimatePresence>
        {showHint && loaded && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute top-14 left-1/2 -translate-x-1/2 z-10 pointer-events-none"
          >
            <div className="bg-black/75 border border-white/10 rounded px-5 py-3 text-center backdrop-blur-sm space-y-1">
              <p className="text-[10px] font-serif text-primary uppercase tracking-widest mb-1">Grudge Harbor</p>
              <p className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase">Explore the town — WASD / Arrows</p>
              <p className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase">SE Yard — spar dummies · F to attack</p>
              <p className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase">West Sigil — Boss Arena · South — Dungeon</p>
              <p className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase">E — Engage stations · C — War Panel</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function CampWithBoundary() {
  return (
    <CampErrorBoundary>
      <Camp />
    </CampErrorBoundary>
  );
}
