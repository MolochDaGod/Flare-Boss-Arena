/**
 * In-game party strip — Codex frost chrome + status icons + AI stance controls.
 */
import { useState, type ReactNode } from "react";
import type { AllyHudSnapshot } from "@/game/GameEngine";
import { ChevronDown, ChevronUp, Users, Bug, Shield, Axe, Bot } from "lucide-react";
import { CODEX_FROST, type StatusIconId } from "@/data/codexUiAssets";
import { StatusIcon, StatusIconRow } from "@/components/CodexUi";

interface PartyHudProps {
  allies: AllyHudSnapshot[];
  loadErrors: string[];
  /** Party-wide AI stance (GameEngine.setAlliesStance). */
  onStance?: (stance: "defend" | "harvest" | "auto") => void;
  /** Per-ally brain override (GameEngine.setAllyBrain). */
  onAllyBrain?: (allyId: string, brain: "bodyguard" | "gatherer" | "auto") => void;
}

const ROLE_COLORS: Record<string, string> = {
  healer: "#5ec9a8",
  tank: "#6b8fd4",
  ranger: "#c5a059",
  bruiser: "#d46b6b",
  fighter: "#d4a06b",
  skirmisher: "#b06bd4",
  unarmed: "#8a8a8a",
};

/** Role → status art for the ally portrait chip. */
const ROLE_STATUS: Record<string, StatusIconId> = {
  healer: "regen",
  tank: "shield",
  ranger: "lucky",
  bruiser: "rage",
  fighter: "strength",
  skirmisher: "haste",
  unarmed: "thorns",
};

function allyStatusIcons(a: AllyHudSnapshot): StatusIconId[] {
  const icons: StatusIconId[] = [];
  if (a.dead) {
    icons.push("weakness");
    return icons;
  }
  const roleIcon = ROLE_STATUS[a.role] ?? "strength";
  icons.push(roleIcon);
  const ratio = a.maxHp > 0 ? a.hp / a.maxHp : 1;
  if (ratio < 0.35) icons.push("bleed");
  else if (ratio < 0.55) icons.push("slow");
  if (a.state === "heal") icons.push("regen");
  if (a.state === "attack") icons.push("rage");
  if (a.state === "gather") icons.push("lucky");
  if (!a.loadOk) icons.push("curse");
  return [...new Set(icons)].slice(0, 4);
}

function hpColor(ratio: number): string {
  if (ratio > 0.55) return "#5ec9a8";
  if (ratio > 0.3) return "#c5a059";
  return "#d46b6b";
}

