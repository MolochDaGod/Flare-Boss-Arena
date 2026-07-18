/**
 * Dock Quest Traveler tutorial opener — ported for Flare Boss Arena.
 *
 * Same quest line for all 6 races; only destinations change.
 * Source: grudge-builder factionLobbyIslands quest_traveler + travelerTutorialQuest.
 *
 * Ends: craft raft → sail to faction island → meet commander.
 */

export type RaceId = "human" | "barbarian" | "elf" | "dwarf" | "orc" | "undead";

export const TRAVELER_NPC = {
  name: "Dock Quest Traveler",
  dialogueSetId: "starter_quest_boat",
  voiceId: "sean-lenhart",
  /** CDN dialogue pack */
  audioBase: "https://assets.grudge-studio.com/audio/dialogue/super-pack",
  modelUrl: "https://assets.grudge-studio.com/models/grudge6/races/WK_Characters.glb",
} as const;

export type TravelerStepKind =
  | "dialogue"
  | "move"
  | "harvest"
  | "craft"
  | "equip"
  | "combat"
  | "claim"
  | "board"
  | "sail"
  | "talk_commander";

export interface TravelerStepReward {
  gold?: number;
  xp?: number;
  wood?: number;
  stone?: number;
  herb?: number;
  items?: Array<{ id: string; name: string; qty: number }>;
}

export interface TravelerTutorialStep {
  id: string;
  kind: TravelerStepKind;
  title: string;
  objective: string;
  hint: string;
  travelerLine: string;
  vocalCategory: "greeting" | "confirmation" | "miscellaneous" | "completion" | "farewell" | "shouting";
  targetCount?: number;
  rewards: TravelerStepReward;
}

