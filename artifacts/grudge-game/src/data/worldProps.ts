/**
 * Registry for world GLB props — perk machines, collectable symbols,
 * environment pieces, and 3D UI panels.
 *
 * Files live under `public/models/{perks,props,ui}/`.
 */
import { CAMP_PROP_LAYOUTS } from "./campTown";

export type WorldPropKind =
  | "machine"
  | "collectable"
  | "perk_symbol"
  | "environment"
  | "ui_panel"
  | "character";

export type PerkId = "firebug" | "medic" | "support" | "gunslinger";

export interface WorldPropDef {
  id: string;
  name: string;
  kind: WorldPropKind;
  /** Subfolder under public/models/ */
  folder: "perks" | "props" | "ui" | "fantasy-props";
  file: string;
  /** Uniform scale target — footprint (max XZ) or height depending on scaleMode. */
  scaleTarget: number;
  scaleMode: "footprint" | "height";
  /** Skeletal clip to loop when the GLB ships animation data. */
  clip?: string | null;
  perkId?: PerkId;
}

/** Helper — GST megakit fantasy props (shared trim textures). */
function fp(
  id: string,
  file: string,
  name: string,
  scaleTarget: number,
  scaleMode: "footprint" | "height" = "height",
  kind: WorldPropKind = "environment",
): WorldPropDef {
  return {
    id,
    name,
    kind,
    folder: "fantasy-props",
    file: file.endsWith(".gltf") || file.endsWith(".glb") ? file : `${file}.gltf`,
    scaleTarget,
    scaleMode,
  };
}

export const PERK_COLORS: Record<PerkId, number> = {
  firebug: 0xff5522,
  medic: 0xff3366,
  support: 0x3388ff,
  gunslinger: 0xffcc33,
};

export const PERK_LABELS: Record<PerkId, string> = {
  firebug: "Firebug",
  medic: "Medic",
  support: "Support",
  gunslinger: "Gunslinger",
};

export const WORLD_PROPS: WorldPropDef[] = [
  {
    id: "prop_perk_machines",
    name: "Perk Machines",
    kind: "machine",
    folder: "perks",
    file: "perk_machines.glb",
    // Was 6 — often loaded as a giant slab; keep machine-row human-scale.
    scaleTarget: 3.2,
    scaleMode: "footprint",
  },
  {
    id: "prop_gumball",
    name: "Gumball Machine",
    kind: "machine",
    folder: "perks",
    file: "animation_gum_ball_machine.glb",
    scaleTarget: 1.85,
    scaleMode: "height",
    clip: null,
  },
  {
    id: "prop_perk_firebug",
    name: "Firebug Perk",
    kind: "perk_symbol",
    folder: "perks",
    file: "kf2_firebug_perk_symbol.glb",
    scaleTarget: 1.2,
    scaleMode: "height",
    perkId: "firebug",
  },
  {
    id: "prop_perk_medic",
    name: "Medic Perk",
    kind: "perk_symbol",
    folder: "perks",
    file: "kf2_medic_perk_symbol.glb",
    scaleTarget: 1.2,
    scaleMode: "height",
    perkId: "medic",
  },
  {
    id: "prop_perk_support",
    name: "Support Perk",
    kind: "perk_symbol",
    folder: "perks",
    file: "kf2_support_perk_symbol.glb",
    scaleTarget: 1.2,
    scaleMode: "height",
    perkId: "support",
  },
  {
    id: "prop_perk_gunslinger",
    name: "Gunslinger Perk",
    kind: "perk_symbol",
    folder: "perks",
    file: "kf2_gunslinger_perk_symbol.glb",
    scaleTarget: 1.2,
    scaleMode: "height",
    perkId: "gunslinger",
  },
  {
    id: "prop_gunslinger_hero",
    name: "Gunslinger",
    kind: "character",
    folder: "perks",
    file: "gunslinger.glb",
    scaleTarget: 1.9,
    scaleMode: "height",
    perkId: "gunslinger",
  },
  {
    id: "prop_grass_trenches",
    name: "Grass Trenches",
    kind: "environment",
    folder: "props",
    file: "grass_trenches.glb",
    // Decorative ground strip — was 14u and dwarfed the yard.
    scaleTarget: 6.5,
    scaleMode: "footprint",
  },
  {
    id: "prop_weapon_panel",
    name: "Weapon Panel",
    kind: "ui_panel",
    folder: "ui",
    file: "weapo_panel_ui.glb",
    scaleTarget: 2.2,
    scaleMode: "height",
  },

  // ── GST Fantasy Props (megakit glTF) — camp forge / market / dungeon ──
  fp("fp_anvil", "Anvil", "Anvil", 0.95, "height"),
  fp("fp_anvil_log", "Anvil_Log", "Anvil on Log", 1.1, "height"),
  fp("fp_workbench", "Workbench", "Workbench", 1.6, "footprint"),
  fp("fp_workbench_drawers", "Workbench_Drawers", "Workbench Drawers", 1.5, "footprint"),
  fp("fp_weapon_stand", "WeaponStand", "Weapon Stand", 1.8, "height"),
  fp("fp_whetstone", "Whetstone", "Whetstone", 0.55, "footprint"),
  fp("fp_barrel", "Barrel", "Barrel", 0.95, "height"),
  fp("fp_barrel_apples", "Barrel_Apples", "Apple Barrel", 0.95, "height"),
  fp("fp_crate_wood", "Crate_Wooden", "Wooden Crate", 0.85, "footprint"),
  fp("fp_crate_metal", "Crate_Metal", "Metal Crate", 0.85, "footprint"),
  fp("fp_banner_1", "Banner_1", "Banner", 2.4, "height"),
  fp("fp_banner_2", "Banner_2", "Banner B", 2.4, "height"),
  fp("fp_table", "Table_Large", "Large Table", 2.2, "footprint"),
  fp("fp_bench", "Bench", "Bench", 1.6, "footprint"),
  fp("fp_stool", "Stool", "Stool", 0.55, "height"),
  fp("fp_chest", "Chest_Wood", "Wood Chest", 1.1, "footprint"),
  fp("fp_cauldron", "Cauldron", "Cauldron", 0.9, "height"),
  fp("fp_torch", "Torch_Metal", "Metal Torch", 1.6, "height"),
  fp("fp_lantern", "Lantern_Wall", "Wall Lantern", 0.55, "height"),
  fp("fp_candles", "CandleStick_Stand", "Candle Stand", 0.9, "height"),
  fp("fp_stall", "Stall_Empty", "Market Stall", 2.8, "footprint"),
  fp("fp_stall_cart", "Stall_Cart_Empty", "Market Cart", 2.2, "footprint"),
  fp("fp_dummy", "Dummy", "Training Dummy", 1.9, "height"),
  fp("fp_bookcase", "Bookcase_2", "Bookcase", 2.2, "height"),
  fp("fp_books", "Book_Stack_1", "Book Stack", 0.45, "height"),
  fp("fp_coins", "Coin_Pile", "Coin Pile", 0.5, "footprint"),
  fp("fp_pouch", "Pouch_Large", "Coin Pouch", 0.35, "height"),
  fp("fp_key", "Key_Gold", "Gold Key", 0.25, "height", "collectable"),
  fp("fp_shield", "Shield_Wooden", "Wooden Shield", 0.9, "height"),
  fp("fp_sword", "Sword_Bronze", "Bronze Sword", 1.0, "height"),
  fp("fp_axe", "Axe_Bronze", "Bronze Axe", 0.95, "height"),
  fp("fp_potion", "Potion_1", "Potion", 0.28, "height", "collectable"),
  fp("fp_bag", "Bag", "Travel Bag", 0.55, "height"),
  fp("fp_cage", "Cage_Small", "Small Cage", 1.0, "height"),
  fp("fp_chain", "Chain_Coil", "Chain Coil", 0.7, "footprint"),
  fp("fp_bucket", "Bucket_Wooden_1", "Wooden Bucket", 0.5, "height"),
  fp("fp_farm_crate", "FarmCrate_Apple", "Apple Crate", 0.9, "footprint"),
];

