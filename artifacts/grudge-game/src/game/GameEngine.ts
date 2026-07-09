import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { createEnemyModel, updateEnemyAnimation, makeAnimState, archetypeFor, type EnemyModel, type AnimState } from "./EnemyFactory";
import { isMonsterId, loadMonsterModel, disposeMonsterModel, ANIMATED_MONSTER_TEMPLATES } from "./MonsterModels";
import { isKitMonsterId, loadKitMonster, disposeKitModel, KIT_TEMPLATES } from "./KayKitCharacter";
import { makeGroundMaterial, makeRockField, makeTerrainSkirt } from "./proceduralTextures";
import { buildOrcCamp, type CampHandle } from "./CampBuilder";
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
import { addResource, getResources, type ResourceBag } from "../data/resources";
import { getWallet, saveWallet } from "../data/wallet";
import {
  getActiveFighterKit,
  type FighterKit,
} from "../data/fighterSkills";
import { getActiveFighter, RACALVIN_ID } from "../data/fighters";
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
import { PORTRAIT_URL, resolveVisibleMeshes, type RaceId } from "../data/characterMeshes";
import { getSkin, skinUrl, type SkinDef } from "../data/skins";
import { loadRacalvinForDungeon } from "./racalvinHero";
import { skillAnimCandidates } from "./kaykitHero";
import { SkillVfx } from "./skillVfx";
import type { ClassSkill } from "../data/classSkills";
import { archetypeForSkill, type SkillShapeKind } from "./combat/skillArchetypes";
import { targetsInShape, type ShapeQuery } from "./combat/damageShapes";
import type { CombatTarget } from "./combat/types";
import { ParticleVfx, elementColor } from "./combat/particles";
import { TelegraphField } from "./combat/telegraphs";
import { DeployableManager } from "./combat/deployables";
import { makeBloomComposer, type BloomComposer } from "./combat/bloom";
import { SlashWaveField } from "./combat/slashVfx";
import { AuraField } from "./combat/auras";
import { getActiveCombatProfile, brainTuning, type BrainArchetype } from "../data/characterCombatProfiles";
import { pickHeroEnemies, heroEnemyAsTemplate } from "../data/heroEnemyLibrary";
import { CDN_MONSTER_TEMPLATES } from "../data/cdnMonsters";
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
import { FX2D } from "./FX2D";
import { DUNGEON_COLLECTABLES } from "../data/worldProps";
import { loadWorldProp, disposeWorldProp, type LoadedWorldProp } from "./WorldPropLoader";

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
  equipHasShoulder?: boolean;
}

export class GameEngine {
  private scene!: THREE.Scene;
  private camera!: THREE.OrthographicCamera;
  private renderer!: THREE.WebGLRenderer;
  private clock!: THREE.Clock;
  private loader!: GLTFLoader;
  private skillVfx!: SkillVfx;
  private particles!: ParticleVfx;
  private telegraphs!: TelegraphField;
  private deployables!: DeployableManager;
  private bloom: BloomComposer | null = null;
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
  private _camLook = new THREE.Vector3(0, 0, 0);
  private playerPos = new THREE.Vector3(0, 0, 0);
  private _rmTmp = new THREE.Vector3();
  private playerTarget: THREE.Vector3 | null = null;
  private playerSpeed = 6;
  private playerFacing = 0;
  private playerAttackCooldown = 0;
  private playerMaxAttackCooldown = 0.75;
  private indicatorRing: THREE.Mesh | null = null;

  // Real dungeon geometry (forge-scene.glb): floor + wall colliders via BVH.
  private dungeonMap: DungeonMap | null = null;
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
  private coveProps: THREE.Group[] = [];
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
  public onSailBoss: (() => void) | null = null;

  private fighterKit: FighterKit = getActiveFighterKit();
  private slashField: SlashWaveField | null = null;
  private auras: AuraField | null = null;
  /** fighterId → brain for hero-rival enemies. */
  private enemyBrains = new Map<string, BrainArchetype>();
  private playerAuraElement = getActiveCombatProfile().auraElement;
  /** -1 = none; 0-4 = skill awaiting ground placement. */
  private pendingSkillIdx = -1;
  private skillCdUntil = [0, 0, 0, 0, 0];
  private specialCdUntil = 0;
  private blocking = false;
  private jumpVel = 0;
  private playerY = 0;
  private dodgeIframeUntil = 0;
  private skillCursor: THREE.Mesh | null = null;
  private skillCursorMat: THREE.MeshBasicMaterial | null = null;

  /** Live perk combat modifiers (refreshed each frame / on cast). */
  private perkMods(): PerkCombatMods {
    return getActivePerkMods();
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
    // Attribute stones + fighter loadout → speed / defense baseline
    try {
      const lo = getGameLoadout();
      this.playerSpeed = 6 * lo.combat.moveSpeedMult;
      this.playerDefense = Math.round(stats.defense + lo.combat.defense * 40);
    } catch {
      /* ignore */
    }
    this._camLook.copy(this.playerPos);

    const w = container.clientWidth;
    const h = container.clientHeight;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x060608);
    this.scene.fog = new THREE.FogExp2(0x060608, 0.010);

