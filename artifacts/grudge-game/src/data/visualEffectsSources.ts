/**
 * MolochDaGod forks + first-party resources for VFX, shaders, controllers, AI.
 * Use as a borrow-patterns catalog for Flare Boss Arena / grudge-game visuals.
 *
 * Last inventory: 2026-08-05 (GitHub API users/MolochDaGod)
 */

export type SourceFit = "port-soon" | "patterns" | "research" | "tooling";

export interface VisualSourceRef {
  id: string;
  /** Your fork or owned repo */
  url: string;
  /** Upstream if this is a fork */
  upstream?: string;
  kind: "fork" | "owned";
  fit: SourceFit;
  /** What to steal for grudge-game visuals / AI feel */
  applyTo: string[];
  notes: string;
  pushed?: string;
}

/** Your recent GitHub forks (MolochDaGod) relevant to effects / controllers / AI. */
export const MOLCOH_FORKS: VisualSourceRef[] = [
  {
    id: "CastingAbilitiesThreeJS",
    url: "https://github.com/MolochDaGod/CastingAbilitiesThreeJS",
    upstream: "https://github.com/achrefelouafi/AvatarCastingAbilitiesThreeJS",
    kind: "fork",
    fit: "port-soon",
    pushed: "2026-08-03",
    applyTo: [
      "combat/particles.ts element VFX",
      "combat/combatVfx.ts path-following casts",
      "combat/bloom.ts + post grade",
      "skill ground_aoe / deployable trails",
      "ocean/water materials (raymarched water)",
    ],
    notes:
      "BEST VFX lab: Fire volume, Ocean water, Earth instanced crust, Air scooter, GPU particles, depth soft-intersect, distortion pass, ACES grade, lil-gui presets. Vite+Three+GLSL — same stack as grudge-game.",
  },
  {
    id: "grudgecontrol",
    url: "https://github.com/MolochDaGod/grudgecontrol",
    upstream: "https://github.com/hh-hang/three-player-controller",
    kind: "fork",
    fit: "port-soon",
    pushed: "2026-07-29",
    applyTo: [
      "GameEngine land locomotion feel",
      "open water → land transitions",
      "camera spring / over-shoulder",
      "BVH colliders (we already use three-mesh-bvh)",
      "optional vehicle/boat boarding API",
    ],
    notes:
      "Capsule + BVH controller, FPS/TPS, fly, vehicle (Rapier optional). Patterns for boarding skiff / smoother camera.",
  },
  {
    id: "GrudgeShader.lab",
    url: "https://github.com/MolochDaGod/GrudgeShader.lab",
    upstream: "https://github.com/lo-th/Shader.lab",
    kind: "fork",
    fit: "research",
    pushed: "2026-03-19",
    applyTo: [
      "custom GLSL materials",
      "shadertoy ports for sky/ocean/magic",
      "postprocessing experiments",
    ],
    notes: "Advanced three.js shader lab (shadertoy ports). Mine for island atmosphere shaders.",
  },
  {
    id: "web-demos",
    url: "https://github.com/MolochDaGod/web-demos",
    upstream: "https://github.com/red-reddington/web-demos",
    kind: "fork",
    fit: "patterns",
    pushed: "2026-05-31",
    applyTo: ["procedural scenes", "single-file perf demos", "LOD/instancing ideas"],
    notes: "High-perf Three.js demos, procedural scenes, small games.",
  },
  {
    id: "CoreGRUDA",
    url: "https://github.com/MolochDaGod/CoreGRUDA",
    upstream: "https://github.com/MavonEngine/Core",
    kind: "fork",
    fit: "patterns",
    pushed: "2026-06-23",
    applyTo: ["multiplayer entity sync", "engine structure", "browser TS game loop"],
    notes: "TS three.js multi/single player engine core.",
  },
  {
    id: "grudgeblox",
    url: "https://github.com/MolochDaGod/grudgeblox",
    upstream: "https://github.com/iErcann/NotBlox",
    kind: "fork",
    fit: "patterns",
    pushed: "2026-07-28",
    applyTo: ["multiplayer physics", "vehicles/cars", "Netcode patterns"],
    notes: "NotBlox-style multiplayer Three.js + physics.",
  },
  {
    id: "GCS",
    url: "https://github.com/MolochDaGod/GCS",
    upstream: "https://github.com/M3-org/CharacterStudio",
    kind: "fork",
    fit: "tooling",
    pushed: "2026-06-30",
    applyTo: ["character wardrobe UI", "VRM/avatar pipeline"],
    notes: "CharacterStudio VRM avatar creator.",
  },
  {
    id: "UniRigGrudge",
    url: "https://github.com/MolochDaGod/UniRigGrudge",
    upstream: "https://github.com/VAST-AI-Research/UniRig",
    kind: "fork",
    fit: "research",
    pushed: "2026-04-22",
    applyTo: ["auto-rig pipelines", "baked anim retarget"],
    notes: "SIGGRAPH UniRig — skeleton rigging AI research.",
  },
  {
    id: "voxel-builder",
    url: "https://github.com/MolochDaGod/voxel-builder",
    upstream: "https://github.com/nimadez/voxel-builder",
    kind: "fork",
    fit: "tooling",
    pushed: "2026-06-22",
    applyTo: ["voxel props", "quick blockout islands"],
    notes: "Voxel modeling app.",
  },
  {
    id: "GRUDAIDE",
    url: "https://github.com/MolochDaGod/GRUDAIDE",
    upstream: "https://github.com/warpdotdev/warp",
    kind: "fork",
    fit: "tooling",
    pushed: "2026-06-17",
    applyTo: ["agentic dev workflow"],
    notes: "Warp agentic IDE fork — tooling, not runtime VFX.",
  },
];

