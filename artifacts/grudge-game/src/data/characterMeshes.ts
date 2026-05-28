/**
 * Toon-RTS character portrait manifest.
 *
 * Each race GLB at:
 *   https://assets.grudge-studio.com/asset-packs/toon-rts-characters/glb/characters/<race>.glb
 * ships the FULL wardrobe baked into one skeleton:
 *
 *   • bodies     (e.g. WK_Units_Body_A..E)
 *   • heads      (Units_Head_A..N — count varies per race)
 *   • arms       (Units_Arms_A..E)
 *   • legs       (Units_Legs_A..D)
 *   • shoulderpads (Units_Shoulderpads_A..F)
 *   • weapons    (sword/bow/staff/axe/hammer/spear/dagger/mace/pick variants)
 *   • shields    (Shield_A..D)
 *   • xtras      (Xtra_quiver / Xtra_bag / Xtra_wood)
 *
 * ALL meshes are visible by default in the GLB — that's why an unfiltered
 * character looks like a walking armoury (every weapon at once). We therefore
 * compute the SET OF MESHES THAT SHOULD BE VISIBLE for a given race + equip
 * loadout, and the renderer hides everything else.
 *
 * Mesh naming is class-prefixed and not perfectly consistent across races:
 *   • human:     `WK_…`        (Units_Body_A, Units_head_A — mixed case)
 *   • elf:       `ELF_…`       (Units_Body_A, Units_Head_A)
 *   • dwarf:     `DWF_…`       (Units_Body_A, Units_Head_A)
 *   • orc:       `ORC_…`       (Units_Body_A, Units_Head_A)
 *   • undead:    `UD_…`        (Units_body_A, Units_head_A)
 *   • barbarian: `BRB_…`       (no `Units_` infix — just `body_A`, `head_A`)
 *
 * All matching here is case-insensitive and infix-tolerant.
 */

export type RaceId = "human" | "elf" | "dwarf" | "orc" | "undead" | "barbarian";

const ROOT = "https://assets.grudge-studio.com/asset-packs/toon-rts-characters/glb/characters";

/** Canonical URL for the race's portrait GLB. */
export function PORTRAIT_URL(race: RaceId): string {
  return `${ROOT}/${race}.glb`;
}

/** Human-readable mesh prefix per race (documentation only). */
export const RACE_PREFIX: Record<RaceId, string> = {
  human: "WK_", elf: "ELF_", dwarf: "DWF_", orc: "ORC_", undead: "UD_", barbarian: "BRB_",
};

/** Roles a single mesh can play once categorised. */
type Role =
  | "body" | "head" | "arms" | "legs" | "shoulder"
  | "weapon_sword" | "weapon_bow" | "weapon_staff" | "weapon_axe"
  | "weapon_hammer" | "weapon_mace" | "weapon_spear" | "weapon_dagger" | "weapon_pick"
  | "shield" | "quiver" | "bag" | "wood";

/** Categorise one mesh name. Returns `null` for skeleton bones / unknowns. */
function classify(name: string): Role | null {
  const n = name.toLowerCase();
  // Weapons — check before generic body parts so e.g. "shoulderpads" doesn't
  // accidentally swallow a weapon match.
  if (/weapon.*staff/.test(n))  return "weapon_staff";
  if (/weapon.*bow/.test(n))    return "weapon_bow";
  if (/weapon.*sword/.test(n))  return "weapon_sword";
  if (/weapon.*mace/.test(n))   return "weapon_mace";
  if (/weapon.*hammer/.test(n)) return "weapon_hammer";
  if (/weapon.*axe/.test(n))    return "weapon_axe";
  if (/weapon.*spear/.test(n))  return "weapon_spear";
  if (/weapon.*dagger/.test(n)) return "weapon_dagger";
  if (/weapon.*pick/.test(n))   return "weapon_pick";
  // Exclude scene-graph helpers like `L_shield_container` / `R_hand_container`
  // — only true wardrobe shield meshes go in the shield bucket.
  if (/shield/.test(n) && !/container/.test(n)) return "shield";
  if (/xtra.*quiver/.test(n))   return "quiver";
  if (/xtra.*bag/.test(n))      return "bag";
  if (/xtra.*wood/.test(n))     return "wood";
  if (/shoulderpads/.test(n))   return "shoulder";
  // Body parts. Match `body_X`, `Units_Body_X`, etc.  Place AFTER weapons so
  // we don't grab a sub-string like "body" inside an unrelated name.
  if (/(^|_)body(_|$)/.test(n))     return "body";
  if (/(^|_)head(_|$)/.test(n))     return "head";
  if (/(^|_)arms(_|$)/.test(n))     return "arms";
  if (/(^|_)legs(_|$)/.test(n))     return "legs";
  return null;
}

