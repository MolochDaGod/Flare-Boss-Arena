/**
 * Optimized combat HUD — UI/UX patterns from annihilate-reference GrudgeUi.js:
 *   • full-screen overlay with pointer-events: none (only interactive chips clickable)
 *   • glass strips + 120ms linear bar fills (CSS transition, not React spring spam)
 *   • team/alive strip, active combat state badge, runtime clock
 *   • combat log without framer-motion per-line (cheaper opacity stack)
 *   • world-space enemy HP ticks with CSS width transition only
 *
 * Keep this presentational: engine still owns truth; parent passes throttled GameState.
 */
import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { GameState } from "@/game/GameEngine";

const GOLD = "#c5a059";
const TIER_COLORS: Record<number, string> = {
  1: "#9ca3af",
  2: "#22c55e",
  3: "#3b82f6",
  4: "#a855f7",
  5: "#f59e0b",
  6: "#ef4444",
};

function formatRuntime(ms: number) {
  const total = Math.floor(ms / 1000);
  const m = String(Math.floor(total / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return `${m}:${s}`;
}

/** Imperative-style fill bar (GrudgeUi 120ms linear). */
function SmoothBar({
  pct,
  color,
  height = 7,
  className = "",
}: {
  pct: number;
  color: string;
  height?: number;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div
      className={`rounded-full overflow-hidden ${className}`}
      style={{
        height,
        background: "rgba(255,255,255,0.12)",
        boxShadow: "inset 0 1px 2px rgba(0,0,0,0.55)",
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${clamped}%`,
          borderRadius: 999,
          background: color,
          transition: "width 120ms linear",
        }}
      />
    </div>
  );
}

function logColor(msg: string): string {
  if (/hits you|hit you|Bolt|Beam|Slam|Eruption/i.test(msg)) return "#ff8578";
  if (/defeated|XP|Unlocked|Round/i.test(msg)) return "#ffc666";
  if (/CRIT/i.test(msg)) return "#ff8844";
  if (/winds up|marks the ground|channels|unleashes/i.test(msg)) return "#ff9a6a";
  return "#dceaff";
}

export interface GameCombatHudProps {
  state: GameState;
  charName: string;
  raceClass: string;
  skillBar: Array<{ id: string; name: string; icon?: string } | undefined>;
  skillCdPct?: number[];
  specialReadyPct: number;
  onSkill?: (idx: number) => void;
  startMs?: number;
}

export const GameCombatHud = memo(function GameCombatHud({
  state,
  charName,
  raceClass,
  skillBar,
  specialReadyPct,
  onSkill,
  startMs,
}: GameCombatHudProps) {
  const [runtime, setRuntime] = useState("00:00");
  const startRef = useRef(startMs ?? performance.now());

  useEffect(() => {
    const id = window.setInterval(() => {
      setRuntime(formatRuntime(performance.now() - startRef.current));
    }, 250); // GrudgeUi polls at 250ms — not 60Hz React
    return () => clearInterval(id);
  }, []);

  const hpPct = (state.playerHp / Math.max(1, state.playerMaxHp)) * 100;
  const manaPct = (state.playerMana / Math.max(1, state.playerMaxMana)) * 100;
  const atkPct = (1 - state.playerAttackCooldown) * 100;
  const bossPct = state.bossAlive
    ? (state.bossHp / Math.max(1, state.bossMaxHp)) * 100
    : 0;
  const hpColor = hpPct > 50 ? "#59e194" : hpPct > 25 ? "#ffc666" : "#ff6565";
  const combatLabel = state.combatLabel ?? (state.blocking ? "BLOCK" : state.jumping ? "AIR" : "IDLE");
  const alive = state.enemies.length;
  const invuln = !!state.invulnerable;

  const logLines = useMemo(() => state.combatLog.slice(0, 6), [state.combatLog]);

  return (
    <div
      className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between"
      style={{ fontFamily: "Bahnschrift, 'Segoe UI', system-ui, sans-serif" }}
      aria-hidden={false}
    >
      {/* ── Top strip (GrudgeUi grudge-strip) ── */}
      <div className="flex flex-col items-center gap-1.5 pt-2 px-2">
        <div
          className="flex flex-wrap items-center justify-center gap-3 px-3 py-1.5 rounded-xl text-[11px] leading-none"
          style={{
            background: "rgba(6,12,18,0.52)",
            border: "1px solid rgba(130,170,206,0.28)",
            backdropFilter: "blur(3px)",
            textShadow: "0 1px 2px rgba(0,0,0,0.7)",
            color: "#eaf4ff",
          }}
        >
          <span>
            <span className="text-[#9ab0c6]">Alive </span>
            <span className="font-bold text-[#ff8578]">{alive}</span>
          </span>
          <span>
            <span className="text-[#9ab0c6]">Round </span>
            <span className="font-bold text-[#53ddb0]">{state.islandRound}</span>
          </span>
          <span>
            <span className="text-[#9ab0c6]">×</span>
            <span className="font-bold text-[#72bbff]">{state.difficultyMult.toFixed(2)}</span>
          </span>
          <span className="text-[#9ab0c6]">{runtime}</span>
          {state.activePerks?.length ? (
            <span className="text-[#c5a059] max-w-[180px] truncate">
              {state.activePerks.slice(0, 3).join(" · ")}
            </span>
          ) : null}
        </div>

        {/* Combat state pill */}
        <div
          className="px-3 py-0.5 rounded-full text-[11px] tracking-widest font-semibold"
          style={{
            background: invuln ? "rgba(83,221,176,0.2)" : "rgba(8,16,24,0.55)",
            border: invuln
              ? "1px solid rgba(83,221,176,0.7)"
              : "1px solid rgba(130,170,206,0.25)",
            color: invuln ? "#53ddb0" : "#dceaff",
            textShadow: "0 1px 2px rgba(0,0,0,0.7)",
          }}
        >
          {combatLabel}
          {state.blocking ? " · Q" : ""}
          {invuln && combatLabel !== "DODGE" ? " · IFRAME" : ""}
        </div>

        {/* Boss bar */}
        {state.bossAlive && state.bossName && (
          <div className="w-[min(320px,90vw)] mt-0.5">
            <p
              className="text-center text-[10px] tracking-widest uppercase mb-0.5"
              style={{ color: "#ff8578", textShadow: "0 1px 2px rgba(0,0,0,0.7)" }}
            >
              {state.bossName}
            </p>
            <SmoothBar pct={bossPct} color="#e23b3b" height={9} />
          </div>
        )}

        <p className="text-[10px] text-[#9ab0c6] tracking-[0.18em] uppercase opacity-80">
          {state.zone}
        </p>
      </div>

      {/* ── Center prompts ── */}
      <div className="flex-1 flex flex-col items-center justify-end pb-2 gap-2">
        {state.nearbyPirate && (
          <div
            className="px-4 py-2 rounded-xl text-center min-w-[240px]"
            style={{
              background: "rgba(5,10,16,0.72)",
              border: "1px solid rgba(197,160,89,0.35)",
              backdropFilter: "blur(4px)",
            }}
          >
            <p className="text-sm tracking-widest uppercase" style={{ color: GOLD }}>
              {state.nearbyPirate.name}
            </p>
            <p className="text-[10px] text-[#9ab0c6]">{state.nearbyPirate.title}</p>
            <p className="text-[11px] mt-1 text-amber-100/90">{state.nearbyPirate.prompt}</p>
            <p className="text-[10px] font-mono mt-1 tracking-widest" style={{ color: GOLD }}>
              [E]
            </p>
          </div>
        )}
        {!state.nearbyPirate && state.nearbyHarvest && (
          <p
            className="text-[11px] px-3 py-1 rounded-lg text-emerald-200/90"
            style={{
              background: "rgba(5,10,16,0.7)",
              border: "1px solid rgba(130,170,206,0.2)",
            }}
          >
            {state.nearbyHarvest}
          </p>
        )}
      </div>

      {/* ── Bottom: player frame + skills + log ── */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-2 items-end px-3 pb-3">
        {/* Player vitals (grudge-footer style) */}
        <div
          className="justify-self-start w-[min(280px,calc(100vw-24px))] px-3 py-2 rounded-xl"
          style={{
            background: "rgba(5,10,16,0.55)",
            border: "1px solid rgba(130,170,206,0.26)",
            backdropFilter: "blur(3px)",
            textShadow: "0 1px 2px rgba(0,0,0,0.7)",
          }}
        >
          <div className="flex justify-between items-baseline mb-1">
            <span className="text-[12px] text-[#dceaff]">{charName}</span>
            <span className="text-[10px] text-[#9ab0c6]">
              Lv {state.playerLevel} · {raceClass}
            </span>
          </div>
          <div className="flex justify-between text-[10px] text-[#9ab0c6] mb-0.5">
            <span>HP</span>
            <span style={{ color: hpColor }}>
              {state.playerHp} / {state.playerMaxHp}
            </span>
          </div>
          <div
            className="rounded-full overflow-hidden"
            style={{
              height: 8,
              background: "rgba(255,255,255,0.12)",
              boxShadow: "inset 0 1px 2px rgba(0,0,0,0.55)",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${Math.max(0, Math.min(100, hpPct))}%`,
                borderRadius: 999,
                background: "linear-gradient(90deg, #ff6565, #ffc666 48%, #59e194)",
                transition: "width 120ms linear",
              }}
            />
          </div>
          <div className="mt-1.5 flex justify-between text-[10px] text-[#9ab0c6] mb-0.5">
            <span>MP</span>
            <span className="text-[#72bbff]">
              {state.playerMana} / {state.playerMaxMana}
            </span>
          </div>
          <SmoothBar pct={manaPct} color="#3b82f6" height={6} />
          <div className="mt-1">
            <SmoothBar pct={atkPct} color="#ffaa00" height={4} />
          </div>
          <div className="mt-1.5 flex gap-2 text-[10px] text-[#9ab0c6]">
            <span>🪙 {state.gold}</span>
            <span>🪵 {state.resources?.wood ?? 0}</span>
            <span>🪨 {state.resources?.stone ?? 0}</span>
          </div>
        </div>

        {/* Skill bar + controls */}
        <div className="justify-self-center flex flex-col items-center gap-1.5">
          <div className="pointer-events-auto flex gap-1.5">
            {skillBar.slice(0, 5).map((sk, i) => (
              <button
                key={sk?.id ?? i}
                type="button"
                onClick={() => onSkill?.(i)}
                title={sk?.name ?? `Skill ${i + 1}`}
                className="w-10 h-10 rounded-lg text-[10px] font-mono tracking-wide transition-transform hover:-translate-y-0.5"
                style={{
                  background: "rgba(13,23,34,0.55)",
                  border: "1px solid rgba(140,191,221,0.3)",
                  color: "#eaf3fe",
                  boxShadow:
                    i === 0 && specialReadyPct >= 0.99
                      ? "0 0 0 1px rgba(83,221,176,0.5) inset"
                      : undefined,
                }}
              >
                {i + 1}
              </button>
            ))}
            <button
              type="button"
              onClick={() => onSkill?.(-1)}
              title="Special (R)"
              className="w-10 h-10 rounded-lg text-[10px] font-mono"
              style={{
                background: "rgba(83,221,176,0.12)",
                border: "1px solid rgba(83,221,176,0.55)",
                color: "#53ddb0",
              }}
            >
              R
            </button>
          </div>
          <p className="text-[10px] text-[#9ab0c6] text-center max-w-[280px] leading-snug">
            WASD move · mouse aim · Shift dodge 4m to cursor · Q block · Space jump · LMB select · RMB attack · 1–5 · R · E
          </p>
        </div>

        {/* Combat log — no motion.div spam */}
        <div className="justify-self-end w-[min(260px,calc(100vw-24px))] space-y-0.5 text-right">
          {logLines.map((msg, i) => (
            <div
              key={`${i}-${msg.slice(0, 24)}`}
              className="text-[11px] tracking-wide"
              style={{
                color: logColor(msg),
                opacity: Math.max(0.25, 1 - i * 0.12),
                textShadow: "0 1px 2px rgba(0,0,0,0.75)",
              }}
            >
              {msg}
            </div>
          ))}
        </div>
      </div>

      {/* Floating enemy HP (CSS transition only) */}
      {state.enemies.map((en) => {
        if (
          en.screenX < -40 ||
          en.screenX > (typeof window !== "undefined" ? window.innerWidth + 40 : 2000) ||
          en.screenY < -20 ||
          en.screenY > (typeof window !== "undefined" ? window.innerHeight + 20 : 2000)
        ) {
          return null;
        }
        const pct = (en.hp / Math.max(1, en.maxHp)) * 100;
        const col = pct > 50 ? "#59e194" : pct > 25 ? "#ffc666" : "#ff6565";
        const tierColor = TIER_COLORS[en.tier] ?? "#9ca3af";
        return (
          <div
            key={en.id}
            className="absolute pointer-events-none"
            style={{ left: en.screenX - 40, top: en.screenY - 34, width: 80 }}
          >
            <p
              className="text-center text-[9px] tracking-widest uppercase mb-0.5 truncate"
              style={{ color: en.isBoss ? "#ff8578" : tierColor, textShadow: "0 1px 2px #000" }}
            >
              {en.name}
            </p>
            <SmoothBar pct={pct} color={col} height={5} />
          </div>
        );
      })}

      {/* Damage numbers — simple float, no framer */}
      {state.damageNumbers.map((d) => (
        <div
          key={d.id}
          className="absolute pointer-events-none font-mono font-bold select-none"
          style={{
            left: d.x,
            top: d.y - d.age * 36,
            transform: "translate(-50%, -50%)",
            color: d.isPlayer ? "#ff8578" : d.isCrit ? "#ffc666" : "#eaf4ff",
            fontSize: d.isCrit ? 16 : 13,
            opacity: Math.max(0, 1 - d.age / 1.4),
            textShadow: "0 1px 3px #000",
            zIndex: 20,
          }}
        >
          {d.isCrit ? "!" : ""}
          {d.value}
        </div>
      ))}
    </div>
  );
});
