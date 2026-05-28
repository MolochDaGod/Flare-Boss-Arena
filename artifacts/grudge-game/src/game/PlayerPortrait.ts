import * as THREE from "three";
import { loadFBX, findHandBone, attachWeaponToBone, normaliseHeight, TOON_CHAR_PATHS, TOON_WEAPON_PATHS } from "./assets";

function disposeObject3D(root: THREE.Object3D) {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    for (const mat of mats) {
      const std = mat as THREE.MeshStandardMaterial | undefined;
      if (!std) continue;
      std.map?.dispose?.();
      std.normalMap?.dispose?.();
      std.roughnessMap?.dispose?.();
      std.metalnessMap?.dispose?.();
      std.emissiveMap?.dispose?.();
      std.dispose?.();
    }
  });
}

export interface PortraitOptions {
  charClass: string;
  weaponType?: string | null;
  factionColor?: string;
}

/**
 * Self-camera 3D character preview.
 * Renders the player's Toon character + equipped weapon into a small canvas,
 * with a slow turntable rotation. Used inside MainPanel.
 */
export class PlayerPortrait {
  private container!: HTMLDivElement;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private rig: THREE.Group | null = null;
  private weaponMount: THREE.Object3D | null = null;
  private mixer: THREE.AnimationMixer | null = null;
  private clock = new THREE.Clock();
  private rafId = 0;
  private disposed = false;
  private opts: PortraitOptions;
  private weaponReqId = 0;

  constructor(opts: PortraitOptions) {
    this.opts = opts;
  }

  async mount(container: HTMLDivElement) {
    if (this.disposed) return;
    this.container = container;
    const w = container.clientWidth || 320;
    const h = container.clientHeight || 420;

    this.scene = new THREE.Scene();
    this.scene.background = null;

    this.camera = new THREE.PerspectiveCamera(28, w / h, 0.1, 50);
    this.camera.position.set(0, 1.6, 4.2);
    this.camera.lookAt(0, 1.1, 0);

    try {
      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      this.renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
    }
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = false;
    container.appendChild(this.renderer.domElement);

    // Dramatic lighting
    const accent = new THREE.Color(this.opts.factionColor ?? "#ffaa44");
    this.scene.add(new THREE.AmbientLight(0x202028, 1.2));
    const key = new THREE.DirectionalLight(accent, 2.6);
    key.position.set(2.5, 4, 3.5);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x6688ff, 1.2);
    rim.position.set(-3, 2, -2);
    this.scene.add(rim);
    const fill = new THREE.PointLight(0xffd49a, 1.5, 12);
    fill.position.set(0, 1.5, 4);
    this.scene.add(fill);

