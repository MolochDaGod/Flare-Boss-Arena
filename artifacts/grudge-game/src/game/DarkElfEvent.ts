/**
 * Dark Elf Crystal Event — ritual crystal + 4 assets around it, barrier walls,
 * and spawns. All damageable structures carry HP; barriers also block movement.
 *
 * The four assets are the registered dark-elf Unity structures when present
 * (camp / encampment / stronghold / castle) as scaled satellite props; otherwise
 * procedural pylons + dark_elf.glb wardens stand in so the event always plays.
 */

import * as THREE from "three";
import type { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  UNITY_INSTANCES,
  resolveInstanceUrl,
  type UnityInstanceDef,
} from "../data/unityInstances";
import { DARK_ELF_SENTRY_URL } from "./DarkElfCamp";

export type StructureKind = "crystal" | "pylon" | "barrier" | "asset";

export interface DamageableStructure {
  id: string;
  kind: StructureKind;
  name: string;
  hp: number;
  maxHp: number;
  alive: boolean;
  /** World-space center (foot). */
  position: THREE.Vector3;
  /** Horizontal hit radius for melee. */
  hitRadius: number;
  /** Optional AABB half-extents for collision (barriers). */
  halfX: number;
  halfZ: number;
  group: THREE.Object3D;
  /** Flash / tint root. */
  meshRoot: THREE.Object3D;
}

export interface DarkElfEventHandle {
  group: THREE.Group;
  center: THREE.Vector3;
  crystal: DamageableStructure;
  structures: DamageableStructure[];
  /** Preferred dark-elf spawn points (world). */
  spawnSpots: THREE.Vector3[];
  /** Wisp anchors near the ritual. */
  wispSpots: THREE.Vector3[];
  /** Push capsule out of living barrier AABBs. */
  collideHorizontal: (pos: THREE.Vector3, radius: number) => void;
  /** Nearest living structure in range, or null. */
  nearestStructure: (pos: THREE.Vector3, maxDist: number) => DamageableStructure | null;
  /** Apply damage; returns true if the structure died this hit. */
  damageStructure: (s: DamageableStructure, dmg: number) => boolean;
  /** True while crystal still lives (event active). */
  isActive: () => boolean;
  dispose: () => void;
}

const FOUR_DARK_ELF_ASSETS = ["dark_elf_camp", "dark_elf_encampment", "dark_elf_stronghold", "dark_elf_castle"] as const;

function applyVoidTint(root: THREE.Object3D) {
  root.traverse((c) => {
    const mesh = c as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      const m = mat as THREE.MeshStandardMaterial;
      if (!m.color) continue;
      const hsl = { h: 0, s: 0, l: 0 };
      m.color.getHSL(hsl);
      m.color.setHSL(0.76, Math.min(0.65, hsl.s * 0.7 + 0.28), hsl.l * 0.62);
      if (m.emissive) {
        m.emissive.setHex(0x3a1060);
        m.emissiveIntensity = Math.max(m.emissiveIntensity ?? 0, 0.25);
      }
    }
  });
}

function makeHpBar(maxW = 1.4): THREE.Group {
  const g = new THREE.Group();
  g.name = "hp_bar";
  const bg = new THREE.Mesh(
    new THREE.PlaneGeometry(maxW, 0.1),
    new THREE.MeshBasicMaterial({ color: 0x1a0a18, transparent: true, opacity: 0.75, depthWrite: false }),
  );
  const fg = new THREE.Mesh(
    new THREE.PlaneGeometry(maxW, 0.08),
    new THREE.MeshBasicMaterial({ color: 0xaa44ff, transparent: true, opacity: 0.95, depthWrite: false }),
  );
  fg.position.z = 0.01;
  fg.name = "hp_fg";
  g.add(bg, fg);
  g.userData.maxW = maxW;
  g.userData.fg = fg;
  return g;
}

function setHpBar(bar: THREE.Group, ratio: number) {
  const fg = bar.userData.fg as THREE.Mesh | undefined;
  const maxW = (bar.userData.maxW as number) ?? 1.4;
  if (!fg) return;
  const r = Math.max(0, Math.min(1, ratio));
  fg.scale.x = Math.max(0.001, r);
  fg.position.x = -((1 - r) * maxW) * 0.5;
  const mat = fg.material as THREE.MeshBasicMaterial;
  mat.color.setHex(r > 0.45 ? 0xaa44ff : r > 0.2 ? 0xff8844 : 0xff3344);
}

