/**
 * Toon-RTS / grudge6 modular wardrobe (Polygon Blacksmith publisher 17894).
 *
 * Production race kit (STONE ★ PLAY):
 *   https://assets.grudge-studio.com/asset-packs/toon-rts-characters/glb/characters/{raceId}.glb
 * Author FBX (Desktop grudgeproduction/Toon_RTS):
 *   WK_/BRB_/ELF_/DWF_/ORC_/UD_ Characters_customizable.FBX
 *
 * Each kit ships the FULL wardrobe on one Bip001 skeleton:
 *   • bodies / heads / arms / legs / shoulderpads (letter variants A…)
 *   • weapons: sword, bow, staff, axe, hammer, spear, dagger, pick (NO "weapon_" prefix on author)
 *   • shields · bag · wood · quiver (when present)
 *
 * Author names (meta SSOT) — examples:
 *   WK_Units_Body_A · WK_Units_sword_A · WK_Units_Bow · WK_Units_shield_A
 *   ELF_Sword_A · ELF_Bow · ELF_Units_Head_A
 *   BRB_body_A · BRB_sword_A (no Units_ infix)
 *
 * ALL meshes are visible by default — unfiltered kit = walking armoury.
 * resolveVisibleMeshes() = one body/head/arms/legs + class weapon/shield only.
 */

export type RaceId = "human" | "elf" | "dwarf" | "orc" | "undead" | "barbarian";

const TOON_RTS_CDN =
  "https://assets.grudge-studio.com/asset-packs/toon-rts-characters/glb/characters";

