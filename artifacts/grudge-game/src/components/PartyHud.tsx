import { useState } from "react";
import type { AllyHudSnapshot } from "@/game/GameEngine";
import { ChevronDown, ChevronUp, Users, Bug } from "lucide-react";

interface PartyHudProps {
  allies: AllyHudSnapshot[];
  loadErrors: string[];
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

function hpColor(ratio: number): string {
  if (ratio > 0.55) return "#5ec9a8";
  if (ratio > 0.3) return "#c5a059";
  return "#d46b6b";
}

export function PartyHud({ allies, loadErrors }: PartyHudProps) {
  const [debugOpen, setDebugOpen] = useState(false);

  if (!allies.length && !loadErrors.length) return null;

  return (
    <div className="rounded border border-white/10 bg-black/70 backdrop-blur-sm overflow-hidden pointer-events-auto">
      <div className="flex items-center gap-2 px-2.5 py-1.5 border-b border-white/5">
        <Users className="w-3 h-3 text-[#c5a059]" />
        <span className="text-[9px] font-serif uppercase tracking-widest text-[#c5a059]">Party</span>
        <span className="text-[8px] font-mono text-muted-foreground ml-auto">{allies.length}/2</span>
      </div>

      <div className="p-2 space-y-2">
        {allies.map((a) => {
          const ratio = a.dead ? 0 : a.maxHp > 0 ? a.hp / a.maxHp : 0;
          const roleColor = ROLE_COLORS[a.role] ?? "#c5a059";
          return (
            <div key={a.id} className={`space-y-1 ${a.dead ? "opacity-55" : ""}`}>
              <div className="flex items-center justify-between gap-2">
                <span className={`text-[10px] font-serif truncate ${a.dead ? "text-muted-foreground line-through" : "text-foreground"}`}>
                  {a.name}
                </span>
                <span
                  className="text-[7px] font-mono uppercase tracking-wider px-1 py-0.5 rounded shrink-0"
                  style={{ color: roleColor, border: `1px solid ${roleColor}44` }}
                >
                  {a.role}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${Math.round(ratio * 100)}%`, backgroundColor: hpColor(ratio) }}
                />
              </div>
              <div className="flex items-center justify-between text-[7px] font-mono text-muted-foreground">
                <span>{a.dead ? "—" : `${Math.round(a.hp)}/${a.maxHp}`}</span>
                <span className="uppercase tracking-wider truncate max-w-[90px]" title={a.goal ?? a.state}>
                  {a.dead
                    ? a.respawnSec > 0
                      ? `down · ${a.respawnSec}s`
                      : "down"
                    : a.goal ?? a.state}
                </span>
              </div>
              {!a.loadOk && (
                <p className="text-[7px] text-red-400 font-mono">Prefab load issue</p>
              )}
            </div>
          );
        })}

        {loadErrors.length > 0 && (
          <div className="text-[7px] font-mono text-red-400/90 space-y-0.5 pt-1 border-t border-white/5">
            {loadErrors.map((e, i) => (
              <p key={i} className="truncate" title={e}>{e}</p>
            ))}
          </div>
        )}
      </div>

      {allies.some((a) => a.debug) && (
        <>
          <button
            type="button"
            onClick={() => setDebugOpen((v) => !v)}
            className="w-full flex items-center justify-center gap-1 px-2 py-1 text-[7px] font-mono uppercase tracking-wider text-muted-foreground hover:text-[#c5a059] border-t border-white/5 transition-colors"
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
                    <p className="text-[#c5a059]">{a.name}</p>
                    <p>
                      anim: {a.debug.animSource} · pack {a.debug.animPack}
                      {a.debug.idleBindRatio != null ? ` · bind ${Math.round(a.debug.idleBindRatio * 100)}%` : ""}
                    </p>
                    <p>clips: {a.debug.clipNames.join(", ") || "—"}</p>
                    {a.gait != null && <p>gait: {a.gait.toFixed(2)}</p>}
                    <p>h: {a.debug.targetHeight?.toFixed(2) ?? "?"}m · meshes {a.debug.visibleMeshes.length} · bones {a.debug.boneCount}</p>
                    <p>tex slots: {a.debug.texturedSlots} · {a.debug.loadMs}ms</p>
                    {a.debug.errors.length > 0 && (
                      <p className="text-red-400">{a.debug.errors.join("; ")}</p>
                    )}
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