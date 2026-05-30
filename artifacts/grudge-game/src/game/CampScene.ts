import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export type CampStationId =
  | "anvil"
  | "skills"
  | "stats"
  | "quests"
  | "stash"
  | "portal_dungeon"
  | "portal_boss";

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

export interface CampStateUpdate {
  nearbyStationId: CampStationId | null;
  nearbyStationLabel: string | null;
  nearbyStationHint: string | null;
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

const OBJECTSTORE = "https://molochdagod.github.io/ObjectStore";

const CLASS_TO_MODEL: Record<string, string> = {
  warrior: "Knight",
  mage: "Mage",
  ranger: "Ranger",
  worge: "Barbarian",
  barbarian: "Barbarian",
};

const RACE_TO_MODEL_OVERRIDE: Record<string, string> = {
  human: "Knight",
  dwarf: "Barbarian",
  elf: "Ranger",
  highelf: "Mage",
  orc: "Barbarian",
  undead: "Mage",
  worge: "Barbarian",
  gnome: "Mage",
};

function resolveModelName(className?: string, raceKey?: string): string {
  const r = (raceKey ?? "").toLowerCase();
  if (RACE_TO_MODEL_OVERRIDE[r]) return RACE_TO_MODEL_OVERRIDE[r];
  const c = (className ?? "").toLowerCase();
  return CLASS_TO_MODEL[c] ?? "Knight";
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
  private clock = new THREE.Clock();
  private animFrameId = 0;

  private playerGroup: THREE.Group | null = null;
  private heroAnim: HeroAnimator | null = null;
  private playerPos = new THREE.Vector3(0, 0, 6);
  private playerTarget: THREE.Vector3 | null = null;
  private playerFacing = 0;
  private playerSpeed = 6;

  private stations: CampStation[] = [];
  private campfireLight!: THREE.PointLight;
  private campfireMesh!: THREE.Mesh;
  private embers: { mesh: THREE.Mesh; vel: THREE.Vector3; life: number; max: number }[] = [];

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

  private readonly RADIUS = 9;
  private readonly BOUNDS = 16;

  private options: CampSceneOptions;
  private _engaged = false;

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

    this.buildEnvironment();
    this.buildStations();
    this.buildCampfire();
    this.buildDummies();
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

    // Stone floor — large dark hex-like tile
    const floorGeom = new THREE.CircleGeometry(this.BOUNDS, 64);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x1a1410,
      roughness: 0.95,
      metalness: 0.05,
    });
    const floor = new THREE.Mesh(floorGeom, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Inner ring stones (cobble path) — instanced
    const stoneGeom = new THREE.BoxGeometry(0.6, 0.18, 0.6);
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x2b2520, roughness: 0.85 });
    const ringCount = 64;
    const ringInstanced = new THREE.InstancedMesh(stoneGeom, stoneMat, ringCount);
    const m = new THREE.Matrix4();
    for (let i = 0; i < ringCount; i++) {
      const a = (i / ringCount) * Math.PI * 2;
      const r = 3.2 + Math.random() * 0.4;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const yRot = Math.random() * Math.PI;
      m.compose(
        new THREE.Vector3(x, 0.09, z),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yRot, 0)),
        new THREE.Vector3(1, 0.6 + Math.random() * 0.4, 1),
      );
      ringInstanced.setMatrixAt(i, m);
    }
    ringInstanced.receiveShadow = true;
    this.scene.add(ringInstanced);

    // Outer perimeter rocks
    const rockGeom = new THREE.DodecahedronGeometry(0.7, 0);
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x14110d, roughness: 1 });
    const rockCount = 36;
    const rockInst = new THREE.InstancedMesh(rockGeom, rockMat, rockCount);
    for (let i = 0; i < rockCount; i++) {
      const a = (i / rockCount) * Math.PI * 2 + Math.random() * 0.1;
      const r = this.BOUNDS - 1 - Math.random() * 1.8;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const scl = 0.7 + Math.random() * 1.2;
      m.compose(
        new THREE.Vector3(x, scl * 0.3, z),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.random(), Math.random() * Math.PI, Math.random())),
        new THREE.Vector3(scl, scl, scl),
      );
      rockInst.setMatrixAt(i, m);
    }
    rockInst.castShadow = true;
    rockInst.receiveShadow = true;
    this.scene.add(rockInst);

    // Distant tents (silhouettes) for ambient camp feel
    const tentMat = new THREE.MeshStandardMaterial({ color: 0x261612, roughness: 0.95 });
    for (let i = 0; i < 4; i++) {
      const a = i * (Math.PI / 2) + Math.PI / 4;
      const r = this.BOUNDS - 3.5;
      const tx = Math.cos(a) * r;
      const tz = Math.sin(a) * r;
      const tent = new THREE.Mesh(new THREE.ConeGeometry(1.3, 2.2, 6), tentMat);
      tent.position.set(tx, 1.1, tz);
      tent.castShadow = true;
      tent.receiveShadow = true;
      this.scene.add(tent);
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, 2.7, 6),
        new THREE.MeshStandardMaterial({ color: 0x0a0a0a }),
      );
      pole.position.set(tx, 1.35, tz);
      this.scene.add(pole);
    }
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

  private addStation(
    id: CampStationId,
    label: string,
    hint: string,
    angleDeg: number,
    color: number,
    iconBuilder: (mat: THREE.MeshStandardMaterial) => THREE.Object3D,
  ): CampStation {
    const a = (angleDeg * Math.PI) / 180;
    const x = Math.cos(a) * this.RADIUS;
    const z = Math.sin(a) * this.RADIUS;

    const group = new THREE.Group();
    group.position.set(x, 0, z);

    // Pedestal
    const pedGeom = new THREE.CylinderGeometry(0.85, 1.0, 0.5, 10);
    const pedMat = new THREE.MeshStandardMaterial({ color: 0x1d1814, roughness: 0.9 });
    const ped = new THREE.Mesh(pedGeom, pedMat);
    ped.position.y = 0.25;
    ped.castShadow = true;
    ped.receiveShadow = true;
    group.add(ped);

    // Glow ring (emissive disc just above pedestal)
    const ringMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.95, 1.2, 32), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.52;
    group.add(ring);
    (group.userData as { ring: THREE.Mesh }).ring = ring;

    // Icon mesh
    const iconMat = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.7,
      roughness: 0.4,
      metalness: 0.6,
    });
    const icon = iconBuilder(iconMat);
    icon.position.y = 1.05;
    icon.castShadow = true;
    group.add(icon);

    // Floating label sprite
    const labelTex = this.makeLabelTexture(label.toUpperCase());
    const labelMat = new THREE.SpriteMaterial({ map: labelTex, transparent: true, depthTest: false });
    const labelSprite = new THREE.Sprite(labelMat);
    labelSprite.position.y = 2.6;
    labelSprite.scale.set(2.8, 0.7, 1);
    group.add(labelSprite);

    const glow = new THREE.PointLight(color, 1.4, 6, 2);
    glow.position.y = 1.4;
    group.add(glow);

    // Face center
    group.rotation.y = Math.atan2(-x, -z);

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

  private buildStations() {
    // 7 stations in arc — Dungeon and Boss portals get larger, distinctive shapes.
    this.addStation("anvil", "Forge", "Craft & repair weapons and armor.", -20, 0xff7733, (mat) => {
      const g = new THREE.Group();
      const anvilTop = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.25, 0.6), mat);
      const anvilBody = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.5), mat);
      anvilBody.position.y = -0.3;
      g.add(anvilTop);
      g.add(anvilBody);
      return g;
    });

    this.addStation("skills", "Skill Obelisk", "Allocate skill points across your trees.", 20, 0x44aaff, (mat) => {
      const obelisk = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.4, 4), mat);
      return obelisk;
    });

    this.addStation("stats", "Soul Altar", "Distribute attribute points.", -60, 0xaa44ff, (mat) => {
      const g = new THREE.Group();
      const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.45, 0), mat);
      crystal.position.y = 0.2;
      g.add(crystal);
      return g;
    });

    this.addStation("quests", "War Board", "Review boss intel and active hunts.", 60, 0xffcc33, (mat) => {
      const g = new THREE.Group();
      const board = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.9, 0.08), mat);
      board.position.y = 0.1;
      g.add(board);
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.05, 1.2, 6),
        new THREE.MeshStandardMaterial({ color: 0x251a10 }),
      );
      post.position.y = -0.5;
      g.add(post);
      return g;
    });

    this.addStation("stash", "Stash", "Manage and equip your gear.", -100, 0x66ddaa, (mat) => {
      const g = new THREE.Group();
      const chest = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 0.6), mat);
      const lid = new THREE.Mesh(
        new THREE.CylinderGeometry(0.3, 0.3, 0.9, 8, 1, false, 0, Math.PI),
        mat,
      );
      lid.rotation.z = Math.PI / 2;
      lid.position.y = 0.25;
      g.add(chest);
      g.add(lid);
      return g;
    });

    this.addStation("portal_dungeon", "Dungeon Gate", "Enter the infinite dungeon.", -150, 0xff4422, (mat) => {
      const g = new THREE.Group();
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.12, 12, 24), mat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.4;
      g.add(ring);
      const portalDisc = new THREE.Mesh(
        new THREE.CircleGeometry(0.7, 24),
        new THREE.MeshBasicMaterial({ color: 0xff2200, transparent: true, opacity: 0.55 }),
      );
      portalDisc.rotation.x = Math.PI / 2;
      portalDisc.position.y = 0.41;
      g.add(portalDisc);
      return g;
    });

    this.addStation("portal_boss", "Boss Sigil", "Challenge a generated boss.", 150, 0xff22aa, (mat) => {
      const g = new THREE.Group();
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.12, 12, 24), mat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.4;
      g.add(ring);
      const portalDisc = new THREE.Mesh(
        new THREE.CircleGeometry(0.7, 24),
        new THREE.MeshBasicMaterial({ color: 0xaa00aa, transparent: true, opacity: 0.55 }),
      );
      portalDisc.rotation.x = Math.PI / 2;
      portalDisc.position.y = 0.41;
      g.add(portalDisc);
      return g;
    });
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

      // Drive with embedded clips + the shared KayKit animation library.
      this.heroAnim = new HeroAnimator(root, gltf.animations);
      loadCampAnimLibrary(loader).then((clips) => {
        if (this.disposed || !this.heroAnim) return;
        this.heroAnim.addLibraryClips(clips);
      });

      this.loaded = true;
      this.emitState();
    };

    loader.load(localUrl, onLoaded, undefined, () => {
      if (this.disposed) return;
      // Fallback to remote ObjectStore model.
      loader.load(remoteUrl, onLoaded, undefined, () => {
        if (this.disposed) return;
        // Final fallback: simple capsule.
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

  private _keyDown = (e: KeyboardEvent) => {
    this.keys.add(e.code);
    if (e.code === "KeyE") this.tryEngage();
    if (e.code === "KeyF") this.attackNearest();
    if (e.code === "Space") {
      e.preventDefault();
      this.doJump();
    }
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
    const forward = new THREE.Vector3(Math.sin(this.playerFacing), 0, Math.cos(this.playerFacing));
    const B = this.BOUNDS - 1;
    this.playerPos.x = Math.max(-B, Math.min(B, this.playerPos.x + forward.x * 2.4));
    this.playerPos.z = Math.max(-B, Math.min(B, this.playerPos.z + forward.z * 2.4));
    this.playerTarget = null;
    this.heroAnim?.trigger("dodge");
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

    // Alternate animation flavour: even slots melee, odd slots cast.
    const isCast = idx % 2 === 1;
    if (this.heroAnim) {
      const played = this.heroAnim.trigger(isCast ? "cast" : "attack");
      if (!played) this.proceduralLunge();
    } else {
      this.proceduralLunge();
    }

    // Damage: skills hit dummies within a radius in front of / around the player.
    const radius = isCast ? 5.5 : 3.2;
    const forward = new THREE.Vector3(Math.sin(this.playerFacing), 0, Math.cos(this.playerFacing));
    const center = this.playerPos.clone().add(forward.multiplyScalar(isCast ? 2.5 : 1.6));
    const mult = isCast ? 2.4 : 1.8;
    let hitAny = false;
    for (const d of this.dummies) {
      if (!d.alive) continue;
      if (d.pos.distanceTo(center) <= radius) {
        const isCrit = Math.random() < this.critChance + 0.05;
        const dmg = Math.round(this.baseDamage * mult * (isCrit ? 2 : 1) * (0.85 + Math.random() * 0.3));
        this.damageDummy(d, dmg, isCrit, true);
        hitAny = true;
      }
    }
    this.spawnVfx(center, isCast ? 0x66aaff : 0xffaa33, radius);
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
    this.renderer.render(this.scene, this.camera);
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
      if (d < 2.6 && (!closest || d < closest.d)) closest = { st, d };
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
    const now = performance.now();
    this.options.onStateUpdate({
      nearbyStationId: this.currentNearbyId,
      nearbyStationLabel: st?.label ?? null,
      nearbyStationHint: st?.hint ?? null,
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
    this.embers = [];
    this.vfx = [];
    this.dummies = [];
    this.playerGroup = null;
    // Release every GPU resource owned by the scene (player, stations,
    // environment, labels/CanvasTextures, campfire, embers, vfx, dummies).
    disposeObject3D(this.scene);
    this.scene.clear();
    this.renderer.dispose();
  }
}

// ─── Shared KayKit animation library (clip-name → clip) ───────────────────────
/**
 * Recursively dispose every geometry, material and texture under `root`.
 * Uses `.isMesh` flag checks (NOT `instanceof`) because the app can load
 * multiple Three.js instances, which breaks `instanceof`.
 */
function disposeObject3D(root: THREE.Object3D) {
  root.traverse((c) => {
    const mesh = c as THREE.Mesh;
    if (!(mesh as unknown as { isMesh?: boolean }).isMesh) return;
    if (mesh.geometry) mesh.geometry.dispose();
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      if (!m) continue;
      const mm = m as THREE.Material & Record<string, unknown>;
      for (const key of Object.keys(mm)) {
        const val = mm[key] as { isTexture?: boolean; dispose?: () => void } | undefined;
        if (val && val.isTexture && typeof val.dispose === "function") val.dispose();
      }
      m.dispose();
    }
  });
}

const CAMP_KIT_BASE = `${import.meta.env.BASE_URL}models/kaykit`;
const CAMP_ANIM_FILES = [
  "anim/general.glb",
  "anim/movement.glb",
  "anim/combat.glb",
  // Richer Rig_Medium clip packs (jump/dodge/run variants, ranged/spell casts,
  // special emotes). Same rig as the heroes → bone names match.
  "anim-ext/movement_advanced.glb",
  "anim-ext/combat_ranged.glb",
  "anim-ext/special.glb",
];
let campAnimCache: THREE.AnimationClip[] | null = null;
let campAnimPromise: Promise<THREE.AnimationClip[]> | null = null;

function loadCampAnimLibrary(loader: GLTFLoader): Promise<THREE.AnimationClip[]> {
  if (campAnimCache) return Promise.resolve(campAnimCache);
  if (campAnimPromise) return campAnimPromise;
  campAnimPromise = (async () => {
    const all: THREE.AnimationClip[] = [];
    await Promise.all(
      CAMP_ANIM_FILES.map(
        (f) =>
          new Promise<void>((resolve) => {
            loader.load(
              `${CAMP_KIT_BASE}/${f}`,
              (g) => {
                for (const clip of g.animations) all.push(clip);
                resolve();
              },
              undefined,
              () => resolve(),
            );
          }),
      ),
    );
    campAnimCache = all;
    return all;
  })();
  return campAnimPromise;
}

/**
 * HeroAnimator — drives the camp player with a full KayKit clip set.
 *
 * Resolves logical states (idle / walk / run / attack / cast / hit / jump /
 * dodge) from candidate clip-name lists, matching whatever clips ship embedded
 * in the hero GLB and whatever is added later from the shared library. One-shot
 * states (attack/cast/hit/jump/dodge) play once then fade back to locomotion.
 * `trigger()` returns false when no clip resolves so the caller can fall back to
 * a procedural lunge.
 */
type HeroState = "idle" | "walk" | "run" | "attack" | "cast" | "hit" | "jump" | "dodge";

const HERO_CANDIDATES: Record<HeroState, string[]> = {
  idle: ["idle_a", "idle", "idle_b"],
  walk: ["walking_c", "walking_b", "walking_a", "walk", "walking"],
  run: ["running_a", "running_b", "running", "jog", "sprint", "run"],
  attack: [
    "1h_melee_attack_chop",
    "melee_1h_attack_chop",
    "2h_melee_attack_chop",
    "melee_2h_attack",
    "unarmed_attack",
    "attack",
    "slash",
    "chop",
    "slice",
    "stab",
    "punch",
  ],
  cast: ["spellcast", "spell", "cast", "2h_ranged", "ranged", "shoot", "throw", "magic"],
  hit: ["hit_a", "hit_b", "hit", "damage"],
  jump: ["jump_full", "jump", "jumping"],
  dodge: ["dodge", "roll", "evade"],
};

class HeroAnimator {
  private mixer: THREE.AnimationMixer;
  private root: THREE.Object3D;
  private byName = new Map<string, THREE.AnimationClip>();
  private actions: Partial<Record<HeroState, THREE.AnimationAction>> = {};
  private current: HeroState = "idle";
  private oneShot: THREE.AnimationAction | null = null;
  private wantMoving = false;
  private onFinished: (e: { action: THREE.AnimationAction }) => void;

  constructor(root: THREE.Object3D, embedded: THREE.AnimationClip[]) {
    this.root = root;
    this.mixer = new THREE.AnimationMixer(root);
    this.indexClips(embedded);
    this.rebuildActions();

    this.onFinished = (e) => {
      if (this.oneShot && e.action === this.oneShot) {
        this.oneShot = null;
        const back = this.actions[this.wantMoving ? this.locomotion() : "idle"];
        if (back) {
          back.reset().fadeIn(0.12).play();
          this.current = this.wantMoving ? this.locomotion() : "idle";
        }
      }
    };
    this.mixer.addEventListener(
      "finished",
      this.onFinished as unknown as THREE.EventListener<object, "finished", THREE.AnimationMixer>,
    );

    const idle = this.actions.idle ?? this.actions.walk;
    if (idle) {
      idle.reset().play();
      this.current = this.actions.idle ? "idle" : "walk";
    }
  }

  private indexClips(clips: THREE.AnimationClip[]) {
    for (const c of clips) {
      const key = c.name.toLowerCase();
      if (!this.byName.has(key)) this.byName.set(key, c);
    }
  }

  private resolve(state: HeroState): THREE.AnimationClip | undefined {
    for (const cand of HERO_CANDIDATES[state]) {
      for (const [name, clip] of this.byName) {
        if (name.includes(cand)) return clip;
      }
    }
    return undefined;
  }

  private rebuildActions() {
    (Object.keys(HERO_CANDIDATES) as HeroState[]).forEach((state) => {
      if (this.actions[state]) return;
      const clip = this.resolve(state);
      if (clip) this.actions[state] = this.mixer.clipAction(clip);
    });
  }

  /** Add clips from the shared library after async load and re-resolve states. */
  addLibraryClips(clips: THREE.AnimationClip[]) {
    this.indexClips(clips);
    this.rebuildActions();
    // If we were idling with nothing, start idle now.
    if (!this.oneShot && this.actions[this.current]) {
      this.actions[this.current]!.play();
    }
  }

  private locomotion(): HeroState {
    return this.actions.walk ? "walk" : this.actions.run ? "run" : "idle";
  }

  setMoving(moving: boolean) {
    this.wantMoving = moving;
    if (this.oneShot) return;
    const next: HeroState = moving ? this.locomotion() : "idle";
    if (next === this.current) return;
    const prev = this.actions[this.current];
    const nextA = this.actions[next];
    if (!nextA) return;
    prev?.fadeOut(0.18);
    nextA.reset().fadeIn(0.18).play();
    this.current = next;
  }

  /** Play a one-shot state. Returns false if no clip resolves. */
  trigger(state: HeroState): boolean {
    const a = this.actions[state];
    if (!a || this.oneShot) return !!a;
    this.oneShot = a;
    a.reset();
    a.setLoop(THREE.LoopOnce, 1);
    a.clampWhenFinished = false;
    a.fadeIn(0.06).play();
    this.actions[this.current]?.fadeOut(0.06);
    return true;
  }

  update(delta: number) {
    this.mixer.update(delta);
  }

  dispose() {
    this.mixer.removeEventListener(
      "finished",
      this.onFinished as unknown as THREE.EventListener<object, "finished", THREE.AnimationMixer>,
    );
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.root);
  }
}