/** Group every mesh in the GLB by role. */
function bucket(meshNames: string[]): Record<Role, string[]> {
  const out = {
    body: [], head: [], arms: [], legs: [], shoulder: [],
    weapon_sword: [], weapon_bow: [], weapon_staff: [], weapon_axe: [],
    weapon_hammer: [], weapon_mace: [], weapon_spear: [], weapon_dagger: [], weapon_pick: [],
    shield: [], quiver: [], bag: [], wood: [],
  } as Record<Role, string[]>;
  for (const name of meshNames) {
    const role = classify(name);
    if (role) out[role].push(name);
  }
  // Stable order so variant picking is deterministic.
  for (const k of Object.keys(out) as Role[]) out[k].sort();
  return out;
}

/**
 * Equip categories (from R2 weapons.json) → priority list of weapon roles.
 *
 * Real R2 keys (24) include `axes1h`, `hammers1h`/`hammers2h`,
 * `greatswords`/`greataxes`, the elemental staff/tome families
 * (`fireStaves`, `frostTomes`, …), `guns`, and `tools`. We map them all
 * here AND `categoryToRoles()` also normalises an unknown key by stripping
 * `1h`/`2h` suffixes and the elemental prefix, so a new category like
 * `shadowStaves` still resolves to a staff mesh.
 */
const WEAPON_ROLE_FOR_CATEGORY: Record<string, Role[]> = {
  // Bladed 1H / 2H
  swords:     ["weapon_sword"],
  greatswords:["weapon_sword"],
  daggers:    ["weapon_dagger"],
  // Axes
  axes:       ["weapon_axe"],
  axes1h:     ["weapon_axe"],
  greataxes:  ["weapon_axe"],
  // Blunts
  hammers:    ["weapon_hammer", "weapon_mace"],
  hammers1h:  ["weapon_hammer", "weapon_mace"],
  hammers2h:  ["weapon_hammer", "weapon_mace"],
  warhammers: ["weapon_hammer", "weapon_mace"],
  maces:      ["weapon_mace", "weapon_hammer"],
  blunts:     ["weapon_mace", "weapon_hammer"],
  clubs:      ["weapon_mace", "weapon_hammer"],
  // Polearms
  spears:     ["weapon_spear"],
  polearms:   ["weapon_spear"],
  // Ranged — no gun/crossbow mesh in toon-rts, fall through to bow.
  bows:       ["weapon_bow"],
  crossbows:  ["weapon_bow"],
  guns:       ["weapon_bow"],
  // Magic — every elemental staff family + tomes render as a staff.
  staves:        ["weapon_staff"],
  staffs:        ["weapon_staff"],
  wands:         ["weapon_staff"],
  arcaneStaves:  ["weapon_staff"],
  fireStaves:    ["weapon_staff"],
  frostStaves:   ["weapon_staff"],
  holyStaves:    ["weapon_staff"],
  lightningStaves: ["weapon_staff"],
  natureStaves:  ["weapon_staff"],
  arcaneTomes:   ["weapon_staff"],
  fireTomes:     ["weapon_staff"],
  frostTomes:    ["weapon_staff"],
  holyTomes:     ["weapon_staff"],
  lightningTomes:["weapon_staff"],
  natureTomes:   ["weapon_staff"],
  // Tools — Mining Pick, Lumber Axe. Pick the right utility mesh.
  picks:      ["weapon_pick"],
  tools:      ["weapon_pick", "weapon_axe"],
};

/**
 * Best-effort resolution of an equip category to weapon-mesh roles. Looks up
 * the exact key first, then falls back to normalised forms:
 *   `fireStaves` → `staves`, `axes1h` → `axes`, `hammers2h` → `hammers`, etc.
 */
function categoryToRoles(category: string): Role[] {
  const raw = category.toLowerCase();
  const exact = WEAPON_ROLE_FOR_CATEGORY[category] ?? WEAPON_ROLE_FOR_CATEGORY[raw];
  if (exact) return exact;
  // Strip 1h/2h size suffix.
  const noSize = raw.replace(/(1h|2h)$/i, "");
  if (WEAPON_ROLE_FOR_CATEGORY[noSize]) return WEAPON_ROLE_FOR_CATEGORY[noSize];
  // Strip elemental prefix (fire/frost/holy/lightning/arcane/nature/shadow…).
  const elemental = noSize.replace(/^(fire|frost|holy|lightning|arcane|nature|shadow|void)/i, "");
  if (elemental && WEAPON_ROLE_FOR_CATEGORY[elemental]) return WEAPON_ROLE_FOR_CATEGORY[elemental];
  return [];
}

