import { useEffect, useRef, useState, useCallback, Component, type ReactNode, type ErrorInfo } from "react";
import { useLocation } from "wouter";
import { useListCharacters } from "@workspace/api-client-react";
import { GameEngine, type GameState } from "@/game/GameEngine";
import { Loader2, ArrowLeft, Swords, Zap, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

class GameErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; message: string }> {
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
          <p className="font-serif text-primary uppercase tracking-widest text-lg">Dungeon Unavailable</p>
          <p className="text-sm text-muted-foreground max-w-xs text-center font-mono">{this.state.message || "WebGL is required to enter the dungeon."}</p>
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

const TIER_COLORS: Record<number, string> = {
  1: "#9ca3af",
  2: "#22c55e",
  3: "#3b82f6",
  4: "#a855f7",
  5: "#f59e0b",
};

function Game() {
  const [, setLocation] = useLocation();
  const mountRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [showControls, setShowControls] = useState(true);

  const { data: characters } = useListCharacters();
  const char = characters?.[0];

  const handleStateUpdate = useCallback((state: GameState) => {
    setGameState(state);
  }, []);

  useEffect(() => {
    if (!mountRef.current || !char) return;

    const attrs = (char.attributes as Record<string, number>) ?? {};
    const stats = char.stats as Record<string, number> ?? {};
    const hp = Math.round((stats.hp as number) ?? (250 + (attrs.Vitality ?? 0) * 25));
    const mana = Math.round((stats.mana as number) ?? (100 + (attrs.Intellect ?? 0) * 9));
    const level = char.level ?? 1;
    const str = attrs.Strength ?? 5;
    const dex = attrs.Dexterity ?? 2;
    const baseDamage = 20 + str * 3 + dex * 1.5 + level * 4;

    const engine = new GameEngine();
    engine.onStateUpdate = handleStateUpdate;
    engine.init(mountRef.current, char.class?.toLowerCase() ?? "warrior", char.name, {
      hp, mana, level, baseDamage: Math.round(baseDamage),
    });
    engineRef.current = engine;

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, [char, handleStateUpdate]);

  // Hide controls hint after 5s
  useEffect(() => {
    const t = setTimeout(() => setShowControls(false), 5000);
    return () => clearTimeout(t);
  }, []);

  if (!char) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-6 bg-background">
        <p className="font-serif text-muted-foreground tracking-widest text-lg">No Warlord Found</p>
        <button
          onClick={() => setLocation("/character/new")}
          className="font-serif text-sm tracking-widest uppercase text-primary border border-primary/40 px-6 py-2 rounded hover:bg-primary/10 transition-colors"
        >
          Forge a Warlord
        </button>
      </div>
    );
  }

  const hpPct = gameState ? (gameState.playerHp / gameState.playerMaxHp) * 100 : 100;
  const manaPct = gameState ? (gameState.playerMana / gameState.playerMaxMana) * 100 : 100;
  const atkPct = gameState ? (1 - gameState.playerAttackCooldown) * 100 : 100;
  const hpColor = hpPct > 50 ? "#22c55e" : hpPct > 25 ? "#f59e0b" : "#ef4444";

