import {
  useEffect,
  useRef,
  useState,
  useMemo,
  useCallback,
  Component,
  type ReactNode,
  type ErrorInfo,
} from "react";
import { useLocation } from "wouter";
import { useGetClasses, useGetWeapons } from "@workspace/api-client-react";
import {
  ArenaScene,
  type ArenaStateUpdate,
  type ArenaBossInput,
} from "@/game/ArenaScene";
import { getPlayableCharacter } from "@/data/playableIdentity";
import { useResolvedSkills } from "@/data/skillsResolver";
import { skillIconSrc } from "@/data/skillIcons";
import { generateLocalBoss } from "@/data/localBoss";
import { getActiveFighterId } from "@/data/fighters";
import {
  Loader2,
  Skull,
  Swords,
  ArrowLeft,
  Sword,
  Crosshair,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { BarGauge, OrbGauge, Separator, WarningBanner } from "@/components/CraftpixUI";

// ─── Error boundary (WebGL may be unavailable in headless/screenshot) ───────────
class ArenaErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; message: string }> {
  state = { hasError: false, message: "" };
  static getDerivedStateFromError(err: Error) {
    return { hasError: true, message: err.message };
  }
  componentDidCatch(_err: Error, _info: ErrorInfo) {}
  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 bg-black flex flex-col items-center justify-center gap-6 z-50 p-6">
          <WarningBanner title="Arena Unavailable" className="max-w-md w-full">
            {this.state.message || "WebGL is required to enter the arena."}
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

// ─── Stone/gold HUD theme ───────────────────────────────────────────────────────
const GOLD = "#c5a059";
const stonePanel: React.CSSProperties = {
  background: "linear-gradient(to bottom, #2a2a2a, #111)",
  border: `2px solid ${GOLD}`,
  boxShadow: "inset 0 0 10px #000, 0 0 12px rgba(0,0,0,0.8), inset 1px 1px 0 rgba(255,255,255,0.18)",
  borderRadius: 8,
};
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

// ─── Player stat derivation (compact mirror of the dungeon's formulas) ──────────
interface ArenaPlayerStats {
  level: number;
  maxHp: number;
  maxMana: number;
  baseDamage: number;
  critChance: number;
  className: string;
  raceKey: string;
}

function computeArenaStats(
  char: Record<string, unknown>,
  classesData: unknown,
  weaponsData: unknown,
): ArenaPlayerStats {
  const attrs = (char.attributes as Record<string, number>) ?? {};
  const level = Number(char.level ?? 1);
  const charClass = String(char.class ?? "warrior").toLowerCase();
  const charRace = String(char.race ?? "human");

  const classes = (classesData as Record<string, unknown>)?.classes as
    | Record<string, Record<string, unknown>>
    | undefined;
  const classData = classes?.[charClass] ?? classes?.["warrior"];
  const classStart = (classData?.startingAttributes as Record<string, number>) ?? {};

  const str = (classStart.Strength ?? 5) + (attrs.Strength ?? 0);
  const vit = (classStart.Vitality ?? 3) + (attrs.Vitality ?? 0);
  const end_ = (classStart.Endurance ?? 2) + (attrs.Endurance ?? 0);
  const dex = (classStart.Dexterity ?? 1) + (attrs.Dexterity ?? 0);
  const agi = (classStart.Agility ?? 1) + (attrs.Agility ?? 0);
  const int_ = (classStart.Intellect ?? 0) + (attrs.Intellect ?? 0);
  const wis = (classStart.Wisdom ?? 0) + (attrs.Wisdom ?? 0);

  const maxHp = 200 + vit * 50 + end_ * 20 + level * 20;
  const maxMana = 100 + int_ * 20 + wis * 10 + level * 10;
  let baseDamage = 15 + str * 4 + dex * 2 + agi * 1 + level * 3;
  let critChance = 0.1 + dex * 0.01 + agi * 0.005;

  const equipment = (char.equipment as Record<string, string>) ?? {};
  const mainHandId = equipment.mainHand;
  if (mainHandId && weaponsData && typeof weaponsData === "object") {
    const cats = (weaponsData as Record<string, unknown>).categories as
      | Record<string, { items?: unknown[] }>
      | undefined;
    if (cats) {
      outer: for (const cat of Object.values(cats)) {
        for (const raw of cat.items ?? []) {
          const w = raw as Record<string, unknown>;
          if (w.id === mainHandId) {
            const ws = w.stats as Record<string, number> | undefined;
            if (ws) {
              baseDamage += ws.damageBase ?? 0;
              critChance += (ws.critBase ?? 0) / 100;
            }
            break outer;
          }
        }
      }
    }
  }

  return {
    level,
    maxHp: Math.round(maxHp),
    maxMana: Math.round(maxMana),
    baseDamage: Math.round(baseDamage),
    critChance: Math.min(0.6, critChance),
    className: charClass,
    raceKey: charRace,
  };
}

// ─── Boss arena page ────────────────────────────────────────────────────────────
function BossArena() {
  const [, setLocation] = useLocation();
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<ArenaScene | null>(null);
  const autoSummonRef = useRef(false);
  /** Stable key so the 3D scene is not disposed/recreated every React render. */
  const sceneKeyRef = useRef<string | null>(null);

  const { data: classesData } = useGetClasses();
  const { data: weaponsData } = useGetWeapons();
  // Freeze identity for this visit — getPlayableCharacter() returns a new object
  // every call, which used to thrash useMemo + remount ArenaScene every frame.
  const fighterId = getActiveFighterId();
  const char = useMemo(() => getPlayableCharacter(), [fighterId]);

  const [boss, setBoss] = useState<ArenaBossInput | null>(null);
  const [hud, setHud] = useState<ArenaStateUpdate | null>(null);
  const [tier] = useState(1);
  const [reward, setReward] = useState<string | null>(null);
  const [summoning, setSummoning] = useState(false);

  const stats = useMemo(() => {
    return computeArenaStats(
      char as unknown as Record<string, unknown>,
      classesData,
      weaponsData,
    );
  }, [
    char.id,
    char.level,
    char.class,
    char.race,
    char.attributes,
    char.equipment,
    classesData,
    weaponsData,
  ]);

  // Stable primitive fingerprint for scene lifecycle (ignore object identity).
  const statsKey = `${stats.level}|${stats.maxHp}|${stats.maxMana}|${stats.baseDamage}|${stats.critChance.toFixed(4)}|${stats.className}|${stats.raceKey}`;

  const { classSkills: hudClassSkills } = useResolvedSkills(String(char.class ?? "warrior"));

  // 5 fighter skills for the arena bar.
  const skillSlots = useMemo<{ name: string; glyph?: string; icon?: string }[]>(() => {
    return (hudClassSkills?.skills ?? []).slice(0, 5).map((s) => ({
      name: s.name,
      glyph: s.glyph as string | undefined,
      icon: skillIconSrc(s.icon) ?? undefined,
    }));
  }, [hudClassSkills]);

  const handleState = useCallback((s: ArenaStateUpdate) => setHud(s), []);

  // Spin up the arena once — only when boss id or stats fingerprint changes.
  useEffect(() => {
    if (!mountRef.current || !boss) return;
    const key = `${boss.id}|${statsKey}`;
    if (sceneKeyRef.current === key && sceneRef.current) return;

    // Tear down any previous instance before building a new one.
    if (sceneRef.current) {
      sceneRef.current.dispose();
      sceneRef.current = null;
    }
    sceneKeyRef.current = key;

    const scene = new ArenaScene({
      className: stats.className,
      raceKey: stats.raceKey,
      level: stats.level,
      maxHp: stats.maxHp,
      maxMana: stats.maxMana,
      baseDamage: stats.baseDamage,
      critChance: stats.critChance,
      boss,
      onStateUpdate: handleState,
      onVictory: () => {
        setReward("Victory — spoils added to your session wallet.");
      },
    });
    scene.init(mountRef.current);
    scene.setHudSkills(hudClassSkills?.skills.slice(0, 5) ?? []);
    sceneRef.current = scene;
    return () => {
      // Only dispose if this effect's scene is still the active one.
      if (sceneRef.current === scene) {
        scene.dispose();
        sceneRef.current = null;
        sceneKeyRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boss?.id, statsKey]);

  // Keep skill archetypes in sync without remounting the WebGL scene.
  useEffect(() => {
    sceneRef.current?.setHudSkills(hudClassSkills?.skills.slice(0, 5) ?? []);
  }, [hudClassSkills]);

  const applyBossPayload = useCallback((raw: Record<string, unknown>, fallbackTier: number) => {
    const abilitiesRaw = (raw.abilities as Record<string, unknown>[]) ?? [];
    setBoss({
      id: Number(raw.id),
      name: String(raw.name ?? "Adversary"),
      title: String(raw.title ?? ""),
      maxHp: Number(raw.maxHp ?? raw.hp ?? 1000),
      // Always at least 2 phases so circle bursts / pattern shifts show up.
      phases: Math.max(2, Math.min(3, Number(raw.phases ?? 3) || 3)),
      tier: Number(raw.tier ?? fallbackTier),
      assetPack: raw.assetPack ? String(raw.assetPack) : undefined,
      abilities: abilitiesRaw.map((a) => ({
        id: String(a.id),
        name: String(a.name),
        damage: Number(a.damage ?? 30),
        type: String(a.type ?? "melee"),
        cooldown: Number(a.cooldown ?? 4),
        description: a.description ? String(a.description) : undefined,
      })),
    });
    setSummoning(false);
  }, []);

  /**
   * Conjure a playable boss immediately.
   * Production Vercel is static SPA-only — POST /api/bosses/generate is 404 —
   * so we always use the client generator (no spinner stuck on network).
   */
  const summonLocalBoss = useCallback(() => {
    setSummoning(true);
    const local = generateLocalBoss({
      tier,
      playerClass: String(char.class ?? "warrior"),
      playerLevel: Number(char.level ?? 1),
    });
    applyBossPayload(local as unknown as Record<string, unknown>, tier);
  }, [applyBossPayload, char.class, char.level, tier]);

  const handleSummon = useCallback(() => {
    setReward(null);
    setHud(null);
    sceneKeyRef.current = null;
    if (sceneRef.current) {
      sceneRef.current.dispose();
      sceneRef.current = null;
    }
    summonLocalBoss();
  }, [summonLocalBoss]);

  const handleRematch = () => {
    setBoss(null);
    setHud(null);
    setReward(null);
    autoSummonRef.current = false;
    sceneKeyRef.current = null;
    if (sceneRef.current) {
      sceneRef.current.dispose();
      sceneRef.current = null;
    }
  };

  // Auto-conjure once when the arena is entered (and again after rematch).
  useEffect(() => {
    if (boss) return;
    if (autoSummonRef.current) return;
    autoSummonRef.current = true;
    handleSummon();
  }, [boss, handleSummon]);

  const charName = char.name;

  return (
    <div className="fixed inset-0 bg-black overflow-hidden select-none">
      {/* 3D mount */}
      <div ref={mountRef} className="absolute inset-0" />

      {/* Back button */}
      <button
        onClick={() => setLocation("/")}
        className="absolute top-4 left-4 z-20 flex items-center gap-2 font-serif text-xs tracking-widest uppercase text-muted-foreground hover:text-primary transition-colors px-3 py-2"
        style={stonePanel}
      >
        <Rivets />
        <ArrowLeft className="w-4 h-4" /> War Panel
      </button>

      {/* ── Loading until a boss payload exists ── */}
      {!boss && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-black/60">
          <Loader2 className="w-12 h-12 animate-spin" style={{ color: GOLD }} />
          <p className="font-serif tracking-widest uppercase animate-pulse" style={{ color: GOLD }}>
            {summoning ? "Forging Adversary..." : "Preparing Arena..."}
          </p>
          <button
            onClick={handleSummon}
            className="mt-2 font-serif text-xs tracking-widest uppercase px-5 py-2 rounded border"
            style={{ borderColor: GOLD, color: GOLD }}
          >
            Conjure Manually
          </button>
        </div>
      )}

      {/* ── Active fight HUD ── */}
      {boss && hud && (
        <>
          {/* Boss banner — top center */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 w-[min(560px,80vw)] px-4 py-2.5" style={stonePanel}>
            <Rivets />
            <div className="flex justify-between items-end font-serif tracking-widest mb-1">
              <span className="uppercase text-sm text-destructive flex items-center gap-2">
                <Skull className="w-4 h-4" /> {boss.name}
              </span>
              <span className="text-[10px] uppercase" style={{ color: GOLD }}>
                Phase {hud.bossPhase}/{hud.bossMaxPhases}
              </span>
            </div>
            {/* Phase thresholds (match ArenaScene: 3-phase = 66%/33%, 2-phase = 50%) */}
            <div className="relative">
              <BarGauge pct={(hud.bossHp / hud.bossMaxHp) * 100} color="#e23b3b" frame="cast" height={16} />
              <div className="pointer-events-none absolute inset-x-0 top-0 bottom-0">
                {(hud.bossMaxPhases >= 3 ? [66, 33] : hud.bossMaxPhases >= 2 ? [50] : []).map((at) => (
                  <div
                    key={at}
                    className="absolute top-0 bottom-0 w-0.5 bg-black/80"
                    style={{ left: `${at}%`, boxShadow: `0 0 4px ${GOLD}` }}
                    title={`Phase transition at ${at}% HP`}
                  />
                ))}
              </div>
            </div>
            {boss.title && (
              <div className="text-center text-[10px] tracking-widest uppercase text-muted-foreground mt-1">{boss.title}</div>
            )}
          </div>

          {/* Phase transition banner */}
          <AnimatePresence>
            {hud.phaseAnnounce && (
              <motion.div
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.08 }}
                className="absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none"
              >
                <div
                  className="font-serif text-4xl md:text-5xl tracking-[0.35em] uppercase px-8 py-3"
                  style={{
                    color: "#ff6a4a",
                    textShadow: "0 0 24px #ff2200, 0 2px 0 #000",
                    border: `2px solid ${GOLD}`,
                    background: "rgba(20,4,4,0.72)",
                  }}
                >
                  {hud.phaseAnnounce}
                </div>
                <p className="text-center text-xs tracking-widest uppercase mt-2" style={{ color: "#ffb84d" }}>
                  Leave the crimson circle · dodge projectiles
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Floating boss telegraph warning */}
          <AnimatePresence>
            {hud.bossTelegraph && hud.bossAlive && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="absolute left-1/2 -translate-x-1/2 z-10 font-serif text-sm tracking-widest uppercase px-3 py-1 rounded"
                style={{
                  top: 92,
                  color: hud.bossTelegraph.startsWith("DODGE") ? "#fff0c8" : "#ffb84d",
                  background: hud.bossTelegraph.startsWith("DODGE")
                    ? "rgba(140,20,0,0.75)"
                    : "rgba(120,40,0,0.6)",
                  border: hud.bossTelegraph.startsWith("DODGE")
                    ? "1px solid #ff5522"
                    : "1px solid #ff8800",
                  boxShadow: hud.bossTelegraph.startsWith("DODGE")
                    ? "0 0 16px rgba(255,60,20,0.45)"
                    : undefined,
                }}
              >
                ⚠ {hud.bossTelegraph}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Player vitals — bottom left */}
          <div className="absolute bottom-4 left-4 z-10 w-60 px-3.5 py-3" style={stonePanel}>
            <Rivets />
            <div className="flex justify-between items-center mb-1.5">
              <span className="font-serif text-sm tracking-widest uppercase" style={{ color: GOLD }}>
                {charName}
              </span>
              <span className="text-[10px] text-muted-foreground">Lv {hud.playerLevel}</span>
            </div>
            <Separator className="mb-2.5 opacity-80" />
            <div className="flex items-stretch gap-3">
              <OrbGauge pct={(hud.playerHp / hud.playerMaxHp) * 100} color="#e23b3b" size={58} className="self-center shrink-0" />
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>HP</span>
                  <span>{Math.round(hud.playerHp)}/{hud.playerMaxHp}</span>
                </div>
                <BarGauge pct={(hud.playerHp / hud.playerMaxHp) * 100} color="#e23b3b" height={15} />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>MP</span>
                  <span>{Math.round(hud.playerMana)}/{hud.playerMaxMana}</span>
                </div>
                <BarGauge pct={(hud.playerMana / hud.playerMaxMana) * 100} color="#3b82f6" height={12} />
              </div>
            </div>
          </div>

          {/* Combat log — bottom right */}
          <div className="absolute bottom-4 right-4 z-10 w-72 max-h-40 overflow-hidden px-3 py-2" style={stonePanel}>
            <Rivets />
            <div className="space-y-0.5">
              {hud.combatLog.slice(0, 6).map((line, i) => (
                <div key={i} className="text-[11px] font-serif tracking-wide" style={{ opacity: 1 - i * 0.14, color: i === 0 ? GOLD : "#bbb" }}>
                  {line}
                </div>
              ))}
            </div>
          </div>

          {/* Bottom control cluster — centered, wraps on narrow viewports */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-end justify-center gap-2 flex-wrap max-w-[calc(100%-2rem)]">
          {/* Skill bar */}
          <div className="relative flex gap-2 px-3 py-2" style={stonePanel}>
            <Rivets />
            {skillSlots.map((s, i) => {
              const cd = hud.skillCooldownPct[i] ?? 1;
              const ready = cd >= 1;
              return (
                <button
                  key={i}
                  onClick={() => sceneRef.current?.useSkill(i)}
                  className="relative w-12 h-12 rounded flex items-center justify-center text-lg border transition-colors overflow-hidden"
                  style={{ borderColor: ready ? GOLD : "#444", background: "rgba(0,0,0,0.5)" }}
                  title={s.name}
                >
                  {s.icon ? (
                    <img
                      src={s.icon}
                      alt={s.name}
                      className="w-full h-full object-cover rounded"
                    />
                  ) : (
                    <span>{s.glyph ?? "✦"}</span>
                  )}
                  {!ready && (
                    <div
                      className="absolute inset-0 bg-black/70"
                      style={{ clipPath: `inset(${cd * 100}% 0 0 0)` }}
                    />
                  )}
                  <span className="absolute bottom-0.5 right-1 text-[8px] text-muted-foreground">{i + 1}</span>
                </button>
              );
            })}
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => sceneRef.current?.attackNearest()}
              className="w-12 h-12 rounded flex flex-col items-center justify-center border"
              style={{ borderColor: GOLD, background: "rgba(0,0,0,0.5)", color: GOLD }}
              title="Attack [F]"
            >
              <Sword className="w-5 h-5" />
              <span className="text-[7px]">F</span>
            </button>
            <button
              onClick={() => sceneRef.current?.doDodge()}
              className="relative w-12 h-12 rounded flex flex-col items-center justify-center border overflow-hidden"
              style={{
                borderColor: hud.iframeActive ? "#7ec8ff" : (hud.dodgeReadyPct ?? 1) >= 1 ? GOLD : "#444",
                background: hud.iframeActive ? "rgba(80,140,220,0.35)" : "rgba(0,0,0,0.5)",
                color: hud.iframeActive ? "#cfe9ff" : GOLD,
                boxShadow: hud.iframeActive ? "0 0 14px rgba(120,190,255,0.55)" : undefined,
              }}
              title="Dodge projectiles & circles [Shift] — brief invulnerability"
            >
              <Crosshair className="w-5 h-5" />
              <span className="text-[7px]">SHF</span>
              {(hud.dodgeReadyPct ?? 1) < 1 && !hud.iframeActive && (
                <div
                  className="absolute inset-0 bg-black/70"
                  style={{ clipPath: `inset(${(hud.dodgeReadyPct ?? 0) * 100}% 0 0 0)` }}
                />
              )}
            </button>
          </div>
          </div>

          {/* Floating damage numbers (+ DODGE markers) */}
          <div className="absolute inset-0 z-10 pointer-events-none overflow-hidden">
            {hud.damageNumbers.map((d) => {
              const isDodge = d.value === 0 && d.isCrit;
              return (
                <span
                  key={d.id}
                  className="absolute font-serif font-bold"
                  style={{
                    left: d.x,
                    top: d.y - d.age * 36,
                    transform: "translate(-50%, -50%)",
                    opacity: Math.max(0, 1 - d.age / (isDodge ? 0.9 : 1.4)),
                    fontSize: isDodge ? 20 : d.isCrit ? 26 : 18,
                    color: isDodge
                      ? "#a8dcff"
                      : d.isPlayer
                        ? d.isCrit
                          ? "#ffd060"
                          : "#ffe9b0"
                        : "#ff5a5a",
                    textShadow: "0 0 4px #000, 0 2px 3px #000",
                    letterSpacing: isDodge ? "0.12em" : undefined,
                  }}
                >
                  {isDodge ? "DODGE" : `${d.isCrit ? "✦" : ""}${d.value}`}
                </span>
              );
            })}
          </div>

          {/* Soft load cue only — never blocks input (models stream under the HUD). */}
          {!hud.loaded && (
            <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-3 py-1.5 rounded pointer-events-none" style={{ ...stonePanel, opacity: 0.9 }}>
              <Loader2 className="w-4 h-4 animate-spin" style={{ color: GOLD }} />
              <p className="font-serif tracking-widest uppercase text-[10px]" style={{ color: GOLD }}>Streaming models…</p>
            </div>
          )}

          {/* ── Victory / Defeat overlay ── */}
          <AnimatePresence>
            {hud.outcome !== "fighting" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute inset-0 z-40 flex items-center justify-center bg-black/75 p-6"
              >
                <div className="max-w-md w-full p-8 text-center space-y-5 relative" style={stonePanel}>
                  <Rivets />
                  {hud.outcome === "victory" ? (
                    <>
                      <Swords className="w-14 h-14 mx-auto" style={{ color: GOLD }} />
                      <h2 className="font-serif text-4xl uppercase tracking-widest" style={{ color: GOLD }}>Victory</h2>
                      <p className="text-muted-foreground text-sm">
                        {boss.name} lies broken at your feet.
                      </p>
                      {reward && (
                        <p className="font-serif tracking-widest uppercase text-sm" style={{ color: GOLD }}>{reward}</p>
                      )}
                    </>
                  ) : (
                    <>
                      <Skull className="w-14 h-14 mx-auto text-destructive" />
                      <h2 className="font-serif text-4xl uppercase tracking-widest text-destructive">Defeated</h2>
                      <p className="text-muted-foreground text-sm">
                        {boss.name} stands triumphant. Recover and try again.
                      </p>
                    </>
                  )}
                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={handleRematch}
                      className="flex-1 h-12 font-serif tracking-widest uppercase rounded"
                      style={{ background: GOLD, color: "#1a1208" }}
                    >
                      New Adversary
                    </button>
                    <button
                      onClick={() => setLocation("/")}
                      className="flex-1 h-12 font-serif tracking-widest uppercase rounded border"
                      style={{ borderColor: GOLD, color: GOLD }}
                    >
                      War Panel
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}

export default function Boss() {
  return (
    <ArenaErrorBoundary>
      <BossArena />
    </ArenaErrorBoundary>
  );
}
