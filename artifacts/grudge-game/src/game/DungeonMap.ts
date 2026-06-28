/**
 * DungeonMap — turns the `forge-scene.glb` Synty asset pack into the REAL,
 * walkable dungeon instead of a decorative landmark sitting on a flat plane.
 *
 * On load the GLB is scaled UP to fill the arena, recentered on XZ, and dropped
 * so its floor sits at y≈0. We then bake every static mesh into ONE world-space
 * geometry and build a `MeshBVH` over it. That single accelerated structure
 * powers three things the engine needs:
 *
 *   • `floorPickFromRay` — click-to-move picks land on the actual map floor.
 *   • `sampleFloorY`      — actors follow real floor height each frame.
 *   • `collideHorizontal` — a capsule slides along the map's walls (no clipping).
 *
 * Everything degrades gracefully: until `ready` is true (or if the GLB fails to
 * load) the engine falls back to its flat-plane behaviour. Mesh detection uses
 * the `.isMesh`/`.isSkinnedMesh` flags (NOT `instanceof`) because the app loads
 * multiple Three.js instances.
 */
import * as THREE from "three";
import type { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { MeshBVH, type ExtendedTriangle } from "three-mesh-bvh";

export interface DungeonMapOptions {
  /** Longest XZ dimension (world units) the map is scaled to fill. */
  targetExtent?: number;
}

export class DungeonMap {
  /** Visible map root (added to the scene once loaded). */
  readonly group = new THREE.Group();
  /** True once the GLB is loaded AND its collision BVH is built. */
  ready = false;
  /** XZ play bounds (Box2: x → world X, y → world Z). */
  readonly bounds = new THREE.Box2();

  private bvh: MeshBVH | null = null;
  private colliderGeo: THREE.BufferGeometry | null = null;
  private disposed = false;
  private readonly targetExtent: number;

  // Scratch — reused every frame to avoid per-frame allocations.
  private readonly _seg = new THREE.Line3();
  private readonly _box = new THREE.Box3();
  private readonly _triPt = new THREE.Vector3();
  private readonly _capPt = new THREE.Vector3();
  private readonly _dir = new THREE.Vector3();
  private readonly _down = new THREE.Ray(new THREE.Vector3(), new THREE.Vector3(0, -1, 0));

  constructor(opts: DungeonMapOptions = {}) {
    this.targetExtent = opts.targetExtent ?? 120;
  }

  /**
   * Load + normalize the dungeon GLB and build its collision BVH. `onReady` is
   * always invoked exactly once (success OR failure) so a loading veil can clear.
   */
  load(loader: GLTFLoader, scene: THREE.Scene, url: string, onReady?: () => void) {
    loader.load(
      url,
      (gltf) => {
        if (this.disposed) {
          this.disposeObject(gltf.scene);
          return;
        }
        const root = gltf.scene;

        // Measure raw bbox → uniform scale to fill the arena, recenter on XZ,
        // and drop the floor to y≈0.
        const bbox = new THREE.Box3().setFromObject(root);
        const size = bbox.getSize(new THREE.Vector3());
        const center = bbox.getCenter(new THREE.Vector3());
        const longestXZ = Math.max(size.x, size.z) || 1;
        const scale = this.targetExtent / longestXZ;
        root.scale.setScalar(scale);
        root.position.set(-center.x * scale, -bbox.min.y * scale, -center.z * scale);
        root.updateMatrixWorld(true);

        root.traverse((child) => {
          const m = child as THREE.Mesh;
          if (m.isMesh) {
            m.castShadow = true;
            m.receiveShadow = true;
          }
        });

        this.group.add(root);
        scene.add(this.group);

        this.buildCollider(root);
        this.ready = !!this.bvh;
        onReady?.();
      },
      undefined,
      (err) => {
        if (this.disposed) return; // engine already torn down — don't fire onReady
        // Non-fatal: gameplay still works on the engine's flat fallback plane.
        // eslint-disable-next-line no-console
        console.warn("[DungeonMap] failed to load:", url, err);
        onReady?.();
      },
    );
  }

  /** Merge every static mesh into one world-space geometry and build the BVH. */
  private buildCollider(root: THREE.Object3D) {
    root.updateMatrixWorld(true);
    const geoms: THREE.BufferGeometry[] = [];
    root.traverse((child) => {
      const m = child as THREE.Mesh;
      if (!m.isMesh || !m.geometry) return;
      if ((m as THREE.SkinnedMesh).isSkinnedMesh) return; // skinned props can't bake to a static collider
      // Position-only, non-indexed, baked into world space so the BVH lives in
      // the same frame as the player.
      let g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
      for (const attr of Object.keys(g.attributes)) {
        if (attr !== "position") g.deleteAttribute(attr);
      }
      g.applyMatrix4(m.matrixWorld);
      geoms.push(g);
    });
    if (geoms.length === 0) return;

    const merged = mergeGeometries(geoms, false);
    for (const g of geoms) g.dispose();
    if (!merged) return;

    this.colliderGeo = merged;
    this.bvh = new MeshBVH(merged);

    merged.computeBoundingBox();
    const bb = merged.boundingBox!;
    this.bounds.set(
      new THREE.Vector2(bb.min.x, bb.min.z),
      new THREE.Vector2(bb.max.x, bb.max.z),
    );
  }

  /**
   * Floor height under (x, z), or null if there's no floor there. Probes
   * DOWNWARD from `fromY` and returns the first (highest) surface below it, so
   * passing the actor's current foot height + a small step-up allowance finds
   * the floor *under* the actor and never snaps onto ceilings/roofs overhead.
   * `fromY` defaults high for generic top-down queries (e.g. cursor markers).
   */
  sampleFloorY(x: number, z: number, fromY = 1000): number | null {
    if (!this.bvh) return null;
    this._down.origin.set(x, fromY, z);
    this._down.direction.set(0, -1, 0);
    const hit = this.bvh.raycastFirst(this._down, THREE.DoubleSide);
    return hit ? hit.point.y : null;
  }

  /** World floor point under a camera ray (for click-to-move), or null. */
  floorPickFromRay(ray: THREE.Ray): THREE.Vector3 | null {
    if (!this.bvh) return null;
    const hit = this.bvh.raycastFirst(ray, THREE.DoubleSide);
    return hit ? hit.point.clone() : null;
  }

  /**
   * Slide a capsule (vertical, foot at `pos.y`) out of the map's walls, mutating
   * `pos.x`/`pos.z` in place. Only the HORIZONTAL component of each contact is
   * applied — vertical placement is owned by `sampleFloorY` — so flat floors
   * never lift the player and walls never let them through.
   */
  collideHorizontal(pos: THREE.Vector3, radius: number, height: number) {
    if (!this.bvh) return;
    const footY = pos.y;
    this._seg.start.set(pos.x, footY + radius, pos.z);
    this._seg.end.set(pos.x, footY + Math.max(height - radius, radius), pos.z);

    for (let iter = 0; iter < 4; iter++) {
      this._box.makeEmpty();
      this._box.expandByPoint(this._seg.start);
      this._box.expandByPoint(this._seg.end);
      this._box.min.addScalar(-radius);
      this._box.max.addScalar(radius);

      let moved = false;
      this.bvh.shapecast({
        intersectsBounds: (box: THREE.Box3) => box.intersectsBox(this._box),
        intersectsTriangle: (tri: ExtendedTriangle) => {
          const dist = tri.closestPointToSegment(this._seg, this._triPt, this._capPt);
          if (dist < radius) {
            this._dir.copy(this._capPt).sub(this._triPt);
            this._dir.y = 0; // horizontal slide only
            const len = this._dir.length();
            if (len > 1e-5) {
              this._dir.multiplyScalar(1 / len);
              const depth = radius - dist;
              this._seg.start.addScaledVector(this._dir, depth);
              this._seg.end.addScaledVector(this._dir, depth);
              moved = true;
            }
          }
          return false;
        },
      });
      if (!moved) break;
    }

    pos.x = this._seg.start.x;
    pos.z = this._seg.start.z;
  }

  /** Keep (x, z) inside the map bounds (safety net for BVH gaps / open doors). */
  clampXZ(pos: THREE.Vector3, inset = 1) {
    if (!this.ready) return;
    pos.x = THREE.MathUtils.clamp(pos.x, this.bounds.min.x + inset, this.bounds.max.x - inset);
    pos.z = THREE.MathUtils.clamp(pos.z, this.bounds.min.y + inset, this.bounds.max.y - inset);
  }

  dispose() {
    this.disposed = true;
    this.group.userData.disposed = true;
    this.disposeObject(this.group);
    this.group.parent?.remove(this.group);
    this.colliderGeo?.dispose();
    this.colliderGeo = null;
    this.bvh = null;
    this.ready = false;
  }

  private disposeObject(root: THREE.Object3D) {
    const geos = new Set<THREE.BufferGeometry>();
    const mats = new Set<THREE.Material>();
    root.traverse((c) => {
      const m = c as THREE.Mesh;
      if (!m.isMesh) return;
      if (m.geometry) geos.add(m.geometry);
      const list = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
      for (const mat of list) mats.add(mat);
    });
    for (const g of geos) g.dispose();
    for (const mat of mats) {
      for (const v of Object.values(mat)) {
        if (v && (v as THREE.Texture).isTexture) (v as THREE.Texture).dispose();
      }
      mat.dispose();
    }
  }
}