/** First-party owned repos that feed AI / visuals / fleet. */
export const MOLCOH_OWNED_VISUAL_AI: VisualSourceRef[] = [
  {
    id: "grudge-ai-hub",
    url: "https://github.com/MolochDaGod/grudge-ai-hub",
    kind: "owned",
    fit: "tooling",
    pushed: "2026-08-03",
    applyTo: ["live AI endpoints", "agent tooling for content"],
    notes: "GRUDA Legion AI Hub — Cloudflare Worker ai.grudge-studio.com",
  },
  {
    id: "ObjectStore",
    url: "https://github.com/MolochDaGod/ObjectStore",
    kind: "owned",
    fit: "port-soon",
    pushed: "2026-08-05",
    applyTo: ["CDN assets", "icons", "world map HTML", "SDK"],
    notes: "Public game data API + assets (already used by grudge-game ObjectStore base).",
  },
  {
    id: "Flare-Boss-Arena",
    url: "https://github.com/MolochDaGod/Flare-Boss-Arena",
    kind: "owned",
    fit: "port-soon",
    pushed: "2026-08-01",
    applyTo: ["this monorepo target"],
    notes: "Main product; grudge-game lives under artifacts.",
  },
  {
    id: "grudge-arena",
    url: "https://github.com/MolochDaGod/grudge-arena",
    kind: "owned",
    fit: "port-soon",
    pushed: "2026-08-02",
    applyTo: ["baked anims", "race GLBs", "combat VFX parity", "island-village convert"],
    notes: "PvP arena — production anim CDN + smoke tests.",
  },
  {
    id: "The-ENGINE",
    url: "https://github.com/MolochDaGod/The-ENGINE",
    kind: "owned",
    fit: "patterns",
    pushed: "2026-08-03",
    applyTo: ["annihilate combat", "ROLE_HOTKEYS", "grudge6 stack"],
    notes: "Annihilate / ENGINE combat SSOT notes.",
  },
  {
    id: "warlord-genesis",
    url: "https://github.com/MolochDaGod/warlord-genesis",
    kind: "owned",
    fit: "patterns",
    pushed: "2026-08-02",
    applyTo: ["RTS HUD CSS", "warcamp UX", "deploy verify"],
    notes: "Warstrat / genesis monorepo — HUD and auth patterns.",
  },
  {
    id: "threejs-rapier-react-three-controller",
    url: "https://github.com/MolochDaGod/threejs-rapier-react-three-controller",
    kind: "owned",
    fit: "port-soon",
    pushed: "2026-08-05",
    applyTo: ["Rapier + R3F controller experiments"],
    notes: "Very recent controller experiment — compare with grudgecontrol.",
  },
  {
    id: "grudge-ui-editor",
    url: "https://github.com/MolochDaGod/grudge-ui-editor",
    kind: "owned",
    fit: "tooling",
    pushed: "2026-08-02",
    applyTo: ["HUD/editor tooling"],
    notes: "UI editor for Grudge surfaces.",
  },
];

/**
 * Priority order to pull into grudge-game visuals next.
 */
export const VISUAL_UPGRADE_QUEUE = [
  {
    step: 1,
    source: "CastingAbilitiesThreeJS",
    deliverable:
      "Port GPU particle pool + soft depth intersect; upgrade ParticleVfx/CombatVfx fire & water casts",
  },
  {
    step: 2,
    source: "CastingAbilitiesThreeJS",
    deliverable: "Post stack: distortion buffer + grade (chromatic/grain) on bloom composer",
  },
  {
    step: 3,
    source: "grudgecontrol + threejs-rapier-react-three-controller",
    deliverable: "Smoother land camera spring + optional BVH capsule polish (keep iso cam option)",
  },
  {
    step: 4,
    source: "GrudgeShader.lab / Casting water",
    deliverable: "Replace OpenWater sum-of-sines with richer water material when perf allows",
  },
  {
    step: 5,
    source: "AllyGoals + zone density (in-repo) + grudge-ai-hub",
    deliverable: "Telemetry hooks for AI goal debug; optional live agent for content",
  },
] as const;
