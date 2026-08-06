import { useEffect, useRef, useState } from "react";
import { FighterPreview } from "@/components/FighterPreview";
import type { FighterDef } from "@/data/fighters";
import { SCOURGE_ID, JOHN_WAYNE_ID, RACALVIN_ID } from "@/data/fighters";
import { getEvolutionMeta } from "@/data/fighterEvolutions";

/** Browsers cap active WebGL contexts (~8–16). Queue roster previews instead of one per card. */
const MAX_LIVE_PREVIEWS = 6;

const CREW_PREVIEW_IDS = new Set([SCOURGE_ID, JOHN_WAYNE_ID, RACALVIN_ID]);
let livePreviews = 0;
const previewWaiters: Array<{ priority: number; grant: () => void }> = [];

function acquirePreviewSlot(priority: number): Promise<void> {
  if (livePreviews < MAX_LIVE_PREVIEWS) {
    livePreviews++;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const entry = {
      priority,
      grant: () => {
        livePreviews++;
        resolve();
      },
    };
    previewWaiters.push(entry);
    previewWaiters.sort((a, b) => b.priority - a.priority);
  });
}

function releasePreviewSlot() {
  livePreviews = Math.max(0, livePreviews - 1);
  const next = previewWaiters.shift();
  if (next) next.grant();
}

const ROLE_ACCENT: Record<string, string> = {
  "Corsair King": "#c5a059",
  "Chain Tank": "#88ccee",
  "Ranged Engineer": "#ffaa44",
  Emperor: "#e85d5d",
  Swordsman: "#7eb8ff",
  Swordmaster: "#9ad4ff",
  Assassin: "#a855f7",
  "Beast Assassin": "#c084fc",
  Tactician: "#38bdf8",
  Striker: "#fb923c",
  Brawler: "#f97316",
  Gunner: "#94a3b8",
  Warden: "#64748b",
  Guardian: "#4ade80",
  "Phoenix Guardian": "#22d3ee",
};

function StaticThumb({ fighter, waiting }: { fighter: FighterDef; waiting: boolean }) {
  const evo = getEvolutionMeta(fighter.id);
  const accent = ROLE_ACCENT[fighter.role] ?? "#c5a059";
  const initial = fighter.name.replace(/[^A-Za-z]/g, "").charAt(0) || "?";

  return (
    <div
      className="flex h-full w-full flex-col items-center justify-center gap-1 px-3 text-center"
      style={{
        background: `radial-gradient(ellipse at 50% 35%, ${accent}22 0%, transparent 55%), linear-gradient(180deg, #0a0808 0%, #060608 100%)`,
      }}
    >
      <div
        className="flex h-14 w-14 items-center justify-center rounded-full border font-serif text-2xl uppercase tracking-widest shadow-inner"
        style={{ borderColor: `${accent}55`, color: accent, background: `${accent}12` }}
      >
        {initial}
      </div>
      <p className="font-serif text-[11px] uppercase tracking-[0.15em] text-foreground/90 line-clamp-1">
        {fighter.name}
      </p>
      <p className="font-serif text-[10px] uppercase tracking-[0.2em] text-muted-foreground line-clamp-1">
        {fighter.role}
      </p>
      {evo && (
        <span
          className="text-[9px] font-mono uppercase tracking-widest px-2 py-0.5 rounded border"
          style={{ borderColor: `${accent}40`, color: accent }}
        >
          {evo.isFinalForm ? "Final" : `T${evo.tier}`}
        </span>
      )}
      {waiting && (
        <p className="text-[9px] font-mono text-muted-foreground/60 animate-pulse">Summoning model…</p>
      )}
    </div>
  );
}

/**
 * Roster card portrait — lazy 3D with a static placeholder until in-view and a
 * preview slot is available. Prevents blank/broken tops on /units.
 */
export function FighterRosterThumb({ fighter }: { fighter: FighterDef }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const [visibleRatio, setVisibleRatio] = useState(0);
  const [hasSlot, setHasSlot] = useState(false);
  const slotHeldRef = useRef(false);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        setInView(entry.isIntersecting);
        setVisibleRatio(entry.intersectionRatio);
      },
      { rootMargin: "80px", threshold: [0, 0.08, 0.25, 0.5, 0.75, 1] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!inView || visibleRatio < 0.08) {
      if (slotHeldRef.current) {
        releasePreviewSlot();
        slotHeldRef.current = false;
      }
      setHasSlot(false);
      return;
    }

    let cancelled = false;
    // Prefer Racalvin crew slots so /units always shows live idle/walk first
    const priority = visibleRatio + (CREW_PREVIEW_IDS.has(fighter.id) ? 1.5 : 0);
    acquirePreviewSlot(priority).then(() => {
      if (cancelled) {
        releasePreviewSlot();
        return;
      }
      slotHeldRef.current = true;
      setHasSlot(true);
    });

    return () => {
      cancelled = true;
      if (slotHeldRef.current) {
        releasePreviewSlot();
        slotHeldRef.current = false;
      }
      setHasSlot(false);
    };
  }, [inView, visibleRatio, fighter.id]);

  const isCrew = CREW_PREVIEW_IDS.has(fighter.id);

  return (
    <div ref={rootRef} className="absolute inset-0">
      {hasSlot ? (
        <FighterPreview
          skinId={fighter.skinId}
          fighterId={fighter.id}
          pauseRotation
          showcaseLocomotion={isCrew}
        />
      ) : (
        <StaticThumb fighter={fighter} waiting={inView && visibleRatio >= 0.08} />
      )}
    </div>
  );
}