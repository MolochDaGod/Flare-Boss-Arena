/**
 * Shared Three.js setup helpers for Flare.
 * - One GLTFLoader recipe (incl. archived KHR SpecGloss materials)
 * - Safe WebGLRenderer teardown (forceContextLoss)
 */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const SPEC_GLOSS = "KHR_materials_pbrSpecularGlossiness";

/**
 * Archived glTF extension removed from three.js core loaders.
 * Approximate as MeshStandardMaterial (diffuse → color/map, gloss → roughness).
 * @see https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Archived/KHR_materials_pbrSpecularGlossiness
 */
function createSpecGlossPlugin(parser: {
  assignTexture: (
    materialParams: Record<string, unknown>,
    mapName: string,
    mapDef: unknown,
  ) => Promise<unknown>;
}) {
  return {
    name: SPEC_GLOSS,
    getMaterialType() {
      return THREE.MeshStandardMaterial;
    },
    extendParams(
      materialParams: Record<string, unknown>,
      materialDef: {
        extensions?: Record<string, Record<string, unknown>>;
      },
    ) {
      const ext = materialDef.extensions?.[SPEC_GLOSS];
      if (!ext) return Promise.resolve();

      const pending: Promise<unknown>[] = [];
      materialParams.color = new THREE.Color(1, 1, 1);
      materialParams.opacity = 1;

      const diffuse = ext.diffuseFactor as number[] | undefined;
      if (Array.isArray(diffuse)) {
        (materialParams.color as THREE.Color).fromArray(diffuse);
        materialParams.opacity = diffuse[3] ?? 1;
      }
      if (ext.diffuseTexture) {
        pending.push(parser.assignTexture(materialParams, "map", ext.diffuseTexture));
      }

      const gloss =
        typeof ext.glossinessFactor === "number" ? ext.glossinessFactor : 1;
      materialParams.roughness = THREE.MathUtils.clamp(1 - gloss, 0.04, 1);
      // Specular-glossiness has no direct metalness; keep non-metal default.
      materialParams.metalness = 0.0;

      const specular = ext.specularFactor as number[] | undefined;
      if (Array.isArray(specular)) {
        // Mild metalness lift from bright specular (heuristic only).
        const specLum = (specular[0] + specular[1] + specular[2]) / 3;
        materialParams.metalness = THREE.MathUtils.clamp(specLum * 0.35, 0, 0.6);
      }

      if (ext.specularGlossinessTexture) {
        // Use SG map as roughnessMap (alpha is gloss in the extension).
        pending.push(
          parser.assignTexture(
            materialParams,
            "roughnessMap",
            ext.specularGlossinessTexture,
          ),
        );
      }

      return Promise.all(pending);
    },
  };
}

/** Canonical GLTFLoader for the app — always register SpecGloss for KayKit / older packs. */
export function createGltfLoader(): GLTFLoader {
  const loader = new GLTFLoader();
  loader.register((parser) => createSpecGlossPlugin(parser));
  return loader;
}

export type FlareTimer = THREE.Timer;

/** Preferred frame timer (three r170+). Falls back to a thin Clock shim if missing. */
export function createFrameTimer(): {
  update: () => void;
  getDelta: () => number;
  getElapsed: () => number;
  connect: (doc: Document) => void;
  disconnect: () => void;
} {
  if (typeof THREE.Timer === "function") {
    const timer = new THREE.Timer();
    return {
      update: () => timer.update(),
      getDelta: () => timer.getDelta(),
      getElapsed: () => timer.getElapsed(),
      connect: (doc) => timer.connect(doc),
      disconnect: () => timer.disconnect(),
    };
  }
  // Legacy path (should not hit on three@0.185)
  const clock = new THREE.Clock();
  return {
    update: () => {},
    getDelta: () => clock.getDelta(),
    getElapsed: () => clock.getElapsedTime(),
    connect: () => {},
    disconnect: () => {},
  };
}

/** Default shadow filter for three r185+ (PCFSoft is deprecated). */
export const FLARE_SHADOW_TYPE = THREE.PCFShadowMap;

/**
 * Tear down a WebGLRenderer fully so browsers release the context
 * (avoids "Too many active WebGL contexts").
 */
export function disposeRenderer(renderer: THREE.WebGLRenderer | null | undefined) {
  if (!renderer) return;
  try {
    renderer.domElement?.removeEventListener?.("webglcontextlost", () => {});
    renderer.forceContextLoss();
  } catch {
    /* ignore */
  }
  try {
    renderer.dispose();
  } catch {
    /* ignore */
  }
  const canvas = renderer.domElement;
  if (canvas?.parentNode) {
    canvas.parentNode.removeChild(canvas);
  }
}
