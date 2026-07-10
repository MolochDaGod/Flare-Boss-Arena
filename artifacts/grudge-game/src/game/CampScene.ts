import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  disposeObject3D,
  loadActiveFighterModel,
  skillAnimCandidates,
  type HeroLike,
} from "./kaykitHero";
import { Townsperson } from "./Townsfolk";
import { SkillVfx } from "./skillVfx";
import { archetypeForSkill } from "./combat/skillArchetypes";
import { pointInShape, type ShapeQuery } from "./combat/damageShapes";
import { TelegraphField } from "./combat/telegraphs";
import { ParticleVfx } from "./combat/particles";
import { makeBloomComposer, type BloomComposer } from "./combat/bloom";
import type { ClassSkill } from "../data/classSkills";
import { CAMP_PROP_PLACEMENTS } from "../data/worldProps";
import { loadWorldProp, disposeWorldProp, type LoadedWorldProp } from "./WorldPropLoader";
import { canDodge } from "./combatInput";
import {
  CAMP_BOUNDS,
  CAMP_STATION_BY_ID,
  campStationMarkers,
  type CampStationCategory,
} from "../data/campTown";
import { CAMP_TILEABLE_FLOOR, CAMP_TILEABLE_SCATTER } from "../data/tileablePixelPack";
import { buildTileableCamp, type TileablePackHandle } from "./TileablePackLoader";

export type CampStationId =
  | "anvil"
  | "skills"
  | "stats"
  | "quests"
  | "stash"
  | "portal_dungeon"
  | "portal_boss"
  | "perk_machines"
  | "gumball"
  | "perk_firebug"
  | "perk_medic"
  | "perk_support"
  | "perk_gunslinger"
  | "weapon_panel";

export interface CampStation {
  id: CampStationId;
  label: string;
  hint: string;
  position: THREE.Vector3;
  color: number;
  group: THREE.Group;
  glow: THREE.PointLight;
}

/** A training-yard target the player can attack to test moves. */
export interface CampDummyState {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  screenX: number;
  screenY: number;
  alive: boolean;
}

export interface CampDamageNumber {
  id: number;
  x: number;
  y: number;
  value: number;
  isCrit: boolean;
  isPlayer: boolean;
  age: number;
}

export interface CampMapMarker {
  id: string;
  nx: number;
  nz: number;
  color: number;
  category: CampStationCategory;
}

export interface CampStateUpdate {
  nearbyStationId: CampStationId | null;
  nearbyStationLabel: string | null;
  nearbyStationHint: string | null;
  nearbyStationCategory: CampStationCategory | null;
  nearbyStationDistrict: string | null;
  nearbyStationAction: string | null;
  playerMapX: number;
  playerMapZ: number;
  mapMarkers: CampMapMarker[];
  promptKey: string;
  loaded: boolean;
  // ── Combat / testing-ground state ──
  playerHp: number;
  playerMaxHp: number;
  playerMana: number;
  playerMaxMana: number;
  playerLevel: number;
  attackCooldownPct: number;
  skillCooldownPct: number[];
  dummies: CampDummyState[];
  damageNumbers: CampDamageNumber[];
  combatLog: string[];
}

export interface CampSceneOptions {
  className?: string;
  raceKey?: string;
  /** Player combat numbers (sensible defaults applied when omitted). */
  level?: number;
  maxHp?: number;
  maxMana?: number;
  baseDamage?: number;
  critChance?: number;
  /** Mana cost + cooldown (s) for each of the up-to-5 skill slots. */
  skillCount?: number;
  onStateUpdate?: (s: CampStateUpdate) => void;
  onStationEngage?: (id: CampStationId) => void;
}

interface CampDummy {
  id: string;
  name: string;
  group: THREE.Group;
  pos: THREE.Vector3;
  hp: number;
  maxHp: number;
  alive: boolean;
  flash: number; // hit-flash timer
  deadT: number; // time since death (for respawn)
  mats: THREE.MeshStandardMaterial[];
  baseColors: number[];
}

interface CampVfx {
  mesh: THREE.Mesh;
  life: number;
  max: number;
  grow: number;
}

export class CampScene {
  private container: HTMLElement | null = null;
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.OrthographicCamera;
  private bloom: BloomComposer | null = null;
  private clock = new THREE.Clock();
  private animFrameId = 0;
  private skillVfx!: SkillVfx;
  private telegraphs!: TelegraphField;
  private particles!: ParticleVfx;
  /** Resolved HUD skills for archetype mapping; idx fallback works if unset. */
  private hudSkills: (ClassSkill | undefined)[] = [];

  private playerGroup: THREE.Group | null = null;
  private heroAnim: HeroLike | null = null;
  private playerPos = new THREE.Vector3(0, 0, 6);
  private _rmTmp = new THREE.Vector3();
  private playerTarget: THREE.Vector3 | null = null;
  private playerFacing = 0;
  private playerSpeed = 6;
  private lastDodgeAt = 0;

  private stations: CampStation[] = [];
  private campfireLight!: THREE.PointLight;
  private campfireMesh!: THREE.Mesh;
  private embers: { mesh: THREE.Mesh; vel: THREE.Vector3; life: number; max: number }[] = [];

  // ── Ambient townsfolk (KayKit heroes, non-targetable) ──
  private townsfolk: Townsperson[] = [];

  // ── Perk machines, collectable symbols, environment props ──
  private worldProps: LoadedWorldProp[] = [];
  private propLoader = new GLTFLoader();

  // ── Combat / testing-ground ──
  private dummies: CampDummy[] = [];
  private vfx: CampVfx[] = [];
  private attackTarget: CampDummy | null = null;
  private attackCdT = 0;
  private readonly attackInterval = 0.85;
  private readonly attackRange = 2.6;
  private playerHp = 600;
  private playerMaxHp = 600;
  private playerMana = 220;
  private playerMaxMana = 220;
  private playerLevel = 1;
  private baseDamage = 32;
  private critChance = 0.12;
  private skillCdUntil: number[] = [0, 0, 0, 0, 0];
  private skillCdLen: number[] = [4, 5, 6, 7, 8];
  private skillManaCost = [18, 24, 30, 36, 42];
  private damageNumbers: CampDamageNumber[] = [];
  private dmgId = 0;
  private combatLog: string[] = [];

