/**
 * Shared Three.js setup for Flare Boss Arena / camp / boss / dungeon.
 *
 * Production glTF recipe (aligned with gameopen + threejs-loaders skill):
 *  - Shared LoadingManager (one progress/error surface)
 *  - DRACO geometry decoder
 *  - Meshopt buffer decoder
 *  - KTX2 / Basis (after bindKtx2(renderer))
 *  - KHR_materials_pbrSpecularGlossiness → MeshStandard approx (KayKit packs)
 *
 * Plain uncompressed GLBs still load; decoders only activate when declared.
 */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

const SPEC_GLOSS = "KHR_materials_pbrSpecularGlossiness";

/** Google-hosted Draco WASM (1.5.x fleet default). */
const DRACO_DECODER_PATH =
  "https://www.gstatic.com/draco/versioned/decoders/1.5.7/";
/** Basis transcoder pinned near three@0.185. */
const KTX2_TRANSCODER_PATH =
  "https://cdn.jsdelivr.net/npm/three@0.185.0/examples/jsm/libs/basis/";

// Enable browser Cache for TextureLoader / FileLoader under the hood.
if (typeof THREE.Cache !== "undefined") {
  THREE.Cache.enabled = true;
}

/** Shared progress/error surface for every optimized load. */
export const gltfManager = new THREE.LoadingManager();

let sharedDraco: DRACOLoader | null = null;
function getDraco(): DRACOLoader {
  if (!sharedDraco) {
    sharedDraco = new DRACOLoader(gltfManager);
    sharedDraco.setDecoderPath(DRACO_DECODER_PATH);
    sharedDraco.preload();
  }
  return sharedDraco;
}

let sharedKtx2: KTX2Loader | null = null;
let ktx2Bound = false;

/**
 * Bind KTX2 / Basis Universal using a live WebGLRenderer (GPU detect).
 * Call once after creating the renderer in Camp / Arena / GameEngine.
 * Safe to call multiple times.
 */
export function bindKtx2(renderer: THREE.WebGLRenderer): void {
  if (!renderer) return;
  if (ktx2Bound && sharedKtx2) {
    try {
      sharedKtx2.detectSupport(renderer);
    } catch {
      /* ignore */
    }
    return;
  }
  try {
    sharedKtx2 = new KTX2Loader(gltfManager)
      .setTranscoderPath(KTX2_TRANSCODER_PATH)
      .detectSupport(renderer);
    ktx2Bound = true;
    if (sharedLoader) {
      sharedLoader.setKTX2Loader(sharedKtx2);
    }
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn("[threeSetup] KTX2 bind failed (non-fatal):", err);
    }
  }
}

export function isKtx2Bound(): boolean {
  return ktx2Bound;
}

/**
 * Archived glTF extension removed from three.js core loaders.
 * Approximate as MeshStandardMaterial (diffuse → color/map, gloss → roughness).
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
      materialParams.metalness = 0.0;

      const specular = ext.specularFactor as number[] | undefined;
      if (Array.isArray(specular)) {
        const specLum = (specular[0] + specular[1] + specular[2]) / 3;
        materialParams.metalness = THREE.MathUtils.clamp(specLum * 0.35, 0, 0.6);
      }

      if (ext.specularGlossinessTexture) {
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

export interface GltfLoaderOptions {
  /** Override shared LoadingManager (tests / isolated progress UI). */
  manager?: THREE.LoadingManager;
  /** Supply a live renderer to enable KTX2. */
  renderer?: THREE.WebGLRenderer;
  /** Force a fresh loader instance (default: false → shared singleton). */
  fresh?: boolean;
}

/** Meshopt WASM must be ready before EXT_meshopt_compression GLBs (crew packs). */
let meshoptReady: Promise<void> | null = null;

export function ensureMeshoptReady(): Promise<void> {
  if (!meshoptReady) {
    const ready = (MeshoptDecoder as { ready?: Promise<unknown> }).ready;
    meshoptReady = ready
      ? ready.then(() => undefined).catch(() => undefined)
      : Promise.resolve();
  }
  return meshoptReady;
}

/**
 * Wire Draco + Meshopt + SpecGloss (+ KTX2 when bound/renderer provided).
 */
export function makeGltfLoader(opts: GltfLoaderOptions = {}): GLTFLoader {
  const manager = opts.manager ?? gltfManager;
  const loader = new GLTFLoader(manager);
  loader.setDRACOLoader(getDraco());
  try {
    // Always register; loads should await ensureMeshoptReady() first.
    loader.setMeshoptDecoder(MeshoptDecoder);
  } catch {
    /* meshopt optional if bundler strips wasm */
  }
  loader.register((parser) => createSpecGlossPlugin(parser));
  if (opts.renderer) {
    bindKtx2(opts.renderer);
  }
  if (sharedKtx2) {
    loader.setKTX2Loader(sharedKtx2);
  }
  return loader;
}

let sharedLoader: GLTFLoader | null = null;

/**
 * Process-wide decoder-optimized loader (preferred for camp / boss / skills).
 * Prefer this over `new GLTFLoader()` or repeated createGltfLoader() calls.
 */
export function sharedGltfLoader(): GLTFLoader {
  if (!sharedLoader) sharedLoader = makeGltfLoader();
  return sharedLoader;
}

/**
 * Canonical GLTFLoader for the app.
 * Defaults to the shared singleton so camp/skills/arena share one decode pipeline.
 * Pass `{ fresh: true }` only when a private LoadingManager is required.
 */
export function createGltfLoader(opts: GltfLoaderOptions = {}): GLTFLoader {
  if (opts.fresh || opts.manager) {
    return makeGltfLoader(opts);
  }
  if (opts.renderer) {
    bindKtx2(opts.renderer);
  }
  return sharedGltfLoader();
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

/** Dispose shared decoder workers (call only on full app teardown). */
export function disposeGltfDecoders() {
  try {
    sharedDraco?.dispose();
  } catch {
    /* ignore */
  }
  sharedDraco = null;
  try {
    sharedKtx2?.dispose();
  } catch {
    /* ignore */
  }
  sharedKtx2 = null;
  ktx2Bound = false;
  sharedLoader = null;
}
