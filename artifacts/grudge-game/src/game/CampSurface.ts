/**
 * Capital Harbor (camp) terrain surface — MeshBVH + optional Rapier ground.
 *
 * Clean split of responsibilities (fleet SSOT):
 *  - MeshBVH: floor pick (click-to-move), foot height sample, horizontal capsule slide
 *  - Rapier: fixed ground slab (physics world ready; camp locomotion stays BVH-driven)
 *
 * Mirrors DungeonMap patterns so /camp and /game share the same collider mental model.
 */
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { MeshBVH, type ExtendedTriangle } from "three-mesh-bvh";
import { RapierWorld } from "./physics/RapierWorld";

export interface CampSurfaceOptions {
  /** Play radius (circle harbor). */
  bounds: number;
  scene: THREE.Scene;
  /** Visual underlay color. */
  groundColor?: number;
}

export class CampSurface {
  readonly group = new THREE.Group();
  ready = false;

  private bvh: MeshBVH | null = null;
  private colliderGeo: THREE.BufferGeometry | null = null;
  private groundMesh: THREE.Mesh | null = null;
  private rapier: RapierWorld | null = null;
  private disposed = false;
  private readonly bounds: number;
  private readonly scene: THREE.Scene;

  private readonly _seg = new THREE.Line3();
  private readonly _box = new THREE.Box3();
  private readonly _triPt = new THREE.Vector3();
  private readonly _capPt = new THREE.Vector3();
  private readonly _dir = new THREE.Vector3();
  private readonly _down = new THREE.Ray(new THREE.Vector3(), new THREE.Vector3(0, -1, 0));

  constructor(opts: CampSurfaceOptions) {
    this.bounds = opts.bounds;
    this.scene = opts.scene;
    this.group.name = "campSurface";
    this.scene.add(this.group);
    this.mountGround(opts.groundColor ?? 0x0e0c0a);
    // Immediate flat BVH so raycasts work before tileable scatter streams in
    this.rebuildFromRoots([]);
  }

  /** Visible flat harbor pad under the tileable grass/stone grid. */
  private mountGround(color: number) {
    const geo = new THREE.CircleGeometry(this.bounds + 2, 64);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshStandardMaterial({
      color,
      roughness: 1,
      metalness: 0,
    });
    this.groundMesh = new THREE.Mesh(geo, mat);
    this.groundMesh.position.y = -0.02;
    this.groundMesh.receiveShadow = true;
    this.groundMesh.name = "campGroundPad";
    this.groundMesh.userData.campCollider = true;
    this.group.add(this.groundMesh);
  }

  /**
   * Rebuild MeshBVH from ground + static roots (tileable scatter, walls, stations).
   * Skips skinned meshes and instanced floor (too many tiles); walls/trees bake cleanly.
   */
  rebuildFromRoots(roots: THREE.Object3D[]) {
    if (this.disposed) return;
    const geoms: THREE.BufferGeometry[] = [];

    const bakeMesh = (m: THREE.Mesh) => {
      if (!m.geometry) return;
      if ((m as THREE.SkinnedMesh).isSkinnedMesh) return;
      if ((m as THREE.InstancedMesh).isInstancedMesh) return;
      // Skip pure floor grass cards that are near-flat already covered by pad
      if (/grass|floor_tile|instance/i.test(m.name) && m.userData.campCollider !== true) {
        // still bake tall props
        const box = new THREE.Box3().setFromObject(m);
        const size = box.getSize(new THREE.Vector3());
        if (size.y < 0.35) return;
      }
      let g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
      for (const attr of Object.keys(g.attributes)) {
        if (attr !== "position") g.deleteAttribute(attr);
      }
      m.updateWorldMatrix(true, false);
      g.applyMatrix4(m.matrixWorld);
      geoms.push(g);
    };

    // Always include ground pad
    if (this.groundMesh) bakeMesh(this.groundMesh);

    for (const root of roots) {
      if (!root) continue;
      root.updateMatrixWorld(true);
      root.traverse((child) => {
        const m = child as THREE.Mesh;
        if (!m.isMesh) return;
        bakeMesh(m);
      });
    }

    // Dispose previous collider
    this.colliderGeo?.dispose();
    this.colliderGeo = null;
    this.bvh = null;

    if (geoms.length === 0) {
      this.ready = false;
      return;
    }

    // Cap triangle budget: if too many pieces, keep ground + densest first
    const MAX_GEOMS = 120;
    const use = geoms.length > MAX_GEOMS ? geoms.slice(0, MAX_GEOMS) : geoms;
    const merged = mergeGeometries(use, false);
    for (const g of geoms) g.dispose();
    if (!merged) {
      this.ready = false;
      return;
    }

    this.colliderGeo = merged;
    this.bvh = new MeshBVH(merged);
    this.ready = true;
  }

  /** Lazy Rapier fixed ground (SI gravity) — optional physics path. */
  async initRapier(): Promise<void> {
    if (this.disposed || this.rapier) return;
    try {
      const world = new RapierWorld();
      const ok = await world.init({
        gravityY: -9.81,
        groundHalfExtents: { x: this.bounds + 4, y: 0.5, z: this.bounds + 4 },
      });
      if (ok && !this.disposed) this.rapier = world;
      else world.dispose();
    } catch (err) {
      if (import.meta.env.DEV) {
        console.warn("[CampSurface] Rapier init skipped:", err);
      }
    }
  }

  stepRapier(dt: number) {
    this.rapier?.step(dt);
  }

  get rapierReady(): boolean {
    return !!this.rapier?.ready;
  }

  sampleFloorY(x: number, z: number, fromY = 40): number {
    if (!this.bvh) return 0;
    this._down.origin.set(x, fromY, z);
    this._down.direction.set(0, -1, 0);
    const hit = this.bvh.raycastFirst(this._down, THREE.DoubleSide);
    return hit ? hit.point.y : 0;
  }

  floorPickFromRay(ray: THREE.Ray): THREE.Vector3 | null {
    if (this.bvh) {
      const hit = this.bvh.raycastFirst(ray, THREE.DoubleSide);
      if (hit) return hit.point.clone();
    }
    // Fallback plane y=0
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const pt = new THREE.Vector3();
    if (ray.intersectPlane(plane, pt)) return pt;
    return null;
  }

  /** Horizontal capsule slide against walls/props (feet Y owned by sampleFloorY). */
  collideHorizontal(pos: THREE.Vector3, radius = 0.42, height = 1.75) {
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
            this._dir.y = 0;
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

  clampXZ(pos: THREE.Vector3, inset = 1) {
    const B = this.bounds - inset;
    pos.x = THREE.MathUtils.clamp(pos.x, -B, B);
    pos.z = THREE.MathUtils.clamp(pos.z, -B, B);
  }

  dispose() {
    this.disposed = true;
    this.rapier?.dispose();
    this.rapier = null;
    this.colliderGeo?.dispose();
    this.colliderGeo = null;
    this.bvh = null;
    this.groundMesh?.geometry.dispose();
    (this.groundMesh?.material as THREE.Material | undefined)?.dispose();
    this.groundMesh = null;
    this.scene.remove(this.group);
    this.ready = false;
  }
}