/** Canonical URL for the race's production kit GLB (Toon RTS ★ — keep in sync with grudge6Assets.raceGlbUrl). */
export function PORTRAIT_URL(race: RaceId): string {
  return `${TOON_RTS_CDN}/${race}.glb`;
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

/**
 * Categorise one mesh name. Returns `null` for skeleton bones / unknowns.
 *
 * Polygon Blacksmith Toon RTS does **not** use a `weapon_` prefix on kit parts
 * (author: `WK_Units_sword_A`, `ELF_Bow`). Older bakes may still use `weapon_*`.
 */
function classify(name: string): Role | null {
  const n = name.toLowerCase();
  if (/container|auxscene|forgescene|armature/.test(n)) return null;

  // Extras before body (bag/wood names are simple)
  if (/quiver/.test(n)) return "quiver";
  if (/(^|_)bag($|_)|xtra.*bag|units_bag/.test(n)) return "bag";
  if (/(^|_)wood($|_)|xtra.*wood|units_wood/.test(n)) return "wood";
  if (/shoulderpads|shoulder_pad/.test(n)) return "shoulder";

  // Shields — wardrobe only (not L_shield_container)
  if (/shield/.test(n) && !/container/.test(n)) return "shield";

  // Weapons — author + optional weapon_ prefix
  // Order: staff before "sword" false positives; pick before generic "axe" tools ok
  if (/staff|weapon_staff/.test(n)) return "weapon_staff";
  if (/\bbow\b|_bow($|_)|weapon_bow|crossbow/.test(n)) return "weapon_bow";
  if (/dagger|weapon_dagger/.test(n)) return "weapon_dagger";
  if (/spear|weapon_spear|lance/.test(n)) return "weapon_spear";
  if (/hammer|weapon_hammer/.test(n)) return "weapon_hammer";
  if (/mace|weapon_mace|club/.test(n)) return "weapon_mace";
  if (/\bpick\b|_pick($|_)|weapon_pick|mining/.test(n)) return "weapon_pick";
  if (/\baxe\b|_axe($|_)|weapon_axe|greataxe/.test(n)) return "weapon_axe";
  if (/sword|weapon_sword|blade/.test(n)) return "weapon_sword";

  // Body parts — `body_X`, `Units_Body_X`, `BRB_body_A`
  if (/(^|_)body(_|$)/.test(n)) return "body";
  if (/(^|_)head(_|$)/.test(n)) return "head";
  if (/(^|_)arms(_|$)/.test(n)) return "arms";
  if (/(^|_)legs(_|$)/.test(n)) return "legs";
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
  /** Item category for the Offhand slot — used for bow detection / dual-wield. */
  offCategory?: string;
  /** True if anything is equipped in the Offhand slot. */
  hasOffhand?: boolean;
  /**
   * When true (default if hasOffhand), show a shield mesh.
   * When false with hasOffhand + offCategory, show a second weapon (e.g. dagger).
   */
  offhandIsShield?: boolean;
  /** True if the Shoulder armor slot is equipped. */
  hasShoulder?: boolean;
  /** Optional armor variant seed offset for body/arms/legs picks. */
  armorSeed?: number;
  /**
   * Prefer mesh letter from Warlords T0 / author kit (Body_A plate, B leather, C cloth).
   * Matches Toon RTS suffix `_A` … `_N` on Units_Body / head / arms / legs.
   */
  bodyLetter?: string;
  armsLetter?: string;
  legsLetter?: string;
  headLetter?: string | null;
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

/** Prefer author letter suffix (`_A`, `_B`…) then fall back to seed pick. */
function pickLetter(
  list: string[],
  letter: string | null | undefined,
  seed: number,
  offset = 0,
): string | undefined {
  if (list.length === 0) return undefined;
  if (letter) {
    const L = letter.toUpperCase();
    const hit = list.find((n) => {
      const m = n.match(/_([A-Za-z])$/);
      return m != null && m[1]!.toUpperCase() === L;
    });
    if (hit) return hit;
  }
  return pick(list, seed, offset);
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
  const seed = seedHash(seedStr || "warlord") + (equip.armorSeed ?? 0);
  const visible = new Set<string>();

  const add = (name: string | undefined) => { if (name) visible.add(name); };

  // Base avatar — Warlords armor letters when set (plate A / leather B / cloth C)
  add(pickLetter(b.body, equip.bodyLetter, seed, 0));
  add(pickLetter(b.head, equip.headLetter ?? equip.bodyLetter, seed, 1));
  add(pickLetter(b.arms, equip.armsLetter, seed, 2));
  add(pickLetter(b.legs, equip.legsLetter, seed, 3));

  if (equip.hasShoulder) add(pick(b.shoulder, seed, 4));

  /** First mesh hit across weapon roles; falls through categories when race kit lacks that weapon. */
  const pickWeapon = (category: string | undefined, seedOff: number): string | undefined => {
    if (!category) return undefined;
    const roles = categoryToRoles(category);
    // Universal fallbacks so every Warlords class always holds *something*
    const fallback: Role[] = [
      "weapon_sword",
      "weapon_axe",
      "weapon_hammer",
      "weapon_mace",
      "weapon_staff",
      "weapon_spear",
      "weapon_bow",
      "weapon_dagger",
      "weapon_pick",
    ];
    const order = [...roles, ...fallback.filter((r) => !roles.includes(r))];
    for (const r of order) {
      const hit = pick(b[r], seed, seedOff);
      if (hit) return hit;
    }
    return undefined;
  };

  // Weapon: try every role for the equipped category, in priority order.
  if (equip.mainCategory) {
    add(pickWeapon(equip.mainCategory, 5));
  }

  // Offhand: shield OR dual-wield second weapon (sword + dagger practice).
  if (equip.hasOffhand) {
    const wantShield = equip.offhandIsShield !== false && !equip.offCategory;
    if (wantShield || equip.offhandIsShield === true) {
      add(pick(b.shield, seed, 6));
    } else if (equip.offCategory) {
      let off = pickWeapon(equip.offCategory, 7);
      // Prefer a different mesh than mainhand if both are swords/daggers.
      if (off && equip.mainCategory) {
        const main = pickWeapon(equip.mainCategory, 5);
        if (main && off === main) {
          off = pickWeapon(equip.offCategory, 8) ?? off;
        }
      }
      add(off);
    } else {
      add(pick(b.shield, seed, 6));
    }
  }

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
