import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";

/** Soft vignette + subtle contrast — keeps the dark-fantasy mood without muddying VFX. */
const VignetteShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    offset: { value: 0.95 },
    darkness: { value: 0.72 },
    warmth: { value: 0.04 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float offset;
    uniform float darkness;
    uniform float warmth;
    varying vec2 vUv;
    void main() {
      vec4 texel = texture2D(tDiffuse, vUv);
      vec2 uv = (vUv - 0.5) * vec2(offset);
      float vig = clamp(1.0 - dot(uv, uv), 0.0, 1.0);
      vig = pow(vig, darkness);
      // Slight warm lift in midtones so gold/fire VFX pop on cold fog.
      texel.rgb *= mix(vec3(1.0), vec3(1.0 + warmth, 1.0 + warmth * 0.55, 1.0 - warmth * 0.35), 0.55);
      gl_FragColor = vec4(texel.rgb * vig, texel.a);
    }
  `,
};

export interface BloomComposer {
  composer: EffectComposer;
  bloomPass: UnrealBloomPass;
  vignettePass: ShaderPass | null;
  /** Baseline bloom strength (before combat pulse). */
  baseStrength: number;
  /** 0..1 temporary combat punch added to strength. */
  pulse: number;
  setSize(w: number, h: number, resolutionScale?: number): void;
  /** Call each frame with dt to decay combat pulse. */
  update(dt: number): void;
  /** Brief bloom kick for skills / crits / stage hits. */
  kick(amount?: number): void;
  dispose(): void;
}

export interface BloomOpts {
  strength?: number;
  radius?: number;
  threshold?: number;
  resolutionScale?: number;
  /** Vignette darkness power (higher = darker edges). 0 disables vignette. */
  vignette?: number;
  /** Soft warm grade 0..0.12. */
  warmth?: number;
}

/**
 * Build a selective-bloom post pipeline:
 * RenderPass → UnrealBloomPass → Vignette → OutputPass
 *
 * High bloom threshold keeps only hot VFX cores glowing. Vignette frames the
 * iso stage without washing dark terrain. OutputPass applies tone mapping +
 * color space. Bloom blur RTs stay half-res for fill cost.
 */
export function makeBloomComposer(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  w: number,
  h: number,
  opts: BloomOpts = {},
): BloomComposer | null {
  try {
    const scale = opts.resolutionScale ?? 0.5;
    const bw = Math.max(1, Math.floor(w * scale));
    const bh = Math.max(1, Math.floor(h * scale));
    const baseStrength = opts.strength ?? 0.62;
    const composer = new EffectComposer(renderer);
    composer.setSize(w, h);
    composer.addPass(new RenderPass(scene, camera));
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(bw, bh),
      baseStrength,
      opts.radius ?? 0.48,
      opts.threshold ?? 0.82,
    );
    composer.addPass(bloomPass);

    let vignettePass: ShaderPass | null = null;
    const vigAmt = opts.vignette ?? 0.78;
    if (vigAmt > 0.01) {
      vignettePass = new ShaderPass(VignetteShader);
      vignettePass.uniforms.darkness.value = vigAmt;
      vignettePass.uniforms.warmth.value = opts.warmth ?? 0.045;
      composer.addPass(vignettePass);
    }
    composer.addPass(new OutputPass());

    const handle: BloomComposer = {
      composer,
      bloomPass,
      vignettePass,
      baseStrength,
      pulse: 0,
      setSize(nw: number, nh: number, resolutionScale = scale) {
        composer.setSize(nw, nh);
        const rbw = Math.max(1, Math.floor(nw * resolutionScale));
        const rbh = Math.max(1, Math.floor(nh * resolutionScale));
        bloomPass.resolution.set(rbw, rbh);
      },
      update(dt: number) {
        if (handle.pulse > 0) {
          handle.pulse = Math.max(0, handle.pulse - dt * 1.8);
        }
        bloomPass.strength = handle.baseStrength + handle.pulse * 0.55;
      },
      kick(amount = 0.35) {
        handle.pulse = Math.min(1, handle.pulse + amount);
      },
      dispose() {
        composer.dispose();
      },
    };
    return handle;
  } catch {
    return null;
  }
}
