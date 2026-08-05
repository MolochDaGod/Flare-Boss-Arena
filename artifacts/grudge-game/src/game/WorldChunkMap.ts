/**
 * Deployed world-chunk visuals — subtle zone rings, claim pads, chunk grid.
 * Kept low-profile so nothing giant sits in the middle of the map.
 */
import * as THREE from "three";
import type { WorldChunkManifest, WorldZone } from "../data/worldZones";

export interface WorldChunkMapHandle {
  group: THREE.Group;
  manifest: WorldChunkManifest;
  markClaimed: (zoneId: string) => void;
  dispose: () => void;
}

export function buildWorldChunkMap(
  scene: THREE.Scene,
  manifest: WorldChunkManifest,
): WorldChunkMapHandle {
  const group = new THREE.Group();
  group.name = "WorldChunkMap";
  const zoneMeshes = new Map<string, THREE.Mesh>();

  // Soft chunk grid (subtle — not solid planes that read as “big object”)
  const tile = (manifest.halfExtent * 2) / 3;
  const lineMat = new THREE.LineBasicMaterial({
    color: 0xc5a059,
    transparent: true,
    opacity: 0.12,
    depthWrite: false,
  });
  for (const ch of manifest.deployedChunks) {
    const cx = ch.cx * tile + tile * 0.5 - manifest.halfExtent;
    const cz = ch.cz * tile + tile * 0.5 - manifest.halfExtent;
    const half = tile * 0.46;
    const pts = [
      new THREE.Vector3(cx - half, 0.06, cz - half),
      new THREE.Vector3(cx + half, 0.06, cz - half),
      new THREE.Vector3(cx + half, 0.06, cz + half),
      new THREE.Vector3(cx - half, 0.06, cz + half),
      new THREE.Vector3(cx - half, 0.06, cz - half),
    ];
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    group.add(new THREE.Line(geo, lineMat));
  }

  for (const z of manifest.zones) {
    // Spawn hub: only a small pad — no giant ring in map center
    if (z.kind === "outpost" && Math.hypot(z.x, z.z) < 4) {
      const pad = makeClaimPad(z, 1.6);
      pad.position.set(z.x, 0.05, z.z);
      group.add(pad);
      zoneMeshes.set(z.id, pad);
      continue;
    }

    const ring = makeZoneRing(z);
    ring.position.set(z.x, 0.06, z.z);
    group.add(ring);
    zoneMeshes.set(z.id, ring);

    if (z.claimable) {
      const pad = makeClaimPad(z, 1.8);
      pad.position.set(z.x, 0.05, z.z);
      group.add(pad);
    }

    // Compact name billboard (not 8m sprites) — include area level
    if (z.kind === "harbor" || z.kind === "boss_gate" || z.claimable || z.density >= 0.7) {
      const label = makeZoneLabel(z);
      label.position.set(z.x, 1.8, z.z);
      group.add(label);
    }
  }

  scene.add(group);

  return {
    group,
    manifest,
    markClaimed: (zoneId: string) => {
      const z = manifest.zones.find((x) => x.id === zoneId);
      if (z) z.owner = "player";
      const mesh = zoneMeshes.get(zoneId);
      if (mesh) {
        const mat = mesh.material as THREE.MeshBasicMaterial | THREE.MeshStandardMaterial;
        if ("color" in mat) mat.color.setHex(0x53ddb0);
        if ("opacity" in mat) mat.opacity = 0.5;
      }
    },
    dispose: () => {
      scene.remove(group);
      group.traverse((c) => {
        const m = c as THREE.Mesh;
        if (m.isMesh) {
          m.geometry?.dispose();
          const mat = m.material;
          if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
          else (mat as THREE.Material | undefined)?.dispose?.();
        }
        if ((c as THREE.Line).isLine) {
          const l = c as THREE.Line;
          l.geometry?.dispose();
          (l.material as THREE.Material)?.dispose?.();
        }
        if ((c as THREE.Sprite).isSprite) {
          const s = c as THREE.Sprite;
          (s.material as THREE.SpriteMaterial).map?.dispose();
          (s.material as THREE.Material).dispose();
        }
      });
    },
  };
}

function makeZoneRing(z: WorldZone): THREE.Mesh {
  // Thin annulus — never a filled disk that blocks the map
  const outer = Math.min(z.radius, 16);
  const inner = Math.max(outer * 0.92, outer - 0.55);
  const geo = new THREE.RingGeometry(inner, outer, 40);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({
    color: z.color,
    transparent: true,
    opacity: z.claimable ? 0.28 : 0.14,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = `zone_ring_${z.id}`;
  mesh.userData.zoneId = z.id;
  mesh.renderOrder = 2;
  return mesh;
}

function makeClaimPad(z: WorldZone, radius = 1.8): THREE.Mesh {
  const geo = new THREE.CircleGeometry(radius, 20);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshStandardMaterial({
    color: z.owner === "player" ? 0x53ddb0 : 0x2a3a55,
    emissive: z.owner === "player" ? 0x1a4433 : 0x0a1520,
    emissiveIntensity: 0.4,
    transparent: true,
    opacity: 0.45,
    roughness: 0.75,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = `claim_pad_${z.id}`;
  mesh.userData.zoneId = z.id;
  mesh.receiveShadow = true;
  return mesh;
}

function makeZoneLabel(z: WorldZone): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 48;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, 256, 48);
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.roundRect?.(8, 8, 240, 32, 4);
  if (!ctx.roundRect) ctx.fillRect(8, 8, 240, 32);
  else ctx.fill();
  ctx.fillStyle = "#e8d5a3";
  ctx.font = "bold 15px Cinzel, serif";
  ctx.textAlign = "center";
  const lvl = typeof z.areaLevel === "number" ? `  L${z.areaLevel}` : "";
  ctx.fillText((z.name.slice(0, 18) + lvl).slice(0, 26), 128, 30);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    opacity: 0.75,
  });
  const spr = new THREE.Sprite(mat);
  // Human-readable world size (~3m wide), not 8m billboards
  spr.scale.set(3.2, 0.6, 1);
  spr.name = `zone_label_${z.id}`;
  return spr;
}