  return (
    <div className="fixed inset-0 bg-black flex flex-col" style={{ zIndex: 50 }}>
      {/* 3D game canvas */}
      <div ref={mountRef} className="absolute inset-0" style={{ cursor: "crosshair" }} />

      {/* Loading overlay */}
      {(!gameState || !gameState.loaded) && (
        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-4 z-20">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="font-serif text-primary uppercase tracking-widest text-sm animate-pulse">Entering the Dungeon...</p>
        </div>
      )}

      {/* Top bar — zone + back button */}
      <div className="absolute top-0 left-0 right-0 flex items-start justify-between px-4 pt-3 z-10 pointer-events-none">
        <button
          className="pointer-events-auto flex items-center gap-2 px-3 py-1.5 bg-black/60 border border-white/10 rounded text-xs font-serif tracking-widest uppercase text-muted-foreground hover:text-white hover:border-white/30 transition-colors backdrop-blur-sm"
          onClick={() => setLocation("/")}
        >
          <ArrowLeft className="w-3 h-3" />
          War Panel
        </button>

        <div className="text-center pointer-events-none">
          <p className="text-[10px] font-serif uppercase tracking-[0.2em] text-muted-foreground/70">{gameState?.zone ?? "..."}</p>
        </div>

        <div className="w-24" />
      </div>

      {/* Player HUD — bottom left */}
      {gameState && (
        <div className="absolute bottom-4 left-4 z-10 w-64 space-y-2">
          {/* Character name */}
          <div className="flex items-center justify-between mb-1">
            <span className="font-serif text-sm tracking-widest text-primary uppercase">{char.name}</span>
            <span className="font-serif text-xs text-muted-foreground tracking-widest">Lv {gameState.playerLevel}</span>
          </div>

          {/* HP bar */}
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-mono uppercase text-muted-foreground tracking-widest">HP</span>
              <span className="text-[10px] font-mono" style={{ color: hpColor }}>{Math.round(gameState.playerHp)} / {gameState.playerMaxHp}</span>
            </div>
            <div className="h-3 bg-black/60 border border-white/10 rounded-sm overflow-hidden">
              <div
                className="h-full transition-all duration-100 rounded-sm"
                style={{ width: `${hpPct}%`, background: hpColor, boxShadow: `0 0 6px ${hpColor}88` }}
              />
            </div>
          </div>

          {/* Mana bar */}
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-mono uppercase text-muted-foreground tracking-widest">MP</span>
              <span className="text-[10px] font-mono text-blue-400">{Math.round(gameState.playerMana)} / {gameState.playerMaxMana}</span>
            </div>
            <div className="h-2 bg-black/60 border border-white/10 rounded-sm overflow-hidden">
              <div
                className="h-full transition-all duration-100 rounded-sm"
                style={{ width: `${manaPct}%`, background: "#3b82f6", boxShadow: "0 0 6px #3b82f688" }}
              />
            </div>
          </div>

          {/* Attack cooldown */}
          <div className="h-1.5 bg-black/60 border border-white/10 rounded-sm overflow-hidden">
            <div
              className="h-full rounded-sm transition-all duration-75"
              style={{ width: `${atkPct}%`, background: "#ffaa00", boxShadow: "0 0 4px #ffaa0066" }}
            />
          </div>
        </div>
      )}

      {/* Combat log — bottom right */}
      {gameState && gameState.combatLog.length > 0 && (
        <div className="absolute bottom-4 right-4 z-10 w-72 space-y-1 pointer-events-none">
          <AnimatePresence initial={false}>
            {gameState.combatLog.slice(0, 6).map((msg, i) => (
              <motion.div
                key={msg + i}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1 - i * 0.12, x: 0 }}
                exit={{ opacity: 0 }}
                className="text-right text-[11px] font-serif tracking-wide"
                style={{ color: msg.includes("hit you") || msg.includes("hits you") ? "#ef4444" : msg.includes("defeated") || msg.includes("XP") ? "#f59e0b" : msg.includes("CRIT") ? "#ff6600" : "#d1d5db" }}
              >
                {msg}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Enemy health bars — floating in world space */}
      {gameState && gameState.enemies.map((en) => {
        if (en.screenX < 0 || en.screenX > window.innerWidth) return null;
        const pct = (en.hp / en.maxHp) * 100;
        const col = en.hp / en.maxHp > 0.5 ? "#22c55e" : en.hp / en.maxHp > 0.25 ? "#f59e0b" : "#ef4444";
        const tierColor = TIER_COLORS[en.tier] ?? "#9ca3af";
        return (
          <div
            key={en.id}
            className="absolute pointer-events-none z-10"
            style={{ left: en.screenX - 40, top: en.screenY - 32, width: 80 }}
          >
            <p className="text-center text-[9px] font-serif tracking-widest uppercase mb-0.5" style={{ color: tierColor }}>{en.name}</p>
            <div className="h-1.5 bg-black/70 border border-white/10 rounded-sm overflow-hidden">
              <div className="h-full rounded-sm transition-all duration-150" style={{ width: `${pct}%`, background: col }} />
            </div>
          </div>
        );
      })}

      {/* Floating damage numbers */}
      {gameState && gameState.damageNumbers.map((d) => (
        <div
          key={d.id}
          className="absolute pointer-events-none font-mono font-bold z-20"
          style={{
            left: d.x,
            top: d.y,
            fontSize: d.isCrit ? 18 : d.isPlayer ? 14 : 13,
            color: d.isPlayer ? "#ef4444" : d.isCrit ? "#ff6600" : "#ffffff",
            textShadow: "0 1px 4px rgba(0,0,0,0.9)",
            opacity: Math.max(0, 1 - d.age / 1.4),
            transform: `translate(-50%, -${d.age * 30}px)`,
            transition: "none",
          }}
        >
          {d.isCrit ? `${d.value}!` : `-${d.value}`}
        </div>
      ))}

      {/* Action buttons */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex gap-3">
        <button
          className="flex flex-col items-center gap-1 px-4 py-2 bg-black/70 border border-primary/40 rounded font-serif text-xs tracking-widest uppercase text-primary hover:bg-primary/10 hover:border-primary/70 transition-all backdrop-blur-sm active:scale-95"
          onClick={() => engineRef.current?.attackNearest()}
        >
          <Swords className="w-4 h-4" />
          <span>Attack [F]</span>
        </button>
        <button
          className="flex flex-col items-center gap-1 px-4 py-2 bg-black/70 border border-blue-500/40 rounded font-serif text-xs tracking-widest uppercase text-blue-400 hover:bg-blue-500/10 hover:border-blue-500/70 transition-all backdrop-blur-sm active:scale-95"
          onClick={() => setLocation("/boss")}
        >
          <Zap className="w-4 h-4" />
          <span>Boss Arena</span>
        </button>
      </div>

      {/* Controls hint */}
      <AnimatePresence>
        {showControls && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute top-12 left-1/2 -translate-x-1/2 z-10 pointer-events-none"
          >
            <div className="bg-black/70 border border-white/10 rounded px-4 py-2 text-center backdrop-blur-sm">
              <p className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase">WASD / Arrow Keys — Move</p>
              <p className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase">Click Enemy — Target &amp; Attack</p>
              <p className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase">F / Space — Attack Nearest</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function GameWithBoundary() {
  return (
    <GameErrorBoundary>
      <Game />
    </GameErrorBoundary>
  );
}
