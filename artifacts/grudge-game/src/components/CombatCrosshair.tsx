/**
 * DRC / Open style weapon-aware combat crosshair (centre-fixed for iso combat).
 * Ported from gameopen Crosshair.tsx — shapes: dot | x | cross | ring.
 * Use in combat mode; hide OS cursor on the 3D mount.
 */
import { useEffect, useState } from "react";

export type CombatReticleShape = "dot" | "x" | "cross" | "ring";

export interface CombatCrosshairProps {
  visible?: boolean;
  /** Weapon shape — melee=dot, bow=x, gun=cross, staff=ring */
  shape?: CombatReticleShape;
  /** Soft bloom gap (px) from movement/recoil */
  spread?: number;
  /** Hit marker pulse key */
  hitMarker?: number;
  rangeState?: "close" | "optimal" | "far" | "none";
  focusLocked?: boolean;
  /** 0–1 phase for staff ring breathe */
  pulse?: number;
  aoeScale?: number;
  className?: string;
}

/** Map class / weapon keyword → reticle shape (DRC reticleProfiles intent). */
export function reticleShapeForClass(classId?: string, weaponHint?: string): CombatReticleShape {
  const w = `${classId ?? ""} ${weaponHint ?? ""}`.toLowerCase();
  if (/bow|ranger|longbow|archer/.test(w)) return "x";
  if (/gun|rifle|pistol|crossbow|shooter|engineer|gadget|pathfinder|john/.test(w)) return "cross";
  if (/staff|mage|magic|wand|tome|healer/.test(w)) return "ring";
  if (/chain|anchor|tank|scourge|warbrute|faithbearer/.test(w)) return "ring";
  return "dot";
}

export function CombatCrosshair({
  visible = true,
  shape = "cross",
  spread = 0,
  hitMarker = 0,
  rangeState = "none",
  focusLocked = false,
  pulse = 0,
  aoeScale = 1,
  className = "",
}: CombatCrosshairProps) {
  const [hitFlash, setHitFlash] = useState(false);

  useEffect(() => {
    if (!hitMarker) return;
    setHitFlash(true);
    const t = window.setTimeout(() => setHitFlash(false), 120);
    return () => window.clearTimeout(t);
  }, [hitMarker]);

  if (!visible) return null;

  const gap = Math.max(0, Math.min(28, spread));
  const pulseScale = shape === "ring" ? 1 + 0.12 * Math.sin(pulse * Math.PI * 2) : 1;
  const ringScale = Math.max(0.5, aoeScale) * pulseScale;

  const rangeColor =
    rangeState === "optimal"
      ? "#59e194"
      : rangeState === "far"
        ? "#ffc666"
        : rangeState === "close"
          ? "#ff6565"
          : "transparent";

  const base = {
    position: "absolute" as const,
    left: "50%",
    top: "50%",
    transform: "translate(-50%, -50%)",
    pointerEvents: "none" as const,
    zIndex: 25,
  };

  if (shape === "dot") {
    return (
      <div className={`combat-crosshair combat-crosshair-dot ${className}`} style={base} aria-hidden>
        <span
          style={{
            display: "block",
            width: focusLocked ? 8 : 6,
            height: focusLocked ? 8 : 6,
            borderRadius: "50%",
            background: hitFlash ? "#fff" : "#c5a059",
            boxShadow: hitFlash
              ? "0 0 10px #fff, 0 0 4px #c5a059"
              : "0 0 6px rgba(197,160,89,0.85)",
            border: "1px solid rgba(0,0,0,0.55)",
          }}
        />
        {rangeState !== "none" && (
          <span
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: 28,
              height: 28,
              margin: -14,
              borderRadius: "50%",
              border: `1.5px solid ${rangeColor}`,
              opacity: 0.75,
            }}
          />
        )}
      </div>
    );
  }

  if (shape === "x") {
    const arm = 9 + gap * 0.15;
    return (
      <div className={`combat-crosshair combat-crosshair-x ${className}`} style={base} aria-hidden>
        {[45, -45].map((deg) => (
          <span
            key={deg}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: arm * 2,
              height: 2,
              marginLeft: -arm,
              marginTop: -1,
              background: hitFlash ? "#fff" : "#e8c56a",
              transform: `rotate(${deg}deg)`,
              boxShadow: "0 0 4px rgba(0,0,0,0.8)",
            }}
          />
        ))}
      </div>
    );
  }

  if (shape === "ring") {
    const r = 14 * ringScale;
    return (
      <div className={`combat-crosshair combat-crosshair-ring ${className}`} style={base} aria-hidden>
        <span
          style={{
            display: "block",
            width: r * 2,
            height: r * 2,
            borderRadius: "50%",
            border: `2px solid ${hitFlash ? "#fff" : "#7ec8ff"}`,
            boxShadow: "0 0 8px rgba(126,200,255,0.55)",
            opacity: 0.9,
          }}
        />
        <span
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: 4,
            height: 4,
            margin: -2,
            borderRadius: "50%",
            background: "#c5a059",
          }}
        />
      </div>
    );
  }

  // classic cross (+ ticks)
  const outer = 11 + gap * 0.2;
  const inner = 3 + gap * 0.08;
  const tick = (dx1: number, dy1: number, dx2: number, dy2: number) => (
    <line
      x1={dx1}
      y1={dy1}
      x2={dx2}
      y2={dy2}
      stroke={hitFlash ? "#fff" : "#ff9a3c"}
      strokeWidth={2}
      strokeLinecap="round"
    />
  );
  return (
    <div className={`combat-crosshair combat-crosshair-cross ${className}`} style={base} aria-hidden>
      <svg width={40} height={40} viewBox="-20 -20 40 40" style={{ overflow: "visible", filter: "drop-shadow(0 0 3px #000)" }}>
        {tick(-outer, 0, -inner, 0)}
        {tick(inner, 0, outer, 0)}
        {tick(0, -outer, 0, -inner)}
        {tick(0, inner, 0, outer)}
        <circle cx={0} cy={0} r={1.6} fill="#ffd789" />
      </svg>
      {rangeState !== "none" && (
        <span
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: 32,
            height: 32,
            margin: -16,
            borderRadius: "50%",
            border: `1.5px solid ${rangeColor}`,
            opacity: 0.7,
          }}
        />
      )}
    </div>
  );
}
