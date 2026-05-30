/**
 * Best-version class skills for the four playable classes
 * (warrior / mage / ranger / worge).
 *
 * These are CLIENT-AUTHORED definitions distilled from the legacy combat
 * class definitions. Each class exposes its core combat abilities plus a single
 * signature ability (flagged with `isSignature`). Skills are virtual — there are
 * no master icon assets, so each carries an emoji `glyph` for rendering.
 *
 * The shape here is intentionally framework-free so it can be consumed by the
 * Grimoire (skills page), the Armory (equipment cards), the MainPanel SkillsTab
 * and the in-game HUD skill bar via `skillsResolver`.
 */

export type ClassSkillType =
  | "physical"
  | "magical"
  | "buff"
  | "heal"
  | "heal_over_time"
  | "summon"
  | "focus";

export interface ClassSkill {
  id: string;
  name: string;
  description: string;
  /** Emoji glyph used for rendering (fallback when no icon asset resolves). */
  glyph: string;
  /**
   * Public-relative path to a real skill icon (under `public/`), e.g.
   * `icons/skilltree/FireMage_Free/FireMage_28.png`. Resolve to a usable
   * `src` via `skillIconSrc()` (prepends `import.meta.env.BASE_URL`).
   */
  icon?: string;
  type: ClassSkillType;
  /** Damage multiplier (relative to base attack), when applicable. */
  damage?: number;
  manaCost?: number;
  staminaCost?: number;
  /** Cooldown in combat turns. */
  cooldown?: number;
  target: "enemy" | "self";
  /** Human-readable effect tags. */
  effects?: string[];
  /** True for the class's signature/ultimate ability. */
  isSignature?: boolean;
}

export interface ClassSkillSet {
  id: string;
  name: string;
  color: string;
  description: string;
  skills: ClassSkill[];
}

const WARRIOR: ClassSkillSet = {
  id: "warrior",
  name: "Warrior",
  color: "#ef4444",
  description: "A fearless frontline fighter specializing in raw power and defense.",
  skills: [
    {
      id: "slash",
      name: "Slash",
      description: "A steady sword strike that restores stamina and mana.",
      glyph: "⚔",
      type: "physical",
      damage: 0.9,
      cooldown: 0,
      target: "enemy",
      effects: ["+5 Mana", "+8 Stamina"],
    },
    {
      id: "power_strike",
      name: "Power Strike",
      description: "A devastating blow dealing 2x damage.",
      glyph: "💥",
      type: "physical",
      damage: 2.0,
      staminaCost: 25,
      cooldown: 2,
      target: "enemy",
      effects: ["2x Damage"],
    },
    {
      id: "war_cry",
      name: "War Cry",
      description: "Boost your damage by 30% for 3 turns.",
      glyph: "📢",
      type: "buff",
      staminaCost: 30,
      cooldown: 5,
      target: "self",
      effects: ["+30% Damage", "3 turns"],
    },
    {
      id: "shield_bash",
      name: "Shield Bash",
      description: "Slam your shield to stun the enemy for 1 turn.",
      glyph: "🛡",
      type: "physical",
      damage: 0.8,
      staminaCost: 20,
      cooldown: 4,
      target: "enemy",
      effects: ["Stun 1 turn"],
    },
    {
      id: "cleave",
      name: "Cleave",
      description: "Slash deep, hitting all enemies and causing bleed for 3 turns.",
      glyph: "🪓",
      type: "physical",
      damage: 1.5,
      staminaCost: 22,
      cooldown: 3,
      target: "enemy",
      effects: ["AoE", "Bleed 3 turns"],
    },
    {
      id: "demon_blade",
      name: "Demon Blade",
      description: "Transform into a Demon Swordsman for 3 turns: +40% damage, +15 defense.",
      glyph: "🗡",
      type: "buff",
      staminaCost: 40,
      cooldown: 8,
      target: "self",
      effects: ["+40% Damage", "+15 Defense", "3 turns"],
    },
    {
      id: "invincible",
      name: "Invincible",
      description: "Become invulnerable for 2 turns, absorbing all damage.",
      glyph: "✨",
      type: "buff",
      staminaCost: 35,
      cooldown: 8,
      target: "self",
      effects: ["Immune 2 turns"],
      isSignature: true,
    },
  ],
};

