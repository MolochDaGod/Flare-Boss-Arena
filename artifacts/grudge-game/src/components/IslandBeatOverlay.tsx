import { motion, AnimatePresence } from "framer-motion";
import { Anchor, Skull, Sparkles, Swords, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { GameBeat } from "@/game/GameEngine";

const GOLD = "#c5a059";

interface IslandBeatOverlayProps {
  beat: GameBeat | null;
  playerDead: boolean;
  canSail: boolean;
  coveBearing: number | null;
  onRespawn: () => void;
  onSail: () => void;
  onDismiss: () => void;
}

export function IslandBeatOverlay({
  beat,
  playerDead,
  canSail,
  coveBearing,
  onRespawn,
  onSail,
  onDismiss,
}: IslandBeatOverlayProps) {
  const show = Boolean(beat) || playerDead;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-30 flex items-center justify-center bg-black/55 backdrop-blur-[2px] pointer-events-auto"
        >
          <motion.div
            initial={{ scale: 0.92, y: 16 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0 }}
            className="mx-4 max-w-md w-full rounded-lg border-2 px-6 py-6 text-center"
            style={{
              borderColor: playerDead ? "#ef444488" : `${GOLD}99`,
              background: "linear-gradient(180deg, rgba(12,10,8,0.95), rgba(4,4,6,0.98))",
              boxShadow: `0 0 40px -8px ${playerDead ? "#ef4444" : GOLD}66`,
            }}
          >
            {playerDead ? (
              <>
                <Skull className="mx-auto h-10 w-10 text-red-400 mb-3" />
                <h2 className="font-serif text-2xl uppercase tracking-widest text-red-300">Defeated</h2>
                <p className="mt-2 text-sm text-muted-foreground font-serif">
                  The island claims another soul. Respawn at Pirate Cove with half health.
                </p>
                <Button className="mt-5 font-serif tracking-widest" onClick={onRespawn}>
                  Respawn at Cove
                </Button>
              </>
            ) : beat?.kind === "mission_complete" ? (
              <>
                <Swords className="mx-auto h-9 w-9 mb-3" style={{ color: GOLD }} />
                <h2 className="font-serif text-xl uppercase tracking-widest" style={{ color: GOLD }}>{beat.title}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{beat.subtitle}</p>
                <Button variant="outline" className="mt-5 font-serif tracking-widest" onClick={onDismiss}>
                  Hold the Line
                </Button>
              </>
            ) : beat?.kind === "boss_alert" ? (
              <>
                <Skull className="mx-auto h-10 w-10 text-fuchsia-400 mb-3 animate-pulse" />
                <h2 className="font-serif text-xl uppercase tracking-widest text-fuchsia-300">{beat.title}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{beat.subtitle}</p>
                <Button variant="outline" className="mt-5 font-serif tracking-widest border-fuchsia-500/50" onClick={onDismiss}>
                  Stand Ready
                </Button>
              </>
            ) : beat?.kind === "boss_defeated" || (canSail && beat?.kind === "victory") ? (
              <>
                <Trophy className="mx-auto h-10 w-10 mb-3" style={{ color: GOLD }} />
                <h2 className="font-serif text-xl uppercase tracking-widest" style={{ color: GOLD }}>
                  {beat?.title ?? "Island Secured"}
                </h2>
                <p className="mt-2 text-sm text-muted-foreground font-serif">{beat?.subtitle}</p>
                {coveBearing != null && (
                  <p className="mt-3 text-[10px] font-mono text-muted-foreground">
                    Cove bearing: {Math.round(coveBearing)}° — follow the compass, press E at Barbarossa
                  </p>
                )}
                <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
                  <Button className="font-serif tracking-widest" onClick={onSail}>
                    <Anchor className="mr-2 h-4 w-4" />
                    Sail to Next Island
                  </Button>
                  <Button variant="outline" className="font-serif tracking-widest" onClick={onDismiss}>
                    Loot the Cove
                  </Button>
                </div>
              </>
            ) : beat?.kind === "island_event" ? (
              <>
                <Sparkles className="mx-auto h-9 w-9 mb-3 text-amber-300" />
                <h2 className="font-serif text-xl uppercase tracking-widest text-amber-200">{beat.title}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{beat.subtitle}</p>
                <Button variant="outline" className="mt-5 font-serif tracking-widest border-amber-500/40" onClick={onDismiss}>
                  Press On
                </Button>
              </>
            ) : beat?.kind === "sail" ? (
              <>
                <Anchor className="mx-auto h-10 w-10 mb-3" style={{ color: GOLD }} />
                <h2 className="font-serif text-xl uppercase tracking-widest" style={{ color: GOLD }}>{beat.title}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{beat.subtitle}</p>
              </>
            ) : beat ? (
              <>
                <Swords className="mx-auto h-8 w-8 mb-3" style={{ color: GOLD }} />
                <h2 className="font-serif text-lg uppercase tracking-widest">{beat.title}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{beat.subtitle}</p>
                <Button variant="ghost" className="mt-4 text-xs" onClick={onDismiss}>
                  Continue
                </Button>
              </>
            ) : null}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}