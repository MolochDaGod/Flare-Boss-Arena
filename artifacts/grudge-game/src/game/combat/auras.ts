import * as THREE from "three";
import { elementColor, type SkillElement } from "./particles";

/**
 * Lightweight ground auras — ring meshes that pulse under a unit.
 * Designed for lag-free use: shared materials per element, InstancedMesh-ready
 * geometry, no particles unless callers opt in.
 */

interface AuraHandle {
  mesh: THREE.Mesh;
  element: SkillElement;
  baseScale: number;
  age: number;
  life: number;
  /** Follow this object each frame (player / enemy group). */
  follow: THREE.Object3D | null;
  yOffset: number;
}

export class AuraField {
  private scene: THREE.Scene;
  private auras: AuraHandle[] = [];
  private ringGeo: THREE.RingGeometry;
  private matCache = new Map<number, THREE.MeshBasicMaterial>();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.ringGeo = new THREE.RingGeometry(0.55, 0.85, 40);
  }

  private mat(hex: number): THREE.MeshBasicMaterial {
    let m = this.matCache.get(hex);
    if (!m) {
      m = new THREE.MeshBasicMaterial({
        color: hex,
        transparent: true,
        opacity: 0.42,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      this.matCache.set(hex, m);
    }
    return m;
  }

  /**
   * Attach a looping aura under `follow` (or free-standing at `origin`).
   * `life <= 0` means permanent until clear/dispose.
   */
  attach(
    element: SkillElement,
    opts: {
      follow?: THREE.Object3D | null;
      origin?: THREE.Vector3;
      radius?: number;
      life?: number;
      yOffset?: number;
    } = {},
  ): AuraHandle {
    const hex = elementColor(element);
    const mesh = new THREE.Mesh(this.ringGeo, this.mat(hex).clone());
    (mesh.material as THREE.MeshBasicMaterial).opacity = 0.4;
    mesh.rotation.x = -Math.PI / 2;
    mesh.renderOrder = 2;
    const radius = opts.radius ?? 1.2;
    mesh.scale.setScalar(radius);
    const origin = opts.origin ?? opts.follow?.position ?? new THREE.Vector3();
    mesh.position.set(origin.x, opts.yOffset ?? 0.08, origin.z);
    this.scene.add(mesh);
    const h: AuraHandle = {
      mesh,
      element,
      baseScale: radius,
      age: 0,
      life: opts.life ?? 0,
      follow: opts.follow ?? null,
      yOffset: opts.yOffset ?? 0.08,
    };
    this.auras.push(h);
    return h;
  }

  /** One-shot expanding pulse (skill cast / phase change). */
  pulse(element: SkillElement, center: THREE.Vector3, radius = 2.5, life = 0.55) {
    const h = this.attach(element, { origin: center, radius: radius * 0.4, life, yOffset: 0.1 });
    h.baseScale = radius;
  }

  update(delta: number) {
    for (let i = this.auras.length - 1; i >= 0; i--) {
      const a = this.auras[i]!;
      a.age += delta;
      if (a.follow) {
        a.mesh.position.x = a.follow.position.x;
        a.mesh.position.z = a.follow.position.z;
        a.mesh.position.y = (a.follow.position.y || 0) + a.yOffset;
      }
      const mat = a.mesh.material as THREE.MeshBasicMaterial;
      if (a.life > 0) {
        const u = a.age / a.life;
        a.mesh.scale.setScalar(a.baseScale * (0.45 + u * 0.9));
        mat.opacity = 0.5 * (1 - u);
        if (a.age >= a.life) {
          this.scene.remove(a.mesh);
          mat.dispose();
          this.auras.splice(i, 1);
        }
      } else {
        // Idle pulse
        const s = a.baseScale * (1 + Math.sin(a.age * 4.2) * 0.08);
        a.mesh.scale.setScalar(s);
        mat.opacity = 0.28 + Math.sin(a.age * 3.1) * 0.1;
      }
    }
  }

  clear() {
    for (const a of this.auras) {
      this.scene.remove(a.mesh);
      (a.mesh.material as THREE.Material).dispose();
    }
    this.auras = [];
  }

  dispose() {
    this.clear();
    this.ringGeo.dispose();
    for (const m of this.matCache.values()) m.dispose();
    this.matCache.clear();
  }
}
