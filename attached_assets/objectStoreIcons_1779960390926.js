/**
 * ObjectStore Icon Resolver
 * Centralised URL builders for every icon type served from the
 * Grudge Studio ObjectStore CDN (GitHub Pages).
 *
 * CDN root: https://molochdagod.github.io/ObjectStore
 */

export const OBJECTSTORE_BASE = 'https://molochdagod.github.io/ObjectStore';

// ── Class → skill-icon prefix mapping ────────────────────────────────────────
const CLASS_SKILL_PREFIX = {
  warrior: 'Warriorskill',
  mage:    'Mageskill',
  worge:   'Druideskill',
  ranger:  'Archerskill',
};

// Additional class prefixes available in ObjectStore
const EXTRA_CLASS_PREFIXES = {
  paladin:   'Paladinskill',
  priest:    'Priestskill',
  shaman:    'Shamanskill',
  assassin:  'Assassinskill',
  warlock:   'Warlock',
  engineer:  'Engineerskill',
};

/**
 * Get a class skill icon URL from ObjectStore skill_nobg/ folder.
 * @param {string} className - warrior | mage | worge | ranger
 * @param {number} index - 1-based icon index (1–50)
 * @returns {string} Full CDN URL
 */
export function getClassSkillIcon(className, index) {
  const prefix = CLASS_SKILL_PREFIX[className] || EXTRA_CLASS_PREFIXES[className] || 'Warriorskill';
  const padded = String(index).padStart(2, '0');
  return `${OBJECTSTORE_BASE}/icons/skill_nobg/${prefix}_${padded}_nobg.png`;
}

// ── Weapon icon index (mirrors ObjectStore icons/icon-index.json) ────────────
const WEAPON_TYPE_ICONS = {
  sword:      'weapons_full/Sword_01.png',
  axe:        'weapons_full/Axe_01.png',
  greatsword: 'weapons_full/Sword_21.png',
  greataxe:   'weapons_full/Axe_11.png',
  hammer2h:   'weapons_full/Hammer_01.png',
  hammer1h:   'weapons_full/Hammer_11.png',
  shield:     'weapons_full/Shield_01.png',
  staff:      'weapons_full/Staff_01.png',
  dagger:     'weapons_full/Dagger_01.png',
  bow:        'weapons_full/Bow_01.png',
  crossbow:   'weapons_full/Crossbow_01.png',
  gun:        'weapons_full/Gun_01.png',
  lance:      'weapons_full/Spear_01.png',
  tome:       'weapons/fire_tome_sprite.png',
  relic:      'weapons/arcane_tome_sprite.png',
  wand:       'weapons_full/Staff_11.png',
};

/**
 * Get a weapon-type icon URL.
 * @param {string} weaponType - sword | axe | greatsword | etc.
 * @returns {string} Full CDN URL
 */
export function getWeaponIcon(weaponType) {
  const relative = WEAPON_TYPE_ICONS[weaponType] || WEAPON_TYPE_ICONS.sword;
  return `${OBJECTSTORE_BASE}/icons/${relative}`;
}

