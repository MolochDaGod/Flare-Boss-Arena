import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";

const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");

const fbxLoader = new FBXLoader();
const fbxCache = new Map<string, Promise<THREE.Group>>();

export function loadFBX(path: string): Promise<THREE.Group> {
  const url = `${BASE}${path.startsWith("/") ? path : "/" + path}`;
  let p = fbxCache.get(url);
  if (!p) {
    p = new Promise<THREE.Group>((resolve, reject) => {
      fbxLoader.load(url, (obj) => resolve(obj), undefined, (err) => reject(err));
    });
    fbxCache.set(url, p);
  }
  return p.then((g) => cloneSkinned(g));
}

function cloneSkinned(src: THREE.Group): THREE.Group {
  const clone = src.clone(true) as THREE.Group;
  const boneMap = new Map<string, THREE.Bone>();
  clone.traverse((o) => { if ((o as THREE.Bone).isBone) boneMap.set(o.name, o as THREE.Bone); });
  clone.traverse((o) => {
    const sk = o as THREE.SkinnedMesh;
    if (sk.isSkinnedMesh) {
      const newBones = sk.skeleton.bones.map((b) => boneMap.get(b.name) ?? b);
      sk.skeleton = new THREE.Skeleton(newBones, sk.skeleton.boneInverses);
    }
  });
  return clone;
}

const HAND_NAME_PATTERNS = [
  /^hand[_.]?r/i, /right[_.]?hand/i, /\.R$/, /_R$/,
  /weapon[_.]?r/i, /grip[_.]?r/i, /palm[_.]?r/i,
  /^hand[_.]?l/i, /left[_.]?hand/i, /\.L$/, /_L$/,
];

export function findHandBone(root: THREE.Object3D, preferRight = true): THREE.Bone | null {
  const bones: THREE.Bone[] = [];
  root.traverse((o) => { if ((o as THREE.Bone).isBone) bones.push(o as THREE.Bone); });

  const rightPatterns = HAND_NAME_PATTERNS.slice(0, 6);
  const leftPatterns = HAND_NAME_PATTERNS.slice(6);
  const primary = preferRight ? rightPatterns : leftPatterns;
  const secondary = preferRight ? leftPatterns : rightPatterns;

  for (const re of primary) {
    const b = bones.find((bn) => re.test(bn.name));
    if (b) return b;
  }
  for (const re of secondary) {
    const b = bones.find((bn) => re.test(bn.name));
    if (b) return b;
  }
  // Fallback: any bone with "hand" in the name
  return bones.find((b) => /hand/i.test(b.name)) ?? null;
}

export function attachWeaponToBone(
  weaponRoot: THREE.Object3D,
  bone: THREE.Bone,
  opts: { scale?: number; offset?: THREE.Vector3; rotation?: THREE.Euler } = {},
): THREE.Object3D {
  const wrap = new THREE.Group();
  wrap.name = "WeaponMount";
  const s = opts.scale ?? 1;
  weaponRoot.scale.setScalar(s);
  if (opts.offset) weaponRoot.position.copy(opts.offset);
  if (opts.rotation) weaponRoot.rotation.copy(opts.rotation);
  wrap.add(weaponRoot);
  bone.add(wrap);
  return wrap;
}

/** Centre+scale-normalise an FBX group so its tallest dimension == targetHeight */
export function normaliseHeight(g: THREE.Object3D, targetHeight: number) {
  const box = new THREE.Box3().setFromObject(g);
  const size = new THREE.Vector3(); box.getSize(size);
  const h = Math.max(size.y, 0.001);
  const scale = targetHeight / h;
  g.scale.multiplyScalar(scale);
  // Re-box after scaling, then move so feet sit at y=0
  const box2 = new THREE.Box3().setFromObject(g);
  g.position.y -= box2.min.y;
}

export const TOON_CHAR_PATHS: Record<string, string> = {
  warrior: "/toon/WK/models/character.fbx",
  mage:    "/toon/ELF/models/character.fbx",
  ranger:  "/toon/ELF/models/character.fbx",
  worge:   "/toon/BRB/models/character.fbx",
  undead:  "/toon/UD/models/character.fbx",
};

/** weapon type id (SWORD, STAFF, HAMMER, …) -> FBX path */
export const TOON_WEAPON_PATHS: Record<string, string> = {
  SWORD:      "/toon/WK/equipment/sword.fbx",
  GREATSWORD: "/toon/BRB/equipment/sword.fbx",
  HAMMER:     "/toon/BRB/equipment/hammer.fbx",
  GREATAXE:   "/toon/BRB/equipment/hammer.fbx",
  AXE:        "/toon/BRB/equipment/hammer.fbx",
  STAFF:      "/toon/WK/equipment/staff.fbx",
  WAND:       "/toon/WK/equipment/staff.fbx",
  TOME:       "/toon/WK/equipment/staff.fbx",
  MACE:       "/toon/BRB/equipment/hammer.fbx",
  SPEAR:      "/toon/ELF/equipment/spear.fbx",
  SCYTHE:     "/toon/ELF/equipment/staff.fbx",
  BOW:        "/toon/ELF/equipment/spear.fbx",
  CROSSBOW:   "/toon/ELF/equipment/spear.fbx",
  GUN:        "/toon/WK/equipment/sword.fbx",
  DAGGER:     "/toon/WK/equipment/sword.fbx",
  SHIELD:     "/toon/WK/equipment/sword.fbx",
  OFFHAND_RELIC: "/toon/WK/equipment/staff.fbx",
};
