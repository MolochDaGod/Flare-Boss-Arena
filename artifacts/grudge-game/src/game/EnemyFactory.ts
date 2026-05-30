import * as THREE from "three";

export type Archetype = "humanoid" | "quadruped" | "flying" | "arachnid" | "dragon" | "golem";

export interface EnemyRig {
  body?: THREE.Object3D;
  head?: THREE.Object3D;
  jaw?: THREE.Object3D;
  leftArm?: THREE.Object3D;
  rightArm?: THREE.Object3D;
  leftLeg?: THREE.Object3D;
  rightLeg?: THREE.Object3D;
  legs?: THREE.Object3D[];
  tail?: THREE.Object3D;
  leftWing?: THREE.Object3D;
  rightWing?: THREE.Object3D;
  weapon?: THREE.Object3D;
  horns?: THREE.Object3D;
}

export interface EnemyModel {
  group: THREE.Group;
  archetype: Archetype;
  rig: EnemyRig;
  baseY: number;         // resting Y offset
  height: number;        // total height (for healthbar offset)
  bodyMats: THREE.MeshStandardMaterial[];
  originalColors: number[];
  /**
   * Set for GLB-backed enemies (real imported models). When present the
   * procedural-primitive rig animation is skipped — skeletal motion is driven
   * by `mixer` (if the GLB shipped a rig + clip) or a procedural idle sway
   * applied to the whole group (for static GLBs with no skeleton).
   */
  isGLB?: boolean;
  /** AnimationMixer for skeletal GLB clips. Null for static (rig-less) GLBs. */
  mixer?: THREE.AnimationMixer | null;
  /**
   * State-driven animator for KayKit characters (shared-library clips). When
   * present, `updateEnemyAnimation` drives logical states (idle/walk/attack/
   * hit/death) through it instead of the single-clip `mixer` path.
   */
  kit?: KitAnimator | null;
}

/**
 * State-driven animation controller for KayKit characters. Implemented in
 * `KayKitCharacter.ts`; declared here so `EnemyModel` can reference it without a
 * circular import.
 */
export interface KitAnimator {
  update(delta: number): void;
  /** Crossfade between idle and walk locomotion. */
  setMoving(moving: boolean): void;
  /** Play the attack clip once, then return to locomotion. */
  attack(): void;
  /** Play the hit-reaction clip once, then return to locomotion. */
  hit(): void;
  /** Play the death clip once and clamp on the final frame. */
  die(): void;
  dispose(): void;
}

/** Map enemy type → archetype */
function archetypeFor(type: string): Archetype {
  switch (type) {
    case "beast":     return "quadruped";   // wolves, tigers, raptors, rhinos
    case "reptile":   return "quadruped";
    case "arachnid":  return "arachnid";
    case "dragon":    return "dragon";
    case "golem":     return "golem";
    case "orc":
    case "troll":
    case "undead":
    case "minotaur":
    case "egyptian":
    case "titan":
    case "elemental": return "humanoid";
    default:          return "humanoid";
  }
}

/** Color palette by enemy type + name */
function colorsFor(type: string, name: string, tier: number): { primary: number; secondary: number; accent: number } {
  const n = name.toLowerCase();

  // Name-based overrides first
  if (n.includes("frost")) return { primary: 0x6ecbff, secondary: 0x2a4a6a, accent: 0xffffff };
  if (n.includes("fire") || n.includes("phantom")) return { primary: 0xff5522, secondary: 0x551100, accent: 0xffaa00 };
  if (n.includes("shadow")) return { primary: 0x221133, secondary: 0x110022, accent: 0x6622aa };
  if (n.includes("ghost") || n.includes("spectral")) return { primary: 0xddeeff, secondary: 0x445566, accent: 0xaaccff };
  if (n.includes("mummy") || n.includes("anubis") || n.includes("sphinx")) return { primary: 0xc9a06e, secondary: 0x7a5a32, accent: 0xffd366 };
  if (n.includes("dire") || n.includes("wolf")) return { primary: 0x5a4838, secondary: 0x2a1d12, accent: 0xaa9988 };
  if (n.includes("bat")) return { primary: 0x231a2a, secondary: 0x110510, accent: 0x884466 };
  if (n.includes("tiger")) return { primary: 0xd08a2a, secondary: 0x2a1808, accent: 0xffe5b0 };
  if (n.includes("rhino")) return { primary: 0x4a4438, secondary: 0x252018, accent: 0x6a6052 };
  if (n.includes("raptor") || n.includes("velociraptor")) return { primary: 0x4a6638, secondary: 0x223018, accent: 0x88aa55 };

  switch (type) {
    case "beast":     return { primary: 0x6b5640, secondary: 0x332618, accent: 0xaa8866 };
    case "reptile":   return { primary: 0x556a2e, secondary: 0x2a3818, accent: 0x88a85a };
    case "arachnid":  return { primary: 0x2a1a3a, secondary: 0x140820, accent: 0x884ccc };
    case "dragon":    return { primary: 0x9a2233, secondary: 0x441018, accent: 0xff6644 };
    case "golem":     return { primary: 0x6a6660, secondary: 0x3a3832, accent: 0x8a8680 };
    case "orc":       return { primary: 0x4a6638, secondary: 0x222e18, accent: 0x88aa55 };
    case "troll":     return { primary: 0x556a48, secondary: 0x2a3520, accent: 0x88a070 };
    case "undead":    return { primary: 0xa8a89a, secondary: 0x5a5a50, accent: 0x6644aa };
    case "minotaur":  return { primary: 0x6a4a2a, secondary: 0x331a08, accent: 0xaa7733 };
    case "egyptian":  return { primary: 0xc9a06e, secondary: 0x7a5a32, accent: 0xffd366 };
    case "titan":     return { primary: 0x4a5566, secondary: 0x222a35, accent: 0x88aabb };
    case "elemental": return { primary: 0x6644cc, secondary: 0x221155, accent: 0xaa88ff };
    default:          return { primary: 0x666666, secondary: 0x333333, accent: 0xaaaaaa };
  }
}

