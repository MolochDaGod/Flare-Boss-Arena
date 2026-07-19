/**
 * Hotkey VFX catalog — synced with https://vfxgrudge.puter.site/
 * (Fantasy VFX Sandbox builtin + grudgeDot playground effects).
 *
 * Maps combat skill bar keys → sandbox effect ids → GLB kind used by SkillVfx.
 * Weapon skills in-game resolve through `vfxForSkillSlot` / `vfxForHotkey`.
 */

import type { SkillElement } from "../game/combat/particles";
import type { SkillShapeKind } from "../game/combat/skillArchetypes";

/** Sandbox effect ids (from vfxgrudge.puter.site catalog). */
export type SandboxVfxId =
  | "chain_lightning"
  | "inferno"
  | "fire_aura"
  | "arcane_swirl"
  | "ice_lightning_burst"
  | "getsuga_slash"
  | "fireball"
  | "moon_beam"
  | "frost_wave"
  | "fire_wisps"
  | "fire_hand"
  | "holy_hands"
  | "arcane_hands"
  | "poison_cloud";

/** GLB kinds staged under models/vfx/ (runs/dist + legacy). */
export type CombatVfxKind =
  | "tornado"
  | "cloud"
  | "fireball"
  | "lightning"
  | "explosion"
  | "slash"
  | "light_slash"
  | "energy_beam"
  | "laser_beam"
  | "light_beam"
  | "spell_glyph"
  | "chaos_glyph"
  | "explosive_orb"
  | "muzzle"
  | "ring_red"
  | "ring_green"
  | "aoe_warning"
  | "crystals"
  | "strawberry_strike"
  | "yellow_light"
  | "location";

export interface VfxHotkeyBinding {
  /** KeyboardEvent.code e.g. Digit1, KeyQ */
  code: string;
  /** HUD label */
  key: string;
  /** Skill bar slot index (0-based) */
  slot: number;
  sandboxId: SandboxVfxId;
  name: string;
  category: string;
  description: string;
  /** Preferred GLB spawn kind */
  glb: CombatVfxKind;
  element: SkillElement;
  tags: string[];
}

/**
 * Full hotkey bar — Digit1–0 + Q/E/R/F style combat binds used across
 * dungeon / camp / boss / PvP arenas.
 */
