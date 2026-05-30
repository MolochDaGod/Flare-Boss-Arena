import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  OBJECTSTORE,
  resolveModelName,
  disposeObject3D,
  loadKayKitAnimLibrary,
  HeroAnimator,
} from "./kaykitHero";
import { loadMonsterModel, disposeMonsterModel, isMonsterId } from "./MonsterModels";
import type { EnemyModel } from "./EnemyFactory";
import { makeGroundMaterial, makeTerrainSkirt } from "./proceduralTextures";

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
  mesh: THREE.Mesh;
  light: THREE.PointLight | null;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  max: number;
  damage: number;
  radius: number;
  homing: boolean;
}

type TelegraphKind = "melee" | "aoe" | "debuff";

interface Telegraph {
  kind: TelegraphKind;
  ring: THREE.Mesh; // outer warning ring (static)
  fill: THREE.Mesh; // inner disc that grows during wind-up
  center: THREE.Vector3;
  radius: number;
  t: number;
  windup: number;
  struck: boolean;
  damage: number;
  label: string;
}

interface ArenaVfx {
  mesh: THREE.Mesh;
  life: number;
  max: number;
  grow: number;
  fade: number;
}

/** Pick an in-repo (rigged) monster GLB to embody the boss, by tier. */
function bossMonsterId(tier: number): string {
  switch (Math.max(1, Math.min(5, Math.round(tier)))) {
    case 1: return "mon_cultist";
    case 2: return "mon_medusa";
    case 3: return "mon_dante_beast";
    case 4: return "mon_medusa";
    default: return "mon_dante_beast";
  }
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
  private clock = new THREE.Clock();
  private animFrameId = 0;

  // Lighting rig (sun follows the player for crisp shadows on a big map).
  private sun!: THREE.DirectionalLight;

  // Player
  private playerGroup: THREE.Object3D | null = null;
  private heroAnim: HeroAnimator | null = null;
  private playerPos = new THREE.Vector3(0, 0, 9);
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
  private vfx: ArenaVfx[] = [];

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
    const d = 13;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x070608);
    this.scene.fog = new THREE.FogExp2(0x0a0608, 0.02);

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
    // Flat cobble combat floor (procedural tiling material).
    const repeat = this.BOUNDS / 2;
    const groundMat = makeGroundMaterial(repeat, this.renderer.capabilities.getMaxAnisotropy());
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(this.BOUNDS * 2, this.BOUNDS * 2), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Heightmap relief ringing the flat arena (rolling foothills → ridge). The
    // flat center uses a Chebyshev mask matching the square movement clamp.
    const skirt = makeTerrainSkirt(this.BOUNDS);
    this.scene.add(skirt);

    // Arena boundary stones (instanced) marking the walkable square edge.
    const stoneGeom = new THREE.DodecahedronGeometry(0.9, 0);
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x16110e, roughness: 1 });
    const per = 13;
    const total = per * 4;
    const inst = new THREE.InstancedMesh(stoneGeom, stoneMat, total);
    const m = new THREE.Matrix4();
    const edge = this.BOUNDS - 0.5;
    let idx = 0;
    for (let side = 0; side < 4; side++) {
      for (let i = 0; i < per; i++) {
        const t = (i / (per - 1)) * 2 - 1; // -1..1
        let x = 0;
        let z = 0;
        if (side === 0) { x = t * edge; z = -edge; }
        else if (side === 1) { x = t * edge; z = edge; }
        else if (side === 2) { x = -edge; z = t * edge; }
        else { x = edge; z = t * edge; }
        const scl = 0.8 + Math.random() * 1.4;
        m.compose(
          new THREE.Vector3(x + (Math.random() - 0.5), scl * 0.3, z + (Math.random() - 0.5)),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.random() * 0.4, Math.random() * Math.PI, Math.random() * 0.4)),
          new THREE.Vector3(scl, scl, scl),
        );
        inst.setMatrixAt(idx++, m);
      }
    }
    inst.castShadow = true;
    inst.receiveShadow = true;
    this.scene.add(inst);
  }

  private buildBraziers() {
    // Four corner braziers for dark-fantasy ambiance + flicker.
    const r = this.BOUNDS - 3;
    const spots = [
      new THREE.Vector3(r, 0, r),
      new THREE.Vector3(-r, 0, r),
      new THREE.Vector3(r, 0, -r),
      new THREE.Vector3(-r, 0, -r),
    ];
    for (const p of spots) {
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16, 0.22, 2.0, 8),
        new THREE.MeshStandardMaterial({ color: 0x1a1410, roughness: 0.9 }),
      );
      post.position.set(p.x, 1.0, p.z);
      post.castShadow = true;
      this.scene.add(post);

      const bowl = new THREE.Mesh(
        new THREE.CylinderGeometry(0.5, 0.3, 0.4, 10),
        new THREE.MeshStandardMaterial({ color: 0x2a2018, roughness: 0.85 }),
      );
      bowl.position.set(p.x, 2.1, p.z);
      this.scene.add(bowl);

      const flame = new THREE.Mesh(
        new THREE.SphereGeometry(0.32, 12, 10),
        new THREE.MeshBasicMaterial({ color: 0xffa83a, transparent: true, opacity: 0.9 }),
      );
      flame.position.set(p.x, 2.45, p.z);
      flame.scale.set(1, 1.5, 1);
      this.scene.add(flame);

      const light = new THREE.PointLight(0xff9c44, 4, 16, 2);
      light.position.set(p.x, 2.6, p.z);
      this.scene.add(light);
      (flame.userData as { light?: THREE.PointLight }).light = light;
      this.braziers.push(flame);
    }
  }
  private braziers: THREE.Mesh[] = [];

  // ── Player ────────────────────────────────────────────────────────────────
  private loadPlayer() {
    const modelName = resolveModelName(this.options.className, this.options.raceKey);
    const loader = new GLTFLoader();
    const localUrl = `${import.meta.env.BASE_URL}models/kaykit/heroes/${modelName}.glb`;
    const remoteUrl = `${OBJECTSTORE}/models/characters/kaykit/${modelName}.glb`;

    const onLoaded = (gltf: { scene: THREE.Group; animations: THREE.AnimationClip[] }) => {
      if (this.disposed) {
        disposeObject3D(gltf.scene);
        return;
      }
      const root = gltf.scene;
      root.scale.setScalar(1.5);
      root.position.copy(this.playerPos);
      root.traverse((c) => {
        const mesh = c as THREE.Mesh & { isSkinnedMesh?: boolean };
        if (mesh.isMesh) {
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          if (mesh.isSkinnedMesh) mesh.frustumCulled = false;
        }
      });
      this.scene.add(root);
      this.playerGroup = root;

      this.heroAnim = new HeroAnimator(root, gltf.animations);
      loadKayKitAnimLibrary(loader).then((clips) => {
        if (this.disposed || !this.heroAnim) return;
        this.heroAnim.addLibraryClips(clips);
      });

      this.loaded = true;
      this.emitState();
    };

    loader.load(localUrl, onLoaded, undefined, () => {
      if (this.disposed) return;
      loader.load(remoteUrl, onLoaded, undefined, () => {
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
      });
    });
  }

  // ── Boss ──────────────────────────────────────────────────────────────────
  private loadBoss() {
    const loader = new GLTFLoader();
    const monsterId = bossMonsterId(this.boss.tier);
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
  }

  // ── Input ─────────────────────────────────────────────────────────────────
  private _keyDown = (e: KeyboardEvent) => {
    this.keys.add(e.code);
    if (e.code === "KeyF") this.attackNearest();
    if (e.code === "Space") { e.preventDefault(); this.doDodge(); }
    if (e.code === "KeyQ" || e.code === "ShiftLeft") this.doDodge();
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
      const B = this.BOUNDS - 1;
      hit.x = Math.max(-B, Math.min(B, hit.x));
      hit.z = Math.max(-B, Math.min(B, hit.z));
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

  doDodge() {
    if (this.outcome !== "fighting") return;
    const forward = new THREE.Vector3(Math.sin(this.playerFacing), 0, Math.cos(this.playerFacing));
    const B = this.BOUNDS - 1;
    this.playerPos.x = Math.max(-B, Math.min(B, this.playerPos.x + forward.x * 3.0));
    this.playerPos.z = Math.max(-B, Math.min(B, this.playerPos.z + forward.z * 3.0));
    this.playerTarget = null;
    this.heroAnim?.trigger("dodge");
  }

  useSkill(idx: number) {
    if (idx < 0 || idx > 4 || this.outcome !== "fighting") return;
    const now = performance.now();
    if (now < (this.skillCdUntil[idx] ?? 0)) return;
    const cost = this.skillManaCost[idx] ?? 20;
    if (this.playerMana < cost) { this.pushLog("Not enough mana."); return; }
    this.playerMana -= cost;
    this.skillCdUntil[idx] = now + (this.skillCdLen[idx] ?? 5) * 1000;

    const isCast = idx % 2 === 1;
    if (this.heroAnim) {
      const played = this.heroAnim.trigger(isCast ? "cast" : "attack");
      if (!played) this.proceduralLunge();
    } else {
      this.proceduralLunge();
    }

    // Skills strike the boss if within range of the cast point.
    const radius = isCast ? 6.0 : 3.6;
    const forward = new THREE.Vector3(Math.sin(this.playerFacing), 0, Math.cos(this.playerFacing));
    const center = this.playerPos.clone().add(forward.multiplyScalar(isCast ? 3 : 1.8));
    this.spawnVfx(center, isCast ? 0x66aaff : 0xffaa33, radius, 0.45);
    if (this.bossAlive && this.bossPos.distanceTo(center) <= radius + 1.5) {
      const mult = isCast ? 2.6 : 1.9;
      const isCrit = Math.random() < this.critChance + 0.05;
      const dmg = Math.round(this.baseDamage * mult * (isCrit ? 2 : 1) * (0.85 + Math.random() * 0.3));
      this.damageBoss(dmg, isCrit);
      this.pushLog(`Skill ${idx + 1} blasts ${this.boss.name}!`);
    } else {
      this.pushLog(`Skill ${idx + 1} — boss out of range.`);
    }
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
    const cdSec = Math.max(2.4, Math.min(12, ability.cooldown || 4));
    this.abilityCdUntil.set(ability.id, now + cdSec * 1000);
    const type = normalizeAbilityType(ability.type);
    const dmg = Math.max(8, Math.round((ability.damage || 30) * (0.85 + Math.random() * 0.3)));

    if (type === "ranged" || type === "magic") {
      this.spawnProjectile(ability, dmg, type === "magic");
    } else if (type === "aoe") {
      this.spawnTelegraph("aoe", this.playerPos.clone(), 4.2, 1.25, dmg, ability.name);
    } else if (type === "debuff") {
      this.spawnTelegraph("debuff", this.playerPos.clone(), 3.2, 1.1, dmg, ability.name);
    } else {
      // Melee — short wind-up swing anchored in front of the boss toward player.
      const toP = new THREE.Vector3().subVectors(this.playerPos, this.bossPos).setY(0);
      if (toP.lengthSq() > 0.001) toP.normalize();
      const center = this.bossPos.clone().add(toP.multiplyScalar(this.bossMeleeRange * 0.6));
      this.spawnTelegraph("melee", center, this.bossMeleeRange, 0.5, dmg, ability.name);
    }
    this.pushLog(`${this.boss.name} uses ${ability.name}.`);
  }

  private spawnProjectile(ability: ArenaBossAbility, dmg: number, homing: boolean) {
    const color = homing ? 0xaa44ff : 0xff5522;
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.4, 12, 10),
      new THREE.MeshBasicMaterial({ color }),
    );
    const start = this.bossPos.clone().add(new THREE.Vector3(0, this.bossWorldHeight * 0.55, 0));
    mesh.position.copy(start);
    this.scene.add(mesh);
    const light = new THREE.PointLight(color, 2.2, 8, 2);
    mesh.add(light);

    const target = this.playerPos.clone().add(new THREE.Vector3(0, 1, 0));
    const dir = new THREE.Vector3().subVectors(target, start).normalize();
    const speed = homing ? 12 : 16;
    this.projectiles.push({
      mesh,
      light,
      pos: start.clone(),
      vel: dir.multiplyScalar(speed),
      life: 0,
      max: 3.2,
      damage: dmg,
      radius: 1.2,
      homing,
    });
  }

  private spawnTelegraph(kind: TelegraphKind, center: THREE.Vector3, radius: number, windup: number, damage: number, label: string) {
    const color = kind === "melee" ? 0xff3322 : kind === "aoe" ? 0xff8800 : 0xaa33ff;
    center.y = 0;

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(radius - 0.18, radius, 40),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(center.x, 0.06, center.z);
    this.scene.add(ring);

    const fill = new THREE.Mesh(
      new THREE.CircleGeometry(radius, 40),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.18, side: THREE.DoubleSide }),
    );
    fill.rotation.x = -Math.PI / 2;
    fill.position.set(center.x, 0.05, center.z);
    fill.scale.setScalar(0.02);
    this.scene.add(fill);

    this.telegraphs.push({ kind, ring, fill, center: center.clone(), radius, t: 0, windup, struck: false, damage, label });
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
  private spawnVfx(at: THREE.Vector3, color: number, grow: number, max: number) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.3, 0.6, 36),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(at.x, 0.18, at.z);
    this.scene.add(ring);
    this.vfx.push({ mesh: ring, life: 0, max, grow, fade: 0.85 });
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
    this.renderer.render(this.scene, this.camera);
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
    const B = this.BOUNDS - 1;
    if (raw.length() > 0 && this.outcome === "fighting") {
      raw.normalize();
      this.playerPos.x = Math.max(-B, Math.min(B, this.playerPos.x + raw.x * speed * delta));
      this.playerPos.z = Math.max(-B, Math.min(B, this.playerPos.z + raw.y * speed * delta));
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
        this.playerPos.x = Math.max(-B, Math.min(B, this.playerPos.x + to.x * speed * delta));
        this.playerPos.z = Math.max(-B, Math.min(B, this.playerPos.z + to.z * speed * delta));
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
          this.bossPos.x = Math.max(-B, Math.min(B, this.bossPos.x + to.x * this.bossSpeed * delta));
          this.bossPos.z = Math.max(-B, Math.min(B, this.bossPos.z + to.z * this.bossSpeed * delta));
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

    // ── VFX rings ──
    for (let i = this.vfx.length - 1; i >= 0; i--) {
      const v = this.vfx[i]!;
      v.life += delta;
      const p = v.life / v.max;
      const s = 0.4 + p * v.grow;
      v.mesh.scale.set(s, s, s);
      (v.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, v.fade * (1 - p));
      if (v.life >= v.max) {
        this.scene.remove(v.mesh);
        v.mesh.geometry.dispose();
        (v.mesh.material as THREE.Material).dispose();
        this.vfx.splice(i, 1);
      }
    }

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

    // Stream HUD state (~30 Hz).
    this.stateAccum += delta;
    if (this.stateAccum >= this.stateInterval) {
      this.stateAccum = 0;
      this.emitState();
    }
  }

  private updateProjectiles(delta: number) {
    const B = this.BOUNDS;
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i]!;
      p.life += delta;
      if (p.homing && p.life < p.max * 0.5 && this.outcome === "fighting") {
        const desired = new THREE.Vector3().subVectors(this.playerPos.clone().setY(1), p.pos).normalize().multiplyScalar(p.vel.length());
        p.vel.lerp(desired, 0.06);
      }
      p.pos.addScaledVector(p.vel, delta);
      p.mesh.position.copy(p.pos);

      const hitPlayer = p.pos.distanceTo(this.playerPos.clone().setY(p.pos.y)) <= p.radius;
      const outOfBounds = Math.abs(p.pos.x) > B + 2 || Math.abs(p.pos.z) > B + 2 || p.pos.y < 0;
      if ((hitPlayer && this.outcome === "fighting") || p.life > p.max || outOfBounds) {
        if (hitPlayer && this.outcome === "fighting") {
          this.damagePlayer(p.damage, this.boss.name + "'s bolt");
          this.spawnVfx(this.playerPos.clone(), p.homing ? 0xaa44ff : 0xff5522, 2, 0.4);
        }
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        (p.mesh.material as THREE.Material).dispose();
        this.projectiles.splice(i, 1);
      }
    }
  }

  private updateTelegraphs(delta: number) {
    this.activeTelegraphLabel = null;
    for (let i = this.telegraphs.length - 1; i >= 0; i--) {
      const tg = this.telegraphs[i]!;
      tg.t += delta;
      const p = Math.min(1, tg.t / tg.windup);
      // Fill grows during wind-up to telegraph the timing.
      tg.fill.scale.setScalar(Math.max(0.02, p));
      (tg.fill.material as THREE.MeshBasicMaterial).opacity = 0.15 + p * 0.35;
      const ringMat = tg.ring.material as THREE.MeshBasicMaterial;
      ringMat.opacity = 0.55 + Math.sin(tg.t * 18) * 0.3;

      if (!tg.struck && this.outcome === "fighting") this.activeTelegraphLabel = tg.label;

      if (!tg.struck && tg.t >= tg.windup) {
        tg.struck = true;
        const inside = this.playerPos.distanceTo(tg.center) <= tg.radius;
        this.spawnVfx(tg.center.clone(), tg.kind === "melee" ? 0xff3322 : tg.kind === "aoe" ? 0xff8800 : 0xaa33ff, tg.radius * 1.4, 0.45);
        if (inside && this.outcome === "fighting") {
          this.damagePlayer(tg.damage, tg.label);
          if (tg.kind === "debuff") {
            this.slowUntil = performance.now() + 3000;
            this.pushLog("You are slowed!");
          }
        }
        // Strike flash on the ring.
        ringMat.opacity = 1;
      }

      if (tg.t >= tg.windup + 0.25) {
        this.scene.remove(tg.ring);
        this.scene.remove(tg.fill);
        tg.ring.geometry.dispose();
        (tg.ring.material as THREE.Material).dispose();
        tg.fill.geometry.dispose();
        (tg.fill.material as THREE.Material).dispose();
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
    const aspect = w / h;
    const d = 13;
    this.camera.left = -d * aspect;
    this.camera.right = d * aspect;
    this.camera.top = d;
    this.camera.bottom = -d;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
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
    if (this.bossGroup) this.bossGroup.userData.disposed = true;
    if (this.bossModel) { disposeMonsterModel(this.bossModel); this.bossModel = null; }
    this.projectiles = [];
    this.telegraphs = [];
    this.vfx = [];
    this.braziers = [];
    this.playerGroup = null;
    this.bossGroup = null;
    disposeObject3D(this.scene);
    this.scene.clear();
    this.renderer.dispose();
  }
}
