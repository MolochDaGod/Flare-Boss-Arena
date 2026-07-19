import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  disposeObject3D,
  loadActiveFighterModel,
  skillAnimCandidates,
  type HeroLike,
} from "./kaykitHero";
import { SkillVfx } from "./skillVfx";
import { vfxForArchetype, vfxForSkillSlot } from "../data/vfxHotkeys";
import { archetypeForSkill } from "./combat/skillArchetypes";
import { pointInShape, type ShapeQuery } from "./combat/damageShapes";
import { TelegraphField } from "./combat/telegraphs";
import { ParticleVfx } from "./combat/particles";
import { CombatVfx } from "./combat/combatVfx";
import { makeBloomComposer, type BloomComposer } from "./combat/bloom";
import {
  createIsoCameraState,
  isoCameraWheel,
  applyOrthoFrustum,
  updateIsoCamera,
  kickCameraShake,
  type IsoCameraState,
} from "./combat/isoCamera";
import { canDodge } from "./combatInput";
import type { ClassSkill } from "../data/classSkills";
import { loadMonsterModel, disposeMonsterModel, isMonsterId, isBossMonsterId } from "./MonsterModels";
import { BOSS_MONSTER_DEFS, BOSS_MONSTER_BY_ID } from "../data/bossMonsters";
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
  radius: number;
  homing: boolean;
  color: number;
  trailT: number;
}

type TelegraphKind = "melee" | "aoe" | "debuff";

interface Telegraph {
  kind: TelegraphKind;
  center: THREE.Vector3;
  radius: number;
  t: number;
  windup: number;
  struck: boolean;
  damage: number;
  label: string;
}

