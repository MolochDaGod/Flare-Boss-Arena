/**
 * Toon RTS polyart material apply — author .mat parity for grudge6 kits.
 *
 * From Unity WK/ORC/ELF Standard materials:
 *   Metallic 0 · Glossiness 0 · SpecularHighlights off · Color ≈ white
 *   MainTex = race atlas (flipY false for FBX-exported UVs)
 * Color sets: full recolored atlases (Materials/Colors), not shader masks.
 */

import * as THREE from "three";
import { TOON_RTS_MATERIAL } from "../../data/toonRtsColorSets";

export interface ApplyToonRtsOpts {
  atlas: THREE.Texture;
  /** Multiply only when atlas is standard and we soft-tint a missing color set. */
  tintHex?: number;
  /** Force MeshStandardMaterial rebuild (recommended for baked GLB that ships wrong PBR). */
  forceStandard?: boolean;
}

/**
 * Configure atlas texture for Toon RTS (author FBX path).
 */
export function configureToonAtlasTexture(tex: THREE.Texture): void {
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.flipY = false;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  // Polyart atlases: linear filter avoids shimmer on distant units; nearest is harsher
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
}

/**
 * Apply atlas + author material recipe to every UV mesh under root.
 * Returns number of material slots patched.
 */
export function applyToonRtsMaterials(root: THREE.Object3D, opts: ApplyToonRtsOpts): number {
  const { atlas, tintHex = 0xffffff, forceStandard = true } = opts;
  configureToonAtlasTexture(atlas);

  const tint = new THREE.Color(tintHex);
  let patched = 0;

  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    // Skip non-UV props if any
    if (!mesh.geometry?.attributes?.uv) return;

    const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const next: THREE.Material[] = [];

    for (const mat of list) {
      if (!mat) continue;
      let m: THREE.MeshStandardMaterial;

      const old = mat as THREE.MeshStandardMaterial;
      const hasEmbedMap = !!(old.map && old.map.image);
      if (
        forceStandard ||
        !(old as THREE.MeshStandardMaterial).isMeshStandardMaterial ||
        !hasEmbedMap
      ) {
        // Rebuild to Standard so metal/rough match author polyart
        m = new THREE.MeshStandardMaterial({
          map: atlas,
          color: tint.clone(),
          metalness: TOON_RTS_MATERIAL.metalness,
          roughness: TOON_RTS_MATERIAL.roughness,
          envMapIntensity: TOON_RTS_MATERIAL.envMapIntensity,
          side: old.side ?? THREE.FrontSide,
          transparent: old.transparent ?? false,
          opacity: old.opacity ?? 1,
          alphaTest: old.alphaTest ?? 0,
          name: old.name || "toon_rts_unit",
        });
      } else {
        // Keep embedded Toon ★ map; only author metal/rough/tint
        m = old;
        if (tintHex !== 0xffffff) m.color.copy(tint);
        else if (m.color) m.color.set(0xffffff);
        m.metalness = TOON_RTS_MATERIAL.metalness;
        m.roughness = TOON_RTS_MATERIAL.roughness;
        if ("envMapIntensity" in m) m.envMapIntensity = TOON_RTS_MATERIAL.envMapIntensity;
      }

      m.vertexColors = false;
      // No specular highlights equivalent — roughness high already
      if ("specularIntensity" in m) (m as THREE.MeshPhysicalMaterial).specularIntensity = 0;
      m.needsUpdate = true;
      next.push(m);
      patched++;
    }

    if (next.length === 1) mesh.material = next[0]!;
    else if (next.length > 1) mesh.material = next;

    mesh.castShadow = true;
    mesh.receiveShadow = true;
  });

  return patched;
}

/** Dispose helper for materials we may have replaced. */
export function disposeMeshMaterials(root: THREE.Object3D) {
  root.traverse((c) => {
    const m = c as THREE.Mesh;
    if (!m.isMesh || !m.material) return;
    const list = Array.isArray(m.material) ? m.material : [m.material];
    for (const mat of list) mat?.dispose?.();
  });
}
