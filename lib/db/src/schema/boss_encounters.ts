import { pgTable, serial, text, integer, jsonb, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const bossEncountersTable = pgTable("boss_encounters", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  title: text("title").notNull(),
  tier: integer("tier").notNull().default(1),
  hp: integer("hp").notNull(),
  maxHp: integer("max_hp").notNull(),
  phase: integer("phase").notNull().default(1),
  phases: integer("phases").notNull().default(2),
  abilities: jsonb("abilities").$type<Array<{id: string; name: string; damage: number; description: string; cooldown: number; type: string}>>().notNull().default([]),
  lore: text("lore").notNull().default(""),
  mechanics: jsonb("mechanics").$type<Record<string, unknown>>().notNull().default({}),
  assetPack: text("asset_pack").notNull().default(""),
  defeated: boolean("defeated").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertBossEncounterSchema = createInsertSchema(bossEncountersTable).omit({ id: true, createdAt: true });
export type InsertBossEncounter = z.infer<typeof insertBossEncounterSchema>;
export type BossEncounter = typeof bossEncountersTable.$inferSelect;