export function PartyHud({ allies, loadErrors, onStance, onAllyBrain }: PartyHudProps) {
  const [debugOpen, setDebugOpen] = useState(false);

  if (!allies.length && !loadErrors.length) return null;

  const stanceBtn = (
    label: string,
    stance: "defend" | "harvest" | "auto",
    icon: ReactNode,
  ) => (
    <button
      type="button"
      key={stance}
      disabled={!onStance}
      onClick={() => onStance?.(stance)}
      className="flex-1 flex items-center justify-center gap-1 px-1.5 py-1 rounded text-[7px] font-mono uppercase tracking-wider transition-colors disabled:opacity-40"
      style={{
        border: `1px solid ${CODEX_FROST.panelBorder}`,
        background: "rgba(0,0,0,0.35)",
        color: CODEX_FROST.ice,
      }}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div
      className="rounded-md overflow-hidden pointer-events-auto"
      style={{
        background: CODEX_FROST.panelBg,
        border: `1px solid ${CODEX_FROST.panelBorder}`,
        boxShadow: CODEX_FROST.glow,
      }}
    >
      <div
        className="flex items-center gap-2 px-2.5 py-1.5 border-b"
        style={{ borderColor: "rgba(120,190,230,0.12)" }}
      >
        <Users className="w-3 h-3" style={{ color: CODEX_FROST.accent }} />
        <span
          className="text-[9px] font-serif uppercase tracking-widest"
          style={{ color: CODEX_FROST.ice }}
        >
          Party
        </span>
        <StatusIcon id="shield" size={14} />
        <span className="text-[8px] font-mono text-muted-foreground ml-auto">
          {allies.length}/2
        </span>
      </div>

      {/* AI interface — party stance */}
      <div
        className="flex gap-1 px-2 py-1.5 border-b"
        style={{ borderColor: "rgba(120,190,230,0.12)" }}
      >
        {stanceBtn("Defend", "defend", <Shield className="w-2.5 h-2.5" />)}
        {stanceBtn("Harvest", "harvest", <Axe className="w-2.5 h-2.5" />)}
        {stanceBtn("Auto", "auto", <Bot className="w-2.5 h-2.5" />)}
      </div>

      <div className="p-2 space-y-2">
        {allies.map((a) => {
          const ratio = a.dead ? 0 : a.maxHp > 0 ? a.hp / a.maxHp : 0;
          const roleColor = ROLE_COLORS[a.role] ?? CODEX_FROST.gold;
          const statusIds = allyStatusIcons(a);
          const brainLabel = a.brain || "auto";
          return (
            <div
              key={a.id}
              className={`rounded border px-2 py-1.5 space-y-1 ${a.dead ? "opacity-55" : ""}`}
              style={{
                borderColor: `${roleColor}44`,
                background: "rgba(0,0,0,0.28)",
              }}
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded flex items-center justify-center shrink-0 border"
                  style={{
                    borderColor: `${roleColor}66`,
                    background: "rgba(10,20,30,0.8)",
                    boxShadow: `inset 0 0 8px ${roleColor}22`,
                  }}
                >
                  <StatusIcon
                    id={ROLE_STATUS[a.role] ?? "strength"}
                    size={20}
                    dimmed={a.dead}
                    title={a.role}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-[10px] font-serif truncate ${
                        a.dead ? "text-muted-foreground line-through" : "text-foreground"
                      }`}
                    >
                      {a.name}
                    </span>
                    <span
                      className="text-[7px] font-mono uppercase tracking-wider px-1 py-0.5 rounded shrink-0"
                      style={{ color: roleColor, border: `1px solid ${roleColor}44` }}
                    >
                      {a.role}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/10 overflow-hidden mt-0.5">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.round(ratio * 100)}%`,
                        backgroundColor: hpColor(ratio),
                      }}
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <StatusIconRow ids={statusIds} size={14} max={4} />
                <span className="text-[7px] font-mono text-muted-foreground uppercase tracking-wider shrink-0">
                  {a.dead
                    ? a.respawnSec > 0
                      ? `down · ${a.respawnSec}s`
                      : "down"
                    : `${Math.round(a.hp)}/${a.maxHp} · ${a.state} · ${brainLabel}`}
                </span>
              </div>
              {!a.dead && onAllyBrain && (
                <div className="flex gap-1 pt-0.5">
                  {(
                    [
                      ["Def", "bodyguard"],
                      ["Harv", "gatherer"],
                      ["Auto", "auto"],
                    ] as const
                  ).map(([lab, br]) => {
                    const on =
                      (br === "bodyguard" && brainLabel === "bodyguard") ||
                      (br === "gatherer" && brainLabel === "gatherer");
                    return (
                      <button
                        key={br}
                        type="button"
                        onClick={() => onAllyBrain(a.id, br)}
                        className="flex-1 px-1 py-0.5 rounded text-[6px] font-mono uppercase tracking-wider"
                        style={{
                          border: `1px solid ${on ? CODEX_FROST.accent : "rgba(120,190,230,0.2)"}`,
                          color: on ? CODEX_FROST.accent : CODEX_FROST.ice,
                          background: "rgba(0,0,0,0.25)",
                        }}
                      >
                        {lab}
                      </button>
                    );
                  })}
                </div>
              )}
              {!a.loadOk && (
                <p className="text-[7px] text-red-400 font-mono flex items-center gap-1">
                  <StatusIcon id="curse" size={12} /> Prefab load issue
                </p>
              )}
              {a.debug?.glbUrl && (
                <p className="text-[6px] font-mono text-muted-foreground truncate" title={a.debug.glbUrl}>
                  {a.debug.glbUrl.includes("toon-rts") ? "★ Toon RTS" : "mesh"} · {a.race}
                </p>
              )}
            </div>
          );
        })}

        {loadErrors.length > 0 && (
          <div className="text-[7px] font-mono text-red-400/90 space-y-0.5 pt-1 border-t border-white/5">
            {loadErrors.map((e, i) => (
              <p key={i} className="truncate" title={e}>
                {e}
              </p>
            ))}
          </div>
        )}
      </div>

      {allies.some((a) => a.debug) && (
        <>
          <button
            type="button"
            onClick={() => setDebugOpen((v) => !v)}
            className="w-full flex items-center justify-center gap-1 px-2 py-1 text-[7px] font-mono uppercase tracking-wider text-muted-foreground hover:text-[#7ec8e8] border-t transition-colors"
            style={{ borderColor: "rgba(120,190,230,0.12)" }}
          >
            <Bug className="w-2.5 h-2.5" />
            Animator debug
            {debugOpen ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
          </button>
          {debugOpen && (
            <div className="px-2 pb-2 space-y-2 max-h-36 overflow-y-auto text-[7px] font-mono text-muted-foreground">
              {allies.map((a) =>
                a.debug ? (
                  <div key={a.id} className="space-y-0.5 border-t border-white/5 pt-1 first:border-0 first:pt-0">
                    <p style={{ color: CODEX_FROST.accent }}>{a.name}</p>
                    <p className="truncate">anim {a.debug.animSource} · bones {a.debug.boneCount}</p>
                    <p className="truncate">meshes {a.debug.visibleMeshes?.slice(0, 4).join(", ")}</p>
                    {a.debug.errors?.length ? (
                      <p className="text-red-400/80 truncate">{a.debug.errors[0]}</p>
                    ) : null}
                  </div>
                ) : null,
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
