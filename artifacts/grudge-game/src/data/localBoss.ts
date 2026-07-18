/**
 * Client-side boss encounter generator.
 *
 * Production on Vercel ships the static Vite frontend only — POST /api/bosses/generate
 * is not available (405). This module builds a fully playable ArenaBossInput so the
 * boss arena still loads character + monster GLBs and combat works offline.
 */

import type { ArenaBossAbility, ArenaBossInput } from "@/game/ArenaScene";

export interface LocalBossRequest {
  tier: number;
  playerClass?: string;
  playerLevel?: number;
}

const NAME_POOL: Array<{ name: string; title: string; pack: string; flying?: boolean }> = [
  // Imported boss GLBs (dragons + ML in-game bosses)
  { name: "Noble Dragon", title: "Wyrm of the Western Reach", pack: "boss_noble_dragon", flying: true },
  { name: "Tarisland Drake", title: "Sky Terror of the Ruins", pack: "boss_tarisland_dragon", flying: true },
  { name: "Sky Horror", title: "Winged Pit Lord", pack: "cdn_sky_horror", flying: true },
  { name: "Storm Drake", title: "Cloud Scourge", pack: "cdn_storm_drake", flying: true },
  { name: "Cinder Wyrmling", title: "Fireworm of the Depths", pack: "boss_fireworm" },
  { name: "Framis", title: "Dark Necromancer", pack: "boss_framis_necro" },
  { name: "Sora", title: "Shifting Cloud", pack: "boss_sora_cloud", flying: true },
  { name: "Sun Monkey King", title: "Heaven's Challenger", pack: "boss_sun_monkey_king" },
  // Legacy procedural boss names (fallback bodies)
  { name: "Ashen Pincher", title: "Chitin of the Dunes", pack: "Boss_Character_Pincher_Chitin" },
  { name: "Briar Matriarch", title: "Queen of Thorns", pack: "Boss_Character_Thornguard_Medusa" },
  { name: "Dante's Shadow", title: "Beast of the Pit", pack: "Boss_Character_Beast_Hunter" },
  { name: "Grave Acolyte", title: "Cultist of the Last Oath", pack: "Boss_Character_Cult_Undead" },
  { name: "Wrath Colossus", title: "Lord of Endless Grudges", pack: "Boss_Character_Colossus_Titan" },
  { name: "Gloom Stalker", title: "Predator of the Wild", pack: "Boss_Character_Hunter_Beast" },
  { name: "Serpent Witch", title: "Gorgon of the Darkwood", pack: "Boss_Character_Medusa_Serpent" },
  { name: "Bone Priest", title: "Wraith of the Crypt", pack: "Boss_Character_Necro_Lich" },
];

const ABILITY_TEMPLATES: Array<Omit<ArenaBossAbility, "damage" | "cooldown">> = [
  { id: "slam", name: "Crushing Slam", type: "melee", description: "A heavy close-range blow — leave the red circle." },
  { id: "bolt", name: "Hex Bolt", type: "ranged", description: "A dodgeable projectile bolt. Sidestep or Space." },
  { id: "nova", name: "Ruin Nova", type: "aoe", description: "A ground circle detonates after a wind-up." },
  { id: "curse", name: "Grudge Curse", type: "debuff", description: "A purple circle that slows if you stay in it." },
  { id: "arc", name: "Arcane Lance", type: "magic", description: "A homing orb — dodge through at the last second." },
  { id: "sweep", name: "Whirl Sweep", type: "melee", description: "A wide spinning melee arc around the boss." },
  { id: "volley", name: "Grudge Volley", type: "ranged", description: "A fan of dodgeable bolts." },
  { id: "meteor", name: "Skyfall", type: "aoe", description: "Multiple impact circles rain around you." },
];

function clampTier(tier: number): number {
  return Math.max(1, Math.min(5, Math.round(tier) || 1));
}

function pickName(tier: number, salt: number) {
  const idx = (tier * 3 + salt) % NAME_POOL.length;
  return NAME_POOL[idx]!;
}

function buildAbilities(tier: number, level: number): ArenaBossAbility[] {
  // Always ship a full toolkit so phases can mix melee / circle AoE / dodgeable bolts.
  const count = Math.min(ABILITY_TEMPLATES.length, 5 + Math.floor(tier / 2));
  const baseDmg = 16 + tier * 11 + level * 2;
  const out: ArenaBossAbility[] = [];
  for (let i = 0; i < count; i++) {
    const t = ABILITY_TEMPLATES[(tier + i * 2) % ABILITY_TEMPLATES.length]!;
    const typeMul =
      t.type === "aoe" ? 0.9 : t.type === "debuff" ? 0.5 : t.type === "melee" ? 1.05 : 0.95;
    out.push({
      ...t,
      id: `${t.id}_${i}`,
      damage: Math.round(baseDmg * typeMul * (1 + i * 0.06)),
      cooldown: t.type === "aoe" ? 6 + tier * 0.4 : t.type === "melee" ? 2.2 + tier * 0.25 : 3.4 + tier * 0.3,
    });
  }
  return out;
}

/** Build a deterministic-enough local boss for the given tier / player context. */
export function generateLocalBoss(req: LocalBossRequest): ArenaBossInput {
  const tier = clampTier(req.tier);
  const level = Math.max(1, Math.round(req.playerLevel ?? 1));
  const salt = Date.now() % 97;
  const identity = pickName(tier, salt);
  // Always 3 phases so circle telegraphs + dodge patterns fully showcase.
  const phases = 3;
  // Scale HP so a fight lasts longer at higher tiers without requiring the API.
  const maxHp = Math.round(1100 + tier * 1200 + level * 90 + salt * 3);

  const abilities = buildAbilities(tier, level);
  // Flying bosses get a dive + aerial bolt pattern
  if (identity.flying) {
    abilities.unshift({
      id: "sky_dive",
      name: "Sky Dive",
      type: "aoe",
      description: "Boss dives from the air — leave the red circle.",
      damage: Math.round(22 + tier * 14 + level * 2),
      cooldown: 7,
    });
    abilities.push({
      id: "wing_barrage",
      name: "Wing Barrage",
      type: "ranged",
      description: "Aerial projectiles — dodge with Space.",
      damage: Math.round(14 + tier * 8),
      cooldown: 4,
    });
  }

  return {
    id: -(salt + 1), // negative ids mark local/offline encounters
    name: identity.name,
    title: identity.title,
    maxHp: identity.flying ? Math.round(maxHp * 1.08) : maxHp,
    phases,
    tier,
    assetPack: identity.pack,
    abilities,
  };
}
