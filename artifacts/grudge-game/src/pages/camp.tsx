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
import { SkillIcon } from "@/components/SkillIcon";
import { BarGauge, OrbGauge, Separator, WarningBanner } from "@/components/CraftpixUI";

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

  const hpPct = state ? (state.playerHp / state.playerMaxHp) * 100 : 100;
  const manaPct = state ? (state.playerMana / state.playerMaxMana) * 100 : 100;
  const atkPct = state ? state.attackCooldownPct * 100 : 100;
  const hpColor = hpPct > 50 ? "#22c55e" : hpPct > 25 ? "#f59e0b" : "#ef4444";

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

      {/* Player HUD — bottom left */}
      {state && loaded && (
        <div className="absolute bottom-4 left-4 z-10 w-60 px-3.5 py-3" style={stonePanel}>
          <Rivets />
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-serif text-sm tracking-widest uppercase" style={{ color: GOLD }}>{char.name as string}</span>
            <span className="font-serif text-xs text-muted-foreground tracking-widest">Lv {state.playerLevel}</span>
          </div>
          <Separator className="mb-2.5 opacity-80" />
          <div className="flex items-stretch gap-3">
            <OrbGauge pct={hpPct} color={hpColor} size={58} className="self-center shrink-0" />
            <div className="flex-1 min-w-0 space-y-1.5">
              {/* HP */}
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-mono uppercase text-muted-foreground tracking-widest">HP</span>
                <span className="text-[10px] font-mono" style={{ color: hpColor }}>
                  {Math.round(state.playerHp)} / {state.playerMaxHp}
                </span>
              </div>
              <BarGauge pct={hpPct} color={hpColor} height={15} />
              {/* Mana */}
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-mono uppercase text-muted-foreground tracking-widest">MP</span>
                <span className="text-[10px] font-mono text-blue-400">
                  {Math.round(state.playerMana)} / {state.playerMaxMana}
                </span>
              </div>
              <BarGauge pct={manaPct} color="#3b82f6" height={12} />
              {/* Attack cooldown strip */}
              <BarGauge pct={atkPct} color="#ffaa00" height={9} glow={false} />
            </div>
          </div>
        </div>
      )}

      {/* Combat log — bottom right */}
      {state && state.combatLog.length > 0 && (
        <div className="absolute bottom-4 right-4 z-10 w-72 space-y-1 pointer-events-none">
          <AnimatePresence initial={false}>
            {state.combatLog.slice(0, 7).map((msg, i) => (
              <motion.div
                key={msg + i}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: Math.max(0.15, 1 - i * 0.12), x: 0 }}
                exit={{ opacity: 0 }}
                className="text-right text-[11px] font-serif tracking-wide"
                style={{ color: msg.includes("shattered") ? "#f59e0b" : msg.includes("mana") ? "#60a5fa" : "#d1d5db" }}
              >
                {msg}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Dummy health bars */}
      {state && state.dummies.map((d) => {
        if (!d.alive) return null;
        if (d.screenX < 0 || d.screenX > window.innerWidth || d.screenY < 0 || d.screenY > window.innerHeight) return null;
        const pct = (d.hp / d.maxHp) * 100;
        const col = pct > 50 ? "#22c55e" : pct > 25 ? "#f59e0b" : "#ef4444";
        return (
          <div key={d.id} className="absolute pointer-events-none z-10" style={{ left: d.screenX - 44, top: d.screenY - 28, width: 88 }}>
            <p className="text-center text-[9px] font-serif tracking-widest uppercase mb-0.5 truncate text-amber-200/80">{d.name}</p>
            <div className="h-1.5 bg-black/70 border border-white/10 rounded-sm overflow-hidden">
              <div className="h-full rounded-sm transition-all duration-150" style={{ width: `${pct}%`, background: col }} />
            </div>
          </div>
        );
      })}

      {/* Floating damage numbers */}
      {state && state.damageNumbers.map((d) => (
        <div
          key={d.id}
          className="absolute pointer-events-none font-mono font-bold z-20 select-none"
          style={{
            left: d.x,
            top: d.y,
            fontSize: d.isCrit ? 20 : 14,
            color: d.isCrit ? "#ff6600" : "#ffffff",
            textShadow: "0 1px 4px rgba(0,0,0,0.9)",
            opacity: Math.max(0, 1 - d.age / 1.4),
            transform: `translate(-50%, -${d.age * 32}px)`,
          }}
        >
          {d.isCrit ? `${d.value}!` : `-${d.value}`}
        </div>
      ))}

      {/* Skill bar — class + weapon skills (click or press 1–5) */}
      {state && loaded && (hudClassSkills || hudWeaponSlots.length > 0) && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-10 flex items-end gap-4">
          {hudClassSkills && (
            <div className="flex flex-col items-center gap-1">
              <span className="text-[9px] font-serif tracking-widest uppercase" style={{ color: GOLD }}>Class · {hudClassSkills.name}</span>
              <div className="flex gap-1.5">
                {hudClassSkills.skills.slice(0, 5).map((s, i) => {
                  const cd = state.skillCooldownPct[i] ?? 1;
                  const ready = cd >= 1;
                  return (
                    <button
                      key={s.id}
                      title={`${s.name}${s.cooldown ? ` · CD ${s.cooldown}` : ""}\n${s.description}`}
                      onClick={() => sceneRef.current?.useSkill(i)}
                      className="relative w-11 h-11 rounded flex items-center justify-center text-lg bg-black border-2 border-neutral-700 hover:border-[#c5a059] hover:scale-105 transition-all overflow-hidden"
                      style={{ boxShadow: "inset 0 0 5px #000" }}
                    >
                      <SkillIcon icon={s.icon} glyph={s.glyph} size={40} radius={4} />
                      <span className="absolute top-0.5 left-1 text-[9px] font-serif text-neutral-400">{i + 1}</span>
                      {s.isSignature && <span className="absolute -bottom-1 -right-1 text-[9px] leading-none" style={{ color: GOLD }}>★</span>}
                      {!ready && (
                        <span className="absolute inset-0 bg-black/70" style={{ clipPath: `inset(0 0 ${cd * 100}% 0)` }} />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {hudWeaponSlots.length > 0 && (
            <div className="flex flex-col items-center gap-1">
              <span className="text-[9px] font-serif tracking-widest uppercase" style={{ color: GOLD }}>Weapon</span>
              <div className="flex gap-1.5">
                {hudWeaponSlots.map((slot, j) => {
                  const sk = slot.skills[0];
                  if (!sk) return null;
                  const slotIdx = Math.min(4, (hudClassSkills?.skills.length ?? 0) + j);
                  return (
                    <button
                      key={slot.type}
                      title={`${slot.label}: ${sk.name}${sk.cooldown ? ` · CD ${sk.cooldown}` : ""}\n${sk.description}`}
                      onClick={() => sceneRef.current?.useSkill(slotIdx)}
                      className="w-11 h-11 rounded flex items-center justify-center overflow-hidden bg-black border-2 border-neutral-700 hover:border-[#c5a059] hover:scale-105 transition-all"
                      style={{ boxShadow: "inset 0 0 5px #000" }}
                    >
                      <SkillIcon icon={sk.icon} glyph="⚔️" size={28} radius={4} />
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Action buttons — bottom centre */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex gap-3 px-4 py-2.5" style={stonePanel}>
        <Rivets />
        <button
          className="flex flex-col items-center gap-1 px-4 py-2 rounded font-serif text-xs tracking-widest uppercase bg-black/40 border border-[#c5a059]/60 text-[#c5a059] hover:bg-[#c5a059]/15 hover:border-[#c5a059] transition-all active:scale-95"
          onClick={() => sceneRef.current?.attackNearest()}
        >
          <Swords className="w-4 h-4" />
          <span>Attack [F]</span>
        </button>
        <button
          className="flex flex-col items-center gap-1 px-4 py-2 rounded font-serif text-xs tracking-widest uppercase bg-black/40 border border-neutral-700 text-muted-foreground hover:border-[#c5a059]/70 hover:text-[#c5a059] transition-all active:scale-95"
          onClick={() => setPanelOpen(true)}
        >
          <LayoutGrid className="w-4 h-4" />
          <span>Panel [C]</span>
        </button>
        <button
          className="flex flex-col items-center gap-1 px-4 py-2 rounded font-serif text-xs tracking-widest uppercase bg-black/40 border border-red-500/50 text-red-300 hover:bg-red-500/15 hover:border-red-500 transition-all active:scale-95"
          onClick={() => setLocation("/game")}
        >
          <Swords className="w-4 h-4" />
          <span>Dungeon</span>
        </button>
        <button
          className="flex flex-col items-center gap-1 px-4 py-2 rounded font-serif text-xs tracking-widest uppercase bg-black/40 border border-fuchsia-500/50 text-fuchsia-300 hover:bg-fuchsia-500/15 hover:border-fuchsia-500 transition-all active:scale-95"
          onClick={() => setLocation("/boss")}
        >
          <Skull className="w-4 h-4" />
          <span>Boss</span>
        </button>
      </div>

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
