export const classDefinitions = {
  warrior: {
    name: 'Warrior',
    icon: 'crossed_swords',
    color: '#ef4444',
    description: 'A fearless frontline fighter specializing in raw power and defense.',
    lore: 'Forged in the crucible of the Grudge Wars, Warriors are the backbone of any warband. Their strength and endurance are unmatched on the battlefield.',
    startingAttributes: { Strength: 5, Vitality: 3, Endurance: 2, Dexterity: 1, Agility: 1, Intellect: 0, Wisdom: 0, Tactics: 0 },
    abilities: [
      { id: 'slash', name: 'Slash', icon: 'crossed_swords', description: 'A steady sword strike that restores resources', type: 'physical', damage: 0.9, manaCost: 0, staminaCost: 0, cooldown: 0, target: 'enemy', manaGain: 5, staminaGain: 8 },
      { id: 'power_strike', name: 'Power Strike', icon: 'bomb', description: 'A devastating blow dealing 2x damage', type: 'physical', damage: 2.0, manaCost: 0, staminaCost: 25, cooldown: 2, target: 'enemy' },
      { id: 'war_cry', name: 'War Cry', icon: 'battle', description: 'Boost your damage by 30% for 3 turns', type: 'buff', damage: 0, manaCost: 0, staminaCost: 30, cooldown: 5, target: 'self', effect: { stat: 'damage', multiplier: 1.3, duration: 3 } },
      { id: 'shield_bash', name: 'Shield Bash', icon: 'shield', description: 'Stun the enemy for 1 turn', type: 'physical', damage: 0.8, manaCost: 0, staminaCost: 20, cooldown: 4, target: 'enemy', effect: { type: 'stun', duration: 1 } },
      { id: 'cleave', name: 'Cleave', icon: 'target', description: 'Slash deep, hitting all enemies and causing bleed for 3 turns', type: 'physical', damage: 1.5, manaCost: 0, staminaCost: 22, cooldown: 3, target: 'enemy', isAoE: true, effect: { type: 'dot', damage: 0.12, duration: 3 } },
      { id: 'demon_blade', name: 'Demon Blade', icon: 'sword', description: 'Transform into a Demon Swordsman for 3 turns, gaining +40% damage and +15 defense', type: 'buff', damage: 0, manaCost: 0, staminaCost: 40, cooldown: 8, target: 'self', isDemonBlade: true, effect: { stat: 'damage', multiplier: 1.4, duration: 3 }, defenseBoost: { stat: 'defense', flat: 15, duration: 3 } },
    ],
    signatureAbility: { id: 'invincible', name: 'Invincible', icon: 'shield', description: 'Become invulnerable for 2 turns, absorbing all damage', type: 'buff', damage: 0, manaCost: 0, staminaCost: 35, cooldown: 8, target: 'self', isInvincible: true, effect: { stat: 'defense', flat: 999, duration: 2 } }
  },
  mage: {
    name: 'Mage Priest',
    icon: 'crystal',
    color: '#8b5cf6',
    description: 'Master of arcane magic and divine healing arts.',
    lore: 'Drawing power from ancient ley lines and forgotten gods, Mage Priests wield destructive magic alongside sacred healing — a balance few can master.',
    startingAttributes: { Strength: 0, Vitality: 1, Endurance: 1, Dexterity: 0, Agility: 0, Intellect: 5, Wisdom: 4, Tactics: 1 },
    abilities: [
      { id: 'arcane_bolt', name: 'Arcane Bolt', icon: 'sparkle', description: 'A focused arcane pulse that restores resources', type: 'magical', damage: 1.0, manaCost: 0, staminaCost: 0, cooldown: 0, target: 'enemy', manaGain: 8, staminaGain: 5 },
      { id: 'fireball', name: 'Fireball', icon: 'fire', description: 'Hurls fire dealing massive damage + burn', type: 'magical', damage: 2.5, manaCost: 35, staminaCost: 0, cooldown: 3, target: 'enemy', effect: { type: 'dot', damage: 0.1, duration: 2 } },
      { id: 'heal', name: 'Divine Heal', icon: 'heart', description: 'Restore 30% of max HP', type: 'heal', damage: 0, manaCost: 40, staminaCost: 0, cooldown: 4, target: 'self', healPercent: 0.30 },
      { id: 'ice_storm', name: 'Ice Storm', icon: 'ice', description: 'Freezes all enemies, reducing their damage', type: 'magical', damage: 1.8, manaCost: 30, staminaCost: 0, cooldown: 3, target: 'enemy', isAoE: true, effect: { stat: 'damage', multiplier: 0.6, duration: 2 } },
    ],
    signatureAbility: { id: 'mana_shield', name: 'Mana Shield', icon: 'shield', description: 'Convert mana into a protective barrier', type: 'buff', damage: 0, manaCost: 50, staminaCost: 0, cooldown: 5, target: 'self', effect: { stat: 'defense', flat: 25, duration: 3 } }
  },
  worge: {
    name: 'Worge',
    icon: 'wolf',
    color: '#d97706',
    description: 'A shapeshifter who wields nature and storm magic in human form, then transforms into a devastating beast.',
    lore: 'Worges walk between worlds — scholars of storm and root in mortal guise, unstoppable predators in beast form. Their mace and dagger channel primal energies until the wild within is unleashed.',
    startingAttributes: { Strength: 2, Vitality: 2, Endurance: 1, Dexterity: 2, Agility: 2, Intellect: 2, Wisdom: 1, Tactics: 0 },
    abilities: [
      { id: 'mace_strike', name: 'Mace Strike', icon: 'hammer', description: 'A storm-charged mace blow that restores resources', type: 'physical', damage: 1.0, manaCost: 0, staminaCost: 0, cooldown: 0, target: 'enemy', manaGain: 6, staminaGain: 6 },
      { id: 'lightning_lash', name: 'Lightning Lash', icon: 'lightning', description: 'Call down a bolt of lightning on the target', type: 'magical', damage: 1.8, manaCost: 25, staminaCost: 0, cooldown: 2, target: 'enemy', effect: { type: 'dot', damage: 0.1, duration: 2 } },
      { id: 'natures_grasp', name: "Nature's Grasp", icon: 'nature', description: 'Vines heal you over 3 turns', type: 'heal_over_time', damage: 0, manaCost: 20, staminaCost: 0, cooldown: 4, target: 'self', healPercent: 0.08, duration: 3 },
      { id: 'dagger_toss', name: 'Dagger Toss', icon: 'sword', description: 'Hurl an envenomed dagger, poisoning for 3 turns', type: 'physical', damage: 0.9, manaCost: 0, staminaCost: 15, cooldown: 3, target: 'enemy', effect: { type: 'dot', damage: 0.15, duration: 3 } },
      { id: 'summon_heal_totem', name: 'Heal Totem', icon: 'nature', description: 'Summon a totem that heals allies when you act', type: 'summon_totem', totemType: 'heal_totem', manaCost: 30, staminaCost: 0, cooldown: 6, target: 'self' },
      { id: 'summon_fire_totem', name: 'Fire Totem', icon: 'fire', description: 'Summon a totem that attacks enemies when you act', type: 'summon_totem', totemType: 'fire_totem', manaCost: 25, staminaCost: 10, cooldown: 6, target: 'self' },
      { id: 'summon_fear_totem', name: 'Fear Totem', icon: 'skull', description: 'Summon a totem that slows enemies and may cause them to skip attacks', type: 'summon_totem', totemType: 'fear_totem', manaCost: 35, staminaCost: 0, cooldown: 7, target: 'self' },
      { id: 'summon_leaf_elemental', name: 'Call Leaf Sprite', icon: 'nature', description: 'Summon a nature spirit that heals allies and poisons foes', type: 'summon_companion', companionType: 'leaf_elemental', manaCost: 35, staminaCost: 0, cooldown: 8, target: 'self' },
      { id: 'summon_imp', name: 'Call War Imp', icon: 'fire', description: 'Summon a vicious imp that attacks enemies with fire', type: 'summon_companion', companionType: 'imp_companion', manaCost: 30, staminaCost: 10, cooldown: 8, target: 'self' },
      { id: 'summon_twig', name: 'Call Twig Guardian', icon: 'shield', description: 'Summon a bark guardian that taunts enemies and retaliates', type: 'summon_companion', companionType: 'twig_companion', manaCost: 25, staminaCost: 15, cooldown: 8, target: 'self' },
    ],
    signatureAbility: { id: 'bear_form', name: 'Worge Transform', icon: 'wolf', description: 'Transform into a ferocious beast, boosting damage and defense. Use again to revert.', type: 'buff', damage: 0, manaCost: 0, staminaCost: 20, cooldown: 0, target: 'self', isBearForm: true, effect: { stat: 'damage', multiplier: 1.25, duration: 99 }, defenseBoost: { stat: 'defense', flat: 10, duration: 99 } }
  },
  ranger: {
    name: 'Ranger',
    icon: 'bow',
    color: '#22c55e',
    description: 'A deadly marksman with precise long-range attacks.',
    lore: 'Silent and patient, Rangers strike from the shadows with lethal precision. Their arrows find gaps in even the thickest armor.',
    startingAttributes: { Strength: 1, Vitality: 1, Endurance: 1, Dexterity: 4, Agility: 3, Intellect: 1, Wisdom: 0, Tactics: 1 },
    abilities: [
      { id: 'quick_shot', name: 'Quick Shot', icon: 'bow', description: 'A swift arrow that restores resources', type: 'physical', damage: 0.8, manaCost: 0, staminaCost: 0, cooldown: 0, target: 'enemy', manaGain: 4, staminaGain: 7 },
      { id: 'aimed_shot', name: 'Aimed Shot', icon: 'target', description: 'A carefully aimed shot that always crits', type: 'physical', damage: 2.0, manaCost: 0, staminaCost: 20, cooldown: 2, target: 'enemy', guaranteedCrit: true },
      { id: 'poison_arrow', name: 'Poison Arrow', icon: 'skull', description: 'Poisons the enemy for damage over time', type: 'physical', damage: 0.7, manaCost: 0, staminaCost: 15, cooldown: 3, target: 'enemy', effect: { type: 'dot', damage: 0.2, duration: 3 } },
      { id: 'evasive_maneuver', name: 'Evasive Roll', icon: 'energy', description: 'Increase evasion by 50% for 2 turns', type: 'buff', damage: 0, manaCost: 0, staminaCost: 15, cooldown: 4, target: 'self', effect: { stat: 'evasion', flat: 50, duration: 2 } },
      { id: 'volley', name: 'Arrow Volley', icon: 'bow', description: 'Rain arrows on all enemies for heavy damage', type: 'physical', damage: 2.4, manaCost: 0, staminaCost: 28, cooldown: 4, target: 'enemy', isAoE: true },
    ],
    signatureAbility: { id: 'focus', name: 'Focus', icon: 'target', description: 'Passive: +10% crit per turn (max 5 stacks). Critting spends stacks. Active: Double stacks and guarantee next crit.', type: 'focus', damage: 0, manaCost: 0, staminaCost: 15, cooldown: 4, target: 'self', isFocus: true }
  }
};

export const CLASS_TIERS = [
  { minRank: 1, maxRank: 10, name: 'Legendary', className: 'legendary', desc: 'Mythical power achieved through perfect synergy.', color: '#89f7fe' },
  { minRank: 11, maxRank: 50, name: 'Warlord', className: 'warlord', desc: 'A dominant force on the battlefield.', color: '#f97316' },
  { minRank: 51, maxRank: 100, name: 'Epic', className: 'epic', desc: 'A hero of renown and great skill.', color: '#a855f7' },
  { minRank: 101, maxRank: 200, name: 'Hero', className: 'hero', desc: 'A capable adventurer with potential.', color: '#3b82f6' },
  { minRank: 201, maxRank: 300, name: 'Normal', className: 'normal', desc: 'A standard combatant.', color: '#9ca3af' }
];
