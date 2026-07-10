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

const ROUND_MISSIONS: Omit<RoundMission, "killGoal">[] = [
  {
    id: "cull_beach",
    title: "Clear the Beachhead",
    description: "Cull hostiles along the cobble roads to draw out the Island Colossus.",
    rewardLabel: "Captain's Sail — next island",
  },
  {
    id: "cull_roads",
    title: "Secure the Road Network",
    description: "Purge patrols from the seeded island paths.",
    rewardLabel: "Captain's Sail — next island",
  },
  {
    id: "cull_shrine",
    title: "Silence the Shrines",
    description: "Cull hostiles near the Grudge shrines and crossroads.",
    rewardLabel: "Captain's Sail — next island",
  },
  {
    id: "cull_cove",
    title: "Break the Cove Blockade",
    description: "Clear the approach to Pirate Cove before the Colossus lands.",
    rewardLabel: "Captain's Sail — next island",
  },
  {
    id: "cull_wastes",
    title: "Scour the Ash Wastes",
    description: "Hunt through the fog-shrouded outer ring.",
    rewardLabel: "Captain's Sail — next island",
  },
];

export function missionForRound(round: number): RoundMission {
  const r = Math.max(1, round);
  const killGoal = 6 + Math.min(5, Math.floor((r - 1) / 2)) * 2;
  const template = ROUND_MISSIONS[(r - 1) % ROUND_MISSIONS.length]!;
  return {
    ...template,
    id: `${template.id}_r${r}`,
    title: r === 1 ? template.title : `Round ${r} — ${template.title}`,
    killGoal,
  };
}