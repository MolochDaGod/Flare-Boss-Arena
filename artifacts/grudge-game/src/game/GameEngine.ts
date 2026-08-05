import * as THREE from "three";
import {
  createFrameTimer,
  createGltfLoader,
  disposeRenderer,
} from "@/game/threeSetup";
import { createEnemyModel, updateEnemyAnimation, makeAnimState, archetypeFor, type EnemyModel, type AnimState } from "./EnemyFactory";
import { isMonsterId, loadMonsterModel, disposeMonsterModel, ANIMATED_MONSTER_TEMPLATES } from "./MonsterModels";
import { disposeKitModel } from "./KayKitCharacter";
import { makeGroundMaterial, makeRockField, makeTerrainSkirt } from "./proceduralTextures";
import { buildOrcCamp, type CampHandle } from "./CampBuilder";
import { buildDarkElfCampPrefab, type DarkElfCampHandle } from "./DarkElfCamp";
import {
  buildDarkElfCrystalEvent,
  type DarkElfEventWithVisuals,
} from "./DarkElfEvent";
import {
  DARK_ELF_SPAWN_TEMPLATES,
  SPIDER_SPAWN_TEMPLATES,
  SKELETON_SPAWN_TEMPLATES,
  resolveCatalogModelId,
  catalogTint,
  catalogScale,
  hashString,
} from "../data/monsterCatalog";
import { WarningEffectField } from "./combat/warningEffects";
import {
  createClaimFlagField,
  placeClaimFlag,
  updateClaimFlags,
  bindClaimNodes,
  type ClaimFlagField,
} from "./ClaimFlag";
import {
  createWispEventField,
  spawnWispEventPack,
  updateWisps,
  damageWisp,
  nearestAliveWisp,
  type WispEventField,
} from "./WispEvent";
import { spawnScriptedHarvestNodes } from "./Harvestables";
import { PIRATE_DEFS, loadPirate, disposePirate, disposeGltfObject, type PirateHandle, type PirateRole } from "./PirateNPC";
import { Townsperson } from "./Townsfolk";
import {
  buildHarvestField,
  attachRockFieldNodes,
  hideHarvestNode,
  showHarvestNode,
  nearestHarvestNode,
  resourceForKind,
  type HarvestField,
  type HarvestNode,
} from "./Harvestables";
import { addResource, getResources, spendResources, type ResourceBag } from "../data/resources";
import { getWallet, saveWallet } from "../data/wallet";
import {
  getActiveFighterKit,
  type FighterKit,
} from "../data/fighterSkills";
import { getActiveFighter, RACALVIN_ID } from "../data/fighters";
import {
  getRacalvinWeapons,
  launchRacalvinMindStrike,
  updateRacalvinMindSwords,
  RACALVIN_PSYCHIC_COLOR,
} from "./racalvinHero";
import {
  getActivePerkMods,
  grantPerk,
  getActivePerks,
  PERK_BY_ID,
  type PerkId,
  type PerkCombatMods,
} from "../data/perks";
import { PlayerAnimator, buildAuthoredClips, buildSkinAnim } from "./PlayerAnimator";
import { DungeonMap } from "./DungeonMap";
import { MazeArena } from "./MazeArena";
import { PORTRAIT_URL, resolveVisibleMeshes, type RaceId } from "../data/characterMeshes";
import { getSkin, skinUrl, type SkinDef } from "../data/skins";
import { loadRacalvinForDungeon } from "./racalvinHero";
import { skillAnimCandidates } from "./kaykitHero";
import { SkillVfx } from "./skillVfx";
import type { ClassSkill } from "../data/classSkills";
import { archetypeForSkill, type SkillShapeKind } from "./combat/skillArchetypes";
import { targetsInShape, type ShapeQuery } from "./combat/damageShapes";
import type { CombatTarget } from "./combat/types";
import { ParticleVfx, elementColor, type SkillElement } from "./combat/particles";
import { vfxForArchetype, vfxForSkillSlot } from "../data/vfxHotkeys";
import { TelegraphField } from "./combat/telegraphs";
import {
  DeployableManager,
  createDeployableGhost,
  createCampGhost,
} from "./combat/deployables";
import type { DeployableKind } from "./combat/skillArchetypes";
import { makeBloomComposer, type BloomComposer } from "./combat/bloom";
import {
  createIsoCameraState,
  isoCameraWheel,
  applyOrthoFrustum,
  updateIsoCamera,
  kickCameraShake,
  type IsoCameraState,
} from "./combat/isoCamera";
import { SlashWaveField } from "./combat/slashVfx";
import { AuraField } from "./combat/auras";
import { ProjectileField } from "./combat/projectiles";
import { PendingStrikeField } from "./combat/pendingStrikes";
import { CombatStateMachine } from "./combatState";
import {
  resolveDodge,
  dodgeClipCandidates,
  DODGE_IFRAME_S,
  DODGE_COOLDOWN_S,
} from "./dodgeMath";
import { getActiveCombatProfile, brainTuning, type BrainArchetype } from "../data/characterCombatProfiles";
import { pickHeroEnemies, heroEnemyAsTemplate } from "../data/heroEnemyLibrary";
import { CDN_ANIMATED_TEMPLATES, CDN_MONSTER_TEMPLATES } from "../data/cdnMonsters";
import { getStoneCombatMods, addStone, rollStoneDrop, STONE_META } from "../data/stones";
import { resolveSkillBoost } from "../data/abilityUpgrades";
import {
  resolveHitProcs,
  resolveKillProcs,
  onslaughtAttackSpeedMult,
  isOnslaughtActive,
  tryBlurOnHitTaken,
  blurDamageMult,
  isBlurActive,
} from "../data/procs";
import { getGameLoadout } from "../data/gameCombat";
import { Grudge6Factory, type Grudge6PrefabDebug } from "./grudge6/Grudge6Character";
import {
  thinkAlly,
  stepAllyMovement,
  manTower,
  type AllyAgent,
  type AllyState,
} from "./grudge6/AllyBrain";
import {
  createPlayerCampField,
  buildPlayerCamp,
  isInsidePlayerCamp,
  nearestPlayerCamp,
  pushOutOfCamps,
  CAMP_BUILD_COST,
  type PlayerCampField,
} from "./PlayerCamp";
import { FX2D } from "./FX2D";
import { DUNGEON_COLLECTABLES } from "../data/worldProps";
import { loadWorldProp, disposeWorldProp, type LoadedWorldProp } from "./WorldPropLoader";
import { loadGLTFCached } from "./assets";
import { RunDirector, type RunEvent } from "./RunDirector";
import { FogOfWar, type FogMinimapSnapshot } from "./FogOfWar";
import { generateIslandPaths, type IslandPathMap } from "./IslandPathMap";
import { zoneLabel } from "../data/islandRun";
import type { ActiveIslandEvent } from "../data/islandEvents";
import type { PlayerSnapshot } from "@workspace/net-protocol";
import { pickDungeonBossDef } from "../data/bossRoster";
import { findPath, advanceAlongPath } from "./pathfind";
import {
  generateWorldChunkManifest,
  nearestClaimableZone,
  zoneAt,
  zoneSpawnBias,
  type WorldChunkManifest,
  type WorldZone,
} from "../data/worldZones";
import {
  configureDracoLoader,
  bakeIslandScene,
  scatterZoneDebris,
  disposeDracoLoader,
} from "./sceneBake";
import { createOpenWater, type OpenWaterHandle, type PlayDomain } from "./OpenWater";
import { buildHarborDistrict, type HarborDistrictHandle } from "./HarborDistrict";
import { generateArchipelago } from "../data/archipelago";
import { buildWorldChunkMap, type WorldChunkMapHandle } from "./WorldChunkMap";
import { manaRegenPerSec, hpRegenPerSec, applyRegen } from "../data/combatStats";
import { deployAllyTo } from "./grudge6/AllyBrain";
// PlayerCamp + farm modular imported above

const OBJECTSTORE_BASE = "https://molochdagod.github.io/ObjectStore";

function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CLASS_MODEL: Record<string, string> = {
  warrior: "Knight",
  mage:    "Mage",
  ranger:  "Ranger",
  worge:   "Barbarian",
};

/** Bounding box over only the VISIBLE meshes. `Box3.setFromObject` ignores
 *  visibility, which would inflate the box with the race GLB's hidden wardrobe
 *  meshes (every weapon at once) and wreck height-based scaling. */
function visibleBox(root: THREE.Object3D): THREE.Box3 {
  const box = new THREE.Box3();
  root.updateWorldMatrix(true, true);
  root.traverse((c) => {
    const m = c as THREE.Mesh;
    if (m.isMesh && m.visible && m.geometry) {
      if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
      const gb = m.geometry.boundingBox;
      if (gb) box.union(gb.clone().applyMatrix4(m.matrixWorld));
    }
  });
  return box;
}

export interface EnemyTemplate {
  id: string;
  name: string;
  type: string;       // beast, arachnid, troll, orc, undead, golem, minotaur, dragon, egyptian, titan, reptile, elemental
  tier: number;
  hp: number;
  damage: number;
}

export interface EnemyInstance {
  id: string;
  template: EnemyTemplate;
  model: EnemyModel;
  anim: AnimState;
  hp: number;
  maxHp: number;
  state: "idle" | "patrol" | "chase" | "attack" | "hurt" | "death" | "dead";
  position: THREE.Vector3;
  patrolTarget: THREE.Vector3;
  spawnPos: THREE.Vector3;
  facing: number;        // yaw angle (radians)
  attackCooldown: number;
  hurtTimer: number;
  aggroRange: number;
  attackRange: number;
  speed: number;
  /** A* waypoints for wander / chase. */
  path: THREE.Vector3[];
  pathRepathAt: number;
  idleUntil: number;
}

export interface DamageNumber {
  id: string;
  value: number;
  worldPos: THREE.Vector3;
  age: number;
  isPlayer: boolean;
  isCrit: boolean;
}

export interface NearbyPirateInfo {
  id: string;
  name: string;
  title: string;
  role: PirateRole;
  prompt: string;
}

/** Island beat cards (boss alert / victory / sail). Kept for Party / overlay consumers. */
export type GameBeatKind =
  | "boss_alert"
  | "boss_defeated"
  | "victory"
  | "sail"
  | "mission_complete"
  | "island_event";

export interface GameBeat {
  kind: GameBeatKind;
  title: string;
  subtitle: string;
}

/** Party ally row for PartyHud. */
export interface AllyHudSnapshot {
  id: string;
  name: string;
  role: string;
  race: string;
  hp: number;
  maxHp: number;
  state: AllyState;
  brain: string;
  /** Active goal/objective label from goal AI. */
  goal?: string;
  loadOk: boolean;
  dead: boolean;
  respawnSec: number;
  gait: number | null;
  debug: Grudge6PrefabDebug | null;
}

export interface GameState {
  playerHp: number;
  playerMaxHp: number;
  playerMana: number;
  playerMaxMana: number;
  playerLevel: number;
  playerXp: number;
  playerAttackCooldown: number;
  enemies: Array<{ id: string; name: string; hp: number; maxHp: number; screenX: number; screenY: number; tier: number; isBoss?: boolean }>;
  damageNumbers: Array<{ id: string; value: number; x: number; y: number; age: number; isPlayer: boolean; isCrit: boolean }>;
  combatLog: string[];
  zone: string;
  loaded: boolean;
  /** True once the dungeon GLB + collision BVH are built (or load failed). */
  mapReady: boolean;
  /** Gathered resources (wood / stone). */
  resources: ResourceBag;
  gold: number;
  /** Nearby pirate for E-key interact (vendor / captain / crew). */
  nearbyPirate: NearbyPirateInfo | null;
  /** Nearby harvest node label for HUD. */
  nearbyHarvest: string | null;
  /** Island generation seed (captain re-sails change this). */
  mapSeed: number;
  /** Progressive island / round number (1 = first area). */
  islandRound: number;
  /** Difficulty mult shown in HUD (enemy HP/dmg scale). */
  difficultyMult: number;
  /** True while a dungeon boss is alive. */
  bossAlive: boolean;
  bossName: string | null;
  bossHp: number;
  bossMaxHp: number;
  /** Skill targeting mode: -1 none, 0-4 pending ground AoE skill. */
  pendingSkillIdx: number;
  /** Special (R) cooldown 0..1 ready. */
  specialReadyPct: number;
  /** Block held (Q). */
  blocking: boolean;
  /** Jump airborne. */
  jumping: boolean;
  /** Active perk labels for HUD. */
  activePerks: string[];
  /** Annihilate-style combat phase label (IDLE / RUN / ATK / BLOCK / DODGE…). */
  combatLabel: string;
  /** True while dodge/block i-frames are active. */
  invulnerable: boolean;
  /** Alive foe count (GrudgeUi strip). */
  aliveEnemies: number;
  /** Fog-of-war minimap snapshot (world map). */
  fogMinimap: FogMinimapSnapshot | null;
  /** 0–100 explored percentage of the island grid. */
  exploredPct: number;
  /** Party allies for PartyHud. */
  allies: AllyHudSnapshot[];
  /** Ally load failures. */
  partyLoadErrors: string[];
  /** Island beat card (mission / boss / sail / event). */
  beat: GameBeat | null;
  /** True when captain re-sail is unlocked (boss defeated). */
  canSail: boolean;
  /** Island run phase. */
  islandPhase: string;
  /** Mission progress text. */
  missionTitle: string;
  missionKills: number;
  missionGoal: number;
  /** Multiplayer remote player count (excluding local). */
  remotePlayerCount: number;
  /** Co-op / PvP room label when connected. */
  mpRoom: string | null;
  /** Player dead → IslandBeatOverlay respawn. */
  playerDead: boolean;
  /** Bearing degrees toward Pirate Cove (for sail UI). */
  coveBearing: number | null;
  /** Current world zone name (chunk map). */
  currentZone: string | null;
  /** Claimable zone nearby prompt. */
  nearbyClaimZone: string | null;
  /** Player-owned claim count. */
  claimsOwned: number;
  /** Zone list for world map UI. */
  worldZones: Array<{
    id: string;
    name: string;
    kind: string;
    x: number;
    z: number;
    radius: number;
    color: number;
    claimable: boolean;
    owner: string;
    chunkX: number;
    chunkZ: number;
    areaLevel?: number;
    density?: number;
  }>;
  playerMapX: number;
  playerMapZ: number;
  /** land | open_water — helm mode for open sea. */
  playDomain: PlayDomain;
  /** Helm HUD when aboard. */
  boatHeading?: number;
  boatSpeed?: number;
  nearbyIslandName?: string | null;
  /** Harbor shop/training prompt. */
  nearbyHarborStation?: string | null;
  /** Prompt to board skiff at dock. */
  canEmbark?: boolean;
  /** Prompt to land at island. */
  canLand?: boolean;
}

export interface PlayerInitStats {
  hp: number;
  mana: number;
  level: number;
  baseDamage: number;
  defense: number;
  critChance: number;
  attackSpeed: number;
  charName: string;
  charClass: string;
  charRace: string;
  /** Selected champion skin id (One Piece model); null/undefined → race model. */
  skinId?: string | null;
  /** Equipped Mainhand item category (drives race wardrobe weapon mesh). */
  equipMainCategory?: string;
  equipHasOffhand?: boolean;
  /** Offhand category for dual-wield (e.g. daggers) vs shield. */
  equipOffCategory?: string;
  /** When true with hasOffhand, show shield; when false show offCategory weapon. */
  equipOffhandIsShield?: boolean;
  equipHasShoulder?: boolean;
}

export class GameEngine {
  private scene!: THREE.Scene;
  private camera!: THREE.OrthographicCamera;
  private renderer!: THREE.WebGLRenderer;
  private timer = createFrameTimer();
  private loader!: ReturnType<typeof createGltfLoader>;
  private skillVfx!: SkillVfx;
  private particles!: ParticleVfx;
  private telegraphs!: TelegraphField;
  private deployables!: DeployableManager;
  private bloom: BloomComposer | null = null;
  /** Orthographic iso rig — smooth zoom, velocity lead, combat shake. */
  private isoCam: IsoCameraState = createIsoCameraState({
    d: 16,
    dMin: 8,
    dMax: 34,
    offset: new THREE.Vector3(18, 18, 18),
  });
  /** Horizontal velocity for accel/decel + camera lead (open-world feel). */
  private playerVel = new THREE.Vector3();
  private _dustAccum = 0;
  /** Resolved HUD skills for archetype mapping; idx fallback works if unset. */
  private hudSkills: (ClassSkill | undefined)[] = [];
  private pointerDown = false;
  private attackHeld = false;
  private pointerGround: THREE.Vector3 | null = null;
  private animFrameId = 0;
  private floorPlane!: THREE.Mesh;
  private raycaster = new THREE.Raycaster();
  private container: HTMLDivElement | null = null;

  private playerGroup: THREE.Group | null = null;
  private playerMixer: THREE.AnimationMixer | null = null;
  private playerAnimator: PlayerAnimator | null = null;
  private initStats!: PlayerInitStats;
  private playerPos = new THREE.Vector3(0, 0, 0);
  private _rmTmp = new THREE.Vector3();
  /** Per-frame scratch vectors — never allocate in the hot loop. */
  private _tmpV2 = new THREE.Vector2();
  private _tmpV3a = new THREE.Vector3();
  private _tmpV3b = new THREE.Vector3();
  private _tmpV3c = new THREE.Vector3();
  private _projectScratch = new THREE.Vector3();
  private _slashTargetScratch: Array<{ id: string; position: THREE.Vector3; alive: boolean }> = [];
  private _enemyTargetScratch: CombatTarget[] = [];
  /** Fixed-step combat sim (30 Hz) — render stays vsync. */
  private _simAccum = 0;
  private readonly SIM_DT = 1 / 30;
  private readonly SIM_MAX_STEPS = 3;
  /** HUD bridge throttle — skill skill says never React every rAF. */
  private _notifyAccum = 0;
  private readonly NOTIFY_INTERVAL = 1 / 18;
  private _stateDirty = true;
  private _frame = 0;
  private _perkModsCache: PerkCombatMods | null = null;
  private _perkModsFrame = -1;
  private playerTarget: THREE.Vector3 | null = null;
  private playerSpeed = 6;
  private playerFacing = 0;
  private playerAttackCooldown = 0;
  private playerMaxAttackCooldown = 0.75;
  private indicatorRing: THREE.Mesh | null = null;

  // Real dungeon geometry (forge-scene.glb): floor + wall colliders via BVH.
  private dungeonMap: DungeonMap | null = null;
  /** Procedural maze walls + large rooms (annihilate Box-style solids). */
  private maze: MazeArena | null = null;
  private mapReady = false;
  /** Public hook fired once the dungeon GLB + collision BVH are ready. */
  public onMapReady: (() => void) | null = null;
  private readonly PLAYER_RADIUS = 0.5;
  private readonly PLAYER_HEIGHT = 1.9;

  private playerHp = 500;
  private playerMaxHp = 500;
  private playerMana = 200;
  private playerMaxMana = 200;
  private playerLevel = 1;
  private playerXp = 0;
  private playerBaseDamage = 35;
  private playerDefense = 5;
  private playerCritChance = 0.15;

  private keys = new Set<string>();
  private enemies: EnemyInstance[] = [];
  private enemyTemplates: EnemyTemplate[] = [];
  private enemyIdCounter = 0;
  private damageNumbers: DamageNumber[] = [];
  private idCounter = 0;
  private combatLog: string[] = [];
  private targetEnemy: EnemyInstance | null = null;

  public onStateUpdate: ((s: GameState) => void) | null = null;

  private torchLights: THREE.PointLight[] = [];
  private loaded = false;
  private DUNGEON = 90;

  // Larger-map / best-practice additions.
  private sun: THREE.DirectionalLight | null = null;
  private groundMesh: THREE.Mesh | null = null;
  private rockField: THREE.InstancedMesh | null = null;
  private terrainMesh: THREE.Mesh | null = null;
  private camp: CampHandle | null = null;
  private pirates: PirateHandle[] = [];
  private townsfolk: Townsperson[] = [];
  private coveProps: THREE.Object3D[] = [];
  private worldCollectables: LoadedWorldProp[] = [];
  private collectedPropIds = new Set<string>();
  private coveLabel: THREE.Sprite | null = null;
  private coveCenter = new THREE.Vector3(70, 0, -14);
  private disposed = false;
  private harvestField: HarvestField | null = null;
  private mapSeed = (Math.random() * 0xffffffff) >>> 0;
  /** Round 1 = first island; captain re-sail increments. */
  private islandRound = 1;
  private bossEnemyId: string | null = null;
  private nearbyPirate: NearbyPirateInfo | null = null;
  private nearbyHarvestLabel: string | null = null;
  /** Callback when captain sails — React can hard-refresh or show toast. */
  public onMapReseed: ((seed: number) => void) | null = null;
  public onOpenVendor: (() => void) | null = null;
  public onOpenTraveler: (() => void) | null = null;
  public onSailBoss: (() => void) | null = null;
  /** Island progression director (persisted run, missions, events, sail gate). */
  private runDirector = new RunDirector();
  private fog: FogOfWar | null = null;
  private pathMap: IslandPathMap | null = null;
  private pathVisual: THREE.Group | null = null;
  private currentBeat: GameBeat | null = null;
  private fogSaveAccum = 0;
  private partyLoadErrors: string[] = [];
  private mpRoom: string | null = null;
  private remoteAvatars = new Map<
    string,
    { group: THREE.Group; target: THREE.Vector3; yaw: number; name: string }
  >();
  private worldManifest: WorldChunkManifest | null = null;
  private worldChunkMap: WorldChunkMapHandle | null = null;
  private nearbyClaimZone: WorldZone | null = null;
  private currentZone: WorldZone | null = null;
  private claimsOwned = 0;
  /** Attribute-ish regen inputs (from player stats at init). */
  private regenIntellect = 4;
  private regenWisdom = 3;
  private regenVitality = 3;
  private regenEndurance = 2;
  private combatUntil = 0;

  private fighterKit: FighterKit = getActiveFighterKit();
  private slashField: SlashWaveField | null = null;
  private auras: AuraField | null = null;
  private projectileField: ProjectileField | null = null;
  private pendingStrikes: PendingStrikeField | null = null;
  private warningFx: WarningEffectField | null = null;
  private camps: CampHandle[] = [];
  private darkElfCamp: DarkElfCampHandle | null = null;
  /** Crystal + 4 assets + barriers (damageable) around the dark-elf ritual. */
  private darkElfEvent: DarkElfEventWithVisuals | null = null;
  private readonly darkElfCampAnchor = new THREE.Vector3(-42, 0, -32);
  private claimFlags: ClaimFlagField | null = null;
  /** Player-built camps (fence + watchtower) — enemy exclusion zones. */
  private playerCamps: PlayerCampField | null = null;
  private farmField: { dispose: () => void } | null = null;
  private zoneDebris: { dispose: () => void } | null = null;
  private sceneBaked = false;
  private openWater: OpenWaterHandle | null = null;
  private harborDistrict: HarborDistrictHandle | null = null;
  private playDomain: PlayDomain = "land";
  private wispEvents: WispEventField | null = null;
  private claimPlaceCd = 0;
  /** Boss special attack cooldowns by enemy id. */
  private bossSpecialCd = new Map<string, number>();
  /** Per-enemy special cast counter for deterministic ability picks. */
  private bossSpecialCount = new Map<string, number>();
  /** fighterId → brain for hero-rival enemies. */
  private enemyBrains = new Map<string, BrainArchetype>();
  private playerAuraElement = getActiveCombatProfile().auraElement;
  /** Party allies (max 2) — Grudge6 units with AI brains. */
  private allies: AllyAgent[] = [];
  private grudge6Factory = new Grudge6Factory();
  private partySpawned = false;
  /** True while a manual V-key summon is in flight. */
  private partySummoning = false;
  /** -1 = none; 0-4 = skill awaiting ground placement. */
  private pendingSkillIdx = -1;
  /**
   * Active mouse-ghost placement (skill AoE, combat deployable, or camp).
   * LMB confirms; Esc cancels. Ghost follows pointerGround.
   */
  private placeMode:
    | null
    | {
        kind: "skill_aoe";
        skillIdx: number;
        maxRange: number;
        radius: number;
        color: number;
      }
    | {
        kind: "deployable";
        /** Fighter kit skill index, or -1 for legacy HUD skill bar. */
        skillIdx: number;
        legacyHud: boolean;
        deployKind: DeployableKind;
        maxRange: number;
        radius: number;
        color: number;
        damage: number;
        manaCost: number;
        cooldown: number;
      }
    | {
        kind: "camp";
        radius: number;
        padId: string | null;
        padX: number;
        padZ: number;
      } = null;
  private placeGhost: THREE.Group | null = null;
  private skillCdUntil = [0, 0, 0, 0, 0];
  private specialCdUntil = 0;
  private blocking = false;
  private jumpVel = 0;
  private playerY = 0;
  private dodgeIframeUntil = 0;
  /** Next time Shift dodge may fire (ms, performance.now). */
  private dodgeCdUntil = 0;
  /** Tag-based combat FSM (annihilate Maria pattern). */
  private combatFsm = new CombatStateMachine();
  private skillCursor: THREE.Mesh | null = null;
  private skillCursorMat: THREE.MeshBasicMaterial | null = null;

  /** Live perk combat modifiers — cached once per sim frame. */
  private perkMods(): PerkCombatMods {
    if (this._perkModsFrame !== this._frame || !this._perkModsCache) {
      this._perkModsCache = getActivePerkMods();
      this._perkModsFrame = this._frame;
    }
    return this._perkModsCache;
  }

  /** Enemy scaling for current island round: HP/dmg grow each re-sail. */
  private difficultyMult(): number {
    return 1 + (this.islandRound - 1) * 0.28;
  }

  private scaleTemplate(t: EnemyTemplate): EnemyTemplate {
    const m = this.difficultyMult();
    return {
      ...t,
      hp: Math.round(t.hp * m),
      damage: Math.round(t.damage * (1 + (this.islandRound - 1) * 0.18)),
      name: this.islandRound > 1 ? `R${this.islandRound} ${t.name}` : t.name,
    };
  }
  private hoveredEnemy: EnemyInstance | null = null;
  private hoverEmissive = new Map<THREE.MeshStandardMaterial, { hex: number; intensity: number }>();
  private _moveHandler!: (e: MouseEvent) => void;
  private _downHandler!: (e: MouseEvent) => void;
  private _upHandler!: (e: MouseEvent) => void;
  private _contextHandler!: (e: MouseEvent) => void;
  private fx: FX2D | null = null;

  init(
    container: HTMLDivElement,
    stats: PlayerInitStats,
    enemyTemplates: EnemyTemplate[],
  ) {
    this.container = container;
    this.playerHp = this.playerMaxHp = stats.hp;
    this.playerMana = this.playerMaxMana = stats.mana;
    this.playerLevel = stats.level;
    this.playerBaseDamage = stats.baseDamage;
    this.playerDefense = stats.defense;
    this.playerCritChance = stats.critChance;
    this.playerMaxAttackCooldown = stats.attackSpeed;
    this.enemyTemplates = enemyTemplates;
    this.initStats = stats;
    // Soft attribute proxies for regen (class-ish defaults until full attr pass-through)
    const cls = (stats.charClass ?? "warrior").toLowerCase();
    this.regenIntellect = cls.includes("mage") || cls.includes("sorc") ? 10 : cls.includes("priest") ? 8 : 4;
    this.regenWisdom = cls.includes("mage") || cls.includes("priest") ? 8 : 3;
    this.regenVitality = cls.includes("warrior") || cls.includes("tank") ? 8 : 4;
    this.regenEndurance = cls.includes("warrior") || cls.includes("ranger") ? 6 : 3;
    // Attribute stones + fighter loadout → speed / defense baseline
    try {
      const lo = getGameLoadout();
      this.playerSpeed = 6 * lo.combat.moveSpeedMult;
      this.playerDefense = Math.round(stats.defense + lo.combat.defense * 40);
    } catch {
      /* ignore */
    }
    this.isoCam.look.copy(this.playerPos);

    // Restore persistent island run (seed / round / phase / fog).
    this.runDirector = new RunDirector();
    this.mapSeed = this.runDirector.run.seed;
    this.islandRound = this.runDirector.run.round;

    const w = container.clientWidth;
    const h = container.clientHeight;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x060608);
    // Linear fog: nearer start so open-world depth reads without killing VFX mid-range.
    this.scene.fog = new THREE.Fog(0x07060a, 36, 130);

    const aspect = w / h;
    const d = this.isoCam.d;
    this.camera = new THREE.OrthographicCamera(-d * aspect, d * aspect, d, -d, 0.1, 360);
    this.camera.position.set(18, 18, 18);
    this.camera.lookAt(0, 0, 0);

