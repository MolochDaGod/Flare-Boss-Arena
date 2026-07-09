import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  disposeObject3D,
  loadActiveFighterModel,
  skillAnimCandidates,
  type HeroLike,
} from "./kaykitHero";
import { SkillVfx } from "./skillVfx";
import { archetypeForSkill } from "./combat/skillArchetypes";
import { pointInShape, type ShapeQuery } from "./combat/damageShapes";
import { TelegraphField } from "./combat/telegraphs";
import { ParticleVfx } from "./combat/particles";
import { makeBloomComposer, type BloomComposer } from "./combat/bloom";
import type { ClassSkill } from "../data/classSkills";
import { loadMonsterModel, disposeMonsterModel, isMonsterId } from "./MonsterModels";
import type { EnemyModel } from "./EnemyFactory";
import { makeGroundMaterial } from "./proceduralTextures";

// ─── Public types ─────────────────────────────────────────────────────────────

export type BossAbilityType = "melee" | "ranged" | "magic" | "aoe" | "debuff";

export interface ArenaBossAbility {
  id: string;
  name: string;
  damage: number;
  type: string;
  cooldown: number;
  description?: string;
}

export interface ArenaBossInput {
  id: number;
  name: string;
  title?: string;
  maxHp: number;
  phases: number;
  tier: number;
  assetPack?: string;
  abilities: ArenaBossAbility[];
}

export type ArenaOutcome = "fighting" | "victory" | "defeat";

export interface ArenaDamageNumber {
  id: number;
  x: number;
  y: number;
  value: number;
  isCrit: boolean;
  isPlayer: boolean;
  age: number;
}

export interface ArenaStateUpdate {
  loaded: boolean;
  outcome: ArenaOutcome;
  playerHp: number;
  playerMaxHp: number;
  playerMana: number;
  playerMaxMana: number;
  playerLevel: number;
  attackCooldownPct: number;
  skillCooldownPct: number[];
  /** 0..1 ready for next dodge (1 = ready). */
  dodgeReadyPct: number;
  /** True while dodge invulnerability frames are active. */
  iframeActive: boolean;
  bossName: string;
  bossTitle: string;
  bossHp: number;
  bossMaxHp: number;
  bossPhase: number;
  bossMaxPhases: number;
  bossScreenX: number;
  bossScreenY: number;
  bossAlive: boolean;
  bossTelegraph: string | null;
  /** Brief phase-banner text (e.g. "PHASE 2") while announce timer is live. */
  phaseAnnounce: string | null;
  damageNumbers: ArenaDamageNumber[];
  combatLog: string[];
}

export interface ArenaSceneOptions {
  className?: string;
  raceKey?: string;
  level?: number;
  maxHp?: number;
  maxMana?: number;
  baseDamage?: number;
  critChance?: number;
  boss: ArenaBossInput;
  onStateUpdate?: (s: ArenaStateUpdate) => void;
  onVictory?: () => void;
  onDefeat?: () => void;
}

// ─── Internal entity types ────────────────────────────────────────────────────

interface Projectile {
  sprite: THREE.Sprite; // glowing additive billboard (shared particle texture)
  light: THREE.PointLight | null;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  max: number;
  damage: number;
  /** Hit radius — large enough to feel fair, small enough to dodge through. */
  radius: number;
  homing: boolean;
  color: number;
  trailT: number;
  /** All boss bolts are dodgeable via i-frames or sidestep. */
  dodgeable: boolean;
  /** Optional ground shadow that tracks projected landing for lobbed shots. */
  groundRing?: THREE.Mesh;
}

type TelegraphKind = "melee" | "aoe" | "debuff" | "phase";

interface Telegraph {
  kind: TelegraphKind;
  center: THREE.Vector3;
  radius: number;
  t: number;
  windup: number;
  struck: boolean;
  damage: number;
  label: string;
  /** Growing ring (phase burst / expanding nova). */
  expanding?: boolean;
  radiusEnd?: number;
}

/**
 * Pick an in-repo (rigged, animated) monster GLB to embody the boss, by tier.
 * Prefer smaller GLBs at low tiers — cultist_armed is ~31 MB and made every
 * tier-1 load feel broken/hung on slow networks.
 */
function bossMonsterId(tier: number): string {
  switch (Math.max(1, Math.min(5, Math.round(tier)))) {
    case 1: return "mon_pincher";
    case 2: return "mon_medusa";
    case 3: return "mon_dante_beast";
    case 4: return "mon_medusa";
    default: return "mon_dante_beast";
  }
}

/** Deterministic 32-bit hash so the same assetPack always picks the same model. */
function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Resolve the AI-generated `assetPack` to an actual in-repo boss model.
 *
 * No dedicated Boss GLBs / R2 boss assets exist in this project, so the
 * generated `assetPack` string drives the choice among the shipped monster
 * models: first by thematic keyword, then by a deterministic hash so distinct
 * bosses get distinct (but stable) bodies. Empty `assetPack` falls back to a
 * tier-based pick. The caller still guards the result with `isMonsterId`.
 */
function resolveBossModelId(assetPack: string | undefined, tier: number): string {
  const pack = (assetPack ?? "").toLowerCase();
  if (!pack.trim() || pack === "boss_character_default") return bossMonsterId(tier);

  // Only animated (rigged, non-null clip) monsters are eligible — the boss must
  // visibly idle/move/attack, so the static `mon_big_scary_*` GLBs are excluded.
  const keywordMap: Array<[RegExp, string]> = [
    [/colossus|titan|giant|golem|wrath|dread|hulk|behemoth|leviathan/, "mon_dante_beast"],
    [/gloom|brute|ogre|troll|abomination/, "mon_medusa"],
    [/thorn|queen|briar|medusa|serpent|gorgon|witch|matriarch|naga/, "mon_medusa"],
    [/hunter|predator|beast|wolf|hound|stalker|fang|claw/, "mon_dante_beast"],
    [/cult|undead|wraith|lich|priest|acolyte|necro|bone|grave/, "mon_cultist"],
    [/spider|arachnid|chitin|scuttle|pincher|crawler/, "mon_pincher"],
  ];
  for (const [re, id] of keywordMap) {
    if (re.test(pack)) return id;
  }

  // No thematic match — hash the pack for a stable, varied body (animated only).
  const pool = ["mon_dante_beast", "mon_medusa", "mon_cultist", "mon_pincher"];
  return pool[hashString(pack) % pool.length]!;
}

function normalizeAbilityType(t: string): BossAbilityType {
  const s = (t ?? "").toLowerCase();
  if (s.includes("aoe") || s.includes("area")) return "aoe";
  if (s.includes("debuff") || s.includes("curse") || s.includes("slow")) return "debuff";
  if (s.includes("magic") || s.includes("spell") || s.includes("arcane")) return "magic";
  if (s.includes("rang") || s.includes("bolt") || s.includes("shot") || s.includes("fire")) return "ranged";
  return "melee";
}

/**
 * ArenaScene — real-time 3D boss arena.
 *
 * A plain Three.js class (no React hooks in the loop) modelled on the dungeon /
 * camp scenes: heightmap-relief terrain, an animated KayKit hero the player
 * controls (WASD + click-to-move, dodge, attack, skills), and a single
 * AI-generated boss embodied by an in-repo monster GLB. The boss behaviour is
 * decided client-side from the generated ability list (projectiles, telegraphed
 * ground strikes, AoE zones, melee) with HP-based phase transitions. React only
 * renders the HUD from throttled state updates.
 */
