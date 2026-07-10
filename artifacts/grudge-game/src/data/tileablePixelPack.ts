/**
 * Tileable pixel art asset pack — mesh catalog and camp placement layouts.
 * Source: `public/models/tileable/tilable_pixel_asset_pack.glb` (101-mesh atlas).
 */

export const TILEABLE_PACK_FILE = "tilable_pixel_asset_pack.glb";
export const TILEABLE_PACK_URL =
  `${import.meta.env.BASE_URL}models/tileable/${TILEABLE_PACK_FILE}`;

/** Uniform grid cell size in world units (matches stone tile footprint). */
export const TILEABLE_CELL = 2;

export type TileableCategory =
  | "floor"
  | "wall"
  | "corner"
  | "building"
  | "tree"
  | "rock"
  | "prop"
  | "terrain";

export interface TileableMeshDef {
  id: string;
  mesh: string;
  category: TileableCategory;
  label: string;
}

/** Canonical mesh names inside the atlas GLB. */
export const TILEABLE_MESHES: TileableMeshDef[] = [
  { id: "grass", mesh: "Grass_Tiles2_0", category: "floor", label: "Grass Tile" },
  { id: "stone", mesh: "StoneTile_Tiles2_0", category: "floor", label: "Stone Tile" },
  { id: "grass_ramp", mesh: "GrassRamp_Tiles2_0", category: "terrain", label: "Grass Ramp" },
  { id: "grass_corner", mesh: "GrassBlockCorner_Tiles2_0", category: "terrain", label: "Grass Corner" },
  { id: "wall", mesh: "Wall_Tiles2_0", category: "wall", label: "Wood Wall" },
  { id: "wall_corner", mesh: "WallCorner_Tiles2_0", category: "corner", label: "Wall Corner" },
  { id: "wall_corner_l", mesh: "WallCornerL_Tiles2_0", category: "corner", label: "Wall Corner L" },
  { id: "wall_corner_r", mesh: "WallCornerR_Tiles2_0", category: "corner", label: "Wall Corner R" },
  { id: "stone_wall", mesh: "StoneWall_Tiles2_0", category: "wall", label: "Stone Wall" },
  { id: "stone_wall_corner", mesh: "StoneWallCorner_Tiles2_0", category: "corner", label: "Stone Wall Corner" },
  { id: "home_blue", mesh: "HomeBlue_Buildings1_0", category: "building", label: "Blue Home" },
  { id: "home_green", mesh: "HomeGreen_Buildings1_0", category: "building", label: "Green Home" },
  { id: "home_red", mesh: "HomeRed_Buildings1_0", category: "building", label: "Red Home" },
  { id: "home_parts", mesh: "HomeParts_Buildings1_0", category: "building", label: "Home Parts" },
  { id: "hedge", mesh: "Hedge_Buildings1_0", category: "prop", label: "Hedge" },
  { id: "hedge_long", mesh: "HedgeLong_Buildings1_0", category: "prop", label: "Long Hedge" },
  { id: "tree_pine", mesh: "TreePine_Natures_0", category: "tree", label: "Pine Tree" },
  { id: "tree_bush", mesh: "TreeBush_Natures_0", category: "tree", label: "Bush" },
  { id: "tree_bare", mesh: "TreeBare_Natures_0", category: "tree", label: "Bare Tree" },
  { id: "tree_log", mesh: "TreeLog_Natures_0", category: "tree", label: "Fallen Log" },
  { id: "rock", mesh: "Bombable Rock_Tiles2_0", category: "rock", label: "Rock" },
  { id: "rock_b", mesh: "Bombable Rock.001_Tiles2_0", category: "rock", label: "Rock B" },
  { id: "rock_c", mesh: "Bombable Rock.002_Tiles2_0", category: "rock", label: "Rock C" },
  { id: "rock_rubble", mesh: "Bombable Rock Rubble_Tiles2_0", category: "rock", label: "Rubble" },
  { id: "fountain", mesh: "Fountain_Tiles4_0", category: "prop", label: "Fountain" },
  { id: "pillar", mesh: "Pillar1_Tiles2_0", category: "prop", label: "Pillar" },
  { id: "log_bridge", mesh: "LogBridge_Tiles2_0", category: "prop", label: "Log Bridge" },
  { id: "herb", mesh: "Herb_Tiles2_0", category: "prop", label: "Herb" },
];

export const TILEABLE_MESH_BY_ID = new Map(TILEABLE_MESHES.map((d) => [d.id, d]));

export type TileableScaleMode = "footprint" | "height" | "native" | "cell";

export interface TileablePlacement {
  /** Registry id from {@link TILEABLE_MESHES} or raw GLB mesh name. */
  mesh: string;
  x: number;
  z: number;
  rotY?: number;
  scaleMode?: TileableScaleMode;
  /** Target size — footprint (max XZ), height (Y), or cell width for `cell` mode. */
  scaleTarget?: number;
}

export interface TileableFloorConfig {
  bounds: number;
  cell?: number;
  grassMesh?: string;
  stoneMesh?: string;
  /** Stone ring radius in cells from centre (cobble plaza). */
  stoneRingCells?: number;
}

/** Floor grid + scatter for the training-yard camp (bounds ≈ 18). */
export const CAMP_TILEABLE_FLOOR: TileableFloorConfig = {
  bounds: 18,
  cell: TILEABLE_CELL,
  grassMesh: "Grass_Tiles2_0",
  stoneMesh: "StoneTile_Tiles2_0",
  stoneRingCells: 2,
};

