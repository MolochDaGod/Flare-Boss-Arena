import { pgTable, serial, text, integer, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const charactersTable = pgTable("characters", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  class: text("class").notNull(),
  race: text("race").notNull(),
  level: integer("level").notNull().default(1),
  xp: integer("xp").notNull().default(0),
  attributes: jsonb("attributes").$type<Record<string, number>>().notNull().default({}),
  equipment: jsonb("equipment").$type<Record<string, string | null>>().notNull().default({}),
  stats: jsonb("stats").$type<Record<string, number>>().notNull().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCharacterSchema = createInsertSchema(charactersTable).omit({ id: true, createdAt: true });
export type InsertCharacter = z.infer<typeof insertCharacterSchema>;
export type Character = typeof charactersTable.$inferSelect;