// Named weapon icons from icon-index.json
const NAMED_WEAPON_ICONS = {
  // Greatswords
  duskreaver: 'weapons/duskreaver_greatsword_sprite.png',
  ironwrath:  'weapons/ironwrath_greatsword_sprite.png',
  wraithblade:'weapons/wraithblade.png',
  emberbrand: 'weapons/emberbrand.png',
  doomspire:  'weapons/doomspire.png',
  bloodspire: 'weapons/bloodspire.png',
  // Greataxes
  embermaul:  'weapons/embermaul.png',
  bloodreaver:'weapons/bloodreaver.png',
  // Daggers
  emberfang:  'weapons/emberfang.png',
  bloodshiv:  'weapons/bloodshiv.png',
  nightfang:  'weapons/nightfang.png',
  // Hammers 2h
  bloodcrusher:'weapons/bloodcrusher_2h_hammer_sprite.png',
  emberforge:  'weapons/emberforge_2h_hammer_sprite.png',
  // Crossbows
  emberbolt:  'weapons/emberbolt.png',
  // Bows
  emberthorn: 'weapons/emberthorn.png',
  shadowflight:'weapons/shadowflight.png',
  // Guns
  duskblaster:'weapons/duskblaster.png',
  blackpowder:'weapons/blackpowder.png',
  emberrifle: 'weapons/emberrifle.png',
  // Staves
  'blazing-wrath': 'weapons/blazing-wrath.png',
  frostgrudge: 'weapons/frostgrudge_staff_sprite.png',
  voidspire:   'weapons/voidspire.png',
  // Tomes
  'fire-tome': 'weapons/fire_tome_sprite.png',
  'frost-tome':'weapons/frost_tome_sprite.png',
  'holy-tome': 'weapons/holy_tome_sprite.png',
  'lightning-tome':'weapons/lightning_tome_sprite.png',
  'nature-tome':'weapons/nature_tome_sprite.png',
  'arcane-tome':'weapons/arcane_tome_sprite.png',

  // ── Nature / Worge staves ─────────────────────────────────────────────────
  'verdant-wrath':     'weapons/nature_tome_sprite.png',
  'thorn-grudge':      'weapons/nature_tome_sprite.png',
  'wild-oathbreaker':  'weapons/nature_tome_sprite.png',
  'grove-guardian':     'weapons/nature_tome_sprite.png',
  'blossom-fury':      'weapons/nature_tome_sprite.png',
  'root-warden':       'weapons/nature_tome_sprite.png',

  // ── Arcane / General staves ───────────────────────────────────────────────
  'arcane-fury':       'weapons/arcane_tome_sprite.png',
  'thunder-spire':     'weapons/lightning_tome_sprite.png',
  'redemption-staff':  'weapons/holy_tome_sprite.png',

  // ── Named tomes ───────────────────────────────────────────────────────────
  'crimson-inferno-tome':  'weapons/fire_tome_sprite.png',
  'blazewrath-grimoire':   'weapons/fire_tome_sprite.png',
  'frozen-glacier-tome':   'weapons/frost_tome_sprite.png',
  'ancient-verdant-tome':  'weapons/nature_tome_sprite.png',
  'radiant-dawn-tome':     'weapons/holy_tome_sprite.png',
};

/**
 * Get a named weapon icon URL.
 * @param {string} weaponName - e.g. "emberbrand", "doomspire"
 * @returns {string|null} Full CDN URL or null
 */
export function getNamedWeaponIcon(weaponName) {
  const relative = NAMED_WEAPON_ICONS[weaponName];
  return relative ? `${OBJECTSTORE_BASE}/icons/${relative}` : null;
}

// ── Armor icons ──────────────────────────────────────────────────────────────
const ARMOR_SLOT_PREFIX = {
  helmet: { prefix: 'Helm', folder: 'armor_full' },
  armor:  { prefix: 'Chest', folder: 'armor_full' },
  feet:   { prefix: 'Boots', folder: 'armor_full' },
  ring:   { prefix: 'Ring', folder: 'armor_full' },
  relic:  { prefix: 'Bracer', folder: 'armor_full' },
  offhand:{ prefix: 'Ring', folder: 'armor_full' },
  back:   { prefix: 'Back', folder: 'armor_full' },
  belt:   { prefix: 'Belt', folder: 'armor_full' },
  pants:  { prefix: 'Pants', folder: 'armor_full' },
  shoulder:{ prefix: 'Shoulder', folder: 'armor_full' },
  hands:  { prefix: 'Gloves', folder: 'armor_full' },
  necklace:{ prefix: 'necklace', folder: 'armor_full' },
};

/**
 * Get an armor slot icon URL.
 * @param {string} slot - helmet | armor | feet | ring | relic | etc.
 * @param {number} index - 1-based icon index
 * @returns {string} Full CDN URL
 */
export function getArmorIcon(slot, index = 1) {
  const slotInfo = ARMOR_SLOT_PREFIX[slot] || ARMOR_SLOT_PREFIX.armor;
  const padded = String(index).padStart(2, '0');
  return `${OBJECTSTORE_BASE}/icons/${slotInfo.folder}/${slotInfo.prefix}_${padded}.png`;
}

