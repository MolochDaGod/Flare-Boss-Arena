import * as THREE from "three";

const ZONE_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const ZONE_FRAGMENT = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uRing;

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    float r = length(p);
    float ang = atan(p.y, p.x);
    float warp = noise(p * 3.0 + vec2(uTime * 0.5, -uTime * 0.4)) * 0.18;
    float rr = r + warp;
    if (rr > 1.0) discard;
    float shimmer = noise(p * 5.0 + vec2(-uTime * 0.7, uTime * 0.5));
    float swirl = 0.5 + 0.5 * sin(ang * 6.0 + uTime * 3.0 - rr * 7.0);
    float ringBand = smoothstep(0.45, 0.82, rr) * (1.0 - smoothstep(0.82, 1.0, rr));
    float fill = 1.0 - rr;
    float base = mix(fill, ringBand, uRing);
    float a = base * (0.45 + 0.7 * shimmer) * (0.7 + 0.5 * swirl);
    vec3 c = uColor * (0.7 + 1.1 * base + 0.7 * shimmer);
    gl_FragColor = vec4(c, clamp(a, 0.0, 1.0) * uOpacity);
  }
`;

export function createHotZoneMaterial(color: THREE.ColorRepresentation, ring = false, opacity = 0.55): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: Math.random() * 10 },
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: opacity },
      uRing: { value: ring ? 1 : 0 },
    },
    vertexShader: ZONE_VERTEX,
    fragmentShader: ZONE_FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
}