const MAGE: ClassSkillSet = {
  id: "mage",
  name: "Mage Priest",
  color: "#8b5cf6",
  description: "Master of arcane magic and divine healing arts.",
  skills: [
    {
      id: "arcane_bolt",
      name: "Arcane Bolt",
      description: "A focused arcane pulse that restores mana and stamina.",
      glyph: "✦",
      type: "magical",
      damage: 1.0,
      cooldown: 0,
      target: "enemy",
      effects: ["+8 Mana", "+5 Stamina"],
    },
    {
      id: "fireball",
      name: "Fireball",
      description: "Hurls fire dealing massive damage plus a burn.",
      glyph: "🔥",
      type: "magical",
      damage: 2.5,
      manaCost: 35,
      cooldown: 3,
      target: "enemy",
      effects: ["Burn 2 turns"],
    },
    {
      id: "heal",
      name: "Divine Heal",
      description: "Restore 30% of max HP.",
      glyph: "❤",
      type: "heal",
      manaCost: 40,
      cooldown: 4,
      target: "self",
      effects: ["Heal 30% HP"],
    },
    {
      id: "ice_storm",
      name: "Ice Storm",
      description: "Freezes all enemies, reducing their damage.",
      glyph: "❄",
      type: "magical",
      damage: 1.8,
      manaCost: 30,
      cooldown: 3,
      target: "enemy",
      effects: ["AoE", "-40% Enemy Damage"],
    },
    {
      id: "mana_shield",
      name: "Mana Shield",
      description: "Convert mana into a protective barrier (+25 defense, 3 turns).",
      glyph: "🔰",
      type: "buff",
      manaCost: 50,
      cooldown: 5,
      target: "self",
      effects: ["+25 Defense", "3 turns"],
      isSignature: true,
    },
  ],
};

const RANGER: ClassSkillSet = {
  id: "ranger",
  name: "Ranger",
  color: "#22c55e",
  description: "A deadly marksman with precise long-range attacks.",
  skills: [
    {
      id: "quick_shot",
      name: "Quick Shot",
      description: "A swift arrow that restores stamina and mana.",
      glyph: "🏹",
      type: "physical",
      damage: 0.8,
      cooldown: 0,
      target: "enemy",
      effects: ["+4 Mana", "+7 Stamina"],
    },
    {
      id: "aimed_shot",
      name: "Aimed Shot",
      description: "A carefully aimed shot that always crits.",
      glyph: "🎯",
      type: "physical",
      damage: 2.0,
      staminaCost: 20,
      cooldown: 2,
      target: "enemy",
      effects: ["Guaranteed Crit"],
    },
    {
      id: "poison_arrow",
      name: "Poison Arrow",
      description: "Poisons the enemy for heavy damage over time.",
      glyph: "☠",
      type: "physical",
      damage: 0.7,
      staminaCost: 15,
      cooldown: 3,
      target: "enemy",
      effects: ["Poison 3 turns"],
    },
    {
      id: "evasive_maneuver",
      name: "Evasive Roll",
      description: "Increase evasion by 50% for 2 turns.",
      glyph: "💨",
      type: "buff",
      staminaCost: 15,
      cooldown: 4,
      target: "self",
      effects: ["+50% Evasion", "2 turns"],
    },
    {
      id: "volley",
      name: "Arrow Volley",
      description: "Rain arrows on all enemies for heavy damage.",
      glyph: "🌧",
      type: "physical",
      damage: 2.4,
      staminaCost: 28,
      cooldown: 4,
      target: "enemy",
      effects: ["AoE"],
    },
    {
      id: "focus",
      name: "Focus",
      description: "Stacking +10% crit per turn (max 5). Active: double stacks and guarantee next crit.",
      glyph: "🔭",
      type: "focus",
      staminaCost: 15,
      cooldown: 4,
      target: "self",
      effects: ["+10% Crit / turn", "Crit Burst"],
      isSignature: true,
    },
  ],
};

const WORGE: ClassSkillSet = {
  id: "worge",
  name: "Worge",
  color: "#d97706",
  description: "A shapeshifter wielding nature and storm magic, then transforming into a beast.",
  skills: [
    {
      id: "mace_strike",
      name: "Mace Strike",
      description: "A storm-charged mace blow that restores resources.",
      glyph: "🔨",
      type: "physical",
      damage: 1.0,
      cooldown: 0,
      target: "enemy",
      effects: ["+6 Mana", "+6 Stamina"],
    },
    {
      id: "lightning_lash",
      name: "Lightning Lash",
      description: "Call down a bolt of lightning on the target.",
      glyph: "⚡",
      type: "magical",
      damage: 1.8,
      manaCost: 25,
      cooldown: 2,
      target: "enemy",
      effects: ["Shock 2 turns"],
    },
    {
      id: "natures_grasp",
      name: "Nature's Grasp",
      description: "Vines heal you over 3 turns.",
      glyph: "🌿",
      type: "heal_over_time",
      manaCost: 20,
      cooldown: 4,
      target: "self",
      effects: ["Heal over 3 turns"],
    },
    {
      id: "dagger_toss",
      name: "Dagger Toss",
      description: "Hurl an envenomed dagger, poisoning for 3 turns.",
      glyph: "🔪",
      type: "physical",
      damage: 0.9,
      staminaCost: 15,
      cooldown: 3,
      target: "enemy",
      effects: ["Poison 3 turns"],
    },
    {
      id: "summon_heal_totem",
      name: "Heal Totem",
      description: "Summon a totem that heals allies when you act.",
      glyph: "🪵",
      type: "summon",
      manaCost: 30,
      cooldown: 6,
      target: "self",
      effects: ["Summon", "AoE Heal"],
    },
    {
      id: "summon_fire_totem",
      name: "Fire Totem",
      description: "Summon a totem that attacks enemies when you act.",
      glyph: "🗿",
      type: "summon",
      manaCost: 25,
      staminaCost: 10,
      cooldown: 6,
      target: "self",
      effects: ["Summon", "Fire Damage"],
    },
    {
      id: "bear_form",
      name: "Worge Transform",
      description: "Transform into a ferocious beast: +25% damage, +10 defense. Use again to revert.",
      glyph: "🐺",
      type: "buff",
      staminaCost: 20,
      cooldown: 0,
      target: "self",
      effects: ["+25% Damage", "+10 Defense", "Toggle"],
      isSignature: true,
    },
  ],
};

