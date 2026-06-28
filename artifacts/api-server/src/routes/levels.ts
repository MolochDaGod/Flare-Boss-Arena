import { Router } from "express";
import { db } from "@workspace/db";
import { levelsTable, type InsertLevel } from "@workspace/db";
import { asc, eq } from "drizzle-orm";
import { GetLevelParams } from "@workspace/api-zod";
import { logger } from "../lib/logger";

const router = Router();

const SEED_LEVELS: InsertLevel[] = [
  {
    slug: "blackmire-catacombs",
    name: "Blackmire Catacombs",
    biome: "catacombs",
    seed: 10117,
    difficulty: 1,
    description: "Flooded ossuaries beneath the old keep, where the first grudges were buried and refuse to stay dead.",
    recommendedLevel: 1,
    unlockReq: {},
    sortOrder: 1,
  },
  {
    slug: "rotwood-thicket",
    name: "Rotwood Thicket",
    biome: "darkwood",
    seed: 20231,
    difficulty: 2,
    description: "A choking tangle of blighted timber and briar-bound horrors that drink the light.",
    recommendedLevel: 5,
    unlockReq: { minLevel: 5 },
    sortOrder: 2,
  },
  {
    slug: "emberforge-depths",
    name: "Emberforge Depths",
    biome: "ember",
    seed: 30459,
    difficulty: 3,
    description: "Magma-veined forge halls where slag-wrought sentinels guard the warlord smithies of old.",
    recommendedLevel: 10,
    unlockReq: { minLevel: 10 },
    sortOrder: 3,
  },
  {
    slug: "frostvault-hollows",
    name: "Frostvault Hollows",
    biome: "frost",
    seed: 40873,
    difficulty: 4,
    description: "Glacier-sealed vaults of a frozen dynasty, their wardens never thawed, never forgiving.",
    recommendedLevel: 16,
    unlockReq: { minLevel: 16 },
    sortOrder: 4,
  },
  {
    slug: "shattered-wastes",
    name: "The Shattered Wastes",
    biome: "wastes",
    seed: 50291,
    difficulty: 5,
    description: "A scorched expanse of broken oaths, stalked by the wraiths of armies that lost their war.",
    recommendedLevel: 22,
    unlockReq: { minLevel: 22 },
    sortOrder: 5,
  },
  {
    slug: "drowned-cove",
    name: "The Drowned Cove",
    biome: "cove",
    seed: 60733,
    difficulty: 6,
    description: "Tide-rotted wrecks and barnacled marauders haunting the last harbor of the damned.",
    recommendedLevel: 28,
    unlockReq: { minLevel: 28, requiresZone: "shattered-wastes" },
    sortOrder: 6,
  },
];

export async function seedLevels(): Promise<void> {
  await db.insert(levelsTable).values(SEED_LEVELS).onConflictDoNothing({ target: levelsTable.slug });
  logger.info({ count: SEED_LEVELS.length }, "Levels seeded");
}

router.get("/levels", async (req, res) => {
  const levels = await db.select().from(levelsTable).orderBy(asc(levelsTable.sortOrder));
  res.json(levels.map((l) => ({ ...l, createdAt: l.createdAt.toISOString() })));
});

router.get("/levels/:slug", async (req, res) => {
  const parsed = GetLevelParams.safeParse({ slug: req.params.slug });
  if (!parsed.success) { res.status(400).json({ error: "Invalid slug" }); return; }
  const [level] = await db.select().from(levelsTable).where(eq(levelsTable.slug, parsed.data.slug));
  if (!level) { res.status(404).json({ error: "Level not found" }); return; }
  res.json({ ...level, createdAt: level.createdAt.toISOString() });
});

export default router;
