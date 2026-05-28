import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const R2_BASE = "https://pub-e7fcf1fd4c9946ecb84b3766bbc7b50d.r2.dev";
const OBJECTSTORE_BASE = "https://molochdagod.github.io/ObjectStore";

const CLASS_MODEL: Record<string, string> = {
  warrior: "Knight",
  mage:    "Mage",
  ranger:  "Ranger",
  worge:   "Barbarian",
};

export type AnimName = "idle" | "walk" | "attack1" | "hurt" | "death";

export interface EnemyAnim { file: string; frames: number; }

export interface EnemyTemplate {
  id: string;
  name: string;
  tier: number;
  hp: number;
  damage: number;
  folder: string;
  frameWidth: number;
  frameHeight: number;
  animations: Partial<Record<AnimName, EnemyAnim>>;
}

export interface EnemyInstance {
  id: string;
  template: EnemyTemplate;
  mesh: THREE.Mesh;
  hp: number;
  maxHp: number;
  state: "idle" | "patrol" | "chase" | "attack" | "hurt" | "death" | "dead";
  currentAnim: AnimName;
  frameTime: number;
  currentFrame: number;
  textures: Partial<Record<AnimName, THREE.Texture>>;
  material: THREE.MeshBasicMaterial;
  position: THREE.Vector3;
  patrolTarget: THREE.Vector3;
  spawnPos: THREE.Vector3;
  attackCooldown: number;
  aggroRange: number;
  attackRange: number;
  speed: number;
  hurtTimer: number;
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
}

export class GameEngine {
  private scene!: THREE.Scene;
  private camera!: THREE.OrthographicCamera;
  private renderer!: THREE.WebGLRenderer;
  private clock!: THREE.Clock;
  private loader!: GLTFLoader;
  private textureLoader!: THREE.TextureLoader;
  private animFrameId = 0;
  private floorPlane!: THREE.Mesh;
  private raycaster = new THREE.Raycaster();
  private container: HTMLDivElement | null = null;

  private playerGroup: THREE.Group | null = null;
  private playerMixer: THREE.AnimationMixer | null = null;
  private playerPos = new THREE.Vector3(0, 0, 0);
  private playerTarget: THREE.Vector3 | null = null;
  private playerSpeed = 6;
  private playerFacing = 1;
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
  private playerAttackSpeed = 0.75;

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
  private DUNGEON = 14;

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

