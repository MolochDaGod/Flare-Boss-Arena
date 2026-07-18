/**
 * Dock Quest Traveler tutorial opener HUD.
 * Same quest line for all races — destinations filled from race.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  stepsForRace,
  loadTutorialProgress,
  saveTutorialProgress,
  grantStepRewards,
  travelerVocalUrl,
  RACE_DEST,
  type RaceId,
  type TutorialProgress,
  type TravelerTutorialStep,
} from "@/data/travelerTutorial";
import { addResource } from "@/data/resources";
import { getWallet, saveWallet } from "@/data/wallet";

const RACES: RaceId[] = ["human", "barbarian", "elf", "dwarf", "orc", "undead"];

function playVocal(step: TravelerTutorialStep) {
  try {
    const url = travelerVocalUrl(step.vocalCategory, 1 + (step.id.length % 5));
    const a = new Audio(url);
    a.volume = 0.55;
    void a.play().catch(() => {
      /* CDN optional */
    });
  } catch {
    /* ignore */
  }
}

export function TravelerTutorialHUD(props: {
  raceId?: RaceId;
  /** Called when player finishes meet_commander */
  onComplete?: (p: TutorialProgress) => void;
  compact?: boolean;
}) {
  const [raceId, setRaceId] = useState<RaceId>(props.raceId ?? "human");
  const [progress, setProgress] = useState<TutorialProgress>(() => loadTutorialProgress(raceId));
  const [log, setLog] = useState<string[]>([]);
  const [open, setOpen] = useState(true);

  const steps = useMemo(() => stepsForRace(raceId), [raceId]);
  const dest = RACE_DEST[raceId];
  const step = steps[Math.min(progress.stepIndex, steps.length - 1)]!;
  const done = progress.metCommander;

  useEffect(() => {
    setProgress(loadTutorialProgress(raceId));
  }, [raceId]);

  useEffect(() => {
    saveTutorialProgress(progress);
  }, [progress]);

  const pushLog = useCallback((line: string) => {
    setLog((L) => [line, ...L].slice(0, 8));
  }, []);

  const advance = useCallback(
    (reason?: string) => {
      if (done) return;
      const current = steps[progress.stepIndex];
      if (!current) return;
      playVocal(current);
      let next = grantStepRewards(progress, current);
      // Apply bag rewards
      if (current.rewards.wood) addResource("wood", current.rewards.wood);
      if (current.rewards.stone) addResource("stone", current.rewards.stone);
      if (current.rewards.herb) addResource("herb", current.rewards.herb);
      if (current.rewards.gold) {
        try {
          const w = getWallet();
          w.gold = (w.gold ?? 0) + (current.rewards.gold ?? 0);
          saveWallet(w);
        } catch {
          /* optional */
        }
      }
      pushLog(
        reason ??
          `✓ ${current.title} — +${current.rewards.xp ?? 0} XP · +${current.rewards.gold ?? 0}g`,
      );
      pushLog(`Traveler: “${current.travelerLine}”`);
      if (current.id === "meet_commander") {
        pushLog(`Reported to ${dest.commanderName}. Opener complete.`);
        props.onComplete?.(next);
      }
      setProgress(next);
    },
    [done, steps, progress, pushLog, dest.commanderName, props],
  );

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-24 left-3 z-40 rounded border border-amber-700/60 bg-black/75 px-3 py-1.5 text-xs text-amber-200"
      >
        Traveler Quest
      </button>
    );
  }

  return (
    <div className="fixed bottom-20 left-3 z-40 w-[min(100vw-1.5rem,22rem)] rounded-lg border border-amber-800/50 bg-gradient-to-b from-zinc-950/95 to-black/90 p-3 text-zinc-100 shadow-xl backdrop-blur">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-amber-500/90">
            Dock Quest Traveler · Tutorial Opener
          </div>
          <div className="text-sm font-semibold text-amber-100">
            {done ? "Opener Complete" : step.title}
          </div>
        </div>
        <button
          type="button"
          className="text-zinc-500 hover:text-zinc-300"
          onClick={() => setOpen(false)}
          aria-label="Collapse"
        >
          −
        </button>
      </div>

      <label className="mb-2 flex items-center gap-2 text-[11px] text-zinc-400">
        Race boat
        <select
          className="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 text-zinc-200"
          value={raceId}
          onChange={(e) => setRaceId(e.target.value as RaceId)}
        >
          {RACES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </label>

      <div className="mb-2 rounded border border-zinc-800 bg-black/40 p-2 text-[11px] leading-snug text-zinc-300">
        <div className="text-amber-200/90">→ {dest.islandName}</div>
        <div>
          Commander:{" "}
          <span className="text-zinc-100">
            {dest.commanderName} {dest.commanderTitle}
          </span>
        </div>
        <div className="text-zinc-500">Faction {dest.factionName} · same steps, different shore</div>
      </div>

      {!done && (
        <>
          <p className="mb-1 text-xs text-zinc-200">{step.objective}</p>
          <p className="mb-2 text-[11px] text-zinc-500">{step.hint}</p>
          <blockquote className="mb-2 border-l-2 border-amber-700/70 pl-2 text-[11px] italic text-amber-100/80">
            “{step.travelerLine}”
          </blockquote>
          <div className="mb-2 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => advance()}
              className="rounded bg-amber-700/90 px-2.5 py-1 text-[11px] font-medium text-black hover:bg-amber-600"
            >
              Complete step
            </button>
            <button
              type="button"
              onClick={() => playVocal(step)}
              className="rounded border border-zinc-600 px-2.5 py-1 text-[11px] text-zinc-300 hover:bg-zinc-800"
            >
              Play vocal
            </button>
          </div>
        </>
      )}

      {done && (
        <p className="mb-2 text-xs text-emerald-300">
          Raft sailed to {dest.islandName}. You reported to {dest.commanderName}. Rewards banked.
        </p>
      )}

      <div className="mb-2 max-h-28 overflow-y-auto text-[10px] text-zinc-500">
        {steps.map((s, i) => {
          const ok = progress.completed.includes(s.id);
          const cur = !done && i === progress.stepIndex;
          return (
            <div
              key={s.id}
              className={
                ok ? "text-emerald-600/90" : cur ? "text-amber-300" : "text-zinc-600"
              }
            >
              {ok ? "✓" : cur ? "●" : "○"} {s.title}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2 border-t border-zinc-800 pt-2 text-[10px] text-zinc-400">
        <span>XP {progress.xp}</span>
        <span>Gold {progress.gold}</span>
        <span>Wood {progress.wood}</span>
        <span>Stone {progress.stone}</span>
        <span>Items {progress.inventory.length}</span>
      </div>

      {log.length > 0 && (
        <div className="mt-2 max-h-16 overflow-y-auto border-t border-zinc-800 pt-1 text-[10px] text-zinc-500">
          {log.map((l, i) => (
            <div key={`${i}-${l.slice(0, 12)}`}>{l}</div>
          ))}
        </div>
      )}
    </div>
  );
}

export default TravelerTutorialHUD;