// ── Material icons ───────────────────────────────────────────────────────────
const MATERIAL_ICONS = {
  ore:      { 1: 'bronze_gear_t1_sprite', 2: 'iron_gear_t2_sprite', 3: 'steel_gear_t3_sprite', 4: 'mithril_gear_t4_sprite', 5: 'adamantine_gear_t5_sprite', 6: 'orichalcum_gear_t6_sprite', 7: 'starmetal_gear_t7_sprite', 8: 'divine_gear_t8_sprite' },
  wood:     { 1: 'pine_plank_t1_sprite', 2: 'oak_plank_t2_sprite', 3: 'maple_plank_t3_sprite', 4: 'ash_plank_t4_sprite', 5: 'ironwood_plank_t5_sprite', 6: 'ebony_plank_t6_sprite', 7: 'wyrmwood_plank_t7_sprite', 8: 'worldtree_plank_t8_sprite' },
  cloth:    { 1: 'linen_cloth_t1_sprite', 2: 'cotton_cloth_t2_sprite', 3: 'wool_cloth_t3_sprite', 4: 'silk_cloth_t4_sprite', 5: 'enchanted_cloth_t5_sprite', 6: 'arcane_cloth_t6_sprite', 7: 'celestial_cloth_t7_sprite', 8: 'divine_cloth_t8_sprite' },
  essence:  { 1: 'faint-essence', 2: 'minor-essence', 3: 'lesser-essence', 4: 'greater-essence', 5: 'superior-essence', 6: 'refined-essence', 7: 'perfect-essence', 8: 'divine-essence' },
  gem:      { 1: 'pebble-gem', 2: 'rough-gem', 3: 'flawed-gem', 4: 'standard-gem', 5: 'fine-gem', 6: 'pristine-gem', 7: 'flawless-gem', 8: 'divine-gem' },
  leather:  { 1: 'scraps-leather', 2: 'rawhide', 3: 'thick-hide', 4: 'rugged-leather', 5: 'hardened-leather', 6: 'hardened-leather', 7: 'rugged-leather', 8: 'rawhide' },
};

/**
 * Get a material icon URL by category and tier.
 * @param {string} category - ore | wood | cloth | essence | gem | leather
 * @param {number} tier - 1–8
 * @returns {string} Full CDN URL
 */
export function getMaterialIcon(category, tier = 1) {
  const map = MATERIAL_ICONS[category];
  if (!map) return `${OBJECTSTORE_BASE}/icons/materials/bronze_gear_t1_sprite.png`;
  const filename = map[tier] || map[1];
  return `${OBJECTSTORE_BASE}/icons/materials/${filename}.png`;
}

// ── 3D Model URL helpers ───────────────────────────────────────────────────────

/**
 * Get a resource model URL (GLTF preferred, OBJ fallback).
 * @param {string} modelName - e.g. "Silver_Bars", "Copper_Bar"
 * @param {string} format - 'gltf' | 'obj' | 'fbx' (default: 'gltf')
 * @returns {string} Full CDN URL
 */
export function getResourceModelUrl(modelName, format = 'gltf') {
  const ext = format === 'gltf' ? '.gltf' : format === 'obj' ? '.obj' : `.${format}`;
  return `${OBJECTSTORE_BASE}/KayKit_ResourceBits_1.0_FREE/Assets/${format}/${modelName}${ext}`;
}

/**
 * Get a building model URL.
 * @param {string} modelName - e.g. "castle", "market"
 * @param {string} format - 'gltf' | 'obj' | 'fbx'
 * @returns {string} Full CDN URL
 */
export function getBuildingModelUrl(modelName, format = 'gltf') {
  // KayKit Medieval Builder GLB files use .gltf.glb naming convention
  const ext = format === 'gltf' ? '.gltf.glb' : `.${format}`;
  const sub = format === 'gltf' ? 'gltf' : format;
  return `${OBJECTSTORE_BASE}/models/KayKit_MedievalBuilder/objects/${sub}/${modelName}${ext}`;
}

/**
 * Get a character model URL (GLB only).
 * @param {string} characterName - e.g. "Knight", "Barbarian"
 * @returns {string} Full CDN URL
 */
export function getCharacterModelUrl(characterName) {
  return `${OBJECTSTORE_BASE}/models/characters/kaykit/${characterName}.glb`;
}

// ── Profession icons ─────────────────────────────────────────────────────────
const PROFESSION_ICONS = {
  miner:    'professions/miner_profession_game_icon.png',
  forester: 'professions/forester_profession_game_icon.png',
  mystic:   'professions/mystic_profession_game_icon.png',
  chef:     'professions/chef_profession_game_icon.png',
  engineer: 'professions/engineer_profession_game_icon.png',
};

export function getProfessionIcon(profession) {
  const relative = PROFESSION_ICONS[profession.toLowerCase()];
  return relative ? `${OBJECTSTORE_BASE}/icons/${relative}` : null;
}

