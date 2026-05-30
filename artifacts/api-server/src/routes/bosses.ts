import { Router } from "express";
import { db } from "@workspace/db";
import { bossEncountersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";
import {
  GenerateBossBody,
  GetBossParams,
  RecordBossDefeatBody,
  RecordBossDefeatParams,
} from "@workspace/api-zod";

const router = Router();

const BASE_BOSSES = [
  { name: "The Hunter", title: "Predator of the Wild", tier: 4, zone: "Fabled Island", hp: 8000, phases: 2, assetPack: "Boss_Character_Hunter" },
  { name: "Thornguard Matriarch", title: "Queen of the Briar", tier: 3, zone: "Darkwood", hp: 6000, phases: 2, assetPack: "Boss_Character_Thornguard" },
  { name: "The Wrathkeeper", title: "Lord of Endless Grudges", tier: 7, zone: "Shattered Wastes", hp: 15000, phases: 3, assetPack: "Boss_Character_Wrathkeeper" },
];

router.get("/bosses", async (req, res) => {
  const bosses = await db.select().from(bossEncountersTable);
  res.json(bosses.map(b => ({ ...b, createdAt: b.createdAt.toISOString() })));
});

router.get("/bosses/:id", async (req, res) => {
  const parsed = GetBossParams.safeParse({ id: parseInt(req.params.id) });
  if (!parsed.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const [boss] = await db.select().from(bossEncountersTable).where(eq(bossEncountersTable.id, parsed.data.id));
  if (!boss) { res.status(404).json({ error: "Boss not found" }); return; }
  res.json({ ...boss, createdAt: boss.createdAt.toISOString() });
});

router.post("/bosses/generate", async (req, res) => {
  const parsed = GenerateBossBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { tier = 3, zone = "Shattered Wastes", playerClass = "warrior", playerLevel = 10, difficulty = "normal" } = parsed.data ?? {};

  const prompt = `You are a game designer for "Grudge Warlords," a dark fantasy isometric ARPG in the vein of Diablo and Flare Engine. Generate a unique AI boss encounter.

Player info: Class=${playerClass}, Level=${playerLevel}, Difficulty=${difficulty}
Zone: ${zone}, Boss Tier: ${tier}

Return ONLY valid JSON matching this schema exactly:
{
  "name": "Boss Name",
  "title": "Fearsome Subtitle",
  "lore": "2-3 sentence dark lore description",
  "tier": ${tier},
  "hp": <integer scaled to tier, tier 1=2000, tier 8=20000>,
  "phases": <2 or 3>,
  "assetPack": "Boss_Character_Name",
  "abilities": [
    { "id": "ability_id", "name": "Ability Name", "damage": <integer>, "description": "What it does", "cooldown": <rounds>, "type": "melee|ranged|magic|aoe|debuff" }
  ],
  "mechanics": {
    "phase1": { "name": "Phase Name", "description": "Phase 1 strategy" },
    "phase2": { "name": "Phase Name", "description": "Phase 2 strategy, triggered at 50% HP" },
    "phase3": { "name": "Phase Name", "description": "Phase 3 strategy, triggered at 20% HP — only if phases=3" }
  }
}

Make the boss thematic to the zone and challenging for the player's class. Abilities should counter the player's strengths. Make it genuinely threatening and lore-rich. The name should feel like a real boss from a dark fantasy world.`;

  const completion = await openai.chat.completions.create({
    model: "gpt-5.1",
    max_completion_tokens: 1200,
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
  });

  let bossData: Record<string, unknown>;
  try {
    bossData = JSON.parse(completion.choices[0]?.message?.content ?? "{}");
  } catch {
    res.status(500).json({ error: "Failed to parse AI boss generation" });
    return;
  }

  const abilities = (bossData.abilities as Array<{id: string; name: string; damage: number; description: string; cooldown: number; type: string}>) ?? [];
  const mechanics = (bossData.mechanics as Record<string, unknown>) ?? {};
  const maxHp = (bossData.hp as number) ?? 8000;

  const [boss] = await db.insert(bossEncountersTable).values({
    name: (bossData.name as string) ?? "The Unnamed",
    title: (bossData.title as string) ?? "Harbinger of Ruin",
    tier: (bossData.tier as number) ?? tier,
    hp: maxHp,
    maxHp,
    phase: 1,
    phases: (bossData.phases as number) ?? 2,
    abilities,
    lore: (bossData.lore as string) ?? "",
    mechanics,
    assetPack: (bossData.assetPack as string) ?? "Boss_Character_Default",
    defeated: false,
  }).returning();

  res.status(201).json({ ...boss, createdAt: boss.createdAt.toISOString() });
});

router.post("/bosses/:id/defeat", async (req, res) => {
  const idParsed = RecordBossDefeatParams.safeParse({ id: parseInt(req.params.id) });
  if (!idParsed.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = RecordBossDefeatBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [boss] = await db.select().from(bossEncountersTable).where(eq(bossEncountersTable.id, idParsed.data.id));
  if (!boss) { res.status(404).json({ error: "Boss not found" }); return; }

  await db.update(bossEncountersTable).set({ defeated: true }).where(eq(bossEncountersTable.id, idParsed.data.id));

  const xpGained = boss.tier * 500 + boss.maxHp / 10;
  const weaponDrops = ["bloodfeud-blade", "wraithfang", "oathbreaker", "kinrend-edge", "dusksinger-blade"];
  const armorDrops = ["cloth-bloodfeud-helm", "plate-oathbreaker-chest", "mail-wraithfang-gloves"];
  const allDrops = [...weaponDrops, ...armorDrops];
  const itemsDropped = Array.from({ length: Math.min(boss.tier, 4) }, () =>
    allDrops[Math.floor(Math.random() * allDrops.length)]
  );

  res.json({
    xpGained,
    itemsDropped,
    goldDropped: boss.tier * 100,
    message: `${boss.name} has been slain.`,
  });
});

export default router;
