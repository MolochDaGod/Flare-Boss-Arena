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
import {
  useGetClasses,
  useGetWeapons,
} from "@workspace/api-client-react";
import {
  ArenaScene,
  type ArenaStateUpdate,
  type ArenaBossInput,
} from "@/game/ArenaScene";
import { CLASS_STARTER_WEAPON } from "@/data/starterGear";
import { getPlayableCharacter } from "@/data/playableIdentity";
import { getGameLoadout } from "@/data/gameCombat";
import { useResolvedSkills } from "@/data/skillsResolver";
import { skillIconSrc } from "@/data/skillIcons";
import {
  Loader2,
  Skull,
  Swords,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ParchmentPanel, WarningBanner } from "@/components/CraftpixUI";
import { toast } from "sonner";
import { MultiplayerPanel } from "@/components/MultiplayerPanel";
import type { MultiplayerClient } from "@/net/MultiplayerClient";
import {
  bossQueryFromSearch,
  ALL_BOSSES,
} from "@/data/localBoss";
import { generateRosterBoss } from "@/data/bossRoster";
import { UnifiedCombatHud } from "@/components/UnifiedCombatHud";
import { fromArenaState } from "@/data/combatHudAdapters";

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
  _classesData: unknown,
  _weaponsData: unknown,
): ArenaPlayerStats {
  // Single path with fighter loadout + stones + equipped weapons/armor boosts.
  const id = String(char.id ?? "");
  const loadout = getGameLoadout(id || null);
  const level = Number(char.level ?? 1);
  return {
    level,
    maxHp: loadout.combat.maxHp,
    maxMana: loadout.combat.maxMana,
    baseDamage: loadout.combat.baseDamage,
    critChance: loadout.combat.critChance,
    className: String(char.class ?? loadout.fighter.role).toLowerCase(),
    raceKey: "human",
  };
}