/** Pick a curated boss GLB by tier (dragons + ML bosses under models/bosses/). */
function bossMonsterId(tier: number): string {
  switch (Math.max(1, Math.min(5, Math.round(tier)))) {
    case 1: return "boss_fireworm";
    case 2: return "boss_framis_necro";
    case 3: return "boss_sora_cloud";
    case 4: return "boss_sun_monkey_king";
    default: return "boss_noble_dragon";
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
 * Resolve `assetPack` / localBoss pack ids to a shipped boss or monster GLB.
 * Prefers curated `models/bosses/*` (dragons, framis, sora, monkey king), then
 * themed mon_* fallbacks. Empty pack → tier-based boss pick.
 */
function resolveBossModelId(assetPack: string | undefined, tier: number): string {
  const pack = (assetPack ?? "").toLowerCase().trim();
  if (!pack || pack === "boss_character_default") return bossMonsterId(tier);

  // Exact curated boss id (localBoss packs use boss_noble_dragon etc.)
  if (isBossMonsterId(pack)) return pack;
  if (isBossMonsterId(`boss_${pack}`)) return `boss_${pack}`;
  // assetPack may be the bare file stem: noble_dragon → boss_noble_dragon
  for (const d of BOSS_MONSTER_DEFS) {
    if (pack === d.id || pack === d.file.replace(/\.glb$/i, "") || pack.includes(d.id.replace(/^boss_/, ""))) {
      return d.id;
    }
  }

  // Thematic keywords → curated boss GLBs first, then mon_* bodies.
  const keywordMap: Array<[RegExp, string]> = [
    [/noble|wyrm of|western/, "boss_noble_dragon"],
    [/tarisland|sky.?terror|drake/, "boss_tarisland_dragon"],
    [/fireworm|cinder|wyrmling/, "boss_fireworm"],
    [/framis|necro/, "boss_framis_necro"],
    [/sora|shifting.?cloud|cloud/, "boss_sora_cloud"],
    [/monkey|sun.?king|wukong|heaven/, "boss_sun_monkey_king"],
    [/dragon|wyrm|drake/, "boss_noble_dragon"],
    [/colossus|titan|giant|golem|wrath|dread|hulk|behemoth|leviathan/, "mon_dante_beast"],
    [/gloom|brute|ogre|troll|abomination/, "mon_medusa"],
    [/thorn|queen|briar|medusa|serpent|gorgon|witch|matriarch|naga/, "mon_medusa"],
    [/hunter|predator|beast|wolf|hound|stalker|fang|claw/, "mon_dante_beast"],
    [/cult|undead|wraith|lich|priest|acolyte|bone|grave/, "mon_cultist"],
    [/spider|arachnid|chitin|scuttle|pincher|crawler/, "mon_pincher"],
  ];
  for (const [re, id] of keywordMap) {
    if (re.test(pack)) return id;
  }

  // Stable hash into curated boss pool so every conjure gets a real boss body.
  const pool = BOSS_MONSTER_DEFS.map((d) => d.id);
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
  private combatVfx!: CombatVfx;
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
  private playerSpeed = 7;
  private slowUntil = 0;

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
  private lastDodgeAt = 0;

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
  private bossActionT = 2.5;
  private abilityCdUntil = new Map<string, number>();
  private activeTelegraphLabel: string | null = null;
  private bossMoving = false;
  /** Charge / leap lunge target (phase 2+ special movement). */
  private bossChargeTarget: THREE.Vector3 | null = null;
  private bossChargeT = 0;
  private phaseAura: THREE.PointLight | null = null;

  private projectiles: Projectile[] = [];
  private telegraphs: Telegraph[] = [];

  /** Iso camera: smooth zoom, velocity lead, combat shake. */
  private isoCam: IsoCameraState = createIsoCameraState({
    d: 13,
    dMin: 6,
    dMax: 26,
    offset: new THREE.Vector3(22, 24, 22),
  });
  private playerVel = new THREE.Vector3();
  private _dustAccum = 0;

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
  }

  init(container: HTMLElement) {
    this.container = container;
    const w = container.clientWidth;
    const h = container.clientHeight;
    const aspect = w / h;
    const d = this.isoCam.d;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x070608);
    this.scene.fog = new THREE.Fog(0x0a0608, 22, 72);
    this.skillVfx = new SkillVfx(this.scene, new GLTFLoader());
    this.skillTelegraphs = new TelegraphField(this.scene);
    this.particles = new ParticleVfx(this.scene);
    this.combatVfx = new CombatVfx(this.scene);

    this.camera = new THREE.OrthographicCamera(-d * aspect, d * aspect, d, -d, 0.1, 400);
    this.camera.position.set(22, 24, 22);
    this.camera.lookAt(0, 0, 0);
    this.isoCam.look.set(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.02;
    container.appendChild(this.renderer.domElement);
    this.bloom = makeBloomComposer(this.renderer, this.scene, this.camera, w, h, {
      strength: 0.7,
      radius: 0.52,
      threshold: 0.78,
      resolutionScale: 0.5,
      vignette: 0.85,
      warmth: 0.055,
    });

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
    // Wheel zoom on canvas (passive:false so we can prevent page scroll).
    this.renderer.domElement.addEventListener("wheel", this._onWheel, { passive: false });

    this.animFrameId = requestAnimationFrame(this.animate);
  }

  private _onWheel = (e: WheelEvent) => {
    isoCameraWheel(this.isoCam, e, 0.75, 1.5);
  };

  private applyCameraFrustum() {
    if (!this.container || !this.camera) return;
    const w = this.container.clientWidth;
    const h = Math.max(1, this.container.clientHeight);
    applyOrthoFrustum(this.camera, this.isoCam.d, w / h);
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

  // ── Boss ──────────────────────────────────────────────────────────────────
  private loadBoss() {
    const loader = new GLTFLoader();
    // Prefer curated boss GLBs (models/bosses); fall back to mon_* if needed.
    let monsterId = resolveBossModelId(this.boss.assetPack, this.boss.tier);
    if (!isMonsterId(monsterId)) monsterId = bossMonsterId(this.boss.tier);
    if (!isMonsterId(monsterId)) return;

    const isCuratedBoss = isBossMonsterId(monsterId);
    // Curated bosses already bake height + bossScale; mon_* get a tier menace scale.
    const tierScale = isCuratedBoss
      ? 1.05 + Math.max(0, Math.min(5, this.boss.tier)) * 0.06
      : 1.5 + Math.max(0, Math.min(5, this.boss.tier)) * 0.16;
    const def = BOSS_MONSTER_BY_ID.get(monsterId);
    const model = loadMonsterModel(monsterId, loader, (m) => {
      if (this.disposed) return;
      m.group.scale.setScalar(tierScale);
      this.bossWorldHeight = m.height * tierScale * (def?.bossScale ?? 1);
      // Entrance flourish
      this.spawnVfx(this.bossPos.clone(), 0xff6622, 6, 0.7);
      this.skillVfx?.spawn("cloud", this.bossPos.clone(), 5, 1.2);
      this.pushLog(
        `${this.boss.name}${this.boss.title ? ", " + this.boss.title : ""} enters the arena` +
          (def ? ` — ${def.name} form.` : "."),
      );
    });
    model.group.position.copy(this.bossPos);
    this.scene.add(model.group);
    this.bossModel = model;
    this.bossGroup = model.group;
    this.bossWorldHeight = model.height * tierScale;
  }

  // ── Input ─────────────────────────────────────────────────────────────────
  private _keyDown = (e: KeyboardEvent) => {
    this.keys.add(e.code);
    if (e.repeat) return;
    if (e.code === "KeyF") this.attackNearest();
    if (e.code === "Space") { e.preventDefault(); this.doJump(); }
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

  doJump() {
    if (this.outcome !== "fighting") return;
    if (this.heroAnim?.trigger("jump")) return;
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

  doDodge() {
    if (this.outcome !== "fighting") return;
    const now = performance.now();
    if (!canDodge(this.lastDodgeAt, now)) return;
    this.lastDodgeAt = now;
    this.playerTarget = null;
    // Dodge clips carry their own forward lunge via root motion; only dash
    // manually when the active model has no dodge clip (e.g. fighter skins).
    if (this.heroAnim?.trigger("dodge")) return;
    const forward = new THREE.Vector3(Math.sin(this.playerFacing), 0, Math.cos(this.playerFacing));
    this.playerPos.x += forward.x * 3.0;
    this.playerPos.z += forward.z * 3.0;
    this.clampToArena(this.playerPos);
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
    if (this.heroAnim) {
      const played = this.heroAnim.triggerNamed(skillAnimCandidates(idx, isCast));
      if (!played) this.proceduralLunge();
    } else {
      this.proceduralLunge();
    }

    // Auto-aim the boss so shaped skills read as aimed.
    if (this.bossAlive) {
      this.playerFacing = Math.atan2(this.bossPos.x - this.playerPos.x, this.bossPos.z - this.playerPos.z);
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
    // vfxgrudge.puter.site hotkeys → weapon skill GLB pack
    {
      const bind = vfxForArchetype(arch.element, kind, idx) ?? vfxForSkillSlot(idx);
      this.skillVfx.spawn(bind.glb, center, kind === "nova" || kind === "circle" ? 4.5 : 3.5, 1.15);
    }
    this.combatVfx.pulseCastAura(origin, arch.element);
    if (kind === "line") {
      this.combatVfx.fireProjectile(
        origin.clone().setY(1.2),
        this.bossPos.clone().setY(this.bossWorldHeight * 0.5),
        { element: arch.element, skillTags: this.hudSkills[idx]?.name },
      );
    }
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

  // ── Boss combat ─────────────────────────────────────────────────────────────
  private bossActionInterval(): number {
    if (this.bossPhase >= 3) return 1.25;
    if (this.bossPhase >= 2) return 1.9;
    return 2.7;
  }

  private chooseAbility(distToPlayer: number): ArenaBossAbility | null {
    const now = performance.now();
    const ready = this.boss.abilities.filter((a) => now >= (this.abilityCdUntil.get(a.id) ?? 0));
    const pool = ready.length > 0 ? ready : this.boss.abilities;
    if (pool.length === 0) return null;

    // Bias toward melee when the player is close, ranged/aoe when far.
    const close = distToPlayer < this.bossMeleeRange + 1;
    const scored = pool.map((a) => {
      const t = normalizeAbilityType(a.type);
      let weight = 1;
      if (close && t === "melee") weight = 3;
      if (!close && (t === "ranged" || t === "magic")) weight = 3;
      if (!close && (t === "aoe" || t === "debuff")) weight = 2.2;
      if (close && (t === "ranged" || t === "magic")) weight = 0.5;
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
    const phaseCdMul = this.bossPhase >= 3 ? 0.7 : this.bossPhase >= 2 ? 0.85 : 1;
    const cdSec = Math.max(1.6, Math.min(12, (ability.cooldown || 4) * phaseCdMul));
    this.abilityCdUntil.set(ability.id, now + cdSec * 1000);
    const type = normalizeAbilityType(ability.type);
    const phaseDmgMul = 1 + (this.bossPhase - 1) * 0.18;
    const dmg = Math.max(8, Math.round((ability.damage || 30) * phaseDmgMul * (0.85 + Math.random() * 0.3)));

    // Trigger attack animation when the GLB has a multi-clip bank.
    this.bossModel?.clipBank?.playAttack();

    if (type === "ranged" || type === "magic") {
      this.spawnProjectile(ability, dmg, type === "magic");
      // Phase 2+: volley extras. Phase 3: denser fan.
      const extras = this.bossPhase >= 3 ? 3 : this.bossPhase >= 2 ? 1 : 0;
      for (let i = 0; i < extras; i++) {
        const spread = (i + 1) * 0.35 * (i % 2 === 0 ? 1 : -1);
        this.spawnProjectileOffset(ability, Math.round(dmg * 0.55), type === "magic", spread);
      }
    } else if (type === "aoe") {
      // Multi-meteor pattern scales with phase (warnings + delayed strikes).
      const count = this.bossPhase >= 3 ? 4 : this.bossPhase >= 2 ? 2 : 1;
      const baseR = 3.6 + this.bossPhase * 0.4;
      const windup = Math.max(0.75, 1.35 - this.bossPhase * 0.12);
      for (let i = 0; i < count; i++) {
        const ang = (Math.PI * 2 * i) / count + Math.random() * 0.4;
        const dist = i === 0 ? 0 : 2.2 + Math.random() * 3.5;
        const c = this.playerPos.clone().add(
          new THREE.Vector3(Math.cos(ang) * dist, 0, Math.sin(ang) * dist),
        );
        this.clampToArena(c, 2);
        this.spawnTelegraph("aoe", c, baseR - i * 0.15, windup + i * 0.12, Math.round(dmg * (1 - i * 0.08)), ability.name);
      }
      if (this.bossPhase >= 2) {
        this.skillVfx?.spawn("tornado", this.playerPos.clone(), 3.5, 1.2);
      }
    } else if (type === "debuff") {
      this.spawnTelegraph("debuff", this.playerPos.clone(), 3.2 + this.bossPhase * 0.3, 1.0, dmg, ability.name);
      // Phase 3: second curse ring on the boss (don't stand in the center).
      if (this.bossPhase >= 3) {
        this.spawnTelegraph("debuff", this.bossPos.clone(), 5.5, 1.35, Math.round(dmg * 0.7), `${ability.name} Field`);
      }
    } else {
      // Melee — short wind-up swing; phase 2+ may charge at the player.
      const toP = new THREE.Vector3().subVectors(this.playerPos, this.bossPos).setY(0);
      if (toP.lengthSq() > 0.001) toP.normalize();
      if (this.bossPhase >= 2 && Math.random() < 0.45) {
        // Charge telegraph then lunge.
        this.bossChargeTarget = this.playerPos.clone();
        this.bossChargeT = 0.55;
        this.spawnTelegraph(
          "melee",
          this.playerPos.clone(),
          3.2,
          0.55,
          Math.round(dmg * 1.15),
          `${ability.name} — CHARGE`,
        );
        this.pushLog(`${this.boss.name} charges!`);
      } else {
        const center = this.bossPos.clone().add(toP.multiplyScalar(this.bossMeleeRange * 0.6));
        this.spawnTelegraph("melee", center, this.bossMeleeRange, 0.45, dmg, ability.name);
        // Phase 3: cleave ring around boss
        if (this.bossPhase >= 3) {
          this.spawnTelegraph("melee", this.bossPos.clone(), this.bossMeleeRange + 1.5, 0.7, Math.round(dmg * 0.65), "Cleave");
        }
      }
    }
    this.pushLog(`${this.boss.name} uses ${ability.name}.`);
  }

  /** Extra projectile with yaw offset (for phase volleys). */
  private spawnProjectileOffset(ability: ArenaBossAbility, dmg: number, homing: boolean, yawOffset: number) {
    const color = homing ? 0xaa44ff : 0xff5522;
    const start = this.bossPos.clone().add(new THREE.Vector3(0, this.bossWorldHeight * 0.55, 0));
    const target = this.playerPos.clone().add(new THREE.Vector3(0, 1, 0));
    const dir = new THREE.Vector3().subVectors(target, start).normalize();
    // Rotate around Y
    const cos = Math.cos(yawOffset);
    const sin = Math.sin(yawOffset);
    const dx = dir.x * cos - dir.z * sin;
    const dz = dir.x * sin + dir.z * cos;
    const aim = start.clone().add(new THREE.Vector3(dx, 0, dz).multiplyScalar(14));
    aim.y = target.y;
    if (!homing) {
      this.combatVfx.fireProjectile(start, aim, {
        element: "fire",
        skillTags: ability.name,
        preset: { primary: color, secondary: 0xffeeaa, speed: 16, gravity: 1.2, size: 0.32, spin: 10 },
        onHit: () => {
          if (this.outcome === "fighting") {
            this.damagePlayer(dmg, `${this.boss.name}'s volley`);
            this.spawnVfx(this.playerPos.clone(), color, 1.5, 0.3);
          }
        },
      });
      return;
    }
    const sprite = this.particles.projectileSprite(color, 1.2);
    sprite.position.copy(start);
    this.scene.add(sprite);
    const light = new THREE.PointLight(color, 1.8, 7, 2);
    sprite.add(light);
    this.projectiles.push({
      sprite,
      light,
      pos: start.clone(),
      vel: new THREE.Vector3(dx, 0.05, dz).normalize().multiplyScalar(11),
      life: 0,
      max: 2.8,
      damage: dmg,
      radius: 1.1,
      homing: true,
      color,
      trailT: 0,
    });
  }

  private spawnProjectile(ability: ArenaBossAbility, dmg: number, homing: boolean) {
    const color = homing ? 0xaa44ff : 0xff5522;
    const start = this.bossPos.clone().add(new THREE.Vector3(0, this.bossWorldHeight * 0.55, 0));
    this.particles?.impact(start.clone(), color, 0.7);

    const target = this.playerPos.clone().add(new THREE.Vector3(0, 1, 0));

    if (!homing) {
      this.combatVfx.fireProjectile(start, target, {
        element: homing ? "arcane" : "fire",
        skillTags: ability.name,
        preset: { primary: color, secondary: 0xffeeaa, speed: 18, gravity: 1.5, size: 0.4, spin: 10 },
        onHit: () => {
          if (this.outcome === "fighting") {
            this.damagePlayer(dmg, `${this.boss.name}'s bolt`);
            this.spawnVfx(this.playerPos.clone(), color, 2, 0.4);
          }
        },
      });
      return;
    }

    const sprite = this.particles.projectileSprite(color, 1.5);
    sprite.position.copy(start);
    this.scene.add(sprite);
    const light = new THREE.PointLight(color, 2.4, 9, 2);
    sprite.add(light);
    const dir = new THREE.Vector3().subVectors(target, start).normalize();
    this.projectiles.push({
      sprite,
      light,
      pos: start.clone(),
      vel: dir.multiplyScalar(12),
      life: 0,
      max: 3.2,
      damage: dmg,
      radius: 1.2,
      homing,
      color,
      trailT: 0,
    });
  }

  private spawnTelegraph(kind: TelegraphKind, center: THREE.Vector3, radius: number, windup: number, damage: number, label: string) {
    const color = kind === "melee" ? 0xff3322 : kind === "aoe" ? 0xff8800 : 0xaa33ff;
    center.y = 0;
    // Wind-up warning uses the shared native-shader ground telegraph (a circle
    // that sweeps its fill over the wind-up), not primitive ring/disc meshes.
    this.skillTelegraphs?.show(
      { kind: "circle", origin: center.clone(), dir: new THREE.Vector3(1, 0, 0), radius },
      windup,
      color,
    );
    this.telegraphs.push({ kind, center: center.clone(), radius, t: 0, windup, struck: false, damage, label });
  }

  private damageBoss(amount: number, isCrit: boolean) {
    if (!this.bossAlive) return;
    this.bossHp = Math.max(0, this.bossHp - amount);
    this.bossFlash = 0.2;
    this.bossModel?.clipBank?.playHit();
    this.spawnDamageNumber(
      this.bossPos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.8, this.bossWorldHeight + 0.4, 0)),
      amount, isCrit, true,
    );

    // Phase transitions at 66% / 33% when 3 phases, else 50% / 20%.
    const pct = this.bossHp / this.bossMaxHp;
    const p2 = this.boss.phases >= 3 ? 0.66 : 0.5;
    const p3 = this.boss.phases >= 3 ? 0.33 : 0.2;
    if (this.bossPhase < 2 && pct <= p2) this.enterPhase(2);
    else if (this.bossPhase < 3 && this.boss.phases >= 3 && pct <= p3) this.enterPhase(3);

    if (this.bossHp <= 0) this.bossDies();
  }

  private enterPhase(phase: number) {
    this.bossPhase = phase;
    this.bossActionT = Math.min(this.bossActionT, 0.45);
    this.bossSpeed += 0.85;
    const phaseNames = ["", "Awakening", "Enrage", "Last Stand"];
    const label = phaseNames[phase] ?? `Phase ${phase}`;
    this.pushLog(`⚠ STAGE ${phase}: ${this.boss.name} — ${label}!`);
    this.activeTelegraphLabel = `STAGE ${phase} — ${label}`;
    kickCameraShake(this.isoCam, 0.55 + phase * 0.12);
    this.bloom?.kick(0.55);

    // Arena-wide phase shockwave: ring of warning circles + nova VFX.
    this.spawnVfx(this.bossPos.clone(), phase >= 3 ? 0xff0044 : 0xff4400, 9, 0.8);
    this.skillVfx?.spawn(phase >= 3 ? "tornado" : "cloud", this.bossPos.clone(), 6 + phase, 1.4);
    this.bossFlash = 0.55;
    this.bossModel?.clipBank?.playAttack();

    // Phase transition slam: expanding ring telegraphs the player must leave.
    const rings = phase >= 3 ? 3 : 2;
    for (let i = 0; i < rings; i++) {
      const r = 3.5 + i * 2.8;
      this.spawnTelegraph(
        "aoe",
        this.bossPos.clone(),
        r,
        0.9 + i * 0.2,
        Math.round(28 + this.boss.tier * 8 + phase * 12),
        `Stage ${phase} Shockwave`,
      );
    }
    // Phase 3: seed delayed meteors on the player path.
    if (phase >= 3) {
      for (let i = 0; i < 5; i++) {
        const ang = (Math.PI * 2 * i) / 5;
        const c = this.playerPos.clone().add(new THREE.Vector3(Math.cos(ang) * 4, 0, Math.sin(ang) * 4));
        this.clampToArena(c, 2);
        this.spawnTelegraph("aoe", c, 3.0, 1.1 + i * 0.08, Math.round(35 + this.boss.tier * 6), "Last Stand Meteor");
      }
    }

    // Persistent phase aura light (hotter each stage).
    if (this.phaseAura) {
      this.scene.remove(this.phaseAura);
      this.phaseAura.dispose();
    }
    const auraColor = phase >= 3 ? 0xff0066 : phase >= 2 ? 0xff4400 : 0xffaa22;
    this.phaseAura = new THREE.PointLight(auraColor, 2.2 + phase * 0.8, 18, 2);
    this.phaseAura.position.set(this.bossPos.x, this.bossWorldHeight * 0.6, this.bossPos.z);
    this.scene.add(this.phaseAura);

    this.emitState();
  }

  private bossDies() {
    this.bossAlive = false;
    this.bossDeadT = 0;
    this.outcome = "victory";
    this.pushLog(`VICTORY — ${this.boss.name} has fallen!`);
    this.spawnVfx(this.bossPos.clone(), 0xffd060, 8, 0.9);
    this.skillVfx?.spawn("cloud", this.bossPos.clone(), 7, 1.5);
    this.bossModel?.clipBank?.playDeath();
    if (this.phaseAura) {
      this.scene.remove(this.phaseAura);
      this.phaseAura.dispose();
      this.phaseAura = null;
    }
    this.emitState();
    if (!this.victoryFired) {
      this.victoryFired = true;
      this.options.onVictory?.();
    }
  }

  private damagePlayer(amount: number, label: string) {
    if (this.outcome !== "fighting") return;
    const mitigated = Math.max(4, Math.round(amount));
    this.playerHp = Math.max(0, this.playerHp - mitigated);
    this.heroAnim?.trigger("hit");
    kickCameraShake(this.isoCam, Math.min(0.6, 0.2 + mitigated * 0.005));
    this.bloom?.kick(0.28);
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
    const accel = 34;
    const friction = 18;

    // ── Player movement (velocity-based for camera lead + dust) ──
    const raw = new THREE.Vector2();
    if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) { raw.x -= 1; raw.y -= 1; }
    if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) { raw.x += 1; raw.y += 1; }
    if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) { raw.x -= 1; raw.y += 1; }
    if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) { raw.x += 1; raw.y -= 1; }

    let moving = false;
    if (raw.length() > 0 && this.outcome === "fighting") {
      raw.normalize();
      const k = 1 - Math.exp(-accel * delta);
      this.playerVel.x += (raw.x * speed - this.playerVel.x) * k;
      this.playerVel.z += (raw.y * speed - this.playerVel.z) * k;
      this.playerTarget = null;
      this.attackBoss = false;
      this.playerFacing = Math.atan2(raw.x, raw.y);
      moving = true;
    } else if (this.attackBoss && this.bossAlive && this.outcome === "fighting") {
      const to = new THREE.Vector3().subVectors(this.bossPos, this.playerPos).setY(0);
      const d = to.length();
      this.playerFacing = Math.atan2(to.x, to.z);
      if (d > this.attackRange) {
        to.normalize();
        const k = 1 - Math.exp(-accel * delta);
        this.playerVel.x += (to.x * speed - this.playerVel.x) * k;
        this.playerVel.z += (to.z * speed - this.playerVel.z) * k;
        moving = true;
      } else {
        this.playerVel.multiplyScalar(Math.exp(-friction * delta));
      }
    } else if (this.playerTarget && this.outcome === "fighting") {
      const to = new THREE.Vector3().subVectors(this.playerTarget, this.playerPos).setY(0);
      const d = to.length();
      if (d > 0.25) {
        to.normalize();
        const k = 1 - Math.exp(-accel * delta);
        this.playerVel.x += (to.x * speed - this.playerVel.x) * k;
        this.playerVel.z += (to.z * speed - this.playerVel.z) * k;
        this.playerFacing = Math.atan2(to.x, to.z);
        moving = true;
      } else {
        this.playerTarget = null;
        this.playerVel.set(0, 0, 0);
      }
    } else {
      this.playerVel.multiplyScalar(Math.exp(-friction * delta));
      if (this.playerVel.lengthSq() < 0.04) this.playerVel.set(0, 0, 0);
    }
    if (this.playerVel.lengthSq() > 1e-6) {
      this.playerPos.x += this.playerVel.x * delta;
      this.playerPos.z += this.playerVel.z * delta;
      this.clampToArena(this.playerPos);
      if (this.playerVel.lengthSq() > 1.2) moving = true;
    }
    if (moving && this.playerVel.lengthSq() > 12) {
      this._dustAccum += delta;
      if (this._dustAccum >= 0.1) {
        this._dustAccum = 0;
        this.particles?.impact(this.playerPos.clone().setY(0.12), 0x8a7060, 0.26);
      }
    } else {
      this._dustAccum = 0;
    }

    // Root motion: let lunging/dodge/jump clips carry the logical position so
    // the mesh moves WITH the character instead of sliding and snapping back.
    if (this.heroAnim && this.heroAnim.consumeRootMotion(this._rmTmp)) {
      this.playerPos.x += this._rmTmp.x;
      this.playerPos.z += this._rmTmp.z;
      this.clampToArena(this.playerPos);
    }

    if (this.playerGroup) {
      this.playerGroup.position.lerp(new THREE.Vector3(this.playerPos.x, 0, this.playerPos.z), 0.3);
      this.playerGroup.rotation.y += (this.playerFacing - this.playerGroup.rotation.y) * 0.2;
    }

    // ── Player basic attack ──
    this.attackCdT = Math.max(0, this.attackCdT - delta);
    if (!moving && this.attackBoss && this.bossAlive) {
      const dist = this.bossPos.distanceTo(this.playerPos);
      if (dist <= this.attackRange + 1 && this.attackCdT <= 0) {
        this.attackCdT = this.attackInterval;
        if (this.heroAnim) {
          const played = this.heroAnim.trigger("attack");
          if (!played) this.proceduralLunge();
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

    if (this.heroAnim) {
      this.heroAnim.setMoving(moving);
      this.heroAnim.update(delta);
    }

    this.skillVfx.update(delta);
    this.combatVfx.update(delta);
    this.skillTelegraphs?.update(delta);
    this.particles?.update(delta);

    // ── Boss AI + movement + animation ──
    if (this.bossModel?.clipBank) this.bossModel.clipBank.update(delta);
    else if (this.bossModel?.mixer) this.bossModel.mixer.update(delta);
    if (this.bossGroup) {
      this.bossMoving = false;
      if (this.bossAlive && this.outcome === "fighting") {
        const to = new THREE.Vector3().subVectors(this.playerPos, this.bossPos).setY(0);
        const dist = to.length();
        const faceYaw = Math.atan2(to.x, to.z);
        this.bossGroup.rotation.y += (faceYaw - this.bossGroup.rotation.y) * 0.08;

        // Charge lunge (telegraphed melee special).
        if (this.bossChargeTarget && this.bossChargeT > 0) {
          this.bossChargeT -= delta;
          if (this.bossChargeT <= 0) {
            const chargeDir = new THREE.Vector3()
              .subVectors(this.bossChargeTarget, this.bossPos)
              .setY(0);
            if (chargeDir.lengthSq() > 0.01) {
              chargeDir.normalize();
              this.bossPos.x += chargeDir.x * Math.min(dist, 8);
              this.bossPos.z += chargeDir.z * Math.min(dist, 8);
              this.clampToArena(this.bossPos, 2);
            }
            this.spawnVfx(this.bossPos.clone(), 0xff2200, 5, 0.5);
            this.bossChargeTarget = null;
            this.bossMoving = true;
          }
        } else if (dist > this.bossMeleeRange) {
          to.normalize();
          // Phase 3: occasional sidestep strafe for more dynamic movement.
          if (this.bossPhase >= 3 && Math.random() < 0.02) {
            const side = new THREE.Vector3(-to.z, 0, to.x).multiplyScalar(this.bossSpeed * 1.4 * delta);
            this.bossPos.x += side.x;
            this.bossPos.z += side.z;
          } else {
            this.bossPos.x += to.x * this.bossSpeed * delta;
            this.bossPos.z += to.z * this.bossSpeed * delta;
          }
          this.clampToArena(this.bossPos, 2);
          this.bossMoving = true;
        } else if (this.bossPhase >= 2 && dist < this.bossMeleeRange * 0.45) {
          // Backstep when player is too close (phase 2+).
          to.normalize();
          this.bossPos.x -= to.x * this.bossSpeed * 0.7 * delta;
          this.bossPos.z -= to.z * this.bossSpeed * 0.7 * delta;
          this.clampToArena(this.bossPos, 2);
          this.bossMoving = true;
        }

        this.bossGroup.position.lerp(new THREE.Vector3(this.bossPos.x, 0, this.bossPos.z), 0.15);
        this.bossModel?.clipBank?.setMoving(this.bossMoving);

        // Action timer.
        this.bossActionT -= delta;
        if (this.bossActionT <= 0) {
          this.bossActionT = this.bossActionInterval() * (0.8 + Math.random() * 0.5);
          const ability = this.chooseAbility(dist);
          if (ability) this.performAbility(ability);
        }

        // Phase aura follows boss.
        if (this.phaseAura) {
          this.phaseAura.position.set(this.bossPos.x, this.bossWorldHeight * 0.55, this.bossPos.z);
          this.phaseAura.intensity = 2 + this.bossPhase * 0.7 + Math.sin(elapsed * 6) * 0.4;
        }
      } else if (!this.bossAlive) {
        // Death tip-over (if no death clip) / settle.
        this.bossDeadT += delta;
        if (!this.bossModel?.clipBank) {
          this.bossGroup.rotation.z = Math.min(Math.PI / 2.2, this.bossGroup.rotation.z + delta * 1.6);
          this.bossGroup.position.y = Math.max(-0.4, this.bossGroup.position.y - delta * 0.5);
        }
      }

      // Hurt flash tint (phase-tinted).
      if (this.bossModel) {
        if (this.bossFlash > 0) {
          this.bossFlash = Math.max(0, this.bossFlash - delta);
          const k = this.bossFlash / 0.25;
          const r = this.bossPhase >= 3 ? 1 : 1;
          const g = this.bossPhase >= 3 ? 0.05 : 0.15;
          const b = this.bossPhase >= 3 ? 0.25 : 0;
          for (const mm of this.bossModel.bodyMats) mm.emissive.setRGB(k * r, k * g, k * b);
        } else {
          for (const mm of this.bossModel.bodyMats) mm.emissive.setRGB(0, 0, 0);
        }
      }
    }

    this.updateProjectiles(delta);
    this.updateTelegraphs(delta);

    // Damage numbers age out.
    for (let i = this.damageNumbers.length - 1; i >= 0; i--) {
      this.damageNumbers[i]!.age += delta;
      if (this.damageNumbers[i]!.age > 1.4) this.damageNumbers.splice(i, 1);
    }

    // Brazier flicker.
    for (const f of this.braziers) {
      const s = 1 + Math.sin(elapsed * 7 + f.position.x) * 0.12;
      f.scale.set(s, 1.5 + Math.sin(elapsed * 5 + f.position.z) * 0.12, s);
      const light = (f.userData as { light?: THREE.PointLight }).light;
      if (light) light.intensity = 3.6 + Math.sin(elapsed * 6.5 + f.position.x) * 0.6;
    }

    // Iso camera: velocity lead, smooth zoom, combat shake; mild dual-focus with boss.
    const focus = this.playerPos.clone();
    if (this.bossAlive) {
      // Pull framing slightly toward the boss so both fighters stay readable.
      focus.x = this.playerPos.x * 0.72 + this.bossPos.x * 0.28;
      focus.z = this.playerPos.z * 0.72 + this.bossPos.z * 0.28;
    }
    updateIsoCamera(this.camera, this.isoCam, focus, this.playerVel, delta, {
      lead: 0.18,
      follow: 8,
      lookFollow: 10,
      zoomFollow: 12,
      defaultD: 13,
    });
    this.applyCameraFrustum();
    this.bloom?.update(delta);
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

  private updateProjectiles(delta: number) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i]!;
      p.life += delta;
      if (p.homing && p.life < p.max * 0.5 && this.outcome === "fighting") {
        const desired = new THREE.Vector3().subVectors(this.playerPos.clone().setY(1), p.pos).normalize().multiplyScalar(p.vel.length());
        p.vel.lerp(desired, 0.06);
      }
      p.pos.addScaledVector(p.vel, delta);
      p.sprite.position.copy(p.pos);
      // Subtle pulse so the bolt reads as live energy.
      p.sprite.scale.setScalar((p.homing ? 1.5 : 1.25) * (1 + Math.sin(p.life * 22) * 0.12));

      // Ember trail via the shared particle system (throttled).
      p.trailT += delta;
      if (p.trailT >= 0.06 && p.life < p.max * 0.9) {
        p.trailT = 0;
        this.particles?.impact(p.pos.clone(), p.color, 0.32);
      }

      const hitPlayer = p.pos.distanceTo(this.playerPos.clone().setY(p.pos.y)) <= p.radius;
      const outOfBounds = Math.hypot(p.pos.x, p.pos.z) > this.BOUNDS + 2 || p.pos.y < 0;
      if ((hitPlayer && this.outcome === "fighting") || p.life > p.max || outOfBounds) {
        if (hitPlayer && this.outcome === "fighting") {
          this.damagePlayer(p.damage, this.boss.name + "'s bolt");
          this.spawnVfx(this.playerPos.clone(), p.color, 2, 0.4);
        }
        this.scene.remove(p.sprite);
        (p.sprite.material as THREE.Material).dispose();
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

      if (!tg.struck && this.outcome === "fighting") this.activeTelegraphLabel = tg.label;

      if (!tg.struck && tg.t >= tg.windup) {
        tg.struck = true;
        const color = tg.kind === "melee" ? 0xff3322 : tg.kind === "aoe" ? 0xff8800 : 0xaa33ff;
        const inside = this.playerPos.distanceTo(tg.center) <= tg.radius;
        // Detonation: particle nova + a GLB flourish (cloud burst) on the strike.
        this.spawnVfx(tg.center.clone(), color, tg.radius * 1.4, 0.45);
        this.skillVfx?.spawn(tg.kind === "debuff" ? "tornado" : "cloud", tg.center.clone(), tg.radius, 1.0);
        if (inside && this.outcome === "fighting") {
          this.damagePlayer(tg.damage, tg.label);
          if (tg.kind === "debuff") {
            this.slowUntil = performance.now() + 3000;
            this.pushLog("You are slowed!");
          }
        }
      }

      if (tg.t >= tg.windup + 0.25) {
        this.telegraphs.splice(i, 1);
      }
    }
  }

  private emitState() {
    if (this.disposed || !this.options.onStateUpdate) return;
    const now = performance.now();
    const bossScreen = this.worldToScreen(this.bossPos.clone().add(new THREE.Vector3(0, this.bossWorldHeight + 0.6, 0)));
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
      bossName: this.boss.name,
      bossTitle: this.boss.title ?? "",
      bossHp: this.bossHp,
      bossMaxHp: this.bossMaxHp,
      bossPhase: this.bossPhase,
      bossMaxPhases: this.boss.phases,
      bossScreenX: bossScreen.x,
      bossScreenY: bossScreen.y,
      bossAlive: this.bossAlive,
      bossTelegraph: this.activeTelegraphLabel,
      damageNumbers: this.damageNumbers.map((d) => ({ ...d })),
      combatLog: this.combatLog.slice(),
    });
  }

  private onResize = () => {
    if (!this.container) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.renderer.setSize(w, h);
    this.bloom?.setSize(w, h, 0.5);
    this.applyCameraFrustum();
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.animFrameId);
    window.removeEventListener("resize", this.onResize);
    window.removeEventListener("keydown", this._keyDown);
    window.removeEventListener("keyup", this._keyUp);
    if (this.container) {
      this.container.removeEventListener("click", this._click);
      this.renderer?.domElement?.removeEventListener("wheel", this._onWheel);
      if (this.renderer.domElement.parentNode === this.container) {
        this.container.removeChild(this.renderer.domElement);
      }
    }
    if (this.phaseAura) {
      this.scene?.remove(this.phaseAura);
      this.phaseAura.dispose();
      this.phaseAura = null;
    }
    if (this.heroAnim) { this.heroAnim.dispose(); this.heroAnim = null; }
    this.skillVfx?.dispose();
    this.combatVfx?.dispose();
    this.skillTelegraphs?.dispose();
    this.particles?.dispose();
    if (this.bossGroup) this.bossGroup.userData.disposed = true;
    if (this.bossModel) { disposeMonsterModel(this.bossModel); this.bossModel = null; }
    for (const p of this.projectiles) {
      this.scene.remove(p.sprite);
      (p.sprite.material as THREE.Material).dispose();
    }
    this.projectiles = [];
    this.telegraphs = [];
    this.braziers = [];
    this.playerGroup = null;
    this.bossGroup = null;
    disposeObject3D(this.scene);
    this.scene.clear();
    this.bloom?.dispose();
    this.bloom = null;
    this.renderer.dispose();
  }
}
