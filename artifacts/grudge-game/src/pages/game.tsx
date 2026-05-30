import { useEffect, useRef, useState, useCallback, Component, useMemo, type ReactNode, type ErrorInfo } from "react";
import { useLocation } from "wouter";
import { useListCharacters, useGetEnemies, useGetClasses, useGetWeapons } from "@workspace/api-client-react";
import { GameEngine, type GameState, type EnemyTemplate, type PlayerInitStats } from "@/game/GameEngine";
import { Loader2, ArrowLeft, Swords, Zap, AlertTriangle, Shield, Crosshair, LayoutGrid } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { MainPanel, useMainPanelHotkeys, MAIN_PANEL_KEYS, type CharSummary, type PanelKey } from "@/components/MainPanel";
import { getSelectedSkin } from "@/data/skins";
import { CLASS_STARTER_WEAPON } from "@/data/starterGear";
import { useResolvedSkills } from "@/data/skillsResolver";

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
        <div className="fixed inset-0 bg-black flex flex-col items-center justify-center gap-6 z-50">
          <AlertTriangle className="w-12 h-12 text-yellow-500" />
          <p className="font-serif text-primary uppercase tracking-widest text-lg">Dungeon Unavailable</p>
          <p className="text-sm text-muted-foreground max-w-xs text-center font-mono">{this.state.message || "WebGL is required to enter the dungeon."}</p>
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
  const charName = String(char.name ?? "Warlord");

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
  useMainPanelHotkeys(
    () => setPanelOpen((v) => !v),
    () => setPanelOpen(false),
    panelOpen,
    (idx) => { const k = MAIN_PANEL_KEYS[idx]; if (k) setPanelTab(k); },
  );

  const { data: characters } = useListCharacters();
  const { data: enemiesData } = useGetEnemies();
  const { data: classesData } = useGetClasses();
  const { data: weaponsData } = useGetWeapons();

  const char = characters?.[0];

  const handleStateUpdate = useCallback((state: GameState) => {
    setGameState(state);
  }, []);

  // Build enemy templates from real R2 data
  const enemyTemplates = useMemo(() => buildEnemyTemplates(enemiesData), [enemiesData]);

  // Compute player stats from real class/weapon data
  const playerStats = useMemo(() => {
    if (!char) return null;
    return computePlayerStats(
      char as unknown as Record<string, unknown>,
      classesData,
      weaponsData,
    );
  }, [char, classesData, weaponsData]);

  // Resolve class + weapon skills for the in-game HUD skill bar.
  const hudClass = char ? String((char as unknown as Record<string, unknown>).class ?? "warrior").toLowerCase() : null;
  const hudMainCategory = hudClass ? CLASS_STARTER_WEAPON[hudClass]?.category : null;
  const { classSkills: hudClassSkills, weaponSlots: hudWeaponSlots } = useResolvedSkills(hudClass, hudMainCategory);

  // Only start the engine once we have enemies + stats
  const ready = !!char && enemyTemplates.length > 0 && !!playerStats;

  useEffect(() => {
    if (!mountRef.current || !ready || !playerStats) return;

    const c = char as unknown as Record<string, unknown>;
    const charId = c.id as string | number;
    const charClass = String(c.class ?? "warrior").toLowerCase();
    const equipMainCategory = CLASS_STARTER_WEAPON[charClass]?.category;
    const skinId = charId != null ? getSelectedSkin(charId) : null;

    const engine = new GameEngine();
    engine.onStateUpdate = handleStateUpdate;
    engine.init(mountRef.current, { ...playerStats, skinId, equipMainCategory }, enemyTemplates);
    engineRef.current = engine;

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  useEffect(() => {
    const t = setTimeout(() => setShowControls(false), 6000);
    return () => clearTimeout(t);
  }, []);

  if (!char) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-6 bg-background">
        <p className="font-serif text-muted-foreground tracking-widest text-lg uppercase">No Warlord Found</p>
        <button
          onClick={() => setLocation("/character/new")}
          className="font-serif text-sm tracking-widest uppercase text-primary border border-primary/40 px-6 py-2 rounded hover:bg-primary/10 transition-colors"
        >
          Forge a Warlord
        </button>
      </div>
    );
  }

  const hpPct   = gameState ? (gameState.playerHp / gameState.playerMaxHp) * 100 : 100;
  const manaPct = gameState ? (gameState.playerMana / gameState.playerMaxMana) * 100 : 100;
  const atkPct  = gameState ? (1 - gameState.playerAttackCooldown) * 100 : 100;
  const hpColor = hpPct > 50 ? "#22c55e" : hpPct > 25 ? "#f59e0b" : "#ef4444";

  return (
    <div className="fixed inset-0 bg-black flex flex-col" style={{ zIndex: 50 }}>
      {/* 3D canvas */}
      <div ref={mountRef} className="absolute inset-0" style={{ cursor: "crosshair" }} />

      {/* Loading overlay */}
      {(!gameState || !gameState.loaded) && (
        <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center gap-4 z-20">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="font-serif text-primary uppercase tracking-widest text-sm animate-pulse">
            {!ready ? "Loading Grudge Data..." : "Entering the Dungeon..."}
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
        </div>
      )}

      {/* Top — zone + back */}
      <div className="absolute top-0 left-0 right-0 flex items-start justify-between px-4 pt-3 z-10 pointer-events-none">
        <button
          className="pointer-events-auto flex items-center gap-2 px-3 py-1.5 bg-black/60 border border-white/10 rounded text-xs font-serif tracking-widest uppercase text-muted-foreground hover:text-white hover:border-white/30 transition-colors backdrop-blur-sm"
          onClick={() => setLocation("/")}
        >
          <ArrowLeft className="w-3 h-3" />
          War Panel
        </button>

        <div className="text-center">
          <p className="text-[10px] font-serif uppercase tracking-[0.2em] text-muted-foreground/60">{gameState?.zone ?? ""}</p>
        </div>

        {/* Mini stats top-right */}
        {playerStats && gameState && (
          <div className="pointer-events-auto bg-black/60 border border-white/10 backdrop-blur-sm rounded px-3 py-1.5 text-right">
            <p className="text-[10px] font-serif uppercase tracking-widest text-primary">{playerStats.charName}</p>
            <p className="text-[9px] font-mono text-muted-foreground">
              Lv {gameState.playerLevel} · {playerStats.charRace} {playerStats.charClass}
            </p>
            <p className="text-[9px] font-mono text-muted-foreground/70">
              DMG {playerStats.baseDamage} · DEF {playerStats.defense} · CRIT {Math.round(playerStats.critChance * 100)}%
            </p>
          </div>
        )}
      </div>

      {/* Player HUD — bottom left */}
      {gameState && (
        <div className="absolute bottom-4 left-4 z-10 w-60 space-y-2 px-3.5 py-3" style={stonePanel}>
          <Rivets />
          <div className="flex items-center justify-between mb-1">
            <span className="font-serif text-sm tracking-widest uppercase" style={{ color: GOLD }}>{char.name as string}</span>
            <span className="font-serif text-xs text-muted-foreground tracking-widest">Lv {gameState.playerLevel}</span>
          </div>

          {/* HP */}
          <div className="space-y-0.5">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-mono uppercase text-muted-foreground tracking-widest">HP</span>
              <span className="text-[10px] font-mono" style={{ color: hpColor }}>
                {Math.round(gameState.playerHp)} / {gameState.playerMaxHp}
              </span>
            </div>
            <div className="h-3 bg-black/60 border border-white/10 rounded-sm overflow-hidden">
              <div
                className="h-full transition-all duration-100 rounded-sm"
                style={{ width: `${hpPct}%`, background: hpColor, boxShadow: `0 0 6px ${hpColor}88` }}
              />
            </div>
          </div>

          {/* Mana */}
          <div className="space-y-0.5">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-mono uppercase text-muted-foreground tracking-widest">MP</span>
              <span className="text-[10px] font-mono text-blue-400">
                {Math.round(gameState.playerMana)} / {gameState.playerMaxMana}
              </span>
            </div>
            <div className="h-2 bg-black/60 border border-white/10 rounded-sm overflow-hidden">
              <div
                className="h-full transition-all duration-100 rounded-sm"
                style={{ width: `${manaPct}%`, background: "#3b82f6", boxShadow: "0 0 6px #3b82f688" }}
              />
            </div>
          </div>

          {/* Attack cooldown strip */}
          <div className="h-1.5 bg-black/60 border border-white/10 rounded-sm overflow-hidden">
            <div
              className="h-full rounded-sm transition-all duration-75"
              style={{ width: `${atkPct}%`, background: "#ffaa00", boxShadow: "0 0 4px #ffaa0066" }}
            />
          </div>

          {/* XP bar */}
          <div className="h-1 bg-black/40 border border-white/5 rounded-sm overflow-hidden">
            <div
              className="h-full rounded-sm"
              style={{ width: `${Math.min(100, (gameState.playerXp % 500) / 5)}%`, background: "#a855f7" }}
            />
          </div>
        </div>
      )}

      {/* Combat log — bottom right */}
      {gameState && gameState.combatLog.length > 0 && (
        <div className="absolute bottom-4 right-4 z-10 w-72 space-y-1 pointer-events-none">
          <AnimatePresence initial={false}>
            {gameState.combatLog.slice(0, 7).map((msg, i) => (
              <motion.div
                key={msg + i}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: Math.max(0.15, 1 - i * 0.12), x: 0 }}
                exit={{ opacity: 0 }}
                className="text-right text-[11px] font-serif tracking-wide"
                style={{
                  color: msg.includes("hits you") || msg.includes("hit you")
                    ? "#ef4444"
                    : msg.includes("defeated") || msg.includes("XP")
                    ? "#f59e0b"
                    : msg.includes("CRIT")
                    ? "#ff6600"
                    : "#d1d5db",
                }}
              >
                {msg}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Floating enemy health bars */}
      {gameState && gameState.enemies.map((en) => {
        if (en.screenX < 0 || en.screenX > window.innerWidth || en.screenY < 0 || en.screenY > window.innerHeight) return null;
        const pct = (en.hp / en.maxHp) * 100;
        const col = pct > 50 ? "#22c55e" : pct > 25 ? "#f59e0b" : "#ef4444";
        const tierColor = TIER_COLORS[en.tier] ?? "#9ca3af";
        return (
          <div
            key={en.id}
            className="absolute pointer-events-none z-10"
            style={{ left: en.screenX - 44, top: en.screenY - 36, width: 88 }}
          >
            <p className="text-center text-[9px] font-serif tracking-widest uppercase mb-0.5 truncate" style={{ color: tierColor }}>
              {en.name}
            </p>
            <div className="h-1.5 bg-black/70 border border-white/10 rounded-sm overflow-hidden">
              <div className="h-full rounded-sm transition-all duration-150" style={{ width: `${pct}%`, background: col }} />
            </div>
          </div>
        );
      })}

      {/* Floating damage numbers */}
      {gameState && gameState.damageNumbers.map((d) => (
        <div
          key={d.id}
          className="absolute pointer-events-none font-mono font-bold z-20 select-none"
          style={{
            left: d.x,
            top: d.y,
            fontSize: d.isCrit ? 20 : d.isPlayer ? 15 : 13,
            color: d.isPlayer ? "#ef4444" : d.isCrit ? "#ff6600" : "#ffffff",
            textShadow: "0 1px 4px rgba(0,0,0,0.9)",
            opacity: Math.max(0, 1 - d.age / 1.4),
            transform: `translate(-50%, -${d.age * 32}px)`,
          }}
        >
          {d.isCrit ? `${d.value}!` : d.isPlayer ? `-${d.value}` : `-${d.value}`}
        </div>
      ))}

      {/* Skill bar — class + weapon skills, above the action buttons */}
      {gameState && (hudClassSkills || hudWeaponSlots.length > 0) && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-10 flex items-end gap-4">
          {hudClassSkills && (
            <div className="flex flex-col items-center gap-1">
              <span className="text-[9px] font-serif tracking-widest uppercase" style={{ color: GOLD }}>Class · {hudClassSkills.name}</span>
              <div className="flex gap-1.5">
                {hudClassSkills.skills.slice(0, 5).map((s, i) => (
                  <div
                    key={s.id}
                    title={`${s.name}${s.cooldown ? ` · CD ${s.cooldown}` : ""}\n${s.description}`}
                    className="relative w-11 h-11 rounded flex items-center justify-center text-lg bg-black border-2 border-neutral-700 hover:border-[#c5a059] hover:scale-105 transition-all"
                    style={{ boxShadow: "inset 0 0 5px #000" }}
                  >
                    <span>{s.glyph}</span>
                    <span className="absolute top-0.5 left-1 text-[9px] font-serif text-neutral-400">{i + 1}</span>
                    {s.isSignature && <span className="absolute -bottom-1 -right-1 text-[9px] leading-none" style={{ color: GOLD }}>★</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {hudWeaponSlots.length > 0 && (
            <div className="flex flex-col items-center gap-1">
              <span className="text-[9px] font-serif tracking-widest uppercase" style={{ color: GOLD }}>Weapon</span>
              <div className="flex gap-1.5">
                {hudWeaponSlots.map((slot) => {
                  const sk = slot.skills[0];
                  if (!sk) return null;
                  return (
                    <div
                      key={slot.type}
                      title={`${slot.label}: ${sk.name}${sk.cooldown ? ` · CD ${sk.cooldown}` : ""}\n${sk.description}`}
                      className="w-11 h-11 rounded flex items-center justify-center overflow-hidden bg-black border-2 border-neutral-700 hover:border-[#c5a059] hover:scale-105 transition-all"
                      style={{ boxShadow: "inset 0 0 5px #000" }}
                    >
                      {sk.icon ? (
                        <img src={`https://molochdagod.github.io/ObjectStore/icons/skill_nobg/${sk.icon}`} alt={sk.name} className="w-7 h-7 object-contain" />
                      ) : (
                        <Swords className="w-5 h-5 text-amber-400" />
                      )}
                    </div>
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
          onClick={() => engineRef.current?.attackNearest()}
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
          className="flex flex-col items-center gap-1 px-4 py-2 rounded font-serif text-xs tracking-widest uppercase bg-black/40 border border-neutral-700 text-muted-foreground hover:border-[#c5a059]/70 hover:text-[#c5a059] transition-all active:scale-95"
          onClick={() => setLocation("/equipment")}
        >
          <Shield className="w-4 h-4" />
          <span>Armory</span>
        </button>
        <button
          className="flex flex-col items-center gap-1 px-4 py-2 rounded font-serif text-xs tracking-widest uppercase bg-black/40 border border-blue-500/50 text-blue-400 hover:bg-blue-500/15 hover:border-blue-500 transition-all active:scale-95"
          onClick={() => setLocation("/boss")}
        >
          <Zap className="w-4 h-4" />
          <span>Boss Arena</span>
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
              <p className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase">WASD / Arrow Keys — Move</p>
              <p className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase">Left Click Enemy — Target &amp; Chase</p>
              <p className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase">F / Space — Attack Nearest</p>
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
