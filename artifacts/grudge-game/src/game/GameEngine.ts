import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { createEnemyModel, updateEnemyAnimation, makeAnimState, type EnemyModel, type AnimState } from "./EnemyFactory";
import { isMonsterId, loadMonsterModel, disposeMonsterModel, MONSTER_TEMPLATES } from "./MonsterModels";
import { isKitMonsterId, loadKitMonster, disposeKitModel, KIT_TEMPLATES } from "./KayKitCharacter";
import { makeGroundMaterial, makeRockField, makeTerrainSkirt } from "./proceduralTextures";
import { buildOrcCamp, type CampHandle } from "./CampBuilder";
import { PlayerAnimator, buildAuthoredClips, pickSkinClips } from "./PlayerAnimator";
import { PORTRAIT_URL, resolveVisibleMeshes, type RaceId } from "../data/characterMeshes";
import { getSkin, skinUrl, type SkinDef } from "../data/skins";

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
  private DUNGEON = 50;

  // Larger-map / best-practice additions.
  private sun: THREE.DirectionalLight | null = null;
  private groundMesh: THREE.Mesh | null = null;
  private rockField: THREE.InstancedMesh | null = null;
  private terrainMesh: THREE.Mesh | null = null;
  private camp: CampHandle | null = null;
  private hoveredEnemy: EnemyInstance | null = null;
  private hoverEmissive = new Map<THREE.MeshStandardMaterial, { hex: number; intensity: number }>();
  private _moveHandler!: (e: MouseEvent) => void;

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
    this.scene.fog = new THREE.FogExp2(0x060608, 0.018);

    const aspect = w / h;
    const d = 13;
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

    this.buildDungeon();
    this.loadEnvironment();
    this.camp = buildOrcCamp(this.loader, this.scene, `${import.meta.env.BASE_URL}models/buildings/orc_camp_set.glb`);
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
    this.loader.load(
      url,
      (gltf) => {
        const root = gltf.scene;
        // Measure the raw bbox so we can recenter + scale uniformly.
        const bbox = new THREE.Box3().setFromObject(root);
        const size = new THREE.Vector3(); bbox.getSize(size);
        const center = new THREE.Vector3(); bbox.getCenter(center);

        // Keep the forge a fixed-size central landmark (~40 units) instead of
        // stretching it across the whole enlarged map — the textured ground +
        // rock field fill the rest, giving a real sense of scale.
        const targetExtent = 40;
        const longestXZ = Math.max(size.x, size.z) || 1;
        const scale = targetExtent / longestXZ;

        root.scale.setScalar(scale);
        // After scaling, recenter so (cx, cz) lands at origin and floor sits at y≈0.
        root.position.set(-center.x * scale, -bbox.min.y * scale, -center.z * scale);

        root.traverse((child) => {
          const m = child as THREE.Mesh;
          if (m.isMesh) {
            m.castShadow = true;
            m.receiveShadow = true;
          }
        });

        this.scene.add(root);
      },
      undefined,
      (err) => {
        // Non-fatal: gameplay still works on the invisible click plane.
        // eslint-disable-next-line no-console
        console.warn("[GameEngine] forge-scene.glb failed to load:", err);
      },
    );
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
    sun.shadow.camera.far = 120;
    sun.shadow.camera.left = sun.shadow.camera.bottom = -35;
    sun.shadow.camera.right = sun.shadow.camera.top = 35;
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
    const skin = getSkin(this.initStats.skinId);
    if (skin) this.loadSkinModel(skin);
    else this.loadRaceModel();
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
        this.finalizePlayer(wrapper, new PlayerAnimator(model, clips));
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

    // Always spawn one of each imported GLB monster so they're guaranteed to
    // appear in the dungeon alongside the procedural roster.
    for (const m of MONSTER_TEMPLATES) configs.push({ template: m, count: 1 });

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

  private createEnemy(template: EnemyTemplate, pos: THREE.Vector3): EnemyInstance {
    const id = `e${this.enemyIdCounter++}`;
    const retag = (m: EnemyModel) => {
      // Re-tag children once the GLB has streamed in so raycast targeting
      // works on the real meshes.
      m.group.traverse((c) => { c.userData.enemyId = id; });
    };
    const model = isKitMonsterId(template.id)
      ? loadKitMonster(template.id, this.loader, retag)
      : isMonsterId(template.id)
        ? loadMonsterModel(template.id, this.loader, retag)
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
    };
    this._keyUpHandler = (e: KeyboardEvent) => this.keys.delete(e.code);
    this._clickHandler = (e: MouseEvent) => this.handleClick(e, container);
    this._moveHandler = (e: MouseEvent) => this.handleHover(e, container);

    window.addEventListener("keydown", this._keyDownHandler);
    window.addEventListener("keyup", this._keyUpHandler);
    container.addEventListener("click", this._clickHandler);
    container.addEventListener("mousemove", this._moveHandler);
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

    const floorHit = this.raycaster.intersectObject(this.floorPlane);
    if (floorHit.length > 0) {
      const pt = floorHit[0].point;
      const D = this.DUNGEON - 1;
      this.playerTarget = new THREE.Vector3(
        Math.max(-D, Math.min(D, pt.x)),
        0,
        Math.max(-D, Math.min(D, pt.z))
      );
      this.targetEnemy = null;
      if (this.indicatorRing) {
        this.indicatorRing.position.set(this.playerTarget.x, 0.08, this.playerTarget.z);
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
      if (isKitMonsterId(enemy.template.id)) {
        disposeKitModel(enemy.model);
      } else if (isMonsterId(enemy.template.id)) {
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
    this.renderer.render(this.scene, this.camera);
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
      const D = this.DUNGEON - 1;
      this.playerPos.x = Math.max(-D, Math.min(D, this.playerPos.x + raw.x * this.playerSpeed * delta));
      this.playerPos.z = Math.max(-D, Math.min(D, this.playerPos.z + raw.y * this.playerSpeed * delta));
      this.playerTarget = null;
      this.targetEnemy = null;
      if (this.indicatorRing) this.indicatorRing.visible = false;
      this.playerFacing = Math.atan2(raw.x, raw.y);
      playerMoving = true;
    }

    if (this.playerTarget) {
      const toTarget = new THREE.Vector3().subVectors(this.playerTarget, this.playerPos);
      const distToTarget = toTarget.length();
      const stopDist = this.targetEnemy ? 2.8 : 0.2;
      if (distToTarget > stopDist) {
        toTarget.normalize();
        const D = this.DUNGEON - 1;
        this.playerPos.x = Math.max(-D, Math.min(D, this.playerPos.x + toTarget.x * this.playerSpeed * delta));
        this.playerPos.z = Math.max(-D, Math.min(D, this.playerPos.z + toTarget.z * this.playerSpeed * delta));
        this.playerFacing = Math.atan2(toTarget.x, toTarget.z);
        playerMoving = true;
      } else {
        if (this.targetEnemy && this.playerAttackCooldown <= 0) {
          this.doAttack(this.targetEnemy);
        } else if (!this.targetEnemy) {
          this.playerTarget = null;
          if (this.indicatorRing) this.indicatorRing.visible = false;
        }
      }
    }

    if (this.targetEnemy && this.playerAttackCooldown <= 0) {
      const d = this.playerPos.distanceTo(this.targetEnemy.position);
      if (d <= 3.2 && this.targetEnemy.state !== "dead" && this.targetEnemy.state !== "death") {
        this.doAttack(this.targetEnemy);
      }
    }

    if (this.playerGroup) {
      const targetPos = new THREE.Vector3(this.playerPos.x, 0, this.playerPos.z);
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
          const D = this.DUNGEON - 1;
          en.position.x = Math.max(-D, Math.min(D, en.position.x + dir.x * en.speed * delta));
          en.position.z = Math.max(-D, Math.min(D, en.position.z + dir.z * en.speed * delta));
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

    // Sync mesh position + rotation
    en.model.group.position.x = en.position.x;
    en.model.group.position.z = en.position.z;
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
    cancelAnimationFrame(this.animFrameId);
    window.removeEventListener("resize", this.onResize);
    window.removeEventListener("keydown", this._keyDownHandler);
    window.removeEventListener("keyup", this._keyUpHandler);
    if (this.container) {
      this.container.removeEventListener("click", this._clickHandler);
      if (this._moveHandler) this.container.removeEventListener("mousemove", this._moveHandler);
      if (this.renderer.domElement.parentNode === this.container) {
        this.container.removeChild(this.renderer.domElement);
      }
    }
    this.clearHover();
    this.playerAnimator?.dispose();
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
    if (this.rockField) {
      this.rockField.geometry.dispose();
      (this.rockField.material as THREE.Material).dispose();
    }
    this.renderer.dispose();
    for (const en of this.enemies) {
      en.model.group.userData.disposed = true;
      if (isKitMonsterId(en.template.id)) {
        disposeKitModel(en.model);
      } else if (isMonsterId(en.template.id)) {
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
