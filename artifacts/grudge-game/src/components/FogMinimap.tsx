import { useMemo } from "react";
import type { FogMinimapSnapshot } from "@/game/FogOfWar";

const GOLD = "#c5a059";

interface FogMinimapProps {
  snapshot: FogMinimapSnapshot | null;
  exploredPct: number;
}

export function FogMinimap({ snapshot, exploredPct }: FogMinimapProps) {
  const cells = useMemo(() => snapshot?.cells ?? [], [snapshot]);

  if (!snapshot) return null;

  const size = 108;
  const cellW = size / snapshot.gridW;
  const cellH = size / snapshot.gridH;

  const px = ((snapshot.playerNx + 1) / 2) * size;
  const pz = ((snapshot.playerNz + 1) / 2) * size;
  const cx = ((snapshot.coveNx + 1) / 2) * size;
  const cz = ((snapshot.coveNz + 1) / 2) * size;

  return (
    <div className="rounded border border-white/15 bg-black/70 backdrop-blur-sm p-2 shadow-lg">
      <p className="text-[8px] font-serif uppercase tracking-widest text-muted-foreground mb-1.5 text-center">
        Island Map · {exploredPct}% charted
      </p>
      <svg width={size} height={size} className="block mx-auto" style={{ imageRendering: "pixelated" }}>
        {cells.map((c, i) => {
          const gx = i % snapshot.gridW;
          const gz = Math.floor(i / snapshot.gridW);
          const fill =
            c.state === 1 ? "rgba(30,28,24,0.15)" : c.state === 0 ? "rgba(20,18,28,0.55)" : "rgba(4,3,8,0.95)";
          return (
            <rect
              key={i}
              x={gx * cellW}
              y={gz * cellH}
              width={cellW + 0.5}
              height={cellH + 0.5}
              fill={fill}
            />
          );
        })}
        <circle cx={cx} cy={cz} r={3} fill="none" stroke={GOLD} strokeWidth={1.2} opacity={0.85} />
        <circle cx={px} cy={pz} r={3.5} fill="#22c55e" stroke="#fff" strokeWidth={0.8} />
      </svg>
      <p className="text-[7px] font-mono text-muted-foreground/70 mt-1 text-center">
        <span style={{ color: GOLD }}>○</span> Cove · <span className="text-green-400">●</span> You
      </p>
    </div>
  );
}