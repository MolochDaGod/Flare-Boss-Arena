/**
 * Unified combat HUD model — every live mode (island, boss arena, camp, moba)
 * maps into this shape so one shell renders everywhere.
 */

export type CombatModeId = "island" | "boss" | "camp" | "moba" | "pvp";

export interface HudEnemyMark {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  screenX: number;
  screenY: number;
  tier?: number;
  isBoss?: boolean;
}

export interface HudDamageFloat {
  id: string | number;
  value: number;
  x: number;
  y: number;
  age: number;
  isPlayer: boolean;
  isCrit: boolean;
}

export interface HudSkillSlot {
  id: string;
  name: string;
  /** Hotkey label 1–5 or R */
  key?: string;
  glyph?: string;
  icon?: string;
  /** 0..1 ready (1 = off cooldown) */
  readyPct?: number;
  pending?: boolean;
  isSignature?: boolean;
}

export interface HudAllyRow {
  id: string;
  name: string;
  role?: string;
  hp: number;
  maxHp: number;
  dead?: boolean;
}

export interface HudInteractPrompt {
  title: string;
  subtitle?: string;
  hint?: string;
  key?: string;
}

export interface HudResourceBag {
  gold?: number;
  wood?: number;
  stone?: number;
  embers?: number;
}

export interface UnifiedCombatHudState {
  mode: CombatModeId;
  loaded: boolean;

  // Player
  charName: string;
  raceClass?: string;
  playerLevel: number;
  playerHp: number;
  playerMaxHp: number;
  playerMana: number;
  playerMaxMana: number;
  /** 0..1 attack readiness (1 = ready) */
  attackReadyPct: number;
  combatLabel?: string;
  invulnerable?: boolean;
  blocking?: boolean;
  jumping?: boolean;

  // World strip
  zone: string;
  runtimeLabel?: string;
  /** Island round / wave / phase */
  roundOrWave?: number;
  difficultyMult?: number;
  aliveCount?: number;
  activePerks?: string[];
  missionLine?: string;

  // Boss
  bossAlive?: boolean;
  bossName?: string | null;
  bossTitle?: string | null;
  bossHp?: number;
  bossMaxHp?: number;
  bossPhase?: number;
  bossMaxPhases?: number;
  bossStyle?: string | null;
  bossTelegraph?: string | null;

  // Lists
  enemies: HudEnemyMark[];
  damageNumbers: HudDamageFloat[];
  combatLog: string[];
  skills: HudSkillSlot[];
  specialReadyPct?: number;
  allies?: HudAllyRow[];
  resources?: HudResourceBag;
  interact?: HudInteractPrompt | null;

  // Outcome (boss arena)
  outcome?: "fighting" | "victory" | "defeat" | null;
}

export const GOLD = "#c5a059";

export const HUD_GLASS: Record<string, string | number> = {
  background: "linear-gradient(180deg, rgba(18,14,10,0.86), rgba(6,6,8,0.92))",
  border: "1px solid rgba(197,160,89,0.32)",
  boxShadow: "0 8px 28px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06)",
  backdropFilter: "blur(8px)",
  borderRadius: 10,
};
