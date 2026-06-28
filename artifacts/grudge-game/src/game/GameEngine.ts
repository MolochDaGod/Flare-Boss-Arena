import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { createEnemyModel, updateEnemyAnimation, makeAnimState, archetypeFor, type EnemyModel, type AnimState } from "./EnemyFactory";
import { isMonsterId, loadMonsterModel, disposeMonsterModel, ANIMATED_MONSTER_TEMPLATES } from "./MonsterModels";
import { isKitMonsterId, loadKitMonster, disposeKitModel, KIT_TEMPLATES } from "./KayKitCharacter";
import { makeGroundMaterial, makeRockField, makeTerrainSkirt } from "./proceduralTextures";
import { buildOrcCamp, type CampHandle } from "./CampBuilder";
import { PIRATE_DEFS, loadPirate, disposePirate, disposeGltfObject, type PirateHandle } from "./PirateNPC";
import { Townsperson } from "./Townsfolk";
import { PlayerAnimator, buildAuthoredClips, pickSkinClips } from "./PlayerAnimator";
import { DungeonMap } from "./DungeonMap";
import { PORTRAIT_URL, resolveVisibleMeshes, type RaceId } from "../data/characterMeshes";
import { getSkin, skinUrl, type SkinDef } from "../data/skins";
import { RACALVIN_ID } from "../data/fighters";
import { loadRacalvinForDungeon } from "./racalvinHero";
import { skillAnimCandidates } from "./kaykitHero";
import { SkillVfx } from "./skillVfx";
import type { ClassSkill } from "../data/classSkills";
import { archetypeForSkill } from "./combat/skillArchetypes";
import { targetsInShape, type ShapeQuery } from "./combat/damageShapes";
import type { CombatTarget } from "./combat/types";
import { ParticleVfx } from "./combat/particles";
import { TelegraphField } from "./combat/telegraphs";
import { DeployableManager } from "./combat/deployables";
import { FlameVfx } from "./combat/FlameVfx";
import { makeBloomComposer, type BloomComposer } from "./combat/bloom";

const OBJECTSTORE_BASE = "https://molochdagod.github.io/ObjectStore";

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

export interface GameState {
  playerHp: number;
  playerMaxHp: number;
  playerMana: number;
  playerMaxMana: number;
  playerLevel: number;
  playerXp: number;
  playerAttackCooldown: number;
  enemies: Array<{ id: string; name: string; hp: number; maxHp: number; screenX: number; screenY: number; tier: number }>;
  damageNumbers: Array<{ id: string; value: number; x: number; y: number; age: number; isPlayer: boolean; isCrit: boolean }>;
  combatLog: string[];
  zone: string;
  loaded: boolean;
  /** True once the dungeon GLB + collision BVH are built (or load failed). */
  mapReady: boolean;
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
  private flameVfx!: FlameVfx;
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
  private coveLabel: THREE.Sprite | null = null;
  private coveCenter = new THREE.Vector3(70, 0, -14);
  private disposed = false;
  private hoveredEnemy: EnemyInstance | null = null;
  private hoverEmissive = new Map<THREE.MeshStandardMaterial, { hex: number; intensity: number }>();
  private _moveHandler!: (e: MouseEvent) => void;
  private _downHandler!: (e: MouseEvent) => void;
  private _upHandler!: (e: MouseEvent) => void;
  private _contextHandler!: (e: MouseEvent) => void;

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
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    // Filmic tone mapping for richer contrast across the larger lit map.
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    container.appendChild(this.renderer.domElement);

    this.clock = new THREE.Clock();
    this.loader = new GLTFLoader();
    this.skillVfx = new SkillVfx(this.scene, this.loader);
    this.particles = new ParticleVfx(this.scene);
    this.telegraphs = new TelegraphField(this.scene);
    this.deployables = new DeployableManager(this.scene);
    this.flameVfx = new FlameVfx(this.scene);
    // Selective bloom so the additive flame VFX glow without washing out the
    // dark scene. Null (graceful fallback to direct render) if setup fails headless.
    this.bloom = makeBloomComposer(this.renderer, this.scene, this.camera, w, h);

