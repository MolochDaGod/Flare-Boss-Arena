/**
 * Stack-fit open-water / naval references for Grudge (Three.js + TS browser ARPG).
 *
 * We do NOT vendor these repos — patterns only (water shaders, boat forces,
 * multiplayer naval loops). Our runtime stays: Vite + React + Three.js +
 * existing pirate Ship_* GLBs + Grudge6 crew.
 */

export interface OpenSourceRef {
  id: string;
  name: string;
  url: string;
  license?: string;
  stackFit: "excellent" | "good" | "patterns-only";
  borrow: string[];
  avoid: string[];
}

/**
 * Curated GitHub / demos closest to our open-water + combat goals.
 */
export const OPEN_WATER_REFS: OpenSourceRef[] = [
  {
    id: "three-sails",
    name: "three-sails (QusaiAlbonni)",
    url: "https://github.com/QusaiAlbonni/three-sails",
    license: "see repo",
    stackFit: "excellent",
    borrow: [
      "Sum-of-sines ocean vertex shader",
      "Buoyancy / pitch-roll from wave samples",
      "Sail lift-drag force sketch (simplified)",
      "Day/night ocean lighting",
    ],
    avoid: ["Ape.ecs dependency", "full custom rigid body engine"],
  },
  {
    id: "bythelee",
    name: "By The Lee (leeboardtools)",
    url: "https://github.com/leeboardtools/bythelee",
    stackFit: "good",
    borrow: [
      "3D sailing force model structure",
      "Boat state encapsulation",
      "Socket.IO multiplayer roadmap (we already use socket.io)",
    ],
    avoid: ["Phaser-era wrappers", "full sim UI"],
  },
  {
    id: "mk48",
    name: "mk48.io (SoftbearStudios)",
    url: "https://github.com/SoftbearStudios/mk48",
    license: "AGPL-3.0",
    stackFit: "patterns-only",
    borrow: [
      "Naval combat loop: helm, weapons, sensors, crates",
      "Ship progression / weapon families as design data",
      "Multiplayer room topology",
    ],
    avoid: ["Rust/WASM engine rewrite", "AGPL copy-paste into our MIT-style game"],
  },
  {
    id: "island-fever",
    name: "Island Fever (kylepaulsen)",
    url: "https://github.com/kylepaulsen/Island-Fever",
    stackFit: "good",
    borrow: ["Seeded island generation + revisit", "Island save/load shell"],
    avoid: ["Voxel terrain pipeline"],
  },
  {
    id: "three-ocean",
    name: "three.js ocean example",
    url: "https://threejs.org/examples/?q=water#webgl_shaders_ocean",
    stackFit: "excellent",
    borrow: ["Water mesh + sun reflection baseline"],
    avoid: ["Full Water.js if we need lighter mobile path"],
  },
  {
    id: "aviation-ocean",
    name: "PhilCrowther Aviation ocean modules",
    url: "https://github.com/PhilCrowther/Aviation",
    stackFit: "good",
    borrow: ["Moving-map ocean grids", "FFT / multi-grid water research"],
    avoid: ["WebGPU-only path until we migrate renderer"],
  },
  {
    id: "boat-game-three",
    name: "goncalotp/boat-game-three-js",
    url: "https://github.com/goncalotp/boat-game-three-js",
    stackFit: "good",
    borrow: ["Minimal boat controls demo structure"],
    avoid: ["University-toy scope for combat"],
  },
];

/** Migration phases we implement in-repo (flexible order). */
export const OPEN_WATER_MIGRATION = [
  {
    phase: 1,
    title: "Harbor as island district",
    doneWhen: "Camp shops/training stations exist at human scale on the island cove",
  },
  {
    phase: 2,
    title: "Open water pilot mode",
    doneWhen: "Board skiff at dock, sail on ocean mesh, crew slots from party",
  },
  {
    phase: 3,
    title: "Archipelago chart",
    doneWhen: "Seeded satellite islands with levels; land triggers next island run",
  },
  {
    phase: 4,
    title: "Naval combat v1",
    doneWhen: "Broadside / ram against sea hostiles; dock return",
  },
  {
    phase: 5,
    title: "UX polish",
    doneWhen: "Helm HUD, chart markers, embark/disembark prompts, flexible controls",
  },
] as const;
