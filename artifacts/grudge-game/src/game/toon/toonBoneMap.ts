/**
 * Mixamo / Bip001 → Toon Soldier bone retarget (FBA mirror of grudge-builder).
 */
import * as THREE from "three";

export type BoneRole =
  | "hips"
  | "spine"
  | "neck"
  | "head"
  | "lClavicle"
  | "lUpperArm"
  | "lForearm"
  | "lHand"
  | "rClavicle"
  | "rUpperArm"
  | "rForearm"
  | "rHand"
  | "lThigh"
  | "lCalf"
  | "lFoot"
  | "rThigh"
  | "rCalf"
  | "rFoot";

export const SOURCE_BONE_TO_ROLE: Record<string, BoneRole> = {
  "Bip001 Pelvis": "hips",
  "Bip001 Spine": "spine",
  "Bip001 Spine1": "spine",
  "Bip001 Neck": "neck",
  "Bip001 Head": "head",
  "Bip001 L Clavicle": "lClavicle",
  "Bip001 L UpperArm": "lUpperArm",
  "Bip001 L Forearm": "lForearm",
  "Bip001 L Hand": "lHand",
  "Bip001 R Clavicle": "rClavicle",
  "Bip001 R UpperArm": "rUpperArm",
  "Bip001 R Forearm": "rForearm",
  "Bip001 R Hand": "rHand",
  "Bip001 L Thigh": "lThigh",
  "Bip001 L Calf": "lCalf",
  "Bip001 L Foot": "lFoot",
  "Bip001 L Toe0": "lFoot",
  "Bip001 R Thigh": "rThigh",
  "Bip001 R Calf": "rCalf",
  "Bip001 R Foot": "rFoot",
  "Bip001 R Toe0": "rFoot",
  Bip001_Pelvis: "hips",
  Bip001_Spine: "spine",
  Bip001_Neck: "neck",
  Bip001_Head: "head",
  Bip001_L_Clavicle: "lClavicle",
  Bip001_L_UpperArm: "lUpperArm",
  Bip001_L_Forearm: "lForearm",
  Bip001_L_Hand: "lHand",
  Bip001_R_Clavicle: "rClavicle",
  Bip001_R_UpperArm: "rUpperArm",
  Bip001_R_Forearm: "rForearm",
  Bip001_R_Hand: "rHand",
  Bip001_L_Thigh: "lThigh",
  Bip001_L_Calf: "lCalf",
  Bip001_L_Foot: "lFoot",
  Bip001_R_Thigh: "rThigh",
  Bip001_R_Calf: "rCalf",
  Bip001_R_Foot: "rFoot",
  Hips: "hips",
  Spine: "spine",
  Spine1: "spine",
  Spine2: "spine",
  Neck: "neck",
  Head: "head",
  LeftShoulder: "lClavicle",
  LeftArm: "lUpperArm",
  LeftForeArm: "lForearm",
  LeftHand: "lHand",
  RightShoulder: "rClavicle",
  RightArm: "rUpperArm",
  RightForeArm: "rForearm",
  RightHand: "rHand",
  LeftUpLeg: "lThigh",
  LeftLeg: "lCalf",
  LeftFoot: "lFoot",
  RightUpLeg: "rThigh",
  RightLeg: "rCalf",
  RightFoot: "rFoot",
};

const MIXAMO_PREFIXES = [
  "mixamorig10:",
  "mixamorig9:",
  "mixamorig8:",
  "mixamorig7:",
  "mixamorig6:",
  "mixamorig5:",
  "mixamorig4:",
  "mixamorig3:",
  "mixamorig2:",
  "mixamorig1:",
  "mixamorig:",
];

export function stripMixamoPrefix(name: string): string {
  for (const p of MIXAMO_PREFIXES) {
    if (name.startsWith(p)) return name.slice(p.length);
  }
  return name.startsWith("mixamorig") ? name.slice("mixamorig".length) : name;
}

export type RoleMap = Partial<Record<BoneRole, string>>;

function chainDepth(bone: THREE.Bone, max = 8): number {
  let d = 0;
  let b: THREE.Bone | undefined = bone;
  while (b && d < max) {
    const kids = b.children.filter((c) => (c as THREE.Bone).isBone) as THREE.Bone[];
    if (!kids.length) break;
    b = kids[0];
    d++;
  }
  return d;
}

function worldX(bone: THREE.Bone): number {
  const v = new THREE.Vector3();
  bone.getWorldPosition(v);
  return v.x;
}

