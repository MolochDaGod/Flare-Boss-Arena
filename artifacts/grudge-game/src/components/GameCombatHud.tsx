/**
 * @deprecated Prefer UnifiedCombatHud + fromIslandGameState.
 * Thin adapter kept so older imports still work.
 */
import { memo, useMemo } from "react";
import type { GameState } from "@/game/GameEngine";
import { UnifiedCombatHud } from "@/components/UnifiedCombatHud";
import { fromIslandGameState, skillsFromBar } from "@/data/combatHudAdapters";

export interface GameCombatHudProps {
  state: GameState;
  charName: string;
  raceClass: string;
  skillBar: Array<{ id: string; name: string; icon?: string; glyph?: string } | undefined>;
  skillCdPct?: number[];
  specialReadyPct: number;
  onSkill?: (idx: number) => void;
  startMs?: number;
}

export const GameCombatHud = memo(function GameCombatHud({
  state,
  charName,
  raceClass,
  skillBar,
  skillCdPct,
  specialReadyPct,
  onSkill,
  startMs,
}: GameCombatHudProps) {
  const skills = useMemo(
    () => skillsFromBar(skillBar, skillCdPct, state.pendingSkillIdx),
    [skillBar, skillCdPct, state.pendingSkillIdx],
  );
  const unified = useMemo(
    () =>
      fromIslandGameState(state, {
        charName,
        raceClass,
        skills,
        specialReadyPct,
      }),
    [state, charName, raceClass, skills, specialReadyPct],
  );

  return (
    <UnifiedCombatHud
      state={unified}
      onSkill={onSkill}
      onSpecial={() => onSkill?.(-1)}
      startMs={startMs}
    />
  );
});
