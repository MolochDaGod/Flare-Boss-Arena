/**
 * Canonical Three.js character/asset placement for Flare Boss Arena.
 *
 * Best practices (threejs-game skill + annihilate Level/Box discipline):
 *  1. Measure → uniform scale to target height
 *  2. Re-measure after scale (nested pivots lie in pre-scale boxes)
 *  3. Recenter XZ on the wrapper origin; drop feet to y = 0
 *  4. castShadow / receiveShadow; SkinnedMesh frustumCulled = false
 *  5. Optionally zero horizontal root-bone bind so idle clips don't drift
 *     the mesh off the logical position (root motion is applied elsewhere)
 *
 * Always use `.isMesh` / `.isSkinnedMesh` / `.isBone` flags — never `instanceof`
 * (multiple Three.js copies break instanceof).
 */
import * as THREE from "three";

const ROOT_BONE_RE = [
  /^hips$/i,
  /^hip$/i,
  /^pelvis$/i,
  /^bip001[_\s-]?pelvis/i,
  /^mixamorig:?hips$/i,
  /^root$/i,
  /^body_pelvis/i,
];

export interface NormalizeResult {
  /** Actual world height after normalize (≈ targetHeight). */
  height: number;
  /** Materials collected for hurt-flash. */
  bodyMats: THREE.MeshStandardMaterial[];
  originalColors: number[];
  /** Root/hips bone if found (for root-motion / drift fix). */
  rootBone: THREE.Object3D | null;
}

export interface NormalizeOpts {
  targetHeight: number;
  /** When true (default), pin hips XZ to bind so looping clips don't slide. */
  pinRootHorizontal?: boolean;
  castShadow?: boolean;
  receiveShadow?: boolean;
}

/**
 * Normalize a loaded character/prop under `root` so feet sit at y=0 and the
 * body is centred on the local origin. Mutates `root` in place.
 */
export function normalizeCharacterRoot(
  root: THREE.Object3D,
  opts: NormalizeOpts,
): NormalizeResult {
  const pinRoot = opts.pinRootHorizontal !== false;
  const castShadow = opts.castShadow !== false;
  const receiveShadow = opts.receiveShadow !== false;

  root.updateWorldMatrix(true, true);
  const box0 = new THREE.Box3().setFromObject(root);
  const size0 = new THREE.Vector3();
  box0.getSize(size0);
  const h0 = Math.max(size0.y, 0.001);
  const scale = opts.targetHeight / h0;
  root.scale.multiplyScalar(scale);

  // Re-box after scale — accurate feet / center for nested armatures.
  root.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(root);
  const center = new THREE.Vector3();
  const size = new THREE.Vector3();
  box.getCenter(center);
  box.getSize(size);

  root.position.x -= center.x;
  root.position.z -= center.z;
  root.position.y -= box.min.y;

  const bodyMats: THREE.MeshStandardMaterial[] = [];
  const originalColors: number[] = [];
  const found: { bone: THREE.Object3D | null } = { bone: null };

  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.castShadow = castShadow;
      mesh.receiveShadow = receiveShadow;
      if ((mesh as THREE.SkinnedMesh).isSkinnedMesh) {
        mesh.frustumCulled = false;
      }
      const mats = Array.isArray(mesh.material)
        ? mesh.material
        : mesh.material
          ? [mesh.material]
          : [];
      for (const m of mats) {
        if (m && (m as THREE.MeshStandardMaterial).color) {
          const sm = m as THREE.MeshStandardMaterial;
          bodyMats.push(sm);
          originalColors.push(sm.color.getHex());
        }
      }
    }
    if (
      !found.bone &&
      (child as THREE.Bone).isBone &&
      ROOT_BONE_RE.some((re) => re.test(child.name))
    ) {
      found.bone = child;
    }
  });

  const hips = found.bone;
  if (pinRoot && hips) {
    // Store bind so animators can restore; zero XZ drift on bind pose.
    hips.userData.bindPos = hips.position.clone();
    hips.position.x = 0;
    hips.position.z = 0;
    hips.userData.pinRootHorizontal = true;
  }

  root.updateWorldMatrix(true, true);
  const finalBox = new THREE.Box3().setFromObject(root);
  const finalSize = new THREE.Vector3();
  finalBox.getSize(finalSize);

  return {
    height: finalSize.y || opts.targetHeight,
    bodyMats,
    originalColors,
    rootBone: hips,
  };
}

/**
 * Classify animation clips by name into idle / walk / attack / hit / death.
 * Patterns shared with `data/enemyAnimLibrary` so Quaternius packs
 * (Idle / Walk / Bite_Front / HitReact / Death) and Mixamo names all resolve.
 */
