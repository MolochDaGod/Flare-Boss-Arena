import * as THREE from "three";
import type { ShapeQuery } from "./damageShapes";

/**
 * Native-shader ground telegraphs: a flat plane per cast with a custom GLSL
 * fragment shader that masks the exact hit shape (circle / nova / cone / line),
 * draws a bright edge + a forward/radial fill sweep, and fades in/out. The plane
 * stays world-axis-aligned (lying flat); the forward direction is passed as a
 * uniform, so no rotation bookkeeping is needed and cone/line orient correctly.
 */

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform float uSize;       // world span of the plane (== 2 * reach)
uniform vec2  uDir;        // normalized world forward (x, z)
uniform int   uKind;       // 0 circle, 1 nova, 2 cone, 3 line
uniform float uRadius;
uniform float uHalfAngle;
uniform float uLength;
uniform float uHalfWidth;
uniform vec3  uColor;
uniform float uProgress;   // 0..1 fill sweep
uniform float uAlpha;      // overall fade

void main() {
  // Plane is rotated flat (rotation.x = -PI/2): local +x -> world +x,
  // local +y(uv.y) -> world -z. Reconstruct the world-space offset (x, z).
  vec2 c = (vUv - 0.5) * uSize;
  vec2 o = vec2(c.x, -c.y);
  float fwd  = dot(o, uDir);
  float side = o.x * uDir.y - o.y * uDir.x; // perpendicular (uDir is unit)
  float dist = length(o);

  float inside = 0.0;
  float edge = 0.0;

  if (uKind == 0 || uKind == 1) {
    inside = step(dist, uRadius);
    edge = smoothstep(uRadius - 0.2, uRadius, dist) * step(dist, uRadius + 0.03);
  } else if (uKind == 2) {
    float ang = acos(clamp(fwd / max(dist, 1e-4), -1.0, 1.0));
    float inAng = step(ang, uHalfAngle);
    inside = inAng * step(dist, uRadius) * step(0.0, fwd);
    edge = inside * (smoothstep(uRadius - 0.25, uRadius, dist)
                   + smoothstep(uHalfAngle - 0.07, uHalfAngle, ang));
  } else {
    float inLen = step(0.0, fwd) * step(fwd, uLength);
    float inW = step(abs(side), uHalfWidth);
    inside = inLen * inW;
    edge = inside * (smoothstep(uHalfWidth - 0.14, uHalfWidth, abs(side))
                   + smoothstep(uLength - 0.25, uLength, fwd));
  }

  float sweep = (uKind == 3)
    ? step(fwd, uProgress * uLength)
    : step(dist, uProgress * uRadius);
  float fill = inside * (0.16 + 0.24 * sweep);
  float a = max(fill, clamp(edge, 0.0, 1.0) * 0.95) * uAlpha;
  if (a < 0.01) discard;
  gl_FragColor = vec4(uColor, a);
}
`;

function kindToInt(kind: ShapeQuery["kind"]): number {
  switch (kind) {
    case "circle": return 0;
    case "nova": return 1;
    case "cone": return 2;
    case "line": return 3;
  }
}

interface Tele {
  mesh: THREE.Mesh;
  mat: THREE.ShaderMaterial;
  age: number;
  dur: number;
}

export class TelegraphField {
  private scene: THREE.Scene;
  private geo: THREE.PlaneGeometry;
  private active: Tele[] = [];
  private disposed = false;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.geo = new THREE.PlaneGeometry(1, 1);
  }

  show(q: ShapeQuery, duration: number, color: number) {
    if (this.disposed) return;
    const reach = q.kind === "line" ? q.length ?? 8 : q.radius ?? 5;
    const size = 2 * (reach + 0.6);
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uSize: { value: size },
        uDir: { value: new THREE.Vector2(q.dir.x, q.dir.z).normalize() },
        uKind: { value: kindToInt(q.kind) },
        uRadius: { value: q.radius ?? reach },
        uHalfAngle: { value: q.halfAngle ?? Math.PI / 4 },
        uLength: { value: q.length ?? reach },
        uHalfWidth: { value: q.halfWidth ?? 1.2 },
        uColor: { value: new THREE.Color(color) },
        uProgress: { value: 0 },
        uAlpha: { value: 0 },
      },
    });
    const mesh = new THREE.Mesh(this.geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(q.origin.x, 0.06, q.origin.z);
    mesh.scale.set(size, size, 1);
    mesh.renderOrder = 3;
    this.scene.add(mesh);
    this.active.push({ mesh, mat, age: 0, dur: Math.max(0.12, duration) });
  }

  update(delta: number) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const t = this.active[i];
      t.age += delta;
      const p = Math.min(1, t.age / t.dur);
      t.mat.uniforms.uProgress.value = p;
      t.mat.uniforms.uAlpha.value = p < 0.8 ? Math.min(1, p / 0.15) : 1 - (p - 0.8) / 0.2;
      if (t.age >= t.dur) {
        this.scene.remove(t.mesh);
        t.mat.dispose();
        this.active.splice(i, 1);
      }
    }
  }

  dispose() {
    this.disposed = true;
    for (const t of this.active) {
      this.scene.remove(t.mesh);
      t.mat.dispose();
    }
    this.active = [];
    this.geo.dispose();
  }
}