export const CLASS_SKILLS: Record<string, ClassSkillSet> = {
  warrior: WARRIOR,
  mage: MAGE,
  ranger: RANGER,
  worge: WORGE,
};

/**
 * Real skill-icon assignments (CraftPix skill-tree pack, served from
 * `public/icons/skilltree/`). Keyed by skill id; thematically matched to each
 * ability. Baked onto the skill objects once at module load so every consumer
 * (Grimoire, Armory, MainPanel, in-game/camp/boss HUDs) renders the same art.
 */
const ICON_BASE = "icons/skilltree";
const SKILL_ICONS: Record<string, string> = {
  // Warrior
  slash: `${ICON_BASE}/FireMage_Free/FireMage_2.png`,
  power_strike: `${ICON_BASE}/FireMage_Free/FireMage_26.png`,
  war_cry: `${ICON_BASE}/EarthMage_Free/EarthMage_31.png`,
  shield_bash: `${ICON_BASE}/EarthMage_Free/EarthMage_4.png`,
  cleave: `${ICON_BASE}/FireMage_Free/FireMage_17.png`,
  demon_blade: `${ICON_BASE}/Necromancer_Free/Necromancer_16.png`,
  invincible: `${ICON_BASE}/EarthMage_Free/EarthMage_25.png`,
  // Mage
  arcane_bolt: `${ICON_BASE}/FrostMage_Free/FrostMage_14.png`,
  fireball: `${ICON_BASE}/FireMage_Free/FireMage_28.png`,
  heal: `${ICON_BASE}/FireMage_Free/FireMage_13.png`,
  ice_storm: `${ICON_BASE}/FrostMage_Free/FrostMage_8.png`,
  mana_shield: `${ICON_BASE}/FrostMage_Free/FrostMage_21.png`,
  // Ranger
  quick_shot: `${ICON_BASE}/Hunter_Free/Hunter_4.png`,
  aimed_shot: `${ICON_BASE}/Hunter_Free/Hunter_24.png`,
  poison_arrow: `${ICON_BASE}/Hunter_Free/Hunter_25.png`,
  evasive_maneuver: `${ICON_BASE}/Hunter_Free/Hunter_6.png`,
  volley: `${ICON_BASE}/Hunter_Free/Hunter_22.png`,
  focus: `${ICON_BASE}/Hunter_Free/Hunter_1.png`,
  // Worge
  mace_strike: `${ICON_BASE}/EarthMage_Free/EarthMage_13.png`,
  lightning_lash: `${ICON_BASE}/FireMage_Free/FireMage_25.png`,
  natures_grasp: `${ICON_BASE}/EarthMage_Free/EarthMage_10.png`,
  dagger_toss: `${ICON_BASE}/Hunter_Free/Hunter_14.png`,
  summon_heal_totem: `${ICON_BASE}/FireMage_Free/FireMage_22.png`,
  summon_fire_totem: `${ICON_BASE}/FireMage_Free/FireMage_35.png`,
  bear_form: `${ICON_BASE}/EarthMage_Free/EarthMage_20.png`,
};

for (const set of Object.values(CLASS_SKILLS)) {
  for (const skill of set.skills) {
    if (SKILL_ICONS[skill.id]) skill.icon = SKILL_ICONS[skill.id];
  }
}

/** Aliases so the legacy display name ("Mage Priest") and similar resolve. */
const CLASS_ALIASES: Record<string, string> = {
  warrior: "warrior",
  "mage priest": "mage",
  mage: "mage",
  priest: "mage",
  ranger: "ranger",
  hunter: "ranger",
  worge: "worge",
  druid: "worge",
};

export function getClassSkills(charClass: string | undefined | null): ClassSkillSet | null {
  if (!charClass) return null;
  const key = charClass.trim().toLowerCase();
  const resolved = CLASS_ALIASES[key] ?? key;
  return CLASS_SKILLS[resolved] ?? null;
}
