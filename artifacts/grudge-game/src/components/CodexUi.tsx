/**
 * Codex UI primitives — sprite slots, status icons, frost panels.
 * Assets: public/ui/codex (build-yourself sprite_pieces + roguelite status).
 */
import type { CSSProperties, ReactNode } from "react";
import {
  CODEX_FROST,
  CODEX_SPRITE_SHEET,
  statusIconUrl,
  type StatusIconId,
} from "@/data/codexUiAssets";

const pixel: CSSProperties = { imageRendering: "pixelated" };

/** Pixel-art status icon (128→display size). */
export function StatusIcon({
  id,
  size = 28,
  title,
  className = "",
  dimmed = false,
}: {
  id: StatusIconId | string;
  size?: number;
  title?: string;
  className?: string;
  dimmed?: boolean;
}) {
  return (
    <img
      src={statusIconUrl(id)}
      alt={title ?? id}
      title={title ?? id}
      width={size}
      height={size}
      draggable={false}
      className={className}
      style={{
        ...pixel,
        width: size,
        height: size,
        opacity: dimmed ? 0.35 : 1,
        filter: dimmed ? "grayscale(0.6)" : undefined,
        flexShrink: 0,
      }}
    />
  );
}

/**
 * Equipment / inventory slot frame.
 * Uses sprite_pieces sheet as ornate border + optional status glyph.
 */
export function CodexSlot({
  size = 64,
  filled = false,
  accent = CODEX_FROST.accent,
  statusId,
  glyph,
  label,
  sublabel,
  onClick,
  selected = false,
  children,
}: {
  size?: number;
  filled?: boolean;
  accent?: string;
  statusId?: StatusIconId | string;
  glyph?: string;
  label?: string;
  sublabel?: string;
  onClick?: () => void;
  selected?: boolean;
  children?: ReactNode;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className="group relative flex flex-col items-center gap-1 text-left transition-transform hover:scale-[1.02] focus:outline-none"
      style={{ width: size + 8 }}
    >
      <div
        className="relative flex items-center justify-center overflow-hidden"
        style={{
          width: size,
          height: size,
          borderRadius: 6,
          border: `2px solid ${selected ? accent : filled ? `${accent}aa` : "rgba(100,150,180,0.35)"}`,
          boxShadow: selected
            ? `0 0 0 1px ${accent}, ${CODEX_FROST.glow}`
            : filled
              ? `inset 0 0 12px ${accent}33, ${CODEX_FROST.glow}`
              : "inset 0 0 10px rgba(0,0,0,0.45)",
          background: filled ? CODEX_FROST.slotFill : CODEX_FROST.slotEmpty,
          backgroundImage: `url(${CODEX_SPRITE_SHEET})`,
          backgroundSize: "220% 220%",
          backgroundPosition: filled ? "70% 35%" : "40% 55%",
          backgroundRepeat: "no-repeat",
          imageRendering: "pixelated",
        }}
      >
        {/* Dark scrim so icons read over sprite art */}
        <div
          className="absolute inset-0"
          style={{
            background: filled
              ? "radial-gradient(circle at 50% 45%, rgba(20,40,60,0.15), rgba(4,10,16,0.72))"
              : "radial-gradient(circle at 50% 45%, rgba(15,30,45,0.4), rgba(4,8,12,0.85))",
          }}
        />
        <div className="relative z-[1] flex items-center justify-center">
          {children ??
            (statusId ? (
              <StatusIcon id={statusId} size={Math.round(size * 0.55)} dimmed={!filled} title={label} />
            ) : glyph ? (
              <span className="text-lg leading-none" style={{ filter: filled ? "none" : "grayscale(1) opacity(0.5)" }}>
                {glyph}
              </span>
            ) : null)}
        </div>
        {filled && (
          <div
            className="absolute bottom-0 left-0 right-0 h-0.5"
            style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }}
          />
        )}
      </div>
      {label && (
        <div className="w-full text-center px-0.5">
          <p
            className="text-[9px] font-mono uppercase tracking-wider truncate"
            style={{ color: filled ? accent : CODEX_FROST.accentDim }}
          >
            {label}
          </p>
          {sublabel && (
            <p className="text-[8px] font-mono text-muted-foreground truncate">{sublabel}</p>
          )}
        </div>
      )}
    </Tag>
  );
}

/** Frost / cold-biome framed panel. */
export function CodexPanel({
  title,
  kicker,
  icon,
  actions,
  children,
  className = "",
}: {
  title?: string;
  kicker?: string;
  icon?: StatusIconId | string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-lg ${className}`}
      style={{
        background: CODEX_FROST.panelBg,
        border: `1px solid ${CODEX_FROST.panelBorder}`,
        boxShadow: CODEX_FROST.glow,
      }}
    >
      {/* Ice edge */}
      <div
        className="absolute inset-x-0 top-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${CODEX_FROST.ice}88, transparent)` }}
      />
      {(title || kicker) && (
        <div
          className="flex items-center gap-2 px-3 py-2.5 border-b"
          style={{ borderColor: "rgba(120,190,230,0.15)" }}
        >
          {icon && <StatusIcon id={icon} size={22} title={title} />}
          <div className="min-w-0 flex-1">
            {kicker && (
              <p className="text-[9px] font-mono uppercase tracking-[0.2em]" style={{ color: CODEX_FROST.accentDim }}>
                {kicker}
              </p>
            )}
            {title && (
              <h3 className="font-serif text-sm uppercase tracking-widest truncate" style={{ color: CODEX_FROST.ice }}>
                {title}
              </h3>
            )}
          </div>
          {actions}
        </div>
      )}
      <div className="p-3 sm:p-4">{children}</div>
    </div>
  );
}

/** Compact stat chip with optional status art. */
export function CodexStatChip({
  label,
  value,
  statusId,
  accent = CODEX_FROST.accent,
}: {
  label: string;
  value: string | number;
  statusId?: StatusIconId | string;
  accent?: string;
}) {
  return (
    <div
      className="flex items-center gap-2 rounded border px-2 py-1.5 min-w-0"
      style={{
        borderColor: `${accent}44`,
        background: "rgba(8,16,24,0.65)",
      }}
    >
      {statusId && <StatusIcon id={statusId} size={20} title={label} />}
      <div className="min-w-0">
        <p className="text-[8px] font-mono uppercase tracking-wider text-muted-foreground truncate">{label}</p>
        <p className="text-sm font-mono truncate" style={{ color: accent }}>
          {value}
        </p>
      </div>
    </div>
  );
}

/** Row of effect icons (stone affixes / ally buffs). */
export function StatusIconRow({
  ids,
  size = 20,
  max = 6,
}: {
  ids: Array<StatusIconId | string>;
  size?: number;
  max?: number;
}) {
  const show = ids.slice(0, max);
  if (!show.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1">
      {show.map((id, i) => (
        <StatusIcon key={`${id}-${i}`} id={id} size={size} title={String(id)} />
      ))}
      {ids.length > max && (
        <span className="text-[9px] font-mono text-muted-foreground">+{ids.length - max}</span>
      )}
    </div>
  );
}