  private keys = new Set<string>();
  private currentNearbyId: CampStationId | null = null;
  private loaded = false;
  private disposed = false;
  private stateAccum = 0;
  private readonly stateInterval = 1 / 30; // throttle HUD updates to ~30 Hz

  private readonly STATION_RADIUS = 6.2; // engage marker (doorway) distance from centre
  private readonly BUILDING_RADIUS = 9.2; // building distance from centre
  private readonly BOUNDS = 18;

  private options: CampSceneOptions;
  private _engaged = false;
  private tileableHandle: TileablePackHandle | null = null;

  constructor(options: CampSceneOptions = {}) {
    this.options = options;
    this.playerLevel = options.level ?? 1;
    this.playerMaxHp = options.maxHp ?? 400 + this.playerLevel * 40;
    this.playerHp = this.playerMaxHp;
    this.playerMaxMana = options.maxMana ?? 150 + this.playerLevel * 15;
    this.playerMana = this.playerMaxMana;
    this.baseDamage = options.baseDamage ?? 28 + this.playerLevel * 4;
    this.critChance = options.critChance ?? 0.12;
  }

  init(container: HTMLElement) {
    this.container = container;
    const w = container.clientWidth;
    const h = container.clientHeight;
    const aspect = w / h;
    const d = 11;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x05050a);
    this.scene.fog = new THREE.FogExp2(0x06060c, 0.025);
    this.skillVfx = new SkillVfx(this.scene, new GLTFLoader());
    this.telegraphs = new TelegraphField(this.scene);
    this.particles = new ParticleVfx(this.scene);

    this.camera = new THREE.OrthographicCamera(-d * aspect, d * aspect, d, -d, 0.1, 200);
    this.camera.position.set(18, 18, 18);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.95;
    container.appendChild(this.renderer.domElement);
    this.bloom = makeBloomComposer(this.renderer, this.scene, this.camera, w, h);

    this.buildEnvironment();
    this.buildTileableWorld();
    this.buildStations();
    this.loadTown();
    this.buildWorldProps();
    this.buildCampfire();
    this.buildDummies();
    this.buildTownsfolk();
    this.loadPlayer();
    this.emitState();

    window.addEventListener("resize", this.onResize);
    window.addEventListener("keydown", this._keyDown);
    window.addEventListener("keyup", this._keyUp);
    container.addEventListener("click", this._click);

