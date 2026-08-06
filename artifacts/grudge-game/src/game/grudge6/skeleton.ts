/**
 * Grudge6 / Toon RTS skeleton SSOT (ported from Open characterDeploy / grudge/skeleton).
 *
 * Toon RTS race GLBs ship ~14–27 SkinnedMeshes each with a DISCONNECTED skeleton.
 * Without unifySkeletons, baked Bip001 clips only deform one mesh island →
 * T-pose limbs, stretched parts, “broken grudge6” look.
 *
 * @see grudge-character-correctness · gameopen/.../grudge/skeleton.ts
 */
import * as THREE from "three";

/** Collapse every SkinnedMesh onto ONE canonical bone chain (shallowest name wins). */
export function unifySkeletons(root: THREE.Object3D): THREE.Skeleton | null {
  root.updateMatrixWorld(true);

  // BFS from root children — first bone per name is canonical (same as Open SSOT)
  const canon = new Map<string, THREE.Bone>();
  const queue: THREE.Object3D[] = [...root.children];
  while (queue.length) {
    const node = queue.shift()!;
    // isBone flag (not instanceof) — multi-three copy safe
    if ((node as THREE.Bone).isBone && node.name && !canon.has(node.name)) {
      canon.set(node.name, node as THREE.Bone);
    }
    for (const c of node.children) queue.push(c);
  }
  if (canon.size === 0) return null;

  let widest: THREE.Skeleton | null = null;
  let unresolved = 0;
  root.traverse((node) => {
    const sm = node as THREE.SkinnedMesh;
    if (!sm.isSkinnedMesh || !sm.skeleton) return;
    const newBones = sm.skeleton.bones.map((b) => {
      const c = canon.get(b.name);
      if (!c) unresolved++;
      return c ?? b;
    });
    const newSkel = new THREE.Skeleton(newBones, sm.skeleton.boneInverses);
    sm.bind(newSkel, sm.bindMatrix);
    if (!widest || newSkel.bones.length > widest.bones.length) widest = newSkel;
  });

  if (unresolved > 0 && import.meta.env.DEV) {
    console.warn(
      `[grudge6] unifySkeletons: ${unresolved} bone(s) had no canonical match`,
    );
  }
  return widest;
}

/**
 * Force uniform local scale on every Mesh node.
 * WK kit heads ship non-uniform [2.41, 2.54, 2.54] which reads as stretch
 * once the kit is parent-scaled to 1.8 m.
 */
export function forceUniformMeshScales(root: THREE.Object3D): number {
  let fixed = 0;
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const sx = Math.abs(m.scale.x);
    const sy = Math.abs(m.scale.y);
    const sz = Math.abs(m.scale.z);
    if (sx < 1e-8 && sy < 1e-8 && sz < 1e-8) return;
    if (Math.abs(sx - sy) > 0.015 || Math.abs(sx - sz) > 0.015 || Math.abs(sy - sz) > 0.015) {
      // Prefer max axis so we don't shrink heads too hard vs body (still uniform)
      const u = Math.max(sx, sy, sz);
      m.scale.set(u, u, u);
      fixed++;
    }
  });
  if (fixed) root.updateMatrixWorld(true);
  return fixed;
}

/** Decade unit snap (classic 100× / 0.01×) — unclamped. */
export function powerOfTenScale(reference: number, current: number): number {
  if (!(reference > 0) || !(current > 0)) return 1;
  return Math.pow(10, Math.round(Math.log10(reference / current)));
}
