/**
 * Helm / open-water UX strip — flexible prompts for board, sail, land.
 */
import { Anchor, Ship, Compass, MapPin } from "lucide-react";
import { GOLD, HUD_GLASS } from "@/data/combatHudModel";

export interface OpenWaterHudProps {
  playDomain: "land" | "open_water";
  boatHeading?: number;
  boatSpeed?: number;
  nearbyIslandName?: string | null;
  nearbyHarborStation?: string | null;
  canEmbark?: boolean;
  canLand?: boolean;
  onBoard?: () => void;
  onLand?: () => void;
}

export function OpenWaterHud({
  playDomain,
  boatHeading = 0,
  boatSpeed = 0,
  nearbyIslandName,
  nearbyHarborStation,
  canEmbark,
  canLand,
  onBoard,
  onLand,
}: OpenWaterHudProps) {
  const deg = (((boatHeading * 180) / Math.PI) % 360 + 360) % 360;
  const knots = Math.abs(boatSpeed) * 0.55;

  return (
    <div
      className="w-[min(96vw,280px)] overflow-hidden pointer-events-auto"
      style={HUD_GLASS as React.CSSProperties}
    >
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 border-b border-white/10">
        <Ship className="w-3 h-3" style={{ color: GOLD }} />
        <span className="text-[9px] font-serif uppercase tracking-widest" style={{ color: GOLD }}>
          {playDomain === "open_water" ? "Open Water" : "Harbor"}
        </span>
        <span className="ml-auto text-[8px] font-mono text-muted-foreground">
          {playDomain === "open_water" ? `${knots.toFixed(1)} kn` : "ashore"}
        </span>
      </div>

      <div className="p-2 space-y-1.5 text-[9px] font-mono text-muted-foreground">
        {playDomain === "open_water" ? (
          <>
            <p className="flex items-center gap-1.5 text-foreground/90">
              <Compass className="w-3 h-3 shrink-0" style={{ color: GOLD }} />
              Heading {deg.toFixed(0)}°
            </p>
            {nearbyIslandName && (
              <p className="flex items-center gap-1.5 text-sky-300/90">
                <MapPin className="w-3 h-3 shrink-0" />
                Near {nearbyIslandName}
              </p>
            )}
            <p className="text-[8px] text-muted-foreground/60">WASD helm · B land at buoy</p>
            {canLand && (
              <button
                type="button"
                className="w-full mt-1 px-2 py-1.5 rounded border border-primary/40 text-[9px] uppercase tracking-widest text-primary hover:bg-primary/10"
                onClick={onLand}
              >
                Landfall (B)
              </button>
            )}
          </>
        ) : (
          <>
            {nearbyHarborStation && (
              <p className="flex items-center gap-1.5 text-amber-200/90">
                <Anchor className="w-3 h-3 shrink-0" style={{ color: GOLD }} />
                {nearbyHarborStation}
              </p>
            )}
            {canEmbark && (
              <button
                type="button"
                className="w-full px-2 py-1.5 rounded border border-sky-500/40 text-[9px] uppercase tracking-widest text-sky-300 hover:bg-sky-500/10"
                onClick={onBoard}
              >
                Board skiff (B)
              </button>
            )}
            <p className="text-[8px] text-muted-foreground/60">
              Harbor shops inland of jetty · B at skiff for open sea
            </p>
          </>
        )}
      </div>
    </div>
  );
}