function pushOutAabb(
  pos: THREE.Vector3,
  radius: number,
  cx: number,
  cz: number,
  halfX: number,
  halfZ: number,
): boolean {
  const minX = cx - halfX - radius;
  const maxX = cx + halfX + radius;
  const minZ = cz - halfZ - radius;
  const maxZ = cz + halfZ + radius;
  if (pos.x <= minX || pos.x >= maxX || pos.z <= minZ || pos.z >= maxZ) return false;
  const pushL = pos.x - minX;
  const pushR = maxX - pos.x;
  const pushD = pos.z - minZ;
  const pushU = maxZ - pos.z;
  const m = Math.min(pushL, pushR, pushD, pushU);
  if (m === pushL) pos.x = minX;
  else if (m === pushR) pos.x = maxX;
  else if (m === pushD) pos.z = minZ;
  else pos.z = maxZ;
  return true;
}

function flashDamage(root: THREE.Object3D) {
  root.traverse((c) => {
    const m = c as THREE.Mesh;
    if (!m.isMesh) return;
    const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
    for (const mat of mats) {
      const sm = mat as THREE.MeshStandardMaterial;
      if (sm.emissive) {
        sm.userData._flash = (sm.userData._flash as number | undefined) ?? sm.emissiveIntensity;
        sm.emissiveIntensity = Math.min(3, (sm.emissiveIntensity ?? 0.2) + 1.4);
      }
    }
  });
  // Decay flash next frames via userData timer on root
  root.userData.flashT = 0.18;
}

function updateFlash(root: THREE.Object3D, dt: number) {
  const t = (root.userData.flashT as number | undefined) ?? 0;
  if (t <= 0) return;
  const next = t - dt;
  root.userData.flashT = next;
  if (next > 0) return;
  root.traverse((c) => {
    const m = c as THREE.Mesh;
    if (!m.isMesh) return;
    const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
    for (const mat of mats) {
      const sm = mat as THREE.MeshStandardMaterial;
      if (sm.emissive && sm.userData._flash != null) {
        sm.emissiveIntensity = sm.userData._flash as number;
      }
    }
  });
}

/**
 * Build the dark-elf crystal event at `center` (world).
 */
