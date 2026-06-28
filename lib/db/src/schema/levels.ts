import { pgTable, serial, text, integer, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const levelsTable = pgTable("levels", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  biome: text("biome").notNull(),
  seed: integer("seed").notNull(),
  difficulty: integer("difficulty").notNull().default(1),
  description: text("description").notNull().default(""),
  recommendedLevel: integer("recommended_level").notNull().default(1),
  unlockReq: jsonb("unlock_req").$type<{ minLevel?: number; requiresZone?: string }>().notNull().default({}),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertLevelSchema = createInsertSchema(levelsTable).omit({ id: true, createdAt: true });
export type InsertLevel = z.infer<typeof insertLevelSchema>;
export type Level = typeof levelsTable.$inferSelect;