/** Tier scale multiplier */
function tierScale(tier: number): number {
  return 0.85 + tier * 0.12;  // T1=0.97, T8=1.81
}

/** Build all materials for an enemy with a shared palette */
function makeMats(c: { primary: number; secondary: number; accent: number }) {
  const primary   = new THREE.MeshStandardMaterial({ color: c.primary,   roughness: 0.75, metalness: 0.1 });
  const secondary = new THREE.MeshStandardMaterial({ color: c.secondary, roughness: 0.85, metalness: 0.05 });
  const accent    = new THREE.MeshStandardMaterial({ color: c.accent,    roughness: 0.6,  metalness: 0.25 });
  const eyes      = new THREE.MeshStandardMaterial({ color: 0xffaa00, emissive: 0xff6600, emissiveIntensity: 2, roughness: 0.2 });
  return { primary, secondary, accent, eyes };
}

// ─── Builders ─────────────────────────────────────────────────────────────────

function buildHumanoid(name: string, type: string, tier: number): EnemyModel {
  const c = colorsFor(type, name, tier);
  const m = makeMats(c);
  const s = tierScale(tier);

  const g = new THREE.Group();
  const rig: EnemyRig = {};
  const mats = [m.primary, m.secondary, m.accent];

  // Torso
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.0, 0.45), m.primary);
  torso.position.y = 1.55;
  torso.castShadow = true;
  g.add(torso);
  rig.body = torso;

  // Pelvis
  const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.3, 0.42), m.secondary);
  pelvis.position.y = 0.95;
  pelvis.castShadow = true;
  g.add(pelvis);

  // Head pivot at neck — rotation around shoulder line
  const headPivot = new THREE.Group();
  headPivot.position.y = 2.1;
  g.add(headPivot);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.52, 0.5), m.primary);
  head.castShadow = true;
  headPivot.add(head);
  rig.head = headPivot;

  // Eyes
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), m.eyes);
  eyeL.position.set(-0.13, 0.05, 0.26);
  head.add(eyeL);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.13;
  head.add(eyeR);

  // Type-specific head accessories
  if (type === "minotaur") {
    // Horns
    const hornGeo = new THREE.ConeGeometry(0.08, 0.5, 8);
    const hornL = new THREE.Mesh(hornGeo, m.accent);
    hornL.position.set(-0.22, 0.25, 0);
    hornL.rotation.z = Math.PI / 3.5;
    head.add(hornL);
    const hornR = hornL.clone();
    hornR.position.x = 0.22;
    hornR.rotation.z = -Math.PI / 3.5;
    head.add(hornR);
  }
  if (type === "undead" || name.toLowerCase().includes("mummy")) {
    // Hood
    const hood = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.55, 8, 1, true), m.secondary);
    hood.position.y = 0.15;
    head.add(hood);
  }
  if (type === "elemental") {
    // Glow aura
    const aura = new THREE.Mesh(new THREE.SphereGeometry(0.45, 16, 16), new THREE.MeshBasicMaterial({ color: c.accent, transparent: true, opacity: 0.35 }));
    head.add(aura);
    torso.material = m.accent;
  }

  // Arms — pivot at shoulder
  const armGeo = new THREE.BoxGeometry(0.22, 0.95, 0.22);
  armGeo.translate(0, -0.45, 0);  // pivot at top

  const leftArmPivot = new THREE.Group();
  leftArmPivot.position.set(-0.45, 2.0, 0);
  const leftArmMesh = new THREE.Mesh(armGeo, m.secondary);
  leftArmMesh.castShadow = true;
  leftArmPivot.add(leftArmMesh);
  g.add(leftArmPivot);
  rig.leftArm = leftArmPivot;

  const rightArmPivot = new THREE.Group();
  rightArmPivot.position.set(0.45, 2.0, 0);
  const rightArmMesh = new THREE.Mesh(armGeo, m.secondary);
  rightArmMesh.castShadow = true;
  rightArmPivot.add(rightArmMesh);
  g.add(rightArmPivot);
  rig.rightArm = rightArmPivot;

  // Weapon in right hand for orc/troll/minotaur/egyptian
  if (["orc", "troll", "minotaur", "egyptian", "titan"].includes(type)) {
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.7, 6), m.secondary);
    handle.position.set(0, -0.9, 0.05);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.45, 0.05), m.accent);
    blade.position.set(0, -1.25, 0.05);
    rightArmMesh.add(handle);
    rightArmMesh.add(blade);
    rig.weapon = blade;
  }

  // Legs — pivot at hip
  const legGeo = new THREE.BoxGeometry(0.26, 0.85, 0.26);
  legGeo.translate(0, -0.4, 0);

  const leftLegPivot = new THREE.Group();
  leftLegPivot.position.set(-0.18, 0.85, 0);
  const leftLegMesh = new THREE.Mesh(legGeo, m.secondary);
  leftLegMesh.castShadow = true;
  leftLegPivot.add(leftLegMesh);
  g.add(leftLegPivot);
  rig.leftLeg = leftLegPivot;

  const rightLegPivot = new THREE.Group();
  rightLegPivot.position.set(0.18, 0.85, 0);
  const rightLegMesh = new THREE.Mesh(legGeo, m.secondary);
  rightLegMesh.castShadow = true;
  rightLegPivot.add(rightLegMesh);
  g.add(rightLegPivot);
  rig.rightLeg = rightLegPivot;

  // Scale based on tier and special types
  let typeScale = s;
  if (type === "troll" || type === "minotaur") typeScale *= 1.35;
  if (type === "titan") typeScale *= 1.7;
  g.scale.setScalar(typeScale);

  return { group: g, archetype: "humanoid", rig, baseY: 0, height: 2.7 * typeScale, bodyMats: mats, originalColors: [c.primary, c.secondary, c.accent] };
}

