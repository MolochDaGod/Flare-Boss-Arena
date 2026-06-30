import type RAPIER from "@dimforge/rapier3d-compat";

let rapierModule: typeof RAPIER | null = null;
let initPromise: Promise<typeof RAPIER> | null = null;

/** Lazily load Rapier's WASM bundle once per tab. */
export async function ensureRapier(): Promise<typeof RAPIER> {
  if (rapierModule) return rapierModule;
  if (!initPromise) {
    initPromise = import("@dimforge/rapier3d-compat").then(async (mod) => {
      const R = mod.default;
      await R.init();
      rapierModule = R;
      return R;
    });
  }
  return initPromise;
}

export interface RapierWorldOptions {
  gravityY?: number;
  /** Half-extents of the infinite ground slab (world units). */
  groundHalfExtents?: { x: number; y: number; z: number };
}

/**
 * Thin vanilla-Three wrapper around a Rapier simulation world.
 * GameEngine can keep MeshBVH for floor picking while Rapier handles
 * dynamic bodies (projectiles, ragdolls, pushables) in a later pass.
 */
export class RapierWorld {
  private rapier: typeof RAPIER | null = null;
  private world: RAPIER.World | null = null;
  private groundBody: RAPIER.RigidBody | null = null;
  private disposed = false;
  private _ready = false;

  get ready(): boolean {
    return this._ready;
  }

  async init(opts: RapierWorldOptions = {}): Promise<boolean> {
    if (this.disposed) return false;

    const R = await ensureRapier();
    const gravityY = opts.gravityY ?? -9.81;
    const half = opts.groundHalfExtents ?? { x: 200, y: 0.5, z: 200 };

    this.rapier = R;
    this.world = new R.World({ x: 0, y: gravityY, z: 0 });

    const groundDesc = R.RigidBodyDesc.fixed();
    this.groundBody = this.world.createRigidBody(groundDesc);
    const groundCol = R.ColliderDesc.cuboid(half.x, half.y, half.z);
    this.world.createCollider(groundCol, this.groundBody);

    this._ready = true;
    return true;
  }

  get simulation(): RAPIER.World | null {
    return this.world;
  }

  step(dt: number): void {
    if (!this.world || dt <= 0) return;
    this.world.timestep = dt;
    this.world.step();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.groundBody = null;
    if (this.world) {
      this.world.free();
      this.world = null;
    }
    this.rapier = null;
    this._ready = false;
  }
}