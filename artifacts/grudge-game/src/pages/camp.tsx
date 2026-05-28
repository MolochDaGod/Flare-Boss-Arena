import { Component, useCallback, useEffect, useMemo, useRef, useState, type ErrorInfo, type ReactNode } from "react";
import { useLocation } from "wouter";
import { useListCharacters } from "@workspace/api-client-react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, ArrowLeft, Flame, LayoutGrid, Loader2, Skull, Swords } from "lucide-react";
import { CampScene, type CampStateUpdate, type CampStationId } from "@/game/CampScene";
import { MainPanel, useMainPanelHotkeys, MAIN_PANEL_KEYS, type CharSummary, type PanelKey } from "@/components/MainPanel";

class CampErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; message: string }> {
  state = { hasError: false, message: "" };
  static getDerivedStateFromError(err: Error) {
    return { hasError: true, message: err.message };
  }
  componentDidCatch(_err: Error, _info: ErrorInfo) {}
  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 bg-black flex flex-col items-center justify-center gap-6 z-50">
          <AlertTriangle className="w-12 h-12 text-yellow-500" />
          <p className="font-serif text-primary uppercase tracking-widest text-lg">Camp Unavailable</p>
          <p className="text-sm text-muted-foreground max-w-xs text-center font-mono">{this.state.message || "WebGL is required to enter the camp."}</p>
          <button
            className="font-serif text-xs tracking-widest uppercase text-primary border border-primary/40 px-6 py-2 rounded hover:bg-primary/10 transition-colors"
            onClick={() => window.history.back()}
          >
            Return
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const STATION_TO_PANEL: Partial<Record<CampStationId, PanelKey>> = {
  anvil: "craft",
  skills: "skillTree",
  stats: "attribute",
  quests: "quest",
  stash: "equipment",
};

function Camp() {
  const [, setLocation] = useLocation();
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<CampScene | null>(null);

  const [state, setState] = useState<CampStateUpdate | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelTab, setPanelTab] = useState<PanelKey>("equipment");
  const [showHint, setShowHint] = useState(true);

  useMainPanelHotkeys(
    () => setPanelOpen((v) => !v),
    () => setPanelOpen(false),
    panelOpen,
    (idx) => {
      const k = MAIN_PANEL_KEYS[idx];
      if (k) setPanelTab(k);
    },
  );

  const { data: characters } = useListCharacters();
  const char = characters?.[0];

  const handleState = useCallback((s: CampStateUpdate) => setState(s), []);

  const handleEngage = useCallback(
    (id: CampStationId) => {
      if (id === "portal_dungeon") {
        setLocation("/game");
        return;
      }
      if (id === "portal_boss") {
        setLocation("/boss");
        return;
      }
      const panel = STATION_TO_PANEL[id];
      if (panel) {
        setPanelTab(panel);
        setPanelOpen(true);
      }
    },
    [setLocation],
  );

  useEffect(() => {
    if (!mountRef.current || !char) return;
    const scene = new CampScene({
      className: char.class as string,
      raceKey: char.race as string,
      onStateUpdate: handleState,
      onStationEngage: handleEngage,
    });
    scene.init(mountRef.current);
    sceneRef.current = scene;
    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
  }, [char, handleState, handleEngage]);

  useEffect(() => {
    const t = setTimeout(() => setShowHint(false), 6500);
    return () => clearTimeout(t);
  }, []);

  const charSummary = useMemo<CharSummary | null>(() => {
    if (!char) return null;
    return {
      name: char.name as string,
      race: char.race as string,
      class: char.class as string,
      level: (char.level as number) ?? 1,
      faction: (char as { faction?: string }).faction,
      attributes: (char.attributes as Record<string, number>) ?? {},
      equipment: (char.equipment as Record<string, string | undefined>) ?? {},
    };
  }, [char]);

