/**
 * In-game world map — zones, claims, player, fog exploration, click-to-mark.
 */
import { useMemo, useState } from "react";
import { GOLD, HUD_GLASS } from "@/data/combatHudModel";
import { Map as MapIcon, Flag, Anchor, Crosshair } from "lucide-react";

export interface WorldMapZoneRow {
  id: string;
  name: string;
  kind: string;
  x: number;
  z: number;
  radius: number;
  color: number;
  claimable: boolean;
  owner: string;
  chunkX: number;
  chunkZ: number;
  /** D2-style monster area level */
  areaLevel?: number;
  density?: number;
}

interface WorldMapPanelProps {
  zones: WorldMapZoneRow[];
  playerX: number;
  playerZ: number;
  halfExtent?: number;
  currentZone?: string | null;
  nearbyClaim?: string | null;
  claimsOwned?: number;
  exploredPct?: number;
  /** Optional: navigate / set waypoint when clicking the chart. */
  onWaypoint?: (x: number, z: number) => void;
  /** Expanded full-panel mode (M key / map toggle). */
  expanded?: boolean;
  onToggleExpand?: () => void;
}

export function WorldMapPanel({
  zones,
  playerX,
  playerZ,
  halfExtent = 90,
  currentZone,
  nearbyClaim,
  claimsOwned = 0,
  exploredPct = 0,
  onWaypoint,
  expanded = false,
  onToggleExpand,
}: WorldMapPanelProps) {
  const size = expanded ? 280 : 148;
  const toN = (v: number) => ((v / halfExtent + 1) / 2) * size;
  const fromN = (n: number) => (n / size) * 2 * halfExtent - halfExtent;
  const px = toN(playerX);
  const pz = toN(playerZ);
  const [mark, setMark] = useState<{ x: number; z: number } | null>(null);

  const legend = useMemo(() => {
    const kinds = new Map<string, number>();
    for (const z of zones) kinds.set(z.kind, (kinds.get(z.kind) ?? 0) + 1);
    return [...kinds.entries()].slice(0, 5);
  }, [zones]);

  const onSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = e.clientX - rect.left;
    const nz = e.clientY - rect.top;
    const wx = fromN(nx);
    const wz = fromN(nz);
    setMark({ x: wx, z: wz });
    onWaypoint?.(wx, wz);
  };

  return (
    <div
      className={expanded ? "w-[min(96vw,320px)] overflow-hidden" : "w-[200px] overflow-hidden"}
      style={HUD_GLASS as React.CSSProperties}
    >
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 border-b border-white/10">
        <MapIcon className="w-3 h-3" style={{ color: GOLD }} />
        <span className="text-[9px] font-serif uppercase tracking-widest" style={{ color: GOLD }}>
          Island Map
        </span>
        <span className="ml-auto text-[8px] font-mono text-muted-foreground">
          {exploredPct}% · {claimsOwned} claims
        </span>
        {onToggleExpand && (
          <button
            type="button"
            className="text-[8px] font-mono uppercase tracking-wider text-[#c5a059]/80 hover:text-[#c5a059]"
            onClick={onToggleExpand}
          >
            {expanded ? "−" : "+"}
          </button>
        )}
      </div>

      <div className="p-2">
        <svg
          width={size}
          height={size}
          className="block mx-auto rounded cursor-crosshair"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={onSvgClick}
        >
          {/* Outer border */}
          <rect
            x={1}
            y={1}
            width={size - 2}
            height={size - 2}
            fill="none"
            stroke="rgba(197,160,89,0.25)"
            strokeWidth={1}
          />
          {/* Chunk grid 3×3 */}
          {[1, 2].map((i) => (
            <g key={i}>
              <line
                x1={(i * size) / 3}
                y1={0}
                x2={(i * size) / 3}
                y2={size}
                stroke="rgba(197,160,89,0.12)"
                strokeWidth={1}
              />
              <line
                x1={0}
                y1={(i * size) / 3}
                x2={size}
                y2={(i * size) / 3}
                stroke="rgba(197,160,89,0.12)"
                strokeWidth={1}
              />
            </g>
          ))}
          {/* Compass */}
          <text x={size - 14} y={12} fill="rgba(197,160,89,0.5)" fontSize={8} fontFamily="monospace">
            N
          </text>

          {zones.map((z) => {
            const cx = toN(z.x);
            const cz = toN(z.z);
            const r = Math.max(3, (z.radius / halfExtent) * (size / 2));
            const hex = `#${z.color.toString(16).padStart(6, "0")}`;
            const owned = z.owner === "player";
            return (
              <g key={z.id}>
                <circle
                  cx={cx}
                  cy={cz}
                  r={r}
                  fill={hex}
                  fillOpacity={owned ? 0.4 : 0.14}
                  stroke={hex}
                  strokeWidth={owned ? 1.5 : 0.8}
                  strokeOpacity={0.75}
                />
                {z.claimable && (
                  <circle cx={cx} cy={cz} r={2.2} fill={owned ? "#53ddb0" : "#66aaff"} />
                )}
                {expanded && (
                  <text
                    x={cx}
                    y={cz - r - 2}
                    textAnchor="middle"
                    fill="rgba(232,222,194,0.65)"
                    fontSize={6}
                    fontFamily="Cinzel, serif"
                  >
                    {z.name.length > 10 ? z.name.slice(0, 9) + "…" : z.name}
                    {z.areaLevel != null ? ` L${z.areaLevel}` : ""}
                  </text>
                )}
              </g>
            );
          })}

          {/* Cove */}
          <circle cx={toN(70)} cy={toN(-14)} r={4} fill="none" stroke={GOLD} strokeWidth={1.2} />
          {/* Dark elf ritual (NW) */}
          <circle cx={toN(-42)} cy={toN(-32)} r={5} fill="none" stroke="#aa44ff" strokeWidth={1} strokeOpacity={0.6} />

          {/* Waypoint mark */}
          {mark && (
            <g>
              <circle cx={toN(mark.x)} cy={toN(mark.z)} r={4} fill="none" stroke="#f59e0b" strokeWidth={1.2} />
              <line
                x1={toN(mark.x) - 5}
                y1={toN(mark.z)}
                x2={toN(mark.x) + 5}
                y2={toN(mark.z)}
                stroke="#f59e0b"
                strokeWidth={0.8}
              />
              <line
                x1={toN(mark.x)}
                y1={toN(mark.z) - 5}
                x2={toN(mark.x)}
                y2={toN(mark.z) + 5}
                stroke="#f59e0b"
                strokeWidth={0.8}
              />
            </g>
          )}

          {/* Player */}
          <circle cx={px} cy={pz} r={3.5} fill="#22c55e" stroke="#fff" strokeWidth={0.8} />
          {/* Facing tick (north-up map uses position only) */}
        </svg>

        <div className="mt-1.5 space-y-0.5 text-[8px] font-mono text-muted-foreground">
          {currentZone && (
            <p className="flex items-center gap-1 truncate">
              <Anchor className="w-2.5 h-2.5 shrink-0" style={{ color: GOLD }} />
              <span className="text-foreground/90">{currentZone}</span>
            </p>
          )}
          {nearbyClaim && (
            <p className="flex items-center gap-1 truncate text-sky-300/90">
              <Flag className="w-2.5 h-2.5 shrink-0" />
              Near: {nearbyClaim}
            </p>
          )}
          {mark && (
            <p className="flex items-center gap-1 truncate text-amber-300/90">
              <Crosshair className="w-2.5 h-2.5 shrink-0" />
              Mark {mark.x.toFixed(0)}, {mark.z.toFixed(0)}
            </p>
          )}
          {expanded && legend.length > 0 && (
            <p className="text-[7px] text-muted-foreground/70 pt-0.5">
              {legend.map(([k, n]) => `${k}×${n}`).join(" · ")}
            </p>
          )}
          <p className="text-[7px] text-muted-foreground/50">
            C camp ghost · LMB place · V man tower · 1–5 skill/deploy ghost
          </p>
        </div>
      </div>
    </div>
  );
}
