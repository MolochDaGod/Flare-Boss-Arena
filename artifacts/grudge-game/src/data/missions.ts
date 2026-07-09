/**
 * Round missions — clear conditions that summon the Island Colossus.
 */

export interface RoundMission {
  id: string;
  title: string;
  description: string;
  killGoal: number;
  rewardLabel: string;
}

export function missionForRound(round: number): RoundMission {
  const r = Math.max(1, round);
  const killGoal = 6 + Math.min(4, Math.floor((r - 1) / 2)) * 2;
  return {
    id: `cull_r${r}`,
    title: r === 1 ? "Clear the Beachhead" : `Round ${r} — Purge the Island`,
    description: `Cull ${killGoal} hostiles to draw out the Island Colossus.`,
    killGoal,
    rewardLabel: "Captain's Sail — next island",
  };
}