  if (!char) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-6 bg-background min-h-[100dvh]">
        <p className="font-serif text-muted-foreground tracking-widest text-lg uppercase">No Warlord Found</p>
        <button
          onClick={() => setLocation("/character/new")}
          className="font-serif text-sm tracking-widest uppercase text-primary border border-primary/40 px-6 py-2 rounded hover:bg-primary/10 transition-colors"
        >
          Forge a Warlord
        </button>
      </div>
    );
  }

  const loaded = state?.loaded ?? false;
  const nearby = state?.nearbyStationLabel ?? null;

  return (
    <div className="fixed inset-0 bg-black flex flex-col" style={{ zIndex: 50 }}>
      <div ref={mountRef} className="absolute inset-0" style={{ cursor: "crosshair" }} />

      {/* Loading overlay */}
      {!loaded && (
        <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center gap-4 z-20">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="font-serif text-primary uppercase tracking-widest text-sm animate-pulse">Kindling the Camp...</p>
        </div>
      )}

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 flex items-start justify-between px-4 pt-3 z-10 pointer-events-none">
        <button
          className="pointer-events-auto flex items-center gap-2 px-3 py-1.5 bg-black/60 border border-white/10 rounded text-xs font-serif tracking-widest uppercase text-muted-foreground hover:text-white hover:border-white/30 transition-colors backdrop-blur-sm"
          onClick={() => setLocation("/")}
        >
          <ArrowLeft className="w-3 h-3" />
          War Panel
        </button>

        <div className="flex items-center gap-2 px-3 py-1.5 bg-black/55 border border-primary/30 rounded backdrop-blur-sm">
          <Flame className="w-3.5 h-3.5 text-primary" />
          <p className="text-[10px] font-serif uppercase tracking-[0.25em] text-primary">Sanctuary Camp</p>
        </div>

        <div className="pointer-events-auto bg-black/60 border border-white/10 backdrop-blur-sm rounded px-3 py-1.5 text-right">
          <p className="text-[10px] font-serif uppercase tracking-widest text-primary">{char.name as string}</p>
          <p className="text-[9px] font-mono text-muted-foreground">
            Lv {(char.level as number) ?? 1} · {char.race as string} {char.class as string}
          </p>
        </div>
      </div>

      {/* Engage prompt — appears when near a station */}
      <AnimatePresence>
        {loaded && nearby && (
          <motion.div
            key={state?.nearbyStationId}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute left-1/2 -translate-x-1/2 z-10 pointer-events-none"
            style={{ bottom: "26%" }}
          >
            <div className="bg-black/80 border border-primary/50 rounded px-5 py-3 text-center backdrop-blur-sm shadow-[0_0_24px_-8px_rgba(255,170,0,0.6)]">
              <p className="text-[10px] font-serif uppercase tracking-[0.25em] text-muted-foreground">Approach</p>
              <p className="font-serif text-primary uppercase tracking-widest text-base mt-0.5">{nearby}</p>
              {state?.nearbyStationHint && (
                <p className="text-[10px] font-mono text-muted-foreground/80 mt-1.5">{state.nearbyStationHint}</p>
              )}
              <div className="mt-2 inline-flex items-center gap-2">
                <kbd className="font-mono text-[10px] tracking-widest px-2 py-0.5 rounded border border-primary/60 bg-primary/10 text-primary">
                  {state?.promptKey ?? "E"}
                </kbd>
                <span className="text-[10px] font-serif tracking-widest uppercase text-muted-foreground">Engage</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom actions */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex gap-3">
        <button
          className="flex flex-col items-center gap-1 px-4 py-2 bg-black/70 border border-primary/40 rounded font-serif text-xs tracking-widest uppercase text-primary hover:bg-primary/10 hover:border-primary/70 transition-all backdrop-blur-sm active:scale-95"
          onClick={() => setPanelOpen(true)}
        >
          <LayoutGrid className="w-4 h-4" />
          <span>Panel [C]</span>
        </button>
        <button
          className="flex flex-col items-center gap-1 px-4 py-2 bg-black/70 border border-red-500/40 rounded font-serif text-xs tracking-widest uppercase text-red-300 hover:bg-red-500/10 hover:border-red-500/70 transition-all backdrop-blur-sm active:scale-95"
          onClick={() => setLocation("/game")}
        >
          <Swords className="w-4 h-4" />
          <span>Enter Dungeon</span>
        </button>
        <button
          className="flex flex-col items-center gap-1 px-4 py-2 bg-black/70 border border-fuchsia-500/40 rounded font-serif text-xs tracking-widest uppercase text-fuchsia-300 hover:bg-fuchsia-500/10 hover:border-fuchsia-500/70 transition-all backdrop-blur-sm active:scale-95"
          onClick={() => setLocation("/boss")}
        >
          <Skull className="w-4 h-4" />
          <span>Boss Arena</span>
        </button>
      </div>

      {/* MainPanel overlay */}
      {charSummary && (
        <MainPanel
          open={panelOpen}
          onClose={() => setPanelOpen(false)}
          activeTab={panelTab}
          onActiveTabChange={setPanelTab}
          character={charSummary}
        />
      )}

      {/* Hint */}
      <AnimatePresence>
        {showHint && loaded && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute top-14 left-1/2 -translate-x-1/2 z-10 pointer-events-none"
          >
            <div className="bg-black/75 border border-white/10 rounded px-5 py-3 text-center backdrop-blur-sm space-y-1">
              <p className="text-[10px] font-serif text-primary uppercase tracking-widest mb-1">Camp Controls</p>
              <p className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase">WASD / Arrows — Walk</p>
              <p className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase">Click Ground — Move To</p>
              <p className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase">E — Engage Station</p>
              <p className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase">C — Open Panel</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function CampWithBoundary() {
  return (
    <CampErrorBoundary>
      <Camp />
    </CampErrorBoundary>
  );
}
