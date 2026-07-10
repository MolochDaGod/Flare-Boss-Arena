import * as THREE from "three";
import { Sky } from "three/examples/jsm/objects/Sky.js";

export interface CampSkyPreset {
  sunPosition: THREE.Vector3;
  lightPosition: THREE.Vector3;
  sunColor: THREE.Color;
  sunIntensity: number;
  hemiSky: THREE.Color;
  hemiGround: THREE.Color;
  hemiIntensity: number;
  turbidity: number;
  rayleigh: number;
  fogColor: THREE.Color;
  fogDensity: number;
  exposure: number;
}

const PRESETS = {
  dawn: {
    sunPosition: new THREE.Vector3(-1, 0.08, -1),
    lightPosition: new THREE.Vector3(-9, 3.5, -7),
    sunColor: new THREE.Color("#ffd2a1"),
    sunIntensity: 1.7,
    hemiSky: new THREE.Color("#ffd9b0"),
    hemiGround: new THREE.Color("#23232e"),
    hemiIntensity: 0.5,
    turbidity: 7,
    rayleigh: 2.4,
    fogColor: new THREE.Color("#2a2230"),
    fogDensity: 0.012,
    exposure: 0.92,
  },
  noon: {
    sunPosition: new THREE.Vector3(0.3, 1, 0.4),
    lightPosition: new THREE.Vector3(5, 13, 6),
    sunColor: new THREE.Color("#fff6ea"),
    sunIntensity: 2.6,
    hemiSky: new THREE.Color("#bcd4ff"),
    hemiGround: new THREE.Color("#2f2c26"),
    hemiIntensity: 0.7,
    turbidity: 3.5,
    rayleigh: 1.1,
    fogColor: new THREE.Color("#8eb8e8"),
    fogDensity: 0.006,
    exposure: 1.05,
  },
  sunset: {
    sunPosition: new THREE.Vector3(1, 0.05, 0.35),
    lightPosition: new THREE.Vector3(10, 2.2, 3),
    sunColor: new THREE.Color("#ff8a46"),
    sunIntensity: 1.9,
    hemiSky: new THREE.Color("#ffae6e"),
    hemiGround: new THREE.Color("#1a1320"),
    hemiIntensity: 0.5,
    turbidity: 11,
    rayleigh: 3.2,
    fogColor: new THREE.Color("#4a2838"),
    fogDensity: 0.01,
    exposure: 0.95,
  },
  night: {
    sunPosition: new THREE.Vector3(0, -0.35, -1),
    lightPosition: new THREE.Vector3(-3, 9, -5),
    sunColor: new THREE.Color("#6f8dff"),
    sunIntensity: 0.55,
    hemiSky: new THREE.Color("#2b3a78"),
    hemiGround: new THREE.Color("#04050a"),
    hemiIntensity: 0.45,
    turbidity: 0.2,
    rayleigh: 0.5,
    fogColor: new THREE.Color("#06080f"),
    fogDensity: 0.018,
    exposure: 0.78,
  },
} satisfies Record<string, CampSkyPreset>;

const CYCLE_KEYS = ["dawn", "noon", "sunset", "night"] as const;
type CycleKey = (typeof CYCLE_KEYS)[number];

function lerpPreset(a: CampSkyPreset, b: CampSkyPreset, t: number): CampSkyPreset {
  const sunPosition = a.sunPosition.clone().lerp(b.sunPosition, t);
  const lightPosition = a.lightPosition.clone().lerp(b.lightPosition, t);
  return {
    sunPosition,
    lightPosition,
    sunColor: a.sunColor.clone().lerp(b.sunColor, t),
    sunIntensity: THREE.MathUtils.lerp(a.sunIntensity, b.sunIntensity, t),
    hemiSky: a.hemiSky.clone().lerp(b.hemiSky, t),
    hemiGround: a.hemiGround.clone().lerp(b.hemiGround, t),
    hemiIntensity: THREE.MathUtils.lerp(a.hemiIntensity, b.hemiIntensity, t),
    turbidity: THREE.MathUtils.lerp(a.turbidity, b.turbidity, t),
    rayleigh: THREE.MathUtils.lerp(a.rayleigh, b.rayleigh, t),
    fogColor: a.fogColor.clone().lerp(b.fogColor, t),
    fogDensity: THREE.MathUtils.lerp(a.fogDensity, b.fogDensity, t),
    exposure: THREE.MathUtils.lerp(a.exposure, b.exposure, t),
  };
}

