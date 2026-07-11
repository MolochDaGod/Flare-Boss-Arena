import { useEffect, useRef, useState, useCallback, Component, useMemo, type ReactNode, type ErrorInfo } from "react";
import { useLocation } from "wouter";
import { useGetEnemies, useGetClasses, useGetWeapons } from "@workspace/api-client-react";
import { GameEngine, type GameState, type EnemyTemplate, type PlayerInitStats } from "@/game/GameEngine";
import { Loader2, ArrowLeft, Swords, Zap, Shield, Crosshair, LayoutGrid } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { MainPanel, useMainPanelHotkeys, MAIN_PANEL_KEYS, type CharSummary, type PanelKey } from "@/components/MainPanel";
import { getSelectedSkin } from "@/data/skins";
import { getActiveFighter } from "@/data/fighters";
import { getPlayableCharacter } from "@/data/playableIdentity";
import { SkillIcon } from "@/components/SkillIcon";
import { WarningBanner } from "@/components/CraftpixUI";
import { getWallet, saveWallet } from "@/data/wallet";
import {
  VENDOR_GOODS,
  getResources,
  addResource,
  spendResource,
  spendResources,
} from "@/data/resources";
import { getGameLoadout, loadoutSkillBar } from "@/data/gameCombat";
import { toast } from "sonner";
import { useSystemsHotkey } from "@/hooks/useSystemsHotkey";
import { GameEscapeMenu, SystemHub } from "@/components/SystemHub";
import { GameCombatHud } from "@/components/GameCombatHud";