export function discoverToonBoneRoles(root: THREE.Object3D): RoleMap {
  let best: THREE.Skeleton | null = null;
  root.traverse((o) => {
    const m = o as THREE.SkinnedMesh;
    if (m.isSkinnedMesh && m.skeleton?.bones?.length) {
      if (!best || m.skeleton.bones.length > best.bones.length) best = m.skeleton;
    }
  });
  if (!best) return {};

  const bones = best.bones as THREE.Bone[];
  let hips: THREE.Bone | null = null;
  for (const b of bones) {
    const kids = b.children.filter((c) => (c as THREE.Bone).isBone) as THREE.Bone[];
    if (kids.length >= 3 && /^Bone/i.test(b.name)) {
      hips = b;
      break;
    }
  }
  if (!hips) {
    hips =
      bones
        .filter((b) => b.children.some((c) => (c as THREE.Bone).isBone))
        .sort(
          (a, b) =>
            b.children.filter((c) => (c as THREE.Bone).isBone).length -
            a.children.filter((c) => (c as THREE.Bone).isBone).length,
        )[0] ?? null;
  }
  if (!hips) return {};

  const roles: RoleMap = { hips: hips.name };
  const hipKids = hips.children.filter((c) => (c as THREE.Bone).isBone) as THREE.Bone[];
  const ranked = hipKids
    .map((b) => ({
      b,
      kids: b.children.filter((c) => (c as THREE.Bone).isBone).length,
      depth: chainDepth(b),
      x: worldX(b),
    }))
    .sort((a, b) => b.kids - a.kids || b.depth - a.depth);

  const spineEntry = ranked[0];
  if (spineEntry) {
    roles.spine = spineEntry.b.name;
    const spineKids = spineEntry.b.children.filter((c) =>
      (c as THREE.Bone).isBone,
    ) as THREE.Bone[];
    const arms = spineKids
      .map((b) => ({ b, depth: chainDepth(b), x: worldX(b) }))
      .filter((e) => e.depth >= 1)
      .sort((a, b) => a.x - b.x);
    if (arms.length >= 2) {
      assignArm(roles, "l", arms[0].b);
      assignArm(roles, "r", arms[arms.length - 1].b);
    }
  }

  const legs = ranked
    .slice(1)
    .filter((e) => e.depth >= 1)
    .sort((a, b) => a.x - b.x);
  if (legs.length >= 2) {
    assignLeg(roles, "l", legs[0].b);
    assignLeg(roles, "r", legs[legs.length - 1].b);
  }
  return roles;
}

function assignArm(roles: RoleMap, side: "l" | "r", start: THREE.Bone) {
  const chain: THREE.Bone[] = [start];
  let cur = start;
  while (chain.length < 4) {
    const kids = cur.children.filter((c) => (c as THREE.Bone).isBone) as THREE.Bone[];
    if (!kids.length) break;
    cur = kids[0];
    chain.push(cur);
  }
  const p = side;
  if (chain[0]) roles[`${p}Clavicle` as BoneRole] = chain[0].name;
  if (chain[1]) roles[`${p}UpperArm` as BoneRole] = chain[1].name;
  else if (chain[0]) roles[`${p}UpperArm` as BoneRole] = chain[0].name;
  if (chain[2]) roles[`${p}Forearm` as BoneRole] = chain[2].name;
  if (chain[3]) roles[`${p}Hand` as BoneRole] = chain[3].name;
}

function assignLeg(roles: RoleMap, side: "l" | "r", start: THREE.Bone) {
  const chain: THREE.Bone[] = [start];
  let cur = start;
  while (chain.length < 3) {
    const kids = cur.children.filter((c) => (c as THREE.Bone).isBone) as THREE.Bone[];
    if (!kids.length) break;
    cur = kids[0];
    chain.push(cur);
  }
  const p = side;
  if (chain[0]) roles[`${p}Thigh` as BoneRole] = chain[0].name;
  if (chain[1]) roles[`${p}Calf` as BoneRole] = chain[1].name;
  if (chain[2]) roles[`${p}Foot` as BoneRole] = chain[2].name;
}

export function roleForSourceBone(boneName: string): BoneRole | null {
  const bare = stripMixamoPrefix(boneName);
  return (
    SOURCE_BONE_TO_ROLE[bare] ??
    SOURCE_BONE_TO_ROLE[bare.replace(/_/g, " ")] ??
    SOURCE_BONE_TO_ROLE[bare.replace(/ /g, "_")] ??
    null
  );
}

export function toRotationOnlyClip(clip: THREE.AnimationClip): THREE.AnimationClip {
  clip.tracks = clip.tracks.filter((t) => {
    const dot = t.name.indexOf(".");
    if (dot < 0) return true;
    const prop = t.name.slice(dot + 1);
    return prop === "quaternion" || prop === "rotation";
  });
  return clip;
}

export function retargetClipToToon(
  clip: THREE.AnimationClip,
  roleMap: RoleMap,
  opts?: { name?: string },
): THREE.AnimationClip {
  const out = clip.clone();
  if (opts?.name) out.name = opts.name;
  toRotationOnlyClip(out);
  const kept: THREE.KeyframeTrack[] = [];
  for (const track of out.tracks) {
    const dot = track.name.indexOf(".");
    if (dot < 0) continue;
    const bone = track.name.slice(0, dot);
    const prop = track.name.slice(dot);
    const role = roleForSourceBone(bone);
    if (!role || !roleMap[role]) continue;
    track.name = roleMap[role]! + prop;
    kept.push(track);
  }
  out.tracks = kept;
  return out;
}

export function parseBakedClipJson(data: unknown, name?: string): THREE.AnimationClip {
  const clip = THREE.AnimationClip.parse(data as object);
  if (name) clip.name = name;
  return clip;
}