    // Pedestal disc
    const disc = new THREE.Mesh(
      new THREE.CylinderGeometry(1.0, 1.1, 0.08, 32),
      new THREE.MeshStandardMaterial({ color: 0x141016, roughness: 0.6, metalness: 0.7 })
    );
    disc.position.y = 0.04;
    this.scene.add(disc);
    const glow = new THREE.Mesh(
      new THREE.RingGeometry(1.05, 1.25, 48),
      new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false }),
    );
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.085;
    this.scene.add(glow);

    if (this.disposed) return;
    window.addEventListener("resize", this.onResize);
    this.animate();
    void this.loadCharacter();
  }

  private async loadCharacter() {
    const clazz = this.opts.charClass?.toLowerCase() ?? "warrior";
    const path = TOON_CHAR_PATHS[clazz] ?? TOON_CHAR_PATHS.warrior;
    try {
      const fbx = await loadFBX(path);
      if (this.disposed) return;
      this.rig = fbx;
      normaliseHeight(fbx, 2.0);
      // Centre laterally
      const box = new THREE.Box3().setFromObject(fbx);
      const c = new THREE.Vector3(); box.getCenter(c);
      fbx.position.x -= c.x;
      fbx.position.z -= c.z;
      // Tint by faction
      const tint = new THREE.Color(this.opts.factionColor ?? "#c9873b");
      fbx.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          const mats = Array.isArray(m.material) ? m.material : [m.material];
          for (const raw of mats) {
            const mat = raw as THREE.MeshStandardMaterial;
            if (mat && (mat as THREE.Material).type) {
              const std = new THREE.MeshStandardMaterial({
                color: tint.clone().multiplyScalar(0.85),
                roughness: 0.7, metalness: 0.25,
              });
              if (Array.isArray(m.material)) {
                const idx = (m.material as THREE.Material[]).indexOf(raw);
                (m.material as THREE.Material[])[idx] = std;
              } else {
                m.material = std;
              }
            }
          }
        }
      });
      this.scene.add(fbx);

      // Idle "breathing" animation if any clips present
      if (fbx.animations && fbx.animations.length > 0) {
        this.mixer = new THREE.AnimationMixer(fbx);
        this.mixer.clipAction(fbx.animations[0]).play();
      }

      if (this.disposed) return;
      await this.applyWeapon(this.opts.weaponType ?? null);
    } catch {
      // Fallback: simple silhouette
      const fb = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.4, 1.2, 4, 12),
        new THREE.MeshStandardMaterial({ color: this.opts.factionColor ?? "#c9873b", roughness: 0.5 }),
      );
      fb.position.y = 1.1;
      this.scene.add(fb);
      this.rig = new THREE.Group(); this.rig.add(fb);
    }
  }

  async setWeapon(weaponType: string | null) {
    this.opts.weaponType = weaponType;
    await this.applyWeapon(weaponType);
  }

  private async applyWeapon(weaponType: string | null) {
    if (this.disposed) return;
    const myReq = ++this.weaponReqId;
    this.detachCurrentWeapon();
    if (!this.rig || !weaponType) return;
    const path = TOON_WEAPON_PATHS[weaponType];
    if (!path) return;
    const bone = findHandBone(this.rig, true);
    try {
      const wpn = await loadFBX(path);
      // Stale request? Another weapon was requested after us — drop this load.
      if (this.disposed || !this.rig || myReq !== this.weaponReqId) {
        disposeObject3D(wpn);
        return;
      }
      // Normalise weapon scale relative to character scale
      const box = new THREE.Box3().setFromObject(wpn);
      const sz = new THREE.Vector3(); box.getSize(sz);
      const maxDim = Math.max(sz.x, sz.y, sz.z);
      const wScale = (maxDim > 0 ? 1.1 / maxDim : 1) * 100; // FBX export is often cm
      if (bone) {
        attachWeaponToBone(wpn, bone, {
          scale: wScale,
          offset: new THREE.Vector3(0, 0, 0),
        });
        this.weaponMount = wpn.parent;
      } else {
        // No bone found — float it next to the rig as a visual hint
        wpn.scale.setScalar(0.01);
        wpn.position.set(0.7, 1.2, 0);
        this.rig.add(wpn);
        this.weaponMount = wpn;
      }
    } catch {
      /* ignore weapon load failures */
    }
  }

  private detachCurrentWeapon() {
    if (!this.weaponMount) return;
    this.weaponMount.parent?.remove(this.weaponMount);
    disposeObject3D(this.weaponMount);
    this.weaponMount = null;
  }

  private animate = () => {
    if (this.disposed) return;
    this.rafId = requestAnimationFrame(this.animate);
    const dt = Math.min(this.clock.getDelta(), 0.05);
    if (this.rig) this.rig.rotation.y += dt * 0.35;
    if (this.mixer) this.mixer.update(dt);
    this.renderer.render(this.scene, this.camera);
  };

  private onResize = () => {
    if (!this.container) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.rafId);
    window.removeEventListener("resize", this.onResize);
    if (this.renderer) {
      this.renderer.dispose();
      if (this.renderer.domElement.parentNode === this.container) {
        this.container.removeChild(this.renderer.domElement);
      }
    }
    this.scene?.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mat of mats) (mat as THREE.Material | undefined)?.dispose?.();
    });
  }
}