function sampleCycle(phase: number): CampSkyPreset {
  const n = CYCLE_KEYS.length;
  const scaled = ((phase % 1) + 1) % 1 * n;
  const idx = Math.floor(scaled) % n;
  const next = (idx + 1) % n;
  const t = scaled - idx;
  return lerpPreset(PRESETS[CYCLE_KEYS[idx] as CycleKey], PRESETS[CYCLE_KEYS[next] as CycleKey], t);
}

export interface CampSkyHandle {
  /** 0–1 over the full dawn→noon→sunset→night loop; 0.75+ reads as night. */
  readonly phase: number;
  update(elapsed: number, followTarget?: THREE.Vector3): void;
  dispose(): void;
}

export interface CampSkyOptions {
  /** Seconds for one full day/night loop (default 180). */
  cycleSeconds?: number;
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
}

/**
 * Procedural sky dome (Three.js Sky shader) with animated day/night lighting,
 * fog, and exposure — ported from the vfx-sandbox time-of-day presets.
 */
export function createCampSky(opts: CampSkyOptions): CampSkyHandle {
  const { scene, renderer } = opts;
  const cycleSeconds = opts.cycleSeconds ?? 180;

  const sky = new Sky();
  sky.scale.setScalar(450000);
  scene.add(sky);

  const hemi = new THREE.HemisphereLight(0xbcd4ff, 0x2f2c26, 0.7);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff6ea, 2.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004;
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 90;
  const shadowSpan = 42;
  sun.shadow.camera.left = -shadowSpan;
  sun.shadow.camera.right = shadowSpan;
  sun.shadow.camera.top = shadowSpan;
  sun.shadow.camera.bottom = -shadowSpan;
  scene.add(sun);
  scene.add(sun.target);

  scene.background = null;
  if (!scene.fog) scene.fog = new THREE.FogExp2(0x8eb8e8, 0.006);

  const uniforms = sky.material.uniforms;
  let phase = 0;

  const apply = (p: CampSkyPreset, follow?: THREE.Vector3) => {
    uniforms["sunPosition"].value.copy(p.sunPosition);
    uniforms["turbidity"].value = p.turbidity;
    uniforms["rayleigh"].value = p.rayleigh;
    uniforms["mieCoefficient"].value = 0.005;
    uniforms["mieDirectionalG"].value = 0.8;

    sun.color.copy(p.sunColor);
    sun.intensity = p.sunIntensity;
    sun.position.copy(p.lightPosition);
    if (follow) {
      sun.target.position.set(follow.x, 0, follow.z);
      sun.target.updateMatrixWorld();
    }

    hemi.color.copy(p.hemiSky);
    hemi.groundColor.copy(p.hemiGround);
    hemi.intensity = p.hemiIntensity;

    const fog = scene.fog as THREE.FogExp2;
    fog.color.copy(p.fogColor);
    fog.density = p.fogDensity;
    renderer.toneMappingExposure = p.exposure;
  };

  apply(sampleCycle(0.25));

  return {
    get phase() {
      return phase;
    },
    update(elapsed: number, followTarget?: THREE.Vector3) {
      phase = (elapsed % cycleSeconds) / cycleSeconds;
      apply(sampleCycle(phase), followTarget);
    },
    dispose() {
      scene.remove(sky);
      sky.geometry.dispose();
      sky.material.dispose();
      scene.remove(hemi);
      scene.remove(sun);
      scene.remove(sun.target);
    },
  };
}