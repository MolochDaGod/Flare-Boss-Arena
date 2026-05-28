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

export interface CampStateUpdate {
  nearbyStationId: CampStationId | null;
  nearbyStationLabel: string | null;
  nearbyStationHint: string | null;
  promptKey: string;
  loaded: boolean;
}

export interface CampSceneOptions {
  className?: string;
  raceKey?: string;
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

export class CampScene {
  private container: HTMLElement | null = null;
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.OrthographicCamera;
  private clock = new THREE.Clock();
  private animFrameId = 0;

  private playerGroup: THREE.Group | null = null;
  private playerMixer: THREE.AnimationMixer | null = null;
  private playerActions: Record<string, THREE.AnimationAction> = {};
  private currentAction: THREE.AnimationAction | null = null;
  private playerPos = new THREE.Vector3(0, 0, 6);
  private playerTarget: THREE.Vector3 | null = null;
  private playerFacing = 0;
  private playerSpeed = 6;

  private stations: CampStation[] = [];
  private campfireLight!: THREE.PointLight;
  private campfireMesh!: THREE.Mesh;
  private embers: { mesh: THREE.Mesh; vel: THREE.Vector3; life: number; max: number }[] = [];

  private keys = new Set<string>();
  private currentNearbyId: CampStationId | null = null;
  private loaded = false;

  private readonly RADIUS = 9;
  private readonly BOUNDS = 16;

  private options: CampSceneOptions;
  private _engaged = false;

  constructor(options: CampSceneOptions = {}) {
    this.options = options;
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
    this.loadPlayer();
    this.notifyState();

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
    const url = `${OBJECTSTORE}/models/characters/kaykit/${modelName}.glb`;
    const loader = new GLTFLoader();
    loader.load(
      url,
      (gltf) => {
        const root = gltf.scene;
        root.scale.setScalar(1.5);
        root.position.copy(this.playerPos);
        root.traverse((c) => {
          const mesh = c as THREE.Mesh;
          if (mesh.isMesh) {
            mesh.castShadow = true;
            mesh.receiveShadow = true;
          }
        });
        this.scene.add(root);
        this.playerGroup = root;

        if (gltf.animations.length > 0) {
          this.playerMixer = new THREE.AnimationMixer(root);
          for (const clip of gltf.animations) {
            const action = this.playerMixer.clipAction(clip);
            const key = clip.name.toLowerCase();
            this.playerActions[key] = action;
          }
          this.playClipMatching(["idle"]);
        }

        this.loaded = true;
        this.notifyState();
      },
      undefined,
      () => {
        // Fallback: simple capsule
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
        this.notifyState();
      },
    );
  }

  private playClipMatching(keywords: string[]) {
    if (!this.playerMixer) return;
    let chosen: THREE.AnimationAction | null = null;
    for (const k of keywords) {
      for (const name of Object.keys(this.playerActions)) {
        if (name.includes(k)) {
          chosen = this.playerActions[name]!;
          break;
        }
      }
      if (chosen) break;
    }
    if (!chosen) {
      const first = Object.values(this.playerActions)[0];
      if (first) chosen = first;
    }
    if (!chosen || chosen === this.currentAction) return;
    if (this.currentAction) this.currentAction.fadeOut(0.2);
    chosen.reset().fadeIn(0.2).play();
    this.currentAction = chosen;
  }

  private _keyDown = (e: KeyboardEvent) => {
    this.keys.add(e.code);
    if (e.code === "KeyE") this.tryEngage();
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
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hit = new THREE.Vector3();
    if (raycaster.ray.intersectPlane(plane, hit)) {
      hit.x = Math.max(-this.BOUNDS + 1, Math.min(this.BOUNDS - 1, hit.x));
      hit.z = Math.max(-this.BOUNDS + 1, Math.min(this.BOUNDS - 1, hit.z));
      this.playerTarget = hit;
    }
  };

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
      this.playerFacing = Math.atan2(raw.x, raw.y);
      moving = true;
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

    if (this.playerMixer) this.playerMixer.update(delta);
    this.playClipMatching(moving ? ["run", "walk", "move"] : ["idle"]);

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
      this.notifyState();
    }
    if (closest) {
      closest.st.glow.intensity = 2.4 + Math.sin(elapsed * 6) * 0.4;
    }
  }

  private notifyState() {
    if (!this.options.onStateUpdate) return;
    const st = this.stations.find((s) => s.id === this.currentNearbyId) ?? null;
    this.options.onStateUpdate({
      nearbyStationId: this.currentNearbyId,
      nearbyStationLabel: st?.label ?? null,
      nearbyStationHint: st?.hint ?? null,
      promptKey: "E",
      loaded: this.loaded,
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
    for (const e of this.embers) {
      this.scene.remove(e.mesh);
      e.mesh.geometry.dispose();
      (e.mesh.material as THREE.Material).dispose();
    }
    this.embers = [];
    this.renderer.dispose();
  }
}