export const TRAVELER_TUTORIAL_STEPS: TravelerTutorialStep[] = [
  {
    id: "meet_traveler",
    kind: "dialogue",
    title: "Welcome Aboard",
    objective: "Speak with the Dock Quest Traveler on your starter boat",
    hint: "Press E near the traveler",
    travelerLine:
      "Easy there, shipwrecked. I am the Dock Traveler — every race hears the same first lesson. Listen close.",
    vocalCategory: "greeting",
    rewards: { gold: 15, xp: 25, items: [{ id: "item_ration_t0", name: "Travel Ration", qty: 2 }] },
  },
  {
    id: "learn_move",
    kind: "move",
    title: "Find Your Feet",
    objective: "Walk from the boat to the beach marker",
    hint: "WASD · camera drag · Sprint with Shift",
    travelerLine: "First lesson: move. Reach the beach marker before the tide takes your courage.",
    vocalCategory: "confirmation",
    rewards: { xp: 20 },
  },
  {
    id: "gather_basics",
    kind: "harvest",
    title: "Gather to Survive",
    objective: "Collect sticks (×3) and stones (×2) near the wreck",
    hint: "E / F harvest nodes when close",
    travelerLine: "Empty hands fill with sticks and stone. Harvest is life on these islands.",
    vocalCategory: "miscellaneous",
    targetCount: 5,
    rewards: {
      xp: 40,
      wood: 3,
      stone: 2,
      items: [{ id: "t0_tool_kit_token", name: "Tool Kit Token", qty: 1 }],
    },
  },
  {
    id: "craft_tools",
    kind: "craft",
    title: "Craft T0 Tools",
    objective: "Quick-craft a Flint Pickaxe",
    hint: "Main Panel → Quick Craft · 1 wood + 1 stone",
    travelerLine: "Tools make the traveler. Craft a pickaxe — then we talk timber and iron.",
    vocalCategory: "confirmation",
    rewards: {
      xp: 50,
      gold: 20,
      items: [{ id: "t0_pickaxe", name: "Flint Pickaxe", qty: 1 }],
    },
  },
  {
    id: "equip_tool",
    kind: "equip",
    title: "Equip Main Hand",
    objective: "Equip the pickaxe to MainHand",
    hint: "Inventory → equipment → MainHand",
    travelerLine: "A tool in the bag is a hope. A tool in the hand is a plan.",
    vocalCategory: "confirmation",
    rewards: { xp: 25 },
  },
  {
    id: "harvest_node",
    kind: "harvest",
    title: "Work a Node",
    objective: "Fully harvest one stone node and one wood node",
    hint: "Attack trees and rocks with F until they deplete",
    travelerLine: "Nodes refill in time. Take what you need — leave the island breathing.",
    vocalCategory: "miscellaneous",
    targetCount: 2,
    rewards: { xp: 45, wood: 5, stone: 5, gold: 15 },
  },
  {
    id: "claim_flag",
    kind: "claim",
    title: "Plant a Claim",
    objective: "Plant a claim flag (C) and harvest a scripted node in the ring",
    hint: "Press C · gather one node inside the golden ring",
    travelerLine:
      "Claim the ground and the ground answers with resources. Flags mark what you mean to keep.",
    vocalCategory: "shouting",
    rewards: {
      xp: 60,
      gold: 30,
      items: [{ id: "item_claim_flag_t0", name: "Practice Claim Flag", qty: 1 }],
    },
  },
  {
    id: "first_fight",
    kind: "combat",
    title: "First Blood",
    objective: "Defeat one enemy or extinguish one wisp",
    hint: "F attack · Q block · Shift dodge",
    travelerLine: "Steel answers steel. Finish one foe cleanly — block, dodge, strike.",
    vocalCategory: "shouting",
    targetCount: 1,
    rewards: {
      xp: 80,
      gold: 40,
      items: [
        { id: "potion_minor_heal", name: "Minor Healing Potion", qty: 3 },
        { id: "t0_sidearm", name: "Traveler Sidearm", qty: 1 },
      ],
    },
  },
  {
    id: "ui_basics",
    kind: "dialogue",
    title: "Know Your Panels",
    objective: "Open equipment / skills once (or advance via traveler)",
    hint: "Explore the HUD panels, then talk to the traveler again",
    travelerLine:
      "Panels are your second map. Inventory, skills, and the main board — open each before we sail.",
    vocalCategory: "miscellaneous",
    rewards: { xp: 30, gold: 10 },
  },
  {
    id: "craft_raft",
    kind: "craft",
    title: "Build the Raft",
    objective: "Craft a Coastal Raft (requires wood)",
    hint: "Gather wood · spend 8 wood at the traveler craft prompt",
    travelerLine:
      "Last craft of the shore: a raft. Build it true — then we leave the wreck behind.",
    vocalCategory: "confirmation",
    rewards: {
      xp: 100,
      gold: 50,
      items: [{ id: "item_raft_t0", name: "Coastal Raft", qty: 1 }],
    },
  },
  {
    id: "board_raft",
    kind: "board",
    title: "Board the Raft",
    objective: "Board your raft at the dock",
    hint: "Press E at the dock raft marker",
    travelerLine: "Board when ready. The sea between wreck and home is short — if you keep the heading.",
    vocalCategory: "confirmation",
    rewards: { xp: 40 },
  },
  {
    id: "sail_faction",
    kind: "sail",
    title: "Sail to Your People",
    objective: "Sail the raft to {island} ({race} faction island)",
    hint: "Confirm sail when the traveler opens the heading",
    travelerLine:
      "Same road for every bloodline — only the shore changes. Sail for {island}. Your commander waits.",
    vocalCategory: "shouting",
    rewards: { xp: 120, gold: 75 },
  },
  {
    id: "meet_commander",
    kind: "talk_commander",
    title: "Report to the Commander",
    objective: "Speak with {commander} at {island}",
    hint: "Dock · talk to the commander to complete the opener",
    travelerLine:
      "I leave you here. Report to {commander}. The fleet needs sailors who can gather, claim, fight, and sail.",
    vocalCategory: "farewell",
    rewards: {
      xp: 200,
      gold: 150,
      items: [
        { id: "item_faction_badge", name: "Faction Recruit Badge", qty: 1 },
        { id: "item_traveler_satchel", name: "Traveler Satchel", qty: 1 },
        { id: "potion_minor_heal", name: "Minor Healing Potion", qty: 5 },
      ],
    },
  },
];

export interface RaceTravelerDest {
  raceId: RaceId;
  islandName: string;
  commanderName: string;
  commanderTitle: string;
  factionName: string;
  questTravelerEntityId: string;
}