// ─── Error Boundary ────────────────────────────────────────────────────────────
class GameErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; message: string }> {
  state = { hasError: false, message: "" };
  static getDerivedStateFromError(err: Error) {
    return { hasError: true, message: err.message };
  }
  componentDidCatch(_err: Error, _info: ErrorInfo) {}
  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 bg-black flex flex-col items-center justify-center gap-6 z-50 p-6">
          <WarningBanner title="Dungeon Unavailable" className="max-w-md w-full">
            {this.state.message || "WebGL is required to enter the dungeon."}
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

// ─── Data helpers ──────────────────────────────────────────────────────────────

/** Build EnemyTemplate[] from the R2 enemies JSON (categories → items) */
function buildEnemyTemplates(enemiesData: unknown): EnemyTemplate[] {
  if (!enemiesData || typeof enemiesData !== "object") return [];
  const d = enemiesData as Record<string, unknown>;
  const categories = d.categories as Record<string, { items?: unknown[] }> | undefined;
  if (!categories) return [];

  const templates: EnemyTemplate[] = [];
  for (const cat of Object.values(categories)) {
    for (const raw of cat.items ?? []) {
      const e = raw as Record<string, unknown>;
      templates.push({
        id: String(e.id ?? ""),
        name: String(e.name ?? e.id ?? "Unknown"),
        type: String(e.type ?? "beast"),
        tier: Number(e.tier ?? 1),
        hp: Number(e.hp ?? 100),
        damage: Number(e.damage ?? 10),
      });
    }
  }
  return templates;
}

/** Compute real player stats from class data + character attributes + equipped weapon */
function computePlayerStats(
  char: Record<string, unknown>,
  classesData: unknown,
  weaponsData: unknown,
): PlayerInitStats {
  const attrs = (char.attributes as Record<string, number>) ?? {};
  const level = Number(char.level ?? 1);
  const charClass = String(char.class ?? "warrior").toLowerCase();
  const charRace = String(char.race ?? "human");
  const charName = String(char.name ?? "Fighter");

  // Class base attributes from R2
  const classes = (classesData as Record<string, unknown>)?.classes as Record<string, Record<string, unknown>> | undefined;
  const classData = classes?.[charClass] ?? classes?.["warrior"];
  const classStart = (classData?.startingAttributes as Record<string, number>) ?? {};

  // Merged attributes: class base + character's stored attributes
  const str = (classStart.Strength ?? 5)  + (attrs.Strength ?? 0);
  const vit = (classStart.Vitality ?? 3)  + (attrs.Vitality ?? 0);
  const end_ = (classStart.Endurance ?? 2) + (attrs.Endurance ?? 0);
  const dex = (classStart.Dexterity ?? 1) + (attrs.Dexterity ?? 0);
  const agi = (classStart.Agility ?? 1)   + (attrs.Agility ?? 0);
  const int_ = (classStart.Intellect ?? 0) + (attrs.Intellect ?? 0);
  const wis = (classStart.Wisdom ?? 0)    + (attrs.Wisdom ?? 0);

  // Base stat formulas
  const baseHp = 200 + vit * 50 + end_ * 20 + level * 20;
  const baseMana = 100 + int_ * 20 + wis * 10 + level * 10;
  let baseDamage = 15 + str * 4 + dex * 2 + agi * 1 + level * 3;
  let defense = 5 + end_ * 2 + level * 1;
  let critChance = 0.10 + dex * 0.01 + agi * 0.005;
  let attackSpeed = 0.80 - dex * 0.01;

  // Equipped weapon — pull from weaponsData using the mainHand item id
  const equipment = (char.equipment as Record<string, string>) ?? {};
  const mainHandId = equipment.mainHand;
  if (mainHandId && weaponsData && typeof weaponsData === "object") {
    const wd = weaponsData as Record<string, unknown>;
    const cats = wd.categories as Record<string, { items?: unknown[] }> | undefined;
    if (cats) {
      outer: for (const cat of Object.values(cats)) {
        for (const raw of cat.items ?? []) {
          const w = raw as Record<string, unknown>;
          if (w.id === mainHandId) {
            const ws = w.stats as Record<string, number> | undefined;
            if (ws) {
              baseDamage += ws.damageBase ?? 0;
              critChance += (ws.critBase ?? 0) / 100;
              attackSpeed = Math.max(0.3, attackSpeed - (ws.speedBase ?? 0) / 1000);
            }
            break outer;
          }
        }
      }
    }
  }

  // Equipped armor — sum defense from all armor slots
  if (char.equipment && typeof weaponsData === "object") {
    // Defense bonus from equipped armor approximated from endurance/level for now
    defense += level * 2;
  }

  return {
    hp: Math.round(baseHp),
    mana: Math.round(baseMana),
    level,
    baseDamage: Math.round(baseDamage),
    defense: Math.round(defense),
    critChance: Math.min(0.60, critChance),
    attackSpeed: Math.max(0.30, Math.min(1.5, attackSpeed)),
    charName,
    charClass,
    charRace,
  };
}

// ─── Tier colours ──────────────────────────────────────────────────────────────
const TIER_COLORS: Record<number, string> = {
  1: "#9ca3af", 2: "#22c55e", 3: "#3b82f6",
  4: "#a855f7", 5: "#f59e0b", 6: "#f97316",
  7: "#ef4444", 8: "#ec4899",
};

// ─── Stone/gold HUD theme (per UIlayer mockup) ──────────────────────────────────
const GOLD = "#c5a059";
// Forged-stone panel: dark gradient, gold rim, inset shadow + top highlight.
const stonePanel: React.CSSProperties = {
  background: "linear-gradient(to bottom, #2a2a2a, #111)",
  border: `2px solid ${GOLD}`,
  boxShadow:
    "inset 0 0 10px #000, 0 0 12px rgba(0,0,0,0.8), inset 1px 1px 0 rgba(255,255,255,0.18)",
  borderRadius: 8,
};
// Gold corner rivets — purely decorative, absolutely positioned inside a panel.
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

// ─── Main Game component ───────────────────────────────────────────────────────
function Game() {
  const [, setLocation] = useLocation();
  const mountRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [showControls, setShowControls] = useState(true);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelTab, setPanelTab] = useState<PanelKey>("equipment");
  const [vendorOpen, setVendorOpen] = useState(false);
  const [bagTick, setBagTick] = useState(0);
  useMainPanelHotkeys(
    () => setPanelOpen((v) => !v),
    () => setPanelOpen(false),
    panelOpen,
    (idx) => { const k = MAIN_PANEL_KEYS[idx]; if (k) setPanelTab(k); },
  );

  const { data: enemiesData } = useGetEnemies();
  const { data: classesData } = useGetClasses();
  const { data: weaponsData } = useGetWeapons();

  const char = getPlayableCharacter();