function buildQuadruped(name: string, type: string, tier: number): EnemyModel {
  const c = colorsFor(type, name, tier);
  const m = makeMats(c);
  const s = tierScale(tier);
  const isLarge = /rhino|tiger|raptor/i.test(name);
  const isBat = /bat/i.test(name);

  if (isBat) return buildFlying(name, type, tier);

  const g = new THREE.Group();
  const rig: EnemyRig = {};

  const bodyLen = isLarge ? 1.5 : 1.1;
  const bodyH = isLarge ? 0.65 : 0.5;
  const bodyW = isLarge ? 0.75 : 0.55;
  const standH = isLarge ? 0.85 : 0.65;

  // Body
  const body = new THREE.Mesh(new THREE.BoxGeometry(bodyW, bodyH, bodyLen), m.primary);
  body.position.y = standH + bodyH / 2;
  body.castShadow = true;
  g.add(body);
  rig.body = body;

  // Head — at front of body
  const headPivot = new THREE.Group();
  headPivot.position.set(0, standH + bodyH * 0.9, -bodyLen / 2 - 0.05);
  g.add(headPivot);

  const headSize = isLarge ? 0.55 : 0.42;
  const head = new THREE.Mesh(new THREE.BoxGeometry(headSize, headSize * 0.85, headSize * 1.1), m.primary);
  head.position.z = -headSize / 2;
  head.castShadow = true;
  headPivot.add(head);
  rig.head = headPivot;

  // Snout
  const snout = new THREE.Mesh(new THREE.BoxGeometry(headSize * 0.55, headSize * 0.45, headSize * 0.55), m.secondary);
  snout.position.set(0, -headSize * 0.1, -headSize * 0.85);
  head.add(snout);

  // Eyes
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), m.eyes);
  eyeL.position.set(-headSize * 0.25, headSize * 0.15, -headSize * 0.35);
  head.add(eyeL);
  const eyeR = eyeL.clone();
  eyeR.position.x = headSize * 0.25;
  head.add(eyeR);

  // Ears (for wolf/tiger)
  if (/wolf|tiger/i.test(name)) {
    const earGeo = new THREE.ConeGeometry(0.1, 0.18, 4);
    const earL = new THREE.Mesh(earGeo, m.secondary);
    earL.position.set(-headSize * 0.3, headSize * 0.5, 0);
    head.add(earL);
    const earR = earL.clone();
    earR.position.x = headSize * 0.3;
    head.add(earR);
  }

  // Horn for rhino
  if (/rhino/i.test(name)) {
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.4, 8), m.accent);
    horn.position.set(0, headSize * 0.1, -headSize * 1.15);
    horn.rotation.x = -Math.PI / 6;
    head.add(horn);
  }

  // 4 legs at corners — pivot at hip
  const legGeo = new THREE.BoxGeometry(0.16, standH, 0.18);
  legGeo.translate(0, -standH / 2, 0);
  const legs: THREE.Object3D[] = [];
  const xs = [-bodyW * 0.35, bodyW * 0.35];
  const zs = [-bodyLen * 0.4, bodyLen * 0.4];
  for (const x of xs) for (const z of zs) {
    const pivot = new THREE.Group();
    pivot.position.set(x, standH, z);
    const leg = new THREE.Mesh(legGeo, m.secondary);
    leg.castShadow = true;
    pivot.add(leg);
    g.add(pivot);
    legs.push(pivot);
  }
  rig.legs = legs;
  rig.leftLeg = legs[0];
  rig.rightLeg = legs[1];

  // Tail
  const tailPivot = new THREE.Group();
  tailPivot.position.set(0, standH + bodyH * 0.7, bodyLen / 2);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.6), m.secondary);
  tail.position.z = 0.3;
  tail.castShadow = true;
  tailPivot.add(tail);
  g.add(tailPivot);
  rig.tail = tailPivot;

  g.scale.setScalar(s);
  return { group: g, archetype: "quadruped", rig, baseY: 0, height: (standH + bodyH + headSize) * s, bodyMats: [m.primary, m.secondary, m.accent], originalColors: [c.primary, c.secondary, c.accent] };
}

