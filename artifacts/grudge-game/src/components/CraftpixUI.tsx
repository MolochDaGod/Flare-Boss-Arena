import React from "react";

/**
 * CraftPix "Fantasy Game Interface" textures (extracted from the PSD packs into
 * `public/ui/craftpix/`). Served BASE_URL-aware so they resolve under the
 * artifact's base path. Only the cleanly-extracted, on-theme (dark/ember/gold)
 * elements are exposed here — see `.agents/memory/craftpix-ui-psd-packs.md`.
 */
const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
const asset = (f: string) => `${BASE}/ui/craftpix/${f}`;

export const CRAFTPIX = {
  panelParchment: asset("panel-parchment.png"),
  warningBanner: asset("warning-banner.png"),
  warningIcon: asset("warning-icon.png"),
  globe: asset("globe.png"),
  barFrame: asset("bar-frame.png"),
  scaleFrame: asset("scale-frame.png"),
  castFrame: asset("cast-frame.png"),
  separator: asset("separator.png"),
  barFill: asset("bar-fill.png"),
} as const;

const GOLD = "#c5a059";

/** Textured dark-stone panel (parchment fill + gold rim). Drop-in for cards/modals. */
export function ParchmentPanel({
  children,
  className,
  style,
}: {
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={className}
      style={{
        position: "relative",
        backgroundImage: `url(${CRAFTPIX.panelParchment})`,
        backgroundSize: "100% 100%",
        backgroundRepeat: "no-repeat",
        border: `2px solid ${GOLD}`,
        borderRadius: 8,
        boxShadow: "inset 0 0 18px rgba(0,0,0,0.65), 0 0 14px rgba(0,0,0,0.8), inset 1px 1px 0 rgba(255,255,255,0.12)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** Parchment warning/notification banner with the red "!" glyph + title/body. */
export function WarningBanner({
  title,
  children,
  className,
  style,
}: {
  title?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={className}
      style={{
        position: "relative",
        backgroundImage: `url(${CRAFTPIX.warningBanner})`,
        backgroundSize: "100% 100%",
        backgroundRepeat: "no-repeat",
        padding: "14px 22px 14px 70px",
        minHeight: 80,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        ...style,
      }}
    >
      <img
        src={CRAFTPIX.warningIcon}
        alt=""
        draggable={false}
        style={{ position: "absolute", left: 20, top: "50%", transform: "translateY(-50%)", height: 50, filter: "drop-shadow(0 0 4px rgba(0,0,0,0.6))" }}
      />
      {title && (
        <div
          className="font-serif"
          style={{ color: GOLD, fontSize: 15, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: children ? 4 : 0, lineHeight: 1.2 }}
        >
          {title}
        </div>
      )}
      {children && <div style={{ color: "#e9dcc6", fontSize: 12, lineHeight: 1.45 }}>{children}</div>}
    </div>
  );
}

type BarFrameKind = "bar" | "scale" | "cast";
const FRAME_SRC: Record<BarFrameKind, string> = {
  bar: CRAFTPIX.barFrame,
  scale: CRAFTPIX.scaleFrame,
  cast: CRAFTPIX.castFrame,
};

/**
 * Forged bar gauge: a CraftPix metallic frame with a colored fill seated in the
 * recessed channel. `pct` 0–100. Insets clear the arrow caps + channel lip.
 */
export function BarGauge({
  pct,
  color,
  frame = "bar",
  height = 16,
  glow = true,
  insetX = "5.5%",
  insetY = "32%",
  className,
  style,
  children,
}: {
  pct: number;
  color: string;
  frame?: BarFrameKind;
  height?: number;
  glow?: boolean;
  /** Horizontal inset so the fill clears the frame's arrow caps. Tune per frame. */
  insetX?: string;
  /** Vertical inset so the fill seats in the recessed channel. Tune per frame. */
  insetY?: string;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div
      className={className}
      style={{
        position: "relative",
        height,
        backgroundImage: `url(${FRAME_SRC[frame]})`,
        backgroundSize: "100% 100%",
        backgroundRepeat: "no-repeat",
        ...style,
      }}
    >
      <div style={{ position: "absolute", left: insetX, right: insetX, top: insetY, bottom: insetY, overflow: "hidden", borderRadius: 2 }}>
        <div
          style={{
            height: "100%",
            width: `${clamped}%`,
            background: color,
            boxShadow: glow ? `0 0 6px ${color}aa` : undefined,
            transition: "width 120ms linear",
          }}
        />
      </div>
      {children}
    </div>
  );
}

/**
 * Decorative health orb: a colored liquid that rises by `pct` behind the glossy
 * CraftPix globe (overlay blend keeps the metal rim + highlights reading).
 */
export function OrbGauge({
  pct,
  color,
  size = 64,
  inset = { left: "16%", right: "16%", top: "11%", bottom: "13%" },
  className,
}: {
  pct: number;
  color: string;
  size?: number;
  /** Liquid bounds inside the globe rim. Tune if the glass art changes. */
  inset?: { left: string; right: string; top: string; bottom: string };
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className={className} style={{ position: "relative", width: size, height: size }}>
      <div style={{ position: "absolute", left: inset.left, right: inset.right, top: inset.top, bottom: inset.bottom, borderRadius: "50%", overflow: "hidden", background: "#0a0a0a" }}>
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: `${clamped}%`, background: color, transition: "height 150ms linear" }} />
      </div>
      <img
        src={CRAFTPIX.globe}
        alt=""
        draggable={false}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", mixBlendMode: "overlay", pointerEvents: "none" }}
      />
      <img
        src={CRAFTPIX.globe}
        alt=""
        draggable={false}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.45, pointerEvents: "none" }}
      />
    </div>
  );
}

/** Ornate horizontal divider. */
export function Separator({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <img
      src={CRAFTPIX.separator}
      alt=""
      draggable={false}
      className={className}
      style={{ display: "block", width: "100%", height: "auto", ...style }}
    />
  );
}
