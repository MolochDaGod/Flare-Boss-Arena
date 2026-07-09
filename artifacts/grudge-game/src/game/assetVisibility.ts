import * as THREE from "three";
import type { HiddenMeshRule } from "../data/fighterAssetTuning";

const RULES_KEY = "assetVisibilityRules";

/** Clip-name substrings that reveal deferred weapon / prop meshes. */
export const COMBAT_CLIP_HINTS = [
  "combo",
  "skill",
  "attack",
  "slash",
  "chop",
  "stab",
  "cast",
  "spell",
  "shoot",
  "throw",
  "damage",
  "dodge",
  "jump",
  "shigan",
  "shugan",
  "par",
  "sp01",
  "sp02",
  "sp03",
  "sp_",
  "counter",
  "death",
  "stretchy",
  "transform",
  "yasakani",
  "yubisashi",
] as const;

const BODY_PART_RE =
  /(^|_)(body|face|hair|coat|hat|leg|tail|beard|elbow|hagoromo|scarf|glass|watch|shoes|open_watch|cigarette|transform_capsule)(_|$)/i;

/**
 * Bounty-rush skin GLBs ship alternate weapon meshes left at the bind pose (y≈0).
 * Animations toggle the correct subset per clip — hide the rest until combat plays.
 */
export function isDeferredWeaponMesh(meshName: string): boolean {
  const n = meshName.toLowerCase();
  if (BODY_PART_RE.test(n)) return false;
  if (/(^|_)(l_|r_)?hand/.test(n)) return false;

  return (
    /(^|_)(l_|r_)?weapon/.test(n) ||
    /weapon_\d/.test(n) ||
    /kanabo/.test(n) ||
    /weopen/.test(n) ||
    /(^|_)(l_|r_|bk_|waist_)blade/.test(n) ||
    /(^|_)(l_|r_|bk_|waist_)sheath/.test(n) ||
    /knife_pl_/.test(n) ||
    /musket/.test(n) ||
    /sakazuki/.test(n) ||
    /flying_rock/.test(n) ||
    /noodle/.test(n) ||
    /wooden_box/.test(n) ||
    /kroom_dummy/.test(n) ||
    /pigeon/.test(n) ||
    /taru_pl_/.test(n) ||
    /stretchy_arm/.test(n) ||
    /(^|_)(l_|r_)arm_(sp|skill)/.test(n) ||
    /(^|_)(l_|r_)leg_(skill|sp)/.test(n)
  );
}

export function collectMeshNames(root: THREE.Object3D): string[] {
  const names = new Set<string>();
  root.traverse((o) => {
    const m = o as THREE.Mesh & { isMesh?: boolean };
    if (m.isMesh && o.name) names.add(o.name);
  });
  return [...names].sort();
}

/** Build hide-until-combat rules for weapon/prop meshes detected by name. */
export function inferHiddenWeaponRules(meshNames: string[]): HiddenMeshRule[] {
  return meshNames
    .filter(isDeferredWeaponMesh)
    .map((meshName) => ({
      meshName,
      alwaysVisible: false,
      showOnClips: [...COMBAT_CLIP_HINTS],
    }));
}

/** Merge saved tuner rules with auto-detected weapon meshes (saved wins). */
export function resolveHiddenMeshRules(saved: HiddenMeshRule[], meshNames: string[]): HiddenMeshRule[] {
  const inferred = inferHiddenWeaponRules(meshNames);
  const savedByName = new Map(saved.map((r) => [r.meshName, r]));
  const merged = inferred.map((rule) => savedByName.get(rule.meshName) ?? rule);
  for (const rule of saved) {
    if (!merged.some((r) => r.meshName === rule.meshName)) merged.push(rule);
  }
  return merged;
}

/** Apply visibility rules after the model loads. */
export function applyHiddenMeshRules(root: THREE.Object3D, rules: HiddenMeshRule[]) {
  root.userData[RULES_KEY] = rules;
  const byName = new Map(rules.map((r) => [r.meshName, r]));
  root.traverse((o) => {
    const m = o as THREE.Mesh & { isMesh?: boolean };
    if (!m.isMesh || !o.name) return;
    const rule = byName.get(o.name);
    if (!rule) return;
    m.visible = rule.alwaysVisible;
  });
}

/** Reveal meshes registered for the active animation clip; hide deferred parts otherwise. */
export function syncHiddenMeshesForClip(root: THREE.Object3D, clipName: string) {
  const rules = root.userData[RULES_KEY] as HiddenMeshRule[] | undefined;
  if (!rules?.length) return;
  const clip = clipName.toLowerCase();
  const byName = new Map(rules.map((r) => [r.meshName, r]));
  root.traverse((o) => {
    const m = o as THREE.Mesh & { isMesh?: boolean };
    if (!m.isMesh || !o.name) return;
    const rule = byName.get(o.name);
    if (!rule || rule.alwaysVisible) return;
    const show =
      rule.showOnClips.length === 0
        ? false
        : rule.showOnClips.some((c) => clip.includes(c.toLowerCase()) || c.toLowerCase().includes(clip));
    m.visible = show;
  });
}

/** Resolve + apply fighter mesh visibility (saved tuning + auto weapon detection). */
export function setupFighterMeshVisibility(
  root: THREE.Object3D,
  fighterId: string,
  savedRules: HiddenMeshRule[],
  activeClipName?: string,
) {
  const rules = resolveHiddenMeshRules(savedRules, collectMeshNames(root));
  applyHiddenMeshRules(root, rules);
  if (activeClipName) syncHiddenMeshesForClip(root, activeClipName);
  root.userData.fighterAssetId = fighterId;
}