export interface PortraitEquip {
  /** Item category for the Mainhand slot (e.g. "swords", "bows"). */
  mainCategory?: string;
  /** Item category for the Offhand slot — used for bow detection. */
  offCategory?: string;
  /** True if anything is equipped in the Offhand slot. */
  hasOffhand?: boolean;
  /** True if the Shoulder armor slot is equipped. */
  hasShoulder?: boolean;
}

/** Cheap, deterministic hash for picking variants by character name. */
function seedHash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/** Pick one variant from a sorted bucket using a seed offset. */
function pick(list: string[], seed: number, offset = 0): string | undefined {
  if (list.length === 0) return undefined;
  return list[(seed + offset) % list.length];
}

/**
 * Given every mesh name in the loaded GLB, the race, the equip loadout, and a
 * stable seed (character name / id), return the set of meshes that should be
 * VISIBLE. Everything else stays hidden.
 *
 * Always shows: one body, one head, one arms, one legs.
 * Conditionally: one shoulderpads (if Shoulder equipped), one shield (if any
 * Offhand equipped), one weapon (if any Mainhand equipped — chosen by item
 * category), and the quiver (if either hand holds a bow/crossbow).
 */
export function resolveVisibleMeshes(
  allMeshNames: string[],
  _race: RaceId,
  equip: PortraitEquip,
  seedStr: string,
): Set<string> {
  const b = bucket(allMeshNames);
  const seed = seedHash(seedStr || "warlord");
  const visible = new Set<string>();

  const add = (name: string | undefined) => { if (name) visible.add(name); };

  // Base avatar — pick one of each, offset by a different multiplier so the
  // same seed doesn't always pick e.g. "A" across the board.
  add(pick(b.body, seed, 0));
  add(pick(b.head, seed, 1));
  add(pick(b.arms, seed, 2));
  add(pick(b.legs, seed, 3));

  if (equip.hasShoulder) add(pick(b.shoulder, seed, 4));

  // Weapon: try every role for the equipped category, in priority order.
  if (equip.mainCategory) {
    const roles = categoryToRoles(equip.mainCategory);
    let chosen: string | undefined;
    for (const r of roles) {
      chosen = pick(b[r], seed, 5);
      if (chosen) break;
    }
    add(chosen);
  }

  // Offhand: any equipped offhand → show a shield (we don't model dual-wield
  // visuals beyond the shield bucket the race ships with).
  if (equip.hasOffhand) add(pick(b.shield, seed, 6));

  // Quiver: visible whenever a bow/crossbow is in either hand.
  const isRanged = (cat?: string) => {
    const c = (cat ?? "").toLowerCase();
    return c === "bows" || c === "crossbows";
  };
  if (isRanged(equip.mainCategory) || isRanged(equip.offCategory)) {
    add(pick(b.quiver, seed, 7));
  }

  return visible;
}

/* ───────────────────────────────────────────────────────────────────────────
 * Backwards-compat shims. The previous KayKit-based portrait shipped a few
 * named exports that other parts of the codebase may still reference. We keep
 * thin no-op shims so a stale import doesn't compile-fail, while the new
 * `PORTRAIT_URL` + `resolveVisibleMeshes` are the real API.
 * ─────────────────────────────────────────────────────────────────────────── */

/** @deprecated use PORTRAIT_URL(race). Kept so older imports still resolve. */
export type KayKitModel = RaceId;
/** @deprecated use PORTRAIT_URL(race). */
export const KAYKIT_URL = PORTRAIT_URL;
/** @deprecated portrait now keys off race, not class. */
export const CLASS_TO_MODEL: Record<string, RaceId> = {};
/** @deprecated portrait now keys off race directly. */
export const RACE_TO_MODEL: Record<RaceId, RaceId> = {
  human: "human", elf: "elf", dwarf: "dwarf", orc: "orc", undead: "undead", barbarian: "barbarian",
};
/** @deprecated replaced by `resolveVisibleMeshes`. */
export function computeHiddenMeshes(): Set<string> { return new Set(); }
