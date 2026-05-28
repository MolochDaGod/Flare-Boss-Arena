import { Router } from "express";
import { db } from "@workspace/db";
import { charactersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  CreateCharacterBody,
  UpdateCharacterBody,
  GetCharacterParams,
  UpdateCharacterParams,
  EquipItemBody,
  EquipItemParams,
  GetCharacterSkillsParams,
} from "@workspace/api-zod";

const router = Router();

const CLASS_STARTING_ATTRIBUTES: Record<string, Record<string, number>> = {
  warrior: { Strength: 5, Vitality: 3, Endurance: 2, Dexterity: 1, Agility: 1, Intellect: 0, Wisdom: 0, Tactics: 0 },
  mage: { Strength: 0, Vitality: 1, Endurance: 1, Dexterity: 2, Agility: 1, Intellect: 5, Wisdom: 3, Tactics: 0 },
  ranger: { Strength: 1, Vitality: 2, Endurance: 1, Dexterity: 5, Agility: 3, Intellect: 0, Wisdom: 0, Tactics: 1 },
  worge: { Strength: 2, Vitality: 2, Endurance: 1, Dexterity: 2, Agility: 1, Intellect: 2, Wisdom: 2, Tactics: 1 },
};

const RACE_BONUSES: Record<string, Record<string, number>> = {
  human: { Strength: 1, Intellect: 1, Vitality: 1, Dexterity: 1, Endurance: 1, Wisdom: 1, Agility: 1, Tactics: 1 },
  orc: { Strength: 3, Vitality: 3, Endurance: 2, Dexterity: 0, Agility: 1, Intellect: 0, Wisdom: 0, Tactics: 0 },
  elf: { Strength: 0, Intellect: 3, Vitality: 1, Dexterity: 3, Agility: 3, Wisdom: 2, Endurance: 0, Tactics: 1 },
  dwarf: { Strength: 2, Vitality: 2, Endurance: 4, Dexterity: 1, Agility: 0, Intellect: 0, Wisdom: 1, Tactics: 3 },
  undead: { Strength: 1, Vitality: 0, Endurance: 2, Dexterity: 2, Agility: 2, Intellect: 3, Wisdom: 3, Tactics: 0 },
  beastkin: { Strength: 3, Vitality: 2, Endurance: 1, Dexterity: 3, Agility: 4, Intellect: 0, Wisdom: 0, Tactics: 0 },
};

function computeStats(attributes: Record<string, number>) {
  const str = attributes.Strength ?? 0;
  const vit = attributes.Vitality ?? 0;
  const dex = attributes.Dexterity ?? 0;
  const end = attributes.Endurance ?? 0;
  const intel = attributes.Intellect ?? 0;
  const wis = attributes.Wisdom ?? 0;
  return {
    hp: 100 + vit * 12,
    mana: 50 + wis * 10,
    physDamage: 10 * (1 + str * 0.05),
    magicDamage: 10 * (1 + intel * 0.05),
    critChance: 5 + dex * 1.5,
    defense: 5 + end * 2,
  };
}

router.get("/characters", async (req, res) => {
  const chars = await db.select().from(charactersTable);
  res.json(chars.map(c => ({
    ...c,
    createdAt: c.createdAt.toISOString(),
  })));
});

router.post("/characters", async (req, res) => {
  const parsed = CreateCharacterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { name, class: charClass, race } = parsed.data;
  const baseAttrs = CLASS_STARTING_ATTRIBUTES[charClass.toLowerCase()] ?? CLASS_STARTING_ATTRIBUTES.warrior;
  const raceBonuses = RACE_BONUSES[race.toLowerCase()] ?? {};
  const attributes: Record<string, number> = {};
  for (const key of Object.keys(baseAttrs)) {
    attributes[key] = (baseAttrs[key] ?? 0) + (raceBonuses[key] ?? 0);
  }
  const stats = computeStats(attributes);
  const equipment: Record<string, null> = {
    mainHand: null, offHand: null, helm: null, chest: null,
    legs: null, boots: null, gloves: null, ring1: null, ring2: null, amulet: null,
  };
  const [char] = await db.insert(charactersTable).values({
    name, class: charClass, race, level: 1, xp: 0, attributes, equipment, stats,
  }).returning();
  res.status(201).json({ ...char, createdAt: char.createdAt.toISOString() });
});

