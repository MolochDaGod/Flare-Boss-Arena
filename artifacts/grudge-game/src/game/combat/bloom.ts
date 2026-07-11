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
 * OutputPass) so the additive particle VFX glow while the dark scene stays moody.
 * A high threshold means only the brightest hot cores/embers bloom — it does
 * NOT wash out the dark-fantasy mood. OutputPass applies the renderer's tone
 * mapping + color space at the end of the chain (RenderPass renders linear HDR).
 *
 * EffectComposer stays full-res (sharp scene). UnrealBloomPass internal RTs use
 * `resolutionScale` (default 0.5) so the expensive multi-pass blur is cheap.
 * Returns null if setup fails (e.g. headless / no-GPU).
 */
export function makeBloomComposer(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  w: number,
  h: number,
  opts: { strength?: number; radius?: number; threshold?: number; resolutionScale?: number } = {},
): BloomComposer | null {
  try {
    const scale = opts.resolutionScale ?? 0.5;
    const bw = Math.max(1, Math.floor(w * scale));
    const bh = Math.max(1, Math.floor(h * scale));
    const composer = new EffectComposer(renderer);
    composer.setSize(w, h);
    composer.addPass(new RenderPass(scene, camera));
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(bw, bh),
      opts.strength ?? 0.55,
      opts.radius ?? 0.4,
      opts.threshold ?? 0.88,
    );
    composer.addPass(bloomPass);
    composer.addPass(new OutputPass());
    return { composer, bloomPass };
  } catch {
    return null;
  }
}
