/**
 * UnifiedCombatHud — single combat shell for island, boss arena, camp, and moba.
 *
 * Layout (pointer-events: none shell; interactive chips only):
 *   TOP     mode strip · combat pill · boss bar · zone
 *   CENTER  interact prompt · telegraph
 *   BOTTOM  vitals | skill bar + actions | combat log
 *   FLOAT   enemy HP ticks · damage numbers
 *   SIDES   optional right rail (party / minimap / multiplayer)
 */
import { memo, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  GOLD,
  HUD_GLASS,
  type UnifiedCombatHudState,
} from "@/data/combatHudModel";
import { SkillIcon } from "@/components/SkillIcon";
import { Swords, Zap, Shield, Crosshair } from "lucide-react";

const TIER_COLORS: Record<number, string> = {
  1: "#9ca3af",
  2: "#22c55e",
  3: "#3b82f6",
  4: "#a855f7",
  5: "#f59e0b",
  6: "#ef4444",
};

const MODE_LABEL: Record<string, string> = {
  island: "Island",
  boss: "Boss Arena",
  camp: "Camp",
  moba: "MOBA",
  pvp: "PvP",
};

function formatRuntime(ms: number) {
  const total = Math.floor(ms / 1000);
  const m = String(Math.floor(total / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return `${m}:${s}`;
}

function SmoothBar({
  pct,
  color,
  height = 7,
  gradient,
}: {
  pct: number;
  color: string;
  height?: number;
  gradient?: string;
}) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div
      className="rounded-full overflow-hidden"
      style={{
        height,
        background: "rgba(0,0,0,0.45)",
        boxShadow: "inset 0 1px 2px rgba(0,0,0,0.6)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${clamped}%`,
          borderRadius: 999,
          background: gradient ?? color,
          transition: "width 120ms linear",
          boxShadow: `0 0 8px ${color}55`,
        }}
      />
    </div>
  );
}

function logColor(msg: string): string {
  if (/hits you|hit you|Bolt|Beam|Slam|Eruption|slain|defeated you/i.test(msg)) return "#ff8578";
  if (/defeated|XP|Unlocked|Round|Victory|Colossus Fallen/i.test(msg)) return "#ffc666";
  if (/CRIT|✦/i.test(msg)) return "#ff8844";
  if (/winds up|marks|channels|telegraph|⚠/i.test(msg)) return "#ff9a6a";
  if (/mana|MP|stone|wood|gold/i.test(msg)) return "#72bbff";
  return "#dceaff";
}

export interface UnifiedCombatHudProps {
  state: UnifiedCombatHudState;
  /** Right rail: party, minimap, mp panel */
  rightRail?: ReactNode;
  /** Extra bottom actions (Attack / Panel / etc.) */
  bottomActions?: ReactNode;
  onSkill?: (idx: number) => void;
  onSpecial?: () => void;
  onAttack?: () => void;
  onDodge?: () => void;
  controlsHint?: string;
  startMs?: number;
  className?: string;
}

