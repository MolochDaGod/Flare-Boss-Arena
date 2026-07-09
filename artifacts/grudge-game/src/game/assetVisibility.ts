import * as THREE from "three";
import type { HiddenMeshRule } from "../data/fighterAssetTuning";

const RULES_KEY = "assetVisibilityRules";

export function collectMeshNames(root: THREE.Object3D): string[] {
  const names = new Set<string>();
  root.traverse((o) => {
    const m = o as THREE.Mesh & { isMesh?: boolean };
    if (m.isMesh && o.name) names.add(o.name);
  });
  return [...names].sort();
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