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
import { CombatVfx } from "./combat/combatVfx";
import { makeBloomComposer, type BloomComposer } from "./combat/bloom";
import { canDodge } from "./combatInput";
import {
  resolveDodge,
  dodgeClipCandidates,
  DODGE_IFRAME_S,
} from "./dodgeMath";
import type { ClassSkill } from "../data/classSkills";
import { loadMonsterModel, disposeMonsterModel, isMonsterId } from "./MonsterModels";
import type { EnemyModel } from "./EnemyFactory";
import { makeGroundMaterial } from "./proceduralTextures";
import type { PlayerSnapshot } from "@workspace/net-protocol";

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

export type BossFightStyle =
  | "brawler"
  | "artillery"
  | "flying"
  | "necromancer"
  | "gorgon"
  | "colossus"
  | "skirmisher"
  | "duelist"
  | "elemental"
  | "dragon";

export interface ArenaBossInput {
  id: number;
  name: string;
  title?: string;
  maxHp: number;
  phases: number;
  tier: number;
  assetPack?: string;
  abilities: ArenaBossAbility[];
  /** Fight style from boss roster — drives AI + telegraphs. */
  style?: BossFightStyle;
  /** Explicit model id (boss_*, mon_*, cdn_*). */
  modelId?: string;
  flying?: boolean;
  bossScale?: number;
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
  /** Connected PvP remote count (excluding local). */
  remotePlayerCount: number;
  mpRoom: string | null;
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

/** Pick an in-repo monster GLB to embody the boss, by tier. */
function bossMonsterId(tier: number): string {
  switch (Math.max(1, Math.min(5, Math.round(tier)))) {
    case 1:
      return "mon_cultist";
    case 2:
      return "mon_pincher";
    case 3:
      return "mon_dante_beast";
    case 4:
      return "mon_medusa";
    default:
      return "mon_big_scary_t3";
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
 * Resolve assetPack / modelId to a loadable monster id.
 * Supports boss_* (public/models/bosses), mon_*, cdn_*, and keyword packs.
 */
function resolveBossModelId(
  assetPack: string | undefined,
  tier: number,
  modelId?: string,
): string {
  if (modelId && isMonsterId(modelId)) return modelId;

  const pack = (assetPack ?? "").trim();
  if (pack && isMonsterId(pack)) return pack;

  const lower = pack.toLowerCase();
  if (!lower || lower === "boss_character_default") return bossMonsterId(tier);

  // Direct boss pack aliases from legacy localBoss names
  const direct: Record<string, string> = {
    boss_noble_dragon: "boss_noble_dragon",
    boss_tarisland_dragon: "boss_tarisland_dragon",
    boss_fireworm: "boss_fireworm",
    boss_framis_necro: "boss_framis_necro",
    boss_sora_cloud: "boss_sora_cloud",
    boss_sun_monkey_king: "boss_sun_monkey_king",
    // CDN ids must match real asset stems (see data/cdnMonsters.ts)
    cdn_flying_demon: "cdn_flying_demon",
    cdn_dragon: "cdn_dragon",
    cdn_demon: "cdn_demon",
    cdn_yeti: "cdn_yeti",
    cdn_ghost: "cdn_ghost",
  };
  if (direct[lower]) return direct[lower]!;

  const keywordMap: Array<[RegExp, string]> = [
    [/noble.?dragon|wyrm of the western/, "boss_noble_dragon"],
    [/tarisland|sky terror/, "boss_tarisland_dragon"],
    [/fireworm|cinder|wyrmling/, "boss_fireworm"],
    [/framis|necro/, "boss_framis_necro"],
    [/sora|shifting.?cloud/, "boss_sora_cloud"],
    [/monkey|sun.?king/, "boss_sun_monkey_king"],
    // Match asset names only — never rebadge Yeti/Demon as other creatures
    [/\bdragon\b/, "cdn_dragon"],
    [/flying.?demon|\bdemon\b/, "cdn_flying_demon"],
    [/\byeti\b/, "cdn_yeti"],
    [/\bghost\b/, "cdn_ghost"],
    [/cyclops/, "cdn_cyclops"],
    [/cthulhu/, "cdn_cthulhu"],
    [/colossus|titan|giant|golem|wrath|dread|hulk|behemoth|leviathan|big.?scary.?t3/, "mon_big_scary_t3"],
    [/medusa|gorgon|naga/, "mon_medusa"],
    [/dante|dante.?beast/, "mon_dante_beast"],
    [/\bwolf\b/, "cdn_wolf"],
    [/\bbear\b/, "cdn_bear"],
    [/cult|priest|acolyte/, "mon_cultist"],
    [/skeleton.?warrior/, "mon_skeleton_warrior_ummo"],
    [/skeleton|bone|grave/, "mon_skeleton_ummo"],
    [/pincher|spider|arachnid|chitin|scuttle|crawler/, "mon_pincher"],
    [/dark.?elf/, "mon_dark_elf"],
    [/\borc\b/, "cdn_orc"],
    [/ninja/, "cdn_ninja"],
  ];
  for (const [re, id] of keywordMap) {
    if (re.test(lower)) return id;
  }

  const pool = [
    "boss_fireworm",
    "boss_framis_necro",
    "boss_sora_cloud",
    "boss_sun_monkey_king",
    "mon_dante_beast",
    "mon_medusa",
    "mon_cultist",
    "mon_pincher",
    "mon_big_scary_t3",
    "boss_noble_dragon",
  ];
  return pool[hashString(lower) % pool.length]!;
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
  /** ms timestamp — player invulnerable while dodging. */
  private dodgeIframeUntil = 0;

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
  /** PvP remote avatars (Socket.IO snapshots). */
  private remoteAvatars = new Map<
    string,
    { group: THREE.Group; target: THREE.Vector3; yaw: number }
  >();
  private mpRoom: string | null = null;
  private fightStyle: BossFightStyle = "brawler";
  private flyingBoss = false;
  private bossHoverY = 0;

  constructor(options: ArenaSceneOptions) {
    this.options = options;
    this.boss = options.boss;
    this.fightStyle = options.boss.style ?? this.inferStyle(options.boss);
    this.flyingBoss = !!options.boss.flying || this.fightStyle === "flying" || this.fightStyle === "dragon";
    this.bossHoverY = this.flyingBoss ? 1.4 : 0;
    // Style-tuned base speed / melee
    switch (this.fightStyle) {
      case "brawler":
      case "duelist":
        this.bossSpeed = 3.1;
        break;
      case "skirmisher":
        this.bossSpeed = 3.6;
        break;
      case "colossus":
        this.bossSpeed = 1.5;
        break;
      case "artillery":
      case "necromancer":
        this.bossSpeed = 1.8;
        break;
      case "flying":
      case "dragon":
        this.bossSpeed = 2.6;
        break;
      default:
        this.bossSpeed = 2.4;
    }
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
    const d = 13;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x070608);
    this.scene.fog = new THREE.FogExp2(0x0a0608, 0.02);
    this.skillVfx = new SkillVfx(this.scene, new GLTFLoader());
    this.skillTelegraphs = new TelegraphField(this.scene);
    this.particles = new ParticleVfx(this.scene);
    this.combatVfx = new CombatVfx(this.scene);

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

  private inferStyle(boss: ArenaBossInput): BossFightStyle {
    const pack = `${boss.assetPack ?? ""} ${boss.name}`.toLowerCase();
    if (/dragon|wyrm|drake/.test(pack)) return "dragon";
    if (/colossus|titan|wrath/.test(pack)) return "colossus";
    if (/medusa|gorgon|serpent|briar/.test(pack)) return "gorgon";
    if (/necro|framis|cult|grave|acolyte/.test(pack)) return "necromancer";
    if (/monkey|duelist|sun/.test(pack)) return "duelist";
    if (/pincher|chitin|spider/.test(pack)) return "skirmisher";
    if (/sora|cloud|element|cinder|fireworm/.test(pack)) return "elemental";
    if (/sky|flying|horror|wing/.test(pack)) return "flying";
    if (/dante|beast|brawler/.test(pack)) return "brawler";
    return "brawler";
  }

  // ── Boss ──────────────────────────────────────────────────────────────────
  private loadBoss() {
    const loader = new GLTFLoader();
    let monsterId = resolveBossModelId(this.boss.assetPack, this.boss.tier, this.boss.modelId);
    if (!isMonsterId(monsterId)) monsterId = bossMonsterId(this.boss.tier);
    if (!isMonsterId(monsterId)) {
      this.pushLog("Boss model missing — using empty placeholder.");
      return;
    }

    const tierScale =
      (1.35 + Math.max(0, Math.min(5, this.boss.tier)) * 0.12) * (this.boss.bossScale ?? 1);
    const model = loadMonsterModel(monsterId, loader, (m) => {
      if (this.disposed) return;
      m.group.scale.multiplyScalar(tierScale);
      this.bossWorldHeight = m.height * tierScale + this.bossHoverY;
      if (this.bossGroup) this.bossGroup.position.y = this.bossHoverY;
    });
    model.group.position.copy(this.bossPos);
    model.group.position.y = this.bossHoverY;
    this.scene.add(model.group);
    this.bossModel = model;
    this.bossGroup = model.group;
    this.bossWorldHeight = model.height * tierScale + this.bossHoverY;

    this.pushLog(
      `${this.boss.name}${this.boss.title ? ", " + this.boss.title : ""} enters the arena [${this.fightStyle}].`,
    );
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
    this.attackBoss = false;

    const threats: { x: number; z: number }[] = [];
    if (this.bossAlive) threats.push({ x: this.bossPos.x, z: this.bossPos.z });

    const dash = resolveDodge({
      keys: this.keys,
      facingYaw: this.playerFacing,
      playerX: this.playerPos.x,
      playerZ: this.playerPos.z,
      threats,
      threatRange: 28,
    });

    // Engine-owned distance so clips with/without root motion feel the same.
    this.playerFacing = Math.atan2(dash.dirX, dash.dirZ);
    this.playerPos.x += dash.dirX * dash.distance;
    this.playerPos.z += dash.dirZ * dash.distance;
    this.clampToArena(this.playerPos);

    // Visual only — distance already applied. Prefer directional clips.
    const clips = dodgeClipCandidates(dash.relative);
    if (!this.heroAnim?.triggerNamed(clips)) {
      this.heroAnim?.trigger("dodge");
    }
    // Soft i-frame window for boss hits (Arena has no full combat FSM).
    this.dodgeIframeUntil = now + DODGE_IFRAME_S * 1000;
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
    if (kind === "nova" || kind === "circle") {
      this.skillVfx.spawn("cloud", center, 4);
      if (arch.element === "fire") this.skillVfx.spawn("tornado", center, 3.5);
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
    const styleMul =
      this.fightStyle === "duelist" || this.fightStyle === "skirmisher"
        ? 0.85
        : this.fightStyle === "colossus"
          ? 1.25
          : this.fightStyle === "artillery" || this.fightStyle === "necromancer"
            ? 1.1
            : 1;
    if (this.bossPhase >= 3) return 1.15 * styleMul;
    if (this.bossPhase >= 2) return 1.75 * styleMul;
    return 2.5 * styleMul;
  }

  private chooseAbility(distToPlayer: number): ArenaBossAbility | null {
    const now = performance.now();
    const ready = this.boss.abilities.filter((a) => now >= (this.abilityCdUntil.get(a.id) ?? 0));
    const pool = ready.length > 0 ? ready : this.boss.abilities;
    if (pool.length === 0) return null;

    const close = distToPlayer < this.bossMeleeRange + 1.2;
    const mid = distToPlayer < 10;
    const style = this.fightStyle;

    const scored = pool.map((a) => {
      const t = normalizeAbilityType(a.type);
      const id = a.id.toLowerCase();
      let weight = 1;

      // Generic range bias
      if (close && t === "melee") weight = 3;
      if (!close && (t === "ranged" || t === "magic")) weight = 2.8;
      if (!close && (t === "aoe" || t === "debuff")) weight = 2.2;
      if (close && (t === "ranged" || t === "magic")) weight = 0.55;

      // Style-specific weighting
      switch (style) {
        case "brawler":
          if (t === "melee") weight *= 2.2;
          if (id.includes("pounce") || id.includes("slam")) weight *= 1.5;
          break;
        case "duelist":
          if (id.includes("combo") || id.includes("sweep") || id.includes("pounce")) weight *= 2;
          if (t === "melee") weight *= 1.6;
          break;
        case "skirmisher":
          if (id.includes("pounce") || id.includes("bolt")) weight *= 2;
          break;
        case "artillery":
          if (t === "ranged" || id.includes("meteor") || id.includes("volley")) weight *= 2.4;
          if (t === "melee") weight *= 0.35;
          break;
        case "necromancer":
          if (t === "magic" || t === "debuff" || id.includes("death") || id.includes("curse")) weight *= 2.2;
          if (t === "melee") weight *= 0.4;
          break;
        case "gorgon":
          if (id.includes("gaze") || id.includes("coil") || t === "debuff") weight *= 2.3;
          break;
        case "colossus":
          if (id.includes("stomp") || id.includes("meteor") || id.includes("slam")) weight *= 2.4;
          if (t === "ranged") weight *= 0.5;
          break;
        case "elemental":
          if (id.includes("storm") || id.includes("meteor") || id.includes("nova")) weight *= 2.2;
          break;
        case "flying":
        case "dragon":
          if (id.includes("sky") || id.includes("wing") || id.includes("breath") || id.includes("meteor"))
            weight *= 2.3;
          if (t === "melee" && !close) weight *= 0.3;
          break;
        default:
          break;
      }

      // Phase 3: prefer big AoEs
      if (this.bossPhase >= 3 && (t === "aoe" || id.includes("meteor") || id.includes("stomp"))) {
        weight *= 1.6;
      }
      if (!mid && t === "melee") weight *= 0.4;
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
    const phaseCd = this.bossPhase >= 3 ? 0.85 : this.bossPhase >= 2 ? 0.92 : 1;
    const cdSec = Math.max(1.6, Math.min(12, (ability.cooldown || 4) * phaseCd));
    this.abilityCdUntil.set(ability.id, now + cdSec * 1000);
    const type = normalizeAbilityType(ability.type);
    const dmg = Math.max(
      8,
      Math.round((ability.damage || 30) * (0.85 + Math.random() * 0.3) * (1 + (this.bossPhase - 1) * 0.08)),
    );
    const id = ability.id.toLowerCase();
    const name = ability.name.toLowerCase();

    // Style-shaped multi-pattern attacks
    if (id.includes("volley") || name.includes("volley") || name.includes("barrage")) {
      this.spawnFanProjectiles(ability, dmg, 5, false);
    } else if (id.includes("meteor") || name.includes("skyfall") || name.includes("storm")) {
      this.spawnMeteorField(dmg, ability.name, name.includes("storm") ? 3 : 4);
    } else if (id.includes("breath") || name.includes("breath")) {
      this.spawnBreathLine(dmg, ability.name);
    } else if (id.includes("sky_dive") || name.includes("sky dive") || name.includes("dive")) {
      this.spawnTelegraph("aoe", this.playerPos.clone(), 5.0, 1.15, dmg * 1.1, ability.name);
    } else if (id.includes("stomp") || name.includes("earthquake") || name.includes("stomp")) {
      this.spawnTelegraph("aoe", this.bossPos.clone(), 7.5, 1.35, dmg, ability.name);
    } else if (id.includes("coil") || name.includes("coil")) {
      this.spawnTelegraph("aoe", this.bossPos.clone(), 5.5, 1.1, dmg, ability.name);
      this.spawnTelegraph("aoe", this.bossPos.clone(), 3.2, 0.85, dmg * 0.7, ability.name + " (inner)");
    } else if (id.includes("gaze") || name.includes("gaze") || name.includes("petrify")) {
      this.spawnTelegraph("debuff", this.playerPos.clone(), 3.6, 1.2, dmg, ability.name);
    } else if (id.includes("combo") || name.includes("flurry")) {
      const toP = new THREE.Vector3().subVectors(this.playerPos, this.bossPos).setY(0);
      if (toP.lengthSq() > 0.001) toP.normalize();
      const center = this.bossPos.clone().add(toP.multiplyScalar(this.bossMeleeRange * 0.55));
      this.spawnTelegraph("melee", center, this.bossMeleeRange * 0.85, 0.32, dmg * 0.55, ability.name);
      this.spawnTelegraph(
        "melee",
        center.clone().add(toP.clone().multiplyScalar(0.8)),
        this.bossMeleeRange * 0.9,
        0.55,
        dmg * 0.7,
        ability.name + " II",
      );
    } else if (id.includes("pounce") || name.includes("pounce")) {
      this.spawnTelegraph("melee", this.playerPos.clone(), 3.4, 0.65, dmg, ability.name);
    } else if (type === "ranged" || type === "magic") {
      this.spawnProjectile(ability, dmg, type === "magic" || this.fightStyle === "necromancer");
    } else if (type === "aoe") {
      const r =
        this.fightStyle === "colossus" ? 5.5 : this.fightStyle === "elemental" ? 4.6 : 4.2;
      this.spawnTelegraph("aoe", this.playerPos.clone(), r, 1.2, dmg, ability.name);
    } else if (type === "debuff") {
      this.spawnTelegraph("debuff", this.playerPos.clone(), 3.4, 1.15, dmg, ability.name);
    } else {
      const toP = new THREE.Vector3().subVectors(this.playerPos, this.bossPos).setY(0);
      if (toP.lengthSq() > 0.001) toP.normalize();
      const reach = this.fightStyle === "colossus" ? this.bossMeleeRange * 1.25 : this.bossMeleeRange;
      const center = this.bossPos.clone().add(toP.multiplyScalar(reach * 0.6));
      this.spawnTelegraph("melee", center, reach, 0.48, dmg, ability.name);
    }
    this.pushLog(`${this.boss.name} uses ${ability.name}.`);
  }

  private spawnFanProjectiles(ability: ArenaBossAbility, dmg: number, count: number, homing: boolean) {
    const start = this.bossPos.clone().add(new THREE.Vector3(0, this.bossWorldHeight * 0.55, 0));
    const base = new THREE.Vector3().subVectors(this.playerPos.clone().setY(1), start).normalize();
    const spread = 0.45;
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0 : (i / (count - 1) - 0.5) * spread;
      const dir = new THREE.Vector3(base.x, base.y, base.z);
      // yaw rotate around Y
      const cos = Math.cos(t);
      const sin = Math.sin(t);
      const dx = dir.x * cos - dir.z * sin;
      const dz = dir.x * sin + dir.z * cos;
      const target = start.clone().add(new THREE.Vector3(dx, 0, dz).multiplyScalar(28).setY(1));
      this.combatVfx.fireProjectile(start.clone(), target, {
        element: "fire",
        skillTags: ability.name,
        preset: { primary: 0xff6622, secondary: 0xffeeaa, speed: 16, gravity: 1.2, size: 0.32, spin: 8 },
        onHit: () => {
          if (this.outcome === "fighting") {
            this.damagePlayer(Math.round(dmg * 0.55), `${this.boss.name}'s volley`);
            this.spawnVfx(this.playerPos.clone(), 0xff6622, 1.5, 0.3);
          }
        },
      });
    }
  }

  private spawnMeteorField(dmg: number, label: string, n: number) {
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * Math.PI * 2;
      const dist = 1.5 + Math.random() * 7;
      const center = this.playerPos
        .clone()
        .add(new THREE.Vector3(Math.cos(ang) * dist, 0, Math.sin(ang) * dist));
      this.clampToArena(center);
      this.spawnTelegraph("aoe", center, 2.8, 0.9 + i * 0.12, Math.round(dmg * 0.75), label);
    }
  }

  private spawnBreathLine(dmg: number, label: string) {
    const dir = new THREE.Vector3().subVectors(this.playerPos, this.bossPos).setY(0);
    if (dir.lengthSq() < 1e-4) dir.set(0, 0, 1);
    dir.normalize();
    for (let i = 1; i <= 5; i++) {
      const center = this.bossPos.clone().add(dir.clone().multiplyScalar(i * 2.8));
      this.clampToArena(center);
      this.spawnTelegraph("aoe", center, 2.2, 0.55 + i * 0.08, Math.round(dmg * 0.65), label);
    }
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
    this.spawnDamageNumber(
      this.bossPos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.8, this.bossWorldHeight + 0.4, 0)),
      amount, isCrit, true,
    );

    // Phase transitions at 50% / 20%.
    const pct = this.bossHp / this.bossMaxHp;
    if (this.bossPhase < 2 && pct <= 0.5) this.enterPhase(2);
    else if (this.bossPhase < 3 && this.boss.phases >= 3 && pct <= 0.2) this.enterPhase(3);

    if (this.bossHp <= 0) this.bossDies();
  }

  private enterPhase(phase: number) {
    this.bossPhase = phase;
    this.bossActionT = Math.min(this.bossActionT, 0.6);
    this.bossSpeed += 0.7;
    this.pushLog(`${this.boss.name} enters Phase ${phase} — the assault intensifies!`);
    // Shockwave VFX + brief flash.
    this.spawnVfx(this.bossPos.clone(), 0xff2200, 7, 0.6);
    this.bossFlash = 0.4;
    this.emitState();
  }

  private bossDies() {
    this.bossAlive = false;
    this.bossDeadT = 0;
    this.outcome = "victory";
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
    if (performance.now() < this.dodgeIframeUntil) return; // dodge i-frames
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

    // Root motion for lunges/skills. Dodge travel is engine-applied — drain
    // any banked dash delta so it cannot double-move after i-frames end.
    if (this.heroAnim) {
      const dodging = performance.now() < this.dodgeIframeUntil;
      if (this.heroAnim.consumeRootMotion(this._rmTmp) && !dodging) {
        this.playerPos.x += this._rmTmp.x;
        this.playerPos.z += this._rmTmp.z;
        this.clampToArena(this.playerPos);
      }
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

    // ── Stat-based resource regen ──
    if (this.outcome === "fighting") {
      const inCombat = true;
      const mpR = 4.5 + this.playerLevel * 0.25 + 6 * 0.55; // intellect-ish
      const hpR = 2.5 + this.playerLevel * 0.12;
      this.playerMana = Math.min(this.playerMaxMana, this.playerMana + mpR * (inCombat ? 0.55 : 1) * delta);
      this.playerHp = Math.min(this.playerMaxHp, this.playerHp + hpR * 0.35 * delta);
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
    if (this.bossModel?.mixer) this.bossModel.mixer.update(delta);
    if (this.bossGroup) {
      if (this.bossAlive && this.outcome === "fighting") {
        const to = new THREE.Vector3().subVectors(this.playerPos, this.bossPos).setY(0);
        const dist = to.length();
        const faceYaw = Math.atan2(to.x, to.z);
        this.bossGroup.rotation.y += (faceYaw - this.bossGroup.rotation.y) * 0.08;

        // Preferred standoff distance by fight style
        let preferMin = this.bossMeleeRange * 0.85;
        let preferMax = this.bossMeleeRange + 0.5;
        switch (this.fightStyle) {
          case "artillery":
          case "necromancer":
            preferMin = 8;
            preferMax = 12;
            break;
          case "flying":
          case "dragon":
            preferMin = 7;
            preferMax = 11;
            break;
          case "elemental":
          case "gorgon":
            preferMin = 5;
            preferMax = 9;
            break;
          case "colossus":
            preferMin = this.bossMeleeRange;
            preferMax = this.bossMeleeRange + 2;
            break;
          case "skirmisher":
            preferMin = 3;
            preferMax = 6;
            break;
          case "duelist":
          case "brawler":
          default:
            preferMin = this.bossMeleeRange * 0.7;
            preferMax = this.bossMeleeRange + 0.8;
            break;
        }

        if (dist > preferMax) {
          to.normalize();
          this.bossPos.x += to.x * this.bossSpeed * delta;
          this.bossPos.z += to.z * this.bossSpeed * delta;
          this.clampToArena(this.bossPos, 2);
        } else if (dist < preferMin && dist > 0.2) {
          // Kite / retreat for ranged styles
          to.normalize();
          this.bossPos.x -= to.x * this.bossSpeed * 0.85 * delta;
          this.bossPos.z -= to.z * this.bossSpeed * 0.85 * delta;
          this.clampToArena(this.bossPos, 2);
        } else if (this.fightStyle === "skirmisher" || this.fightStyle === "duelist") {
          // Strafe orbit
          const side = new THREE.Vector3(-to.z, 0, to.x).normalize();
          this.bossPos.x += side.x * this.bossSpeed * 0.55 * delta;
          this.bossPos.z += side.z * this.bossSpeed * 0.55 * delta;
          this.clampToArena(this.bossPos, 2);
        }

        // Gentle hover bob for flying / dragon styles
        const hover =
          this.bossHoverY +
          (this.flyingBoss ? Math.sin(elapsed * 2.2) * 0.25 : 0);
        this.bossGroup.position.lerp(new THREE.Vector3(this.bossPos.x, hover, this.bossPos.z), 0.15);

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

    // Camera + sun follow the player.
    const camTarget = new THREE.Vector3(this.playerPos.x * 0.5, 0, this.playerPos.z * 0.5);
    this.camera.position.lerp(camTarget.clone().add(new THREE.Vector3(22, 24, 22)), 0.05);
    this.camera.lookAt(camTarget);
    if (this.sun) {
      this.sun.position.set(this.playerPos.x + 18, 30, this.playerPos.z + 12);
      this.sun.target.position.set(this.playerPos.x, 0, this.playerPos.z);
      this.sun.target.updateMatrixWorld();
    }

    // PvP remote avatars lerp
    const rLerp = 1 - Math.exp(-10 * delta);
    for (const rem of this.remoteAvatars.values()) {
      rem.group.position.x += (rem.target.x - rem.group.position.x) * rLerp;
      rem.group.position.z += (rem.target.z - rem.group.position.z) * rLerp;
      rem.group.rotation.y += (rem.yaw - rem.group.rotation.y) * rLerp;
    }

    // Stream HUD state (~30 Hz).
    this.stateAccum += delta;
    if (this.stateAccum >= this.stateInterval) {
      this.stateAccum = 0;
      this.emitState();
    }
  }

  /** PvP: set room label for HUD. */
  setMpRoom(room: string | null) {
    this.mpRoom = room;
  }

  /** PvP: sync remote players from Socket.IO snapshots. */
  syncRemotePlayers(snaps: PlayerSnapshot[], localId: string | null) {
    if (this.disposed) return;
    const seen = new Set<string>();
    for (const s of snaps) {
      if (localId && s.id === localId) continue;
      seen.add(s.id);
      let rem = this.remoteAvatars.get(s.id);
      if (!rem) {
        const group = new THREE.Group();
        const body = new THREE.Mesh(
          new THREE.CapsuleGeometry(0.32, 0.95, 4, 8),
          new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.5 }),
        );
        body.position.y = 1.0;
        body.castShadow = true;
        group.add(body);
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(0.4, 0.55, 20),
          new THREE.MeshBasicMaterial({
            color: 0xef4444,
            transparent: true,
            opacity: 0.55,
            side: THREE.DoubleSide,
          }),
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.06;
        group.add(ring);
        group.position.set(s.p.x, 0, s.p.z);
        this.scene.add(group);
        rem = { group, target: new THREE.Vector3(s.p.x, s.p.y, s.p.z), yaw: s.r };
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

  /** Local pose for multiplayer input stream. */
  getLocalNetPose(): { x: number; z: number; yaw: number; ax: number; az: number } {
    return {
      x: this.playerPos.x,
      z: this.playerPos.z,
      yaw: this.playerFacing,
      ax: 0,
      az: 0,
    };
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
      remotePlayerCount: this.remoteAvatars.size,
      mpRoom: this.mpRoom,
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
    this.bloom?.composer.dispose();
    this.bloom = null;
    this.renderer.dispose();
  }
}