function buildFlying(name: string, type: string, tier: number): EnemyModel {
  const c = colorsFor(type, name, tier);
  const m = makeMats(c);
  const s = tierScale(tier) * 0.8;

  const g = new THREE.Group();
  const rig: EnemyRig = {};

  const hoverY = 1.4;

  // Body
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 10), m.primary);
  body.scale.set(1, 0.85, 1.4);
  body.position.y = hoverY;
  body.castShadow = true;
  g.add(body);
  rig.body = body;

  // Head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 10), m.primary);
  head.position.set(0, hoverY + 0.05, -0.38);
  head.castShadow = true;
  g.add(head);
  rig.head = head;

  // Eyes
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 6), m.eyes);
  eyeL.position.set(-0.09, 0.05, -0.15);
  head.add(eyeL);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.09;
  head.add(eyeR);

  // Wings — large flat triangular shapes
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, 0);
  wingShape.lineTo(0.9, 0.1);
  wingShape.lineTo(1.1, -0.3);
  wingShape.lineTo(0.5, -0.45);
  wingShape.lineTo(0, -0.1);
  wingShape.lineTo(0, 0);
  const wingGeo = new THREE.ExtrudeGeometry(wingShape, { depth: 0.04, bevelEnabled: false });
  wingGeo.translate(0, 0, -0.02);

  const wingMat = new THREE.MeshStandardMaterial({ color: c.secondary, roughness: 0.9, side: THREE.DoubleSide, transparent: true, opacity: 0.92 });

  const leftWing = new THREE.Group();
  leftWing.position.set(-0.2, hoverY + 0.05, 0);
  const lwMesh = new THREE.Mesh(wingGeo, wingMat);
  lwMesh.scale.x = -1;
  leftWing.add(lwMesh);
  g.add(leftWing);
  rig.leftWing = leftWing;

  const rightWing = new THREE.Group();
  rightWing.position.set(0.2, hoverY + 0.05, 0);
  rightWing.add(new THREE.Mesh(wingGeo, wingMat));
  g.add(rightWing);
  rig.rightWing = rightWing;

  g.scale.setScalar(s);
  return { group: g, archetype: "flying", rig, baseY: 0, height: 0.6 * s + hoverY * s, bodyMats: [m.primary, m.secondary, wingMat], originalColors: [c.primary, c.secondary, c.secondary] };
}

function buildArachnid(name: string, type: string, tier: number): EnemyModel {
  const c = colorsFor(type, name, tier);
  const m = makeMats(c);
  const s = tierScale(tier);

  const g = new THREE.Group();
  const rig: EnemyRig = {};

  const standH = 0.45;

  // Abdomen (big)
  const abdomen = new THREE.Mesh(new THREE.SphereGeometry(0.55, 14, 12), m.primary);
  abdomen.scale.set(1.1, 0.85, 1.2);
  abdomen.position.y = standH + 0.3;
  abdomen.castShadow = true;
  g.add(abdomen);
  rig.body = abdomen;

  // Head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), m.primary);
  head.position.set(0, standH + 0.25, -0.6);
  head.castShadow = true;
  g.add(head);
  rig.head = head;

  // 6 glowing eyes
  for (let i = 0; i < 6; i++) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 6), m.eyes);
    const row = Math.floor(i / 3);
    const col = i % 3;
    eye.position.set(-0.12 + col * 0.12, 0.05 - row * 0.08, -0.22);
    head.add(eye);
  }

  // Fangs
  const fangGeo = new THREE.ConeGeometry(0.04, 0.18, 6);
  const fangL = new THREE.Mesh(fangGeo, m.accent);
  fangL.position.set(-0.08, -0.18, -0.2);
  fangL.rotation.x = Math.PI;
  head.add(fangL);
  const fangR = fangL.clone();
  fangR.position.x = 0.08;
  head.add(fangR);

  // 8 legs in pairs
  const legGeo = new THREE.CylinderGeometry(0.04, 0.025, 0.7, 6);
  legGeo.translate(0, -0.35, 0);
  const legs: THREE.Object3D[] = [];
  for (let i = 0; i < 4; i++) {
    const angle = ((i / 3) - 0.5) * 1.2;  // -0.6 to 0.6
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.35, standH + 0.3, Math.sin(angle) * 0.5);
      pivot.rotation.z = side * (0.6 + Math.cos(angle) * 0.2);
      pivot.rotation.x = angle * 0.5;
      const leg = new THREE.Mesh(legGeo, m.secondary);
      leg.castShadow = true;
      pivot.add(leg);
      g.add(pivot);
      legs.push(pivot);
    }
  }
  rig.legs = legs;

  g.scale.setScalar(s);
  return { group: g, archetype: "arachnid", rig, baseY: 0, height: 1.1 * s, bodyMats: [m.primary, m.secondary, m.accent], originalColors: [c.primary, c.secondary, c.accent] };
}

