export type RewardTrackId = "daily" | "weekly" | "season" | "achievement";

export interface RewardEntry {
  id: string;
  track: RewardTrackId;
  title: string;
  description: string;
  progress: number;
  goal: number;
  rewardLabel: string;
  claimed: boolean;
}

export const REWARD_TRACKS: { id: RewardTrackId; label: string; blurb: string }[] = [
  { id: "daily", label: "Daily Cull", blurb: "MMO daily-login loop — quick combat goals." },
  { id: "weekly", label: "War Week", blurb: "Weekly raid-style milestones across modes." },
  { id: "season", label: "Season Pass", blurb: "Battle-pass track (Destiny / Fortnite pattern)." },
  { id: "achievement", label: "Trophies", blurb: "Permanent achievements — RTS campaign medals." },
];

export const REWARDS: RewardEntry[] = [
  { id: "d1", track: "daily", title: "First Blood", description: "Defeat 10 enemies in the dungeon.", progress: 10, goal: 10, rewardLabel: "150 Gold", claimed: false },
  { id: "d2", track: "daily", title: "Perk Pilgrim", description: "Collect 2 perk symbols in the world.", progress: 1, goal: 2, rewardLabel: "1 Perk Token", claimed: false },
  { id: "d3", track: "daily", title: "Camp Visit", description: "Engage any camp station.", progress: 0, goal: 1, rewardLabel: "50 Embers", claimed: false },
  { id: "w1", track: "weekly", title: "Boss Breaker", description: "Defeat 3 generated bosses.", progress: 1, goal: 3, rewardLabel: "500 Gold + 2 Souls", claimed: false },
  { id: "w2", track: "weekly", title: "Bestiary Sweep", description: "Fight every monster tier in the dungeon.", progress: 4, goal: 5, rewardLabel: "Rare Craft Mat", claimed: false },
  { id: "s1", track: "season", title: "Season Tier 5", description: "Earn 2,000 season XP.", progress: 840, goal: 2000, rewardLabel: "Gunslinger Skin Tint", claimed: false },
  { id: "s2", track: "season", title: "Season Tier 10", description: "Earn 5,000 season XP.", progress: 840, goal: 5000, rewardLabel: "Exclusive Emote", claimed: false },
  { id: "a1", track: "achievement", title: "Horde Survivor", description: "Survive 30 minutes in one dungeon session.", progress: 0, goal: 1, rewardLabel: "Title: Cull Veteran", claimed: false },
  { id: "a2", track: "achievement", title: "Gumball Addict", description: "Spin the gumball machine 25 times.", progress: 0, goal: 25, rewardLabel: "Gumball Trail VFX", claimed: false },
];