// ── Attribute icons ──────────────────────────────────────────────────────────
const ATTRIBUTE_ICONS = {
  strength:  'professions/strength_attribute_sigil_icon.png',
  agility:   'professions/agility_attribute_sigil_icon.png',
  dexterity: 'professions/dexterity_attribute_sigil_icon.png',
  intellect: 'professions/intellect_attribute_sigil_icon.png',
  wisdom:    'professions/wisdom_attribute_sigil_icon.png',
  vitality:  'professions/vitality_attribute_sigil_icon.png',
  endurance: 'professions/endurance_attribute_sigil_icon.png',
  tactics:   'professions/tactics_attribute_sigil_icon.png',
};

export function getAttributeIcon(attribute) {
  const relative = ATTRIBUTE_ICONS[attribute.toLowerCase()];
  return relative ? `${OBJECTSTORE_BASE}/icons/${relative}` : null;
}

// ── Consumable icons ─────────────────────────────────────────────────────────
export function getConsumableIcon(index = 1) {
  const padded = String(index).padStart(2, '0');
  return `${OBJECTSTORE_BASE}/icons/consumables/potion_${padded}.png`;
}

// ── Generic weapon-full icon (e.g. Sword_01 – Arrow_30) ─────────────────────
export function getWeaponFullIcon(prefix, index = 1) {
  const padded = String(index).padStart(2, '0');
  return `${OBJECTSTORE_BASE}/icons/weapons_full/${prefix}_${padded}.png`;
}

// ── Weapon skill icons (from icons/skills/ folder — with backgrounds) ────────
export function getWeaponSkillIcon(category, index = 1) {
  return `${OBJECTSTORE_BASE}/icons/skills/${category}_${index}.png`;
}

// ── UI sprite icons ──────────────────────────────────────────────────────────
const UI_ICONS = {
  armor:   'sprites/Icon_armor.png',
  book:    'sprites/Icon_book.png',
  craft:   'sprites/Icon_craft.png',
  notes:   'sprites/Icon_notes.png',
  skull:   'sprites/Icon_scull.png',
  loot:    'sprites/Loot_06.png',
  crystal: 'sprites/Crystal_eq_icon_nb.png',
  trade:   'sprites/Trade_eq_icon_nb.png',
  guild:   'sprites/Guild_eq_icon_r.png',
  mail:    'sprites/Mail_eq_icon_r.png',
};

export function getUIIcon(name) {
  const relative = UI_ICONS[name];
  return relative ? `${OBJECTSTORE_BASE}/icons/${relative}` : null;
}

// ── GrudgeUUID Sprite Manifest Integration ───────────────────────────────────
// Sprite manifest from warlord-crafting-suite with UUIDs and sheet metadata.
// Load once, then use getSpriteByUuid() or getSpriteBySlug() for lookups.

let _spriteManifest = null;
let _uuidIndex = null;
let _slugIndex = null;

/**
 * Initialize the sprite manifest for UUID-based lookups.
 * @param {Array} sprites - Array of sprite entries from manifest.json
 */
export function initSpriteManifest(sprites) {
  _spriteManifest = sprites;
  _uuidIndex = new Map();
  _slugIndex = new Map();
  for (const s of sprites) {
    if (s.grudgeUuid) _uuidIndex.set(s.grudgeUuid, s);
    if (s.id) _slugIndex.set(s.id, s);
  }
}

/**
 * Get a sprite entry by its GrudgeUUID.
 * @param {string} uuid - e.g. "ANIM-20260320073512-000001-569789E6"
 * @returns {Object|null} Sprite entry with path, sheetMeta, dimensions
 */
export function getSpriteByUuid(uuid) {
  return _uuidIndex?.get(uuid) || null;
}

/**
 * Get a sprite entry by its slug ID.
 * @param {string} id - e.g. "boar-idle-with-shadow"
 * @returns {Object|null} Sprite entry
 */
export function getSpriteBySlug(id) {
  return _slugIndex?.get(id) || null;
}

/**
 * Get all sprites in a category.
 * @param {string} category - e.g. "animal", "weapon", "armor"
 * @returns {Array} Matching sprite entries
 */
export function getSpritesByCategory(category) {
  if (!_spriteManifest) return [];
  return _spriteManifest.filter(s => s.category === category);
}

/**
 * Get the full ObjectStore or local URL for a sprite entry.
 * @param {Object} sprite - Sprite entry from manifest
 * @param {boolean} useCDN - If true, return ObjectStore CDN URL
 * @returns {string} Full URL
 */
export function getSpriteUrl(sprite, useCDN = false) {
  if (!sprite) return '';
  if (useCDN) return `${OBJECTSTORE_BASE}${sprite.path}`;
  return sprite.path;
}
