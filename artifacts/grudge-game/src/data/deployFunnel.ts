/**
 * Guided deploy funnel — one path from War Panel into the island loop.
 */

import { PLAY_LOOP, type NavHref } from "./gameFlow";
import { getActiveFighterId } from "./fighters";
import { getPartyAllyIds } from "./grudge6Roster";
import { getActivePerks } from "./perks";
import { getPlayableCharacter } from "./playableIdentity";
import { loadIslandRun } from "./islandRun";

export type DeployStepStatus = "done" | "todo" | "optional";

export interface DeployStep {
  id: string;
  label: string;
  note: string;
  route: NavHref;
  status: DeployStepStatus;
  done: boolean;
}

export interface DeployReadiness {
  steps: DeployStep[];
  blockers: DeployStep[];
  recommended: DeployStep | null;
  canDeploy: boolean;
  deployLabel: string;
  deployHref: NavHref;
  islandRound: number;
  islandPhase: string;
  resume: boolean;
}

function hasEquippedStones(): boolean {
  const char = getPlayableCharacter();
  const eq = char.equipment ?? {};
  return Object.values(eq).some((v) => Boolean(v));
}

export function getDeployReadiness(): DeployReadiness {
  const run = loadIslandRun();
  const resume =
    run.round > 1 ||
    run.killsThisRound > 0 ||
    run.phase === "boss_fight" ||
    run.phase === "boss_alert" ||
    run.phase === "victory";

  const steps: DeployStep[] = [
    {
      id: "fighter",
      label: PLAY_LOOP[0]!.label,
      note: "Active champion kit",
      route: "/select",
      status: "done",
      done: Boolean(getActiveFighterId()),
    },
    {
      id: "party",
      label: PLAY_LOOP[1]!.label,
      note: "Allies follow you in the dungeon",
      route: "/party",
      status: "optional",
      done: getPartyAllyIds().length > 0,
    },
    {
      id: "equipment",
      label: PLAY_LOOP[2]!.label,
      note: "Socket attribute stones",
      route: "/equipment",
      status: "optional",
      done: hasEquippedStones(),
    },
    {
      id: "skills",
      label: PLAY_LOOP[3]!.label,
      note: "Review fighter skills",
      route: "/skills",
      status: "optional",
      done: true,
    },
    {
      id: "perks",
      label: "Perks",
      note: "Combat modifiers apply in-run",
      route: "/perks",
      status: "optional",
      done: getActivePerks().length > 0,
    },
  ];

  const blockers = steps.filter((s) => s.status === "done" && !s.done);
  const recommended = steps.find((s) => !s.done && s.id !== "skills") ?? null;

  // Production capital start: Grudge Harbor (/camp). Resume open-world cull only when mid-run.
  const deployLabel = resume
    ? run.phase === "victory"
      ? `Return — Sail from Harbor (R${run.round})`
      : `Resume Island — Round ${run.round}`
    : "Enter Capital Harbor";

  return {
    steps,
    blockers,
    recommended,
    canDeploy: blockers.length === 0,
    deployLabel,
    deployHref: resume ? "/game" : "/camp",
    islandRound: run.round,
    islandPhase: run.phase,
    resume,
  };
}