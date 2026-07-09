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
  folder: "perks" | "props" | "ui";
  file: string;
  /** Uniform scale target — footprint (max XZ) or height depending on scaleMode. */
  scaleTarget: number;
  scaleMode: "footprint" | "height";
  /** Skeletal clip to loop when the GLB ships animation data. */
  clip?: string | null;
  perkId?: PerkId;
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
    scaleTarget: 6,
    scaleMode: "footprint",
  },
  {
    id: "prop_gumball",
    name: "Gumball Machine",
    kind: "machine",
    folder: "perks",
    file: "animation_gum_ball_machine.glb",
    scaleTarget: 2.4,
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
    scaleTarget: 14,
    scaleMode: "footprint",
  },
  {
    id: "prop_weapon_panel",
    name: "Weapon Panel",
    kind: "ui_panel",
    folder: "ui",
    file: "weapo_panel_ui.glb",
    scaleTarget: 3.2,
    scaleMode: "height",
  },
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
];