export const VFX_HOTKEYS: VfxHotkeyBinding[] = [
  {
    code: "Digit1",
    key: "1",
    slot: 0,
    sandboxId: "fireball",
    name: "Fireball",
    category: "fire",
    description: "A blazing projectile that streaks toward the target.",
    glb: "fireball",
    element: "fire",
    tags: ["fire", "projectile", "ranged", "spell"],
  },
  {
    code: "Digit2",
    key: "2",
    slot: 1,
    sandboxId: "getsuga_slash",
    name: "Getsuga Slash",
    category: "slash",
    description: "A crescent slash wave that travels toward the enemy.",
    glb: "slash",
    element: "physical",
    tags: ["slash", "melee", "wave"],
  },
  {
    code: "Digit3",
    key: "3",
    slot: 2,
    sandboxId: "chain_lightning",
    name: "Chain Lightning",
    category: "lightning",
    description: "Branching bolts of electric fury.",
    glb: "lightning",
    element: "lightning",
    tags: ["lightning", "chain", "aoe"],
  },
  {
    code: "Digit4",
    key: "4",
    slot: 3,
    sandboxId: "moon_beam",
    name: "Moon Beam",
    category: "light",
    description: "A radiant pillar of moonlight crashing down from above.",
    glb: "light_beam",
    element: "arcane",
    tags: ["light", "beam", "aoe", "spell"],
  },
  {
    code: "Digit5",
    key: "5",
    slot: 4,
    sandboxId: "frost_wave",
    name: "Frost Wave",
    category: "ice",
    description: "An expanding ring of frost spikes erupting from the ground.",
    glb: "ring_green",
    element: "ice",
    tags: ["ice", "wave", "aoe", "ground"],
  },
  {
    code: "Digit6",
    key: "6",
    slot: 5,
    sandboxId: "poison_cloud",
    name: "Poison Cloud",
    category: "poison",
    description: "A lingering cloud of toxic green vapor.",
    glb: "cloud",
    element: "poison",
    tags: ["poison", "cloud", "aoe", "dot"],
  },
  {
    code: "Digit7",
    key: "7",
    slot: 6,
    sandboxId: "inferno",
    name: "Inferno",
    category: "fire",
    description: "A roaring pillar of flame consuming the area.",
    glb: "tornado",
    element: "fire",
    tags: ["fire", "aoe", "spell"],
  },
  {
    code: "Digit8",
    key: "8",
    slot: 7,
    sandboxId: "ice_lightning_burst",
    name: "Ice / Lightning Burst",
    category: "ice",
    description: "A shattering burst of icy shards crackling with energy.",
    glb: "explosion",
    element: "ice",
    tags: ["ice", "lightning", "burst", "impact"],
  },
  {
    code: "Digit9",
    key: "9",
    slot: 8,
    sandboxId: "arcane_swirl",
    name: "Arcane Swirl",
    category: "arcane",
    description: "Ribbons of arcane energy spiral overhead into a turret.",
    glb: "spell_glyph",
    element: "arcane",
    tags: ["arcane", "swirl", "turret", "ranged"],
  },
  {
    code: "Digit0",
    key: "0",
    slot: 9,
    sandboxId: "fire_aura",
    name: "Fire Aura",
    category: "fire",
    description: "A roiling column of flame that wreaths the caster.",
    glb: "ring_red",
    element: "fire",
    tags: ["fire", "aura", "buff", "self"],
  },
  {
    code: "KeyQ",
    key: "Q",
    slot: 0,
    sandboxId: "fire_wisps",
    name: "Fire Wisps",
    category: "fire",
    description: "Three small fire wisps orbit then streak out to seek foes.",
    glb: "yellow_light",
    element: "fire",
    tags: ["fire", "wisp", "seeker", "homing", "spell"],
  },
  {
    code: "KeyE",
    key: "E",
    slot: 1,
    sandboxId: "fire_hand",
    name: "Fire Hand",
    category: "fire",
    description: "Flame wreathes the caster's hand in a gauntlet of fire.",
    glb: "muzzle",
    element: "fire",
    tags: ["fire", "hand", "self", "buff"],
  },
  {
    code: "KeyR",
    key: "R",
    slot: 4,
    sandboxId: "getsuga_slash",
    name: "Getsuga Slash (R)",
    category: "slash",
    description: "Ultimate crescent slash — fighter special R.",
    glb: "light_slash",
    element: "physical",
    tags: ["slash", "ultimate", "wave"],
  },
  {
    code: "KeyF",
    key: "F",
    slot: 2,
    sandboxId: "holy_hands",
    name: "Holy Hands",
    category: "light",
    description: "Radiant divine light gathers around the caster's hands.",
    glb: "crystals",
    element: "arcane",
    tags: ["holy", "light", "hand", "self", "buff"],
  },
  {
    code: "KeyZ",
    key: "Z",
    slot: 3,
    sandboxId: "arcane_hands",
    name: "Arcane Hands",
    category: "arcane",
    description: "Spiraling arcane energy coils tightly around the hands.",
    glb: "chaos_glyph",
    element: "arcane",
    tags: ["arcane", "hand", "self", "buff"],
  },
  {
    code: "KeyX",
    key: "X",
    slot: 5,
    sandboxId: "chain_lightning",
    name: "Chain Lightning (X)",
    category: "lightning",
    description: "Weapon skill alternate lightning proc.",
    glb: "energy_beam",
    element: "lightning",
    tags: ["lightning", "weapon"],
  },
  {
    code: "KeyC",
    key: "C",
    slot: 6,
    sandboxId: "moon_beam",
    name: "Moon Beam (C)",
    category: "light",
    description: "Weapon skill light pillar.",
    glb: "laser_beam",
    element: "arcane",
    tags: ["light", "weapon"],
  },
  {
    code: "KeyV",
    key: "V",
    slot: 7,
    sandboxId: "poison_cloud",
    name: "Poison Cloud (V)",
    category: "poison",
    description: "Weapon skill toxin cloud.",
    glb: "cloud",
    element: "poison",
    tags: ["poison", "weapon"],
  },
];

const BY_CODE = new Map(VFX_HOTKEYS.map((b) => [b.code, b]));
const BY_SLOT = new Map<number, VfxHotkeyBinding>();
for (const b of VFX_HOTKEYS) {
  if (!BY_SLOT.has(b.slot) || b.code.startsWith("Digit")) BY_SLOT.set(b.slot, b);
}

export function vfxForHotkey(code: string): VfxHotkeyBinding | undefined {
  return BY_CODE.get(code);
}

/** Resolve VFX for a skill bar slot (0–9). */
export function vfxForSkillSlot(slot: number): VfxHotkeyBinding {
  return (
    BY_SLOT.get(slot) ??
    VFX_HOTKEYS[slot % VFX_HOTKEYS.length]!
  );
}

/** Match sandbox VFX from skill element + shape (weapon skills without slot). */
export function vfxForArchetype(
  element: SkillElement,
  shape: SkillShapeKind,
  slot = 0,
): VfxHotkeyBinding {
  if (shape === "line" || shape === "cone") {
    if (element === "lightning") return vfxForSkillSlot(2);
    if (element === "fire") return vfxForSkillSlot(0);
    return vfxForSkillSlot(1); // slash
  }
  if (shape === "nova" || shape === "circle") {
    if (element === "ice") return vfxForSkillSlot(4);
    if (element === "poison") return vfxForSkillSlot(5);
    if (element === "fire") return vfxForSkillSlot(6);
    return vfxForSkillSlot(3);
  }
  if (shape === "deployable") return vfxForSkillSlot(9);
  return vfxForSkillSlot(slot);
}

/** Public list for HUD tooltips / admin boards. */
export function listVfxHotkeys(): VfxHotkeyBinding[] {
  return VFX_HOTKEYS.slice();
}
