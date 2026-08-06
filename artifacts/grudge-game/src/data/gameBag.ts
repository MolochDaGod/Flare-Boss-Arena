/**
 * In-game 10-slot bag + crew tray (session SSOT).
 * Filled from starter gear + party allies — not a parallel inventory system.
 */

import {
  starterLoadout,
  type StarterItem,
  HATCHET,
  PICKAXE,
  HEALING_POTION,
  HEARTHSTONE,
} from "./starterGear";
import { getActiveFighter } from "./fighters";
import { getPartyAllyIds, getGrudge6Hero } from "./grudge6Roster";
import { getResources, type ResourceBag } from "./resources";
import { getWallet } from "./wallet";

export const BAG_SLOT_COUNT = 10;

export type BagSlotKind =
  | "empty"
  | "weapon"
  | "tool"
  | "consumable"
  | "utility"
  | "loot"
  | "crew";

export interface BagSlot {
  index: number;
  kind: BagSlotKind;
  /** Stable id for click/use */
  id: string | null;
  name: string;
  glyph: string;
  /** Optional spellbook / status icon id */
  statusIcon?: string;
  count?: number;
  description?: string;
  /** Party ally id when kind=crew */
  allyId?: string;
  equipped?: boolean;
}

export interface GameBagSnapshot {
  slots: BagSlot[];
  gold: number;
  resources: ResourceBag;
  crew: Array<{ id: string; name: string; role: string }>;
  activeTool: "weapon" | "hatchet" | "pickaxe";
}

const ACTIVE_TOOL_KEY = "flare:bag:activeTool";

export function getActiveTool(): "weapon" | "hatchet" | "pickaxe" {
  if (typeof localStorage === "undefined") return "weapon";
  try {
    const v = localStorage.getItem(ACTIVE_TOOL_KEY);
    if (v === "hatchet" || v === "pickaxe" || v === "weapon") return v;
  } catch {
    /* ignore */
  }
  return "weapon";
}

export function setActiveTool(t: "weapon" | "hatchet" | "pickaxe") {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(ACTIVE_TOOL_KEY, t);
}

function emptySlot(i: number): BagSlot {
  return {
    index: i,
    kind: "empty",
    id: null,
    name: "Empty",
    glyph: "",
  };
}

/**
 * Build 10 bag slots:
 * 0 weapon · 1 empty off · 2 hatchet · 3 pickaxe · 4 potion · 5 hearth
 * 6–9 loot / overflow
 * Crew is separate (party max 2) but mirrored into HUD.
 */
export function buildGameBagSnapshot(fighterId?: string): GameBagSnapshot {
  const f = getActiveFighter();
  const id = fighterId ?? f.id;
  const items = starterLoadout(id);
  const weapon = items.find((i) => i.type === "weapon");
  const potion = items.find((i) => i.type === "consumable") ?? HEALING_POTION;
  const toolH = items.find((i) => i.id === HATCHET.id) ?? HATCHET;
  const toolP = items.find((i) => i.id === PICKAXE.id) ?? PICKAXE;
  const hearth = items.find((i) => i.type === "utility") ?? HEARTHSTONE;
  const tool = getActiveTool();

  const slots: BagSlot[] = Array.from({ length: BAG_SLOT_COUNT }, (_, i) => emptySlot(i));

  const put = (i: number, item: StarterItem, kind: BagSlotKind, equipped = false) => {
    slots[i] = {
      index: i,
      kind,
      id: item.id,
      name: item.name,
      glyph: item.glyph,
      count: item.count,
      description: item.description,
      equipped,
      statusIcon:
        kind === "weapon"
          ? "strength"
          : kind === "tool"
            ? item.id.includes("pick")
              ? "shield"
              : "rage"
            : kind === "consumable"
              ? "regen"
              : kind === "utility"
                ? "haste"
                : undefined,
    };
  };

  if (weapon) put(0, weapon, "weapon", tool === "weapon");
  put(2, toolH, "tool", tool === "hatchet");
  put(3, toolP, "tool", tool === "pickaxe");
  put(4, potion, "consumable");
  put(5, hearth, "utility");

  const crew: Array<{ id: string; name: string; role: string }> = [];
  for (const aid of getPartyAllyIds()) {
    const h = getGrudge6Hero(aid);
    if (h) crew.push({ id: h.id, name: h.displayName, role: String(h.role) });
  }

  return {
    slots,
    gold: getWallet().gold,
    resources: getResources(),
    crew,
    activeTool: tool,
  };
}