    this.buildDungeon();
    this.loadEnvironment();
    this.camp = buildOrcCamp(this.loader, this.scene, `${import.meta.env.BASE_URL}models/buildings/orc_camp_set.glb`);
    this.buildPirateCove();
    this.setupLighting();
    this.loadPlayerModel();
    this.spawnInitialEnemies();
    this.setupInput(container);

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

    // Hundreds of scattered rocks in a single InstancedMesh draw call (fills
    // the now-much-larger map without tanking performance).
    const rocks = makeRockField(220, D * 0.35, D - 4);
    this.scene.add(rocks);
    this.rockField = rocks;

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
   * Load the forge dungeon GLB (~5.6 MB, 822 meshes, Synty SD_* asset pack)
   * from `public/models/forge-scene.glb`, recenter its XZ bbox to the origin,
   * scale it to fit the playable area (DUNGEON*2), drop it so the floor sits
   * at y=0, and enable shadow casting/receiving on every mesh.
   */
  private loadEnvironment() {
    const url = `${import.meta.env.BASE_URL}models/forge-scene.glb`;
    // The forge GLB IS the dungeon now: scaled up, walkable, with real floor +
    // wall colliders (BVH). It stays centered at the origin so the orc camp and
    // pirate cove ring it. DungeonMap fires onReady on success OR failure so any
    // loading veil can clear, and gameplay falls back to the flat plane until
    // the BVH is built.
    this.dungeonMap = new DungeonMap({ targetExtent: 130 });
    this.dungeonMap.load(this.loader, this.scene, url, () => {
      this.mapReady = true;
      this.onMapReady?.();
      this.notifyState();
    });
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
    // Boat assistance: a docked ship as the cove landmark + a jetty + loot.
    this.loadCoveProp("world/Ship_Small.gltf", new THREE.Vector3(c.x + 7, 0, c.z - 4), 16, Math.PI * 0.18);
    this.loadCoveProp("world/Environment_Dock.gltf", new THREE.Vector3(c.x + 1, 0, c.z), 11, 0);
    this.loadCoveProp("world/Prop_Chest_Gold.gltf", new THREE.Vector3(c.x - 2.5, 0, c.z + 2.5), 1.3, 0.6);
    this.loadCoveProp("world/Prop_Barrel.gltf", new THREE.Vector3(c.x - 3.5, 0, c.z + 1), 1.1, 0);
    this.loadCoveProp("world/Prop_Anchor.gltf", new THREE.Vector3(c.x - 1.5, 0, c.z + 3.5), 1.4, -0.4);

    // Three neutral pirate allies standing around the cove.
    const trio = PIRATE_DEFS.slice(0, 3);
    trio.forEach((def, i) => {
      const angle = (i / trio.length) * Math.PI * 0.8 - Math.PI * 0.4;
      const px = c.x - 2 + Math.cos(angle) * 3.2;
      const pz = c.z + 2 + Math.sin(angle) * 3.2;
      const handle = loadPirate(def, this.loader);
      handle.group.position.set(px, 0, pz);
      handle.group.rotation.y = Math.atan2(-px, -pz); // face the map centre
      handle.group.userData.waveTimer = 1.5 + Math.random() * 4;
      this.scene.add(handle.group);
      this.pirates.push(handle);
    });

    this.addCoveLabel(new THREE.Vector3(c.x + 1, 4.6, c.z));

    this.buildTownsfolk();
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
        const clips = pickSkinClips(gltf.animations, skin.scheme);
        this.finalizePlayer(wrapper, new PlayerAnimator(model, clips, gltf.animations));
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

    for (const { template, count } of configs) {
      for (let i = 0; i < count; i++) {
        const D = this.DUNGEON - 3;
        let x = 0, z = 0;
        let attempts = 0;
        do {
          x = (Math.random() * 2 - 1) * D;
          z = (Math.random() * 2 - 1) * D;
          attempts++;
        } while (Math.sqrt(x * x + z * z) < 6 && attempts < 20);
        this.createEnemy(template, new THREE.Vector3(x, 0, z));
      }
    }
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
      aggroRange: 6.5 + template.tier * 0.6,
      attackRange: 1.8 + template.tier * 0.2 + (model.archetype === "dragon" || model.archetype === "golem" ? 1.2 : 0),
      speed: model.archetype === "flying" ? 3.5 : model.archetype === "golem" ? 1.6 : model.archetype === "dragon" ? 2.4 : 2.4 + template.tier * 0.35,
    };