  // Engine already throttles HUD pushes (~18 Hz). Cap React commits further so a
  // burst of force-notifies (damage/crit) cannot schedule 60 React trees/sec.
  const lastUiPushRef = useRef(0);
  const pendingStateRef = useRef<GameState | null>(null);
  const uiRafRef = useRef(0);
  const handleStateUpdate = useCallback((state: GameState) => {
    pendingStateRef.current = state;
    const now = performance.now();
    const minGap = 1000 / 20; // 20 Hz max into React
    if (now - lastUiPushRef.current < minGap) {
      if (!uiRafRef.current) {
        uiRafRef.current = requestAnimationFrame(() => {
          uiRafRef.current = 0;
          lastUiPushRef.current = performance.now();
          if (pendingStateRef.current) setGameState(pendingStateRef.current);
        });
      }
      return;
    }
    lastUiPushRef.current = now;
    setGameState(state);
  }, []);

  // Build enemy templates from real R2 data
  const enemyTemplates = useMemo(() => buildEnemyTemplates(enemiesData), [enemiesData]);

  // Compute player stats from real class/weapon data
  const playerStats = useMemo(() => {
    return computePlayerStats(
      char as unknown as Record<string, unknown>,
      classesData,
      weaponsData,
    );
  }, [char, classesData, weaponsData]);

  // Fighter + stones + skill ranks (re-read each visit so socketed stones apply).
  const loadout = useMemo(() => getGameLoadout(getActiveFighter().id), [bagTick]);
  const skillBar = useMemo(() => loadoutSkillBar(loadout), [loadout]);

  const combatStats = useMemo((): PlayerInitStats | null => {
    if (!playerStats) return null;
    return {
      ...playerStats,
      hp: loadout.combat.maxHp,
      mana: loadout.combat.maxMana,
      baseDamage: loadout.combat.baseDamage,
      critChance: loadout.combat.critChance,
      defense: Math.round(playerStats.defense + loadout.combat.defense * 40),
      // Engine treats this as seconds between basic attacks.
      attackSpeed: loadout.combat.attackInterval,
    };
  }, [playerStats, loadout]);

  const ready = enemyTemplates.length > 0 && !!combatStats;