export const UnifiedCombatHud = memo(function UnifiedCombatHud({
  state,
  rightRail,
  bottomActions,
  onSkill,
  onSpecial,
  onAttack,
  onDodge,
  controlsHint,
  startMs,
  className,
}: UnifiedCombatHudProps) {
  const [runtime, setRuntime] = useState("00:00");
  const startRef = useRef(startMs ?? performance.now());

  useEffect(() => {
    const id = window.setInterval(() => {
      setRuntime(formatRuntime(performance.now() - startRef.current));
    }, 250);
    return () => clearInterval(id);
  }, []);

  const hpPct = (state.playerHp / Math.max(1, state.playerMaxHp)) * 100;
  const manaPct = (state.playerMana / Math.max(1, state.playerMaxMana)) * 100;
  const atkPct = Math.max(0, Math.min(100, (state.attackReadyPct ?? 1) * 100));
  const bossPct =
    state.bossAlive && state.bossMaxHp
      ? (Math.max(0, state.bossHp ?? 0) / Math.max(1, state.bossMaxHp)) * 100
      : 0;
  const hpColor = hpPct > 50 ? "#59e194" : hpPct > 25 ? "#ffc666" : "#ff6565";
  const combatLabel =
    state.combatLabel ??
    (state.blocking ? "BLOCK" : state.jumping ? "AIR" : "IDLE");
  const invuln = !!state.invulnerable;
  const logLines = useMemo(() => state.combatLog.slice(0, 7), [state.combatLog]);
  const specialPct = state.specialReadyPct ?? 1;

  const defaultHint =
    controlsHint ??
    (state.mode === "boss"
      ? "WASD · F attack · Shift+WASD dodge · Shift alone flees boss · 1–5"
      : state.mode === "camp"
        ? "WASD · F attack · Shift dodge · E station · 1–5 · C panel"
        : state.mode === "moba"
          ? "WASD · F/Space/E attack"
          : "WASD · Shift+WASD dodge · Shift alone flees threat · Q block · Space · F · 1–5 · R · E · C · V");

  return (
    <div
      className={`pointer-events-none absolute inset-0 z-10 flex flex-col justify-between ${className ?? ""}`}
      style={{ fontFamily: "Cinzel, Bahnschrift, 'Segoe UI', system-ui, sans-serif" }}
    >
      {/* ── TOP ── */}
      <div className="flex flex-col items-center gap-1.5 pt-2 px-2 relative">
        {/* Mode strip */}
        <div
          className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-3.5 py-1.5 text-[11px] leading-none"
          style={{ ...HUD_GLASS, color: "#eaf4ff" }}
        >
          <span className="font-serif uppercase tracking-[0.18em]" style={{ color: GOLD }}>
            {MODE_LABEL[state.mode] ?? state.mode}
          </span>
          {state.aliveCount != null && (
            <span>
              <span className="text-[#9ab0c6]">Alive </span>
              <span className="font-bold text-[#ff8578]">{state.aliveCount}</span>
            </span>
          )}
          {state.roundOrWave != null && (
            <span>
              <span className="text-[#9ab0c6]">
                {state.mode === "moba" ? "Wave " : "Round "}
              </span>
              <span className="font-bold text-[#53ddb0]">{state.roundOrWave}</span>
            </span>
          )}
          {state.difficultyMult != null && state.difficultyMult > 0 && (
            <span>
              <span className="text-[#9ab0c6]">×</span>
              <span className="font-bold text-[#72bbff]">{state.difficultyMult.toFixed(2)}</span>
            </span>
          )}
          <span className="text-[#9ab0c6] font-mono">{state.runtimeLabel ?? runtime}</span>
          {state.activePerks?.length ? (
            <span className="text-[#c5a059] max-w-[160px] truncate font-serif text-[10px]">
              {state.activePerks.slice(0, 3).join(" · ")}
            </span>
          ) : null}
        </div>

        {/* Combat state pill */}
        <div
          className="px-3 py-0.5 rounded-full text-[10px] tracking-[0.2em] font-semibold uppercase"
          style={{
            background: invuln ? "rgba(83,221,176,0.18)" : "rgba(8,12,18,0.65)",
            border: invuln
              ? "1px solid rgba(83,221,176,0.7)"
              : "1px solid rgba(197,160,89,0.25)",
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
          <div
            className="w-[min(420px,92vw)] px-3 py-2 mt-0.5"
            style={HUD_GLASS}
          >
            <div className="flex justify-between items-end mb-1 gap-2">
              <p
                className="text-[11px] tracking-[0.18em] uppercase font-serif truncate"
                style={{ color: "#ff8578", textShadow: "0 1px 2px #000" }}
              >
                {state.bossName}
                {state.bossTitle ? (
                  <span className="text-[#9ab0c6] font-normal"> · {state.bossTitle}</span>
                ) : null}
              </p>
              <span className="text-[9px] font-mono uppercase shrink-0" style={{ color: GOLD }}>
                {state.bossPhase != null
                  ? `Ph ${state.bossPhase}/${state.bossMaxPhases ?? 3}`
                  : ""}
                {state.bossStyle ? ` · ${state.bossStyle}` : ""}
              </span>
            </div>
            <SmoothBar
              pct={bossPct}
              color="#e23b3b"
              height={10}
              gradient="linear-gradient(90deg, #7a1515, #e23b3b 55%, #ff8866)"
            />
            <div className="flex justify-between text-[9px] font-mono text-[#9ab0c6] mt-0.5">
              <span>
                {Math.round(state.bossHp ?? 0)} / {Math.round(state.bossMaxHp ?? 0)}
              </span>
            </div>
          </div>
        )}

        {/* Telegraph */}
        {state.bossTelegraph && state.bossAlive && (
          <div
            className="px-3 py-1 text-[11px] tracking-widest uppercase font-serif"
            style={{
              color: "#ffb84d",
              background: "rgba(120,40,0,0.65)",
              border: "1px solid #ff8800",
              borderRadius: 8,
              textShadow: "0 1px 2px #000",
            }}
          >
            ⚠ {state.bossTelegraph}
          </div>
        )}

        <p className="text-[10px] text-[#9ab0c6] tracking-[0.16em] uppercase opacity-85 max-w-[90vw] truncate text-center">
          {state.zone}
        </p>
        {state.missionLine && (
          <p className="text-[10px] font-mono text-[#c5a059]/90 max-w-[90vw] truncate text-center">
            {state.missionLine}
          </p>
        )}
      </div>

      {/* ── CENTER prompts ── */}
      <div className="flex-1 flex flex-col items-center justify-end pb-2 gap-2 min-h-0">
        {state.interact && (
          <div className="px-4 py-2.5 text-center min-w-[220px] max-w-[min(340px,90vw)]" style={HUD_GLASS}>
            <p className="text-sm tracking-widest uppercase font-serif" style={{ color: GOLD }}>
              {state.interact.title}
            </p>
            {state.interact.subtitle && (
              <p className="text-[10px] text-[#9ab0c6] mt-0.5">{state.interact.subtitle}</p>
            )}
            {state.interact.hint && (
              <p className="text-[11px] mt-1 text-amber-100/90 font-serif">{state.interact.hint}</p>
            )}
            {state.interact.key && (
              <p className="text-[11px] font-mono mt-1.5 tracking-widest" style={{ color: GOLD }}>
                [{state.interact.key}]
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── RIGHT RAIL ── */}
      {rightRail && (
        <div className="absolute top-14 right-3 z-20 flex flex-col items-end gap-2 pointer-events-auto max-w-[220px]">
          {rightRail}
        </div>
      )}

      {/* ── BOTTOM ── */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-2 items-end px-3 pb-3">
        {/* Vitals */}
        <div
          className="justify-self-start w-[min(290px,calc(100vw-24px))] px-3 py-2.5"
          style={HUD_GLASS}
        >
          <div className="flex justify-between items-baseline mb-1.5 gap-2">
            <span className="text-[13px] font-serif tracking-widest uppercase truncate" style={{ color: GOLD }}>
              {state.charName}
            </span>
            <span className="text-[10px] text-[#9ab0c6] shrink-0 font-mono">
              Lv {state.playerLevel}
              {state.raceClass ? ` · ${state.raceClass}` : ""}
            </span>
          </div>
          <div className="flex justify-between text-[10px] text-[#9ab0c6] mb-0.5">
            <span className="tracking-widest uppercase">HP</span>
            <span style={{ color: hpColor }} className="font-mono">
              {Math.round(state.playerHp)} / {Math.round(state.playerMaxHp)}
            </span>
          </div>
          <SmoothBar
            pct={hpPct}
            color={hpColor}
            height={9}
            gradient="linear-gradient(90deg, #ff6565, #ffc666 48%, #59e194)"
          />
          <div className="mt-1.5 flex justify-between text-[10px] text-[#9ab0c6] mb-0.5">
            <span className="tracking-widest uppercase">MP</span>
            <span className="text-[#72bbff] font-mono">
              {Math.round(state.playerMana)} / {Math.round(state.playerMaxMana)}
            </span>
          </div>
          <SmoothBar pct={manaPct} color="#3b82f6" height={7} />
          <div className="mt-1.5">
            <SmoothBar pct={atkPct} color="#ffaa00" height={4} />
          </div>
          {state.resources && (
            <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-[#9ab0c6] font-mono">
              {state.resources.gold != null && <span style={{ color: GOLD }}>🪙 {state.resources.gold}</span>}
              {state.resources.wood != null && <span>🪵 {state.resources.wood}</span>}
              {state.resources.stone != null && <span>🪨 {state.resources.stone}</span>}
              {state.resources.embers != null && <span>🔥 {state.resources.embers}</span>}
            </div>
          )}
        </div>

        {/* Skills + actions */}
        <div className="justify-self-center flex flex-col items-center gap-1.5">
          {state.skills.length > 0 && (
            <div className="pointer-events-auto flex gap-1.5 items-end">
              {state.skills.slice(0, 5).map((sk, i) => {
                const ready = (sk.readyPct ?? 1) >= 0.99;
                const cd = sk.readyPct ?? 1;
                return (
                  <button
                    key={sk.id}
                    type="button"
                    onClick={() => onSkill?.(i)}
                    title={sk.name}
                    className="relative w-11 h-11 rounded-lg transition-transform hover:-translate-y-0.5 active:scale-95 overflow-hidden"
                    style={{
                      background: "rgba(8,10,14,0.85)",
                      border: sk.pending
                        ? "2px solid #66ccff"
                        : ready
                          ? `2px solid ${GOLD}99`
                          : "2px solid rgba(255,255,255,0.12)",
                      boxShadow: sk.pending ? "0 0 12px #66ccff66" : "inset 0 0 6px #000",
                    }}
                  >
                    {sk.icon ? (
                      <SkillIcon icon={sk.icon} glyph={sk.glyph ?? "✦"} size={40} radius={4} />
                    ) : (
                      <span className="text-base leading-none" style={{ color: GOLD }}>
                        {sk.glyph ?? sk.key ?? i + 1}
                      </span>
                    )}
                    <span className="absolute top-0.5 left-1 text-[8px] font-mono text-neutral-400">
                      {sk.key ?? i + 1}
                    </span>
                    {sk.isSignature && (
                      <span className="absolute bottom-0 right-0.5 text-[8px]" style={{ color: GOLD }}>
                        ★
                      </span>
                    )}
                    {!ready && (
                      <span
                        className="absolute inset-0 bg-black/70"
                        style={{ clipPath: `inset(0 0 ${cd * 100}% 0)` }}
                      />
                    )}
                  </button>
                );
              })}
              {(onSpecial || state.specialReadyPct != null) && state.mode !== "moba" && (
                <button
                  type="button"
                  onClick={() => onSpecial?.()}
                  title="Special (R)"
                  className="relative w-11 h-11 rounded-lg flex flex-col items-center justify-center"
                  style={{
                    background: "rgba(83,221,176,0.1)",
                    border: `2px solid rgba(83,221,176,${0.35 + 0.45 * specialPct})`,
                    color: "#53ddb0",
                    opacity: 0.55 + 0.45 * specialPct,
                  }}
                >
                  <Zap className="w-4 h-4" />
                  <span className="text-[8px] font-mono">R</span>
                </button>
              )}
            </div>
          )}

          <div className="pointer-events-auto flex gap-1.5">
            {onAttack && (
              <ActionChip icon={<Swords className="w-3.5 h-3.5" />} label="Atk" onClick={onAttack} />
            )}
            {onDodge && (
              <ActionChip icon={<Crosshair className="w-3.5 h-3.5" />} label="Dodge" onClick={onDodge} />
            )}
            {bottomActions}
          </div>
          <p className="text-[9px] text-[#9ab0c6] text-center max-w-[320px] leading-snug px-1">
            {defaultHint}
          </p>
        </div>

        {/* Combat log */}
        <div className="justify-self-end w-[min(270px,calc(100vw-24px))] space-y-0.5 text-right px-2 py-1.5" style={logLines.length ? HUD_GLASS : undefined}>
          {logLines.map((msg, i) => (
            <div
              key={`${i}-${msg.slice(0, 28)}`}
              className="text-[11px] tracking-wide font-serif"
              style={{
                color: logColor(msg),
                opacity: Math.max(0.28, 1 - i * 0.11),
                textShadow: "0 1px 2px rgba(0,0,0,0.75)",
              }}
            >
              {msg}
            </div>
          ))}
        </div>
      </div>

      {/* Floating enemy HP */}
      {state.enemies.map((en) => {
        if (typeof window === "undefined") return null;
        if (
          en.screenX < -40 ||
          en.screenX > window.innerWidth + 40 ||
          en.screenY < -20 ||
          en.screenY > window.innerHeight + 20
        ) {
          return null;
        }
        const pct = (en.hp / Math.max(1, en.maxHp)) * 100;
        const col = pct > 50 ? "#59e194" : pct > 25 ? "#ffc666" : "#ff6565";
        const tierColor = TIER_COLORS[en.tier ?? 1] ?? "#9ca3af";
        return (
          <div
            key={en.id}
            className="absolute pointer-events-none"
            style={{ left: en.screenX - 42, top: en.screenY - 36, width: 84 }}
          >
            <p
              className="text-center text-[9px] tracking-widest uppercase mb-0.5 truncate font-serif"
              style={{
                color: en.isBoss ? "#ff8578" : tierColor,
                textShadow: "0 1px 2px #000",
              }}
            >
              {en.name}
            </p>
            <SmoothBar pct={pct} color={col} height={5} />
          </div>
        );
      })}

      {/* Damage floats */}
      {state.damageNumbers.map((d) => (
        <div
          key={d.id}
          className="absolute pointer-events-none font-mono font-bold select-none"
          style={{
            left: d.x,
            top: d.y - d.age * 36,
            transform: "translate(-50%, -50%)",
            color: d.isPlayer ? "#ff8578" : d.isCrit ? "#ffc666" : "#eaf4ff",
            fontSize: d.isCrit ? 17 : 13,
            opacity: Math.max(0, 1 - d.age / 1.4),
            textShadow: "0 1px 3px #000",
            zIndex: 20,
          }}
        >
          {d.isCrit ? "✦" : ""}
          {d.value}
        </div>
      ))}
    </div>
  );
});

function ActionChip({
  icon,
  label,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] tracking-widest uppercase transition-transform hover:-translate-y-0.5"
      style={{
        border: `1px solid ${GOLD}55`,
        background: "rgba(13,18,24,0.7)",
        color: GOLD,
      }}
    >
      {icon}
      {label}
    </button>
  );
}

/** Thin re-export so existing imports of GameCombatHud keep working. */
export { UnifiedCombatHud as GameCombatHudShell };