function buildDragon(name: string, type: string, tier: number): EnemyModel {
  const c = colorsFor(type, name, tier);
  const m = makeMats(c);
  const s = tierScale(tier) * 1.3;

  const g = new THREE.Group();
  const rig: EnemyRig = {};

  const standH = 1.0;

  // Body
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.9, 16, 12), m.primary);
  body.scale.set(1.0, 0.85, 1.6);
  body.position.y = standH + 0.2;
  body.castShadow = true;
  g.add(body);
  rig.body = body;

  // Neck + head
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.45, 1.0, 8), m.primary);
  neck.position.set(0, standH + 0.7, -1.0);
  neck.rotation.x = Math.PI / 4;
  neck.castShadow = true;
  g.add(neck);

  const headPivot = new THREE.Group();
  headPivot.position.set(0, standH + 1.0, -1.4);
  g.add(headPivot);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.5, 0.85), m.primary);
  head.castShadow = true;
  headPivot.add(head);
  rig.head = headPivot;

  // Snout
  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.35, 0.45), m.secondary);
  snout.position.set(0, -0.05, -0.55);
  head.add(snout);

  // Horns
  const hornGeo = new THREE.ConeGeometry(0.1, 0.5, 6);
  const hornL = new THREE.Mesh(hornGeo, m.accent);
  hornL.position.set(-0.2, 0.3, 0.1);
  hornL.rotation.x = -Math.PI / 5;
  hornL.rotation.z = Math.PI / 8;
  head.add(hornL);
  const hornR = hornL.clone();
  hornR.position.x = 0.2;
  hornR.rotation.z = -Math.PI / 8;
  head.add(hornR);

  // Glowing eyes
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), m.eyes);
  eyeL.position.set(-0.18, 0.1, -0.28);
  head.add(eyeL);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.18;
  head.add(eyeR);

  // Wings — large
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, 0);
  wingShape.lineTo(1.6, 0.2);
  wingShape.lineTo(2.0, -0.6);
  wingShape.lineTo(1.5, -0.9);
  wingShape.lineTo(0.8, -0.6);
  wingShape.lineTo(0, -0.2);
  wingShape.lineTo(0, 0);
  const wingGeo = new THREE.ExtrudeGeometry(wingShape, { depth: 0.06, bevelEnabled: false });

  const wingMat = new THREE.MeshStandardMaterial({ color: c.secondary, roughness: 0.9, side: THREE.DoubleSide, transparent: true, opacity: 0.95 });

  const leftWing = new THREE.Group();
  leftWing.position.set(-0.5, standH + 0.6, 0);
  leftWing.rotation.z = Math.PI / 16;
  const lwm = new THREE.Mesh(wingGeo, wingMat);
  lwm.scale.x = -1;
  lwm.castShadow = true;
  leftWing.add(lwm);
  g.add(leftWing);
  rig.leftWing = leftWing;

  const rightWing = new THREE.Group();
  rightWing.position.set(0.5, standH + 0.6, 0);
  rightWing.rotation.z = -Math.PI / 16;
  const rwm = new THREE.Mesh(wingGeo, wingMat);
  rwm.castShadow = true;
  rightWing.add(rwm);
  g.add(rightWing);
  rig.rightWing = rightWing;

  // Tail
  const tailPivot = new THREE.Group();
  tailPivot.position.set(0, standH + 0.2, 1.3);
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.35, 1.6, 8), m.primary);
  tail.position.z = 0.8;
  tail.rotation.x = Math.PI / 2;
  tail.castShadow = true;
  tailPivot.add(tail);
  g.add(tailPivot);
  rig.tail = tailPivot;

  // 4 legs
  const legGeo = new THREE.BoxGeometry(0.25, standH, 0.3);
  legGeo.translate(0, -standH / 2, 0);
  const legs: THREE.Object3D[] = [];
  for (const x of [-0.55, 0.55]) for (const z of [-0.55, 0.65]) {
    const pivot = new THREE.Group();
    pivot.position.set(x, standH, z);
    const leg = new THREE.Mesh(legGeo, m.secondary);
    leg.castShadow = true;
    pivot.add(leg);
    g.add(pivot);
    legs.push(pivot);
  }
  rig.legs = legs;
  rig.leftLeg = legs[0];
  rig.rightLeg = legs[1];

  g.scale.setScalar(s);
  return { group: g, archetype: "dragon", rig, baseY: 0, height: 3.0 * s, bodyMats: [m.primary, m.secondary, wingMat], originalColors: [c.primary, c.secondary, c.secondary] };
}