export const RACE_DEST: Record<RaceId, RaceTravelerDest> = {
  human: {
    raceId: "human",
    islandName: "Haven Reach Outpost",
    commanderName: "Sigurd",
    commanderTitle: "The Unbreakable",
    factionName: "Crusade",
    questTravelerEntityId: "human_quest_traveler_boat",
  },
  barbarian: {
    raceId: "barbarian",
    islandName: "Stormfang Isle",
    commanderName: "Thrax",
    commanderTitle: "The Savage",
    factionName: "Crusade",
    questTravelerEntityId: "barbarian_quest_traveler_boat",
  },
  elf: {
    raceId: "elf",
    islandName: "Starleaf Cay",
    commanderName: "Aelindor",
    commanderTitle: "The Swift",
    factionName: "Fabled",
    questTravelerEntityId: "elf_quest_traveler_boat",
  },
  dwarf: {
    raceId: "dwarf",
    islandName: "Anvilspire Key",
    commanderName: "Durgin",
    commanderTitle: "Ironheart",
    factionName: "Fabled",
    questTravelerEntityId: "dwarf_quest_traveler_boat",
  },
  orc: {
    raceId: "orc",
    islandName: "Bloodwake Atoll",
    commanderName: "Gruk",
    commanderTitle: "Skullcrusher",
    factionName: "Legion",
    questTravelerEntityId: "orc_quest_traveler_boat",
  },
  undead: {
    raceId: "undead",
    islandName: "Gravewake Shoal",
    commanderName: "Bone",
    commanderTitle: "The Collector",
    factionName: "Legion",
    questTravelerEntityId: "undead_quest_traveler_boat",
  },
};

export function fillTokens(text: string, dest: RaceTravelerDest): string {
  return text
    .replace(/\{island\}/g, dest.islandName)
    .replace(/\{commander\}/g, `${dest.commanderName} ${dest.commanderTitle}`)
    .replace(/\{race\}/g, dest.raceId)
    .replace(/\{faction\}/g, dest.factionName);
}

export function stepsForRace(raceId: RaceId): TravelerTutorialStep[] {
  const dest = RACE_DEST[raceId] ?? RACE_DEST.human;
  return TRAVELER_TUTORIAL_STEPS.map((s) => ({
    ...s,
    objective: fillTokens(s.objective, dest),
    hint: fillTokens(s.hint, dest),
    travelerLine: fillTokens(s.travelerLine, dest),
  }));
}

/** Super Dialogue pack URL for a bark (optional playback). */
export function travelerVocalUrl(
  category: TravelerTutorialStep["vocalCategory"],
  variant = 1,
): string {
  const tag = TRAVELER_NPC.voiceId.split("-")[0]; // sean
  return `${TRAVELER_NPC.audioBase}/${category}/${category}_${variant}_${tag}.wav`;
}

export type TutorialProgress = {
  raceId: RaceId;
  stepIndex: number;
  completed: string[];
  inventory: string[];
  gold: number;
  xp: number;
  wood: number;
  stone: number;
  raftCrafted: boolean;
  boarded: boolean;
  sailed: boolean;
  metCommander: boolean;
};

const STORAGE_KEY = "grudge:traveler-tutorial";

export function loadTutorialProgress(raceId: RaceId): TutorialProgress {
  const fallback: TutorialProgress = {
    raceId,
    stepIndex: 0,
    completed: [],
    inventory: [],
    gold: 0,
    xp: 0,
    wood: 0,
    stone: 0,
    raftCrafted: false,
    boarded: false,
    sailed: false,
    metCommander: false,
  };
  if (typeof localStorage === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const p = { ...fallback, ...JSON.parse(raw), raceId };
    return p;
  } catch {
    return fallback;
  }
}

export function saveTutorialProgress(p: TutorialProgress) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
}

export function grantStepRewards(p: TutorialProgress, step: TravelerTutorialStep): TutorialProgress {
  const next = { ...p, inventory: [...p.inventory] };
  next.gold += step.rewards.gold ?? 0;
  next.xp += step.rewards.xp ?? 0;
  next.wood += step.rewards.wood ?? 0;
  next.stone += step.rewards.stone ?? 0;
  for (const it of step.rewards.items ?? []) {
    for (let i = 0; i < it.qty; i++) next.inventory.push(it.id);
  }
  if (step.id === "craft_raft") next.raftCrafted = true;
  if (step.id === "board_raft") next.boarded = true;
  if (step.id === "sail_faction") next.sailed = true;
  if (step.id === "meet_commander") next.metCommander = true;
  if (!next.completed.includes(step.id)) next.completed = [...next.completed, step.id];
  next.stepIndex = Math.min(TRAVELER_TUTORIAL_STEPS.length - 1, next.stepIndex + 1);
  return next;
}