export const WORLD_PROP_BY_ID = new Map(WORLD_PROPS.map((d) => [d.id, d]));

/** Camp hub placement — models + optional E-key interaction stations. */
export interface CampPropPlacement {
  propId: string;
  x: number;
  z: number;
  rotY: number;
  stationId?: string;
  label?: string;
  hint?: string;
  color?: number;
}

/** Camp hub placements — synced with the 5× harbor layout in campTown.ts */
export const CAMP_PROP_PLACEMENTS: CampPropPlacement[] = CAMP_PROP_LAYOUTS;

/** Dungeon scatter — floating perk symbols the player can pick up. */
export interface CollectablePlacement {
  propId: string;
  x: number;
  z: number;
  rotY?: number;
  stationId?: string;
}

export const DUNGEON_COLLECTABLES: CollectablePlacement[] = [
  { propId: "prop_perk_firebug", x: -22, z: 18, stationId: "perk_firebug" },
  { propId: "prop_perk_medic", x: 28, z: -12, stationId: "perk_medic" },
  { propId: "prop_perk_support", x: -30, z: -20, stationId: "perk_support" },
  { propId: "prop_perk_gunslinger", x: 35, z: 25, stationId: "perk_gunslinger" },
  { propId: "prop_gumball", x: 0, z: 40, rotY: Math.PI },
  // Fantasy props — loot / atmosphere along corridors
  { propId: "fp_chest", x: 14, z: 22, rotY: 0.4 },
  { propId: "fp_chest", x: -18, z: -26, rotY: -0.8 },
  { propId: "fp_barrel", x: 8, z: -16, rotY: 0.2 },
  { propId: "fp_crate_wood", x: -12, z: 14, rotY: 0.6 },
  { propId: "fp_torch", x: 20, z: 8, rotY: 0 },
  { propId: "fp_torch", x: -24, z: -8, rotY: Math.PI },
  { propId: "fp_coins", x: 6, z: 30, rotY: 0 },
  { propId: "fp_potion", x: -8, z: 26, rotY: 0.3 },
  { propId: "fp_key", x: 32, z: -6, rotY: 0.5 },
  { propId: "fp_cage", x: -28, z: 20, rotY: 0.2 },
  { propId: "fp_chain", x: 24, z: -22, rotY: 1.1 },
  { propId: "fp_bag", x: -4, z: -32, rotY: 0.7 },
];