function buildGolem(name: string, type: string, tier: number): EnemyModel {
  const c = colorsFor(type, name, tier);
  const m = makeMats(c);
  // Override roughness for stone feel
  m.primary.roughness = 1.0; m.primary.metalness = 0;
  m.secondary.roughness = 1.0; m.secondary.metalness = 0;
  const s = tierScale(tier) * 1.2;

  const g = new THREE.Group();
  const rig: EnemyRig = {};

  // Chunky asymmetric body — multiple stone blocks
  const torso = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.4, 0.9), m.primary);
  torso.position.y = 1.6;
  torso.castShadow = true;
  g.add(torso);
  rig.body = torso;

  // Shoulder pads
  const shoulderL = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.45, 0.6), m.secondary);
  shoulderL.position.set(-0.75, 2.2, 0);
  shoulderL.castShadow = true;
  g.add(shoulderL);
  const shoulderR = shoulderL.clone();
  shoulderR.position.x = 0.75;
  g.add(shoulderR);

  // Head — smaller stone block
  const headPivot = new THREE.Group();
  headPivot.position.y = 2.55;
  g.add(headPivot);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.6, 0.7), m.primary);
  head.castShadow = true;
  headPivot.add(head);
  rig.head = headPivot;

  // Glowing rune eyes
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), m.eyes);
  eyeL.position.set(-0.15, 0.05, 0.36);
  head.add(eyeL);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.15;
  head.add(eyeR);

  // Arms — chunky
  const armGeo = new THREE.BoxGeometry(0.4, 1.2, 0.4);
  armGeo.translate(0, -0.55, 0);

  const leftArm = new THREE.Group();
  leftArm.position.set(-0.8, 2.15, 0);
  const lam = new THREE.Mesh(armGeo, m.secondary);
  lam.castShadow = true;
  leftArm.add(lam);
  // Stone fist
  const fistL = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.45, 0.5), m.primary);
  fistL.position.y = -1.2;
  leftArm.add(fistL);
  g.add(leftArm);
  rig.leftArm = leftArm;

  const rightArm = new THREE.Group();
  rightArm.position.set(0.8, 2.15, 0);
  const ram = new THREE.Mesh(armGeo, m.secondary);
  ram.castShadow = true;
  rightArm.add(ram);
  const fistR = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.45, 0.5), m.primary);
  fistR.position.y = -1.2;
  rightArm.add(fistR);
  g.add(rightArm);
  rig.rightArm = rightArm;

  // Legs — short and stout
  const legGeo = new THREE.BoxGeometry(0.45, 0.9, 0.45);
  legGeo.translate(0, -0.42, 0);

  const leftLeg = new THREE.Group();
  leftLeg.position.set(-0.3, 0.9, 0);
  const llm = new THREE.Mesh(legGeo, m.secondary);
  llm.castShadow = true;
  leftLeg.add(llm);
  g.add(leftLeg);
  rig.leftLeg = leftLeg;

  const rightLeg = new THREE.Group();
  rightLeg.position.set(0.3, 0.9, 0);
  const rlm = new THREE.Mesh(legGeo, m.secondary);
  rlm.castShadow = true;
  rightLeg.add(rlm);
  g.add(rightLeg);
  rig.rightLeg = rightLeg;

  g.scale.setScalar(s);
  return { group: g, archetype: "golem", rig, baseY: 0, height: 3.0 * s, bodyMats: [m.primary, m.secondary, m.accent], originalColors: [c.primary, c.secondary, c.accent] };
}

/** Main entry point */
export function createEnemyModel(name: string, type: string, tier: number): EnemyModel {
  const arch = archetypeFor(type);
  switch (arch) {
    case "quadruped": return buildQuadruped(name, type, tier);
    case "flying":    return buildFlying(name, type, tier);
    case "arachnid":  return buildArachnid(name, type, tier);
    case "dragon":    return buildDragon(name, type, tier);
    case "golem":     return buildGolem(name, type, tier);
    case "humanoid":  return buildHumanoid(name, type, tier);
    default:          return buildHumanoid(name, type, tier);
  }
}

// ─── Animation drivers ────────────────────────────────────────────────────────

export interface AnimState {
  walkPhase: number;
  attackPhase: number;     // 0 = idle, climbs to 1 during attack
  hurtPhase: number;       // 0..1, fades out
  deathPhase: number;      // 0..1, rises during death
  isWalking: boolean;
  isAttacking: boolean;
}