// ─── Boss arena page ────────────────────────────────────────────────────────────
function BossArena() {
  const [, setLocation] = useLocation();
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<ArenaScene | null>(null);
  const autoSummonRef = useRef(false);

  const { data: classesData } = useGetClasses();
  const { data: weaponsData } = useGetWeapons();
  const char = getPlayableCharacter();

  const [boss, setBoss] = useState<ArenaBossInput | null>(null);
  const [hud, setHud] = useState<ArenaStateUpdate | null>(null);
  const [tier, setTier] = useState(1);
  const [reward, setReward] = useState<string | null>(null);
  const [rosterIndex, setRosterIndex] = useState(0);
  const [bossStyleLabel, setBossStyleLabel] = useState<string>("");

  const stats = useMemo(() => {
    return computeArenaStats(
      char as unknown as Record<string, unknown>,
      classesData,
      weaponsData,
    );
  }, [char, classesData, weaponsData]);

  const hudClass = String(char.class ?? "warrior").toLowerCase();
  const hudMainCategory = hudClass ? CLASS_STARTER_WEAPON[hudClass]?.category : null;
  const { classSkills: hudClassSkills, weaponSlots: hudWeaponSlots } = useResolvedSkills(hudClass, hudMainCategory);

  // Unified 5-slot skill bar: 2 class skills + 3 weapon-slot primaries.
  const skillSlots = useMemo<{ name: string; glyph?: string; icon?: string }[]>(() => {
    const classPart = (hudClassSkills?.skills ?? []).slice(0, 2).map((s) => ({
      name: s.name,
      glyph: s.glyph as string | undefined,
      icon: skillIconSrc(s.icon) ?? undefined,
    }));
    const weaponPart = hudWeaponSlots.slice(0, 3).map((slot) => {
      const sk = slot.skills[0];
      return {
        name: sk?.name ?? slot.label,
        glyph: undefined as string | undefined,
        icon: skillIconSrc(sk?.icon) ?? undefined,
      };
    });
    return [...classPart, ...weaponPart].slice(0, 5);
  }, [hudClassSkills, hudWeaponSlots]);

  const handleState = useCallback((s: ArenaStateUpdate) => setHud(s), []);

  // Spin up the arena once a boss is generated + stats are ready.
  useEffect(() => {
    if (!mountRef.current || !boss || !stats) return;
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
        const bossId = boss.id;
        if (bossId != null) {
          setReward("Victory — spoils added to your session wallet.");
        }
      },
    });
    scene.init(mountRef.current);
    scene.setHudSkills(hudClassSkills?.skills.slice(0, 5) ?? []);
    sceneRef.current = scene;
    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boss, stats]);

  // Keep the scene's archetype mapping in sync with resolved class skills.
  useEffect(() => {
    sceneRef.current?.setHudSkills(hudClassSkills?.skills.slice(0, 5) ?? []);
  }, [hudClassSkills]);

  const summonLocal = useCallback(
    (opts?: { bossIndex?: number; bossId?: string }) => {
      setReward(null);
      const level = Number((char as unknown as Record<string, unknown>).level ?? 1);
      const full = generateRosterBoss({
        tier,
        playerLevel: level,
        playerClass: String((char as unknown as Record<string, unknown>).class ?? "warrior"),
        bossIndex: opts?.bossIndex ?? rosterIndex,
        bossId: opts?.bossId,
      });
      setBossStyleLabel(full.style);
      setBoss({
        id: full.id,
        name: full.name,
        title: full.title,
        maxHp: full.maxHp,
        phases: full.phases,
        tier: full.tier,
        assetPack: full.modelId,
        abilities: full.abilities,
        style: full.style,
        modelId: full.modelId,
        flying: full.flying,
        bossScale: full.bossScale,
      });
      toast.message(`${full.name} enters`, {
        description: `${full.style} · ${full.abilities.length} abilities · ${full.maxHp} HP`,
      });
    },
    [char, tier, rosterIndex],
  );

  const handleSummon = () => {
    // Prefer URL ?boss= override, else current roster picker
    const q = bossQueryFromSearch(typeof window !== "undefined" ? window.location.search : "");
    if (q.bossId || q.bossIndex != null) {
      summonLocal(q);
      return;
    }
    summonLocal({ bossIndex: rosterIndex });
  };

  const handleRematch = () => {
    setBoss(null);
    setHud(null);
    setReward(null);
    autoSummonRef.current = false;
  };

  // QA / deep-link: ?boss=framis or ?boss=3 auto-starts that fight once stats ready.
  useEffect(() => {
    if (!stats) return;
    if (boss) return;
    if (autoSummonRef.current) return;
    const q = bossQueryFromSearch(typeof window !== "undefined" ? window.location.search : "");
    if (!q.bossId && q.bossIndex == null) return;
    autoSummonRef.current = true;
    if (q.bossId) {
      const idx = ALL_BOSSES.findIndex((b) => b.id === q.bossId);
      if (idx >= 0) setRosterIndex(idx);
      summonLocal({ bossId: q.bossId });
    } else if (q.bossIndex != null) {
      setRosterIndex(q.bossIndex);
      summonLocal({ bossIndex: q.bossIndex });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [char, stats, boss]);

  const charName = char.name;
  const mpClientRef = useRef<MultiplayerClient | null>(null);

  // Stream local pose into PvP room when connected.
  useEffect(() => {
    let last = 0;
    let raf = 0;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const client = mpClientRef.current;
      const scene = sceneRef.current;
      if (!client || !scene || now - last < 50) return;
      last = now;
      const pose = scene.getLocalNetPose();
      client.sendInput({
        ax: pose.ax,
        az: pose.az,
        yaw: pose.yaw,
      });
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

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

      {/* ── Loading / pick boss before fight starts ── */}
      {!boss && (
        <div className="absolute inset-0 z-30 flex items-center justify-center p-6 bg-black/70">
          <ParchmentPanel className="max-w-lg w-full p-8 text-center space-y-5">
            <Rivets />
            <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center border" style={{ borderColor: GOLD }}>
              <Skull className="w-8 h-8" style={{ color: GOLD }} />
            </div>
            <div>
              <h1 className="font-serif text-3xl uppercase tracking-widest mb-2" style={{ color: GOLD }}>
                Arena of Blood
              </h1>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {ALL_BOSSES.length} curated bosses · distinct fight styles · offline-ready
              </p>
            </div>

            {/* Boss carousel */}
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                className="p-2 rounded border border-white/15 hover:border-primary/50"
                onClick={() => setRosterIndex((i) => (i - 1 + ALL_BOSSES.length) % ALL_BOSSES.length)}
              >
                <ChevronLeft className="w-4 h-4" style={{ color: GOLD }} />
              </button>
              <div className="min-w-[200px]">
                <p className="font-serif text-lg uppercase tracking-widest text-foreground">
                  {ALL_BOSSES[rosterIndex % ALL_BOSSES.length]?.name}
                </p>
                <p className="text-[10px] font-mono uppercase text-muted-foreground">
                  {ALL_BOSSES[rosterIndex % ALL_BOSSES.length]?.title}
                </p>
                <p className="text-[10px] mt-1" style={{ color: GOLD }}>
                  {ALL_BOSSES[rosterIndex % ALL_BOSSES.length]?.style} · T
                  {ALL_BOSSES[rosterIndex % ALL_BOSSES.length]?.tier}
                </p>
              </div>
              <button
                type="button"
                className="p-2 rounded border border-white/15 hover:border-primary/50"
                onClick={() => setRosterIndex((i) => (i + 1) % ALL_BOSSES.length)}
              >
                <ChevronRight className="w-4 h-4" style={{ color: GOLD }} />
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground font-serif px-2">
              {ALL_BOSSES[rosterIndex % ALL_BOSSES.length]?.blurb}
            </p>

            <div className="flex items-center justify-center gap-2">
              <span className="font-serif text-xs tracking-widest uppercase text-muted-foreground">Tier</span>
              {[1, 2, 3, 4, 5].map((t) => (
                <button
                  key={t}
                  onClick={() => setTier(t)}
                  className="w-9 h-9 font-serif text-sm rounded border transition-colors"
                  style={{
                    borderColor: tier === t ? GOLD : "#444",
                    color: tier === t ? GOLD : "#888",
                    background: tier === t ? "rgba(197,160,89,0.12)" : "transparent",
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
            <button
              onClick={handleSummon}
              className="w-full h-14 font-serif text-lg tracking-widest uppercase rounded transition-colors"
              style={{ background: GOLD, color: "#1a1208" }}
            >
              Enter Fight
            </button>
            {!stats && (
              <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-2">
                <Loader2 className="w-3 h-3 animate-spin" /> Loading fighter stats…
              </p>
            )}
          </ParchmentPanel>
        </div>
      )}

      {/* ── Unified combat HUD ── */}
      {boss && hud && (
        <>
          <UnifiedCombatHud
            state={fromArenaState(hud, {
              charName: String(charName ?? "Fighter"),
              raceClass: `${String(char.race ?? "")} ${String(char.class ?? "")}`.trim(),
              skills: skillSlots.map((s, i) => ({
                id: `slot_${i}`,
                name: s.name,
                key: String(i + 1),
                icon: s.icon,
                glyph: s.glyph,
                readyPct: hud.skillCooldownPct[i] ?? 1,
              })),
              bossStyle: bossStyleLabel || boss.style || null,
              zone: "Arena of Blood",
            })}
            onSkill={(idx) => sceneRef.current?.useSkill(idx)}
            onAttack={() => sceneRef.current?.attackNearest()}
            onDodge={() => sceneRef.current?.doDodge()}
            rightRail={
              <div className="w-[210px]">
                <MultiplayerPanel
                  mode="arena"
                  roomKey="quick"
                  compact
                  onClient={(c) => {
                    mpClientRef.current = c;
                    sceneRef.current?.setMpRoom(c?.room ?? null);
                  }}
                  onSnapshots={(_t, snaps, localId) => {
                    sceneRef.current?.syncRemotePlayers(snaps, localId);
                  }}
                  onKill={(killer, victim) => {
                    toast.message(`PvP: ${killer} downed ${victim}`);
                  }}
                />
              </div>
            }
          />

          {/* Loading overlay until models stream in */}
          {!hud.loaded && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/50">
              <Loader2 className="w-10 h-10 animate-spin" style={{ color: GOLD }} />
              <p className="font-serif tracking-widest uppercase text-sm" style={{ color: GOLD }}>Entering the arena...</p>
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