    try {
      this.renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
        stencil: false,
      });
    } catch {
      this.renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: "high-performance" });
    }
    this.renderer.setSize(w, h);
    // Cap DPR hard — 1.25 keeps retina readable without 2× pixel fill.
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
    this.renderer.shadowMap.enabled = true;
    // PCF is clearer and cheaper than PCFSoft.
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    // Manual shadow updates every other frame (see animate) — big fill win.
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.shadowMap.needsUpdate = true;
    container.appendChild(this.renderer.domElement);

    this.timer.connect(document);
    this.loader = createGltfLoader();
    configureDracoLoader(this.loader);
    this.skillVfx = new SkillVfx(this.scene, this.loader);
    this.particles = new ParticleVfx(this.scene);
    this.telegraphs = new TelegraphField(this.scene);
    this.deployables = new DeployableManager(this.scene);
    this.slashField = new SlashWaveField(this.scene, this.particles);
    this.auras = new AuraField(this.scene);
    this.projectileField = new ProjectileField(this.scene, this.particles, this.telegraphs);
    this.warningFx = new WarningEffectField(this.scene);
    this.pendingStrikes = new PendingStrikeField(this.telegraphs, this.particles, this.warningFx);
    this.fighterKit = getActiveFighterKit();
    this.playerAuraElement = getActiveCombatProfile().auraElement;
    // Ground-AoE placement ring (shown while a skill is pending).
    this.skillCursorMat = new THREE.MeshBasicMaterial({
      color: 0x66ccff,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.skillCursor = new THREE.Mesh(new THREE.RingGeometry(0.85, 1.0, 48), this.skillCursorMat);
    this.skillCursor.rotation.x = -Math.PI / 2;
    this.skillCursor.position.y = 0.12;
    this.skillCursor.visible = false;
    this.skillCursor.renderOrder = 6;
    this.scene.add(this.skillCursor);
    // Bloom + vignette + warm grade (see combat/bloom.ts). Null if headless / no-GPU.
    this.bloom = makeBloomComposer(this.renderer, this.scene, this.camera, w, h, {
      strength: 0.64,
      radius: 0.5,
      threshold: 0.8,
      resolutionScale: 0.5,
      vignette: 0.8,
      warmth: 0.05,
    });

    this.buildDungeon();
    this.initIslandSystems();
    this.initWorldChunkMap();
    this.loadEnvironment();
    const campUrl = `${import.meta.env.BASE_URL}models/buildings/orc_camp_set.glb`;
    // Green orc war-camp near east ridge.
    this.camp = buildOrcCamp(this.loader, this.scene, campUrl, {
      theme: "orc",
      offset: new THREE.Vector3(38, 0, 28),
      // Keep war-camp human-scale vs ~2m fighter (was nearly map-sized at times).
      scale: 0.72,
      name: "orc_camp",
    });
    this.camps.push(this.camp);
    // Dark-elf camp prefab (backdrop) + crystal event (4 assets, barriers, HP).
    this.darkElfCamp = buildDarkElfCampPrefab(
      this.loader,
      this.scene,
      this.darkElfCampAnchor.clone(),
      campUrl,
    );
    if (this.darkElfCamp?.group) {
      this.darkElfCamp.group.scale.multiplyScalar(0.75);
    }
    this.darkElfEvent = buildDarkElfCrystalEvent(
      this.loader,
      this.scene,
      this.darkElfCampAnchor.clone(),
    );
    this.log("Void crystal hums — shatter the four pylons and barriers around it.");
    this.claimFlags = createClaimFlagField(this.scene);
    this.playerCamps = createPlayerCampField(this.scene);
    this.wispEvents = createWispEventField(this.scene);
    // Harvest nodes near cove only — no auto camp / yellow ring.
    this.plantStarterClaim();
    this.spawnWispEvents();
    this.buildPirateCove();
    this.buildHarborAndOpenWater();
    this.buildHarvestables();
    this.buildWorldCollectables();
    this.scatterGenerativeProps();
    this.scatterModularOutposts();
    this.scatterFarmFields();
    this.bakeWorldAfterScatter();
    this.setupLighting();
    this.loadPlayerModel();
    this.spawnInitialEnemies();
    // Boss only after mission kill goal (or resume mid boss fight / victory).
    this.maybeSpawnRunBoss();
    this.setupInput(container);
    this.log(this.runDirector.zone);
    this.log(
      `${this.runDirector.mission.title}: 0/${this.runDirector.mission.killGoal} culls · E at captain to sail after Colossus`,
    );

    this.fx = new FX2D(container);

    window.addEventListener("resize", this.onResize);
    this.renderer.domElement.addEventListener("wheel", this._onWheel, { passive: false });
    this.animate();
  }

  /** Orthographic wheel zoom — smooth target; applied each frame via isoCam. */
  private _onWheel = (e: WheelEvent) => {
    isoCameraWheel(this.isoCam, e, 0.9, 1.7);
  };

  private applyCameraFrustum() {
    if (!this.container || !this.camera) return;
    const w = this.container.clientWidth;
    const h = Math.max(1, this.container.clientHeight);
    applyOrthoFrustum(this.camera, this.isoCam.d, w / h);
  }

  private buildDungeon() {
    const D = this.DUNGEON;

    // Large textured stone floor spanning the whole map. The cobble pattern is
    // generated procedurally (no external fetch), repeat-tiled, and uses the
    // renderer's max anisotropy so it stays crisp at grazing camera angles.
    const aniso = this.renderer.capabilities.getMaxAnisotropy();
    const groundMat = makeGroundMaterial(Math.round(D / 2), aniso);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(D * 2, D * 2), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    ground.receiveShadow = true;
    this.scene.add(ground);
    this.groundMesh = ground;

    // Noise-displaced terrain ringing the flat arena — rolling foothills rising
    // into a distant mountain ridge. The inner `D` half stays flat so all
    // gameplay (player + enemies clamp to ±(D-1)) keeps walking on y≈0.
    const terrain = makeTerrainSkirt(D);
    this.scene.add(terrain);
    this.terrainMesh = terrain;

    // Scattered boulders — visual + minable stone (wired in buildHarvestables).
    // 110 instances is plenty for fill; each still casts into the 1k shadow map.
    const rocks = makeRockField(110, D * 0.28, D - 4);
    this.scene.add(rocks.mesh);
    this.rockField = rocks.mesh;
    // Stash for harvest wiring (positions live until buildHarvestables runs).
    (this as unknown as { _rockFieldMeta?: { positions: THREE.Vector3[]; scales: number[] } })._rockFieldMeta = {
      positions: rocks.positions,
      scales: rocks.scales,
    };

    // Invisible click plane — covers the playable area for click-to-move
    // raycasting. Sits just above the visible ground so floor picks are stable.
    const clickPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(D * 2, D * 2),
      new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide })
    );
    clickPlane.rotation.x = -Math.PI / 2;
    clickPlane.position.y = 0.05;
    this.scene.add(clickPlane);
    this.floorPlane = clickPlane;

    const ringGeo = new THREE.RingGeometry(0.3, 0.45, 24);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide });
    this.indicatorRing = new THREE.Mesh(ringGeo, ringMat);
    this.indicatorRing.rotation.x = -Math.PI / 2;
    this.indicatorRing.position.y = 0.08;
    this.indicatorRing.visible = false;
    this.scene.add(this.indicatorRing);

    // Maze walls + large rooms (seeded; re-sail gets a new layout).
    this.buildMaze();
  }

  /**
   * Seeded maze corridors with large combat rooms every so often.
   * Patterns from annihilate-reference Box/Level: static solids, slide collision.
   */
  private buildMaze() {
    this.maze?.dispose();
    this.maze = new MazeArena({
      halfExtent: this.DUNGEON,
      cellSize: 5,
      wallHeight: 3.4,
      seed: this.mapSeed ^ 0x4d415a45, // "MAZE"
      largeRoomCount: 7,
      openZones: [
        { x: 0, z: 0, half: 14 }, // player hub
        { x: this.coveCenter.x, z: this.coveCenter.z, half: 16 }, // pirate cove
        { x: -52, z: 38, half: 12 }, // boss staging default
        { x: 0, z: -8, half: 8 }, // camp / forge approach
        // Dark-elf crystal event — clear yard so 4 assets + barriers + spawns fit
        { x: this.darkElfCampAnchor.x, z: this.darkElfCampAnchor.z, half: 18 },
      ],
    });
    this.scene.add(this.maze.group);
  }

  /** Zone chunk map — Diablo-2 style seeded districts + waypoint graph. */
  private initWorldChunkMap() {
    this.worldChunkMap?.dispose();
    this.worldChunkMap = null;
    this.worldManifest = generateWorldChunkManifest(
      this.mapSeed,
      this.islandRound,
      this.DUNGEON,
    );
    this.worldChunkMap = buildWorldChunkMap(this.scene, this.worldManifest);
    this.claimsOwned = this.worldManifest.zones.filter((z) => z.owner === "player").length;
    // Rebuild maze open yards from zone anchors (deterministic per seed).
    this.rebuildMazeOpenZonesFromManifest();
    this.log(
      `World chart act#${this.worldManifest.actSeed.toString(16).slice(0, 4)}: ${this.worldManifest.zones.length} zones · ${this.worldManifest.waypointPath.length} waypoints · seed #${this.mapSeed.toString(16)}`,
    );
  }

  /** Expand maze open circles from zone centers so packs/camps fit. */
  private rebuildMazeOpenZonesFromManifest() {
    if (!this.maze || !this.worldManifest) return;
    // MazeArena is rebuilt only on re-sail; openZones set at construction.
    // Soft-clear walls near critical zones by regenerating maze with zone opens.
    const opens = [
      { x: 0, z: 0, half: 14 },
      { x: this.coveCenter.x, z: this.coveCenter.z, half: 16 },
      { x: this.darkElfCampAnchor.x, z: this.darkElfCampAnchor.z, half: 18 },
      ...this.worldManifest.zones
        .filter((z) => z.kind === "boss_gate" || z.kind === "harbor" || z.claimable || z.kind === "farm")
        .map((z) => ({ x: z.x, z: z.z, half: Math.max(8, z.radius * 0.85) })),
    ];
    this.maze?.dispose();
    this.maze = new MazeArena({
      halfExtent: this.DUNGEON,
      cellSize: 5,
      wallHeight: 3.4,
      seed: this.mapSeed ^ 0x4d415a45,
      largeRoomCount: 7 + Math.min(4, this.islandRound),
      openZones: opens,
    });
    this.scene.add(this.maze.group);
    if (this.maze.group) {
      this.maze.group.name = "maze";
      this.maze.group.userData.bakeStatic = true;
    }
  }

  /**
   * After modular/farm/props stream, place instanced debris and freeze statics.
   * Async loads continue to attach; bake marks existing static roots.
   */
  private bakeWorldAfterScatter() {
    this.zoneDebris?.dispose();
    this.zoneDebris = null;
    if (this.worldManifest) {
      this.zoneDebris = scatterZoneDebris(
        this.scene,
        this.worldManifest.zones.map((z) => ({
          x: z.x,
          z: z.z,
          radius: z.radius,
          kind: z.kind,
        })),
        this.mapSeed ^ this.worldManifest.actSeed,
      );
    }
    // Defer final freeze so async atlas props land, then bake.
    window.setTimeout(() => {
      if (this.disposed) return;
      bakeIslandScene(this.scene);
      this.sceneBaked = true;
      this.log("Island scene baked — static batches frozen · instanced debris online.");
    }, 2200);
  }

  /**
   * Fog-of-war world map + seed-driven island road network.
   * Restores explored cells from the persisted island run.
   */
  private initIslandSystems() {
    // Paths first so open-zone layout can bias toward roads.
    if (this.pathVisual) {
      this.scene.remove(this.pathVisual);
      this.pathVisual.traverse((c) => {
        const m = c as THREE.Mesh;
        if (m.isMesh) {
          m.geometry?.dispose();
          const mat = m.material;
          if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
          else (mat as THREE.Material | undefined)?.dispose();
        }
      });
      this.pathVisual = null;
    }
    this.pathMap = generateIslandPaths(this.mapSeed, this.DUNGEON);
    const aniso = this.renderer?.capabilities?.getMaxAnisotropy?.() ?? 4;
    this.pathVisual = this.pathMap.buildVisual(aniso);
    this.scene.add(this.pathVisual);
    if (this.terrainMesh) this.pathMap.flattenTerrain(this.terrainMesh);

    this.fog?.dispose();
    this.fog = new FogOfWar(this.scene, this.DUNGEON, 2.5);
    const saved = this.runDirector.run.exploredCells ?? [];
    if (saved.length) this.fog.loadExplored(saved);
    // Seed vision at hub + cove so the player always has a foothold on the map.
    this.fog.revealAt(0, 0, 14);
    this.fog.revealAt(this.coveCenter.x, this.coveCenter.z, 12);
  }

  /** Spawn Island Colossus when mission complete or resuming a boss phase. */
  private maybeSpawnRunBoss() {
    const phase = this.runDirector.phase;
    if (phase === "victory" || phase === "sail") return;
    if (phase === "boss_alert" || phase === "boss_fight") {
      if (!this.bossEnemyId) {
        this.spawnDungeonBoss();
        this.runDirector.beginBossFight();
      }
      return;
    }
    // explore — boss waits for kill goal
  }

  private processRunEvents(events: RunEvent[]) {
    for (const ev of events) {
      if (ev.type === "mission_progress") {
        // Quiet progress in log only; beat card when goal hits via boss_alert
        if (ev.kills === 1 || ev.kills === Math.floor(ev.goal / 2) || ev.kills >= ev.goal - 1) {
          this.log(`Mission ${ev.kills}/${ev.goal}`);
        }
      } else if (ev.type === "boss_alert") {
        this.currentBeat = {
          kind: "boss_alert",
          title: "Island Colossus Approaches",
          subtitle: `${this.runDirector.mission.title} complete — the titan stirs in the ruins.`,
        };
        this.log("Boss alert — Island Colossus has entered the field!");
        if (!this.bossEnemyId) this.spawnDungeonBoss();
        this.runDirector.beginBossFight();
      } else if (ev.type === "boss_defeated") {
        this.currentBeat = {
          kind: "boss_defeated",
          title: "Colossus Fallen",
          subtitle: "Return to Pirate Cove and speak with Captain Barbarossa (E) to sail onward.",
        };
        this.log("Victory — speak to the captain at Pirate Cove to re-sail.");
      } else if (ev.type === "sail") {
        this.currentBeat = {
          kind: "sail",
          title: `Island Round ${ev.round}`,
          subtitle: `New chart · seed #${ev.seed.toString(16)} · foes scale up.`,
        };
      } else if (ev.type === "island_event") {
        this.applyIslandEvent(ev.event);
      }
    }
  }

  private applyIslandEvent(ev: ActiveIslandEvent) {
    this.currentBeat = {
      kind: "island_event",
      title: ev.title,
      subtitle: ev.description,
    };
    this.log(`Island event: ${ev.title}`);
    switch (ev.kind) {
      case "supply_cache": {
        addResource("wood", 8 + this.islandRound);
        addResource("stone", 6 + this.islandRound);
        this.playerMana = Math.min(this.playerMaxMana, this.playerMana + 40);
        this.log("Supply cache looted (+wood/stone, mana surge).");
        break;
      }
      case "shrine_buff":
        this.runDirector.applyShrineBuff(90);
        this.log("Grudge shrine blessing — damage and regen for 90s.");
        break;
      case "merchant_visit":
        this.log("A drift merchant signals near the crossroads — vendor open.");
        this.onOpenVendor?.();
        break;
      case "relic_find":
        this.playerXp += 120 + this.islandRound * 40;
        this.log("Relic unearthed — bonus XP.");
        break;
      case "ambush_wave":
      case "patrol_elite": {
        const n = ev.kind === "patrol_elite" ? 1 : 3 + Math.min(3, this.islandRound);
        const rng = mulberry(this.mapSeed ^ (this.runDirector.run.killsThisRound * 9176));
        for (let i = 0; i < n; i++) {
          const t =
            this.enemyTemplates[Math.floor(rng() * Math.max(1, this.enemyTemplates.length))] ??
            ({
              id: "ambush_skirmisher",
              name: ev.kind === "patrol_elite" ? "Elite Patrol" : "Ambush Skirmisher",
              type: "humanoid",
              tier: ev.kind === "patrol_elite" ? 4 : 2,
              hp: 180,
              damage: 18,
            } satisfies EnemyTemplate);
          const pos = this.pathMap?.sampleSpawnPoint(rng) ?? new THREE.Vector3(ev.x, 0, ev.z);
          pos.x += (rng() - 0.5) * 4;
          pos.z += (rng() - 0.5) * 4;
          this.createEnemy(this.scaleTemplate(t), this.snapToWalkable(pos));
        }
        break;
      }
      case "storm_front":
        this.fog?.revealAt(this.playerPos.x, this.playerPos.z, 6);
        this.log("Ash storm — vision shrinks; elites drop richer spoils.");
        break;
      default:
        break;
    }
    this.runDirector.clearActiveEvent();
  }

  /** Public: dismiss beat overlay. */
  dismissBeat() {
    this.currentBeat = null;
    this.notifyState(true);
  }

  /** Public: sail to next island (UI / captain). */
  sailToNextIsland() {
    if (!this.runDirector.canSail() && this.runDirector.phase !== "victory") {
      this.log("Defeat the Island Colossus before sailing.");
      return false;
    }
    const ev = this.runDirector.sailToNextIsland();
    this.processRunEvents([ev]);
    this.applySailState();
    // Refresh archipelago chart for new round seed
    if (this.openWater) {
      const chart = generateArchipelago(this.mapSeed, this.islandRound, {
        coveX: this.coveCenter.x,
        coveZ: this.coveCenter.z,
        seaHalfExtent: 220,
      });
      this.openWater.setChart(chart);
    }
    return true;
  }

  /**
   * B — board skiff for open water, or land at nearest island / home dock.
   * Flexible: works from dock or mid-sea landfall.
   */
  tryToggleEmbark() {
    if (!this.openWater) {
      this.log("Open water systems offline.");
      return;
    }
    if (this.playDomain === "open_water") {
      const isle = this.openWater.nearestIsland(32);
      if (!isle) {
        this.log("No landfall in range — sail closer to an island buoy.");
        return;
      }
      // Land: home dock or satellite landfall
      if (isle.isHome) {
        const dock = new THREE.Vector3(this.coveCenter.x + 2, 0, this.coveCenter.z + 1);
        this.openWater.disembark(dock);
        this.playDomain = "land";
        this.playerPos.copy(dock);
        this.playerPos.x -= 2;
        if (this.playerGroup) {
          this.playerGroup.visible = true;
          this.playerGroup.position.set(this.playerPos.x, 0, this.playerPos.z);
        }
        this.log(`Landed at ${isle.name}. Harbor shops & training are ashore.`);
      } else {
        // Satellite landfall — require colossus cleared for voyage (flexible: allow explore land)
        this.openWater.disembark(
          new THREE.Vector3(isle.x - isle.radius * 0.4, 0, isle.z),
        );
        this.playDomain = "land";
        this.playerPos.set(isle.x - isle.radius * 0.5, 0, isle.z);
        if (this.playerGroup) {
          this.playerGroup.visible = true;
          this.playerGroup.position.set(this.playerPos.x, 0, this.playerPos.z);
        }
        this.log(
          `Landfall ${isle.name} (L${isle.areaLevel}). Sail home or press Sail when Colossus is down for a full reseed.`,
        );
        // Optional full reseed if voyage unlocked
        if (this.runDirector.canSail() || this.runDirector.phase === "victory") {
          this.log("Voyage ready — use captain Sail for a full next-island generation.");
        }
      }
      this.notifyState(true);
      return;
    }

    // Board near docked skiff
    const dock = new THREE.Vector3(this.coveCenter.x + 6, 0, this.coveCenter.z - 3);
    const d = Math.hypot(this.playerPos.x - dock.x, this.playerPos.z - dock.z);
    if (d > 10) {
      this.log("Move to the docked skiff (east jetty), then press B to board.");
      return;
    }
    this.openWater.boatPos.copy(dock);
    this.openWater.embark();
    this.playDomain = "open_water";
    if (this.playerGroup) this.playerGroup.visible = false;
    this.playerTarget = null;
    this.attackHeld = false;
    this.log(
      "Helm free — WASD sail, B land at buoy/home. Party crew rides the deck. Open-water combat next.",
    );
    this.notifyState(true);
  }

  /** Public: respawn at Pirate Cove after death. */
  respawnAtCove() {
    if (this.playerHp > 0) return;
    this.playerHp = Math.max(1, Math.floor(this.playerMaxHp * 0.5));
    this.playerMana = Math.floor(this.playerMaxMana * 0.5);
    this.playerPos.set(this.coveCenter.x - 4, 0, this.coveCenter.z);
    this.playerY = 0;
    this.jumpVel = 0;
    if (this.playerGroup) {
      this.playerGroup.position.set(this.playerPos.x, 0, this.playerPos.z);
    }
    this.log("You wash ashore at Pirate Cove…");
    this.notifyState(true);
  }

  /** Multiplayer: set room label for HUD. */
  setMpRoom(room: string | null) {
    this.mpRoom = room;
    this.notifyState(true);
  }

  /**
   * Multiplayer: sync remote player avatars from Socket.IO snapshots.
   * Capsules lerp toward server positions; local id is skipped.
   */
  syncRemotePlayers(snaps: PlayerSnapshot[], localId: string | null) {
    const seen = new Set<string>();
    for (const s of snaps) {
      if (localId && s.id === localId) continue;
      seen.add(s.id);
      let rem = this.remoteAvatars.get(s.id);
      if (!rem) {
        const group = this.makeRemoteAvatarCapsule(0x4488ff);
        group.position.set(s.p.x, 0, s.p.z);
        this.scene.add(group);
        rem = {
          group,
          target: new THREE.Vector3(s.p.x, s.p.y, s.p.z),
          yaw: s.r,
          name: s.id.slice(0, 6),
        };
        this.remoteAvatars.set(s.id, rem);
      }
      rem.target.set(s.p.x, s.p.y, s.p.z);
      rem.yaw = s.r;
    }
    for (const [id, rem] of this.remoteAvatars) {
      if (!seen.has(id)) {
        this.scene.remove(rem.group);
        rem.group.traverse((c) => {
          const m = c as THREE.Mesh;
          if (m.isMesh) {
            m.geometry?.dispose();
            (m.material as THREE.Material)?.dispose();
          }
        });
        this.remoteAvatars.delete(id);
      }
    }
  }

  private makeRemoteAvatarCapsule(color: number): THREE.Group {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.35, 1.0, 4, 8),
      new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.15 }),
    );
    body.position.y = 1.0;
    body.castShadow = true;
    g.add(body);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.45, 0.58, 24),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.05;
    g.add(ring);
    return g;
  }

  private applySailState() {
    this.mapSeed = this.runDirector.run.seed;
    this.islandRound = this.runDirector.run.round;
    // Clear enemies and respawn scaled for the new round.
    for (const en of [...this.enemies]) {
      this.scene.remove(en.model.group);
      en.model.group.userData.disposed = true;
      if (en.model.kit) disposeKitModel(en.model);
      else if (en.model.isGLB) disposeMonsterModel(en.model);
    }
    this.enemies = [];
    this.enemyBrains.clear();
    this.bossEnemyId = null;
    this.bossSpecialCd.clear();
    this.projectileField?.clear();
    this.pendingStrikes?.clear();
    this.auras?.clear();
    if (this.playerGroup) {
      this.auras?.attach(this.playerAuraElement, {
        follow: this.playerGroup,
        radius: 1.35,
        yOffset: 0.05,
      });
    }
    this.buildMaze();
    this.initIslandSystems();
    this.initWorldChunkMap();
    this.buildHarvestables();
    this.spawnInitialEnemies();
    this.maybeSpawnRunBoss();
    this.playerPos.set(0, 0, 0);
    if (this.maze) {
      const hub = this.maze.nearestWalkable(0, 0);
      this.playerPos.set(hub.x, 0, hub.z);
    }
    this.playerY = 0;
    this.jumpVel = 0;
    this.dodgeCdUntil = 0;
    this.dodgeIframeUntil = 0;
    this.combatFsm.reset();
    if (this.playerGroup) {
      this.playerGroup.position.set(this.playerPos.x, 0, this.playerPos.z);
    }
    this.playerHp = Math.min(this.playerMaxHp, this.playerHp + this.playerMaxHp * 0.35);
    this.playerMana = Math.min(this.playerMaxMana, this.playerMana + this.playerMaxMana * 0.4);
    const mult = this.difficultyMult();
    this.log(
      `Round ${this.islandRound} — island #${this.mapSeed.toString(16)} · enemies ×${mult.toFixed(2)}`,
    );
    this.onMapReseed?.(this.mapSeed);
    this.notifyState(true);
  }

  /**
   * Environment setup. Maze is built in `buildDungeon()`; map is ready once
   * walls exist. Optional forge-scene GLB remains disabled (flat + maze SSOT).
   */
  private loadEnvironment() {
    this.mapReady = true;
    this.onMapReady?.();
    this.notifyState();
  }

  /**
   * Resolve the just-moved player against maze walls (AABB slide, annihilate
   * Box-style), dark-elf barriers, and optional dungeon BVH.
   * Floor stays flat y=0 unless BVH floor.
   */
  private resolvePlayer() {
    const dm = this.dungeonMap;
    if (dm?.ready) dm.collideHorizontal(this.playerPos, this.PLAYER_RADIUS, this.PLAYER_HEIGHT);
    // Maze walls — primary layout collision for the open-arena path.
    this.maze?.collideHorizontal(this.playerPos, this.PLAYER_RADIUS);
    // Living void barriers / crystal / pylons at the dark-elf event.
    this.darkElfEvent?.collideHorizontal(this.playerPos, this.PLAYER_RADIUS);
    const D = this.DUNGEON - 1;
    this.playerPos.x = Math.max(-D, Math.min(D, this.playerPos.x));
    this.playerPos.z = Math.max(-D, Math.min(D, this.playerPos.z));
    const fy = dm?.ready
      ? dm.sampleFloorY(this.playerPos.x, this.playerPos.z, this.playerPos.y + 0.6)
      : null;
    this.playerPos.y = fy ?? 0;
  }

  /**
   * Damage wisps + dark-elf event structures inside a world circle
   * (skills / AoEs). Returns true if anything took a hit.
   */
  private damageEventPropsInRadius(center: THREE.Vector3, radius: number, dmg: number): boolean {
    let hit = false;
    if (this.wispEvents) {
      for (const w of this.wispEvents.wisps) {
        if (!w.alive) continue;
        if (Math.hypot(w.position.x - center.x, w.position.z - center.z) <= radius + 0.8) {
          damageWisp(w, dmg);
          hit = true;
        }
      }
    }
    if (this.darkElfEvent?.isActive()) {
      for (const s of this.darkElfEvent.structures) {
        if (!s.alive) continue;
        if (Math.hypot(s.position.x - center.x, s.position.z - center.z) <= radius + s.hitRadius * 0.5) {
          const killed = this.darkElfEvent.damageStructure(s, dmg);
          if (killed) {
            this.log(s.kind === "crystal" ? "Void Crystal shattered!" : `${s.name} destroyed!`);
          }
          hit = true;
        }
      }
    }
    return hit;
  }

  /**
   * Continuous move + collide so high-speed frames (sprint / dodge residual)
   * cannot tunnel through maze walls or event barriers.
   */
  private movePlayerHorizontal(dx: number, dz: number) {
    if (this.maze) {
      this.maze.moveAndCollide(this.playerPos, dx, dz, this.PLAYER_RADIUS);
    } else {
      this.playerPos.x += dx;
      this.playerPos.z += dz;
    }
    this.darkElfEvent?.collideHorizontal(this.playerPos, this.PLAYER_RADIUS);
    const D = this.DUNGEON - 1;
    this.playerPos.x = Math.max(-D, Math.min(D, this.playerPos.x));
    this.playerPos.z = Math.max(-D, Math.min(D, this.playerPos.z));
  }

  /** Clamp an arbitrary XZ point to the playable arena and out of maze walls. */
  private clampToArena(v: THREE.Vector3) {
    const D = this.DUNGEON - 1;
    v.x = Math.max(-D, Math.min(D, v.x));
    v.z = Math.max(-D, Math.min(D, v.z));
    this.maze?.collideHorizontal(v, this.PLAYER_RADIUS * 0.9);
    this.darkElfEvent?.collideHorizontal(v, this.PLAYER_RADIUS * 0.9);
  }

  /** Snap a proposed spawn to a walkable maze cell (no enemies inside walls). */
  private snapToWalkable(v: THREE.Vector3): THREE.Vector3 {
    if (!this.maze) {
      this.clampToArena(v);
      return v;
    }
    if (!this.maze.isWalkableWorld(v.x, v.z)) {
      const w = this.maze.nearestWalkable(v.x, v.z);
      v.x = w.x;
      v.z = w.z;
    }
    this.clampToArena(v);
    return v;
  }

  /**
   * Pirate Cove — a neutral allied outpost: a docked ship (boat assistance) +
   * dock + treasure props, ringed by NEUTRAL pirate NPCs. The pirates animate
   * with their own embedded clips (idle + wave at a nearby player), are never
   * added to `this.enemies`, and carry no `enemyId`, so they can't be targeted
   * or attacked. They signal that the pirate crew will aid you in the Boss Arena.
   */
  /**
   * Harbor shops/training on-island + open-water ocean/skiff (archipelago chart).
   * Flexible: land gameplay unchanged; B boards skiff for open sea.
   */
  private buildHarborAndOpenWater() {
    this.harborDistrict?.dispose();
    this.harborDistrict = buildHarborDistrict(this.scene, this.coveCenter);

    const chart = generateArchipelago(this.mapSeed, this.islandRound, {
      coveX: this.coveCenter.x,
      coveZ: this.coveCenter.z,
      seaHalfExtent: 220,
    });
    this.openWater?.dispose();
    this.openWater = createOpenWater(this.scene, this.loader, {
      seaHalfExtent: chart.seaHalfExtent,
      chart,
      embarkWorld: new THREE.Vector3(this.coveCenter.x + 6, 0, this.coveCenter.z - 3),
      boatLength: 8.5,
    });
    this.playDomain = "land";
    this.log(
      `Harbor district online · archipelago ${chart.islands.length} isles · board skiff (B) for open water`,
    );
  }

  private buildPirateCove() {
    const c = this.coveCenter;
    // Dock scene — ships/dock sized for ~2m player (not stadium props).
    // Skiff is player helm vessel (OpenWater); large ship is scenery berth.
    this.loadCoveProp("world/Ship_Small.gltf", new THREE.Vector3(c.x + 6, 0, c.z - 3), 9, Math.PI * 0.18, {
      interact: "dock",
      label: "Docked skiff — B board · open water",
    });
    this.loadCoveProp("world/Ship_Large.gltf", new THREE.Vector3(c.x + 12, 0, c.z - 7), 12, Math.PI * 0.08, {
      interact: "dock",
      label: "Corsair ship",
    });
    this.loadCoveProp("world/Environment_Dock.gltf", new THREE.Vector3(c.x + 1, 0, c.z), 7.5, 0, {
      interact: "dock",
      label: "Jetty",
    });
    this.loadCoveProp("world/Environment_Dock_Pole.gltf", new THREE.Vector3(c.x - 4, 0, c.z + 4), 1.6, 0.3);
    // Loot chests — E to open (not auto-eat)
    this.loadCoveProp("world/Prop_Chest_Gold.gltf", new THREE.Vector3(c.x - 2.5, 0, c.z + 2.5), 1.05, 0.6, {
      interact: "chest",
      label: "Cove Loot Chest",
      lootGold: 45,
      lootWood: 4,
    });
    this.loadCoveProp("world/Prop_Chest_Gold.gltf", new THREE.Vector3(c.x + 3, 0, c.z + 5), 1.0, -0.3, {
      interact: "chest",
      label: "Jetty Chest",
      lootGold: 25,
      lootStone: 3,
    });
    this.loadCoveProp("world/Prop_Barrel.gltf", new THREE.Vector3(c.x - 3.5, 0, c.z + 1), 0.95, 0, {
      interact: "barrel",
      label: "Supply Barrel",
      lootWood: 2,
    });
    this.loadCoveProp("world/Prop_Anchor.gltf", new THREE.Vector3(c.x - 1.5, 0, c.z + 3.5), 1.15, -0.4);
    this.loadCoveProp("world/Prop_Coins.gltf", new THREE.Vector3(c.x - 2, 0, c.z + 1.5), 0.7, 0.2);

    // Dock Quest Traveler — tutorial NPC on the jetty
    this.spawnDockTraveler(new THREE.Vector3(c.x - 0.5, 0, c.z + 3.2));

    // Full crew: vendor (Anne), captain (Barbarossa), + crew for atmosphere.
    PIRATE_DEFS.forEach((def, i) => {
      const angle = (i / PIRATE_DEFS.length) * Math.PI * 1.1 - Math.PI * 0.55;
      const r = def.role === "captain" ? 4.2 : def.role === "vendor" ? 3.0 : 3.6;
      const px = c.x - 1.5 + Math.cos(angle) * r;
      const pz = c.z + 1.5 + Math.sin(angle) * r;
      const handle = loadPirate(def, this.loader);
      handle.group.position.set(px, 0, pz);
      handle.group.rotation.y = Math.atan2(c.x - px, c.z - pz);
      handle.group.userData.waveTimer = 1.5 + Math.random() * 4;
      handle.group.userData.pirateId = def.id;
      handle.group.userData.pirateRole = def.role ?? "crew";
      this.scene.add(handle.group);
      this.pirates.push(handle);
    });

    this.addCoveLabel(new THREE.Vector3(c.x + 1, 3.2, c.z));

    this.buildTownsfolk();
  }

  /** Dock Quest Traveler — KayKit/pirate NPC marker for tutorial opener. */
  private spawnDockTraveler(pos: THREE.Vector3) {
    // Reuse pirate crew mesh pipeline if available; else a lit marker + label.
    const def = PIRATE_DEFS.find((p) => p.role === "crew") ?? PIRATE_DEFS[0];
    if (def) {
      const handle = loadPirate(
        {
          ...def,
          id: "dock_traveler",
          name: "Dock Quest Traveler",
          title: "Tutorial Guide",
          role: "crew",
          prompt: "Speak — Dock Quest tutorial",
        },
        this.loader,
      );
      handle.group.position.copy(pos);
      handle.group.rotation.y = Math.PI;
      handle.group.userData.waveTimer = 2;
      handle.group.userData.pirateId = "dock_traveler";
      handle.group.userData.pirateRole = "traveler";
      handle.group.userData.isTraveler = true;
      this.scene.add(handle.group);
      this.pirates.push(handle);
    }
    // Beach marker for "learn_move" step
    const marker = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.45, 0.15, 12),
      new THREE.MeshStandardMaterial({
        color: 0xc5a059,
        emissive: 0x664400,
        emissiveIntensity: 0.5,
      }),
    );
    marker.position.set(pos.x - 8, 0.08, pos.z + 2);
    marker.name = "traveler_beach_marker";
    this.scene.add(marker);
    this.coveProps.push(marker);
  }

  /** Tall generative trees (2–4× character height) + stone piles + island rocks. */
  /** Plant a starter claim near the cove and script harvest nodes inside it. */
  private plantStarterClaim() {
    if (!this.claimFlags || !this.harvestField) return;
    // Called before harvest field exists on first init — re-run after buildHarvestables.
  }

  private applyClaimNodes(
    pos: THREE.Vector3,
    opts?: { radius?: number; nodeCount?: number; seed?: number },
  ) {
    if (!this.claimFlags || !this.harvestField) return;
    // Harvest scripting only — no yellow ring (camps use fence + tower visuals).
    const { claim, nodeSpawns } = placeClaimFlag(this.claimFlags, {
      position: pos,
      radius: opts?.radius ?? 12,
      owner: "player",
      factionId: "player",
      color: 0xc9a227,
      nodeCount: opts?.nodeCount ?? 8,
      maxTier: 2,
      seed: opts?.seed ?? (this.mapSeed ^ hashString("claim")),
      now: performance.now() / 1000,
      showRing: false,
      showFlag: false,
    });
    const created = spawnScriptedHarvestNodes(
      this.harvestField,
      nodeSpawns.map(({ def, position }) => ({
        defId: def.id,
        name: def.name,
        kind: def.type === "wood" ? "wood" : def.type === "herb" ? "herb" : "stone",
        position,
        hp: def.hp,
        yieldMin: def.baseYield,
        yieldMax: def.baseYield + 2,
        respawnSec: def.respawnTime,
      })),
    );
    bindClaimNodes(claim, created);
    this.log(`Harvest parcel set — ${created.length} nodes inside the claim.`);
  }

  private spawnWispEvents() {
    if (!this.wispEvents) return;
    const anchors = [
      new THREE.Vector3(-28, 0, 18),
      new THREE.Vector3(18, 0, -36),
      new THREE.Vector3(-8, 0, -22),
      new THREE.Vector3(32, 0, 8),
    ];
    // Ritual wisps orbit the dark-elf crystal event
    if (this.darkElfEvent) {
      for (const s of this.darkElfEvent.wispSpots) {
        anchors.push(s.clone());
      }
    }
    // Snap to walkable so wisps never sit inside maze walls
    for (const a of anchors) {
      if (this.maze && !this.maze.isWalkableWorld(a.x, a.z)) {
        const w = this.maze.nearestWalkable(a.x, a.z);
        a.x = w.x;
        a.z = w.z;
      }
    }
    spawnWispEventPack(this.wispEvents, this.mapSeed, anchors);
    this.log("Colored wisps stir on the island — watch for sky beams.");
  }

  private buildHarvestables() {
    if (this.harvestField) {
      this.scene.remove(this.harvestField.root);
      this.harvestField.dispose();
      this.harvestField = null;
    }
    this.harvestField = buildHarvestField(this.mapSeed, this.DUNGEON, {
      treeCount: 52,
      stoneCount: 36,
    });
    this.scene.add(this.harvestField.root);

    // Wire decorative rock field into minable stone nodes.
    const meta = (this as unknown as { _rockFieldMeta?: { positions: THREE.Vector3[]; scales: number[] } })._rockFieldMeta;
    if (this.rockField && meta) {
      attachRockFieldNodes(this.harvestField, this.rockField, meta.positions, meta.scales);
    }

    // Starter harvest parcel near pirate cove — no camp, no yellow ring.
    this.applyClaimNodes(new THREE.Vector3(58, 0, -10), {
      radius: 14,
      nodeCount: 10,
      seed: this.mapSeed ^ 0xc1a1,
    });
  }

  /** Generative farm zones from farm_-_low_poly_moduler_pack atlas. */
  private scatterFarmFields() {
    this.farmField?.dispose();
    this.farmField = null;
    void import("./farmModular").then(({ scatterFarmModular }) => {
      if (this.disposed) return;
      const farmZones =
        this.worldManifest?.zones.filter((z) => z.kind === "farm" || z.kind === "cropland") ?? [];
      this.farmField = scatterFarmModular(this.loader, this.scene, {
        halfExtent: this.DUNGEON,
        seed: this.mapSeed ^ 0x4641524d, // "FARM"
        clusterCount: 4 + Math.min(3, this.islandRound) + farmZones.length,
        partsPerCluster: 8,
        unitScale: 0.4,
        zoneCenters: farmZones.map((z) => ({ x: z.x, z: z.z, r: z.radius })),
        avoid: [
          { x: 0, z: 0, r: 18 },
          { x: this.coveCenter.x, z: this.coveCenter.z, r: 22 },
          { x: this.darkElfCampAnchor.x, z: this.darkElfCampAnchor.z, r: 20 },
          { x: 38, z: 28, r: 16 },
        ],
        snapWalkable: (x, z) =>
          this.maze?.nearestWalkable(x, z) ?? new THREE.Vector3(x, 0, z),
      });
    });
  }

  /**
   * Generative island expansion — best pirate-kit props + world catalog pieces.
   * Chests/barrels are interactable loot; docks/anchors/coins fill the wilds.
   */
  private scatterGenerativeProps() {
    const rng = mulberry(this.mapSeed ^ 0x9e3779b9);
    const props: Array<{
      rel: string;
      extent: number;
      interact?: "chest" | "barrel";
      label?: string;
      weight?: number;
    }> = [
      { rel: "world/Prop_Barrel.gltf", extent: 0.9, interact: "barrel", label: "Supply Barrel", weight: 4 },
      { rel: "world/Prop_Chest_Gold.gltf", extent: 1.0, interact: "chest", label: "Island Chest", weight: 3 },
      { rel: "world/Prop_Anchor.gltf", extent: 1.05, weight: 2 },
      { rel: "world/Prop_Coins.gltf", extent: 0.65, weight: 3 },
      { rel: "world/Environment_Dock_Pole.gltf", extent: 1.4, weight: 2 },
      { rel: "world/Ship_Small.gltf", extent: 3.2, weight: 1 },
    ];
    // Weighted pool for variety (more loot than scenery).
    const pool: typeof props = [];
    for (const p of props) {
      const w = p.weight ?? 1;
      for (let k = 0; k < w; k++) pool.push(p);
    }
    const count = 28 + Math.min(14, this.islandRound * 3);
    for (let i = 0; i < count; i++) {
      const p = pool[Math.floor(rng() * pool.length)]!;
      const a = rng() * Math.PI * 2;
      const r = 22 + rng() * (this.DUNGEON - 36);
      let x = Math.cos(a) * r;
      let z = Math.sin(a) * r;
      // Keep clear of cove + hub center (no giant clutter at origin).
      if (Math.hypot(x, z) < 14) {
        x += 18;
        z += 10;
      }
      if (x > 55 && Math.abs(z + 14) < 20) x -= 25;
      // Clear dark-elf ritual yard
      if (Math.hypot(x + 42, z + 32) < 20) {
        x += 14;
        z -= 10;
      }
      // Clear east orc war-camp
      if (Math.hypot(x - 38, z - 28) < 16) {
        x -= 12;
        z += 10;
      }
      const pos = this.maze?.nearestWalkable(x, z) ?? new THREE.Vector3(x, 0, z);
      this.loadCoveProp(
        p.rel,
        pos,
        p.extent * (0.85 + rng() * 0.3),
        rng() * Math.PI * 2,
        p.interact
          ? {
              interact: p.interact,
              label: p.label ?? p.interact,
              lootGold: p.interact === "chest" ? 12 + Math.floor(rng() * 40) : 4 + Math.floor(rng() * 8),
              lootWood: p.interact === "barrel" ? 2 + Math.floor(rng() * 4) : rng() < 0.4 ? 1 : 0,
              lootStone: p.interact === "chest" && rng() < 0.5 ? 1 + Math.floor(rng() * 3) : 0,
            }
          : undefined,
      );
    }

    // Scatter a few catalogued world props (grass trenches as wild landmarks).
    const landmarkCount = 3 + Math.min(2, this.islandRound);
    for (let i = 0; i < landmarkCount; i++) {
      const a = rng() * Math.PI * 2;
      const r = 35 + rng() * (this.DUNGEON - 50);
      let x = Math.cos(a) * r;
      let z = Math.sin(a) * r;
      if (Math.hypot(x, z) < 20) continue;
      if (Math.hypot(x - this.coveCenter.x, z - this.coveCenter.z) < 24) continue;
      const pos = this.maze?.nearestWalkable(x, z) ?? new THREE.Vector3(x, 0, z);
      try {
        const loaded = loadWorldProp("prop_grass_trenches", this.loader, {
          position: pos,
          rotationY: rng() * Math.PI * 2,
        });
        this.worldCollectables.push(loaded);
        this.scene.add(loaded.holder);
      } catch {
        /* optional asset */
      }
    }
  }

  /** Generative modular outposts from orc_camp_set atlas parts (best static meshes). */
  private modularField: { dispose: () => void } | null = null;
  private scatterModularOutposts() {
    this.modularField?.dispose();
    this.modularField = null;
    void import("./modularBuildings").then(({ scatterModularBuildings }) => {
      if (this.disposed) return;
      const campUrl = `${import.meta.env.BASE_URL}models/buildings/orc_camp_set.glb`;
      this.modularField = scatterModularBuildings(this.loader, this.scene, campUrl, {
        halfExtent: this.DUNGEON,
        seed: this.mapSeed ^ 0x4d4f4455, // "MODU"
        // Expand with island round — more outposts deeper into the run
        clusterCount: 6 + Math.min(4, this.islandRound),
        partsPerCluster: 7,
        unitScale: 0.52,
        avoid: [
          { x: 0, z: 0, r: 18 },
          { x: this.coveCenter.x, z: this.coveCenter.z, r: 22 },
          { x: this.darkElfCampAnchor.x, z: this.darkElfCampAnchor.z, r: 22 },
          { x: 38, z: 28, r: 16 },
        ],
        snapWalkable: (x, z) =>
          this.maze?.nearestWalkable(x, z) ?? new THREE.Vector3(x, 0, z),
      });
    });
  }

  /** Neutral KayKit townsfolk wandering near the cove — ambient population only,
   *  never targetable (they carry no `enemyId`). */
  private buildTownsfolk() {
    const c = this.coveCenter;
    const anchors: { x: number; z: number; model?: string }[] = [
      { x: c.x - 6, z: c.z + 5, model: "Knight" },
      { x: c.x - 8, z: c.z - 2, model: "Mage" },
      { x: c.x - 4, z: c.z + 7, model: "Ranger" },
    ];
    for (const a of anchors) {
      const t = new Townsperson(this.loader, {
        home: new THREE.Vector3(a.x, 0, a.z),
        model: a.model,
        height: 1.85,
        wanderRadius: 2.8,
      });
      this.scene.add(t.group);
      this.townsfolk.push(t);
    }
  }

  /** Perk symbols + gumball machine scattered in the dungeon as pickups. */
  private buildWorldCollectables() {
    for (const place of DUNGEON_COLLECTABLES) {
      const key = `${place.propId}@${place.x},${place.z}`;
      const loaded = loadWorldProp(place.propId, this.loader, {
        position: new THREE.Vector3(place.x, 0.8, place.z),
        rotationY: place.rotY ?? 0,
      });
      loaded.holder.userData.collectKey = key;
      loaded.holder.userData.stationId = place.stationId;
      this.scene.add(loaded.holder);
      this.worldCollectables.push(loaded);
    }
  }

  private updateWorldCollectables(delta: number, elapsed: number) {
    const pickupRadius = 2.8;
    for (let i = this.worldCollectables.length - 1; i >= 0; i--) {
      const wp = this.worldCollectables[i]!;
      wp.mixer?.update(delta);
      if (wp.def.kind === "perk_symbol") {
        const t = elapsed * 1.8 + wp.holder.position.x;
        wp.holder.position.y = 0.8 + Math.sin(t) * 0.18;
        wp.holder.rotation.y += delta * 0.5;
      }

      const key = wp.holder.userData.collectKey as string;
      if (this.collectedPropIds.has(key)) continue;

      const dx = wp.holder.position.x - this.playerPos.x;
      const dz = wp.holder.position.z - this.playerPos.z;
      if (dx * dx + dz * dz <= pickupRadius * pickupRadius) {
        this.collectedPropIds.add(key);
        const perkId = wp.def.perkId as PerkId | undefined;
        if (perkId) {
          const r = grantPerk(perkId);
          this.log(r.ok ? `Unlocked perk: ${PERK_BY_ID.get(perkId)?.name ?? perkId}!` : r.message);
        } else {
          this.log(`Collected ${wp.def.name}!`);
        }
        this.scene.remove(wp.holder);
        disposeWorldProp(wp);
        this.worldCollectables.splice(i, 1);
      }
    }
  }

  /**
   * Load a pirate-kit prop. `extent` = target footprint (m). Hard-capped so
   * broken bboxes never produce map-scale ships/chests in the hub.
   */
  private loadCoveProp(
    rel: string,
    pos: THREE.Vector3,
    extent: number,
    rotY: number,
    interact?: {
      interact: "chest" | "barrel" | "dock" | "traveler";
      label: string;
      lootGold?: number;
      lootWood?: number;
      lootStone?: number;
    },
  ) {
    const url = `${import.meta.env.BASE_URL}models/pirates/${rel}`;
    const safeExtent = Math.min(14, Math.max(0.4, extent));
    loadGLTFCached(this.loader, url).then(
      (gltf) => {
        if (this.disposed) {
          return;
        }
        const root = gltf.scene.clone(true);
        const bbox = new THREE.Box3().setFromObject(root);
        const size = this._tmpV3a;
        bbox.getSize(size);
        const foot = Math.max(size.x, size.z, 0.05);
        let s = safeExtent / foot;
        // Height safety: nothing taller than ~8m unless it's a ship
        const isShip = /ship/i.test(rel);
        const maxH = isShip ? 10 : 3.5;
        if (size.y * s > maxH) s = maxH / Math.max(size.y, 0.05);
        s = Math.min(8, Math.max(0.05, s));
        root.scale.setScalar(s);
        const b2 = new THREE.Box3().setFromObject(root);
        const ctr = this._tmpV3b;
        b2.getCenter(ctr);
        root.position.set(-ctr.x, -b2.min.y, -ctr.z);
        root.traverse((c) => {
          const m = c as THREE.Mesh;
          if (m.isMesh) {
            m.castShadow = true;
            m.receiveShadow = true;
          }
        });
        const holder = new THREE.Group();
        holder.position.copy(pos);
        // Never stack giant props on world origin by accident
        if (Math.hypot(pos.x, pos.z) < 0.5 && !interact) {
          holder.position.set(6, 0, 6);
        }
        holder.rotation.y = rotY;
        holder.add(root);
        if (interact) {
          holder.userData.interact = interact.interact;
          holder.userData.interactLabel = interact.label;
          holder.userData.lootGold = interact.lootGold ?? 0;
          holder.userData.lootWood = interact.lootWood ?? 0;
          holder.userData.lootStone = interact.lootStone ?? 0;
          holder.userData.looted = false;
          holder.userData.interactRadius = interact.interact === "dock" ? 4.5 : 2.6;
        }
        this.scene.add(holder);
        this.coveProps.push(holder);
      },
      (err) => {
        // eslint-disable-next-line no-console
        console.warn("[GameEngine] cove prop failed:", rel, err);
      },
    );
  }

  /** Floating gold sprite label marking the Pirate Cove. */
  private addCoveLabel(pos: THREE.Vector3) {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.font = "bold 46px Georgia, 'Times New Roman', serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(0,0,0,0.9)";
    ctx.shadowBlur = 10;
    ctx.fillStyle = "#e9c46a";
    ctx.fillText("\u2693 PIRATE COVE", 256, 64);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
    const sprite = new THREE.Sprite(mat);
    sprite.position.copy(pos);
    sprite.scale.set(9, 2.25, 1);
    this.scene.add(sprite);
    this.coveLabel = sprite;
  }

  private setupLighting() {
    const ambient = new THREE.AmbientLight(0x120a08, 2.5);
    this.scene.add(ambient);

    // Hemisphere light gives subtle sky/ground bounce across the open map.
    const hemi = new THREE.HemisphereLight(0x3a3050, 0x1a1410, 0.5);
    this.scene.add(hemi);

    // Key/sun light. Tight frustum + player-follow (update) keeps shadows sharp
    // without a huge map. 1024 is enough for orthographic ARPG scale.
    const sun = new THREE.DirectionalLight(0xff9955, 2.2);
    sun.position.set(20, 30, 20);
    sun.castShadow = true;
    sun.shadow.mapSize.setScalar(1024);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 160;
    sun.shadow.camera.left = sun.shadow.camera.bottom = -42;
    sun.shadow.camera.right = sun.shadow.camera.top = 42;
    sun.shadow.bias = -0.001;
    sun.shadow.normalBias = 0.02;
    this.scene.add(sun);
    this.scene.add(sun.target);
    this.sun = sun;

    const fill = new THREE.DirectionalLight(0x1a2050, 0.6);
    fill.position.set(-15, 8, -15);
    fill.castShadow = false;
    this.scene.add(fill);

    // Fewer torch point lights (each is a full scene pass for lit materials).
    const torchPositions: Array<[number, number]> = [
      [-45, -45], [45, -45], [-45, 45], [45, 45],
      [-10, -10], [10, 10],
    ];
    for (const [tx, tz] of torchPositions) {
      const light = new THREE.PointLight(0xff6600, 2.4, 12, 1.8);
      light.position.set(tx, 3, tz);
      light.castShadow = false;
      this.scene.add(light);
      this.torchLights.push(light);

      const flame = new THREE.Mesh(
        new THREE.SphereGeometry(0.14, 6, 6),
        new THREE.MeshBasicMaterial({ color: 0xff8833 })
      );
      flame.position.set(tx, 3.1, tz);
      this.scene.add(flame);
    }
  }

  private loadPlayerModel() {
    if (this.initStats.skinId === RACALVIN_ID) {
      this.loadRacalvinModel();
      return;
    }
    // Annihilate / Warlords g6_{race}_{class} — CDN Toon-RTS + baked anim packs
    const g6 = this.initStats.skinId?.match(
      /^g6_(human|barbarian|elf|dwarf|orc|undead)_(warrior|mage|ranger|worge)$/,
    );
    if (g6) {
      this.initStats.charRace = g6[1];
      this.initStats.charClass = g6[2];
      this.loadGrudge6Player(this.initStats.skinId!);
      return;
    }
    const skin = getSkin(this.initStats.skinId);
    if (skin) this.loadSkinModel(skin);
    else this.loadRaceModel();
  }

  /** Playable Grudge6 / Warlords 24 — correct scale, wardrobe, baked Bip001 clips. */
  private loadGrudge6Player(heroId: string) {
    void import("./grudge6/loadGrudge6Hero").then(({ loadGrudge6PlayableHero }) => {
      void loadGrudge6PlayableHero(heroId, this.loader).then((res) => {
        if (!res || this.disposed) {
          if (res) res.animator.dispose();
          this.loadRaceModel();
          return;
        }
        this.finalizePlayer(res.wrapper, res.animator);
      }).catch(() => this.loadRaceModel());
    });
  }

  /** Racalvin (Corsair King) — dual Brothers' Keeper mind-swords + clips. */
  private loadRacalvinModel() {
    loadRacalvinForDungeon(
      this.loader,
      1.9,
      (wrapper, animator) => {
        this.finalizePlayer(wrapper, animator);
        // Mind-sword hit pulse → soft AoE when blades strike
        const model = wrapper.children[0] ?? wrapper;
        const rig = getRacalvinWeapons(model);
        rig?.setStrikeHitHandler((worldPos) => {
          this.particles?.impact(worldPos.clone().setY(1.1), RACALVIN_PSYCHIC_COLOR, 1.4);
          this.auras?.pulse("arcane", worldPos.clone(), 2.2, 0.35);
          // Damage nearby foes on psychic blade impact
          for (const en of this.enemies) {
            if (en.state === "dead" || en.state === "death") continue;
            if (en.position.distanceTo(worldPos) < 3.2) {
              this.damageEnemy(en, this.playerBaseDamage * 0.85, Math.random() < this.playerCritChance + 0.1);
            }
          }
        });
      },
      () => this.loadRaceModel(),
    );
  }

  /** Launch Brothers' Keeper dual blades toward current aim / nearest foe. */
  private launchRacalvinSwords() {
    if (!this.playerGroup) return;
    const model = this.playerGroup.children[0] ?? this.playerGroup;
    if (!getRacalvinWeapons(model)) return;
    const en = this.targetEnemy && this.targetEnemy.state !== "dead" && this.targetEnemy.state !== "death"
      ? this.targetEnemy
      : this.nearestEnemy(12);
    const target = en
      ? en.position.clone().setY(1.15)
      : this.playerPos
          .clone()
          .add(
            new THREE.Vector3(Math.sin(this.playerFacing) * 5, 1.15, Math.cos(this.playerFacing) * 5),
          );
    launchRacalvinMindStrike(model, target, this.playerFacing);
  }

  /** One Piece champion skin — fully rigged GLB, plays its own labelled clips. */
  private loadSkinModel(skin: SkinDef) {
    this.loader.load(
      skinUrl(skin),
      (gltf) => {
        const model = gltf.scene;
        model.traverse((c) => {
          const m = c as THREE.Mesh;
          if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; }
        });
        const wrapper = this.buildPlayerWrapper(model, skin.height ?? 1.9);
        const { actions, pool, attackBlend } = buildSkinAnim(gltf.animations, skin.scheme);
        this.finalizePlayer(wrapper, new PlayerAnimator(model, actions, pool, { attackBlend }));
      },
      undefined,
      () => this.loadRaceModel(), // graceful fallback to the race model
    );
  }

  /** Grudge race model — clean Biped skeleton, ZERO clips, so we synthesise
   *  authored idle/walk/attack clips and allow-list the equipped wardrobe. */
  private loadRaceModel() {
    const race = (this.initStats.charRace?.toLowerCase() || "human") as RaceId;
    this.loader.load(
      PORTRAIT_URL(race),
      (gltf) => {
        const model = gltf.scene;
        const names: string[] = [];
        model.traverse((c) => { if ((c as THREE.Mesh).isMesh) names.push(c.name); });
        const visible = resolveVisibleMeshes(names, race, {
          mainCategory: this.initStats.equipMainCategory,
          hasOffhand: this.initStats.equipHasOffhand,
          offCategory: this.initStats.equipOffCategory,
          offhandIsShield: this.initStats.equipOffhandIsShield,
          hasShoulder: this.initStats.equipHasShoulder,
        }, this.initStats.charName || race);
        model.traverse((c) => {
          const m = c as THREE.Mesh;
          if (m.isMesh) {
            m.visible = visible.has(m.name);
            m.castShadow = true;
            m.receiveShadow = true;
            m.frustumCulled = false; // skinned meshes vanish if culled in bind pose
          }
        });
        const wrapper = this.buildPlayerWrapper(model, 1.9);
        model.updateWorldMatrix(true, true);
        const clips = buildAuthoredClips(model);
        this.finalizePlayer(wrapper, new PlayerAnimator(model, clips));
      },
      undefined,
      () => this.finalizePlayer(this.buildFallbackPlayer(), null),
    );
  }

  /** Wrap a model in a group whose origin is at the model's feet, uniformly
   *  scaled to `targetHeight` and XZ-centred. The wrapper is what we move/turn. */
  private buildPlayerWrapper(model: THREE.Object3D, targetHeight: number): THREE.Group {
    const wrapper = new THREE.Group();
    model.updateWorldMatrix(true, true);
    const box = visibleBox(model);
    const size = new THREE.Vector3();
    box.getSize(size);
    if (size.y > 0.001) model.scale.setScalar(targetHeight / size.y);
    model.updateWorldMatrix(true, true);
    const box2 = visibleBox(model);
    const center = new THREE.Vector3();
    box2.getCenter(center);
    model.position.x -= center.x;
    model.position.z -= center.z;
    model.position.y -= box2.min.y;
    wrapper.add(model);
    wrapper.updateMatrixWorld(true);
    return wrapper;
  }

  private finalizePlayer(group: THREE.Group, animator: PlayerAnimator | null) {
    this.playerGroup = group;
    this.playerGroup.position.copy(this.playerPos);
    this.playerAnimator = animator;

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.55, 0.7, 32),
      new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.08;
    this.playerGroup.add(ring);

    this.scene.add(this.playerGroup);
    // Element signature aura under the fighter (from combat profile).
    this.auras?.attach(this.playerAuraElement, {
      follow: this.playerGroup,
      radius: 1.35,
      yOffset: 0.05,
    });
    this.loaded = true;
    this.notifyState();
  }

  private buildFallbackPlayer(): THREE.Group {
    const g = new THREE.Group();
    const amber = new THREE.MeshStandardMaterial({ color: 0xc9873b, roughness: 0.6 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x2a1a0a, roughness: 0.8 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.65, 1.1, 0.4), amber);
    body.position.y = 0.85; body.castShadow = true; g.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.48, 0.48), amber);
    head.position.y = 1.7; head.castShadow = true; g.add(head);
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.9, 0.22), dark);
    armL.position.set(-0.45, 0.85, 0); armL.castShadow = true; g.add(armL);
    const armR = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.9, 0.22), dark);
    armR.position.set(0.45, 0.85, 0); armR.castShadow = true; g.add(armR);
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.7, 0.25), dark);
    legL.position.set(-0.2, 0.25, 0); legL.castShadow = true; g.add(legL);
    const legR = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.7, 0.25), dark);
    legR.position.set(0.2, 0.25, 0); legR.castShadow = true; g.add(legR);
    const glow = new THREE.Mesh(
      new THREE.RingGeometry(0.55, 0.7, 32),
      new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide })
    );
    glow.rotation.x = -Math.PI / 2; glow.position.y = 0.08; g.add(glow);
    return g;
  }

  private spawnInitialEnemies() {
    if (this.enemyTemplates.length === 0) return;

    // Pick a mix of tiers for the starter dungeon
    const byTier = (t: number) => this.enemyTemplates.filter((e) => e.tier === t);
    const shuffle = <T,>(arr: T[]) => [...arr].sort(() => Math.random() - 0.5);

    const picked: EnemyTemplate[] = [];
    picked.push(...shuffle(byTier(1)).slice(0, 4));
    picked.push(...shuffle(byTier(2)).slice(0, 2));
    picked.push(...shuffle(byTier(3)).slice(0, 1));
    if (picked.length === 0) picked.push(...shuffle(this.enemyTemplates).slice(0, 5));

    const configs = picked.map((t) => ({ template: t, count: t.tier === 1 ? 2 : 1 }));

    // Animated local mon packs (pincher, cultist, dante, medusa…) — no KayKit.
    for (const m of ANIMATED_MONSTER_TEMPLATES) configs.push({ template: m, count: 1 });

    // uMMORPG skeleton GLBs only.
    for (const m of SKELETON_SPAWN_TEMPLATES) {
      configs.push({ template: m, count: 3 });
    }

    // Dark-elf warband (dark_elf.glb variants) at their Unity-style camp.
    for (const m of DARK_ELF_SPAWN_TEMPLATES) {
      configs.push({ template: m, count: m.tier >= 4 ? 1 : 2 });
    }

    // Spider den — pincher brood + matriarch.
    for (const m of SPIDER_SPAWN_TEMPLATES) {
      configs.push({ template: m, count: m.tier === 1 ? 4 : m.tier >= 4 ? 1 : 2 });
    }

    // Rival heroes (unused fighters) — elite pack with AI brains from combat profiles.
    const rivals = pickHeroEnemies(this.mapSeed ^ 0xc0ffee, Math.min(3, 1 + Math.floor((this.islandRound - 1) / 2)));
    for (const h of rivals) {
      configs.push({ template: heroEnemyAsTemplate(h), count: 1 });
      this.enemyBrains.set(h.visualId, h.brain);
      this.enemyBrains.set(h.id, h.brain);
    }

    // CDN Quaternius pack (assets.grudge-studio.com) — real stems + multi-clip banks.
    const cdnRng = mulberry(this.mapSeed ^ 0xcd4);
    const cdnPool = CDN_ANIMATED_TEMPLATES.length ? CDN_ANIMATED_TEMPLATES : CDN_MONSTER_TEMPLATES;
    const cdnCount = 6 + Math.min(8, this.islandRound * 2);
    const cdnPick = [...cdnPool].sort(() => cdnRng() - 0.5).slice(0, cdnCount);
    for (const m of cdnPick) configs.push({ template: m, count: 1 });

    const rng = mulberry(this.mapSeed ^ 0x51aced);
    // Faction home anchors (match camp placements).
    const darkCampAnchor = this.darkElfCampAnchor.clone();
    const spiderDenAnchor = new THREE.Vector3(22, 0, -48);
    const undeadAnchor = new THREE.Vector3(-18, 0, 40);
    // Prefer curated crystal-ring spawn spots for dark elves
    const darkSpots = this.darkElfEvent?.spawnSpots ?? [];
    let darkSpotIdx = 0;
    for (const { template, count } of configs) {
      for (let i = 0; i < count; i++) {
        // Prefer maze corridors / rooms; fall back to open ring if maze missing.
        let pos: THREE.Vector3;
        const id = template.id;
        const biasDark = id.startsWith("mon_dark_elf");
        const biasSpider = /spider|pincher|brood/i.test(id);
        const biasSkel = /skeleton|legionnaire|ummo/i.test(id);
        if (biasDark) {
          if (darkSpots.length > 0) {
            pos = darkSpots[darkSpotIdx % darkSpots.length]!.clone();
            darkSpotIdx++;
            pos.x += (rng() - 0.5) * 2.2;
            pos.z += (rng() - 0.5) * 2.2;
          } else {
            pos = new THREE.Vector3(
              darkCampAnchor.x + (rng() - 0.5) * 14,
              0,
              darkCampAnchor.z + (rng() - 0.5) * 14,
            );
          }
          if (this.maze) pos = this.maze.nearestWalkable(pos.x, pos.z);
        } else if (biasSpider || biasSkel) {
          const anchor = biasSpider ? spiderDenAnchor : undeadAnchor;
          pos = new THREE.Vector3(
            anchor.x + (rng() - 0.5) * 16,
            0,
            anchor.z + (rng() - 0.5) * 16,
          );
          if (this.maze) pos = this.maze.nearestWalkable(pos.x, pos.z);
        } else if (this.maze && rng() < 0.55 && this.maze.rooms.some((r) => r.kind === "large")) {
          pos = this.maze.randomLargeRoomCenter(rng);
          // Jitter inside the room so packs don't stack.
          pos.x += (rng() - 0.5) * 6;
          pos.z += (rng() - 0.5) * 6;
        } else if (this.maze) {
          pos = this.maze.randomWalkable(rng);
        } else {
          const D = this.DUNGEON - 3;
          pos = new THREE.Vector3((rng() * 2 - 1) * D, 0, (rng() * 2 - 1) * D);
        }
        if (Math.hypot(pos.x, pos.z) < 8) {
          pos = this.maze?.nearestWalkable(pos.x + 12, pos.z + 8) ?? pos.set(14, 0, 10);
        }
        // Density gate — sparse zones skip some trash
        const bias = zoneSpawnBias(this.worldManifest, pos.x, pos.z);
        if (rng() > 0.35 + bias.density * 0.65) continue;
        const tpl = this.scaleTemplate(template);
        if (bias.areaLevel > 4) {
          tpl.hp = Math.round(tpl.hp * (1 + (bias.areaLevel - 3) * 0.06));
          tpl.damage = Math.round(tpl.damage * (1 + (bias.areaLevel - 3) * 0.04));
        }
        this.createEnemy(tpl, this.snapToWalkable(pos));
      }
    }
    // Extra packs weighted by zone density / area level (D2 pack feel)
    const extra = Math.min(20, (this.islandRound - 1) * 2 + 4);
    if (extra > 0 && this.enemyTemplates.length) {
      const rng2 = mulberry(this.mapSeed ^ 0xdead);
      for (let i = 0; i < extra; i++) {
        const t = this.enemyTemplates[Math.floor(rng2() * this.enemyTemplates.length)]!;
        let pos: THREE.Vector3;
        let zBias = { density: 0.5, areaLevel: 3, zone: null as WorldZone | null };
        if (this.worldManifest && rng2() < 0.72) {
          // Prefer denser zones
          const pool = [...this.worldManifest.zones].sort(
            (a, b) => b.density * b.areaLevel - a.density * a.areaLevel,
          );
          const z = pool[Math.floor(rng2() * Math.min(8, pool.length))]!;
          pos = new THREE.Vector3(
            z.x + (rng2() - 0.5) * z.radius * 1.1,
            0,
            z.z + (rng2() - 0.5) * z.radius * 1.1,
          );
          if (this.maze) pos = this.maze.nearestWalkable(pos.x, pos.z);
          zBias = { density: z.density, areaLevel: z.areaLevel, zone: z };
        } else {
          pos =
            this.maze?.randomWalkable(rng2) ??
            new THREE.Vector3(
              (rng2() * 2 - 1) * (this.DUNGEON - 4),
              0,
              (rng2() * 2 - 1) * (this.DUNGEON - 4),
            );
          zBias = zoneSpawnBias(this.worldManifest, pos.x, pos.z);
        }
        if (Math.hypot(pos.x, pos.z) < 8) continue;
        if (rng2() > 0.25 + zBias.density * 0.75) continue;
        const tpl = this.scaleTemplate(t);
        tpl.hp = Math.round(tpl.hp * (1 + zBias.areaLevel * 0.05));
        tpl.damage = Math.round(tpl.damage * (1 + zBias.areaLevel * 0.03));
        this.createEnemy(tpl, this.snapToWalkable(pos));
      }
    }
    // Guaranteed zone guards on hostile / high-density areas
    if (this.worldManifest) {
      const rng3 = mulberry(this.mapSeed ^ 0x20e);
      for (const z of this.worldManifest.zones) {
        if (z.density < 0.5 && z.kind !== "ruins" && z.kind !== "dungeon_mouth") continue;
        if (z.kind === "harbor" || z.kind === "farm" || z.kind === "cropland") continue;
        const packs = 1 + Math.floor(z.density * 2);
        for (let p = 0; p < packs; p++) {
          const t =
            this.enemyTemplates[Math.floor(rng3() * Math.max(1, this.enemyTemplates.length))] ??
            ANIMATED_MONSTER_TEMPLATES[0];
          if (!t) continue;
          const ang = rng3() * Math.PI * 2;
          const r = rng3() * z.radius * 0.7;
          const pos =
            this.maze?.nearestWalkable(z.x + Math.cos(ang) * r, z.z + Math.sin(ang) * r) ??
            new THREE.Vector3(z.x, 0, z.z);
          const tpl = this.scaleTemplate(t);
          tpl.hp = Math.round(tpl.hp * (1 + z.areaLevel * 0.05));
          this.createEnemy(tpl, this.snapToWalkable(pos));
        }
      }
    }
  }

  /**
   * Island Colossus — roster-driven boss (boss_ / mon_ / cdn_ models) with style tags.
   */
  private spawnDungeonBoss() {
    const rng = mulberry(this.mapSeed ^ 0xb055);
    let bossPos = this.maze?.randomLargeRoomCenter(rng) ?? new THREE.Vector3(-52, 0, 38);
    if (this.maze) {
      let best = bossPos;
      let bestD = Math.hypot(best.x, best.z);
      for (const r of this.maze.rooms) {
        if (r.kind !== "large") continue;
        const d = Math.hypot(r.cx, r.cz);
        if (d > bestD) {
          bestD = d;
          best = new THREE.Vector3(r.cx, 0, r.cz);
        }
      }
      bossPos = best;
    }
    this.snapToWalkable(bossPos);
    const m = this.difficultyMult();

    // Prefer RunDirector bossId when it's a real model id; else seeded roster pick.
    const def = pickDungeonBossDef(this.mapSeed, this.islandRound);
    let modelId = this.runDirector.run.bossId || def.modelId;
    let displayName = def.name;
    let style: string = def.style;
    if (
      !modelId ||
      !(
        modelId.startsWith("boss_") ||
        modelId.startsWith("mon_") ||
        modelId.startsWith("cdn_")
      )
    ) {
      modelId = def.modelId;
      displayName = def.name;
      style = def.style;
    } else if (modelId === def.modelId) {
      displayName = def.name;
      style = def.style;
    }

    const template: EnemyTemplate = {
      id: modelId,
      name: this.islandRound > 1 ? `R${this.islandRound} ${displayName}` : displayName,
      type: style,
      tier: 5,
      hp: Math.round(1400 * m * 1.1),
      damage: Math.round(38 * (1 + (this.islandRound - 1) * 0.15)),
    };
    // Boss always spawns outside player camps
    pushOutOfCamps(this.playerCamps, bossPos, 4);
    const boss = this.createEnemy(template, bossPos);
    if (!boss) {
      this.log("Boss spawn blocked — no walkable site clear of camps.");
      return;
    }
    boss.aggroRange = 14;
    boss.attackRange = style === "artillery" || style === "necromancer" ? 9 : 4.2;
    boss.speed = style === "skirmisher" || style === "duelist" ? 2.4 : style === "colossus" ? 1.4 : 1.7;
    boss.model.group.scale.multiplyScalar(1.35);
    boss.model.height *= 1.35;
    this.bossEnemyId = boss.id;
    boss.model.group.userData.isBoss = true;
    boss.model.group.userData.bossStyle = style;
    this.bossSpecialCd.set(boss.id, 1.5);
    this.log(`${boss.template.name} [${style}] stirs in a large chamber — red circles and bolts!`);
  }

  /** FNV-1a hash → deterministic per-template model pick. */
  private hashStr(s: string): number {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  /**
   * Resolve any enemy template to a REAL animated GLB model id. Roster ids
   * (kit_* / mon_*) pass through unchanged; every data-driven bestiary enemy is
   * mapped by archetype + tier to an animated skeletal GLB — so no enemy ever
   * renders as the crude procedural-primitive placeholder. Deterministic per
   * template, so a given bestiary entry always looks the same across spawns.
   */
  private resolveAnimatedModelId(template: EnemyTemplate): string {
    // uMMORPG / local mon only — KayKit ids remapped in catalog.
    const catalogId = resolveCatalogModelId(template.id);
    if (isMonsterId(catalogId)) return catalogId;
    if (isMonsterId(template.id)) return template.id;
    const UMMO_BY_TIER = [
      "mon_skeleton_warrior_ummo",
      "mon_skeleton_ummo",
      "mon_skeleton_ummo",
      "mon_dark_elf",
      "mon_dark_elf",
    ];
    const seed = this.hashStr(template.id || template.name);
    const t = Math.max(1, Math.min(template.tier, 5));
    let pool: string[];
    // Only ids that map to real mesh files (local mon_* or CDN stems).
    switch (archetypeFor(template.type)) {
      case "arachnid":
        pool = ["mon_pincher", "cdn_crab"];
        break;
      case "quadruped":
        pool = ["mon_dante_beast", "cdn_yeti", "cdn_dino", "cdn_wolf", "cdn_bear", "cdn_monkroose"];
        break;
      case "dragon":
        pool = ["cdn_dragon", "mon_dante_beast"];
        break;
      case "golem":
        pool = ["cdn_demon", "cdn_cyclops", "cdn_mushroom_king", "cdn_cthulhu", "mon_medusa"];
        break;
      case "flying":
        pool = ["cdn_ghost", "cdn_ghost_skull", "cdn_armabee", "cdn_armabee_evolved", "cdn_flying_demon", "cdn_dragon", "cdn_bat", "cdn_pigeon"];
        break;
      case "humanoid":
      default:
        if (t <= 1) pool = ["mon_skeleton_warrior_ummo", "mon_skeleton_ummo", "cdn_bunny", "cdn_chicken"];
        else if (t === 2) pool = ["mon_skeleton_ummo", "mon_cultist", "cdn_orc", "cdn_ninja", "mon_dark_elf_raider"];
        else if (t === 3) pool = ["mon_dark_elf", "mon_cultist", "cdn_orc_skull", "cdn_alien", "cdn_ninja"];
        else pool = ["mon_dark_elf", "mon_medusa", "cdn_demon", "mon_dark_elf_captain", "cdn_cyclops"];
        break;
    }
    const chosen = pool[seed % pool.length] ?? UMMO_BY_TIER[t - 1] ?? "mon_skeleton_ummo";
    if (import.meta.env.DEV && !isMonsterId(resolveCatalogModelId(chosen)) && !isMonsterId(chosen)) {
      console.warn(`[GameEngine] resolveAnimatedModelId produced unknown model id "${chosen}" for "${template.id}"`);
    }
    return resolveCatalogModelId(chosen);
  }

  /** Apply catalog tint + scale after GLB inject (dark elves, spider sizes). */
  private applyCatalogLook(templateId: string, model: EnemyModel) {
    const tint = catalogTint(templateId);
    const scale = catalogScale(templateId);
    if (scale !== 1) {
      model.group.scale.multiplyScalar(scale);
      model.height *= scale;
    }
    if (tint != null && model.bodyMats.length) {
      const c = new THREE.Color(tint);
      for (const mat of model.bodyMats) {
        mat.color.lerp(c, 0.55);
        if ("emissive" in mat) {
          mat.emissive.setHex(tint);
          mat.emissiveIntensity = Math.max(mat.emissiveIntensity ?? 0, 0.12);
        }
      }
    }
  }

  private createEnemy(template: EnemyTemplate, pos: THREE.Vector3): EnemyInstance | null {
    // Never spawn inside player-built camps
    if (isInsidePlayerCamp(this.playerCamps, pos.x, pos.z, 0.5)) {
      if (!pushOutOfCamps(this.playerCamps, pos, 2.5)) return null;
      // Still inside after push? skip
      if (isInsidePlayerCamp(this.playerCamps, pos.x, pos.z, 0.2)) return null;
    }
    const id = `e${this.enemyIdCounter++}`;
    this.snapToWalkable(pos);
    const retag = (m: EnemyModel) => {
      // Re-tag children once the GLB has streamed in so raycast targeting
      // works on the real meshes.
      m.group.traverse((c) => { c.userData.enemyId = id; });
    };
    const modelId = this.resolveAnimatedModelId(template);
    const onReady = (m: EnemyModel) => {
      retag(m);
      this.applyCatalogLook(template.id, m);
    };
    const model = isMonsterId(modelId)
      ? loadMonsterModel(modelId, this.loader, onReady)
      : createEnemyModel(template.name, template.type, template.tier);
    // Immediate scale/tint for procedural fallbacks or already-ready groups.
    this.applyCatalogLook(template.id, model);
    model.group.position.set(pos.x, model.baseY, pos.z);
    model.group.userData.baseY = model.baseY;
    model.group.userData.enemyId = id;
    model.group.userData.catalogId = template.id;
    this.scene.add(model.group);

    const brain = this.enemyBrains.get(template.id) ?? this.enemyBrains.get(modelId);
    const tune = brain ? brainTuning(brain) : null;
    let aggroRange = 6.5 + template.tier * 0.6;
    let attackRange = 1.8 + template.tier * 0.2 + (model.archetype === "dragon" || model.archetype === "golem" ? 1.2 : 0);
    let speed =
      model.archetype === "flying"
        ? 3.5
        : model.archetype === "golem"
          ? 1.6
          : model.archetype === "dragon"
            ? 2.4
            : 2.4 + template.tier * 0.35;
    if (tune) {
      aggroRange *= tune.aggroMult;
      attackRange *= tune.attackRangeMult;
      speed *= tune.speedMult;
    }

    const enemy: EnemyInstance = {
      id,
      template,
      model,
      anim: makeAnimState(),
      hp: template.hp,
      maxHp: template.hp,
      state: "idle",
      position: pos.clone(),
      patrolTarget: pos.clone(),
      spawnPos: pos.clone(),
      facing: Math.random() * Math.PI * 2,
      attackCooldown: Math.random() * 1.5,
      hurtTimer: 0,
      aggroRange,
      attackRange,
      speed,
      path: [],
      pathRepathAt: 0,
      idleUntil: performance.now() / 1000 + Math.random() * 2,
    };

    // Make every mesh under the enemy carry the enemyId for raycast hits
    model.group.traverse((c) => { c.userData.enemyId = id; });
    // Soft signature aura for elites / rivals (tier ≥ 3).
    if (template.tier >= 3 && this.auras) {
      const el =
        brain === "caster" || brain === "gunner"
          ? "arcane"
          : brain === "assassin"
            ? "poison"
            : brain === "tank"
              ? "physical"
              : "fire";
      this.auras.attach(el as import("./combat/particles").SkillElement, {
        follow: model.group,
        radius: 1.1 + template.tier * 0.12,
        yOffset: 0.06,
      });
    }

    this.enemies.push(enemy);
    return enemy;
  }

  private setupInput(container: HTMLDivElement) {
    container.setAttribute("tabIndex", "0");
    container.focus();

    this._keyDownHandler = (e: KeyboardEvent) => {
      this.keys.add(e.code);
      // F = basic attack | Space = jump | Q = block | Shift = dodge | E = interact | R = special
      if (e.code === "KeyF") {
        e.preventDefault();
        this.attackNearest();
      }
      if (e.code === "Space") {
        e.preventDefault();
        this.doJump();
      }
      if (e.code === "KeyQ") {
        e.preventDefault();
        this.blocking = true;
        this.combatFsm.beginBlock();
      }
      if (e.code === "ShiftLeft" || e.code === "ShiftRight") {
        e.preventDefault();
        this.doDodge();
      }
      if (e.code === "KeyE") {
        e.preventDefault();
        this.tryEngagePirate();
      }
      if (e.code === "KeyR") {
        e.preventDefault();
        this.useSpecial();
      }
      if (e.code === "KeyC") {
        e.preventDefault();
        this.beginCampPlacement();
      }
      if (e.code === "KeyV") {
        e.preventDefault();
        this.tryDeployAllies();
      }
      if (e.code === "KeyB") {
        e.preventDefault();
        this.tryToggleEmbark();
      }
      if (e.code === "KeyT") {
        e.preventDefault();
        this.onOpenTraveler?.();
      }
      if (e.code === "Escape") {
        this.cancelPlacement();
      }
      const n = Number(e.key);
      if (n >= 1 && n <= 5) {
        e.preventDefault();
        this.selectSkill(n - 1);
      }
    };
    this._keyUpHandler = (e: KeyboardEvent) => {
      this.keys.delete(e.code);
      if (e.code === "KeyQ") {
        this.blocking = false;
        this.combatFsm.endBlock();
      }
    };
    this._clickHandler = (e: MouseEvent) => this.handleClick(e, container);
    this._moveHandler = (e: MouseEvent) => this.handleHover(e, container);
    // LEFT button = selection / move (handled by the `click` event) and, while
    // held, cursor-aims skills. RIGHT button = attack (hold to keep swinging).
    this._downHandler = (e: MouseEvent) => {
      if (e.button === 2) {
        e.preventDefault();
        this.attackHeld = true;
        this.updatePointerGround(e, container);
        return;
      }
      if (e.button === 0) {
        this.pointerDown = true;
        this.updatePointerGround(e, container);
      }
    };
    this._upHandler = (e: MouseEvent) => {
      if (e.button === 2) this.attackHeld = false;
      if (e.button === 0) this.pointerDown = false;
    };
    // Right-click is the attack button — suppress the browser context menu.
    this._contextHandler = (e: MouseEvent) => e.preventDefault();

    window.addEventListener("keydown", this._keyDownHandler);
    window.addEventListener("keyup", this._keyUpHandler);
    container.addEventListener("click", this._clickHandler);
    container.addEventListener("mousemove", this._moveHandler);
    container.addEventListener("mousedown", this._downHandler);
    container.addEventListener("contextmenu", this._contextHandler);
    window.addEventListener("mouseup", this._upHandler);
  }

  /** Raycast the floor under the cursor and cache the ground point for aiming. */
  private updatePointerGround(e: MouseEvent, container: HTMLDivElement) {
    const rect = container.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(mouse, this.camera);
    const gp = this.dungeonMap?.ready
      ? this.dungeonMap.floorPickFromRay(this.raycaster.ray)
      : (this.raycaster.intersectObject(this.floorPlane)[0]?.point ?? null);
    if (gp) {
      if (!this.pointerGround) this.pointerGround = new THREE.Vector3();
      this.pointerGround.copy(gp);
    }
  }

  /**
   * Hover raycast: highlight the enemy under the cursor (emissive glow) and
   * switch to a pointer cursor so targets read as clickable on the big map.
   */
  private handleHover(e: MouseEvent, container: HTMLDivElement) {
    const rect = container.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
    this.raycaster.setFromCamera(mouse, this.camera);

    const liveGroups = this.enemies
      .filter((en) => en.state !== "dead" && en.state !== "death")
      .map((en) => en.model.group);
    const hits = this.raycaster.intersectObjects(liveGroups, true);

    // Track the cursor's ground point for cursor-aim.
    const gp = this.dungeonMap?.ready
      ? this.dungeonMap.floorPickFromRay(this.raycaster.ray)
      : (this.raycaster.intersectObject(this.floorPlane)[0]?.point ?? null);
    if (gp) {
      if (!this.pointerGround) this.pointerGround = new THREE.Vector3();
      this.pointerGround.copy(gp);
    }

    let hovered: EnemyInstance | null = null;
    if (hits.length > 0) {
      const eid = hits[0].object.userData.enemyId as string | undefined;
      hovered = this.enemies.find((en) => en.id === eid) ?? null;
    }

    if (hovered !== this.hoveredEnemy) {
      this.clearHover();
      if (hovered) {
        for (const m of hovered.model.bodyMats) {
          this.hoverEmissive.set(m, { hex: m.emissive.getHex(), intensity: m.emissiveIntensity });
          m.emissive.setHex(0x662200);
          m.emissiveIntensity = 0.9;
        }
      }
      this.hoveredEnemy = hovered;
      container.style.cursor = hovered ? "pointer" : "default";
    }
  }

  /** Restore emissive on the previously-hovered enemy. */
  private clearHover() {
    for (const [mat, prev] of this.hoverEmissive) {
      mat.emissive.setHex(prev.hex);
      mat.emissiveIntensity = prev.intensity;
    }
    this.hoverEmissive.clear();
  }

  private _keyDownHandler!: (e: KeyboardEvent) => void;
  private _keyUpHandler!: (e: KeyboardEvent) => void;
  private _clickHandler!: (e: MouseEvent) => void;

  private handleClick(e: MouseEvent, container: HTMLDivElement) {
    if (e.button !== 0) return; // LEFT button only — RIGHT button is attack
    const rect = container.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
    this.raycaster.setFromCamera(mouse, this.camera);

    // Ground pick (used for AoE / deployable / camp placement and move).
    const pt = this.dungeonMap?.ready
      ? this.dungeonMap.floorPickFromRay(this.raycaster.ray)
      : (this.raycaster.intersectObject(this.floorPlane)[0]?.point ?? null);

    // Placement mode: LMB confirms ghost place (skill AoE, deployable, camp).
    if (this.placeMode && pt) {
      this.clampToArena(pt);
      const world = this.clampPlacementPoint(new THREE.Vector3(pt.x, 0, pt.z));
      this.confirmPlacement(world);
      return;
    }
    // Legacy skill index (kept in sync with placeMode)
    if (this.pendingSkillIdx >= 0 && pt) {
      this.clampToArena(pt);
      this.castPendingSkillAt(new THREE.Vector3(pt.x, 0, pt.z));
      return;
    }

    // Raycast against all enemy meshes recursively
    const liveGroups: THREE.Object3D[] = this.enemies
      .filter((en) => en.state !== "dead" && en.state !== "death")
      .map((en) => en.model.group);
    const hits = this.raycaster.intersectObjects(liveGroups, true);
    if (hits.length > 0) {
      const eid = hits[0].object.userData.enemyId as string | undefined;
      if (eid) {
        const enemy = this.enemies.find((en) => en.id === eid);
        if (enemy) {
          this.targetEnemy = enemy;
          this.playerTarget = enemy.position.clone();
          return;
        }
      }
    }

    // Click-to-move
    if (pt) {
      this.clampToArena(pt);
      this.playerTarget = new THREE.Vector3(pt.x, 0, pt.z);
      this.targetEnemy = null;
      if (this.indicatorRing) {
        this.indicatorRing.position.set(this.playerTarget.x, pt.y + 0.08, this.playerTarget.z);
        this.indicatorRing.visible = true;
      }
    }
  }

  /** Space — jump (clip + hop). Velocity hop + small dust. */
  doJump() {
    if (this.playerY > 0.05 || this.jumpVel > 0) return;
    this.jumpVel = 7.5;
    this.playerAnimator?.triggerRole("jump");
    this.playerAnimator?.triggerNamed(["jump", "jump_full"]);
  }

  /**
   * Shift — controlled-distance dodge with cooldown + i-frames.
   *
   * Direction:
   *  1. WASD / arrows held → dash along that iso move vector
   *  2. Shift alone → away from nearest living enemy / wisp threat
   *  3. else pointer ground aim, then facing forward
   *
   * Distance is engine-owned (see dodgeMath) so skins without root-motion
   * dodge clips still clear telegraphs. Root motion is ignored while i-frames
   * are active so clips cannot double-travel the dash.
   */
  doDodge() {
    const now = performance.now();
    if (now < this.dodgeCdUntil) return;
    if (this.playerHp <= 0) return;
    if (!this.combatFsm.dodge(DODGE_IFRAME_S)) return;

    const threats: { x: number; z: number }[] = [];
    for (const en of this.enemies) {
      if (en.state === "dead" || en.state === "death") continue;
      threats.push({ x: en.position.x, z: en.position.z });
    }
    if (this.wispEvents) {
      for (const w of this.wispEvents.wisps ?? []) {
        if (!w.alive) continue;
        threats.push({ x: w.position.x, z: w.position.z });
      }
    }

    const dash = resolveDodge({
      keys: this.keys,
      facingYaw: this.playerFacing,
      playerX: this.playerPos.x,
      playerZ: this.playerPos.z,
      threats,
      aimX: this.pointerGround?.x ?? null,
      aimZ: this.pointerGround?.z ?? null,
      threatRange: 24,
    });

    // Face the dash so body + directional clips match travel.
    this.playerFacing = Math.atan2(dash.dirX, dash.dirZ);
    // Sub-stepped collide so a 5m roll cannot tunnel a wall cell.
    this.movePlayerHorizontal(dash.dirX * dash.distance, dash.dirZ * dash.distance);
    this.resolvePlayer();

    // Prefer directional clip names; role dodge as fallback. Never attack.
    const clips = dodgeClipCandidates(dash.relative);
    if (!this.playerAnimator?.triggerNamed(clips, { rootMotion: false, allowAttackFallback: false })) {
      this.playerAnimator?.triggerRole("dodge", { rootMotion: false });
    }

    this.playerTarget = null;
    this.attackHeld = false;
    this.targetEnemy = null;
    if (this.indicatorRing) this.indicatorRing.visible = false;

    this.dodgeIframeUntil = now + DODGE_IFRAME_S * 1000;
    this.dodgeCdUntil = now + DODGE_COOLDOWN_S * 1000;
    this.particles?.impact(this.playerPos.clone().setY(0.35), 0xc5e8ff, 0.55);
    this.particles?.impact(this.playerPos.clone().setY(0.15), 0x8a9aaa, 0.45);
    try { kickCameraShake(this.isoCam, 0.12); } catch { /* optional */ }
    try { this.bloom?.kick?.(0.15); } catch { /* optional */ }
    this.notifyState(true);
  }

  private isDodging(): boolean {
    return this.combatFsm.invulnerable || performance.now() < this.dodgeIframeUntil;
  }

  /** 1-5: select skill. Ground-AoE / deployable wait for LMB + ghost; others cast now. */
  selectSkill(idx: number) {
    const skill = this.fighterKit.skills[idx];
    if (!skill) {
      // Fall back to legacy class skill path (also uses place mode for deployables).
      this.useSkill(idx);
      return;
    }
    const now = performance.now();
    if (now < (this.skillCdUntil[idx] ?? 0)) {
      this.log(`${skill.name} is on cooldown.`);
      return;
    }
    if (this.playerMana < skill.manaCost) {
      this.log("Not enough mana.");
      return;
    }

    // Infer deployable from explicit targeting, shape, or archetype tags.
    const arch = archetypeForSkill(
      {
        id: skill.id,
        name: skill.name,
        type: skill.element === "physical" ? "physical" : "magical",
        manaCost: skill.manaCost,
        cooldown: skill.cooldown,
        effects: [skill.description, skill.id, skill.name],
      } as import("../data/classSkills").ClassSkill,
      idx,
    );
    const isDeploy =
      skill.targeting === "deployable" ||
      skill.shape === "deployable" ||
      !!skill.deployable ||
      arch.shape === "deployable";

    if (isDeploy) {
      const dep = (skill.deployable ?? arch.deployable ?? "fire_totem") as DeployableKind;
      const color = skill.color ?? arch.color;
      const radius = (skill.aoeRadius ?? arch.radius ?? 4) * this.perkMods().aoeRadiusMult;
      const maxRange = skill.placeRange ?? arch.range ?? 6;
      this.beginDeployablePlacement({
        skillIdx: idx,
        legacyHud: false,
        deployKind: dep,
        maxRange,
        radius,
        color,
        damage: this.playerBaseDamage * skill.damageMult * arch.damageMult,
        manaCost: skill.manaCost,
        cooldown: skill.cooldown,
      });
      this.log(`${skill.name} — ghost ready. LMB to deploy (Esc cancel).`);
      return;
    }

    if (skill.targeting === "ground_aoe") {
      const r = (skill.aoeRadius ?? 4) * this.perkMods().aoeRadiusMult;
      const color = skill.color ?? elementColor(skill.element);
      this.beginSkillAoePlacement(idx, r, color, skill.placeRange ?? 9);
      this.log(`${skill.name} ready — LMB to place AoE (Esc cancel).`);
      return;
    }
    this.castFighterSkill(idx, null);
  }

  /** Esc / cancel — clear ghost placement. */
  cancelSkillTargeting() {
    this.cancelPlacement();
  }

  cancelPlacement() {
    this.pendingSkillIdx = -1;
    this.placeMode = null;
    if (this.skillCursor) this.skillCursor.visible = false;
    this.clearPlaceGhost();
    this.notifyState();
  }

  private clearPlaceGhost() {
    if (!this.placeGhost) return;
    this.scene.remove(this.placeGhost);
    this.placeGhost.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.geometry?.dispose();
      const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
      for (const mat of mats) mat.dispose();
    });
    this.placeGhost = null;
  }

  private setPlaceGhost(group: THREE.Group) {
    this.clearPlaceGhost();
    this.placeGhost = group;
    this.scene.add(group);
    const p = this.pointerGround ?? this.playerPos;
    group.position.set(p.x, 0, p.z);
  }

  private beginSkillAoePlacement(idx: number, radius: number, color: number, maxRange: number) {
    this.cancelPlacement();
    this.pendingSkillIdx = idx;
    this.placeMode = { kind: "skill_aoe", skillIdx: idx, maxRange, radius, color };
    if (this.skillCursor && this.skillCursorMat) {
      this.skillCursor.visible = true;
      this.skillCursor.scale.setScalar(radius);
      this.skillCursorMat.color.setHex(color);
    }
    this.notifyState();
  }

  private beginDeployablePlacement(opts: {
    skillIdx: number;
    legacyHud: boolean;
    deployKind: DeployableKind;
    maxRange: number;
    radius: number;
    color: number;
    damage: number;
    manaCost: number;
    cooldown: number;
  }) {
    this.cancelPlacement();
    this.pendingSkillIdx = opts.skillIdx;
    this.placeMode = {
      kind: "deployable",
      skillIdx: opts.skillIdx,
      legacyHud: opts.legacyHud,
      deployKind: opts.deployKind,
      maxRange: opts.maxRange,
      radius: opts.radius,
      color: opts.color,
      damage: opts.damage,
      manaCost: opts.manaCost,
      cooldown: opts.cooldown,
    };
    // Ring + 3D ghost
    if (this.skillCursor && this.skillCursorMat) {
      this.skillCursor.visible = true;
      this.skillCursor.scale.setScalar(Math.max(1.2, opts.radius * 0.45));
      this.skillCursorMat.color.setHex(opts.color);
    }
    this.setPlaceGhost(createDeployableGhost(opts.deployKind, opts.color, opts.radius));
    this.notifyState();
  }

  /** Clamp place point to maxRange from player and arena. */
  private clampPlacementPoint(world: THREE.Vector3): THREE.Vector3 {
    const mode = this.placeMode;
    const maxR = mode && "maxRange" in mode ? mode.maxRange : 12;
    const to = world.clone().sub(this.playerPos);
    to.y = 0;
    if (to.length() > maxR) to.setLength(maxR);
    const out = this.playerPos.clone().add(to);
    out.y = 0;
    this.clampToArena(out);
    // Camps snap to claim pads when close
    if (mode?.kind === "camp" && mode.padId) {
      const d = Math.hypot(out.x - mode.padX, out.z - mode.padZ);
      if (d < 14) {
        out.set(mode.padX, 0, mode.padZ);
      }
    }
    // Avoid placing combat deployables deep inside enemy-only camps? allow player camps
    return out;
  }

  private updatePlaceGhostFollow() {
    if (!this.placeMode) return;
    const raw = this.pointerGround
      ? this.pointerGround.clone()
      : this.playerPos.clone().add(
          new THREE.Vector3(Math.sin(this.playerFacing), 0, Math.cos(this.playerFacing)).multiplyScalar(4),
        );
    const p = this.clampPlacementPoint(raw);
    if (this.placeGhost) {
      this.placeGhost.position.set(p.x, 0, p.z);
      // Soft pulse
      const t = performance.now() / 1000;
      this.placeGhost.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        const mat = m.material as THREE.MeshStandardMaterial;
        if (mat?.opacity != null) {
          mat.opacity = 0.35 + 0.15 * Math.sin(t * 4);
        }
      });
      // Valid/invalid tint for camp (inside pad / resources already checked on enter)
      if (this.placeMode.kind === "camp") {
        const ok = this.isCampPlaceValid(p);
        this.placeGhost.traverse((o) => {
          const m = o as THREE.Mesh;
          if (!m.isMesh) return;
          const mat = m.material as THREE.MeshStandardMaterial;
          if (mat?.emissive) mat.emissive.setHex(ok ? 0x44aa66 : 0xaa3333);
        });
      }
    }
    if (this.skillCursor && this.placeMode.kind !== "camp") {
      this.skillCursor.visible = true;
      this.skillCursor.position.set(p.x, 0.12, p.z);
    }
  }

  private isCampPlaceValid(p: THREE.Vector3): boolean {
    if (isInsidePlayerCamp(this.playerCamps, p.x, p.z)) return false;
    if (this.placeMode?.kind === "camp" && this.placeMode.padId) {
      return Math.hypot(p.x - this.placeMode.padX, p.z - this.placeMode.padZ) < 14;
    }
    // Free place allowed if near a claimable zone or any open ground within range
    const pad =
      this.worldManifest &&
      nearestClaimableZone(this.worldManifest, p.x, p.z, 12);
    if (pad && pad.owner !== "none" && pad.owner !== "wild") return false;
    return true;
  }

  private confirmPlacement(world: THREE.Vector3) {
    const mode = this.placeMode;
    if (!mode) return;
    const p = this.clampPlacementPoint(world);

    if (mode.kind === "skill_aoe") {
      const idx = mode.skillIdx;
      this.cancelPlacement();
      this.castFighterSkill(idx, p);
      return;
    }

    if (mode.kind === "deployable") {
      const m = mode;
      // Re-check mana/cd at confirm
      if (m.skillIdx >= 0 && !m.legacyHud) {
        const skill = this.fighterKit.skills[m.skillIdx];
        if (skill) {
          if (this.playerMana < skill.manaCost) {
            this.log("Not enough mana.");
            this.cancelPlacement();
            return;
          }
          if (performance.now() < (this.skillCdUntil[m.skillIdx] ?? 0)) {
            this.log("Skill on cooldown.");
            this.cancelPlacement();
            return;
          }
          this.playerMana -= skill.manaCost;
          this.skillCdUntil[m.skillIdx] = performance.now() + skill.cooldown * 1000;
          this.playerAnimator?.triggerNamed(skill.anim);
        }
      } else if (m.legacyHud) {
        if (!this.combatFsm.skill(0.55)) {
          this.cancelPlacement();
          return;
        }
        this.playerAttackCooldown = this.playerMaxAttackCooldown;
        this.playerAnimator?.triggerNamed(
          skillAnimCandidates(m.skillIdx, true),
        );
      }
      const ok = this.deployables.deploy(
        m.deployKind,
        p,
        m.color,
        m.damage,
        m.radius,
      );
      if (ok) {
        this.particles?.castSkillVfx({
          element: "fire",
          shape: "deployable",
          center: p.clone(),
          origin: this.playerPos.clone(),
          dir: this.resolveAimDir(),
          reach: m.radius,
        });
        this.log(`Deployed ${m.deployKind.replace("_", " ")}.`);
      }
      this.cancelPlacement();
      this.notifyState();
      return;
    }

    if (mode.kind === "camp") {
      this.confirmCampBuild(p);
      return;
    }
  }

  private castPendingSkillAt(world: THREE.Vector3) {
    if (this.placeMode) {
      this.confirmPlacement(world);
      return;
    }
    const idx = this.pendingSkillIdx;
    if (idx < 0) return;
    this.pendingSkillIdx = -1;
    if (this.skillCursor) this.skillCursor.visible = false;
    this.castFighterSkill(idx, world);
  }

  /** R — character special attack (skill_a / skill_b wave). */
  useSpecial() {
    if (this.initStats?.skinId === RACALVIN_ID) this.launchRacalvinSwords();
    const now = performance.now();
    if (now < this.specialCdUntil) {
      this.log("Special on cooldown.");
      return;
    }
    const sp = this.fighterKit.special;
    if (this.playerMana < sp.manaCost) {
      this.log("Not enough mana for special.");
      return;
    }
    this.playerMana -= sp.manaCost;
    this.specialCdUntil = now + sp.cooldown * 1000;
    this.playerFacing = Math.atan2(this.resolveAimDir().x, this.resolveAimDir().z);
    this.playerAnimator?.triggerNamed(sp.anim);
    if (!this.playerAnimator?.isRootMotionActive()) {
      const f = this.resolveAimDir();
      this.playerPos.x += f.x * 1.2;
      this.playerPos.z += f.z * 1.2;
      this.clampToArena(this.playerPos);
    }
    const mods = this.perkMods();
    const dir = this.resolveAimDir();
    const origin = this.playerPos.clone().setY(1.15);
    const dmg = this.playerBaseDamage * sp.damageMult * mods.autoAttackMult * (0.9 + Math.random() * 0.2);
    if (sp.slashWave) {
      this.slashField?.spawn(origin, dir, {
        damage: dmg,
        range: sp.slashRange * mods.slashRangeMult,
        color: sp.color,
        radius: 1.5 * Math.min(1.4, mods.aoeRadiusMult),
      });
    } else {
      // Melee special cone
      const q: ShapeQuery = {
        kind: "cone",
        origin: this.playerPos.clone(),
        dir,
        radius: 5.5,
        halfAngle: Math.PI / 4,
      };
      this.telegraphs?.show(q, 0.25, sp.color);
      for (const en of targetsInShape(q, this.enemies, (e) => e.state !== "dead" && e.state !== "death")) {
        this.damageEnemy(en, dmg, Math.random() < this.playerCritChance + 0.08);
      }
    }
    this.auras?.pulse(sp.element ?? this.playerAuraElement, this.playerPos.clone(), 2.8, 0.5);
    this.log(`${getActiveFighter().name} — ${sp.name}!`);
    this.notifyState();
  }

  /** Cast a fighter skill; `place` is set for ground_aoe. */
  private castFighterSkill(idx: number, place: THREE.Vector3 | null) {
    const skill = this.fighterKit.skills[idx];
    if (!skill) return;
    const now = performance.now();
    if (now < (this.skillCdUntil[idx] ?? 0)) return;
    if (this.playerMana < skill.manaCost) {
      this.log("Not enough mana.");
      return;
    }
    this.playerMana -= skill.manaCost;
    const preBoost = resolveSkillBoost(skill.id);
    this.skillCdUntil[idx] = now + skill.cooldown * 1000 * preBoost.cooldownMult;

    const dir = this.resolveAimDir();
    this.playerFacing = Math.atan2(dir.x, dir.z);
    this.playerAnimator?.triggerNamed(skill.anim);
    if (!this.playerAnimator?.isRootMotionActive() && skill.targeting !== "self" && skill.targeting !== "ground_aoe") {
      this.playerPos.x += dir.x * 1.1;
      this.playerPos.z += dir.z * 1.1;
      this.clampToArena(this.playerPos);
    }

    const mods = this.perkMods();
    const skillBoost = preBoost;
    const stones = getStoneCombatMods();
    const loadout = getGameLoadout();
    const spell = loadout.combat.spellDamageMult;
    const dmg =
      this.playerBaseDamage *
      skill.damageMult *
      mods.autoAttackMult *
      skillBoost.damageMult *
      spell *
      (0.85 + Math.random() * 0.3);
    const color = skill.color ?? elementColor(skill.element);
    const aoeMul = mods.aoeRadiusMult * skillBoost.aoeMult * loadout.combat.aoeMult;
    const slashMul = mods.slashRangeMult * (1 + stones.aoe * 0.5);
    const skillId = skill.id;

    if (skill.targeting === "self") {
      // Heal-ish for marco regen style
      if (skill.damageMult < 0.6) {
        this.playerHp = Math.min(this.playerMaxHp, this.playerHp + 40 + this.playerLevel * 5);
        this.log(`${skill.name} — restored vitality.`);
      } else {
        const q: ShapeQuery = {
          kind: "nova",
          origin: this.playerPos.clone(),
          dir,
          radius: skill.aoeRadius ?? 4,
        };
        this.telegraphs?.show(q, 0.3, color);
        this.particles?.castSkillVfx({
          element: skill.element,
          shape: "nova",
          center: this.playerPos.clone(),
          origin: this.playerPos.clone(),
          dir,
          reach: skill.aoeRadius ?? 4,
        });
        for (const en of targetsInShape(q, this.enemies, (e) => e.state !== "dead" && e.state !== "death")) {
          this.damageEnemy(en, dmg, false, skillId);
        }
        this.damageEventPropsInRadius(this.playerPos, (skill.aoeRadius ?? 4) * aoeMul, dmg);
      }
      this.auras?.pulse(skill.element, this.playerPos.clone(), 2.2 * aoeMul, 0.45);
      this.notifyState();
      return;
    }

    if (skill.targeting === "slash_wave" || skill.shape === "slash") {
      this.slashField?.spawn(this.playerPos.clone().setY(1.15), dir, {
        damage: dmg,
        range: (skill.slashRange ?? 11) * slashMul,
        color,
        radius: 1.4 * Math.min(1.35, aoeMul),
      });
      this.auras?.pulse(skill.element, this.playerPos.clone(), 1.8, 0.35);
      this.log(`${skill.name}!`);
      this.notifyState();
      return;
    }

    // Deployable skills (totem / turret / trap) — place must come from LMB ghost.
    if (
      skill.targeting === "deployable" ||
      skill.shape === "deployable" ||
      skill.deployable
    ) {
      if (!place) {
        // Re-enter ghost mode if cast without a point
        const arch = archetypeForSkill(
          {
            id: skill.id,
            name: skill.name,
            type: skill.element === "physical" ? "physical" : "magical",
            manaCost: skill.manaCost,
            cooldown: skill.cooldown,
            effects: [skill.description],
          } as import("../data/classSkills").ClassSkill,
          idx,
        );
        // Refund mana/cd since we didn't actually cast
        this.playerMana = Math.min(this.playerMaxMana, this.playerMana + skill.manaCost);
        this.skillCdUntil[idx] = 0;
        this.beginDeployablePlacement({
          skillIdx: idx,
          legacyHud: false,
          deployKind: (skill.deployable ?? arch.deployable ?? "fire_totem") as DeployableKind,
          maxRange: skill.placeRange ?? arch.range ?? 6,
          radius: (skill.aoeRadius ?? arch.radius ?? 4) * aoeMul,
          color,
          damage: dmg,
          manaCost: skill.manaCost,
          cooldown: skill.cooldown,
        });
        return;
      }
      const dep = (skill.deployable ?? "fire_totem") as DeployableKind;
      this.deployables.deploy(dep, place, color, dmg, (skill.aoeRadius ?? 4) * aoeMul);
      this.particles?.castSkillVfx({
        element: skill.element,
        shape: "deployable",
        center: place.clone(),
        origin: this.playerPos.clone(),
        dir,
        reach: skill.aoeRadius ?? 4,
      });
      this.log(`${skill.name} deployed.`);
      this.notifyState();
      return;
    }

    if (skill.targeting === "ground_aoe") {
      const maxR = (skill.placeRange ?? 9) * Math.min(1.25, aoeMul);
      let center = place ?? this.playerPos.clone().add(dir.clone().multiplyScalar(maxR * 0.55));
      const to = center.clone().sub(this.playerPos);
      if (to.length() > maxR) {
        to.setLength(maxR);
        center = this.playerPos.clone().add(to);
      }
      this.clampToArena(center);
      const radius = (skill.aoeRadius ?? 4) * aoeMul;
      const kind = skill.shape === "nova" ? "nova" : "circle";
      const q: ShapeQuery = {
        kind,
        origin: center.clone(),
        dir,
        radius,
      };
      this.telegraphs?.show(q, 0.4, color);
      this.skillVfx?.spawn("cloud", center.clone(), radius, 1.1);
      this.particles?.castSkillVfx({
        element: skill.element,
        shape: kind,
        center: center.clone(),
        origin: this.playerPos.clone(),
        dir,
        reach: radius,
      });
      this.auras?.pulse(skill.element, center.clone(), radius * 0.9, 0.5);
      for (const en of targetsInShape(q, this.enemies, (e) => e.state !== "dead" && e.state !== "death")) {
        const isCrit = Math.random() < this.playerCritChance + mods.critBonus + skillBoost.critBonus + 0.05;
        this.damageEnemy(en, dmg * (isCrit ? 1.75 : 1), isCrit, skillId);
      }
      this.damageEventPropsInRadius(center, radius, dmg);
      this.log(`${skill.name} detonates!`);
      this.notifyState();
      return;
    }

    // Instant cone / line / nova from self (slash shapes already returned above).
    const shapeKind: ShapeQuery["kind"] =
      skill.shape === "line" || skill.shape === "cone" || skill.shape === "nova" || skill.shape === "circle"
        ? skill.shape
        : "cone";
    const q: ShapeQuery = {
      kind: shapeKind,
      origin: this.playerPos.clone(),
      dir,
      radius: (skill.aoeRadius ?? 5) * aoeMul,
      halfAngle: Math.PI / 4,
      length: (skill.slashRange ?? 9) * slashMul,
      halfWidth: 1.3 * Math.min(1.3, aoeMul),
    };
    this.telegraphs?.show(q, 0.28, color);
    this.particles?.castSkillVfx({
      element: skill.element,
      shape: shapeKind as SkillShapeKind,
      center: this.playerPos.clone(),
      origin: this.playerPos.clone(),
      dir,
      reach: (skill.aoeRadius ?? skill.slashRange ?? 5) * aoeMul,
      halfAngle: Math.PI / 4,
    });

    // Line / bolt skills also fire a traveling projectile that damages on pass-through.
    if (shapeKind === "line" || /bolt|beam|arrow|shot|ray|lance/i.test(skill.name + skill.id)) {
      this.firePlayerProjectile(dir, dmg, color, skill.element);
    }

    // Also fire a short slash wave so physical cuts travel past the fist.
    if (skill.element === "physical" || shapeKind === "cone" || mods.autoAttackSlash) {
      this.slashField?.spawn(this.playerPos.clone().setY(1.1), dir, {
        damage: dmg * 0.55,
        range: Math.min(14, (skill.slashRange ?? 7) * slashMul),
        color,
        radius: 1.2,
      });
    }
    for (const en of targetsInShape(q, this.enemies, (e) => e.state !== "dead" && e.state !== "death")) {
      const isCrit = Math.random() < this.playerCritChance + mods.critBonus + skillBoost.critBonus + 0.05;
      this.damageEnemy(en, dmg * (isCrit ? 1.75 : 1), isCrit, skillId);
    }
    this.damageEventPropsInRadius(
      this.playerPos,
      Math.max(q.radius ?? 4, (q.length ?? 0) * 0.45),
      dmg,
    );
    this.auras?.pulse(skill.element, this.playerPos.clone(), 1.6 * aoeMul, 0.35);
    this.log(`${skill.name}!`);
    this.notifyState();
  }

  /** Traveling skill bolt — damages first enemy hit along the path. */
  private firePlayerProjectile(
    dir: THREE.Vector3,
    damage: number,
    color: number,
    element: string,
  ) {
    const origin = this.playerPos.clone();
    origin.y = 1.2;
    const target = this.playerPos.clone().add(dir.clone().setY(0).normalize().multiplyScalar(18));
    target.y = 1.0;
    // Arcane / magic: spline (ballistic) bolts; physical: linear
    if (/arcane|magic|ice|frost|void|psychic|fire/i.test(element)) {
      const mid = origin.clone().lerp(target, 0.45);
      mid.y += 3.2 + Math.random() * 1.5;
      mid.x += (Math.random() - 0.5) * 2;
      mid.z += (Math.random() - 0.5) * 2;
      this.projectileField?.spawnSpline({
        origin,
        control: mid,
        target,
        damage,
        speed: 18,
        color,
        radius: 0.85,
        life: 1.4,
        label: "Skill Arc",
        team: "player",
        seekAccel: 3.2,
      });
    } else {
      this.projectileField?.spawn({
        origin: this.playerPos.clone(),
        dir,
        damage,
        speed: 22,
        color,
        radius: 1.1,
        homing: 0,
        life: 1.1,
        y: 1.2,
        label: "Skill Bolt",
        team: "player",
      });
    }
  }

  /**
   * Boss special rotation (ArenaScene-inspired): telegraphed melee AoE, ground
   * circle under player, line pierce, projectile volley. Watch red zones.
   */
  private fireBossSpecial(en: EnemyInstance, dist: number) {
    const castN = (this.bossSpecialCount.get(en.id) ?? 0) + 1;
    this.bossSpecialCount.set(en.id, castN);
    // Deterministic damage variance + special pick (same seed → same fight choreography).
    const dmgU = (hashString(`${en.id}|dmg|${castN}`) >>> 0) / 4294967296;
    const dmg = Math.floor(en.template.damage * (1.1 + dmgU * 0.35));
    const origin = en.position.clone();
    const dir = this._tmpV3a.set(
      this.playerPos.x - origin.x,
      0,
      this.playerPos.z - origin.z,
    );
    if (dir.lengthSq() < 1e-4) dir.set(0, 0, 1);
    dir.normalize();
    en.anim.isAttacking = true;
    en.facing = Math.atan2(dir.x, dir.z);

    // 0 slam · 1 eruption · 2 beam · 3 volley — force slam when player is in face range.
    let pick = WarningEffectField.pickIndex(en.id, castN, 4);
    if (dist < 3.5) pick = 0;
    const name = en.template.name;
    const isDark = /dark elf|shadow|void/i.test(name);
    const isSpider = /spider|pincher|brood|chitin|arach/i.test(name);
    const isSkel = /skeleton|bone|undead|minion|reaver|conjurer/i.test(name);

    if (pick === 0) {
      const center = origin.clone().add(dir.clone().multiplyScalar(2.2));
      const windup = WarningEffectField.windupFor(en.id, "slam", isSpider ? 0.4 : 0.55, 0.2);
      this.pendingStrikes?.schedule({
        kind: "circle",
        origin: center,
        dir,
        radius: 3.4 + en.template.tier * 0.15 + (isSpider ? 0.6 : 0),
        damage: dmg,
        windup,
        label: `${name} Slam`,
        color: isDark ? 0xaa33ff : isSpider ? 0x884ccc : 0xff3322,
        element: "physical",
        sourceId: en.id,
        ring: true,
        warnHeight: en.model.height + 0.6,
      });
      this.log(`${name} winds up a slam!`);
    } else if (pick === 1) {
      const windup = WarningEffectField.windupFor(en.id, "eruption", 1.0, 0.3);
      this.pendingStrikes?.schedule({
        kind: "circle",
        origin: this.playerPos.clone(),
        dir,
        radius: 3.6 + (isDark ? 0.5 : 0),
        damage: Math.round(dmg * 1.15),
        windup,
        label: `${name} Eruption`,
        color: isDark ? 0xcc44ff : isSkel ? 0x88aaff : 0xff8800,
        element: isDark ? "arcane" : "fire",
        sourceId: en.id,
        ring: true,
        warnHeight: 2.8,
      });
      this.log(`${name} marks the ground — move!`);
    } else if (pick === 2) {
      const windup = WarningEffectField.windupFor(en.id, "beam", 0.65, 0.25);
      this.pendingStrikes?.schedule({
        kind: "line",
        origin,
        dir,
        length: 14,
        halfWidth: 1.45,
        damage: Math.round(dmg * 1.05),
        windup,
        label: `${name} Beam`,
        color: isDark ? 0x66eeff : 0xffaa33,
        element: "arcane",
        sourceId: en.id,
        warnHeight: en.model.height + 0.5,
      });
      this.log(`${name} channels a beam!`);
    } else {
      // Projectile volley + brief cast warning over caster.
      const windup = WarningEffectField.windupFor(en.id, "volley", 0.35, 0.15);
      this.warningFx?.spawn({
        position: origin,
        duration: windup,
        color: 0xaa44ff,
        height: en.model.height + 0.4,
        seed: `${en.id}|volley|${castN}`,
      });
      this.projectileField?.spawnVolley(origin, this.playerPos, 3 + (en.template.tier >= 5 ? 2 : 0), {
        damage: Math.round(dmg * 0.75),
        speed: 12,
        color: isDark ? 0x9944ff : isSpider ? 0xaa66cc : 0xaa44ff,
        radius: 0.95,
        homing: 0.08,
        y: Math.max(1.4, en.model.height * 0.45),
        label: `${name} Bolt`,
      });
      this.log(`${name} unleashes bolts!`);
    }
  }

  private fireEnemyProjectile(en: EnemyInstance, dmg: number, magic: boolean) {
    const origin = en.position.clone();
    origin.y = Math.max(1.2, en.model.height * 0.45);
    const target = this.playerPos.clone();
    target.y = 1.0;
    if (magic) {
      const mid = origin.clone().lerp(target, 0.4);
      mid.y += 2.8;
      mid.x += (Math.random() - 0.5) * 3;
      mid.z += (Math.random() - 0.5) * 3;
      this.projectileField?.spawnSpline({
        origin,
        control: mid,
        target,
        damage: dmg,
        speed: 11,
        color: 0x8866ff,
        radius: 0.7,
        label: en.template.name,
        team: "enemy",
        seekAccel: 4.5,
      });
    } else {
      const dir = this._tmpV3a.set(
        this.playerPos.x - en.position.x,
        0,
        this.playerPos.z - en.position.z,
      );
      if (dir.lengthSq() < 1e-4) dir.set(0, 0, 1);
      dir.normalize();
      this.projectileField?.spawn({
        origin: en.position.clone(),
        dir,
        damage: dmg,
        speed: 14,
        color: 0xff6633,
        radius: 0.9,
        homing: 0,
        y: 1.15,
        label: en.template.name,
      });
    }
  }

  attackNearest() {
    if (this.playerAttackCooldown > 0) return;
    let nearest: EnemyInstance | null = null;
    let nearestDist = Infinity;
    for (const en of this.enemies) {
      if (en.state === "dead" || en.state === "death") continue;
      const d = en.position.distanceTo(this.playerPos);
      if (d < nearestDist) { nearestDist = d; nearest = en; }
    }
    // Prefer wisps when closer than standard enemies
    if (this.wispEvents) {
      const w = nearestAliveWisp(this.wispEvents, this.playerPos, 4.5);
      if (w) {
        const wd = Math.hypot(w.position.x - this.playerPos.x, w.position.z - this.playerPos.z);
        if (!nearest || wd <= nearestDist) {
          this.playerAttackCooldown = this.playerMaxAttackCooldown;
          this.playerFacing = Math.atan2(w.position.x - this.playerPos.x, w.position.z - this.playerPos.z);
          this.playerAnimator?.triggerAttack();
          const dmg = Math.max(1, Math.floor(this.playerBaseDamage * (0.9 + Math.random() * 0.3)));
          const killed = damageWisp(w, dmg);
          this.particles?.impact(w.position.clone().setY(1.4), w.palette.color, 0.45);
          this.log(killed ? `${w.palette.name} extinguished!` : `Hit ${w.palette.name} for ${dmg} (${w.hp}/${w.maxHp})`);
          this.notifyState();
          return;
        }
      }
    }
    // Dark-elf event structures (crystal / pylons / barriers)
    if (this.darkElfEvent?.isActive()) {
      const s = this.darkElfEvent.nearestStructure(this.playerPos, 4.2);
      if (s) {
        const sd = Math.hypot(s.position.x - this.playerPos.x, s.position.z - this.playerPos.z);
        if (!nearest || sd <= nearestDist) {
          this.playerAttackCooldown = this.playerMaxAttackCooldown;
          this.playerFacing = Math.atan2(s.position.x - this.playerPos.x, s.position.z - this.playerPos.z);
          this.playerAnimator?.triggerAttack();
          const dmg = Math.max(1, Math.floor(this.playerBaseDamage * (0.95 + Math.random() * 0.25)));
          const killed = this.darkElfEvent.damageStructure(s, dmg);
          this.particles?.impact(s.position.clone().setY(1.2), 0xaa55ff, 0.5);
          if (killed) {
            this.log(
              s.kind === "crystal"
                ? "Void Crystal shattered — dark-elf ritual broken!"
                : `${s.name} destroyed!`,
            );
            if (s.kind === "crystal") {
              // Bonus: extinguish nearby ritual wisps lightly
              if (this.wispEvents) {
                for (const w of this.wispEvents.wisps) {
                  if (!w.alive) continue;
                  if (Math.hypot(w.position.x - s.position.x, w.position.z - s.position.z) < 20) {
                    damageWisp(w, Math.floor(w.maxHp * 0.35));
                  }
                }
              }
            }
          } else {
            this.log(`Hit ${s.name} for ${dmg} (${Math.ceil(s.hp)}/${s.maxHp})`);
          }
          this.notifyState();
          return;
        }
      }
    }
    if (nearest && nearestDist < 4.5) {
      this.doAttack(nearest);
      return;
    }
    // No foe in melee — chop trees / quarry stone by attacking harvest nodes.
    this.tryHarvestAttack();
  }

  /** Nearest live enemy within `maxDist` (used by the RMB hold-to-attack lock). */
  private nearestEnemy(maxDist: number): EnemyInstance | null {
    let nearest: EnemyInstance | null = null;
    let nearestDist = maxDist;
    for (const en of this.enemies) {
      if (en.state === "dead" || en.state === "death") continue;
      const d = en.position.distanceTo(this.playerPos);
      if (d < nearestDist) { nearestDist = d; nearest = en; }
    }
    return nearest;
  }

  /** Provide resolved HUD skills so archetypes map to real skill flavor.
   *  Optional — the slot-index fallback already gives a broad shape mix. */
  setHudSkills(skills: (ClassSkill | undefined)[]) {
    this.hudSkills = skills;
  }

  /** Adapt an enemy into the scene-agnostic CombatTarget used by shape queries
   *  and deployables, routing damage through the existing death pipeline. */
  private asTarget(en: EnemyInstance): CombatTarget {
    return {
      position: en.position,
      isAlive: () => en.state !== "dead" && en.state !== "death",
      applyDamage: (amount, isCrit) => this.damageEnemy(en, amount, isCrit),
    };
  }

  private enemyTargets(): CombatTarget[] {
    const out = this._enemyTargetScratch;
    out.length = 0;
    for (const en of this.enemies) {
      if (en.state === "dead" || en.state === "death") continue;
      out.push(this.asTarget(en));
    }
    return out;
  }

  /**
   * Apply damage + stone procs (bolts, novas, elemental). Optional skillId for ranks.
   */
  private damageEnemy(en: EnemyInstance, amount: number, isCrit: boolean, skillId?: string) {
    if (en.state === "dead" || en.state === "death") return;
    this.combatUntil = performance.now() / 1000 + 4.5;
    const skillBoost = skillId ? resolveSkillBoost(skillId) : undefined;
    const stones = getStoneCombatMods();
    const spell = 1 + stones.spellDamage;
    let raw = amount * (skillBoost?.damageMult ?? 1);
    const baseForProc = Math.max(1, Math.floor(amount));
    const procs = resolveHitProcs({
      isCrit,
      isSkill: !!skillId,
      baseDamage: baseForProc,
      spellPower: spell,
    });
    let dmg = Math.max(1, Math.floor(raw) + procs.extraDamage - Math.floor(en.template.tier * 2));
    if (en.model.group.userData.shockedUntil && performance.now() < en.model.group.userData.shockedUntil) {
      dmg = Math.floor(dmg * 1.2);
    }
    en.hp = Math.max(0, en.hp - dmg);
    if (procs.heal > 0) this.playerHp = Math.min(this.playerMaxHp, this.playerHp + procs.heal);
    if (procs.shock) en.model.group.userData.shockedUntil = performance.now() + 2500;
    if (procs.frost) en.model.group.userData.chilledUntil = performance.now() + 2200;
    if (procs.burn) en.model.group.userData.bleedUntil = performance.now() + 2800;

    const wp = en.model.group.position.clone();
    wp.y += en.model.height * 0.7;
    this.damageNumbers.push({ id: `d${this.idCounter++}`, value: dmg, worldPos: wp, age: 0, isPlayer: false, isCrit });
    this.particles?.impact(wp, procs.elementColor || (isCrit ? 0xffd54a : 0xff7a1e), procs.particles ? 1.1 : 0.7);

    // Auto-fire projectile / nova from stones
    const aim = new THREE.Vector3(en.position.x - this.playerPos.x, 0, en.position.z - this.playerPos.z);
    if (aim.lengthSq() < 1e-4) aim.set(Math.sin(this.playerFacing), 0, Math.cos(this.playerFacing));
    aim.normalize();
    if (procs.fireBolt) {
      this.slashField?.spawn(this.playerPos.clone().setY(1.2), aim, {
        damage: Math.max(4, Math.floor(baseForProc * 0.5)),
        range: 11 + stones.aoe * 4,
        color: procs.elementColor,
        radius: 1.15,
        speed: 32,
      });
    }
    if (procs.nova) {
      const r = 3.2 * (1 + stones.aoe);
      const q: ShapeQuery = { kind: "nova", origin: en.position.clone(), dir: aim, radius: r };
      this.telegraphs?.show(q, 0.2, procs.elementColor);
      this.auras?.pulse("fire", en.position.clone(), r, 0.4);
      for (const other of targetsInShape(q, this.enemies, (e) => e.state !== "dead" && e.state !== "death" && e !== en)) {
        const splash = Math.max(1, Math.floor(baseForProc * 0.35));
        other.hp = Math.max(0, other.hp - splash);
        if (other.hp <= 0) this.killEnemy(other, skillId);
      }
    }

    if (procs.labels.length) this.log(procs.labels.join(" · "));
    if (en.hp <= 0) {
      this.killEnemy(en, skillId);
    } else {
      en.anim.hurtPhase = 1;
      en.state = "hurt";
      en.hurtTimer = en.model.group.userData.chilledUntil ? 0.55 : 0.35;
    }
  }

  /** Resolve aim direction: cursor-aim while the pointer is held, else auto-aim
   *  the nearest living enemy, else keep the current facing. */
  private resolveAimDir(): THREE.Vector3 {
    if (this.pointerDown && this.pointerGround) {
      const d = new THREE.Vector3(this.pointerGround.x - this.playerPos.x, 0, this.pointerGround.z - this.playerPos.z);
      if (d.lengthSq() > 1e-4) return d.normalize();
    }
    let nearest: EnemyInstance | null = null;
    let nearestDist = Infinity;
    for (const en of this.enemies) {
      if (en.state === "dead" || en.state === "death") continue;
      const d = en.position.distanceTo(this.playerPos);
      if (d < nearestDist) { nearestDist = d; nearest = en; }
    }
    if (nearest) {
      const d = new THREE.Vector3(nearest.position.x - this.playerPos.x, 0, nearest.position.z - this.playerPos.z);
      if (d.lengthSq() > 1e-4) return d.normalize();
    }
    return new THREE.Vector3(Math.sin(this.playerFacing), 0, Math.cos(this.playerFacing));
  }

  /** Skill-bar action: resolve the skill's ARCHETYPE (shape or deployable), aim
   *  it (auto/cursor), show a ground telegraph, fire particles + GLB flavor, and
   *  strike every enemy inside the shape. */
  useSkill(idx: number) {
    if (this.playerAttackCooldown > 0) return;
    const arch = archetypeForSkill(this.hudSkills[idx], idx);

    // Deployables: ghost follows mouse, LMB confirms (no auto-place).
    if (arch.shape === "deployable") {
      const dep = (arch.deployable ?? "fire_totem") as DeployableKind;
      this.beginDeployablePlacement({
        skillIdx: idx,
        legacyHud: true,
        deployKind: dep,
        maxRange: arch.range ?? 5,
        radius: arch.radius ?? 4,
        color: arch.color,
        damage: this.playerBaseDamage * arch.damageMult,
        manaCost: 0,
        cooldown: 0,
      });
      this.log(`Place ${dep.replace("_", " ")} — LMB to deploy (Esc cancel).`);
      this.notifyState();
      return;
    }

    if (!this.combatFsm.skill(0.55)) return;
    const dir = this.resolveAimDir();
    this.playerFacing = Math.atan2(dir.x, dir.z);

    const isCast = arch.shape === "circle" || arch.shape === "nova";
    const played = this.playerAnimator?.triggerNamed(skillAnimCandidates(idx, isCast)) ?? false;
    if (!played) this.playerAnimator?.triggerAttack();
    // If the model has no locomotion root bone, commit permanent forward travel
    // so the fighter ends where the skill ends instead of sliding back.
    if (!this.playerAnimator?.isRootMotionActive()) {
      const dist = isCast ? 0.35 : 1.5;
      const f = this.resolveAimDir();
      this.playerPos.x += f.x * dist;
      this.playerPos.z += f.z * dist;
      this.clampToArena(this.playerPos);
    }
    this.playerAttackCooldown = this.playerMaxAttackCooldown;
    this.bloom?.kick(0.28);
    kickCameraShake(this.isoCam, 0.08);

    const origin = this.playerPos.clone();

    const q: ShapeQuery = {
      kind: arch.shape,
      origin,
      dir,
      radius: arch.radius,
      halfAngle: arch.halfAngle,
      length: arch.length,
      halfWidth: arch.halfWidth,
    };
    this.telegraphs?.show(q, arch.telegraph, arch.color);

    // Element- + shape-aware particle silhouette, centered on the actual damage
    // area (origin for circle/nova; cone/line project forward inside castSkillVfx).
    const reach = arch.radius ?? arch.length ?? 4;
    const center = origin.clone();
    // vfxgrudge.puter.site hotkey catalog → GLB spawn by skill slot / archetype
    this.spawnSkillVfx(center, arch.shape, arch.element, idx);
    this.particles?.castSkillVfx({
      element: arch.element,
      shape: arch.shape,
      center,
      origin,
      dir,
      reach,
      halfAngle: arch.halfAngle,
    });

    const hits = targetsInShape(q, this.enemies, (en) => en.state !== "dead" && en.state !== "death");
    for (const en of hits) {
      const isCrit = Math.random() < this.playerCritChance + 0.05;
      const raw = this.playerBaseDamage * arch.damageMult * (0.85 + Math.random() * 0.3) * (isCrit ? 1.75 : 1);
      this.damageEnemy(en, raw, isCrit);
    }
    this.notifyState();
  }

  /**
   * Hotkey VFX from vfxgrudge.puter.site + runs/dist GLB pack.
   * Always spawns the catalog GLB for the skill slot; shape still drives size.
   */
  private spawnSkillVfx(
    pos: THREE.Vector3,
    shape: SkillShapeKind,
    element: SkillElement,
    slot: number,
  ) {
    const bind = vfxForArchetype(element, shape, slot) ?? vfxForSkillSlot(slot);
    const radius =
      shape === "nova" || shape === "circle" ? 4.5 : shape === "line" ? 3.2 : 3.5;
    this.skillVfx.spawn(bind.glb, pos, radius, 1.15);
  }

  /**
   * Engage nearby pirate / chest / dock prop (E).
   * Vendor → shop · Captain → sail · Traveler → tutorial · Chests → loot.
   */
  tryEngagePirate() {
    this.refreshNearbyInteractables();

    // Prefer world prop interactables when closer than NPCs
    if (this.tryOpenNearbyProp()) return;

    // Harbor district shops / training (city on island)
    if (this.playDomain === "land" && this.harborDistrict) {
      const st = this.harborDistrict.nearest(this.playerPos.x, this.playerPos.z, 3.8);
      if (st) {
        this.log(`${st.layout.label}: ${st.layout.hint}`);
        // Flexible routing — stations map to existing game pages / systems
        const routes: Record<string, string> = {
          stash: "/equipment",
          weapon_panel: "/equipment",
          skills: "/skills",
          stats: "/",
          quests: "/content",
          anvil: "/",
          portal_dungeon: "/game",
          portal_boss: "/boss",
        };
        const href = routes[st.id];
        if (href && typeof window !== "undefined") {
          // Soft prompt — UI can also deep-link; avoid hard navigate mid-combat loop
          this.log(`→ ${st.layout.action} (open ${st.layout.shortLabel} from Systems when docked).`);
        }
        return;
      }
    }

    const np = this.nearbyPirate;
    if (!np) {
      this.log("Nothing to engage — head to Pirate Cove (east) or a claim pad.");
      return;
    }
    const pirate = this.pirates.find((p) => p.def.id === np.id);
    pirate?.animator?.wave();

    if (np.role === "vendor") {
      this.log(`${np.name}: "Wood, stone, grog — fair prices. Sell harvest, buy supplies."`);
      this.onOpenVendor?.();
      return;
    }
    if (np.role === "traveler" || np.id === "dock_traveler") {
      this.log(
        `${np.name}: "Welcome shipwrecked — open the Dock Quest panel (T) and follow every step to your commander."`,
      );
      this.onOpenTraveler?.();
      return;
    }
    if (np.role === "captain") {
      if (this.runDirector.canSail()) {
        this.log(`${np.name}: "The wind shifts — I chart a new island!"`);
        this.sailToNextIsland();
        return;
      }
      const kills = this.runDirector.run.killsThisRound;
      const goal = this.runDirector.mission.killGoal;
      if (this.bossEnemyId || this.runDirector.phase === "boss_fight") {
        this.log(`${np.name}: "The Colossus still stands — bring me its head, then we sail."`);
      } else if (kills < goal) {
        this.log(
          `${np.name}: "Cull ${goal - kills} more hostiles (${kills}/${goal}) and the Colossus will rise."`,
        );
      } else {
        this.log(`${np.name}: "Hunt the Colossus in the ruins — then we re-sail."`);
      }
      return;
    }
    this.log(`${np.name}: "${np.prompt}"`);
  }

  /** Open chest / barrel on E — one-shot loot. */
  private tryOpenNearbyProp(): boolean {
    let best: THREE.Object3D | null = null;
    let bestD = 3.2;
    for (const g of this.coveProps) {
      if (!g.userData.interact || g.userData.looted) continue;
      const kind = g.userData.interact as string;
      if (kind !== "chest" && kind !== "barrel") continue;
      const r = (g.userData.interactRadius as number) ?? 2.6;
      const d = Math.hypot(g.position.x - this.playerPos.x, g.position.z - this.playerPos.z);
      if (d < Math.min(bestD, r)) {
        bestD = d;
        best = g;
      }
    }
    if (!best) return false;
    best.userData.looted = true;
    const gold = Number(best.userData.lootGold) || 0;
    const wood = Number(best.userData.lootWood) || 0;
    const stone = Number(best.userData.lootStone) || 0;
    const label = String(best.userData.interactLabel ?? "Loot");
    if (gold > 0) {
      const w = getWallet();
      saveWallet({ ...w, gold: w.gold + gold });
    }
    if (wood > 0) addResource("wood", wood);
    if (stone > 0) addResource("stone", stone);
    this.log(
      `Opened ${label}: ${gold ? `+${gold}g ` : ""}${wood ? `+${wood} wood ` : ""}${stone ? `+${stone} stone` : ""}`.trim(),
    );
    // Dim opened chests
    best.traverse((c) => {
      const m = c as THREE.Mesh;
      if (m.isMesh && m.material) {
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        for (const mat of mats) {
          const sm = mat as THREE.MeshStandardMaterial;
          if (sm.color) sm.color.multiplyScalar(0.45);
          if (sm.opacity != null) {
            sm.transparent = true;
            sm.opacity = 0.55;
          }
        }
      }
    });
    this.notifyState(true);
    return true;
  }

  /** Captain re-sails: next round — tougher enemies, new seed/layout/boss. */
  reseedGenerativeMap() {
    // Prefer gated sail; allow force reseed only after victory (legacy entry).
    if (this.runDirector.canSail() || this.runDirector.phase === "victory") {
      this.sailToNextIsland();
      return;
    }
    this.log("Defeat the Island Colossus before the captain will re-chart the seas.");
    this.notifyState(true);
  }

  private refreshNearbyInteractables() {
    this.nearbyPirate = null;
    this.nearbyHarvestLabel = null;
    const now = performance.now() / 1000;

    let bestPirateDist = 3.8;
    for (const p of this.pirates) {
      if (!p.ready) continue;
      const d = Math.hypot(p.group.position.x - this.playerPos.x, p.group.position.z - this.playerPos.z);
      if (d < bestPirateDist) {
        bestPirateDist = d;
        const role = (p.def.role ?? "crew") as PirateRole;
        this.nearbyPirate = {
          id: p.def.id,
          name: p.def.name,
          title: p.def.title,
          role,
          prompt: p.def.prompt ?? "Talk",
        };
      }
    }

    // Chests / barrels override harvest prompt when closer
    let bestLoot: string | null = null;
    let bestLootD = 3.0;
    for (const g of this.coveProps) {
      if (!g.userData.interact || g.userData.looted) continue;
      const kind = g.userData.interact as string;
      if (kind !== "chest" && kind !== "barrel") continue;
      const d = Math.hypot(g.position.x - this.playerPos.x, g.position.z - this.playerPos.z);
      const r = (g.userData.interactRadius as number) ?? 2.6;
      if (d < Math.min(bestLootD, r)) {
        bestLootD = d;
        bestLoot = `${g.userData.interactLabel ?? kind} — E open`;
      }
    }
    if (bestLoot) {
      this.nearbyHarvestLabel = bestLoot;
    } else if (this.harvestField) {
      const n = nearestHarvestNode(this.harvestField.nodes, this.playerPos, 3.5, now);
      if (n) {
        this.nearbyHarvestLabel =
          n.kind === "wood"
            ? `Tree (${Math.ceil(n.hp)} HP) — F/RMB chop wood`
            : n.meshBank === "rock"
              ? `Rock (${Math.ceil(n.hp)} HP) — F/RMB mine stone`
              : `Stone pile (${Math.ceil(n.hp)} HP) — F/RMB quarry`;
      }
    }
  }

  /** Attack nearest enemy, or harvest a tree/stone node if no foe is in reach. */
  private doAttack(enemy: EnemyInstance) {
    if (this.playerAttackCooldown > 0) return;
    if (enemy.state === "dead" || enemy.state === "death") return;

    const dist = this.playerPos.distanceTo(enemy.position);
    if (dist > 4.0) {
      this.playerTarget = enemy.position.clone();
      return;
    }

    if (!this.combatFsm.attack(0.42)) return;

    // Racalvin: release mind-swords toward the target
    if (this.initStats?.skinId === RACALVIN_ID) this.launchRacalvinSwords();

    const mods = this.perkMods();
    const stones = getStoneCombatMods();
    const base = this.playerBaseDamage * mods.autoAttackMult + stones.damage * 0.35;
    const variance = 0.8 + Math.random() * 0.4;
    const critChance = Math.min(0.75, this.playerCritChance + mods.critBonus + stones.crit);
    const isCrit = Math.random() < critChance;
    let rawDmg = Math.max(1, Math.floor(base * variance * (isCrit ? 1.85 : 1)));
    if (mods.burnOnHit > 0) rawDmg += Math.floor(base * mods.burnOnHit);
    // Route through damageEnemy for procs/bolts/novas
    this.playerAttackCooldown =
      this.playerMaxAttackCooldown * mods.attackSpeedMult * Math.max(0.5, 1 - stones.attackSpeed) * onslaughtAttackSpeedMult();

    const dx = enemy.position.x - this.playerPos.x;
    const dz = enemy.position.z - this.playerPos.z;
    this.playerFacing = Math.atan2(dx, dz);
    this.playerAnimator?.triggerAttack();

    if (mods.autoAttackSlash) {
      const dir = new THREE.Vector3(dx, 0, dz);
      if (dir.lengthSq() < 1e-4) dir.set(Math.sin(this.playerFacing), 0, Math.cos(this.playerFacing));
      dir.normalize();
      this.slashField?.spawn(this.playerPos.clone().setY(1.1), dir, {
        damage: rawDmg * 0.55,
        range: 7 * mods.slashRangeMult * (1 + stones.aoe * 0.4),
        color: stones.procBurn > 0.1 ? 0xff5522 : 0xffcc66,
        radius: 1.25 + stones.aoe,
      });
    }

    this.damageEnemy(enemy, rawDmg, isCrit);
    if (this.fx) {
      const wp = enemy.model.group.position.clone();
      wp.y += enemy.model.height * 0.7;
      const sc = this.worldToScreen(wp);
      if (isCrit) this.fx.spawnSpellImpact(sc.x, sc.y, "#ff4400", 50);
      else this.fx.spawnHitSparks(sc.x, sc.y, "#ffaa00", 10);
    }
    this.notifyState();
  }

  private killEnemy(enemy: EnemyInstance, skillId?: string) {
    enemy.hp = 0;
    enemy.state = "death";
    enemy.anim.deathPhase = 0.01;  // trigger death animation
    if (this.targetEnemy === enemy) this.targetEnemy = null;
    if (this.hoveredEnemy === enemy) {
      this.clearHover();
      this.hoveredEnemy = null;
    }

    const isBoss = enemy.id === this.bossEnemyId || !!enemy.model.group.userData.isBoss;
    const xp = enemy.template.tier * 50 + 25 + (isBoss ? 400 : 0);
    this.playerXp += xp;
    this.log(`${enemy.template.name} defeated! +${xp} XP`);

    // Gold + attribute stone drops + kill procs
    const w = getWallet();
    const goldGain = 8 + enemy.template.tier * 6 + (isBoss ? 180 + enemy.template.tier * 40 : 0) + Math.floor(Math.random() * 8);
    const soulsGain = isBoss ? 2 + Math.floor(enemy.template.tier / 2) : Math.random() < 0.08 ? 1 : 0;
    saveWallet({
      ...w,
      gold: w.gold + goldGain,
      souls: w.souls + soulsGain,
      embers: w.embers + (isBoss ? 3 : Math.random() < 0.12 ? 1 : 0),
    });
    this.log(`+${goldGain} gold${soulsGain ? ` · +${soulsGain} souls` : ""}`);

    const dropChance = isBoss ? 0.92 : 0.28 + enemy.template.tier * 0.05 + this.islandRound * 0.012;
    if (Math.random() < dropChance) {
      const stone = rollStoneDrop({
        itemLevel: enemy.template.tier * 5 + this.islandRound * 2,
        seed: (Math.random() * 0xffffffff) >>> 0,
        boss: isBoss,
      });
      addStone(stone);
      const meta = STONE_META[stone.attr];
      this.log(`Stone: ${meta.glyph} ${stone.name} (${stone.effects.length} effects)`);
    }

    const killProc = resolveKillProcs();
    if (killProc.onslaughtSec > 0) {
      this.log("Onslaught! (attack speed up)");
      this.auras?.pulse("lightning", this.playerPos.clone(), 2.2, 0.4);
    }

    if (isBoss) {
      this.bossEnemyId = null;
    }

    // Island run director: mission kills, boss phases, random events.
    try {
      const runEvents = this.runDirector.onKill(isBoss);
      this.processRunEvents(runEvents);
    } catch (e) {
      console.warn("[island] run director kill failed", e);
    }

    setTimeout(() => {
      enemy.state = "dead";
      this.scene.remove(enemy.model.group);
      enemy.model.group.userData.disposed = true;
      if (enemy.model.kit) {
        disposeKitModel(enemy.model);
      } else if (enemy.model.isGLB) {
        disposeMonsterModel(enemy.model);
      } else {
        enemy.model.group.traverse((c) => {
          const mesh = c as THREE.Mesh;
          if (mesh.geometry) mesh.geometry.dispose();
        });
        for (const mat of enemy.model.bodyMats) mat.dispose();
      }
    }, 1400);

    // Dungeon boss does not soft-respawn; trash mobs do.
    if (!isBoss) {
      setTimeout(() => {
        if (this.disposed) return;
        const idx = this.enemies.indexOf(enemy);
        if (idx !== -1) this.enemies.splice(idx, 1);
        const spawnPos = enemy.spawnPos.clone();
        spawnPos.x += (Math.random() - 0.5) * 4;
        spawnPos.z += (Math.random() - 0.5) * 4;
        // Respawn with current round difficulty
        const base: EnemyTemplate = {
          id: enemy.template.id,
          name: enemy.template.name.replace(/^R\d+\s+/, ""),
          type: enemy.template.type,
          tier: enemy.template.tier,
          hp: Math.round(enemy.template.hp / this.difficultyMult()),
          damage: enemy.template.damage,
        };
        this.createEnemy(this.scaleTemplate(base), spawnPos);
      }, 14000);
    } else {
      setTimeout(() => {
        if (this.disposed) return;
        const idx = this.enemies.indexOf(enemy);
        if (idx !== -1) this.enemies.splice(idx, 1);
      }, 1400);
    }
  }

  /**
   * C — start camp placement ghost (fence + tower). LMB places; Esc cancels.
   * Spends wood/stone only on successful LMB confirm.
   */
  private beginCampPlacement() {
    if (this.claimPlaceCd > 0) {
      this.log("Camp construction on cooldown.");
      return;
    }
    if (!this.claimFlags || !this.harvestField || !this.playerCamps) return;

    if (isInsidePlayerCamp(this.playerCamps, this.playerPos.x, this.playerPos.z)) {
      this.log("Already inside a built camp. V mans the tower with Grudge6.");
      return;
    }

    const bag = getResources();
    if (bag.wood < CAMP_BUILD_COST.wood || bag.stone < CAMP_BUILD_COST.stone) {
      this.log(
        `Need ${CAMP_BUILD_COST.wood} wood + ${CAMP_BUILD_COST.stone} stone to build a camp.`,
      );
      return;
    }

    const pad =
      this.worldManifest &&
      nearestClaimableZone(this.worldManifest, this.playerPos.x, this.playerPos.z, 18);
    if (pad && pad.owner !== "none" && pad.owner !== "wild") {
      this.log(`${pad.name} is already held by ${pad.owner}.`);
      return;
    }

    const radius = pad?.radius ?? 11;
    this.cancelPlacement();
    this.placeMode = {
      kind: "camp",
      radius: Math.max(9, radius),
      padId: pad?.id ?? null,
      padX: pad?.x ?? this.playerPos.x,
      padZ: pad?.z ?? this.playerPos.z,
    };
    this.setPlaceGhost(createCampGhost(Math.max(9, radius)));
    if (this.skillCursor) this.skillCursor.visible = false;
    this.log(
      pad
        ? `Camp ghost at ${pad.name} — move mouse, LMB to build (Esc cancel).`
        : `Camp ghost ready — LMB to build fence + tower (Esc cancel).`,
    );
    this.notifyState();
  }

  private confirmCampBuild(at: THREE.Vector3) {
    if (!this.claimFlags || !this.harvestField || !this.playerCamps) {
      this.cancelPlacement();
      return;
    }
    if (!this.isCampPlaceValid(at)) {
      this.log("Invalid camp site — aim at a free claim pad.");
      return; // keep ghost active
    }
    if (!spendResources({ wood: CAMP_BUILD_COST.wood, stone: CAMP_BUILD_COST.stone })) {
      this.log(
        `Need ${CAMP_BUILD_COST.wood} wood + ${CAMP_BUILD_COST.stone} stone to build a camp.`,
      );
      this.cancelPlacement();
      return;
    }

    const mode = this.placeMode;
    const radius = mode?.kind === "camp" ? mode.radius : 11;
    const pad =
      this.worldManifest &&
      nearestClaimableZone(this.worldManifest, at.x, at.z, 14);
    if (pad && (pad.owner === "none" || pad.owner === "wild")) {
      pad.owner = "player";
      this.worldChunkMap?.markClaimed(pad.id);
      this.claimsOwned++;
    } else if (mode?.kind === "camp" && mode.padId && this.worldManifest) {
      const z = this.worldManifest.zones.find((x) => x.id === mode.padId);
      if (z && (z.owner === "none" || z.owner === "wild")) {
        z.owner = "player";
        this.worldChunkMap?.markClaimed(z.id);
        this.claimsOwned++;
      }
    }

    this.claimPlaceCd = 10;
    this.applyClaimNodes(at, {
      radius,
      nodeCount: 7,
      seed: this.mapSeed ^ hashString(`claim|${at.x.toFixed(0)}|${at.z.toFixed(0)}`),
    });
    buildPlayerCamp(this.playerCamps, this.loader, {
      position: at,
      radius,
      seed: this.mapSeed ^ hashString(`camp|${at.x.toFixed(0)}|${at.z.toFixed(0)}`),
    });

    for (const en of this.enemies) {
      if (en.state === "dead" || en.state === "death") continue;
      if (pushOutOfCamps(this.playerCamps, en.position, 1.2)) {
        en.model.group.position.x = en.position.x;
        en.model.group.position.z = en.position.z;
        en.spawnPos.copy(en.position);
      }
    }

    this.cancelPlacement();
    this.log(`Camp built — fence + tower. Enemies blocked. V mans tower.`);
    this.notifyState();
  }

  /** Map click / external waypoint — click-to-move to world XZ. */
  setPlayerTarget(x: number, z: number) {
    const p = this.maze?.nearestWalkable(x, z) ?? new THREE.Vector3(x, 0, z);
    this.playerTarget = p;
    this.attackHeld = false;
    this.targetEnemy = null;
    if (this.indicatorRing) {
      this.indicatorRing.visible = true;
      this.indicatorRing.position.set(p.x, 0.08, p.z);
    }
  }

  /**
   * V — manual deploy / tower man / recall (never auto on claim).
   * - Empty field → summon party (Grudge6Deploy).
   * - Holding / manning → recall.
   * - Near built camp tower → man tower with first free ally.
   * - Near player claim → post allies to pad.
   */
  private tryDeployAllies() {
    if (!this.allies.length) {
      if (this.partySummoning) {
        this.log("Summoning allies…");
        return;
      }
      this.partySummoning = true;
      void this.spawnPartyAllies().finally(() => {
        this.partySummoning = false;
        if (!this.allies.length) {
          this.log("No allies in the field — pick owned Grudge6 on /party, then press V.");
        } else {
          this.log("Allies summoned. V near camp mans tower / posts to pad.");
        }
      });
      return;
    }

    // Recall if any are holding or manning
    const anyHeld = this.allies.some((a) => a.deployHold || a.towerManned);
    if (anyHeld) {
      for (const a of this.allies) {
        deployAllyTo(a, null);
        // Snap mesh back to ground
        a.instance.group.position.y = 0;
      }
      // Clear camp manning slots
      if (this.playerCamps) {
        for (const c of this.playerCamps.camps) c.mannedAllyId = null;
      }
      this.log("Allies recalled to your formation.");
      return;
    }

    // Prefer manning nearest built camp tower
    const camp = nearestPlayerCamp(
      this.playerCamps,
      this.playerPos.x,
      this.playerPos.z,
      16,
    );
    if (camp) {
      // First free ally mans tower; rest hold pad at fence line
      const free = this.allies.filter((a) => !a.dead && a.hp > 0);
      if (!free.length) {
        this.log("No living allies to man the tower.");
        return;
      }
      const lookout = free[0]!;
      manTower(lookout, camp.manSlot);
      camp.mannedAllyId = lookout.instance.def.id;
      lookout.instance.group.position.set(camp.manSlot.x, camp.manSlot.y, camp.manSlot.z);
      for (let i = 1; i < free.length; i++) {
        const off = (i - free.length / 2) * 1.5;
        deployAllyTo(
          free[i]!,
          new THREE.Vector3(camp.position.x + off, 0, camp.position.z + camp.radius * 0.35),
        );
      }
      this.log(
        `${lookout.instance.def.displayName} mans the watchtower. V recalls.`,
      );
      return;
    }

    if (!this.worldManifest) {
      this.log("Build a camp (C) first, then press V to man the tower.");
      return;
    }
    const owned = this.worldManifest.zones.filter((z) => z.owner === "player" && z.claimable);
    if (!owned.length) {
      this.log("Build a camp (C: wood+stone), then press V to post / man tower.");
      return;
    }
    let best = owned[0]!;
    let bestD = Infinity;
    for (const z of owned) {
      const d = Math.hypot(z.x - this.playerPos.x, z.z - this.playerPos.z);
      if (d < bestD) {
        bestD = d;
        best = z;
      }
    }
    if (bestD > 18) {
      this.log("Move closer to a built camp or claim, then press V.");
      return;
    }
    for (let i = 0; i < this.allies.length; i++) {
      const off = (i - (this.allies.length - 1) / 2) * 1.6;
      deployAllyTo(this.allies[i]!, new THREE.Vector3(best.x + off, 0, best.z + 1.2));
    }
    this.log(`Allies posted at ${best.name ?? "claim"}. V again to recall.`);
  }

  /** Chop / quarry: attack nearest harvest node (tree or stone). */
  private tryHarvestAttack() {
    if (this.playerAttackCooldown > 0 || !this.harvestField) return;
    const now = performance.now() / 1000;
    // Respawn elapsed nodes.
    for (const n of this.harvestField.nodes) {
      if (n.hp <= 0 && n.respawnAt > 0 && now >= n.respawnAt) {
        n.hp = n.maxHp;
        n.respawnAt = 0;
        showHarvestNode(this.harvestField, n);
      }
    }
    // Rocks are bulky — slightly longer reach so mining feels fair.
    const node = nearestHarvestNode(this.harvestField.nodes, this.playerPos, 3.4, now);
    if (!node) return;

    this.playerAttackCooldown = this.playerMaxAttackCooldown * 0.85;
    this.playerFacing = Math.atan2(node.position.x - this.playerPos.x, node.position.z - this.playerPos.z);
    this.playerAnimator?.triggerAttack();

    const dmg = Math.max(8, Math.floor(this.playerBaseDamage * 0.55 * (0.85 + Math.random() * 0.3)));
    node.hp = Math.max(0, node.hp - dmg);
    const wp = node.position.clone();
    wp.y = node.kind === "wood" ? 2.5 : 1.2;
    this.damageNumbers.push({
      id: `d${this.idCounter++}`,
      value: dmg,
      worldPos: wp,
      age: 0,
      isPlayer: false,
      isCrit: false,
    });
    this.log(
      node.kind === "wood"
        ? `You chop the tree (−${dmg}).`
        : `You strike the stone (−${dmg}).`,
    );

    if (node.hp <= 0) {
      const yMin = node.yieldMin;
      const yMax = node.yieldMax;
      const amount = yMin + Math.floor(Math.random() * (yMax - yMin + 1));
      const res = resourceForKind(node.kind);
      addResource(res, amount);
      hideHarvestNode(this.harvestField, node);
      node.respawnAt = now + 45 + Math.random() * 30;
      this.log(`Harvested ${amount} ${res}!`);
    }
    this.notifyState();
  }

  private takeDamage(amount: number, source: string) {
    if (this.isDodging()) {
      this.log(`Dodged ${source}!`);
      return;
    }
    this.combatUntil = performance.now() / 1000 + 4.5;
    const mods = this.perkMods();
    const stones = getStoneCombatMods();
    // Magical vs physical: bosses/magic names use magicDefense
    const isMagic = /bolt|hex|arcane|magic|curse|spell|nova|shock/i.test(source);
    const def = isMagic ? stones.magicDefense : stones.defense;
    let mitigated = Math.max(1, amount - Math.floor(this.playerDefense * 0.5));
    mitigated = Math.max(
      1,
      Math.floor(mitigated * mods.damageTakenMult * Math.max(0.5, 1 - def) * blurDamageMult()),
    );
    if (tryBlurOnHitTaken()) {
      this.log("Blur! Damage reduced.");
      this.auras?.pulse("arcane", this.playerPos.clone(), 1.6, 0.35);
    }
    if (this.blocking) {
      mitigated = Math.max(1, Math.floor(mitigated * 0.3));
      this.log(`Blocked ${source} — only ${mitigated} damage.`);
    } else if (isBlurActive()) {
      this.log(`${source} glances (${mitigated})`);
    } else {
      this.log(`${source} hits you for ${mitigated}`);
      this.combatFsm.hit(0.28);
      this.playerAnimator?.triggerRole("hit");
    }
    this.playerHp = Math.max(0, this.playerHp - mitigated);
    if (this.playerHp <= 0) this.combatFsm.die();
    kickCameraShake(this.isoCam, Math.min(0.55, 0.18 + mitigated * 0.004));
    this.bloom?.kick(0.22);
    const wp = this.playerPos.clone();
    wp.y += 2.5;
    this.damageNumbers.push({ id: `d${this.idCounter++}`, value: mitigated, worldPos: wp, age: 0, isPlayer: true, isCrit: false });
    this.notifyState();
  }

  private log(msg: string) {
    this.combatLog.unshift(msg);
    if (this.combatLog.length > 10) this.combatLog.pop();
  }

  /** Camera / sun follow while helming the skiff (open water early-exit path). */
  private updateOpenWaterCamera(delta: number) {
    this.playerVel.set(
      Math.sin(this.playerFacing) * (this.openWater?.speed ?? 0),
      0,
      Math.cos(this.playerFacing) * (this.openWater?.speed ?? 0),
    );
    updateIsoCamera(this.camera, this.isoCam, this.playerPos, this.playerVel, delta, {
      lead: 0.28,
      follow: 7,
    });
    if (this.sun) {
      this.sun.position.set(this.playerPos.x + 24, 36, this.playerPos.z + 24);
      this.sun.target.position.set(this.playerPos.x, 0, this.playerPos.z);
      this.sun.target.updateMatrixWorld();
    }
  }

  private animate = () => {
    this.animFrameId = requestAnimationFrame(this.animate);
    this.timer.update();
    const frameDt = Math.min(this.timer.getDelta(), 0.08);
    this._frame++;

    // Fixed 30 Hz combat/AI sim — stable hit timing; render stays vsync.
    this._simAccum += frameDt;
    let steps = 0;
    while (this._simAccum >= this.SIM_DT && steps < this.SIM_MAX_STEPS) {
      this.update(this.SIM_DT);
      this._simAccum -= this.SIM_DT;
      steps++;
    }
    // Avoid spiral-of-death after long tabs-out.
    if (this._simAccum > this.SIM_DT * this.SIM_MAX_STEPS) {
      this._simAccum = 0;
    }

    // Shadow maps every other frame (directional sun tracks slowly enough).
    if ((this._frame & 1) === 0) {
      this.renderer.shadowMap.needsUpdate = true;
    }

    if (this.bloom) {
      this.bloom.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
    if (this.fx) {
      this.fx.update(frameDt);
      this.fx.draw();
    }
  };

  private update(delta: number) {
    const elapsed = this.timer.getElapsed();

    // Freeze the whole simulation until the player has actually entered the
    // scene (player model loaded AND the dungeon GLB/BVH built). This keeps
    // enemies, pirate NPCs and all AI from moving or acting behind the loading
    // veil, so the world is pristine the instant the veil lifts. Force HUD so
    // the loading veil receives ready promptly.
    if (!this.loaded || !this.mapReady) {
      this.notifyState(true);
      return;
    }

    // Spawn party once the world is ready (async race models).
    if (!this.partySpawned) {
      this.partySpawned = true;
      void this.spawnPartyAllies();
    }

    if (this.playerAttackCooldown > 0) this.playerAttackCooldown -= delta;
    // Advance combat FSM timers (attack/dodge/skill recovery).
    if (this.combatFsm.update(delta)) this.notifyState(false);

    // Open-water helm (boat controls consume WASD; land combat paused lightly)
    this.openWater?.update(delta, this.keys, { canPilot: this.playDomain === "open_water" });
    if (this.playDomain === "open_water" && this.openWater) {
      this.playerPos.copy(this.openWater.boatPos);
      this.playerFacing = this.openWater.heading;
      // Party rides deck slots
      const slots = this.openWater.crewSlots;
      for (let i = 0; i < this.allies.length; i++) {
        const a = this.allies[i]!;
        if (a.dead || a.hp <= 0) continue;
        const slot = slots[i % slots.length]!;
        a.pos.set(slot.x, 0, slot.z);
        a.instance.group.position.set(slot.x, slot.y, slot.z);
        a.facing = this.openWater.heading;
        a.instance.group.rotation.y = this.openWater.heading;
        a.instance.animator?.setMoving?.(false);
        a.instance.animator?.update(delta);
      }
      // Camera follows boat
      this.playerY = 0;
      this.fog?.revealAt(this.playerPos.x, this.playerPos.z, 20);
      this.notifyState(false);
      // Still render enemies/VFX but skip land locomotion
      this.updateFogAndRemotes(delta);
      this.darkElfEvent?.updateVisuals?.(delta, this.camera);
      // Jump to camera update via shared path below — skip land move block
      this.updateOpenWaterCamera(delta);
      return;
    }

    this.updateWorldCollectables(delta, elapsed);
    this.updateAllies(delta);
    this.updateFogAndRemotes(delta);
    // Crystal bob + HP bar billboards for dark-elf event structures
    this.darkElfEvent?.updateVisuals?.(delta, this.camera);

    // Shrine buff regen tick
    if (this.runDirector.hasShrineBuff()) {
      this.playerHp = Math.min(this.playerMaxHp, this.playerHp + 6 * delta);
    }

    // Keyboard movement (scratch Vector2 — no per-tick alloc)
    // Gated by annihilate canMove tag (block/attack/hit lock locomotion).
    const raw = this._tmpV2;
    raw.set(0, 0);
    if (this.combatFsm.canMove) {
      if (this.keys.has("KeyW") || this.keys.has("ArrowUp"))    { raw.x -= 1; raw.y -= 1; }
      if (this.keys.has("KeyS") || this.keys.has("ArrowDown"))  { raw.x += 1; raw.y += 1; }
      if (this.keys.has("KeyA") || this.keys.has("ArrowLeft"))  { raw.x -= 1; raw.y += 1; }
      if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) { raw.x += 1; raw.y -= 1; }
    }

    // Velocity-based locomotion: resolve desired velocity from WASD / RMB chase /
    // click-move, then integrate once. Drives camera look-ahead + foot dust.
    let playerMoving = false;
    const maxSpd = this.playerSpeed;
    const accel = 32;
    const friction = 16;
    let wantX = 0;
    let wantZ = 0;
    let hasWant = false;

    if (raw.lengthSq() > 0) {
      raw.normalize();
      wantX = raw.x * maxSpd;
      wantZ = raw.y * maxSpd;
      hasWant = true;      this.playerTarget = null;
      this.targetEnemy = null;
      if (this.indicatorRing) this.indicatorRing.visible = false;
      this.playerFacing = Math.atan2(raw.x, raw.y);
      playerMoving = true;
    } else if (this.attackHeld) {
      // RIGHT mouse held = attack. Lock selected or nearest foe; chase into melee.
      const locked =
        this.targetEnemy && this.targetEnemy.state !== "dead" && this.targetEnemy.state !== "death"
          ? this.targetEnemy
          : this.nearestEnemy(14);
      if (!locked) {
        this.tryHarvestAttack();
      } else {
        this.targetEnemy = locked;
        const toFoe = this._tmpV3a.subVectors(locked.position, this.playerPos);
        const dist = toFoe.length();
        this.playerFacing = Math.atan2(toFoe.x, toFoe.z);
        if (dist > 3.0) {
          toFoe.normalize();
          wantX = toFoe.x * maxSpd;
          wantZ = toFoe.z * maxSpd;
          hasWant = true;          playerMoving = true;
        } else if (this.playerAttackCooldown <= 0) {
          this.doAttack(locked);
        }
        this.playerTarget = null;
        if (this.indicatorRing) this.indicatorRing.visible = false;
      }
    } else if (this.playerTarget) {
      // LEFT-click move — no auto-attack; attacking is RMB-only.
      const toTarget = this._tmpV3a.subVectors(this.playerTarget, this.playerPos);
      const distToTarget = toTarget.length();
      if (distToTarget > 0.25) {
        toTarget.normalize();
        wantX = toTarget.x * maxSpd;
        wantZ = toTarget.z * maxSpd;
        hasWant = true;        this.playerFacing = Math.atan2(toTarget.x, toTarget.z);
        playerMoving = true;
      } else {
        this.playerTarget = null;
        if (this.indicatorRing) this.indicatorRing.visible = false;
      }
    }

    if (hasWant) {
      const k = 1 - Math.exp(-accel * delta);
      this.playerVel.x += (wantX - this.playerVel.x) * k;
      this.playerVel.z += (wantZ - this.playerVel.z) * k;
    } else {
      const damp = Math.exp(-friction * delta);
      this.playerVel.x *= damp;
      this.playerVel.z *= damp;
      if (this.playerVel.lengthSq() < 0.04) this.playerVel.set(0, 0, 0);
    }
    if (this.playerVel.lengthSq() > 1e-6) {
      this.playerPos.x += this.playerVel.x * delta;
      this.playerPos.z += this.playerVel.z * delta;
      if (this.playerVel.lengthSq() > 1.2) playerMoving = true;
    }
    // Foot dust when skimming ground at speed (open-world velocity read).
    if (playerMoving && this.playerY <= 0.08 && this.playerVel.lengthSq() > 8) {
      this._dustAccum += delta;
      if (this._dustAccum >= 0.09) {
        this._dustAccum = 0;
        this.particles?.impact(
          this._tmpV3a.set(this.playerPos.x, 0.12, this.playerPos.z),
          0x9a8a6a,
          0.28,
        );
      }
    } else {
      this._dustAccum = 0;
    }
    this.combatFsm.setMoving(playerMoving && this.playerY <= 0.05);

    // Jump arc (Space).
    if (this.jumpVel !== 0 || this.playerY > 0) {
      this.jumpVel -= 22 * delta;
      this.playerY += this.jumpVel * delta;
      if (this.playerY <= 0) {
        this.playerY = 0;
        this.jumpVel = 0;
      }
    }

    // Drive mixer first so root-motion sample sees this frame's pose, then
    // fold travel into world position. Ending a skill must leave the body at
    // the clip terminus (no snap back to the cast origin).
    if (this.playerAnimator) {
      this.playerAnimator.setMoving(playerMoving && this.playerY <= 0.05);
      this.playerAnimator.update(delta);
      // Skip root-motion travel during dodge i-frames — distance is engine-applied.
      if (!this.isDodging() && this.playerAnimator.consumeRootMotion(this._rmTmp)) {
        this.movePlayerHorizontal(this._rmTmp.x, this._rmTmp.z);
      } else if (this.isDodging()) {
        this.playerAnimator.consumeRootMotion(this._rmTmp); // drain bank so it doesn't dump later
      }
    } else if (this.playerMixer) {
      this.playerMixer.update(delta);
    }

    // Brothers' Keeper dual mind-swords (Racalvin only)
    if (this.playerGroup && this.initStats?.skinId === RACALVIN_ID) {
      const model = this.playerGroup.children[0] ?? this.playerGroup;
      updateRacalvinMindSwords(model, delta, this.playerFacing);
    }

    // Resolve the freshly-moved player against the real dungeon geometry.
    this.resolvePlayer();
    this.playerPos.y = this.playerY;

    // Slash waves (special + skill cuts) — travel farther than the melee hit.
    if (this.slashField) {
      const slashTargets = this._slashTargetScratch;
      slashTargets.length = 0;
      for (const en of this.enemies) {
        slashTargets.push({
          id: en.id,
          position: en.position,
          alive: en.state !== "dead" && en.state !== "death",
        });
      }
      const slashHits = this.slashField.update(delta, slashTargets);
      for (const h of slashHits) {
        const en = this.enemies.find((e) => e.id === h.enemyId);
        if (en) this.damageEnemy(en, h.damage, Math.random() < this.playerCritChance);
      }
    }

    // Boss/enemy projectiles + telegraphed AoE / line detonations.
    const invuln = this.isDodging() || this.combatFsm.invulnerable;
    if (this.projectileField) {
      const slashTargets = this._slashTargetScratch;
      slashTargets.length = 0;
      for (const en of this.enemies) {
        slashTargets.push({
          id: en.id,
          position: en.position,
          alive: en.state !== "dead" && en.state !== "death",
        });
      }
      const { playerHits, enemyHits } = this.projectileField.update(delta, this.playerPos, {
        invulnerable: invuln,
        enemies: slashTargets,
      });
      for (const h of playerHits) this.takeDamage(h.damage, h.label);
      for (const h of enemyHits) {
        const en = this.enemies.find((e) => e.id === h.enemyId);
        if (en) this.damageEnemy(en, h.damage, Math.random() < this.playerCritChance);
      }
    }
    if (this.pendingStrikes) {
      const shits = this.pendingStrikes.update(delta, this.playerPos, { invulnerable: invuln });
      for (const h of shits) this.takeDamage(h.damage, h.label);
    }
    this.warningFx?.update(delta, this.camera ?? undefined);
    if (this.claimPlaceCd > 0) this.claimPlaceCd = Math.max(0, this.claimPlaceCd - delta);
    if (this.claimFlags) updateClaimFlags(this.claimFlags, performance.now() / 1000);
    if (this.wispEvents) {
      updateWisps(this.wispEvents, {
        playerPos: this.playerPos,
        delta,
        time: performance.now() / 1000,
        projectiles: this.projectileField,
        pending: this.pendingStrikes,
        warnings: this.warningFx,
        particles: this.particles,
        onPlayerHit: (dmg, label) => this.takeDamage(dmg, label),
        log: (m) => this.log(m),
      });
    }

    // Ghost + skill cursor follow mouse while placement is active.
    if (this.placeMode) {
      this.updatePlaceGhostFollow();
    } else if (this.pendingSkillIdx >= 0 && this.skillCursor && this.pointerGround) {
      this.skillCursor.visible = true;
      this.skillCursor.position.set(this.pointerGround.x, 0.12, this.pointerGround.z);
      const sk = this.fighterKit.skills[this.pendingSkillIdx];
      if (sk) this.skillCursor.scale.setScalar(sk.aoeRadius ?? 4);
    }

    if (this.playerGroup) {
      const targetPos = this._tmpV3b.set(this.playerPos.x, this.playerY, this.playerPos.z);
      const blend = this.playerAnimator?.isRootMotionActive() ? 0.9 : 0.4;
      this.playerGroup.position.lerp(targetPos, blend);
      // Shortest-arc turn toward facing — avoids the long way around at ±π.
      let dy = this.playerFacing - this.playerGroup.rotation.y;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      this.playerGroup.rotation.y += dy * 0.25;
    }

    this.skillVfx.update(delta);
    this.particles?.update(delta);
    this.telegraphs?.update(delta);
    this.auras?.update(delta);
    this.deployables?.update(delta, {
      targets: this.enemyTargets(),
      particles: this.particles,
      telegraphs: this.telegraphs,
      log: (m) => this.log(m),
    });

    // Neutral pirate allies at the cove: idle anim, turn-to-face, wave.
    for (const t of this.townsfolk) t.update(delta);
    for (const p of this.pirates) {
      if (!p.ready || !p.animator) continue;
      p.animator.update(delta);
      const dx = this.playerPos.x - p.group.position.x;
      const dz = this.playerPos.z - p.group.position.z;
      if (Math.hypot(dx, dz) < 11) {
        const want = Math.atan2(dx, dz);
        let dy = want - p.group.rotation.y;
        while (dy > Math.PI) dy -= Math.PI * 2;
        while (dy < -Math.PI) dy += Math.PI * 2;
        p.group.rotation.y += dy * 0.08;
        p.group.userData.waveTimer -= delta;
        if (p.group.userData.waveTimer <= 0) {
          p.animator.wave();
          p.group.userData.waveTimer = 5 + Math.random() * 5;
        }
      }
    }

    // Proximity prompts for cove + harvest nodes.
    this.refreshNearbyInteractables();

    // Soft-respawn harvest nodes on timer.
    if (this.harvestField) {
      const now = performance.now() / 1000;
      for (const n of this.harvestField.nodes) {
        if (n.hp <= 0 && n.respawnAt > 0 && now >= n.respawnAt) {
          n.hp = n.maxHp;
          n.respawnAt = 0;
          showHarvestNode(this.harvestField, n);
        }
      }
    }

    // Iso camera: velocity look-ahead, smooth zoom, combat shake.
    this._tmpV3c.set(this.playerPos.x, this.playerY, this.playerPos.z);
    updateIsoCamera(this.camera, this.isoCam, this._tmpV3c, this.playerVel, delta, {
      lead: 0.22,
      follow: 9,
      lookFollow: 11,
      zoomFollow: 14,
      defaultD: 16,
    });
    this.applyCameraFrustum();
    this.bloom?.update(delta);

    // Sun + shadow rig tracks the player so shadows stay sharp across the big map.
    if (this.sun) {
      this.sun.position.set(this.playerPos.x + 20, 30, this.playerPos.z + 20);
      this.sun.target.position.set(this.playerPos.x, 0, this.playerPos.z);
      this.sun.target.updateMatrixWorld();
    }

    // Torch flicker at half rate of sim (cheap sin still, fewer lights now).
    if ((this._frame & 1) === 0) {
      for (let i = 0; i < this.torchLights.length; i++) {
        const t = this.torchLights[i];
        t.intensity = 2.2 + Math.sin(elapsed * 5.7 + i * 2.3) * 0.4;
      }
    }

    for (const en of this.enemies) {
      if (en.state === "dead") continue;
      this.updateEnemy(en, delta, elapsed);
    }

    // In-place age filter (no new array when nothing expires).
    {
      let w = 0;
      for (let i = 0; i < this.damageNumbers.length; i++) {
        const d = this.damageNumbers[i];
        d.worldPos.y += delta * 1.8;
        d.age += delta;
        if (d.age < 1.4) this.damageNumbers[w++] = d;
      }
      this.damageNumbers.length = w;
    }

    const mods = this.perkMods();
    const inCombat = performance.now() / 1000 < this.combatUntil;
    const hpR =
      hpRegenPerSec({
        level: this.playerLevel,
        vitality: this.regenVitality,
        endurance: this.regenEndurance,
        inCombat,
        hpRegenBonus: mods.regenPerSec,
      });
    const mpR = manaRegenPerSec({
      level: this.playerLevel,
      intellect: this.regenIntellect,
      wisdom: this.regenWisdom,
      inCombat,
      manaRegenBonus: 0,
    });
    this.playerHp = applyRegen(this.playerHp, this.playerMaxHp, hpR, delta);
    this.playerMana = applyRegen(this.playerMana, this.playerMaxMana, mpR, delta);

    // Zone tracking for world map HUD
    if (this.worldManifest) {
      this.currentZone = zoneAt(this.worldManifest, this.playerPos.x, this.playerPos.z);
      this.nearbyClaimZone = nearestClaimableZone(
        this.worldManifest,
        this.playerPos.x,
        this.playerPos.z,
        11,
      );
    }

    this.notifyState(false);
  }

  private updateEnemy(en: EnemyInstance, delta: number, elapsed: number) {
    const now = performance.now() / 1000;
    // Cooldown / hurt timers
    if (en.attackCooldown > 0) en.attackCooldown -= delta;
    if (en.hurtTimer > 0) {
      en.hurtTimer -= delta;
      if (en.hurtTimer <= 0 && en.state === "hurt") en.state = "chase";
    }

    const distToPlayer = en.position.distanceTo(this.playerPos);
    en.anim.isWalking = false;
    const brain = this.enemyBrains.get(en.template.id);
    const tune = brain ? brainTuning(brain) : null;

    // Flying archetype / flyer brain — hover altitude + strafe bias
    const isFlying =
      en.model.archetype === "flying" || brain === "flyer";
    if (isFlying && en.model.group) {
      const hover = 1.6 + Math.sin(elapsed * 2.2 + en.position.x) * 0.35;
      en.model.group.position.y = hover;
      en.position.y = 0; // logical combat still on ground plane
    }

    if (en.state !== "hurt" && en.state !== "death") {
      if (distToPlayer < en.aggroRange) {
        // Face the player
        const dx = this.playerPos.x - en.position.x;
        const dz = this.playerPos.z - en.position.z;
        en.facing = Math.atan2(dx, dz);

        // Brain kite: skirmishers/casters back off when too close.
        const kiteFloor = tune ? en.attackRange * tune.kiteBelow : 0;
        if (tune && distToPlayer < kiteFloor && distToPlayer > 0.6) {
          en.state = "chase";
          const dir = this._tmpV3a.subVectors(en.position, this.playerPos).normalize();
          en.position.x += dir.x * en.speed * 0.85 * delta;
          en.position.z += dir.z * en.speed * 0.85 * delta;
          this.clampToArena(en.position);
          en.anim.isWalking = true;
        } else if (distToPlayer <= en.attackRange) {
          en.state = "attack";
          if (en.attackCooldown <= 0) {
            en.anim.isAttacking = true;
            const isBoss = en.id === this.bossEnemyId || !!en.model.group.userData.isBoss;
            if (isBoss) {
              this.fireBossSpecial(en, distToPlayer);
              en.attackCooldown = 2.6 + Math.random() * 0.8;
            } else {
              const special = tune && Math.random() < tune.specialBias;
              const dmg = Math.floor(
                en.template.damage * (special ? 1.45 : 1) * (0.85 + Math.random() * 0.3),
              );
              // Casters / ranged brains: telegraphed bolt instead of pure contact.
              if (brain === "caster" || (special && distToPlayer > 2.4)) {
                this.fireEnemyProjectile(en, dmg, brain === "caster");
              } else {
                this.takeDamage(dmg, en.template.name + (special ? " ★" : ""));
              }
              if (special && this.auras) {
                this.auras.pulse(
                  brain === "caster" ? "arcane" : brain === "assassin" ? "poison" : "fire",
                  en.position.clone(),
                  2.2 + en.template.tier * 0.2,
                  0.45,
                );
              }
              en.attackCooldown = (special ? 2.4 : 1.7) + Math.random() * 0.6;
            }
          }
        } else {
          // Boss mid-range: still fire specials while closing.
          const isBoss = en.id === this.bossEnemyId || !!en.model.group.userData.isBoss;
          if (isBoss && distToPlayer < en.aggroRange) {
            const cd = this.bossSpecialCd.get(en.id) ?? 0;
            if (cd <= 0) {
              this.fireBossSpecial(en, distToPlayer);
              this.bossSpecialCd.set(en.id, 3.2 + Math.random() * 1.2);
            } else {
              this.bossSpecialCd.set(en.id, cd - delta);
            }
          }
          en.state = "chase";
          // Dense zones (D2 packs): slightly longer aggro leash while chasing
          const zBias = zoneSpawnBias(this.worldManifest, en.position.x, en.position.z);
          if (zBias.density > 0.65 && distToPlayer < en.aggroRange * 1.35) {
            en.aggroRange = Math.max(en.aggroRange, 7.5 + en.template.tier * 0.5);
          }
          // Pathfind toward player (repath ~2.5×/sec)
          if (this.maze && (en.pathRepathAt <= now || en.path.length === 0)) {
            en.path = findPath(this.maze, {
              fromX: en.position.x,
              fromZ: en.position.z,
              toX: this.playerPos.x,
              toZ: this.playerPos.z,
              maxNodes: 500,
            });
            en.pathRepathAt = now + 0.4 + Math.random() * 0.25;
          }
          if (en.path.length > 0) {
            const step = advanceAlongPath(en.position, en.path, en.speed, delta);
            en.path = step.path;
            if (step.moved) {
              en.facing = step.facing;
              en.anim.isWalking = true;
            }
            this.maze?.collideHorizontal(en.position, this.PLAYER_RADIUS * 0.85);
            this.darkElfEvent?.collideHorizontal(en.position, this.PLAYER_RADIUS * 0.85);
            this.clampToArena(en.position);
          } else {
            const dir = this._tmpV3a.subVectors(this.playerPos, en.position).normalize();
            if (brain === "assassin") {
              const side = Math.sin(elapsed * 1.7) >= 0 ? 1 : -1;
              dir.x += -dir.z * 0.4 * side;
              dir.z += dir.x * 0.4 * side;
              dir.normalize();
            }
            en.position.x += dir.x * en.speed * delta;
            en.position.z += dir.z * en.speed * delta;
            this.clampToArena(en.position);
            en.facing = Math.atan2(dir.x, dir.z);
            en.anim.isWalking = true;
          }
        }
      } else {
        // Idle pause then wander via pathfind
        if (en.state === "idle" && now < en.idleUntil) {
          en.anim.isWalking = false;
        } else {
          const distToPatrol = en.position.distanceTo(en.patrolTarget);
          if (distToPatrol < 0.55 || en.path.length === 0) {
            if (this.maze) {
              // Biased wander: sometimes toward zone centers for pack feel
              let tx = en.spawnPos.x;
              let tz = en.spawnPos.z;
              if (Math.random() < 0.55) {
                const p = this.maze.randomWalkable(() => Math.random());
                tx = en.spawnPos.x + (p.x - en.spawnPos.x) * 0.45;
                tz = en.spawnPos.z + (p.z - en.spawnPos.z) * 0.45;
              } else if (this.worldManifest && Math.random() < 0.4) {
                const z =
                  this.worldManifest.zones[
                    Math.floor(Math.random() * this.worldManifest.zones.length)
                  ]!;
                tx = z.x + (Math.random() - 0.5) * z.radius * 0.6;
                tz = z.z + (Math.random() - 0.5) * z.radius * 0.6;
              } else {
                tx = en.spawnPos.x + (Math.random() * 2 - 1) * 8;
                tz = en.spawnPos.z + (Math.random() * 2 - 1) * 8;
              }
              const w = this.maze.nearestWalkable(tx, tz);
              en.patrolTarget.copy(w);
              en.path = findPath(this.maze, {
                fromX: en.position.x,
                fromZ: en.position.z,
                toX: w.x,
                toZ: w.z,
                maxNodes: 350,
              });
              en.pathRepathAt = now + 2;
            } else {
              en.patrolTarget.set(
                en.spawnPos.x + (Math.random() * 2 - 1) * 6,
                0,
                en.spawnPos.z + (Math.random() * 2 - 1) * 6,
              );
              en.path = [en.patrolTarget.clone()];
            }
            en.idleUntil = now + 0.6 + Math.random() * 1.8;
            en.state = "patrol";
          }
          if (en.path.length > 0) {
            const step = advanceAlongPath(en.position, en.path, en.speed * 0.55, delta);
            en.path = step.path;
            if (step.moved) {
              en.facing = step.facing;
              en.anim.isWalking = true;
              en.state = "patrol";
            }
            this.maze?.collideHorizontal(en.position, this.PLAYER_RADIUS * 0.7);
            this.darkElfEvent?.collideHorizontal(en.position, this.PLAYER_RADIUS * 0.7);
            this.clampToArena(en.position);
          } else {
            en.anim.isWalking = false;
            en.state = "idle";
          }
        }
      }
    }

    // Player camps: enemies cannot enter (push to fence line)
    if (pushOutOfCamps(this.playerCamps, en.position, 0.8)) {
      // Redirect spawn home outside camps so they don't path back in forever
      if (isInsidePlayerCamp(this.playerCamps, en.spawnPos.x, en.spawnPos.z)) {
        en.spawnPos.copy(en.position);
      }
      en.anim.isWalking = true;
    }

    // Sync mesh position + rotation; follow the real dungeon floor height
    // (the rig animator reads userData.baseY each frame to place y).
    en.model.group.position.x = en.position.x;
    en.model.group.position.z = en.position.z;
    if (this.dungeonMap?.ready) {
      const efy = this.dungeonMap.sampleFloorY(en.position.x, en.position.z, en.model.group.position.y + 1.0);
      en.model.group.userData.baseY = (efy ?? 0) + en.model.baseY;
    }
    en.model.group.rotation.y += (en.facing - en.model.group.rotation.y) * 0.15;

    // Run procedural rig animation
    updateEnemyAnimation(en.model, en.anim, delta, elapsed);
  }

  /**
   * Load Grudge6 allies from party selection only (no auto-fill / no camp auto-post).
   * Pipeline: resolveDeployIds → createGrudge6Character (SkeletonUtils + atlas + mesh allow-list
   * + baked anims) → createAllyAgent (brain + goal/objective AI).
   */
  private async spawnPartyAllies() {
    if (this.allies.length) return; // already in field — use V to post/recall
    this.partySpawned = true;
    this.partyLoadErrors = [];
    const { deployPartyAllies } = await import("./grudge6/Grudge6Deploy");
    const result = await deployPartyAllies({
      factory: this.grudge6Factory,
      loader: this.loader,
      playerPos: this.playerPos,
      scene: this.scene,
      isDisposed: () => this.disposed,
      onProgress: (name, ok, err) => {
        if (ok) this.log(`${name} joins the field.`);
        else this.log(`Could not summon ${name}${err ? `: ${err}` : ""}`);
      },
    });
    if (this.disposed) {
      for (const a of result.agents) a.instance.dispose();
      return;
    }
    for (const a of result.agents) this.allies.push(a);
    this.partyLoadErrors = [...result.errors];
    if (!result.loaded.length && !result.errors.length) {
      this.log("No party allies selected — visit /party to deploy Grudge6 units, then press V.");
    } else if (result.loaded.length) {
      this.log(`Party in field: ${result.loaded.join(", ")}. C claim · V post/recall at pad.`);
    }
  }

  private updateAllies(delta: number) {
    if (!this.allies.length) return;
    const now = performance.now() / 1000;
    const enemies = this.enemies
      .filter((e) => e.state !== "dead" && e.state !== "death")
      .map((e) => ({
        id: e.id,
        pos: e.position.clone(),
        hp: e.hp,
        maxHp: e.maxHp,
      }));
    const harvest: Array<{ id: string; pos: THREE.Vector3; kind: "wood" | "stone" }> = [];
    if (this.harvestField) {
      for (const n of this.harvestField.nodes) {
        if (n.hp <= 0) continue;
        harvest.push({
          id: n.id,
          pos: new THREE.Vector3(n.position.x, 0, n.position.z),
          kind: n.kind === "wood" ? "wood" : "stone",
        });
      }
    }
    const focusEnemy =
      this.targetEnemy && this.targetEnemy.state !== "dead" && this.targetEnemy.state !== "death"
        ? this.targetEnemy
        : this.attackHeld
          ? this.nearestEnemy(14)
          : null;

    const pz = this.worldManifest
      ? zoneAt(this.worldManifest, this.playerPos.x, this.playerPos.z)
      : null;
    const playerZone = pz
      ? {
          id: pz.id,
          kind: pz.kind,
          x: pz.x,
          z: pz.z,
          radius: pz.radius,
          areaLevel: pz.areaLevel,
          density: pz.density,
          owner: pz.owner,
        }
      : null;
    // Mission objective zone = last waypoint (boss approach) or densest hostile
    let objectiveZone = playerZone;
    if (this.worldManifest?.waypointPath?.length) {
      const lastId = this.worldManifest.waypointPath[this.worldManifest.waypointPath.length - 1]!;
      const oz = this.worldManifest.zones.find((z) => z.id === lastId);
      if (oz) {
        objectiveZone = {
          id: oz.id,
          kind: oz.kind,
          x: oz.x,
          z: oz.z,
          radius: oz.radius,
          areaLevel: oz.areaLevel,
          density: oz.density,
          owner: oz.owner,
        };
      }
    }

    const world = {
      playerPos: this.playerPos.clone(),
      playerHp: this.playerHp,
      playerMaxHp: this.playerMaxHp,
      focusTarget: focusEnemy ? focusEnemy.position.clone() : null,
      focusEnemyId: focusEnemy?.id ?? null,
      enemies,
      harvest,
      playerZone,
      objectiveZone,
      dt: delta,
      now,
    };

    for (const agent of this.allies) {
      if (agent.hp <= 0) continue;
      const brain = agent.instance.def.brain;
      const action = thinkAlly(agent, brain, world, this.playerFacing);
      // Pathfind long moves so allies navigate maze corridors
      if (
        action.type === "move" &&
        action.targetPos &&
        this.maze &&
        agent.pathRepathAt <= now
      ) {
        const d = agent.pos.distanceTo(action.targetPos);
        if (d > 3.5) {
          agent.path = findPath(this.maze, {
            fromX: agent.pos.x,
            fromZ: agent.pos.z,
            toX: action.targetPos.x,
            toZ: action.targetPos.z,
            maxNodes: 400,
          });
          agent.pathRepathAt = now + 0.55;
        } else {
          agent.path = [];
        }
      }
      const speed = 5.2 + (brain === "skirmish" || brain === "assassin" ? 0.8 : 0);
      stepAllyMovement(agent, action, speed, delta, (p) => {
        this.maze?.collideHorizontal(p, this.PLAYER_RADIUS * 0.7);
        this.clampToArena(p);
      });

      // Apply action results
      if (action.type === "attack" && action.enemyId) {
        const en = this.enemies.find((e) => e.id === action.enemyId);
        if (en && en.state !== "dead" && en.state !== "death") {
          const dmg = Math.max(
            1,
            Math.floor(agent.instance.def.kit.damage * agent.instance.def.kit.skillMult * (0.85 + Math.random() * 0.3)),
          );
          this.damageEnemy(en, dmg, Math.random() < 0.12);
        }
      } else if (action.type === "heal") {
        const amt = agent.instance.def.kit.healAmount;
        if (action.healTarget === "player" || !action.healTarget) {
          this.playerHp = Math.min(this.playerMaxHp, this.playerHp + amt);
          this.log(`${agent.instance.def.displayName} heals you +${amt}`);
          this.auras?.pulse("arcane", this.playerPos.clone(), 2.0, 0.45);
        } else {
          agent.hp = Math.min(agent.maxHp, agent.hp + amt);
          this.log(`${agent.instance.def.displayName} mends wounds +${amt}`);
        }
      } else if (action.type === "harvest" && action.harvestId && this.harvestField) {
        const node = this.harvestField.nodes.find((n) => n.id === action.harvestId);
        if (node && node.hp > 0) {
          node.hp -= 12 + agent.instance.def.kit.damage * 0.4;
          if (node.hp <= 0) {
            const amount = node.yieldMin + Math.floor(Math.random() * (node.yieldMax - node.yieldMin + 1));
            const res = resourceForKind(node.kind);
            addResource(res, amount);
            hideHarvestNode(this.harvestField, node);
            node.respawnAt = now + 50;
            this.log(`${agent.instance.def.displayName} gathered ${amount} ${res}`);
          }
        }
      }

      // Sync mesh — tower lookouts stay elevated on the platform
      if (agent.towerManned) {
        agent.pos.x = agent.towerManned.x;
        agent.pos.z = agent.towerManned.z;
        agent.instance.group.position.set(
          agent.towerManned.x,
          agent.towerManned.y,
          agent.towerManned.z,
        );
      } else {
        agent.instance.group.position.x = agent.pos.x;
        agent.instance.group.position.y = 0;
        agent.instance.group.position.z = agent.pos.z;
      }
      let dy = agent.facing - agent.instance.group.rotation.y;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      agent.instance.group.rotation.y += dy * 0.2;
      agent.instance.animator?.update(delta);
    }
  }

  worldToScreen(worldPos: THREE.Vector3): { x: number; y: number } {
    if (!this.container) return { x: -9999, y: -9999 };
    const pos = this._projectScratch.copy(worldPos).project(this.camera);
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    return { x: (pos.x * 0.5 + 0.5) * w, y: (-pos.y * 0.5 + 0.5) * h };
  }

  /** Fog vision + remote avatar lerp + persist explored cells. */
  private updateFogAndRemotes(delta: number) {
    if (this.fog) {
      const sources: { x: number; z: number; radius: number }[] = [
        { x: this.playerPos.x, z: this.playerPos.z, radius: 16 },
      ];
      for (const a of this.allies) {
        if (a.hp <= 0) continue;
        sources.push({ x: a.pos.x, z: a.pos.z, radius: 10 });
      }
      // Ash storm: tighter vision
      if (this.runDirector.run.activeEventId === "evt_storm") {
        for (const s of sources) s.radius *= 0.55;
      }
      this.fog.update(sources);
      this.fogSaveAccum += delta;
      if (this.fogSaveAccum >= 2.5) {
        this.fogSaveAccum = 0;
        this.runDirector.setExploredCells(this.fog.exportExplored());
      }
    }

    const lerp = 1 - Math.exp(-10 * delta);
    for (const rem of this.remoteAvatars.values()) {
      rem.group.position.x += (rem.target.x - rem.group.position.x) * lerp;
      rem.group.position.z += (rem.target.z - rem.group.position.z) * lerp;
      rem.group.rotation.y += (rem.yaw - rem.group.rotation.y) * lerp;
    }
  }

  /**
   * Mark HUD dirty. Pass `force=true` for combat-critical events (damage, load
   * ready, death) so React sees them immediately; otherwise batches to ~18 Hz.
   */
  private notifyState(force = true) {
    this._stateDirty = true;
    if (force) {
      this.flushState();
      return;
    }
    this._notifyAccum += this.SIM_DT;
    if (this._notifyAccum >= this.NOTIFY_INTERVAL) {
      this._notifyAccum = 0;
      this.flushState();
    }
  }

  private flushState() {
    if (!this.onStateUpdate || !this._stateDirty) return;
    this._stateDirty = false;

    const enemyUI: GameState["enemies"] = [];
    for (const e of this.enemies) {
      if (e.state === "dead") continue;
      this._tmpV3a.copy(e.model.group.position);
      this._tmpV3a.y += e.model.height + 0.4;
      const sc = this.worldToScreen(this._tmpV3a);
      enemyUI.push({
        id: e.id,
        name: e.template.name,
        hp: e.hp,
        maxHp: e.maxHp,
        screenX: sc.x,
        screenY: sc.y,
        tier: e.template.tier,
        isBoss: e.id === this.bossEnemyId,
      });
    }

    const dmgUI: GameState["damageNumbers"] = [];
    for (const d of this.damageNumbers) {
      const sc = this.worldToScreen(d.worldPos);
      dmgUI.push({
        id: d.id,
        value: d.value,
        x: sc.x,
        y: sc.y,
        age: d.age,
        isPlayer: d.isPlayer,
        isCrit: d.isCrit,
      });
    }

    const boss = this.enemies.find((e) => e.id === this.bossEnemyId && e.state !== "dead" && e.state !== "death");
    const w = getWallet();
    const allyHud: AllyHudSnapshot[] = this.allies.map((a) => ({
      id: a.instance.def.id,
      name: a.instance.def.displayName,
      role: a.instance.def.role,
      race: a.instance.def.race,
      hp: Math.round(a.hp),
      maxHp: a.maxHp,
      state: a.state,
      brain: a.instance.def.brain,
      goal: a.currentGoal?.label ?? a.state,
      loadOk: true,
      dead: a.dead || a.hp <= 0,
      respawnSec: a.respawnAt > 0 ? Math.max(0, a.respawnAt - performance.now() / 1000) : 0,
      gait: a.instance.animator?.getGait?.() ?? null,
      debug: a.instance.debug ?? null,
    }));
    const exploredN = this.fog?.exploredCount() ?? 0;
    const gridN = this.fog ? this.fog.gridW * this.fog.gridH : 1;
    const fogSnap =
      this.fog?.getMinimap(
        this.playerPos.x,
        this.playerPos.z,
        this.coveCenter.x,
        this.coveCenter.z,
      ) ?? null;
    const dx = this.coveCenter.x - this.playerPos.x;
    const dz = this.coveCenter.z - this.playerPos.z;
    const coveBearing = (Math.atan2(dx, dz) * 180) / Math.PI;
    this.onStateUpdate({
      playerHp: Math.round(this.playerHp),
      playerMaxHp: this.playerMaxHp,
      playerMana: Math.round(this.playerMana),
      playerMaxMana: this.playerMaxMana,
      playerLevel: this.playerLevel,
      playerXp: this.playerXp,
      playerAttackCooldown: Math.max(0, this.playerAttackCooldown / this.playerMaxAttackCooldown),
      enemies: enemyUI,
      damageNumbers: dmgUI,
      combatLog: this.combatLog.slice(0, 10),
      zone: zoneLabel(this.runDirector.run),
      loaded: this.loaded,
      mapReady: this.mapReady,
      resources: getResources(),
      gold: w.gold,
      nearbyPirate: this.nearbyPirate,
      nearbyHarvest: this.nearbyHarvestLabel,
      mapSeed: this.mapSeed,
      islandRound: this.islandRound,
      difficultyMult: this.difficultyMult(),
      bossAlive: !!boss,
      bossName: boss?.template.name ?? null,
      bossHp: boss?.hp ?? 0,
      bossMaxHp: boss?.maxHp ?? 0,
      pendingSkillIdx: this.pendingSkillIdx,
      specialReadyPct: Math.min(1, 1 - Math.max(0, this.specialCdUntil - performance.now()) / Math.max(1, this.fighterKit.special.cooldown * 1000)),
      blocking: this.blocking,
      jumping: this.playerY > 0.05 || this.jumpVel > 0,
      activePerks: getActivePerks().map((id) => PERK_BY_ID.get(id)?.name ?? id),
      combatLabel: this.combatFsm.label,
      invulnerable: this.isDodging() || this.combatFsm.invulnerable,
      aliveEnemies: enemyUI.length,
      fogMinimap: fogSnap,
      exploredPct: Math.min(100, Math.round((exploredN / gridN) * 100)),
      allies: allyHud,
      partyLoadErrors: this.partyLoadErrors,
      beat: this.currentBeat,
      canSail: this.runDirector.canSail(),
      islandPhase: this.runDirector.phase,
      missionTitle: this.runDirector.mission.title,
      missionKills: this.runDirector.run.killsThisRound,
      missionGoal: this.runDirector.mission.killGoal,
      remotePlayerCount: this.remoteAvatars.size,
      mpRoom: this.mpRoom,
      playerDead: this.playerHp <= 0,
      coveBearing,
      currentZone: this.currentZone?.name ?? null,
      nearbyClaimZone: this.nearbyClaimZone
        ? `${this.nearbyClaimZone.name} · C ghost · LMB build (${CAMP_BUILD_COST.wood}w/${CAMP_BUILD_COST.stone}s)`
        : null,
      claimsOwned: this.claimsOwned,
      worldZones: (this.worldManifest?.zones ?? []).map((z) => ({
        id: z.id,
        name: z.name,
        kind: z.kind,
        x: z.x,
        z: z.z,
        radius: z.radius,
        color: z.color,
        claimable: z.claimable,
        owner: z.owner,
        chunkX: z.chunkX,
        chunkZ: z.chunkZ,
        areaLevel: z.areaLevel,
        density: z.density,
      })),
      playerMapX: this.playerPos.x,
      playerMapZ: this.playerPos.z,
      playDomain: this.playDomain,
      boatHeading: this.openWater?.heading,
      boatSpeed: this.openWater?.speed,
      nearbyIslandName:
        this.playDomain === "open_water"
          ? this.openWater?.nearestIsland(36)?.name ?? null
          : null,
      nearbyHarborStation:
        this.playDomain === "land" && this.harborDistrict
          ? (() => {
              const s = this.harborDistrict!.nearest(
                this.playerPos.x,
                this.playerPos.z,
                3.8,
              );
              return s
                ? `${s.layout.shortLabel} · E ${s.layout.action}`
                : null;
            })()
          : null,
      canEmbark:
        this.playDomain === "land" &&
        Math.hypot(
          this.playerPos.x - (this.coveCenter.x + 6),
          this.playerPos.z - (this.coveCenter.z - 3),
        ) < 10,
      canLand:
        this.playDomain === "open_water" &&
        !!this.openWater?.nearestIsland(32),
    });
  }

  private onResize = () => {
    if (!this.container) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.renderer.setSize(w, h);
    this.bloom?.setSize(w, h, 0.5);
    this.renderer.shadowMap.needsUpdate = true;
    this.applyCameraFrustum();
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.animFrameId);
    window.removeEventListener("resize", this.onResize);
    this.renderer?.domElement?.removeEventListener("wheel", this._onWheel);
    window.removeEventListener("keydown", this._keyDownHandler);
    window.removeEventListener("keyup", this._keyUpHandler);
    if (this._upHandler) window.removeEventListener("mouseup", this._upHandler);
    if (this.container) {
      this.container.removeEventListener("click", this._clickHandler);
      if (this._moveHandler) this.container.removeEventListener("mousemove", this._moveHandler);
      if (this._downHandler) this.container.removeEventListener("mousedown", this._downHandler);
      if (this._contextHandler) this.container.removeEventListener("contextmenu", this._contextHandler);
      if (this.renderer.domElement.parentNode === this.container) {
        this.container.removeChild(this.renderer.domElement);
      }
    }
    this.clearHover();
    if (this.fog) {
      try {
        this.runDirector.setExploredCells(this.fog.exportExplored());
      } catch {
        /* ignore */
      }
      this.fog.dispose();
      this.fog = null;
    }
    this.worldChunkMap?.dispose();
    this.worldChunkMap = null;
    this.worldManifest = null;
    this.modularField?.dispose();
    this.modularField = null;
    this.farmField?.dispose();
    this.farmField = null;
    this.zoneDebris?.dispose();
    this.zoneDebris = null;
    this.openWater?.dispose();
    this.openWater = null;
    this.harborDistrict?.dispose();
    this.harborDistrict = null;
    this.playerCamps?.dispose();
    this.playerCamps = null;
    this.clearPlaceGhost();
    this.placeMode = null;
    disposeDracoLoader();
    if (this.pathVisual) {
      this.scene.remove(this.pathVisual);
      this.pathVisual = null;
    }
    this.pathMap = null;
    for (const rem of this.remoteAvatars.values()) {
      this.scene.remove(rem.group);
      rem.group.traverse((c) => {
        const m = c as THREE.Mesh;
        if (m.isMesh) {
          m.geometry?.dispose();
          (m.material as THREE.Material)?.dispose();
        }
      });
    }
    this.remoteAvatars.clear();
    this.maze?.dispose();
    this.maze = null;
    this.projectileField?.dispose();
    this.projectileField = null;
    this.pendingStrikes?.dispose();
    this.pendingStrikes = null;
    this.fx?.dispose();
    this.fx = null;
    this.playerAnimator?.dispose();
    this.skillVfx?.dispose();
    this.particles?.dispose();
    this.telegraphs?.dispose();
    this.deployables?.dispose();
    this.slashField?.dispose();
    this.slashField = null;
    this.auras?.dispose();
    this.auras = null;
    for (const a of this.allies) {
      this.scene.remove(a.instance.group);
      a.instance.dispose();
    }
    this.allies = [];
    if (this.skillCursor) {
      this.scene.remove(this.skillCursor);
      this.skillCursor.geometry.dispose();
      this.skillCursorMat?.dispose();
      this.skillCursor = null;
    }
    // Dispose the procedural ground + rock field.
    if (this.groundMesh) {
      this.groundMesh.geometry.dispose();
      const gm = this.groundMesh.material as THREE.MeshStandardMaterial;
      gm.map?.dispose();
      gm.bumpMap?.dispose();
      gm.dispose();
    }
    if (this.terrainMesh) {
      this.terrainMesh.geometry.dispose();
      (this.terrainMesh.material as THREE.Material).dispose();
    }
    this.camp?.dispose();
    for (const c of this.camps) {
      if (c !== this.camp) c.dispose();
    }
    this.camps = [];
    this.darkElfCamp?.dispose();
    this.darkElfCamp = null;
    this.darkElfEvent?.dispose();
    this.darkElfEvent = null;
    this.claimFlags?.dispose();
    this.claimFlags = null;
    this.wispEvents?.dispose();
    this.wispEvents = null;
    this.warningFx?.dispose();
    this.warningFx = null;
    this.bossSpecialCount.clear();
    this.harvestField?.dispose();
    this.harvestField = null;
    this.dungeonMap?.dispose();
    this.dungeonMap = null;
    for (const p of this.pirates) {
      this.scene.remove(p.group);
      disposePirate(p);
    }
    this.pirates = [];
    for (const t of this.townsfolk) {
      this.scene.remove(t.group);
      t.dispose();
    }
    this.townsfolk = [];
    for (const wp of this.worldCollectables) {
      this.scene.remove(wp.holder);
      disposeWorldProp(wp);
    }
    this.worldCollectables = [];
    this.collectedPropIds.clear();
    for (const g of this.coveProps) {
      this.scene.remove(g);
      disposeGltfObject(g);
    }
    this.coveProps = [];
    if (this.coveLabel) {
      this.scene.remove(this.coveLabel);
      const lm = this.coveLabel.material as THREE.SpriteMaterial;
      lm.map?.dispose();
      lm.dispose();
    }
    if (this.rockField) {
      this.rockField.geometry.dispose();
      (this.rockField.material as THREE.Material).dispose();
    }
    this.bloom?.dispose();
    this.bloom = null;
    this.timer.disconnect();
    disposeRenderer(this.renderer);
    for (const en of this.enemies) {
      en.model.group.userData.disposed = true;
      if (en.model.kit) {
        disposeKitModel(en.model);
      } else if (en.model.isGLB) {
        disposeMonsterModel(en.model);
      } else {
        en.model.group.traverse((c) => {
          const mesh = c as THREE.Mesh;
          if (mesh.geometry) mesh.geometry.dispose();
        });
        for (const mat of en.model.bodyMats) mat.dispose();
      }
    }
  }
}