    // Make every mesh under the enemy carry the enemyId for raycast hits
    model.group.traverse((c) => { c.userData.enemyId = id; });

    this.enemies.push(enemy);
    return enemy;
  }

  private setupInput(container: HTMLDivElement) {
    container.setAttribute("tabIndex", "0");
    container.focus();

    this._keyDownHandler = (e: KeyboardEvent) => {
      this.keys.add(e.code);
      if (e.code === "KeyF" || e.code === "Space") {
        e.preventDefault();
        this.attackNearest();
      }
      const n = Number(e.key);
      if (n >= 1 && n <= 5) {
        e.preventDefault();
        this.useSkill(n - 1);
      }
    };
    this._keyUpHandler = (e: KeyboardEvent) => this.keys.delete(e.code);
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

    // Click-to-move: pick the real dungeon floor when the BVH is ready, else
    // fall back to the flat plane.
    const pt = this.dungeonMap?.ready
      ? this.dungeonMap.floorPickFromRay(this.raycaster.ray)
      : (this.raycaster.intersectObject(this.floorPlane)[0]?.point ?? null);
    if (pt) {
      this.clampToArena(pt);
      this.playerTarget = new THREE.Vector3(pt.x, 0, pt.z);
      this.targetEnemy = null;
      if (this.indicatorRing) {
        // Seat the marker on the actually-picked surface (pt.y from the ray hit).
        this.indicatorRing.position.set(this.playerTarget.x, pt.y + 0.08, this.playerTarget.z);
        this.indicatorRing.visible = true;
      }
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
    if (nearest && nearestDist < 4.5) this.doAttack(nearest);
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

  /** Apply skill/deployable damage to one enemy (tier mitigation, damage number,
   *  hurt/death). Marks state dirty so off-cast hits refresh the HUD once/frame. */
  private damageEnemy(en: EnemyInstance, amount: number, isCrit: boolean) {
    if (en.state === "dead" || en.state === "death") return;
    const dmg = Math.max(1, Math.floor(amount) - Math.floor(en.template.tier * 2));
    en.hp = Math.max(0, en.hp - dmg);
    const wp = en.model.group.position.clone();
    wp.y += en.model.height * 0.7;
    this.damageNumbers.push({ id: `d${this.idCounter++}`, value: dmg, worldPos: wp, age: 0, isPlayer: false, isCrit });
    this.particles?.impact(wp, isCrit ? 0xffd54a : 0xff7a1e);
    this.flameVfx?.burst(wp, {
      kind: "fire",
      color: isCrit ? 0xffd54a : 0xff7a1e,
      big: isCrit,
      scale: isCrit ? 0.85 : 0.6,
    });
    if (en.hp <= 0) {
      this.killEnemy(en);
    } else {
      en.anim.hurtPhase = 1;
      en.state = "hurt";
      en.hurtTimer = 0.4;
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
    this.playerAttackCooldown = this.playerMaxAttackCooldown;

    const origin = this.playerPos.clone();

    if (arch.shape === "deployable") {
      const dep = arch.deployable ?? "fire_totem";
      const place = origin.clone().add(dir.clone().multiplyScalar(arch.range));
      this.clampToArena(place);
      this.deployables.deploy(dep, place, arch.color, this.playerBaseDamage * arch.damageMult, arch.radius ?? 4);
      this.particles?.fireColumn(place.clone().setY(0.3), arch.color);
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

    // Keep the GLB tornado/cloud flavor + add a particle accent at the strike point.
    const reach = arch.radius ?? arch.length ?? 4;
    const center = origin.clone().add(dir.clone().multiplyScalar(reach * 0.5));
    this.spawnSkillVfx(center, idx, isCast);
    this.flameVfx?.burst(center.clone().setY(0.6), {
      kind: "fire",
      color: arch.color,
      big: true,
      scale: isCast ? 1.25 : 1.0,
    });
    if (arch.shape === "nova" || arch.shape === "circle") {
      this.particles?.nova(center.clone().setY(0.4), reach, arch.color);
    } else {
      this.particles?.impact(center.clone().setY(0.6), arch.color, 1.1);
    }

    const hits = targetsInShape(q, this.enemies, (en) => en.state !== "dead" && en.state !== "death");
    for (const en of hits) {
      const isCrit = Math.random() < this.playerCritChance + 0.05;
      const raw = this.playerBaseDamage * arch.damageMult * (0.85 + Math.random() * 0.3) * (isCrit ? 1.75 : 1);
      this.damageEnemy(en, raw, isCrit);
    }
    this.notifyState();
  }

  /** Map a skill slot to a VFX and spawn it at the strike point. Cast slots
   *  spawn a cloud ring (push/knockback); melee slots spawn a fire tornado. */
  private spawnSkillVfx(pos: THREE.Vector3, idx: number, isCast: boolean) {
    if (isCast) {
      this.skillVfx.spawn("cloud", pos, 4, 1.1);
    } else {
      this.skillVfx.spawn("tornado", pos, idx === 4 ? 4.5 : 3, 1.3);
    }
  }

  private doAttack(enemy: EnemyInstance) {
    if (this.playerAttackCooldown > 0) return;
    if (enemy.state === "dead" || enemy.state === "death") return;

    const dist = this.playerPos.distanceTo(enemy.position);
    if (dist > 4.0) {
      this.playerTarget = enemy.position.clone();
      return;
    }

    const base = this.playerBaseDamage;
    const variance = 0.8 + Math.random() * 0.4;
    const isCrit = Math.random() < this.playerCritChance;
    const rawDmg = Math.max(1, Math.floor(base * variance * (isCrit ? 1.75 : 1)));
    const dmg = Math.max(1, rawDmg - Math.floor(enemy.template.tier * 2));

    enemy.hp = Math.max(0, enemy.hp - dmg);
    this.playerAttackCooldown = this.playerMaxAttackCooldown;

    // Face the enemy
    const dx = enemy.position.x - this.playerPos.x;
    const dz = enemy.position.z - this.playerPos.z;
    this.playerFacing = Math.atan2(dx, dz);

    this.playerAnimator?.triggerAttack();

    const wp = enemy.model.group.position.clone();
    wp.y += enemy.model.height * 0.7;
    this.damageNumbers.push({ id: `d${this.idCounter++}`, value: dmg, worldPos: wp, age: 0, isPlayer: false, isCrit });

    this.log(`You hit ${enemy.template.name} for ${dmg}${isCrit ? " CRIT!" : ""}`);

    if (enemy.hp <= 0) {
      this.killEnemy(enemy);
    } else {
      enemy.anim.hurtPhase = 1;
      enemy.state = "hurt";
      enemy.hurtTimer = 0.4;
    }
    this.notifyState();
  }

  private killEnemy(enemy: EnemyInstance) {
    enemy.hp = 0;
    enemy.state = "death";
    enemy.anim.deathPhase = 0.01;  // trigger death animation
    if (this.targetEnemy === enemy) this.targetEnemy = null;
    if (this.hoveredEnemy === enemy) {
      this.clearHover();
      this.hoveredEnemy = null;
    }

    const xp = enemy.template.tier * 50 + 25;
    this.playerXp += xp;
    this.log(`${enemy.template.name} defeated! +${xp} XP`);

    setTimeout(() => {
      enemy.state = "dead";
      this.scene.remove(enemy.model.group);
      enemy.model.group.userData.disposed = true;
      if (enemy.model.kit) {
        disposeKitModel(enemy.model);
      } else if (enemy.model.isGLB) {
        // Thorough GLB cleanup (mixer + geometry + materials + textures), and
        // releases resources even if the GLB is still streaming in.
        disposeMonsterModel(enemy.model);
      } else {
        enemy.model.group.traverse((c) => {
          const mesh = c as THREE.Mesh;
          if (mesh.geometry) mesh.geometry.dispose();
        });
        for (const mat of enemy.model.bodyMats) mat.dispose();
      }
    }, 1400);

    setTimeout(() => {
      const idx = this.enemies.indexOf(enemy);
      if (idx !== -1) this.enemies.splice(idx, 1);
      const spawnPos = enemy.spawnPos.clone();
      spawnPos.x += (Math.random() - 0.5) * 4;
      spawnPos.z += (Math.random() - 0.5) * 4;
      this.createEnemy(enemy.template, spawnPos);
    }, 14000);
  }

  private takeDamage(amount: number, source: string) {
    const mitigated = Math.max(1, amount - Math.floor(this.playerDefense * 0.5));
    this.playerHp = Math.max(0, this.playerHp - mitigated);
    const wp = this.playerPos.clone();
    wp.y += 2.5;
    this.damageNumbers.push({ id: `d${this.idCounter++}`, value: mitigated, worldPos: wp, age: 0, isPlayer: true, isCrit: false });
    this.log(`${source} hits you for ${mitigated}`);
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
  };

  private update(delta: number) {
    const elapsed = this.clock.getElapsedTime();

    if (this.playerAttackCooldown > 0) this.playerAttackCooldown -= delta;

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
      if (locked) {
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

    // Resolve the freshly-moved player against the real dungeon geometry.
    this.resolvePlayer();

    if (this.playerGroup) {
      const targetPos = new THREE.Vector3(this.playerPos.x, this.playerPos.y, this.playerPos.z);
      this.playerGroup.position.lerp(targetPos, 0.35);
      // Shortest-arc turn toward facing — avoids the long way around at ±π.
      let dy = this.playerFacing - this.playerGroup.rotation.y;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      this.playerGroup.rotation.y += dy * 0.25;
    }

    // Drive locomotion + attack animation from movement state.
    if (this.playerAnimator) {
      this.playerAnimator.setMoving(playerMoving);
      this.playerAnimator.update(delta);
    } else if (this.playerMixer) {
      this.playerMixer.update(delta);
    }

    this.skillVfx.update(delta);
    this.flameVfx?.update(delta);
    this.particles?.update(delta);
    this.telegraphs?.update(delta);
    this.deployables?.update(delta, {
      targets: this.enemyTargets(),
      particles: this.particles,
      telegraphs: this.telegraphs,
      log: (m) => this.log(m),
    });

    // Neutral pirate allies at the cove: idle anim, plus turn-to-face and an
    // occasional wave when the player wanders close.
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

    if (this.playerHp < this.playerMaxHp) {
      this.playerHp = Math.min(this.playerMaxHp, this.playerHp + delta * 6);
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

    if (en.state !== "hurt" && en.state !== "death") {
      if (distToPlayer < en.aggroRange) {
        // Face the player
        const dx = this.playerPos.x - en.position.x;
        const dz = this.playerPos.z - en.position.z;
        en.facing = Math.atan2(dx, dz);

        if (distToPlayer <= en.attackRange) {
          en.state = "attack";
          if (en.attackCooldown <= 0) {
            en.anim.isAttacking = true;
            const dmg = Math.floor(en.template.damage * (0.85 + Math.random() * 0.3));
            this.takeDamage(dmg, en.template.name);
            en.attackCooldown = 1.8 + Math.random() * 0.6;
          }
        } else {
          en.state = "chase";
          const dir = new THREE.Vector3().subVectors(this.playerPos, en.position).normalize();
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
      combatLog: [...this.combatLog],
      zone: "Grudge Dungeon — Starter Island",
      loaded: this.loaded,
      mapReady: this.mapReady,
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
    this.playerAnimator?.dispose();
    this.skillVfx?.dispose();
    this.flameVfx?.dispose();
    this.particles?.dispose();
    this.telegraphs?.dispose();
    this.deployables?.dispose();
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