export class ArenaScene {
  private container: HTMLElement | null = null;
  private scene!: THREE.Scene;
  private camera!: THREE.OrthographicCamera;
  private renderer!: THREE.WebGLRenderer;
  private bloom: BloomComposer | null = null;
  private clock = new THREE.Clock();
  private skillVfx!: SkillVfx;
  private skillTelegraphs!: TelegraphField;
  private particles!: ParticleVfx;
  /** Resolved HUD skills for archetype mapping; idx fallback works if unset. */
  private hudSkills: (ClassSkill | undefined)[] = [];
  private animFrameId = 0;

  // Lighting rig (sun follows the player for crisp shadows on a big map).
  private sun!: THREE.DirectionalLight;

  // Player
  private playerGroup: THREE.Object3D | null = null;
  private heroAnim: HeroLike | null = null;
  private playerPos = new THREE.Vector3(0, 0, 9);
  private _rmTmp = new THREE.Vector3();
  private playerFacing = Math.PI;
  private playerTarget: THREE.Vector3 | null = null;
  private attackBoss = false; // auto-approach + basic-attack the boss
  private playerSpeed = 7.2;
  private slowUntil = 0;
  /** Dodge invulnerability end time (performance.now ms). */
  private iframeUntil = 0;
  /** Dodge cooldown end time. */
  private dodgeCdUntil = 0;
  private readonly dodgeCdSec = 0.85;
  private readonly dodgeIframeSec = 0.42;
  private readonly dodgeDistance = 3.4;

  private playerHp: number;
  private playerMaxHp: number;
  private playerMana: number;
  private playerMaxMana: number;
  private playerLevel: number;
  private baseDamage: number;
  private critChance: number;
  private readonly attackInterval = 0.8;
  private readonly attackRange = 3.0;
  private attackCdT = 0;

  private skillCdUntil = [0, 0, 0, 0, 0];
  private skillCdLen = [4, 5, 6, 7, 8];
  private skillManaCost = [18, 24, 30, 36, 42];

  // Boss
  private boss: ArenaBossInput;
  private bossModel: EnemyModel | null = null;
  private bossGroup: THREE.Group | null = null;
  private bossPos = new THREE.Vector3(0, 0, -9);
  private bossHp: number;
  private bossMaxHp: number;
  private bossPhase = 1;
  private bossAlive = true;
  private bossFlash = 0;
  private bossDeadT = 0;
  private bossWorldHeight = 3;
  private bossSpeed = 2.4;
  private readonly bossMeleeRange = 4.5;
  private bossActionT = 2.2;
  private abilityCdUntil = new Map<string, number>();
  private activeTelegraphLabel: string | null = null;
  /** Seconds remaining for "PHASE N" HUD banner. */
  private phaseAnnounceT = 0;
  private phaseAnnounceText: string | null = null;
  /** Shared ring geometry for projectile ground shadows. */
  private projRingGeo: THREE.RingGeometry | null = null;

  private projectiles: Projectile[] = [];
  private telegraphs: Telegraph[] = [];

  // HUD streaming
  private damageNumbers: ArenaDamageNumber[] = [];
  private dmgId = 0;
  private combatLog: string[] = [];
  private outcome: ArenaOutcome = "fighting";
  private loaded = false;
  private disposed = false;
  private stateAccum = 0;
  private readonly stateInterval = 1 / 30;

  private keys = new Set<string>();
  private readonly BOUNDS = 18;
  private options: ArenaSceneOptions;
  private victoryFired = false;
  private defeatFired = false;

  constructor(options: ArenaSceneOptions) {
    this.options = options;
    this.boss = options.boss;
    this.playerLevel = options.level ?? 1;
    this.playerMaxHp = options.maxHp ?? 400 + this.playerLevel * 40;
    this.playerHp = this.playerMaxHp;
    this.playerMaxMana = options.maxMana ?? 150 + this.playerLevel * 15;
    this.playerMana = this.playerMaxMana;
    this.baseDamage = options.baseDamage ?? 28 + this.playerLevel * 4;
    this.critChance = options.critChance ?? 0.12;
    this.bossMaxHp = Math.max(1, options.boss.maxHp);
    this.bossHp = this.bossMaxHp;
    // Normalize phase count so telegraphs / volleys always have room to escalate.
    this.boss.phases = Math.max(2, Math.min(3, Math.round(this.boss.phases) || 2));
  }

  init(container: HTMLElement) {
    this.container = container;
    const w = container.clientWidth;
    const h = container.clientHeight;
    const aspect = w / h;
    const d = 13;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x070608);
    this.scene.fog = new THREE.FogExp2(0x0a0608, 0.02);
    this.skillVfx = new SkillVfx(this.scene, new GLTFLoader());
    this.skillTelegraphs = new TelegraphField(this.scene);
    this.particles = new ParticleVfx(this.scene);

    this.camera = new THREE.OrthographicCamera(-d * aspect, d * aspect, d, -d, 0.1, 400);
    this.camera.position.set(22, 24, 22);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.98;
    container.appendChild(this.renderer.domElement);
    this.bloom = makeBloomComposer(this.renderer, this.scene, this.camera, w, h);

    this.buildLighting();
    this.buildTerrain();
    this.buildBraziers();
    this.loadPlayer();
    this.loadBoss();
    this.emitState();

    window.addEventListener("resize", this.onResize);
    window.addEventListener("keydown", this._keyDown);
    window.addEventListener("keyup", this._keyUp);
    container.addEventListener("click", this._click);