    this.animFrameId = requestAnimationFrame(this.animate);
  }

  private buildEnvironment() {
    const moon = new THREE.HemisphereLight(0x6a78a8, 0x0a0a14, 0.45);
    this.scene.add(moon);
    const moonDir = new THREE.DirectionalLight(0x8caaff, 0.35);
    moonDir.position.set(-15, 20, -10);
    this.scene.add(moonDir);

    // Dark underlay — visible until the tileable floor grid streams in.
    const floorGeom = new THREE.CircleGeometry(this.BOUNDS, 64);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x0e0c0a,
      roughness: 1,
      metalness: 0,
    });
    const floor = new THREE.Mesh(floorGeom, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.02;
    floor.receiveShadow = true;
    this.scene.add(floor);
  }

  /** Modular grass/stone floor, trees, rocks, walls, and town-upgrade buildings. */
  private buildTileableWorld() {
    const loader = new GLTFLoader();
    this.tileableHandle = buildTileableCamp(loader, this.scene, {
      floor: { ...CAMP_TILEABLE_FLOOR, bounds: this.BOUNDS },
      scatter: CAMP_TILEABLE_SCATTER,
    });
  }

  private buildCampfire() {
    // Stone ring base
    const baseGeom = new THREE.TorusGeometry(0.9, 0.25, 8, 24);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x222018, roughness: 1 });
    const base = new THREE.Mesh(baseGeom, baseMat);
    base.rotation.x = Math.PI / 2;
    base.position.y = 0.2;
    this.scene.add(base);

    // Logs (cross)
    const logMat = new THREE.MeshStandardMaterial({ color: 0x3a2410, roughness: 0.9 });
    for (let i = 0; i < 3; i++) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 1.4, 8), logMat);
      log.rotation.z = Math.PI / 2;
      log.rotation.y = (i / 3) * Math.PI;
      log.position.y = 0.3 + i * 0.06;
      log.castShadow = true;
      this.scene.add(log);
    }

    // Flame core (animated emissive)
    const flameMat = new THREE.MeshBasicMaterial({ color: 0xffaa33, transparent: true, opacity: 0.85 });
    this.campfireMesh = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 12), flameMat);
    this.campfireMesh.position.y = 0.8;
    this.campfireMesh.scale.set(1, 1.5, 1);
    this.scene.add(this.campfireMesh);

    const inner = new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 12, 10),
      new THREE.MeshBasicMaterial({ color: 0xffe6a0, transparent: true, opacity: 0.95 }),
    );
    inner.position.y = 0.85;
    inner.scale.set(1, 1.4, 1);
    this.scene.add(inner);
    (this.campfireMesh.userData as { inner: THREE.Mesh }).inner = inner;

    this.campfireLight = new THREE.PointLight(0xff9c44, 6, 18, 1.8);
    this.campfireLight.position.set(0, 1.4, 0);
    this.campfireLight.castShadow = true;
    this.scene.add(this.campfireLight);
  }

  // ── Training dummies ──────────────────────────────────────────────────────
  private buildDummies() {
    const spots: { x: number; z: number; name: string }[] = [
      { x: -3.2, z: 3.4, name: "Training Dummy" },
      { x: 0, z: 4.2, name: "Straw Knight" },
      { x: 3.2, z: 3.4, name: "Practice Post" },
    ];
    spots.forEach((s, i) => this.dummies.push(this.makeDummy(`dummy_${i}`, s.name, s.x, s.z)));
  }

  // ── Ambient townsfolk ─────────────────────────────────────────────────────
  /** Populate the training-ground town with neutral KayKit NPCs that idle and
   *  wander. They carry no `enemyId`, so they can never be targeted or hit. */
  private buildTownsfolk() {
    const loader = new GLTFLoader();
    const anchors: { x: number; z: number; model?: string }[] = [
      { x: -7.5, z: -2.0, model: "Knight" },
      { x: 6.8, z: -3.5, model: "Mage" },
      { x: -5.0, z: 6.5, model: "Ranger" },
      { x: 5.5, z: 6.0, model: "Rogue" },
      { x: 8.0, z: 2.0, model: "Barbarian" },
    ];
    for (const a of anchors) {
      const t = new Townsperson(loader, {
        home: new THREE.Vector3(a.x, 0, a.z),
        model: a.model,
        height: 1.8,
        wanderRadius: 2.6,
      });
      this.scene.add(t.group);
      this.townsfolk.push(t);
    }
  }

  private makeDummy(id: string, name: string, x: number, z: number): CampDummy {
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    const mats: THREE.MeshStandardMaterial[] = [];
    const postMat = new THREE.MeshStandardMaterial({ color: 0x4a3520, roughness: 0.9 });
    const strawMat = new THREE.MeshStandardMaterial({ color: 0xb8924a, roughness: 0.95 });
    mats.push(postMat, strawMat);

    // Central post
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 2.0, 8), postMat);
    post.position.y = 1.0;
    post.castShadow = true;
    group.add(post);

    // Straw body
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.7, 6, 12), strawMat);
    body.position.y = 1.35;
    body.castShadow = true;
    group.add(body);

    // Head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), strawMat);
    head.position.y = 2.05;
    head.castShadow = true;
    group.add(head);

    // Cross-arms
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.5, 6), postMat);
    arm.rotation.z = Math.PI / 2;
    arm.position.y = 1.5;
    group.add(arm);

    // Target ring band
    const band = new THREE.Mesh(
      new THREE.TorusGeometry(0.45, 0.06, 8, 20),
      new THREE.MeshStandardMaterial({ color: 0x8a1a1a, roughness: 0.7, emissive: 0x300000 }),
    );
    band.position.y = 1.35;
    band.rotation.x = Math.PI / 2;
    group.add(band);

    // Base
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 0.2, 10), postMat);
    base.position.y = 0.1;
    base.receiveShadow = true;
    group.add(base);

    group.traverse((c) => {
      (c as THREE.Mesh).userData.dummyId = id;
    });
    group.userData.dummyId = id;

    this.scene.add(group);

    return {
      id,
      name,
      group,
      pos: new THREE.Vector3(x, 0, z),
      hp: 500,
      maxHp: 500,
      alive: true,
      flash: 0,
      deadT: 0,
      mats,
      baseColors: mats.map((mm) => mm.color.getHex()),
    };
  }

  private addStation(def: {
    id: CampStationId;
    label: string;
    hint: string;
    angleDeg: number;
    color: number;
  }): CampStation {
    const { id, label, hint, angleDeg, color } = def;
    const a = (angleDeg * Math.PI) / 180;
    // The engage marker sits at the building's doorway (toward camp centre).
    const x = Math.cos(a) * this.STATION_RADIUS;
    const z = Math.sin(a) * this.STATION_RADIUS;

    const group = new THREE.Group();
    group.position.set(x, 0, z);

    // Glowing ground pad (pulses) marking where to stand.
    const ringMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.85, 1.25, 32), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.06;
    group.add(ring);
    (group.userData as { ring: THREE.Mesh }).ring = ring;

    // Floating interaction glyph hovering over the pad.
    const glyphMat = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.9,
      roughness: 0.35,
      metalness: 0.6,
    });
    const glyph = new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 0), glyphMat);
    glyph.position.y = 1.5;
    glyph.castShadow = true;
    group.add(glyph);

    // Floating label sprite above the doorway.
    const labelTex = this.makeLabelTexture(label.toUpperCase());
    const labelMat = new THREE.SpriteMaterial({ map: labelTex, transparent: true, depthTest: false });
    const labelSprite = new THREE.Sprite(labelMat);
    labelSprite.position.y = 3.0;
    labelSprite.scale.set(2.8, 0.7, 1);
    group.add(labelSprite);

    const glow = new THREE.PointLight(color, 1.6, 9, 2);
    glow.position.y = 1.8;
    group.add(glow);

    this.scene.add(group);

    const station: CampStation = {
      id,
      label,
      hint,
      position: new THREE.Vector3(x, 0, z),
      color,
      group,
      glow,
    };
    this.stations.push(station);
    return station;
  }

  /**
   * Each camp interaction is hosted by a different building of the fishing town.
   * `building` is the GLB node name extracted by {@link loadTown}; angles fan the
   * houses around the camp centre.
   */
  private readonly STATION_DEFS: {
    id: CampStationId;
    label: string;
    hint: string;
    angleDeg: number;
    color: number;
    building: string;
  }[] = [
    { id: "stash", label: "Stash", hint: "Manage and equip your gear.", angleDeg: -90, color: 0x66ddaa, building: "bank_9" },
    { id: "skills", label: "Skill Obelisk", hint: "Allocate skill points across your trees.", angleDeg: -38.6, color: 0x44aaff, building: "guild_51" },
    { id: "stats", label: "Soul Altar", hint: "Distribute attribute points.", angleDeg: 12.9, color: 0xaa44ff, building: "guild.001_49" },
    { id: "quests", label: "War Board", hint: "Review boss intel and active hunts.", angleDeg: 64.3, color: 0xffcc33, building: "bar_25" },
    { id: "anvil", label: "Forge", hint: "Craft & repair weapons and armor.", angleDeg: 115.7, color: 0xff7733, building: "house_59" },
    { id: "portal_dungeon", label: "Dungeon Gate", hint: "Enter the infinite dungeon.", angleDeg: 167.1, color: 0xff4422, building: "house.001_67" },
    { id: "portal_boss", label: "Boss Sigil", hint: "Challenge a generated boss.", angleDeg: 218.6, color: 0xff22aa, building: "house.002_75" },
  ];

  private buildStations() {
    for (const def of this.STATION_DEFS) this.addStation(def);
  }

  /** Perk machines, gumball, weapon panel, trenches — from `worldProps` catalog. */
  private buildWorldProps() {
    for (const place of CAMP_PROP_PLACEMENTS) {
      const loaded = loadWorldProp(place.propId, this.propLoader, {
        position: new THREE.Vector3(place.x, 0, place.z),
        rotationY: place.rotY,
      });
      this.scene.add(loaded.holder);
      this.worldProps.push(loaded);

      if (place.stationId && place.label && place.hint && place.color != null) {
        this.addStationAt(place.x, place.z, {
          id: place.stationId as CampStationId,
          label: place.label,
          hint: place.hint,
          color: place.color,
        });
      }
    }
  }

  /** Interaction pad at an explicit world position (perk alley / props). */
  private addStationAt(
    x: number,
    z: number,
    def: { id: CampStationId; label: string; hint: string; color: number },
  ): CampStation {
    const { id, label, hint, color } = def;
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    const ringMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.75, 1.1, 32), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.06;
    group.add(ring);
    (group.userData as { ring: THREE.Mesh }).ring = ring;

    const glyphMat = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.85,
      roughness: 0.35,
      metalness: 0.6,
    });
    const glyph = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), glyphMat);
    glyph.position.y = 1.35;
    glyph.castShadow = true;
    group.add(glyph);

    const labelTex = this.makeLabelTexture(label.toUpperCase());
    const labelMat = new THREE.SpriteMaterial({ map: labelTex, transparent: true, depthTest: false });
    const labelSprite = new THREE.Sprite(labelMat);
    labelSprite.position.y = 2.6;
    labelSprite.scale.set(2.4, 0.6, 1);
    group.add(labelSprite);

    const glow = new THREE.PointLight(color, 1.4, 8, 2);
    glow.position.y = 1.6;
    group.add(glow);

    this.scene.add(group);

    const station: CampStation = {
      id,
      label,
      hint,
      position: new THREE.Vector3(x, 0, z),
      color,
      group,
      glow,
    };
    this.stations.push(station);
    return station;
  }

  /**
   * Stream the fishing-town GLB and place each named building at its
   * interaction's angle, facing the camp centre. The town is an ATLAS — every
   * building is modelled stacked at the origin — so each is cloned out and
   * normalised individually. Non-fatal: if the load fails, the glowing pads +
   * labels still mark every interaction.
   */
  private loadTown() {
    const loader = new GLTFLoader();
    const url = `${import.meta.env.BASE_URL}models/buildings/fishing_town.glb`;
    loader.load(
      url,
      (gltf) => {
        if (this.disposed) {
          disposeObject3D(gltf.scene);
          return;
        }
        gltf.scene.updateWorldMatrix(true, true);
        for (const def of this.STATION_DEFS) {
          const src = this.findBuilding(gltf.scene, def.building);
          if (!src) {
            if (import.meta.env.DEV) {
              console.warn(`[Camp] fishing_town building "${def.building}" not found for station "${def.id}"`);
            }
            continue;
          }
          const a = (def.angleDeg * Math.PI) / 180;
          const x = Math.cos(a) * this.BUILDING_RADIUS;
          const z = Math.sin(a) * this.BUILDING_RADIUS;
          this.scene.add(this.placeBuilding(src, x, z));
        }
      },
      undefined,
      () => {
        /* non-fatal — the camp still works with beacons + labels only */
      },
    );
  }

  private findBuilding(root: THREE.Object3D, name: string): THREE.Object3D | null {
    let found: THREE.Object3D | null = null;
    root.traverse((o) => {
      if (!found && o.name === name) found = o;
    });
    if (found) return found;
    // Fallback to a prefix match in case a re-export shifts the numeric suffix.
    const base = name.replace(/_\d+$/, "");
    root.traverse((o) => {
      if (!found && (o.name === base || o.name.startsWith(base + "_") || o.name.startsWith(base + "."))) {
        found = o;
      }
    });
    return found;
  }

  /**
   * Clone a building subtree out of the atlas, bake its world matrix (preserving
   * the glTF Y-up axis correction), normalise it to a fixed footprint with feet
   * at y=0, and wrap it in a holder placed at + facing the camp centre.
   */
  private placeBuilding(src: THREE.Object3D, x: number, z: number): THREE.Group {
    const TARGET = 5.5; // world-unit footprint (max of width/depth)
    src.updateWorldMatrix(true, false);

    const clone = src.clone(true);
    clone.position.set(0, 0, 0);
    clone.quaternion.identity();
    clone.scale.set(1, 1, 1);
    clone.applyMatrix4(src.matrixWorld);

    const pivot = new THREE.Group();
    pivot.add(clone);

    const box = new THREE.Box3().setFromObject(pivot);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const footprint = Math.max(size.x, size.z) || 1;

    // Recentre footprint over the origin and drop feet to the ground.
    clone.position.x -= center.x;
    clone.position.z -= center.z;
    clone.position.y -= box.min.y;
    pivot.scale.setScalar(TARGET / footprint);

    pivot.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if ((mesh as unknown as { isMesh?: boolean }).isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });

    const holder = new THREE.Group();
    holder.position.set(x, 0, z);
    holder.rotation.y = Math.atan2(-x, -z); // face camp centre
    holder.add(pivot);
    return holder;
  }

  private makeLabelTexture(text: string): THREE.CanvasTexture {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = "bold 56px 'Cinzel', 'Times New Roman', serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillText(text, canvas.width / 2 + 3, canvas.height / 2 + 3);
    ctx.fillStyle = "#ffd789";
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }

  private loadPlayer() {
    const loader = new GLTFLoader();
    // Prefer the globally-selected fighter skin; fall back to the KayKit hero.
    loadActiveFighterModel(
      loader,
      2.6,
      (root, anim) => {
        if (this.disposed) {
          disposeObject3D(root);
          return;
        }
        root.position.copy(this.playerPos);
        this.scene.add(root);
        this.playerGroup = root;
        this.heroAnim = anim;
        this.loaded = true;
        this.emitState();
      },
      () => this.loadFallbackPlayer(),
    );
  }

  /** Honest fallback when the fighter skin GLB fails to load: a plain capsule.
   *  KayKit heroes are reserved for townsfolk/NPCs and are never the player. */
  private loadFallbackPlayer() {
    if (this.disposed) return;
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.45, 1.1, 6, 12),
      new THREE.MeshStandardMaterial({ color: 0x886644, roughness: 0.7 }),
    );
    body.position.y = 1.1;
    body.castShadow = true;
    g.add(body);
    g.position.copy(this.playerPos);
    this.scene.add(g);
    this.playerGroup = g;
    this.loaded = true;
    this.emitState();
  }

  private _keyDown = (e: KeyboardEvent) => {
    this.keys.add(e.code);
    if (e.repeat) return;
    if (e.code === "KeyE") this.tryEngage();
    if (e.code === "KeyF") this.attackNearest();
    if (e.code === "Space") {
      e.preventDefault();
      this.doJump();
    }
    if (e.code === "KeyQ" || e.code === "ShiftLeft" || e.code === "ShiftRight") {
      e.preventDefault();
      this.doDodge();
    }
    if (e.code.startsWith("Digit")) {
      const n = Number(e.code.slice(5));
      if (n >= 1 && n <= 5) this.useSkill(n - 1);
    }
  };
  private _keyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };

  private _click = (event: MouseEvent) => {
    if (!this.container) return;
    const rect = this.container.getBoundingClientRect();
    const mouseNdc = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouseNdc, this.camera);

    // Target a dummy first.
    const dummyGroups = this.dummies.filter((d) => d.alive).map((d) => d.group);
    const dummyHits = raycaster.intersectObjects(dummyGroups, true);
    if (dummyHits.length > 0) {
      let obj: THREE.Object3D | null = dummyHits[0]!.object;
      let dummyId: string | undefined;
      while (obj && !dummyId) {
        dummyId = (obj.userData as { dummyId?: string }).dummyId;
        obj = obj.parent;
      }
      const target = this.dummies.find((d) => d.id === dummyId && d.alive);
      if (target) {
        this.attackTarget = target;
        this.playerTarget = null;
        return;
      }
    }

    // Otherwise move to the ground point.
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hit = new THREE.Vector3();
    if (raycaster.ray.intersectPlane(plane, hit)) {
      hit.x = Math.max(-this.BOUNDS + 1, Math.min(this.BOUNDS - 1, hit.x));
      hit.z = Math.max(-this.BOUNDS + 1, Math.min(this.BOUNDS - 1, hit.z));
      this.playerTarget = hit;
      this.attackTarget = null;
    }
  };

  // ── Combat actions ────────────────────────────────────────────────────────
  /** Target + attack the nearest living dummy (auto-approaches if out of range). */
  attackNearest() {
    let best: CampDummy | null = null;
    let bestD = Infinity;
    for (const d of this.dummies) {
      if (!d.alive) continue;
      const dist = d.pos.distanceTo(this.playerPos);
      if (dist < bestD) {
        bestD = dist;
        best = d;
      }
    }
    if (best) {
      this.attackTarget = best;
      this.playerTarget = null;
    }
  }

  /** Jump in place (animation-only; procedural hop fallback). */
  doJump() {
    if (this.heroAnim && this.heroAnim.trigger("jump")) return;
    if (!this.playerGroup) return;
    const g = this.playerGroup;
    const baseY = 0;
    let t = 0;
    const dur = 0.5;
    const step = () => {
      if (this.disposed) return;
      t += 0.016;
      const p = Math.min(1, t / dur);
      g.position.y = baseY + Math.sin(p * Math.PI) * 1.1;
      if (p < 1) requestAnimationFrame(step);
      else g.position.y = baseY;
    };
    requestAnimationFrame(step);
  }

  /** Dodge roll — quick dash in the facing direction + animation. */
  doDodge() {
    const now = performance.now();
    if (!canDodge(this.lastDodgeAt, now)) return;
    this.lastDodgeAt = now;
    this.playerTarget = null;
    // Dodge clips carry their own forward lunge via root motion; only dash
    // manually when the active model has no dodge clip (e.g. fighter skins).
    if (this.heroAnim?.trigger("dodge")) return;
    const forward = new THREE.Vector3(Math.sin(this.playerFacing), 0, Math.cos(this.playerFacing));
    const B = this.BOUNDS - 1;
    this.playerPos.x = Math.max(-B, Math.min(B, this.playerPos.x + forward.x * 2.4));
    this.playerPos.z = Math.max(-B, Math.min(B, this.playerPos.z + forward.z * 2.4));
  }

  /** Provide resolved HUD skills so archetypes map to real skill flavor. */
  setHudSkills(skills: (ClassSkill | undefined)[]) {
    this.hudSkills = skills;
  }

  /** Fire weapon/class skill in slot `idx` (0-based). */
  useSkill(idx: number) {
    if (idx < 0 || idx > 4) return;
    const now = performance.now();
    if (now < (this.skillCdUntil[idx] ?? 0)) return; // on cooldown
    const cost = this.skillManaCost[idx] ?? 20;
    if (this.playerMana < cost) {
      this.pushLog("Not enough mana.");
      return;
    }
    this.playerMana -= cost;
    this.skillCdUntil[idx] = now + (this.skillCdLen[idx] ?? 5) * 1000;

    // Resolve the skill's archetype shape (idx fallback gives a broad mix).
    const arch = archetypeForSkill(this.hudSkills[idx], idx);
    const isCast = arch.shape === "circle" || arch.shape === "nova" || arch.shape === "deployable";
    if (this.heroAnim) {
      const played = this.heroAnim.triggerNamed(skillAnimCandidates(idx, isCast));
      if (!played) this.proceduralLunge();
    } else {
      this.proceduralLunge();
    }

    // Auto-aim the nearest living dummy so shaped skills read as aimed.
    let nearest: CampDummy | null = null;
    let nearestDist = Infinity;
    for (const d of this.dummies) {
      if (!d.alive) continue;
      const dist = d.pos.distanceTo(this.playerPos);
      if (dist < nearestDist) { nearestDist = dist; nearest = d; }
    }
    if (nearest) this.playerFacing = Math.atan2(nearest.pos.x - this.playerPos.x, nearest.pos.z - this.playerPos.z);
    const dir = new THREE.Vector3(Math.sin(this.playerFacing), 0, Math.cos(this.playerFacing));
    const origin = this.playerPos.clone();

    // The Training Ground keeps deployables as an instant AoE pulse (no spawns).
    const kind = arch.shape === "deployable" ? "nova" : arch.shape;
    const q: ShapeQuery = {
      kind,
      origin,
      dir,
      radius: arch.radius,
      halfAngle: arch.halfAngle,
      length: arch.length,
      halfWidth: arch.halfWidth,
    };
    this.telegraphs?.show(q, arch.telegraph || 0.3, arch.color);

    const reach = arch.radius ?? arch.length ?? 4;
    const center =
      kind === "circle" || kind === "nova"
        ? origin.clone()
        : origin.clone().add(dir.clone().multiplyScalar(reach * 0.5));
    if (kind === "nova" || kind === "circle") this.skillVfx.spawn("cloud", center, 4, 1.0);
    this.particles?.castSkillVfx({
      element: arch.element,
      shape: kind,
      center: kind === "nova" || kind === "circle" ? center.clone() : origin.clone(),
      origin: origin.clone(),
      dir,
      reach,
      halfAngle: arch.halfAngle,
    });

    let hitAny = false;
    for (const d of this.dummies) {
      if (!d.alive) continue;
      if (pointInShape(q, d.pos)) {
        const isCrit = Math.random() < this.critChance + 0.05;
        const dmg = Math.round(this.baseDamage * arch.damageMult * (isCrit ? 2 : 1) * (0.85 + Math.random() * 0.3));
        this.damageDummy(d, dmg, isCrit, true);
        hitAny = true;
      }
    }
    this.pushLog(hitAny ? `Skill ${idx + 1} strikes the yard!` : `Skill ${idx + 1} — no target in range.`);
    this.emitState();
  }

  private proceduralLunge() {
    if (!this.playerGroup) return;
    const g = this.playerGroup;
    const forward = new THREE.Vector3(Math.sin(this.playerFacing), 0, Math.cos(this.playerFacing));
    const start = g.position.clone();
    const peak = start.clone().add(forward.multiplyScalar(0.5));
    let t = 0;
    const dur = 0.22;
    const step = () => {
      if (this.disposed) return;
      t += 0.016;
      const p = Math.min(1, t / dur);
      const e = p < 0.5 ? p * 2 : (1 - p) * 2;
      g.position.lerpVectors(start, peak, e);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  private damageDummy(d: CampDummy, dmg: number, isCrit: boolean, isPlayer: boolean) {
    d.hp = Math.max(0, d.hp - dmg);
    d.flash = 0.18;
    this.spawnDamageNumber(d.pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.6, 2.2, 0)), dmg, isCrit, isPlayer);
    if (d.hp <= 0 && d.alive) {
      d.alive = false;
      d.deadT = 0;
      this.pushLog(`${d.name} shattered!`);
      if (this.attackTarget === d) this.attackTarget = null;
    }
  }

  private spawnDamageNumber(world: THREE.Vector3, value: number, isCrit: boolean, isPlayer: boolean) {
    const sc = this.worldToScreen(world);
    this.damageNumbers.push({
      id: this.dmgId++,
      x: sc.x,
      y: sc.y,
      value,
      isCrit,
      isPlayer,
      age: 0,
    });
    if (this.damageNumbers.length > 40) this.damageNumbers.splice(0, this.damageNumbers.length - 40);
  }

  private spawnVfx(at: THREE.Vector3, color: number, radius: number) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.2, 0.4, 32),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(at.x, 0.15, at.z);
    this.scene.add(ring);
    this.vfx.push({ mesh: ring, life: 0, max: 0.4, grow: radius });
  }

  private pushLog(msg: string) {
    this.combatLog.unshift(msg);
    if (this.combatLog.length > 12) this.combatLog.length = 12;
  }

  private worldToScreen(world: THREE.Vector3): { x: number; y: number } {
    const v = world.clone().project(this.camera);
    const w = this.container?.clientWidth ?? window.innerWidth;
    const h = this.container?.clientHeight ?? window.innerHeight;
    return { x: ((v.x + 1) / 2) * w, y: ((1 - v.y) / 2) * h };
  }

  tryEngage() {
    if (!this.currentNearbyId || this._engaged) return;
    this._engaged = true;
    this.options.onStationEngage?.(this.currentNearbyId);
    // Re-arm shortly after to allow next press
    setTimeout(() => {
      this._engaged = false;
    }, 350);
  }

  private animate = () => {
    this.animFrameId = requestAnimationFrame(this.animate);
    const delta = Math.min(this.clock.getDelta(), 0.08);
    this.update(delta);
    if (this.bloom) this.bloom.composer.render();
    else this.renderer.render(this.scene, this.camera);
  };

  private update(delta: number) {
    const elapsed = this.clock.getElapsedTime();

    // Movement (WASD/arrows in isometric basis)
    const raw = new THREE.Vector2();
    if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) {
      raw.x -= 1;
      raw.y -= 1;
    }
    if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) {
      raw.x += 1;
      raw.y += 1;
    }
    if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) {
      raw.x -= 1;
      raw.y += 1;
    }
    if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) {
      raw.x += 1;
      raw.y -= 1;
    }

    let moving = false;
    if (raw.length() > 0) {
      raw.normalize();
      const B = this.BOUNDS - 1;
      this.playerPos.x = Math.max(-B, Math.min(B, this.playerPos.x + raw.x * this.playerSpeed * delta));
      this.playerPos.z = Math.max(-B, Math.min(B, this.playerPos.z + raw.y * this.playerSpeed * delta));
      this.playerTarget = null;
      this.attackTarget = null;
      this.playerFacing = Math.atan2(raw.x, raw.y);
      moving = true;
    } else if (this.attackTarget && this.attackTarget.alive) {
      // Auto-approach the attack target, then stop in range.
      const toTarget = new THREE.Vector3().subVectors(this.attackTarget.pos, this.playerPos);
      const d = toTarget.length();
      this.playerFacing = Math.atan2(toTarget.x, toTarget.z);
      if (d > this.attackRange) {
        toTarget.normalize();
        this.playerPos.x += toTarget.x * this.playerSpeed * delta;
        this.playerPos.z += toTarget.z * this.playerSpeed * delta;
        moving = true;
      }
    } else if (this.playerTarget) {
      const toTarget = new THREE.Vector3().subVectors(this.playerTarget, this.playerPos);
      const d = toTarget.length();
      if (d > 0.2) {
        toTarget.normalize();
        this.playerPos.x += toTarget.x * this.playerSpeed * delta;
        this.playerPos.z += toTarget.z * this.playerSpeed * delta;
        this.playerFacing = Math.atan2(toTarget.x, toTarget.z);
        moving = true;
      } else {
        this.playerTarget = null;
      }
    }

    // Root motion: let lunging/dodge/jump clips carry the logical position so
    // the mesh moves WITH the character instead of sliding and snapping back.
    if (this.heroAnim && this.heroAnim.consumeRootMotion(this._rmTmp)) {
      const B = this.BOUNDS - 1;
      this.playerPos.x = Math.max(-B, Math.min(B, this.playerPos.x + this._rmTmp.x));
      this.playerPos.z = Math.max(-B, Math.min(B, this.playerPos.z + this._rmTmp.z));
    }

    if (this.playerGroup) {
      const targetPos = new THREE.Vector3(this.playerPos.x, 0, this.playerPos.z);
      this.playerGroup.position.lerp(targetPos, 0.3);
      this.playerGroup.rotation.y += (this.playerFacing - this.playerGroup.rotation.y) * 0.2;
    }

    // Basic-attack loop against the current target when in range.
    this.attackCdT = Math.max(0, this.attackCdT - delta);
    if (!moving && this.attackTarget && this.attackTarget.alive) {
      const dist = this.attackTarget.pos.distanceTo(this.playerPos);
      if (dist <= this.attackRange && this.attackCdT <= 0) {
        this.attackCdT = this.attackInterval;
        if (this.heroAnim) {
          const played = this.heroAnim.trigger("attack");
          if (!played) this.proceduralLunge();
        } else {
          this.proceduralLunge();
        }
        const isCrit = Math.random() < this.critChance;
        const dmg = Math.round(this.baseDamage * (isCrit ? 2 : 1) * (0.85 + Math.random() * 0.3));
        this.damageDummy(this.attackTarget, dmg, isCrit, true);
      }
    }

    // Resource regen.
    this.playerMana = Math.min(this.playerMaxMana, this.playerMana + 14 * delta);
    this.playerHp = Math.min(this.playerMaxHp, this.playerHp + 6 * delta);

    // Animator state.
    if (this.heroAnim) {
      this.heroAnim.setMoving(moving);
      this.heroAnim.update(delta);
    }

    this.skillVfx.update(delta);
    this.telegraphs?.update(delta);
    this.particles?.update(delta);

    for (const t of this.townsfolk) t.update(delta);

    // Dummies: hit-flash decay, death tip-over + respawn.
    for (const d of this.dummies) {
      if (d.flash > 0) {
        d.flash = Math.max(0, d.flash - delta);
        const k = d.flash / 0.18;
        for (let i = 0; i < d.mats.length; i++) {
          d.mats[i]!.emissive.setRGB(k, k * 0.2, 0);
        }
      } else {
        for (const mm of d.mats) mm.emissive.setRGB(0, 0, 0);
      }
      if (!d.alive) {
        d.deadT += delta;
        d.group.rotation.z = Math.min(Math.PI / 2.2, d.group.rotation.z + delta * 3);
        d.group.position.y = Math.max(-0.3, d.group.position.y - delta * 0.4);
        if (d.deadT > 3) {
          // Respawn upright at full health.
          d.alive = true;
          d.hp = d.maxHp;
          d.deadT = 0;
          d.group.rotation.z = 0;
          d.group.position.set(d.pos.x, 0, d.pos.z);
        }
      }
    }

    // VFX rings.
    for (let i = this.vfx.length - 1; i >= 0; i--) {
      const v = this.vfx[i]!;
      v.life += delta;
      const p = v.life / v.max;
      const s = 0.4 + p * v.grow;
      v.mesh.scale.set(s, s, s);
      (v.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.8 * (1 - p));
      if (v.life >= v.max) {
        this.scene.remove(v.mesh);
        v.mesh.geometry.dispose();
        (v.mesh.material as THREE.Material).dispose();
        this.vfx.splice(i, 1);
      }
    }

    // Damage numbers age out.
    for (let i = this.damageNumbers.length - 1; i >= 0; i--) {
      const dn = this.damageNumbers[i]!;
      dn.age += delta;
      if (dn.age > 1.4) this.damageNumbers.splice(i, 1);
    }

    // Camera follow (gentle)
    const camOffset = new THREE.Vector3(18, 18, 18);
    const camTarget = new THREE.Vector3(this.playerPos.x * 0.4, 0, this.playerPos.z * 0.4).add(camOffset);
    this.camera.position.lerp(camTarget, 0.04);
    this.camera.lookAt(this.playerPos.x * 0.4, 0, this.playerPos.z * 0.4);

    // World prop animation mixers + floating perk symbols.
    for (const wp of this.worldProps) {
      wp.mixer?.update(delta);
      if (wp.def.kind === "perk_symbol") {
        const t = elapsed * 1.6 + wp.holder.position.x;
        wp.holder.position.y = Math.sin(t) * 0.12;
        wp.holder.rotation.y += delta * 0.35;
      }
    }

    // Campfire flicker
    if (this.campfireLight) {
      this.campfireLight.intensity = 5.2 + Math.sin(elapsed * 6.3) * 0.7 + Math.sin(elapsed * 17) * 0.35;
    }
    if (this.campfireMesh) {
      const s = 1 + Math.sin(elapsed * 7.1) * 0.06;
      this.campfireMesh.scale.set(s, 1.45 + Math.sin(elapsed * 4.7) * 0.08, s);
      const inner = (this.campfireMesh.userData as { inner?: THREE.Mesh }).inner;
      if (inner) {
        const s2 = 1 + Math.sin(elapsed * 9.4 + 1) * 0.08;
        inner.scale.set(s2, 1.4 + Math.sin(elapsed * 5.9) * 0.1, s2);
      }
    }

    // Spawn embers
    if (Math.random() < 0.5) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xffb060, transparent: true, opacity: 0.95 });
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.04, 4, 3), mat);
      m.position.set((Math.random() - 0.5) * 0.4, 0.9, (Math.random() - 0.5) * 0.4);
      this.scene.add(m);
      this.embers.push({
        mesh: m,
        vel: new THREE.Vector3((Math.random() - 0.5) * 0.5, 1.6 + Math.random() * 0.5, (Math.random() - 0.5) * 0.5),
        life: 0,
        max: 1.2 + Math.random() * 0.6,
      });
    }
    for (let i = this.embers.length - 1; i >= 0; i--) {
      const e = this.embers[i]!;
      e.life += delta;
      e.mesh.position.addScaledVector(e.vel, delta);
      e.vel.y -= delta * 0.4;
      const mat = e.mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, 1 - e.life / e.max);
      if (e.life >= e.max) {
        this.scene.remove(e.mesh);
        e.mesh.geometry.dispose();
        mat.dispose();
        this.embers.splice(i, 1);
      }
    }

    // Station glow pulse + proximity
    let closest: { st: CampStation; d: number } | null = null;
    for (const st of this.stations) {
      const d = st.position.distanceTo(this.playerPos);
      const ring = (st.group.userData as { ring?: THREE.Mesh }).ring;
      const pulse = 0.45 + 0.2 * Math.sin(elapsed * 2.5 + st.position.x * 0.3);
      if (ring) (ring.material as THREE.MeshBasicMaterial).opacity = pulse;
      st.glow.intensity = 1.0 + 0.5 * Math.sin(elapsed * 3 + st.position.z * 0.2);
      if (d < 3.4 && (!closest || d < closest.d)) closest = { st, d };
    }

    const newNearbyId = closest?.st.id ?? null;
    if (newNearbyId !== this.currentNearbyId) {
      // Boost glow of the nearby station
      if (this.currentNearbyId) {
        const prev = this.stations.find((s) => s.id === this.currentNearbyId);
        if (prev) prev.glow.intensity = 1.2;
      }
      this.currentNearbyId = newNearbyId;
    }
    if (closest) {
      closest.st.glow.intensity = 2.4 + Math.sin(elapsed * 6) * 0.4;
    }

    // Stream the full state (station + combat) to the React HUD, throttled to
    // ~30 Hz so we don't force a full React rerender every render frame.
    this.stateAccum += delta;
    if (this.stateAccum >= this.stateInterval) {
      this.stateAccum = 0;
      this.emitState();
    }
  }

  private emitState() {
    if (this.disposed || !this.options.onStateUpdate) return;
    const st = this.stations.find((s) => s.id === this.currentNearbyId) ?? null;
    const layout = this.currentNearbyId ? CAMP_STATION_BY_ID.get(this.currentNearbyId) : undefined;
    const bounds = CAMP_BOUNDS;
    const now = performance.now();
    this.options.onStateUpdate({
      nearbyStationId: this.currentNearbyId,
      nearbyStationLabel: st?.label ?? null,
      nearbyStationHint: st?.hint ?? null,
      nearbyStationCategory: layout?.category ?? null,
      nearbyStationDistrict: layout?.district ?? null,
      nearbyStationAction: layout?.action ?? null,
      playerMapX: bounds > 0 ? this.playerPos.x / bounds : 0,
      playerMapZ: bounds > 0 ? this.playerPos.z / bounds : 0,
      mapMarkers: campStationMarkers().map((m) => ({
        id: m.id,
        nx: bounds > 0 ? m.x / bounds : 0,
        nz: bounds > 0 ? m.z / bounds : 0,
        color: m.color,
        category: m.category,
      })),
      promptKey: "E",
      loaded: this.loaded,
      playerHp: this.playerHp,
      playerMaxHp: this.playerMaxHp,
      playerMana: this.playerMana,
      playerMaxMana: this.playerMaxMana,
      playerLevel: this.playerLevel,
      attackCooldownPct: 1 - this.attackCdT / this.attackInterval,
      skillCooldownPct: this.skillCdUntil.map((until, i) => {
        const len = (this.skillCdLen[i] ?? 5) * 1000;
        const remain = Math.max(0, until - now);
        return 1 - remain / len;
      }),
      dummies: this.dummies.map((d) => {
        const sc = this.worldToScreen(d.pos.clone().add(new THREE.Vector3(0, 2.6, 0)));
        return {
          id: d.id,
          name: d.name,
          hp: d.hp,
          maxHp: d.maxHp,
          screenX: sc.x,
          screenY: sc.y,
          alive: d.alive,
        };
      }),
      damageNumbers: this.damageNumbers.map((d) => ({ ...d })),
      combatLog: this.combatLog.slice(),
    });
  }

  private onResize = () => {
    if (!this.container) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    const aspect = w / h;
    const d = 11;
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
    window.removeEventListener("keydown", this._keyDown);
    window.removeEventListener("keyup", this._keyUp);
    if (this.container) {
      this.container.removeEventListener("click", this._click);
      if (this.renderer.domElement.parentNode === this.container) {
        this.container.removeChild(this.renderer.domElement);
      }
    }
    if (this.heroAnim) {
      this.heroAnim.dispose();
      this.heroAnim = null;
    }
    this.skillVfx?.dispose();
    this.telegraphs?.dispose();
    this.particles?.dispose();
    for (const t of this.townsfolk) {
      this.scene.remove(t.group);
      t.dispose();
    }
    this.townsfolk = [];
    for (const wp of this.worldProps) {
      this.scene.remove(wp.holder);
      disposeWorldProp(wp);
    }
    this.worldProps = [];
    this.tileableHandle?.dispose();
    this.tileableHandle = null;
    this.embers = [];
    this.vfx = [];
    this.dummies = [];
    this.playerGroup = null;
    // Release every GPU resource owned by the scene (player, stations,
    // environment, labels/CanvasTextures, campfire, embers, vfx, dummies).
    disposeObject3D(this.scene);
    this.scene.clear();
    this.bloom?.composer.dispose();
    this.bloom = null;
    this.renderer.dispose();
  }
}