export function buildDarkElfCrystalEvent(
  loader: GLTFLoader,
  scene: THREE.Scene,
  center: THREE.Vector3,
): DarkElfEventHandle {
  const group = new THREE.Group();
  group.name = "dark_elf_crystal_event";
  group.position.copy(center);
  scene.add(group);

  const structures: DamageableStructure[] = [];
  const spawnSpots: THREE.Vector3[] = [];
  const wispSpots: THREE.Vector3[] = [];
  let disposed = false;

  // ── Central crystal (high HP, event heart) ───────────────────────────────
  const crystalRoot = new THREE.Group();
  crystalRoot.name = "event_crystal";
  const crystalMat = new THREE.MeshStandardMaterial({
    color: 0xc080ff,
    emissive: 0x7711cc,
    emissiveIntensity: 1.35,
    metalness: 0.45,
    roughness: 0.18,
    transparent: true,
    opacity: 0.94,
  });
  const crystalMesh = new THREE.Mesh(new THREE.OctahedronGeometry(1.35, 0), crystalMat);
  crystalMesh.position.y = 2.4;
  crystalMesh.castShadow = true;
  crystalRoot.add(crystalMesh);
  // Pedestal
  const pedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(1.4, 1.8, 0.55, 8),
    new THREE.MeshStandardMaterial({ color: 0x2a1838, roughness: 0.85, metalness: 0.2 }),
  );
  pedestal.position.y = 0.28;
  pedestal.castShadow = true;
  pedestal.receiveShadow = true;
  crystalRoot.add(pedestal);
  // Sky beam
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.4, 22, 10, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xaa66ff,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    }),
  );
  beam.position.y = 12;
  crystalRoot.add(beam);
  const crystalBar = makeHpBar(1.8);
  crystalBar.position.set(0, 4.2, 0);
  crystalRoot.add(crystalBar);
  group.add(crystalRoot);

  const crystal: DamageableStructure = {
    id: "de_crystal",
    kind: "crystal",
    name: "Void Crystal",
    hp: 900,
    maxHp: 900,
    alive: true,
    position: center.clone(),
    hitRadius: 2.2,
    halfX: 1.2,
    halfZ: 1.2,
    group: crystalRoot,
    meshRoot: crystalRoot,
  };
  crystalRoot.userData.hpBar = crystalBar;
  structures.push(crystal);

  // ── Four assets around crystal (cardinal ring) ───────────────────────────
  const assetDefs = FOUR_DARK_ELF_ASSETS.map((id) =>
    UNITY_INSTANCES.find((d) => d.id === id),
  ).filter((d): d is UnityInstanceDef => !!d);

  const ringR = 7.5;
  for (let i = 0; i < 4; i++) {
    const ang = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const lx = Math.cos(ang) * ringR;
    const lz = Math.sin(ang) * ringR;
    const holder = new THREE.Group();
    holder.name = `de_asset_${i}`;
    holder.position.set(lx, 0, lz);
    holder.rotation.y = Math.atan2(-lx, -lz);
    group.add(holder);

    // Procedural pylon base (always present)
    const pylon = new THREE.Group();
    const shaft = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 2.6, 0.7),
      new THREE.MeshStandardMaterial({
        color: 0x3a2048,
        emissive: 0x551188,
        emissiveIntensity: 0.45,
        roughness: 0.55,
        metalness: 0.35,
      }),
    );
    shaft.position.y = 1.3;
    shaft.castShadow = true;
    const cap = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.55, 0),
      new THREE.MeshStandardMaterial({
        color: 0xcc88ff,
        emissive: 0x8822cc,
        emissiveIntensity: 1.1,
        metalness: 0.5,
        roughness: 0.2,
      }),
    );
    cap.position.y = 2.85;
    pylon.add(shaft, cap);
    holder.add(pylon);

    const bar = makeHpBar(1.1);
    bar.position.set(0, 3.4, 0);
    holder.add(bar);
    holder.userData.hpBar = bar;

    const def = assetDefs[i];
    const maxHp = def ? 420 + i * 40 : 360;
    const struct: DamageableStructure = {
      id: `de_asset_${i}`,
      kind: "asset",
      name: def?.name ?? `Void Pylon ${i + 1}`,
      hp: maxHp,
      maxHp,
      alive: true,
      position: new THREE.Vector3(center.x + lx, 0, center.z + lz),
      hitRadius: 1.8,
      halfX: 1.1,
      halfZ: 1.1,
      group: holder,
      meshRoot: holder,
    };
    structures.push(struct);

    // Try load Unity asset GLB as scaled satellite prop
    if (def) {
      const urls = [resolveInstanceUrl(def, false), resolveInstanceUrl(def, true)].filter(
        (u, idx, a) => !!u && a.indexOf(u) === idx,
      );
      const tryLoad = (ui: number) => {
        if (disposed || ui >= urls.length) return;
        loader.load(
          urls[ui]!,
          (gltf) => {
            if (disposed || !struct.alive) {
              gltf.scene.traverse((c) => {
                const m = c as THREE.Mesh;
                m.geometry?.dispose();
              });
              return;
            }
            const root = gltf.scene;
            applyVoidTint(root);
            root.updateMatrixWorld(true);
            const box = new THREE.Box3().setFromObject(root);
            const size = new THREE.Vector3();
            box.getSize(size);
            const span = Math.max(size.x, size.z, 0.01);
            // Compact satellite — never dominate the crystal ring
            const target = 4.2;
            root.scale.setScalar(Math.min(1.2, target / span));
            root.updateMatrixWorld(true);
            const b2 = new THREE.Box3().setFromObject(root);
            root.position.y -= b2.min.y;
            root.position.x -= (b2.min.x + b2.max.x) * 0.5;
            root.position.z -= (b2.min.z + b2.max.z) * 0.5;
            root.traverse((c) => {
              const m = c as THREE.Mesh;
              if (m.isMesh) {
                m.castShadow = true;
                m.receiveShadow = true;
                m.frustumCulled = false;
              }
            });
            // Hide oversized procedural pylon if real asset loaded
            pylon.visible = false;
            holder.add(root);
          },
          undefined,
          () => tryLoad(ui + 1),
        );
      };
      tryLoad(0);
    }

    // Guard spawn just outside each asset
    const guardR = ringR + 2.8;
    spawnSpots.push(
      new THREE.Vector3(center.x + Math.cos(ang) * guardR, 0, center.z + Math.sin(ang) * guardR),
    );
    // Wisp between assets (mid-angle)
    const mid = ang + Math.PI / 4;
    wispSpots.push(
      new THREE.Vector3(
        center.x + Math.cos(mid) * (ringR + 5.5),
        0,
        center.z + Math.sin(mid) * (ringR + 5.5),
      ),
    );
  }

  // ── Barrier wall segments (destructible ring segments between assets) ────
  const barrierCount = 8;
  const barrierR = 11.5;
  for (let i = 0; i < barrierCount; i++) {
    const ang = (i / barrierCount) * Math.PI * 2;
    const lx = Math.cos(ang) * barrierR;
    const lz = Math.sin(ang) * barrierR;
    const holder = new THREE.Group();
    holder.position.set(lx, 0, lz);
    holder.rotation.y = ang + Math.PI / 2;
    holder.name = `de_barrier_${i}`;

    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(3.2, 2.4, 0.55),
      new THREE.MeshStandardMaterial({
        color: 0x2a1835,
        emissive: 0x3a1060,
        emissiveIntensity: 0.35,
        roughness: 0.78,
        metalness: 0.25,
      }),
    );
    wall.position.y = 1.2;
    wall.castShadow = true;
    wall.receiveShadow = true;
    holder.add(wall);
    // Spike tips
    for (const sx of [-1.1, 0, 1.1]) {
      const spike = new THREE.Mesh(
        new THREE.ConeGeometry(0.18, 0.55, 5),
        new THREE.MeshStandardMaterial({
          color: 0x6622aa,
          emissive: 0x440088,
          emissiveIntensity: 0.6,
        }),
      );
      spike.position.set(sx, 2.55, 0);
      holder.add(spike);
    }
    const bar = makeHpBar(1.0);
    bar.position.set(0, 2.9, 0);
    holder.add(bar);
    holder.userData.hpBar = bar;
    group.add(holder);

    // World-oriented AABB for collision (approx square after rotation)
    const worldX = center.x + lx;
    const worldZ = center.z + lz;
    structures.push({
      id: `de_barrier_${i}`,
      kind: "barrier",
      name: "Void Barrier",
      hp: 220,
      maxHp: 220,
      alive: true,
      position: new THREE.Vector3(worldX, 0, worldZ),
      hitRadius: 2.0,
      halfX: 1.55,
      halfZ: 0.55,
      group: holder,
      meshRoot: holder,
    });
  }

  // Extra outer patrol spawns
  for (let i = 0; i < 4; i++) {
    const ang = (i / 4) * Math.PI * 2;
    spawnSpots.push(
      new THREE.Vector3(center.x + Math.cos(ang) * 15, 0, center.z + Math.sin(ang) * 15),
    );
  }

  // Decorative wardens (visual; combat enemies spawned by GameEngine)
  for (let i = 0; i < 4; i++) {
    const ang = (i / 4) * Math.PI * 2 + 0.2;
    const spot = new THREE.Vector3(Math.cos(ang) * 5.2, 0, Math.sin(ang) * 5.2);
    loader.load(
      DARK_ELF_SENTRY_URL,
      (gltf) => {
        if (disposed) return;
        const s = gltf.scene.clone(true);
        const box = new THREE.Box3().setFromObject(s);
        const size = new THREE.Vector3();
        box.getSize(size);
        const h = Math.max(size.y, 0.01);
        s.scale.setScalar(1.85 / h);
        s.position.copy(spot);
        s.position.y = 0;
        s.rotation.y = Math.atan2(-spot.x, -spot.z);
        applyVoidTint(s);
        s.traverse((c) => {
          const m = c as THREE.Mesh;
          if (m.isMesh) {
            m.castShadow = true;
            m.receiveShadow = true;
            m.frustumCulled = false;
          }
        });
        group.add(s);
      },
      undefined,
      () => {
        /* optional */
      },
    );
  }

  const handle: DarkElfEventHandle = {
    group,
    center: center.clone(),
    crystal,
    structures,
    spawnSpots,
    wispSpots,
    collideHorizontal(pos, radius) {
      // Multi-pass so corners between barriers don't tunnel. Barriers are
      // rotated on Y — resolve in each barrier's local frame then map back.
      for (let iter = 0; iter < 8; iter++) {
        let moved = false;
        for (const s of structures) {
          if (!s.alive) continue;
          if (s.kind !== "barrier" && s.kind !== "crystal" && s.kind !== "asset") continue;
          if (s.kind === "barrier") {
            // Local X = wall length, local Z = thickness
            const yaw = s.group.rotation.y + group.rotation.y;
            const cos = Math.cos(-yaw);
            const sin = Math.sin(-yaw);
            const dx = pos.x - s.position.x;
            const dz = pos.z - s.position.z;
            let lx = dx * cos - dz * sin;
            let lz = dx * sin + dz * cos;
            const hx = s.halfX + radius;
            const hz = s.halfZ + radius;
            if (lx > -hx && lx < hx && lz > -hz && lz < hz) {
              const pushL = lx + hx;
              const pushR = hx - lx;
              const pushD = lz + hz;
              const pushU = hz - lz;
              const m = Math.min(pushL, pushR, pushD, pushU);
              if (m === pushL) lx = -hx;
              else if (m === pushR) lx = hx;
              else if (m === pushD) lz = -hz;
              else lz = hz;
              // Back to world
              const c2 = Math.cos(yaw);
              const s2 = Math.sin(yaw);
              pos.x = s.position.x + lx * c2 - lz * s2;
              pos.z = s.position.z + lx * s2 + lz * c2;
              moved = true;
            }
          } else {
            const hx = s.halfX * 0.95;
            const hz = s.halfZ * 0.95;
            if (pushOutAabb(pos, radius, s.position.x, s.position.z, hx, hz)) moved = true;
          }
        }
        if (!moved) break;
      }
    },
    nearestStructure(pos, maxDist) {
      let best: DamageableStructure | null = null;
      let bestD = maxDist;
      for (const s of structures) {
        if (!s.alive) continue;
        const d = Math.hypot(s.position.x - pos.x, s.position.z - pos.z) - s.hitRadius * 0.35;
        if (d < bestD) {
          bestD = d;
          best = s;
        }
      }
      return best;
    },
    damageStructure(s, dmg) {
      if (!s.alive || dmg <= 0) return false;
      s.hp = Math.max(0, s.hp - dmg);
      flashDamage(s.meshRoot);
      const bar = s.group.userData.hpBar as THREE.Group | undefined;
      if (bar) setHpBar(bar, s.hp / s.maxHp);
      if (s.hp > 0) return false;
      s.alive = false;
      // Collapse: sink + hide
      s.group.visible = false;
      if (s.kind === "crystal") {
        // Shatter beam / deactivate event
        for (const o of structures) {
          if (o.kind === "barrier" && o.alive) {
            o.hp = 0;
            o.alive = false;
            o.group.visible = false;
          }
        }
      }
      return true;
    },
    isActive: () => crystal.alive,
    dispose: () => {
      disposed = true;
      scene.remove(group);
      group.traverse((c) => {
        const m = c as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        if (m.material) {
          const mats = Array.isArray(m.material) ? m.material : [m.material];
          for (const mat of mats) mat.dispose();
        }
      });
    },
  };

  // Face HP bars toward +Z initially; GameEngine can billboard each frame
  for (const s of structures) {
    const bar = s.group.userData.hpBar as THREE.Group | undefined;
    if (bar) setHpBar(bar, 1);
  }

  // Tick helper stored for flash decay (called from GameEngine)
  (handle as DarkElfEventHandle & { updateVisuals?: (dt: number, cam?: THREE.Camera) => void }).updateVisuals = (
    dt: number,
    cam?: THREE.Camera,
  ) => {
    crystalMesh.rotation.y += dt * 0.65;
    crystalMesh.position.y = 2.4 + Math.sin(performance.now() * 0.002) * 0.12;
    for (const s of structures) {
      if (!s.alive) continue;
      updateFlash(s.meshRoot, dt);
      const bar = s.group.userData.hpBar as THREE.Group | undefined;
      if (bar && cam) {
        bar.quaternion.copy(cam.quaternion);
      }
    }
  };

  return handle;
}

export type DarkElfEventWithVisuals = DarkElfEventHandle & {
  updateVisuals?: (dt: number, cam?: THREE.Camera) => void;
};