export function classifyClips(clips: THREE.AnimationClip[]): {
  idle?: THREE.AnimationClip;
  walk?: THREE.AnimationClip;
  attack?: THREE.AnimationClip;
  hit?: THREE.AnimationClip;
  death?: THREE.AnimationClip;
  all: THREE.AnimationClip[];
} {
  const by = (patterns: RegExp[]) => {
    for (const re of patterns) {
      const hit = clips.find((c) => re.test(c.name));
      if (hit) return hit;
    }
    return undefined;
  };
  return {
    idle:
      by([/^idle$/i, /idle|stand|standing|breath|wait|rest|fight_idle|combat_idle/i]) ??
      clips[0],
    // Prefer walk over run for locomotion; run is still a valid walk fallback.
    walk:
      by([/walk|walking|trot|locom/i, /run|running|sprint|jog|gallop|fly/i, /move(?!ment)/i]),
    attack: by([
      /attack|strike|slash|punch|swing|bite|cast|shoot|combo|melee|combat|headbutt|slap|claw|sting|spit/i,
    ]),
    hit: by([/hit|hurt|damage|react|flinch|impact|gethit|get_hit/i]),
    death: by([/death|die|dead|collapse|defeat/i]),
    all: clips,
  };
}

/**
 * Lightweight multi-clip bank for GLB enemies that ship idle/walk/attack tracks.
 * Cross-fades like KayKit / PlayerAnimator (fadeOut → reset fadeIn play).
 */
export class GlbClipBank {
  private mixer: THREE.AnimationMixer;
  private idle?: THREE.AnimationAction;
  private walk?: THREE.AnimationAction;
  private attack?: THREE.AnimationAction;
  private hit?: THREE.AnimationAction;
  private death?: THREE.AnimationAction;
  private current?: THREE.AnimationAction;
  private oneShot?: THREE.AnimationAction;
  private wantMoving = false;
  private dead = false;
  private onFinished: (e: { action: THREE.AnimationAction }) => void;

  constructor(
    root: THREE.Object3D,
    clips: THREE.AnimationClip[],
    preferredAttack?: string | null,
    preferredIdle?: string | null,
  ) {
    this.mixer = new THREE.AnimationMixer(root);
    const classified = classifyClips(clips);
    if (preferredIdle) {
      const hit = clips.find(
        (c) => c.name === preferredIdle || c.name.toLowerCase().includes(preferredIdle.toLowerCase()),
      );
      if (hit) classified.idle = hit;
    }
    if (preferredAttack) {
      const hit = clips.find(
        (c) => c.name === preferredAttack || c.name.toLowerCase().includes(preferredAttack.toLowerCase()),
      );
      if (hit) classified.attack = hit;
    }
    const mk = (c?: THREE.AnimationClip) => (c ? this.mixer.clipAction(c) : undefined);
    this.idle = mk(classified.idle);
    this.walk = mk(classified.walk);
    this.attack = mk(classified.attack);
    this.hit = mk(classified.hit);
    this.death = mk(classified.death);

    this.onFinished = (e) => {
      if (this.dead) return;
      if (this.oneShot && e.action === this.oneShot) {
        this.oneShot = undefined;
        this.crossfade(this.wantMoving ? this.walk ?? this.idle : this.idle, 0.12);
      }
    };
    this.mixer.addEventListener(
      "finished",
      this.onFinished as unknown as THREE.EventListener<object, "finished", THREE.AnimationMixer>,
    );

    if (this.idle) {
      this.idle.setLoop(THREE.LoopRepeat, Infinity);
      this.idle.play();
      this.current = this.idle;
    } else if (this.walk) {
      this.walk.setLoop(THREE.LoopRepeat, Infinity);
      this.walk.play();
      this.current = this.walk;
    }
  }

  private crossfade(next: THREE.AnimationAction | undefined, fade = 0.18) {
    if (!next || next === this.current) return;
    next.enabled = true;
    next.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).play();
    if (this.current) this.current.crossFadeTo(next, fade, false);
    this.current = next;
  }

  private playOnce(action: THREE.AnimationAction | undefined) {
    if (this.dead || !action || this.oneShot) return;
    action.reset();
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = false;
    this.crossfade(action, 0.08);
    this.oneShot = action;
  }

  update(delta: number) {
    this.mixer.update(delta);
  }

  setMoving(moving: boolean) {
    this.wantMoving = moving;
    if (this.dead || this.oneShot) return;
    if (moving && this.walk) this.crossfade(this.walk, 0.15);
    else if (this.idle) this.crossfade(this.idle, 0.15);
  }

  playAttack() {
    this.playOnce(this.attack);
  }

  playHit() {
    this.playOnce(this.hit);
  }

  playDeath() {
    if (this.dead) return;
    this.dead = true;
    this.oneShot = undefined;
    const a = this.death;
    if (a) {
      a.reset();
      a.setLoop(THREE.LoopOnce, 1);
      a.clampWhenFinished = true;
      this.crossfade(a, 0.12);
    }
  }

  dispose() {
    this.mixer.removeEventListener(
      "finished",
      this.onFinished as unknown as THREE.EventListener<object, "finished", THREE.AnimationMixer>,
    );
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.mixer.getRoot());
  }
}