    this.animFrameId = requestAnimationFrame(this.animate);
  }

  // ── Environment ───────────────────────────────────────────────────────────
  private buildLighting() {
    const hemi = new THREE.HemisphereLight(0x55506a, 0x080608, 0.5);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xffb27a, 1.15);
    sun.position.set(18, 30, 12);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 120;
    const fr = 36;
    sun.shadow.camera.left = -fr;
    sun.shadow.camera.right = fr;
    sun.shadow.camera.top = fr;
    sun.shadow.camera.bottom = -fr;
    sun.shadow.bias = -0.0004;
    this.scene.add(sun);
    this.scene.add(sun.target);
    this.sun = sun;

    // Faint blood-red fill from the boss side.
    const fill = new THREE.PointLight(0xff3322, 1.4, 60, 2);
    fill.position.set(0, 8, -12);
    this.scene.add(fill);
  }

  private buildTerrain() {
    const R = this.BOUNDS;
    const Rw = R - 1; // walkable radius — matches the circular movement clamp.

    // Round sand-and-cobble combat floor (procedural tiling material).
    const groundMat = makeGroundMaterial(R / 2, this.renderer.capabilities.getMaxAnisotropy());
    const floor = new THREE.Mesh(new THREE.CircleGeometry(Rw + 0.6, 72), groundMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Dark apron ringing the pit so the arena reads as an enclosed bowl.
    const apron = new THREE.Mesh(
      new THREE.RingGeometry(Rw, Rw + 44, 64),
      new THREE.MeshStandardMaterial({ color: 0x050405, roughness: 1 }),
    );
    apron.rotation.x = -Math.PI / 2;
    apron.position.y = -0.05;
    apron.receiveShadow = true;
    this.scene.add(apron);

    // ── Colosseum shell ───────────────────────────────────────────────────
    // Inner pit wall — sits exactly at the walkable edge (radius BOUNDS - 1) so
    // the barrier the fighters cannot cross lines up with the nav clamp.
    const wallH = 2.1;
    const wall = new THREE.Mesh(
      new THREE.CylinderGeometry(Rw, Rw, wallH, 72, 1, true),
      new THREE.MeshStandardMaterial({ color: 0x1b1613, roughness: 1, side: THREE.DoubleSide }),
    );
    wall.position.y = wallH / 2;
    wall.receiveShadow = true;
    wall.castShadow = true;
    this.scene.add(wall);

    // Stone coping capping the pit wall.
    const coping = new THREE.Mesh(
      new THREE.TorusGeometry(Rw, 0.3, 8, 72),
      new THREE.MeshStandardMaterial({ color: 0x3b332c, roughness: 0.9 }),
    );
    coping.rotation.x = Math.PI / 2;
    coping.position.y = wallH;
    coping.castShadow = true;
    this.scene.add(coping);

    // Stepped spectator stands rising outward (riser + tread per tier). Kept
    // low (≤ ~6u) so the fixed iso camera always sees over the near arc.
    const tiers = 5;
    const tread = 2.1;
    const rise = 0.75;
    const matA = new THREE.MeshStandardMaterial({ color: 0x2a2320, roughness: 0.95 });
    const matB = new THREE.MeshStandardMaterial({ color: 0x211b18, roughness: 1 });
    for (let i = 0; i < tiers; i++) {
      const r = Rw + 0.3 + i * tread;
      const y = wallH + i * rise;
      const riser = new THREE.Mesh(
        new THREE.CylinderGeometry(r, r, rise, 72, 1, true),
        i % 2 === 0 ? matA : matB,
      );
      riser.position.y = y + rise / 2;
      riser.receiveShadow = true;
      riser.castShadow = true;
      this.scene.add(riser);

      const step = new THREE.Mesh(
        new THREE.RingGeometry(r, r + tread, 72),
        i % 2 === 0 ? matB : matA,
      );
      step.rotation.x = -Math.PI / 2;
      step.position.y = y + rise;
      step.receiveShadow = true;
      this.scene.add(step);
    }

    // Merlon pillars ringing the top of the stands for a toothed silhouette.
    const merlons = 28;
    const merlonGeom = new THREE.BoxGeometry(1.1, 1.8, 1.1);
    const merlonMat = new THREE.MeshStandardMaterial({ color: 0x342c26, roughness: 0.9 });
    const merlonInst = new THREE.InstancedMesh(merlonGeom, merlonMat, merlons);
    const mm = new THREE.Matrix4();
    const merlonR = Rw + 0.3 + tiers * tread;
    const merlonY = wallH + tiers * rise + 0.9;
    for (let i = 0; i < merlons; i++) {
      const a = (i / merlons) * Math.PI * 2;
      mm.makeTranslation(Math.cos(a) * merlonR, merlonY, Math.sin(a) * merlonR);
      merlonInst.setMatrixAt(i, mm);
    }
    merlonInst.castShadow = true;
    merlonInst.receiveShadow = true;
    this.scene.add(merlonInst);
  }

  private buildBraziers() {
    // Eight braziers ringing the pit edge for dark-fantasy ambiance + flicker.
    const count = 8;
    const r = this.BOUNDS - 1.5;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + Math.PI / count;
      const px = Math.cos(a) * r;
      const pz = Math.sin(a) * r;

      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16, 0.22, 2.0, 8),
        new THREE.MeshStandardMaterial({ color: 0x1a1410, roughness: 0.9 }),
      );
      post.position.set(px, 1.0, pz);
      post.castShadow = true;
      this.scene.add(post);

      const bowl = new THREE.Mesh(
        new THREE.CylinderGeometry(0.5, 0.3, 0.4, 10),
        new THREE.MeshStandardMaterial({ color: 0x2a2018, roughness: 0.85 }),
      );
      bowl.position.set(px, 2.1, pz);
      this.scene.add(bowl);

      const flame = new THREE.Mesh(
        new THREE.SphereGeometry(0.32, 12, 10),
        new THREE.MeshBasicMaterial({ color: 0xffa83a, transparent: true, opacity: 0.9 }),
      );
      flame.position.set(px, 2.45, pz);
      flame.scale.set(1, 1.5, 1);
      this.scene.add(flame);

      const light = new THREE.PointLight(0xff9c44, 4, 16, 2);
      light.position.set(px, 2.6, pz);
      this.scene.add(light);
      (flame.userData as { light?: THREE.PointLight }).light = light;
      this.braziers.push(flame);
    }
  }
  private braziers: THREE.Mesh[] = [];

  // ── Player ────────────────────────────────────────────────────────────────
  private loadPlayer() {
    const loader = new GLTFLoader();
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled || this.disposed) return;
      settled = true;
      fn();
    };
    // Prefer the globally-selected fighter skin; fall back to a capsule.
    loadActiveFighterModel(
      loader,
      2.6,
      (root, anim) => {
        finish(() => {
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
        });
      },
      () => finish(() => this.loadFallbackPlayer()),
    );
    // Don't leave "Entering the arena..." forever if the skin GLB hangs.
    window.setTimeout(() => {
      finish(() => this.loadFallbackPlayer());
    }, 10000);
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

  // ── Boss ──────────────────────────────────────────────────────────────────
  private loadBoss() {
    const loader = new GLTFLoader();
    // Drive the body from the AI-generated assetPack; fall back to tier if the
    // resolved id is somehow not a shipped monster.
    let monsterId = resolveBossModelId(this.boss.assetPack, this.boss.tier);
    if (!isMonsterId(monsterId)) monsterId = bossMonsterId(this.boss.tier);
    if (!isMonsterId(monsterId)) return;

    const tierScale = 1.5 + Math.max(0, Math.min(5, this.boss.tier)) * 0.16;
    const model = loadMonsterModel(monsterId, loader, (m) => {
      if (this.disposed) return;
      // Scale the whole boss up for menace; feet stay grounded (origin scale).
      m.group.scale.setScalar(tierScale);
      this.bossWorldHeight = m.height * tierScale;
    });
    model.group.position.copy(this.bossPos);
    this.scene.add(model.group);
    this.bossModel = model;
    this.bossGroup = model.group;
    this.bossWorldHeight = model.height * tierScale;

    this.pushLog(`${this.boss.name}${this.boss.title ? ", " + this.boss.title : ""} enters the arena.`);
    this.pushLog("Tip: red/orange circles detonate — step out or Shift-dodge (i-frames).");
    this.pushLog("Tip: Space jump · Q block · F attack · R special · 1-5 skills.");
  }

  // ── Input ─────────────────────────────────────────────────────────────────
  private _keyDown = (e: KeyboardEvent) => {
    this.keys.add(e.code);
    // F attack · Space jump · Q block (i-frame parry) · Shift dodge · R special
    if (e.code === "KeyF") this.attackNearest();
    if (e.code === "Space") {
      e.preventDefault();
      this.heroAnim?.trigger("jump");
    }
    // Q = block/parry — short invulnerability so circle strikes can still be avoided.
    if (e.code === "KeyQ") {
      e.preventDefault();
      this.doBlock();
    }
    if (e.code === "ShiftLeft" || e.code === "ShiftRight") {
      e.preventDefault();
      this.doDodge();
    }
    if (e.code === "KeyR") {
      e.preventDefault();
      this.useSkill(0); // special mapped to first skill slot in arena
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
    const ndc = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(ndc, this.camera);

    // Target the boss if clicked.
    if (this.bossGroup && this.bossAlive) {
      const hits = raycaster.intersectObject(this.bossGroup, true);
      if (hits.length > 0) {
        this.attackBoss = true;
        this.playerTarget = null;
        return;
      }
    }

    // Otherwise move to the ground point.
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hit = new THREE.Vector3();
    if (raycaster.ray.intersectPlane(plane, hit)) {
      this.clampToArena(hit);
      this.playerTarget = hit;
      this.attackBoss = false;
    }
  };

  // ── Player actions ──────────────────────────────────────────────────────────
  attackNearest() {
    if (this.bossAlive) {
      this.attackBoss = true;
      this.playerTarget = null;
    }
  }

  /** Constrain a position to the circular arena floor (radius BOUNDS - margin). */
  private clampToArena(p: THREE.Vector3, margin = 1) {
    const r = this.BOUNDS - margin;
    const len = Math.hypot(p.x, p.z);
    if (len > r) {
      p.x = (p.x / len) * r;
      p.z = (p.z / len) * r;
    }
    return p;
  }

  doDodge() {
    if (this.outcome !== "fighting") return;
    const now = performance.now();
    if (now < this.dodgeCdUntil) return;
    this.dodgeCdUntil = now + this.dodgeCdSec * 1000;
    // Invulnerability windows make projectiles and circle strikes dodgeable.
    this.iframeUntil = now + this.dodgeIframeSec * 1000;
    this.playerTarget = null;
    this.attackBoss = false;

    // Prefer the skin/racalvin dodge clip; always apply a logical dash so
    // sidestep distance is consistent even when the clip has no root motion.
    this.heroAnim?.trigger("dodge");
    const forward = new THREE.Vector3(Math.sin(this.playerFacing), 0, Math.cos(this.playerFacing));
    // Strafe preference when holding A/D so you can dodge *through* bolts.
    if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) {
      forward.set(-Math.cos(this.playerFacing), 0, Math.sin(this.playerFacing));
    } else if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) {
      forward.set(Math.cos(this.playerFacing), 0, -Math.sin(this.playerFacing));
    }
    this.playerPos.x += forward.x * this.dodgeDistance;
    this.playerPos.z += forward.z * this.dodgeDistance;
    this.clampToArena(this.playerPos);
    this.particles?.impact(
      this.playerPos.clone().setY(0.4),
      0xc5e8ff,
      0.55,
    );
  }

  /** Q block — shorter i-frames than dodge, no dash (parry circles / bolts). */
  doBlock() {
    if (this.outcome !== "fighting") return;
    const now = performance.now();
    // Share dodge cooldown so block/dodge can't chain-spam invuln.
    if (now < this.dodgeCdUntil) return;
    this.dodgeCdUntil = now + this.dodgeCdSec * 0.55 * 1000;
    this.iframeUntil = now + Math.min(0.45, this.dodgeIframeSec) * 1000;
    this.heroAnim?.trigger("cast");
    this.particles?.impact(this.playerPos.clone().setY(1.0), 0xffe9a0, 0.4);
  }

  /** True while the player cannot take damage (dodge i-frames). */
  private isInvulnerable(): boolean {
    return performance.now() < this.iframeUntil;
  }

  useSkill(idx: number) {
    if (idx < 0 || idx > 4 || this.outcome !== "fighting") return;
    const now = performance.now();
    if (now < (this.skillCdUntil[idx] ?? 0)) return;
    const cost = this.skillManaCost[idx] ?? 20;
    if (this.playerMana < cost) { this.pushLog("Not enough mana."); return; }
    this.playerMana -= cost;
    this.skillCdUntil[idx] = now + (this.skillCdLen[idx] ?? 5) * 1000;

    // Resolve the skill's archetype shape (idx fallback gives a broad mix).
    const arch = archetypeForSkill(this.hudSkills[idx], idx);
    const isCast = arch.shape === "circle" || arch.shape === "nova" || arch.shape === "deployable";
    // Auto-aim the boss so shaped skills read as aimed (before travel).
    if (this.bossAlive) {
      this.playerFacing = Math.atan2(this.bossPos.x - this.playerPos.x, this.bossPos.z - this.playerPos.z);
    }

    // Play skill clip; root motion (or committed lunge) carries the body to the
    // skill's end pose — never snap back to the pre-cast station.
    if (this.heroAnim) {
      const played = this.heroAnim.triggerNamed(skillAnimCandidates(idx, isCast));
      if (!played) this.commitSkillTravel(isCast ? 0.4 : 1.6);
      else if (!this.heroAnim.isRootMotionActive()) this.commitSkillTravel(isCast ? 0.35 : 1.4);
    } else {
      this.commitSkillTravel(isCast ? 0.4 : 1.6);
    }

    const dir = new THREE.Vector3(Math.sin(this.playerFacing), 0, Math.cos(this.playerFacing));
    const origin = this.playerPos.clone();

    // The Boss Arena keeps deployables as an instant AoE pulse (no spawns).
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
    this.skillTelegraphs?.show(q, arch.telegraph || 0.3, arch.color);

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

    // Boss is a single large target — allow a small reach tolerance.
    const tolerant: ShapeQuery = { ...q, radius: (arch.radius ?? 4) + 1.5, length: (arch.length ?? 8) + 1.5 };
    if (this.bossAlive && pointInShape(tolerant, this.bossPos)) {
      const isCrit = Math.random() < this.critChance + 0.05;
      const dmg = Math.round(this.baseDamage * arch.damageMult * (isCrit ? 2 : 1) * (0.85 + Math.random() * 0.3));
      this.damageBoss(dmg, isCrit);
      this.pushLog(`Skill ${idx + 1} blasts ${this.boss.name}!`);
    } else {
      this.pushLog(`Skill ${idx + 1} — boss out of range.`);
    }
    this.emitState();
  }

  /** Provide resolved HUD skills so archetypes map to real skill flavor. */
  setHudSkills(skills: (ClassSkill | undefined)[]) {
    this.hudSkills = skills;
  }

  /**
   * Commit a permanent forward displacement for skill/attack travel when the
   * active model has no root-motion bone (or no clip). The character ends at
   * the skill terminus — it does NOT ease back to the cast origin.
   */
  private commitSkillTravel(distance: number) {
    const forward = new THREE.Vector3(Math.sin(this.playerFacing), 0, Math.cos(this.playerFacing));
    const start = this.playerPos.clone();
    const end = start.clone().add(forward.multiplyScalar(Math.max(0.15, distance)));
    this.clampToArena(end);
    // Logical position lands at the skill end immediately so combat ranges match.
    this.playerPos.copy(end);
    // Smooth the mesh from the cast origin to the committed end (no return trip).
    if (!this.playerGroup) return;
    const g = this.playerGroup;
    g.position.copy(start);
    let t = 0;
    const dur = 0.28;
    const step = () => {
      if (this.disposed || !this.playerGroup) return;
      t += 0.016;
      const p = Math.min(1, t / dur);
      // Ease-out so the last frames settle on the end pose.
      const e = 1 - (1 - p) * (1 - p);
      g.position.lerpVectors(start, this.playerPos, e);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /** @deprecated Use commitSkillTravel — kept name alias for attack fallback. */
  private proceduralLunge() {
    this.commitSkillTravel(1.1);
  }

  // ── Boss combat ─────────────────────────────────────────────────────────────
  private bossActionInterval(): number {
    // Faster casts each phase — still telegraphed so circles/bolts stay readable.
    if (this.bossPhase >= 3) return 1.05;
    if (this.bossPhase >= 2) return 1.55;
    return 2.35;
  }

  private phaseDamageMul(): number {
    if (this.bossPhase >= 3) return 1.28;
    if (this.bossPhase >= 2) return 1.12;
    return 1;
  }

  private chooseAbility(distToPlayer: number): ArenaBossAbility | null {
    const now = performance.now();
    const ready = this.boss.abilities.filter((a) => now >= (this.abilityCdUntil.get(a.id) ?? 0));
    const pool = ready.length > 0 ? ready : this.boss.abilities;
    if (pool.length === 0) return null;

    // Phase-aware weighting: late phases push multi-circle / projectile patterns.
    const close = distToPlayer < this.bossMeleeRange + 1;
    const scored = pool.map((a) => {
      const t = normalizeAbilityType(a.type);
      let weight = 1;
      if (close && t === "melee") weight = this.bossPhase >= 2 ? 2.2 : 3.2;
      if (!close && (t === "ranged" || t === "magic")) weight = 2.8 + this.bossPhase * 0.4;
      if (t === "aoe") weight = 1.8 + this.bossPhase * 0.7;
      if (t === "debuff") weight = 1.2 + (this.bossPhase >= 2 ? 0.6 : 0);
      if (close && (t === "ranged" || t === "magic")) weight = 0.7 + this.bossPhase * 0.25;
      // Name hints (volley / meteor) get phase boosts even if typed generically.
      const n = a.name.toLowerCase();
      if (/volley|barrage|bolt|lance/.test(n)) weight *= 1.25;
      if (/nova|skyfall|meteor|ruin|circle/.test(n)) weight *= 1.2;
      return { a, weight };
    });
    const totalW = scored.reduce((s, x) => s + x.weight, 0);
    let r = Math.random() * totalW;
    for (const s of scored) {
      r -= s.weight;
      if (r <= 0) return s.a;
    }
    return scored[0]!.a;
  }

  private performAbility(ability: ArenaBossAbility) {
    const now = performance.now();
    // Phase shortens cooldowns slightly so the arena stays busy.
    const cdScale = this.bossPhase >= 3 ? 0.72 : this.bossPhase >= 2 ? 0.85 : 1;
    const cdSec = Math.max(1.8, Math.min(12, (ability.cooldown || 4) * cdScale));
    this.abilityCdUntil.set(ability.id, now + cdSec * 1000);
    const type = normalizeAbilityType(ability.type);
    const dmg = Math.max(
      8,
      Math.round((ability.damage || 30) * this.phaseDamageMul() * (0.85 + Math.random() * 0.3)),
    );
    const nameLc = ability.name.toLowerCase();

    if (type === "ranged" || type === "magic" || /volley|barrage/.test(nameLc)) {
      if (this.bossPhase >= 2 || /volley|barrage|fan/.test(nameLc)) {
        this.spawnProjectileVolley(ability, dmg, type === "magic", this.bossPhase >= 3 ? 5 : 3);
      } else {
        this.spawnProjectile(ability, dmg, type === "magic");
      }
      // Phase 3: follow a bolt volley with a small foot-circle under the player.
      if (this.bossPhase >= 3 && Math.random() < 0.55) {
        this.spawnTelegraph("aoe", this.playerPos.clone(), 2.6, 0.95, Math.round(dmg * 0.55), `${ability.name} Aftershock`);
      }
    } else if (type === "aoe" || /skyfall|meteor|rain|nova/.test(nameLc)) {
      if (this.bossPhase >= 2 || /skyfall|meteor|rain/.test(nameLc)) {
        this.spawnMultiCircles(dmg, ability.name, this.bossPhase >= 3 ? 5 : 3);
      } else {
        this.spawnTelegraph("aoe", this.playerPos.clone(), 4.4, 1.35, dmg, ability.name, true);
      }
    } else if (type === "debuff") {
      this.spawnTelegraph("debuff", this.playerPos.clone(), 3.4, 1.2, dmg, ability.name, true);
    } else {
      // Melee — circle in front of the boss toward the player (leave the red zone).
      const toP = new THREE.Vector3().subVectors(this.playerPos, this.bossPos).setY(0);
      if (toP.lengthSq() > 0.001) toP.normalize();
      const center = this.bossPos.clone().add(toP.multiplyScalar(this.bossMeleeRange * 0.55));
      const windup = this.bossPhase >= 3 ? 0.42 : 0.55;
      this.spawnTelegraph("melee", center, this.bossMeleeRange * 0.95, windup, dmg, ability.name, true);
      // Phase 2+: extra ring around the boss itself (dodge out).
      if (this.bossPhase >= 2) {
        this.spawnTelegraph(
          "melee",
          this.bossPos.clone(),
          3.2 + this.bossPhase * 0.35,
          windup + 0.15,
          Math.round(dmg * 0.7),
          `${ability.name} Shockwave`,
          true,
        );
      }
    }
    this.pushLog(`${this.boss.name} uses ${ability.name}.`);
  }

  /**
   * Fan of dodgeable projectiles. Angular spread grows with count so you can
   * step between bolts or i-frame through one of them.
   */
  private spawnProjectileVolley(ability: ArenaBossAbility, dmg: number, homing: boolean, count: number) {
    const n = Math.max(2, Math.min(7, count));
    const spread = (Math.PI / 7) * (n - 1);
    const base = Math.atan2(this.playerPos.x - this.bossPos.x, this.playerPos.z - this.bossPos.z);
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0.5 : i / (n - 1);
      const ang = base - spread / 2 + spread * spread;
      const dir = new THREE.Vector3(Math.sin(ang), 0, Math.cos(ang));
      // Only the center bolt homes slightly — side bolts stay linear so they are dodgeable.
      const isCenter = Math.abs(t - 0.5) < 0.01;
      this.spawnProjectile(ability, Math.round(dmg * (isCenter ? 1 : 0.72)), homing && isCenter, dir);
    }
  }

  /** Scatter danger circles around the player (meteor / skyfall pattern). */
  private spawnMultiCircles(dmg: number, label: string, count: number) {
    const n = Math.max(2, Math.min(6, count));
    // Always one on the player's current feet so standing still is punished.
    this.spawnTelegraph("aoe", this.playerPos.clone(), 3.1, 1.15, dmg, label, true);
    for (let i = 1; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 + Math.random() * 0.4;
      const dist = 3.2 + Math.random() * 4.5;
      const c = new THREE.Vector3(
        this.playerPos.x + Math.cos(ang) * dist,
        0,
        this.playerPos.z + Math.sin(ang) * dist,
      );
      this.clampToArena(c, 2);
      const windup = 0.95 + i * 0.12 + Math.random() * 0.2;
      this.spawnTelegraph("aoe", c, 2.6 + Math.random() * 0.9, windup, Math.round(dmg * 0.75), label, true);
    }
  }

  private spawnProjectile(
    ability: ArenaBossAbility,
    dmg: number,
    homing: boolean,
    forcedDir?: THREE.Vector3,
  ) {
    const color = homing ? 0xaa44ff : 0xff5522;
    const start = this.bossPos.clone().add(new THREE.Vector3(0, this.bossWorldHeight * 0.55, 0));
    // Readable size — bright additive orb.
    const sprite = this.particles.projectileSprite(color, homing ? 1.65 : 1.4);
    sprite.position.copy(start);
    this.scene.add(sprite);
    const light = new THREE.PointLight(color, 2.6, 10, 2);
    sprite.add(light);
    this.particles?.impact(start.clone(), color, 0.7);

    let dir: THREE.Vector3;
    if (forcedDir) {
      dir = forcedDir.clone().normalize();
    } else {
      const target = this.playerPos.clone().add(new THREE.Vector3(0, 1, 0));
      dir = new THREE.Vector3().subVectors(target, start).normalize();
    }
    // Speeds tuned so a mid-range dodge i-frame window can slip through.
    const speed = homing ? 9.5 : 13.5;

    // Ground shadow ring that tracks under the bolt (circle indication of path).
    let groundRing: THREE.Mesh | undefined;
    if (!this.projRingGeo) this.projRingGeo = new THREE.RingGeometry(0.45, 0.7, 28);
    const ringMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    groundRing = new THREE.Mesh(this.projRingGeo, ringMat);
    groundRing.rotation.x = -Math.PI / 2;
    groundRing.position.set(start.x, 0.05, start.z);
    groundRing.renderOrder = 3;
    this.scene.add(groundRing);

    // Lead marker: small danger circle at predicted intercept if linear.
    if (!homing) {
      const lead = this.playerPos.clone();
      const travel = start.distanceTo(lead.setY(start.y)) / speed;
      const pred = this.playerPos.clone().add(
        new THREE.Vector3(dir.x, 0, dir.z).multiplyScalar(0), // aim at current feet
      );
      this.skillTelegraphs?.showCircle(pred, 1.1, Math.min(1.1, travel * 0.85), color, { ring: true, y: 0.05 });
    }

    this.projectiles.push({
      sprite,
      light,
      pos: start.clone(),
      vel: dir.multiplyScalar(speed),
      life: 0,
      max: 3.6,
      damage: dmg,
      radius: 0.95, // tight hitbox — visual is larger so "dodge" feels generous
      homing,
      color,
      trailT: 0,
      dodgeable: true,
      groundRing,
    });
  }

  private spawnTelegraph(
    kind: TelegraphKind,
    center: THREE.Vector3,
    radius: number,
    windup: number,
    damage: number,
    label: string,
    ring = false,
  ) {
    const color =
      kind === "melee" ? 0xff3322
        : kind === "aoe" ? 0xff8800
          : kind === "phase" ? 0xff2244
            : 0xaa33ff;
    center.y = 0;
    // Filled sweep + hollow outer ring so the danger zone is unmistakable.
    this.skillTelegraphs?.showCircle(center.clone(), radius, windup, color, { ring: false, y: 0.06 });
    if (ring) {
      this.skillTelegraphs?.showCircle(center.clone(), radius, windup, color, { ring: true, y: 0.08 });
    }
    this.telegraphs.push({
      kind,
      center: center.clone(),
      radius,
      t: 0,
      windup,
      struck: false,
      damage,
      label,
    });
  }

  private damageBoss(amount: number, isCrit: boolean) {
    if (!this.bossAlive) return;
    this.bossHp = Math.max(0, this.bossHp - amount);
    this.bossFlash = 0.2;
    this.spawnDamageNumber(
      this.bossPos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.8, this.bossWorldHeight + 0.4, 0)),
      amount, isCrit, true,
    );

    // Phase transitions: 66% → P2, 33% → P3 (when boss has 3 phases), else 50%.
    const pct = this.bossHp / this.bossMaxHp;
    const maxPhases = Math.max(1, this.boss.phases);
    if (maxPhases >= 3) {
      if (this.bossPhase < 2 && pct <= 0.66) this.enterPhase(2);
      else if (this.bossPhase < 3 && pct <= 0.33) this.enterPhase(3);
    } else if (maxPhases >= 2) {
      if (this.bossPhase < 2 && pct <= 0.5) this.enterPhase(2);
    }

    if (this.bossHp <= 0) this.bossDies();
  }

  private enterPhase(phase: number) {
    this.bossPhase = phase;
    this.bossActionT = 0.35; // nearly immediate follow-up after the burst
    this.bossSpeed += 0.55;
    this.phaseAnnounceText = `PHASE ${phase}`;
    this.phaseAnnounceT = 2.4;
    this.pushLog(`${this.boss.name} enters Phase ${phase} — leave the crimson circle!`);

    // Phase burst: large ring telegraphed from the boss — must dodge out or i-frame.
    const burstR = 6.5 + phase * 1.1;
    const burstDmg = Math.round(40 * this.phaseDamageMul() * (1 + this.boss.tier * 0.08));
    this.spawnTelegraph("phase", this.bossPos.clone(), burstR, 1.4, burstDmg, `Phase ${phase} Burst`, true);
    // Secondary outer ring for phase 3.
    if (phase >= 3) {
      this.spawnTelegraph("phase", this.bossPos.clone(), burstR + 3.2, 1.7, Math.round(burstDmg * 0.6), "Outer Shockwave", true);
      this.spawnProjectileVolley(
        { id: "phase_volley", name: "Phase Volley", damage: Math.round(burstDmg * 0.45), type: "ranged", cooldown: 99 },
        Math.round(burstDmg * 0.45),
        false,
        5,
      );
    }

    this.spawnVfx(this.bossPos.clone(), 0xff2200, 8, 0.6);
    this.bossFlash = 0.55;
    this.emitState();
  }

  private bossDies() {
    this.bossAlive = false;
    this.bossDeadT = 0;
    this.outcome = "victory";
    this.phaseAnnounceText = null;
    this.phaseAnnounceT = 0;
    this.pushLog(`VICTORY — ${this.boss.name} has fallen!`);
    this.spawnVfx(this.bossPos.clone(), 0xffd060, 8, 0.9);
    this.emitState();
    if (!this.victoryFired) {
      this.victoryFired = true;
      this.options.onVictory?.();
    }
  }

  private damagePlayer(amount: number, label: string) {
    if (this.outcome !== "fighting") return;
    if (this.isInvulnerable()) {
      this.pushLog(`Dodged ${label}!`);
      this.particles?.impact(this.playerPos.clone().setY(1.2), 0xaadfff, 0.7);
      return;
    }
    const mitigated = Math.max(4, Math.round(amount));
    this.playerHp = Math.max(0, this.playerHp - mitigated);
    this.heroAnim?.trigger("hit");
    this.spawnDamageNumber(
      this.playerPos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.6, 2.4, 0)),
      mitigated, false, false,
    );
    this.pushLog(`${label} hits you for ${mitigated}.`);
    if (this.playerHp <= 0) this.playerDies();
  }

  private playerDies() {
    this.outcome = "defeat";
    this.pushLog("You have been slain in the arena.");
    this.emitState();
    if (!this.defeatFired) {
      this.defeatFired = true;
      this.options.onDefeat?.();
    }
  }

  // ── VFX + helpers ───────────────────────────────────────────────────────────
  /**
   * Ground detonation: an expanding particle nova + spark burst via the shared
   * ParticleVfx system (no primitive ring mesh). `grow` scales the radius.
   */
  private spawnVfx(at: THREE.Vector3, color: number, grow: number, _max: number) {
    this.particles?.nova(at.clone().setY(0.35), Math.max(1.5, grow * 0.5), color);
    this.particles?.impact(at.clone().setY(0.6), color, Math.min(2.2, 0.7 + grow * 0.12));
  }

  private spawnDamageNumber(world: THREE.Vector3, value: number, isCrit: boolean, isPlayer: boolean) {
    const sc = this.worldToScreen(world);
    this.damageNumbers.push({ id: this.dmgId++, x: sc.x, y: sc.y, value, isCrit, isPlayer, age: 0 });
    if (this.damageNumbers.length > 40) this.damageNumbers.splice(0, this.damageNumbers.length - 40);
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

  // ── Loop ──────────────────────────────────────────────────────────────────
  private animate = () => {
    this.animFrameId = requestAnimationFrame(this.animate);
    const delta = Math.min(this.clock.getDelta(), 0.05);
    this.update(delta);
    if (this.bloom) this.bloom.composer.render();
    else this.renderer.render(this.scene, this.camera);
  };

  private update(delta: number) {
    const elapsed = this.clock.getElapsedTime();
    const now = performance.now();
    const speed = now < this.slowUntil ? this.playerSpeed * 0.45 : this.playerSpeed;

    // ── Player movement ──
    const raw = new THREE.Vector2();
    if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) { raw.x -= 1; raw.y -= 1; }
    if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) { raw.x += 1; raw.y += 1; }
    if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) { raw.x -= 1; raw.y += 1; }
    if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) { raw.x += 1; raw.y -= 1; }

    let moving = false;
    if (raw.length() > 0 && this.outcome === "fighting") {
      raw.normalize();
      this.playerPos.x += raw.x * speed * delta;
      this.playerPos.z += raw.y * speed * delta;
      this.clampToArena(this.playerPos);
      this.playerTarget = null;
      this.attackBoss = false;
      this.playerFacing = Math.atan2(raw.x, raw.y);
      moving = true;
    } else if (this.attackBoss && this.bossAlive) {
      const to = new THREE.Vector3().subVectors(this.bossPos, this.playerPos).setY(0);
      const d = to.length();
      this.playerFacing = Math.atan2(to.x, to.z);
      if (d > this.attackRange) {
        to.normalize();
        this.playerPos.x += to.x * speed * delta;
        this.playerPos.z += to.z * speed * delta;
        this.clampToArena(this.playerPos);
        moving = true;
      }
    } else if (this.playerTarget) {
      const to = new THREE.Vector3().subVectors(this.playerTarget, this.playerPos).setY(0);
      const d = to.length();
      if (d > 0.2) {
        to.normalize();
        this.playerPos.x += to.x * speed * delta;
        this.playerPos.z += to.z * speed * delta;
        this.playerFacing = Math.atan2(to.x, to.z);
        moving = true;
      } else {
        this.playerTarget = null;
      }
    }

    // ── Player basic attack ──
    this.attackCdT = Math.max(0, this.attackCdT - delta);
    if (!moving && this.attackBoss && this.bossAlive) {
      const dist = this.bossPos.distanceTo(this.playerPos);
      if (dist <= this.attackRange + 1 && this.attackCdT <= 0) {
        this.attackCdT = this.attackInterval;
        if (this.heroAnim) {
          const played = this.heroAnim.trigger("attack");
          if (!played || !this.heroAnim.isRootMotionActive()) this.proceduralLunge();
        } else { this.proceduralLunge(); }
        const isCrit = Math.random() < this.critChance;
        const dmg = Math.round(this.baseDamage * (isCrit ? 2 : 1) * (0.85 + Math.random() * 0.3));
        this.damageBoss(dmg, isCrit);
      }
    }

    // ── Resource regen ──
    if (this.outcome === "fighting") {
      this.playerMana = Math.min(this.playerMaxMana, this.playerMana + 14 * delta);
      this.playerHp = Math.min(this.playerMaxHp, this.playerHp + 3 * delta);
    }

    // Mixer first, then root-motion sample, then fold travel into world position.
    // (Consume-before-update dropped the final frame and caused snap-back.)
    if (this.heroAnim) {
      this.heroAnim.setMoving(moving);
      this.heroAnim.update(delta);
      if (this.heroAnim.consumeRootMotion(this._rmTmp)) {
        this.playerPos.x += this._rmTmp.x;
        this.playerPos.z += this._rmTmp.z;
        this.clampToArena(this.playerPos);
      }
    }

    if (this.playerGroup) {
      const targetPos = new THREE.Vector3(this.playerPos.x, 0, this.playerPos.z);
      // During root-motion skills, stick tightly so the body never rubber-bands
      // back to a lagging wrapper position when the clip finishes.
      const blend = this.heroAnim?.isRootMotionActive() ? 0.9 : 0.4;
      this.playerGroup.position.lerp(targetPos, blend);
      this.playerGroup.rotation.y += (this.playerFacing - this.playerGroup.rotation.y) * 0.2;
    }

    this.skillVfx.update(delta);
    this.skillTelegraphs?.update(delta);
    this.particles?.update(delta);

    // ── Boss AI + movement + animation ──
    if (this.bossModel?.mixer) this.bossModel.mixer.update(delta);
    if (this.bossGroup) {
      if (this.bossAlive && this.outcome === "fighting") {
        const to = new THREE.Vector3().subVectors(this.playerPos, this.bossPos).setY(0);
        const dist = to.length();
        const faceYaw = Math.atan2(to.x, to.z);
        this.bossGroup.rotation.y += (faceYaw - this.bossGroup.rotation.y) * 0.08;
        if (dist > this.bossMeleeRange) {
          to.normalize();
          this.bossPos.x += to.x * this.bossSpeed * delta;
          this.bossPos.z += to.z * this.bossSpeed * delta;
          this.clampToArena(this.bossPos, 2);
        }
        this.bossGroup.position.lerp(new THREE.Vector3(this.bossPos.x, 0, this.bossPos.z), 0.15);

        // Action timer.
        this.bossActionT -= delta;
        if (this.bossActionT <= 0) {
          this.bossActionT = this.bossActionInterval() * (0.8 + Math.random() * 0.5);
          const ability = this.chooseAbility(dist);
          if (ability) this.performAbility(ability);
        }
      } else if (!this.bossAlive) {
        // Death tip-over.
        this.bossDeadT += delta;
        this.bossGroup.rotation.z = Math.min(Math.PI / 2.2, this.bossGroup.rotation.z + delta * 1.6);
        this.bossGroup.position.y = Math.max(-0.4, this.bossGroup.position.y - delta * 0.5);
      }

      // Hurt flash tint.
      if (this.bossModel) {
        if (this.bossFlash > 0) {
          this.bossFlash = Math.max(0, this.bossFlash - delta);
          const k = this.bossFlash / 0.2;
          for (const mm of this.bossModel.bodyMats) mm.emissive.setRGB(k, k * 0.15, 0);
        } else {
          for (const mm of this.bossModel.bodyMats) mm.emissive.setRGB(0, 0, 0);
        }
      }
    }

    this.updateProjectiles(delta);
    this.updateTelegraphs(delta);

    if (this.phaseAnnounceT > 0) {
      this.phaseAnnounceT = Math.max(0, this.phaseAnnounceT - delta);
      if (this.phaseAnnounceT <= 0) this.phaseAnnounceText = null;
    }

    // Damage numbers age out.
    for (let i = this.damageNumbers.length - 1; i >= 0; i--) {
      const d = this.damageNumbers[i]!;
      d.age += delta;
      // "Dodge" markers use value 0 + isCrit — age them out a bit faster.
      const maxAge = d.value === 0 ? 0.9 : 1.4;
      if (d.age > maxAge) this.damageNumbers.splice(i, 1);
    }

    // Brazier flicker.
    for (const f of this.braziers) {
      const s = 1 + Math.sin(elapsed * 7 + f.position.x) * 0.12;
      f.scale.set(s, 1.5 + Math.sin(elapsed * 5 + f.position.z) * 0.12, s);
      const light = (f.userData as { light?: THREE.PointLight }).light;
      if (light) light.intensity = 3.6 + Math.sin(elapsed * 6.5 + f.position.x) * 0.6;
    }

    // Camera + sun follow the player.
    const camTarget = new THREE.Vector3(this.playerPos.x * 0.5, 0, this.playerPos.z * 0.5);
    this.camera.position.lerp(camTarget.clone().add(new THREE.Vector3(22, 24, 22)), 0.05);
    this.camera.lookAt(camTarget);
    if (this.sun) {
      this.sun.position.set(this.playerPos.x + 18, 30, this.playerPos.z + 12);
      this.sun.target.position.set(this.playerPos.x, 0, this.playerPos.z);
      this.sun.target.updateMatrixWorld();
    }

    // Stream HUD state (~30 Hz).
    this.stateAccum += delta;
    if (this.stateAccum >= this.stateInterval) {
      this.stateAccum = 0;
      this.emitState();
    }
  }

  private disposeProjectile(p: Projectile) {
    this.scene.remove(p.sprite);
    (p.sprite.material as THREE.Material).dispose();
    if (p.groundRing) {
      this.scene.remove(p.groundRing);
      (p.groundRing.material as THREE.Material).dispose();
      p.groundRing = undefined;
    }
  }

  private updateProjectiles(delta: number) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i]!;
      p.life += delta;
      // Homing is soft and only for the first half of life so late dodges work.
      if (p.homing && p.life < p.max * 0.45 && this.outcome === "fighting") {
        const desired = new THREE.Vector3()
          .subVectors(this.playerPos.clone().setY(1), p.pos)
          .normalize()
          .multiplyScalar(p.vel.length());
        p.vel.lerp(desired, 0.045);
      }
      p.pos.addScaledVector(p.vel, delta);
      p.sprite.position.copy(p.pos);
      p.sprite.scale.setScalar((p.homing ? 1.65 : 1.4) * (1 + Math.sin(p.life * 22) * 0.12));

      if (p.groundRing) {
        p.groundRing.position.set(p.pos.x, 0.05, p.pos.z);
        const mat = p.groundRing.material as THREE.MeshBasicMaterial;
        mat.opacity = 0.35 + 0.25 * Math.sin(p.life * 14);
      }

      p.trailT += delta;
      if (p.trailT >= 0.06 && p.life < p.max * 0.9) {
        p.trailT = 0;
        this.particles?.impact(p.pos.clone(), p.color, 0.32);
      }

      const horizDist = Math.hypot(p.pos.x - this.playerPos.x, p.pos.z - this.playerPos.z);
      const hitPlayer = horizDist <= p.radius && Math.abs(p.pos.y - 1) < 2.2;
      const outOfBounds = Math.hypot(p.pos.x, p.pos.z) > this.BOUNDS + 2 || p.pos.y < -0.5;
      if ((hitPlayer && this.outcome === "fighting") || p.life > p.max || outOfBounds) {
        if (hitPlayer && this.outcome === "fighting") {
          if (p.dodgeable && this.isInvulnerable()) {
            this.pushLog("Dodged a projectile!");
            this.particles?.impact(p.pos.clone(), 0xc5e8ff, 0.9);
            this.spawnDamageNumber(
              this.playerPos.clone().add(new THREE.Vector3(0, 2.6, 0)),
              0,
              false,
              true,
            );
            // Zero shown as dodge cue via log; strip last 0-dmg number if needed.
            const last = this.damageNumbers[this.damageNumbers.length - 1];
            if (last && last.value === 0) {
              last.value = 0;
              // Reuse as visual "DODGE" by marking crit style gold for visibility.
              last.isCrit = true;
              last.isPlayer = true;
            }
          } else {
            this.damagePlayer(p.damage, this.boss.name + "'s bolt");
            this.spawnVfx(this.playerPos.clone(), p.color, 2, 0.4);
          }
        }
        this.disposeProjectile(p);
        this.projectiles.splice(i, 1);
      }
    }
  }

  private updateTelegraphs(delta: number) {
    this.activeTelegraphLabel = null;
    // The ground warning decal is owned by `skillTelegraphs` (TelegraphField),
    // updated in the main loop; here we only resolve the strike + its VFX.
    for (let i = this.telegraphs.length - 1; i >= 0; i--) {
      const tg = this.telegraphs[i]!;
      tg.t += delta;

      if (!tg.struck && this.outcome === "fighting") {
        const remaining = tg.windup - tg.t;
        // Prefer the soonest detonation as the HUD warning.
        if (!this.activeTelegraphLabel || remaining < 0.55) {
          this.activeTelegraphLabel =
            remaining <= 0.35 ? `DODGE — ${tg.label}` : tg.label;
        }
      }

      if (!tg.struck && tg.t >= tg.windup) {
        tg.struck = true;
        const color =
          tg.kind === "melee" || tg.kind === "phase" ? 0xff3322
            : tg.kind === "aoe" ? 0xff8800
              : 0xaa33ff;
        const inside = this.playerPos.distanceTo(tg.center) <= tg.radius + 0.15;
        this.spawnVfx(tg.center.clone(), color, tg.radius * 1.4, 0.45);
        this.skillVfx?.spawn(
          tg.kind === "debuff" ? "tornado" : "cloud",
          tg.center.clone(),
          tg.radius,
          1.0,
        );
        if (inside && this.outcome === "fighting") {
          // Circles are fully avoidable: leave the zone OR dodge i-frame at impact.
          if (this.isInvulnerable()) {
            this.pushLog(`Dodged ${tg.label}!`);
            this.particles?.impact(this.playerPos.clone().setY(1.1), 0xc5e8ff, 0.85);
          } else {
            this.damagePlayer(tg.damage, tg.label);
            if (tg.kind === "debuff") {
              this.slowUntil = performance.now() + 3000;
              this.pushLog("You are slowed!");
            }
          }
        }
      }

      if (tg.t >= tg.windup + 0.28) {
        this.telegraphs.splice(i, 1);
      }
    }
  }

  private emitState() {
    if (this.disposed || !this.options.onStateUpdate) return;
    const now = performance.now();
    const bossScreen = this.worldToScreen(this.bossPos.clone().add(new THREE.Vector3(0, this.bossWorldHeight + 0.6, 0)));
    const dodgeRemain = Math.max(0, this.dodgeCdUntil - now);
    this.options.onStateUpdate({
      loaded: this.loaded,
      outcome: this.outcome,
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
      dodgeReadyPct: 1 - dodgeRemain / (this.dodgeCdSec * 1000),
      iframeActive: this.isInvulnerable(),
      bossName: this.boss.name,
      bossTitle: this.boss.title ?? "",
      bossHp: this.bossHp,
      bossMaxHp: this.bossMaxHp,
      bossPhase: this.bossPhase,
      bossMaxPhases: Math.max(1, this.boss.phases),
      bossScreenX: bossScreen.x,
      bossScreenY: bossScreen.y,
      bossAlive: this.bossAlive,
      bossTelegraph: this.activeTelegraphLabel,
      phaseAnnounce: this.phaseAnnounceT > 0 ? this.phaseAnnounceText : null,
      damageNumbers: this.damageNumbers.map((d) => ({ ...d })),
      combatLog: this.combatLog.slice(),
    });
  }

  private onResize = () => {
    if (!this.container) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    const aspect = w / h;
    const d = 13;
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
    if (this.heroAnim) { this.heroAnim.dispose(); this.heroAnim = null; }
    this.skillVfx?.dispose();
    this.skillTelegraphs?.dispose();
    this.particles?.dispose();
    if (this.bossGroup) this.bossGroup.userData.disposed = true;
    if (this.bossModel) { disposeMonsterModel(this.bossModel); this.bossModel = null; }
    for (const p of this.projectiles) this.disposeProjectile(p);
    this.projectiles = [];
    this.telegraphs = [];
    this.braziers = [];
    this.playerGroup = null;
    this.bossGroup = null;
    this.projRingGeo?.dispose();
    this.projRingGeo = null;
    disposeObject3D(this.scene);
    this.scene.clear();
    this.bloom?.composer.dispose();
    this.bloom = null;
    this.renderer.dispose();
  }
}
