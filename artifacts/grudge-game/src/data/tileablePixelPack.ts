/**
 * Tileable pixel art pack — floor foundations + graphed scatter for /camp.
 * Source: `public/models/tileable/tilable_pixel_asset_pack.glb`
 *
 * Layout rules:
 * - Floor = cube foundations (grass + stone roads), graphed spokes/rings
 * - Scatter = nature + walls + landmarks only — NO voxel homes meshed with fishing_town
 * - Props always place on foundation top (see TileablePackLoader)
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

export interface TileableRoadConfig {
  /** Radial cobble spokes in degrees (station doorway bearings). */
  spokeAnglesDeg: number[];
  /** Angular half-width of each spoke in radians. */
  spokeHalfWidth?: number;
  /** Chebyshev ring roads at these cell distances from centre. */
  ringCells?: number[];
  /** Pave the central N–S and E–W axes. */
  crossAxes?: boolean;
}

export interface TileableFloorConfig {
  bounds: number;
  cell?: number;
  grassMesh?: string;
  stoneMesh?: string;
  /** Stone ring radius in cells from centre (cobble plaza). */
  stoneRingCells?: number;
  roads?: TileableRoadConfig;
}

/** Graphed foundation floor — spokes to station angles, ring roads, plaza. */
export const CAMP_TILEABLE_FLOOR: TileableFloorConfig = {
  bounds: 36,
  cell: TILEABLE_CELL,
  grassMesh: "Grass_Tiles2_0",
  stoneMesh: "StoneTile_Tiles2_0",
  stoneRingCells: 2,
  roads: {
    // Match CampScene STATION_DEFS angleDeg (doorway bearings)
    spokeAnglesDeg: [-90, -38.6, 12.9, 64.3, 115.7, 167.1, 218.6],
    spokeHalfWidth: 0.2,
    ringCells: [4, 8],
    crossAxes: true,
  },
};

/**
 * Graphed scatter — perimeter nature + walls + plaza props only.
 * Voxel homes removed (fishing_town.glb owns buildings on foundation tops).
 */
export const CAMP_TILEABLE_SCATTER: TileablePlacement[] = [
  // Plaza landmark (centre-south of campfire)
  { mesh: "fountain", x: 0, z: -4, rotY: 0, scaleMode: "footprint", scaleTarget: 2.8 },
  { mesh: "pillar", x: -5, z: -3, rotY: 0, scaleMode: "height", scaleTarget: 2.6 },
  { mesh: "pillar", x: 5, z: -3, rotY: 0, scaleMode: "height", scaleTarget: 2.6 },

  // Perimeter trees (outside wall ring, not on station pads)
  { mesh: "tree_pine", x: 30, z: 10, rotY: 0.4, scaleMode: "height", scaleTarget: 4.6 },
  { mesh: "tree_pine", x: -28, z: 16, rotY: 1.1, scaleMode: "height", scaleTarget: 4.2 },
  { mesh: "tree_bare", x: -30, z: -12, rotY: 2.4, scaleMode: "height", scaleTarget: 4.8 },
  { mesh: "tree_pine", x: 28, z: -16, rotY: 0.9, scaleMode: "height", scaleTarget: 4.0 },
  { mesh: "tree_bush", x: 22, z: 26, rotY: 0.2, scaleMode: "height", scaleTarget: 2.4 },
  { mesh: "tree_bush", x: -22, z: 28, rotY: 1.8, scaleMode: "height", scaleTarget: 2.2 },
  { mesh: "tree_log", x: 18, z: -28, rotY: -0.6, scaleMode: "footprint", scaleTarget: 3.2 },
  { mesh: "herb", x: 10, z: 16, rotY: 0, scaleMode: "footprint", scaleTarget: 1.2 },
  { mesh: "herb", x: -14, z: 12, rotY: 0.8, scaleMode: "footprint", scaleTarget: 1.1 },

  // Rocks at corners (graph nodes)
  { mesh: "rock", x: 30, z: -24, rotY: 0.5, scaleMode: "footprint", scaleTarget: 2.0 },
  { mesh: "rock_b", x: -30, z: 22, rotY: 1.2, scaleMode: "footprint", scaleTarget: 2.2 },
  { mesh: "rock_c", x: 26, z: 28, rotY: 2.0, scaleMode: "footprint", scaleTarget: 1.8 },
  { mesh: "rock_rubble", x: -26, z: -26, rotY: 0.3, scaleMode: "footprint", scaleTarget: 1.6 },

  // Hedge borders along market / guild edges (not through plaza)
  { mesh: "hedge", x: 14, z: 10, rotY: 0.7, scaleMode: "footprint", scaleTarget: 5 },
  { mesh: "hedge_long", x: -16, z: 20, rotY: 1.0, scaleMode: "footprint", scaleTarget: 7 },

  // N/S perimeter walls on outer ring (graphed, not random)
  { mesh: "wall", x: 0, z: 33, rotY: 0, scaleMode: "footprint", scaleTarget: 4 },
  { mesh: "wall", x: -10, z: 33, rotY: 0, scaleMode: "footprint", scaleTarget: 4 },
  { mesh: "wall", x: 10, z: 33, rotY: 0, scaleMode: "footprint", scaleTarget: 4 },
  { mesh: "wall_corner", x: -18, z: 31, rotY: 0, scaleMode: "footprint", scaleTarget: 3.5 },
  { mesh: "wall_corner", x: 18, z: 31, rotY: -Math.PI / 2, scaleMode: "footprint", scaleTarget: 3.5 },
  { mesh: "stone_wall", x: 0, z: -33, rotY: Math.PI, scaleMode: "footprint", scaleTarget: 4 },
  { mesh: "stone_wall", x: -12, z: -32, rotY: Math.PI, scaleMode: "footprint", scaleTarget: 4 },
  { mesh: "stone_wall", x: 12, z: -32, rotY: Math.PI, scaleMode: "footprint", scaleTarget: 4 },
  { mesh: "stone_wall_corner", x: -16, z: -30, rotY: Math.PI / 2, scaleMode: "footprint", scaleTarget: 3.5 },
  { mesh: "stone_wall_corner", x: 16, z: -30, rotY: -Math.PI / 2, scaleMode: "footprint", scaleTarget: 3.5 },
];

/** Harbor-scale scatter (nature only) — no voxel homes. */
export const HARBOR_TILEABLE_SCATTER: TileablePlacement[] = [
  { mesh: "tree_pine", x: 72, z: 28, rotY: 0.3, scaleMode: "height", scaleTarget: 5 },
  { mesh: "tree_pine", x: -68, z: -32, rotY: 1.4, scaleMode: "height", scaleTarget: 4.8 },
  { mesh: "tree_bare", x: 58, z: -60, rotY: 2.1, scaleMode: "height", scaleTarget: 5.2 },
  { mesh: "rock", x: 80, z: 10, rotY: 0.6, scaleMode: "footprint", scaleTarget: 2.5 },
  { mesh: "rock_c", x: -78, z: -20, rotY: 1.0, scaleMode: "footprint", scaleTarget: 2.8 },
  { mesh: "fountain", x: 10, z: 8, rotY: 0, scaleMode: "footprint", scaleTarget: 4 },
  { mesh: "hedge_long", x: 52, z: -8, rotY: 0.5, scaleMode: "footprint", scaleTarget: 10 },
];