router.get("/characters/:id", async (req, res) => {
  const parsed = GetCharacterParams.safeParse({ id: parseInt(req.params.id) });
  if (!parsed.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const [char] = await db.select().from(charactersTable).where(eq(charactersTable.id, parsed.data.id));
  if (!char) { res.status(404).json({ error: "Character not found" }); return; }
  res.json({ ...char, createdAt: char.createdAt.toISOString() });
});

router.patch("/characters/:id", async (req, res) => {
  const idParsed = UpdateCharacterParams.safeParse({ id: parseInt(req.params.id) });
  if (!idParsed.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = UpdateCharacterBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [char] = await db.update(charactersTable)
    .set(parsed.data)
    .where(eq(charactersTable.id, idParsed.data.id))
    .returning();
  if (!char) { res.status(404).json({ error: "Character not found" }); return; }
  res.json({ ...char, createdAt: char.createdAt.toISOString() });
});

router.post("/characters/:id/equip", async (req, res) => {
  const idParsed = EquipItemParams.safeParse({ id: parseInt(req.params.id) });
  if (!idParsed.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = EquipItemBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [existing] = await db.select().from(charactersTable).where(eq(charactersTable.id, idParsed.data.id));
  if (!existing) { res.status(404).json({ error: "Character not found" }); return; }
  const equipment = { ...(existing.equipment as Record<string, string | null>), [parsed.data.slot]: parsed.data.itemId };
  const [char] = await db.update(charactersTable)
    .set({ equipment })
    .where(eq(charactersTable.id, idParsed.data.id))
    .returning();
  res.json({ ...char, createdAt: char.createdAt.toISOString() });
});

router.get("/characters/:id/skills", async (req, res) => {
  const parsed = GetCharacterSkillsParams.safeParse({ id: parseInt(req.params.id) });
  if (!parsed.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const [char] = await db.select().from(charactersTable).where(eq(charactersTable.id, parsed.data.id));
  if (!char) { res.status(404).json({ error: "Character not found" }); return; }
  const equipment = char.equipment as Record<string, string | null>;

  const activeSkills: Array<{id: string; name: string; description: string; cooldown: string; mana: number; icon: string; weaponType: string}> = [];
  const passives: Array<{id: string; name: string; description: string; cooldown: string; mana: number; icon: string; weaponType: string}> = [];

  const weaponSkillMap: Record<string, Array<{id: string; name: string; description: string; cooldown: string; mana: number; icon: string}>> = {
    sword: [
      { id: "slash", name: "Vengeful Slash", description: "Single-target slash, builds 1 Grudge Mark stack", cooldown: "0s", mana: 0, icon: "/icons/pack/weapons/Sword_01.png" },
      { id: "power_strike", name: "Power Strike", description: "Powerful overhead strike dealing 150% damage", cooldown: "6s", mana: 15, icon: "/icons/pack/weapons/Sword_02.png" },
    ],
    axe: [
      { id: "cleave", name: "Brutal Cleave", description: "Wide arc hitting multiple enemies", cooldown: "7s", mana: 18, icon: "/icons/pack/weapons/Axe_01.png" },
      { id: "gorehowl", name: "Gorehowl Strike", description: "Savage strike with bleed for 5s", cooldown: "5s", mana: 12, icon: "/icons/pack/weapons/Axe_02.png" },
    ],
    staff: [
      { id: "arcane_bolt", name: "Arcane Bolt", description: "Launches a bolt of raw arcane energy", cooldown: "0s", mana: 10, icon: "/icons/pack/weapons/Staff_01.png" },
      { id: "mana_surge", name: "Mana Surge", description: "Overloads the target with magical energy", cooldown: "8s", mana: 25, icon: "/icons/pack/weapons/Staff_02.png" },
    ],
    bow: [
      { id: "arrow_shot", name: "Arrow Shot", description: "Quick ranged attack with high accuracy", cooldown: "0s", mana: 0, icon: "/icons/pack/weapons/Bow_01.png" },
      { id: "volley", name: "Volley", description: "Fires multiple arrows in a cone", cooldown: "8s", mana: 20, icon: "/icons/pack/weapons/Bow_02.png" },
    ],
  };

  const mainHand = equipment.mainHand;
  if (mainHand) {
    const weaponType = mainHand.includes("sword") ? "sword"
      : mainHand.includes("axe") ? "axe"
      : mainHand.includes("staff") ? "staff"
      : mainHand.includes("bow") ? "bow"
      : "sword";
    const skills = weaponSkillMap[weaponType] ?? weaponSkillMap.sword;
    skills.forEach(s => activeSkills.push({ ...s, weaponType }));
  } else {
    activeSkills.push({ id: "basic_attack", name: "Basic Attack", description: "A basic unarmed strike", cooldown: "0s", mana: 0, icon: "", weaponType: "unarmed" });
  }

  const helm = equipment.helm;
  if (helm) {
    passives.push({ id: "helm_passive", name: "Iron Will", description: "+5% defense from headgear", cooldown: "passive", mana: 0, icon: "", weaponType: "armor" });
  }
  const chest = equipment.chest;
  if (chest) {
    passives.push({ id: "chest_passive", name: "Fortified", description: "+10 max HP from chest armor", cooldown: "passive", mana: 0, icon: "", weaponType: "armor" });
  }

  res.json({ characterId: char.id, activeSkills, passives });
});

export default router;
