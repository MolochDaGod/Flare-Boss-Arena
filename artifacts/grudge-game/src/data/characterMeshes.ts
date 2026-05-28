/**
 * KayKit Character Pack — mesh manifest
 *
 * Source GLBs (CDN: https://molochdagod.github.io/ObjectStore/models/characters/kaykit/<Name>.glb):
 *
 *   Knight.glb     (9 meshes)
 *     Knight_Head, Knight_Body, Knight_ArmLeft, Knight_ArmRight,
 *     Knight_LegLeft, Knight_LegRight, Knight_Helmet, Knight_HelmetVisor, Knight_Cape
 *
 *   Mage.glb       (8 meshes)
 *     Mage_Head, Mage_Body, Mage_ArmLeft, Mage_ArmRight,
 *     Mage_LegLeft, Mage_LegRight, Mage_Hat, Mage_Cape
 *
 *   Ranger.glb     (8 meshes)
 *     Ranger_Head, Ranger_Body, Ranger_ArmLeft, Ranger_ArmRight,
 *     Ranger_LegLeft, Ranger_LegRight, Ranger_Cape, Ranger_Quiver
 *
 *   Barbarian.glb  (7 meshes)
 *     Barbarian_Head, Barbarian_Body, Barbarian_ArmLeft, Barbarian_ArmRight,
 *     Barbarian_LegLeft, Barbarian_LegRight, Barbarian_BearHat
 *
 * Mesh prefixes are class-scoped — there are no shared mesh names across models.
 * Only the *optional* meshes (helm/hat, cape, quiver) toggle with equipment.
 * Body/Arms/Legs/Head form the base avatar and are always visible.
 */

export type KayKitModel = "Knight" | "Mage" | "Ranger" | "Barbarian";

export const KAYKIT_BASE =
  "https://molochdagod.github.io/ObjectStore/models/characters/kaykit";

export const KAYKIT_URL = (m: KayKitModel) => `${KAYKIT_BASE}/${m}.glb`;

/** Class → which KayKit model represents them on the portrait. */
export const CLASS_TO_MODEL: Record<string, KayKitModel> = {
  warrior: "Knight",
  mage: "Mage",
  ranger: "Ranger",
  worge: "Barbarian",
};

/** Race fallback when no class match (used by race-picker on the equip tab). */
export const RACE_TO_MODEL: Record<string, KayKitModel> = {
  human: "Knight",
  elf: "Ranger",
  dwarf: "Barbarian",
  orc: "Barbarian",
  undead: "Mage",
  barbarian: "Barbarian",
};

/**
 * Per-model mesh manifest — what mesh names exist and what each represents.
 * Used both for documentation and at runtime for visibility toggling.
 */
export interface MeshInfo {
  name: string;          // exact GLB mesh name
  part: "head" | "body" | "armL" | "armR" | "legL" | "legR" | "helm" | "cape" | "quiver";
  optional: boolean;     // if true, hidden unless a matching slot is equipped
}

export const MODEL_MESHES: Record<KayKitModel, MeshInfo[]> = {
  Knight: [
    { name: "Knight_Head",        part: "head",   optional: false },
    { name: "Knight_Body",        part: "body",   optional: false },
    { name: "Knight_ArmLeft",     part: "armL",   optional: false },
    { name: "Knight_ArmRight",    part: "armR",   optional: false },
    { name: "Knight_LegLeft",     part: "legL",   optional: false },
    { name: "Knight_LegRight",    part: "legR",   optional: false },
    { name: "Knight_Helmet",      part: "helm",   optional: true  },
    { name: "Knight_HelmetVisor", part: "helm",   optional: true  },
    { name: "Knight_Cape",        part: "cape",   optional: true  },
  ],
  Mage: [
    { name: "Mage_Head",     part: "head",   optional: false },
    { name: "Mage_Body",     part: "body",   optional: false },
    { name: "Mage_ArmLeft",  part: "armL",   optional: false },
    { name: "Mage_ArmRight", part: "armR",   optional: false },
    { name: "Mage_LegLeft",  part: "legL",   optional: false },
    { name: "Mage_LegRight", part: "legR",   optional: false },
    { name: "Mage_Hat",      part: "helm",   optional: true  },
    { name: "Mage_Cape",     part: "cape",   optional: true  },
  ],
  Ranger: [
    { name: "Ranger_Head",     part: "head",   optional: false },
    { name: "Ranger_Body",     part: "body",   optional: false },
    { name: "Ranger_ArmLeft",  part: "armL",   optional: false },
    { name: "Ranger_ArmRight", part: "armR",   optional: false },
    { name: "Ranger_LegLeft",  part: "legL",   optional: false },
    { name: "Ranger_LegRight", part: "legR",   optional: false },
    { name: "Ranger_Cape",     part: "cape",   optional: true  },
    { name: "Ranger_Quiver",   part: "quiver", optional: true  },
  ],
  Barbarian: [
    { name: "Barbarian_Head",     part: "head", optional: false },
    { name: "Barbarian_Body",     part: "body", optional: false },
    { name: "Barbarian_ArmLeft",  part: "armL", optional: false },
    { name: "Barbarian_ArmRight", part: "armR", optional: false },
    { name: "Barbarian_LegLeft",  part: "legL", optional: false },
    { name: "Barbarian_LegRight", part: "legR", optional: false },
    { name: "Barbarian_BearHat",  part: "helm", optional: true  },
  ],
};

/**
 * Given a model and the current equipment slot state, compute the set of
 * mesh names that should be HIDDEN. Optional meshes (helm/cape/quiver) are
 * hidden by default and only shown when the corresponding slot is filled.
 *
 * `equippedSlots` is the set of MainPanel slot names that have an item.
 * Recognised slots: "Helm", "Relic", "Mainhand", "Offhand".
 *  - Helm  → shows the model's helm/hat mesh(es)
 *  - Relic → shows the cape mesh (Knight/Mage/Ranger)
 *  - A ranged Mainhand/Offhand on Ranger shows the quiver
 */
export function computeHiddenMeshes(
  model: KayKitModel,
  equippedSlots: Set<string>,
  hasRanged: boolean,
): Set<string> {
  const hidden = new Set<string>();
  for (const m of MODEL_MESHES[model]) {
    if (!m.optional) continue;
    let show = false;
    if (m.part === "helm" && equippedSlots.has("Helm")) show = true;
    if (m.part === "cape" && equippedSlots.has("Relic")) show = true;
    if (m.part === "quiver" && hasRanged) show = true;
    if (!show) hidden.add(m.name);
  }
  return hidden;
}