  useEffect(() => {
    if (!mountRef.current || !ready || !combatStats) return;

    const c = char as unknown as Record<string, unknown>;
    const charId = c.id as string | number;
    const skinId =
      getActiveFighter()?.skinId ?? (charId != null ? getSelectedSkin(charId) : null);

    const engine = new GameEngine();
    engine.onStateUpdate = handleStateUpdate;
    engine.onOpenVendor = () => setVendorOpen(true);
    engine.onMapReseed = (seed) => {
      toast.message("Next island — tougher round", {
        description: `Seed #${seed.toString(16)}. Enemies scale up each sail. Equip perks on /perks.`,
      });
      setBagTick((t) => t + 1);
    };
    engine.init(
      mountRef.current,
      {
        ...combatStats,
        skinId,
        equipMainCategory: loadout.weapon.style,
      },
      enemyTemplates,
    );
    engineRef.current = engine;

    return () => {
      if (uiRafRef.current) {
        cancelAnimationFrame(uiRafRef.current);
        uiRafRef.current = 0;
      }
      engine.dispose();
      engineRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  useEffect(() => {
    const t = setTimeout(() => setShowControls(false), 6000);
    return () => clearTimeout(t);
  }, []);

  const [menuOpen, setMenuOpen] = useSystemsHotkey({ alsoEscape: true });
  const [hubOpen, setHubOpen] = useState(false);

  return (
    <div className="fixed inset-0 bg-black flex flex-col" style={{ zIndex: 50 }}>
      {/* 3D canvas */}
      <div ref={mountRef} className="absolute inset-0" style={{ cursor: "crosshair" }} />
      <GameEscapeMenu open={menuOpen} onOpenChange={setMenuOpen} />
      <SystemHub open={hubOpen} onOpenChange={setHubOpen} />

      {/* Loading overlay — held until the dungeon GLB + collision BVH are built */}
      <AnimatePresence>
        {(!gameState || !gameState.loaded || !gameState.mapReady) && (
          <motion.div
            key="dungeon-loading-veil"
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center gap-4 z-20"
          >
            <Loader2
              className="w-16 h-16 animate-spin text-primary drop-shadow-[0_0_18px_rgba(197,160,89,0.35)]"
              aria-label="Loading"
            />
            <p className="font-serif text-primary uppercase tracking-widest text-sm animate-pulse">
              {!ready
                ? "Loading Grudge Data..."
                : !gameState?.loaded
                ? "Summoning your fighter..."
                : "Raising the Dungeon..."}
            </p>
            {playerStats && (
              <div className="text-center space-y-1 mt-2">
                <p className="text-[11px] font-serif tracking-widest text-muted-foreground uppercase">
                  {playerStats.charName} · {playerStats.charRace} {playerStats.charClass}
                </p>
                <p className="text-[10px] font-mono text-muted-foreground/70">
                  HP {playerStats.hp} · MP {playerStats.mana} · DMG {playerStats.baseDamage} · DEF {playerStats.defense}
                </p>
                <p className="text-[10px] font-mono text-muted-foreground/50">
                  CRIT {Math.round(playerStats.critChance * 100)}% · {enemyTemplates.length} enemy types loaded
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top nav only — combat chrome is GameCombatHud (annihilate GrudgeUi style) */}
      <div className="absolute top-0 left-0 z-20 flex items-center gap-2 px-4 pt-3 pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            className="flex items-center gap-2 px-3 py-1.5 bg-black/60 border border-white/10 rounded text-xs font-serif tracking-widest uppercase text-muted-foreground hover:text-white hover:border-white/30 transition-colors backdrop-blur-sm"
            onClick={() => setLocation("/")}
          >
            <ArrowLeft className="w-3 h-3" />
            War Panel
          </button>
          <button
            className="flex items-center gap-2 px-3 py-1.5 bg-black/60 border border-primary/30 rounded text-xs font-serif tracking-widest uppercase text-primary hover:bg-primary/10 transition-colors backdrop-blur-sm"
            onClick={() => setHubOpen(true)}
            title="All systems (M)"
          >
            <LayoutGrid className="w-3 h-3" />
            Systems
          </button>
        </div>
      </div>

      {/* Optimized combat HUD — bars 120ms CSS, state badge, log, world HP ticks */}
      {gameState && gameState.loaded && gameState.mapReady && (
        <GameCombatHud
          state={gameState}
          charName={String(char.name ?? "Fighter")}
          raceClass={`${playerStats?.charRace ?? ""} ${playerStats?.charClass ?? ""}`.trim()}
          skillBar={skillBar.map((s) => ({ id: s.id, name: s.name }))}
          specialReadyPct={gameState.specialReadyPct}
          onSkill={(idx) => {
            if (idx < 0) engineRef.current?.useSpecial();
            else engineRef.current?.selectSkill(idx);
          }}
        />
      )}

      {/* Fighter skill chips — glyph bar above foot controls */}
      {gameState && skillBar.length > 0 && (
        <div className="absolute bottom-[4.5rem] left-1/2 -translate-x-1/2 z-20 flex items-end gap-3 pointer-events-auto">
          <div className="flex flex-col items-center gap-1">
            <span className="text-[9px] font-serif tracking-widest uppercase" style={{ color: GOLD }}>
              {loadout.fighter.name} · {loadout.weapon.glyph} {loadout.weapon.name}
            </span>
            <div className="flex gap-1.5">
              {skillBar.map((s) => {
                const pending = gameState.pendingSkillIdx === s.index;
                return (
                  <div
                    key={s.id}
                    onClick={() => engineRef.current?.selectSkill(s.index)}
                    title={`${s.name}${s.isAoe ? " · key then LMB place" : s.isSlash ? " · slash wave" : ""}\n${s.description}\nMP ${s.manaCost} · CD ${s.cooldown}s`}
                    className="relative w-11 h-11 rounded flex items-center justify-center text-lg bg-black/80 border-2 hover:scale-105 transition-transform overflow-hidden cursor-pointer active:scale-95"
                    style={{
                      borderColor: pending ? "#66ccff" : `${GOLD}99`,
                      boxShadow: pending ? "0 0 12px #66ccff" : "inset 0 0 5px #000",
                    }}
                  >
                    <span className="text-lg leading-none">{s.glyph}</span>
                    <span className="absolute top-0.5 left-1 text-[9px] font-serif text-neutral-400">{s.index + 1}</span>
                    {s.isAoe && (
                      <span className="absolute bottom-0.5 right-0.5 text-[7px] text-cyan-300">AoE</span>
                    )}
                    {s.isSlash && !s.isAoe && (
                      <span className="absolute bottom-0.5 right-0.5 text-[7px] text-amber-300">〜</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex flex-col items-center gap-1">
            <span className="text-[9px] font-serif tracking-widest uppercase" style={{ color: GOLD }}>Special</span>
            <button
              onClick={() => engineRef.current?.useSpecial()}
              title={`${loadout.special.name}\n${loadout.special.description}`}
              className="relative w-12 h-12 rounded flex flex-col items-center justify-center bg-black/80 border-2 border-amber-500/70 hover:border-amber-400 transition-all"
              style={{
                opacity: 0.55 + 0.45 * (gameState.specialReadyPct ?? 1),
                boxShadow: "0 0 10px rgba(255,180,60,0.35)",
              }}
            >
              <span className="text-sm font-serif" style={{ color: GOLD }}>R</span>
              <span className="text-[8px] text-amber-200/90 truncate max-w-[44px]">{loadout.special.name.split(" ")[0]}</span>
            </button>
          </div>
        </div>
      )}

      {/* Compact action strip (pointer-events on shell; annihilate-style chips) */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex gap-2 px-3 py-1.5 rounded-xl pointer-events-auto"
        style={{
          background: "rgba(5,10,16,0.55)",
          border: "1px solid rgba(130,170,206,0.26)",
          backdropFilter: "blur(3px)",
        }}
      >
        <button
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] tracking-widest uppercase text-[#c5a059] hover:-translate-y-0.5 transition-transform"
          style={{ border: "1px solid rgba(197,160,89,0.45)", background: "rgba(13,23,34,0.45)" }}
          onClick={() => engineRef.current?.attackNearest()}
        >
          <Swords className="w-3.5 h-3.5" />
          Atk
        </button>
        <button
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] tracking-widest uppercase text-amber-300 hover:-translate-y-0.5 transition-transform"
          style={{ border: "1px solid rgba(251,191,36,0.4)", background: "rgba(13,23,34,0.45)" }}
          onClick={() => engineRef.current?.useSpecial()}
        >
          <Zap className="w-3.5 h-3.5" />
          R
        </button>
        <button
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] tracking-widest uppercase text-[#9ab0c6] hover:text-[#eaf4ff] hover:-translate-y-0.5 transition-transform"
          style={{ border: "1px solid rgba(140,191,221,0.25)", background: "rgba(13,23,34,0.45)" }}
          onClick={() => setPanelOpen(true)}
        >
          <LayoutGrid className="w-3.5 h-3.5" />
          C
        </button>
        <button
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] tracking-widest uppercase text-[#9ab0c6] hover:text-[#eaf4ff] hover:-translate-y-0.5 transition-transform"
          style={{ border: "1px solid rgba(140,191,221,0.25)", background: "rgba(13,23,34,0.45)" }}
          onClick={() => setLocation("/equipment")}
        >
          <Shield className="w-3.5 h-3.5" />
          Armory
        </button>
        <button
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] tracking-widest uppercase text-[#72bbff] hover:-translate-y-0.5 transition-transform"
          style={{ border: "1px solid rgba(59,130,246,0.4)", background: "rgba(13,23,34,0.45)" }}
          onClick={() => setLocation("/boss")}
        >
          <Zap className="w-3.5 h-3.5" />
          Boss
        </button>
      </div>

      {/* MainPanel overlay (hotkey C) */}
      <MainPanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        activeTab={panelTab}
        onActiveTabChange={setPanelTab}
        character={{
          name: char.name as string,
          race: char.race as string,
          class: char.class as string,
          level: (char.level as number) ?? 1,
          faction: (char as { faction?: string }).faction,
          attributes: (char.attributes as Record<string, number>) ?? {},
          equipment: (char.equipment as Record<string, string | undefined>) ?? {},
        } satisfies CharSummary}
      />

      {/* Anne Bonny — Pirate Cove vendor */}
      <AnimatePresence>
        {vendorOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 p-4"
            onClick={() => setVendorOpen(false)}
          >
            <div
              className="relative max-w-md w-full p-6 space-y-4"
              style={stonePanel}
              onClick={(e) => e.stopPropagation()}
            >
              <Rivets />
              <div className="text-center">
                <h2 className="font-serif text-xl tracking-widest uppercase" style={{ color: GOLD }}>
                  Anne&apos;s Trade Chest
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Sell harvest for gold, or buy with gold / wood / stone.
                </p>
                <p className="text-xs mt-1">
                  <span style={{ color: GOLD }}>🪙 {getWallet().gold}</span>
                  {" · "}🪵 {getResources().wood} · 🪨 {getResources().stone}
                </p>
              </div>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {VENDOR_GOODS.map((g) => {
                  const priceBits: string[] = [];
                  if (g.kind === "sell") {
                    priceBits.push(`+${g.gold}g`);
                    if (g.resource) priceBits.push(`−${g.amount} ${g.resource}`);
                  } else {
                    if (g.gold > 0) priceBits.push(`−${g.gold}g`);
                    if (g.costWood) priceBits.push(`−${g.costWood} wood`);
                    if (g.costStone) priceBits.push(`−${g.costStone} stone`);
                    if (g.grant === "wood") priceBits.push(`+${g.amount} wood`);
                    if (g.grant === "stone") priceBits.push(`+${g.amount} stone`);
                    if (g.grant === "gold_bag") priceBits.push("+25g");
                    if (g.grant === "potion") priceBits.push("+potion");
                  }
                  return (
                  <button
                    key={g.id + bagTick}
                    className="w-full text-left px-3 py-2 rounded border border-white/10 hover:border-[#c5a059]/60 bg-black/40 transition-colors"
                    onClick={() => {
                      const w = getWallet();
                      if (g.kind === "sell") {
                        if (!g.resource) return;
                        if (!spendResource(g.resource, g.amount)) {
                          toast.error(`Need ${g.amount} ${g.resource}.`);
                          return;
                        }
                        saveWallet({ ...w, gold: w.gold + g.gold });
                        toast.success(`Sold ${g.amount} ${g.resource} for ${g.gold} gold.`);
                        setBagTick((t) => t + 1);
                        return;
                      }
                      // BUY — pay gold and/or wood/stone
                      if (g.gold > 0 && w.gold < g.gold) {
                        toast.error("Not enough gold.");
                        return;
                      }
                      if (!spendResources({ wood: g.costWood ?? 0, stone: g.costStone ?? 0 })) {
                        toast.error(
                          `Need ${g.costWood ? g.costWood + " wood" : ""}${g.costWood && g.costStone ? " + " : ""}${g.costStone ? g.costStone + " stone" : ""}`.trim() ||
                            "Not enough resources.",
                        );
                        return;
                      }
                      if (g.gold > 0) saveWallet({ ...w, gold: w.gold - g.gold });
                      if (g.grant === "potion") {
                        toast.success("Healing brew acquired — feel the grit return.");
                      } else if (g.grant === "wood") {
                        addResource("wood", g.amount);
                        toast.success(`Bought ${g.amount} wood.`);
                      } else if (g.grant === "stone") {
                        addResource("stone", g.amount);
                        toast.success(`Bought ${g.amount} stone.`);
                      } else if (g.grant === "gold_bag") {
                        const ww = getWallet();
                        saveWallet({ ...ww, gold: ww.gold + 25 });
                        toast.success("Anne counts out 25 gold.");
                      } else if (g.resource && g.amount) {
                        addResource(g.resource, g.amount);
                        toast.success(`Bought ${g.amount} ${g.resource}.`);
                      } else {
                        toast.success(`Traded: ${g.name}`);
                      }
                      setBagTick((t) => t + 1);
                    }}
                  >
                    <div className="flex justify-between items-center gap-2">
                      <span className="font-serif text-sm tracking-wide">{g.name}</span>
                      <span className="text-[10px] font-mono shrink-0" style={{ color: GOLD }}>
                        {priceBits.join(" · ")}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{g.blurb}</p>
                  </button>
                  );
                })}
              </div>
              <button
                className="w-full h-10 font-serif tracking-widest uppercase rounded"
                style={{ background: GOLD, color: "#1a1208" }}
                onClick={() => setVendorOpen(false)}
              >
                Close
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Controls hint */}
      <AnimatePresence>
        {showControls && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute top-14 left-1/2 -translate-x-1/2 z-10 pointer-events-none"
          >
            <div className="bg-black/75 border border-white/10 rounded px-5 py-3 text-center backdrop-blur-sm space-y-1">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Crosshair className="w-3 h-3 text-primary" />
                <p className="text-[10px] font-serif text-primary uppercase tracking-widest">Controls</p>
              </div>
              <p className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase">WASD — Move · LMB move/target · RMB hold attack</p>
              <p className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase">F Attack · Space Jump · Q Block · Shift Dodge</p>
              <p className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase">E Interact · R Special · 1-5 Skills (AoE: key then LMB place)</p>
              <p className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase">Chop trees / quarry stone with F · Cove east · Colossus west</p>
              <p className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase">Left Click Ground — Move To</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function GameWithBoundary() {
  return (
    <GameErrorBoundary>
      <Game />
    </GameErrorBoundary>
  );
}
