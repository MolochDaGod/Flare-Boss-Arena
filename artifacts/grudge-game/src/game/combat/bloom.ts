import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";

export interface BloomComposer {
  composer: EffectComposer;
  bloomPass: UnrealBloomPass;
}

/**
 * Build a selective-bloom post pipeline (RenderPass → UnrealBloomPass →
 * OutputPass) so the additive flame VFX glow while the dark scene stays moody.
 * A high threshold means only the brightest hot cores/embers bloom — it does
 * NOT wash out the dark-fantasy mood. OutputPass applies the renderer's tone
 * mapping + color space at the end of the chain (RenderPass renders linear HDR).
 *
 * Returns null if setup fails (e.g. headless / no-GPU), letting callers fall
 * back to direct rendering — the engines already degrade gracefully there.
 */
export function makeBloomComposer(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  w: number,
  h: number,
  opts: { strength?: number; radius?: number; threshold?: number } = {},
): BloomComposer | null {
  try {
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(w, h),
      opts.strength ?? 0.7,
      opts.radius ?? 0.5,
      opts.threshold ?? 0.85,
    );
    composer.addPass(bloomPass);
    composer.addPass(new OutputPass());
    return { composer, bloomPass };
  } catch {
    return null;
  }
}