    const w = container.clientWidth;
    const h = container.clientHeight;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x060608);
    this.scene.fog = new THREE.FogExp2(0x060608, 0.022);

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
    container.appendChild(this.renderer.domElement);

    this.clock = new THREE.Clock();
    this.loader = new GLTFLoader();
    this.textureLoader = new THREE.TextureLoader();

    this.buildDungeon();
    this.setupLighting();
    this.loadPlayerModel(stats.charClass);
    this.spawnInitialEnemies();
    this.setupInput(container);

    window.addEventListener("resize", this.onResize);
    this.animate();
  }

  private buildDungeon() {
    const D = this.DUNGEON;

    const mats = [
      new THREE.MeshStandardMaterial({ color: 0x181618, roughness: 0.95 }),
      new THREE.MeshStandardMaterial({ color: 0x111013, roughness: 1.0 }),
      new THREE.MeshStandardMaterial({ color: 0x1a0f0f, roughness: 0.9 }),
    ];
    const tileGeo = new THREE.BoxGeometry(1, 0.12, 1);

    for (let x = -D; x <= D; x++) {
      for (let z = -D; z <= D; z++) {
        const n = Math.sin(x * 5.3 + z * 7.1) * Math.sin(x * 2.7 + z * 4.3);
        const mat = n > 0.3 ? mats[2] : (x + z) % 2 === 0 ? mats[0] : mats[1];
        const tile = new THREE.Mesh(tileGeo, mat);
        tile.position.set(x, -0.06, z);
        tile.receiveShadow = true;
        this.scene.add(tile);
      }
    }

    const clickPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(D * 2, D * 2),
      new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide })
    );
    clickPlane.rotation.x = -Math.PI / 2;
    clickPlane.position.y = 0.05;
    this.scene.add(clickPlane);
    this.floorPlane = clickPlane;

    const wallMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0c, roughness: 1 });
    const wallH = 4.5;
    const walls: [number, number, number, number][] = [
      [0, D + 0.5, D * 2 + 1, 1],
      [0, -D - 0.5, D * 2 + 1, 1],
      [D + 0.5, 0, 1, D * 2 + 2],
      [-D - 0.5, 0, 1, D * 2 + 2],
    ];
    for (const [wx, wz, ww, wl] of walls) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(ww, wallH, wl), wallMat);
      wall.position.set(wx, wallH / 2, wz);
      wall.castShadow = true;
      wall.receiveShadow = true;
      this.scene.add(wall);
    }

    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x0d0c0e, roughness: 0.9 });
    const pillarPositions = [
      [-7, -7], [7, -7], [-7, 7], [7, 7],
      [0, -10], [0, 10], [-10, 0], [10, 0],
    ];
    for (const [px, pz] of pillarPositions) {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.9, 4.5, 0.9), pillarMat);
      pillar.position.set(px, 2.25, pz);
      pillar.castShadow = true;
      pillar.receiveShadow = true;
      this.scene.add(pillar);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.3, 1.1), pillarMat);
      cap.position.set(px, 4.65, pz);
      this.scene.add(cap);
    }

    const ringGeo = new THREE.RingGeometry(0.3, 0.45, 24);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide });
    this.indicatorRing = new THREE.Mesh(ringGeo, ringMat);
    this.indicatorRing.rotation.x = -Math.PI / 2;
    this.indicatorRing.position.y = 0.08;
    this.indicatorRing.visible = false;
    this.scene.add(this.indicatorRing);
  }

  private setupLighting() {
    const ambient = new THREE.AmbientLight(0x120a08, 2.5);
    this.scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xff9955, 2.2);
    sun.position.set(20, 30, 20);
    sun.castShadow = true;
    sun.shadow.mapSize.setScalar(2048);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 120;
    sun.shadow.camera.left = sun.shadow.camera.bottom = -25;
    sun.shadow.camera.right = sun.shadow.camera.top = 25;
    sun.shadow.bias = -0.001;
    this.scene.add(sun);

    const fill = new THREE.DirectionalLight(0x1a2050, 0.6);
    fill.position.set(-15, 8, -15);
    this.scene.add(fill);

    const torchPositions = [
      [-7, -7], [7, -7], [-7, 7], [7, 7],
      [0, -10], [0, 10], [-10, 0], [10, 0],
    ];
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

  private loadPlayerModel(charClass: string) {
    const modelName = CLASS_MODEL[charClass?.toLowerCase()] ?? "Knight";
    const url = `${OBJECTSTORE_BASE}/models/characters/kaykit/${modelName}.glb`;

    this.loader.load(
      url,
      (gltf) => {
        this.playerGroup = gltf.scene;
        this.playerGroup.scale.setScalar(1.05);
        this.playerGroup.position.copy(this.playerPos);

        this.playerGroup.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        this.scene.add(this.playerGroup);

        if (gltf.animations.length > 0) {
          this.playerMixer = new THREE.AnimationMixer(this.playerGroup);
          const clip = gltf.animations.find((a) => /idle/i.test(a.name)) ?? gltf.animations[0];
          this.playerMixer.clipAction(clip).play();
        }

        const ring = new THREE.Mesh(
          new THREE.RingGeometry(0.55, 0.7, 32),
          new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide })
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.08;
        this.playerGroup.add(ring);

        this.loaded = true;
        this.notifyState();
      },
      undefined,
      () => {
        this.playerGroup = this.buildFallbackPlayer();
        this.scene.add(this.playerGroup);
        this.loaded = true;
        this.notifyState();
      }
    );
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

    // Pick tier 1-2 enemies for starter dungeon
    const tier1 = this.enemyTemplates.filter((t) => t.tier === 1);
    const tier2 = this.enemyTemplates.filter((t) => t.tier === 2);
    const tier3 = this.enemyTemplates.filter((t) => t.tier === 3);

    // Select up to 4 distinct enemy types from lower tiers, spread across dungeon
    const picked: EnemyTemplate[] = [];
    const shuffle = <T,>(arr: T[]) => [...arr].sort(() => Math.random() - 0.5);

    const t1s = shuffle(tier1).slice(0, 3);
    const t2s = shuffle(tier2).slice(0, 2);
    const t3s = shuffle(tier3).slice(0, 1);
    picked.push(...t1s, ...t2s, ...t3s);

    if (picked.length === 0) {
      // fallback: spawn any
      picked.push(...shuffle(this.enemyTemplates).slice(0, 4));
    }

    const configs: Array<{ template: EnemyTemplate; count: number }> = picked.map((t) => ({
      template: t,
      count: t.tier === 1 ? 3 : t.tier === 2 ? 2 : 1,
    }));

    for (const { template, count } of configs) {
      for (let i = 0; i < count; i++) {
        const D = this.DUNGEON - 2;
        let x = 0, z = 0;
        let attempts = 0;
        do {
          x = (Math.random() * 2 - 1) * D;
          z = (Math.random() * 2 - 1) * D;
          attempts++;
        } while (Math.sqrt(x * x + z * z) < 5 && attempts < 20);
        this.createEnemy(template, new THREE.Vector3(x, 0, z));
      }
    }
  }

  private createEnemy(template: EnemyTemplate, pos: THREE.Vector3): EnemyInstance {
    const id = `e${this.enemyIdCounter++}`;
    // Scale based on frame size and tier
    const baseScale = Math.max(template.frameWidth, template.frameHeight) / 100;
    const scale = Math.max(1.8, Math.min(4.5, baseScale * (1.5 + template.tier * 0.3)));

    const geo = new THREE.PlaneGeometry(scale, scale);
    const mat = new THREE.MeshBasicMaterial({
      transparent: true,
      alphaTest: 0.05,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(pos.x, scale / 2, pos.z);
    mesh.userData.enemyId = id;
    mesh.userData.spriteScale = scale;
    this.scene.add(mesh);

    const enemy: EnemyInstance = {
      id, template, mesh,
      hp: template.hp, maxHp: template.hp,
      state: "idle", currentAnim: "idle",
      frameTime: 0, currentFrame: 0,
      textures: {}, material: mat,
      position: pos.clone(),
      patrolTarget: pos.clone(),
      spawnPos: pos.clone(),
      attackCooldown: Math.random() * 1.5,
      aggroRange: 6 + template.tier * 0.7,
      attackRange: 1.6 + template.tier * 0.2,
      speed: 2.2 + template.tier * 0.45,
      hurtTimer: 0,
    };

    this.enemies.push(enemy);

    // Load animations that exist for this enemy
    for (const anim of ["idle", "walk", "attack1", "hurt", "death"] as AnimName[]) {
      if (template.animations[anim]) {
        this.loadEnemyAnim(enemy, anim);
      }
    }

    return enemy;
  }

  private loadEnemyAnim(enemy: EnemyInstance, anim: AnimName) {
    const animData = enemy.template.animations[anim];
    if (!animData) return;

    const url = `${R2_BASE}/${enemy.template.folder}/${animData.file}`;
    const tex = this.textureLoader.load(url, (loadedTex) => {
      // Set repeat AFTER load to know natural image dimensions
      loadedTex.wrapS = THREE.RepeatWrapping;
      loadedTex.colorSpace = THREE.SRGBColorSpace;
      loadedTex.magFilter = THREE.NearestFilter;
      loadedTex.minFilter = THREE.NearestFilter;
      loadedTex.repeat.x = 1 / animData.frames;
      loadedTex.offset.x = 0;

      if (anim === "idle" && !enemy.material.map) {
        enemy.material.map = loadedTex;
        enemy.material.needsUpdate = true;
      }
      enemy.textures[anim] = loadedTex;
    });
    // Pre-set repeat so it's correct if accessed before load completes
    tex.wrapS = THREE.RepeatWrapping;
    tex.repeat.x = 1 / animData.frames;
    tex.offset.x = 0;
  }

  private playEnemyAnim(enemy: EnemyInstance, anim: AnimName) {
    const target = enemy.template.animations[anim] ? anim : "idle";
    if (enemy.currentAnim === target) return;
    const tex = enemy.textures[target];
    if (!tex) return;
    enemy.currentAnim = target;
    enemy.currentFrame = 0;
    enemy.frameTime = 0;
    tex.offset.x = 0;
    enemy.material.map = tex;
    enemy.material.needsUpdate = true;
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

    window.addEventListener("keydown", this._keyDownHandler);
    window.addEventListener("keyup", this._keyUpHandler);
    container.addEventListener("click", this._clickHandler);
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

    const liveMeshes = this.enemies
      .filter((en) => en.state !== "dead" && en.state !== "death")
      .map((en) => en.mesh);
    const hits = this.raycaster.intersectObjects(liveMeshes);
    if (hits.length > 0) {
      const eid = (hits[0].object as THREE.Mesh).userData.enemyId as string;
      const enemy = this.enemies.find((en) => en.id === eid);
      if (enemy) {
        this.targetEnemy = enemy;
        this.playerTarget = enemy.position.clone();
        return;
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
    if (nearest && nearestDist < 4) this.doAttack(nearest);
  }

  private doAttack(enemy: EnemyInstance) {
    if (this.playerAttackCooldown > 0) return;
    if (enemy.state === "dead" || enemy.state === "death") return;

    const dist = this.playerPos.distanceTo(enemy.position);
    if (dist > 3.8) {
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

    const dx = enemy.position.x - this.playerPos.x;
    this.playerFacing = dx >= 0 ? 1 : -1;

    const wp = enemy.mesh.position.clone();
    wp.y += 1.2;
    this.damageNumbers.push({ id: `d${this.idCounter++}`, value: dmg, worldPos: wp, age: 0, isPlayer: false, isCrit });

    const critTxt = isCrit ? " CRIT!" : "";
    this.log(`You hit ${enemy.template.name} for ${dmg}${critTxt}`);

    if (enemy.hp <= 0) {
      this.killEnemy(enemy);
    } else {
      this.playEnemyAnim(enemy, "hurt");
      enemy.state = "hurt";
      enemy.hurtTimer = 0.5;
    }
    this.notifyState();
  }

  private killEnemy(enemy: EnemyInstance) {
    enemy.hp = 0;
    enemy.state = "death";
    this.playEnemyAnim(enemy, "death");
    if (this.targetEnemy === enemy) this.targetEnemy = null;

    const xp = enemy.template.tier * 50 + 25;
    this.playerXp += xp;
    this.log(`${enemy.template.name} defeated! +${xp} XP`);

    const deathFrames = enemy.template.animations.death?.frames ?? 4;
    const deathDuration = (deathFrames * 1000) / 8;
    setTimeout(() => {
      enemy.state = "dead";
      this.scene.remove(enemy.mesh);
    }, deathDuration + 200);

    setTimeout(() => {
      const idx = this.enemies.indexOf(enemy);
      if (idx !== -1) this.enemies.splice(idx, 1);
      // Respawn same template near spawn point
      const spawnPos = enemy.spawnPos.clone();
      spawnPos.x += (Math.random() - 0.5) * 3;
      spawnPos.z += (Math.random() - 0.5) * 3;
      this.createEnemy(enemy.template, spawnPos);
    }, 12000);
  }

  private takeDamage(amount: number, source: string) {
    // Defense reduces incoming damage
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

    const raw = new THREE.Vector2();
    if (this.keys.has("KeyW") || this.keys.has("ArrowUp"))    { raw.x -= 1; raw.y -= 1; }
    if (this.keys.has("KeyS") || this.keys.has("ArrowDown"))  { raw.x += 1; raw.y += 1; }
    if (this.keys.has("KeyA") || this.keys.has("ArrowLeft"))  { raw.x -= 1; raw.y += 1; }
    if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) { raw.x += 1; raw.y -= 1; }

    if (raw.length() > 0) {
      raw.normalize();
      const D = this.DUNGEON - 1;
      this.playerPos.x = Math.max(-D, Math.min(D, this.playerPos.x + raw.x * this.playerSpeed * delta));
      this.playerPos.z = Math.max(-D, Math.min(D, this.playerPos.z + raw.y * this.playerSpeed * delta));
      this.playerTarget = null;
      this.targetEnemy = null;
      if (this.indicatorRing) this.indicatorRing.visible = false;
      if (raw.x > 0) this.playerFacing = 1;
      else if (raw.x < 0) this.playerFacing = -1;
    }

    if (this.playerTarget) {
      const toTarget = new THREE.Vector3().subVectors(this.playerTarget, this.playerPos);
      const distToTarget = toTarget.length();
      const stopDist = this.targetEnemy ? 2.5 : 0.2;
      if (distToTarget > stopDist) {
        toTarget.normalize();
        const D = this.DUNGEON - 1;
        this.playerPos.x = Math.max(-D, Math.min(D, this.playerPos.x + toTarget.x * this.playerSpeed * delta));
        this.playerPos.z = Math.max(-D, Math.min(D, this.playerPos.z + toTarget.z * this.playerSpeed * delta));
        if (toTarget.x > 0.1) this.playerFacing = 1;
        else if (toTarget.x < -0.1) this.playerFacing = -1;
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
      if (d <= 3.0 && this.targetEnemy.state !== "dead" && this.targetEnemy.state !== "death") {
        this.doAttack(this.targetEnemy);
      }
    }

    if (this.playerGroup) {
      const targetPos = new THREE.Vector3(this.playerPos.x, 0, this.playerPos.z);
      this.playerGroup.position.lerp(targetPos, 0.3);
      this.playerGroup.scale.x = this.playerFacing * Math.abs(this.playerGroup.scale.x);
    }

    if (this.playerMixer) this.playerMixer.update(delta);

    const camOffset = new THREE.Vector3(18, 18, 18);
    const camTarget = new THREE.Vector3(this.playerPos.x, 0, this.playerPos.z).add(camOffset);
    this.camera.position.lerp(camTarget, 0.07);
    this.camera.lookAt(this.playerPos.x, 0, this.playerPos.z);

    for (let i = 0; i < this.torchLights.length; i++) {
      const t = this.torchLights[i];
      t.intensity = 2.5 + Math.sin(elapsed * 5.7 + i * 2.3) * 0.5 + Math.sin(elapsed * 13.1 + i * 1.7) * 0.25;
    }

    for (const en of this.enemies) {
      if (en.state === "dead") continue;
      this.updateEnemy(en, delta);
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

  private updateEnemy(en: EnemyInstance, delta: number) {
    if (en.attackCooldown > 0) en.attackCooldown -= delta;
    if (en.hurtTimer > 0) {
      en.hurtTimer -= delta;
      if (en.hurtTimer <= 0 && en.state === "hurt") {
        en.state = "chase";
      }
    }

    const distToPlayer = en.position.distanceTo(this.playerPos);

    if (en.state !== "hurt" && en.state !== "death") {
      if (distToPlayer < en.aggroRange) {
        if (distToPlayer <= en.attackRange) {
          if (en.state !== "attack") {
            en.state = "attack";
            this.playEnemyAnim(en, "attack1");
          }
          if (en.attackCooldown <= 0) {
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
          this.playEnemyAnim(en, "walk");
        }
      } else {
        const distToPatrol = en.position.distanceTo(en.patrolTarget);
        if (distToPatrol < 0.3) {
          en.patrolTarget.set(
            en.spawnPos.x + (Math.random() * 2 - 1) * 3.5,
            0,
            en.spawnPos.z + (Math.random() * 2 - 1) * 3.5
          );
          this.playEnemyAnim(en, "idle");
          en.state = "idle";
        } else {
          const dir = new THREE.Vector3().subVectors(en.patrolTarget, en.position).normalize();
          en.position.x += dir.x * en.speed * 0.45 * delta;
          en.position.z += dir.z * en.speed * 0.45 * delta;
          this.playEnemyAnim(en, "walk");
          en.state = "patrol";
        }
      }
    }

    const scale = (en.mesh.userData.spriteScale as number) ?? 2.2;
    en.mesh.position.set(en.position.x, scale / 2, en.position.z);
    en.mesh.quaternion.copy(this.camera.quaternion);

    const facingRight = en.position.x < this.playerPos.x;
    en.mesh.scale.x = facingRight ? Math.abs(en.mesh.scale.x) : -Math.abs(en.mesh.scale.x);

    const animData = en.template.animations[en.currentAnim];
    const tex = en.textures[en.currentAnim];
    if (animData && tex) {
      const fps = 8;
      en.frameTime += delta;
      if (en.frameTime >= 1 / fps) {
        en.frameTime -= 1 / fps;
        en.currentFrame = (en.currentFrame + 1) % animData.frames;
        tex.offset.x = en.currentFrame / animData.frames;
      }
    }
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
        const above = e.mesh.position.clone();
        above.y += ((e.mesh.userData.spriteScale as number) ?? 2) * 0.65;
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
      if (this.renderer.domElement.parentNode === this.container) {
        this.container.removeChild(this.renderer.domElement);
      }
    }
    this.renderer.dispose();
    for (const en of this.enemies) {
      en.mesh.geometry.dispose();
      en.material.dispose();
      for (const tex of Object.values(en.textures)) tex?.dispose();
    }
  }
}
