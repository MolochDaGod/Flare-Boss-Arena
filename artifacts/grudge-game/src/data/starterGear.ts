/**
 * T0 starter loadout — given to every new warlord.
 *
 * Each class starts with:
 *   • 1× class weapon (Mainhand, T0)
 *   • 1× Hatchet (harvest wood, off-combat tool)
 *   • 1× Pickaxe (harvest stone, off-combat tool)
 *   • 2× Lesser Healing Potion (consumable)
 *   • 1× Hearthstone (home-bound portal, 30-minute cooldown)
 *
 * These are CLIENT-AUTHORED items (the R2 master files start at T1). They share
 * the same `AnyItem` shape used elsewhere in the inventory grid so the equip
 * flow, tooltip, and hotbar render them without special-casing.
 */

import type { ReactNode } from "react";

export interface StarterItem {
  id: string;
  uuid: string;
  name: string;
  tier: 0;
  type: "weapon" | "tool" | "consumable" | "utility";
  category: string;
  slotType?: "Mainhand" | "Offhand";
  description: string;
  lore?: string;
  /** Icon hint — rendered as an emoji glyph since these are virtual items. */
  glyph: string;
  /** For consumables/utility, milliseconds until usable again. */
  cooldownMs?: number;
  /** Stack-count on a single inventory slot (consumables stack). */
  count?: number;
  stats?: Record<string, number>;
  abilities?: string[];
}

export const HATCHET: StarterItem = {
  id: "tool.hatchet.t0",
  uuid: "starter-hatchet",
  name: "Worn Hatchet",
  tier: 0,
  type: "tool",
  category: "harvest",
  glyph: "🪓",
  description: "Chops wood from fallen logs and standing trees.",
  lore: "Notched from a thousand cuts, but still bites true.",
  abilities: ["Harvest: Wood"],
};

export const PICKAXE: StarterItem = {
  id: "tool.pickaxe.t0",
  uuid: "starter-pickaxe",
  name: "Worn Pickaxe",
  tier: 0,
  type: "tool",
  category: "harvest",
  glyph: "⛏",
  description: "Breaks ore nodes and loose stone.",
  lore: "The dwarves would call it serviceable.",
  abilities: ["Harvest: Stone", "Harvest: Ore"],
};

export const HEALING_POTION: StarterItem = {
  id: "potion.heal.lesser",
  uuid: "starter-potion-1",
  name: "Lesser Healing Potion",
  tier: 0,
  type: "consumable",
  category: "potion",
  glyph: "🧪",
  count: 2,
  cooldownMs: 30_000,
  description: "Restores 60 HP. 30s cooldown.",
  lore: "Tastes of iron and cheap herbs.",
  abilities: ["Restore 60 HP"],
};

export const HEARTHSTONE: StarterItem = {
  id: "utility.hearthstone",
  uuid: "starter-hearthstone",
  name: "Hearthstone",
  tier: 0,
  type: "utility",
  category: "portal",
  glyph: "🔥",
  cooldownMs: 30 * 60 * 1000, // 30 minutes
  description: "Channel for 8s to return to your bound camp. 30 min cooldown.",
  lore: "A coal from the camp's brazier, never quite cool.",
  abilities: ["Recall: Camp", "Bind: Sanctuary"],
};

/** Per-class starting Mainhand weapon. */
export const CLASS_STARTER_WEAPON: Record<string, StarterItem> = {
  warrior: {
    id: "weapon.shortsword.t0",
    uuid: "starter-weapon-warrior",
    name: "Iron Shortsword",
    tier: 0,
    type: "weapon",
    category: "swords",
    slotType: "Mainhand",
    glyph: "⚔",
    stats: { damage: 6 },
    description: "Standard issue. Forged from pig iron.",
    lore: "The first blade every conscript is handed at the gates.",
  },
  mage: {
    id: "weapon.staff.t0",
    uuid: "starter-weapon-mage",
    name: "Apprentice Staff",
    tier: 0,
    type: "weapon",
    category: "staves",
    slotType: "Mainhand",
    glyph: "🪄",
    stats: { damage: 4, magicDamage: 6 },
    description: "Channels a small mote of arcane fire.",
    lore: "A branch of yew, ringed with a single copper band.",
  },
  ranger: {
    id: "weapon.shortbow.t0",
    uuid: "starter-weapon-ranger",
    name: "Hunter's Shortbow",
    tier: 0,
    type: "weapon",
    category: "bows",
    slotType: "Mainhand",
    glyph: "🏹",
    stats: { damage: 5 },
    description: "Made for tracking deer; serviceable against men.",
    lore: "Strung with sinew, kept dry in oilcloth.",
  },
  worge: {
    id: "weapon.club.t0",
    uuid: "starter-weapon-worge",
    name: "Knotted Club",
    tier: 0,
    type: "weapon",
    category: "blunts",
    slotType: "Mainhand",
    glyph: "🪵",
    stats: { damage: 7 },
    description: "A heavy length of oak with a stone wedged through it.",
    lore: "Worges prefer their weapons honest.",
  },
};

/**
 * Build the full starting inventory for a class. Returns a fresh array each
 * call so callers can safely mutate.  Consumables that stack are split into
 * `count` field (the inventory slot renders the count badge).
 */
export function starterLoadout(charClass: string): StarterItem[] {
  const weapon = CLASS_STARTER_WEAPON[charClass.toLowerCase()] ?? CLASS_STARTER_WEAPON.warrior;
  return [
    { ...weapon },
    { ...HATCHET },
    { ...PICKAXE },
    { ...HEALING_POTION },
    { ...HEARTHSTONE },
  ];
}

/** localStorage-backed cooldown ledger — per character × item. */
const COOLDOWN_KEY = (charId: string | number) => `grudge.cooldowns.${charId}`;

export function getCooldowns(charId: string | number): Record<string, number> {
  if (typeof localStorage === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(COOLDOWN_KEY(charId)) ?? "{}");
  } catch {
    return {};
  }
}

export function startCooldown(charId: string | number, itemId: string, ms: number) {
  if (typeof localStorage === "undefined") return;
  const cds = getCooldowns(charId);
  cds[itemId] = Date.now() + ms;
  localStorage.setItem(COOLDOWN_KEY(charId), JSON.stringify(cds));
}

export function cooldownRemaining(charId: string | number, itemId: string): number {
  const cds = getCooldowns(charId);
  const until = cds[itemId];
  if (!until) return 0;
  return Math.max(0, until - Date.now());
}

// Avoid an "unused import" complaint if a downstream file picks up types here.
export type _ItemRendererPlaceholder = ReactNode;
