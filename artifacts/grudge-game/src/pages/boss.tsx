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
  useListCharacters,
  useGenerateBoss,
  useGetClasses,
  useGetWeapons,
  useRecordBossDefeat,
} from "@workspace/api-client-react";
import {
  ArenaScene,
  type ArenaStateUpdate,
  type ArenaBossInput,
} from "@/game/ArenaScene";
import { CLASS_STARTER_WEAPON } from "@/data/starterGear";
import { useResolvedSkills } from "@/data/skillsResolver";
import {
  Loader2,
  Skull,
  Swords,
  ArrowLeft,
  AlertTriangle,
  Sword,
  Crosshair,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

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
        <div className="fixed inset-0 bg-black flex flex-col items-center justify-center gap-6 z-50">
          <AlertTriangle className="w-12 h-12 text-yellow-500" />
          <p className="font-serif text-primary uppercase tracking-widest text-lg">Arena Unavailable</p>
          <p className="text-sm text-muted-foreground max-w-xs text-center font-mono">
            {this.state.message || "WebGL is required to enter the arena."}
          </p>
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

  const { data: characters } = useListCharacters();
  const { data: classesData } = useGetClasses();
  const { data: weaponsData } = useGetWeapons();
  const char = characters?.[0];

  const [boss, setBoss] = useState<ArenaBossInput | null>(null);
  const [hud, setHud] = useState<ArenaStateUpdate | null>(null);
  const [tier, setTier] = useState(1);
  const [reward, setReward] = useState<string | null>(null);

  const generateBoss = useGenerateBoss();
  const recordDefeat = useRecordBossDefeat();

  const stats = useMemo(() => {
    if (!char) return null;
    return computeArenaStats(
      char as unknown as Record<string, unknown>,
      classesData,
      weaponsData,
    );
  }, [char, classesData, weaponsData]);

  const hudClass = char ? String((char as unknown as Record<string, unknown>).class ?? "warrior").toLowerCase() : null;
  const hudMainCategory = hudClass ? CLASS_STARTER_WEAPON[hudClass]?.category : null;
  const { classSkills: hudClassSkills, weaponSlots: hudWeaponSlots } = useResolvedSkills(hudClass, hudMainCategory);

  // Unified 5-slot skill bar: 2 class skills + 3 weapon-slot primaries.
  const skillSlots = useMemo<{ name: string; glyph?: string; icon?: string }[]>(() => {
    const classPart = (hudClassSkills?.skills ?? []).slice(0, 2).map((s) => ({
      name: s.name,
      glyph: s.glyph,
      icon: undefined as string | undefined,
    }));
    const weaponPart = hudWeaponSlots.slice(0, 3).map((slot) => {
      const sk = slot.skills[0];
      return { name: sk?.name ?? slot.label, glyph: undefined as string | undefined, icon: sk?.icon };
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
        const characterId = Number((char as unknown as Record<string, unknown>).id);
        if (bossId != null && Number.isFinite(characterId)) {
          recordDefeat.mutate(
            { id: bossId, data: { characterId } },
            {
              onSuccess: (loot) => {
                const l = loot as unknown as Record<string, unknown>;
                const gold = Number(l.goldDropped ?? 0);
                const xp = Number(l.xpGained ?? 0);
                const items = Array.isArray(l.itemsDropped) ? (l.itemsDropped as string[]) : [];
                const parts = [`+${gold} gold`, `+${xp} XP`];
                if (items.length > 0) parts.push(items.join(", "));
                setReward(parts.join(" · "));
              },
              onError: () => setReward("Spoils claimed."),
            },
          );
        }
      },
    });
    scene.init(mountRef.current);
    sceneRef.current = scene;
    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boss, stats]);

  const handleSummon = () => {
    if (!char) return;
    setReward(null);
    generateBoss.mutate(
      {
        data: {
          tier,
          playerClass: (char as unknown as Record<string, unknown>).class as string,
          playerLevel: Number((char as unknown as Record<string, unknown>).level ?? 1),
        },
      },
      {
        onSuccess: (b) => {
          const raw = b as unknown as Record<string, unknown>;
          const abilitiesRaw = (raw.abilities as Record<string, unknown>[]) ?? [];
          setBoss({
            id: Number(raw.id),
            name: String(raw.name ?? "Adversary"),
            title: String(raw.title ?? ""),
            maxHp: Number(raw.maxHp ?? 1000),
            phases: Number(raw.phases ?? 1),
            tier: Number(raw.tier ?? tier),
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
        },
        onError: () => toast.error("The ritual failed — no boss could be conjured."),
      },
    );
  };

  const handleRematch = () => {
    setBoss(null);
    setHud(null);
    setReward(null);
  };

  if (!char) {
    return (
      <div className="fixed inset-0 bg-background flex flex-col items-center justify-center gap-6">
        <p className="font-serif text-muted-foreground tracking-widest text-lg uppercase">No Warlord Found</p>
        <button
          onClick={() => setLocation("/character/new")}
          className="font-serif text-xs tracking-widest uppercase text-primary border border-primary/40 px-6 py-2 rounded hover:bg-primary/10 transition-colors"
        >
          Forge a Warlord
        </button>
      </div>
    );
  }

  const charName = String((char as unknown as Record<string, unknown>).name ?? "Warlord");

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

      {/* ── Pre-fight: summon screen ── */}
      {!boss && !generateBoss.isPending && (
        <div className="absolute inset-0 z-30 flex items-center justify-center p-6">
          <div className="max-w-md w-full p-8 text-center space-y-6 relative" style={stonePanel}>
            <Rivets />
            <div className="w-20 h-20 mx-auto rounded-full flex items-center justify-center border" style={{ borderColor: GOLD }}>
              <Skull className="w-10 h-10" style={{ color: GOLD }} />
            </div>
            <div>
              <h1 className="font-serif text-3xl uppercase tracking-widest mb-2" style={{ color: GOLD }}>
                Arena of Blood
              </h1>
              <p className="text-muted-foreground text-sm leading-relaxed">
                The AI forges a unique boss tailored to your might. Step into the arena and fight it in real time — dodge its
                telegraphs, weave your skills, break its phases.
              </p>
            </div>
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
              Conjure Adversary
            </button>
          </div>
        </div>
      )}

      {/* ── Generating ── */}
      {generateBoss.isPending && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-black/60">
          <Loader2 className="w-12 h-12 animate-spin" style={{ color: GOLD }} />
          <p className="font-serif tracking-widest uppercase animate-pulse" style={{ color: GOLD }}>
            Forging Adversary...
          </p>
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
            <div className="h-3 w-full bg-black/60 rounded overflow-hidden border border-black/50">
              <div
                className="h-full transition-[width] duration-150"
                style={{
                  width: `${(hud.bossHp / hud.bossMaxHp) * 100}%`,
                  background: "linear-gradient(to right, #7a0d0d, #e23b3b)",
                }}
              />
            </div>
            {boss.title && (
              <div className="text-center text-[10px] tracking-widest uppercase text-muted-foreground mt-1">{boss.title}</div>
            )}
          </div>

          {/* Floating boss telegraph warning */}
          <AnimatePresence>
            {hud.bossTelegraph && hud.bossAlive && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="absolute left-1/2 -translate-x-1/2 z-10 font-serif text-sm tracking-widest uppercase px-3 py-1 rounded"
                style={{ top: 92, color: "#ffb84d", background: "rgba(120,40,0,0.6)", border: "1px solid #ff8800" }}
              >
                ⚠ {hud.bossTelegraph}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Player vitals — bottom left */}
          <div className="absolute bottom-4 left-4 z-10 w-60 space-y-2 px-3.5 py-3" style={stonePanel}>
            <Rivets />
            <div className="flex justify-between items-center">
              <span className="font-serif text-sm tracking-widest uppercase" style={{ color: GOLD }}>
                {charName}
              </span>
              <span className="text-[10px] text-muted-foreground">Lv {hud.playerLevel}</span>
            </div>
            <div>
              <div className="flex justify-between text-[10px] text-muted-foreground mb-0.5">
                <span>HP</span>
                <span>{Math.round(hud.playerHp)}/{hud.playerMaxHp}</span>
              </div>
              <div className="h-3 w-full bg-black/60 rounded overflow-hidden border border-black/50">
                <div className="h-full bg-gradient-to-r from-red-900 to-red-500" style={{ width: `${(hud.playerHp / hud.playerMaxHp) * 100}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-[10px] text-muted-foreground mb-0.5">
                <span>MP</span>
                <span>{Math.round(hud.playerMana)}/{hud.playerMaxMana}</span>
              </div>
              <div className="h-2.5 w-full bg-black/60 rounded overflow-hidden border border-black/50">
                <div className="h-full bg-gradient-to-r from-blue-900 to-blue-500" style={{ width: `${(hud.playerMana / hud.playerMaxMana) * 100}%` }} />
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

          {/* Skill bar — bottom center */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex gap-2 px-3 py-2" style={stonePanel}>
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
                      src={`https://molochdagod.github.io/ObjectStore/icons/skill_nobg/${s.icon}`}
                      alt={s.name}
                      className="w-7 h-7 object-contain"
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

          {/* Action buttons — right of skill bar */}
          <div className="absolute bottom-4 z-10 flex gap-2" style={{ left: "calc(50% + 200px)" }}>
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
              className="w-12 h-12 rounded flex flex-col items-center justify-center border"
              style={{ borderColor: GOLD, background: "rgba(0,0,0,0.5)", color: GOLD }}
              title="Dodge [Space/Q]"
            >
              <Crosshair className="w-5 h-5" />
              <span className="text-[7px]">SPC</span>
            </button>
          </div>

          {/* Floating damage numbers */}
          <div className="absolute inset-0 z-10 pointer-events-none overflow-hidden">
            {hud.damageNumbers.map((d) => (
              <span
                key={d.id}
                className="absolute font-serif font-bold"
                style={{
                  left: d.x,
                  top: d.y - d.age * 36,
                  transform: "translate(-50%, -50%)",
                  opacity: Math.max(0, 1 - d.age / 1.4),
                  fontSize: d.isCrit ? 26 : 18,
                  color: d.isPlayer ? (d.isCrit ? "#ffd060" : "#ffe9b0") : "#ff5a5a",
                  textShadow: "0 0 4px #000, 0 2px 3px #000",
                }}
              >
                {d.isCrit ? "✦" : ""}{d.value}
              </span>
            ))}
          </div>

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