/** Trees, rocks, modular buildings, and town-upgrade props. */
export const CAMP_TILEABLE_SCATTER: TileablePlacement[] = [
  // Perimeter trees
  { mesh: "tree_pine", x: 14, z: 6, rotY: 0.4, scaleMode: "height", scaleTarget: 4.2 },
  { mesh: "tree_pine", x: -13, z: 9, rotY: 1.1, scaleMode: "height", scaleTarget: 3.8 },
  { mesh: "tree_bush", x: 12, z: -10, rotY: 0.2, scaleMode: "height", scaleTarget: 2.4 },
  { mesh: "tree_bare", x: -14, z: -5, rotY: 2.4, scaleMode: "height", scaleTarget: 4.5 },
  { mesh: "tree_log", x: 8, z: 13, rotY: -0.6, scaleMode: "footprint", scaleTarget: 3 },
  { mesh: "tree_pine", x: -10, z: -12, rotY: 0.9, scaleMode: "height", scaleTarget: 3.5 },
  { mesh: "tree_bush", x: 15, z: -3, rotY: 1.8, scaleMode: "height", scaleTarget: 2.2 },
  { mesh: "herb", x: 4, z: 7, rotY: 0, scaleMode: "footprint", scaleTarget: 1.2 },

  // Perimeter rocks (replace procedural dodecahedrons)
  { mesh: "rock", x: 15, z: -9, rotY: 0.5, scaleMode: "footprint", scaleTarget: 1.8 },
  { mesh: "rock_b", x: -15, z: 4, rotY: 1.2, scaleMode: "footprint", scaleTarget: 2.1 },
  { mesh: "rock_c", x: 10, z: 14, rotY: 2.0, scaleMode: "footprint", scaleTarget: 1.6 },
  { mesh: "rock_rubble", x: -12, z: -13, rotY: 0.3, scaleMode: "footprint", scaleTarget: 1.4 },
  { mesh: "rock", x: -6, z: 15, rotY: 1.7, scaleMode: "footprint", scaleTarget: 2.0 },
  { mesh: "rock_b", x: 16, z: 2, rotY: 0.8, scaleMode: "footprint", scaleTarget: 1.7 },

  // Town-upgrade homes near station ring
  { mesh: "home_blue", x: 11, z: 3, rotY: -2.2, scaleMode: "footprint", scaleTarget: 4.8 },
  { mesh: "home_green", x: -9, z: 10, rotY: 2.6, scaleMode: "footprint", scaleTarget: 4.5 },
  { mesh: "home_red", x: -7, z: -11, rotY: 0.9, scaleMode: "footprint", scaleTarget: 4.6 },
  { mesh: "home_parts", x: 13, z: -6, rotY: -1.4, scaleMode: "footprint", scaleTarget: 3.2 },

  // District props
  { mesh: "fountain", x: 1.5, z: -2.5, rotY: 0, scaleMode: "footprint", scaleTarget: 2.8 },
  { mesh: "hedge", x: 6, z: 7, rotY: 0.7, scaleMode: "footprint", scaleTarget: 5 },
  { mesh: "hedge_long", x: -5, z: 12, rotY: 1.2, scaleMode: "footprint", scaleTarget: 7 },
  { mesh: "pillar", x: -3, z: -4, rotY: 0, scaleMode: "height", scaleTarget: 2.5 },
  { mesh: "log_bridge", x: 5, z: -12, rotY: Math.PI / 2, scaleMode: "footprint", scaleTarget: 5 },

  // Modular perimeter walls (north / south segments)
  { mesh: "wall", x: 0, z: 16, rotY: 0, scaleMode: "native" },
  { mesh: "wall", x: -6, z: 16, rotY: 0, scaleMode: "native" },
  { mesh: "wall", x: 6, z: 16, rotY: 0, scaleMode: "native" },
  { mesh: "wall_corner", x: -10, z: 14, rotY: 0, scaleMode: "native" },
  { mesh: "wall_corner", x: 10, z: 14, rotY: -Math.PI / 2, scaleMode: "native" },
  { mesh: "stone_wall", x: 0, z: -16, rotY: Math.PI, scaleMode: "native" },
  { mesh: "stone_wall_corner", x: -8, z: -14, rotY: Math.PI / 2, scaleMode: "native" },
];

/** Harbor-scale scatter (5× camp) — for future full Grudge Harbor migration. */
export const HARBOR_TILEABLE_SCATTER: TileablePlacement[] = [
  { mesh: "tree_pine", x: 72, z: 28, rotY: 0.3, scaleMode: "height", scaleTarget: 5 },
  { mesh: "tree_pine", x: -68, z: -32, rotY: 1.4, scaleMode: "height", scaleTarget: 4.8 },
  { mesh: "tree_bare", x: 58, z: -60, rotY: 2.1, scaleMode: "height", scaleTarget: 5.2 },
  { mesh: "rock", x: 80, z: 10, rotY: 0.6, scaleMode: "footprint", scaleTarget: 2.5 },
  { mesh: "rock_c", x: -78, z: -20, rotY: 1.0, scaleMode: "footprint", scaleTarget: 2.8 },
  { mesh: "home_blue", x: 48, z: 14, rotY: -2.0, scaleMode: "footprint", scaleTarget: 6 },
  { mesh: "home_green", x: 28, z: -34, rotY: 2.4, scaleMode: "footprint", scaleTarget: 5.5 },
  { mesh: "home_red", x: -38, z: -12, rotY: 0.8, scaleMode: "footprint", scaleTarget: 5.8 },
  { mesh: "fountain", x: 10, z: 8, rotY: 0, scaleMode: "footprint", scaleTarget: 4 },
  { mesh: "hedge_long", x: 52, z: -8, rotY: 0.5, scaleMode: "footprint", scaleTarget: 10 },
];