    const aspect = w / h;
    const d = 18;
    this.camera = new THREE.OrthographicCamera(-d * aspect, d * aspect, d, -d, 0.1, 300);
    this.camera.position.set(18, 18, 18);
    this.camera.lookAt(0, 0, 0);

    try {
      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    } catch {
      this.renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false });
    }
    this.renderer.setSize(w, h);
    // Cap DPR for lag-free rendering on high-DPI laptops (2x often halves FPS).
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.shadowMap.enabled = true;
    // PCFSoft is deprecated / slower — PCF is clearer and cheaper.
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    // Filmic tone mapping for richer contrast across the larger lit map.
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    // Prefer power-of-two shadow maps and avoid auto-clear thrash.
    this.renderer.shadowMap.autoUpdate = true;
    container.appendChild(this.renderer.domElement);

    this.clock = new THREE.Clock();
    this.loader = new GLTFLoader();
    this.skillVfx = new SkillVfx(this.scene, this.loader);
    this.particles = new ParticleVfx(this.scene);
    this.telegraphs = new TelegraphField(this.scene);
    this.deployables = new DeployableManager(this.scene);
    this.slashField = new SlashWaveField(this.scene, this.particles);
    this.auras = new AuraField(this.scene);
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
    // Selective bloom so the additive particle VFX glow without washing out the
    // dark scene. Null (graceful fallback to direct render) if setup fails headless.
    this.bloom = makeBloomComposer(this.renderer, this.scene, this.camera, w, h);

    this.buildDungeon();
    this.loadEnvironment();
    this.camp = buildOrcCamp(this.loader, this.scene, `${import.meta.env.BASE_URL}models/buildings/orc_camp_set.glb`);
    this.buildPirateCove();
    this.buildHarvestables();
    this.buildWorldCollectables();
    this.scatterGenerativeProps();
    this.setupLighting();
    this.loadPlayerModel();
    this.spawnInitialEnemies();
    this.spawnDungeonBoss();
    this.setupInput(container);

    this.fx = new FX2D(container);

    window.addEventListener("resize", this.onResize);
    this.animate();
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
    const rocks = makeRockField(180, D * 0.28, D - 4);
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
  }

  /**
   * Environment setup. The forge-scene.glb dungeon model (which sat centered at
   * the origin) has been removed at the user's request — the arena now uses the
   * procedural flat stone floor + terrain skirt built in `buildDungeon()`, with
   * movement clamped to the ±DUNGEON square. `dungeonMap` stays null so every
   * `dungeonMap?.ready` branch takes the flat-plane fallback. We mark the map
   * ready immediately so the loading veil clears.
   */
  private loadEnvironment() {
    this.mapReady = true;
    this.onMapReady?.();
    this.notifyState();
  }

  /**
   * Resolve the just-moved player against the real dungeon: slide along walls
   * (capsule vs BVH) and follow the actual floor height. Stays inside the arena
   * via the ±DUNGEON clamp. Off the forge footprint (or before the BVH is ready)
   * it gracefully falls back to the flat ground at y=0.
   */
  private resolvePlayer() {
    const dm = this.dungeonMap;
    if (dm?.ready) dm.collideHorizontal(this.playerPos, this.PLAYER_RADIUS, this.PLAYER_HEIGHT);
    const D = this.DUNGEON - 1;
    this.playerPos.x = Math.max(-D, Math.min(D, this.playerPos.x));
    this.playerPos.z = Math.max(-D, Math.min(D, this.playerPos.z));
    // Probe from just above the current foot height (step-up allowance) so the
    // floor under the player is found, never a roof/ceiling overhead.
    const fy = dm?.ready
      ? dm.sampleFloorY(this.playerPos.x, this.playerPos.z, this.playerPos.y + 0.6)
      : null;
    this.playerPos.y = fy ?? 0;
  }

  /** Clamp an arbitrary XZ point to the playable arena (±DUNGEON). */
  private clampToArena(v: THREE.Vector3) {
    const D = this.DUNGEON - 1;
    v.x = Math.max(-D, Math.min(D, v.x));
    v.z = Math.max(-D, Math.min(D, v.z));
  }

  /**
   * Pirate Cove — a neutral allied outpost: a docked ship (boat assistance) +
   * dock + treasure props, ringed by NEUTRAL pirate NPCs. The pirates animate
   * with their own embedded clips (idle + wave at a nearby player), are never
   * added to `this.enemies`, and carry no `enemyId`, so they can't be targeted
   * or attacked. They signal that the pirate crew will aid you in the Boss Arena.
   */
  private buildPirateCove() {
    const c = this.coveCenter;
    // Boat assistance: docked ships as the cove landmark + jetty + loot.
    this.loadCoveProp("world/Ship_Small.gltf", new THREE.Vector3(c.x + 7, 0, c.z - 4), 16, Math.PI * 0.18);
    this.loadCoveProp("world/Ship_Large.gltf", new THREE.Vector3(c.x + 14, 0, c.z - 8), 22, Math.PI * 0.08);
    this.loadCoveProp("world/Environment_Dock.gltf", new THREE.Vector3(c.x + 1, 0, c.z), 11, 0);
    this.loadCoveProp("world/Environment_Dock_Pole.gltf", new THREE.Vector3(c.x - 4, 0, c.z + 4), 2.2, 0.3);
    this.loadCoveProp("world/Prop_Chest_Gold.gltf", new THREE.Vector3(c.x - 2.5, 0, c.z + 2.5), 1.3, 0.6);
    this.loadCoveProp("world/Prop_Barrel.gltf", new THREE.Vector3(c.x - 3.5, 0, c.z + 1), 1.1, 0);
    this.loadCoveProp("world/Prop_Anchor.gltf", new THREE.Vector3(c.x - 1.5, 0, c.z + 3.5), 1.4, -0.4);
    this.loadCoveProp("world/Prop_Coins.gltf", new THREE.Vector3(c.x - 2, 0, c.z + 1.5), 0.9, 0.2);

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

    this.addCoveLabel(new THREE.Vector3(c.x + 1, 4.6, c.z));

    this.buildTownsfolk();
  }

  /** Tall generative trees (2–4× character height) + stone piles + island rocks. */
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
  }

  /** Scatter extra pirate-kit props as generative dungeon flavor. */
  private scatterGenerativeProps() {
    const rng = mulberry(this.mapSeed ^ 0x9e3779b9);
    const props: Array<{ rel: string; extent: number }> = [
      { rel: "world/Prop_Barrel.gltf", extent: 1.0 },
      { rel: "world/Prop_Chest_Gold.gltf", extent: 1.1 },
      { rel: "world/Prop_Anchor.gltf", extent: 1.2 },
      { rel: "world/Prop_Coins.gltf", extent: 0.85 },
    ];
    for (let i = 0; i < 14; i++) {
      const p = props[i % props.length]!;
      const a = rng() * Math.PI * 2;
      const r = 18 + rng() * (this.DUNGEON - 28);
      let x = Math.cos(a) * r;
      let z = Math.sin(a) * r;
      // Keep clear of cove cluster.
      if (x > 55 && Math.abs(z + 14) < 20) x -= 25;
      this.loadCoveProp(p.rel, new THREE.Vector3(x, 0, z), p.extent * (0.85 + rng() * 0.4), rng() * Math.PI * 2);
    }
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

  /** Load a self-contained pirate-kit prop, scaled so its longest XZ ≈ extent. */
  private loadCoveProp(rel: string, pos: THREE.Vector3, extent: number, rotY: number) {
    const url = `${import.meta.env.BASE_URL}models/pirates/${rel}`;
    this.loader.load(
      url,
      (gltf) => {
        // Teardown-race guard: if the engine was disposed mid-load, release the
        // streamed scene instead of attaching it to a dead engine.
        if (this.disposed) {
          disposeGltfObject(gltf.scene);
          return;
        }
        const root = gltf.scene;
        const bbox = new THREE.Box3().setFromObject(root);
        const size = new THREE.Vector3();
        bbox.getSize(size);
        root.scale.setScalar(extent / (Math.max(size.x, size.z) || 1));
        const b2 = new THREE.Box3().setFromObject(root);
        const ctr = new THREE.Vector3();
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
        holder.rotation.y = rotY;
        holder.add(root);
        this.scene.add(holder);
        this.coveProps.push(holder);
      },
      undefined,
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

    // Key/sun light. Its shadow frustum is kept tight (±35) but the whole rig
    // follows the player each frame (see update()) so shadows stay sharp across
    // the much larger map without an enormous, blurry shadow map.
    const sun = new THREE.DirectionalLight(0xff9955, 2.2);
    sun.position.set(20, 30, 20);
    sun.castShadow = true;
    sun.shadow.mapSize.setScalar(2048);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 220;
    sun.shadow.camera.left = sun.shadow.camera.bottom = -60;
    sun.shadow.camera.right = sun.shadow.camera.top = 60;
    sun.shadow.bias = -0.001;
    this.scene.add(sun);
    this.scene.add(sun.target);
    this.sun = sun;

    const fill = new THREE.DirectionalLight(0x1a2050, 0.6);
    fill.position.set(-15, 8, -15);
    this.scene.add(fill);

    // Torches distributed across the enlarged map for ember pools of light.
    const torchPositions: Array<[number, number]> = [];
    const step = this.DUNGEON / 2;
    for (let gx = -1; gx <= 1; gx++) {
      for (let gz = -1; gz <= 1; gz++) {
        if (gx === 0 && gz === 0) continue;
        torchPositions.push([gx * step, gz * step]);
      }
    }
    torchPositions.push([-10, -10], [10, -10], [-10, 10], [10, 10]);
    for (const [tx, tz] of torchPositions) {
      const light = new THREE.PointLight(0xff6600, 3, 9, 1.5);
      light.position.set(tx, 3, tz);
      this.scene.add(light);
      this.torchLights.push(light);

      const flame = new THREE.Mesh(
        new THREE.SphereGeometry(0.14, 8, 8),
        new THREE.MeshStandardMaterial({ color: 0xff6600, emissive: 0xff6600, emissiveIntensity: 3 })
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
    const skin = getSkin(this.initStats.skinId);
    if (skin) this.loadSkinModel(skin);
    else this.loadRaceModel();
  }

  /** Racalvin (Corsair King) — bespoke base model + library clips + sword. */
  private loadRacalvinModel() {
    loadRacalvinForDungeon(
      this.loader,
      1.9,
      (wrapper, animator) => this.finalizePlayer(wrapper, animator),
      () => this.loadRaceModel(),
    );
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

    // Always spawn one of each ANIMATED imported GLB monster so they're
    // guaranteed to appear in the dungeon.
    for (const m of ANIMATED_MONSTER_TEMPLATES) configs.push({ template: m, count: 1 });

    // Spawn the KayKit skeleton minions (real shared-library skeletal animation).
    for (const m of KIT_TEMPLATES) configs.push({ template: m, count: m.tier === 1 ? 3 : 2 });

    // Rival heroes (unused fighters) — elite pack with AI brains from combat profiles.
    const rivals = pickHeroEnemies(this.mapSeed ^ 0xc0ffee, Math.min(3, 1 + Math.floor((this.islandRound - 1) / 2)));
    for (const h of rivals) {
      configs.push({ template: heroEnemyAsTemplate(h), count: 1 });
      this.enemyBrains.set(h.visualId, h.brain);
      this.enemyBrains.set(h.id, h.brain);
    }

    // CDN monster pack (D1 / assets.grudge-studio.com) — streams at runtime.
    const cdnRng = mulberry(this.mapSeed ^ 0xcd4);
    const cdnPick = [...CDN_MONSTER_TEMPLATES].sort(() => cdnRng() - 0.5).slice(0, 3 + Math.min(4, this.islandRound));
    for (const m of cdnPick) configs.push({ template: m, count: 1 });

    const rng = mulberry(this.mapSeed ^ 0x51aced);
    for (const { template, count } of configs) {
      for (let i = 0; i < count; i++) {
        const D = this.DUNGEON - 3;
        let x = 0, z = 0;
        let attempts = 0;
        do {
          x = (rng() * 2 - 1) * D;
          z = (rng() * 2 - 1) * D;
          attempts++;
        } while (Math.sqrt(x * x + z * z) < 6 && attempts < 20);
        this.createEnemy(this.scaleTemplate(template), new THREE.Vector3(x, 0, z));
      }
    }
    // Extra packs on later rounds
    const extra = Math.min(12, (this.islandRound - 1) * 2);
    if (extra > 0 && this.enemyTemplates.length) {
      const rng2 = mulberry(this.mapSeed ^ 0xdead);
      for (let i = 0; i < extra; i++) {
        const t = this.enemyTemplates[Math.floor(rng2() * this.enemyTemplates.length)]!;
        const D = this.DUNGEON - 4;
        const x = (rng2() * 2 - 1) * D;
        const z = (rng2() * 2 - 1) * D;
        if (Math.hypot(x, z) < 8) continue;
        this.createEnemy(this.scaleTemplate(t), new THREE.Vector3(x, 0, z));
      }
    }
  }

  /**
   * One generative dungeon boss far from spawn (opposite the cove). Uses the
   * largest monster GLB when available; does not soft-respawn on death.
   */
  private spawnDungeonBoss() {
    const bossPos = new THREE.Vector3(-52, 0, 38);
    const m = this.difficultyMult();
    const template: EnemyTemplate = {
      id: "mon_big_scary_t3",
      name: this.islandRound > 1 ? `R${this.islandRound} Island Colossus` : "Island Colossus",
      type: "titan",
      tier: 5,
      hp: Math.round(1400 * m * 1.1),
      damage: Math.round(38 * (1 + (this.islandRound - 1) * 0.15)),
    };
    // Prefer animated medusa/dante if t3 fails resolution — createEnemy maps mon_*.
    const boss = this.createEnemy(template, bossPos);
    boss.aggroRange = 14;
    boss.attackRange = 4.2;
    boss.speed = 1.7;
    boss.model.group.scale.multiplyScalar(1.35);
    boss.model.height *= 1.35;
    this.bossEnemyId = boss.id;
    boss.model.group.userData.isBoss = true;
    this.log(`${template.name} stirs in the western ruins…`);
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
    if (isKitMonsterId(template.id) || isMonsterId(template.id)) return template.id;
    const KIT_BY_TIER = ["kit_skel_minion", "kit_skel_minion", "kit_skel_warrior", "kit_skel_rogue", "kit_skel_mage"];
    const seed = this.hashStr(template.id || template.name);
    const t = Math.max(1, Math.min(template.tier, 5));
    let pool: string[];
    switch (archetypeFor(template.type)) {
      case "arachnid": pool = ["mon_pincher"]; break;
      case "quadruped": pool = ["mon_dante_beast", "mon_pincher"]; break;
      case "dragon": pool = ["mon_dante_beast"]; break;
      case "golem": pool = ["mon_dante_beast", "mon_medusa"]; break;
      case "flying": pool = ["kit_skel_mage"]; break;
      case "humanoid":
      default:
        if (t <= 1) pool = ["kit_skel_minion"];
        else if (t === 2) pool = ["kit_skel_warrior", "kit_skel_rogue", "mon_cultist"];
        else if (t === 3) pool = ["kit_skel_mage", "kit_skel_rogue", "mon_cultist"];
        else pool = ["mon_medusa", "mon_cultist", "kit_skel_mage"];
        break;
    }
    const chosen = pool[seed % pool.length] ?? KIT_BY_TIER[t - 1] ?? "kit_skel_warrior";
    if (import.meta.env.DEV && !isKitMonsterId(chosen) && !isMonsterId(chosen)) {
      // Catch a future roster-id typo before the GLB loaders silently fall back.
      console.warn(`[GameEngine] resolveAnimatedModelId produced unknown model id "${chosen}" for "${template.id}"`);
    }
    return chosen;
  }

  private createEnemy(template: EnemyTemplate, pos: THREE.Vector3): EnemyInstance {
    const id = `e${this.enemyIdCounter++}`;
    const retag = (m: EnemyModel) => {
      // Re-tag children once the GLB has streamed in so raycast targeting
      // works on the real meshes.
      m.group.traverse((c) => { c.userData.enemyId = id; });
    };
    const modelId = this.resolveAnimatedModelId(template);
    const model = isKitMonsterId(modelId)
      ? loadKitMonster(modelId, this.loader, retag)
      : isMonsterId(modelId)
        ? loadMonsterModel(modelId, this.loader, retag)
        : createEnemyModel(template.name, template.type, template.tier);
    model.group.position.set(pos.x, model.baseY, pos.z);
    model.group.userData.baseY = model.baseY;
    model.group.userData.enemyId = id;
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
      if (e.code === "Escape") {
        this.cancelSkillTargeting();
      }
      const n = Number(e.key);
      if (n >= 1 && n <= 5) {
        e.preventDefault();
        this.selectSkill(n - 1);
      }
    };
    this._keyUpHandler = (e: KeyboardEvent) => {
      this.keys.delete(e.code);
      if (e.code === "KeyQ") this.blocking = false;
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

    // Ground pick (used for AoE placement and move).
    const pt = this.dungeonMap?.ready
      ? this.dungeonMap.floorPickFromRay(this.raycaster.ray)
      : (this.raycaster.intersectObject(this.floorPlane)[0]?.point ?? null);

    // Skill targeting: first number key selects, this LMB places & casts.
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

  /** Space — jump (clip + hop). */
  doJump() {
    if (this.playerY > 0.05 || this.jumpVel > 0) return;
    this.jumpVel = 7.5;
    this.playerAnimator?.triggerRole("jump");
    this.playerAnimator?.triggerNamed(["jump", "jump_full"]);
  }

  /** Shift — dodge with i-frames via committed dash. */
  doDodge() {
    const forward = new THREE.Vector3(Math.sin(this.playerFacing), 0, Math.cos(this.playerFacing));
    if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) {
      forward.set(-Math.cos(this.playerFacing), 0, Math.sin(this.playerFacing));
    } else if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) {
      forward.set(Math.cos(this.playerFacing), 0, -Math.sin(this.playerFacing));
    }
    this.playerPos.x += forward.x * 3.2;
    this.playerPos.z += forward.z * 3.2;
    this.clampToArena(this.playerPos);
    this.playerAnimator?.triggerRole("dodge");
    this.playerAnimator?.triggerNamed(["dodge", "roll"]);
    this.playerTarget = null;
    this.dodgeIframeUntil = performance.now() + 380;
  }

  private isDodging(): boolean {
    return performance.now() < this.dodgeIframeUntil;
  }

  /** 1-5: select skill. Ground-AoE skills wait for LMB; others cast immediately. */
  selectSkill(idx: number) {
    const skill = this.fighterKit.skills[idx];
    if (!skill) {
      // Fall back to legacy class skill path.
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
    if (skill.targeting === "ground_aoe") {
      this.pendingSkillIdx = idx;
      if (this.skillCursor && this.skillCursorMat) {
        this.skillCursor.visible = true;
        const r = (skill.aoeRadius ?? 4) * this.perkMods().aoeRadiusMult;
        this.skillCursor.scale.setScalar(r);
        this.skillCursorMat.color.setHex(skill.color ?? elementColor(skill.element));
      }
      this.log(`${skill.name} ready — LMB to place AoE (Esc cancel).`);
      this.notifyState();
      return;
    }
    this.castFighterSkill(idx, null);
  }

  cancelSkillTargeting() {
    this.pendingSkillIdx = -1;
    if (this.skillCursor) this.skillCursor.visible = false;
    this.notifyState();
  }

  private castPendingSkillAt(world: THREE.Vector3) {
    const idx = this.pendingSkillIdx;
    if (idx < 0) return;
    this.pendingSkillIdx = -1;
    if (this.skillCursor) this.skillCursor.visible = false;
    this.castFighterSkill(idx, world);
  }

  /** R — character special attack (skill_a / skill_b wave). */
  useSpecial() {
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
    this.auras?.pulse(skill.element, this.playerPos.clone(), 1.6 * aoeMul, 0.35);
    this.log(`${skill.name}!`);
    this.notifyState();
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
    const out: CombatTarget[] = [];
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
    const dir = this.resolveAimDir();
    this.playerFacing = Math.atan2(dir.x, dir.z);

    const isCast = arch.shape === "circle" || arch.shape === "nova" || arch.shape === "deployable";
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

    const origin = this.playerPos.clone();

    if (arch.shape === "deployable") {
      const dep = arch.deployable ?? "fire_totem";
      const place = origin.clone().add(dir.clone().multiplyScalar(arch.range));
      this.clampToArena(place);
      this.deployables.deploy(dep, place, arch.color, this.playerBaseDamage * arch.damageMult, arch.radius ?? 4);
      this.particles?.castSkillVfx({ element: arch.element, shape: "deployable", center: place.clone(), origin, dir, reach: arch.radius ?? 4 });
      this.log(`You deploy a ${dep.replace("_", " ")}.`);
      this.notifyState();
      return;
    }

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
    this.spawnSkillVfx(center, arch.shape);
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

  /** GLB flavor only for area shapes (a cloud ring on nova/circle). cone/line
   *  rely on the element particle silhouette so the GLBs don't read as repetitive. */
  private spawnSkillVfx(pos: THREE.Vector3, shape: SkillShapeKind) {
    if (shape === "nova" || shape === "circle") {
      this.skillVfx.spawn("cloud", pos, 4, 1.0);
    }
  }

  /**
   * Engage nearby pirate: vendor opens shop, captain re-seeds the generative
   * island (new trees/stones/enemy layout) and can sail to the boss arena.
   */
  tryEngagePirate() {
    this.refreshNearbyInteractables();
    const np = this.nearbyPirate;
    if (!np) {
      this.log("No pirate nearby — head to Pirate Cove (east).");
      return;
    }
    const pirate = this.pirates.find((p) => p.def.id === np.id);
    pirate?.animator?.wave();

    if (np.role === "vendor") {
      this.log(`${np.name}: "Wood, stone, grog — fair prices for a corsair."`);
      this.onOpenVendor?.();
      return;
    }
    if (np.role === "captain") {
      this.log(`${np.name}: "The wind shifts — I chart a new island!"`);
      this.reseedGenerativeMap();
      return;
    }
    this.log(`${np.name}: "${np.prompt}"`);
  }

  /** Captain re-sails: next round — tougher enemies, new seed/layout/boss. */
  reseedGenerativeMap() {
    this.mapSeed = (Math.random() * 0xffffffff) >>> 0;
    this.islandRound += 1;
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
    this.auras?.clear();
    if (this.playerGroup) {
      this.auras?.attach(this.playerAuraElement, {
        follow: this.playerGroup,
        radius: 1.35,
        yOffset: 0.05,
      });
    }
    this.buildHarvestables();
    this.spawnInitialEnemies();
    this.spawnDungeonBoss();
    this.playerPos.set(0, 0, 0);
    this.playerY = 0;
    this.jumpVel = 0;
    if (this.playerGroup) this.playerGroup.position.set(0, 0, 0);
    // Soft heal between rounds so the loop is fair but still pressured.
    this.playerHp = Math.min(this.playerMaxHp, this.playerHp + this.playerMaxHp * 0.35);
    this.playerMana = Math.min(this.playerMaxMana, this.playerMana + this.playerMaxMana * 0.4);
    const mult = this.difficultyMult();
    this.log(
      `Round ${this.islandRound} — island #${this.mapSeed.toString(16)} · enemies ×${mult.toFixed(2)}`,
    );
    this.onMapReseed?.(this.mapSeed);
    this.notifyState();
  }

  private refreshNearbyInteractables() {
    this.nearbyPirate = null;
    this.nearbyHarvestLabel = null;
    const now = performance.now() / 1000;

    let bestPirateDist = 3.6;
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

    if (this.harvestField) {
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
    }
    this.playerHp = Math.max(0, this.playerHp - mitigated);
    const wp = this.playerPos.clone();
    wp.y += 2.5;
    this.damageNumbers.push({ id: `d${this.idCounter++}`, value: mitigated, worldPos: wp, age: 0, isPlayer: true, isCrit: false });
    this.notifyState();
  }

  private log(msg: string) {
    this.combatLog.unshift(msg);
    if (this.combatLog.length > 10) this.combatLog.pop();
  }

  private animate = () => {
    this.animFrameId = requestAnimationFrame(this.animate);
    const delta = Math.min(this.clock.getDelta(), 0.08);
    this.update(delta);
    if (this.bloom) {
      this.bloom.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
    // 2D overlay effects (crosshair, sparks, projectiles)
    if (this.fx) {
      this.fx.update(delta);
      this.fx.draw();
    }
  };

  private update(delta: number) {
    const elapsed = this.clock.getElapsedTime();

    // Freeze the whole simulation until the player has actually entered the
    // scene (player model loaded AND the dungeon GLB/BVH built). This keeps
    // enemies, pirate NPCs and all AI from moving or acting behind the loading
    // veil, so the world is pristine the instant the veil lifts. The state is
    // still pushed each frame so the veil receives the ready signal promptly.
    if (!this.loaded || !this.mapReady) {
      this.notifyState();
      return;
    }

    if (this.playerAttackCooldown > 0) this.playerAttackCooldown -= delta;

    this.updateWorldCollectables(delta, elapsed);

    // Keyboard movement
    const raw = new THREE.Vector2();
    if (this.keys.has("KeyW") || this.keys.has("ArrowUp"))    { raw.x -= 1; raw.y -= 1; }
    if (this.keys.has("KeyS") || this.keys.has("ArrowDown"))  { raw.x += 1; raw.y += 1; }
    if (this.keys.has("KeyA") || this.keys.has("ArrowLeft"))  { raw.x -= 1; raw.y += 1; }
    if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) { raw.x += 1; raw.y -= 1; }

    let playerMoving = false;
    if (raw.length() > 0) {
      raw.normalize();
      this.playerPos.x += raw.x * this.playerSpeed * delta;
      this.playerPos.z += raw.y * this.playerSpeed * delta;
      this.playerTarget = null;
      this.targetEnemy = null;
      if (this.indicatorRing) this.indicatorRing.visible = false;
      this.playerFacing = Math.atan2(raw.x, raw.y);
      playerMoving = true;
    }

    // RIGHT mouse held = attack. Lock the LEFT-selected enemy if it's still
    // alive, otherwise auto-acquire the nearest one; advance into melee, strike.
    let attacking = false;
    if (!playerMoving && this.attackHeld) {
      const locked =
        this.targetEnemy && this.targetEnemy.state !== "dead" && this.targetEnemy.state !== "death"
          ? this.targetEnemy
          : this.nearestEnemy(14);
      if (!locked) {
        // RMB with no foe: harvest nearby tree / stone.
        this.tryHarvestAttack();
      } else if (locked) {
        this.targetEnemy = locked;
        const toFoe = new THREE.Vector3().subVectors(locked.position, this.playerPos);
        const dist = toFoe.length();
        this.playerFacing = Math.atan2(toFoe.x, toFoe.z);
        if (dist > 3.0) {
          toFoe.normalize();
          this.playerPos.x += toFoe.x * this.playerSpeed * delta;
          this.playerPos.z += toFoe.z * this.playerSpeed * delta;
          playerMoving = true;
        } else if (this.playerAttackCooldown <= 0) {
          this.doAttack(locked);
        }
        attacking = true;
        this.playerTarget = null;
        if (this.indicatorRing) this.indicatorRing.visible = false;
      }
    }

    // LEFT-click move (selection / move) — no auto-attack; attacking is RMB-only.
    if (!attacking && this.playerTarget) {
      const toTarget = new THREE.Vector3().subVectors(this.playerTarget, this.playerPos);
      const distToTarget = toTarget.length();
      if (distToTarget > 0.2) {
        toTarget.normalize();
        this.playerPos.x += toTarget.x * this.playerSpeed * delta;
        this.playerPos.z += toTarget.z * this.playerSpeed * delta;
        this.playerFacing = Math.atan2(toTarget.x, toTarget.z);
        playerMoving = true;
      } else {
        this.playerTarget = null;
        if (this.indicatorRing) this.indicatorRing.visible = false;
      }
    }

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
      if (this.playerAnimator.consumeRootMotion(this._rmTmp)) {
        this.playerPos.x += this._rmTmp.x;
        this.playerPos.z += this._rmTmp.z;
      }
    } else if (this.playerMixer) {
      this.playerMixer.update(delta);
    }

    // Resolve the freshly-moved player against the real dungeon geometry.
    this.resolvePlayer();
    this.playerPos.y = this.playerY;

    // Slash waves (special + skill cuts) — travel farther than the melee hit.
    if (this.slashField) {
      const slashHits = this.slashField.update(
        delta,
        this.enemies.map((en) => ({
          id: en.id,
          position: en.position,
          alive: en.state !== "dead" && en.state !== "death",
        })),
      );
      for (const h of slashHits) {
        const en = this.enemies.find((e) => e.id === h.enemyId);
        if (en) this.damageEnemy(en, h.damage, Math.random() < this.playerCritChance);
      }
    }

    // Skill cursor follows mouse while ground-AoE is pending.
    if (this.pendingSkillIdx >= 0 && this.skillCursor && this.pointerGround) {
      this.skillCursor.visible = true;
      this.skillCursor.position.set(this.pointerGround.x, 0.12, this.pointerGround.z);
      const sk = this.fighterKit.skills[this.pendingSkillIdx];
      if (sk) this.skillCursor.scale.setScalar(sk.aoeRadius ?? 4);
    }

    if (this.playerGroup) {
      const targetPos = new THREE.Vector3(this.playerPos.x, this.playerY, this.playerPos.z);
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

    // Smooth follow camera — eases both position and look-at toward the player.
    const camOffset = new THREE.Vector3(18, 18, 18);
    const camTarget = new THREE.Vector3(this.playerPos.x, 0, this.playerPos.z).add(camOffset);
    this.camera.position.lerp(camTarget, 0.12);
    this._camLook.lerp(new THREE.Vector3(this.playerPos.x, 0, this.playerPos.z), 0.15);
    this.camera.lookAt(this._camLook);

    // Sun + shadow rig tracks the player so shadows stay sharp across the big map.
    if (this.sun) {
      this.sun.position.set(this.playerPos.x + 20, 30, this.playerPos.z + 20);
      this.sun.target.position.set(this.playerPos.x, 0, this.playerPos.z);
      this.sun.target.updateMatrixWorld();
    }

    for (let i = 0; i < this.torchLights.length; i++) {
      const t = this.torchLights[i];
      t.intensity = 2.5 + Math.sin(elapsed * 5.7 + i * 2.3) * 0.5 + Math.sin(elapsed * 13.1 + i * 1.7) * 0.25;
    }

    for (const en of this.enemies) {
      if (en.state === "dead") continue;
      this.updateEnemy(en, delta, elapsed);
    }

    this.damageNumbers = this.damageNumbers.filter((d) => {
      d.worldPos.y += delta * 1.8;
      d.age += delta;
      return d.age < 1.4;
    });

    const mods = this.perkMods();
    const regen = 6 + mods.regenPerSec;
    if (this.playerHp < this.playerMaxHp) {
      this.playerHp = Math.min(this.playerMaxHp, this.playerHp + delta * regen);
    }

    this.notifyState();
  }

  private updateEnemy(en: EnemyInstance, delta: number, elapsed: number) {
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
          const dir = new THREE.Vector3().subVectors(en.position, this.playerPos).normalize();
          en.position.x += dir.x * en.speed * 0.85 * delta;
          en.position.z += dir.z * en.speed * 0.85 * delta;
          this.clampToArena(en.position);
          en.anim.isWalking = true;
        } else if (distToPlayer <= en.attackRange) {
          en.state = "attack";
          if (en.attackCooldown <= 0) {
            en.anim.isAttacking = true;
            const special = tune && Math.random() < tune.specialBias;
            const dmg = Math.floor(
              en.template.damage * (special ? 1.45 : 1) * (0.85 + Math.random() * 0.3),
            );
            this.takeDamage(dmg, en.template.name + (special ? " ★" : ""));
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
        } else {
          en.state = "chase";
          const dir = new THREE.Vector3().subVectors(this.playerPos, en.position).normalize();
          // Assassins add a slight lateral strafe for flanking feel.
          if (brain === "assassin") {
            const side = Math.sin(elapsed * 1.7) >= 0 ? 1 : -1;
            const sx = -dir.z * 0.4 * side;
            const sz = dir.x * 0.4 * side;
            dir.x += sx;
            dir.z += sz;
            dir.normalize();
          }
          en.position.x += dir.x * en.speed * delta;
          en.position.z += dir.z * en.speed * delta;
          this.clampToArena(en.position);
          en.anim.isWalking = true;
        }
      } else {
        const distToPatrol = en.position.distanceTo(en.patrolTarget);
        if (distToPatrol < 0.4) {
          en.patrolTarget.set(
            en.spawnPos.x + (Math.random() * 2 - 1) * 4,
            0,
            en.spawnPos.z + (Math.random() * 2 - 1) * 4
          );
          en.state = "idle";
        } else {
          const dir = new THREE.Vector3().subVectors(en.patrolTarget, en.position).normalize();
          en.position.x += dir.x * en.speed * 0.5 * delta;
          en.position.z += dir.z * en.speed * 0.5 * delta;
          en.facing = Math.atan2(dir.x, dir.z);
          en.anim.isWalking = true;
          en.state = "patrol";
        }
      }
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

  worldToScreen(worldPos: THREE.Vector3): { x: number; y: number } {
    if (!this.container) return { x: -9999, y: -9999 };
    const pos = worldPos.clone().project(this.camera);
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    return { x: (pos.x * 0.5 + 0.5) * w, y: (-pos.y * 0.5 + 0.5) * h };
  }

  private notifyState() {
    if (!this.onStateUpdate) return;

    const enemyUI = this.enemies
      .filter((e) => e.state !== "dead")
      .map((e) => {
        const above = e.model.group.position.clone();
        above.y += e.model.height + 0.4;
        const sc = this.worldToScreen(above);
        return { id: e.id, name: e.template.name, hp: e.hp, maxHp: e.maxHp, screenX: sc.x, screenY: sc.y, tier: e.template.tier };
      });

    const dmgUI = this.damageNumbers.map((d) => {
      const sc = this.worldToScreen(d.worldPos);
      return { id: d.id, value: d.value, x: sc.x, y: sc.y, age: d.age, isPlayer: d.isPlayer, isCrit: d.isCrit };
    });

    const boss = this.enemies.find((e) => e.id === this.bossEnemyId && e.state !== "dead" && e.state !== "death");
    const w = getWallet();
    this.onStateUpdate({
      playerHp: Math.round(this.playerHp),
      playerMaxHp: this.playerMaxHp,
      playerMana: Math.round(this.playerMana),
      playerMaxMana: this.playerMaxMana,
      playerLevel: this.playerLevel,
      playerXp: this.playerXp,
      playerAttackCooldown: Math.max(0, this.playerAttackCooldown / this.playerMaxAttackCooldown),
      enemies: enemyUI.map((e) => ({ ...e, isBoss: e.id === this.bossEnemyId })),
      damageNumbers: dmgUI,
      combatLog: [...this.combatLog],
      zone: `Round ${this.islandRound} · Pirate Island · seed ${this.mapSeed.toString(16)}`,
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
    });
  }

  private onResize = () => {
    if (!this.container) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    const aspect = w / h;
    const d = 18;
    this.camera.left = -d * aspect;
    this.camera.right = d * aspect;
    this.camera.top = d;
    this.camera.bottom = -d;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.bloom?.composer.setSize(w, h);
    this.bloom?.bloomPass.resolution.set(w, h);
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.animFrameId);
    window.removeEventListener("resize", this.onResize);
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
    this.bloom?.composer.dispose();
    this.bloom = null;
    this.renderer.dispose();
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
