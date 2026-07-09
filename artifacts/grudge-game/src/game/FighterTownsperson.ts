import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RACALVIN_ID } from "../data/fighters";
import { getSkin, skinUrl } from "../data/skins";
import { buildSkinAnim, PlayerAnimator } from "./PlayerAnimator";
import { HeroAnimator, disposeObject3D } from "./kaykitHero";
import { loadRacalvinBase, loadRacalvinClips } from "./racalvinHero";

export interface FighterNpcOptions {
  skinId: string;
  home: THREE.Vector3;
  height?: number;
  wanderRadius?: number;
  speed?: number;
  faceY?: number;
}

type NpcAnim = { setMoving(m: boolean): void; update(d: number): void; dispose(): void };

/**
 * Ambient champion NPC using real fighter skin GLBs (or Racalvin).
 * Wanders near a home anchor — never targetable in the training yard.
 */
export class FighterTownsperson {
  readonly group = new THREE.Group();
  private anim: NpcAnim | null = null;
  private disposed = false;

  private home: THREE.Vector3;
  private wanderRadius: number;
  private speed: number;
  private target: THREE.Vector3;
  private pauseT: number;

  constructor(loader: GLTFLoader, opts: FighterNpcOptions) {
    this.home = opts.home.clone();
    this.wanderRadius = opts.wanderRadius ?? 5;
    this.speed = opts.speed ?? 1.05;
    this.target = this.home.clone();
    this.pauseT = 0.5 + Math.random() * 2;
    this.group.position.copy(this.home);
    this.group.rotation.y = opts.faceY ?? Math.random() * Math.PI * 2;

    const height = opts.height ?? 2.05;
    if (opts.skinId === RACALVIN_ID) {
      this.loadRacalvin(loader, height);
    } else {
      this.loadSkin(loader, opts.skinId, height);
    }
  }

  private fitToHeight(root: THREE.Object3D, height: number): THREE.Group {
    const wrapper = new THREE.Group();
    root.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(root);
    const size = new THREE.Vector3();
    box.getSize(size);
    if (size.y > 0.001) root.scale.setScalar(height / size.y);
    root.updateWorldMatrix(true, true);
    const box2 = new THREE.Box3().setFromObject(root);
    const center = new THREE.Vector3();
    box2.getCenter(center);
    root.position.x -= center.x;
    root.position.z -= center.z;
    root.position.y -= box2.min.y;
    wrapper.add(root);
    return wrapper;
  }

  private loadSkin(loader: GLTFLoader, skinId: string, height: number) {
    const skin = getSkin(skinId);
    if (!skin) return;
    loader.load(
      skinUrl(skin),
      (gltf) => {
        if (this.disposed) {
          disposeObject3D(gltf.scene);
          return;
        }
        const model = gltf.scene;
        model.traverse((c) => {
          const m = c as THREE.Mesh & { isSkinnedMesh?: boolean };
          if (m.isMesh) {
            m.castShadow = true;
            m.receiveShadow = true;
            if (m.isSkinnedMesh) m.frustumCulled = false;
          }
        });
        const wrapper = this.fitToHeight(model, height);
        this.group.add(wrapper);
        const { actions, pool } = buildSkinAnim(gltf.animations, skin.scheme);
        const pa = new PlayerAnimator(model, actions, pool);
        this.anim = {
          setMoving: (m) => pa.setMoving(m),
          update: (d) => pa.update(d),
          dispose: () => pa.dispose(),
        };
      },
      undefined,
      () => {},
    );
  }

  private loadRacalvin(loader: GLTFLoader, height: number) {
    loadRacalvinBase(
      loader,
      height,
      (wrapper, root, baseClips, _weapons) => {
        if (this.disposed) {
          disposeObject3D(wrapper);
          return;
        }
        this.group.add(wrapper);
        const hero = new HeroAnimator(root, baseClips);
        loadRacalvinClips(loader).then((clips) => {
          if (this.disposed) return;
          hero.addLibraryClips(clips);
        });
        this.anim = {
          setMoving: (m) => hero.setMoving(m),
          update: (d) => hero.update(d),
          dispose: () => hero.dispose(),
        };
      },
      () => {},
    );
  }

  update(delta: number) {
    if (this.disposed) return;
    const pos = this.group.position;
    let moving = false;

    if (this.pauseT > 0) {
      this.pauseT -= delta;
    } else {
      const dx = this.target.x - pos.x;
      const dz = this.target.z - pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 0.25) {
        const inv = 1 / dist;
        pos.x += dx * inv * this.speed * delta;
        pos.z += dz * inv * this.speed * delta;
        this.group.rotation.y = Math.atan2(dx, dz);
        moving = true;
      } else {
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * this.wanderRadius;
        this.target.set(this.home.x + Math.cos(a) * r, this.home.y, this.home.z + Math.sin(a) * r);
        this.pauseT = 2 + Math.random() * 4;
      }
    }

    this.anim?.setMoving(moving);
    this.anim?.update(delta);
  }

  dispose() {
    this.disposed = true;
    this.group.userData.disposed = true;
    this.anim?.dispose();
    disposeObject3D(this.group);
  }
}