export function makeAnimState(): AnimState {
  return { walkPhase: Math.random() * Math.PI * 2, attackPhase: 0, hurtPhase: 0, deathPhase: 0, isWalking: false, isAttacking: false };
}

/** Tint helper — restores base color then applies a hurt flash (0..1). */
function applyHurtFlash(bodyMats: THREE.MeshStandardMaterial[], originalColors: number[], flash: number) {
  for (let i = 0; i < bodyMats.length; i++) {
    const orig = originalColors[i];
    const r = ((orig >> 16) & 0xff) / 255;
    const g = ((orig >> 8) & 0xff) / 255;
    const b = (orig & 0xff) / 255;
    bodyMats[i].color.setRGB(r + flash * (1 - r), g - flash * g * 0.7, b - flash * b * 0.7);
  }
}

export function updateEnemyAnimation(model: EnemyModel, state: AnimState, delta: number, elapsed: number) {
  // ─── GLB-backed enemies ─────────────────────────────────────────────────
  // Real imported models drive their own skeleton (or get a procedural idle
  // sway when rig-less). We still layer hurt-flash, death tip-over, and an
  // attack lunge on the group so combat reads the same as primitive enemies.
  if (model.isGLB) {
    const { group, bodyMats, originalColors } = model;

    // ─── KayKit state-driven animator ────────────────────────────────────
    // Real shared-library clips per logical state (idle/walk/attack/hit/death).
    // The death clip lays the body down, so we do NOT tip the group over here.
    if (model.kit) {
      const kit = model.kit;
      kit.update(delta);

      if (state.hurtPhase > 0) {
        state.hurtPhase = Math.max(0, state.hurtPhase - delta * 4);
        applyHurtFlash(bodyMats, originalColors, state.hurtPhase);
      }

      if (state.deathPhase > 0) {
        state.deathPhase = Math.min(1, state.deathPhase + delta * 1.8);
        kit.die();
        return;
      }

      if (state.isAttacking) {
        state.attackPhase = Math.min(1, state.attackPhase + delta * 4);
        if (state.attackPhase >= 1) { state.attackPhase = 0; state.isAttacking = false; }
        kit.attack();
      }
      if (state.hurtPhase > 0.9) kit.hit();
      kit.setMoving(state.isWalking);
      group.position.y = group.userData.baseY ?? 0;
      return;
    }

    // Skeletal clip playback (rigged GLBs) — always advances so the model
    // breathes/idles even when standing still.
    if (model.mixer) model.mixer.update(delta);

    // Hurt flash fade-out.
    if (state.hurtPhase > 0) {
      state.hurtPhase = Math.max(0, state.hurtPhase - delta * 4);
      applyHurtFlash(bodyMats, originalColors, state.hurtPhase);
    }

    // Death: tip over + sink, then freeze.
    if (state.deathPhase > 0) {
      state.deathPhase = Math.min(1, state.deathPhase + delta * 1.8);
      group.rotation.z = state.deathPhase * Math.PI / 2.2;
      group.position.y = (group.userData.baseY ?? 0) - state.deathPhase * 0.3;
      return;
    }

    // Attack lunge (kick forward then settle).
    if (state.isAttacking) {
      state.attackPhase = Math.min(1, state.attackPhase + delta * 4);
      if (state.attackPhase >= 1) { state.attackPhase = 0; state.isAttacking = false; }
    }
    const lunge = Math.sin(state.attackPhase * Math.PI);
    group.position.y = (group.userData.baseY ?? 0) + lunge * 0.15;

    // Procedural idle sway for STATIC GLBs (no skeleton/clip) so they aren't
    // dead-still. Rigged models already animate via the mixer. The sway is
    // applied to the inner loaded node (group.children[0]) so it doesn't fight
    // the facing yaw that GameEngine writes onto the group itself.
    if (!model.mixer) {
      const inner = group.children[0];
      if (inner) inner.rotation.y = Math.sin(elapsed * 1.1) * 0.08;
      group.position.y = (group.userData.baseY ?? 0) + Math.sin(elapsed * 1.6) * 0.04 + lunge * 0.15;
    }
    return;
  }

  const { rig, archetype, group, bodyMats, originalColors } = model;

  // Walking
  if (state.isWalking) {
    state.walkPhase += delta * 8;
  } else {
    state.walkPhase += delta * 1.5;
  }

  // Attack lunge
  if (state.isAttacking) {
    state.attackPhase = Math.min(1, state.attackPhase + delta * 4);
    if (state.attackPhase >= 1) {
      state.attackPhase = 0;
      state.isAttacking = false;
    }
  }

  // Hurt flash (fades out)
  if (state.hurtPhase > 0) {
    state.hurtPhase = Math.max(0, state.hurtPhase - delta * 4);
    const flash = state.hurtPhase;
    for (let i = 0; i < bodyMats.length; i++) {
      const orig = originalColors[i];
      const r = ((orig >> 16) & 0xff) / 255;
      const g = ((orig >> 8) & 0xff) / 255;
      const b = (orig & 0xff) / 255;
      bodyMats[i].color.setRGB(r + flash * (1 - r), g - flash * g * 0.7, b - flash * b * 0.7);
    }
  }

  // Death: tip over
  if (state.deathPhase > 0) {
    state.deathPhase = Math.min(1, state.deathPhase + delta * 1.8);
    group.rotation.z = state.deathPhase * Math.PI / 2.2;
    group.position.y = -state.deathPhase * 0.3;
    return;
  }

  const walkAmp = state.isWalking ? 1 : 0.15;
  const swing = Math.sin(state.walkPhase) * 0.5 * walkAmp;
  const swingOpp = -swing;
  const attackKick = Math.sin(state.attackPhase * Math.PI);

  switch (archetype) {
    case "humanoid": {
      if (rig.leftLeg)  rig.leftLeg.rotation.x = swing;
      if (rig.rightLeg) rig.rightLeg.rotation.x = swingOpp;
      if (rig.leftArm)  rig.leftArm.rotation.x = swingOpp * 0.7;
      if (rig.rightArm) rig.rightArm.rotation.x = swing * 0.7 - attackKick * 1.6;
      if (rig.body)     rig.body.rotation.z = Math.sin(state.walkPhase * 2) * 0.04 * walkAmp;
      if (rig.head)     rig.head.rotation.y = Math.sin(elapsed * 0.7) * 0.15;
      break;
    }
    case "quadruped": {
      const legs = rig.legs ?? [];
      // FL=0, FR=1, BL=2, BR=3 (or similar pairing)
      for (let i = 0; i < legs.length; i++) {
        const phase = (i === 0 || i === 3) ? state.walkPhase : state.walkPhase + Math.PI;
        legs[i].rotation.x = Math.sin(phase) * 0.55 * walkAmp;
      }
      if (rig.body) rig.body.position.y = (rig.body.userData.baseY ?? rig.body.position.y);
      if (rig.tail) rig.tail.rotation.y = Math.sin(elapsed * 3) * 0.3;
      if (rig.head) {
        rig.head.rotation.x = -attackKick * 0.5 + Math.sin(elapsed * 0.8) * 0.05;
        rig.head.position.z = (rig.head.userData.baseZ ?? rig.head.position.z) - attackKick * 0.4;
      }
      break;
    }
    case "flying": {
      const flap = Math.sin(elapsed * 14) * 0.7;
      if (rig.leftWing)  rig.leftWing.rotation.z = -flap;
      if (rig.rightWing) rig.rightWing.rotation.z = flap;
      const bobY = Math.sin(elapsed * 3) * 0.15;
      group.position.y = bobY + (group.userData.baseY ?? 0);
      if (rig.head) rig.head.position.z = (rig.head.userData.baseZ ?? rig.head.position.z) - attackKick * 0.3;
      break;
    }
    case "arachnid": {
      const legs = rig.legs ?? [];
      for (let i = 0; i < legs.length; i++) {
        const phase = state.walkPhase + i * 0.4;
        legs[i].rotation.x = Math.sin(phase) * 0.35 * walkAmp;
      }
      if (rig.body) rig.body.position.y = (rig.body.userData.baseY ?? rig.body.position.y) + Math.sin(state.walkPhase * 2) * 0.04 * walkAmp;
      if (rig.head) rig.head.position.z = (rig.head.userData.baseZ ?? rig.head.position.z) - attackKick * 0.25;
      break;
    }
    case "dragon": {
      const flap = Math.sin(elapsed * 4) * 0.5;
      if (rig.leftWing)  rig.leftWing.rotation.z = Math.PI / 16 - flap;
      if (rig.rightWing) rig.rightWing.rotation.z = -Math.PI / 16 + flap;
      if (rig.tail) rig.tail.rotation.y = Math.sin(elapsed * 2) * 0.4;
      const legs = rig.legs ?? [];
      for (let i = 0; i < legs.length; i++) {
        const phase = (i === 0 || i === 3) ? state.walkPhase : state.walkPhase + Math.PI;
        legs[i].rotation.x = Math.sin(phase) * 0.4 * walkAmp;
      }
      if (rig.head) {
        rig.head.rotation.x = -attackKick * 0.6;
        rig.head.position.z = (rig.head.userData.baseZ ?? rig.head.position.z) - attackKick * 0.6;
      }
      break;
    }
    case "golem": {
      if (rig.leftLeg)  rig.leftLeg.rotation.x = swing * 0.5;
      if (rig.rightLeg) rig.rightLeg.rotation.x = swingOpp * 0.5;
      if (rig.leftArm)  rig.leftArm.rotation.x = swingOpp * 0.3 - attackKick * 2.0;
      if (rig.rightArm) rig.rightArm.rotation.x = swing * 0.3;
      if (rig.body)     rig.body.rotation.z = Math.sin(state.walkPhase * 2) * 0.05 * walkAmp;
      break;
    }
  }
}
